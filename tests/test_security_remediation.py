import os
import sys
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from werkzeug.datastructures import FileStorage

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User
from app.utils.files import save_upload


class SecurityAndDatabaseRemediationTest(unittest.TestCase):
    """
    Focused regression test suite for Phase 5 Step 1:
    Security and Database Safety Remediation.
    Runs strictly against an isolated temporary SQLite database.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_sec_uploads_")

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.test_upload_dir,
            "EXPOSE_DEV_RESET_URL": False,  # Default safe configuration
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion: NEVER touch active instance DB
        db_uri = self.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"SAFETY VIOLATION: Test targeting {db_uri}"

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed isolated test accounts
        self.admin = User(name="Admin Supervisor", email="admin_sec@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lab Technician", email="lab_sec@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor1 = User(name="Dr. Primary Hepatologist", email="doc1_sec@careai.com", role="hepatologist")
        self.doctor1.set_password("Doctor@123")

        self.doctor2 = User(name="Dr. External Hepatologist", email="doc2_sec@careai.com", role="hepatologist")
        self.doctor2.set_password("Doctor@456")

        self.patient1 = User(name="Patient Alice", email="alice_sec@careai.com", role="patient", portal_id="PAT-5001")
        self.patient1.set_password("Patient@123")

        self.patient2 = User(name="Patient Bob", email="bob_sec@careai.com", role="patient", portal_id="PAT-5002")
        self.patient2.set_password("Patient@123")

        db.session.add_all([self.admin, self.labtech, self.doctor1, self.doctor2, self.patient1, self.patient2])
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
    # 1. AUTHENTICATION & PASSWORD RESET SECURITY
    # =========================================================================
    def test_01_forgot_password_does_not_leak_reset_token_by_default(self):
        """Verify that /api/auth/forgot-password does not return dev_reset_url when EXPOSE_DEV_RESET_URL is False."""
        res = self.client.post("/api/auth/forgot-password", json={"email": "admin_sec@careai.com"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertNotIn("dev_reset_url", data, "Security violation: dev_reset_url was leaked in API response!")

    # =========================================================================
    # 2. SQLITE FOREIGN KEY ENFORCEMENT
    # =========================================================================
    def test_02_sqlite_foreign_key_enforcement_blocks_orphans(self):
        """Verify that SQLite connection listener enforces foreign key constraints."""
        from sqlalchemy.exc import IntegrityError
        # Attempt to insert a Report referencing non-existent patient ID 99999
        orphan_report = Report(patient_id=99999, filename="orphan.pdf", original_filename="orphan.pdf")
        db.session.add(orphan_report)
        with self.assertRaises(IntegrityError):
            db.session.commit()
        db.session.rollback()

    # =========================================================================
    # 3. MEDICAL FILE CONTENT VALIDATION
    # =========================================================================
    def test_03_executable_disguised_as_pdf_is_rejected(self):
        """Verify that binary header validation rejects Windows PE/MZ executables named .pdf."""
        fake_pdf = FileStorage(
            stream=BytesIO(b"MZ\x90\x00\x03\x00\x00\x00FakeWindowsExecutablePayload"),
            filename="malicious.pdf",
            content_type="application/pdf",
        )
        with self.assertRaises(ValueError) as ctx:
            save_upload(fake_pdf)
        self.assertIn("executable or script signature", str(ctx.exception))

    def test_04_php_script_disguised_as_png_is_rejected(self):
        """Verify that binary header validation rejects PHP script disguised as image."""
        fake_png = FileStorage(
            stream=BytesIO(b"<?php echo 'system exploit'; ?>"),
            filename="shell.png",
            content_type="image/png",
        )
        with self.assertRaises(ValueError) as ctx:
            save_upload(fake_png)
        self.assertIn("executable or script signature", str(ctx.exception))

    def test_05_valid_pdf_is_accepted(self):
        """Verify that genuine PDF content passes upload validation."""
        valid_pdf = FileStorage(
            stream=BytesIO(b"%PDF-1.4 Genuine Medical Diagnostic Report Data"),
            filename="cbc_report.pdf",
            content_type="application/pdf",
        )
        saved_name, orig_name = save_upload(valid_pdf)
        self.assertEqual(orig_name, "cbc_report.pdf")
        self.assertTrue(saved_name.endswith("cbc_report.pdf"))

    # =========================================================================
    # 4. CROSS-ROLE & CROSS-DOCTOR DOWNLOAD SECURITY
    # =========================================================================
    def test_06_ssr_report_download_blocks_cross_doctor_access(self):
        """Verify that SSR route /reports/<id>/download rejects hepatologists accessing other doctors' patients."""
        # Patient assigned to Doctor 1
        p_doc1 = Patient(full_name="Patient of Doc1", portal_id="PAT-5001", age=50, gender="F", created_by_id=self.doctor1.id)
        db.session.add(p_doc1)
        db.session.commit()

        # Create dummy report file on disk
        rep_file = Path(self.test_upload_dir) / "doc1_patient_report.pdf"
        rep_file.write_bytes(b"%PDF-1.4 Doctor 1 Patient Report")

        rep = Report(patient=p_doc1, filename="doc1_patient_report.pdf", original_filename="Report.pdf")
        db.session.add(rep)
        db.session.commit()

        # Doctor 2 logs in and attempts to download Doctor 1's patient report via /reports/<id>/download
        self.login_as("doc2_sec@careai.com", "Doctor@456")
        ssr_res = self.client.get(f"/reports/{rep.id}/download")
        self.assertEqual(ssr_res.status_code, 403, "Security violation: Doctor 2 downloaded Doctor 1's patient report via SSR route")

        # REST API /api/reports/<id>/download also rejects
        api_res = self.client.get(f"/api/reports/{rep.id}/download")
        self.assertEqual(api_res.status_code, 403, "Security violation: Doctor 2 downloaded Doctor 1's patient report via REST API")

    # =========================================================================
    # 5. PRESCRIPTION ROLE AUTHORIZATION
    # =========================================================================
    def test_07_labtech_blocked_from_prescriptions_list(self):
        """Verify that lab technician cannot access clinical prescriptions list."""
        self.login_as("lab_sec@careai.com", "Lab@123")
        res = self.client.get("/api/prescriptions")
        self.assertEqual(res.status_code, 403, "Security violation: Lab tech accessed clinical prescriptions list")

    def test_08_patient_prescriptions_scoping(self):
        """Verify that patients can only view their own prescriptions."""
        p_alice = Patient(full_name="Patient Alice", portal_id="PAT-5001", email="alice_sec@careai.com", age=42, gender="F")
        p_bob = Patient(full_name="Patient Bob", portal_id="PAT-5002", email="bob_sec@careai.com", age=60, gender="M")
        db.session.add_all([p_alice, p_bob])
        db.session.commit()

        rx_alice = Prescription(patient=p_alice, doctor_id=self.doctor1.id, medicine="Spironolactone", dosage="50mg", frequency_days=30)
        rx_bob = Prescription(patient=p_bob, doctor_id=self.doctor1.id, medicine="Furosemide", dosage="40mg", frequency_days=30)
        db.session.add_all([rx_alice, rx_bob])
        db.session.commit()

        self.login_as("alice_sec@careai.com", "Patient@123")
        res = self.client.get("/api/prescriptions")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data["prescriptions"]), 1)
        self.assertEqual(data["prescriptions"][0]["id"], rx_alice.id)
        self.assertEqual(data["prescriptions"][0]["medicine"], "Spironolactone")


if __name__ == "__main__":
    unittest.main()
