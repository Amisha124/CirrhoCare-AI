import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class EndToEndClinicalWorkflowAndDashboardsTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_e2e_workflow.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name
        self.temp_upload_dir = tempfile.mkdtemp(prefix="e2e_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "e2e-clinical-workflow-test-key-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "e2e-clinical-workflow-test-key-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # 1. Staff users
            self.admin = User(name="System Admin", email="admin@clinic.org", role="admin")
            self.admin.set_password("Admin@1234")

            self.labtech = User(name="Neha Verma", email="neha.labtech@clinic.org", role="labtech")
            self.labtech.set_password("LabTech@1234")

            self.doctor_assigned = User(name="Dr. Raj Sharma", email="raj.sharma@clinic.org", role="hepatologist")
            self.doctor_assigned.set_password("Doctor@1234")

            self.doctor_unauthorized = User(name="Dr. External Clinician", email="external.doc@clinic.org", role="hepatologist")
            self.doctor_unauthorized.set_password("Doctor@1234")

            # 2. Patient User Accounts
            self.patient_user_a = User(
                name="Aisha Patel",
                email="aisha.patel@careai.com",
                role="patient",
                portal_id="PAT-1008",
            )
            self.patient_user_a.set_password("PatientA@1234")

            self.patient_user_b = User(
                name="Eleanor Vance",
                email="eleanor.vance@careai.com",
                role="patient",
                portal_id="PAT-1001",
            )
            self.patient_user_b.set_password("PatientB@1234")

            db.session.add_all([
                self.admin,
                self.labtech,
                self.doctor_assigned,
                self.doctor_unauthorized,
                self.patient_user_a,
                self.patient_user_b,
            ])
            db.session.commit()

            # 3. Patient Clinical Records
            self.patient_a = Patient(
                full_name="Aisha Patel",
                age=44,
                gender="Female",
                portal_id="PAT-1008",
                phone="+91-9876543210",
                email="aisha.patel@careai.com",
                bilirubin=1.2,
                albumin=3.8,
                sgot=35.0,
                sgpt=40.0,
                platelets=210.0,
                alk_phos=110.0,
                treatment_status="Awaiting Doctor Review",
                lab_workflow_status="Registered",
                assigned_doctor_id=self.doctor_assigned.id,
            )

            self.patient_b = Patient(
                full_name="Eleanor Vance",
                age=58,
                gender="Female",
                portal_id="PAT-1001",
                phone="+91-9123456789",
                email="eleanor.vance@careai.com",
                treatment_status="Registered",
                lab_workflow_status="Registered",
                assigned_doctor_id=self.doctor_unauthorized.id,
            )

            db.session.add_all([self.patient_a, self.patient_b])
            db.session.commit()

            self.patient_a_id = self.patient_a.id
            self.patient_b_id = self.patient_b.id

    def tearDown(self):
        try:
            shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except Exception:
            pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _logout(self):
        return self.client.post("/api/auth/logout")

    def test_complete_end_to_end_clinical_workflow(self):
        """
        Executes the 17-step end-to-end integration audit workflow across Lab, Doctor, Patient, and Admin roles.
        """
        # -------------------------------------------------------------
        # STEP 1: Authenticate as Lab Technician
        # -------------------------------------------------------------
        res_login_lab = self._login("neha.labtech@clinic.org", "LabTech@1234")
        self.assertEqual(res_login_lab.status_code, 200, "Step 1: Lab Technician login must succeed")
        user_data = res_login_lab.get_json()["user"]
        self.assertEqual(user_data["role"], "labtech")

        # -------------------------------------------------------------
        # STEP 2: Select a test patient
        # -------------------------------------------------------------
        res_get_patient = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(res_get_patient.status_code, 200, "Step 2: Lab Tech must be able to view patient")
        patient_info = res_get_patient.get_json()["patient"]
        self.assertEqual(patient_info["portal_id"], "PAT-1008")
        initial_reports_count = len(patient_info.get("reports", []))
        self.assertEqual(initial_reports_count, 0)

        # -------------------------------------------------------------
        # STEP 3 & 4: Enter valid laboratory test results & Save via PUT /api/patients/<id>
        # -------------------------------------------------------------
        lab_update_payload = {
            "bilirubin": 2.6,
            "albumin": 3.1,
            "sgot": 68.0,
            "sgpt": 75.0,
            "platelets": 175.0,
            "alk_phos": 160.0,
            "copper": 88.0,
            "prothrombin": 12.4,
            "edema": 0.5,
            "ascites": "N",
            "spiders": "Y",
            "hepatomegaly": "Y",
        }
        res_put = self.client.put(f"/api/patients/{self.patient_a_id}", json=lab_update_payload)
        self.assertEqual(res_put.status_code, 200, "Step 4: Saving laboratory results must return 200")
        put_json = res_put.get_json()
        self.assertIn("report", put_json, "Response payload must include newly generated report")
        new_report_data = put_json["report"]
        report_id = new_report_data["id"]

        # -------------------------------------------------------------
        # STEP 5: Verify automatic PDF generation file created on disk
        # -------------------------------------------------------------
        pdf_filename = new_report_data["filename"]
        expected_pdf_path = os.path.join(self.temp_upload_dir, pdf_filename)
        self.assertTrue(os.path.exists(expected_pdf_path), f"Step 5: Generated PDF file must exist at {expected_pdf_path}")
        pdf_file_size = os.path.getsize(expected_pdf_path)
        self.assertGreater(pdf_file_size, 500, f"Step 5: PDF file size must be non-trivial (got {pdf_file_size} bytes)")

        # Verify PDF header magic bytes %PDF
        with open(expected_pdf_path, "rb") as f:
            header_magic = f.read(4)
        self.assertEqual(header_magic, b"%PDF", "Step 5: File must be a valid PDF document")

        # -------------------------------------------------------------
        # STEP 6: Verify exactly 1 Report DB record created and linked to patient ID
        # -------------------------------------------------------------
        with self.app.app_context():
            reports = Report.query.filter_by(patient_id=self.patient_a_id).all()
            self.assertEqual(len(reports), 1, "Step 6: Exactly one Report record must exist for this patient")
            db_report = reports[0]
            self.assertEqual(db_report.id, report_id)
            self.assertEqual(db_report.category, "Liver Function Test (LFT)")
            self.assertEqual(db_report.filename, pdf_filename)

        # -------------------------------------------------------------
        # STEP 7: Verify patient's status in DB & API is "Report Uploaded"
        # -------------------------------------------------------------
        with self.app.app_context():
            p = db.session.get(Patient, self.patient_a_id)
            self.assertEqual(p.lab_workflow_status, "Report Uploaded", "Step 7: DB lab_workflow_status must be 'Report Uploaded'")
            self.assertEqual(p.treatment_status, "Report Uploaded", "Step 7: DB treatment_status must be 'Report Uploaded'")
            self.assertEqual(p.bilirubin, 2.6)
            self.assertEqual(p.albumin, 3.1)

        # Lab tech downloads and records bytes
        res_lab_download = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(res_lab_download.status_code, 200, "Lab Tech must be able to download the generated PDF")
        lab_bytes = res_lab_download.data
        self.assertEqual(len(lab_bytes), pdf_file_size)

        self._logout()

        # -------------------------------------------------------------
        # STEP 8: Authenticate as Doctor
        # -------------------------------------------------------------
        res_login_doc = self._login("raj.sharma@clinic.org", "Doctor@1234")
        self.assertEqual(res_login_doc.status_code, 200, "Step 8: Assigned doctor login must succeed")

        # -------------------------------------------------------------
        # STEP 9: Verify Doctor sees "Report Uploaded" status
        # -------------------------------------------------------------
        res_doc_patient = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(res_doc_patient.status_code, 200)
        doc_patient_payload = res_doc_patient.get_json()["patient"]
        self.assertEqual(doc_patient_payload["lab_workflow_status"], "Report Uploaded", "Step 9: Doctor sees lab_workflow_status='Report Uploaded'")
        self.assertEqual(doc_patient_payload["treatment_status"], "Report Uploaded", "Step 9: Doctor sees treatment_status='Report Uploaded'")
        self.assertEqual(len(doc_patient_payload["reports"]), 1, "Doctor sees 1 attached report")

        # -------------------------------------------------------------
        # STEP 10: Doctor downloads PDF via GET /api/reports/<id>/download and records bytes
        # -------------------------------------------------------------
        res_doc_download = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(res_doc_download.status_code, 200, "Step 10: Doctor can download patient's PDF")
        self.assertEqual(res_doc_download.headers.get("Content-Type"), "application/pdf")
        doc_bytes = res_doc_download.data
        self.assertEqual(doc_bytes, lab_bytes, "Step 10: Doctor download must match Lab Tech download exactly")

        self._logout()

        # -------------------------------------------------------------
        # STEP 11: Authenticate as Patient
        # -------------------------------------------------------------
        res_login_patient = self._login("aisha.patel@careai.com", "PatientA@1234")
        self.assertEqual(res_login_patient.status_code, 200, "Step 11: Patient A login must succeed")

        # -------------------------------------------------------------
        # STEP 12: Verify Patient dashboard returns report and "Report Uploaded" status
        # -------------------------------------------------------------
        res_patient_dashboard = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_patient_dashboard.status_code, 200, "Step 12: Patient dashboard API must return 200")
        patient_dash_data = res_patient_dashboard.get_json()
        patient_rec = patient_dash_data["latest_record"]
        self.assertEqual(patient_rec["treatment_status"], "Report Uploaded")
        self.assertEqual(patient_rec["lab_workflow_status"], "Report Uploaded")

        # Check reports returned to patient
        res_patient_reports = self.client.get("/api/reports")
        self.assertEqual(res_patient_reports.status_code, 200)
        patient_reports_list = res_patient_reports.get_json()["reports"]
        self.assertEqual(len(patient_reports_list), 1)
        self.assertEqual(patient_reports_list[0]["id"], report_id)

        # -------------------------------------------------------------
        # STEP 13: Patient downloads PDF via GET /api/reports/<id>/download & confirms byte-for-byte match
        # -------------------------------------------------------------
        res_patient_download = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(res_patient_download.status_code, 200, "Step 13: Patient can download their own report")
        patient_bytes = res_patient_download.data
        self.assertEqual(patient_bytes, doc_bytes, "Step 13: Patient bytes must match Doctor bytes byte-for-byte")

        self._logout()

        # -------------------------------------------------------------
        # STEP 14: Authenticate as Admin
        # -------------------------------------------------------------
        res_login_admin = self._login("admin@clinic.org", "Admin@1234")
        self.assertEqual(res_login_admin.status_code, 200, "Step 14: Admin login must succeed")

        # -------------------------------------------------------------
        # STEP 15: Verify Admin sees "Report Uploaded" in patient monitoring & audit logs
        # -------------------------------------------------------------
        res_admin_overview = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_admin_overview.status_code, 200, "Step 15: Admin overview API must return 200")
        admin_data = res_admin_overview.get_json()

        # Check recent patients list in overview
        recent_pts = admin_data.get("recent_patients", [])
        patient_a_in_admin = next((p for p in recent_pts if p["id"] == self.patient_a_id), None)
        self.assertIsNotNone(patient_a_in_admin, "Patient A must appear in Admin recent patients")
        self.assertEqual(patient_a_in_admin["lab_workflow_status"], "Report Uploaded")

        # Check patient monitoring list
        res_admin_pts = self.client.get("/api/patients")
        self.assertEqual(res_admin_pts.status_code, 200, "Step 15: Admin patients list API must return 200")
        admin_all_pts = res_admin_pts.get_json()["patients"]
        pt_monitoring = next((p for p in admin_all_pts if p["id"] == self.patient_a_id), None)
        self.assertIsNotNone(pt_monitoring)
        self.assertEqual(pt_monitoring["lab_workflow_status"], "Report Uploaded")

        # Check audit logs in overview and via /api/logs
        res_logs = self.client.get("/api/logs?q=Report")
        self.assertEqual(res_logs.status_code, 200, "Step 15: Admin can query audit logs")
        logs = res_logs.get_json()["logs"]
        report_log_actions = [l["action"] for l in logs]
        self.assertTrue(
            any("Report" in act or "AI Lab Report" in act for act in report_log_actions),
            f"Step 15: Report generation/upload action must appear in audit logs. Got: {report_log_actions}"
        )

        self._logout()

        # -------------------------------------------------------------
        # STEP 16: Verify cross-patient access by Patient B returns 403 Forbidden
        # -------------------------------------------------------------
        res_login_patient_b = self._login("eleanor.vance@careai.com", "PatientB@1234")
        self.assertEqual(res_login_patient_b.status_code, 200)

        res_b_download_a = self.client.get(f"/api/reports/{report_id}/download")
        self.assertIn(
            res_b_download_a.status_code,
            [403, 404],
            "Step 16: Cross-patient access by Patient B to Patient A's report must be blocked (403/404)"
        )

        self._logout()

        # -------------------------------------------------------------
        # STEP 17: Verify unauthorized Doctor access returns 403, unauthenticated returns 401, no duplicates
        # -------------------------------------------------------------
        # 17a. Unauthenticated access returns 401
        res_anon = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(res_anon.status_code, 401, "Step 17: Unauthenticated request must return 401 Unauthorized")

        # 17b. Unauthorized doctor (not assigned to patient) returns 403
        self._login("external.doc@clinic.org", "Doctor@1234")
        res_unauth_doc = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(res_unauth_doc.status_code, 403, "Step 17: Doctor not assigned to patient must be blocked with 403")
        self._logout()

        # 17c. Duplicate prevention check
        self._login("neha.labtech@clinic.org", "LabTech@1234")
        # Immediately re-saving the same results triggers idempotency check
        res_put_again = self.client.put(f"/api/patients/{self.patient_a_id}", json=lab_update_payload)
        self.assertEqual(res_put_again.status_code, 200)
        with self.app.app_context():
            total_reports = Report.query.filter_by(patient_id=self.patient_a_id).count()
            self.assertEqual(total_reports, 1, "Step 17: Duplicate report generation must be prevented")

    def test_pdf_failure_preserves_lab_results_and_does_not_mark_status(self):
        """
        Verify that if automatic PDF generation fails, the saved laboratory values are preserved,
        no orphan report is committed, and status is NOT marked as 'Report Uploaded'.
        """
        self._login("neha.labtech@clinic.org", "LabTech@1234")

        with patch("app.api.routes.generate_clinical_patient_report_pdf", side_effect=RuntimeError("Simulated ReportLab Engine Failure")):
            payload = {
                "bilirubin": 4.5,
                "albumin": 2.8,
                "sgot": 110.0,
                "sgpt": 125.0,
            }
            res = self.client.put(f"/api/patients/{self.patient_b_id}", json=payload)
            self.assertEqual(res.status_code, 200)
            res_data = res.get_json()
            self.assertIn("report_error", res_data)

        with self.app.app_context():
            p = db.session.get(Patient, self.patient_b_id)
            # Biomarkers must be safely saved!
            self.assertEqual(p.bilirubin, 4.5)
            self.assertEqual(p.albumin, 2.8)
            self.assertEqual(p.sgot, 110.0)
            self.assertEqual(p.sgpt, 125.0)

            # Status must NOT be marked as 'Report Uploaded'
            self.assertNotEqual(p.lab_workflow_status, "Report Uploaded")
            self.assertNotEqual(p.treatment_status, "Report Uploaded")

            # No orphan report record
            reports = Report.query.filter_by(patient_id=self.patient_b_id).all()
            self.assertEqual(len(reports), 0)


if __name__ == "__main__":
    unittest.main()
