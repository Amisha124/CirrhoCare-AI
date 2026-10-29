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


class TestSimplifiedPatientPortalLogin(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_patient_login_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="patient_login_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "patient-login-secret-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "patient-login-secret-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # Create Staff accounts
            self.admin = User(name="Admin User", email="admin@cirrhocare.org", role="admin")
            self.admin.set_password("AdminPass@123")

            self.doctor = User(name="Dr. Sharma", email="doctor@cirrhocare.org", role="hepatologist", portal_id="DOC-101")
            self.doctor.set_password("DoctorPass@123")

            self.labtech = User(name="Neha Verma", email="labtech@cirrhocare.org", role="labtech", portal_id="LAB-101")
            self.labtech.set_password("LabTechPass@123")

            db.session.add_all([self.admin, self.doctor, self.labtech])
            db.session.commit()

            # Register Patient A (Anil Kapoor)
            self.patient_a = Patient(
                full_name="Anil Kapoor",
                age=54,
                gender="Male",
                portal_id="CC-2026-7780",
                assigned_doctor_id=self.doctor.id,
                created_by_id=self.labtech.id,
                treatment_status="Under treatment",
                bilirubin=2.4,
                albumin=3.1,
                sgot=64.0,
                sgpt=58.0,
                diet_plan="Low sodium, high protein, avoid alcohol.",
                care_instructions="Take prescribed spironolactone once daily in the morning.",
            )
            db.session.add(self.patient_a)
            db.session.commit()

            # Create User for Patient A
            self.patient_a_user = User(
                name="Anil Kapoor",
                email="cc-2026-7780@cirrhocare.internal",
                role="patient",
                portal_id="CC-2026-7780",
                active=True,
            )
            self.patient_a_user.set_password("SecurePin#123")
            db.session.add(self.patient_a_user)

            # Add prescription for Patient A
            rx_a = Prescription(
                patient_id=self.patient_a.id,
                doctor_id=self.doctor.id,
                medicine="Spironolactone",
                dosage="50mg",
                frequency_days=1,
                clinical_notes="Take with breakfast once daily",
            )
            db.session.add(rx_a)

            # Add Report for Patient A
            rep_a = Report(
                patient_id=self.patient_a.id,
                filename="test_report_anil.pdf",
                original_filename="LFT_Anil_Kapoor.pdf",
                is_reviewed=True,
            )
            db.session.add(rep_a)

            # Register Patient B (Sunita Rao)
            self.patient_b = Patient(
                full_name="Sunita Rao",
                age=48,
                gender="Female",
                portal_id="CC-2026-9901",
                assigned_doctor_id=self.doctor.id,
                created_by_id=self.labtech.id,
                diet_plan="Patient B secret diet plan",
                care_instructions="Patient B care instructions",
            )
            db.session.add(self.patient_b)
            db.session.commit()

            self.patient_b_user = User(
                name="Sunita Rao",
                email="cc-2026-9901@cirrhocare.internal",
                role="patient",
                portal_id="CC-2026-9901",
                active=True,
            )
            self.patient_b_user.set_password("PinPatientB#999")
            db.session.add(self.patient_b_user)
            db.session.commit()

            self.patient_a_id = self.patient_a.id
            self.patient_b_id = self.patient_b.id

    def tearDown(self):
        try:
            shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except OSError:
            pass

    def test_01_patient_can_login_with_only_name_and_portal_id(self):
        """1. Patient can sign in using only registered name and Patient ID (no PIN)."""
        res = self.client.post("/api/auth/patient-login", json={
            "name": "Anil Kapoor",
            "portal_id": "CC-2026-7780",
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["portal_id"], "CC-2026-7780")
        self.assertEqual(data["user"]["name"], "Anil Kapoor")
        self.assertEqual(data["user"]["role"], "patient")

    def test_02_name_normalization_variants(self):
        """2. Names are safely normalized (lowercase, uppercase, extra whitespace)."""
        variants = [
            "anil kapoor",
            "Anil Kapoor",
            " ANIL KAPOOR ",
            "  Anil    Kapoor  ",
            "anil   kapoor",
        ]
        for var in variants:
            res = self.client.post("/api/auth/patient-login", json={
                "name": var,
                "portal_id": "CC-2026-7780",
            })
            self.assertEqual(res.status_code, 200, f"Failed for variant '{var}'")
            self.assertTrue(res.get_json()["success"])
            # Logout between attempts
            self.client.post("/api/auth/logout")

    def test_03_login_fails_when_name_does_not_match_patient_id(self):
        """3. Login fails if Patient Name does not match the Patient ID."""
        res = self.client.post("/api/auth/patient-login", json={
            "name": "Wrong Name",
            "portal_id": "CC-2026-7780",
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Patient name or Patient ID is incorrect.")

    def test_04_login_fails_when_patient_id_does_not_exist(self):
        """4. Login fails if Patient ID does not exist."""
        res = self.client.post("/api/auth/patient-login", json={
            "name": "Anil Kapoor",
            "portal_id": "CC-2099-0000",
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Patient name or Patient ID is incorrect.")

    def test_05_missing_fields_return_exact_error_message(self):
        """5. Missing name or Patient ID returns exact error message."""
        # Empty name
        res1 = self.client.post("/api/auth/patient-login", json={
            "name": "",
            "portal_id": "CC-2026-7780",
        })
        self.assertEqual(res1.status_code, 401)
        self.assertEqual(res1.get_json()["error"], "Patient name or Patient ID is incorrect.")

        # Empty portal_id
        res2 = self.client.post("/api/auth/patient-login", json={
            "name": "Anil Kapoor",
            "portal_id": "",
        })
        self.assertEqual(res2.status_code, 401)
        self.assertEqual(res2.get_json()["error"], "Patient name or Patient ID is incorrect.")

    def test_06_never_creates_new_patient_during_login(self):
        """6. Never create a new patient record during login."""
        with self.app.app_context():
            initial_patient_count = Patient.query.count()

        # Failed attempt
        self.client.post("/api/auth/patient-login", json={
            "name": "Nonexistent Person",
            "portal_id": "CC-9999-9999",
        })

        # Successful attempt
        self.client.post("/api/auth/patient-login", json={
            "name": "Anil Kapoor",
            "portal_id": "CC-2026-7780",
        })

        with self.app.app_context():
            final_patient_count = Patient.query.count()
            self.assertEqual(final_patient_count, initial_patient_count)

    def test_07_patient_strict_data_isolation(self):
        """7. Strict patient isolation: patient sees only their own data."""
        # Log in as Patient A
        login_res = self.client.post("/api/auth/patient-login", json={
            "name": "Anil Kapoor",
            "portal_id": "CC-2026-7780",
        })
        self.assertEqual(login_res.status_code, 200)

        # Get dashboard stats
        dash_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.get_json()

        # Anil Kapoor has 1 report, Patient B has 0
        self.assertEqual(dash_data["role"], "patient")
        self.assertEqual(dash_data["portal_id"], "CC-2026-7780")
        self.assertEqual(dash_data["reports_count"], 1)

        # Patient A should be denied direct access to Patient B's record
        forbidden_res = self.client.get(f"/api/patients/{self.patient_b_id}")
        self.assertEqual(forbidden_res.status_code, 403)

        # Patient A can access their own record
        own_res = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(own_res.status_code, 200)
        self.assertEqual(own_res.get_json()["patient"]["full_name"], "Anil Kapoor")
        self.assertEqual(own_res.get_json()["patient"]["diet_plan"], "Low sodium, high protein, avoid alcohol.")

    def test_08_staff_logins_remain_untouched(self):
        """8. Doctor, Lab Technician, and Admin logins continue to work normally."""
        # Admin login
        admin_res = self.client.post("/api/auth/login", json={
            "identifier": "admin@cirrhocare.org",
            "password": "AdminPass@123",
        })
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.get_json()["user"]["role"], "admin")
        self.client.post("/api/auth/logout")

        # Doctor login
        doc_res = self.client.post("/api/auth/login", json={
            "identifier": "doctor@cirrhocare.org",
            "password": "DoctorPass@123",
        })
        self.assertEqual(doc_res.status_code, 200)
        self.assertEqual(doc_res.get_json()["user"]["role"], "hepatologist")
        self.client.post("/api/auth/logout")

        # Lab Tech login
        lab_res = self.client.post("/api/auth/login", json={
            "identifier": "labtech@cirrhocare.org",
            "password": "LabTechPass@123",
        })
        self.assertEqual(lab_res.status_code, 200)
        self.assertEqual(lab_res.get_json()["user"]["role"], "labtech")
        self.client.post("/api/auth/logout")

    def test_09_staff_cannot_login_via_patient_portal_endpoint(self):
        """9. Staff accounts cannot login via the patient portal login endpoint."""
        res = self.client.post("/api/auth/patient-login", json={
            "name": "Dr. Sharma",
            "portal_id": "DOC-101",
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json()["error"], "Patient name or Patient ID is incorrect.")


if __name__ == "__main__":
    unittest.main()
