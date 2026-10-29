import io
import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime

from app import create_app
from app.models import db
from app.models.lab_order import LabOrder
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User


class EndToEndClinicalWorkflowTestCase(unittest.TestCase):
    """
    Comprehensive integration test suite verifying the end-to-end clinical workflow
    connecting Lab Technician, Doctor/Hepatologist, and Patient dashboards in CirrhoCare AI.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_e2e_clinical.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="e2e_clinical_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "e2e-clinical-workflow-test-key-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "e2e-clinical-workflow-test-key-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # Seed attending hepatologist
            self.doctor = User(name="Dr. Sarah Jenkins", email="sarah.jenkins@hospital.org", role="hepatologist")
            self.doctor.set_password("Doctor@1234")

            # Seed second hepatologist for isolation checks
            self.other_doctor = User(name="Dr. Michael Chang", email="michael.chang@hospital.org", role="hepatologist")
            self.other_doctor.set_password("Doctor@1234")

            # Seed lab technician
            self.labtech = User(name="Alex Rivera", email="alex.rivera@hospital.org", role="labtech")
            self.labtech.set_password("LabTech@1234")

            # Seed admin
            self.admin = User(name="Admin Morgan", email="admin.morgan@hospital.org", role="admin")
            self.admin.set_password("Admin@1234")

            # Seed patient user
            self.patient_user = User(name="David Miller", email="david.miller@patient.org", role="patient", portal_id="CC-2026-0088")
            self.patient_user.set_password("Patient@1234")

            # Seed other patient user
            self.other_patient_user = User(name="Elena Rostova", email="elena@patient.org", role="patient", portal_id="CC-2026-0099")
            self.other_patient_user.set_password("Patient@1234")

            db.session.add_all([
                self.doctor, self.other_doctor, self.labtech, self.admin,
                self.patient_user, self.other_patient_user
            ])
            db.session.commit()

            # Seed clinical patient record
            self.patient = Patient(
                full_name="David Miller",
                portal_id="CC-2026-0088",
                age=52,
                gender="Male",
                email="david.miller@patient.org",
                phone="+1-555-0199",
                created_by_id=self.admin.id,
                assigned_doctor_id=self.doctor.id,
                treatment_status="Awaiting review",
                bilirubin=2.4,
                albumin=3.1,
                platelets=145.0,
            )
            db.session.add(self.patient)
            db.session.commit()

            self.patient_id = self.patient.id
            self.doctor_id = self.doctor.id
            self.labtech_id = self.labtech.id
            self.patient_user_id = self.patient_user.id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

        if os.path.exists(self.db_path):
            try:
                os.remove(self.db_path)
            except OSError:
                pass

        if os.path.exists(self.temp_upload_dir):
            try:
                shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _logout(self):
        return self.client.post("/api/auth/logout")

    def test_01_labtech_cannot_unilaterally_cancel_or_mark_no_test_needed(self):
        """
        Verify clinical safeguard rule:
        Lab tech cannot unilaterally mark 'Cancelled' or 'No Test Needed'.
        """
        # Doctor orders a test
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        order_res = self.client.post(f"/api/patients/{self.patient_id}/lab-orders", json={
            "test_type": "Liver Function Test (LFT)",
            "priority": "Routine",
            "clinical_indication": "Routine post-initiation monitoring",
        })
        self.assertEqual(order_res.status_code, 201)
        order_id = order_res.get_json()["order"]["id"]
        self._logout()

        # Lab tech logs in
        self._login("alex.rivera@hospital.org", "LabTech@1234")

        # Attempt to cancel -> must be rejected with 403 Forbidden
        cancel_res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={
            "status": "Cancelled"
        })
        self.assertEqual(cancel_res.status_code, 403)
        self.assertIn("cannot cancel clinical orders", cancel_res.get_json()["error"])

        # Attempt to decide "No Test Needed" -> must be rejected with 403 Forbidden
        no_test_res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={
            "status": "No Test Needed"
        })
        self.assertEqual(no_test_res.status_code, 403)
        self.assertIn("Only an attending physician", no_test_res.get_json()["error"])

        # Verify order status remains 'Ordered'
        get_res = self.client.get(f"/api/lab-orders/{order_id}")
        self.assertEqual(get_res.get_json()["order"]["order_status"], "Ordered")
        self._logout()

    def test_02_labtech_clarification_and_doctor_approval_workflow(self):
        """
        Verify clarification request and doctor decision lifecycle:
        1. Lab tech requests clarification with clinical reason.
        2. Doctor reviews clarification request.
        3. Doctor approves 'No Test Needed' with clinical rationale.
        """
        # Doctor orders test
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        order_res = self.client.post(f"/api/patients/{self.patient_id}/lab-orders", json={
            "test_type": "Coagulation Profile (PT/INR)",
            "priority": "Urgent",
            "clinical_indication": "Pre-procedural assessment",
        })
        order_id = order_res.get_json()["order"]["id"]
        self._logout()

        # Lab tech requests clarification
        self._login("alex.rivera@hospital.org", "LabTech@1234")
        clarify_res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={
            "status": "Clarification Required",
            "reason": "Patient is not on anticoagulation and INR was performed 48h ago. Please confirm necessity.",
        })
        self.assertEqual(clarify_res.status_code, 200)
        order_data = clarify_res.get_json()["order"]
        self.assertEqual(order_data["order_status"], "Clarification Required")
        self.assertEqual(order_data["status_reason"], "Patient is not on anticoagulation and INR was performed 48h ago. Please confirm necessity.")
        self.assertIsNotNone(order_data["clarification_requested_at"])
        self._logout()

        # Doctor logs in, inspects clarification, and decides "No Test Needed"
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        decision_res = self.client.post(f"/api/lab-orders/{order_id}/decision", json={
            "decision": "No Test Needed",
            "notes": "Reviewed 48h prior INR (1.1). Stable trajectory; repeat test not clinically required at this time.",
        })
        self.assertEqual(decision_res.status_code, 200)
        decided_order = decision_res.get_json()["order"]
        self.assertEqual(decided_order["order_status"], "No Test Needed")
        self.assertEqual(decided_order["doctor_decision"], "No Test Needed")
        self.assertIn("prior INR", decided_order["doctor_notes"])
        self.assertEqual(decided_order["doctor_decision_by"], "Dr. Sarah Jenkins")
        self._logout()

    def test_03_labtech_test_not_performed_and_doctor_cancellation(self):
        """
        Verify 'Test Not Performed' recorded by lab tech and cancelled by physician:
        1. Lab tech marks 'Test Not Performed' with hemolysis justification.
        2. Doctor cancels the order.
        """
        # Doctor orders test
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        order_res = self.client.post(f"/api/patients/{self.patient_id}/lab-orders", json={
            "test_type": "Serum Ferritin & Iron Studies",
            "priority": "Routine",
        })
        order_id = order_res.get_json()["order"]["id"]
        self._logout()

        # Lab tech marks Test Not Performed
        self._login("alex.rivera@hospital.org", "LabTech@1234")
        not_perf_res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={
            "status": "Test Not Performed",
            "reason": "Grossly hemolyzed sample unusable for optical spectrometry.",
        })
        self.assertEqual(not_perf_res.status_code, 200)
        self.assertEqual(not_perf_res.get_json()["order"]["order_status"], "Test Not Performed")
        self._logout()

        # Doctor cancels
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        cancel_decision = self.client.post(f"/api/lab-orders/{order_id}/decision", json={
            "decision": "Cancelled",
            "notes": "Specimen hemolyzed; will re-order at next outpatient visit.",
        })
        self.assertEqual(cancel_decision.status_code, 200)
        self.assertEqual(cancel_decision.get_json()["order"]["order_status"], "Cancelled")
        self._logout()

    def test_04_full_accession_upload_and_treatment_completed_lifecycle(self):
        """
        Verify the complete golden clinical pathway:
        1. Doctor orders STAT Viral Markers test.
        2. Lab Tech collects sample (Sample Collected).
        3. Lab Tech begins analysis (In Progress).
        4. Lab Tech uploads verified PDF report linked to lab order.
        5. Lab order transitions to Completed.
        6. Doctor reviews the uploaded diagnostic report (is_reviewed=True).
        7. Doctor prescribes medication regimen.
        8. Doctor concludes treatment with 'Treatment Completed' and rationale.
        9. Patient logs in and views:
           - Real clinical status 'Treatment Completed'
           - Diagnostic report status 'Reviewed'
           - Completed lab test order with downloadable PDF
           - Historical prescription safely preserved
        """
        # Step 1: Doctor places STAT order
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        order_res = self.client.post(f"/api/patients/{self.patient_id}/lab-orders", json={
            "test_type": "Viral Markers (HBsAg / HCV)",
            "priority": "STAT",
            "clinical_indication": "Acute decompensation workup",
        })
        self.assertEqual(order_res.status_code, 201)
        order_id = order_res.get_json()["order"]["id"]
        self._logout()

        # Step 2: Lab tech marks Sample Collected
        self._login("alex.rivera@hospital.org", "LabTech@1234")
        sample_res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={
            "status": "Sample Collected"
        })
        self.assertEqual(sample_res.status_code, 200)
        self.assertEqual(sample_res.get_json()["order"]["order_status"], "Sample Collected")
        self.assertIsNotNone(sample_res.get_json()["order"]["sample_collected_at"])

        # Step 3: Lab tech marks In Progress
        progress_res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={
            "status": "In Progress"
        })
        self.assertEqual(progress_res.status_code, 200)
        self.assertEqual(progress_res.get_json()["order"]["order_status"], "In Progress")

        # Step 4: Lab tech uploads report linked to lab_order_id
        pdf_data = b"%PDF-1.4 Mock viral markers certified laboratory diagnostic document"
        upload_res = self.client.post(
            f"/api/patients/{self.patient_id}/reports",
            data={
                "report": (io.BytesIO(pdf_data), "viral_markers_david.pdf"),
                "category": "Viral Markers (HBsAg / HCV)",
                "lab_order_id": str(order_id),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 201)
        report_id = upload_res.get_json()["report"]["id"]

        # Step 5: Verify lab order is now Completed
        order_check = self.client.get(f"/api/lab-orders/{order_id}")
        self.assertEqual(order_check.get_json()["order"]["order_status"], "Completed")
        self.assertIsNotNone(order_check.get_json()["order"]["completed_at"])
        self._logout()

        # Step 6: Doctor logs in and marks report as reviewed
        self._login("sarah.jenkins@hospital.org", "Doctor@1234")
        review_rep_res = self.client.post(f"/api/reports/{report_id}/review")
        self.assertEqual(review_rep_res.status_code, 200)
        self.assertTrue(review_rep_res.get_json()["report"]["is_reviewed"])
        self.assertEqual(review_rep_res.get_json()["report"]["reviewed_by_name"], "Dr. Sarah Jenkins")

        # Step 7: Doctor writes prescription
        rx_res = self.client.post(f"/api/patients/{self.patient_id}/prescriptions", json={
            "medicine": "Tenofovir Alafenamide",
            "dosage": "25mg once daily with breakfast",
            "frequency_days": 90,
            "treatment_status": "Under treatment",
            "clinical_notes": "Suppressive antiviral therapy initiated based on negative HBV DNA and low HBsAg quantitative titer.",
            "diet_suggestion": "Low sodium diet, hydration >2L/day",
        })
        self.assertEqual(rx_res.status_code, 201)
        rx_id = rx_res.get_json()["prescription"]["id"]

        # Step 8: Doctor marks Treatment Completed
        # Verify attempt without explicit confirmation fails
        fail_res = self.client.patch(f"/api/patients/{self.patient_id}/review-status", json={
            "treatment_status": "Treatment Completed",
            "confirm": False,
        })
        self.assertEqual(fail_res.status_code, 400)
        self.assertIn("Explicit confirmation is required", fail_res.get_json()["error"])

        # With explicit confirmation -> succeeds
        complete_res = self.client.patch(f"/api/patients/{self.patient_id}/review-status", json={
            "treatment_status": "Treatment Completed",
            "confirm": True,
            "treatment_notes": "Clinical course complete. Sustained virologic response, liver enzyme stabilization.",
        })
        self.assertEqual(complete_res.status_code, 200)
        patient_data = complete_res.get_json()["patient"]
        self.assertEqual(patient_data["treatment_status"], "Treatment Completed")
        self.assertIsNotNone(patient_data["treatment_completed_at"])
        self.assertEqual(patient_data["treatment_completed_by"], "Dr. Sarah Jenkins")
        self.assertEqual(patient_data["treatment_completed_notes"], "Clinical course complete. Sustained virologic response, liver enzyme stabilization.")

        # Prescriptions and reports remain intact
        self.assertEqual(len(patient_data["prescriptions"]), 1)
        self.assertEqual(patient_data["prescriptions"][0]["id"], rx_id)
        self.assertEqual(len(patient_data["reports"]), 1)
        self.assertEqual(patient_data["reports"][0]["id"], report_id)
        self._logout()

        # Step 9: Patient logs in and verifies their portal dashboard
        self._login("david.miller@patient.org", "Patient@1234")
        dash_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(dash_res.status_code, 200)
        p_dash = dash_res.get_json()

        # Verified Real clinical status
        self.assertEqual(p_dash["latest_record"]["treatment_status"], "Treatment Completed")
        self.assertEqual(p_dash["latest_record"]["doctor_confirmed_status"], "Treatment Completed")

        # Distinct report review status
        self.assertEqual(p_dash["report_review_status"], "Reviewed")
        self.assertEqual(p_dash["reports_count"], 1)

        # Real lab test order
        self.assertEqual(p_dash["lab_orders_count"], 1)
        self.assertEqual(p_dash["latest_lab_order"]["order_status"], "Completed")
        self.assertEqual(p_dash["latest_lab_order"]["test_type"], "Viral Markers (HBsAg / HCV)")

        # Download report verified
        dl_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.data, pdf_data)

        # Download prescription verified
        rx_dl_res = self.client.get(f"/api/prescriptions/{rx_id}")
        self.assertEqual(rx_dl_res.status_code, 200)
        self.assertEqual(rx_dl_res.get_json()["prescription"]["medicine"], "Tenofovir Alafenamide")

        self._logout()

    def test_05_cross_patient_authorization_safeguards(self):
        """
        Verify that patients cannot view or download other patients' lab orders or reports.
        """
        # Seed report for David Miller
        with self.app.app_context():
            order = LabOrder(
                patient_id=self.patient_id,
                doctor_id=self.doctor_id,
                test_type="Ultrasound Abdomen",
                order_status="Ordered"
            )
            db.session.add(order)
            db.session.commit()
            order_id = order.id

        # Other patient logs in
        self._login("elena@patient.org", "Patient@1234")

        # Cannot view David's lab order
        cross_order_res = self.client.get(f"/api/lab-orders/{order_id}")
        self.assertEqual(cross_order_res.status_code, 403)

        # Cannot view David's clinical review
        cross_patient_res = self.client.get(f"/api/patients/{self.patient_id}")
        self.assertEqual(cross_patient_res.status_code, 403)

        self._logout()


if __name__ == "__main__":
    unittest.main()

