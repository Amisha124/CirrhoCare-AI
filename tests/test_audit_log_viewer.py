import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.user import User


class AuditLogViewerTestSuite(unittest.TestCase):
    """
    Comprehensive test suite for Phase 6 Task 4: Admin Audit Log Viewer.
    Verifies:
    - Strict RBAC: Admin access granted, Labtech / Hepatologist / Patient / Unauth rejected.
    - Field completeness: id, action, details, user_id, user_name, user_email, user_role, created_at.
    - Search functionality across action, details, user email, and user name.
    - Role filtering including explicit 'system' role matching.
    - Action type/prefix filtering.
    - Date range filtering and malformed parameter resilience.
    - Inverted date range resilience (no 500 error).
    - Pagination, page boundaries, and safe sorting.
    - Clean empty dataset responses.
    - Immutability of logs (no POST, PUT, DELETE endpoints).
    Runs strictly in an isolated temporary SQLite database.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_audit_uploads_")

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.test_upload_dir,
            "EXPOSE_DEV_RESET_URL": False,
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety check: Never target active DB
        db_uri = self.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"SAFETY VIOLATION: Test targeting {db_uri}"

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed isolated test users
        self.admin = User(name="Administrator", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lead Lab Specialist", email="lab@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor = User(name="Dr. Jane Hepatologist", email="doctor@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.patient = User(name="Alice Patient", email="alice@patient.com", role="patient", portal_id="PAT-ALICE01")
        self.patient.set_password("Patient@123")

        db.session.add_all([self.admin, self.labtech, self.doctor, self.patient])
        db.session.commit()

        # Seed representative Activity Logs with different timestamps and actors
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        self.log1 = ActivityLog(
            user_id=self.admin.id,
            action="API Key Revocation",
            details="admin@careai.com rotated security credentials",
            created_at=now - timedelta(days=10),
        )
        self.log2 = ActivityLog(
            user_id=self.labtech.id,
            action="Patient created (API)",
            details="Alice Patient (PAT-ALICE01) evaluated High Risk",
            created_at=now - timedelta(days=7),
        )
        self.log3 = ActivityLog(
            user_id=self.labtech.id,
            action="Report uploaded (API)",
            details="alice_liver_biopsy.pdf for Alice Patient",
            created_at=now - timedelta(days=5),
        )
        self.log4 = ActivityLog(
            user_id=self.doctor.id,
            action="Prescription issued",
            details="Alice Patient: Spironolactone 50mg daily by Dr. Jane Hepatologist",
            created_at=now - timedelta(days=2),
        )
        self.log5 = ActivityLog(
            user_id=self.admin.id,
            action="Export patients CSV (API)",
            details="Initiated by admin@careai.com",
            created_at=now - timedelta(hours=12),
        )
        self.log_system = ActivityLog(
            user_id=None,  # System automated action
            action="System Automated Backup",
            details="Scheduled database integrity checkpoint verified",
            created_at=now - timedelta(hours=2),
        )

        db.session.add_all([self.log1, self.log2, self.log3, self.log4, self.log5, self.log_system])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _admin_login(self):
        res = self._login("admin@careai.com", "Admin@123")
        self.assertEqual(res.status_code, 200)
        # Purge ephemeral login activity log so seeded dataset counts remain exact
        ActivityLog.query.filter(ActivityLog.details.ilike("%signed in via REST API%")).delete()
        db.session.commit()
        return res

    # =========================================================
    # 1. AUTHENTICATION & ACCESS CONTROL (RBAC)
    # =========================================================

    def test_unauthenticated_logs_access_rejected(self):
        """Unauthenticated requests to /api/logs return 401 Unauthorized."""
        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success", True))

    def test_patient_logs_access_forbidden(self):
        """Patient role calling /api/logs is rejected with 403 Forbidden."""
        self._login("alice@patient.com", "Patient@123")
        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data.get("success", True))

    def test_hepatologist_logs_access_forbidden(self):
        """Hepatologist role calling /api/logs is rejected with 403 Forbidden."""
        self._login("doctor@careai.com", "Doctor@123")
        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 403)

    def test_labtech_logs_access_forbidden(self):
        """Lab Technician role calling /api/logs is rejected with 403 Forbidden."""
        self._login("lab@careai.com", "Lab@123")
        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 403)

    def test_admin_logs_access_granted(self):
        """Admin role can access /api/logs successfully with complete log list."""
        self._admin_login()
        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total"], 6)
        self.assertEqual(len(data["logs"]), 6)

    # =========================================================
    # 2. FIELD COMPLETENESS & STRUCTURE
    # =========================================================

    def test_admin_logs_field_structure(self):
        """Audit log payload contains exact required schema without phantom fields."""
        self._admin_login()
        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        logs = data["logs"]
        self.assertGreater(len(logs), 0)

        # Inspect non-system log
        user_log = next(l for l in logs if l["user_email"] == "lab@careai.com")
        self.assertIn("id", user_log)
        self.assertIn("action", user_log)
        self.assertIn("details", user_log)
        self.assertIn("user_id", user_log)
        self.assertIn("user_name", user_log)
        self.assertEqual(user_log["user_name"], "Lead Lab Specialist")
        self.assertIn("user_email", user_log)
        self.assertEqual(user_log["user_role"], "labtech")
        self.assertIn("created_at", user_log)

        # Inspect system log (user_id is None)
        sys_log = next(l for l in logs if l["action"] == "System Automated Backup")
        self.assertIsNone(sys_log["user_id"])
        self.assertEqual(sys_log["user_name"], "System")
        self.assertEqual(sys_log["user_email"], "System")
        self.assertEqual(sys_log["user_role"], "system")

    # =========================================================
    # 3. SEARCH & FILTERING
    # =========================================================

    def test_admin_logs_search_by_action(self):
        """Search query 'q' finds logs by action name."""
        self._admin_login()
        res = self.client.get("/api/logs?q=Prescription")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["logs"][0]["action"], "Prescription issued")

    def test_admin_logs_search_by_details(self):
        """Search query 'q' finds logs by content in details/resource."""
        self._admin_login()
        res = self.client.get("/api/logs?q=biopsy")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertIn("biopsy", data["logs"][0]["details"].lower())

    def test_admin_logs_search_by_user_email(self):
        """Search query 'q' matches user email."""
        self._admin_login()
        res = self.client.get("/api/logs?q=doctor@careai.com")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["logs"][0]["user_email"], "doctor@careai.com")

    def test_admin_logs_search_by_user_name(self):
        """Search query 'q' matches user name."""
        self._admin_login()
        res = self.client.get("/api/logs?q=Specialist")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 2)  # Lab tech has 2 logs

    def test_admin_logs_filter_by_role(self):
        """Role parameter accurately filters logs by user role."""
        self._admin_login()
        res = self.client.get("/api/logs?role=labtech")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 2)
        for l in data["logs"]:
            self.assertEqual(l["user_role"], "labtech")

    def test_admin_logs_filter_by_system_role(self):
        """Role parameter 'system' returns system/automated actions without user_id."""
        self._admin_login()
        res = self.client.get("/api/logs?role=system")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["logs"][0]["action"], "System Automated Backup")

    def test_admin_logs_filter_by_action_prefix(self):
        """Action parameter filters logs by action substring."""
        self._admin_login()
        res = self.client.get("/api/logs?action=Patient created")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["logs"][0]["action"], "Patient created (API)")

    # =========================================================
    # 4. DATE RANGE FILTERING & RESILIENCE
    # =========================================================

    def test_admin_logs_date_range_filtering(self):
        """Date range filtering restricts returned logs to within timestamps."""
        self._admin_login()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        start_str = (now - timedelta(days=3)).strftime("%Y-%m-%d")
        end_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        res = self.client.get(f"/api/logs?start_date={start_str}&end_date={end_str}")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        # Events in last 3 days: log4 (2 days), log5 (12 hours), log_system (2 hours) = 3
        self.assertEqual(data["total"], 3)

    def test_admin_logs_inverted_date_range(self):
        """Inverted date range (start after end) safely yields 0 logs without 500 error."""
        self._admin_login()
        res = self.client.get("/api/logs?start_date=2026-12-31&end_date=2026-01-01")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["logs"], [])

    def test_admin_logs_invalid_date_parameters(self):
        """Malformed date parameter strings degrade gracefully without crashing."""
        self._admin_login()
        res = self.client.get("/api/logs?start_date=bad-date&end_date=invalid")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total"], 6)

    # =========================================================
    # 5. PAGINATION & SORTING
    # =========================================================

    def test_admin_logs_pagination_and_bounds(self):
        """Pagination returns expected slice, total, and total_pages."""
        self._admin_login()
        res = self.client.get("/api/logs?page=1&per_page=2")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 6)
        self.assertEqual(len(data["logs"]), 2)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["per_page"], 2)
        self.assertEqual(data["total_pages"], 3)

        # Page 2
        res2 = self.client.get("/api/logs?page=2&per_page=2")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertEqual(len(data2["logs"]), 2)
        self.assertEqual(data2["page"], 2)

    def test_admin_logs_sorting(self):
        """Logs can be sorted ascending or descending by timestamp and action."""
        self._admin_login()
        # Ascending created_at: earliest first (log1: 10 days ago)
        res_asc = self.client.get("/api/logs?sort_by=created_at&sort_dir=asc")
        self.assertEqual(res_asc.status_code, 200)
        data_asc = res_asc.get_json()
        self.assertEqual(data_asc["logs"][0]["action"], "API Key Revocation")

        # Descending created_at: latest first (log_system: 2 hours ago)
        res_desc = self.client.get("/api/logs?sort_by=created_at&sort_dir=desc")
        self.assertEqual(res_desc.status_code, 200)
        data_desc = res_desc.get_json()
        self.assertEqual(data_desc["logs"][0]["action"], "System Automated Backup")

    # =========================================================
    # 6. EMPTY DATASET HANDLING
    # =========================================================

    def test_admin_logs_empty_dataset(self):
        """Empty activity log table returns clean zero-state JSON."""
        self._admin_login()
        ActivityLog.query.delete()
        db.session.commit()

        res = self.client.get("/api/logs")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["logs"], [])
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["total_pages"], 1)

    # =========================================================
    # 7. IMMUTABILITY & SECURITY (NO MODIFICATION ENDPOINTS)
    # =========================================================

    def test_logs_immutable_via_api(self):
        """Activity logs cannot be created, modified, or deleted via /api/logs."""
        self._admin_login()
        # POST
        res_post = self.client.post("/api/logs", json={"action": "Tamper", "details": "Unauthorized"})
        self.assertEqual(res_post.status_code, 405)

        # PUT
        res_put = self.client.put("/api/logs/1", json={"action": "Tamper"})
        self.assertEqual(res_put.status_code, 405)

        # DELETE
        res_del = self.client.delete("/api/logs/1")
        self.assertEqual(res_del.status_code, 405)


if __name__ == "__main__":
    unittest.main()
