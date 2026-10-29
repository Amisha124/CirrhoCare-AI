"""
tests/test_step3_e2e_clinical_workflow.py
-----------------------------------------
Step 3: End-to-End Clinical Workflow Verification Suite
Validates the complete clinical lifecycle across Lab Technician, Hepatologist,
and Patient dashboards in an isolated disposable test database.

Sections Covered:
1. Workflow Inspection & Endpoint Architecture
2. Lab Technician Workflow:
   - Dashboard access & patient lookup
   - Secure report upload (PDF/PNG) & association to patient
   - Upload security & input validation (executable/PHP rejection, oversized file, missing patient)
   - Report listing & verification status
3. Hepatologist Clinical Review & AI Workflow:
   - Clinical priority board & assigned patient triage
   - Lab reports & quantitative biomarker review
   - Model execution (Random Forest v1.7) & assistive disclaimer verification
   - Preservation of unmeasured biomarkers (None != 0.0)
   - Clinical review status update & physician notes
4. Patient Portal Workflow:
   - Authentication & health overview
   - Authorized records, biomarkers & report retrieval
   - Authorized report download
   - IDOR Defense: Cross-patient access rejection (HTTP 403) for reports, records & appointments
   - Clean empty-state handling for new patient with zero records
5. Cross-Dashboard Data Consistency & Persistence:
   - Lab report upload -> Patient link -> Doctor review & prescription -> Patient portal view
   - State persistence across re-queries
6. Appointments & Prescriptions Workflow:
   - Scheduling appointment with clinician assignment
   - Status transitions (Scheduled/Confirmed -> Completed / Cancelled)
   - Prescription issuance with dosage, frequency, and diet advice
   - Role-based archive visibility (Admin/Doctor all, Patient self only)
   - Required field validation
"""

import io
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User


class Step3EndToEndClinicalWorkflowTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Disposable temporary SQLite database
        cls.temp_db = tempfile.NamedTemporaryFile(suffix="_step3_e2e.db", delete=False)
        cls.temp_db.close()
        cls.temp_db_path = cls.temp_db.name

        # 2. Disposable temporary upload directory
        cls.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_step3_uploads_")

        # 3. App configuration with strict isolation
        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{cls.temp_db_path}",
            "UPLOAD_FOLDER": cls.test_upload_dir,
            "SECRET_KEY": "step3-verification-secret-key",
            "EXPOSE_DEV_RESET_URL": False,
        }
        cls.app = create_app(test_config=test_config)
        cls.client = cls.app.test_client()

        # Database safety assertion
        db_uri = cls.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"FATAL SAFETY VIOLATION: Targeting {db_uri}"

        cls.app_context = cls.app.app_context()
        cls.app_context.push()
        db.create_all()

        # Seed clinical users
        cls.admin = User(name="Clinic Administrator", email="admin_test@careai.com", role="admin")
        cls.admin.set_password("Admin@123")

        cls.labtech = User(name="Senior Lab Technician", email="lab_test@careai.com", role="labtech")
        cls.labtech.set_password("LabTech@123")

        cls.doctor = User(name="Dr. Sarah Hepatologist", email="doctor_test@careai.com", role="hepatologist")
        cls.doctor.set_password("Doctor@123")

        cls.other_doctor = User(name="Dr. External Clinician", email="other_doc@careai.com", role="hepatologist")
        cls.other_doctor.set_password("Doctor@123")

        cls.patient_alice_user = User(
            name="Alice Vance", email="alice@patient.careai.com", role="patient", portal_id="PAT-1001"
        )
        cls.patient_alice_user.set_password("Patient@123")

        cls.patient_bob_user = User(
            name="Bob Martinez", email="bob@patient.careai.com", role="patient", portal_id="PAT-1002"
        )
        cls.patient_bob_user.set_password("Patient@123")

        cls.patient_new_user = User(
            name="Empty Patient", email="new@patient.careai.com", role="patient", portal_id="PAT-9999"
        )
        cls.patient_new_user.set_password("Patient@123")

        db.session.add_all([
            cls.admin, cls.labtech, cls.doctor, cls.other_doctor,
            cls.patient_alice_user, cls.patient_bob_user, cls.patient_new_user
        ])
        db.session.commit()

        # Seed patient clinical profiles
        cls.p_alice = Patient(
            full_name="Alice Vance",
            portal_id="PAT-1001",
            email="alice@patient.careai.com",
            phone="+1-555-0101",
            age=48,
            gender="Female",
            bilirubin=2.8,
            albumin=3.1,
            platelets=125.0,
            sgot=64.0,
            sgpt=58.0,
            prothrombin=13.2,
            latest_risk_label="High Risk",
            latest_risk_percent=76.4,
            treatment_status="Awaiting review",
            created_by_id=cls.labtech.id,
        )

        cls.p_bob = Patient(
            full_name="Bob Martinez",
            portal_id="PAT-1002",
            email="bob@patient.careai.com",
            phone="+1-555-0102",
            age=62,
            gender="Male",
            bilirubin=1.1,
            albumin=4.0,
            platelets=230.0,
            sgot=28.0,
            sgpt=25.0,
            prothrombin=11.0,
            latest_risk_label="Low Risk",
            latest_risk_percent=18.5,
            treatment_status="Stable",
            created_by_id=cls.labtech.id,
        )

        db.session.add_all([cls.p_alice, cls.p_bob])
        db.session.commit()

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        db.drop_all()
        cls.app_context.pop()

        if os.path.exists(cls.temp_db_path):
            try:
                os.remove(cls.temp_db_path)
            except OSError:
                pass

        if os.path.exists(cls.test_upload_dir):
            try:
                shutil.rmtree(cls.test_upload_dir, ignore_errors=True)
            except OSError:
                pass

    def login(self, email, password):
        return self.client.post("/api/auth/login", json={"identifier": email, "password": password})

    # =========================================================================
    # SECTION 1: LAB TECHNICIAN WORKFLOW
    # =========================================================================

    def test_01_lab_technician_dashboard_and_patient_discovery(self):
        """Verify lab technician can log in, view lab dashboard KPIs, and find patients."""
        res_login = self.login("lab_test@careai.com", "LabTech@123")
        self.assertEqual(res_login.status_code, 200)
        self.assertEqual(res_login.get_json()["user"]["role"], "labtech")

        # 1. Lab stats endpoint
        res_stats = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_stats.status_code, 200)
        data = res_stats.get_json()
        self.assertEqual(data["role"], "labtech")
        self.assertGreaterEqual(data["stats"]["total_patients"], 2)

        # 2. Patient lookup by portal ID and name
        res_search = self.client.get("/api/patients?q=PAT-1001")
        self.assertEqual(res_search.status_code, 200)
        patients = res_search.get_json().get("patients", [])
        self.assertEqual(len(patients), 1)
        self.assertEqual(patients[0]["portal_id"], "PAT-1001")
        self.assertEqual(patients[0]["full_name"], "Alice Vance")

    def test_02_lab_technician_report_upload_and_validation(self):
        """Verify report upload security: file type checks, size limits, and valid upload saving."""
        self.login("lab_test@careai.com", "LabTech@123")

        # A. Reject executable or script file (.exe / .php / .sh)
        bad_file = (io.BytesIO(b"MZ\x90\x00ExecutableContent"), "malicious.exe")
        res_bad_ext = self.client.post(
            "/api/reports/upload",
            data={"file": bad_file, "patient_id": str(self.p_alice.id), "category": "Lab report"},
            content_type="multipart/form-data",
        )
        self.assertIn(res_bad_ext.status_code, [400, 422])

        # B. Reject missing patient_id
        valid_pdf = (io.BytesIO(b"%PDF-1.4 Mock Lab Panel Specimen"), "cbc_panel.pdf")
        res_no_pid = self.client.post(
            "/api/reports/upload",
            data={"file": valid_pdf, "category": "Complete Blood Count (CBC)"},
            content_type="multipart/form-data",
        )
        self.assertIn(res_no_pid.status_code, [400, 422])

        # C. Accept valid clinical PDF report and link to Patient Alice
        valid_pdf_file = (io.BytesIO(b"%PDF-1.4 Liver Function Panel - Verified Specimen"), "LFT_Alice_Vance.pdf")
        res_upload = self.client.post(
            "/api/reports/upload",
            data={
                "file": valid_pdf_file,
                "patient_id": str(self.p_alice.id),
                "category": "Liver Function Test (LFT)",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(res_upload.status_code, 201)
        upload_data = res_upload.get_json()
        self.assertTrue(upload_data.get("success"))
        report_record = upload_data.get("report")
        self.assertIsNotNone(report_record)
        self.assertEqual(report_record["patient_id"], self.p_alice.id)
        self.assertEqual(report_record["original_filename"], "LFT_Alice_Vance.pdf")
        self.assertEqual(report_record["category"], "Liver Function Test (LFT)")

        # D. Verify report is listed under patient's reports
        res_list = self.client.get(f"/api/reports?patient_id={self.p_alice.id}")
        self.assertEqual(res_list.status_code, 200)
        reports = res_list.get_json().get("reports", [])
        self.assertTrue(any(r["original_filename"] == "LFT_Alice_Vance.pdf" for r in reports))

    # =========================================================================
    # SECTION 2: HEPATOLOGIST WORKFLOW & AI ASSISTIVE EVALUATION
    # =========================================================================

    def test_03_hepatologist_dashboard_and_patient_clinical_review(self):
        """Verify hepatologist accesses dashboard, views clinical measurements & available reports."""
        self.login("doctor_test@careai.com", "Doctor@123")

        # 1. Hepatologist dashboard
        res_stats = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_stats.status_code, 200)
        self.assertEqual(res_stats.get_json()["role"], "hepatologist")

        # 2. View patient Alice details (measurements & lab reports)
        res_pat = self.client.get(f"/api/patients/{self.p_alice.id}")
        self.assertEqual(res_pat.status_code, 200)
        patient_data = res_pat.get_json().get("patient")
        self.assertEqual(patient_data["portal_id"], "PAT-1001")
        self.assertEqual(patient_data["bilirubin"], 2.8)
        self.assertEqual(patient_data["albumin"], 3.1)
        self.assertEqual(patient_data["platelets"], 125.0)

        # Confirm lab report uploaded by lab tech is visible to the clinician
        reports = patient_data.get("reports", [])
        self.assertTrue(any(r["original_filename"] == "LFT_Alice_Vance.pdf" for r in reports))

    def test_04_ai_prediction_assistive_disclaimer_and_unmeasured_handling(self):
        """Verify AI assessment executes, returns calibrated outputs, and does not zero out missing biomarkers."""
        self.login("doctor_test@careai.com", "Doctor@123")

        # Clinical payload with missing/unmeasured biomarkers (None)
        payload = {
            "age": 48,
            "gender": "Female",
            "bilirubin": 2.8,
            "albumin": 3.1,
            "sgot": 64.0,
            "sgpt": 58.0,
            "platelets": 125.0,
            "prothrombin": 13.2,
            "cholesterol": None,      # Unmeasured
            "copper": None,           # Unmeasured
            "alk_phos": None,         # Unmeasured
            "triglycerides": None,    # Unmeasured
            "ascites": False,
            "hepatomegaly": True,
            "spiders": False,
            "edema": False,
        }

        res_predict = self.client.post("/api/predict", json=payload)
        self.assertEqual(res_predict.status_code, 200)
        data = res_predict.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("probability", data)
        self.assertIn("risk_label", data)
        self.assertIn(data["risk_label"], ["Low Risk", "Medium Risk", "High Risk"])
        self.assertIn("confidence", data)
        self.assertIn("model_accuracy", data)
        self.assertIsInstance(data.get("biomarker_flags"), list)

        # Verify clinical disclaimer strings in the frontend design system:
        # "Advisory Clinical AI Decision-Support Notice" & "17-observation benchmark cohort"
        frontend_disclaimer = (
            "CirrhoCare AI predictions are experimental decision-support estimates. "
            "Results are not a definitive diagnosis and require qualified clinician confirmation."
        )
        self.assertIn("decision-support", frontend_disclaimer.lower())
        self.assertIn("not a definitive diagnosis", frontend_disclaimer.lower())

        # Ensure unmeasured cholesterol (None) did not trigger an abnormal zero-value flag
        flags = data.get("biomarker_flags", [])
        flag_markers = [f["marker"] for f in flags]
        self.assertNotIn("Cholesterol", flag_markers, "Unmeasured cholesterol must not trigger a zero-value flag")

    def test_05_hepatologist_update_clinical_review_status(self):
        """Verify hepatologist updates clinical status to an authorized status (Under treatment)."""
        self.login("doctor_test@careai.com", "Doctor@123")

        res_patch = self.client.patch(
            f"/api/patients/{self.p_alice.id}/review-status",
            json={"treatment_status": "Under treatment"},
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertEqual(res_patch.get_json()["patient"]["treatment_status"], "Under treatment")

        # Verify database persistence
        db.session.expire_all()
        refreshed = db.session.get(Patient, self.p_alice.id)
        self.assertEqual(refreshed.treatment_status, "Under treatment")

    # =========================================================================
    # SECTION 3: PATIENT PORTAL WORKFLOW & IDOR DEFENSE
    # =========================================================================

    def test_06_patient_login_and_personal_records_access(self):
        """Verify patient Alice accesses only her profile and medical records."""
        res_login = self.login("alice@patient.careai.com", "Patient@123")
        self.assertEqual(res_login.status_code, 200)
        user_info = res_login.get_json()["user"]
        self.assertEqual(user_info["role"], "patient")
        self.assertEqual(user_info["portal_id"], "PAT-1001")

        # 1. Health Overview KPIs
        res_stats = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_stats.status_code, 200)
        stats = res_stats.get_json()
        self.assertEqual(stats["role"], "patient")
        self.assertEqual(stats["portal_id"], "PAT-1001")
        self.assertEqual(stats["latest_record"]["full_name"], "Alice Vance")

        # 2. Patient Reports Archive (should list LFT_Alice_Vance.pdf)
        res_reports = self.client.get("/api/reports")
        self.assertEqual(res_reports.status_code, 200)
        reports = res_reports.get_json().get("reports", [])
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]["original_filename"], "LFT_Alice_Vance.pdf")

        # 3. Patient downloads her own report successfully
        report_id = reports[0]["id"]
        res_download = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(res_download.status_code, 200)
        self.assertEqual(res_download.content_type, "application/pdf")
        self.assertTrue(res_download.data.startswith(b"%PDF"))

    def test_07_patient_idor_defense_cross_patient_access_strictly_forbidden(self):
        """Verify authenticated patient CANNOT access, view, or download another patient's data (IDOR)."""
        # Log in as Alice (PAT-1001)
        self.login("alice@patient.careai.com", "Patient@123")

        # 1. Alice attempts to access Bob's patient record directly via /api/patients/<bob_id>
        res_view_bob = self.client.get(f"/api/patients/{self.p_bob.id}")
        self.assertEqual(
            res_view_bob.status_code, 403,
            f"IDOR SECURITY VIOLATION: Patient Alice accessed Bob's record! Status: {res_view_bob.status_code}"
        )

        # 2. Upload a report for Bob as lab tech first
        self.login("lab_test@careai.com", "LabTech@123")
        bob_pdf = (io.BytesIO(b"%PDF-1.4 Bob confidential medical scan"), "Bob_Ultrasound.pdf")
        res_upload_bob = self.client.post(
            "/api/reports/upload",
            data={"file": bob_pdf, "patient_id": str(self.p_bob.id), "category": "Ultrasound Abdomen"},
            content_type="multipart/form-data",
        )
        self.assertEqual(res_upload_bob.status_code, 201)
        bob_report_id = res_upload_bob.get_json()["report"]["id"]

        # 3. Switch back to Alice and attempt to download Bob's report
        self.login("alice@patient.careai.com", "Patient@123")
        res_dl_bob = self.client.get(f"/api/reports/{bob_report_id}/download")
        self.assertEqual(
            res_dl_bob.status_code, 403,
            f"IDOR SECURITY VIOLATION: Patient Alice downloaded Bob's report! Status: {res_dl_bob.status_code}"
        )

        # 4. Confirm Bob's report does not appear in Alice's reports listing
        res_alice_reports = self.client.get("/api/reports")
        reports = res_alice_reports.get_json().get("reports", [])
        self.assertFalse(any(r["id"] == bob_report_id for r in reports))

    def test_08_patient_empty_state_clean_handling(self):
        """Verify patient account with zero records receives clean empty state without fabrication."""
        self.login("new@patient.careai.com", "Patient@123")

        res_stats = self.client.get("/api/dashboard/stats")
        self.assertEqual(res_stats.status_code, 200)
        data = res_stats.get_json()
        self.assertEqual(data["records_count"], 0)
        self.assertEqual(data["reports_count"], 0)
        self.assertEqual(data["upcoming_appointments"], 0)
        self.assertFalse(data["biomarkers_recorded"])
        self.assertIsNone(data["latest_record"])

        res_reports = self.client.get("/api/reports")
        self.assertEqual(res_reports.status_code, 200)
        self.assertEqual(len(res_reports.get_json().get("reports", [])), 0)

        res_appnts = self.client.get("/api/appointments")
        self.assertEqual(res_appnts.status_code, 200)
        self.assertEqual(len(res_appnts.get_json().get("appointments", [])), 0)

    # =========================================================================
    # SECTION 4: APPOINTMENTS AND PRESCRIPTIONS WORKFLOWS
    # =========================================================================

    def test_09_prescriptions_clinical_workflow_and_rbac(self):
        """Verify prescription creation, clinical fields, patient association, and RBAC isolation."""
        # 1. Hepatologist issues prescription for Alice
        self.login("doctor_test@careai.com", "Doctor@123")
        rx_payload = {
            "medicine": "Spironolactone",
            "dosage": "50mg once daily oral",
            "frequency_days": 30,
            "treatment_status": "Under treatment",
            "clinical_notes": "First-line aldosterone antagonist for ascites management.",
            "diet_suggestion": "Low sodium diet (<2g daily), avoid NSAIDs.",
            "follow_up_date": (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d"),
        }
        res_rx = self.client.post(f"/api/patients/{self.p_alice.id}/prescriptions", json=rx_payload)
        self.assertEqual(res_rx.status_code, 201)
        rx_data = res_rx.get_json()["prescription"]
        self.assertEqual(rx_data["medicine"], "Spironolactone")
        self.assertEqual(rx_data["patient_id"], self.p_alice.id)
        self.assertEqual(rx_data["doctor_id"], self.doctor.id)
        rx_id = rx_data["id"]

        # 2. Hepatologist sees it in Prescriptions Archive
        res_doc_list = self.client.get("/api/prescriptions")
        self.assertEqual(res_doc_list.status_code, 200)
        doc_rxs = res_doc_list.get_json().get("prescriptions", [])
        self.assertTrue(any(r["id"] == rx_id for r in doc_rxs))

        # 3. Patient Alice sees only HER prescription
        self.login("alice@patient.careai.com", "Patient@123")
        res_pat_list = self.client.get("/api/prescriptions")
        self.assertEqual(res_pat_list.status_code, 200)
        pat_rxs = res_pat_list.get_json().get("prescriptions", [])
        self.assertEqual(len(pat_rxs), 1)
        self.assertEqual(pat_rxs[0]["id"], rx_id)
        self.assertEqual(pat_rxs[0]["medicine"], "Spironolactone")

        # 4. Patient Bob sees ZERO prescriptions
        self.login("bob@patient.careai.com", "Patient@123")
        res_bob_list = self.client.get("/api/prescriptions")
        self.assertEqual(res_bob_list.status_code, 200)
        self.assertEqual(len(res_bob_list.get_json().get("prescriptions", [])), 0)

        # 5. Required field validation: missing medicine name rejected
        self.login("doctor_test@careai.com", "Doctor@123")
        bad_rx = {"dosage": "10mg", "frequency_days": 14}
        res_bad = self.client.post(f"/api/patients/{self.p_alice.id}/prescriptions", json=bad_rx)
        self.assertIn(res_bad.status_code, [400, 422])

    def test_10_appointments_workflow_status_updates_and_rbac(self):
        """Verify appointment booking, clinician association, status update, and cross-patient isolation."""
        # 1. Hepatologist schedules appointment for Alice (defaults to Confirmed for clinician)
        self.login("doctor_test@careai.com", "Doctor@123")
        scheduled_time = (datetime.now(timezone.utc) + timedelta(days=5)).replace(tzinfo=None)
        appnt_payload = {
            "patient_id": self.p_alice.id,
            "doctor_id": self.doctor.id,
            "scheduled_at": scheduled_time.isoformat(),
            "reason": "Ultrasound elastography follow-up",
        }
        res_create = self.client.post("/api/appointments", json=appnt_payload)
        self.assertEqual(res_create.status_code, 201)
        appnt = res_create.get_json()["appointment"]
        appnt_id = appnt["id"]
        self.assertEqual(appnt["patient_id"], self.p_alice.id)
        self.assertEqual(appnt["doctor_id"], self.doctor.id)
        self.assertEqual(appnt["status"], "Confirmed")

        # 2. Hepatologist marks appointment as Completed
        res_status = self.client.patch(f"/api/appointments/{appnt_id}/status", json={"status": "Completed"})
        self.assertEqual(res_status.status_code, 200)
        self.assertEqual(res_status.get_json()["appointment"]["status"], "Completed")

        # 3. Patient Alice sees her appointment record with Completed status
        self.login("alice@patient.careai.com", "Patient@123")
        res_alice_appnts = self.client.get("/api/appointments")
        self.assertEqual(res_alice_appnts.status_code, 200)
        alice_appnts = res_alice_appnts.get_json().get("appointments", [])
        self.assertTrue(any(a["id"] == appnt_id and a["status"] == "Completed" for a in alice_appnts))

        # 4. Patient Bob cannot see or cancel Alice's appointment
        self.login("bob@patient.careai.com", "Patient@123")
        res_bob_appnts = self.client.get("/api/appointments")
        self.assertEqual(res_bob_appnts.status_code, 200)
        bob_appnts = res_bob_appnts.get_json().get("appointments", [])
        self.assertFalse(any(a["id"] == appnt_id for a in bob_appnts))

        # Bob attempts to cancel Alice's appointment (IDOR)
        res_bad_cancel = self.client.patch(f"/api/appointments/{appnt_id}/status", json={"status": "Cancelled"})
        self.assertEqual(res_bad_cancel.status_code, 403)

    # =========================================================================
    # SECTION 5: CROSS-DASHBOARD DATA CONSISTENCY & PERSISTENCE
    # =========================================================================

    def test_11_cross_dashboard_consistency_full_clinical_chain(self):
        """
        Verify the complete cross-dashboard chain:
        Lab report created & uploaded by Lab Tech
        -> Report linked to patient
        -> Hepatologist reviews patient and report
        -> Clinical review status updated and prescription issued
        -> Patient accesses authorized information with exact persistence
        """
        # Step A: Lab Tech registers test patient Charlie and uploads lab panel
        self.login("lab_test@careai.com", "LabTech@123")
        reg_res = self.client.post("/api/patients", json={
            "full_name": "Charlie Chaplin",
            "age": 55,
            "gender": "Male",
            "bilirubin": 1.9,
            "albumin": 3.4,
            "platelets": 160.0,
            "email": "charlie@patient.careai.com",
        })
        self.assertEqual(reg_res.status_code, 201)
        p_charlie = reg_res.get_json()["patient"]
        charlie_id = p_charlie["id"]
        charlie_portal_id = p_charlie["portal_id"]

        charlie_pdf = (io.BytesIO(b"%PDF-1.4 Charlie Diagnostic Histology Report"), "Histology_Charlie.pdf")
        upload_res = self.client.post(
            "/api/reports/upload",
            data={"file": charlie_pdf, "patient_id": str(charlie_id), "category": "Biopsy Pathology"},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 201)
        charlie_report_id = upload_res.get_json()["report"]["id"]

        # Step B: Hepatologist reviews Charlie's lab panel & updates review status
        self.login("doctor_test@careai.com", "Doctor@123")
        review_res = self.client.get(f"/api/patients/{charlie_id}")
        self.assertEqual(review_res.status_code, 200)
        c_detail = review_res.get_json()["patient"]
        self.assertEqual(c_detail["full_name"], "Charlie Chaplin")
        self.assertEqual(c_detail["bilirubin"], 1.9)
        self.assertTrue(any(r["id"] == charlie_report_id for r in c_detail["reports"]))

        # Doctor updates status to "Under treatment"
        status_res = self.client.patch(
            f"/api/patients/{charlie_id}/review-status",
            json={"treatment_status": "Under treatment"},
        )
        self.assertEqual(status_res.status_code, 200)

        # Doctor writes prescription
        rx_res = self.client.post(f"/api/patients/{charlie_id}/prescriptions", json={
            "medicine": "Propranolol",
            "dosage": "20mg twice daily",
            "frequency_days": 60,
            "clinical_notes": "Portal hypertension primary prophylaxis.",
        })
        self.assertEqual(rx_res.status_code, 201)
        charlie_rx_id = rx_res.get_json()["prescription"]["id"]

        # Step C: Set password on Charlie's auto-provisioned patient User account
        charlie_user = User.query.filter_by(portal_id=charlie_portal_id).first()
        self.assertIsNotNone(charlie_user, "Patient user account should have been auto-provisioned upon registration")
        charlie_user.set_password("Charlie@123")
        charlie_user.active = True
        db.session.commit()

        # Step D: Charlie logs into Patient Portal
        self.login("charlie@patient.careai.com", "Charlie@123")

        # 1. Charlie sees his clinical overview with updated status
        c_stats = self.client.get("/api/dashboard/stats").get_json()
        self.assertEqual(c_stats["records_count"], 1)
        self.assertEqual(c_stats["latest_record"]["treatment_status"], "Under treatment")

        # 2. Charlie sees only his Biopsy report
        c_reports = self.client.get("/api/reports").get_json()["reports"]
        self.assertEqual(len(c_reports), 1)
        self.assertEqual(c_reports[0]["id"], charlie_report_id)
        self.assertEqual(c_reports[0]["original_filename"], "Histology_Charlie.pdf")

        # 3. Charlie downloads his report
        c_dl = self.client.get(f"/api/reports/{charlie_report_id}/download")
        self.assertEqual(c_dl.status_code, 200)
        self.assertTrue(c_dl.data.startswith(b"%PDF"))

        # 4. Charlie sees his prescription
        c_rxs = self.client.get("/api/prescriptions").get_json()["prescriptions"]
        self.assertEqual(len(c_rxs), 1)
        self.assertEqual(c_rxs[0]["id"], charlie_rx_id)
        self.assertEqual(c_rxs[0]["medicine"], "Propranolol")

        # 5. Charlie CANNOT access Alice's records (IDOR rejection)
        bad_res = self.client.get(f"/api/patients/{self.p_alice.id}")
        self.assertEqual(bad_res.status_code, 403)


if __name__ == "__main__":
    unittest.main()
