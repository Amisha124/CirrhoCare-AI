import csv
from io import BytesIO, StringIO

from flask import Blueprint, Response, flash, redirect, render_template, request, send_file, url_for
from flask_login import current_user, login_required
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.models import db
from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.user import User
from app.utils.exports import generate_patients_csv, generate_summary_pdf
from app.utils.logging import log_activity
from app.utils.security import roles_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/")
@login_required
@roles_required("admin")
def dashboard():
    total_patients = Patient.query.count()
    high_risk = Patient.query.filter_by(latest_risk_label="High Risk").count()
    users = User.query.count()
    predictions = Prediction.query.count()
    appointments = Appointment.query.count()
    unread_notifications = Notification.query.filter_by(read=False).count()
    recent_logs = ActivityLog.query.order_by(ActivityLog.created_at.desc()).limit(8).all()
    risk_counts = {
        "Low Risk": Patient.query.filter_by(latest_risk_label="Low Risk").count(),
        "Medium Risk": Patient.query.filter_by(latest_risk_label="Medium Risk").count(),
        "High Risk": high_risk,
    }
    recent_patients = Patient.query.order_by(Patient.created_at.desc()).limit(6).all()
    return render_template("admin/dashboard.html", total_patients=total_patients, high_risk=high_risk, users=users, predictions=predictions, appointments=appointments, unread_notifications=unread_notifications, recent_logs=recent_logs, risk_counts=risk_counts, recent_patients=recent_patients)


@admin_bp.route("/users")
@login_required
@roles_required("admin")
def users():
    role = request.args.get("role", "")
    query = request.args.get("q", "")
    user_query = User.query
    if role:
        user_query = user_query.filter_by(role=role)
    if query:
        user_query = user_query.filter(User.name.ilike(f"%{query}%") | User.email.ilike(f"%{query}%"))
    return render_template("admin/users.html", users=user_query.order_by(User.created_at.desc()).all())


@admin_bp.post("/users/<int:user_id>/toggle")
@login_required
@roles_required("admin")
def toggle_user(user_id):
    user = db.session.get(User, user_id)
    user.active = not user.active
    db.session.commit()
    log_activity("User status changed", f"{user.email} active={user.active}")
    flash("User status updated.", "success")
    return redirect(url_for("admin.users"))


@admin_bp.route("/patients")
@login_required
@roles_required("admin")
def patients():
    risk = request.args.get("risk", "")
    q = request.args.get("q", "")
    patient_query = Patient.query
    if risk:
        patient_query = patient_query.filter_by(latest_risk_label=risk)
    if q:
        patient_query = patient_query.filter(Patient.full_name.ilike(f"%{q}%"))
    return render_template("admin/patients.html", patients=patient_query.order_by(Patient.created_at.desc()).all())


@admin_bp.post("/patients/<int:patient_id>/delete")
@login_required
@roles_required("admin")
def delete_patient(patient_id):
    patient = db.session.get(Patient, patient_id)
    db.session.delete(patient)
    db.session.commit()
    log_activity("Deleted patient", patient.full_name)
    flash("Patient record deleted.", "success")
    return redirect(url_for("admin.patients"))


@admin_bp.route("/analytics")
@login_required
@roles_required("admin")
def analytics():
    predictions = Prediction.query.order_by(Prediction.created_at.desc()).limit(40).all()
    return render_template("admin/analytics.html", predictions=predictions)


@admin_bp.route("/logs")
@login_required
@roles_required("admin")
def logs():
    logs = ActivityLog.query.order_by(ActivityLog.created_at.desc()).limit(100).all()
    return render_template("admin/logs.html", logs=logs)


@admin_bp.route("/notifications")
@login_required
@roles_required("admin")
def notifications():
    rows = Notification.query.filter((Notification.role == "admin") | (Notification.role.is_(None))).order_by(Notification.created_at.desc()).limit(80).all()
    return render_template("shared/notifications.html", notifications=rows)


@admin_bp.post("/notifications/read")
@login_required
@roles_required("admin")
def mark_notifications_read():
    Notification.query.filter((Notification.role == "admin") | (Notification.role.is_(None))).update({"read": True}, synchronize_session=False)
    db.session.commit()
    flash("Notifications marked as read.", "success")
    return redirect(url_for("admin.notifications"))


@admin_bp.route("/export.csv")
@login_required
@roles_required("admin")
def export_csv():
    return generate_patients_csv(user=current_user, args=request.args)


@admin_bp.route("/report.pdf")
@login_required
@roles_required("admin")
def report_pdf():
    return generate_summary_pdf(user=current_user, args=request.args)
