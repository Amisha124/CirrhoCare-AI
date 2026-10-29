import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime

from app import create_app, db
from app.models.activity_log import ActivityLog
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User
from app.utils.migrations import ensure_sqlite_schema


class TestTreatmentStatusWorkflow(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_status_workflow_test.db", delete=False)
        self.temp_db.close()
        self.db_path = self.temp_db.name
        self.temp_upload_dir = tempfile.mkdtemp(prefix="status_workflow_uploads_")

        os.environ["DEMO_MODE"] = "true"
        os.environ["DEMO_DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["DEMO_UPLOAD_FOLDER"] = self.temp_upload_dir
        os.environ["SECRET_KEY"] = "status-workflow-secret-key-2026"

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
            "UPLOAD_FOLDER": self.temp_upload_dir,
            "DEMO_UPLOAD_FOLDER": self.temp_upload_dir,
            "SECRET_KEY": "status-workflow-secret-key-2026",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        with self.app.app_context():
            ensure_sqlite_schema()

            # 1. Primary Doctor (assigned)
            self.doctor = User(
                name="Dr. Raj Sharma",
                email="dr.sharma@cirrhocare.org",
                role="hepatologist",
                portal_id="HEP-101",
            )
            self.doctor.set_password("Doctor@123")

            # 2. Second Doctor (unauthorized to modify other doctor's private patients)
            self.other_doctor = User(
                name="Dr. Sarah Jenkins",
                email="dr.jenkins@cirrhocare.org",
                role="hepatologist",
                portal_id="HEP-102",
            )
            self.other_doctor.set_password("Doctor@123")

            # 3. Lab Technician
            self.labtech = User(
                name="Neha Verma",
                email="neha.lab@cirrhocare.org",
                role="labtech",
                portal_id="LT-101",
            )
            self.labtech.set_password("LabTech@123")

            # 4. Patient User
            self.patient_user = User(
                name="Anil Kapoor",
                email="anil.kapoor@example.com",
                role="patient",
                portal_id="CC-2026-7780",
            )
            self.patient_user.set_password("Patient@123")

            # 5. Patient Record
            self.patient = Patient(
                full_name="Anil Kapoor",
                portal_id="CC-2026-7780",
                age=50,
                gender="Male",
                email="anil.kapoor@example.com",
                phone="9876543210",
                bilirubin=1.6,
                direct_bilirubin=0.5,
                albumin=3.7,
                treatment_status="Awaiting Doctor Review",
                lab_workflow_status="Report Uploaded",
                assigned_doctor_id=None,  # will assign in test
            )

            db.session.add_all([
                self.doctor,
                self.other_doctor,
                self.labtech,
                self.patient_user,
                self.patient,
            ])
            db.session.commit()

            self.patient.assigned_doctor_id = self.doctor.id
            db.session.commit()

            self.doctor_id = self.doctor.id
            self.other_doctor_id = self.other_doctor.id
            self.labtech_id = self.labtech.id
            self.patient_user_id = self.patient_user.id
            self.patient_id = self.patient.id

    def tearDown(self):
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
            if os.path.exists(self.temp_upload_dir):
                shutil.rmtree(self.temp_upload_dir, ignore_errors=True)
        except Exception:
            pass

    def login(self, email, password):
        return self.client.post("/api/auth/login", json={
            "email": email,
            "password": password,
        })

    def logout(self):
        return self.client.post("/api/auth/logout")

    def test_01_doctor_can_update_treatment_status(self):
        """1. Doctor can update treatment status to Under Treatment and Follow-up Required."""
        login_res = self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        self.assertEqual(login_res.status_code, 200)

        # Update to 'Under Treatment'
        res1 = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Under Treatment"},
        )
        self.assertEqual(res1.status_code, 200)
        data1 = json.loads(res1.data)
        self.assertTrue(data1.get("success"))
        self.assertEqual(data1["patient"]["treatment_status"], "Under Treatment")

        # Update to 'Follow-up Required'
        res2 = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Follow-up Required"},
        )
        self.assertEqual(res2.status_code, 200)
        data2 = json.loads(res2.data)
        self.assertEqual(data2["patient"]["treatment_status"], "Follow-up Required")

    def test_02_treatment_completed_requires_confirmation(self):
        """Doctor must explicitly confirm Treatment Completed."""
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")

        # Attempt without confirmation -> 400
        res_fail = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Treatment Completed"},
        )
        self.assertEqual(res_fail.status_code, 400)

        # With explicit confirmation -> 200
        res_ok = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={
                "treatment_status": "Treatment Completed",
                "confirm": True,
                "treatment_notes": "Liver enzymes normalized; clinical regimen completed.",
            },
        )
        self.assertEqual(res_ok.status_code, 200)
        data_ok = json.loads(res_ok.data)
        self.assertEqual(data_ok["patient"]["treatment_status"], "Treatment Completed")
        self.assertIsNotNone(data_ok["patient"]["treatment_completed_at"])

    def test_03_patient_sees_updated_status(self):
        """2. Patient sees the updated status on their dashboard and record."""
        # Doctor updates to 'Under Treatment'
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Under Treatment"},
        )
        self.logout()

        # Patient logs in
        login_pat = self.login("anil.kapoor@example.com", "Patient@123")
        self.assertEqual(login_pat.status_code, 200)

        dash_res = self.client.get("/api/dashboard/stats")
        self.assertEqual(dash_res.status_code, 200)
        dash_data = json.loads(dash_res.data)
        self.assertEqual(dash_data["role"], "patient")
        self.assertEqual(dash_data["latest_record"]["treatment_status"], "Under Treatment")

    def test_04_labtech_sees_updated_clinical_status(self):
        """3. Lab Technician sees the updated clinical status."""
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Follow-up Required"},
        )
        self.logout()

        # Lab Tech logs in
        self.login("neha.lab@cirrhocare.org", "LabTech@123")
        pts_res = self.client.get("/api/patients")
        self.assertEqual(pts_res.status_code, 200)
        pts_data = json.loads(pts_res.data)
        found = next((p for p in pts_data["patients"] if p["id"] == self.patient_id), None)
        self.assertIsNotNone(found)
        self.assertEqual(found["treatment_status"], "Follow-up Required")

    def test_05_lab_workflow_status_remains_unchanged(self):
        """4. Laboratory workflow status remains unchanged when clinical status is modified."""
        # Initial lab_workflow_status is 'Report Uploaded'
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        res = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={
                "treatment_status": "Treatment Completed",
                "confirm": True,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        # Treatment status is completed
        self.assertEqual(data["patient"]["treatment_status"], "Treatment Completed")
        # Lab workflow status is STILL 'Report Uploaded'
        self.assertEqual(data["patient"]["lab_workflow_status"], "Report Uploaded")

        with self.app.app_context():
            p = db.session.get(Patient, self.patient_id)
            self.assertEqual(p.lab_workflow_status, "Report Uploaded")
            self.assertEqual(p.treatment_status, "Treatment Completed")

    def test_06_status_persists_across_new_sessions(self):
        """5. Status persists after starting a new authenticated session."""
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Under Treatment"},
        )
        self.logout()

        # New session as doctor
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        get_res = self.client.get(f"/api/patients/{self.patient_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(json.loads(get_res.data)["patient"]["treatment_status"], "Under Treatment")

    def test_07_patient_cannot_change_treatment_status(self):
        """6. Patient cannot change their own treatment status (403 Forbidden)."""
        self.login("anil.kapoor@example.com", "Patient@123")
        res = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Treatment Completed", "confirm": True},
        )
        self.assertEqual(res.status_code, 403)

    def test_08_labtech_cannot_change_treatment_status(self):
        """7. Lab Technician cannot change clinical treatment status (403 on review-status, ignored on update)."""
        self.login("neha.lab@cirrhocare.org", "LabTech@123")

        # 1. Calling review-status endpoint directly -> 403
        res = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Treatment Completed", "confirm": True},
        )
        self.assertEqual(res.status_code, 403)

        # 2. Updating patient via /api/patients/<id> only updates lab_workflow_status
        res_update = self.client.put(
            f"/api/patients/{self.patient_id}",
            json={"status": "Completed"},
        )
        self.assertEqual(res_update.status_code, 200)

        # Verify clinical status didn't change
        with self.app.app_context():
            p = db.session.get(Patient, self.patient_id)
            self.assertEqual(p.lab_workflow_status, "Completed")
            self.assertNotEqual(p.treatment_status, "Completed")
            self.assertEqual(p.treatment_status, "Awaiting Doctor Review")

    def test_09_invalid_status_values_rejected(self):
        """9. Invalid status values are rejected with 400 Bad Request."""
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        res = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "InvalidStatusXYZ"},
        )
        self.assertEqual(res.status_code, 400)
        err = json.loads(res.data)
        self.assertIn("Invalid status", err.get("error", ""))

    def test_10_audit_log_records_valid_status_changes(self):
        """10. Audit logs record valid status changes with doctor, patient, old and new status."""
        self.login("dr.sharma@cirrhocare.org", "Doctor@123")
        res = self.client.patch(
            f"/api/patients/{self.patient_id}/review-status",
            json={"treatment_status": "Under Treatment"},
        )
        self.assertEqual(res.status_code, 200)

        with self.app.app_context():
            logs = ActivityLog.query.filter(
                ActivityLog.action == "Treatment status updated"
            ).order_by(ActivityLog.created_at.desc()).all()
            self.assertTrue(len(logs) > 0)
            latest_log = logs[0]
            self.assertIn("Anil Kapoor", latest_log.details)
            self.assertIn("Under Treatment", latest_log.details)
            self.assertIn("Dr. Raj Sharma", latest_log.details)


if __name__ == "__main__":
    unittest.main()

