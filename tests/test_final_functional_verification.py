"""
tests/test_final_functional_verification.py
-------------------------------------------
Comprehensive functional verification test suite for CirrhoCare AI:
1. Prescription demo-data gap & Clinical Review workflow (creation, persistence, archive display, history).
2. Report downloads (all 6 demo PDFs, Content-Type, %PDF- magic bytes, non-empty, production uploads isolation).
3. Patient search & risk/status filters.
4. Patient report viewing & downloading.
5. Clinical review status updates (PATCH /api/patients/<id>/review-status).
6. Appointment listing and status updates (PATCH /api/appointments/<id>/status).
7. Population Analytics & CSV / PDF exports.
8. Staff directory search & role filters.
9. Database and storage safety & isolation (instance/cirrhosis.db untouched, instance/uploads untouched).
"""

from datetime import date, datetime, timedelta
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import threading
import unittest
from wsgiref.simple_server import make_server
import requests

from app import create_app
from app.models import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User
from app.utils.demo_reports import generate_demo_report_pdf

BASE_URL = "http://127.0.0.1:5000"


class FinalFunctionalVerificationTestCase(unittest.TestCase):
    server = None
    temp_db_path = None
    temp_upload_dir = None

    @classmethod
    def setUpClass(cls):
        global BASE_URL
        live_override = os.environ.get("USE_LIVE_ENDPOINT")
        if live_override:
            cls.base_url = live_override
            BASE_URL = live_override
        else:
            cls.temp_db = tempfile.NamedTemporaryFile(suffix="_func_verif_iso.db", delete=False)
            cls.temp_db.close()
            cls.temp_db_path = cls.temp_db.name
            cls.temp_upload_dir = tempfile.mkdtemp(prefix="func_verif_uploads_")

            app = create_app(test_config={
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{cls.temp_db_path}",
                "WTF_CSRF_ENABLED": False,
                "DEMO_UPLOAD_FOLDER": cls.temp_upload_dir,
                "UPLOAD_FOLDER": cls.temp_upload_dir,
                "SECRET_KEY": "test-verification-isolated-key",
            })

            with app.app_context():
                db.create_all()

                # 1. Seed users
                admin = User(name="System Admin", email="admin@careai.com", role="admin")
                admin.set_password("Admin@123")
                db.session.add(admin)

                doctor = User(name="Dr. Hepato Care [DEMO]", email="doctor@careai.com", role="hepatologist")
                doctor.set_password("Doctor@123")
                db.session.add(doctor)

                lab = User(name="Lab Technician [DEMO]", email="lab@careai.com", role="labtech")
                lab.set_password("Lab@123")
                db.session.add(lab)

                patient_user = User(name="Eleanor Vance [DEMO]", email="patient@careai.com", role="patient", portal_id="PAT-1001")
                patient_user.set_password("Patient@123")
                db.session.add(patient_user)
                db.session.commit()

                # 2. Seed patients
                p1 = Patient(
                    id=1,
                    full_name="Eleanor Vance [DEMO]",
                    portal_id="PAT-1001",
                    email="patient@careai.com",
                    age=52,
                    gender="Female",
                    bilirubin=1.4,
                    albumin=3.6,
                    sgot=55,
                    sgpt=48,
                    platelets=210,
                    cholesterol=190,
                    prothrombin=11.8,
                    copper=78,
                    alk_phos=650,
                    triglycerides=130,
                    latest_risk_label="High Risk",
                    latest_risk_percent=88.5,
                    treatment_status="Under treatment",
                )
                p2 = Patient(
                    id=2,
                    full_name="Marcus Holloway [DEMO]",
                    portal_id="PAT-1002",
                    email="marcus@example.com",
                    age=48,
                    gender="Male",
                    bilirubin=2.1,
                    albumin=3.2,
                    sgot=70,
                    sgpt=65,
                    platelets=160,
                    cholesterol=210,
                    prothrombin=13.0,
                    copper=90,
                    alk_phos=720,
                    triglycerides=150,
                    latest_risk_label="High Risk",
                    latest_risk_percent=82.0,
                    treatment_status="Awaiting review",
                )
                p3 = Patient(
                    id=3,
                    full_name="Sophia Chen [DEMO]",
                    portal_id="PAT-1003",
                    email="sophia@example.com",
                    age=39,
                    gender="Female",
                    bilirubin=0.9,
                    albumin=4.1,
                    sgot=32,
                    sgpt=30,
                    platelets=250,
                    cholesterol=175,
                    prothrombin=11.2,
                    copper=65,
                    alk_phos=580,
                    triglycerides=110,
                    latest_risk_label="Moderate Risk",
                    latest_risk_percent=45.0,
                    treatment_status="Awaiting review",
                )
                p4 = Patient(
                    id=4,
                    full_name="David Kim [DEMO]",
                    portal_id="PAT-1004",
                    email="david@example.com",
                    age=61,
                    gender="Male",
                    bilirubin=0.8,
                    albumin=4.2,
                    sgot=25,
                    sgpt=22,
                    platelets=280,
                    cholesterol=160,
                    prothrombin=10.9,
                    copper=60,
                    alk_phos=520,
                    triglycerides=95,
                    latest_risk_label="Low Risk",
                    latest_risk_percent=18.0,
                    treatment_status="Under treatment",
                )
                p5 = Patient(
                    id=5,
                    full_name="Arthur Pendelton [DEMO]",
                    portal_id="PAT-1005",
                    email="arthur@example.com",
                    age=57,
                    gender="Male",
                    bilirubin=1.1,
                    albumin=3.9,
                    sgot=40,
                    sgpt=38,
                    platelets=230,
                    cholesterol=185,
                    prothrombin=11.5,
                    copper=72,
                    alk_phos=610,
                    triglycerides=125,
                    latest_risk_label="Moderate Risk",
                    latest_risk_percent=52.0,
                    treatment_status="Awaiting review",
                )
                p6 = Patient(
                    id=6,
                    full_name="Aisha Patel [DEMO]",
                    portal_id="PAT-1008",
                    email="aisha@example.com",
                    age=44,
                    gender="Female",
                    bilirubin=1.8,
                    albumin=3.4,
                    sgot=62,
                    sgpt=58,
                    platelets=180,
                    cholesterol=200,
                    prothrombin=12.5,
                    copper=85,
                    alk_phos=690,
                    triglycerides=140,
                    latest_risk_label="High Risk",
                    latest_risk_percent=91.0,
                    treatment_status="Under treatment",
                )
                db.session.add_all([p1, p2, p3, p4, p5, p6])
                db.session.commit()

                # 3. Seed prescriptions
                rx1 = Prescription(
                    id=1,
                    patient_id=p1.id,
                    doctor_id=doctor.id,
                    medicine="Spironolactone 50mg",
                    dosage="50mg once daily in morning",
                    frequency_days=30,
                    clinical_notes="diuretic titration for ascites and peripheral edema",
                    diet_suggestion="Low sodium diet (<2.0g/day)",
                    follow_up_date=date(2026, 12, 1),
                )
                rx2 = Prescription(
                    id=2,
                    patient_id=p2.id,
                    doctor_id=doctor.id,
                    medicine="Carvedilol 6.25mg",
                    dosage="6.25mg PO twice daily",
                    frequency_days=30,
                    clinical_notes="portal hypertension prophylaxis",
                    diet_suggestion="Avoid NSAIDs and alcohol",
                    follow_up_date=date(2026, 11, 20),
                )
                rx3 = Prescription(
                    id=3,
                    patient_id=p3.id,
                    doctor_id=doctor.id,
                    medicine="Lactulose 10g/15mL",
                    dosage="30mL PO twice daily",
                    frequency_days=30,
                    clinical_notes="secondary prophylaxis for hepatic encephalopathy",
                    diet_suggestion="Adequate fiber, hydration",
                    follow_up_date=date(2026, 12, 10),
                )
                rx4 = Prescription(
                    id=4,
                    patient_id=p4.id,
                    doctor_id=doctor.id,
                    medicine="Furosemide 20mg",
                    dosage="20mg once daily in morning",
                    frequency_days=30,
                    clinical_notes="mild edema management",
                    diet_suggestion="Monitor potassium intake",
                    follow_up_date=date(2026, 11, 30),
                )
                rx5 = Prescription(
                    id=5,
                    patient_id=p6.id,
                    doctor_id=doctor.id,
                    medicine="Propranolol 20mg",
                    dosage="20mg PO twice daily",
                    frequency_days=30,
                    clinical_notes="variceal bleeding secondary prevention",
                    diet_suggestion="Low sodium diet",
                    follow_up_date=date(2026, 12, 15),
                )
                db.session.add_all([rx1, rx2, rx3, rx4, rx5])
                db.session.commit()

                # 4. Seed appointments
                now = datetime.utcnow()
                appt1 = Appointment(
                    patient_id=p1.id,
                    doctor_id=doctor.id,
                    status="Pending",
                    scheduled_at=now + timedelta(days=2),
                    reason="Follow-up consultation",
                )
                appt2 = Appointment(
                    patient_id=p2.id,
                    doctor_id=doctor.id,
                    status="Confirmed",
                    scheduled_at=now + timedelta(days=4),
                    reason="Ultrasound evaluation",
                )
                appt3 = Appointment(
                    patient_id=p3.id,
                    doctor_id=doctor.id,
                    status="Pending",
                    scheduled_at=now + timedelta(days=6),
                    reason="Biopsy review",
                )
                appt4 = Appointment(
                    patient_id=p4.id,
                    doctor_id=doctor.id,
                    status="Completed",
                    scheduled_at=now - timedelta(days=1),
                    reason="Routine checkup",
                )
                db.session.add_all([appt1, appt2, appt3, appt4])
                db.session.commit()

                # 5. Seed reports and generate files in temporary upload directory
                reports_meta = [
                    (1, p1, "demo_eleanor_comprehensive_metabolic_panel.pdf", "Comprehensive_Metabolic_Panel.pdf", "Blood test"),
                    (2, p2, "demo_marcus_abdominal_ultrasound.pdf", "Abdominal_Doppler_Ultrasound.pdf", "Ultrasound"),
                    (3, p3, "demo_david_liver_biopsy_histology.pdf", "Liver_Biopsy_Histology.pdf", "Biopsy"),
                    (4, p4, "demo_sophia_hepatic_function_panel.pdf", "Hepatic_Function_Panel.pdf", "Blood test"),
                    (5, p5, "demo_arthur_fibroscan_elastography.pdf", "FibroScan_Transient_Elastography.pdf", "FibroScan"),
                    (6, p6, "demo_aisha_coagulation_profile.pdf", "Coagulation_Prothrombin_Profile.pdf", "Blood test"),
                ]
                for rep_id, pat, filename, orig_filename, category in reports_meta:
                    rep = Report(
                        id=rep_id,
                        patient_id=pat.id,
                        filename=filename,
                        original_filename=orig_filename,
                        category=category,
                    )
                    db.session.add(rep)
                    db.session.commit()

                    dest_path = Path(cls.temp_upload_dir) / filename
                    generate_demo_report_pdf(rep, pat, dest_path)

            cls.server = make_server("127.0.0.1", 0, app)
            port = cls.server.server_port
            cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
            cls.server_thread.start()
            cls.base_url = f"http://127.0.0.1:{port}"
            BASE_URL = cls.base_url

        # 1. Admin session
        cls.admin_session = requests.Session()
        res_admin = cls.admin_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "admin@careai.com", "password": "Admin@123"},
        )
        assert res_admin.status_code == 200, f"Admin login failed: {res_admin.text}"

        # 2. Doctor session
        cls.doc_session = requests.Session()
        res_doc = cls.doc_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "doctor@careai.com", "password": "Doctor@123"},
        )
        assert res_doc.status_code == 200, f"Doctor login failed: {res_doc.text}"

        # 3. Lab Tech session
        cls.lab_session = requests.Session()
        res_lab = cls.lab_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "lab@careai.com", "password": "Lab@123"},
        )
        assert res_lab.status_code == 200, f"Lab Tech login failed: {res_lab.text}"

        # 4. Patient session
        cls.pat_session = requests.Session()
        res_pat = cls.pat_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "patient@careai.com", "password": "Patient@123"},
        )
        assert res_pat.status_code == 200, f"Patient login failed: {res_pat.text}"

    @classmethod
    def tearDownClass(cls):
        if cls.server:
            cls.server.shutdown()
        if cls.temp_db_path and os.path.exists(cls.temp_db_path):
            try:
                os.remove(cls.temp_db_path)
            except Exception:
                pass
        if cls.temp_upload_dir and os.path.exists(cls.temp_upload_dir):
            try:
                shutil.rmtree(cls.temp_upload_dir, ignore_errors=True)
            except Exception:
                pass

    # -------------------------------------------------------------------------
    # 1. Prescription Demo-Data Gap & Clinical Review Workflow
    # -------------------------------------------------------------------------
    def test_01_prescription_gap_resolved_and_archive_display(self):
        # Doctor views clinic-wide Prescriptions Archive
        res = self.doc_session.get(f"{BASE_URL}/api/prescriptions")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        total = data.get("total", 0)
        self.assertGreaterEqual(total, 5, "Expected at least 5 demo prescriptions in archive")

        prescriptions = data.get("prescriptions", [])
        med_names = [p["medicine"] for p in prescriptions]
        # Check for core demo regimens
        has_spiro = any("Spironolactone" in m for m in med_names)
        has_carv = any("Carvedilol" in m for m in med_names)
        self.assertTrue(has_spiro, "Expected Spironolactone in Prescriptions Archive")
        self.assertTrue(has_carv, "Expected Carvedilol in Prescriptions Archive")

        # Patient 1 (Eleanor Vance) prescription history
        p1_res = self.doc_session.get(f"{BASE_URL}/api/patients/1")
        self.assertEqual(p1_res.status_code, 200)
        p1 = p1_res.json().get("patient", {})
        p1_rx = p1.get("prescriptions", [])
        self.assertGreaterEqual(len(p1_rx), 1, "Patient 1 should have prescription history")

    def test_02_clinical_review_prescription_creation_and_persistence(self):
        # Issue a new prescription via Clinical Review for patient #3 (Sophia Chen, PAT-1003)
        rx_payload = {
            "medicine": "Rifaximin 550mg",
            "dosage": "550mg PO twice daily",
            "frequency_days": 30,
            "treatment_status": "Under treatment",
            "clinical_notes": "[DEMO] Secondary prophylaxis for hepatic encephalopathy with lactulose synergy.",
            "diet_suggestion": "High vegetable protein, adequate fiber, low sodium.",
            "follow_up_date": "2026-12-01",
        }
        create_res = self.doc_session.post(
            f"{BASE_URL}/api/patients/3/prescriptions",
            json=rx_payload,
        )
        self.assertEqual(create_res.status_code, 201)
        created_rx = create_res.json().get("prescription", {})
        rx_id = created_rx.get("id")
        self.assertIsNotNone(rx_id)
        self.assertEqual(created_rx.get("medicine"), "Rifaximin 550mg")
        self.assertIn("Sophia Chen", created_rx.get("patient_name", ""))

        # Verify appearance in Prescriptions Archive
        archive_res = self.doc_session.get(f"{BASE_URL}/api/prescriptions?q=Rifaximin")
        self.assertEqual(archive_res.status_code, 200)
        archive_data = archive_res.json()
        self.assertGreaterEqual(archive_data.get("total", 0), 1)
        found_in_archive = any(r["id"] == rx_id for r in archive_data.get("prescriptions", []))
        self.assertTrue(found_in_archive, "Created prescription must appear in Prescriptions Archive")

        # Verify appearance in patient's clinical history
        p3_res = self.doc_session.get(f"{BASE_URL}/api/patients/3")
        self.assertEqual(p3_res.status_code, 200)
        p3_rx_ids = [r["id"] for r in p3_res.json()["patient"].get("prescriptions", [])]
        self.assertIn(rx_id, p3_rx_ids, "Created prescription must appear in patient's profile history")

    # -------------------------------------------------------------------------
    # 2. Report Downloads Verification
    # -------------------------------------------------------------------------
    def test_03_report_downloads_all_six_demo_reports(self):
        # Query reports list
        rep_list_res = self.doc_session.get(f"{BASE_URL}/api/reports")
        self.assertEqual(rep_list_res.status_code, 200)
        reports = rep_list_res.json().get("reports", [])
        self.assertGreaterEqual(len(reports), 6, "Expected at least 6 demo reports")

        # Download each of the 6 reports
        for rep in reports[:6]:
            rep_id = rep["id"]
            download_res = self.doc_session.get(f"{BASE_URL}/api/reports/{rep_id}/download")
            self.assertEqual(
                download_res.status_code, 200,
                f"Report {rep_id} download failed with status {download_res.status_code}: {download_res.text[:200]}"
            )
            content_type = download_res.headers.get("Content-Type", "")
            self.assertIn("application/pdf", content_type, f"Report {rep_id} Content-Type should be application/pdf, got {content_type}")
            content = download_res.content
            self.assertGreater(len(content), 100, f"Report {rep_id} content is too small ({len(content)} bytes)")
            self.assertTrue(content.startswith(b"%PDF-"), f"Report {rep_id} does not start with %PDF- magic bytes")

    # -------------------------------------------------------------------------
    # 3. Patient Search & Risk/Status Filters
    # -------------------------------------------------------------------------
    def test_04_patient_search_and_filters(self):
        # 1. Search by name
        res_name = self.admin_session.get(f"{BASE_URL}/api/patients?q=Eleanor")
        self.assertEqual(res_name.status_code, 200)
        patients_name = res_name.json().get("patients", [])
        self.assertGreaterEqual(len(patients_name), 1)
        self.assertIn("Eleanor", patients_name[0]["full_name"])

        # 2. Search by portal_id
        res_pid = self.admin_session.get(f"{BASE_URL}/api/patients?q=PAT-1002")
        self.assertEqual(res_pid.status_code, 200)
        patients_pid = res_pid.json().get("patients", [])
        self.assertEqual(len(patients_pid), 1)
        self.assertEqual(patients_pid[0]["portal_id"], "PAT-1002")

        # 3. Filter by risk label
        res_high = self.admin_session.get(f"{BASE_URL}/api/patients?risk=High%20Risk")
        self.assertEqual(res_high.status_code, 200)
        for p in res_high.json().get("patients", []):
            self.assertEqual(p["latest_risk_label"], "High Risk")

        # 4. Filter by treatment status
        res_status = self.admin_session.get(f"{BASE_URL}/api/patients?status=Awaiting%20review")
        self.assertEqual(res_status.status_code, 200)
        for p in res_status.json().get("patients", []):
            self.assertEqual(p["treatment_status"], "Awaiting review")

    # -------------------------------------------------------------------------
    # 4. Clinical Review Status Updates
    # -------------------------------------------------------------------------
    def test_05_clinical_review_status_update(self):
        # Update patient #2 review status to 'Under treatment'
        patch_res = self.doc_session.patch(
            f"{BASE_URL}/api/patients/2/review-status",
            json={"treatment_status": "Under treatment"},
        )
        self.assertEqual(patch_res.status_code, 200)
        data = patch_res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["patient"]["treatment_status"], "Under treatment")

        # Verify reflected in patient record
        p_res = self.doc_session.get(f"{BASE_URL}/api/patients/2")
        self.assertEqual(p_res.json()["patient"]["treatment_status"], "Under treatment")

    # -------------------------------------------------------------------------
    # 5. Appointment Listing & Status Handling
    # -------------------------------------------------------------------------
    def test_06_appointment_listing_and_status_handling(self):
        # List appointments
        res = self.admin_session.get(f"{BASE_URL}/api/appointments")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        appointments = data.get("appointments", [])
        self.assertGreaterEqual(len(appointments), 4, "Expected at least 4 demo appointments")

        # Filter by status
        res_pending = self.admin_session.get(f"{BASE_URL}/api/appointments?status=Pending")
        self.assertEqual(res_pending.status_code, 200)
        for a in res_pending.json().get("appointments", []):
            self.assertEqual(a["status"], "Pending")

        # Update appointment status on an active (Pending/Confirmed) appointment
        active_appnts = [a for a in appointments if a["status"] in ("Pending", "Confirmed")]
        self.assertGreaterEqual(len(active_appnts), 1, "Expected at least 1 active appointment")
        appnt_id = active_appnts[0]["id"]
        status_res = self.admin_session.patch(
            f"{BASE_URL}/api/appointments/{appnt_id}/status",
            json={"status": "Confirmed"},
        )
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["appointment"]["status"], "Confirmed")

    # -------------------------------------------------------------------------
    # 6. Population Analytics & CSV / PDF Exports
    # -------------------------------------------------------------------------
    def test_07_analytics_and_exports(self):
        # Analytics endpoint
        analytics_res = self.admin_session.get(f"{BASE_URL}/api/analytics")
        self.assertEqual(analytics_res.status_code, 200)
        adata = analytics_res.json()
        self.assertTrue(adata.get("success"))
        self.assertIn("risk_distribution", adata)
        self.assertIn("status_distribution", adata)

        # Reports analytics endpoint
        rep_analytics = self.admin_session.get(f"{BASE_URL}/api/reports/analytics")
        self.assertEqual(rep_analytics.status_code, 200)
        self.assertTrue(rep_analytics.json().get("success"))

        # CSV Export
        csv_res = self.admin_session.get(f"{BASE_URL}/api/export/patients.csv")
        self.assertEqual(csv_res.status_code, 200)
        self.assertIn("text/csv", csv_res.headers.get("Content-Type", ""))
        self.assertIn("Full Name", csv_res.text)
        self.assertIn("Patient ID", csv_res.text)

        # PDF Export
        pdf_res = self.admin_session.get(f"{BASE_URL}/api/export/report.pdf")
        self.assertEqual(pdf_res.status_code, 200)
        self.assertIn("application/pdf", pdf_res.headers.get("Content-Type", ""))
        self.assertTrue(pdf_res.content.startswith(b"%PDF-"))

    # -------------------------------------------------------------------------
    # 7. Staff Directory Search & Role Filters
    # -------------------------------------------------------------------------
    def test_08_staff_directory_search_and_role_filters(self):
        # List users as admin
        res = self.admin_session.get(f"{BASE_URL}/api/users")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        users = data.get("users", [])
        self.assertGreaterEqual(len(users), 4)

        # Filter by role: hepatologist
        res_doc = self.admin_session.get(f"{BASE_URL}/api/users?role=hepatologist")
        self.assertEqual(res_doc.status_code, 200)
        for u in res_doc.json().get("users", []):
            self.assertEqual(u["role"], "hepatologist")

        # Search by keyword
        res_search = self.admin_session.get(f"{BASE_URL}/api/users?q=doctor")
        self.assertEqual(res_search.status_code, 200)
        search_users = res_search.json().get("users", [])
        self.assertGreaterEqual(len(search_users), 1)
        self.assertIn("doctor", (search_users[0]["email"] + search_users[0]["name"]).lower())

    # -------------------------------------------------------------------------
    # 8. Database and Storage Safety & Isolation
    # -------------------------------------------------------------------------
    def test_09_safety_isolation_verification(self):
        # 1. instance/cirrhosis.db must be untouched with 0 patients, prescriptions, appointments, reports
        conn = sqlite3.connect("instance/cirrhosis.db")
        c = conn.cursor()
        c.execute("PRAGMA integrity_check")
        self.assertEqual(c.fetchone()[0], "ok")
        for table in ["patients", "prescriptions", "appointments", "reports"]:
            c.execute(f"SELECT count(*) FROM {table}")
            cnt = c.fetchone()[0]
            self.assertEqual(cnt, 0, f"Production table {table} had {cnt} rows, expected 0")
        conn.close()

        # 2. instance/uploads must contain NO demo files
        upload_dir = "instance/uploads"
        if os.path.exists(upload_dir):
            files = os.listdir(upload_dir)
            demo_files = [f for f in files if "demo" in f.lower()]
            self.assertEqual(demo_files, [], f"Production uploads should have no demo files: {demo_files}")

        # 3. instance/demo_uploads must contain valid demo PDFs
        demo_upload_dir = "instance/demo_uploads"
        self.assertTrue(os.path.exists(demo_upload_dir))
        demo_files = [f for f in os.listdir(demo_upload_dir) if f.endswith(".pdf")]
        self.assertGreaterEqual(len(demo_files), 6, "Expected at least 6 demo PDFs in instance/demo_uploads")


if __name__ == "__main__":
    unittest.main()
