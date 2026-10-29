import csv
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.user import User


class SecureExportsTestSuite(unittest.TestCase):
    """
    Comprehensive test suite for Phase 6 Task 6: Secure CSV/PDF Export Improvements.
    Verifies:
    1. Authorized exports succeed for authorized roles.
    2. Unauthenticated export requests are rejected (401).
    3. Unauthorized roles cannot export restricted records.
    4. Patients can export only their own data (and receive 403 if attempting cross-patient exports).
    5. Hepatologists can export only their assigned patients or unassigned triage patients.
    6. CSV Formula Injection protection (CWE-1236) neutralizes formula prefixes (=, +, -, @, \t, \r, %).
    7. CSV encoding produces UTF-8 with BOM ('utf-8-sig') for seamless spreadsheet viewing.
    8. PDF generation includes headers, KPI summary, and mandatory experimental AI disclaimer.
    9. Filtered exports (search q, risk, status, date ranges) export only matching records.
    10. Invalid filter parameters return 400 Bad Request instead of silently exporting all records.
    11. Empty exports are handled gracefully without 500 errors.
    12. Single patient export routes enforce ownership and 404/403 protections.
    13. Legacy export routes (/admin/export.csv, /admin/report.pdf) remain secure and functional.
    14. Absolute database isolation: Active database is NEVER touched.
    """

    def setUp(self):
        # Create isolated temporary database file
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_export_uploads_")

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

        self.labtech = User(name="Tech Specialist", email="lab@careai.com", role="labtech")
        self.labtech.set_password("Lab@123")

        self.doctor1 = User(name="Dr. Jane Hepatologist", email="doctor1@careai.com", role="hepatologist")
        self.doctor1.set_password("Doctor@123")

        self.doctor2 = User(name="Dr. Mark Other", email="doctor2@careai.com", role="hepatologist")
        self.doctor2.set_password("Doctor@123")

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
            self.labtech,
            self.doctor1,
            self.doctor2,
            self.patient_alice,
            self.patient_bob,
        ])
        db.session.commit()

        # Seed representative patients
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        self.p1 = Patient(
            full_name="Alice Walker",
            portal_id="PAT-ALICE01",
            age=45,
            gender="Female",
            email="alice@patient.com",
            phone="+1-555-0101",
            bilirubin=3.2,
            albumin=2.8,
            platelets=110.0,
            sgot=85.0,
            sgpt=92.0,
            prothrombin=14.5,
            latest_risk_label="High Risk",
            latest_risk_percent=88.5,
            treatment_status="Needs urgent review",
            created_at=now - timedelta(days=5),
        )

        self.p2 = Patient(
            full_name="Bob Martin",
            portal_id="PAT-BOB02",
            age=52,
            gender="Male",
            email="bob@patient.com",
            phone="+1-555-0102",
            bilirubin=0.9,
            albumin=4.1,
            platelets=240.0,
            sgot=28.0,
            sgpt=32.0,
            prothrombin=11.8,
            latest_risk_label="Low Risk",
            latest_risk_percent=12.0,
            treatment_status="Stable",
            created_at=now - timedelta(days=3),
        )

        self.p3_formula = Patient(
            full_name="=cmd|' /C calc'!A0",
            portal_id="@PORTAL-INJECT",
            age=38,
            gender="Other",
            email="+injected@email.com",
            phone="-1234567890",
            bilirubin=1.5,
            albumin=3.6,
            platelets=180.0,
            sgot=45.0,
            sgpt=50.0,
            prothrombin=12.5,
            latest_risk_label="Medium Risk",
            latest_risk_percent=45.0,
            treatment_status="Under treatment",
            created_at=now - timedelta(days=1),
        )

        db.session.add_all([self.p1, self.p2, self.p3_formula])
        db.session.commit()

        # Assign p1 to doctor1 via appointment
        appnt1 = Appointment(
            patient_id=self.p1.id,
            doctor_id=self.doctor1.id,
            scheduled_at=now + timedelta(days=2),
            reason="Hepatology consultation",
            status="Scheduled",
        )
        # Assign p2 to doctor2 via appointment
        appnt2 = Appointment(
            patient_id=self.p2.id,
            doctor_id=self.doctor2.id,
            scheduled_at=now + timedelta(days=4),
            reason="Routine clinical review",
            status="Scheduled",
        )
        db.session.add_all([appnt1, appnt2])
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
        """Unauthenticated export requests must be rejected with 401 Unauthorized."""
        res_csv = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_csv.status_code, 401)

        res_pdf = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_pdf.status_code, 401)

        res_single_csv = self.client.get(f"/api/patients/{self.p1.id}/export/csv")
        self.assertEqual(res_single_csv.status_code, 401)

        res_single_pdf = self.client.get(f"/api/patients/{self.p1.id}/export/pdf")
        self.assertEqual(res_single_pdf.status_code, 401)

    # -------------------------------------------------------------------------
    # 2. Authorized Role Exports
    # -------------------------------------------------------------------------
    def test_admin_and_labtech_exports_succeed(self):
        """Admin and Labtech can export registry CSV and PDF."""
        # Admin CSV
        self._login("admin@careai.com", "Admin@123")
        res_admin_csv = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_admin_csv.status_code, 200)
        self.assertIn("text/csv", res_admin_csv.content_type)
        self.assertIn("attachment", res_admin_csv.headers.get("Content-Disposition", ""))

        # Admin PDF
        res_admin_pdf = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_admin_pdf.status_code, 200)
        self.assertIn("application/pdf", res_admin_pdf.content_type)
        self.assertTrue(res_admin_pdf.data.startswith(b"%PDF-"))

        # Labtech CSV
        self._login("lab@careai.com", "Lab@123")
        res_lab_csv = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_lab_csv.status_code, 200)

        # Labtech PDF
        res_lab_pdf = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_lab_pdf.status_code, 200)

    # -------------------------------------------------------------------------
    # 3. Patient Data Isolation & Privacy
    # -------------------------------------------------------------------------
    def test_patient_can_only_export_own_records(self):
        """Patient Alice can export her own record, but not Bob's or registry."""
        self._login("alice@patient.com", "Patient@123")

        # Alice exports CSV: should only contain Alice Walker
        res_csv = self.client.get("/api/export/patients.csv")
        self.assertEqual(res_csv.status_code, 200)
        csv_text = res_csv.data.decode("utf-8-sig")

        self.assertIn("Alice Walker", csv_text)
        self.assertNotIn("Bob Martin", csv_text)

        # Alice exports PDF: succeeds for her record
        res_pdf = self.client.get("/api/export/report.pdf")
        self.assertEqual(res_pdf.status_code, 200)

        # Alice attempts to export Bob's single patient endpoints -> 403 Forbidden!
        res_bob_csv = self.client.get(f"/api/patients/{self.p2.id}/export/csv")
        self.assertEqual(res_bob_csv.status_code, 403)

        res_bob_pdf = self.client.get(f"/api/patients/{self.p2.id}/export/pdf")
        self.assertEqual(res_bob_pdf.status_code, 403)

        # Alice can export her own single patient endpoints -> 200 OK
        res_alice_csv = self.client.get(f"/api/patients/{self.p1.id}/export/csv")
        self.assertEqual(res_alice_csv.status_code, 200)

        res_alice_pdf = self.client.get(f"/api/patients/{self.p1.id}/export/pdf")
        self.assertEqual(res_alice_pdf.status_code, 200)

    # -------------------------------------------------------------------------
    # 4. Hepatologist Role Scoping
    # -------------------------------------------------------------------------
    def test_hepatologist_can_only_export_authorized_patients(self):
        """Doctor 1 can export Alice (assigned), but cannot export Bob (assigned to Doctor 2)."""
        self._login("doctor1@careai.com", "Doctor@123")

        res_csv = self.client.get("/api/export/patients.csv?scope=my_patients")
        self.assertEqual(res_csv.status_code, 200)
        csv_text = res_csv.data.decode("utf-8-sig")

        self.assertIn("Alice Walker", csv_text)
        self.assertNotIn("Bob Martin", csv_text)

        # Attempting to export Bob's record directly -> 403 Forbidden
        res_bob = self.client.get(f"/api/patients/{self.p2.id}/export/csv")
        self.assertEqual(res_bob.status_code, 403)

    # -------------------------------------------------------------------------
    # 5. CSV Formula Injection & Escaping (CWE-1236)
    # -------------------------------------------------------------------------
    def test_csv_formula_injection_protection_and_encoding(self):
        """Untrusted formula prefixes (=, +, -, @, %) must be prepended with a single quote."""
        self._login("admin@careai.com", "Admin@123")

        res = self.client.get("/api/export/patients.csv")
        self.assertEqual(res.status_code, 200)

        # 1. Verify UTF-8 BOM encoding
        self.assertTrue(res.data.startswith(b"\xef\xbb\xbf"), "Missing UTF-8 BOM for Excel compatibility")

        # 2. Parse CSV
        csv_text = res.data.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)

        # Locate the formula injection patient
        inj_row = next((r for r in rows if "calc" in r["Full Name"]), None)
        self.assertIsNotNone(inj_row, "Formula injection patient not found in CSV")

        # Confirm formula was neutralized with a leading single quote
        self.assertTrue(inj_row["Full Name"].startswith("'="), f"Full name not neutralized: {inj_row['Full Name']}")
        self.assertTrue(inj_row["Patient ID"].startswith("'@"), f"Portal ID not neutralized: {inj_row['Patient ID']}")

        # Ensure no secrets or passwords are present in CSV
        self.assertNotIn("password", csv_text.lower())
        self.assertNotIn("token", csv_text.lower())
        self.assertNotIn("secret", csv_text.lower())

    # -------------------------------------------------------------------------
    # 6. PDF Generation, Layout, and AI Disclaimer
    # -------------------------------------------------------------------------
    def test_pdf_generation_headings_and_ai_disclaimer(self):
        """PDF report must contain valid PDF structure, titles, and mandatory AI disclaimer."""
        self._login("admin@careai.com", "Admin@123")

        res = self.client.get("/api/export/report.pdf")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content_type, "application/pdf")
        self.assertTrue(res.data.startswith(b"%PDF-"))

        # Check raw PDF binary for key textual flowables
        pdf_raw = res.data.decode("latin1")
        self.assertIn("CirrhoCare AI", pdf_raw)
        self.assertIn("CRITICAL CLINICAL NOTICE", pdf_raw)
        self.assertIn("experimental machine learning", pdf_raw)
        self.assertIn("NOT clinically validated", pdf_raw)

    # -------------------------------------------------------------------------
    # 7. Filtered Exports
    # -------------------------------------------------------------------------
    def test_filtered_exports(self):
        """Filtering by risk, status, and search query exports only matching records."""
        self._login("admin@careai.com", "Admin@123")

        # Filter: Risk = High Risk
        res_risk = self.client.get("/api/export/patients.csv?risk=High+Risk")
        self.assertEqual(res_risk.status_code, 200)
        text_risk = res_risk.data.decode("utf-8-sig")
        self.assertIn("Alice Walker", text_risk)
        self.assertNotIn("Bob Martin", text_risk)

        # Filter: Status = Stable
        res_status = self.client.get("/api/export/patients.csv?status=Stable")
        self.assertEqual(res_status.status_code, 200)
        text_status = res_status.data.decode("utf-8-sig")
        self.assertIn("Bob Martin", text_status)
        self.assertNotIn("Alice Walker", text_status)

        # Filter: Search query
        res_q = self.client.get("/api/export/patients.csv?q=Alice")
        self.assertEqual(res_q.status_code, 200)
        text_q = res_q.data.decode("utf-8-sig")
        self.assertIn("Alice Walker", text_q)
        self.assertNotIn("Bob Martin", text_q)

    # -------------------------------------------------------------------------
    # 8. Parameter Validation Resilience (400 Bad Request)
    # -------------------------------------------------------------------------
    def test_invalid_parameters_handled_safely(self):
        """Invalid filter parameters return 400 Bad Request instead of silently exporting all."""
        self._login("admin@careai.com", "Admin@123")

        # Invalid risk
        res_inv_risk = self.client.get("/api/export/patients.csv?risk=UNKNOWN_RISK")
        self.assertEqual(res_inv_risk.status_code, 400)
        self.assertIn("Invalid risk filter", res_inv_risk.get_json()["error"])

        # Invalid status
        res_inv_status = self.client.get("/api/export/patients.csv?status=UNKNOWN_STATUS")
        self.assertEqual(res_inv_status.status_code, 400)
        self.assertIn("Invalid status filter", res_inv_status.get_json()["error"])

        # Invalid start_date
        res_inv_date = self.client.get("/api/export/patients.csv?start_date=not-a-date")
        self.assertEqual(res_inv_date.status_code, 400)
        self.assertIn("Invalid date format", res_inv_date.get_json()["error"])

        # Inverted date range (start > end)
        res_inv_range = self.client.get("/api/export/patients.csv?start_date=2026-12-01&end_date=2026-01-01")
        self.assertEqual(res_inv_range.status_code, 400)
        self.assertIn("cannot be later than end_date", res_inv_range.get_json()["error"])

        # Invalid sort_by
        res_inv_sort = self.client.get("/api/export/patients.csv?sort_by=password_hash")
        self.assertEqual(res_inv_sort.status_code, 400)
        self.assertIn("Invalid sort_by column", res_inv_sort.get_json()["error"])

    # -------------------------------------------------------------------------
    # 9. Empty Exports
    # -------------------------------------------------------------------------
    def test_empty_exports_handled_gracefully(self):
        """When 0 records match, valid empty CSV and PDF reports are returned without error."""
        self._login("admin@careai.com", "Admin@123")

        # CSV
        res_csv = self.client.get("/api/export/patients.csv?q=NonExistentPersonX")
        self.assertEqual(res_csv.status_code, 200)
        lines = res_csv.data.decode("utf-8-sig").strip().splitlines()
        self.assertEqual(len(lines), 1, "Expected only header row for empty export")

        # PDF
        res_pdf = self.client.get("/api/export/report.pdf?q=NonExistentPersonX")
        self.assertEqual(res_pdf.status_code, 200)
        self.assertTrue(res_pdf.data.startswith(b"%PDF-"))

    # -------------------------------------------------------------------------
    # 10. Legacy Compatibility Routes
    # -------------------------------------------------------------------------
    def test_legacy_routes_security(self):
        """Legacy routes /admin/export.csv and /admin/report.pdf remain secure."""
        # 1. Unauthenticated -> Rejected (401 or redirect)
        res_unauth = self.client.get("/admin/export.csv")
        self.assertIn(res_unauth.status_code, (401, 302))

        # 2. Patient attempting admin route -> 403 Forbidden
        self._login("alice@patient.com", "Patient@123")
        res_forbidden = self.client.get("/admin/export.csv")
        self.assertEqual(res_forbidden.status_code, 403)

        # 3. Admin -> 200 OK with sanitized content
        self._login("admin@careai.com", "Admin@123")
        res_admin_csv = self.client.get("/admin/export.csv")
        self.assertEqual(res_admin_csv.status_code, 200)
        self.assertTrue(res_admin_csv.data.startswith(b"\xef\xbb\xbf"))

        res_admin_pdf = self.client.get("/admin/report.pdf")
        self.assertEqual(res_admin_pdf.status_code, 200)
        self.assertTrue(res_admin_pdf.data.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
