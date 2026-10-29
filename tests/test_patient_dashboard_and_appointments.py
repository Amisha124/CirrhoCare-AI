import io
import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from app import create_app, db
from app.models.user import User
from app.models.patient import Patient
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.prescription import Prescription
from app.models.report import Report


class TestPatientDashboardAndAppointments(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_patient_dash_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="patient_dash_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "patient-dash-secret-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "patient-dash-secret-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # Create Staff accounts
            self.admin = User(name="Admin User", email="admin@cirrhocare.org", role="admin")
            self.admin.set_password("AdminPass@123")

            self.doctor = User(name="Dr. Sharma", email="doctor@cirrhocare.org", role="hepatologist", portal_id="DOC-101")
            self.doctor.set_password("DoctorPass@123")

            self.other_doctor = User(name="Dr. Patel", email="patel@cirrhocare.org", role="hepatologist", portal_id="DOC-102")
            self.other_doctor.set_password("DoctorPatel@123")

            self.labtech = User(name="Neha Verma", email="labtech@cirrhocare.org", role="labtech", portal_id="LAB-101")
            self.labtech.set_password("LabTechPass@123")

            db.session.add_all([self.admin, self.doctor, self.other_doctor, self.labtech])
            db.session.commit()

            # Register Patient A (Anil Kapoor) with complete biomarkers matching visual reference
            self.patient_a = Patient(
                full_name="Anil Kapoor",
                age=54,
                gender="Male",
                portal_id="CC-2026-7780",
                assigned_doctor_id=self.doctor.id,
                created_by_id=self.labtech.id,
                treatment_status="Under treatment",
                bilirubin=1.6,
                direct_bilirubin=0.5,
                sgot=48.0,
                sgpt=52.0,
                albumin=3.7,
                platelets=190.0,
                prothrombin=13.8,
                alk_phos=115.0,
                diet_plan="Eat a low-salt diet\n\nAvoid alcohol completely",
                care_instructions="Take adequate rest\n\nAvoid heavy physical activity",
                follow_up_date=datetime.now(timezone.utc).date() + timedelta(days=30),
            )
            db.session.add(self.patient_a)
            db.session.commit()

            # Register Patient B with missing/untested biomarkers
            self.patient_b = Patient(
                full_name="Sunita Rao",
                age=42,
                gender="Female",
                portal_id="CC-2026-9090",
                assigned_doctor_id=self.other_doctor.id,
                created_by_id=self.labtech.id,
                treatment_status="Registered",
                bilirubin=None,
                direct_bilirubin=None,
                sgot=None,
                sgpt=None,
                albumin=None,
                platelets=None,
                prothrombin=None,
                alk_phos=None,
            )
            db.session.add(self.patient_b)
            db.session.commit()

            # Create User for Patient A
            self.patient_a_user = User(
                name="Anil Kapoor",
                email="cc-2026-7780@cirrhocare.internal",
                role="patient",
                portal_id="CC-2026-7780",
                active=True,
            )
            self.patient_a_user.set_password("SecurePin#123")

            # Create User for Patient B
            self.patient_b_user = User(
                name="Sunita Rao",
                email="cc-2026-9090@cirrhocare.internal",
                role="patient",
                portal_id="CC-2026-9090",
                active=True,
            )
            self.patient_b_user.set_password("SecurePin#456")

            db.session.add_all([self.patient_a_user, self.patient_b_user])
            db.session.commit()

            # Add Prescription for Patient A
            self.rx_a = Prescription(
                patient_id=self.patient_a.id,
                doctor_id=self.doctor.id,
                medicine="Spironolactone",
                dosage="25 mg once daily",
                frequency_days=30,
                clinical_notes="Take in morning with food",
            )
            db.session.add(self.rx_a)
            db.session.commit()

            # Keep IDs
            self.patient_a_id = self.patient_a.id
            self.patient_b_id = self.patient_b.id
            self.doctor_id = self.doctor.id
            self.other_doctor_id = self.other_doctor.id
            self.labtech_id = self.labtech.id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        if os.path.exists(self.db_path):
            try:
                os.remove(self.db_path)
            except OSError:
                pass
        if os.path.exists(self.temp_upload_dir):
            try:
                shutil.rmtree(self.temp_upload_dir)
            except OSError:
                pass

    def _login(self, email, password):
        return self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": email, "password": password}),
            content_type="application/json",
        )

    def test_patient_dashboard_data_and_biomarker_mapping(self):
        """Verify Patient Portal retrieves the accurate 8 biomarker panel matching visual reference."""
        # Login as Patient A
        login_resp = self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        self.assertEqual(login_resp.status_code, 200)

        # Retrieve current patient profile
        resp = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data.get("success"))
        pt = data.get("patient")

        # Assert all 8 biomarker values match Anil Kapoor's visual reference card
        self.assertEqual(pt.get("full_name"), "Anil Kapoor")
        self.assertEqual(pt.get("portal_id"), "CC-2026-7780")
        self.assertEqual(pt.get("bilirubin"), 1.6)
        self.assertEqual(pt.get("direct_bilirubin"), 0.5)
        self.assertEqual(pt.get("sgot"), 48.0)
        self.assertEqual(pt.get("sgpt"), 52.0)
        self.assertEqual(pt.get("albumin"), 3.7)
        self.assertEqual(pt.get("platelets"), 190.0)
        self.assertEqual(pt.get("prothrombin"), 13.8)
        self.assertEqual(pt.get("alk_phos"), 115.0)

        # Assert diet and care instructions are present
        self.assertIn("low-salt", pt.get("diet_plan", "").lower())
        self.assertIn("rest", pt.get("care_instructions", "").lower())

    def test_missing_biomarker_values_handling(self):
        """Verify serialization safely handles None/null biomarker values without exceptions."""
        login_resp = self._login("cc-2026-9090@cirrhocare.internal", "SecurePin#456")
        self.assertEqual(login_resp.status_code, 200)

        resp = self.client.get(f"/api/patients/{self.patient_b_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        pt = data.get("patient")

        self.assertIsNone(pt.get("bilirubin"))
        self.assertIsNone(pt.get("sgot"))
        self.assertIsNone(pt.get("sgpt"))
        self.assertIsNone(pt.get("platelets"))

    def test_pdf_download_integrity_and_422_on_corrupt_file(self):
        """Verify PDF integrity check returns 422 for corrupted files and 200 for valid PDFs."""
        with self.app.app_context():
            # 1. Create a corrupt/stub file matching the 47-byte placeholder found in demo uploads
            corrupt_fname = "corrupt_test_report.pdf"
            corrupt_fpath = os.path.join(self.temp_upload_dir, corrupt_fname)
            with open(corrupt_fpath, "wb") as f:
                f.write(b"%PDF-1.4 Mock diagnostic report for Anil Kapoor")  # 46 bytes, missing EOF & structure

            corrupt_report = Report(
                patient_id=self.patient_a_id,
                filename=corrupt_fname,
                original_filename="LFT_Corrupt_Test.pdf",
            )
            db.session.add(corrupt_report)
            db.session.commit()
            corrupt_id = corrupt_report.id

            # 2. Create a valid standard PDF
            valid_fname = "valid_test_report.pdf"
            valid_fpath = os.path.join(self.temp_upload_dir, valid_fname)
            # A minimal valid standard PDF payload
            minimal_valid_pdf = (
                b"%PDF-1.4\n"
                b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
                b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
                b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
                b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
                b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n"
            )
            with open(valid_fpath, "wb") as f:
                f.write(minimal_valid_pdf)

            valid_report = Report(
                patient_id=self.patient_a_id,
                filename=valid_fname,
                original_filename="LFT_Valid_Test.pdf",
            )
            db.session.add(valid_report)
            db.session.commit()
            valid_id = valid_report.id

        # Login as Patient A
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")

        # Test corrupt PDF download -> Must return HTTP 422 with structured error
        corrupt_resp = self.client.get(f"/api/reports/{corrupt_id}/download")
        self.assertEqual(corrupt_resp.status_code, 422)
        err_data = corrupt_resp.get_json()
        self.assertFalse(err_data.get("success"))
        self.assertIn("corrupt", err_data.get("error", "").lower())

        # Test valid PDF download with inline=true -> Must return HTTP 200 and Content-Type: application/pdf
        valid_resp = self.client.get(f"/api/reports/{valid_id}/download?inline=true")
        self.assertEqual(valid_resp.status_code, 200)
        self.assertIn("application/pdf", valid_resp.headers.get("Content-Type", ""))
        self.assertIn("inline", valid_resp.headers.get("Content-Disposition", ""))

    def test_patient_consultation_booking_pending_status(self):
        """Verify patient can book a consultation resulting in Pending status, and past dates are rejected."""
        # Login as Patient A
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")

        # Attempt to book appointment in the past -> must reject with 400
        past_date = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%dT10:00")
        bad_resp = self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": past_date,
                "reason": "Consultation checkup",
            }),
            content_type="application/json",
        )
        self.assertEqual(bad_resp.status_code, 400)

        # Book future consultation
        future_date = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%dT10:30")
        create_resp = self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": future_date,
                "reason": "Review liver enzyme values and dietary plan",
                "appointment_type": "Consultation",
            }),
            content_type="application/json",
        )
        self.assertEqual(create_resp.status_code, 201)
        data = create_resp.get_json()
        appnt = data.get("appointment")
        self.assertEqual(appnt.get("status"), "Pending")
        self.assertEqual(appnt.get("appointment_type"), "Consultation")
        self.assertEqual(appnt.get("patient_id"), self.patient_a_id)

    def test_appointment_synchronization_with_doctor_dashboard(self):
        """Verify newly booked appointment appears in Doctor's dashboard and patient appointments list."""
        # 1. Patient A books consultation
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        future_date = (datetime.now(timezone.utc) + timedelta(days=6)).strftime("%Y-%m-%dT11:00")
        self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": future_date,
                "reason": "Discuss ultrasound and AST/ALT levels",
                "appointment_type": "Consultation",
            }),
            content_type="application/json",
        )

        # 2. Doctor logs in
        self._login("doctor@cirrhocare.org", "DoctorPass@123")

        # List appointments for Patient A
        list_resp = self.client.get(f"/api/appointments?patient_id={self.patient_a_id}")
        self.assertEqual(list_resp.status_code, 200)
        data = list_resp.get_json()
        self.assertTrue(data.get("success"))
        appointments = data.get("appointments", [])
        self.assertGreaterEqual(len(appointments), 1)

        target = next((a for a in appointments if "Discuss ultrasound" in a.get("reason", "")), None)
        self.assertIsNotNone(target)
        self.assertEqual(target.get("status"), "Pending")
        self.assertEqual(target.get("patient_name"), "Anil Kapoor")

    def test_doctor_confirm_appointment(self):
        """Verify Doctor can confirm a Pending appointment and record clinical notes."""
        with self.app.app_context():
            future_slot = datetime.now(timezone.utc) + timedelta(days=7)
            appnt = Appointment(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                scheduled_at=future_slot,
                reason="Routine checkup",
                status="Pending",
                appointment_type="Consultation",
            )
            db.session.add(appnt)
            db.session.commit()
            appnt_id = appnt.id

        # Doctor logs in and confirms
        self._login("doctor@cirrhocare.org", "DoctorPass@123")
        patch_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({
                "status": "Confirmed",
                "doctor_notes": "Confirmed. Please come fasting for repeat liver panel.",
            }),
            content_type="application/json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        data = patch_resp.get_json()
        updated = data.get("appointment")
        self.assertEqual(updated.get("status"), "Confirmed")
        self.assertEqual(updated.get("doctor_notes"), "Confirmed. Please come fasting for repeat liver panel.")

    def test_doctor_propose_reschedule(self):
        """Verify Doctor can propose a rescheduled time slot with doctor note."""
        with self.app.app_context():
            orig_slot = datetime.now(timezone.utc) + timedelta(days=3)
            appnt = Appointment(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                scheduled_at=orig_slot,
                reason="Follow-up consultation",
                status="Confirmed",
                appointment_type="Follow-up",
            )
            db.session.add(appnt)
            db.session.commit()
            appnt_id = appnt.id

        new_slot = (datetime.now(timezone.utc) + timedelta(days=4, hours=2)).strftime("%Y-%m-%dT14:00")
        self._login("doctor@cirrhocare.org", "DoctorPass@123")
        patch_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({
                "status": "Rescheduled",
                "scheduled_at": new_slot,
                "doctor_notes": "Moved 1 day forward to accommodate lab review.",
            }),
            content_type="application/json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        data = patch_resp.get_json()
        updated = data.get("appointment")
        self.assertEqual(updated.get("status"), "Rescheduled")
        self.assertEqual(updated.get("doctor_notes"), "Moved 1 day forward to accommodate lab review.")

    def test_follow_up_booking_with_recommended_date(self):
        """Verify follow-up consultation booking with pre-filled type and date."""
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")

        follow_up_time = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%dT09:30")
        create_resp = self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": follow_up_time,
                "reason": "1-Month Doctor Follow-up Visit",
                "appointment_type": "Follow-up",
            }),
            content_type="application/json",
        )
        self.assertEqual(create_resp.status_code, 201)
        data = create_resp.get_json()
        appnt = data.get("appointment")
        self.assertEqual(appnt.get("appointment_type"), "Follow-up")
        self.assertEqual(appnt.get("status"), "Pending")

    def test_unauthorized_cross_patient_access_rejection(self):
        """Verify strict authorization: Patients cannot access other patients' data and Lab Tech cannot access appointments."""
        with self.app.app_context():
            future_slot = datetime.now(timezone.utc) + timedelta(days=10)
            appnt_b = Appointment(
                patient_id=self.patient_b_id,
                doctor_id=self.other_doctor_id,
                scheduled_at=future_slot,
                reason="Confidential consultation Patient B",
                status="Pending",
                appointment_type="Consultation",
            )
            db.session.add(appnt_b)
            db.session.commit()
            appnt_b_id = appnt_b.id

        # Patient A logs in
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")

        # Patient A tries to view Patient B's appointment details -> 403
        get_resp = self.client.get(f"/api/appointments/{appnt_b_id}")
        self.assertEqual(get_resp.status_code, 403)

        # Patient A tries to mutate Patient B's appointment -> 403
        patch_resp = self.client.patch(
            f"/api/appointments/{appnt_b_id}/status",
            data=json.dumps({"status": "Cancelled"}),
            content_type="application/json",
        )
        self.assertEqual(patch_resp.status_code, 403)

        # Patient A tries to list Patient B's appointments -> 403
        list_resp = self.client.get(f"/api/appointments?patient_id={self.patient_b_id}")
        self.assertEqual(list_resp.status_code, 403)

        # Lab Tech logs in -> cannot access clinical appointments -> 403
        self._login("labtech@cirrhocare.org", "LabTechPass@123")
        lab_resp = self.client.get("/api/appointments")
        self.assertEqual(lab_resp.status_code, 403)

    def test_patient_accept_rescheduled_appointment(self):
        """Verify patient can accept a clinician's proposed reschedule, transitioning status to Confirmed."""
        with self.app.app_context():
            rescheduled_slot = datetime.now(timezone.utc) + timedelta(days=5)
            appnt = Appointment(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                scheduled_at=rescheduled_slot,
                reason="Follow-up consultation",
                status="Rescheduled",
                appointment_type="Follow-up",
                doctor_notes="Moved to 2:00 PM for clinic availability.",
            )
            db.session.add(appnt)
            db.session.commit()
            appnt_id = appnt.id

        # Patient logs in
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")

        # Patient accepts doctor's proposed rescheduled slot -> transitions to Confirmed
        accept_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({"status": "Confirmed"}),
            content_type="application/json",
        )
        self.assertEqual(accept_resp.status_code, 200)
        data = accept_resp.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("appointment", {}).get("status"), "Confirmed")

        # Patient cannot change to non-permitted status like "Completed" -> 403
        invalid_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({"status": "Completed"}),
            content_type="application/json",
        )
        self.assertEqual(invalid_resp.status_code, 403)

    def test_labtech_replace_corrupted_report_preserves_id_and_logs_audit(self):
        """Verify Lab Tech can replace a corrupted report file; report ID is preserved and audit trail is logged."""
        # 1. Create a corrupted report in DB
        with self.app.app_context():
            corrupt_fname = "corrupt_lft_demo.pdf"
            corrupt_fpath = os.path.join(self.temp_upload_dir, corrupt_fname)
            with open(corrupt_fpath, "wb") as f:
                f.write(b"%PDF-1.4 Incomplete stub")  # 24 bytes

            corrupt_rep = Report(
                patient_id=self.patient_a_id,
                filename=corrupt_fname,
                original_filename="LFT_Corrupt_Placeholder.pdf",
                category="Liver Function Test",
            )
            db.session.add(corrupt_rep)
            db.session.commit()
            report_id = corrupt_rep.id

        # Patient attempts to download -> 422
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        get_err = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(get_err.status_code, 422)

        # 2. Lab Tech logs in and uploads valid replacement PDF
        self._login("labtech@cirrhocare.org", "LabTechPass@123")

        valid_pdf_content = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
            b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
            b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n"
        )
        upload_data = {
            "report": (io.BytesIO(valid_pdf_content), "LFT_Replacement_Official.pdf"),
            "category": "Liver Function Test (LFT)",
            "replace_report_id": str(report_id),
            "allow_replace": "true",
        }
        upload_resp = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data=upload_data,
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_resp.status_code, 200)
        upload_json = upload_resp.get_json()
        self.assertTrue(upload_json.get("success"))
        # Preserves existing Report ID
        self.assertEqual(upload_json.get("report", {}).get("id"), report_id)

        # 3. Verify downloading now succeeds with 200 and application/pdf
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        view_resp = self.client.get(f"/api/reports/{report_id}/download?inline=true")
        self.assertEqual(view_resp.status_code, 200)
        self.assertIn("application/pdf", view_resp.headers.get("Content-Type", ""))

        # 4. Verify audit trail in ActivityLog
        with self.app.app_context():
            audit_entry = ActivityLog.query.filter(
                ActivityLog.action.like("%Report replaced%")
            ).first()
            self.assertIsNotNone(audit_entry)
            self.assertIn(str(report_id), audit_entry.details)

    def test_single_sidebar_and_layout_structure(self):
        """Verify frontend source files enforce exactly one sidebar with exactly 5 items for patients."""
        patient_page_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "src", "pages", "PatientDashboardPage.tsx"
        )
        sidebar_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "src", "layouts", "Sidebar.tsx"
        )

        with open(patient_page_path, "r", encoding="utf-8") as f:
            patient_content = f.read()

        # PatientDashboardPage must NOT render an internal <aside> or nested <Sidebar>
        self.assertNotIn("<aside", patient_content)
        self.assertNotIn("<Sidebar", patient_content)

        with open(sidebar_path, "r", encoding="utf-8") as f:
            sidebar_content = f.read()

        # Sidebar must contain the 5 patient navigation links
        self.assertIn("Dashboard", sidebar_content)
        self.assertIn("My Reports", sidebar_content)
        self.assertIn("My Prescriptions", sidebar_content)
        self.assertIn("Appointments", sidebar_content)
        self.assertIn("Logout", sidebar_content)

    def test_doctor_sidebar_and_page_structure(self):
        """Verify doctor sidebar includes Appointment Requests with pending badge, and page has required columns."""
        sidebar_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "src", "layouts", "Sidebar.tsx"
        )
        page_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "src", "pages", "DoctorAppointmentRequestsPage.tsx"
        )

        with open(sidebar_path, "r", encoding="utf-8") as f:
            sidebar_content = f.read()

        # Doctor sidebar items: Dashboard, Patients, Appointment Requests, My Profile, Logout
        self.assertIn("Appointment Requests", sidebar_content)
        self.assertIn("pendingDoctorRequestsCount", sidebar_content)

        with open(page_path, "r", encoding="utf-8") as f:
            page_content = f.read()

        # Required columns
        self.assertIn("Patient Name", page_content)
        self.assertIn("Patient ID", page_content)
        self.assertIn("Requested Date", page_content)
        self.assertIn("Requested Time", page_content)
        self.assertIn("Reason for Visit", page_content)
        self.assertIn("Status", page_content)
        self.assertIn("Actions", page_content)

        # Required filters
        self.assertIn("Reschedule Proposed", page_content)
        self.assertIn("Pending", page_content)
        self.assertIn("Confirmed", page_content)
        self.assertIn("Rejected", page_content)
        self.assertIn("Completed", page_content)

    def test_doctor_appointment_requests_e2e_integration(self):
        """Test complete patient booking -> doctor request visibility -> confirmation -> reschedule -> rejection lifecycle."""
        # Step 1: Patient A books Follow-up appointment
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        future_slot = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%dT10:30")
        book_resp = self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": future_slot,
                "reason": "1-Month Follow-Up Consultation",
                "appointment_type": "Follow-up",
            }),
            content_type="application/json",
        )
        self.assertEqual(book_resp.status_code, 201)
        appnt_id = book_resp.get_json()["appointment"]["id"]

        # Step 2: Prevent duplicate pending request for same slot -> 409
        dup_resp = self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": future_slot,
                "reason": "Accidental duplicate booking",
                "appointment_type": "Follow-up",
            }),
            content_type="application/json",
        )
        self.assertEqual(dup_resp.status_code, 409)

        # Step 3: Doctor logs in and queries pending appointment requests
        self._login("doctor@cirrhocare.org", "DoctorPass@123")
        list_resp = self.client.get("/api/appointments?status=Pending")
        self.assertEqual(list_resp.status_code, 200)
        pending_list = list_resp.get_json()["appointments"]
        matching = next((a for a in pending_list if a["id"] == appnt_id), None)
        self.assertIsNotNone(matching)
        self.assertEqual(matching["patient_name"], "Anil Kapoor")
        self.assertEqual(matching["patient_portal_id"], "CC-2026-7780")
        self.assertEqual(matching["appointment_type"], "Follow-up")
        self.assertEqual(matching["status"], "Pending")

        # Step 4: Doctor confirms appointment with prep notes
        confirm_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({
                "status": "Confirmed",
                "doctor_notes": "Confirmed. Please come fasting 8 hours for repeat LFT.",
            }),
            content_type="application/json",
        )
        self.assertEqual(confirm_resp.status_code, 200)
        self.assertEqual(confirm_resp.get_json()["appointment"]["status"], "Confirmed")

        # Step 5: Patient logs in and verifies appointment is Confirmed
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        pat_get = self.client.get(f"/api/appointments/{appnt_id}")
        self.assertEqual(pat_get.status_code, 200)
        pat_data = pat_get.get_json()["appointment"]
        self.assertEqual(pat_data["status"], "Confirmed")
        self.assertIn("fasting 8 hours", pat_data.get("doctor_notes", ""))

        # Step 6: Doctor proposes new date/time (Rescheduled)
        self._login("doctor@cirrhocare.org", "DoctorPass@123")
        new_slot = (datetime.now(timezone.utc) + timedelta(days=8)).strftime("%Y-%m-%dT14:00")
        resched_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({
                "status": "Rescheduled",
                "scheduled_at": new_slot,
                "doctor_notes": "Moved 1 day forward due to surgical schedule.",
            }),
            content_type="application/json",
        )
        self.assertEqual(resched_resp.status_code, 200)
        self.assertEqual(resched_resp.get_json()["appointment"]["status"], "Rescheduled")

        # Step 7: Patient accepts reschedule
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        accept_resp = self.client.patch(
            f"/api/appointments/{appnt_id}/status",
            data=json.dumps({"status": "Confirmed"}),
            content_type="application/json",
        )
        self.assertEqual(accept_resp.status_code, 200)
        self.assertEqual(accept_resp.get_json()["appointment"]["status"], "Confirmed")

        # Step 8: Patient books another consultation, Doctor rejects with reason
        slot_2 = (datetime.now(timezone.utc) + timedelta(days=12)).strftime("%Y-%m-%dT11:00")
        b2_resp = self.client.post(
            "/api/appointments",
            data=json.dumps({
                "scheduled_at": slot_2,
                "reason": "Ultrasound review",
                "appointment_type": "Consultation",
            }),
            content_type="application/json",
        )
        self.assertEqual(b2_resp.status_code, 201)
        appnt_2_id = b2_resp.get_json()["appointment"]["id"]

        self._login("doctor@cirrhocare.org", "DoctorPass@123")
        reject_resp = self.client.patch(
            f"/api/appointments/{appnt_2_id}/status",
            data=json.dumps({
                "status": "Rejected",
                "doctor_notes": "Clinic closed on holiday. Please rebook for next week.",
            }),
            content_type="application/json",
        )
        self.assertEqual(reject_resp.status_code, 200)
        self.assertEqual(reject_resp.get_json()["appointment"]["status"], "Rejected")

        # Patient sees Rejected status
        self._login("cc-2026-7780@cirrhocare.internal", "SecurePin#123")
        get_rej = self.client.get(f"/api/appointments/{appnt_2_id}")
        self.assertEqual(get_rej.status_code, 200)
        self.assertEqual(get_rej.get_json()["appointment"]["status"], "Rejected")
        self.assertIn("holiday", get_rej.get_json()["appointment"]["doctor_notes"])


if __name__ == "__main__":
    unittest.main()
