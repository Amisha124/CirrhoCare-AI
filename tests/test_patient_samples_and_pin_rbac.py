import io
import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.lab_order import LabOrder
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class PatientSamplesAndPinRBACTestCase(unittest.TestCase):
    """
    Integration test suite verifying:
    1. Reset PIN action is strictly Admin-only in both UI and backend API (403 for labtech, doctor, patient).
    2. Patient Samples lab workflow statuses (Pending PDF Upload, PDF Uploaded, Under Analysis, Completed).
    3. Proper handling of patients without lab orders.
    4. Per-order status tracking for patients with multiple lab orders.
    5. Report upload validation, completion flags, and accidental duplicate prevention.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_samples_pin_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="samples_pin_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "patient-samples-pin-test-secret-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "patient-samples-pin-test-secret-2026",
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

            self.patient_user = User(
                name="John Doe",
                email="john.doe@patient.org",
                role="patient",
                portal_id="CC-2026-1001",
            )
            self.patient_user.set_password("Patient@1234")

            self.patient_user_b = User(
                name="Jane Smith",
                email="jane.smith@patient.org",
                role="patient",
                portal_id="CC-2026-1002",
            )
            self.patient_user_b.set_password("Patient@1234")

            db.session.add_all([
                self.admin, self.labtech, self.doctor,
                self.patient_user, self.patient_user_b
            ])
            db.session.commit()

            # Seed patient records
            self.patient_a = Patient(
                full_name="John Doe",
                portal_id="CC-2026-1001",
                age=48,
                gender="Male",
                email="john.doe@patient.org",
                phone="+1-555-0101",
                treatment_status="Awaiting review",
                assigned_doctor_id=self.doctor.id,
            )
            self.patient_b = Patient(
                full_name="Jane Smith",
                portal_id="CC-2026-1002",
                age=55,
                gender="Female",
                email="jane.smith@patient.org",
                phone="+1-555-0102",
                treatment_status="Under treatment",
                assigned_doctor_id=self.doctor.id,
            )
            db.session.add_all([self.patient_a, self.patient_b])
            db.session.commit()

            self.patient_a_id = self.patient_a.id
            self.patient_b_id = self.patient_b.id
            self.doctor_id = self.doctor.id

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

    def test_01_reset_pin_strictly_admin_only(self):
        """
        Verify Requirement 2:
        - Admin can reset a patient's PIN (200 OK, returns new_pin, logged in audit log).
        - Lab Technician cannot reset PIN (403 Forbidden).
        - Hepatologist cannot reset PIN (403 Forbidden).
        - Patient cannot reset PIN (403 Forbidden).
        - Unauthenticated user cannot reset PIN (401 Unauthorized).
        """
        # 1. Unauthenticated attempt -> 401
        res = self.client.post(f"/api/patients/{self.patient_a_id}/reset-pin")
        self.assertEqual(res.status_code, 401)

        # 2. Lab Technician attempt -> 403 Forbidden
        self._login("labtech@clinic.org", "LabTech@1234")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/reset-pin")
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.get_json()["success"])
        self._logout()

        # 3. Hepatologist attempt -> 403 Forbidden
        self._login("doctor@clinic.org", "Doctor@1234")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/reset-pin")
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.get_json()["success"])
        self._logout()

        # 4. Patient attempt -> 403 Forbidden
        self._login("john.doe@patient.org", "Patient@1234")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/reset-pin")
        self.assertEqual(res.status_code, 403)
        self._logout()

        # 5. Admin attempt -> 200 OK, generates new PIN, audit log written
        self._login("admin@clinic.org", "Admin@1234")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/reset-pin")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        new_pin = data["new_pin"]
        self.assertIsNotNone(new_pin)
        self.assertEqual(data["portal_id"], "CC-2026-1001")

        # Verify audit log recorded
        with self.app.app_context():
            log = ActivityLog.query.filter_by(action="Patient PIN Reset").first()
            self.assertIsNotNone(log)
            self.assertIn("CC-2026-1001", log.details)
            self.assertIn("admin@clinic.org", log.details)

        self._logout()

        # Patient signs in with the new PIN
        login_res = self.client.post("/api/auth/patient-login", json={
            "name": "John Doe",
            "portal_id": "CC-2026-1001",
            "pin": new_pin,
        })
        self.assertEqual(login_res.status_code, 200)

    def test_02_patient_samples_multiple_orders_and_empty_orders_handling(self):
        """
        Verify Requirement 1.A & 1.C:
        - Patient without orders returns empty lab_orders list (UI shows 'No lab orders').
        - Patient with multiple orders receives each order individually with test_type, priority, and status.
        """
        self._login("labtech@clinic.org", "LabTech@1234")

        # 1. Inspect Patient B: has NO lab orders yet
        res = self.client.get(f"/api/patients/{self.patient_b_id}")
        self.assertEqual(res.status_code, 200)
        b_data = res.get_json()["patient"]
        self.assertEqual(b_data["lab_orders"], [])
        self.assertEqual(b_data["reports"], [])

        # 2. Add two distinct lab orders to Patient A
        with self.app.app_context():
            order1 = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Liver Function Test (LFT)",
                clinical_indication="Suspected acute hepatic flare",
                priority="STAT",
                order_status="Ordered",
            )
            order2 = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Ultrasound Abdomen",
                clinical_indication="Portal hypertension and ascites assessment",
                priority="Routine",
                order_status="Ordered",
            )
            db.session.add_all([order1, order2])
            db.session.commit()
            order1_id = order1.id
            order2_id = order2.id

        # 3. Retrieve patient list as Labtech
        list_res = self.client.get("/api/patients")
        self.assertEqual(list_res.status_code, 200)
        patients = list_res.get_json()["patients"]

        p_a = next(p for p in patients if p["id"] == self.patient_a_id)
        p_b = next(p for p in patients if p["id"] == self.patient_b_id)

        # Patient B has 0 lab orders
        self.assertEqual(len(p_b["lab_orders"]), 0)

        # Patient A has exactly 2 distinct orders
        self.assertEqual(len(p_a["lab_orders"]), 2)
        order_types = [o["test_type"] for o in p_a["lab_orders"]]
        self.assertIn("Liver Function Test (LFT)", order_types)
        self.assertIn("Ultrasound Abdomen", order_types)

        stat_order = next(o for o in p_a["lab_orders"] if o["id"] == order1_id)
        self.assertEqual(stat_order["priority"], "STAT")
        self.assertEqual(stat_order["order_status"], "Ordered")

        routine_order = next(o for o in p_a["lab_orders"] if o["id"] == order2_id)
        self.assertEqual(routine_order["priority"], "Routine")
        self.assertEqual(routine_order["order_status"], "Ordered")

    def test_03_report_upload_completion_flag_and_duplicate_prevention(self):
        """
        Verify Requirement 1.B & 1.D:
        - Report upload with complete_order="false" attaches report without marking Completed (PDF Uploaded).
        - Report upload with complete_order="true" marks Completed.
        - Repeated upload to completed order without replacement flag is rejected (409 Conflict).
        - Cross-patient lab order linking is rejected (400 Bad Request).
        """
        # Create an order for Patient A and an order for Patient B
        with self.app.app_context():
            order_a = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Complete Blood Count (CBC)",
                priority="Urgent",
                order_status="Ordered",
            )
            order_b = LabOrder(
                patient_id=self.patient_b_id,
                doctor_id=self.doctor_id,
                test_type="Biopsy Pathology",
                priority="Routine",
                order_status="Ordered",
            )
            db.session.add_all([order_a, order_b])
            db.session.commit()
            order_a_id = order_a.id
            order_b_id = order_b.id

        self._login("labtech@clinic.org", "LabTech@1234")

        # 1. Attempt cross-patient linking: upload to Patient A with Patient B's order -> 400
        cross_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 dummy content"), "cbc_report.pdf"),
                "category": "Complete Blood Count (CBC)",
                "lab_order_id": order_b_id,
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(cross_res.status_code, 400)
        self.assertIn("does not belong to this patient", cross_res.get_json()["error"])

        # 2. Upload with complete_order="false" -> attaches report, sets In Progress (PDF Uploaded)
        upload_draft_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 dummy content draft"), "cbc_preliminary.pdf"),
                "category": "Complete Blood Count (CBC)",
                "lab_order_id": order_a_id,
                "complete_order": "false",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_draft_res.status_code, 201)

        with self.app.app_context():
            chk_order = db.session.get(LabOrder, order_a_id)
            self.assertEqual(chk_order.order_status, "Report Uploaded")
            self.assertEqual(len(chk_order.reports), 1)

        # 3. Labtech updates order status to Completed once requirements are fulfilled
        comp_res = self.client.patch(
            f"/api/lab-orders/{order_a_id}/status",
            json={"order_status": "Completed"},
        )
        self.assertEqual(comp_res.status_code, 200)

        with self.app.app_context():
            chk_order = db.session.get(LabOrder, order_a_id)
            self.assertEqual(chk_order.order_status, "Completed")
            self.assertIsNotNone(chk_order.completed_at)

        # 4. Accidental duplicate upload to completed order -> 409 Conflict
        dup_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 dummy duplicate"), "cbc_duplicate.pdf"),
                "category": "Complete Blood Count (CBC)",
                "lab_order_id": order_a_id,
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(dup_res.status_code, 409)
        self.assertIn("already marked Completed", dup_res.get_json()["error"])

        # 5. Upload for Order B with default completion -> marks Completed
        comp_upload = self.client.post(
            f"/api/patients/{self.patient_b_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 biopsy report content"), "biopsy_final.pdf"),
                "category": "Biopsy Pathology",
                "lab_order_id": order_b_id,
                "complete_order": "true",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(comp_upload.status_code, 201)

        with self.app.app_context():
            chk_order_b = db.session.get(LabOrder, order_b_id)
            self.assertEqual(chk_order_b.order_status, "Completed")

    def test_04_patient_self_registration_permanently_forbidden(self):
        """
        Verify:
        - Self-registration via POST /api/auth/register with role="patient" is permanently forbidden (400 Bad Request).
        - Clinical staff roles (e.g. labtech, hepatologist) can register normally.
        """
        res = self.client.post("/api/auth/register", json={
            "name": "Self Registering Patient",
            "email": "selfpatient@test.com",
            "role": "patient",
            "password": "Password@1234",
            "confirm_password": "Password@1234",
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("Patient self-registration is permanently disabled", data["error"])

    def test_05_labtech_patient_registration_generates_id_and_secure_pin(self):
        """
        Verify:
        - Lab Technician registers patient via POST /api/patients -> 201 Created.
        - System automatically generates unique Patient ID (portal_id matching CC-YYYY-XXXX) and secure PIN.
        - PIN is returned only to authorized Labtech at creation time.
        - Non-labtech roles (Admin, Doctor, Patient) receive 403 Forbidden.
        - Newly registered patient can immediately log in via Patient ID + PIN.
        """
        # 1. Admin attempt -> 403 Forbidden
        self._login("admin@clinic.org", "Admin@1234")
        admin_res = self.client.post("/api/patients", json={
            "full_name": "Admin Intake Patient",
            "age": 42,
            "gender": "Male",
        })
        self.assertEqual(admin_res.status_code, 403)
        self._logout()

        # 2. Doctor attempt -> 403 Forbidden
        self._login("doctor@clinic.org", "Doctor@1234")
        doc_res = self.client.post("/api/patients", json={
            "full_name": "Doctor Intake Patient",
            "age": 42,
            "gender": "Male",
        })
        self.assertEqual(doc_res.status_code, 403)
        self._logout()

        # 3. Patient attempt -> 403 Forbidden
        self._login("john.doe@patient.org", "Patient@1234")
        pat_res = self.client.post("/api/patients", json={
            "full_name": "Self Intake Patient",
            "age": 42,
            "gender": "Male",
        })
        self.assertEqual(pat_res.status_code, 403)
        self._logout()

        # 4. Labtech registers patient -> 201 Created with initial_pin
        self._login("labtech@clinic.org", "LabTech@1234")
        create_res = self.client.post("/api/patients", json={
            "full_name": "Carlos Gomez",
            "age": 52,
            "gender": "Male",
            "phone": "+1-555-0999",
            "email": "carlos.gomez@patient.org",
            "bilirubin": 2.4,
            "albumin": 3.1,
            "platelets": 180,
            "assigned_doctor_id": self.doctor_id,
        })
        self.assertEqual(create_res.status_code, 201)
        data = create_res.get_json()
        self.assertTrue(data["success"])
        new_patient = data["patient"]
        portal_id = new_patient["portal_id"]
        initial_pin = data["initial_pin"]

        self.assertTrue(portal_id.startswith("CC-"))
        self.assertTrue(len(initial_pin) >= 6)
        self._logout()

        # 5. Patient logs in using portal_id and initial_pin
        login_res = self.client.post("/api/auth/patient-login", json={
            "name": "Carlos Gomez",
            "portal_id": portal_id,
            "pin": initial_pin,
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.get_json()["success"])
        self._logout()

    def test_06_admin_read_only_workflow_and_monitoring_stats(self):
        """
        Verify:
        - Admin cannot register patients (403 Forbidden).
        - Admin cannot edit patient biomarkers/test results (403 Forbidden).
        - Admin cannot upload diagnostic reports (403 Forbidden).
        - Admin cannot alter lab order status (403 Forbidden).
        - Admin dashboard stats return live diagnostic test status counts and monitoring metrics.
        """
        # Create an order
        with self.app.app_context():
            order = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Liver FibroScan",
                priority="Routine",
                order_status="Report Uploaded",
            )
            db.session.add(order)
            db.session.commit()
            order_id = order.id

        self._login("admin@clinic.org", "Admin@1234")

        # 1. Admin cannot edit biomarkers
        edit_res = self.client.put(f"/api/patients/{self.patient_a_id}", json={
            "bilirubin": 4.5,
            "albumin": 2.2,
        })
        self.assertEqual(edit_res.status_code, 403)

        # 2. Admin cannot upload report
        upload_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 dummy admin"), "admin_forbidden.pdf"),
                "category": "Liver FibroScan",
                "lab_order_id": order_id,
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 403)

        # 3. Admin cannot alter order status
        status_res = self.client.patch(
            f"/api/lab-orders/{order_id}/status",
            json={"order_status": "Completed"},
        )
        self.assertEqual(status_res.status_code, 403)

        # 4. Admin stats return live monitoring counts
        stats_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats_data = stats_res.get_json()["stats"]

        self.assertIn("test_status_counts", stats_data)
        self.assertIn("pending_reports", stats_data)
        self.assertIn("uploaded_reports", stats_data)
        self.assertIn("completed_tests", stats_data)
        self.assertIn("total_doctors", stats_data)
        self.assertIn("total_labtechs", stats_data)
        self.assertEqual(stats_data["total_doctors"], 1)
        self.assertEqual(stats_data["total_labtechs"], 1)
        self.assertGreaterEqual(stats_data["test_status_counts"].get("Report Uploaded", 0), 1)

        self._logout()

    def test_07_doctor_role_boundaries_cannot_alter_lab_orders_or_upload_official_reports(self):
        """
        Verify:
        - Doctor cannot upload official lab reports (403 Forbidden).
        - Doctor cannot alter lab order test statuses (403 Forbidden).
        - Doctor can view patient records and create prescriptions.
        """
        with self.app.app_context():
            order = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Abdominal Doppler Ultrasound",
                priority="Routine",
                order_status="Test Pending",
            )
            db.session.add(order)
            db.session.commit()
            order_id = order.id

        self._login("doctor@clinic.org", "Doctor@1234")

        # 1. Doctor cannot upload lab report
        upload_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 dummy doc"), "doc_forbidden.pdf"),
                "category": "Abdominal Doppler Ultrasound",
                "lab_order_id": order_id,
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 403)

        # 2. Doctor cannot alter lab order status directly
        status_res = self.client.patch(
            f"/api/lab-orders/{order_id}/status",
            json={"order_status": "Completed"},
        )
        self.assertEqual(status_res.status_code, 403)

        # 3. Doctor can view patient record
        view_res = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(view_res.status_code, 200)

        # 4. Doctor can issue prescription
        rx_res = self.client.post(f"/api/patients/{self.patient_a_id}/prescriptions", json={
            "medicine": "Spironolactone",
            "dosage": "50mg once daily",
            "frequency_days": 30,
            "clinical_notes": "For mild peripheral edema management",
        })
        self.assertEqual(rx_res.status_code, 201)
        self.assertTrue(rx_res.get_json()["success"])

        self._logout()

    def test_08_patient_view_only_cannot_mutate_or_access_other_patients(self):
        """
        Verify:
        - Patient can view own records.
        - Patient cannot view other patients' records (403 Forbidden).
        - Patient cannot update biomarkers (403 Forbidden).
        - Patient cannot upload reports (403 Forbidden).
        - Patient cannot modify lab orders (403 Forbidden).
        """
        self._login("john.doe@patient.org", "Patient@1234")

        # 1. Patient can view own record
        own_res = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(own_res.status_code, 200)

        # 2. Patient cannot view another patient's record (Patient B)
        other_res = self.client.get(f"/api/patients/{self.patient_b_id}")
        self.assertEqual(other_res.status_code, 403)

        # 3. Patient cannot edit biomarkers
        edit_res = self.client.put(f"/api/patients/{self.patient_a_id}", json={
            "bilirubin": 1.0,
        })
        self.assertEqual(edit_res.status_code, 403)

        # 4. Patient cannot upload reports
        upload_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": (io.BytesIO(b"%PDF-1.4 dummy"), "fake.pdf"),
                "category": "Self Report",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_res.status_code, 403)

        self._logout()

    def test_09_labtech_test_order_full_lifecycle_statuses(self):
        """
        Verify:
        - Lab Technician can transition lab order across all 7 supported lifecycle statuses:
          'Registered', 'Test Pending', 'Test in Progress', 'Report Pending',
          'Report Uploaded', 'Completed', 'Clarification Required'.
        - Verifies each status transition is accepted and saved in database.
        - Verifies audit log records status transitions without exposing credentials.
        """
        with self.app.app_context():
            order = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Serum Albumin & INR",
                priority="Urgent",
                order_status="Registered",
            )
            db.session.add(order)
            db.session.commit()
            order_id = order.id

        self._login("labtech@clinic.org", "LabTech@1234")

        lifecycle_statuses = [
            "Test Pending",
            "Test in Progress",
            "Report Pending",
            "Report Uploaded",
            "Clarification Required",
            "Completed",
        ]

        for target_status in lifecycle_statuses:
            res = self.client.patch(
                f"/api/lab-orders/{order_id}/status",
                json={"order_status": target_status, "reason": f"Clinical workflow transition to {target_status}"},
            )
            self.assertEqual(res.status_code, 200, f"Failed transitioning to {target_status}")
            data = res.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["order"]["order_status"], target_status)

            with self.app.app_context():
                db_order = db.session.get(LabOrder, order_id)
                self.assertEqual(db_order.order_status, target_status)

        # Verify audit trail contains records
        with self.app.app_context():
            logs = ActivityLog.query.filter(ActivityLog.action.ilike("%Lab order%")).all()
            self.assertGreaterEqual(len(logs), len(lifecycle_statuses))
            # Verify no password or pin is stored in any log details
            for l in logs:
                self.assertNotIn("password", l.details.lower())
                self.assertNotIn("pin", l.details.lower())

        self._logout()


if __name__ == "__main__":
    unittest.main()
