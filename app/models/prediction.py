from datetime import datetime

from app.models import db


class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    probability = db.Column(db.Float, nullable=False)
    risk_label = db.Column(db.String(30), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    model_name = db.Column(db.String(80), default="RandomForest")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    patient = db.relationship("Patient", back_populates="predictions")
