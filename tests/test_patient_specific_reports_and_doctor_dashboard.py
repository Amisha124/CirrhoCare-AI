import os
import re
import unittest
from pathlib import Path
from app import create_app
from app.models import db
from app.models.user import User
from app.models.patient import Patient
from app.models.report import Report
from app.models.prescription import Prescription
from app.utils.demo_reports import generate_clinical_patient_report_pdf


class TestPatientSpecificReportsAndDoctorDashboard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["CIRRHOCARE_ENVIRONMENT"] = "development"
        cls.app = create_app("development")
        cls.app.config["TESTING"] = True
        cls.app.config["WTF_CSRF_ENABLED"] = False
        cls.client = cls.app.test_client()

    def login(self, identifier, password):
        return self.client.post(
            "/api/auth/login",
            json={"identifier": identifier, "password": password},
        )

    def login_patient(self, name, portal_id):
        return self.client.post(
            "/api/auth/patient-login",
            json={"name": name, "portal_id": portal_id},
        )

    # =========================================================================
    # 1. Patient-Specific Lab Report Integrity Tests
    # =========================================================================

    def test_motu_yadav_report_contains_correct_patient_data_and_biomarkers(self):
        """Motu Yadav report must contain Motu Yadav's data, actual biomarkers, and zero Demo Patient text."""
        with self.app.app_context():
            p5 = db.session.get(Patient, 5)
            self.assertIsNotNone(p5)
            self.assertEqual(p5.portal_id, "CC-2026-8634")
            self.assertIn("motu", p5.full_name.lower())

            r4 = db.session.get(Report, 4)
            self.assertIsNotNone(r4)
            self.assertEqual(r4.patient_id, 5)

            demo_dir = Path(self.app.config.get("DEMO_UPLOAD_FOLDER", Path(self.app.instance_path) / "demo_uploads"))
            pdf_path = demo_dir / r4.filename
            self.assertTrue(pdf_path.exists(), f"File {pdf_path} must exist on disk.")

            with open(pdf_path, "rb") as f:
                content = f.read()

            self.assertTrue(content.startswith(b"%PDF-"), "Must be a valid PDF file.")
            # Zero Demo Patient
            self.assertNotIn(b"Demo Patient", content)
            self.assertNotIn(b"PAT-1001", content)
            # Patient identity
            self.assertIn(b"motu yadav", content)
            self.assertIn(b"CC-2026-8634", content)
            # Actual biomarkers
            self.assertIn(b"Total Bilirubin", content)
            self.assertIn(b"Direct Bilirubin", content)
            self.assertIn(b"Not entered", content)

    def test_anil_kapoor_report_contains_correct_patient_data_and_biomarkers(self):
        """Anil Kapoor report must contain Anil Kapoor's data, valid PDF bytes, and correct biomarkers."""
        with self.app.app_context():
            p6 = db.session.get(Patient, 6)
            self.assertIsNotNone(p6)
            self.assertEqual(p6.portal_id, "CC-2026-7780")
            self.assertIn("anil", p6.full_name.lower())

            r5 = db.session.get(Report, 5)
            self.assertIsNotNone(r5)
            self.assertEqual(r5.patient_id, 6)

            demo_dir = Path(self.app.config.get("DEMO_UPLOAD_FOLDER", Path(self.app.instance_path) / "demo_uploads"))
            pdf_path = demo_dir / r5.filename
            self.assertTrue(pdf_path.exists(), f"File {pdf_path} must exist on disk.")

            with open(pdf_path, "rb") as f:
                content = f.read()

            self.assertTrue(content.startswith(b"%PDF-"))
            self.assertGreater(len(content), 1000, "Must be a fully generated PDF, not a 47-byte mock.")
            self.assertNotIn(b"Demo Patient", content)
            self.assertNotIn(b"PAT-1001", content)
            self.assertIn(b"Anil Kapoor", content)
            self.assertIn(b"CC-2026-7780", content)

    def test_motu_yadav_can_download_own_report_successfully(self):
        """Motu Yadav (CC-2026-8634) logs in and downloads his own Report 4."""
        login_res = self.login_patient("motu yadav", "CC-2026-8634")
        self.assertEqual(login_res.status_code, 200, "Patient login for Motu Yadav (CC-2026-8634) must succeed.")

        # Download own report (Report ID 4)
        download_res = self.client.get("/api/reports/4/download?inline=true")
        self.assertEqual(download_res.status_code, 200)
        self.assertIn("application/pdf", download_res.headers.get("Content-Type", ""))
        self.assertTrue(download_res.data.startswith(b"%PDF-"))
        self.assertIn(b"motu yadav", download_res.data)
        self.assertIn(b"CC-2026-8634", download_res.data)
        self.assertNotIn(b"Demo Patient", download_res.data)

    def test_same_name_different_patient_id_isolation(self):
        """Motu Yadav #1 (CC-2026-3292) CANNOT access Motu Yadav #2 (CC-2026-8634) Report 4."""
        # Log in as Motu Yadav (Patient ID 4, CC-2026-3292)
        login_res = self.login_patient("motu yadav", "CC-2026-3292")
        self.assertEqual(login_res.status_code, 200)

        # Attempt to access Report 4 (which belongs to Patient ID 5, CC-2026-8634)
        denied_res = self.client.get("/api/reports/4/download?inline=true")
        self.assertEqual(denied_res.status_code, 403, "Access to another patient's report must be rejected with 403 Forbidden.")

    def test_cross_patient_report_access_blocked(self):
        """Anil Kapoor (CC-2026-7780) cannot access Motu Yadav's report (Report 4)."""
        login_res = self.login_patient("Anil Kapoor", "CC-2026-7780")
        self.assertEqual(login_res.status_code, 200)

        denied_res = self.client.get("/api/reports/4/download?inline=true")
        self.assertEqual(denied_res.status_code, 403)

    def test_corrupt_file_handling_returns_422_clinical_notice(self):
        """Corrupt files return HTTP 422 with clear clinical notice and preserve DB record."""
        with self.app.app_context():
            # Create a mock report pointing to a < 50 byte corrupt stub for testing
            p6 = db.session.get(Patient, 6)
            corrupt_filename = "corrupt_test_report_stub.pdf"
            demo_dir = Path(self.app.config.get("DEMO_UPLOAD_FOLDER", Path(self.app.instance_path) / "demo_uploads"))
            corrupt_path = demo_dir / corrupt_filename
            with open(corrupt_path, "wb") as f:
                f.write(b"%PDF-1.4 stub")  # 13 bytes, corrupt

            temp_report = Report(
                patient_id=p6.id,
                filename=corrupt_filename,
                original_filename="corrupt_test.pdf",
                category="Lab report",
            )
            db.session.add(temp_report)
            db.session.commit()
            temp_rep_id = temp_report.id

        # Log in as doctor to inspect
        login_res = self.login("demo.doctor@cirrhocare.org", "DemoDoctor@123")
        self.assertEqual(login_res.status_code, 200, "Doctor login must succeed.")
        res = self.client.get(f"/api/reports/{temp_rep_id}/download?inline=true")
        self.assertEqual(res.status_code, 422)
        json_data = res.get_json()
        self.assertIn("incomplete or corrupt", json_data.get("error", "").lower())
        self.assertIn("database record is preserved", json_data.get("error", "").lower())

        # Clean up temporary test report record and file
        with self.app.app_context():
            rep = db.session.get(Report, temp_rep_id)
            if rep:
                db.session.delete(rep)
                db.session.commit()
        if corrupt_path.exists():
            corrupt_path.unlink()

    # =========================================================================
    # 2. Doctor Dashboard Prescription & Diet Plan Section Tests
    # =========================================================================

    def test_doctor_can_prescribe_multi_medicines_for_patient(self):
        """Doctor prescribes multiple medicines for patient; medicines are saved and isolated."""
        login_res = self.login("demo.doctor@cirrhocare.org", "DemoDoctor@123")
        self.assertEqual(login_res.status_code, 200)

        medicines_payload = [
            {
                "medicine": "Ursodeoxycholic Acid",
                "dosage": "300mg",
                "frequency": "Twice daily",
                "duration": "30 days",
                "instructions": "Take after meals",
            },
            {
                "medicine": "Spironolactone",
                "dosage": "50mg",
                "frequency": "Once daily (Morning)",
                "duration": "14 days",
                "instructions": "Take with breakfast",
            },
        ]

        # Prescribe for Patient 6 (Anil Kapoor)
        res = self.client.post(
            "/api/prescriptions",
            json={
                "patient_id": 6,
                "medicines": medicines_payload,
                "clinical_notes": "Maintain strict low-sodium regimen and record daily morning weight.",
                "treatment_status": "Under treatment",
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data.get("success"))

        # Verify prescription list for Patient 6
        rx_res = self.client.get("/api/prescriptions?patient_id=6")
        self.assertEqual(rx_res.status_code, 200)
        rx_data = rx_res.get_json()
        self.assertTrue(rx_data.get("success"))
        rxs = rx_data.get("prescriptions", [])
        med_names = [r["medicine"] for r in rxs]
        self.assertIn("Ursodeoxycholic Acid", med_names)
        self.assertIn("Spironolactone", med_names)

        # Verify prescriptions for Patient 5 do NOT contain these new Patient 6 prescriptions
        rx5_res = self.client.get("/api/prescriptions?patient_id=5")
        self.assertEqual(rx5_res.status_code, 200)
        rx5_data = rx5_res.get_json()
        rx5_meds = [r["medicine"] for r in rx5_data.get("prescriptions", [])]
        self.assertNotIn("Spironolactone", rx5_meds)

    def test_doctor_can_save_diet_plan_and_care_advice(self):
        """Doctor saves diet plan and care instructions; patient record updates without overwriting others."""
        login_res = self.login("demo.doctor@cirrhocare.org", "DemoDoctor@123")
        self.assertEqual(login_res.status_code, 200)

        advice_payload = {
            "diet_plan": "Recommended: Boiled vegetables, oats, steamed fish\n\nAvoid: Alcohol, salt over 2g, canned soups\n\nMeals: 4 small meals daily",
            "care_instructions": "Rest: 30 min gentle walk, 8h sleep\n\nCare: Check weight daily at 8 AM",
            "follow_up_date": "2026-11-28",
            "treatment_status": "Under treatment",
        }

        # Save advice for Patient 6 (Anil Kapoor)
        res = self.client.post("/api/patients/6/advice", json=advice_payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))

        # Verify Patient 6 record in DB
        with self.app.app_context():
            p6 = db.session.get(Patient, 6)
            self.assertIn("Boiled vegetables", p6.diet_plan or "")
            self.assertIn("Alcohol", p6.diet_plan or "")
            self.assertIn("30 min gentle walk", p6.care_instructions or "")
            self.assertEqual(str(p6.follow_up_date), "2026-11-28")

            # Verify Patient 5 record was NOT overwritten
            p5 = db.session.get(Patient, 5)
            self.assertNotEqual(p5.diet_plan, p6.diet_plan)

    def test_patient_portal_dashboard_reflects_saved_prescriptions_and_advice(self):
        """Patient logs in to portal and sees their exact prescriptions and diet/care advice."""
        # Ensure doctor saves advice first
        self.login("demo.doctor@cirrhocare.org", "DemoDoctor@123")
        self.client.post("/api/patients/6/advice", json={
            "diet_plan": "Recommended: Boiled vegetables, oats, steamed fish\n\nAvoid: Alcohol\n\nMeals: 4 small meals",
            "care_instructions": "Rest: 30 min gentle walk\n\nCare: Daily monitoring",
            "follow_up_date": "2026-11-28",
            "treatment_status": "Under treatment",
        })

        login_res = self.login_patient("Anil Kapoor", "CC-2026-7780")
        self.assertEqual(login_res.status_code, 200)

        dash_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.get_json()
        self.assertEqual(dash_data.get("role"), "patient")
        latest = dash_data.get("latest_record")
        self.assertIsNotNone(latest)
        self.assertEqual(latest.get("portal_id"), "CC-2026-7780")
        self.assertIn("Boiled vegetables", latest.get("diet_plan") or "")
        self.assertIn("30 min gentle walk", latest.get("care_instructions") or "")
        self.assertEqual(latest.get("follow_up_date"), "2026-11-28")

        # Verify biomarkers are present
        self.assertEqual(latest.get("bilirubin"), 1.6)
        self.assertEqual(latest.get("direct_bilirubin"), 0.5)
        self.assertEqual(latest.get("albumin"), 3.7)
        self.assertEqual(latest.get("sgot"), 48.0)
        self.assertEqual(latest.get("sgpt"), 52.0)
        self.assertEqual(latest.get("platelets"), 190.0)
        self.assertEqual(latest.get("prothrombin"), 13.8)
        self.assertEqual(latest.get("alk_phos"), 115.0)


if __name__ == "__main__":
    unittest.main()
