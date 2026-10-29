import io
import json
import os
import shutil
import tempfile
import unittest
from datetime import date
from app import create_app, db
from app.models.user import User
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report


class TestDoctorDashboardWorkflow(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_doc_e2e_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="doc_e2e_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "doc-e2e-secret-key-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "doc-e2e-secret-key-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # Create Lab Technician
            self.labtech = User(
                name="Neha Verma",
                email="labtech@cirrhocare.org",
                role="labtech",
                portal_id="LT-101",
            )
            self.labtech.set_password("LabTech@123")

            # Create Doctor / Hepatologist
            self.doctor = User(
                name="Dr. Raj Sharma",
                email="doctor@cirrhocare.org",
                role="hepatologist",
                portal_id="HEP-101",
            )
            self.doctor.set_password("Doctor@123")

            # Create a Second Doctor to test patient isolation
            self.other_doctor = User(
                name="Dr. Sarah Jenkins",
                email="otherdoc@cirrhocare.org",
                role="hepatologist",
                portal_id="HEP-102",
            )
            self.other_doctor.set_password("Doctor@123")

            # Create an unrelated Patient to test patient privacy isolation
            self.other_patient_user = User(
                name="Unrelated Patient",
                email="unrelated@cirrhocare.org",
                role="patient",
                portal_id="PAT-9999",
            )
            self.other_patient_user.set_password("Patient@123")

            db.session.add_all([self.labtech, self.doctor, self.other_doctor, self.other_patient_user])
            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
            if os.path.exists(self.temp_upload_dir):
                shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
        except Exception:
            pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _logout(self):
        return self.client.post("/api/auth/logout")

    def test_complete_labtech_doctor_patient_workflow(self):
        """
        Comprehensive test of the 3-role workflow:
        Step 1: Lab Technician registers patient
        Step 2: Lab Technician enters biomarker test results & uploads diagnostic PDF report
        Step 3: Doctor views patient, biomarkers, reports, and status
        Step 4: Doctor prescribes medications & provides diet/care advice
        Step 5: Patient logs in and views their prescriptions, diet, care advice, and reports
        Step 6: Patient isolation check (other patients cannot see this patient's records)
        Step 7: Role authorization checks (Doctor cannot mutate lab biomarkers or upload lab reports)
        """

        # ---------------------------------------------------------------------
        # STEP 1: Lab Technician registers patient
        # ---------------------------------------------------------------------
        login_res = self._login("labtech@cirrhocare.org", "LabTech@123")
        self.assertEqual(login_res.status_code, 200)

        reg_res = self.client.post("/api/patients", json={
            "full_name": "Motu Yadav",
            "age": 45,
            "gender": "male",
            "phone": "9876543210",
        })
        self.assertEqual(reg_res.status_code, 201)
        reg_json = reg_res.get_json()
        self.assertTrue(reg_json["success"])

        patient_data = reg_json["patient"]
        patient_id = patient_data["id"]
        portal_id = patient_data["portal_id"]
        initial_pin = reg_json.get("initial_pin")
        self.assertTrue(portal_id.startswith("CC-"))
        self.assertIsNotNone(initial_pin)
        self.assertEqual(patient_data["treatment_status"], "Registered")

        # ---------------------------------------------------------------------
        # STEP 2: Lab Technician enters biomarker results & uploads PDF report
        # ---------------------------------------------------------------------
        # Enter test results
        results_res = self.client.put(f"/api/patients/{patient_id}", json={
            "bilirubin": 1.8,
            "direct_bilirubin": 0.6,
            "sgot_ast": 55.0,
            "sgpt_alt": 62.0,
            "albumin": 3.4,
            "platelets": 165.0,
            "prothrombin": 14.2,
            "alk_phos": 130.0,
            "treatment_status": "Test In Progress",
        })
        self.assertEqual(results_res.status_code, 200)
        updated_patient = results_res.get_json()["patient"]
        self.assertEqual(updated_patient["bilirubin"], 1.8)
        self.assertEqual(updated_patient["direct_bilirubin"], 0.6)
        self.assertEqual(updated_patient["sgot"], 55.0)
        self.assertEqual(updated_patient["sgpt"], 62.0)
        self.assertEqual(updated_patient["albumin"], 3.4)
        self.assertEqual(updated_patient["platelets"], 165.0)
        self.assertEqual(updated_patient["prothrombin"], 14.2)
        self.assertEqual(updated_patient["alk_phos"], 130.0)
        self.assertEqual(updated_patient["treatment_status"], "Test In Progress")

        # Upload diagnostic PDF report
        sample_pdf_bytes = b"%PDF-1.4 mock LFT diagnostic report content for Motu Yadav"
        upload_res = self.client.post(
            f"/api/patients/{patient_id}/reports",
            data={
                "file": (io.BytesIO(sample_pdf_bytes), "LFT_Report_MotuYadav.pdf"),
                "report_type": "Liver Function Test (LFT)",
            },
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 201)
        upload_json = upload_res.get_json()
        self.assertTrue(upload_json["success"])
        report_id = upload_json["report"]["id"]

        # Verify status automatically advanced to 'Report Uploaded'
        check_lab_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(check_lab_res.get_json()["patient"]["treatment_status"], "Report Uploaded")

        self._logout()

        # ---------------------------------------------------------------------
        # STEP 3: Doctor logs in and verifies patient data visibility
        # ---------------------------------------------------------------------
        doc_login_res = self._login("doctor@cirrhocare.org", "Doctor@123")
        self.assertEqual(doc_login_res.status_code, 200)

        # Doctor lists patients - newly registered patient must appear
        doc_patients_res = self.client.get("/api/patients")
        self.assertEqual(doc_patients_res.status_code, 200)
        doc_patients = doc_patients_res.get_json()["patients"]
        found_patient = next((p for p in doc_patients if p["id"] == patient_id), None)
        self.assertIsNotNone(found_patient)
        self.assertEqual(found_patient["full_name"], "Motu Yadav")
        self.assertEqual(found_patient["portal_id"], portal_id)
        self.assertEqual(found_patient["age"], 45)
        self.assertEqual(found_patient["gender"].lower(), "male")
        self.assertEqual(found_patient["treatment_status"], "Report Uploaded")
        self.assertEqual(found_patient["bilirubin"], 1.8)
        self.assertEqual(found_patient["albumin"], 3.4)

        # Doctor gets detailed patient record
        doc_detail_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(doc_detail_res.status_code, 200)
        p_detail = doc_detail_res.get_json()["patient"]

        # All 8 biomarkers must match actual values entered by Lab Technician
        self.assertEqual(p_detail["bilirubin"], 1.8)
        self.assertEqual(p_detail["direct_bilirubin"], 0.6)
        self.assertEqual(p_detail["sgot"], 55.0)
        self.assertEqual(p_detail["sgpt"], 62.0)
        self.assertEqual(p_detail["albumin"], 3.4)
        self.assertEqual(p_detail["platelets"], 165.0)
        self.assertEqual(p_detail["prothrombin"], 14.2)
        self.assertEqual(p_detail["alk_phos"], 130.0)

        # Reports must be present and viewable
        self.assertTrue(len(p_detail.get("reports", [])) > 0)
        self.assertEqual(p_detail["reports"][0]["id"], report_id)

        # Doctor can open and view / download the uploaded PDF
        report_download_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(report_download_res.status_code, 200)
        self.assertEqual(report_download_res.data, sample_pdf_bytes)

        # ---------------------------------------------------------------------
        # STEP 4: Doctor prescribes medicines & saves diet/care advice
        # ---------------------------------------------------------------------
        # Issue multi-medicine prescription
        rx_res = self.client.post(f"/api/patients/{patient_id}/prescriptions", json={
            "medicines": [
                {
                    "medicine": "Ursodeoxycholic Acid",
                    "dosage": "300mg",
                    "frequency": "Twice daily",
                    "duration": "30 days",
                    "instructions": "Take after meals with a glass of water",
                },
                {
                    "medicine": "Spironolactone",
                    "dosage": "25mg",
                    "frequency": "Once daily",
                    "duration": "15 days",
                    "instructions": "Take in the morning",
                }
            ],
            "clinical_notes": "Follow-up LFT profile recommended in 4 weeks.",
            "treatment_status": "Under treatment",
        })
        self.assertEqual(rx_res.status_code, 201)
        rx_data = rx_res.get_json()
        self.assertTrue(rx_data["success"])
        self.assertEqual(len(rx_data["prescriptions"]), 2)

        # Save Diet Plan & Rest/Care Advice
        diet_plan_text = "Recommended: High-fiber diet, steamed vegetables, lean chicken, adequate water\n\nAvoid: Strictly zero alcohol, low sodium (<2g/day), avoid fried/oily foods\n\nMeals: 4-5 small frequent meals daily"
        care_text = "Rest: 20 minutes moderate walking, 8 hours sleep\n\nCare: Monitor abdominal swelling and weight daily. Report jaundice immediately."

        advice_res = self.client.post(f"/api/patients/{patient_id}/advice", json={
            "diet_plan": diet_plan_text,
            "care_instructions": care_text,
            "follow_up_date": "2026-11-28",
            "treatment_status": "Under treatment",
        })
        self.assertEqual(advice_res.status_code, 200)
        advice_json = advice_res.get_json()
        self.assertTrue(advice_json["success"])

        # Confirm patient assigned to Dr. Raj Sharma and status is 'Under treatment'
        assigned_p = advice_json["patient"]
        self.assertEqual(assigned_p["assigned_doctor_name"], "Dr. Raj Sharma")
        self.assertEqual(assigned_p["treatment_status"], "Under treatment")
        self.assertEqual(assigned_p["follow_up_date"], "2026-11-28")

        self._logout()

        # ---------------------------------------------------------------------
        # STEP 5: Patient logs in and verifies prescriptions, diet, and care advice
        # ---------------------------------------------------------------------
        pat_login_res = self.client.post("/api/auth/patient-login", json={
            "name": "Motu Yadav",
            "portal_id": portal_id,
            "pin": initial_pin,
        })
        self.assertEqual(pat_login_res.status_code, 200)

        # Patient gets their own record
        patient_view_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(patient_view_res.status_code, 200)
        pat_record = patient_view_res.get_json()["patient"]

        # Verify Diet Plan & Care Instructions
        self.assertEqual(pat_record["diet_plan"], diet_plan_text)
        self.assertEqual(pat_record["care_instructions"], care_text)
        self.assertEqual(pat_record["follow_up_date"], "2026-11-28")
        self.assertEqual(pat_record["treatment_status"], "Under treatment")

        # Verify Prescriptions
        pat_rx_res = self.client.get("/api/prescriptions")
        self.assertEqual(pat_rx_res.status_code, 200)
        pat_rx_list = pat_rx_res.get_json()["prescriptions"]
        self.assertEqual(len(pat_rx_list), 2)
        med_names = [r["medicine"] for r in pat_rx_list]
        self.assertIn("Ursodeoxycholic Acid", med_names)
        self.assertIn("Spironolactone", med_names)

        # Verify Patient can access their uploaded PDF report
        pat_reports_res = self.client.get("/api/reports")
        self.assertEqual(pat_reports_res.status_code, 200)
        pat_reports = pat_reports_res.get_json()["reports"]
        self.assertEqual(len(pat_reports), 1)
        self.assertEqual(pat_reports[0]["id"], report_id)

        # ---------------------------------------------------------------------
        # STEP 6: Patient Isolation (unrelated patient cannot access Motu's data)
        # ---------------------------------------------------------------------
        self._logout()
        other_pat_login = self._login("unrelated@cirrhocare.org", "Patient@123")
        self.assertEqual(other_pat_login.status_code, 200)

        # Attempt to access Motu's record -> MUST BE 403 Forbidden
        forbidden_record_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(forbidden_record_res.status_code, 403)

        # Attempt to list Motu's prescriptions -> MUST BE 403 Forbidden
        forbidden_rx_res = self.client.get(f"/api/prescriptions?patient_id={patient_id}")
        self.assertEqual(forbidden_rx_res.status_code, 403)

        # General prescriptions list returns 0 prescriptions for the unrelated patient
        unrelated_rx_list = self.client.get("/api/prescriptions").get_json()["prescriptions"]
        self.assertEqual(len(unrelated_rx_list), 0)

        # ---------------------------------------------------------------------
        # STEP 7: Role Authorization / RBAC enforcement
        # Doctor cannot modify biomarkers or upload official lab reports
        # ---------------------------------------------------------------------
        self._logout()
        self._login("doctor@cirrhocare.org", "Doctor@123")

        # Doctor attempts to modify laboratory biomarkers -> MUST BE 403 Forbidden
        doc_modify_bio = self.client.put(f"/api/patients/{patient_id}", json={
            "bilirubin": 9.9,
            "albumin": 1.0,
        })
        self.assertEqual(doc_modify_bio.status_code, 403)

        # Doctor attempts to upload official lab report -> MUST BE 403 Forbidden
        doc_upload_report = self.client.post(
            f"/api/patients/{patient_id}/reports",
            data={"file": (io.BytesIO(b"%PDF mock"), "doctor_fake_report.pdf")},
            content_type="multipart/form-data"
        )
        self.assertEqual(doc_upload_report.status_code, 403)


if __name__ == "__main__":
    unittest.main()
