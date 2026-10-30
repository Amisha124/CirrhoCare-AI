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


class LabTechAutoPdfAndRedesignTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_lab_auto_pdf.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name
        self.temp_upload_dir = tempfile.mkdtemp(prefix="lab_auto_pdf_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "labtech-auto-pdf-test-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "labtech-auto-pdf-test-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            self.labtech = User(name="Neha Verma", email="neha.lab@clinic.org", role="labtech")
            self.labtech.set_password("LabTech@1234")

            self.doctor = User(name="Dr. Sharma", email="sharma.doc@clinic.org", role="hepatologist")
            self.doctor.set_password("Doctor@1234")

            self.patient_user = User(name="Patient Portal User", email="patient@careai.com", role="patient")
            self.patient_user.set_password("Patient@1234")

            self.test_patient = Patient(
                full_name="Aisha Patel",
                age=44,
                gender="Female",
                portal_id="PAT-1008",
                phone="+91-9876543210",
                bilirubin=1.8,
                albumin=3.6,
                sgot=48.0,
                sgpt=52.0,
                platelets=220.0,
                treatment_status="Registered",
                lab_workflow_status="Registered",
                assigned_doctor_id=self.doctor.id,
            )

            db.session.add_all([self.labtech, self.doctor, self.patient_user, self.test_patient])
            db.session.commit()
            self.patient_id = self.test_patient.id

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

    def test_01_labtech_dashboard_stats_structure(self):
        """Verify GET /api/dashboard/stats returns all rich metrics matching reference screenshot."""
        self._login("neha.lab@clinic.org", "LabTech@1234")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["role"], "labtech")

        stats = data["stats"]
        self.assertIn("total_patients", stats)
        self.assertIn("new_patients_this_week", stats)
        self.assertIn("tests_completed", stats)
        self.assertIn("tests_in_progress", stats)
        self.assertIn("reports_uploaded", stats)
        self.assertIn("total_tests", stats)
        self.assertIn("breakdown", stats)
        self.assertIn("completed", stats["breakdown"])
        self.assertIn("in_progress", stats["breakdown"])
        self.assertIn("report_uploaded", stats["breakdown"])

        # Check recent activities timeline array
        self.assertIn("recent_activities", data)
        self.assertIsInstance(data["recent_activities"], list)
        self._logout()

    def test_02_automatic_pdf_generation_on_save_test_results(self):
        """Verify that updating test results automatically compiles PDF report, updates status and saves Report record."""
        self._login("neha.lab@clinic.org", "LabTech@1234")

        payload = {
            "bilirubin": 2.5,
            "direct_bilirubin": 0.8,
            "albumin": 3.4,
            "sgot_ast": 65.0,
            "sgpt_alt": 70.0,
            "platelets": 180.0,
            "prothrombin": 12.5,
            "alk_phos": 110.0,
        }

        res = self.client.put(f"/api/patients/{self.patient_id}", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["message"], "Laboratory results saved and AI-assisted report generated successfully.")
        self.assertIn("report", data)
        self.assertIsNotNone(data["report"])

        report_id = data["report"]["id"]
        report_filename = data["report"]["filename"]
        self.assertTrue(report_filename.endswith(".pdf"))

        # Verify patient status is advanced to Report Uploaded
        self.assertEqual(data["patient"]["lab_workflow_status"], "Report Uploaded")

        # Verify that the PDF is downloadable and valid
        dl_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.content_type, "application/pdf")
        self.assertTrue(dl_res.data.startswith(b"%PDF"))
        self.assertGreater(len(dl_res.data), 1000)

        self._logout()

    def test_03_dedicated_report_generate_endpoint_and_duplicate_prevention(self):
        """Verify POST /api/patients/<id>/generate-report and 10s duplicate protection."""
        self._login("neha.lab@clinic.org", "LabTech@1234")

        # Call 1: generates report
        res1 = self.client.post(f"/api/patients/{self.patient_id}/generate-report")
        self.assertEqual(res1.status_code, 200)
        d1 = res1.get_json()
        self.assertTrue(d1["success"])
        r1_id = d1["report"]["id"]

        # Call 2 (immediate rapid duplicate within 10s): returns existing report without creating duplicate
        res2 = self.client.post(f"/api/patients/{self.patient_id}/generate-report")
        self.assertEqual(res2.status_code, 200)
        d2 = res2.get_json()
        self.assertTrue(d2["success"])
        r2_id = d2["report"]["id"]
        self.assertEqual(r1_id, r2_id)
        self.assertIn("recently generated", d2["message"])

        self._logout()

    def test_04_rbac_patient_cannot_generate_lab_report(self):
        """Verify role protection: patient cannot call /api/patients/<id>/generate-report."""
        self._login("patient@careai.com", "Patient@1234")
        res = self.client.post(f"/api/patients/{self.patient_id}/generate-report")
        self.assertIn(res.status_code, (403, 401))
        self._logout()


if __name__ == "__main__":
    unittest.main()

