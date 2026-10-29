from datetime import datetime

from app.models import db


class Prescription(db.Model):
    __tablename__ = "prescriptions"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    medicine = db.Column(db.String(180), nullable=False)
    dosage = db.Column(db.String(120), nullable=False)
    frequency_days = db.Column(db.Integer, nullable=False)
    clinical_notes = db.Column(db.Text)
    diet_suggestion = db.Column(db.Text)
    follow_up_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship("Patient", back_populates="prescriptions")
    doctor = db.relationship("User", back_populates="prescriptions")
