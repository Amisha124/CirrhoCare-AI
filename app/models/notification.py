from datetime import datetime

from app.models import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    role = db.Column(db.String(30), nullable=True)
    title = db.Column(db.String(140), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(40), default="info")
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")
