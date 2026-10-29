import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
import io

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.prediction import Prediction
from app.models.notification import Notification


class PatientPortalEnhancementTestSuite(unittest.TestCase):
    """
    Test suite for Prompt 3: Patient Portal Enhancement.
    Verifies:
    1. Personal Health Overview metrics backed by actual API responses.
    2. Biomarker history access and unauthorized cross-patient rejection.
    3. Appointment workflows: viewing, booking, cancellation, and cross-patient prevention.
    4. Secure clinical reports: viewing, authenticated downloading, and cross-patient isolation.
    5. Notifications: ownership and read/unread status management.
    6. Profile update actions supported by backend.

    Executes strictly inside an isolated temporary SQLite database and upload directory.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_patient_uploads_")

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

        # Seed users
        self.admin = User(name="Administrator", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.doctor = User(name="Dr. Jane Hepatologist", email="doctor@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.patient_alice = User(name="Alice Patient", email="alice@careai.com", role="patient", portal_id="PAT-ALICE")
        self.patient_alice.set_password("Patient@123")

        self.patient_bob = User(name="Bob Patient", email="bob@careai.com", role="patient", portal_id="PAT-BOB")
        self.patient_bob.set_password("Patient@123")

        db.session.add_all([self.admin, self.doctor, self.patient_alice, self.patient_bob])
        db.session.commit()

        # Seed clinical patient records
        self.p_alice = Patient(
            full_name="Alice Patient",
            portal_id="PAT-ALICE",
            email="alice@careai.com",
            age=48,
            gender="Female",
            bilirubin=1.8,
            albumin=3.2,
            platelets=140.0,
            sgot=45.0,
            sgpt=38.0,
            prothrombin=13.0,
            latest_risk_label="Medium Risk",
            latest_risk_percent=48.5,
            treatment_status="Under treatment",
        )
        self.p_bob = Patient(
            full_name="Bob Patient",
            portal_id="PAT-BOB",
            email="bob@careai.com",
            age=62,
            gender="Male",
            bilirubin=3.5,
            albumin=2.8,
            platelets=95.0,
            sgot=80.0,
            sgpt=72.0,
            prothrombin=15.5,
            latest_risk_label="High Risk",
            latest_risk_percent=82.0,
            treatment_status="Needs urgent review",
        )
        db.session.add_all([self.p_alice, self.p_bob])
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

        if os.path.exists(self.test_upload_dir):
            try:
                import shutil
                shutil.rmtree(self.test_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def login_as(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    # =========================================================================
    # 1. PERSONAL HEALTH OVERVIEW TESTS
    # =========================================================================

    def test_patient_health_overview_returns_authorized_metrics(self):
        """Verify patient health overview returns actual API data scoped to authenticated patient."""
        self.login_as("alice@careai.com", "Patient@123")

        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertEqual(data["role"], "patient")
        self.assertEqual(data["portal_id"], "PAT-ALICE")
        self.assertEqual(data["records_count"], 1)
        self.assertTrue(data["biomarkers_recorded"])

        latest = data["latest_record"]
        self.assertIsNotNone(latest)
        self.assertEqual(latest["full_name"], "Alice Patient")
        self.assertEqual(latest["bilirubin"], 1.8)
        self.assertEqual(latest["albumin"], 3.2)
        self.assertEqual(latest["latest_risk_label"], "Medium Risk")

    def test_patient_without_records_receives_clean_empty_state(self):
        """Verify patient without records receives clean 0-counts and no errors."""
        new_patient_user = User(name="Charlie New", email="charlie@careai.com", role="patient", portal_id="PAT-NEW")
        new_patient_user.set_password("Patient@123")
        db.session.add(new_patient_user)
        db.session.commit()

        self.login_as("charlie@careai.com", "Patient@123")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertEqual(data["records_count"], 0)
        self.assertEqual(data["reports_count"], 0)
        self.assertEqual(data["upcoming_appointments"], 0)
        self.assertFalse(data["biomarkers_recorded"])
        self.assertIsNone(data["latest_record"])

    # =========================================================================
    # 2. BIOMARKER HISTORY & SECURITY TESTS
    # =========================================================================

    def test_patient_biomarker_history_scoped_to_self(self):
        """Verify patient can only list their own clinical records."""
        self.login_as("alice@careai.com", "Patient@123")

        res = self.client.get("/api/patients")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        patients = data.get("patients", [])

        # Should only contain Alice
        self.assertEqual(len(patients), 1)
        self.assertEqual(patients[0]["portal_id"], "PAT-ALICE")

    def test_patient_cannot_access_another_patients_record(self):
        """Verify accessing another patient's record directly via ID returns 403 Forbidden."""
        self.login_as("alice@careai.com", "Patient@123")

        # Alice tries to view Bob's clinical record directly
        res = self.client.get(f"/api/patients/{self.p_bob.id}")
        self.assertEqual(res.status_code, 403)

    # =========================================================================
    # 3. APPOINTMENTS WORKFLOW & SECURITY TESTS
    # =========================================================================

    def test_patient_appointment_workflow_and_isolation(self):
        """Verify patient can book, view, and cancel their own consultation."""
        self.login_as("alice@careai.com", "Patient@123")

        # 1. Book appointment for Alice
        scheduled_time = (datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None)
        book_res = self.client.post("/api/appointments", json={
            "patient_id": self.p_alice.id,
            "doctor_id": self.doctor.id,
            "scheduled_at": scheduled_time.isoformat(),
            "reason": "Ultrasound follow-up and clinical consultation",
        })
        self.assertEqual(book_res.status_code, 201)
        appnt_id = book_res.get_json()["appointment"]["id"]

        # 2. Verify appointment appears in Alice's appointment list
        list_res = self.client.get("/api/appointments")
        self.assertEqual(list_res.status_code, 200)
        appnts = list_res.get_json().get("appointments", [])
        self.assertTrue(any(a["id"] == appnt_id for a in appnts))

        # 3. Alice can cancel her own appointment
        cancel_res = self.client.patch(f"/api/appointments/{appnt_id}/status", json={"status": "Cancelled"})
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.get_json()["appointment"]["status"], "Cancelled")

    def test_patient_cannot_book_or_cancel_for_another_patient(self):
        """Verify patient cannot book for or modify another patient's appointment."""
        self.login_as("alice@careai.com", "Patient@123")

        # Alice attempts to book an appointment for Bob
        scheduled_time = (datetime.now(timezone.utc) + timedelta(days=4)).replace(tzinfo=None)
        bad_book_res = self.client.post("/api/appointments", json={
            "patient_id": self.p_bob.id,
            "doctor_id": self.doctor.id,
            "scheduled_at": scheduled_time.isoformat(),
            "reason": "Unauthorized booking attempt",
        })
        self.assertEqual(bad_book_res.status_code, 403)

        # Doctor schedules an appointment for Bob
        bob_appnt = Appointment(
            patient_id=self.p_bob.id,
            doctor_id=self.doctor.id,
            scheduled_at=scheduled_time,
            reason="Bob regular review",
            status="Confirmed",
        )
        db.session.add(bob_appnt)
        db.session.commit()

        # Alice attempts to cancel Bob's appointment
        bad_cancel_res = self.client.patch(f"/api/appointments/{bob_appnt.id}/status", json={"status": "Cancelled"})
        self.assertEqual(bad_cancel_res.status_code, 403)

        # Alice attempts to view Bob's appointment details
        bad_view_res = self.client.get(f"/api/appointments/{bob_appnt.id}")
        self.assertEqual(bad_view_res.status_code, 403)

    # =========================================================================
    # 4. CLINICAL REPORTS ACCESS & SECURITY TESTS
    # =========================================================================

    def test_patient_reports_listing_and_download_isolation(self):
        """Verify patient only accesses their own reports and cannot download another patient's files."""
        # Create a report file for Alice
        alice_file_content = b"%PDF-1.4 Alice confidential report"
        alice_filename = "alice_test_report.pdf"
        alice_file_path = os.path.join(self.test_upload_dir, alice_filename)
        with open(alice_file_path, "wb") as f:
            f.write(alice_file_content)

        r_alice = Report(patient_id=self.p_alice.id, filename=alice_filename, original_filename="Alice_LFT.pdf", category="Liver Function Test (LFT)")

        # Create a report file for Bob
        bob_file_content = b"%PDF-1.4 Bob confidential report"
        bob_filename = "bob_test_report.pdf"
        bob_file_path = os.path.join(self.test_upload_dir, bob_filename)
        with open(bob_file_path, "wb") as f:
            f.write(bob_file_content)

        r_bob = Report(patient_id=self.p_bob.id, filename=bob_filename, original_filename="Bob_Biopsy.pdf", category="Biopsy Pathology")

        db.session.add_all([r_alice, r_bob])
        db.session.commit()

        self.login_as("alice@careai.com", "Patient@123")

        # 1. Reports list only contains Alice's report
        list_res = self.client.get("/api/reports")
        self.assertEqual(list_res.status_code, 200)
        reports = list_res.get_json().get("reports", [])
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]["original_filename"], "Alice_LFT.pdf")

        # 2. Alice can download her own report
        dl_res = self.client.get(f"/api/reports/{r_alice.id}/download")
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.data, alice_file_content)

        # 3. Alice CANNOT download Bob's report
        bad_dl_res = self.client.get(f"/api/reports/{r_bob.id}/download")
        self.assertEqual(bad_dl_res.status_code, 403)

    # =========================================================================
    # 5. NOTIFICATIONS OWNERSHIP TESTS
    # =========================================================================

    def test_patient_notifications_ownership_and_read_status(self):
        """Verify patient only sees their own notifications and can mark them as read."""
        n_alice = Notification(user_id=self.patient_alice.id, role="patient", title="Consultation Booked", message="Your appointment was confirmed.", category="info", read=False)
        n_bob = Notification(user_id=self.patient_bob.id, role="patient", title="Bob Alert", message="Confidential notice for Bob.", category="warning", read=False)
        db.session.add_all([n_alice, n_bob])
        db.session.commit()

        self.login_as("alice@careai.com", "Patient@123")

        # 1. Alice only sees her own notification
        res = self.client.get("/api/notifications")
        self.assertEqual(res.status_code, 200)
        notifs = res.get_json().get("notifications", [])
        self.assertEqual(len(notifs), 1)
        self.assertEqual(notifs[0]["title"], "Consultation Booked")

        # 2. Alice marks her notification as read
        patch_res = self.client.patch(f"/api/notifications/{n_alice.id}/read", json={"read": True})
        self.assertEqual(patch_res.status_code, 200)

        # 3. Alice CANNOT mark Bob's notification as read
        bad_patch_res = self.client.patch(f"/api/notifications/{n_bob.id}/read", json={"read": True})
        self.assertIn(bad_patch_res.status_code, [403, 404])

    # =========================================================================
    # 6. PROFILE UPDATE TESTS
    # =========================================================================

    def test_patient_profile_update(self):
        """Verify patient can update their legal display name."""
        self.login_as("alice@careai.com", "Patient@123")

        res = self.client.patch("/api/auth/profile", json={"name": "Alice M. Patient"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["user"]["name"], "Alice M. Patient")

        # Database re-query check
        db.session.expire_all()
        reloaded = db.session.get(User, self.patient_alice.id)
        self.assertEqual(reloaded.name, "Alice M. Patient")


if __name__ == "__main__":
    unittest.main()
