"""
app.utils.demo_prescriptions
----------------------------
Defines realistic, clearly labeled fictional demo prescriptions for the isolated
demo environment (instance/demo_cirrhosis.db).
Ensures safe idempotent seeding: only inserts when Prescription table is empty in demo mode.
Strictly prohibited from touching production database (instance/cirrhosis.db).
"""

from datetime import datetime, timedelta, timezone

from app.models import db
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.user import User


def get_demo_prescriptions_data(now=None):
    if now is None:
        now = datetime.now(timezone.utc)
    today = now.date()

    return [
        {
            "patient_portal_id": "PAT-1001",  # Eleanor Vance [DEMO] - High Risk (84.2%)
            "medicine": "Spironolactone & Furosemide",
            "dosage": "Spironolactone 100mg PO daily in AM, Furosemide 40mg PO daily in AM",
            "frequency_days": 30,
            "clinical_notes": "[DEMO] Dual diuretic titration for ascites and peripheral edema secondary to decompensated cirrhosis. Monitor serum potassium, sodium, and creatinine every 7-10 days. Report rapid weight drop (>0.5 kg/day dry).",
            "diet_suggestion": "Strict low-sodium regimen (< 2.0g NaCl / day). Fluid restriction to 1.5 L/day. Adequate protein intake (1.2-1.5 g/kg/day). Absolute alcohol abstinence.",
            "follow_up_date": today + timedelta(days=14),
            "created_at": now - timedelta(days=12),
        },
        {
            "patient_portal_id": "PAT-1004",  # Arthur Pendelton [DEMO] - High Risk (89.1%)
            "medicine": "Carvedilol",
            "dosage": "6.25mg PO twice daily with meals (titrate to target resting HR 55-60 bpm)",
            "frequency_days": 60,
            "clinical_notes": "[DEMO] Non-selective beta-blocker therapy for primary prophylaxis against variceal hemorrhage. Blood pressure and heart rate check every 2 weeks. Withhold if systolic BP < 90 mmHg or HR < 50 bpm.",
            "diet_suggestion": "Low sodium (< 2000 mg/day). Avoid non-steroidal anti-inflammatory drugs (NSAIDs) completely. Small frequent calorie-dense meals.",
            "follow_up_date": today + timedelta(days=21),
            "created_at": now - timedelta(days=8),
        },
        {
            "patient_portal_id": "PAT-1005",  # David Kim [DEMO] - Medium Risk (41.5%)
            "medicine": "Ursodeoxycholic Acid (UDCA)",
            "dosage": "300mg PO twice daily with meals",
            "frequency_days": 90,
            "clinical_notes": "[DEMO] Hepatoprotective and cytoprotective therapy for steatohepatitis and early fibrotic remodeling. Reassess liver panel (AST/ALT, ALP, Total Bilirubin) at 3-month clinical interval.",
            "diet_suggestion": "Mediterranean dietary pattern rich in omega-3 fatty acids and antioxidants. Eliminate high-fructose corn syrup and processed carbohydrates. Aim for 7-10% gradual body weight reduction.",
            "follow_up_date": today + timedelta(days=45),
            "created_at": now - timedelta(days=5),
        },
        {
            "patient_portal_id": "PAT-1003",  # Sophia Chen [DEMO] - Low Risk (12.3%)
            "medicine": "Vitamin E (d-alpha-tocopherol)",
            "dosage": "800 IU PO once daily with breakfast",
            "frequency_days": 90,
            "clinical_notes": "[DEMO] Antioxidant therapy for non-diabetic hepatic steatosis. Biomarkers stable. Annual ultrasound and elastography surveillance recommended.",
            "diet_suggestion": "Low-glycemic Mediterranean diet. Maintain regular aerobic exercise (150 minutes/week). Hydration with water; limit sweetened beverages.",
            "follow_up_date": today + timedelta(days=60),
            "created_at": now - timedelta(days=4),
        },
        {
            "patient_portal_id": "PAT-1008",  # Aisha Patel [DEMO] - Medium Risk (48.2%)
            "medicine": "Lactulose Oral Solution",
            "dosage": "20 mL (13.3g) PO three times daily, titrated to 2-3 soft bowel movements daily",
            "frequency_days": 30,
            "clinical_notes": "[DEMO] Non-absorbable disaccharide for reduction of blood ammonia and primary prophylaxis of hepatic encephalopathy. Re-evaluate asterixis and psychomotor function.",
            "diet_suggestion": "Adequate dietary fiber intake. Ensure hydration. Moderate vegetable protein consumption (1.0-1.2 g/kg/day). Avoid heavy sedative medications.",
            "follow_up_date": today + timedelta(days=14),
            "created_at": now - timedelta(days=2),
        },
    ]


def ensure_demo_prescriptions_seeded(app=None):
    """
    Safely seeds demo prescriptions into the demo database if empty.
    Strictly asserts that the active database is instance/demo_cirrhosis.db.
    Does NOT duplicate records if prescriptions already exist.
    """
    from flask import current_app
    from config import Config

    target_app = app or current_app
    db_uri = str(target_app.config.get("SQLALCHEMY_DATABASE_URI", ""))

    # Hard safety guard: strictly forbid touching production database
    is_demo_mode = getattr(Config, "DEMO_MODE", False) or "demo_cirrhosis.db" in db_uri
    if not is_demo_mode or "demo_cirrhosis.db" not in db_uri:
        return 0

    assert "demo_cirrhosis.db" in db_uri, "Safety violation: must target demo_cirrhosis.db"
    assert "instance/cirrhosis.db" not in db_uri.replace("\\", "/"), "Safety violation: must not target cirrhosis.db"

    # Check if prescriptions already exist to prevent duplicate records
    existing_count = Prescription.query.count()
    if existing_count > 0:
        return 0

    doctor = User.query.filter_by(role="hepatologist").first()
    if not doctor:
        doctor = User.query.filter_by(role="admin").first()
    if not doctor:
        return 0

    now = datetime.now(timezone.utc)
    rx_items = get_demo_prescriptions_data(now)
    inserted = 0

    for item in rx_items:
        patient = Patient.query.filter_by(portal_id=item["patient_portal_id"]).first()
        if not patient:
            continue

        rx = Prescription(
            patient_id=patient.id,
            doctor_id=doctor.id,
            medicine=item["medicine"],
            dosage=item["dosage"],
            frequency_days=item["frequency_days"],
            clinical_notes=item["clinical_notes"],
            diet_suggestion=item["diet_suggestion"],
            follow_up_date=item["follow_up_date"],
            created_at=item["created_at"],
        )
        db.session.add(rx)
        inserted += 1

    if inserted > 0:
        db.session.commit()
        print(f"[CirrhoCare AI] Seeded {inserted} fictional demo prescriptions in demo_cirrhosis.db")

    return inserted
