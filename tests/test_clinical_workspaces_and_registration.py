import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
import io

sys.path.insert(0, os.getcwd())

from app import create_app
from app.models import db
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.prediction import Prediction
from app.models.activity_log import ActivityLog


class ClinicalWorkspacesAndRegistrationTestSuite(unittest.TestCase):
    """
    Test suite for Combined Prompt 2:
    - Part A: Patient Registration UX & Backend API
    - Part B: Lab Technician Workspace
    - Part C: Hepatologist Workspace
    - Part E & F: Data Integrity, Isolation & Security

    Runs strictly in an isolated temporary SQLite database.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name

        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_clinical_uploads_")

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.test_upload_dir,
            "EXPOSE_DEV_RESET_URL": False,
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Database safety check: Never target active DB
        db_uri = self.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"SAFETY VIOLATION: Test targeting {db_uri}"

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed isolated test users
        self.admin = User(name="Administrator", email="admin@careai.com", role="admin")
        self.admin.set_password("Admin@123")

        self.labtech = User(name="Lab Technician", email="lab@careai.com", role="labtech")
        self.labtech.set_password("LabTech@123")

        self.doctor = User(name="Dr. Jane Hepatologist", email="doctor@careai.com", role="hepatologist")
        self.doctor.set_password("Doctor@123")

        self.other_doctor = User(name="Dr. Other", email="other_doc@careai.com", role="hepatologist")
        self.other_doctor.set_password("Doctor@123")

        self.patient_user = User(name="Patient Demo", email="patient@careai.com", role="patient")
        self.patient_user.set_password("Patient@123")

        db.session.add_all([self.admin, self.labtech, self.doctor, self.other_doctor, self.patient_user])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

        if os.path.exists(self.test_upload_dir):
            try:
                import shutil
                shutil.rmtree(self.test_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def login_as(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    # =========================================================================
    # PART A: PATIENT REGISTRATION TESTS
    # =========================================================================

    def test_authorized_patient_registration_succeeds_labtech(self):
        """Verify lab technician can register a new patient directly with generated portal_id."""
        self.login_as("lab@careai.com", "LabTech@123")

        payload = {
            "full_name": "Eleanor Vance",
            "age": 48,
            "gender": "Female",
            "phone": "+1-555-0199",
            "email": "eleanor@example.com",
            "bilirubin": 1.4,
            "albumin": 3.6,
            "platelets": 210,
        }
        res = self.client.post("/api/patients", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        patient = data.get("patient")
        self.assertIsNotNone(patient)
        self.assertEqual(patient["full_name"], "Eleanor Vance")
        self.assertTrue(patient["portal_id"].startswith("CC-"))
        self.assertEqual(patient["age"], 48)
        self.assertEqual(patient["gender"], "Female")

    def test_authorized_patient_registration_succeeds_admin(self):
        """Verify admin can register a patient."""
        self.login_as("admin@careai.com", "Admin@123")

        payload = {
            "full_name": "Marcus Aurelius",
            "age": 55,
            "gender": "Male",
        }
        res = self.client.post("/api/patients", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["patient"]["full_name"], "Marcus Aurelius")

    def test_unauthorized_roles_rejected_from_patient_registration(self):
        """Verify hepatologist and patient cannot call POST /api/patients."""
        # Hepatologist
        self.login_as("doctor@careai.com", "Doctor@123")
        res_doc = self.client.post("/api/patients", json={"full_name": "Invalid Reg", "age": 40, "gender": "Male"})
        self.assertEqual(res_doc.status_code, 403)

        # Patient
        self.login_as("patient@careai.com", "Patient@123")
        res_pat = self.client.post("/api/patients", json={"full_name": "Invalid Reg", "age": 40, "gender": "Male"})
        self.assertEqual(res_pat.status_code, 403)

        # Unauthenticated
        self.client.post("/api/auth/logout")
        res_unauth = self.client.post("/api/patients", json={"full_name": "Invalid Reg", "age": 40, "gender": "Male"})
        self.assertEqual(res_unauth.status_code, 401)

    def test_registration_validation_required_fields(self):
        """Verify registration rejects missing full_name, invalid age, or invalid gender."""
        self.login_as("lab@careai.com", "LabTech@123")

        # Missing full_name
        res1 = self.client.post("/api/patients", json={"age": 45, "gender": "Male"})
        self.assertIn(res1.status_code, [400, 422])

        # Empty full_name
        res2 = self.client.post("/api/patients", json={"full_name": "   ", "age": 45, "gender": "Male"})
        self.assertIn(res2.status_code, [400, 422])

        # Non-numeric age
        res3 = self.client.post("/api/patients", json={"full_name": "Test Patient", "age": "not_a_number", "gender": "Male"})
        self.assertIn(res3.status_code, [400, 422])

    def test_patient_list_reflects_registered_patient(self):
        """Verify patient list includes the newly created patient immediately."""
        self.login_as("lab@careai.com", "LabTech@123")
        create_res = self.client.post("/api/patients", json={"full_name": "Clara Oswald", "age": 28, "gender": "Female"})
        self.assertEqual(create_res.status_code, 201)
        portal_id = create_res.get_json()["patient"]["portal_id"]

        list_res = self.client.get("/api/patients")
        self.assertEqual(list_res.status_code, 200)
        patients = list_res.get_json().get("patients", [])
        portal_ids = [p["portal_id"] for p in patients]
        self.assertIn(portal_id, portal_ids)

    # =========================================================================
    # PART B: LAB TECHNICIAN WORKSPACE TESTS
    # =========================================================================

    def test_labtech_dashboard_metrics_match_actual_database(self):
        """Verify lab tech dashboard stats return exact counts from the database."""
        self.login_as("lab@careai.com", "LabTech@123")

        # Initial stats: 0 patients
        res1 = self.client.get("/api/dashboard/stats")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()
        self.assertEqual(data1["role"], "labtech")
        stats1 = data1["stats"]
        self.assertEqual(stats1["total_patients"], 0)
        self.assertEqual(stats1["reports_uploaded"], 0)

        # Register 2 patients
        p1 = Patient(full_name="Patient One", age=50, gender="Male", portal_id="PAT-0001", treatment_status="Awaiting review", latest_risk_label="High Risk")
        p2 = Patient(full_name="Patient Two", age=60, gender="Female", portal_id="PAT-0002", treatment_status="Stable", latest_risk_label="Low Risk")
        db.session.add_all([p1, p2])
        db.session.commit()

        # Add 1 report
        r1 = Report(patient_id=p1.id, filename="test_lab.pdf", original_filename="test_lab.pdf", category="Liver Function Test (LFT)")
        db.session.add(r1)
        db.session.commit()

        res2 = self.client.get("/api/dashboard/stats")
        self.assertEqual(res2.status_code, 200)
        stats2 = res2.get_json()["stats"]
        self.assertEqual(stats2["total_patients"], 2)
        self.assertEqual(stats2["reports_uploaded"], 1)
        self.assertEqual(stats2["high_risk"], 1)
        self.assertEqual(stats2["low_risk"], 1)
        self.assertEqual(stats2["awaiting_review"], 1)

    def test_direct_ai_prediction_endpoint(self):
        """Verify direct AI prediction evaluation endpoint works with calibrated biomarkers."""
        self.login_as("lab@careai.com", "LabTech@123")

        payload = {
            "age": 52,
            "gender": "Male",
            "bilirubin": 2.5,
            "albumin": 2.9,
            "sgot": 65,
            "sgpt": 58,
            "platelets": 110,
            "cholesterol": 190,
            "copper": 80,
            "alk_phos": 140,
            "triglycerides": 130,
            "prothrombin": 14.2,
            "ascites": True,
            "hepatomegaly": True,
            "spiders": False,
            "edema": True,
        }
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("probability", data)
        self.assertIn("risk_label", data)
        self.assertIn(data["risk_label"], ["Low Risk", "Medium Risk", "High Risk"])
        self.assertIsInstance(data["biomarker_flags"], list)

    def test_report_upload_workflow_and_validation(self):
        """Verify report upload endpoint accepts valid documents and updates counts."""
        self.login_as("lab@careai.com", "LabTech@123")

        # Create patient to attach report
        patient = Patient(full_name="Report Patient", age=45, gender="Male", portal_id="PAT-REP-1")
        db.session.add(patient)
        db.session.commit()

        # Upload a valid PDF via /api/reports/upload
        file_content = b"%PDF-1.4 Mock Clinical Report Content"
        data = {
            "file": (io.BytesIO(file_content), "blood_panel.pdf"),
            "patient_id": str(patient.id),
            "category": "Complete Blood Count (CBC)",
        }
        upload_res = self.client.post(
            "/api/reports/upload",
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 201)
        upload_data = upload_res.get_json()
        self.assertTrue(upload_data.get("success"))

        # Verify report appears in reports list
        list_res = self.client.get(f"/api/reports?patient_id={patient.id}")
        self.assertEqual(list_res.status_code, 200)
        reports = list_res.get_json().get("reports", [])
        self.assertTrue(any(r["original_filename"] == "blood_panel.pdf" for r in reports))

    # =========================================================================
    # PART C: HEPATOLOGIST WORKSPACE TESTS
    # =========================================================================

    def test_hepatologist_dashboard_strictly_scoped_to_assigned_patients(self):
        """Verify hepatologist dashboard does NOT expose another clinician's patients."""
        # Patient 1 assigned to Dr. Jane (self.doctor) via appointment
        p1 = Patient(full_name="Jane Patient", age=40, gender="Female", portal_id="PAT-DOC-1", latest_risk_label="High Risk", latest_risk_percent=85, treatment_status="Needs urgent review")
        # Patient 2 assigned to Dr. Other (self.other_doctor) via appointment
        p2 = Patient(full_name="Other Doc Patient", age=65, gender="Male", portal_id="PAT-DOC-2", latest_risk_label="High Risk", latest_risk_percent=90, treatment_status="Needs urgent review")
        db.session.add_all([p1, p2])
        db.session.commit()

        appnt1 = Appointment(patient_id=p1.id, doctor_id=self.doctor.id, scheduled_at=datetime.utcnow() + timedelta(days=2), reason="Cirrhosis staging", status="Confirmed")
        appnt2 = Appointment(patient_id=p2.id, doctor_id=self.other_doctor.id, scheduled_at=datetime.utcnow() + timedelta(days=3), reason="Routine check", status="Confirmed")
        db.session.add_all([appnt1, appnt2])
        db.session.commit()

        # Log in as Dr. Jane
        self.login_as("doctor@careai.com", "Doctor@123")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["role"], "hepatologist")

        # Stats should reflect only 1 assigned patient
        stats = data["stats"]
        self.assertEqual(stats["assigned_patients"], 1)

        # Priority patients must contain Jane Patient and NEVER Other Doc Patient
        priority_patients = data.get("priority_patients", [])
        portal_ids = [p["portal_id"] for p in priority_patients]
        self.assertIn("PAT-DOC-1", portal_ids)
        self.assertNotIn("PAT-DOC-2", portal_ids)

        # Appointments should only contain Dr. Jane's appointment
        appointments = data.get("appointments", [])
        appnt_doc_ids = [a["doctor_id"] for a in appointments]
        self.assertTrue(all(d_id == self.doctor.id for d_id in appnt_doc_ids))

    def test_hepatologist_review_status_update(self):
        """Verify hepatologist can update patient review status."""
        self.login_as("doctor@careai.com", "Doctor@123")

        p = Patient(full_name="Status Test Patient", age=50, gender="Male", portal_id="PAT-STAT-1", treatment_status="Awaiting review")
        db.session.add(p)
        db.session.commit()

        # Update status
        res = self.client.patch(
            f"/api/patients/{p.id}/review-status",
            json={"treatment_status": "Under treatment"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["patient"]["treatment_status"], "Under treatment")

        # Check DB reflects change
        db.session.expire_all()
        reloaded = Patient.query.get(p.id)
        self.assertEqual(reloaded.treatment_status, "Under treatment")

    def test_hepatologist_empty_state_clean_response(self):
        """Verify hepatologist with 0 assigned patients receives clean 0-counts and empty lists."""
        self.login_as("doctor@careai.com", "Doctor@123")

        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["stats"]["assigned_patients"], 0)
        self.assertEqual(data["stats"]["pending_clinical_reviews"], 0)
        self.assertEqual(len(data["priority_patients"]), 0)
        self.assertEqual(len(data["appointments"]), 0)
        self.assertEqual(len(data["recent_activity"]), 0)


if __name__ == "__main__":
    unittest.main()
