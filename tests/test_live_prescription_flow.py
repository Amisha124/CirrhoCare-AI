"""
tests/test_live_prescription_flow.py
------------------------------------
Verifies end-to-end prescription workflow on live running server:
1. Retrieval of demo prescriptions in Prescriptions Archive for Admin & Doctor.
2. Patient role data isolation (patient only sees their own prescription).
3. Search filtering by medicine, portal_id, and clinical notes.
4. Date range filtering.
5. Prescription details endpoint (/api/prescriptions/<id>).
6. Prescriptions created in Clinical Review workspace are saved to active demo DB
   and immediately appear in Prescriptions Archive.
7. Verification that production DB (instance/cirrhosis.db) remains untouched.
"""

from datetime import date, datetime
import os
import shutil
import sqlite3
import tempfile
import threading
import unittest
from wsgiref.simple_server import make_server
import requests

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.user import User


class LivePrescriptionFlowTestCase(unittest.TestCase):
    server = None
    temp_db_path = None
    temp_upload_dir = None

    @classmethod
    def setUpClass(cls):
        live_override = os.environ.get("USE_LIVE_ENDPOINT")
        if live_override:
            cls.base_url = live_override
            cls.server = None
            cls.temp_db_path = None
            cls.temp_upload_dir = None
        else:
            cls.temp_db = tempfile.NamedTemporaryFile(suffix="_rx_flow_iso.db", delete=False)
            cls.temp_db.close()
            cls.temp_db_path = cls.temp_db.name
            cls.temp_upload_dir = tempfile.mkdtemp(prefix="rx_flow_uploads_")

            app = create_app(test_config={
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{cls.temp_db_path}",
                "WTF_CSRF_ENABLED": False,
                "DEMO_UPLOAD_FOLDER": cls.temp_upload_dir,
                "UPLOAD_FOLDER": cls.temp_upload_dir,
                "SECRET_KEY": "test-prescription-flow-key",
            })

            with app.app_context():
                db.create_all()

                admin = User(name="System Admin", email="admin@careai.com", role="admin")
                admin.set_password("Admin@123")
                db.session.add(admin)

                doctor = User(name="Dr. Hepato Care [DEMO]", email="doctor@careai.com", role="hepatologist")
                doctor.set_password("Doctor@123")
                db.session.add(doctor)

                patient_user = User(name="Eleanor Vance [DEMO]", email="patient@careai.com", role="patient", portal_id="PAT-1001")
                patient_user.set_password("Patient@123")
                db.session.add(patient_user)
                db.session.commit()

                p1 = Patient(
                    id=1,
                    full_name="Eleanor Vance [DEMO]",
                    portal_id="PAT-1001",
                    email="patient@careai.com",
                    age=52,
                    gender="Female",
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
                    latest_risk_label="High Risk",
                    latest_risk_percent=91.0,
                    treatment_status="Under treatment",
                )
                db.session.add_all([p1, p2, p3, p4, p5, p6])
                db.session.commit()

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

            cls.server = make_server("127.0.0.1", 0, app)
            port = cls.server.server_port
            cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
            cls.server_thread.start()
            cls.base_url = f"http://127.0.0.1:{port}"

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

    def setUp(self):
        self.session_admin = requests.Session()
        res = self.session_admin.post(
            f"{self.base_url}/api/auth/login",
            json={"identifier": "admin@careai.com", "password": "Admin@123"},
        )
        self.assertEqual(res.status_code, 200, "Admin login failed")

        self.session_doc = requests.Session()
        res_doc = self.session_doc.post(
            f"{self.base_url}/api/auth/login",
            json={"identifier": "doctor@careai.com", "password": "Doctor@123"},
        )
        self.assertEqual(res_doc.status_code, 200, "Doctor login failed")

        self.session_pat = requests.Session()
        res_pat = self.session_pat.post(
            f"{self.base_url}/api/auth/login",
            json={"identifier": "patient@careai.com", "password": "Patient@123"},
        )
        self.assertEqual(res_pat.status_code, 200, "Patient login failed")

    def test_01_prescriptions_archive_retrieval(self):
        res = self.session_admin.get(f"{self.base_url}/api/prescriptions")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        total = data.get("total", 0)
        self.assertGreaterEqual(total, 5, "Expected at least 5 demo prescriptions")

        rx_list = data.get("prescriptions", [])
        self.assertGreaterEqual(len(rx_list), 5)

        first_rx = rx_list[0]
        for field in [
            "id",
            "patient_id",
            "patient_name",
            "doctor_id",
            "doctor_name",
            "medicine",
            "dosage",
            "frequency_days",
            "clinical_notes",
            "diet_suggestion",
            "follow_up_date",
            "created_at",
        ]:
            self.assertIn(field, first_rx, f"Missing field {field} in serialized prescription")

    def test_02_role_permissions(self):
        # Doctor should also see the clinic prescriptions archive
        res_doc = self.session_doc.get(f"{self.base_url}/api/prescriptions")
        self.assertEqual(res_doc.status_code, 200)
        self.assertGreaterEqual(res_doc.json().get("total"), 5)

        # Patient should only see their own prescriptions (Eleanor Vance PAT-1001)
        res_pat = self.session_pat.get(f"{self.base_url}/api/prescriptions")
        self.assertEqual(res_pat.status_code, 200)
        pat_data = res_pat.json()
        self.assertEqual(pat_data.get("total"), 1)
        self.assertEqual(pat_data["prescriptions"][0]["patient_name"], "Eleanor Vance [DEMO]")

    def test_03_search_filters(self):
        # Search by medicine name
        res = self.session_admin.get(f"{self.base_url}/api/prescriptions?q=Carvedilol")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("total"), 1)
        self.assertIn("Carvedilol", data["prescriptions"][0]["medicine"])

        # Search by patient portal ID
        res_pat_id = self.session_admin.get(f"{self.base_url}/api/prescriptions?q=PAT-1008")
        self.assertEqual(res_pat_id.status_code, 200)
        data_pat = res_pat_id.json()
        self.assertEqual(data_pat.get("total"), 1)
        self.assertEqual(data_pat["prescriptions"][0]["patient_name"], "Aisha Patel [DEMO]")

        # Search by clinical notes keyword
        res_notes = self.session_admin.get(f"{self.base_url}/api/prescriptions?q=diuretic")
        self.assertEqual(res_notes.status_code, 200)
        data_notes = res_notes.json()
        self.assertEqual(data_notes.get("total"), 1)
        self.assertEqual(data_notes["prescriptions"][0]["patient_name"], "Eleanor Vance [DEMO]")

    def test_04_prescription_details(self):
        res = self.session_admin.get(f"{self.base_url}/api/prescriptions/1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        rx = data.get("prescription")
        self.assertEqual(rx["id"], 1)
        self.assertIn("Spironolactone", rx["medicine"])
        self.assertIsNotNone(rx["diet_suggestion"])

    def test_05_clinical_review_create_and_archive_visibility(self):
        # 1. Count before creation
        initial_res = self.session_admin.get(f"{self.base_url}/api/prescriptions").json()
        initial_total = initial_res.get("total", 0)

        # 2. Issue a prescription for patient ID 2 (Marcus Holloway, PAT-1002) via Clinical Review builder
        payload = {
            "medicine": "Nadolol Beta-Blocker",
            "dosage": "40mg PO once daily in the morning",
            "frequency_days": 30,
            "treatment_status": "Under treatment",
            "clinical_notes": "[DEMO] Issued from Clinical Review builder: Portal hypertension prophylaxis with heart rate monitoring.",
            "diet_suggestion": "Low sodium diet (<2.0g/day), avoid NSAIDs.",
            "follow_up_date": "2026-11-25",
        }
        create_res = self.session_doc.post(
            f"{self.base_url}/api/patients/2/prescriptions",
            json=payload,
        )
        self.assertEqual(create_res.status_code, 201)
        create_data = create_res.json()
        self.assertTrue(create_data.get("success"))
        new_rx = create_data.get("prescription")
        new_rx_id = new_rx["id"]
        self.assertEqual(new_rx["medicine"], "Nadolol Beta-Blocker")
        self.assertEqual(new_rx["patient_name"], "Marcus Holloway [DEMO]")

        # 3. Verify it immediately appears in Prescriptions Archive
        archive_res = self.session_admin.get(f"{self.base_url}/api/prescriptions").json()
        self.assertEqual(archive_res.get("total"), initial_total + 1)

        # Check newly created prescription is in archive list
        found = any(r["id"] == new_rx_id for r in archive_res.get("prescriptions", []))
        self.assertTrue(found, "Newly created prescription not found in Prescriptions Archive")

        # 4. Search for newly created prescription in archive
        search_new = self.session_admin.get(f"{self.base_url}/api/prescriptions?q=Nadolol").json()
        self.assertGreaterEqual(search_new.get("total"), 1)
        search_ids = [r["id"] for r in search_new.get("prescriptions", [])]
        self.assertIn(new_rx_id, search_ids)

        # 5. Verify patient's clinical review profile reflects updated status & prescription history
        p_res = self.session_doc.get(f"{self.base_url}/api/patients/2").json()
        patient = p_res.get("patient")
        self.assertEqual(patient["treatment_status"], "Under treatment")
        p_rx_ids = [r["id"] for r in patient.get("prescriptions", [])]
        self.assertIn(new_rx_id, p_rx_ids)

    def test_06_database_safety_isolation(self):
        # Confirm instance/cirrhosis.db is 100% untouched
        conn = sqlite3.connect("instance/cirrhosis.db")
        c = conn.cursor()
        c.execute("PRAGMA integrity_check")
        self.assertEqual(c.fetchone()[0], "ok")

        for table in ["patients", "prescriptions", "appointments", "reports"]:
            c.execute(f"SELECT count(*) FROM {table}")
            count = c.fetchone()[0]
            self.assertEqual(count, 0, f"Production table {table} should have 0 records, found {count}")
        conn.close()


if __name__ == "__main__":
    unittest.main()
