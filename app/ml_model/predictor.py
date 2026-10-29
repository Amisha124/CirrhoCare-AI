from pathlib import Path

import joblib
import pandas as pd

from app.ml_model.train_model import MODEL_PATH, train


FEATURES = [
    "age", "gender", "bilirubin", "albumin", "sgot", "sgpt", "platelets", "cholesterol",
    "prothrombin", "ascites", "hepatomegaly", "spiders", "edema", "copper", "alk_phos",
    "triglycerides",
]


def _load_bundle():
    if not Path(MODEL_PATH).exists():
        train()
    return joblib.load(MODEL_PATH)


def risk_label(probability):
    if probability >= 70:
        return "High Risk"
    if probability >= 35:
        return "Medium Risk"
    return "Low Risk"


CLINICAL_IMPUTATION_DEFAULTS = {
    "age": 45,
    "gender": 0,
    "bilirubin": 1.0,
    "albumin": 4.0,
    "sgot": 35.0,
    "sgpt": 35.0,
    "platelets": 250.0,
    "cholesterol": 190.0,
    "prothrombin": 11.5,
    "ascites": 0,
    "hepatomegaly": 0,
    "spiders": 0,
    "edema": 0,
    "copper": 75.0,
    "alk_phos": 80.0,
    "triglycerides": 120.0,
}


def predict_probability(payload):
    bundle = _load_bundle()
    values = {}
    for feature in FEATURES:
        raw_val = payload.get(feature)
        if raw_val is None:
            values[feature] = CLINICAL_IMPUTATION_DEFAULTS.get(feature, 0)
        else:
            values[feature] = raw_val

    values["gender"] = 1 if str(values["gender"]).lower().startswith("m") else 0
    for key in ["ascites", "hepatomegaly", "spiders", "edema"]:
        values[key] = 1 if values.get(key) in [True, "true", "1", 1, "on", "yes"] else 0
    frame = pd.DataFrame([values], columns=FEATURES)
    probability = float(bundle["model"].predict_proba(frame)[0][1] * 100)
    confidence = max(probability, 100 - probability)
    return {
        "probability": round(probability, 2),
        "risk_label": risk_label(probability),
        "confidence": round(confidence, 2),
        "model_accuracy": round(float(bundle.get("accuracy", 0)) * 100, 2),
    }
