from datetime import datetime

from app.models import db


class LabOrder(db.Model):
    __tablename__ = "lab_orders"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    test_type = db.Column(db.String(120), nullable=False)
    clinical_indication = db.Column(db.Text, nullable=True)
    priority = db.Column(db.String(20), nullable=False, default="Routine")
    order_status = db.Column(db.String(30), nullable=False, default="Ordered", index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    sample_collected_at = db.Column(db.DateTime, nullable=True)
    status_reason = db.Column(db.Text, nullable=True)
    clarification_requested_at = db.Column(db.DateTime, nullable=True)
    clarification_requested_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    doctor_decision = db.Column(db.String(60), nullable=True)
    doctor_decision_at = db.Column(db.DateTime, nullable=True)
    doctor_decision_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    doctor_notes = db.Column(db.Text, nullable=True)

    patient = db.relationship("Patient", back_populates="lab_orders")
    doctor = db.relationship("User", foreign_keys=[doctor_id], back_populates="lab_orders")
    clarification_requested_by = db.relationship("User", foreign_keys=[clarification_requested_by_id])
    doctor_decision_by = db.relationship("User", foreign_keys=[doctor_decision_by_id])
    reports = db.relationship("Report", back_populates="lab_order")

