"""
Unit tests for Transformed Admin Dashboard API endpoints & statistics.
Uses an isolated in-memory SQLite database.
NEVER touches instance/cirrhosis.db.
"""
from datetime import datetime, timezone
import unittest

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.user import User


class AdminDashboardTransformationTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(test_config={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "WTF_CSRF_ENABLED": False,
            "SECRET_KEY": "test_admin_dashboard_key",
        })
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()

            # Create Admin User
            self.admin = User(name="Admin User", email="admin@careai.com", role="admin")
            self.admin.set_password("Admin@123")

            # Create Care Staff
            self.doc = User(name="Dr. Care", email="doc@careai.com", role="hepatologist")
            self.doc.set_password("Doctor@123")

            self.lab = User(name="Lab Tech", email="lab@careai.com", role="labtech")
            self.lab.set_password("Lab@123")

            self.pat_user = User(name="Patient User", email="pat@careai.com", role="patient", portal_id="PAT-999")
            self.pat_user.set_password("Patient@123")

            db.session.add_all([self.admin, self.doc, self.lab, self.pat_user])
            db.session.commit()
            self.admin_id = self.admin.id
            self.doc_id = self.doc.id
            self.lab_id = self.lab.id
            self.pat_user_id = self.pat_user.id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def login_as(self, email, password):
        return self.client.post("/api/auth/login", json={"identifier": email, "password": password})

    def test_dashboard_stats_empty_database_behavior(self):
        """Test that pristine empty database returns clean real zeros without errors."""
        res_login = self.login_as("admin@careai.com", "Admin@123")
        self.assertEqual(res_login.status_code, 200)

        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertTrue(data["success"])
        self.assertEqual(data["role"], "admin")
        stats = data["stats"]

        # Real zeros for pristine database
        self.assertEqual(stats["total_patients"], 0)
        self.assertEqual(stats["high_risk"], 0)
        self.assertEqual(stats["medium_risk"], 0)
        self.assertEqual(stats["low_risk"], 0)
        self.assertEqual(stats["pending_risk"], 0)
        self.assertEqual(stats["total_appointments"], 0)
        self.assertEqual(stats["clinical_reports"], 0)
        self.assertEqual(stats["pending_reviews"], 0)

        # Active staff should be 3 (admin, hepatologist, labtech)
        self.assertEqual(stats["active_staff"], 3)
        self.assertEqual(stats["total_users"], 4)

        # Distributions should be present and valid
        self.assertEqual(stats["appointment_statuses"], {})
        self.assertEqual(stats["report_categories"], {})
        self.assertEqual(stats["prediction_risks"], {})
        self.assertEqual(stats["age_distribution"], {"< 30": 0, "30-49": 0, "50-64": 0, "65+": 0})

    def test_dashboard_stats_populated_database_behavior(self):
        """Test dashboard stats with populated clinical records."""
        with self.app.app_context():
            # Add patients
            p1 = Patient(
                full_name="Alice Smith",
                portal_id="PAT-101",
                age=45,
                gender="Female",
                bilirubin=3.2,
                albumin=2.9,
                platelets=120.0,
                sgot=65.0,
                sgpt=55.0,
                latest_risk_label="High Risk",
                latest_risk_percent=78.5,
                treatment_status="Needs urgent review",
            )
            p2 = Patient(
                full_name="Bob Jones",
                portal_id="PAT-102",
                age=28,
                gender="Male",
                bilirubin=1.1,
                albumin=3.8,
                platelets=210.0,
                sgot=25.0,
                sgpt=28.0,
                latest_risk_label="Low Risk",
                latest_risk_percent=15.0,
                treatment_status="Stable",
            )
            db.session.add_all([p1, p2])
            db.session.commit()

            # Add appointment
            appnt = Appointment(
                patient_id=p1.id,
                doctor_id=self.doc_id,
                scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None),
                status="Confirmed",
                reason="Follow-up consultation",
            )
            db.session.add(appnt)

            # Add report
            rep = Report(
                patient_id=p1.id,
                filename="biomarker_test.pdf",
                original_filename="Biomarkers_Alice.pdf",
                category="Lab report",
            )
            db.session.add(rep)

            # Add prediction
            pred = Prediction(
                patient_id=p1.id,
                probability=0.785,
                risk_label="High Risk",
                confidence=85.0,
                model_name="RandomForest",
            )
            db.session.add(pred)
            db.session.commit()

        self.login_as("admin@careai.com", "Admin@123")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        stats = data["stats"]
        self.assertEqual(stats["total_patients"], 2)
        self.assertEqual(stats["high_risk"], 1)
        self.assertEqual(stats["low_risk"], 1)
        self.assertEqual(stats["total_appointments"], 1)
        self.assertEqual(stats["clinical_reports"], 1)
        self.assertEqual(stats["pending_reviews"], 1)  # p1 is "Needs urgent review"
        self.assertEqual(stats["appointment_statuses"]["Confirmed"], 1)
        self.assertEqual(stats["report_categories"]["Lab report"], 1)
        self.assertEqual(stats["prediction_risks"]["High Risk"], 1)
        self.assertEqual(stats["age_distribution"]["< 30"], 1)  # Bob (28)
        self.assertEqual(stats["age_distribution"]["30-49"], 1)  # Alice (45)

    def test_non_admin_authorization(self):
        """Test that non-admin accounts receive their own role payload or appropriate response."""
        self.login_as("pat@careai.com", "Patient@123")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["role"], "patient")

    def test_admin_read_only_clinical_permissions_enforced(self):
        """
        Test that Admin accounts are strictly read-only observers and cannot alter
        clinical treatment statuses, appointment statuses, or reschedule appointments.
        Attending Hepatologists retain full clinical management capabilities.
        """
        with self.app.app_context():
            p = Patient(
                full_name="Rajesh Khanna",
                portal_id="PAT-501",
                age=52,
                gender="Male",
                treatment_status="Awaiting Doctor Review",
                assigned_doctor_id=self.doc_id,
            )
            db.session.add(p)
            db.session.commit()
            patient_id = p.id

            appt = Appointment(
                patient_id=patient_id,
                doctor_id=self.doc_id,
                scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None),
                status="Pending",
                reason="Initial liver consultation",
            )
            db.session.add(appt)
            db.session.commit()
            appt_id = appt.id

        # 1. Admin logs in
        login_res = self.login_as("admin@careai.com", "Admin@123")
        self.assertEqual(login_res.status_code, 200)

        # 2. Admin cannot alter clinical treatment status (403 Forbidden)
        res_review = self.client.patch(
            f"/api/patients/{patient_id}/review-status",
            json={"treatment_status": "Under Treatment"},
        )
        self.assertEqual(res_review.status_code, 403)

        # 3. Admin cannot alter appointment status (403 Forbidden)
        res_appt_status = self.client.patch(
            f"/api/appointments/{appt_id}/status",
            json={"status": "Confirmed"},
        )
        self.assertEqual(res_appt_status.status_code, 403)
        self.assertIn("read-only", res_appt_status.get_json().get("message", "").lower())

        # 4. Admin cannot reschedule appointments (403 Forbidden)
        res_reschedule = self.client.patch(
            f"/api/appointments/{appt_id}/reschedule",
            json={"scheduled_at": "2026-11-01 10:00:00", "reason": "Admin reschedule attempt"},
        )
        self.assertEqual(res_reschedule.status_code, 403)

        # 5. Admin CAN view patient in read-only mode (200 OK)
        res_view_patient = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(res_view_patient.status_code, 200)
        self.assertEqual(res_view_patient.get_json()["patient"]["full_name"], "Rajesh Khanna")

        # 6. Admin CAN view audit logs (200 OK)
        res_logs = self.client.get("/api/logs")
        self.assertEqual(res_logs.status_code, 200)

        # 7. Attending Doctor logs in and can manage clinical records
        doc_login = self.login_as("doc@careai.com", "Doctor@123")
        self.assertEqual(doc_login.status_code, 200)

        # Doctor updates clinical status -> 200 OK
        doc_review = self.client.patch(
            f"/api/patients/{patient_id}/review-status",
            json={"treatment_status": "Under Treatment"},
        )
        self.assertEqual(doc_review.status_code, 200)

        # Doctor confirms appointment -> 200 OK
        doc_appt = self.client.patch(
            f"/api/appointments/{appt_id}/status",
            json={"status": "Confirmed"},
        )
        self.assertEqual(doc_appt.status_code, 200)

    def test_admin_dynamic_kpi_metrics_breakdown(self):
        """Test that Admin stats endpoint returns all 8 required dynamic KPI fields."""
        with self.app.app_context():
            p_awaiting = Patient(
                full_name="Patient One",
                portal_id="PAT-601",
                age=40,
                gender="Male",
                treatment_status="Awaiting Doctor Review",
                lab_workflow_status="Registered",
                latest_risk_label="Low Risk",
            )
            p_treating = Patient(
                full_name="Patient Two",
                portal_id="PAT-602",
                age=55,
                gender="Female",
                treatment_status="Under Treatment",
                lab_workflow_status="Report Uploaded",
                latest_risk_label="High Risk",
            )
            p_followup = Patient(
                full_name="Patient Three",
                portal_id="PAT-603",
                age=62,
                gender="Male",
                treatment_status="Follow-up Required",
                lab_workflow_status="Report Uploaded",
                latest_risk_label="Medium Risk",
            )
            p_done = Patient(
                full_name="Patient Four",
                portal_id="PAT-604",
                age=35,
                gender="Female",
                treatment_status="Treatment Completed",
                lab_workflow_status="Report Uploaded",
                latest_risk_label="Low Risk",
            )
            db.session.add_all([p_awaiting, p_treating, p_followup, p_done])
            db.session.commit()

            appt_pending = Appointment(
                patient_id=p_awaiting.id,
                doctor_id=self.doc_id,
                scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None),
                status="Pending",
                reason="Checkup",
            )
            db.session.add(appt_pending)
            db.session.commit()

        self.login_as("admin@careai.com", "Admin@123")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        stats = res.get_json()["stats"]

        self.assertEqual(stats["total_patients"], 4)
        self.assertEqual(stats["awaiting_doctor_review"], 1)
        self.assertEqual(stats["patients_under_treatment"], 1)
        self.assertEqual(stats["follow_up_required"], 1)
        self.assertEqual(stats["treatment_completed"], 1)
        self.assertEqual(stats["high_risk"], 1)
        self.assertEqual(stats["pending_appointment_requests"], 1)
        self.assertIn("staff_breakdown", stats)
        self.assertEqual(stats["staff_breakdown"]["doctors"], 1)
        self.assertEqual(stats["staff_breakdown"]["labtechs"], 1)
        self.assertEqual(stats["staff_breakdown"]["admins"], 1)
        self.assertEqual(stats["staff_breakdown"]["patients"], 1)


if __name__ == "__main__":
    unittest.main()
