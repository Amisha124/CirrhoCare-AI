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


PATIENT_PORTAL_ID = "PAT-1001"


def create_user(name, email, role, password, portal_id=None):
    user = User(name=name, email=email, role=role, portal_id=portal_id)
    user.set_password(password)
    db.session.add(user)
    return user


app = create_app()

with app.app_context():
    # Strict safety guard: Only permit destructive reset if explicitly in demo mode
    # and resolved database is verified to be the dedicated demo database (demo_cirrhosis.db)
    db_uri = str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/")
    is_demo = bool(app.config.get("DEMO_MODE", False))

    if not is_demo:
        raise RuntimeError(
            "SAFETY VIOLATION: reset_demo_data.py can only be run when DEMO_MODE=True is configured in the environment."
        )

    if "instance/demo_cirrhosis.db" not in db_uri and not db_uri.endswith("/demo_cirrhosis.db"):
        raise RuntimeError(
            f"SAFETY VIOLATION: reset_demo_data.py must target the dedicated demo database (demo_cirrhosis.db), "
            f"but resolved database is: {db_uri}"
        )

    if "cirrhosis.db" in db_uri and "demo_cirrhosis.db" not in db_uri:
        raise RuntimeError(
            f"CRITICAL SAFETY VIOLATION: reset_demo_data.py attempted to target production database ({db_uri})!"
        )

    for model in [Notification, ActivityLog, Appointment, Report, Prescription, Prediction, Patient, User]:
        db.session.query(model).delete()
    db.session.commit()

    create_user("System Admin", "admin@careai.com", "admin", "Admin@123")
    create_user("Lab Technician", "lab@careai.com", "labtech", "Lab@123")
    create_user("Dr. Hepato Care", "doctor@careai.com", "hepatologist", "Doctor@123")
    create_user("Demo Patient", "patient@careai.com", "patient", "Patient@123", portal_id=PATIENT_PORTAL_ID)

    db.session.add(Patient(
        full_name="Demo Patient",
        portal_id=PATIENT_PORTAL_ID,
        age=45,
        gender="Female",
        phone="9876543210",
        email="patient@careai.com",
        bilirubin=1.2,
        albumin=3.8,
        sgot=50,
        sgpt=45,
        platelets=220,
        cholesterol=180,
        prothrombin=11,
        copper=80,
        alk_phos=700,
        triglycerides=120,
        latest_risk_label="Pending",
        latest_risk_percent=0,
        treatment_status="Awaiting review",
    ))

    db.session.commit()
    print("Fresh demo data created.")
    print("Admin: admin@careai.com / Admin@123")
    print("Lab: lab@careai.com / Lab@123")
    print("Doctor: doctor@careai.com / Doctor@123")
    print(f"Patient Login ID: {PATIENT_PORTAL_ID} / Patient@123")
    print("Patient email also works: patient@careai.com / Patient@123")
