import io
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta

from app import create_app
from app.models import db
from app.models.lab_order import LabOrder
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User


class CompletePatientWorkflowTestCase(unittest.TestCase):
    """
    Comprehensive End-to-End Test Suite verifying the full clinical patient workflow:
    Step 1: Admin registers patient, unique Patient ID and PIN generated, assigns to Doctor.
    Step 2: Doctor logs in, sees patient in patient list & dashboard, creates lab test order.
    Step 3: Lab Tech logs in, sees pending order, enters biomarkers, uploads PDF report -> order Completed.
    Step 4: Doctor reviews completed order and report, issues prescription and dietary advice.
    Step 5: Patient logs in using Patient ID & PIN, views only their own reports, prescriptions, and advice.
    Step 6: Security and access isolation: unauthorized doctors/patients are rejected with 403.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_workflow_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="workflow_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-workflow-secret-key-101"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-workflow-secret-key-101",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety assertion: strictly verify temporary test database
        db_uri = str(self.app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
        norm_db_path = os.path.abspath(self.db_path).replace("\\", "/")
        if "instance/cirrhosis.db" in db_uri or "instance/demo_cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db") or db_uri.endswith("/demo_cirrhosis.db"):
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test connected to instance database: {db_uri}")
        if norm_db_path not in db_uri and self.db_path not in db_uri:
            raise RuntimeError(f"DATABASE ISOLATION CRITICAL FAILURE: Test database URI does not match temporary test DB: {db_uri}")

        with self.app.app_context():
            db.create_all()

            # Create test staff accounts
            self.admin = User(name="System Admin", email="admin@hospital.test", role="admin", active=True)
            self.admin.set_password("AdminPass123!")

            self.doctor1 = User(name="Dr. Elena Rostova", email="doctor1@hospital.test", role="hepatologist", active=True)
            self.doctor1.set_password("DoctorPass123!")

            self.doctor2 = User(name="Dr. Marcus Vance", email="doctor2@hospital.test", role="hepatologist", active=True)
            self.doctor2.set_password("DoctorPass123!")

            self.labtech = User(name="Lab Tech Priya", email="labtech@hospital.test", role="labtech", active=True)
            self.labtech.set_password("LabTechPass123!")

            db.session.add_all([self.admin, self.doctor1, self.doctor2, self.labtech])
            db.session.commit()

            self.admin_id = self.admin.id
            self.doctor1_id = self.doctor1.id
            self.doctor2_id = self.doctor2.id
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
                shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _logout(self):
        return self.client.post("/api/auth/logout")

    def test_complete_patient_workflow_end_to_end(self):
        """
        Executes the exact 5-step clinical workflow end-to-end.
        """
        # =========================================================================
        # STEP 1: ADMIN REGISTERS PATIENT & ASSIGNS TO DOCTOR
        # =========================================================================
        # 1a. Admin logs in
        login_res = self._login("admin@hospital.test", "AdminPass123!")
        self.assertEqual(login_res.status_code, 200, "Admin login failed")

        # 1b. Admin retrieves doctors list
        doc_res = self.client.get("/api/doctors")
        self.assertEqual(doc_res.status_code, 200)
        docs = doc_res.get_json()["doctors"]
        doc_ids = [d["id"] for d in docs]
        self.assertIn(self.doctor1_id, doc_ids, "Doctor 1 not found in doctors list")

        # 1c. Admin registers new patient, assigning to Doctor 1
        reg_payload = {
            "full_name": "Rohan Deshmukh",
            "age": 48,
            "gender": "Male",
            "phone": "+1-555-8833",
            "email": "rohan.deshmukh@example.test",
            "assigned_doctor_id": self.doctor1_id,
            "treatment_status": "Awaiting review",
            "bilirubin": 2.8,
            "albumin": 3.1,
            "platelets": 115,
            "sgot": 65,
            "sgpt": 58,
            "prothrombin": 13.8,
        }
        create_res = self.client.post("/api/patients", json=reg_payload)
        self.assertEqual(create_res.status_code, 201, f"Patient registration failed: {create_res.get_data(as_text=True)}")
        create_data = create_res.get_json()

        patient_info = create_data["patient"]
        patient_id = patient_info["id"]
        patient_portal_id = patient_info["portal_id"]
        initial_pin = create_data.get("initial_pin")

        self.assertIsNotNone(patient_id, "Patient ID missing")
        self.assertIsNotNone(patient_portal_id, "Portal ID missing")
        self.assertTrue(patient_portal_id.startswith("CC-") or patient_portal_id.startswith("PAT-"), f"Unexpected Portal ID: {patient_portal_id}")
        self.assertIsNotNone(initial_pin, "Initial Secret PIN not generated")
        self.assertEqual(patient_info["assigned_doctor_id"], self.doctor1_id, "Patient not assigned to Doctor 1")
        self.assertEqual(patient_info["assigned_doctor_name"], "Dr. Elena Rostova", "Doctor name not serialized")

        self._logout()

        # =========================================================================
        # STEP 2: DOCTOR LOGS IN & CREATES LAB TEST ORDER
        # =========================================================================
        # 2a. Doctor 1 logs in
        login_doc1 = self._login("doctor1@hospital.test", "DoctorPass123!")
        self.assertEqual(login_doc1.status_code, 200, "Doctor 1 login failed")

        # 2b. Doctor 1 checks patient list: newly registered patient MUST appear
        patients_res = self.client.get("/api/patients")
        self.assertEqual(patients_res.status_code, 200)
        p_list = patients_res.get_json()["patients"]
        p_ids = [p["id"] for p in p_list]
        self.assertIn(patient_id, p_ids, "Newly assigned patient missing from Doctor 1 patient list")

        # 2c. Doctor 1 checks dashboard stats: assigned patient appears in stats
        stats_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats_data = stats_res.get_json()
        self.assertEqual(stats_data["role"], "hepatologist")
        all_assigned = [p["id"] for p in stats_data.get("all_assigned_patients", [])]
        self.assertIn(patient_id, all_assigned, "Newly assigned patient missing from Doctor 1 dashboard stats")

        # 2d. Doctor 1 opens patient record
        patient_detail_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(patient_detail_res.status_code, 200, "Doctor 1 denied access to assigned patient")
        detail_data = patient_detail_res.get_json()["patient"]
        self.assertEqual(detail_data["full_name"], "Rohan Deshmukh")

        # 2e. Doctor 1 creates a laboratory test order
        order_payload = {
            "test_type": "Liver Function Test (LFT)",
            "priority": "Urgent",
            "clinical_indication": "Elevated baseline bilirubin and clinical surveillance.",
        }
        order_res = self.client.post(f"/api/patients/{patient_id}/lab-orders", json=order_payload)
        self.assertEqual(order_res.status_code, 201, f"Failed to create lab order: {order_res.get_data(as_text=True)}")
        order_data = order_res.get_json()["order"]
        order_id = order_data["id"]
        self.assertEqual(order_data["test_type"], "Liver Function Test (LFT)")
        self.assertEqual(order_data["order_status"], "Ordered")
        self.assertEqual(order_data["doctor_id"], self.doctor1_id)

        self._logout()

        # =========================================================================
        # STEP 3: LAB TECHNICIAN ACCESSES ORDER, ENTERS RESULTS & UPLOADS REPORT
        # =========================================================================
        # 3a. Lab Technician logs in
        login_lab = self._login("labtech@hospital.test", "LabTechPass123!")
        self.assertEqual(login_lab.status_code, 200, "Lab Tech login failed")

        # 3b. Lab Tech checks pending lab orders queue: the new order must appear
        lab_orders_res = self.client.get("/api/lab-orders")
        self.assertEqual(lab_orders_res.status_code, 200)
        orders_list = lab_orders_res.get_json()["orders"]
        lab_order_ids = [o["id"] for o in orders_list]
        self.assertIn(order_id, lab_order_ids, "New test order not in lab orders queue")

        # 3c. Lab Tech updates patient's lab biomarkers
        update_markers_payload = {
            "bilirubin": 3.6,
            "albumin": 2.9,
            "platelets": 98.0,
            "sgot": 82.0,
            "sgpt": 75.0,
            "prothrombin": 14.5,
        }
        update_res = self.client.put(f"/api/patients/{patient_id}", json=update_markers_payload)
        self.assertEqual(update_res.status_code, 200, "Lab Tech failed to update biomarkers")

        # 3d. Lab Tech uploads PDF report linked to the lab order
        dummy_pdf_content = b"%PDF-1.4\n%Test Diagnostic Report\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        upload_data = {
            "category": "Liver Function Test (LFT)",
            "lab_order_id": str(order_id),
            "report": (io.BytesIO(dummy_pdf_content), "LFT_Diagnostic_Report.pdf"),
        }
        upload_res = self.client.post(
            f"/api/patients/{patient_id}/reports",
            data=upload_data,
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 201, f"Report upload failed: {upload_res.get_data(as_text=True)}")
        report_data = upload_res.get_json()["report"]
        report_id = report_data["id"]

        # 3e. Verify lab order is now 'Completed'
        verify_order_res = self.client.get(f"/api/lab-orders/{order_id}")
        self.assertEqual(verify_order_res.status_code, 200)
        completed_order = verify_order_res.get_json()["order"]
        self.assertEqual(completed_order["order_status"], "Completed", "Lab order was not marked Completed after report upload")
        self.assertIsNotNone(completed_order["completed_at"], "Order completed_at timestamp missing")

        self._logout()

        # =========================================================================
        # STEP 4: DOCTOR REVIEWS COMPLETED REPORT & ISSUES PRESCRIPTION
        # =========================================================================
        # 4a. Doctor 1 logs in
        self._login("doctor1@hospital.test", "DoctorPass123!")

        # 4b. Doctor 1 inspects patient: verifies completed order and report are attached
        doc_patient_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(doc_patient_res.status_code, 200)
        p_detail = doc_patient_res.get_json()["patient"]

        self.assertEqual(len(p_detail["reports"]), 1, "Uploaded report not attached to patient profile")
        self.assertEqual(p_detail["reports"][0]["id"], report_id)
        self.assertEqual(len(p_detail["lab_orders"]), 1, "Lab order not attached to patient profile")
        self.assertEqual(p_detail["lab_orders"][0]["order_status"], "Completed")

        # 4c. Doctor 1 creates prescription with dosage, frequency, and dietary guidance
        rx_payload = {
            "medicine": "Spironolactone & Furosemide",
            "dosage": "100mg / 40mg daily morning",
            "frequency_days": 30,
            "clinical_notes": "Prescribed for portal hypertension management and ascites prophylaxis.",
            "diet_suggestion": "Strict low-sodium diet (<2g/day), adequate lean protein, avoid alcohol.",
            "follow_up_date": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
        }
        rx_res = self.client.post(f"/api/patients/{patient_id}/prescriptions", json=rx_payload)
        self.assertEqual(rx_res.status_code, 201, f"Prescription creation failed: {rx_res.get_data(as_text=True)}")
        rx_data = rx_res.get_json()["prescription"]
        rx_id = rx_data["id"]
        self.assertEqual(rx_data["medicine"], "Spironolactone & Furosemide")
        self.assertEqual(rx_data["diet_suggestion"], "Strict low-sodium diet (<2g/day), adequate lean protein, avoid alcohol.")

        # 4d. Doctor 1 confirms clinical treatment status
        status_res = self.client.put(f"/api/patients/{patient_id}/review-status", json={"treatment_status": "Under treatment"})
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.get_json()["patient"]["treatment_status"], "Under treatment")

        self._logout()

        # =========================================================================
        # STEP 5: PATIENT LOGS IN USING PATIENT ID & PIN & VIEWS RECORDS
        # =========================================================================
        # 5a. Patient logs in via Patient ID login endpoint
        pt_login_res = self.client.post("/api/auth/patient-login", json={
            "name": "Rohan Deshmukh",
            "portal_id": patient_portal_id,
            "pin": initial_pin,
        })
        self.assertEqual(pt_login_res.status_code, 200, f"Patient ID login failed: {pt_login_res.get_data(as_text=True)}")
        pt_user = pt_login_res.get_json()["user"]
        self.assertEqual(pt_user["role"], "patient")
        self.assertEqual(pt_user["portal_id"], patient_portal_id)

        # 5b. Patient accesses dashboard stats: sees their real records
        pt_dashboard_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(pt_dashboard_res.status_code, 200)
        pt_dash_data = pt_dashboard_res.get_json()
        self.assertEqual(pt_dash_data["role"], "patient")
        self.assertEqual(pt_dash_data["latest_record"]["full_name"], "Rohan Deshmukh")
        self.assertEqual(pt_dash_data["latest_record"]["treatment_status"], "Under treatment")
        self.assertEqual(pt_dash_data["latest_record"]["assigned_doctor_name"], "Dr. Elena Rostova")
        self.assertEqual(pt_dash_data["reports_count"], 1)

        # 5c. Patient views and downloads their authorized report
        pt_reports_res = self.client.get("/api/reports")
        self.assertEqual(pt_reports_res.status_code, 200)
        reports = pt_reports_res.get_json()["reports"]
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]["id"], report_id)

        download_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(download_res.status_code, 200, "Patient unable to download report")
        self.assertEqual(download_res.data, dummy_pdf_content)

        # 5d. Patient views prescriptions: sees their medicine, dosage, and dietary advice
        pt_rx_res = self.client.get("/api/prescriptions")
        self.assertEqual(pt_rx_res.status_code, 200)
        rxs = pt_rx_res.get_json()["prescriptions"]
        self.assertEqual(len(rxs), 1)
        self.assertEqual(rxs[0]["id"], rx_id)
        self.assertEqual(rxs[0]["medicine"], "Spironolactone & Furosemide")
        self.assertEqual(rxs[0]["diet_suggestion"], "Strict low-sodium diet (<2g/day), adequate lean protein, avoid alcohol.")

        self._logout()

        # =========================================================================
        # STEP 6: SECURITY & ACCESS ISOLATION VERIFICATION
        # =========================================================================
        # 6a. Doctor 2 (different doctor) logs in
        self._login("doctor2@hospital.test", "DoctorPass123!")

        # Doctor 2 patient list MUST NOT include Rohan Deshmukh (assigned to Doctor 1)
        doc2_patients = self.client.get("/api/patients").get_json()["patients"]
        doc2_p_ids = [p["id"] for p in doc2_patients]
        self.assertNotIn(patient_id, doc2_p_ids, "Patient assigned to Doctor 1 was visible to unassigned Doctor 2")

        # Direct access by Doctor 2 MUST be rejected with 403 Forbidden
        doc2_forbidden_get = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(doc2_forbidden_get.status_code, 403, "Doctor 2 was not forbidden from accessing Doctor 1's patient")

        # Doctor 2 attempting to order lab tests MUST be rejected with 403 Forbidden
        doc2_forbidden_order = self.client.post(f"/api/patients/{patient_id}/lab-orders", json={
            "test_type": "Renal Function Test (RFT)",
            "priority": "Routine",
        })
        self.assertEqual(doc2_forbidden_order.status_code, 403, "Doctor 2 was not forbidden from ordering tests for Doctor 1's patient")

        self._logout()


if __name__ == "__main__":
    unittest.main()

