import io
import os
import shutil
import tempfile
import unittest

from app import create_app
from app.models import db
from app.models.lab_order import LabOrder
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User


class PatientStatusAndReviewLifecycleTestCase(unittest.TestCase):
    """
    Test suite verifying:
    1. Distinguishing Diagnostic Report Review status from Patient Clinical Treatment status.
    2. Uploading a lab report sets report_review_status to 'Awaiting doctor review' while
       patient treatment_status remains 'Awaiting review'.
    3. Doctor reviewing a report via POST /api/reports/<id>/review marks is_reviewed=True,
       updating report_review_status to 'Reviewed' without prematurely altering treatment_status.
    4. Doctor prescribing medication transitions patient treatment_status to 'Under treatment'
       and auto-confirms unreviewed diagnostic reports.
    5. Patient Dashboard Stats (/api/dashboard/stats) accurately returns real status flags
       without fabricating counts or dates.
    6. Strict test isolation: uses temporary SQLite DB and temp upload folder.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_status_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="status_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-status-secret-key-202"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-status-secret-key-202",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION VIOLATION: Test connected to protected database: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION VIOLATION: Database URI mismatch: {db_uri}")

        with self.app.app_context():
            db.create_all()
            self._seed_test_users()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

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

    def _seed_test_users(self):
        admin = User(
            name="Admin User",
            email="admin@cirrhocare.org",
            role="admin",
            portal_id="ADM-001",
            active=True,
        )
        admin.set_password("AdminPass123!")

        doctor = User(
            name="Dr. Raj Sharma",
            email="dr.sharma@cirrhocare.org",
            role="hepatologist",
            portal_id="DOC-001",
            active=True,
        )
        doctor.set_password("DoctorPass123!")

        labtech = User(
            name="Neha Verma",
            email="neha@cirrhocare.org",
            role="labtech",
            portal_id="LAB-001",
            active=True,
        )
        labtech.set_password("LabTechPass123!")

        db.session.add_all([admin, doctor, labtech])
        db.session.commit()

        self.doctor_id = doctor.id
        self.labtech_id = labtech.id
        self.admin_id = admin.id

    def _login(self, email, password):
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200)
        return res

    def _login_patient(self, portal_id, pin):
        res = self.client.post("/api/auth/login", json={"identifier": portal_id, "password": pin})
        self.assertEqual(res.status_code, 200)
        return res

    def test_complete_status_lifecycle_and_review(self):
        # Step 1: Admin creates patient assigned to Dr. Sharma
        self._login("admin@cirrhocare.org", "AdminPass123!")
        patient_payload = {
            "full_name": "Kavita Patel",
            "age": 49,
            "gender": "Female",
            "assigned_doctor_id": self.doctor_id,
        }
        res = self.client.post("/api/patients", json=patient_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        patient_id = data["patient"]["id"]
        portal_id = data["patient"]["portal_id"]
        pin = data.get("initial_pin") or "PatPin123!"

        # Initial Patient State: Awaiting review, No reports uploaded
        patient_data = data["patient"]
        self.assertEqual(patient_data["treatment_status"], "Awaiting review")
        self.assertEqual(patient_data["report_review_status"], "No reports uploaded")
        self.assertEqual(patient_data["unreviewed_reports_count"], 0)
        self.assertEqual(patient_data["reviewed_reports_count"], 0)

        # Step 2: Lab Technician uploads a medical report for Kavita Patel
        self._login("neha@cirrhocare.org", "LabTechPass123!")
        dummy_pdf = io.BytesIO(b"%PDF-1.4 Dummy PDF Content for Lab Report Testing")
        upload_data = {
            "patient_id": str(patient_id),
            "report_name": "Comprehensive Liver Panel",
            "notes": "Elevated ALT and AST detected; bilirubin slightly increased.",
            "file": (dummy_pdf, "liver_panel_kavita.pdf", "application/pdf"),
        }
        res_upload = self.client.post(
            "/api/reports/upload",
            data=upload_data,
            content_type="multipart/form-data",
        )
        self.assertEqual(res_upload.status_code, 201)
        upload_json = res_upload.get_json()
        self.assertTrue(upload_json["success"])
        report_id = upload_json["report"]["id"]
        self.assertFalse(upload_json["report"]["is_reviewed"])

        # Fetch patient details as Doctor:
        # Report review status must now be 'Awaiting doctor review'
        # Treatment status must REMAIN 'Awaiting review' (uploading report != doctor reviewed != cured)
        self._login("dr.sharma@cirrhocare.org", "DoctorPass123!")
        res_patient = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(res_patient.status_code, 200)
        p_info = res_patient.get_json()["patient"]
        self.assertEqual(p_info["treatment_status"], "Awaiting review")
        self.assertEqual(p_info["report_review_status"], "Awaiting doctor review")
        self.assertEqual(p_info["unreviewed_reports_count"], 1)
        self.assertEqual(p_info["reviewed_reports_count"], 0)

        # Step 3: Doctor marks the report as clinically reviewed
        res_review = self.client.post(f"/api/reports/{report_id}/review")
        self.assertEqual(res_review.status_code, 200)
        review_json = res_review.get_json()
        self.assertTrue(review_json["success"])
        self.assertTrue(review_json["report"]["is_reviewed"])
        self.assertEqual(review_json["report"]["reviewed_by_name"], "Dr. Raj Sharma")

        # After review: report_review_status is 'Reviewed', but treatment_status is STILL 'Awaiting review'
        res_patient2 = self.client.get(f"/api/patients/{patient_id}")
        p_info2 = res_patient2.get_json()["patient"]
        self.assertEqual(p_info2["treatment_status"], "Awaiting review")
        self.assertEqual(p_info2["report_review_status"], "Reviewed")
        self.assertEqual(p_info2["unreviewed_reports_count"], 0)
        self.assertEqual(p_info2["reviewed_reports_count"], 1)

        # Step 4: Doctor prescribes medication
        rx_payload = {
            "patient_id": patient_id,
            "medicine": "Ursodeoxycholic Acid 300mg",
            "dosage": "1 tablet twice daily with meals",
            "treatment_status": "Under treatment",
            "dietary_advice": "Low-sodium diet, abstain completely from alcohol, drink 2-3L water daily.",
        }
        res_rx = self.client.post("/api/prescriptions", json=rx_payload)
        self.assertEqual(res_rx.status_code, 201)
        rx_json = res_rx.get_json()
        self.assertTrue(rx_json["success"])

        # Check patient now has treatment_status == 'Under treatment'
        res_patient3 = self.client.get(f"/api/patients/{patient_id}")
        p_info3 = res_patient3.get_json()["patient"]
        self.assertEqual(p_info3["treatment_status"], "Under treatment")
        self.assertEqual(p_info3["report_review_status"], "Reviewed")
        self.assertEqual(p_info3["prescriptions_count"], 1)

        # Step 5: Patient logs in and fetches dashboard stats
        self._login_patient(portal_id, pin)
        res_dash = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_dash.status_code, 200)
        dash_data = res_dash.get_json()
        self.assertTrue(dash_data["success"])
        self.assertEqual(dash_data["report_review_status"], "Reviewed")
        self.assertEqual(dash_data["unreviewed_reports_count"], 0)
        self.assertEqual(dash_data["reviewed_reports_count"], 1)
        self.assertEqual(dash_data["reports_count"], 1)

        latest_rec = dash_data["latest_record"]
        self.assertEqual(latest_rec["treatment_status"], "Under treatment")
        self.assertEqual(latest_rec["report_review_status"], "Reviewed")

    def test_prescribe_auto_reviews_unreviewed_reports(self):
        """
        Verify that when a doctor writes a prescription for a patient who has unreviewed
        uploaded diagnostic reports, the reports are automatically marked as reviewed
        by the prescribing physician.
        """
        self._login("admin@cirrhocare.org", "AdminPass123!")
        p_res = self.client.post("/api/patients", json={
            "full_name": "Rohan Deshmukh",
            "age": 52,
            "gender": "Male",
            "assigned_doctor_id": self.doctor_id,
        })
        patient_id = p_res.get_json()["patient"]["id"]

        # Lab Tech uploads report
        self._login("neha@cirrhocare.org", "LabTechPass123!")
        dummy_pdf = io.BytesIO(b"%PDF-1.4 Dummy PDF Content")
        res_upload = self.client.post(
            "/api/reports/upload",
            data={
                "patient_id": str(patient_id),
                "report_name": "FibroScan Elastography",
                "file": (dummy_pdf, "fibroscan.pdf", "application/pdf"),
            },
            content_type="multipart/form-data",
        )
        report_id = res_upload.get_json()["report"]["id"]

        # Doctor prescribes directly without calling /reports/<id>/review first
        self._login("dr.sharma@cirrhocare.org", "DoctorPass123!")
        res_rx = self.client.post("/api/prescriptions", json={
            "patient_id": patient_id,
            "medicine": "Propranolol 40mg",
            "dosage": "1 tablet once daily morning",
            "treatment_status": "Under treatment",
        })
        self.assertEqual(res_rx.status_code, 201)

        # Verify report was auto-reviewed by the prescribing physician
        with self.app.app_context():
            rep = db.session.get(Report, report_id)
            self.assertTrue(rep.is_reviewed)
            self.assertEqual(rep.reviewed_by_id, self.doctor_id)

            pat = db.session.get(Patient, patient_id)
            self.assertEqual(pat.treatment_status, "Under treatment")

    def test_doctor_update_patient_review_status_endpoint(self):
        """
        Verify that a doctor can update clinical status directly via
        PUT/PATCH /api/patients/<id>/review-status.
        """
        self._login("admin@cirrhocare.org", "AdminPass123!")
        p_res = self.client.post("/api/patients", json={
            "full_name": "Meera Joshi",
            "age": 41,
            "gender": "Female",
            "assigned_doctor_id": self.doctor_id,
        })
        patient_id = p_res.get_json()["patient"]["id"]

        # Doctor updates clinical status
        self._login("dr.sharma@cirrhocare.org", "DoctorPass123!")
        res_update = self.client.put(f"/api/patients/{patient_id}/review-status", json={
            "treatment_status": "Stable",
            "clinical_notes": "Patient condition stable, liver enzymes within normal parameters.",
        })
        self.assertEqual(res_update.status_code, 200)
        json_up = res_update.get_json()
        self.assertTrue(json_up["success"])
        self.assertEqual(json_up["patient"]["treatment_status"], "Stable")

    def test_patient_isolation_and_security(self):
        """
        Verify that a patient can only access their own dashboard and records,
        and is blocked from accessing another patient's data.
        """
        self._login("admin@cirrhocare.org", "AdminPass123!")
        p1 = self.client.post("/api/patients", json={
            "full_name": "Patient One",
            "age": 30,
            "gender": "Male",
            "assigned_doctor_id": self.doctor_id,
        }).get_json()
        p2 = self.client.post("/api/patients", json={
            "full_name": "Patient Two",
            "age": 40,
            "gender": "Female",
            "assigned_doctor_id": self.doctor_id,
        }).get_json()

        portal_id_1 = p1["patient"]["portal_id"]
        pin_1 = p1.get("initial_pin") or "PatPin123!"
        p2_id = p2["patient"]["id"]

        # Login as Patient One
        self._login_patient(portal_id_1, pin_1)

        # Attempt to access Patient Two's record directly
        res_forbidden = self.client.get(f"/api/patients/{p2_id}")
        self.assertEqual(res_forbidden.status_code, 403)


if __name__ == "__main__":
    unittest.main()
