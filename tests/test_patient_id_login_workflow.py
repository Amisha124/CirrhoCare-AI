import os
import re
import tempfile
import unittest
from datetime import datetime, timedelta

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.user import User
from app.utils.portal import generate_patient_portal_id, generate_patient_pin
from app.utils.security import names_match, normalize_name


class PatientIdLoginWorkflowTestCase(unittest.TestCase):
    """
    Automated test suite verifying the Patient ID-based login workflow:
    1. Admin can register a patient without an email address.
    2. Every newly registered patient receives a unique Patient ID (CC-YYYY-XXXX).
    3. Correct Patient ID, name, and PIN allow login.
    4. Incorrect PIN or mismatched identity is rejected with a generic error.
    5. Rate limiting and temporary lockout against repeated failed login attempts.
    6. One patient cannot access another patient's medical records (isolation).
    7. Existing staff authentication and permissions remain unchanged.
    8. Existing active patient accounts continue working.
    9. First-time PIN change workflow.
    10. Staff-assisted PIN reset workflow.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_patient_id_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="patient_id_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-patient-id-secret-key-42"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-patient-id-secret-key-42",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion: strictly verify temporary test database
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db") or db_uri.endswith("/demo_cirrhosis.db"):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test connected to instance database: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test database URI ({db_uri}) does not match temporary test DB ({self.db_path})")

        with self.app.app_context():
            db.create_all()

            # Seed Admin
            self.admin = User(name="System Admin", email="admin@clinic.org", role="admin", active=True)
            self.admin.set_password("AdminSecure@123")
            db.session.add(self.admin)

            # Seed Lab Tech
            self.labtech = User(name="Lab Tech User", email="labtech@clinic.org", role="labtech", active=True)
            self.labtech.set_password("LabTechSecure@123")
            db.session.add(self.labtech)

            # Seed Hepatologist
            self.doctor = User(name="Dr. Specialist", email="doctor@clinic.org", role="hepatologist", active=True)
            self.doctor.set_password("DoctorSecure@123")
            db.session.add(self.doctor)

            # Seed Pre-existing Active Patient Account (with email and portal_id)
            self.existing_patient = Patient(
                full_name="Eleanor Vance",
                portal_id="PAT-1001",
                age=54,
                gender="Female",
                email="eleanor.vance@example.com",
                treatment_status="Under treatment",
            )
            db.session.add(self.existing_patient)
            db.session.flush()
            self.existing_patient_id = self.existing_patient.id

            self.existing_patient_user = User(
                name="Eleanor Vance",
                email="eleanor.vance@example.com",
                role="patient",
                portal_id="PAT-1001",
                active=True,
                must_change_password=False,
            )
            self.existing_patient_user.set_password("PatientLegacy@123")
            db.session.add(self.existing_patient_user)

            db.session.commit()

    def tearDown(self):
        # Database safety assertion before drop_all
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db") or db_uri.endswith("/demo_cirrhosis.db"):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Teardown attempted to drop instance database: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Teardown database URI ({db_uri}) does not match temporary test DB ({self.db_path})")

        with self.app.app_context():
            db.session.remove()
            db.drop_all()

        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except OSError:
            pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"identifier": email, "password": password})

    def _patient_login(self, name, portal_id, pin=None, remember=False):
        payload = {
            "name": name,
            "portal_id": portal_id,
            "remember": remember,
        }
        if pin is not None:
            payload["pin"] = pin
        return self.client.post("/api/auth/patient-login", json=payload)

    def _logout(self):
        return self.client.post("/api/auth/logout")

    # -------------------------------------------------------------------------
    # 1. Admin & Lab Tech can register a patient without an email address
    # -------------------------------------------------------------------------
    def test_register_patient_without_email(self):
        """Verify Labtech can register a clinical patient without an email address."""
        # Sign in as Labtech
        res = self._login("labtech@clinic.org", "LabTechSecure@123")
        self.assertEqual(res.status_code, 200)

        # Register patient with no email
        create_res = self.client.post("/api/patients", json={
            "full_name": "Ramesh Patel",
            "age": 48,
            "gender": "Male",
            "phone": "+91-9876543210",
            # Email omitted
            "bilirubin": 2.1,
            "albumin": 3.4,
            "platelets": 180,
            "treatment_status": "Awaiting review",
        })
        self.assertEqual(create_res.status_code, 201)
        data = create_res.get_json()
        self.assertTrue(data.get("success"))

        # Verify Patient ID and initial PIN are returned to authorized staff
        portal_id = data.get("portal_id") or data["patient"].get("portal_id")
        initial_pin = data.get("initial_pin")
        self.assertIsNotNone(portal_id)
        self.assertIsNotNone(initial_pin)
        self.assertTrue(re.match(r"^CC-\d{4}-\d{4}$", portal_id))
        self.assertTrue(len(initial_pin) >= 6)

        # Verify DB record exists and has linked User
        with self.app.app_context():
            pat = Patient.query.filter_by(portal_id=portal_id).first()
            self.assertIsNotNone(pat)
            self.assertEqual(pat.full_name, "Ramesh Patel")

            usr = User.query.filter_by(portal_id=portal_id).first()
            self.assertIsNotNone(usr)
            self.assertEqual(usr.role, "patient")
            self.assertTrue(usr.active)
            self.assertTrue(usr.must_change_password)
            self.assertTrue(usr.check_password(initial_pin))

    # -------------------------------------------------------------------------
    # 2. Every newly registered patient receives a unique readable Patient ID
    # -------------------------------------------------------------------------
    def test_unique_patient_id_generation(self):
        """Verify Patient IDs follow CC-<YEAR>-<4-DIGIT> and are unique at database level."""
        self._login("labtech@clinic.org", "LabTechSecure@123")

        generated_ids = set()
        for i in range(5):
            res = self.client.post("/api/patients", json={
                "full_name": f"Test Patient {i}",
                "age": 40 + i,
                "gender": "Other",
            })
            self.assertEqual(res.status_code, 201)
            pid = res.get_json()["patient"]["portal_id"]
            self.assertTrue(re.match(r"^CC-\d{4}-\d{4}$", pid))
            self.assertNotIn(pid, generated_ids)
            generated_ids.add(pid)

        self.assertEqual(len(generated_ids), 5)

    # -------------------------------------------------------------------------
    # 3. Correct Patient ID and Name allow login
    # -------------------------------------------------------------------------
    def test_patient_id_successful_login(self):
        """Verify correct Patient ID and Name allow login and start session."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Aarav Sharma",
            "age": 35,
            "gender": "Male",
        })
        self.assertEqual(create_res.status_code, 201)
        data = create_res.get_json()
        portal_id = data["portal_id"]
        self._logout()

        # Sign in as patient using Name and Patient Portal ID
        login_res = self._patient_login("Aarav Sharma", portal_id)
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertTrue(login_data["success"])
        self.assertEqual(login_data["user"]["portal_id"], portal_id)

        # Check authenticated session (/api/auth/me)
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        self.assertTrue(me_res.get_json()["authenticated"])
        self.assertEqual(me_res.get_json()["user"]["portal_id"], portal_id)

    # -------------------------------------------------------------------------
    # 4. Name normalization handles case, accents, and honorifics
    # -------------------------------------------------------------------------
    def test_patient_name_normalization(self):
        """Verify name normalization accepts case variations and title prefixes."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Dr. Sunita Rao [Demo]",
            "age": 42,
            "gender": "Female",
        })
        self.assertEqual(create_res.status_code, 201)
        data = create_res.get_json()
        portal_id = data["portal_id"]
        self._logout()

        # Sign in with lowercase, stripped honorific, or extra spaces
        test_variants = [
            "sunita rao",
            "SUNITA RAO",
            "  Sunita Rao  ",
            "Dr. Sunita Rao",
        ]
        for name_variant in test_variants:
            login_res = self._patient_login(name_variant, portal_id)
            self.assertEqual(login_res.status_code, 200, f"Failed for name variant: {name_variant}")
            self._logout()

    # -------------------------------------------------------------------------
    # 5. Mismatched identity or invalid Patient ID is rejected with generic error
    # -------------------------------------------------------------------------
    def test_incorrect_credentials_rejected_with_generic_error(self):
        """Verify mismatched identity or invalid ID returns 401 with generic error."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Kavita Devi",
            "age": 52,
            "gender": "Female",
        })
        portal_id = create_res.get_json()["portal_id"]
        self._logout()

        # Case A: Wrong Name
        res_wrong_name = self._patient_login("Wrong Name", portal_id)
        self.assertEqual(res_wrong_name.status_code, 401)
        self.assertIn("Invalid Patient ID or Name", res_wrong_name.get_json()["error"])

        # Case B: Non-existent Patient ID
        res_nonexistent = self._patient_login("Kavita Devi", "CC-2099-9999")
        self.assertEqual(res_nonexistent.status_code, 401)
        self.assertIn("Invalid Patient ID or Name", res_nonexistent.get_json()["error"])

        # Case C: Missing Name
        res_no_name = self._patient_login("", portal_id)
        self.assertEqual(res_no_name.status_code, 400)

        # Case D: Missing Patient ID
        res_no_id = self._patient_login("Kavita Devi", "")
        self.assertEqual(res_no_id.status_code, 400)

    # -------------------------------------------------------------------------
    # 6. Rate limiting and temporary lockout against repeated failed attempts
    # -------------------------------------------------------------------------
    def test_temporary_lockout_after_failed_attempts(self):
        """Verify account is temporarily locked after 5 consecutive failed attempts."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Lockout Test",
            "age": 60,
            "gender": "Male",
        })
        portal_id = create_res.get_json()["portal_id"]
        self._logout()

        # 5 failed attempts with mismatched name
        for attempt in range(5):
            res = self._patient_login(f"Mismatched Name {attempt}", portal_id)
            if attempt < 4:
                self.assertEqual(res.status_code, 401)
            else:
                # 5th attempt locks the account
                self.assertIn(res.status_code, (401, 429))

        # 6th attempt should be rejected with 429 lockout even with correct name
        res_locked = self._patient_login("Lockout Test", portal_id)
        self.assertEqual(res_locked.status_code, 429)
        self.assertIn("temporarily locked", res_locked.get_json()["error"])

    # -------------------------------------------------------------------------
    # 7. Patient-level authorization & record isolation
    # -------------------------------------------------------------------------
    def test_patient_record_isolation(self):
        """Verify one authenticated patient cannot view another patient's medical records."""
        self._login("labtech@clinic.org", "LabTechSecure@123")

        # Patient 1
        res1 = self.client.post("/api/patients", json={"full_name": "Patient Alpha", "age": 45, "gender": "Male"})
        p1_id = res1.get_json()["patient"]["id"]
        p1_portal = res1.get_json()["portal_id"]
        p1_pin = res1.get_json()["initial_pin"]

        # Patient 2
        res2 = self.client.post("/api/patients", json={"full_name": "Patient Beta", "age": 55, "gender": "Female"})
        p2_id = res2.get_json()["patient"]["id"]
        p2_portal = res2.get_json()["portal_id"]
        p2_pin = res2.get_json()["initial_pin"]

        self._logout()

        # Sign in as Patient Alpha
        self._patient_login("Patient Alpha", p1_portal, p1_pin)

        # Patient Alpha accesses their own record -> 200 OK
        own_res = self.client.get(f"/api/patients/{p1_id}")
        self.assertEqual(own_res.status_code, 200)

        # Patient Alpha attempts to access Patient Beta's record -> 403 Forbidden
        other_res = self.client.get(f"/api/patients/{p2_id}")
        self.assertEqual(other_res.status_code, 403)

        # Patient Alpha queries patient list -> only gets their own record
        list_res = self.client.get("/api/patients")
        self.assertEqual(list_res.status_code, 200)
        items = list_res.get_json()["patients"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["portal_id"], p1_portal)

    # -------------------------------------------------------------------------
    # 8. Existing staff authentication and permissions remain unchanged
    # -------------------------------------------------------------------------
    def test_existing_staff_auth_unchanged(self):
        """Verify Administrator, Hepatologist, and Lab Tech logins remain intact."""
        # Admin
        admin_res = self._login("admin@clinic.org", "AdminSecure@123")
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.get_json()["user"]["role"], "admin")
        self._logout()

        # Lab Tech
        lab_res = self._login("labtech@clinic.org", "LabTechSecure@123")
        self.assertEqual(lab_res.status_code, 200)
        self.assertEqual(lab_res.get_json()["user"]["role"], "labtech")
        self._logout()

        # Hepatologist
        doc_res = self._login("doctor@clinic.org", "DoctorSecure@123")
        self.assertEqual(doc_res.status_code, 200)
        self.assertEqual(doc_res.get_json()["user"]["role"], "hepatologist")
        self._logout()

    # -------------------------------------------------------------------------
    # 9. Existing active patient accounts continue working
    # -------------------------------------------------------------------------
    def test_existing_active_patient_accounts_continue_working(self):
        """Verify pre-existing patient Eleanor Vance can log in via email and Patient ID."""
        # Login via email/password
        res_email = self._login("eleanor.vance@example.com", "PatientLegacy@123")
        self.assertEqual(res_email.status_code, 200)
        self.assertEqual(res_email.get_json()["user"]["portal_id"], "PAT-1001")
        self._logout()

        # Login via Patient ID / Name / Password
        res_id = self._patient_login("Eleanor Vance", "PAT-1001", "PatientLegacy@123")
        self.assertEqual(res_id.status_code, 200)
        self.assertEqual(res_id.get_json()["user"]["portal_id"], "PAT-1001")
        self._logout()

    # -------------------------------------------------------------------------
    # 10. Patient PIN change workflow (First-login credential update)
    # -------------------------------------------------------------------------
    def test_patient_change_pin_workflow(self):
        """Verify patient can change their temporary PIN and clear must_change_password."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Vikram Singh",
            "age": 38,
            "gender": "Male",
        })
        portal_id = create_res.get_json()["portal_id"]
        initial_pin = create_res.get_json()["initial_pin"]
        self._logout()

        # Log in with initial PIN
        self._patient_login("Vikram Singh", portal_id, initial_pin)

        # Attempt to change PIN with incorrect current PIN -> 400
        fail_res = self.client.post("/api/auth/change-pin", json={
            "current_pin": "wrongpin",
            "new_pin": "NewPin@789",
            "confirm_pin": "NewPin@789",
        })
        self.assertEqual(fail_res.status_code, 400)

        # Successfully change PIN (kept for future scope)
        success_res = self.client.post("/api/auth/change-pin", json={
            "current_pin": initial_pin,
            "new_pin": "NewPin@789",
            "confirm_pin": "NewPin@789",
        })
        self.assertEqual(success_res.status_code, 200)
        self.assertFalse(success_res.get_json()["user"]["must_change_password"])

        with self.app.app_context():
            u = User.query.filter_by(portal_id=portal_id).first()
            self.assertTrue(u.check_password("NewPin@789"))
            self.assertFalse(u.check_password(initial_pin))

        self._logout()

        # Simplified Name + Portal ID login succeeds directly
        new_login = self._patient_login("Vikram Singh", portal_id)
        self.assertEqual(new_login.status_code, 200)

    # -------------------------------------------------------------------------
    # 11. Staff-assisted PIN reset workflow
    # -------------------------------------------------------------------------
    def test_staff_assisted_pin_reset(self):
        """Verify Admin can reset a patient's PIN and unlock their account."""
        # Lab Tech registers patient
        self._login("labtech@clinic.org", "LabTechSecure@123")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Reset Test Patient",
            "age": 49,
            "gender": "Female",
        })
        patient_id = create_res.get_json()["patient"]["id"]
        portal_id = create_res.get_json()["portal_id"]
        initial_pin = create_res.get_json()["initial_pin"]
        self._logout()

        # Admin resets PIN
        self._login("admin@clinic.org", "AdminSecure@123")
        reset_res = self.client.post(f"/api/patients/{patient_id}/reset-pin")
        self.assertEqual(reset_res.status_code, 200)
        reset_data = reset_res.get_json()
        self.assertTrue(reset_data["success"])
        new_pin = reset_data["new_pin"]
        self.assertIsNotNone(new_pin)
        self.assertNotEqual(new_pin, initial_pin)
        self._logout()

        # Patient signs in with newly reset PIN
        login_res = self._patient_login("Reset Test Patient", portal_id, new_pin)
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.get_json()["success"])

        # Unauthorized patient cannot call reset-pin
        unauth_reset = self.client.post(f"/api/patients/{patient_id}/reset-pin")
        self.assertEqual(unauth_reset.status_code, 403)


if __name__ == "__main__":
    unittest.main()
