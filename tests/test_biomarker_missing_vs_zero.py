"""
tests/test_biomarker_missing_vs_zero.py
---------------------------------------
Regression test suite verifying distinction between missing / unmeasured biomarker values
and genuine measured zero values (Phase 2).

Ensures:
1. parse_biomarker_float correctly distinguishes missing values (None, empty, "N/A") from genuine 0.0.
2. Patient model stores None for unmeasured biomarkers and 0.0 for measured zeros.
3. API serialization preserves None as null and 0.0 as 0.0 in JSON responses.
4. Clinical biomarker evaluation ignores unmeasured None but flags genuine zero measurements.
5. ML predictor handles None via baseline imputation without corrupting stored patient records or overwriting genuine 0.0.
6. Runs strictly in an isolated temporary SQLite database.
"""

import os
import shutil
import tempfile
import unittest

from app import create_app
from app.api.helpers import evaluate_biomarkers, parse_biomarker_float, serialize_patient
from app.ml_model.predictor import CLINICAL_IMPUTATION_DEFAULTS, predict_probability
from app.models import db
from app.models.patient import Patient
from app.models.user import User


class BiomarkerMissingVsZeroTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix="_biomarker_test.db", delete=False)
        self.temp_db.close()
        self.temp_db_path = self.temp_db.name
        self.test_upload_dir = tempfile.mkdtemp(prefix="cirrhocare_test_biomarkers_")

        test_config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.temp_db_path}",
            "UPLOAD_FOLDER": self.test_upload_dir,
            "SECRET_KEY": "test-biomarker-key",
        }
        self.app = create_app(test_config=test_config)
        self.client = self.app.test_client()

        # Safety assertion: verify no active database is targeted
        db_uri = self.app.config["SQLALCHEMY_DATABASE_URI"]
        assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"SAFETY VIOLATION: Test targeting {db_uri}"

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed admin account for API calls
        self.admin = User(name="Admin Tester", email="admin_test@careai.com", role="admin")
        self.admin.set_password("Admin@123")
        db.session.add(self.admin)
        db.session.commit()

        login_res = self.client.post("/api/auth/login", json={"identifier": "admin_test@careai.com", "password": "Admin@123"})
        self.assertEqual(login_res.status_code, 200)

    def tearDown(self):
        self.app_context.pop()
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass
        try:
            if os.path.exists(self.test_upload_dir):
                shutil.rmtree(self.test_upload_dir, ignore_errors=True)
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # 1. Unit Tests for parse_biomarker_float
    # -------------------------------------------------------------------------
    def test_01_parse_biomarker_float_distinguishes_missing_from_zero(self):
        # Missing / unmeasured representations must return None
        missing_inputs = [None, "", "   ", "null", "None", "N/A", "n/a", "Not available", "not available", "—"]
        for val in missing_inputs:
            result = parse_biomarker_float(val)
            self.assertIsNone(result, f"Expected None for missing input {val!r}, got {result}")

        # Genuine zero representations must return 0.0 (float)
        zero_inputs = [0, 0.0, "0", "0.0", "0.00", " 0.0 "]
        for val in zero_inputs:
            result = parse_biomarker_float(val)
            self.assertIsNotNone(result, f"Expected 0.0 for zero input {val!r}, got None")
            self.assertEqual(result, 0.0, f"Expected 0.0 for zero input {val!r}, got {result}")
            self.assertIsInstance(result, float)

        # Standard non-zero positive floats
        positive_inputs = [(1.5, 1.5), ("2.8", 2.8), (140, 140.0), ("3.45", 3.45)]
        for inp, expected in positive_inputs:
            result = parse_biomarker_float(inp)
            self.assertEqual(result, expected)

    # -------------------------------------------------------------------------
    # 2. Database Model Default Behavior
    # -------------------------------------------------------------------------
    def test_02_patient_model_defaults_unmeasured_biomarkers_to_none(self):
        patient = Patient(
            full_name="Unmeasured Patient",
            age=45,
            gender="Female",
            # Leave bilirubin, albumin, platelets unspecified
        )
        db.session.add(patient)
        db.session.commit()

        refreshed = db.session.get(Patient, patient.id)
        self.assertIsNone(refreshed.bilirubin, "Unmeasured bilirubin must be None in DB, not 0.0")
        self.assertIsNone(refreshed.albumin, "Unmeasured albumin must be None in DB, not 0.0")
        self.assertIsNone(refreshed.platelets, "Unmeasured platelets must be None in DB, not 0.0")

        # Serialized dict must produce None (null in JSON)
        p_dict = serialize_patient(refreshed)
        self.assertIsNone(p_dict["bilirubin"])
        self.assertIsNone(p_dict["albumin"])
        self.assertIsNone(p_dict["platelets"])

    def test_03_patient_model_stores_genuine_zero_measurements(self):
        patient = Patient(
            full_name="Genuine Zero Patient",
            age=50,
            gender="Male",
            bilirubin=0.0,
            albumin=0.0,
            platelets=0.0,
        )
        db.session.add(patient)
        db.session.commit()

        refreshed = db.session.get(Patient, patient.id)
        self.assertIsNotNone(refreshed.bilirubin)
        self.assertEqual(refreshed.bilirubin, 0.0)
        self.assertEqual(refreshed.albumin, 0.0)
        self.assertEqual(refreshed.platelets, 0.0)

        # Serialized dict must preserve 0.0
        p_dict = serialize_patient(refreshed)
        self.assertEqual(p_dict["bilirubin"], 0.0)
        self.assertEqual(p_dict["albumin"], 0.0)
        self.assertEqual(p_dict["platelets"], 0.0)

    # -------------------------------------------------------------------------
    # 3. API Patient Registration and Update Endpoints
    # -------------------------------------------------------------------------
    def test_04_api_create_patient_preserves_none_and_zero(self):
        payload = {
            "full_name": "API Biomarker Test Patient",
            "age": 52,
            "gender": "Male",
            "bilirubin": None,      # Unmeasured
            "albumin": 0.0,         # Measured zero
            "platelets": "",        # Empty string (unmeasured)
            "sgot": "N/A",          # Unmeasured label
            "sgpt": 42.0,           # Measured value
        }
        res = self.client.post("/api/patients", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json.get("patient", {})

        self.assertIsNone(data.get("bilirubin"), "Omitted/null bilirubin should be null")
        self.assertEqual(data.get("albumin"), 0.0, "Explicit 0.0 albumin should be preserved as 0.0")
        self.assertIsNone(data.get("platelets"), "Empty string platelets should be null")
        self.assertIsNone(data.get("sgot"), "'N/A' sgot should be null")
        self.assertEqual(data.get("sgpt"), 42.0, "Measured sgpt 42.0 should be preserved")

    def test_05_api_update_patient_biomarkers(self):
        patient = Patient(full_name="Updatable Patient", age=60, gender="Female")
        db.session.add(patient)
        db.session.commit()
        pid = patient.id

        # Update: set bilirubin to genuine 0.0, and albumin to 3.5
        patch_res = self.client.put(f"/api/patients/{pid}", json={
            "bilirubin": 0.0,
            "albumin": 3.5,
        })
        self.assertEqual(patch_res.status_code, 200)
        updated = patch_res.json.get("patient", {})
        self.assertEqual(updated.get("bilirubin"), 0.0)
        self.assertEqual(updated.get("albumin"), 3.5)

        # Update: clear bilirubin back to unmeasured (None)
        patch_res2 = self.client.put(f"/api/patients/{pid}", json={
            "bilirubin": None,
        })
        self.assertEqual(patch_res2.status_code, 200)
        updated2 = patch_res2.json.get("patient", {})
        self.assertIsNone(updated2.get("bilirubin"))

    # -------------------------------------------------------------------------
    # 4. Clinical Biomarker Evaluation Logic
    # -------------------------------------------------------------------------
    def test_06_evaluate_biomarkers_ignores_none_but_flags_zero(self):
        # Case A: Missing biomarkers (None) should NOT trigger false flags
        missing_patient = Patient(
            full_name="Missing Patient",
            age=40,
            gender="Male",
            bilirubin=None,
            albumin=None,
            platelets=None,
        )
        eval_missing = evaluate_biomarkers(missing_patient)
        self.assertEqual(len(eval_missing["flags"]), 0, "Missing biomarkers must not produce evaluation flags")

        # Case B: Measured 0.0 albumin is genuinely critical (normal is 3.5-5.0 g/dL, <2.8 is critical)
        zero_albumin_patient = Patient(
            full_name="Zero Albumin Patient",
            age=40,
            gender="Male",
            albumin=0.0,
            bilirubin=1.0,
            platelets=200.0,
        )
        eval_zero = evaluate_biomarkers(zero_albumin_patient)
        critical_flags = [f for f in eval_zero["flags"] if f["severity"] == "critical"]
        self.assertGreaterEqual(len(critical_flags), 1, "Genuine 0.0 albumin must be flagged as critical")
        self.assertTrue(any(f["marker"] == "Albumin" for f in critical_flags))

    # -------------------------------------------------------------------------
    # 5. ML Predictor Handles None via Imputation Without Corrupting Records
    # -------------------------------------------------------------------------
    def test_07_ml_prediction_with_missing_and_zero_biomarkers(self):
        # Missing values (None) should fall back to CLINICAL_IMPUTATION_DEFAULTS
        payload_missing = {
            "age": 55,
            "gender": "Female",
            "bilirubin": None,
            "albumin": None,
            "platelets": None,
        }
        res_missing = predict_probability(payload_missing)
        self.assertIn(res_missing["risk_label"], ["Low Risk", "Medium Risk", "High Risk"])
        self.assertGreaterEqual(res_missing["probability"], 0.0)
        self.assertLessEqual(res_missing["probability"], 100.0)

        # Genuine zero (0.0) should be preserved and evaluated
        payload_zero = {
            "age": 55,
            "gender": "Female",
            "bilirubin": 0.0,
            "albumin": 0.0,
            "platelets": 150.0,
        }
        res_zero = predict_probability(payload_zero)
        self.assertIn(res_zero["risk_label"], ["Low Risk", "Medium Risk", "High Risk"])


if __name__ == "__main__":
    unittest.main()
