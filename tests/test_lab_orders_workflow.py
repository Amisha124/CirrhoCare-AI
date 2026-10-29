import io
import os
import shutil
import tempfile
import unittest
from datetime import datetime

from app import create_app
from app.models import db
from app.models.lab_order import LabOrder
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User


class LabOrdersWorkflowTestCase(unittest.TestCase):
    """
    Automated test suite verifying the complete doctor-to-laboratory test-order workflow:
    1. Doctor creating a lab order.
    2. Lab technician seeing the order in the accession queue.
    3. Valid and invalid status transitions.
    4. Report correctly linked to its patient and order.
    5. Doctor reviewing the completed report.
    6. Patient report access and cross-patient data isolation.
    7. Unauthorized role rejection.
    8. Persistence across database sessions.
    """

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_lab_orders_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name

        self.temp_upload_dir = tempfile.mkdtemp(prefix="lab_orders_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "test-lab-order-secret-key-101"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "test-lab-order-secret-key-101",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            # Seed test users
            self.doctor = User(name="Dr. Chen", email="dr.chen@test.org", role="hepatologist")
            self.doctor.set_password("Doctor@123")

            self.other_doctor = User(name="Dr. Patel", email="dr.patel@test.org", role="hepatologist")
            self.other_doctor.set_password("Doctor@123")

            self.labtech = User(name="Lab Tech Roy", email="labtech@test.org", role="labtech")
            self.labtech.set_password("LabTech@123")

            self.admin = User(name="Admin User", email="admin@test.org", role="admin")
            self.admin.set_password("Admin@123")

            self.patient_user_a = User(name="Alice Smith", email="alice@test.org", role="patient", portal_id="CC-2026-0001")
            self.patient_user_a.set_password("Patient@123")

            self.patient_user_b = User(name="Bob Jones", email="bob@test.org", role="patient", portal_id="CC-2026-0002")
            self.patient_user_b.set_password("Patient@123")

            db.session.add_all([
                self.doctor, self.other_doctor, self.labtech, self.admin,
                self.patient_user_a, self.patient_user_b
            ])
            db.session.commit()

            # Seed test patients
            self.patient_a = Patient(
                full_name="Alice Smith",
                portal_id="CC-2026-0001",
                age=46,
                gender="Female",
                email="alice@test.org",
                created_by_id=self.doctor.id,
                treatment_status="Awaiting review",
            )
            self.patient_b = Patient(
                full_name="Bob Jones",
                portal_id="CC-2026-0002",
                age=54,
                gender="Male",
                email="bob@test.org",
                created_by_id=self.other_doctor.id,
                treatment_status="Under treatment",
            )
            db.session.add_all([self.patient_a, self.patient_b])
            db.session.commit()

            self.patient_a_id = self.patient_a.id
            self.patient_b_id = self.patient_b.id
            self.doctor_id = self.doctor.id
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
            shutil.rmtree(self.temp_upload_dir, ignore_errors=True)

    def login(self, email, password):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def logout(self):
        return self.client.post("/api/auth/logout")

    def test_01_doctor_creating_lab_order(self):
        """Doctor creates a lab order successfully."""
        self.login("dr.chen@test.org", "Doctor@123")

        payload = {
            "test_type": "Liver Function Test (LFT)",
            "priority": "Urgent",
            "clinical_indication": "Elevated ALT/AST with suspected hepatic inflammation",
        }
        res = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        order = data.get("order")
        self.assertEqual(order["test_type"], "Liver Function Test (LFT)")
        self.assertEqual(order["priority"], "Urgent")
        self.assertEqual(order["order_status"], "Ordered")
        self.assertEqual(order["patient_id"], self.patient_a_id)
        self.assertEqual(order["doctor_id"], self.doctor_id)
        self.assertIn("Elevated ALT/AST", order["clinical_indication"])

    def test_02_labtech_seeing_order(self):
        """Lab technician sees the pending lab order in the accession worklist."""
        # Create order as doctor
        self.login("dr.chen@test.org", "Doctor@123")
        self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Complete Blood Count (CBC)",
            "priority": "STAT",
            "clinical_indication": "Pre-procedural platelet assessment",
        })
        self.logout()

        # Lab tech logs in and checks accession list
        self.login("labtech@test.org", "LabTech@123")
        res = self.client.get("/api/lab-orders")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        orders = data.get("orders")
        self.assertGreaterEqual(len(orders), 1)
        stat_order = next((o for o in orders if o["test_type"] == "Complete Blood Count (CBC)"), None)
        self.assertIsNotNone(stat_order)
        self.assertEqual(stat_order["priority"], "STAT")
        self.assertEqual(stat_order["patient_name"], "Alice Smith")

    def test_03_valid_and_invalid_status_transitions(self):
        """Validates the state machine transitions and role boundaries."""
        # 1. Place order as doctor
        self.login("dr.chen@test.org", "Doctor@123")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Coagulation Profile (PT/INR)",
            "priority": "Routine",
        })
        order_id = res.get_json()["order"]["id"]
        self.logout()

        # 2. Lab tech updates Ordered -> Sample Collected (VALID)
        self.login("labtech@test.org", "LabTech@123")
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "Sample Collected"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["order"]["order_status"], "Sample Collected")

        # 3. Lab tech updates Sample Collected -> In Progress (VALID)
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "In Progress"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["order"]["order_status"], "In Progress")

        # 4. Lab tech attempts invalid backward transition In Progress -> Ordered (INVALID)
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "Ordered"})
        self.assertEqual(res.status_code, 400)

        # 5. Lab tech attempts invalid arbitrary status (INVALID)
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "LostSample"})
        self.assertEqual(res.status_code, 400)

        # 6. Lab tech attempts to cancel order (FORBIDDEN for labtech)
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "Cancelled"})
        self.assertEqual(res.status_code, 403)
        self.logout()

        # 7. Doctor cannot directly alter lab tech status route (403 Forbidden)
        self.login("dr.chen@test.org", "Doctor@123")
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "Cancelled"})
        self.assertEqual(res.status_code, 403)

        # 8. Doctor cancels active orders via clinical decision endpoint
        res = self.client.post(f"/api/lab-orders/{order_id}/decision", json={"decision": "Cancelled", "notes": "Clinical cancellation"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["order"]["order_status"], "Cancelled")

        # 9. Terminal state Cancelled cannot transition further even by lab tech
        self.logout()
        self.login("labtech@test.org", "LabTech@123")
        res = self.client.patch(f"/api/lab-orders/{order_id}/status", json={"status": "In Progress"})
        self.assertEqual(res.status_code, 400)

    def test_04_report_linked_to_patient_and_order(self):
        """Uploading a report with a lab_order_id links them and completes the order."""
        # 1. Place order as doctor
        self.login("dr.chen@test.org", "Doctor@123")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Ultrasound Abdomen",
            "priority": "Routine",
        })
        order_id = res.get_json()["order"]["id"]
        self.logout()

        # 2. Lab tech uploads report fulfilling this order
        self.login("labtech@test.org", "LabTech@123")
        dummy_file = (io.BytesIO(b"%PDF-1.4 Ultrasound Report Test Dummy Content"), "ultrasound_test.pdf")
        upload_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={
                "report": dummy_file,
                "category": "Ultrasound Abdomen",
                "lab_order_id": str(order_id),
            },
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 201)
        upload_data = upload_res.get_json()
        report_data = upload_data["report"]
        self.assertEqual(report_data["lab_order_id"], order_id)

        # 3. Verify order is now completed in the database
        order_res = self.client.get(f"/api/lab-orders/{order_id}")
        self.assertEqual(order_res.status_code, 200)
        order_obj = order_res.get_json()["order"]
        self.assertEqual(order_obj["order_status"], "Completed")
        self.assertIsNotNone(order_obj["completed_at"])
        self.assertEqual(len(order_obj["reports"]), 1)
        self.assertEqual(order_obj["reports"][0]["id"], report_data["id"])

    def test_05_doctor_reviewing_completed_report(self):
        """Doctor can review patient profile, see completed order, and download report."""
        # 1. Place order as doctor
        self.login("dr.chen@test.org", "Doctor@123")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Viral Markers",
            "priority": "Routine",
        })
        order_id = res.get_json()["order"]["id"]
        self.logout()

        # 2. Lab tech fulfills order with report
        self.login("labtech@test.org", "LabTech@123")
        dummy_file = (io.BytesIO(b"%PDF-1.4 Viral Markers Negative Test"), "viral_markers.pdf")
        upload_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={"report": dummy_file, "category": "Viral Markers", "lab_order_id": str(order_id)},
            content_type="multipart/form-data"
        )
        report_id = upload_res.get_json()["report"]["id"]
        self.logout()

        # 3. Doctor reviews patient record
        self.login("dr.chen@test.org", "Doctor@123")
        patient_res = self.client.get(f"/api/patients/{self.patient_a_id}")
        self.assertEqual(patient_res.status_code, 200)
        patient_data = patient_res.get_json()["patient"]
        self.assertTrue(any(o["id"] == order_id and o["order_status"] == "Completed" for o in patient_data.get("lab_orders", [])))

        # 4. Doctor downloads the authorized report
        download_res = self.client.get(f"/api/reports/{report_id}/download")
        self.assertEqual(download_res.status_code, 200)
        self.assertIn(b"%PDF-1.4", download_res.data)

    def test_06_patient_report_access_and_cross_patient_isolation(self):
        """Patient sees only their own reports and cannot access another patient's orders/reports."""
        # Doctor orders and fulfills for Patient A
        self.login("dr.chen@test.org", "Doctor@123")
        res_a = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Liver Function Test (LFT)",
            "priority": "Routine",
        })
        order_a_id = res_a.get_json()["order"]["id"]
        self.logout()

        # Lab tech fulfills order by uploading official report
        self.login("labtech@test.org", "LabTech@123")
        dummy_file_a = (io.BytesIO(b"%PDF-1.4 Patient A Private LFT"), "alice_lft.pdf")
        rep_a_res = self.client.post(
            f"/api/patients/{self.patient_a_id}/reports",
            data={"report": dummy_file_a, "category": "LFT", "lab_order_id": str(order_a_id)},
            content_type="multipart/form-data"
        )
        self.assertEqual(rep_a_res.status_code, 201)
        report_a_id = rep_a_res.get_json()["report"]["id"]
        self.logout()

        # Patient A logs in: can see order and report
        self.login("alice@test.org", "Patient@123")
        orders_a = self.client.get("/api/lab-orders").get_json()["orders"]
        self.assertTrue(any(o["id"] == order_a_id for o in orders_a))

        download_a = self.client.get(f"/api/reports/{report_a_id}/download")
        self.assertEqual(download_a.status_code, 200)
        self.logout()

        # Patient B logs in: CANNOT see Patient A's order or report
        self.login("bob@test.org", "Patient@123")
        orders_b = self.client.get("/api/lab-orders").get_json()["orders"]
        self.assertFalse(any(o["id"] == order_a_id for o in orders_b))

        # Direct access to Patient A's lab order is rejected with 403
        direct_order = self.client.get(f"/api/lab-orders/{order_a_id}")
        self.assertEqual(direct_order.status_code, 403)

        # Direct access to Patient A's report download is rejected with 403
        direct_download = self.client.get(f"/api/reports/{report_a_id}/download")
        self.assertEqual(direct_download.status_code, 403)

    def test_07_unauthorized_role_rejection(self):
        """Unauthorized roles cannot create lab orders."""
        # 1. Patient cannot create a lab order
        self.login("alice@test.org", "Patient@123")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Liver Function Test (LFT)",
            "priority": "Routine",
        })
        self.assertEqual(res.status_code, 403)
        self.logout()

        # 2. Lab technician cannot create a clinical lab order (physician/admin role required)
        self.login("labtech@test.org", "LabTech@123")
        res = self.client.post(f"/api/patients/{self.patient_a_id}/lab-orders", json={
            "test_type": "Liver Function Test (LFT)",
            "priority": "Routine",
        })
        self.assertEqual(res.status_code, 403)
        self.logout()

        # 3. Unauthenticated request rejected with 401
        res = self.client.get("/api/lab-orders")
        self.assertEqual(res.status_code, 401)

    def test_08_persistence_across_database_sessions(self):
        """Lab orders persist cleanly across database sessions and retain relationships."""
        with self.app.app_context():
            order = LabOrder(
                patient_id=self.patient_a_id,
                doctor_id=self.doctor_id,
                test_type="Serum Ferritin & Iron Studies",
                clinical_indication="Suspected hemochromatosis / iron overload",
                priority="STAT",
                order_status="Ordered",
            )
            db.session.add(order)
            db.session.commit()
            persisted_id = order.id

            # End the session
            db.session.remove()

            # Query in fresh session
            reloaded_order = db.session.get(LabOrder, persisted_id)
            self.assertIsNotNone(reloaded_order)
            self.assertEqual(reloaded_order.test_type, "Serum Ferritin & Iron Studies")
            self.assertEqual(reloaded_order.priority, "STAT")
            self.assertEqual(reloaded_order.patient.full_name, "Alice Smith")
            self.assertEqual(reloaded_order.doctor.name, "Dr. Chen")
            self.assertIsNotNone(reloaded_order.created_at)


if __name__ == "__main__":
    unittest.main()

