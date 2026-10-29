import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class ClinicalReportAnalyticsTestSuite(unittest.TestCase):
    """
    Comprehensive test suite for Phase 6 Task 3: Clinical Report Analytics.
    Verifies:
    - Report counts and category aggregation
    - Clinical status and risk distribution
    - Temporal upload velocity trends
    - Date-range filtering and invalid parameter resilience
    - Patient-level authorization and isolation
    - Role-based permissions (Admin, Labtech, Hepatologist, Patient)
    - Empty dataset handling
    - Regression stability
    Runs strictly in an isolated temporary SQLite database.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_uploads_")

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
        self.admin = User(name="Executive Admin", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lead Lab Specialist", email="lab@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor1 = User(name="Dr. Jane Attending", email="doctor1@careai.com", role="hepatologist")
        self.doctor1.set_password("Doctor@123")

        self.doctor2 = User(name="Dr. Mark External", email="doctor2@careai.com", role="hepatologist")
        self.doctor2.set_password("Doctor@123")

        self.patient1_user = User(
            name="Alice Smith", email="alice@patient.com", role="patient", portal_id="PAT-ALICE01"
        )
        self.patient1_user.set_password("Patient@123")

        self.patient2_user = User(
            name="Bob Jones", email="bob@patient.com", role="patient", portal_id="PAT-BOB02"
        )
        self.patient2_user.set_password("Patient@123")

        db.session.add_all([
            self.admin, self.labtech, self.doctor1, self.doctor2,
            self.patient1_user, self.patient2_user
        ])
        db.session.commit()

        # Seed Clinical Patients
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.patient1 = Patient(
            full_name="Alice Smith",
            portal_id="PAT-ALICE01",
            email="alice@patient.com",
            phone="111-222-3333",
            age=46,
            gender="Female",
            latest_risk_label="High Risk",
            treatment_status="Under treatment",
            created_at=now - timedelta(days=20),
            created_by_id=self.labtech.id,
            bilirubin=2.4,
            albumin=3.1,
            sgot=58.0,
            sgpt=62.0,
            platelets=130.0,
            alk_phos=145.0,
        )
        self.patient2 = Patient(
            full_name="Bob Jones",
            portal_id="PAT-BOB02",
            email="bob@patient.com",
            phone="444-555-6666",
            age=58,
            gender="Male",
            latest_risk_label="Low Risk",
            treatment_status="Awaiting review",
            created_at=now - timedelta(days=10),
            created_by_id=self.labtech.id,
            bilirubin=0.9,
            albumin=4.2,
            sgot=25.0,
            sgpt=22.0,
            platelets=260.0,
            alk_phos=90.0,
        )
        db.session.add_all([self.patient1, self.patient2])
        db.session.commit()

        # Create doctor assignments via appointments
        self.appnt1 = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=now + timedelta(days=1),
            reason="Liver function review",
            status="Scheduled",
        )
        self.appnt2 = Appointment(
            patient_id=self.patient2.id,
            doctor_id=self.doctor2.id,
            scheduled_at=now + timedelta(days=2),
            reason="Routine checkup",
            status="Scheduled",
        )
        db.session.add_all([self.appnt1, self.appnt2])
        db.session.commit()

        # Seed Reports with timestamps
        self.r1 = Report(
            patient_id=self.patient1.id,
            filename="alice_blood_panel.pdf",
            original_filename="Alice_Full_Blood_Panel.pdf",
            category="Blood panel",
            uploaded_at=now - timedelta(days=12),
        )
        self.r2 = Report(
            patient_id=self.patient1.id,
            filename="alice_ultrasound.pdf",
            original_filename="Alice_Liver_Ultrasound.pdf",
            category="Ultrasound Scan",
            uploaded_at=now - timedelta(days=5),
        )
        self.r3 = Report(
            patient_id=self.patient1.id,
            filename="alice_biopsy.pdf",
            original_filename="Alice_Liver_Biopsy_Pathology.pdf",
            category="Liver Biopsy",
            uploaded_at=now - timedelta(days=1),
        )
        self.r4 = Report(
            patient_id=self.patient2.id,
            filename="bob_lab_report.pdf",
            original_filename="Bob_Diagnostic_Lab_Report.pdf",
            category="Lab report",
            uploaded_at=now - timedelta(days=2),
        )
        db.session.add_all([self.r1, self.r2, self.r3, self.r4])

        # Seed Activity Logs
        log1 = ActivityLog(
            user_id=self.labtech.id,
            action="upload_report",
            details="Uploaded Alice_Full_Blood_Panel.pdf",
            created_at=now - timedelta(days=12),
        )
        log2 = ActivityLog(
            user_id=self.labtech.id,
            action="upload_report",
            details="Uploaded Bob_Diagnostic_Lab_Report.pdf",
            created_at=now - timedelta(days=2),
        )
        db.session.add_all([log1, log2])
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

    # =========================================================
    # STEP 1: AUTHENTICATION & ACCESS CONTROL
    # =========================================================

    def test_unauthenticated_analytics_rejected(self):
        """Unauthenticated requests to report analytics return 401."""
        res = self.client.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 401)
        res_overview = self.client.get("/api/analytics")
        self.assertEqual(res_overview.status_code, 401)

    # =========================================================
    # STEP 2: ADMIN ANALYTICS
    # =========================================================

    def test_admin_reports_analytics(self):
        """Admin receives complete system-wide clinical report analytics."""
        self._login("admin@careai.com", "Admin@123")
        res = self.client.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertTrue(data["success"])
        self.assertEqual(data["total_reports"], 4)
        self.assertEqual(data["unique_patients"], 2)

        # Categories
        cat = data["reports_by_category"]
        self.assertEqual(cat.get("Blood panel"), 1)
        self.assertEqual(cat.get("Ultrasound Scan"), 1)
        self.assertEqual(cat.get("Liver Biopsy"), 1)
        self.assertEqual(cat.get("Lab report"), 1)

        # Status & Risk
        status = data["reports_by_status"]
        self.assertEqual(status.get("Under treatment"), 3)
        self.assertEqual(status.get("Awaiting review"), 1)
        self.assertEqual(data["awaiting_review_count"], 1)

        risk = data["reports_by_risk"]
        self.assertEqual(risk.get("High Risk"), 3)
        self.assertEqual(risk.get("Low Risk"), 1)

        # Upload velocity trends
        trends = data["upload_trends"]
        self.assertIsInstance(trends, list)
        self.assertGreater(len(trends), 0)
        total_trend_count = sum(t["count"] for t in trends)
        self.assertEqual(total_trend_count, 4)

        # Recent activity trends
        act_trends = data["recent_activity_trends"]
        self.assertIsInstance(act_trends, list)
        self.assertGreaterEqual(len(act_trends), 1)

    def test_admin_overview_analytics_with_date_range(self):
        """Admin can filter analytics endpoint with start_date and end_date."""
        self._login("admin@careai.com", "Admin@123")
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        start_str = (now - timedelta(days=3)).strftime("%Y-%m-%d")
        end_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        res = self.client.get(f"/api/reports/analytics?start_date={start_str}&end_date={end_str}")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        # Reports in the last 3 days: alice_biopsy (1 day ago) and bob_lab_report (2 days ago) = 2
        self.assertEqual(data["total_reports"], 2)

    # =========================================================
    # STEP 3: LAB TECHNICIAN ANALYTICS
    # =========================================================

    def test_labtech_reports_analytics(self):
        """Lab technicians can review diagnostic report statistics and upload activity."""
        self._login("lab@careai.com", "Lab@123")
        res = self.client.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_reports"], 4)
        self.assertIn("reports_by_category", data)
        self.assertIn("upload_trends", data)

    # =========================================================
    # STEP 4: HEPATOLOGIST ANALYTICS & PATIENT ACCESS
    # =========================================================

    def test_hepatologist_assigned_patient_scoping(self):
        """Hepatologist can view report analytics for their authorized patient."""
        self._login("doctor1@careai.com", "Doctor@123")

        # Query specifically for Alice (assigned to doctor1)
        res_alice = self.client.get(f"/api/reports/analytics?patient_id={self.patient1.id}")
        self.assertEqual(res_alice.status_code, 200)
        alice_data = res_alice.get_json()
        self.assertTrue(alice_data["success"])
        self.assertEqual(alice_data["total_reports"], 3)
        self.assertEqual(alice_data["unique_patients"], 1)

        # Attempt to access Bob (assigned to doctor2) -> 403 Forbidden
        res_bob = self.client.get(f"/api/reports/analytics?patient_id={self.patient2.id}")
        self.assertEqual(res_bob.status_code, 403)
        self.assertIn("Unauthorized", res_bob.get_json()["message"])

    def test_hepatologist_general_analytics(self):
        """Hepatologist requesting general report analytics receives authorized patient cohort."""
        self._login("doctor1@careai.com", "Doctor@123")
        res = self.client.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        # Doctor 1 is assigned only to Alice Smith
        self.assertEqual(data["total_reports"], 3)
        self.assertEqual(data["unique_patients"], 1)

    # =========================================================
    # STEP 5: PATIENT HEALTH PORTAL ISOLATION
    # =========================================================

    def test_patient_strict_self_scoping(self):
        """Patient only receives their own report metrics and cannot access other patients."""
        self._login("alice@patient.com", "Patient@123")

        # General analytics endpoint scoped to patient
        res = self.client.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_reports"], 3)
        self.assertEqual(data["unique_patients"], 1)

        # Attempt to supply another patient's ID -> 403 Forbidden
        res_tamper = self.client.get(f"/api/reports/analytics?patient_id={self.patient2.id}")
        self.assertEqual(res_tamper.status_code, 403)
        self.assertIn("Unauthorized", res_tamper.get_json()["message"])

    def test_patient_overview_analytics(self):
        """Patient can access /api/analytics scoped to their health record."""
        self._login("alice@patient.com", "Patient@123")
        res = self.client.get("/api/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_patients"], 1)
        self.assertEqual(data["status_distribution"].get("Under treatment"), 1)

    # =========================================================
    # STEP 6: DATE FILTERING & INVALID PARAMETER RESILIENCE
    # =========================================================

    def test_invalid_date_parameters_handled_gracefully(self):
        """Invalid date parameters do not crash the endpoint (graceful degradation)."""
        self._login("admin@careai.com", "Admin@123")
        res = self.client.get("/api/reports/analytics?start_date=not-a-date&end_date=also-bad")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_reports"], 4)

    def test_inverted_date_range_yields_empty_results(self):
        """Inverted date range (start after end) returns zero reports safely without 500."""
        self._login("admin@careai.com", "Admin@123")
        res = self.client.get("/api/reports/analytics?start_date=2026-12-31&end_date=2026-01-01")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_reports"], 0)
        self.assertEqual(data["reports_by_category"], {})
        self.assertEqual(data["upload_trends"], [])

    # =========================================================
    # STEP 7: EMPTY DATASETS
    # =========================================================

    def test_empty_dataset_handling(self):
        """Clean response structure when database contains zero reports."""
        Report.query.delete()
        db.session.commit()

        self._login("admin@careai.com", "Admin@123")
        res = self.client.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total_reports"], 0)
        self.assertEqual(data["unique_patients"], 0)
        self.assertEqual(data["reports_by_category"], {})
        self.assertEqual(data["reports_by_status"], {})
        self.assertEqual(data["reports_by_risk"], {})
        self.assertEqual(data["upload_trends"], [])
        self.assertEqual(data["awaiting_review_count"], 0)

    # =========================================================
    # STEP 8: REGRESSION TESTING
    # =========================================================

    def test_reports_listing_and_filtering_regression(self):
        """Existing report listing, category filtering, and pagination continue to operate."""
        self._login("admin@careai.com", "Admin@123")
        res = self.client.get("/api/reports?category=Ultrasound Scan")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["reports"]), 1)
        self.assertEqual(data["reports"][0]["original_filename"], "Alice_Liver_Ultrasound.pdf")

    def test_appointment_functionality_regression(self):
        """Appointment management remains unaffected and functional."""
        self._login("admin@careai.com", "Admin@123")
        res = self.client.get("/api/appointments")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])


if __name__ == "__main__":
    unittest.main()
