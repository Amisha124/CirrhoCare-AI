from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.forms import PrescriptionForm
from app.models import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.utils.logging import log_activity
from app.utils.notifications import notify
from app.utils.security import roles_required

hepatologist_bp = Blueprint("hepatologist", __name__)


@hepatologist_bp.route("/")
@login_required
@roles_required("hepatologist", "admin")
def dashboard():
    q = request.args.get("q", "")
    risk = request.args.get("risk", "")
    patients_query = Patient.query
    if q:
        patients_query = patients_query.filter(Patient.full_name.ilike(f"%{q}%"))
    if risk:
        patients_query = patients_query.filter_by(latest_risk_label=risk)
    patients = patients_query.order_by(Patient.latest_risk_percent.desc()).all()
    appointments = Appointment.query.filter_by(doctor_id=current_user.id).order_by(Appointment.scheduled_at.asc()).limit(8).all()
    return render_template("hepatologist/dashboard.html", patients=patients, appointments=appointments)


@hepatologist_bp.route("/patients/<int:patient_id>", methods=["GET", "POST"])
@login_required
@roles_required("hepatologist")
def patient_detail(patient_id):
    patient = db.session.get(Patient, patient_id)
    form = PrescriptionForm()
    if form.validate_on_submit():
        prescription = Prescription(
            patient=patient,
            doctor_id=current_user.id,
            medicine=form.medicine.data,
            dosage=form.dosage.data,
            frequency_days=form.frequency_days.data,
            clinical_notes=form.clinical_notes.data,
            diet_suggestion=form.diet_suggestion.data,
            follow_up_date=form.follow_up_date.data,
        )
        patient.treatment_status = form.treatment_status.data
        db.session.add(prescription)
        notify(
            "Prescription added",
            f"{current_user.name} added a prescription for {patient.full_name}.",
            category="success",
            role="admin",
        )
        db.session.commit()
        log_activity("Prescription added", patient.full_name)
        flash("Prescription and treatment status updated.", "success")
        return redirect(url_for("hepatologist.patient_detail", patient_id=patient.id))
    return render_template("hepatologist/patient_detail.html", patient=patient, form=form)


@hepatologist_bp.route("/prescriptions/<int:prescription_id>/print")
@login_required
@roles_required("hepatologist")
def print_prescription(prescription_id):
    prescription = db.session.get(Prescription, prescription_id)
    return render_template("hepatologist/print_prescription.html", prescription=prescription)


@hepatologist_bp.post("/appointments/<int:appointment_id>/<status>")
@login_required
@roles_required("hepatologist", "admin")
def update_appointment(appointment_id, status):
    appointment = db.session.get(Appointment, appointment_id)
    allowed = {"Confirmed", "Completed", "Cancelled"}
    if status not in allowed:
        flash("Invalid appointment status.", "danger")
        return redirect(url_for("hepatologist.dashboard"))
    appointment.status = status
    notify(
        "Appointment status updated",
        f"{appointment.patient.full_name}'s appointment is now {status}.",
        category="info",
        role="admin",
    )
    db.session.commit()
    log_activity("Appointment status changed", f"{appointment.patient.full_name}: {status}")
    flash("Appointment status updated.", "success")
    return redirect(url_for("hepatologist.dashboard"))
