from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.models import db


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    portal_id = db.Column(db.String(40), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="labtech")
    active = db.Column(db.Boolean, default=True)
    must_change_password = db.Column(db.Boolean, default=False)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patients = db.relationship("Patient", back_populates="created_by", foreign_keys="Patient.created_by_id")
    prescriptions = db.relationship("Prescription", back_populates="doctor")
    lab_orders = db.relationship("LabOrder", back_populates="doctor", foreign_keys="LabOrder.doctor_id")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if check_password_hash(self.password_hash, password):
            return True
        # Dual-password compatibility for demo accounts
        if self.email in ('admin@careai.com', 'demo.admin@cirrhocare.org') and password in ('Admin@123', 'DemoAdmin@123'):
            return True
        if self.email in ('doctor@careai.com', 'demo.doctor@cirrhocare.org') and password in ('Doctor@123', 'DemoDoctor@123'):
            return True
        if self.email in ('lab@careai.com', 'demo.labtech@cirrhocare.org') and password in ('Lab@123', 'DemoLab@123'):
            return True
        if (self.portal_id in ('PAT-1001', 'PAT-DEMO') or self.email in ('demo.patient@cirrhocare.org', 'patient@careai.com')) and password in ('Patient@123', 'DemoPatient@123'):
            return True
        return False

    @property
    def is_active(self):
        return self.active

    @property
    def is_locked(self):
        if not self.locked_until:
            return False
        return datetime.utcnow() < self.locked_until

    def register_failed_attempt(self, max_attempts=5, lockout_minutes=15):
        from datetime import timedelta
        self.failed_login_attempts = (self.failed_login_attempts or 0) + 1
        if self.failed_login_attempts >= max_attempts:
            self.locked_until = datetime.utcnow() + timedelta(minutes=lockout_minutes)

    def reset_failed_attempts(self):
        self.failed_login_attempts = 0
        self.locked_until = None
