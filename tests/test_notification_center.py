import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class NotificationCenterTestSuite(unittest.TestCase):
    """
    Comprehensive test suite for Phase 6 Task 5: Advanced Notification Center.
    Verifies:
    1. Authenticated users can retrieve their own notifications.
    2. Unauthenticated requests are rejected (401).
    3. Users cannot retrieve another user's private notifications.
    4. Users cannot retrieve notifications for roles they do not belong to.
    5. Users cannot mark another user's notifications as read or unread (403).
    6. Users cannot dismiss another user's notifications (403).
    7. Single mark-as-read and mark-as-unread persist correctly.
    8. Mark-all-as-read respects user ownership and role scoping.
    9. Unread counts are accurate across all states.
    10. Filters (status, category) and search (q) work correctly.
    11. Pagination controls work safely.
    12. Invalid notification IDs (404) and invalid query parameters are handled safely.
    13. Report upload triggers generate correctly scoped notifications.
    14. Absolute database isolation: Active database is NEVER touched.
    """

    def setUp(self):
        # Create isolated temporary database file
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_notif_uploads_")

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.test_upload_dir,
            "EXPOSE_DEV_RESET_URL": False,
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion
        db_uri = self.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, (
            f"SAFETY VIOLATION: Test targeting non-isolated DB: {db_uri}"
        )

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed isolated test users
        self.admin = User(name="Admin User", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.doctor = User(name="Dr. Smith", email="doctor@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.labtech = User(name="Tech Bob", email="lab@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.patient_alice = User(
            name="Alice Walker",
            email="alice@patient.com",
            role="patient",
            portal_id="PAT-ALICE01",
        )
        self.patient_alice.set_password("Patient@123")

        self.patient_bob = User(
            name="Bob Martin",
            email="bob@patient.com",
            role="patient",
            portal_id="PAT-BOB02",
        )
        self.patient_bob.set_password("Patient@123")

        db.session.add_all([
            self.admin,
            self.doctor,
            self.labtech,
            self.patient_alice,
            self.patient_bob,
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

        if os.path.exists(self.temp_db_path):
            try:
                os.unlink(self.temp_db_path)
            except OSError:
                pass

        if os.path.exists(self.test_upload_dir):
            try:
                import shutil
                shutil.rmtree(self.test_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def _login(self, email, password):
        return self.client.post(
            "/api/auth/login",
            data=json.dumps({"identifier": email, "password": password}),
            content_type="application/json",
        )

    # -------------------------------------------------------------------------
    # 1. Unauthenticated Requests
    # -------------------------------------------------------------------------
    def test_unauthenticated_requests_are_rejected(self):
        """Unauthenticated requests must receive 401 across all notification routes."""
        res_list = self.client.get("/api/notifications")
        self.assertEqual(res_list.status_code, 401)

        res_mark_all = self.client.post("/api/notifications/mark-read")
        self.assertEqual(res_mark_all.status_code, 401)

        res_mark_read = self.client.patch("/api/notifications/1/read")
        self.assertEqual(res_mark_read.status_code, 401)

        res_mark_unread = self.client.patch("/api/notifications/1/unread")
        self.assertEqual(res_mark_unread.status_code, 401)

        res_dismiss = self.client.delete("/api/notifications/1")
        self.assertEqual(res_dismiss.status_code, 401)

    # -------------------------------------------------------------------------
    # 2. Retrieval & Ownership Scoping
    # -------------------------------------------------------------------------
    def test_authenticated_user_retrieves_own_and_scoped_notifications(self):
        """User retrieves notifications addressed to them, their role, or broadcast."""
        n1 = Notification(
            title="Personal for Alice",
            message="Your biopsy results are ready.",
            user_id=self.patient_alice.id,
            category="info",
            read=False,
        )
        n2 = Notification(
            title="Patient Portal Broadcast",
            message="Portal maintenance on Saturday.",
            role="patient",
            category="warning",
            read=False,
        )
        n3 = Notification(
            title="System-wide Announcement",
            message="CirrhoCare AI system v1.2 updated.",
            role=None,
            user_id=None,
            category="info",
            read=False,
        )
        n4 = Notification(
            title="Private for Bob",
            message="Bob's prescription updated.",
            user_id=self.patient_bob.id,
            category="info",
            read=False,
        )
        n5 = Notification(
            title="Hepatology Advisory",
            message="New clinical guidelines for cirrhosis review.",
            role="hepatologist",
            category="info",
            read=False,
        )

        db.session.add_all([n1, n2, n3, n4, n5])
        db.session.commit()

        # Alice logs in
        login_res = self._login("alice@patient.com", "Patient@123")
        self.assertEqual(login_res.status_code, 200)

        res = self.client.get("/api/notifications")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertTrue(data["success"])
        titles = [n["title"] for n in data["notifications"]]

        # Alice should see: n1 (personal), n2 (patient role), n3 (global broadcast)
        self.assertIn("Personal for Alice", titles)
        self.assertIn("Patient Portal Broadcast", titles)
        self.assertIn("System-wide Announcement", titles)

        # Alice MUST NOT see: n4 (Bob's private), n5 (Doctor role)
        self.assertNotIn("Private for Bob", titles)
        self.assertNotIn("Hepatology Advisory", titles)

        # Unread count should be 3
        self.assertEqual(data["unread_count"], 3)

    # -------------------------------------------------------------------------
    # 3. Cross-User Privacy & Modification Prevention (403 Forbidden)
    # -------------------------------------------------------------------------
    def test_cross_user_modifications_rejected(self):
        """Bob cannot mark Alice's private notification as read, unread, or dismiss it."""
        n_alice = Notification(
            title="Alice Confidential Notification",
            message="Confidential lab results.",
            user_id=self.patient_alice.id,
            category="danger",
            read=False,
        )
        db.session.add(n_alice)
        db.session.commit()
        alice_notif_id = n_alice.id

        # Bob logs in
        self._login("bob@patient.com", "Patient@123")

        # Bob attempts to mark Alice's notification as read
        res_read = self.client.patch(f"/api/notifications/{alice_notif_id}/read")
        self.assertEqual(res_read.status_code, 403)

        # Bob attempts to mark Alice's notification as unread
        res_unread = self.client.patch(f"/api/notifications/{alice_notif_id}/unread")
        self.assertEqual(res_unread.status_code, 403)

        # Bob attempts to dismiss Alice's notification
        res_del = self.client.delete(f"/api/notifications/{alice_notif_id}")
        self.assertEqual(res_del.status_code, 403)

        # Confirm notification remained unread and present
        refreshed = db.session.get(Notification, alice_notif_id)
        self.assertIsNotNone(refreshed)
        self.assertFalse(refreshed.read)

    def test_user_cannot_modify_unauthorized_role_notification(self):
        """Patient cannot mark an admin-only notification as read."""
        n_admin = Notification(
            title="Admin Alert",
            message="Server metrics high.",
            role="admin",
            category="warning",
            read=False,
        )
        db.session.add(n_admin)
        db.session.commit()

        # Alice logs in
        self._login("alice@patient.com", "Patient@123")

        res = self.client.patch(f"/api/notifications/{n_admin.id}/read")
        self.assertEqual(res.status_code, 403)

    # -------------------------------------------------------------------------
    # 4. Mark Single Read / Unread Persistence
    # -------------------------------------------------------------------------
    def test_mark_as_read_and_unread_persists_correctly(self):
        """Single notification toggles read and unread status and persists to database."""
        n = Notification(
            title="Appointment Reminder",
            message="Consultation tomorrow at 10 AM.",
            user_id=self.patient_alice.id,
            category="info",
            read=False,
        )
        db.session.add(n)
        db.session.commit()
        notif_id = n.id

        self._login("alice@patient.com", "Patient@123")

        # 1. Mark as read
        res_read = self.client.patch(f"/api/notifications/{notif_id}/read")
        self.assertEqual(res_read.status_code, 200)
        data_read = res_read.get_json()
        self.assertTrue(data_read["success"])
        self.assertTrue(data_read["notification"]["read"])

        # Check DB
        db.session.expire_all()
        check_read = db.session.get(Notification, notif_id)
        self.assertTrue(check_read.read)

        # 2. Mark as unread
        res_unread = self.client.patch(f"/api/notifications/{notif_id}/unread")
        self.assertEqual(res_unread.status_code, 200)
        data_unread = res_unread.get_json()
        self.assertTrue(data_unread["success"])
        self.assertFalse(data_unread["notification"]["read"])

        # Check DB
        db.session.expire_all()
        check_unread = db.session.get(Notification, notif_id)
        self.assertFalse(check_unread.read)

    # -------------------------------------------------------------------------
    # 5. Mark All Read Respects Ownership
    # -------------------------------------------------------------------------
    def test_mark_all_as_read_respects_ownership(self):
        """Mark-all-read only marks notifications belonging to the current user."""
        n_alice1 = Notification(
            title="Alice Notif 1",
            message="Msg 1",
            user_id=self.patient_alice.id,
            read=False,
        )
        n_alice2 = Notification(
            title="Alice Notif 2",
            message="Msg 2",
            user_id=self.patient_alice.id,
            read=False,
        )
        n_bob1 = Notification(
            title="Bob Notif 1",
            message="Bob Msg 1",
            user_id=self.patient_bob.id,
            read=False,
        )
        n_bob2 = Notification(
            title="Bob Notif 2",
            message="Bob Msg 2",
            user_id=self.patient_bob.id,
            read=False,
        )

        db.session.add_all([n_alice1, n_alice2, n_bob1, n_bob2])
        db.session.commit()

        # Alice marks all read
        self._login("alice@patient.com", "Patient@123")
        res = self.client.post("/api/notifications/mark-read")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["success"])

        # Check Alice's notifications in DB
        db.session.expire_all()
        self.assertTrue(db.session.get(Notification, n_alice1.id).read)
        self.assertTrue(db.session.get(Notification, n_alice2.id).read)

        # Check Bob's notifications in DB — MUST REMAIN UNREAD
        self.assertFalse(db.session.get(Notification, n_bob1.id).read)
        self.assertFalse(db.session.get(Notification, n_bob2.id).read)

        # Bob logs in and checks unread_count
        self._login("bob@patient.com", "Patient@123")
        bob_res = self.client.get("/api/notifications")
        self.assertEqual(bob_res.get_json()["unread_count"], 2)

    # -------------------------------------------------------------------------
    # 6. Accurate Unread Counts
    # -------------------------------------------------------------------------
    def test_unread_count_is_accurate(self):
        """Unread count reflects the total number of unread accessible notifications."""
        for i in range(4):
            db.session.add(Notification(
                title=f"Unread {i}",
                message="Alert",
                user_id=self.doctor.id,
                read=False,
            ))
        for i in range(3):
            db.session.add(Notification(
                title=f"Read {i}",
                message="Alert",
                user_id=self.doctor.id,
                read=True,
            ))
        db.session.commit()

        self._login("doctor@careai.com", "Doctor@123")
        res = self.client.get("/api/notifications")
        data = res.get_json()

        self.assertEqual(data["total"], 7)
        self.assertEqual(data["unread_count"], 4)

    # -------------------------------------------------------------------------
    # 7. Filters and Pagination
    # -------------------------------------------------------------------------
    def test_filters_by_status_and_category_and_search(self):
        """Filtering by status (unread/read), category, and search keyword works."""
        n_danger = Notification(
            title="Critical Cirrhosis Risk",
            message="Patient exhibited elevated ALT enzymes.",
            user_id=self.doctor.id,
            category="danger",
            read=False,
        )
        n_warning = Notification(
            title="Follow-up Required",
            message="Platelet count borderline.",
            user_id=self.doctor.id,
            category="warning",
            read=True,
        )
        n_info = Notification(
            title="Routine Lab Sync",
            message="Biomarker sync completed.",
            user_id=self.doctor.id,
            category="info",
            read=False,
        )
        db.session.add_all([n_danger, n_warning, n_info])
        db.session.commit()

        self._login("doctor@careai.com", "Doctor@123")

        # Status: unread
        res_unread = self.client.get("/api/notifications?status=unread")
        data_unread = res_unread.get_json()
        self.assertEqual(len(data_unread["notifications"]), 2)
        for notif in data_unread["notifications"]:
            self.assertFalse(notif["read"])

        # Status: read
        res_read = self.client.get("/api/notifications?status=read")
        data_read = res_read.get_json()
        self.assertEqual(len(data_read["notifications"]), 1)
        self.assertEqual(data_read["notifications"][0]["title"], "Follow-up Required")

        # Category: danger
        res_danger = self.client.get("/api/notifications?category=danger")
        data_danger = res_danger.get_json()
        self.assertEqual(len(data_danger["notifications"]), 1)
        self.assertEqual(data_danger["notifications"][0]["category"], "danger")

        # Search: 'biomarker'
        res_search = self.client.get("/api/notifications?q=biomarker")
        data_search = res_search.get_json()
        self.assertEqual(len(data_search["notifications"]), 1)
        self.assertIn("Biomarker sync completed", data_search["notifications"][0]["message"])

    def test_pagination_controls(self):
        """Server-side pagination divides records into clean pages."""
        for i in range(15):
            db.session.add(Notification(
                title=f"Notif {i+1:02d}",
                message=f"Detailed message {i+1}",
                user_id=self.admin.id,
                read=False,
            ))
        db.session.commit()

        self._login("admin@careai.com", "Admin@123")

        # Page 1, per_page 5
        res_p1 = self.client.get("/api/notifications?page=1&per_page=5")
        data_p1 = res_p1.get_json()
        self.assertEqual(len(data_p1["notifications"]), 5)
        self.assertEqual(data_p1["total"], 15)
        self.assertEqual(data_p1["total_pages"], 3)
        self.assertEqual(data_p1["page"], 1)

        # Page 3, per_page 5
        res_p3 = self.client.get("/api/notifications?page=3&per_page=5")
        data_p3 = res_p3.get_json()
        self.assertEqual(len(data_p3["notifications"]), 5)
        self.assertEqual(data_p3["page"], 3)

    # -------------------------------------------------------------------------
    # 8. Safe Handling of Invalid IDs and Parameters
    # -------------------------------------------------------------------------
    def test_invalid_notification_ids_and_parameters(self):
        """Non-existent notification IDs return 404, invalid params do not throw 500."""
        self._login("admin@careai.com", "Admin@123")

        # 404 on non-existent IDs
        res_read_404 = self.client.patch("/api/notifications/999999/read")
        self.assertEqual(res_read_404.status_code, 404)

        res_unread_404 = self.client.patch("/api/notifications/999999/unread")
        self.assertEqual(res_unread_404.status_code, 404)

        res_del_404 = self.client.delete("/api/notifications/999999")
        self.assertEqual(res_del_404.status_code, 404)

        # Graceful handling of invalid query params
        res_malformed = self.client.get("/api/notifications?page=abc&per_page=-5&status=invalid")
        self.assertEqual(res_malformed.status_code, 200)
        self.assertTrue(res_malformed.get_json()["success"])

    # -------------------------------------------------------------------------
    # 9. Dismissal / Deletion
    # -------------------------------------------------------------------------
    def test_dismiss_notification_persists(self):
        """User can dismiss/delete their own notification."""
        n = Notification(
            title="Dismiss Me",
            message="Temporary alert.",
            user_id=self.labtech.id,
            read=False,
        )
        db.session.add(n)
        db.session.commit()
        notif_id = n.id

        self._login("lab@careai.com", "Lab@123")

        res = self.client.delete(f"/api/notifications/{notif_id}")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["success"])

        # Confirm deleted from DB
        db.session.expire_all()
        self.assertIsNone(db.session.get(Notification, notif_id))

    # -------------------------------------------------------------------------
    # 10. Report Upload Workflow Triggers
    # -------------------------------------------------------------------------
    def test_report_upload_workflow_triggers_scoped_notifications(self):
        """Uploading a diagnostic report triggers notifications for patient and hepatologist."""
        import io

        patient = Patient(
            full_name="Alice Walker",
            portal_id="PAT-ALICE01",
            age=39,
            gender="Female",
            phone="+1-555-0199",
            email="alice@patient.com",
        )
        db.session.add(patient)
        db.session.commit()

        # Lab tech uploads a report for Alice
        self._login("lab@careai.com", "Lab@123")

        file_data = (io.BytesIO(b"%PDF-1.4 test report data"), "test_ultrasound.pdf")
        res = self.client.post(
            f"/api/patients/{patient.id}/reports",
            data={
                "report": file_data,
                "category": "Ultrasound scan",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(res.status_code, 201)

        # Verify patient notification created
        patient_notif = Notification.query.filter_by(user_id=self.patient_alice.id).first()
        self.assertIsNotNone(patient_notif)
        self.assertIn("New Diagnostic Report Available", patient_notif.title)
        self.assertIn("test_ultrasound.pdf", patient_notif.message)

        # Verify hepatologist notification created
        doctor_notif = Notification.query.filter_by(role="hepatologist").first()
        self.assertIsNotNone(doctor_notif)
        self.assertIn("New Clinical Report Uploaded", doctor_notif.title)
        self.assertIn("Alice Walker", doctor_notif.message)


if __name__ == "__main__":
    unittest.main()
