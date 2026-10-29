import hashlib
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app import create_app
from app.models import db
from app.models.activation_token import PatientActivationToken
from app.models.patient import Patient
from app.models.user import User


class PatientAccountActivationTestCase(unittest.TestCase):
    """
    Automated test suite verifying secure patient account activation by email,
    cryptographic token hashing, expiration, single-use constraints,
    anti-tampering, transactional email provider handling, and duplicate prevention.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_activation_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="activation_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-activation-secret-key-999"

        # Ensure no residual transactional API keys
        if "RESEND_API_KEY" in os.environ:
            del os.environ["RESEND_API_KEY"]
        if "BREVO_API_KEY" in os.environ:
            del os.environ["BREVO_API_KEY"]
        if "EMAIL_PROVIDER" in os.environ:
            del os.environ["EMAIL_PROVIDER"]

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-activation-secret-key-999",
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
            self.admin = User(name="Clinic Admin", email="admin@clinic.org", role="admin", active=True)
            self.admin.set_password("AdminSecure@123")
            db.session.add(self.admin)

            # Seed Lab Tech
            self.labtech = User(name="Lab Technician", email="labtech@clinic.org", role="labtech", active=True)
            self.labtech.set_password("LabTechSecure@123")
            db.session.add(self.labtech)

            # Seed Doctor
            self.doctor = User(name="Dr. Specialist", email="doctor@clinic.org", role="hepatologist", active=True)
            self.doctor.set_password("DoctorSecure@123")
            db.session.add(self.doctor)

            # Seed Pre-existing Active Patient (Backward compatibility check)
            self.existing_patient = Patient(
                full_name="Eleanor Existing",
                portal_id="PAT-EXISTING",
                age=50,
                gender="Female",
                email="eleanor.existing@patient.org",
                treatment_status="Under treatment",
            )
            db.session.add(self.existing_patient)
            db.session.flush()
            self.existing_patient_id = self.existing_patient.id

            self.existing_patient_user = User(
                name="Eleanor Existing",
                email="eleanor.existing@patient.org",
                portal_id="PAT-EXISTING",
                role="patient",
                active=True,
            )
            self.existing_patient_user.set_password("ExistingPatientPass123!")
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
        except Exception:
            pass

    def _login(self, identifier, password):
        return self.client.post("/api/auth/login", json={"identifier": identifier, "password": password})

    # =========================================================================
    # Test 1: Patient registration generates unactivated user and hashed token
    # =========================================================================
    def test_01_patient_registration_generates_activation_token_and_unactivated_user(self):
        """Registering a patient provisions an unactivated User with a hashed token; raw token is not stored."""
        self._login("admin@clinic.org", "AdminSecure@123")

        payload = {
            "full_name": "Oliver Twist",
            "age": 42,
            "gender": "Male",
            "email": "oliver.twist@carepatient.org",
            "portal_id": "PAT-OLIVER",
            "bilirubin": 1.2,
            "albumin": 3.7,
            "platelets": 210,
        }
        res = self.client.post("/api/patients", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])

        # Patient was created
        patient_data = data["patient"]
        self.assertEqual(patient_data["portal_id"], "PAT-OLIVER")

        # Activation URL was generated (in dev/unconfigured fallback)
        self.assertIn("activation_url", data)
        activation_url = data["activation_url"]
        self.assertIsNotNone(activation_url)
        raw_token = activation_url.split("/")[-1]

        with self.app.app_context():
            # Verify User account state
            user = User.query.filter_by(portal_id="PAT-OLIVER").first()
            self.assertIsNotNone(user)
            self.assertEqual(user.email, "oliver.twist@carepatient.org")
            self.assertFalse(user.check_password("Patient@123"), "Shared default password must NEVER be assigned")

            # Verify token record in database
            token_rec = PatientActivationToken.query.filter_by(user_id=user.id).first()
            self.assertIsNotNone(token_rec)
            expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            self.assertEqual(token_rec.token_hash, expected_hash, "Stored token must match SHA-256 hash of raw token")
            self.assertNotEqual(token_rec.token_hash, raw_token, "Raw token must NEVER be stored in the database")
            self.assertIsNone(token_rec.used_at)
            self.assertIsNone(token_rec.revoked_at)
            self.assertFalse(token_rec.is_expired)

    # =========================================================================
    # Test 2: Unactivated patient cannot log in
    # =========================================================================
    def test_02_unactivated_patient_cannot_login_with_any_password(self):
        """Unactivated patient accounts receive a clear 403 activation guidance message on login attempts."""
        self._login("labtech@clinic.org", "LabTechSecure@123")

        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "Unactivated User",
                "age": 35,
                "gender": "Female",
                "email": "pending.patient@carepatient.org",
                "portal_id": "PAT-PENDING",
            },
        )
        self.assertEqual(res.status_code, 201)

        # Mark user as inactive (pending email activation) to test inactive portal account barrier
        with self.app.app_context():
            u = User.query.filter_by(portal_id="PAT-PENDING").first()
            u.active = False
            db.session.commit()

        # Logout staff
        self.client.post("/api/auth/logout")

        # Attempt login with previous default password
        res_login_default = self._login("pending.patient@carepatient.org", "Patient@123")
        self.assertEqual(res_login_default.status_code, 403)
        self.assertIn("not been activated yet", res_login_default.get_json()["error"])

        # Attempt login with portal ID
        res_login_portal = self._login("PAT-PENDING", "AnyPassword123")
        self.assertEqual(res_login_portal.status_code, 403)
        self.assertIn("not been activated yet", res_login_portal.get_json()["error"])

    # =========================================================================
    # Test 3: Token verification endpoint
    # =========================================================================
    def test_03_verify_activation_token_endpoint(self):
        """GET /api/auth/verify-activation-token returns token status and recipient info without consuming the token."""
        self._login("admin@clinic.org", "AdminSecure@123")
        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "Arthur Dent",
                "age": 42,
                "gender": "Male",
                "email": "arthur.dent@galaxy.org",
                "portal_id": "PAT-ARTHUR",
            },
        )
        raw_token = res.get_json()["activation_url"].split("/")[-1]

        # Public verification check
        verify_res = self.client.get(f"/api/auth/verify-activation-token?token={raw_token}")
        self.assertEqual(verify_res.status_code, 200)
        verify_data = verify_res.get_json()
        self.assertTrue(verify_data["valid"])
        self.assertEqual(verify_data["user"]["name"], "Arthur Dent")
        self.assertEqual(verify_data["user"]["portal_id"], "PAT-ARTHUR")

        # Verify token was NOT consumed
        with self.app.app_context():
            tok_rec = PatientActivationToken.query.filter_by(
                token_hash=hashlib.sha256(raw_token.encode()).hexdigest()
            ).first()
            self.assertIsNone(tok_rec.used_at)

    # =========================================================================
    # Test 4: Successful activation and self password creation
    # =========================================================================
    def test_04_successful_activation_and_password_setting(self):
        """Patient successfully redeems activation token, sets password, and logs in."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "Sarah Connor",
                "age": 29,
                "gender": "Female",
                "email": "sarah.connor@sky.org",
                "portal_id": "PAT-SARAH",
            },
        )
        raw_token = res.get_json()["activation_url"].split("/")[-1]

        # Redeem token with new custom password
        activate_res = self.client.post(
            "/api/auth/activate",
            json={
                "token": raw_token,
                "password": "SarahPersonalPassword@2026",
                "confirm_password": "SarahPersonalPassword@2026",
            },
        )
        self.assertEqual(activate_res.status_code, 200)
        activate_data = activate_res.get_json()
        self.assertTrue(activate_data["success"])
        self.assertIn("activated", activate_data["message"].lower())

        with self.app.app_context():
            user = User.query.filter_by(portal_id="PAT-SARAH").first()
            self.assertTrue(user.active)
            self.assertTrue(user.check_password("SarahPersonalPassword@2026"))
            tok_rec = PatientActivationToken.query.filter_by(user_id=user.id).first()
            self.assertIsNotNone(tok_rec.used_at)

        # Patient logs in with newly created password
        login_res = self._login("sarah.connor@sky.org", "SarahPersonalPassword@2026")
        self.assertEqual(login_res.status_code, 200)
        self.assertEqual(login_res.get_json()["user"]["role"], "patient")

    # =========================================================================
    # Test 5: Single-use constraint (reused token rejection)
    # =========================================================================
    def test_05_single_use_token_reuse_rejection(self):
        """Tokens are strictly single-use; subsequent activation attempts are rejected."""
        self._login("admin@clinic.org", "AdminSecure@123")
        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "Miles Davis",
                "age": 60,
                "gender": "Male",
                "email": "miles.davis@music.org",
                "portal_id": "PAT-MILES",
            },
        )
        raw_token = res.get_json()["activation_url"].split("/")[-1]

        # First activation succeeds
        res1 = self.client.post(
            "/api/auth/activate",
            json={
                "token": raw_token,
                "password": "MilesFirstPass@123",
                "confirm_password": "MilesFirstPass@123",
            },
        )
        self.assertEqual(res1.status_code, 200)

        # Second activation attempt with identical token MUST fail
        res2 = self.client.post(
            "/api/auth/activate",
            json={
                "token": raw_token,
                "password": "AttackerPass@999",
                "confirm_password": "AttackerPass@999",
            },
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already been used", res2.get_json()["error"])

        # Verify password was not overridden by second attempt
        with self.app.app_context():
            user = User.query.filter_by(portal_id="PAT-MILES").first()
            self.assertTrue(user.check_password("MilesFirstPass@123"))
            self.assertFalse(user.check_password("AttackerPass@999"))

    # =========================================================================
    # Test 6: Invalid token rejection
    # =========================================================================
    def test_06_invalid_and_tampered_token_rejection(self):
        """Invalid, empty, or tampered tokens are rejected."""
        # Random non-existent token
        res_random = self.client.post(
            "/api/auth/activate",
            json={"token": "completely-invalid-token-12345", "password": "ValidPassword@123"},
        )
        self.assertEqual(res_random.status_code, 400)
        self.assertIn("invalid", res_random.get_json()["error"].lower())

        # Missing token
        res_empty = self.client.post(
            "/api/auth/activate",
            json={"token": "", "password": "ValidPassword@123"},
        )
        self.assertEqual(res_empty.status_code, 400)

        # Mismatched passwords
        res_mismatch = self.client.post(
            "/api/auth/activate",
            json={
                "token": "some-token",
                "password": "ValidPassword@123",
                "confirm_password": "DifferentPassword@123",
            },
        )
        self.assertEqual(res_mismatch.status_code, 400)
        self.assertIn("match", res_mismatch.get_json()["error"].lower())

    # =========================================================================
    # Test 7: Expired token rejection
    # =========================================================================
    def test_07_expired_token_rejection(self):
        """Tokens past expires_at are rejected."""
        self._login("admin@clinic.org", "AdminSecure@123")
        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "Rip Van Winkle",
                "age": 70,
                "gender": "Male",
                "email": "rip.van@sleep.org",
                "portal_id": "PAT-EXPIRE",
            },
        )
        raw_token = res.get_json()["activation_url"].split("/")[-1]

        # Force token expiration in database
        with self.app.app_context():
            tok_rec = PatientActivationToken.query.filter_by(
                token_hash=hashlib.sha256(raw_token.encode()).hexdigest()
            ).first()
            tok_rec.expires_at = datetime.utcnow() - timedelta(days=2)
            db.session.commit()

        # Attempt verification
        res_verify = self.client.get(f"/api/auth/verify-activation-token?token={raw_token}")
        self.assertEqual(res_verify.status_code, 400)
        self.assertIn("expired", res_verify.get_json()["error"].lower())

        # Attempt activation
        res_activate = self.client.post(
            "/api/auth/activate",
            json={"token": raw_token, "password": "ExpiredTokenAttempt@123"},
        )
        self.assertEqual(res_activate.status_code, 400)
        self.assertIn("expired", res_activate.get_json()["error"].lower())

    # =========================================================================
    # Test 8: Revocation of previous token upon re-invite
    # =========================================================================
    def test_08_revoked_token_rejection_when_new_invite_issued(self):
        """Issuing a new invitation revokes the previous token, which cannot be redeemed."""
        self._login("labtech@clinic.org", "LabTechSecure@123")
        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "Grace Hopper",
                "age": 45,
                "gender": "Female",
                "email": "grace.hopper@compiler.org",
                "portal_id": "PAT-GRACE",
            },
        )
        patient_id = res.get_json()["patient"]["id"]
        first_token = res.get_json()["activation_url"].split("/")[-1]

        # Staff re-issues invitation
        reinvite_res = self.client.post(f"/api/patients/{patient_id}/invite")
        self.assertEqual(reinvite_res.status_code, 200)
        second_token = reinvite_res.get_json()["activation_url"].split("/")[-1]
        self.assertNotEqual(first_token, second_token)

        # Attempting first token must be rejected as revoked
        res_old = self.client.post(
            "/api/auth/activate",
            json={"token": first_token, "password": "OldTokenAttempt@123"},
        )
        self.assertEqual(res_old.status_code, 400)
        self.assertIn("revoked", res_old.get_json()["error"].lower())

        # Attempting second token succeeds
        res_new = self.client.post(
            "/api/auth/activate",
            json={"token": second_token, "password": "GraceNewPass@123"},
        )
        self.assertEqual(res_new.status_code, 200)

    # =========================================================================
    # Test 9: Duplicate patient accounts and unauthorized linking prevention
    # =========================================================================
    def test_09_duplicate_patient_and_unauthorized_staff_linking_prevention(self):
        """Staff cannot register a patient using an existing staff email or duplicate Portal ID."""
        self._login("admin@clinic.org", "AdminSecure@123")

        # 1. Attempt to register patient with Administrator's email -> Rejected
        res_staff_email = self.client.post(
            "/api/patients",
            json={
                "full_name": "Impostor Patient",
                "age": 30,
                "gender": "Other",
                "email": "admin@clinic.org",
                "portal_id": "PAT-IMPOSTOR",
            },
        )
        self.assertEqual(res_staff_email.status_code, 400)
        self.assertIn("staff", res_staff_email.get_json()["error"].lower())

        # 2. Attempt to register patient with Doctor's email -> Rejected
        res_doc_email = self.client.post(
            "/api/patients",
            json={
                "full_name": "Impostor Patient 2",
                "age": 30,
                "gender": "Other",
                "email": "doctor@clinic.org",
                "portal_id": "PAT-IMPOSTOR2",
            },
        )
        self.assertEqual(res_doc_email.status_code, 400)
        self.assertIn("staff", res_doc_email.get_json()["error"].lower())

        # 3. Attempt to register duplicate Portal ID -> Rejected
        res_dup_portal = self.client.post(
            "/api/patients",
            json={
                "full_name": "Duplicate Portal ID",
                "age": 40,
                "gender": "Male",
                "email": "diff.email@patient.org",
                "portal_id": "PAT-EXISTING",
            },
        )
        self.assertEqual(res_dup_portal.status_code, 400)
        self.assertIn("already exists", res_dup_portal.get_json()["error"].lower())

    # =========================================================================
    # Test 10: Unconfigured email service handling (no false claims)
    # =========================================================================
    def test_10_unconfigured_email_service_handling(self):
        """When transactional email is not configured, email_sent is False; no false delivery claims are made."""
        self._login("admin@clinic.org", "AdminSecure@123")

        res = self.client.post(
            "/api/patients",
            json={
                "full_name": "NoEmailConfig Patient",
                "age": 48,
                "gender": "Female",
                "email": "noemail@carepatient.org",
                "portal_id": "PAT-NOEMAIL",
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()

        self.assertFalse(data["email_sent"], "Must not claim email was sent when provider is unconfigured")
        self.assertEqual(data["email_status"], "unconfigured")
        self.assertIsNone(data["email_provider"])

    # =========================================================================
    # Test 11: Mock Resend transactional provider integration
    # =========================================================================
    @patch("requests.post")
    def test_11_mock_resend_delivery_success(self, mock_post):
        """With RESEND_API_KEY set and 200 response, email_sent is confirmed True with provider id."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "res_mock_trans_98765"}
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"RESEND_API_KEY": "re_test_dummy_key_123", "EMAIL_PROVIDER": "resend"}):
            self._login("admin@clinic.org", "AdminSecure@123")
            res = self.client.post(
                "/api/patients",
                json={
                    "full_name": "Resend Test Patient",
                    "age": 52,
                    "gender": "Male",
                    "email": "resend.patient@carepatient.org",
                    "portal_id": "PAT-RESEND",
                },
            )
            self.assertEqual(res.status_code, 201)
            data = res.get_json()

            self.assertTrue(data["email_sent"])
            self.assertEqual(data["email_provider"], "resend")
            self.assertEqual(data["email_status"], "delivered")

            # Check that requests.post was called to https://api.resend.com/emails
            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]
            self.assertEqual(call_url, "https://api.resend.com/emails")
            call_headers = mock_post.call_args[1]["headers"]
            self.assertEqual(call_headers["Authorization"], "Bearer re_test_dummy_key_123")

    # =========================================================================
    # Test 12: Mock Brevo transactional provider integration
    # =========================================================================
    @patch("requests.post")
    def test_12_mock_brevo_delivery_success(self, mock_post):
        """With BREVO_API_KEY set and 201 response, email_sent is confirmed True with messageId."""
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"messageId": "<brevo_mock_id_54321@smtp-relay.mailin.fr>"}
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"BREVO_API_KEY": "xkeysib-brevo-test-key", "EMAIL_PROVIDER": "brevo"}):
            self._login("labtech@clinic.org", "LabTechSecure@123")
            res = self.client.post(
                "/api/patients",
                json={
                    "full_name": "Brevo Test Patient",
                    "age": 41,
                    "gender": "Female",
                    "email": "brevo.patient@carepatient.org",
                    "portal_id": "PAT-BREVO",
                },
            )
            self.assertEqual(res.status_code, 201)
            data = res.get_json()

            self.assertTrue(data["email_sent"])
            self.assertEqual(data["email_provider"], "brevo")
            self.assertEqual(data["email_status"], "delivered")

            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]
            self.assertEqual(call_url, "https://api.brevo.com/v3/smtp/email")
            call_headers = mock_post.call_args[1]["headers"]
            self.assertEqual(call_headers["api-key"], "xkeysib-brevo-test-key")

    # =========================================================================
    # Test 13: Email delivery failure handling
    # =========================================================================
    @patch("requests.post")
    def test_13_mock_email_delivery_failure_handling(self, mock_post):
        """Provider rejection or network error marks delivery as failed without corrupting patient record."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = '{"message": "Invalid API key or unverified domain"}'
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"RESEND_API_KEY": "re_bad_key_fail", "EMAIL_PROVIDER": "resend"}):
            self._login("admin@clinic.org", "AdminSecure@123")
            res = self.client.post(
                "/api/patients",
                json={
                    "full_name": "Failure Case Patient",
                    "age": 49,
                    "gender": "Male",
                    "email": "fail.patient@carepatient.org",
                    "portal_id": "PAT-FAIL",
                },
            )
            self.assertEqual(res.status_code, 201)
            data = res.get_json()

            self.assertFalse(data["email_sent"])
            self.assertEqual(data["email_status"], "failed")
            self.assertIn("Resend rejected email dispatch", data["email_message"])

            # Verify patient and activation token still exist in DB with delivery_status="failed"
            with self.app.app_context():
                user = User.query.filter_by(portal_id="PAT-FAIL").first()
                token_rec = PatientActivationToken.query.filter_by(user_id=user.id).first()
                self.assertEqual(token_rec.delivery_status, "failed")
                self.assertIn("Invalid API key", token_rec.delivery_error)

    # =========================================================================
    # Test 14: Staff retry / re-invite endpoint
    # =========================================================================
    def test_14_staff_reinvite_endpoint_and_authorization(self):
        """Authorized staff can retry sending invitation and update patient email."""
        # 1. Doctor cannot trigger reinvite (403)
        self._login("doctor@clinic.org", "DoctorSecure@123")
        res_doc = self.client.post(f"/api/patients/{self.existing_patient_id}/invite")
        self.assertEqual(res_doc.status_code, 403)

        # 2. Admin can trigger reinvite and update email
        self._login("admin@clinic.org", "AdminSecure@123")
        res_admin = self.client.post(
            f"/api/patients/{self.existing_patient_id}/invite",
            json={"email": "eleanor.updated@patient.org"},
        )
        self.assertEqual(res_admin.status_code, 200)
        self.assertTrue(res_admin.get_json()["success"])

        # 3. Check activation-status endpoint
        status_res = self.client.get(f"/api/patients/{self.existing_patient_id}/activation-status")
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.get_json()
        self.assertTrue(status_data["has_portal_account"])
        self.assertIsNotNone(status_data["last_token"])

    # =========================================================================
    # Test 15: Backward compatibility for existing active accounts
    # =========================================================================
    def test_15_existing_active_patients_backward_compatibility(self):
        """Existing active patients continue to log in seamlessly with their existing credentials."""
        res = self._login("eleanor.existing@patient.org", "ExistingPatientPass123!")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["role"], "patient")
        self.assertEqual(data["user"]["portal_id"], "PAT-EXISTING")


if __name__ == "__main__":
    unittest.main()
