import hashlib
from datetime import datetime, timedelta
from app.models import db


class PatientActivationToken(db.Model):
    __tablename__ = "patient_activation_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    delivery_status = db.Column(db.String(40), default="pending")  # sent, failed, unconfigured, pending
    delivery_provider = db.Column(db.String(40), nullable=True)     # resend, brevo, etc.
    delivery_error = db.Column(db.Text, nullable=True)
    last_sent_at = db.Column(db.DateTime, nullable=True)
    sent_to_email = db.Column(db.String(160), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("activation_tokens", cascade="all, delete-orphan"))
    patient = db.relationship("Patient", backref=db.backref("activation_tokens", cascade="all, delete-orphan"))

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Computes SHA-256 hash of raw activation token string."""
        if not raw_token:
            return ""
        return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_valid(self) -> bool:
        return not self.is_expired and not self.is_used and not self.is_revoked
