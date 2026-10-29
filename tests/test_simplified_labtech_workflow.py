import io
import json
import os
import re
import shutil
import tempfile
import unittest

from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class SimplifiedLabTechWorkflowTestCase(unittest.TestCase):
    """
    Verification test suite for the simplified Lab Technician 4-Task Workflow:
    Task 1: Register Patient (auto-generates Patient ID & PIN, initial status Registered)
    Task 2: Enter Test Results (Total Bili, Direct Bili, SGOT, SGPT, Albumin, Platelets, Alk Phos)
    Task 3: Upload PDF Report (uploaded PDF linked to Patient ID, downloadable)
    Task 4: Update Patient Status (Registered, Test In Progress, Report Uploaded, Completed)
    Role Safeguards: Only authorized Lab Technicians can perform these actions.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_simple_lab_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="simple_lab_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "simplified-labtech-test-secret-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "simplified-labtech-test-secret-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            self.admin = User(name="Admin Morgan", email="admin@clinic.org", role="admin")
            self.admin.set_password("Admin@1234")

            self.labtech = User(name="Alex Rivera", email="labtech@clinic.org", role="labtech")
            self.labtech.set_password("LabTech@1234")

            self.doctor = User(name="Dr. Sarah Jenkins", email="doctor@clinic.org", role="hepatologist")
            self.doctor.set_password("Doctor@1234")

            db.session.add_all([self.admin, self.labtech, self.doctor])
            db.session.commit()

            self.doctor_id = self.doctor.id
            self.labtech_id = self.labtech.id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

        if os.path.exists(self.db_path):
            try:
                os.remove(self.db_path)
            except OSError:
                pass

        if os.path.exists(self.temp_upload_dir):
            try:
                shutil.rmtree(self.temp_upload_dir)
            except OSError:
                pass

    def _login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def _logout(self):
        return self.client.post("/api/auth/logout")

    def test_01_task_1_register_patient_generates_id_and_sets_registered(self):
        """
        Task 1: Register Patient
        - Simple form to register patient (name, age, gender, phone).
        - Generates unique Patient ID matching CC-YYYY-XXXX.
        - Sets initial status to Registered.
        """
        self._login("labtech@clinic.org", "LabTech@1234")

        res = self.client.post("/api/patients", json={
            "full_name": "Dev Sharma",
            "age": 46,
            "gender": "Male",
            "phone": "+91-9876543210",
            "assigned_doctor_id": self.doctor_id,
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])

        patient = data["patient"]
        portal_id = patient["portal_id"]
        self.assertTrue(re.match(r"^CC-\d{4}-\d{4}$", portal_id))
        self.assertEqual(patient["treatment_status"], "Registered")
        self.assertIsNotNone(data["initial_pin"])

        self._logout()

    def test_02_task_2_enter_test_results(self):
        """
        Task 2: Enter Test Results
        - Enter Total Bilirubin, Direct Bilirubin, SGOT (AST), SGPT (ALT), Albumin, Platelets.
        - Save against correct Patient ID.
        """
        self._login("labtech@clinic.org", "LabTech@1234")

        # Register patient
        reg_res = self.client.post("/api/patients", json={
            "full_name": "Anita Verma",
            "age": 52,
            "gender": "Female",
        })
        patient_id = reg_res.get_json()["patient"]["id"]
        portal_id = reg_res.get_json()["patient"]["portal_id"]

        # Enter actual laboratory test results
        update_res = self.client.put(f"/api/patients/{patient_id}", json={
            "bilirubin": 2.4,
            "direct_bilirubin": 0.9,
            "sgot": 68,
            "sgpt": 75,
            "albumin": 3.1,
            "platelets": 175,
            "prothrombin": 12.8,
            "alk_phos": 120,
        })
        self.assertEqual(update_res.status_code, 200)
        data = update_res.get_json()
        self.assertTrue(data["success"])

        pat = data["patient"]
        self.assertEqual(pat["portal_id"], portal_id)
        self.assertEqual(pat["bilirubin"], 2.4)
        self.assertEqual(pat["direct_bilirubin"], 0.9)
        self.assertEqual(pat["sgot"], 68)
        self.assertEqual(pat["sgpt"], 75)
        self.assertEqual(pat["albumin"], 3.1)
        self.assertEqual(pat["platelets"], 175)
        self.assertEqual(pat["prothrombin"], 12.8)
        self.assertEqual(pat["alk_phos"], 120)

        # Confirm persisted in DB
        with self.app.app_context():
            db_pat = db.session.get(Patient, patient_id)
            self.assertEqual(db_pat.direct_bilirubin, 0.9)
            self.assertEqual(db_pat.bilirubin, 2.4)

        self._logout()

    def test_03_task_3_upload_pdf_report_and_download(self):
        """
        Task 3: Upload PDF Report
        - One simple upload action linked to patient.
        - Upload diagnostic PDF report.
        - Report is downloadable by authorized user.
        """
        self._login("labtech@clinic.org", "LabTech@1234")

        reg_res = self.client.post("/api/patients", json={
            "full_name": "Rohan Mehra",
            "age": 39,
            "gender": "Male",
        })
        patient_id = reg_res.get_json()["patient"]["id"]

        dummy_pdf = (io.BytesIO(b"%PDF-1.4 Clinical Diagnostic Liver Test Report for Rohan"), "liver_report.pdf")
        upload_res = self.client.post(
            f"/api/patients/{patient_id}/reports",
            data={
                "report": dummy_pdf,
                "category": "Liver Function Test (LFT)",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 201)
        data = upload_res.get_json()
        self.assertTrue(data["success"])
        report_id = data["report"]["id"]

        # Verify patient record now lists this report and status is Report Uploaded
        pat_res = self.client.get(f"/api/patients/{patient_id}")
        self.assertEqual(pat_res.status_code, 200)
        pat_data = pat_res.get_json()["patient"]
        self.assertEqual(len(pat_data["reports"]), 1)
        self.assertEqual(pat_data["reports"][0]["id"], report_id)
        self.assertEqual(pat_data["treatment_status"], "Report Uploaded")

        # Download report
        dl_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(dl_res.status_code, 200)
        self.assertIn(b"%PDF-1.4 Clinical Diagnostic Liver Test Report", dl_res.data)

        self._logout()

    def test_04_task_4_update_patient_status_dropdown(self):
        """
        Task 4: Update Patient Status
        - Provide simple status transitions:
          Registered -> Test In Progress -> Report Uploaded -> Completed
        """
        self._login("labtech@clinic.org", "LabTech@1234")

        reg_res = self.client.post("/api/patients", json={
            "full_name": "Sunita Patil",
            "age": 60,
            "gender": "Female",
        })
        patient_id = reg_res.get_json()["patient"]["id"]

        statuses_to_test = ["Test In Progress", "Report Uploaded", "Completed", "Registered"]

        for st in statuses_to_test:
            up_res = self.client.put(f"/api/patients/{patient_id}", json={
                "treatment_status": st,
            })
            self.assertEqual(up_res.status_code, 200)
            self.assertEqual(up_res.get_json()["patient"]["treatment_status"], st)

            # Check DB
            with self.app.app_context():
                p = db.session.get(Patient, patient_id)
                self.assertEqual(p.treatment_status, st)

        self._logout()

    def test_05_rbac_safeguards_non_labtech_cannot_mutate(self):
        """
        Verify RBAC boundaries:
        - Admin or Doctor cannot register patients via POST /api/patients (403)
        - Admin or Doctor cannot update test results via PUT /api/patients/<id> (403)
        - Admin or Doctor cannot upload lab reports via POST /api/patients/<id>/reports (403)
        """
        # 1. Create a patient as lab tech first
        self._login("labtech@clinic.org", "LabTech@1234")
        res = self.client.post("/api/patients", json={"full_name": "Karan Malhotra", "age": 44, "gender": "Male"})
        patient_id = res.get_json()["patient"]["id"]
        self._logout()

        # 2. Doctor attempts
        self._login("doctor@clinic.org", "Doctor@1234")
        doc_reg = self.client.post("/api/patients", json={"full_name": "Doc Intake", "age": 40, "gender": "Male"})
        self.assertEqual(doc_reg.status_code, 403)

        doc_update = self.client.put(f"/api/patients/{patient_id}", json={"bilirubin": 3.0})
        self.assertEqual(doc_update.status_code, 403)

        doc_upload = self.client.post(
            f"/api/patients/{patient_id}/reports",
            data={"report": (io.BytesIO(b"%PDF-1.4"), "test.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(doc_upload.status_code, 403)
        self._logout()

        # 3. Admin attempts
        self._login("admin@clinic.org", "Admin@1234")
        adm_reg = self.client.post("/api/patients", json={"full_name": "Admin Intake", "age": 40, "gender": "Male"})
        self.assertEqual(adm_reg.status_code, 403)

        adm_update = self.client.put(f"/api/patients/{patient_id}", json={"bilirubin": 3.0})
        self.assertEqual(adm_update.status_code, 403)

        adm_upload = self.client.post(
            f"/api/patients/{patient_id}/reports",
            data={"report": (io.BytesIO(b"%PDF-1.4"), "test.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(adm_upload.status_code, 403)
        self._logout()


if __name__ == "__main__":
    unittest.main()

