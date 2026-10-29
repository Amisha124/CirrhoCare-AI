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
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.user import User


class AppointmentManagementTestSuite(unittest.TestCase):
    """
    Comprehensive test suite for Phase 6 Task 2: Appointment Management.
    Ensures secure appointment workflows, booking validation, 30-min conflict detection,
    rescheduling protections, status state-machine enforcement, and notifications.
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

        # Seed isolated test accounts
        self.admin = User(name="Administrator", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lab Technician", email="lab@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor1 = User(name="Dr. Jane Hepatologist", email="doctor1@careai.com", role="hepatologist")
        self.doctor1.set_password("Doctor@123")

        self.doctor2 = User(name="Dr. Mark Specialist", email="doctor2@careai.com", role="hepatologist")
        self.doctor2.set_password("Doctor@123")

        self.patient1_user = User(
            name="Alice Wonder", email="alice@patient.com", role="patient", portal_id="PAT-A100"
        )
        self.patient1_user.set_password("Patient@123")

        self.patient2_user = User(
            name="Bob Builder", email="bob@patient.com", role="patient", portal_id="PAT-B200"
        )
        self.patient2_user.set_password("Patient@123")

        db.session.add_all([
            self.admin, self.labtech, self.doctor1, self.doctor2,
            self.patient1_user, self.patient2_user
        ])
        db.session.commit()

        # Seed Clinical Patient records
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.patient1 = Patient(
            full_name="Alice Wonder",
            portal_id="PAT-A100",
            email="alice@patient.com",
            phone="111-222-3333",
            age=45,
            gender="Female",
            latest_risk_label="High Risk",
            treatment_status="Under treatment",
            created_at=now - timedelta(days=10),
            created_by_id=self.labtech.id,
        )
        self.patient2 = Patient(
            full_name="Bob Builder",
            portal_id="PAT-B200",
            email="bob@patient.com",
            phone="444-555-6666",
            age=52,
            gender="Male",
            latest_risk_label="Low Risk",
            treatment_status="Routine",
            created_at=now - timedelta(days=5),
            created_by_id=self.labtech.id,
        )
        db.session.add_all([self.patient1, self.patient2])
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
    # STEP 1 & 2: AUTHORIZATION & ACCESS CONTROL
    # =========================================================

    def test_unauthenticated_access_rejected(self):
        """Unauthenticated requests to appointment endpoints return 401."""
        res = self.client.get("/api/appointments")
        self.assertEqual(res.status_code, 401)

        res_post = self.client.post("/api/appointments", json={})
        self.assertEqual(res_post.status_code, 401)

    def test_labtech_role_forbidden(self):
        """Lab technicians are explicitly forbidden from appointment management."""
        self._login("lab@careai.com", "Lab@123")

        # GET list
        res_get = self.client.get("/api/appointments")
        self.assertEqual(res_get.status_code, 403)

        # POST booking
        future_dt = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        res_post = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": future_dt,
            "reason": "Routine Checkup"
        })
        self.assertEqual(res_post.status_code, 403)

    def test_patient_appointment_scope_isolation(self):
        """Patients can only retrieve their own appointments, never other patients'."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=3)
        appnt1 = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt,
            reason="Alice's Checkup",
            status="Pending"
        )
        appnt2 = Appointment(
            patient_id=self.patient2.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt + timedelta(hours=2),
            reason="Bob's Checkup",
            status="Pending"
        )
        db.session.add_all([appnt1, appnt2])
        db.session.commit()

        # Alice logs in
        self._login("alice@patient.com", "Patient@123")
        res = self.client.get("/api/appointments")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["appointments"][0]["id"], appnt1.id)

        # Alice can get appnt1 detail
        res_detail = self.client.get(f"/api/appointments/{appnt1.id}")
        self.assertEqual(res_detail.status_code, 200)

        # Alice cannot get Bob's appnt2 detail
        res_forbidden = self.client.get(f"/api/appointments/{appnt2.id}")
        self.assertEqual(res_forbidden.status_code, 403)

    def test_doctor_and_admin_appointment_access(self):
        """Doctors see their assigned appointments; Admins see all."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=3)
        appnt1 = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt,
            reason="Dr Jane Visit",
            status="Confirmed"
        )
        appnt2 = Appointment(
            patient_id=self.patient2.id,
            doctor_id=self.doctor2.id,
            scheduled_at=future_dt + timedelta(hours=2),
            reason="Dr Mark Visit",
            status="Confirmed"
        )
        db.session.add_all([appnt1, appnt2])
        db.session.commit()

        # Doctor 1 logs in -> only sees appnt1
        self._login("doctor1@careai.com", "Doctor@123")
        res_doc = self.client.get("/api/appointments")
        self.assertEqual(res_doc.status_code, 200)
        self.assertEqual(res_doc.get_json()["total"], 1)
        self.assertEqual(res_doc.get_json()["appointments"][0]["id"], appnt1.id)

        # Doctor 1 cannot inspect Doctor 2's appointment
        res_doc_forbidden = self.client.get(f"/api/appointments/{appnt2.id}")
        self.assertEqual(res_doc_forbidden.status_code, 403)

        # Admin logs in -> sees both appnt1 and appnt2
        self._login("admin@careai.com", "Admin@123")
        res_admin = self.client.get("/api/appointments")
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(res_admin.get_json()["total"], 2)

        # Admin can view both details
        self.assertEqual(self.client.get(f"/api/appointments/{appnt1.id}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/appointments/{appnt2.id}").status_code, 200)

    # =========================================================
    # STEP 3: BOOKING VALIDATION & CONFLICT DETECTION
    # =========================================================

    def test_booking_validation_missing_fields_and_past_date(self):
        """Booking rejects missing fields or past timestamps."""
        self._login("alice@patient.com", "Patient@123")

        # Missing fields
        res_empty = self.client.post("/api/appointments", json={})
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn("required", res_empty.get_json()["message"].lower())

        # Past date
        past_dt = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        res_past = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": past_dt,
            "reason": "Consultation"
        })
        self.assertEqual(res_past.status_code, 400)
        self.assertIn("past", res_past.get_json()["message"].lower())

    def test_patient_booking_other_patient_forbidden(self):
        """A patient cannot submit an appointment for another patient."""
        self._login("alice@patient.com", "Patient@123")
        future_dt = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

        res = self.client.post("/api/appointments", json={
            "patient_id": self.patient2.id,  # Bob
            "doctor_id": self.doctor1.id,
            "scheduled_at": future_dt,
            "reason": "Attempting to book for Bob"
        })
        self.assertEqual(res.status_code, 403)

    def test_successful_booking_defaults(self):
        """Patient booking defaults to Pending; Clinician booking defaults to Confirmed."""
        future_dt1 = (datetime.now(timezone.utc) + timedelta(days=2, hours=10)).isoformat()
        future_dt2 = (datetime.now(timezone.utc) + timedelta(days=2, hours=14)).isoformat()

        # Patient booking
        self._login("alice@patient.com", "Patient@123")
        res_pat = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": future_dt1,
            "reason": "Alice consultation"
        })
        self.assertEqual(res_pat.status_code, 201)
        self.assertEqual(res_pat.get_json()["appointment"]["status"], "Pending")

        # Doctor booking
        self._login("doctor1@careai.com", "Doctor@123")
        res_doc = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": future_dt2,
            "reason": "Doctor scheduled follow-up"
        })
        self.assertEqual(res_doc.status_code, 201)
        self.assertEqual(res_doc.get_json()["appointment"]["status"], "Confirmed")

    def test_scheduling_conflict_doctor_and_patient(self):
        """Rejects overlapping bookings within 30-minute consultation window with 409 Conflict."""
        future_base = datetime.now(timezone.utc) + timedelta(days=4, hours=9)
        base_iso = future_base.isoformat()

        # Doctor books an appointment with Alice
        self._login("doctor1@careai.com", "Doctor@123")
        res1 = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": base_iso,
            "reason": "Base appointment at 09:00"
        })
        self.assertEqual(res1.status_code, 201)

        # Attempt 1: Another appointment for same doctor 15 minutes later with Bob -> 409 Conflict
        overlap_15m = (future_base + timedelta(minutes=15)).isoformat()
        res_conflict_doc = self.client.post("/api/appointments", json={
            "patient_id": self.patient2.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": overlap_15m,
            "reason": "Bob tries to book same doctor at 09:15"
        })
        self.assertEqual(res_conflict_doc.status_code, 409)
        self.assertIn("Doctor is already booked", res_conflict_doc.get_json()["message"])

        # Attempt 2: Alice tries to book Doctor 2 at 09:20 (same patient conflict within 30 min) -> 409 Conflict
        overlap_20m = (future_base + timedelta(minutes=20)).isoformat()
        res_conflict_pat = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor2.id,
            "scheduled_at": overlap_20m,
            "reason": "Alice tries to book second doctor at 09:20"
        })
        self.assertEqual(res_conflict_pat.status_code, 409)
        self.assertIn("Patient already has an appointment", res_conflict_pat.get_json()["message"])

        # Attempt 3: 45 minutes later (no overlap) -> 201 Created
        valid_45m = (future_base + timedelta(minutes=45)).isoformat()
        res_valid = self.client.post("/api/appointments", json={
            "patient_id": self.patient2.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": valid_45m,
            "reason": "Bob at 09:45"
        })
        self.assertEqual(res_valid.status_code, 201)

    # =========================================================
    # STEP 4: RESCHEDULING & STATUS STATE MACHINE
    # =========================================================

    def test_reschedule_workflow_and_validations(self):
        """Rescheduling validates past dates, conflict overlaps, and updates status appropriately."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=5, hours=10)
        appnt = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt,
            reason="Original checkup",
            status="Confirmed"
        )
        db.session.add(appnt)
        db.session.commit()

        # Alice reschedules to past date -> 400 Bad Request
        self._login("alice@patient.com", "Patient@123")
        past_dt = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        res_past = self.client.patch(f"/api/appointments/{appnt.id}/reschedule", json={
            "scheduled_at": past_dt
        })
        self.assertEqual(res_past.status_code, 400)

        # Alice reschedules to valid future slot -> 200 OK, status reset to "Pending"
        new_dt = (datetime.now(timezone.utc) + timedelta(days=6, hours=11)).isoformat()
        res_valid = self.client.patch(f"/api/appointments/{appnt.id}/reschedule", json={
            "scheduled_at": new_dt,
            "reason": "Rescheduled due to work schedule"
        })
        self.assertEqual(res_valid.status_code, 200)
        self.assertEqual(res_valid.get_json()["appointment"]["status"], "Pending")

        # Doctor reschedules -> 200 OK, status set to "Confirmed"
        self._login("doctor1@careai.com", "Doctor@123")
        doc_new_dt = (datetime.now(timezone.utc) + timedelta(days=7, hours=14)).isoformat()
        res_doc_resched = self.client.patch(f"/api/appointments/{appnt.id}/reschedule", json={
            "scheduled_at": doc_new_dt
        })
        self.assertEqual(res_doc_resched.status_code, 200)
        self.assertEqual(res_doc_resched.get_json()["appointment"]["status"], "Confirmed")

    def test_cannot_reschedule_terminal_appointments(self):
        """Completed or Cancelled appointments cannot be rescheduled."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=5)
        completed_appnt = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt,
            reason="Checkup",
            status="Completed"
        )
        cancelled_appnt = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt + timedelta(hours=2),
            reason="Checkup",
            status="Cancelled"
        )
        db.session.add_all([completed_appnt, cancelled_appnt])
        db.session.commit()

        self._login("doctor1@careai.com", "Doctor@123")
        new_dt = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()

        # Reschedule completed -> 400
        res_comp = self.client.patch(f"/api/appointments/{completed_appnt.id}/reschedule", json={
            "scheduled_at": new_dt
        })
        self.assertEqual(res_comp.status_code, 400)
        self.assertIn("completed", res_comp.get_json()["message"].lower())

        # Reschedule cancelled -> 400
        res_canc = self.client.patch(f"/api/appointments/{cancelled_appnt.id}/reschedule", json={
            "scheduled_at": new_dt
        })
        self.assertEqual(res_canc.status_code, 400)
        self.assertIn("cancelled", res_canc.get_json()["message"].lower())

    def test_status_transitions_and_role_constraints(self):
        """Enforces valid state machine and role permissions on appointment status updates."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=5)
        appnt = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt,
            reason="Checkup",
            status="Pending"
        )
        db.session.add(appnt)
        db.session.commit()

        # Patient cannot Confirm or Complete -> 403 Forbidden
        self._login("alice@patient.com", "Patient@123")
        res_pat_confirm = self.client.patch(f"/api/appointments/{appnt.id}/status", json={"status": "Confirmed"})
        self.assertEqual(res_pat_confirm.status_code, 403)

        res_pat_complete = self.client.patch(f"/api/appointments/{appnt.id}/status", json={"status": "Completed"})
        self.assertEqual(res_pat_complete.status_code, 403)

        # Doctor confirms -> 200 OK
        self._login("doctor1@careai.com", "Doctor@123")
        res_doc_confirm = self.client.patch(f"/api/appointments/{appnt.id}/status", json={"status": "Confirmed"})
        self.assertEqual(res_doc_confirm.status_code, 200)
        self.assertEqual(res_doc_confirm.get_json()["appointment"]["status"], "Confirmed")

        # Doctor completes -> 200 OK
        res_doc_complete = self.client.patch(f"/api/appointments/{appnt.id}/status", json={"status": "Completed"})
        self.assertEqual(res_doc_complete.status_code, 200)
        self.assertEqual(res_doc_complete.get_json()["appointment"]["status"], "Completed")

        # Attempt to modify completed appointment -> 400 Bad Request
        res_alter_completed = self.client.patch(f"/api/appointments/{appnt.id}/status", json={"status": "Confirmed"})
        self.assertEqual(res_alter_completed.status_code, 400)
        self.assertIn("completed", res_alter_completed.get_json()["message"].lower())

    def test_patient_cancellation_permissions(self):
        """Patients can cancel their own pending/confirmed appointments, but not other patients'."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=5)
        alice_appnt = Appointment(
            patient_id=self.patient1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt,
            reason="Alice visit",
            status="Confirmed"
        )
        bob_appnt = Appointment(
            patient_id=self.patient2.id,
            doctor_id=self.doctor1.id,
            scheduled_at=future_dt + timedelta(hours=1),
            reason="Bob visit",
            status="Confirmed"
        )
        db.session.add_all([alice_appnt, bob_appnt])
        db.session.commit()

        # Alice cancels Bob's -> 403 Forbidden
        self._login("alice@patient.com", "Patient@123")
        res_alice_bob = self.client.patch(f"/api/appointments/{bob_appnt.id}/status", json={"status": "Cancelled"})
        self.assertEqual(res_alice_bob.status_code, 403)

        # Alice cancels her own -> 200 OK
        res_alice_own = self.client.patch(f"/api/appointments/{alice_appnt.id}/status", json={"status": "Cancelled"})
        self.assertEqual(res_alice_own.status_code, 200)
        self.assertEqual(res_alice_own.get_json()["appointment"]["status"], "Cancelled")

        # Attempt to re-activate cancelled -> 400 Bad Request
        res_reactivate = self.client.patch(f"/api/appointments/{alice_appnt.id}/status", json={"status": "Confirmed"})
        self.assertEqual(res_reactivate.status_code, 400)
        self.assertIn("cancelled", res_reactivate.get_json()["message"].lower())

    # =========================================================
    # STEP 5: NOTIFICATIONS & AUDIT TRAIL
    # =========================================================

    def test_notifications_emitted_without_sensitive_clinical_markers(self):
        """Booking, rescheduling, and status updates trigger non-sensitive notifications."""
        self._login("alice@patient.com", "Patient@123")
        future_dt = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

        # 1. Alice books appointment
        res_book = self.client.post("/api/appointments", json={
            "patient_id": self.patient1.id,
            "doctor_id": self.doctor1.id,
            "scheduled_at": future_dt,
            "reason": "Routine Consultation"
        })
        self.assertEqual(res_book.status_code, 201)
        appnt_id = res_book.get_json()["appointment"]["id"]

        # Check doctor received notification
        doc_notifs = Notification.query.filter_by(user_id=self.doctor1.id).all()
        self.assertTrue(len(doc_notifs) > 0)
        notif = doc_notifs[-1]
        self.assertIn("Consultation", notif.title)
        # Verify NO sensitive clinical data in message
        self.assertNotIn("High Risk", notif.message)
        self.assertNotIn("Cirrhosis", notif.message)
        self.assertNotIn("AST", notif.message)

        # 2. Doctor confirms appointment
        self._login("doctor1@careai.com", "Doctor@123")
        res_conf = self.client.patch(f"/api/appointments/{appnt_id}/status", json={"status": "Confirmed"})
        self.assertEqual(res_conf.status_code, 200)

        # Check patient received notification
        pat_notifs = Notification.query.filter_by(user_id=self.patient1_user.id).all()
        self.assertTrue(len(pat_notifs) > 0)
        pat_notif = pat_notifs[-1]
        self.assertIn("Confirmed", pat_notif.message)

        # 3. Check activity log recorded
        logs = ActivityLog.query.filter(ActivityLog.details.like(f"%{appnt_id}%")).all()
        self.assertTrue(len(logs) > 0)

    # =========================================================
    # STEP 6: SEARCH, FILTER, SORTING & PAGINATION
    # =========================================================

    def test_search_filters_sorting_and_pagination(self):
        """Appointment listing supports search, status filtering, date range, sorting, and pagination."""
        base_time = datetime.now(timezone.utc) + timedelta(days=1)
        appnts = []
        statuses = ["Pending", "Confirmed", "Completed", "Cancelled"]
        for i in range(12):
            appnts.append(
                Appointment(
                    patient_id=self.patient1.id if i % 2 == 0 else self.patient2.id,
                    doctor_id=self.doctor1.id,
                    scheduled_at=base_time + timedelta(hours=i * 2),
                    reason=f"Reason slot {i} hepatitis review" if i == 5 else f"General checkup {i}",
                    status=statuses[i % len(statuses)]
                )
            )
        db.session.add_all(appnts)
        db.session.commit()

        self._login("doctor1@careai.com", "Doctor@123")

        # 1. Total & Pagination (page=1, per_page=5)
        res_p1 = self.client.get("/api/appointments?page=1&per_page=5")
        self.assertEqual(res_p1.status_code, 200)
        data_p1 = res_p1.get_json()
        self.assertEqual(data_p1["total"], 12)
        self.assertEqual(len(data_p1["appointments"]), 5)

        # 2. Search query (find "hepatitis")
        res_search = self.client.get("/api/appointments?q=hepatitis")
        self.assertEqual(res_search.status_code, 200)
        data_search = res_search.get_json()
        self.assertEqual(data_search["total"], 1)
        self.assertIn("hepatitis", data_search["appointments"][0]["reason"])

        # 3. Status filter ("Confirmed")
        res_stat = self.client.get("/api/appointments?status=Confirmed")
        self.assertEqual(res_stat.status_code, 200)
        data_stat = res_stat.get_json()
        self.assertTrue(all(a["status"] == "Confirmed" for a in data_stat["appointments"]))

        # 4. Sorting (scheduled_at desc)
        res_desc = self.client.get("/api/appointments?sort_by=scheduled_at&sort_dir=desc&per_page=12")
        self.assertEqual(res_desc.status_code, 200)
        items = res_desc.get_json()["appointments"]
        dates = [item["scheduled_at"] for item in items]
        self.assertEqual(dates, sorted(dates, reverse=True))


if __name__ == "__main__":
    unittest.main()
