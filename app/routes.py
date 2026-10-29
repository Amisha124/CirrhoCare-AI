from flask import Blueprint, current_app, redirect, render_template, url_for
from flask_login import current_user, login_required
from app.models.notification import Notification

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def landing():
    if current_user.is_authenticated:
        if current_user.role == "admin":
            return redirect(url_for("admin.dashboard"))
        if current_user.role == "hepatologist":
            return redirect(url_for("hepatologist.dashboard"))
        if current_user.role == "patient":
            return redirect(url_for("patient.dashboard"))
        return redirect(url_for("labtech.dashboard"))
    return render_template("landing.html", portal=current_app.config["PORTAL"])


@main_bp.route("/profile")
@login_required
def profile():
    return render_template("shared/profile.html")


@main_bp.route("/notifications")
@login_required
def notifications():
    rows = Notification.query.filter(
        (Notification.user_id == current_user.id) | (Notification.role == current_user.role)
    ).order_by(Notification.created_at.desc()).limit(80).all()
    return render_template("shared/notifications.html", notifications=rows)


@main_bp.route("/reports/<int:report_id>/download")
@login_required
def download_report(report_id):
    from pathlib import Path
    from flask import abort, send_from_directory
    from app.models import db
    from app.models.report import Report

    report = db.session.get(Report, report_id)
    if not report:
        abort(404, description="Report not found")

    from app.api.helpers import is_patient_accessible_by_user
    if not is_patient_accessible_by_user(current_user, report.patient):
        abort(403, description="Access denied: You are not authorized to access this medical report.")

    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    if (upload_dir / report.filename).exists():
        return send_from_directory(upload_dir, report.filename, as_attachment=False, download_name=report.original_filename)

    # Legacy fallback for backward compatibility
    legacy_dir = Path(current_app.root_path) / "static" / "uploads"
    if (legacy_dir / report.filename).exists():
        return send_from_directory(legacy_dir, report.filename, as_attachment=False, download_name=report.original_filename)

    abort(404, description="Report file missing on server")

