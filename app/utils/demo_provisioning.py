"""
app.utils.demo_provisioning
---------------------------
Safely provisions dedicated, clearly labeled demo user accounts in the isolated
demo environment (instance/demo_cirrhosis.db) or temporary test databases.

Guarantees:
1. Hard safety guard: strictly prohibited from executing against the production database (instance/cirrhosis.db).
2. Idempotent: ensures existing accounts are not duplicated.
3. Provisions dedicated demo users for all four system roles:
   - Admin (demo.admin@cirrhocare.org / DemoAdmin@123)
   - Doctor / Hepatologist (demo.doctor@cirrhocare.org / DemoDoctor@123)
   - Lab Technician (demo.labtech@cirrhocare.org / DemoLab@123)
   - Patient (demo.patient@cirrhocare.org / DemoPatient@123 / Portal ID: PAT-1001)
4. Provisions a linked demo Patient profile in the patients table so clinical workflows work out-of-the-box.
"""

from datetime import datetime, timezone


DEMO_USERS_SPEC = [
    {
        "role": "admin",
        "name": "Demo Administrator",
        "email": "demo.admin@cirrhocare.org",
        "portal_id": "ADM-DEMO",
        "password": "DemoAdmin@123",
    },
    {
        "role": "hepatologist",
        "name": "Dr. Demo Hepatologist",
        "email": "demo.doctor@cirrhocare.org",
        "portal_id": "DOC-DEMO",
        "password": "DemoDoctor@123",
    },
    {
        "role": "labtech",
        "name": "Demo Lab Technician",
        "email": "demo.labtech@cirrhocare.org",
        "portal_id": "LAB-DEMO",
        "password": "DemoLab@123",
    },
    {
        "role": "patient",
        "name": "Demo Patient",
        "email": "demo.patient@cirrhocare.org",
        "portal_id": "PAT-1001",
        "password": "DemoPatient@123",
    },
]


def is_demo_allowed(app=None):
    """
    Returns True if demo features are authorized for the active application context.
    Strictly returns False if the database URI points to production cirrhosis.db,
    or if DEMO_MODE is disabled.
    """
    import os
    from flask import current_app
    from config import Config

    target_app = app or current_app
    if not target_app:
        return False

    db_uri = str(target_app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/").lower()

    # Absolute production database protection: Never allow demo mode against cirrhosis.db
    if "instance/cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db"):
        return False

    # Check app config first
    app_demo_mode = target_app.config.get("DEMO_MODE")
    if app_demo_mode is not None:
        if isinstance(app_demo_mode, str):
            is_demo_cfg = app_demo_mode.strip().lower() in ("true", "1", "yes")
        else:
            is_demo_cfg = bool(app_demo_mode)
    else:
        env_val = os.getenv("DEMO_MODE")
        if env_val is not None:
            is_demo_cfg = env_val.strip().lower() in ("true", "1", "yes")
        else:
            is_demo_cfg = bool(getattr(Config, "DEMO_MODE", False))

    return bool(is_demo_cfg)


def ensure_demo_accounts_provisioned(app=None, force=False):
    """
    Safely provisions 4 standard demo accounts (admin, hepatologist, labtech, patient)
    and a linked demo patient profile.

    Parameters:
    -----------
    app : Flask instance, optional
    force : bool, default False
        If False, only automatically executes if active DB is instance/demo_cirrhosis.db.
        If True, executes if demo/testing mode is enabled and active DB is NOT production cirrhosis.db.
    """
    from flask import current_app
    from app.models import db
    from app.models.patient import Patient
    from app.models.user import User

    target_app = app or current_app
    if not target_app:
        return {"provisioned": 0, "status": "no_app"}

    db_uri = str(target_app.config.get("SQLALCHEMY_DATABASE_URI", "")).replace("\\", "/").lower()

    if not is_demo_allowed(target_app):
        return {"provisioned": 0, "status": "demo_disabled"}

    # Critical security guard: never execute against production database
    if "instance/cirrhosis.db" in db_uri or db_uri.endswith("/cirrhosis.db"):
        raise RuntimeError(
            "CRITICAL SECURITY GUARD: ensure_demo_accounts_provisioned() must never be executed "
            "against the production database (instance/cirrhosis.db)!"
        )

    # Guard: for startup seeding, only auto-run if targeting demo_cirrhosis.db
    if not force and "demo_cirrhosis.db" not in db_uri:
        return {"provisioned": 0, "status": "skipped_non_demo_db"}

    users_created = 0

    # 1. Ensure User accounts exist
    doctor_user = None
    for spec in DEMO_USERS_SPEC:
        existing = User.query.filter_by(email=spec["email"]).first()
        if not existing:
            # Also check by portal_id if applicable
            if spec.get("portal_id"):
                existing = User.query.filter_by(portal_id=spec["portal_id"]).first()

        if not existing:
            u = User(
                name=spec["name"],
                email=spec["email"],
                portal_id=spec.get("portal_id"),
                role=spec["role"],
                active=True,
                must_change_password=False,
            )
            u.set_password(spec["password"])
            db.session.add(u)
            users_created += 1
            if spec["role"] == "hepatologist":
                doctor_user = u
        else:
            if spec["role"] == "hepatologist":
                doctor_user = existing

    if users_created > 0:
        db.session.commit()

    # 2. Ensure Doctor reference is retrieved
    if not doctor_user:
        doctor_user = User.query.filter_by(role="hepatologist").first()

    # 3. Ensure demo Patient record exists (PAT-1001)
    demo_patient = Patient.query.filter_by(portal_id="PAT-1001").first()
    if not demo_patient:
        demo_patient = Patient(
            portal_id="PAT-1001",
            full_name="Demo Patient",
            email="demo.patient@cirrhocare.org",
            age=54,
            gender="Female",
            phone="+1 (555) 234-5678",
            bilirubin=2.4,
            albumin=3.1,
            sgot=82.0,
            sgpt=76.0,
            platelets=142.0,
            cholesterol=240.0,
            prothrombin=12.8,
            ascites=True,
            hepatomegaly=True,
            spiders=False,
            edema=False,
            copper=98.0,
            alk_phos=135.0,
            triglycerides=180.0,
            latest_risk_label="High",
            latest_risk_percent=84.2,
            treatment_status="Active clinical management",
            created_by_id=doctor_user.id if doctor_user else None,
        )
        db.session.add(demo_patient)
        db.session.commit()

    # 4. If targeting demo_cirrhosis.db, ensure demo prescriptions are also seeded
    if "demo_cirrhosis.db" in db_uri:
        from app.utils.demo_prescriptions import ensure_demo_prescriptions_seeded
        ensure_demo_prescriptions_seeded(target_app)

    return {"provisioned": users_created, "status": "success"}
