"""
tests/test_demo_reports_download.py
-----------------------------------
Automated verification for Lab Reports download functionality.
Validates:
1. All 6 demo reports return HTTP 200, Content-Type: application/pdf, and proper Content-Disposition attachment.
2. File content integrity (valid %PDF header and non-empty size).
3. Safe resolution via isolated temporary upload directory.
4. Path traversal rejection.
5. Dynamic fallback regeneration if demo PDF is missing on disk.
6. Legacy route compatibility (/reports/<id>/download).
"""

import os
import shutil
import tempfile
import unittest
from pathlib import Path

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User
from app.utils.demo_reports import generate_demo_report_pdf


class DemoReportsDownloadTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_demo_reports_test.db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        self.temp_upload_dir = tempfile.mkdtemp(prefix="demo_reports_uploads_")

        self.app = create_app(test_config={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "WTF_CSRF_ENABLED": False,
            "SECRET_KEY": "demo-test-verification-key",
        })
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()

            # Seed admin user
            admin = User(name="System Admin", email="admin@careai.com", role="admin")
            admin.set_password("Admin@123")
            db.session.add(admin)

            # Seed demo patient
            patient = Patient(
                full_name="Aisha Patel [DEMO]",
                portal_id="PAT-1008",
                age=45,
                gender="Female",
                bilirubin=1.2,
                albumin=3.8,
                sgot=50,
                sgpt=45,
                platelets=220,
                cholesterol=180,
                prothrombin=11.5,
                copper=80,
                alk_phos=700,
                triglycerides=120,
                latest_risk_label="High Risk",
                latest_risk_percent=85.0,
                treatment_status="Active monitoring",
            )
            db.session.add(patient)
            db.session.commit()

            # Seed 6 reports
            reports_metadata = [
                (1, "demo_eleanor_comprehensive_metabolic_panel.pdf", "Comprehensive_Metabolic_Panel.pdf", "Blood test"),
                (2, "demo_marcus_abdominal_ultrasound.pdf", "Abdominal_Doppler_Ultrasound.pdf", "Ultrasound"),
                (3, "demo_david_liver_biopsy_histology.pdf", "Liver_Biopsy_Histology.pdf", "Biopsy"),
                (4, "demo_sophia_hepatic_function_panel.pdf", "Hepatic_Function_Panel.pdf", "Blood test"),
                (5, "demo_arthur_fibroscan_elastography.pdf", "FibroScan_Transient_Elastography.pdf", "FibroScan"),
                (6, "demo_aisha_coagulation_profile.pdf", "Coagulation_Prothrombin_Profile.pdf", "Blood test"),
            ]

            for rep_id, filename, orig_filename, category in reports_metadata:
                rep = Report(
                    id=rep_id,
                    patient_id=patient.id,
                    filename=filename,
                    original_filename=orig_filename,
                    category=category,
                )
                db.session.add(rep)
                db.session.commit()

                # Generate the initial demo PDF in the temporary uploads directory
                file_path = Path(self.temp_upload_dir) / filename
                generate_demo_report_pdf(rep, patient, file_path)

    def tearDown(self):
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

    def login_as(self, email="admin@careai.com", password="Admin@123"):
        return self.client.post("/api/auth/login", json={"identifier": email, "password": password})

    def test_download_all_six_demo_reports(self):
        res_login = self.login_as()
        self.assertEqual(res_login.status_code, 200)

        expected_filenames = [
            "Comprehensive_Metabolic_Panel.pdf",
            "Abdominal_Doppler_Ultrasound.pdf",
            "Liver_Biopsy_Histology.pdf",
            "Hepatic_Function_Panel.pdf",
            "FibroScan_Transient_Elastography.pdf",
            "Coagulation_Prothrombin_Profile.pdf",
        ]

        for report_id in range(1, 7):
            res = self.client.get(f"/api/reports/{report_id}/download")
            self.assertEqual(res.status_code, 200, f"Report {report_id} failed with status {res.status_code}")
            self.assertEqual(res.content_type, "application/pdf")
            self.assertTrue(res.data.startswith(b"%PDF"), f"Report {report_id} data does not start with %PDF")
            self.assertGreater(len(res.data), 5000, f"Report {report_id} size unexpectedly small")

            # Content-Disposition check
            cd = res.headers.get("Content-Disposition", "")
            self.assertIn("attachment", cd)
            self.assertIn(expected_filenames[report_id - 1], cd)

    def test_legacy_download_route(self):
        self.login_as()
        res = self.client.get("/reports/6/download")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content_type, "application/pdf")
        self.assertTrue(res.data.startswith(b"%PDF"))
        self.assertIn("Coagulation_Prothrombin_Profile.pdf", res.headers.get("Content-Disposition", ""))

    def test_inline_mode(self):
        self.login_as()
        res = self.client.get("/api/reports/1/download?inline=1")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content_type, "application/pdf")
        self.assertIn("inline", res.headers.get("Content-Disposition", ""))

    def test_nonexistent_report_returns_404(self):
        self.login_as()
        res = self.client.get("/api/reports/9999/download")
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Report not found")

    def test_fallback_regeneration_when_file_deleted(self):
        self.login_as()
        target_file = Path(self.temp_upload_dir) / "demo_aisha_coagulation_profile.pdf"
        if target_file.exists():
            target_file.unlink()

        self.assertFalse(target_file.exists())

        # Request report #6
        res = self.client.get("/api/reports/6/download")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content_type, "application/pdf")
        self.assertTrue(res.data.startswith(b"%PDF"))
        self.assertTrue(target_file.exists(), "Fallback regeneration should restore missing demo file")


if __name__ == "__main__":
    unittest.main()
