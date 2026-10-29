"""
tests.test_baseline_clinical_dataset
------------------------------------
Verifies that:
1. An empty database is safely initialized with 8 realistic synthetic demo patients.
2. The initialization is idempotent (running it again does not duplicate patients).
3. The AI Random Forest model calculates real risk scores and sets risk labels.
4. Prescriptions, appointments, activity logs, and diagnostic reports are populated.
5. All clinical roles (Doctor, Lab Tech, Admin, Patient) can access their respective endpoints.
"""

import tempfile
import unittest
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


class BaselineClinicalDatasetTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_file.close()
        self.temp_db_path = self.temp_file.name

        test_config = {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "WTF_CSRF_ENABLED": False,
            "SECRET_KEY": "test-clean-baseline-key",
            "DEMO_MODE": False,
        }
        self.app = create_app(test_config=test_config)
        with self.app.app_context():
            from app.utils.clinical_seed import seed_baseline_clinical_data
            seed_baseline_clinical_data(self.app)

    def tearDown(self):
        try:
            Path(self.temp_db_path).unlink(missing_ok=True)
        except Exception:
            pass

    def test_baseline_seeding_on_fresh_database(self):
        with self.app.app_context():
            # Verify 4 user accounts exist
            users = User.query.all()
            user_emails = {u.email for u in users}
            self.assertIn("admin@careai.com", user_emails)
            self.assertIn("doctor@careai.com", user_emails)
            self.assertIn("lab@careai.com", user_emails)
            self.assertIn("patient@careai.com", user_emails)

            # Verify 8 patients exist
            patients = Patient.query.all()
            self.assertEqual(len(patients), 8)
            portal_ids = {p.portal_id for p in patients}
            self.assertIn("PAT-1001", portal_ids)
            self.assertIn("PAT-1008", portal_ids)

            # Verify Eleanor Vance PAT-1001 details
            eleanor = Patient.query.filter_by(portal_id="PAT-1001").first()
            self.assertIsNotNone(eleanor)
            self.assertEqual(eleanor.full_name, "Eleanor Vance [DEMO]")
            self.assertEqual(eleanor.age, 58)
            self.assertEqual(eleanor.gender, "Female")
            self.assertEqual(eleanor.bilirubin, 4.6)
            self.assertEqual(eleanor.albumin, 2.5)
            self.assertIn(eleanor.latest_risk_label, ("High Risk", "High"))
            self.assertGreater(eleanor.latest_risk_percent, 70.0)
            self.assertEqual(eleanor.treatment_status, "Under Treatment")
            self.assertIsNotNone(eleanor.diet_plan)
            self.assertIsNotNone(eleanor.care_instructions)

            # Verify AI predictions were calculated
            predictions = Prediction.query.all()
            self.assertGreaterEqual(len(predictions), 8)
            pred_labels = {pr.risk_label for pr in predictions}
            self.assertTrue("High Risk" in pred_labels or "High" in pred_labels)
            self.assertTrue("Low Risk" in pred_labels or "Low" in pred_labels)

            # Verify appointments exist
            appointments = Appointment.query.all()
            self.assertGreaterEqual(len(appointments), 4)
            appnt_statuses = {a.status for a in appointments}
            self.assertIn("Confirmed", appnt_statuses)
            self.assertIn("Completed", appnt_statuses)

            # Verify prescriptions exist
            prescriptions = Prescription.query.all()
            self.assertGreaterEqual(len(prescriptions), 5)

            # Verify reports exist
            reports = Report.query.all()
            self.assertGreaterEqual(len(reports), 6)

            # Verify logs & notifications exist
            logs = ActivityLog.query.all()
            self.assertGreaterEqual(len(logs), 8)

            notifs = Notification.query.all()
            self.assertGreaterEqual(len(notifs), 2)

    def test_baseline_seeding_is_idempotent(self):
        from app.utils.clinical_seed import seed_baseline_clinical_data

        with self.app.app_context():
            initial_count = Patient.query.count()
            self.assertEqual(initial_count, 8)

            # Run seeder a second time
            res = seed_baseline_clinical_data(self.app)
            self.assertEqual(res["status"], "skipped_existing_data")

            # Patient count must still be exactly 8
            self.assertEqual(Patient.query.count(), 8)
            self.assertEqual(User.query.count(), 4)

    def test_clinical_dashboard_api_visibility(self):
        client = self.app.test_client()

        # 1. Doctor login & patient visibility
        res = client.post("/api/auth/login", json={"identifier": "doctor@careai.com", "password": "Doctor@123"})
        self.assertEqual(res.status_code, 200)

        doc_patients = client.get("/api/patients")
        self.assertEqual(doc_patients.status_code, 200)
        doc_p_data = doc_patients.get_json()
        self.assertEqual(doc_p_data["total"], 8)
        self.assertEqual(len(doc_p_data["patients"]), 8)

        # Doctor dashboard stats
        doc_stats = client.get("/api/dashboard/stats")
        self.assertEqual(doc_stats.status_code, 200)
        doc_s_data = doc_stats.get_json()
        self.assertTrue(doc_s_data["success"])

        # 2. Lab Tech login & patient visibility
        client.post("/api/auth/login", json={"identifier": "lab@careai.com", "password": "Lab@123"})
        lab_patients = client.get("/api/patients")
        self.assertEqual(lab_patients.status_code, 200)
        lab_p_data = lab_patients.get_json()
        self.assertEqual(lab_p_data["total"], 8)

        # 3. Admin login & statistics
        client.post("/api/auth/login", json={"identifier": "admin@careai.com", "password": "Admin@123"})
        admin_stats = client.get("/api/dashboard/stats")
        self.assertEqual(admin_stats.status_code, 200)
        admin_json = admin_stats.get_json()
        self.assertTrue(admin_json["success"])
        admin_s_data = admin_json.get("stats") or admin_json.get("data", {}).get("stats", {})
        self.assertEqual(admin_s_data["total_patients"], 8)
        self.assertEqual(admin_s_data["total_users"], 4)
        self.assertGreaterEqual(admin_s_data["total_predictions"], 8)
        self.assertGreaterEqual(admin_s_data["total_reports"], 6)

        # 4. Patient Portal login & self record visibility
        client.post("/api/auth/login", json={"identifier": "patient@careai.com", "password": "Patient@123"})
        pat_stats = client.get("/api/dashboard/stats")
        self.assertEqual(pat_stats.status_code, 200)
        pat_s_data = pat_stats.get_json()
        self.assertTrue(pat_s_data["success"])
        self.assertEqual(pat_s_data["portal_id"], "PAT-1001")
        self.assertIsNotNone(pat_s_data["latest_record"])
        self.assertEqual(pat_s_data["latest_record"]["full_name"], "Eleanor Vance [DEMO]")
        self.assertGreaterEqual(pat_s_data["reports_count"], 1)

        pat_patients = client.get("/api/patients")
        self.assertEqual(pat_patients.status_code, 200)
        pat_p_data = pat_patients.get_json()
        self.assertEqual(pat_p_data["total"], 1)
        self.assertEqual(pat_p_data["patients"][0]["portal_id"], "PAT-1001")

        # 5. Report download verification
        pat_reports = client.get("/api/reports")
        self.assertEqual(pat_reports.status_code, 200)
        reps = pat_reports.get_json().get("reports", [])
        self.assertGreaterEqual(len(reps), 1)
        rep_id = reps[0]["id"]
        dl_res = client.get(f"/api/reports/{rep_id}/download")
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.mimetype, "application/pdf")
        self.assertTrue(dl_res.data.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
