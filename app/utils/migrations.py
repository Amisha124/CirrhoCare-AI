from sqlalchemy import text

from app.models import db


def ensure_sqlite_schema():
    if not str(db.engine.url).startswith("sqlite"):
        return

    with db.engine.begin() as connection:
        prescription_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(prescriptions)")).fetchall()
        }
        if "diet_suggestion" not in prescription_columns:
            connection.execute(text("ALTER TABLE prescriptions ADD COLUMN diet_suggestion TEXT"))

        user_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        if "portal_id" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN portal_id VARCHAR(40)"))
        if "must_change_password" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0"))
        if "failed_login_attempts" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
        if "locked_until" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))

        patient_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(patients)")).fetchall()
        }
        if "portal_id" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN portal_id VARCHAR(40)"))
        if "direct_bilirubin" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN direct_bilirubin FLOAT"))
        if "assigned_doctor_id" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN assigned_doctor_id INTEGER REFERENCES users(id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_patients_assigned_doctor_id ON patients(assigned_doctor_id)"))
        if "treatment_completed_at" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN treatment_completed_at DATETIME"))
        if "treatment_completed_by_id" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN treatment_completed_by_id INTEGER REFERENCES users(id)"))
        if "treatment_completed_notes" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN treatment_completed_notes TEXT"))
        if "diet_plan" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN diet_plan TEXT"))
        if "care_instructions" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN care_instructions TEXT"))
        if "follow_up_date" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN follow_up_date DATE"))
        if "lab_workflow_status" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN lab_workflow_status VARCHAR(60) DEFAULT 'Registered'"))
        if "treatment_status_updated_at" not in patient_columns:
            connection.execute(text("ALTER TABLE patients ADD COLUMN treatment_status_updated_at DATETIME"))

        # Safe backfill for separate lab workflow vs clinical treatment status
        connection.execute(text("""
            UPDATE patients
            SET lab_workflow_status = CASE
                WHEN treatment_status IN ('Registered', 'Test In Progress', 'Report Uploaded', 'Completed') THEN treatment_status
                WHEN (SELECT COUNT(*) FROM reports WHERE reports.patient_id = patients.id) > 0 THEN 'Report Uploaded'
                ELSE 'Registered'
            END
            WHERE lab_workflow_status IS NULL OR lab_workflow_status = ''
        """))
        connection.execute(text("""
            UPDATE patients
            SET treatment_status = CASE
                WHEN treatment_status = 'Under treatment' THEN 'Under Treatment'
                WHEN treatment_status = 'Awaiting review' THEN 'Awaiting Doctor Review'
                WHEN treatment_status = 'Completed' THEN 'Treatment Completed'
                WHEN treatment_status IN ('Registered', 'Test In Progress', 'Report Uploaded') AND (SELECT COUNT(*) FROM prescriptions WHERE prescriptions.patient_id = patients.id) > 0 THEN 'Under Treatment'
                WHEN treatment_status IN ('Registered', 'Test In Progress', 'Report Uploaded') THEN 'Awaiting Doctor Review'
                ELSE treatment_status
            END
            WHERE treatment_status IN ('Under treatment', 'Awaiting review', 'Completed', 'Registered', 'Test In Progress', 'Report Uploaded')
        """))

        report_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(reports)")).fetchall()
        }
        if "lab_order_id" not in report_columns:
            connection.execute(text("ALTER TABLE reports ADD COLUMN lab_order_id INTEGER REFERENCES lab_orders(id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_reports_lab_order_id ON reports(lab_order_id)"))
        if "is_reviewed" not in report_columns:
            connection.execute(text("ALTER TABLE reports ADD COLUMN is_reviewed BOOLEAN DEFAULT 0"))
        if "reviewed_at" not in report_columns:
            connection.execute(text("ALTER TABLE reports ADD COLUMN reviewed_at DATETIME"))
        if "reviewed_by_id" not in report_columns:
            connection.execute(text("ALTER TABLE reports ADD COLUMN reviewed_by_id INTEGER REFERENCES users(id)"))

        tables = {
            row[0]
            for row in connection.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
        }
        if "lab_orders" not in tables:
            connection.execute(text("""
                CREATE TABLE lab_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    doctor_id INTEGER NOT NULL,
                    test_type VARCHAR(120) NOT NULL,
                    clinical_indication TEXT,
                    priority VARCHAR(20) NOT NULL DEFAULT 'Routine',
                    order_status VARCHAR(30) NOT NULL DEFAULT 'Ordered',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    sample_collected_at DATETIME,
                    status_reason TEXT,
                    clarification_requested_at DATETIME,
                    clarification_requested_by_id INTEGER REFERENCES users(id),
                    doctor_decision VARCHAR(60),
                    doctor_decision_at DATETIME,
                    doctor_decision_by_id INTEGER REFERENCES users(id),
                    doctor_notes TEXT,
                    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
                    FOREIGN KEY(doctor_id) REFERENCES users(id)
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_lab_orders_patient_id ON lab_orders(patient_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_lab_orders_doctor_id ON lab_orders(doctor_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_lab_orders_order_status ON lab_orders(order_status)"))
        else:
            lab_order_cols = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(lab_orders)")).fetchall()
            }
            if "sample_collected_at" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN sample_collected_at DATETIME"))
            if "status_reason" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN status_reason TEXT"))
            if "clarification_requested_at" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN clarification_requested_at DATETIME"))
            if "clarification_requested_by_id" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN clarification_requested_by_id INTEGER REFERENCES users(id)"))
            if "doctor_decision" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN doctor_decision VARCHAR(60)"))
            if "doctor_decision_at" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN doctor_decision_at DATETIME"))
            if "doctor_decision_by_id" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN doctor_decision_by_id INTEGER REFERENCES users(id)"))
            if "doctor_notes" not in lab_order_cols:
                connection.execute(text("ALTER TABLE lab_orders ADD COLUMN doctor_notes TEXT"))

        if "patient_activation_tokens" not in tables:
            connection.execute(text("""
                CREATE TABLE patient_activation_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    patient_id INTEGER,
                    token_hash VARCHAR(64) NOT NULL UNIQUE,
                    expires_at DATETIME NOT NULL,
                    used_at DATETIME,
                    revoked_at DATETIME,
                    delivery_status VARCHAR(40) DEFAULT 'pending',
                    delivery_provider VARCHAR(40),
                    delivery_error TEXT,
                    last_sent_at DATETIME,
                    sent_to_email VARCHAR(160),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_patient_activation_tokens_token_hash ON patient_activation_tokens(token_hash)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_patient_activation_tokens_user_id ON patient_activation_tokens(user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_patient_activation_tokens_patient_id ON patient_activation_tokens(patient_id)"))
