import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User


class SearchFiltersSortingPaginationTest(unittest.TestCase):
    """
    Focused test suite for Phase 6 Task 1:
    Search, Filters, Safe Sorting, and Pagination across all 4 workspaces.
    Runs strictly on an isolated temporary SQLite database.
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

        # Seed isolated test accounts
        self.admin = User(name="Administrator", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lab Technician", email="lab@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor = User(name="Dr. Hepatologist", email="doctor@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.patient1_user = User(
            name="Alice Wonder", email="alice@patient.com", role="patient", portal_id="PAT-A100"
        )
        self.patient1_user.set_password("Patient@123")

        self.patient2_user = User(
            name="Bob Builder", email="bob@patient.com", role="patient", portal_id="PAT-B200"
        )
        self.patient2_user.set_password("Patient@123")

        db.session.add_all([self.admin, self.labtech, self.doctor, self.patient1_user, self.patient2_user])
        db.session.commit()

        # Seed Patient 1 (Alice)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.patient1 = Patient(
            full_name="Alice Wonder",
            portal_id="PAT-A100",
            email="alice@patient.com",
            phone="111-222-3333",
            age=45,
            gender="Female",
            latest_risk_label="High Risk",
            latest_risk_percent=85.0,
            treatment_status="Under treatment",
            created_at=now - timedelta(days=5),
            created_by_id=self.labtech.id,
        )

        # Seed Patient 2 (Bob)
        self.patient2 = Patient(
            full_name="Bob Builder",
            portal_id="PAT-B200",
            email="bob@patient.com",
            phone="444-555-6666",
            age=62,
            gender="Male",
            latest_risk_label="Low Risk",
            latest_risk_percent=20.0,
            treatment_status="Stable",
            created_at=now - timedelta(days=2),
            created_by_id=self.labtech.id,
        )

        # Seed Patient 3 (Charlie)
        self.patient3 = Patient(
            full_name="Charlie Chaplin",
            portal_id="PAT-C300",
            email="charlie@careai.com",
            phone="777-888-9999",
            age=30,
            gender="Male",
            latest_risk_label="Medium Risk",
            latest_risk_percent=55.0,
            treatment_status="Awaiting review",
            created_at=now,
            created_by_id=self.labtech.id,
        )

        db.session.add_all([self.patient1, self.patient2, self.patient3])
        db.session.commit()

        # Seed Reports
        self.report1 = Report(
            patient=self.patient1,
            filename="alice_blood.pdf",
            original_filename="blood_panel_alice.pdf",
            category="Blood panel",
            uploaded_at=now - timedelta(days=4),
        )
        self.report2 = Report(
            patient=self.patient2,
            filename="bob_biopsy.pdf",
            original_filename="liver_biopsy_bob.pdf",
            category="Liver Biopsy",
            uploaded_at=now - timedelta(days=1),
        )
        db.session.add_all([self.report1, self.report2])

        # Seed Appointments
        self.appnt1 = Appointment(
            patient=self.patient1,
            doctor=self.doctor,
            scheduled_at=now + timedelta(days=2),
            status="Scheduled",
            reason="Follow-up consultation",
            created_at=now - timedelta(days=3),
        )
        self.appnt2 = Appointment(
            patient=self.patient2,
            doctor=self.doctor,
            scheduled_at=now - timedelta(days=1),
            status="Completed",
            reason="Initial intake",
            created_at=now - timedelta(days=5),
        )
        db.session.add_all([self.appnt1, self.appnt2])

        # Seed Prescriptions
        self.rx1 = Prescription(
            patient=self.patient1,
            doctor=self.doctor,
            medicine="Propranolol",
            dosage="40mg daily",
            frequency_days=30,
            clinical_notes="Take with water before meals",
            created_at=now - timedelta(days=3),
        )
        self.rx2 = Prescription(
            patient=self.patient2,
            doctor=self.doctor,
            medicine="Spironolactone",
            dosage="25mg daily",
            frequency_days=14,
            clinical_notes="Monitor potassium levels",
            created_at=now - timedelta(days=1),
        )
        db.session.add_all([self.rx1, self.rx2])

        # Seed Predictions
        self.pred1 = Prediction(
            patient=self.patient1,
            model_name="Random Forest",
            risk_label="High Risk",
            probability=85.0,
            confidence=92.0,
            created_at=now - timedelta(days=4),
        )
        self.pred2 = Prediction(
            patient=self.patient2,
            model_name="Random Forest",
            risk_label="Low Risk",
            probability=20.0,
            confidence=88.0,
            created_at=now - timedelta(days=1),
        )
        db.session.add_all([self.pred1, self.pred2])

        # Seed Activity Logs
        self.log1 = ActivityLog(
            user=self.admin,
            action="API User Registration",
            details="Registered new clinical staff member",
            created_at=now - timedelta(days=6),
        )
        self.log2 = ActivityLog(
            user=self.doctor,
            action="Prescription Issued",
            details="Issued Propranolol to Alice Wonder",
            created_at=now - timedelta(days=2),
        )
        db.session.add_all([self.log1, self.log2])
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
    # 1. PATIENTS ENDPOINT (Search, Filter, Sort, Pagination)
    # =========================================================================
    def test_patients_search_by_name_and_portal_id(self):
        self.login_as("admin@careai.com", "Admin@123")
        # Search by partial name
        res = self.client.get("/api/patients?q=Alice")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["patients"][0]["full_name"], "Alice Wonder")

        # Search by portal ID
        res = self.client.get("/api/patients?q=PAT-B200")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["patients"][0]["full_name"], "Bob Builder")

    def test_patients_filter_by_risk_and_status(self):
        self.login_as("doctor@careai.com", "Doctor@123")
        # Filter High Risk
        res = self.client.get("/api/patients?risk=High%20Risk")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["patients"][0]["latest_risk_label"], "High Risk")

        # Filter Treatment Status
        res = self.client.get("/api/patients?status=Stable")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["patients"][0]["full_name"], "Bob Builder")

    def test_patients_date_range_and_safe_sorting(self):
        self.login_as("admin@careai.com", "Admin@123")
        # Sort by full_name asc
        res = self.client.get("/api/patients?sort_by=full_name&sort_dir=asc")
        data = res.get_json()
        names = [p["full_name"] for p in data["patients"]]
        self.assertEqual(names, ["Alice Wonder", "Bob Builder", "Charlie Chaplin"])

        # Sort by full_name desc
        res = self.client.get("/api/patients?sort_by=full_name&sort_dir=desc")
        data = res.get_json()
        names = [p["full_name"] for p in data["patients"]]
        self.assertEqual(names, ["Charlie Chaplin", "Bob Builder", "Alice Wonder"])

        # Safe sorting fallback against arbitrary column input
        res = self.client.get("/api/patients?sort_by=non_existent_column;DROP TABLE--")
        self.assertEqual(res.status_code, 200)

    def test_patients_pagination(self):
        self.login_as("admin@careai.com", "Admin@123")
        res = self.client.get("/api/patients?page=1&per_page=2")
        data = res.get_json()
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["per_page"], 2)
        self.assertEqual(len(data["patients"]), 2)
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["total_pages"], 2)

        res2 = self.client.get("/api/patients?page=2&per_page=2")
        data2 = res2.get_json()
        self.assertEqual(len(data2["patients"]), 1)

    # =========================================================================
    # 2. REPORTS ENDPOINT (Search, Filter, Pagination, Security)
    # =========================================================================
    def test_reports_search_and_category_filter(self):
        self.login_as("lab@careai.com", "Lab@123")
        # Search by original filename
        res = self.client.get("/api/reports?q=blood_panel")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["reports"][0]["filename"], "alice_blood.pdf")

        # Category filter
        res = self.client.get("/api/reports?category=Liver%20Biopsy")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["reports"][0]["category"], "Liver Biopsy")

    def test_reports_patient_security_isolation(self):
        # Alice logs in as patient
        self.login_as("alice@patient.com", "Patient@123")

        # Access own reports
        res = self.client.get("/api/reports")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["reports"][0]["filename"], "alice_blood.pdf")

        # Parameter tampering: Attempt to query Bob's reports (patient_id=2)
        res_tamper = self.client.get(f"/api/reports?patient_id={self.patient2.id}")
        self.assertEqual(res_tamper.status_code, 403)

    # =========================================================================
    # 3. APPOINTMENTS ENDPOINT (Search, Status Filter, Security)
    # =========================================================================
    def test_appointments_search_and_status(self):
        self.login_as("doctor@careai.com", "Doctor@123")
        # Search reason
        res = self.client.get("/api/appointments?q=Follow-up")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["appointments"][0]["reason"], "Follow-up consultation")

        # Status filter
        res = self.client.get("/api/appointments?status=Completed")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["appointments"][0]["status"], "Completed")

    def test_appointments_patient_security_isolation(self):
        self.login_as("alice@patient.com", "Patient@123")
        # Access own appointments
        res = self.client.get("/api/appointments")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["appointments"][0]["patient_id"], self.patient1.id)

        # Attempt to access Bob's appointments
        res_tamper = self.client.get(f"/api/appointments?patient_id={self.patient2.id}")
        self.assertEqual(res_tamper.status_code, 403)

    # =========================================================================
    # 4. PRESCRIPTIONS ENDPOINT (Search, Sorting, Security)
    # =========================================================================
    def test_prescriptions_search_and_sorting(self):
        self.login_as("doctor@careai.com", "Doctor@123")
        # Search by medicine name
        res = self.client.get("/api/prescriptions?q=Propranolol")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["prescriptions"][0]["medicine"], "Propranolol")

        # Sort by medicine asc
        res_sort = self.client.get("/api/prescriptions?sort_by=medicine&sort_dir=asc")
        meds = [p["medicine"] for p in res_sort.get_json()["prescriptions"]]
        self.assertEqual(meds, ["Propranolol", "Spironolactone"])

    def test_prescriptions_patient_security_isolation(self):
        self.login_as("alice@patient.com", "Patient@123")
        res = self.client.get("/api/prescriptions")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["prescriptions"][0]["medicine"], "Propranolol")

        res_tamper = self.client.get(f"/api/prescriptions?patient_id={self.patient2.id}")
        self.assertEqual(res_tamper.status_code, 403)

    # =========================================================================
    # 5. PREDICTIONS ENDPOINT (Risk Filter, Sorting, Security)
    # =========================================================================
    def test_predictions_risk_filter_and_sorting(self):
        self.login_as("doctor@careai.com", "Doctor@123")
        res = self.client.get("/api/predictions?risk=High%20Risk")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["predictions"][0]["risk_label"], "High Risk")

        # Probability sorting
        res_sort = self.client.get("/api/predictions?sort_by=probability&sort_dir=asc")
        probs = [p["probability"] for p in res_sort.get_json()["predictions"]]
        self.assertEqual(probs, [20.0, 85.0])

    def test_predictions_patient_security_isolation(self):
        self.login_as("alice@patient.com", "Patient@123")
        res = self.client.get("/api/predictions")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["predictions"][0]["risk_label"], "High Risk")

        res_tamper = self.client.get(f"/api/predictions?patient_id={self.patient2.id}")
        self.assertEqual(res_tamper.status_code, 403)

    # =========================================================================
    # 6. LOGS & USERS ENDPOINTS (Role-Governed, Filter, Pagination)
    # =========================================================================
    def test_logs_admin_search_and_role_access(self):
        # Patient / Doctor cannot access /api/logs
        self.login_as("doctor@careai.com", "Doctor@123")
        res_doc = self.client.get("/api/logs")
        self.assertEqual(res_doc.status_code, 403)

        # Admin accesses /api/logs
        self.login_as("admin@careai.com", "Admin@123")
        res = self.client.get("/api/logs?q=Registration")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertIn("Registration", data["logs"][0]["action"])

    def test_users_admin_search_role_active_filters(self):
        # Non-admin rejected
        self.login_as("lab@careai.com", "Lab@123")
        res_lab = self.client.get("/api/users")
        self.assertEqual(res_lab.status_code, 403)

        # Admin accesses /api/users
        self.login_as("admin@careai.com", "Admin@123")
        # Search by email
        res = self.client.get("/api/users?q=doctor@careai.com")
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["users"][0]["role"], "hepatologist")

        # Filter by role
        res_role = self.client.get("/api/users?role=patient")
        data_role = res_role.get_json()
        self.assertEqual(data_role["total"], 2)

        # Filter by active
        res_active = self.client.get("/api/users?active=true")
        self.assertEqual(res_active.status_code, 200)

    # =========================================================================
    # 7. INVALID PARAMETERS TOLERANCE
    # =========================================================================
    def test_invalid_parameters_do_not_crash(self):
        self.login_as("admin@careai.com", "Admin@123")
        # Negative / invalid page number
        res = self.client.get("/api/patients?page=-5&per_page=9999")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["page"], 1)
        self.assertLessEqual(data["per_page"], 100)

        # Invalid date format string
        res_date = self.client.get("/api/patients?start_date=not-a-date&end_date=garbage-value")
        self.assertEqual(res_date.status_code, 200)


if __name__ == "__main__":
    unittest.main()
