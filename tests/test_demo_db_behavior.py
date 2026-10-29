"""
Verification of Demo Database Behavior for Admin Dashboard.
Runs strictly against an isolated temporary SQLite database and explicitly created fixtures.
"""
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta

from app import create_app
from app.models import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.user import User


class DemoDatabaseTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_demo_db_test.db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="demo_db_uploads_")

        test_config = {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "WTF_CSRF_ENABLED": False,
            "SECRET_KEY": "demo-test-verification-key",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database isolation safeguard: strictly verify temporary test database
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.temp_db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db") or db_uri.endswith("/demo_cirrhosis.db"):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test connected to instance database: {db_uri}")
        if norm_db_path not in db_uri and self.temp_db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test database URI ({db_uri}) does not match temporary test DB ({self.temp_db_path})")

        with self.app.app_context():
            db.create_all()

            # Seed isolated test accounts
            admin = User(name="System Admin [Demo]", email="admin@careai.com", role="admin", active=True)
            admin.set_password("Admin@123")
            db.session.add(admin)

            doctor = User(name="Dr. Specialist", email="doctor@careai.com", role="hepatologist", active=True)
            doctor.set_password("Doctor@123")
            db.session.add(doctor)

            # Seed test patient with demographics for age distribution
            patient = Patient(
                full_name="Eleanor Vance [DEMO]",
                portal_id="PAT-1001",
                age=54,
                gender="Female",
                email="eleanor@example.com",
                latest_risk_label="High Risk",
                latest_risk_percent=85.0,
                treatment_status="Awaiting review",
            )
            db.session.add(patient)
            db.session.flush()

            # Seed test appointment
            appnt = Appointment(
                patient_id=patient.id,
                doctor_id=doctor.id,
                status="Confirmed",
                scheduled_at=datetime.utcnow() + timedelta(days=2),
                reason="Routine checkup",
            )
            db.session.add(appnt)

            # Seed test report
            report = Report(
                patient_id=patient.id,
                filename="demo_test.pdf",
                original_filename="Blood_Test_Report.pdf",
                category="Lab report",
            )
            db.session.add(report)

            # Seed test prediction
            pred = Prediction(
                patient_id=patient.id,
                risk_label="High Risk",
                probability=85.0,
                confidence=90.0,
                model_name="RandomForestClassifier",
            )
            db.session.add(pred)

            db.session.commit()

    def tearDown(self):
        # Database safety assertion before drop_all
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.temp_db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db") or db_uri.endswith("/demo_cirrhosis.db"):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Teardown attempted to drop instance database: {db_uri}")
        if norm_db_path not in db_uri and self.temp_db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Teardown database URI ({db_uri}) does not match temporary test DB ({self.temp_db_path})")

        with self.app.app_context():
            db.session.remove()
            db.drop_all()

        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except OSError:
            pass
        try:
            if os.path.exists(self.temp_upload_dir):
                shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
        except OSError:
            pass

    def login_as(self, email, password):
        return self.client.post("/api/auth/login", json={"identifier": email, "password": password})

    def test_demo_database_metrics(self):
        res_login = self.login_as("admin@careai.com", "Admin@123")
        self.assertEqual(res_login.status_code, 200)

        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertTrue(data["success"])
        stats = data["stats"]

        # Assert demo database contains realistic data
        self.assertGreater(stats["total_patients"], 0)
        self.assertGreater(stats["total_appointments"], 0)
        self.assertGreater(stats["clinical_reports"], 0)
        self.assertGreater(stats["active_staff"], 0)

        # Assert distribution dictionaries are non-empty
        self.assertIn("Confirmed", stats["appointment_statuses"])
        self.assertIn("Lab report", stats["report_categories"])
        self.assertIn("High Risk", stats["prediction_risks"])

        # Assert age distribution has counts
        self.assertTrue(any(v > 0 for v in stats["age_distribution"].values()))


if __name__ == "__main__":
    unittest.main()
