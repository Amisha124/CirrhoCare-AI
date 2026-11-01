import os
import re
import tempfile
import unittest

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.user import User


class PatientRegistrationLoginLifecycleTestCase(unittest.TestCase):
    """
    Regression test suite verifying the simplified Patient Registration and Login lifecycle:
    1. Lab Tech registration creates both Patient and linked User accounts.
    2. Response includes unique Patient Portal ID (CC-YYYY-XXXX).
    3. Patient login accepts Full Name + Patient Portal ID without requiring a PIN.
    4. Invalid name or invalid portal ID is rejected with 401.
    5. Missing name or portal ID returns 400.
    6. Authenticated patient session opens their own patient dashboard and medical records.
    7. Patients cannot access administrative or other patients' records.
    8. Staff authentication remains unaffected.
    9. Pre-existing patient accounts continue to work.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_lifecycle_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name
        self.temp_upload_dir = tempfile.mkdtemp(prefix="lifecycle_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-simplified-lifecycle-secret-key-123"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-simplified-lifecycle-secret-key-123",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION VIOLATION: Test connected to instance DB: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION VIOLATION: Test DB URI mismatch: {db_uri}")

        with self.app.app_context():
            db.create_all()

            # Seed Staff User: Lab Tech
            self.labtech = User(name="Test Lab Technician", email="labtech@clinic.org", role="labtech", active=True)
            self.labtech.set_password("LabTech123!")
            db.session.add(self.labtech)

            # Seed Pre-existing Patient
            self.baseline_patient = Patient(
                full_name="Existing Patient",
                portal_id="CC-2026-1111",
                age=50,
                gender="Female",
            )
            db.session.add(self.baseline_patient)
            db.session.flush()

            self.baseline_user = User(
                name="Existing Patient",
                email="existing.patient@example.com",
                portal_id="CC-2026-1111",
                role="patient",
                active=True,
            )
            self.baseline_user.set_password("PatientDefault@123")
            db.session.add(self.baseline_user)

            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except OSError:
            pass

    def test_simplified_patient_registration_and_login_lifecycle(self):
        """
        Verify the simplified end-to-end flow:
        Lab tech registers patient -> receives Portal ID -> Patient logs in with Name + Portal ID.
        """
        # Step 1: Lab Tech logs in
        login_resp = self.client.post("/api/auth/login", json={
            "identifier": "labtech@clinic.org",
            "password": "LabTech123!",
        })
        self.assertEqual(login_resp.status_code, 200, "Lab tech login must succeed")

        # Step 2: Lab Tech registers a new patient
        reg_payload = {
            "full_name": "Arjun Sharma",
            "age": 42,
            "gender": "Male",
            "phone": "+91 98765 43210",
            "treatment_status": "Under treatment",
        }
        reg_resp = self.client.post("/api/patients", json=reg_payload)
        self.assertEqual(reg_resp.status_code, 201, "Patient registration should return HTTP 201")
        reg_data = reg_resp.get_json()

        self.assertTrue(reg_data.get("success"), "Registration response must indicate success")
        self.assertIn("portal_id", reg_data, "Response must include portal_id")

        portal_id = reg_data["portal_id"]
        self.assertTrue(re.match(r"^CC-\d{4}-\d{4}$", portal_id), f"Portal ID format invalid: {portal_id}")

        # Step 3: Verify DB records directly
        with self.app.app_context():
            patient_rec = Patient.query.filter_by(portal_id=portal_id).first()
            self.assertIsNotNone(patient_rec, "Patient record must exist in DB")
            self.assertEqual(patient_rec.full_name, "Arjun Sharma")

            user_rec = User.query.filter_by(portal_id=portal_id).first()
            self.assertIsNotNone(user_rec, "Linked User account must exist in DB")
            self.assertEqual(user_rec.role, "patient")
            self.assertEqual(user_rec.name, "Arjun Sharma")
            self.assertTrue(user_rec.active)

        # Step 4: Lab Tech logs out
        logout_resp = self.client.post("/api/auth/logout")
        self.assertEqual(logout_resp.status_code, 200)

        # Step 5: Validation - Missing name or portal_id returns 400
        missing_name_resp = self.client.post("/api/auth/patient-login", json={
            "name": "",
            "portal_id": portal_id,
        })
        self.assertEqual(missing_name_resp.status_code, 400, "Missing name must return 400")

        missing_id_resp = self.client.post("/api/auth/patient-login", json={
            "name": "Arjun Sharma",
            "portal_id": "",
        })
        self.assertEqual(missing_id_resp.status_code, 400, "Missing portal_id must return 400")

        # Step 6: Validation - Nonexistent portal ID returns 401
        bad_id_resp = self.client.post("/api/auth/patient-login", json={
            "name": "Arjun Sharma",
            "portal_id": "CC-2099-9999",
        })
        self.assertEqual(bad_id_resp.status_code, 401, "Nonexistent portal_id must return 401")

        # Step 7: Validation - Mismatched name returns 401
        bad_name_resp = self.client.post("/api/auth/patient-login", json={
            "name": "Wrong Person Name",
            "portal_id": portal_id,
        })
        self.assertEqual(bad_name_resp.status_code, 401, "Mismatched name must return 401")

        # Step 8: Successful Patient Login with Name + Portal ID (No PIN required)
        patient_login_resp = self.client.post("/api/auth/patient-login", json={
            "name": "Arjun Sharma",
            "portal_id": portal_id,
        })
        self.assertEqual(patient_login_resp.status_code, 200, "Patient login with Name + Portal ID must succeed")
        p_data = patient_login_resp.get_json()
        self.assertTrue(p_data.get("success"))
        self.assertEqual(p_data["user"]["role"], "patient")
        self.assertEqual(p_data["user"]["portal_id"], portal_id)
        self.assertEqual(p_data["user"]["name"], "Arjun Sharma")

        # Step 9: Verify authenticated session (/api/auth/me)
        me_resp = self.client.get("/api/auth/me")
        self.assertEqual(me_resp.status_code, 200)
        me_data = me_resp.get_json()
        self.assertTrue(me_data.get("authenticated"))
        self.assertEqual(me_data["user"]["portal_id"], portal_id)

        # Step 10: Verify patient dashboard returns patient's own data
        dashboard_resp = self.client.get("/api/dashboard/stats")
        self.assertEqual(dashboard_resp.status_code, 200)
        dash_data = dashboard_resp.get_json()
        self.assertEqual(dash_data.get("role"), "patient")
        self.assertEqual(dash_data.get("portal_id"), portal_id)
        self.assertEqual(dash_data.get("latest_record", {}).get("portal_id"), portal_id)
        self.assertEqual(dash_data.get("latest_record", {}).get("full_name"), "Arjun Sharma")

        # Step 11: Patient cannot access administrative endpoints
        admin_resp = self.client.get("/api/logs")
        self.assertEqual(admin_resp.status_code, 403, "Patient cannot access admin audit logs")

        # Step 12: Name normalization - Case insensitive and whitespace trimming works
        self.client.post("/api/auth/logout")
        varied_name_resp = self.client.post("/api/auth/patient-login", json={
            "name": "  arjun sharma  ",
            "portal_id": portal_id,
        })
        self.assertEqual(varied_name_resp.status_code, 200, "Normalized name matching must succeed")

        # Step 13: Pre-existing patient account continues working
        self.client.post("/api/auth/logout")
        base_login = self.client.post("/api/auth/patient-login", json={
            "name": "Existing Patient",
            "portal_id": "CC-2026-1111",
        })
        self.assertEqual(base_login.status_code, 200, "Existing patient login must succeed")
        self.assertEqual(base_login.get_json()["user"]["portal_id"], "CC-2026-1111")


if __name__ == "__main__":
    unittest.main()
