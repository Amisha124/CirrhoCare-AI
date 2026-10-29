"""
CirrhoCare AI - Isolated Demo Database Generator
================================================
Generates a realistic, synthetic demo database strictly at:
    instance/demo_cirrhosis.db
NEVER modifies, resets, or touches instance/cirrhosis.db.

All generated records are explicitly labeled with [DEMO] designations.
Never describes generated data as real clinical evidence.

Usage:
    python scripts/generate_isolated_demo_db.py
"""
import os
from pathlib import Path
import sys

# Ensure repository root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from datetime import datetime, timedelta, timezone
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

TARGET_DEMO_DB = BASE_DIR / "instance" / "demo_cirrhosis.db"

def generate_demo_database():
    print(f"[*] Preparing isolated demo database: {TARGET_DEMO_DB}")

    # Safety assertion: strictly forbid targeting active database
    assert "demo_cirrhosis.db" in str(TARGET_DEMO_DB), "FATAL: Must target demo_cirrhosis.db"
    assert "instance/cirrhosis.db" not in str(TARGET_DEMO_DB).replace("\\", "/"), "FATAL: Must not target production database"

    test_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{TARGET_DEMO_DB}",
        "WTF_CSRF_ENABLED": False,
        "SECRET_KEY": "demo-isolated-session-key",
    }

    app = create_app(test_config=test_config)

    with app.app_context():
        # Ensure fresh schema exclusively inside demo database
        db.drop_all()
        db.create_all()

        # Seed 4 standard demo user accounts
        admin = User(name="System Admin [Demo]", email="admin@careai.com", role="admin", active=True)
        admin.set_password("Admin@123")
        db.session.add(admin)

        doctor = User(name="Dr. Hepato Care [Demo]", email="doctor@careai.com", role="hepatologist", active=True)
        doctor.set_password("Doctor@123")
        db.session.add(doctor)

        labtech = User(name="Lab Technician [Demo]", email="lab@careai.com", role="labtech", active=True)
        labtech.set_password("Lab@123")
        db.session.add(labtech)

        patient_demo = User(name="Eleanor Vance [Demo]", email="patient@careai.com", role="patient", portal_id="PAT-1001", active=True)
        patient_demo.set_password("Patient@123")
        db.session.add(patient_demo)

        db.session.commit()

        # Reference dates for registration history (Apr - Sep 2026)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        # 8 Fictional Demo Patients with staggered created_at and realistic clinical profiles
        demo_patients_data = [
            {
                "full_name": "Eleanor Vance [DEMO]",
                "portal_id": "PAT-1001",
                "email": "eleanor.demo@fictional.care",
                "phone": "+1-555-0101",
                "age": 58,
                "gender": "Female",
                "bilirubin": 4.6,
                "albumin": 2.5,
                "platelets": 92.0,
                "sgot": 88.0,
                "sgpt": 74.0,
                "prothrombin": 14.8,
                "latest_risk_label": "High Risk",
                "latest_risk_percent": 84.2,
                "treatment_status": "Needs urgent review",
                "created_at": now - timedelta(days=150), # ~Apr
            },
            {
                "full_name": "Marcus Holloway [DEMO]",
                "portal_id": "PAT-1002",
                "email": "marcus.demo@fictional.care",
                "phone": "+1-555-0102",
                "age": 49,
                "gender": "Male",
                "bilirubin": 2.4,
                "albumin": 3.2,
                "platelets": 138.0,
                "sgot": 61.0,
                "sgpt": 52.0,
                "prothrombin": 12.6,
                "latest_risk_label": "Medium Risk",
                "latest_risk_percent": 54.7,
                "treatment_status": "Under review",
                "created_at": now - timedelta(days=120), # ~May
            },
            {
                "full_name": "Sophia Chen [DEMO]",
                "portal_id": "PAT-1003",
                "email": "sophia.demo@fictional.care",
                "phone": "+1-555-0103",
                "age": 36,
                "gender": "Female",
                "bilirubin": 0.9,
                "albumin": 4.1,
                "platelets": 245.0,
                "sgot": 22.0,
                "sgpt": 24.0,
                "prothrombin": 11.2,
                "latest_risk_label": "Low Risk",
                "latest_risk_percent": 12.3,
                "treatment_status": "Stable",
                "created_at": now - timedelta(days=90), # ~Jun
            },
            {
                "full_name": "Arthur Pendelton [DEMO]",
                "portal_id": "PAT-1004",
                "email": "arthur.demo@fictional.care",
                "phone": "+1-555-0104",
                "age": 67,
                "gender": "Male",
                "bilirubin": 5.1,
                "albumin": 2.2,
                "platelets": 81.0,
                "sgot": 96.0,
                "sgpt": 82.0,
                "prothrombin": 15.4,
                "latest_risk_label": "High Risk",
                "latest_risk_percent": 89.1,
                "treatment_status": "Needs urgent review",
                "created_at": now - timedelta(days=60), # ~Jul
            },
            {
                "full_name": "David Kim [DEMO]",
                "portal_id": "PAT-1005",
                "email": "david.demo@fictional.care",
                "phone": "+1-555-0105",
                "age": 42,
                "gender": "Male",
                "bilirubin": 1.8,
                "albumin": 3.5,
                "platelets": 165.0,
                "sgot": 44.0,
                "sgpt": 39.0,
                "prothrombin": 12.1,
                "latest_risk_label": "Medium Risk",
                "latest_risk_percent": 41.5,
                "treatment_status": "Awaiting review",
                "created_at": now - timedelta(days=35), # ~Aug
            },
            {
                "full_name": "Grace Hopper [DEMO]",
                "portal_id": "PAT-1006",
                "email": "grace.demo@fictional.care",
                "phone": "+1-555-0106",
                "age": 27,
                "gender": "Female",
                "bilirubin": 0.8,
                "albumin": 4.3,
                "platelets": 260.0,
                "sgot": 19.0,
                "sgpt": 21.0,
                "prothrombin": 10.9,
                "latest_risk_label": "Low Risk",
                "latest_risk_percent": 8.6,
                "treatment_status": "Stable",
                "created_at": now - timedelta(days=20), # ~Sep
            },
            {
                "full_name": "Robert Martinez [DEMO]",
                "portal_id": "PAT-1007",
                "email": "robert.demo@fictional.care",
                "phone": "+1-555-0107",
                "age": 53,
                "gender": "Male",
                "bilirubin": 1.1,
                "albumin": 3.9,
                "platelets": 210.0,
                "sgot": 26.0,
                "sgpt": 28.0,
                "prothrombin": 11.5,
                "latest_risk_label": "Low Risk",
                "latest_risk_percent": 14.8,
                "treatment_status": "Stable",
                "created_at": now - timedelta(days=10),
            },
            {
                "full_name": "Aisha Patel [DEMO]",
                "portal_id": "PAT-1008",
                "email": "aisha.demo@fictional.care",
                "phone": "+1-555-0108",
                "age": 44,
                "gender": "Female",
                "bilirubin": 2.1,
                "albumin": 3.3,
                "platelets": 150.0,
                "sgot": 52.0,
                "sgpt": 48.0,
                "prothrombin": 12.4,
                "latest_risk_label": "Medium Risk",
                "latest_risk_percent": 48.2,
                "treatment_status": "Under review",
                "created_at": now - timedelta(days=2),
            },
        ]

        patients_map = {}
        for pdata in demo_patients_data:
            p = Patient(**pdata)
            db.session.add(p)
            patients_map[pdata["portal_id"]] = p

        db.session.commit()

        # 4 Fictional Appointments with distinct statuses: Confirmed (Scheduled), Completed, Rescheduled, Cancelled
        app1 = Appointment(
            patient_id=patients_map["PAT-1001"].id,
            doctor_id=doctor.id,
            scheduled_at=now + timedelta(days=2, hours=10),
            status="Confirmed",
            reason="[DEMO] Urgent decompensated cirrhosis evaluation & ascites management",
        )
        app2 = Appointment(
            patient_id=patients_map["PAT-1002"].id,
            doctor_id=doctor.id,
            scheduled_at=now + timedelta(days=4, hours=14),
            status="Rescheduled",
            reason="[DEMO] 6-month hepatocellular surveillance & portal hypertension review",
        )
        app3 = Appointment(
            patient_id=patients_map["PAT-1005"].id,
            doctor_id=doctor.id,
            scheduled_at=now - timedelta(days=3),
            status="Completed",
            reason="[DEMO] Initial liver biopsy & biomarker baseline assessment",
        )
        app4 = Appointment(
            patient_id=patients_map["PAT-1004"].id,
            doctor_id=doctor.id,
            scheduled_at=now - timedelta(days=1),
            status="Cancelled",
            reason="[DEMO] Patient requested appointment cancellation due to conflicting schedule",
        )
        db.session.add_all([app1, app2, app3, app4])

        # 6 Fictional Diagnostic Reports across diverse categories
        reports = [
            Report(
                patient_id=patients_map["PAT-1001"].id,
                filename="demo_eleanor_comprehensive_metabolic_panel.pdf",
                original_filename="Comprehensive_Metabolic_Panel.pdf",
                category="Lab report",
                uploaded_at=now - timedelta(days=15),
            ),
            Report(
                patient_id=patients_map["PAT-1002"].id,
                filename="demo_marcus_abdominal_ultrasound.pdf",
                original_filename="Abdominal_Doppler_Ultrasound.pdf",
                category="Ultrasound",
                uploaded_at=now - timedelta(days=12),
            ),
            Report(
                patient_id=patients_map["PAT-1005"].id,
                filename="demo_david_liver_biopsy_histology.pdf",
                original_filename="Liver_Biopsy_Histology.pdf",
                category="Biopsy",
                uploaded_at=now - timedelta(days=8),
            ),
            Report(
                patient_id=patients_map["PAT-1003"].id,
                filename="demo_sophia_hepatic_function_panel.pdf",
                original_filename="Hepatic_Function_Panel.pdf",
                category="Lab report",
                uploaded_at=now - timedelta(days=6),
            ),
            Report(
                patient_id=patients_map["PAT-1004"].id,
                filename="demo_arthur_fibroscan_elastography.pdf",
                original_filename="FibroScan_Transient_Elastography.pdf",
                category="Ultrasound",
                uploaded_at=now - timedelta(days=4),
            ),
            Report(
                patient_id=patients_map["PAT-1008"].id,
                filename="demo_aisha_coagulation_profile.pdf",
                original_filename="Coagulation_Prothrombin_Profile.pdf",
                category="Lab report",
                uploaded_at=now - timedelta(days=1),
            ),
        ]
        db.session.add_all(reports)
        db.session.flush()

        # Generate physical PDF files for demo reports in dedicated demo uploads directory
        from app.utils.demo_reports import generate_demo_report_pdf
        demo_uploads_dir = BASE_DIR / "instance" / "demo_uploads"
        assert "demo_uploads" in str(demo_uploads_dir), "FATAL: Must target demo_uploads"
        assert "instance/uploads" not in str(demo_uploads_dir).replace("\\", "/"), "FATAL: Must not target production uploads"
        demo_uploads_dir.mkdir(parents=True, exist_ok=True)
        for rep in reports:
            p = db.session.get(Patient, rep.patient_id)
            pdf_path = demo_uploads_dir / rep.filename
            generate_demo_report_pdf(rep, p, pdf_path)
            print(f"[+] Generated demo report PDF: {rep.filename} ({pdf_path.stat().st_size} bytes)")


        # AI Predictions for the patients
        preds = [
            Prediction(patient_id=patients_map["PAT-1001"].id, probability=0.842, risk_label="High Risk", confidence=89.5, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1002"].id, probability=0.547, risk_label="Medium Risk", confidence=78.2, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1003"].id, probability=0.123, risk_label="Low Risk", confidence=92.1, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1004"].id, probability=0.891, risk_label="High Risk", confidence=91.4, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1005"].id, probability=0.415, risk_label="Medium Risk", confidence=74.0, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1006"].id, probability=0.086, risk_label="Low Risk", confidence=94.5, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1007"].id, probability=0.148, risk_label="Low Risk", confidence=88.2, model_name="RandomForest"),
            Prediction(patient_id=patients_map["PAT-1008"].id, probability=0.482, risk_label="Medium Risk", confidence=79.6, model_name="RandomForest"),
        ]
        db.session.add_all(preds)

        # 8 Diverse Activity Logs for multi-colored activity feed representation
        logs = [
            ActivityLog(user_id=admin.id, action="New patient registered", details="Patient Eleanor Vance (PAT-1001) registered via clinical intake", created_at=now - timedelta(minutes=15)),
            ActivityLog(user_id=labtech.id, action="Lab report uploaded", details="FibroScan Transient Elastography uploaded for Arthur Pendelton", created_at=now - timedelta(minutes=45)),
            ActivityLog(user_id=admin.id, action="Appointment scheduled", details="Consultation scheduled with Dr. Hepato Care for PAT-1001", created_at=now - timedelta(hours=2)),
            ActivityLog(user_id=doctor.id, action="Clinical review completed", details="AI risk stratification (High Risk 84.2%) confirmed for PAT-1001", created_at=now - timedelta(hours=4)),
            ActivityLog(user_id=labtech.id, action="Lab report uploaded", details="Comprehensive Metabolic Panel uploaded for Eleanor Vance", created_at=now - timedelta(hours=7)),
            ActivityLog(user_id=doctor.id, action="Staff session authenticated", details="doctor@careai.com authenticated clinical session", created_at=now - timedelta(hours=12)),
            ActivityLog(user_id=admin.id, action="New staff account created", details="New Lab Technician account provisioned for lab operations", created_at=now - timedelta(days=1)),
            ActivityLog(user_id=admin.id, action="Staff session authenticated", details="admin@careai.com authenticated admin console session", created_at=now - timedelta(days=2)),
        ]
        db.session.add_all(logs)

        # 2 Notifications
        n1 = Notification(
            role="admin",
            title="[DEMO] High-Risk Cirrhosis Patient Admitted",
            message="Patient Eleanor Vance (PAT-1001) classified as High Risk (84.2%). Urgent triage scheduled.",
            read=False,
            category="alert",
        )
        n2 = Notification(
            role="admin",
            title="[DEMO] Routine System Health Verified",
            message="All diagnostic model checkpoints and SQLite connection pools verified healthy.",
            read=True,
            category="system",
        )
        db.session.add_all([n1, n2])

        # 5 Fictional Prescriptions across diverse patients and medication classes
        from app.utils.demo_prescriptions import get_demo_prescriptions_data
        rx_data = get_demo_prescriptions_data(now)
        prescriptions = []
        for item in rx_data:
            p = patients_map.get(item["patient_portal_id"])
            if p:
                prescriptions.append(
                    Prescription(
                        patient_id=p.id,
                        doctor_id=doctor.id,
                        medicine=item["medicine"],
                        dosage=item["dosage"],
                        frequency_days=item["frequency_days"],
                        clinical_notes=item["clinical_notes"],
                        diet_suggestion=item["diet_suggestion"],
                        follow_up_date=item["follow_up_date"],
                        created_at=item["created_at"],
                    )
                )
        db.session.add_all(prescriptions)

        db.session.commit()
        print(f"[+] Successfully generated isolated demo database at: {TARGET_DEMO_DB}")
        print("    Total Demo Patients:", Patient.query.count())
        print("    Total Demo Appointments:", Appointment.query.count())
        print("    Total Demo Reports:", Report.query.count())
        print("    Total Demo Predictions:", Prediction.query.count())
        print("    Total Demo Prescriptions:", Prescription.query.count())
        print("    Total Demo Activity Logs:", ActivityLog.query.count())
        print("    Total Demo Users:", User.query.count())

if __name__ == "__main__":
    generate_demo_database()
