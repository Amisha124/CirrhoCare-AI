"""
CirrhoCare AI - Isolated E2E Test Server
Runs strictly against an isolated temporary SQLite database and temporary upload directory.
Serves the unified Flask backend + React SPA (frontend/dist) on http://127.0.0.1:5055.
NEVER touches instance/cirrhosis.db.
"""
import atexit
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.report import Report
from app.models.user import User

TEMP_DB = tempfile.NamedTemporaryFile(suffix="_e2e.db", delete=False)
TEMP_DB.close()
TEMP_DB_PATH = TEMP_DB.name
TEMP_UPLOAD_DIR = tempfile.mkdtemp(prefix="cirrhocare_e2e_uploads_")

def cleanup():
    try:
        if os.path.exists(TEMP_DB_PATH):
            os.remove(TEMP_DB_PATH)
    except Exception:
        pass
    try:
        if os.path.exists(TEMP_UPLOAD_DIR):
            shutil.rmtree(TEMP_UPLOAD_DIR, ignore_errors=True)
    except Exception:
        pass

atexit.register(cleanup)

test_config = {
    "TESTING": True,
    "WTF_CSRF_ENABLED": False,
    "SQLALCHEMY_DATABASE_URI": f"sqlite:///{TEMP_DB_PATH}",
    "UPLOAD_FOLDER": TEMP_UPLOAD_DIR,
    "EXPOSE_DEV_RESET_URL": False,
    "SECRET_KEY": "e2e_super_secret_test_key",
}

app = create_app(test_config=test_config)

# Safety check
db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
assert "instance" not in db_uri and "cirrhosis.db" not in db_uri, f"FATAL SAFETY VIOLATION: E2E server targeting {db_uri}"

with app.app_context():
    db.create_all()

    # Seed isolated test accounts
    admin = User(name="Admin User", email="admin_test@careai.com", role="admin")
    admin.set_password("Admin@123")

    labtech = User(name="Lab Tech", email="lab_test@careai.com", role="labtech")
    labtech.set_password("Lab@123")

    doctor = User(name="Dr. Hepatologist", email="doc_test@careai.com", role="hepatologist")
    doctor.set_password("Doctor@123")

    alice = User(name="Alice Patient", email="alice_test@careai.com", role="patient", portal_id="PAT-U101")
    alice.set_password("Patient@123")

    bob = User(name="Bob Patient", email="bob_test@careai.com", role="patient", portal_id="PAT-U102")
    bob.set_password("Patient@123")

    db.session.add_all([admin, labtech, doctor, alice, bob])
    db.session.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Seed clinical patients
    p_alice = Patient(
        full_name="Alice Patient",
        portal_id="PAT-U101",
        email="alice_test@careai.com",
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
        treatment_status="Under review",
        created_by_id=labtech.id,
        created_at=now - timedelta(days=10),
    )

    p_bob = Patient(
        full_name="Bob Patient",
        portal_id="PAT-U102",
        email="bob_test@careai.com",
        phone="+1-555-0102",
        age=55,
        gender="Male",
        bilirubin=0.9,
        albumin=4.2,
        platelets=250.0,
        sgot=24.0,
        sgpt=26.0,
        prothrombin=10.8,
        latest_risk_label="Low Risk",
        latest_risk_percent=18.2,
        treatment_status="Stable",
        created_by_id=labtech.id,
        created_at=now - timedelta(days=8),
    )
    db.session.add_all([p_alice, p_bob])
    db.session.commit()

    # Seed appointments
    appnt = Appointment(
        patient_id=p_alice.id,
        doctor_id=doctor.id,
        scheduled_at=now + timedelta(days=2),
        reason="Clinical liver review and ultrasound follow-up",
        status="Scheduled",
    )
    db.session.add(appnt)

    # Seed notifications
    n_admin = Notification(
        user_id=admin.id,
        role="admin",
        title="Security Audit Check",
        message="System security scan completed with 0 warnings.",
        category="system",
        read=False,
    )
    n_doc = Notification(
        user_id=doctor.id,
        role="hepatologist",
        title="Lab Report Ready",
        message="Alice Patient blood panel analysis is available for clinical review.",
        category="clinical",
        read=False,
    )
    n_alice = Notification(
        user_id=alice.id,
        role="patient",
        title="Appointment Confirmed",
        message="Consultation scheduled with Dr. Hepatologist for upcoming liver checkup.",
        category="appointment",
        read=False,
    )
    db.session.add_all([n_admin, n_doc, n_alice])

    # Seed audit activity logs
    log1 = ActivityLog(
        user_id=admin.id,
        action="System Initialized (E2E Test)",
        details="Isolated E2E testing environment bootstrap",
    )
    log2 = ActivityLog(
        user_id=labtech.id,
        action="Lab Panel Processed",
        details="Biomarkers verified for PAT-U101",
    )
    db.session.add_all([log1, log2])
    db.session.commit()

    # Seed report file
    rep_path = Path(TEMP_UPLOAD_DIR) / "alice_diagnostic_report.pdf"
    rep_path.write_bytes(b"%PDF-1.4 Clinical Diagnostic Evaluation Specimen")

    rep = Report(
        patient_id=p_alice.id,
        filename="alice_diagnostic_report.pdf",
        original_filename="blood_panel_alice.pdf",
        category="Lab report",
    )
    db.session.add(rep)
    db.session.commit()

if __name__ == "__main__":
    from waitress import serve
    port = int(os.getenv("E2E_PORT", "5055"))
    print(f"Starting CirrhoCare AI isolated E2E server on http://127.0.0.1:{port} (DB: {TEMP_DB_PATH})...", flush=True)
    serve(app, host="127.0.0.1", port=port, threads=4)
