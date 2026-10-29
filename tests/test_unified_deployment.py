import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class UnifiedDeploymentRegressionTest(unittest.TestCase):
    """
    Comprehensive regression test suite for Phase 5 Step 2:
    Unified Flask + React SPA Deployment (Option A).
    Runs strictly against an isolated temporary SQLite database.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_unified_uploads_")

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.test_upload_dir,
            "EXPOSE_DEV_RESET_URL": False,
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion: NEVER touch active instance DB
        db_uri = self.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"SAFETY VIOLATION: Test targeting {db_uri}"

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed isolated test accounts
        self.admin = User(name="Admin User", email="admin_test@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lab Tech", email="lab_test@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor = User(name="Dr. Hepatologist", email="doc_test@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.patient1_user = User(name="Alice Patient", email="alice_test@careai.com", role="patient", portal_id="PAT-U101")
        self.patient1_user.set_password("Patient@123")

        self.patient2_user = User(name="Bob Patient", email="bob_test@careai.com", role="patient", portal_id="PAT-U102")
        self.patient2_user.set_password("Patient@123")

        db.session.add_all([self.admin, self.labtech, self.doctor, self.patient1_user, self.patient2_user])
        db.session.commit()

        # Seed clinical patient records
        self.patient1 = Patient(
            full_name="Alice Patient",
            portal_id="PAT-U101",
            email="alice_test@careai.com",
            age=48,
            gender="Female",
            latest_risk_label="High Risk",
            latest_risk_percent=76.4,
            treatment_status="Under review",
            created_by_id=self.labtech.id,
        )
        self.patient2 = Patient(
            full_name="Bob Patient",
            portal_id="PAT-U102",
            email="bob_test@careai.com",
            age=55,
            gender="Male",
            latest_risk_label="Low Risk",
            latest_risk_percent=18.2,
            treatment_status="Stable",
            created_by_id=self.labtech.id,
        )
        db.session.add_all([self.patient1, self.patient2])
        db.session.commit()

        # Create dummy report file for patient 1
        rep_file = Path(self.test_upload_dir) / "alice_lab_report.pdf"
        rep_file.write_bytes(b"%PDF-1.4 Diagnostic Lab Report Sample Content")

        self.report1 = Report(
            patient=self.patient1,
            filename="alice_lab_report.pdf",
            original_filename="blood_panel.pdf",
        )
        db.session.add(self.report1)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def login_as(self, email, password):
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200, f"Login failed for {email}: {res.get_json()}")
        return res

    # =========================================================================
    # 1. REACT SPA SERVING & CLIENT-SIDE ROUTING
    # =========================================================================
    def test_spa_index_served_at_root_and_workspaces(self):
        """Verify that React SPA index.html is served for root and role workspace routes."""
        for route in ["/", "/login", "/admin", "/lab", "/doctor", "/patient", "/patients", "/analytics", "/settings"]:
            res = self.client.get(route)
            self.assertEqual(res.status_code, 200, f"Route {route} failed to return 200")
            html = res.get_data(as_text=True)
            self.assertIn('<div id="root"></div>', html, f"Route {route} did not serve React index.html")
            self.assertIn("CirrhoCare AI", html)

    def test_spa_assets_served_and_missing_assets_404(self):
        """Verify that static assets serve with correct status and missing assets return 404."""
        # Find an existing asset in frontend/dist/assets
        dist_assets = Path("frontend/dist/assets")
        self.assertTrue(dist_assets.is_dir(), "frontend/dist/assets directory missing")
        asset_files = list(dist_assets.glob("*.js"))
        self.assertTrue(len(asset_files) > 0, "No built JS asset found")
        asset_name = asset_files[0].name

        # Existing asset -> 200
        res = self.client.get(f"/assets/{asset_name}")
        self.assertEqual(res.status_code, 200)

        # Missing asset -> 404 (MUST NOT return index.html)
        res_missing = self.client.get("/assets/missing-asset-xyz.js")
        self.assertEqual(res_missing.status_code, 404)
        self.assertNotIn('<div id="root"></div>', res_missing.get_data(as_text=True))

    def test_unknown_api_endpoints_return_json_404_never_index_html(self):
        """Verify that unknown /api/* requests return JSON 404, never index.html."""
        for path in ["/api/non-existent-endpoint", "/api/v2/foo", "/api/patients/99999/unknown-action"]:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 404)
            data = res.get_json()
            self.assertIsNotNone(data, f"Endpoint {path} did not return JSON")
            self.assertFalse(data.get("success", True))
            self.assertIn("not found", data.get("error", "").lower())

    # =========================================================================
    # 2. AUTHENTICATION & SECURITY ISOLATION
    # =========================================================================
    def test_unauthenticated_api_returns_json_401(self):
        """Verify that unauthenticated API calls return JSON 401, not HTML login page redirect."""
        res = self.client.get("/api/patients")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIsNotNone(data)
        self.assertFalse(data.get("success", True))
        self.assertIn("Authentication required", data.get("error", ""))

    def test_unauthenticated_web_navigation_redirects_to_login(self):
        """Verify that unauthenticated browser requests to protected routes redirect to /login."""
        res = self.client.get("/admin/export.csv")
        self.assertEqual(res.status_code, 302)
        self.assertIn("/login", res.headers.get("Location", ""))

    # =========================================================================
    # 3. CSV AND PDF EXPORT AUTHORIZATION
    # =========================================================================
    def test_csv_export_admin_authorized_and_roles_forbidden(self):
        """Verify that /api/export/patients.csv and /admin/export.csv allow Admin and reject others."""
        # 1. Admin -> allowed 200
        self.login_as("admin_test@careai.com", "Admin@123")

        res_api = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_api.status_code, 200)
        self.assertEqual(res_api.mimetype, "text/csv")
        csv_text = res_api.get_data(as_text=True)
        self.assertIn("Name,Age,Gender,Risk", csv_text)
        self.assertIn("Alice Patient", csv_text)
        self.assertIn("Bob Patient", csv_text)

        res_bridge = self.client.get("/admin/export.csv")
        self.assertEqual(res_bridge.status_code, 200)
        self.assertEqual(res_bridge.mimetype, "text/csv")
        self.assertIn("Alice Patient", res_bridge.get_data(as_text=True))

        # 2. Lab Tech -> 403 Forbidden on admin bridge route, 200 on role-authorized API route
        self.client.post("/api/auth/logout")
        self.login_as("lab_test@careai.com", "Lab@123")

        res_lab_bridge = self.client.get("/admin/export.csv")
        self.assertEqual(res_lab_bridge.status_code, 403)
        res_lab_api = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_lab_api.status_code, 200)

        # 3. Patient -> 403 Forbidden on admin bridge route, 200 with patient-level isolation on API route
        self.client.post("/api/auth/logout")
        self.login_as("alice_test@careai.com", "Patient@123")

        res_pat_bridge = self.client.get("/admin/export.csv")
        self.assertEqual(res_pat_bridge.status_code, 403)
        res_pat_api = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_pat_api.status_code, 200)
        pat_csv_text = res_pat_api.get_data(as_text=True)
        self.assertIn("Alice Patient", pat_csv_text)
        self.assertNotIn("Bob Patient", pat_csv_text)

        # 4. Unauthenticated -> 401 Unauthorized
        self.client.post("/api/auth/logout")
        res_unauth = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_unauth.status_code, 401)

    def test_pdf_report_admin_authorized_and_roles_forbidden(self):
        """Verify that /admin/report.pdf allows Admin and rejects others, and /api/export/report.pdf enforces auth."""
        # 1. Admin -> allowed 200 with valid PDF bytes
        self.login_as("admin_test@careai.com", "Admin@123")

        res_api = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_api.status_code, 200)
        self.assertEqual(res_api.mimetype, "application/pdf")
        self.assertTrue(res_api.data.startswith(b"%PDF"))

        res_bridge = self.client.get("/admin/report.pdf")
        self.assertEqual(res_bridge.status_code, 200)
        self.assertEqual(res_bridge.mimetype, "application/pdf")
        self.assertTrue(res_bridge.data.startswith(b"%PDF"))

        # 2. Doctor -> 403 Forbidden on admin bridge route, 200 on authorized clinical API route
        self.client.post("/api/auth/logout")
        self.login_as("doc_test@careai.com", "Doctor@123")

        res_doc_bridge = self.client.get("/admin/report.pdf")
        self.assertEqual(res_doc_bridge.status_code, 403)
        res_doc_api = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_doc_api.status_code, 200)
        self.assertTrue(res_doc_api.data.startswith(b"%PDF"))

        # 3. Unauthenticated -> 401 Unauthorized
        self.client.post("/api/auth/logout")
        res_unauth = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_unauth.status_code, 401)

    # =========================================================================
    # 4. USER REGISTRATION & ZERO-DUMMY-RECORD SAFETY
    # =========================================================================
    def test_registration_validation_and_clinical_record_safety(self):
        """Verify that user registration validates input and creates ZERO fake clinical patient records."""
        # 1. API Registration with missing fields
        res_fail = self.client.post("/api/auth/register", json={"name": "", "email": "bad"})
        self.assertEqual(res_fail.status_code, 400)

        # 2. API Registration with short password
        res_short = self.client.post("/api/auth/register", json={
            "name": "New User",
            "email": "newuser@careai.com",
            "role": "patient",
            "password": "123",
        })
        self.assertEqual(res_short.status_code, 400)

        # 3. Successful API registration
        res_ok = self.client.post("/api/auth/register", json={
            "name": "Self Reg Patient",
            "email": "selfreg@careai.com",
            "role": "patient",
            "password": "SecurePassword@123",
        })
        self.assertEqual(res_ok.status_code, 201)
        data = res_ok.get_json()
        self.assertTrue(data["success"])
        self.assertIsNotNone(data["user"]["portal_id"])

        # Strict check: NO fake clinical patient record created in patients table!
        fake_patient = Patient.query.filter_by(email="selfreg@careai.com").first()
        self.assertIsNone(fake_patient, "Violation: Registration created dummy patient record in patients table!")

        # 4. Legacy form POST registration (/auth/register)
        res_form = self.client.post("/auth/register", data={
            "name": "Legacy Form User",
            "email": "legacyform@careai.com",
            "role": "patient",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
        }, follow_redirects=True)
        self.assertEqual(res_form.status_code, 200)

        user_legacy = User.query.filter_by(email="legacyform@careai.com").first()
        self.assertIsNotNone(user_legacy)
        self.assertIsNotNone(user_legacy.portal_id)

        # Strict check: NO fake clinical patient record created
        fake_legacy_patient = Patient.query.filter_by(email="legacyform@careai.com").first()
        self.assertIsNone(fake_legacy_patient)

    # =========================================================================
    # 5. LEGACY BLOCKED PASSWORD RESET (403 FORBIDDEN)
    # =========================================================================
    def test_legacy_reset_password_by_user_id_blocked(self):
        """Verify that GET and POST /auth/reset-password/<user_id> explicitly return 403 Forbidden."""
        res_get = self.client.get(f"/auth/reset-password/{self.admin.id}")
        self.assertEqual(res_get.status_code, 403)

        res_post = self.client.post(f"/auth/reset-password/{self.admin.id}", data={"password": "Hack@123"})
        self.assertEqual(res_post.status_code, 403)

    # =========================================================================
    # 6. MEDICAL REPORT DOWNLOADS EQUIVALENCE & AUTHORIZATION
    # =========================================================================
    def test_report_downloads_enforce_identical_access_control(self):
        """Verify that /api/reports/<id>/download and /reports/<id>/download enforce identical security."""
        # 1. Unauthenticated -> 401 for API, 302 for web
        res_unauth_api = self.client.get(f"/api/reports/{self.report1.id}/download")
        self.assertEqual(res_unauth_api.status_code, 401)

        res_unauth_web = self.client.get(f"/reports/{self.report1.id}/download")
        self.assertEqual(res_unauth_web.status_code, 302)

        # 2. Patient 1 (Owner) -> Allowed 200 on both
        self.login_as("alice_test@careai.com", "Patient@123")
        res_own_api = self.client.get(f"/api/reports/{self.report1.id}/download")
        self.assertEqual(res_own_api.status_code, 200)
        self.assertEqual(res_own_api.data, b"%PDF-1.4 Diagnostic Lab Report Sample Content")

        res_own_web = self.client.get(f"/reports/{self.report1.id}/download")
        self.assertEqual(res_own_web.status_code, 200)
        self.assertEqual(res_own_web.data, b"%PDF-1.4 Diagnostic Lab Report Sample Content")

        # 3. Patient 2 (Unauthorized cross-patient) -> 403 on both
        self.client.post("/api/auth/logout")
        self.login_as("bob_test@careai.com", "Patient@123")

        res_cross_api = self.client.get(f"/api/reports/{self.report1.id}/download")
        self.assertEqual(res_cross_api.status_code, 403)

        res_cross_web = self.client.get(f"/reports/{self.report1.id}/download")
        self.assertEqual(res_cross_web.status_code, 403)

        # 4. Doctor (Care team) -> Allowed 200 on both
        self.client.post("/api/auth/logout")
        self.login_as("doc_test@careai.com", "Doctor@123")

        res_doc_api = self.client.get(f"/api/reports/{self.report1.id}/download")
        self.assertEqual(res_doc_api.status_code, 200)

        res_doc_web = self.client.get(f"/reports/{self.report1.id}/download")
        self.assertEqual(res_doc_web.status_code, 200)

    # =========================================================================
    # 7. PRODUCTION WSGI INITIALIZATION
    # =========================================================================
    def test_production_wsgi_app_initialization(self):
        """Verify that wsgi.py exports a properly configured Flask WSGI application."""
        from wsgi import app as wsgi_app
        self.assertIsNotNone(wsgi_app)
        self.assertIn("/api/patients", [str(r) for r in wsgi_app.url_map.iter_rules()])

    # =========================================================================
    # 8. PRODUCTION HEALTH MONITORING
    # =========================================================================
    def test_health_check_endpoint(self):
        """Verify that /api/health returns status 200 with service metadata."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("service"), "CirrhoCare AI")
        self.assertIn("timestamp", data)


if __name__ == "__main__":
    unittest.main()
