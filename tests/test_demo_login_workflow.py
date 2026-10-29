import os
import shutil
import tempfile
import unittest

from app import create_app
from app.models import db
from app.models.user import User
from app.models.patient import Patient
from app.utils.demo_provisioning import ensure_demo_accounts_provisioned


class DemoLoginWorkflowTestCase(unittest.TestCase):
    """
    Automated test suite verifying the Demo Login workflow:
    1. Demo login succeeds for each of the four roles (Admin, Doctor, Lab Tech, Patient) when enabled.
    2. The authenticated user receives the expected role and can access their respective role-specific endpoints.
    3. Patient demo login cannot access doctor, lab tech, or admin endpoints.
    4. Lab technician demo login cannot access admin endpoints.
    5. Doctor demo login cannot access admin endpoints.
    6. When demo mode is disabled (or in production mode), demo login is blocked with 403 Forbidden.
    7. Normal login with valid credentials continues to function properly for both clinical staff and patients.
    8. Invalid demo role requests are rejected safely.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_demo_login_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="demo_login_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-demo-login-secret-key-123"

        test_config = {
            "TESTING": True,
            "DEMO_MODE": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-demo-login-secret-key-123",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertions
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if (
            "instance/cirrhosis.db" in db_uri
            or "instance/demo_cirrhosis.db" in db_uri
            or db_uri.endswith("/cirrhosis.db")
            or db_uri.endswith("/demo_cirrhosis.db")
        ):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test connected to live instance DB: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test DB mismatch ({db_uri} vs {self.db_path})")

        with self.app.app_context():
            db.create_all()
            ensure_demo_accounts_provisioned(self.app, force=True)

    def tearDown(self):
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if (
            "instance/cirrhosis.db" in db_uri
            or "instance/demo_cirrhosis.db" in db_uri
            or db_uri.endswith("/cirrhosis.db")
            or db_uri.endswith("/demo_cirrhosis.db")
        ):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Teardown targeted live instance DB: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Teardown DB mismatch ({db_uri} vs {self.db_path})")

        with self.app.app_context():
            db.session.remove()
            db.drop_all()

        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except OSError:
            pass

        try:
            if os.path.exists(self.temp_upload_dir):
                shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
        except OSError:
            pass

    def test_demo_login_all_four_roles(self):
        """Verifies demo login succeeds for each of the four roles when enabled."""
        roles_to_test = [
            ("admin", "admin", "/admin"),
            ("doctor", "hepatologist", "/doctor"),
            ("labtech", "labtech", "/lab"),
            ("patient", "patient", "/patient"),
        ]

        for input_role, expected_role, expected_redirect in roles_to_test:
            # Clear cookies / logout between role tests
            self.client.post("/api/auth/logout")

            res = self.client.post("/api/auth/demo-login", json={"role": input_role})
            self.assertEqual(res.status_code, 200, f"Demo login failed for role {input_role}: {res.get_json()}")
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertEqual(data.get("user", {}).get("role"), expected_role)
            self.assertEqual(data.get("redirect_url"), expected_redirect)

            # Confirm session cookie was set by testing /api/auth/me
            me_res = self.client.get("/api/auth/me")
            self.assertEqual(me_res.status_code, 200)
            me_data = me_res.get_json()
            self.assertTrue(me_data.get("authenticated"))
            self.assertEqual(me_data.get("user", {}).get("role"), expected_role)

    def test_demo_user_access_authorized_endpoints(self):
        """Verifies authenticated demo users can access their role-specific endpoints."""
        # 1. Admin accesses /api/logs and dashboard stats
        self.client.post("/api/auth/demo-login", json={"role": "admin"})
        logs_res = self.client.get("/api/logs")
        self.assertEqual(logs_res.status_code, 200)
        stats_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(stats_res.status_code, 200)

        # 2. Doctor accesses /api/patients and lab orders
        self.client.post("/api/auth/demo-login", json={"role": "doctor"})
        patients_res = self.client.get("/api/patients")
        self.assertEqual(patients_res.status_code, 200)
        orders_res = self.client.get("/api/lab-orders")
        self.assertEqual(orders_res.status_code, 200)

        # 3. Lab Tech accesses /api/patients and lab orders
        self.client.post("/api/auth/demo-login", json={"role": "labtech"})
        lab_patients_res = self.client.get("/api/patients")
        self.assertEqual(lab_patients_res.status_code, 200)
        lab_orders_res = self.client.get("/api/lab-orders")
        self.assertEqual(lab_orders_res.status_code, 200)

        # 4. Patient accesses /api/patients (filtered to own record only)
        self.client.post("/api/auth/demo-login", json={"role": "patient"})
        pat_res = self.client.get("/api/patients")
        self.assertEqual(pat_res.status_code, 200)
        pat_data = pat_res.get_json()
        patients_list = pat_data.get("patients", [])
        self.assertEqual(len(patients_list), 1)
        self.assertEqual(patients_list[0].get("portal_id"), "PAT-1001")

    def test_patient_cannot_access_doctor_lab_admin_endpoints(self):
        """Verifies that patient demo login cannot access doctor, lab tech, or admin endpoints."""
        self.client.post("/api/auth/demo-login", json={"role": "patient"})

        # Patient cannot access admin logs
        res_logs = self.client.get("/api/logs")
        self.assertEqual(res_logs.status_code, 403)

        # Patient cannot create patient records (admin/labtech only)
        res_create_pat = self.client.post(
            "/api/patients",
            json={
                "full_name": "Unauthorized Patient",
                "age": 40,
                "gender": "Male",
            },
        )
        self.assertEqual(res_create_pat.status_code, 403)

        # Patient cannot create prescriptions (hepatologist/admin only)
        res_rx = self.client.post(
            "/api/patients/1/prescriptions",
            json={
                "medicine": "Unauthorized Rx",
                "dosage": "10mg",
                "frequency_days": 10,
            },
        )
        self.assertEqual(res_rx.status_code, 403)

        # Patient cannot create lab orders (hepatologist/admin only)
        res_order = self.client.post(
            "/api/patients/1/lab-orders",
            json={
                "test_type": "Comprehensive Metabolic Panel",
                "priority": "Routine",
            },
        )
        self.assertEqual(res_order.status_code, 403)

    def test_labtech_cannot_access_admin_endpoints(self):
        """Verifies that lab technician demo login cannot access admin endpoints."""
        self.client.post("/api/auth/demo-login", json={"role": "labtech"})

        # Lab tech cannot access admin logs
        res_logs = self.client.get("/api/logs")
        self.assertEqual(res_logs.status_code, 403)

        # Lab tech cannot create clinical prescriptions
        res_rx = self.client.post(
            "/api/patients/1/prescriptions",
            json={
                "medicine": "Unauthorized Rx",
                "dosage": "10mg",
                "frequency_days": 10,
            },
        )
        self.assertEqual(res_rx.status_code, 403)

    def test_doctor_cannot_access_admin_endpoints(self):
        """Verifies that doctor demo login cannot access admin endpoints."""
        self.client.post("/api/auth/demo-login", json={"role": "doctor"})

        # Doctor cannot access admin logs
        res_logs = self.client.get("/api/logs")
        self.assertEqual(res_logs.status_code, 403)

        # Doctor cannot register new patient accounts (admin/labtech workflow)
        res_create_pat = self.client.post(
            "/api/patients",
            json={
                "full_name": "Doctor Created Patient",
                "age": 40,
                "gender": "Male",
            },
        )
        self.assertEqual(res_create_pat.status_code, 403)

    def test_demo_login_blocked_when_demo_mode_disabled(self):
        """Verifies that when DEMO_MODE=False (production mode), demo login is blocked with 403."""
        # Create an isolated app with DEMO_MODE=False
        prod_temp_db = tempfile.NamedTemporaryFile(suffix="_prod_mode_test.db", delete=False)
        prod_temp_db.close()
        prod_db_path = prod_temp_db.name
        prod_upload_dir = tempfile.mkdtemp(prefix="prod_mode_uploads_")

        try:
            prod_config = {
                "TESTING": False,
                "DEMO_MODE": False,
                "WTF_CSRF_ENABLED": False,
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{prod_db_path}",
                "UPLOAD_FOLDER": prod_upload_dir,
                "DEMO_UPLOAD_FOLDER": prod_upload_dir,
                "SECRET_KEY": "prod-secret-key-safe",
            }
            prod_app = create_app(test_config=prod_config)
            prod_client = prod_app.test_client()

            with prod_app.app_context():
                db.create_all()

            for role in ["admin", "doctor", "labtech", "patient"]:
                res = prod_client.post("/api/auth/demo-login", json={"role": role})
                self.assertEqual(
                    res.status_code,
                    403,
                    f"Expected 403 Forbidden for role {role} in non-demo mode, got {res.status_code}",
                )
                data = res.get_json()
                self.assertFalse(data.get("success", False))
                self.assertIn("strictly disabled in production mode", data.get("error", ""))

            # Also check health endpoint returns demo_mode: False
            health_res = prod_client.get("/api/health")
            self.assertEqual(health_res.status_code, 200)
            self.assertFalse(health_res.get_json().get("demo_mode"))

        finally:
            try:
                if os.path.exists(prod_db_path):
                    os.remove(prod_db_path)
            except OSError:
                pass
            try:
                if os.path.exists(prod_upload_dir):
                    shutil.rmtree(prod_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def test_normal_login_with_demo_credentials(self):
        """Verifies normal login continues to function properly for both clinical staff and patients."""
        # 1. Staff login with admin demo credentials
        admin_res = self.client.post(
            "/api/auth/login",
            json={"identifier": "demo.admin@cirrhocare.org", "password": "DemoAdmin@123"},
        )
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.get_json().get("user", {}).get("role"), "admin")
        self.client.post("/api/auth/logout")

        # 2. Staff login with doctor demo credentials
        doc_res = self.client.post(
            "/api/auth/login",
            json={"identifier": "demo.doctor@cirrhocare.org", "password": "DemoDoctor@123"},
        )
        self.assertEqual(doc_res.status_code, 200)
        self.assertEqual(doc_res.get_json().get("user", {}).get("role"), "hepatologist")
        self.client.post("/api/auth/logout")

        # 3. Staff login with labtech demo credentials
        lab_res = self.client.post(
            "/api/auth/login",
            json={"identifier": "demo.labtech@cirrhocare.org", "password": "DemoLab@123"},
        )
        self.assertEqual(lab_res.status_code, 200)
        self.assertEqual(lab_res.get_json().get("user", {}).get("role"), "labtech")
        self.client.post("/api/auth/logout")

        # 4. Patient ID & PIN login via /api/auth/patient-login
        pat_res = self.client.post(
            "/api/auth/patient-login",
            json={
                "name": "Demo Patient",
                "portal_id": "PAT-1001",
                "pin": "DemoPatient@123",
            },
        )
        self.assertEqual(pat_res.status_code, 200)
        self.assertEqual(pat_res.get_json().get("user", {}).get("role"), "patient")
        self.client.post("/api/auth/logout")

        # 5. Invalid PIN rejected
        bad_pin_res = self.client.post(
            "/api/auth/patient-login",
            json={
                "name": "Demo Patient",
                "portal_id": "PAT-1001",
                "pin": "WrongPin@999",
            },
        )
        self.assertEqual(bad_pin_res.status_code, 401)

    def test_health_endpoint_runtime_reporting(self):
        """Verifies /api/health accurately reports runtime demo_mode and retains all existing fields."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("service"), "CirrhoCare AI")
        self.assertEqual(data.get("version"), "1.0.0")
        self.assertIn("timestamp", data)
        self.assertIn("demo_mode", data)
        self.assertIs(data.get("demo_mode"), True)

        # Invariant: If database URI targets production cirrhosis.db, is_demo_allowed MUST be False
        from app.utils.demo_provisioning import is_demo_allowed
        class DummyProdApp:
            config = {
                "DEMO_MODE": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///C:/app/instance/cirrhosis.db",
            }
        self.assertFalse(is_demo_allowed(DummyProdApp()))

    def test_invalid_demo_role_rejected(self):
        """Verifies that requests with unknown demo roles return 400 Bad Request."""
        res = self.client.post("/api/auth/demo-login", json={"role": "superadmin"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid demo role", res.get_json().get("error", ""))


if __name__ == "__main__":
    unittest.main()

