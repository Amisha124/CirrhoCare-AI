from datetime import datetime

from app.models import db


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(80), default="Lab report")
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    lab_order_id = db.Column(db.Integer, db.ForeignKey("lab_orders.id"), nullable=True, index=True)
    is_reviewed = db.Column(db.Boolean, default=False, nullable=False)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    patient = db.relationship("Patient", back_populates="reports")
    lab_order = db.relationship("LabOrder", back_populates="reports")
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])
