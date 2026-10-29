import os
import tempfile
import unittest
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User
from app.utils.notifications import notify
from app.utils.tokens import generate_reset_token, verify_reset_token


class Phase1BackendSecurityAndAPITest(unittest.TestCase):
    def setUp(self):
        # Create an isolated temporary SQLite database for this test run
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Strict safety check: ensure the test suite is NEVER connected to the development database
        assert "instance" not in self.app.config["SQLALCHEMY_DATABASE_URI"], "Tests must not target instance database!"

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed test users for the 4 roles
        self.admin = User(name="Admin User", email="admin_test@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lab Tech", email="lab_test@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor = User(name="Dr. Specialist", email="doctor_test@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.patient_user1 = User(name="Patient One", email="patient1@careai.com", role="patient", portal_id="PAT-9001")
        self.patient_user1.set_password("Patient@123")

        self.patient_user2 = User(name="Patient Two", email="patient2@careai.com", role="patient", portal_id="PAT-9002")
        self.patient_user2.set_password("Patient@123")

        db.session.add_all([self.admin, self.labtech, self.doctor, self.patient_user1, self.patient_user2])
        db.session.commit()

        # Create Patient 1 (matching patient_user1)
        self.patient1 = Patient(
            full_name="Patient One",
            portal_id="PAT-9001",
            age=52,
            gender="Male",
            email="patient1@careai.com",
            bilirubin=3.2,
            albumin=2.9,
            sgot=120,
            sgpt=95,
            platelets=110,
            cholesterol=240,
            prothrombin=14.5,
            ascites=True,
            hepatomegaly=True,
            spiders=True,
            edema=False,
            copper=160,
            alk_phos=1400,
            triglycerides=180,
            latest_risk_label="High Risk",
            latest_risk_percent=78.5,
            treatment_status="Under treatment",
        )
        db.session.add(self.patient1)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
        if hasattr(self, "temp_db_path") and os.path.exists(self.temp_db_path):
            try:
                os.unlink(self.temp_db_path)
            except OSError:
                pass

    def login_as(self, email, password):
        return self.client.post("/api/auth/login", json={"identifier": email, "password": password})

    # -------------------------------------------------------------------------
    # 1. Password Reset Security Tests
    # -------------------------------------------------------------------------
    def test_password_reset_token_generation_and_verification(self):
        token = generate_reset_token(self.admin)
        self.assertIsNotNone(token)

        # Valid token verifies correctly
        verified_user = verify_reset_token(token)
        self.assertEqual(verified_user.id, self.admin.id)

    def test_password_reset_tampered_token_rejected(self):
        token = generate_reset_token(self.admin)
        tampered_token = token + "xyz"
        self.assertIsNone(verify_reset_token(tampered_token))

    def test_password_reset_single_use_enforcement(self):
        token = generate_reset_token(self.admin)
        # Use token to change password
        res = self.client.post("/api/auth/reset-password", json={"token": token, "password": "NewSecretPass@123"})
        self.assertEqual(res.status_code, 200)

        # Re-using the exact same token must now fail
        res_repeat = self.client.post("/api/auth/reset-password", json={"token": token, "password": "AnotherPass@123"})
        self.assertEqual(res_repeat.status_code, 400)

    def test_legacy_reset_password_by_user_id_blocked(self):
        # Attempting to access legacy insecure endpoint /auth/reset-password/<user_id> must be 403 Forbidden
        res = self.client.get(f"/auth/reset-password/{self.admin.id}")
        self.assertEqual(res.status_code, 403)

    # -------------------------------------------------------------------------
    # 2. Medical Report Access Control Tests
    # -------------------------------------------------------------------------
    def test_medical_report_access_control(self):
        # Setup dummy file in instance upload dir
        upload_dir = Path(self.app.config["UPLOAD_FOLDER"])
        upload_dir.mkdir(parents=True, exist_ok=True)
        test_filename = "test_lab_report.pdf"
        (upload_dir / test_filename).write_bytes(b"%PDF-1.4 Mock Lab Report Content")

        report = Report(patient=self.patient1, filename=test_filename, original_filename="blood_panel.pdf")
        db.session.add(report)
        db.session.commit()

        # 1. Unauthenticated request -> 401 or redirect
        res_unauth = self.client.get(f"/reports/{report.id}/download")
        self.assertIn(res_unauth.status_code, [302, 401])

        # 2. Patient One (owner) -> allowed 200
        self.login_as("patient1@careai.com", "Patient@123")
        res_owner = self.client.get(f"/reports/{report.id}/download")
        self.assertEqual(res_owner.status_code, 200)

        # 3. Patient Two (different patient) -> 403 Forbidden
        self.client.post("/api/auth/logout")
        self.login_as("patient2@careai.com", "Patient@123")
        res_other = self.client.get(f"/reports/{report.id}/download")
        self.assertEqual(res_other.status_code, 403)

        # 4. Doctor / Clinician -> allowed 200
        self.client.post("/api/auth/logout")
        self.login_as("doctor_test@careai.com", "Doctor@123")
        res_doctor = self.client.get(f"/reports/{report.id}/download")
        self.assertEqual(res_doctor.status_code, 200)

    # -------------------------------------------------------------------------
    # 3. Notification Persistence Tests
    # -------------------------------------------------------------------------
    def test_notification_persistence(self):
        # Test notify with auto_commit=True
        n1 = notify("Test Title", "Test Message", category="danger", role="admin", auto_commit=True)
        self.assertIsNotNone(n1.id)

        # Test notify within a parent transaction
        n2 = notify("Second Title", "Second Message", category="info", role="hepatologist", auto_commit=False)
        self.assertIsNotNone(n2.id)
        db.session.commit()

        count = Notification.query.count()
        self.assertEqual(count, 2)

    # -------------------------------------------------------------------------
    # 4. Patient-User Linkage Clean Registration Tests
    # -------------------------------------------------------------------------
    def test_patient_registration_does_not_create_dummy_clinical_record(self):
        # Self-registration via /auth/register
        res = self.client.post("/auth/register", data={
            "name": "Jane Register",
            "email": "jane@example.com",
            "role": "patient",
            "password": "Password@123",
            "confirm_password": "Password@123",
        }, follow_redirects=True)
        self.assertEqual(res.status_code, 200)

        user = User.query.filter_by(email="jane@example.com").first()
        self.assertIsNotNone(user)
        self.assertIsNotNone(user.portal_id)

        # Verify NO fake Patient record with age=1 was created!
        fake_patient = Patient.query.filter_by(email="jane@example.com", age=1).first()
        self.assertIsNone(fake_patient)

    # -------------------------------------------------------------------------
    # 5. REST API & Role Authorization Tests
    # -------------------------------------------------------------------------
    def test_api_predict_endpoint(self):
        self.login_as("doctor_test@careai.com", "Doctor@123")
        payload = {
            "age": 55,
            "gender": "male",
            "bilirubin": 4.5,
            "albumin": 2.6,
            "sgot": 140,
            "sgpt": 110,
            "platelets": 95,
            "cholesterol": 280,
            "prothrombin": 15.2,
            "ascites": True,
            "hepatomegaly": True,
            "spiders": True,
            "edema": False,
            "copper": 180,
            "alk_phos": 1600,
            "triglycerides": 190,
        }
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("probability", data)
        self.assertIn("risk_label", data)
        self.assertIn("biomarker_flags", data)

    def test_patient_role_scoping(self):
        # When logged in as Patient One, /api/patients must ONLY return Patient One
        self.login_as("patient1@careai.com", "Patient@123")
        res = self.client.get("/api/patients")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["patients"][0]["portal_id"], "PAT-9001")

    def test_prescription_authorization(self):
        # 1. Lab tech cannot prescribe -> 403 Forbidden
        self.login_as("lab_test@careai.com", "Lab@123")
        res_lab = self.client.post(f"/api/patients/{self.patient1.id}/prescriptions", json={
            "medicine": "Spironolactone",
            "dosage": "100mg daily",
            "frequency_days": 30,
        })
        self.assertEqual(res_lab.status_code, 403)

        # 2. Patient cannot prescribe -> 403 Forbidden
        self.client.post("/api/auth/logout")
        self.login_as("patient1@careai.com", "Patient@123")
        res_patient = self.client.post(f"/api/patients/{self.patient1.id}/prescriptions", json={
            "medicine": "Furosemide",
            "dosage": "40mg daily",
            "frequency_days": 14,
        })
        self.assertEqual(res_patient.status_code, 403)

        # 3. Hepatologist is authorized -> 201 Created
        self.client.post("/api/auth/logout")
        self.login_as("doctor_test@careai.com", "Doctor@123")
        res_doc = self.client.post(f"/api/patients/{self.patient1.id}/prescriptions", json={
            "medicine": "Propranolol",
            "dosage": "20mg twice daily",
            "frequency_days": 30,
            "clinical_notes": "Monitor heart rate and blood pressure weekly.",
            "diet_suggestion": "Strict low sodium diet (< 2g/day).",
            "treatment_status": "Under treatment",
        })
        self.assertEqual(res_doc.status_code, 201)
        rx_data = res_doc.get_json()
        self.assertTrue(rx_data["success"])
        self.assertEqual(rx_data["prescription"]["medicine"], "Propranolol")

    def test_dashboard_stats_endpoint_for_all_roles(self):
        for email, pwd, expected_role in [
            ("admin_test@careai.com", "Admin@123", "admin"),
            ("lab_test@careai.com", "Lab@123", "labtech"),
            ("doctor_test@careai.com", "Doctor@123", "hepatologist"),
            ("patient1@careai.com", "Patient@123", "patient"),
        ]:
            self.login_as(email, pwd)
            res = self.client.get("/api/dashboard/stats")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["role"], expected_role)
            self.client.post("/api/auth/logout")


if __name__ == "__main__":
    unittest.main()
