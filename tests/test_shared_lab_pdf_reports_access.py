import os
import shutil
import tempfile
import unittest
from datetime import datetime

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class SharedLabPdfReportsAccessTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_shared_pdf.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name
        self.temp_upload_dir = tempfile.mkdtemp(prefix="shared_pdf_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "shared-lab-pdf-access-test-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "shared-lab-pdf-access-test-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # 1. Staff users
            self.labtech = User(name="Neha Verma", email="neha.labtech@clinic.org", role="labtech")
            self.labtech.set_password("LabTech@1234")

            self.doctor_a = User(name="Dr. Raj Sharma", email="raj.sharma@clinic.org", role="hepatologist")
            self.doctor_a.set_password("Doctor@1234")

            self.doctor_b = User(name="Dr. Priya Mehta", email="priya.mehta@clinic.org", role="hepatologist")
            self.doctor_b.set_password("Doctor@1234")

            # 2. Patient A (Assigned to Doctor A)
            self.patient_a = Patient(
                full_name="Aisha Patel",
                age=44,
                gender="Female",
                portal_id="PAT-1008",
                phone="+91-9876543210",
                email="aisha.patel@careai.com",
                bilirubin=1.8,
                albumin=3.6,
                sgot=48.0,
                sgpt=52.0,
                platelets=220.0,
                treatment_status="Registered",
                lab_workflow_status="Registered",
                assigned_doctor_id=None,  # will set after doc created
            )

            # 3. Patient B (Different patient)
            self.patient_b = Patient(
                full_name="Eleanor Vance",
                age=58,
                gender="Female",
                portal_id="PAT-1001",
                phone="+91-9123456789",
                email="eleanor.vance@careai.com",
                bilirubin=1.2,
                albumin=4.0,
                sgot=25.0,
                sgpt=28.0,
                platelets=250.0,
                treatment_status="Registered",
                lab_workflow_status="Registered",
                assigned_doctor_id=None,
            )

            # 4. Patient User Accounts
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
                self.labtech,
                self.doctor_a,
                self.doctor_b,
                self.patient_a,
                self.patient_b,
                self.patient_user_a,
                self.patient_user_b,
            ])
            db.session.commit()

            # Assign Patient A to Doctor A, Patient B to Doctor B
            self.patient_a.assigned_doctor_id = self.doctor_a.id
            self.patient_b.assigned_doctor_id = self.doctor_b.id
            db.session.commit()

            self.patient_a_id = self.patient_a.id
            self.patient_b_id = self.patient_b.id
            self.doc_a_id = self.doctor_a.id
            self.doc_b_id = self.doctor_b.id

    def tearDown(self):
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except OSError:
            pass
        try:
            shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
        except OSError:
            pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _logout(self):
        return self.client.post("/api/auth/logout")

    def test_shared_pdf_access_across_labtech_doctor_patient(self):
        """
        Verify the complete unified clinical report access flow:
        1. Labtech enters results -> single PDF generated & Report record created.
        2. Labtech views & downloads PDF.
        3. Doctor views & downloads the exact same PDF without duplicate generation.
        4. Patient views & downloads own PDF from Patient Dashboard.
        5. Cross-patient isolation prevents other patients from accessing it.
        6. Doctor isolation prevents unauthorized doctors from accessing it.
        7. Unauthenticated access is rejected.
        8. Report count in database remains exactly 1.
        """
        # =====================================================================
        # STEP 1: Lab Technician Enters Results -> Auto PDF Generated
        # =====================================================================
        self._login("neha.labtech@clinic.org", "LabTech@1234")

        payload = {
            "bilirubin": 2.8,
            "direct_bilirubin": 1.1,
            "albumin": 3.2,
            "sgot_ast": 68.0,
            "sgpt_alt": 74.0,
            "platelets": 175.0,
            "prothrombin": 13.0,
            "alk_phos": 125.0,
        }

        put_res = self.client.put(f"/api/patients/{self.patient_a_id}", json=payload)
        self.assertEqual(put_res.status_code, 200)
        put_data = put_res.get_json()
        self.assertTrue(put_data["success"])
        self.assertIn("report", put_data)
        self.assertIsNotNone(put_data["report"])

        report_id = put_data["report"]["id"]
        report_filename = put_data["report"]["filename"]
        self.assertTrue(report_filename.endswith(".pdf"))

        # Verify only 1 report exists in DB
        with self.app.app_context():
            reports = Report.query.filter_by(patient_id=self.patient_a_id).all()
            self.assertEqual(len(reports), 1)

        # Labtech downloads the report
        lab_dl_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(lab_dl_res.status_code, 200)
        self.assertEqual(lab_dl_res.content_type, "application/pdf")
        labtech_pdf_bytes = lab_dl_res.data
        self.assertTrue(labtech_pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(labtech_pdf_bytes), 1000)

        # Labtech also verifies GET /api/patients/<id>/reports
        lab_reports_res = self.client.get(f"/api/patients/{self.patient_a_id}/reports")
        self.assertEqual(lab_reports_res.status_code, 200)
        self.assertEqual(len(lab_reports_res.get_json()["reports"]), 1)
        self.assertEqual(lab_reports_res.get_json()["reports"][0]["id"], report_id)

        self._logout()

        # =====================================================================
        # STEP 2: Doctor Views and Downloads the Exact Same PDF
        # =====================================================================
        self._login("raj.sharma@clinic.org", "Doctor@1234")

        # Doctor queries patient's reports via reports listing
        doc_rep_res = self.client.get(f"/api/reports?patient_id={self.patient_a_id}")
        self.assertEqual(doc_rep_res.status_code, 200)
        doc_rep_data = doc_rep_res.get_json()
        self.assertTrue(doc_rep_data["success"])
        self.assertEqual(len(doc_rep_data["reports"]), 1)
        self.assertEqual(doc_rep_data["reports"][0]["id"], report_id)

        # Doctor queries via dedicated patient reports endpoint
        doc_pt_reports = self.client.get(f"/api/patients/{self.patient_a_id}/reports")
        self.assertEqual(doc_pt_reports.status_code, 200)
        self.assertEqual(doc_pt_reports.get_json()["reports"][0]["id"], report_id)

        # Doctor downloads the exact same PDF
        doc_dl_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(doc_dl_res.status_code, 200)
        self.assertEqual(doc_dl_res.content_type, "application/pdf")
        doctor_pdf_bytes = doc_dl_res.data

        # Doctor gets the EXACT same file content that was stored on disk
        self.assertEqual(doctor_pdf_bytes, labtech_pdf_bytes)

        # Confirm no duplicate report records were created
        with self.app.app_context():
            reports = Report.query.filter_by(patient_id=self.patient_a_id).all()
            self.assertEqual(len(reports), 1)

        self._logout()

        # =====================================================================
        # STEP 3: Patient A Views and Downloads Own PDF
        # =====================================================================
        self._login("aisha.patel@careai.com", "PatientA@1234")

        # Patient queries dashboard stats
        dash_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.get_json()
        self.assertTrue(dash_data["success"])

        # Check latest_record reports
        self.assertIn("latest_record", dash_data)
        self.assertIsNotNone(dash_data["latest_record"])
        pt_reports = dash_data["latest_record"].get("reports", [])
        self.assertGreaterEqual(len(pt_reports), 1)
        self.assertEqual(pt_reports[0]["id"], report_id)

        # Patient queries /api/reports
        patient_reports_res = self.client.get("/api/reports")
        self.assertEqual(patient_reports_res.status_code, 200)
        p_reps = patient_reports_res.get_json()["reports"]
        self.assertGreaterEqual(len(p_reps), 1)
        self.assertEqual(p_reps[0]["id"], report_id)

        # Patient downloads own PDF
        patient_dl_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(patient_dl_res.status_code, 200)
        self.assertEqual(patient_dl_res.content_type, "application/pdf")
        patient_pdf_bytes = patient_dl_res.data

        # Patient gets the EXACT same file content
        self.assertEqual(patient_pdf_bytes, labtech_pdf_bytes)

        # Confirm still exactly 1 Report record in DB
        with self.app.app_context():
            reports = Report.query.filter_by(patient_id=self.patient_a_id).all()
            self.assertEqual(len(reports), 1)

        self._logout()

        # =====================================================================
        # STEP 4: Cross-Patient Isolation (Patient B Cannot Access Patient A's Report)
        # =====================================================================
        self._login("eleanor.vance@careai.com", "PatientB@1234")

        # Patient B's report list must NOT include Patient A's report
        p_b_reports = self.client.get("/api/reports").get_json()["reports"]
        p_b_rep_ids = [r["id"] for r in p_b_reports]
        self.assertNotIn(report_id, p_b_rep_ids)

        # Patient B directly attempts to download Patient A's report -> 403 Forbidden
        cross_dl = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(cross_dl.status_code, 403)

        # Patient B tries to query Patient A's reports -> 403 Forbidden
        cross_query = self.client.get(f"/api/reports?patient_id={self.patient_a_id}")
        self.assertEqual(cross_query.status_code, 403)

        cross_pt_query = self.client.get(f"/api/patients/{self.patient_a_id}/reports")
        self.assertEqual(cross_pt_query.status_code, 403)

        self._logout()

        # =====================================================================
        # STEP 5: Doctor Isolation (Unauthorized Doctor Cannot Download Other Doctor's Patient Report)
        # =====================================================================
        self._login("priya.mehta@clinic.org", "Doctor@1234")

        # Doctor B is assigned exclusively to Patient B; Patient A is assigned to Doctor A
        doc_b_cross = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(doc_b_cross.status_code, 403)

        doc_b_query = self.client.get(f"/api/patients/{self.patient_a_id}/reports")
        self.assertEqual(doc_b_query.status_code, 403)

        self._logout()

        # =====================================================================
        # STEP 6: Unauthenticated Download Rejected
        # =====================================================================
        anon_dl = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(anon_dl.status_code, 401)

        # =====================================================================
        # STEP 7: Verify Exactly 1 File and 1 Record Persist
        # =====================================================================
        with self.app.app_context():
            all_reports = Report.query.all()
            self.assertEqual(len(all_reports), 1)

        upload_files = [f for f in os.listdir(self.temp_upload_dir) if f.endswith(".pdf")]
        self.assertEqual(len(upload_files), 1)


if __name__ == "__main__":
    unittest.main()

