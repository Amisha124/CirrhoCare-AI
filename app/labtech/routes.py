from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.forms import AppointmentForm, PatientForm
from app.ml_model.predictor import predict_probability
from app.models import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.user import User
from app.utils.files import save_upload
from app.utils.logging import log_activity
from app.utils.notifications import notify
from app.utils.portal import generate_patient_portal_id, generate_patient_pin
from app.utils.security import roles_required
import secrets
from app.utils.activation import generate_activation_token, dispatch_activation_invitation

labtech_bp = Blueprint("labtech", __name__)


def patient_payload(form):
    return {
        "age": form.age.data,
        "gender": form.gender.data,
        "bilirubin": form.bilirubin.data,
        "albumin": form.albumin.data,
        "sgot": form.sgot.data,
        "sgpt": form.sgpt.data,
        "platelets": form.platelets.data,
        "cholesterol": form.cholesterol.data,
        "prothrombin": form.prothrombin.data,
        "ascites": form.ascites.data,
        "hepatomegaly": form.hepatomegaly.data,
        "spiders": form.spiders.data,
        "edema": form.edema.data,
        "copper": form.copper.data,
        "alk_phos": form.alk_phos.data,
        "triglycerides": form.triglycerides.data,
    }


def apply_form(patient, form):
    for key, value in patient_payload(form).items():
        setattr(patient, key, value)
    patient.full_name = form.full_name.data
    patient.phone = form.phone.data
    patient.email = form.email.data
    if not patient.portal_id:
        patient.portal_id = generate_patient_portal_id()


def save_prediction(patient, payload):
    result = predict_probability(payload)
    patient.latest_risk_label = result["risk_label"]
    patient.latest_risk_percent = result["probability"]
    db.session.add(Prediction(patient=patient, probability=result["probability"], risk_label=result["risk_label"], confidence=result["confidence"]))
    if result["risk_label"] == "High Risk":
        notify(
            "High-risk patient detected",
            f"{patient.full_name} has a {result['probability']}% cirrhosis risk probability.",
            category="danger",
            role="hepatologist",
        )
        notify(
            "High-risk prediction alert",
            f"{patient.full_name} was classified as High Risk.",
            category="danger",
            role="admin",
        )
    return result


def create_patient_portal_account(patient, send_invite=True):
    if not patient.portal_id:
        patient.portal_id = generate_patient_portal_id()

    # 1. Check if user already exists with matching portal_id
    existing = User.query.filter_by(portal_id=patient.portal_id).first()
    if existing:
        if existing.role != "patient":
            raise ValueError("Portal ID is associated with a non-patient user account.")
        if patient.email and (not existing.email or "@carepatient.com" in existing.email or "@cirrhocare.internal" in existing.email):
            existing.email = patient.email.lower()
        return existing, {"portal_id": patient.portal_id, "initial_pin": None}

    # 2. Check if user exists with patient.email (prevent duplicate accounts and unauthorized staff linking)
    if patient.email and "@cirrhocare.internal" not in patient.email:
        user_by_email = User.query.filter_by(email=patient.email.lower()).first()
        if user_by_email:
            if user_by_email.role != "patient":
                raise ValueError("The provided email is already registered to a clinical staff account.")
            if user_by_email.portal_id and user_by_email.portal_id != patient.portal_id:
                raise ValueError("The provided email is already linked to another patient profile.")
            user_by_email.portal_id = patient.portal_id
            return user_by_email, {"portal_id": patient.portal_id, "initial_pin": None}

    # 3. Create patient portal account with secure Patient ID and Secret PIN
    email = (patient.email or f"{patient.portal_id.lower()}@cirrhocare.internal").lower()
    initial_pin = generate_patient_pin()
    user = User(
        name=patient.full_name,
        email=email,
        role="patient",
        portal_id=patient.portal_id,
        active=True,
        must_change_password=True,
    )
    user.set_password(initial_pin)
    db.session.add(user)
    db.session.flush()

    raw_token, token_rec = generate_activation_token(user, patient)
    invite_info = {
        "portal_id": patient.portal_id,
        "initial_pin": initial_pin,
        "email_sent": False,
        "provider": None,
        "delivery_status": "skipped",
        "message": f"Patient account created. Patient ID: {patient.portal_id}, Initial PIN: {initial_pin}",
        "raw_token": raw_token,
    }
    if send_invite and patient.email and "@carepatient.com" not in patient.email and "@cirrhocare.internal" not in patient.email:
        dispatched = dispatch_activation_invitation(user, patient, raw_token, token_rec)
        invite_info.update(dispatched)
        invite_info["initial_pin"] = initial_pin
        invite_info["portal_id"] = patient.portal_id

    return user, invite_info


def ensure_patient_login(patient):
    user, _ = create_patient_portal_account(patient, send_invite=True)
    return user


@labtech_bp.route("/")
@login_required
@roles_required("labtech", "admin")
def dashboard():
    q = request.args.get("q", "")
    risk = request.args.get("risk", "")
    patients_query = Patient.query
    if q:
        patients_query = patients_query.filter(Patient.full_name.ilike(f"%{q}%"))
    if risk:
        patients_query = patients_query.filter_by(latest_risk_label=risk)
    patients = patients_query.order_by(Patient.created_at.desc()).all()
    return render_template("labtech/dashboard.html", patients=patients)


@labtech_bp.route("/patients/new", methods=["GET", "POST"])
@login_required
@roles_required("labtech", "admin")
def new_patient():
    form = PatientForm()
    if form.validate_on_submit():
        patient = Patient(created_by_id=current_user.id)
        apply_form(patient, form)
        db.session.add(patient)
        db.session.flush()
        result = save_prediction(patient, patient_payload(form))
        ensure_patient_login(patient)
        if form.report.data:
            filename, original = save_upload(form.report.data)
            db.session.add(Report(patient=patient, filename=filename, original_filename=original))
        db.session.commit()
        log_activity("Patient created", f"{patient.full_name} predicted {result['risk_label']}")
        flash("Patient saved and risk prediction completed.", "success")
        return redirect(url_for("labtech.prediction_result", patient_id=patient.id))
    if request.method == "POST":
        flash("Please check the highlighted patient fields and try again.", "danger")
    return render_template("labtech/patient_form.html", form=form, title="Add patient")


@labtech_bp.route("/patients/<int:patient_id>/edit", methods=["GET", "POST"])
@login_required
@roles_required("labtech", "admin")
def edit_patient(patient_id):
    patient = db.session.get(Patient, patient_id)
    form = PatientForm(obj=patient)
    if form.validate_on_submit():
        apply_form(patient, form)
        result = save_prediction(patient, patient_payload(form))
        ensure_patient_login(patient)
        if form.report.data:
            filename, original = save_upload(form.report.data)
            db.session.add(Report(patient=patient, filename=filename, original_filename=original))
        db.session.commit()
        log_activity("Patient updated", f"{patient.full_name} predicted {result['risk_label']}")
        flash("Patient updated.", "success")
        return redirect(url_for("labtech.prediction_result", patient_id=patient.id))
    if request.method == "POST":
        flash("Please check the highlighted patient fields and try again.", "danger")
    return render_template("labtech/patient_form.html", form=form, title="Edit patient")


@labtech_bp.post("/patients/<int:patient_id>/delete")
@login_required
@roles_required("labtech", "admin")
def delete_patient(patient_id):
    patient = db.session.get(Patient, patient_id)
    db.session.delete(patient)
    db.session.commit()
    log_activity("Patient deleted", patient.full_name)
    flash("Patient deleted.", "success")
    return redirect(url_for("labtech.dashboard"))


@labtech_bp.route("/patients/<int:patient_id>/prediction")
@login_required
@roles_required("labtech", "admin", "hepatologist")
def prediction_result(patient_id):
    patient = db.session.get(Patient, patient_id)
    latest = Prediction.query.filter_by(patient_id=patient.id).order_by(Prediction.created_at.desc()).first()
    return render_template("labtech/prediction_result.html", patient=patient, latest=latest)


@labtech_bp.route("/patients/<int:patient_id>", methods=["GET", "POST"])
@login_required
@roles_required("labtech", "admin", "hepatologist")
def patient_detail(patient_id):
    patient = db.session.get(Patient, patient_id)
    appointment_form = AppointmentForm()
    doctors = User.query.filter_by(role="hepatologist", active=True).order_by(User.name).all()
    appointment_form.doctor_id.choices = [(doctor.id, doctor.name) for doctor in doctors]
    if appointment_form.validate_on_submit():
        appointment = Appointment(
            patient=patient,
            doctor_id=appointment_form.doctor_id.data,
            scheduled_at=appointment_form.scheduled_at.data,
            reason=appointment_form.reason.data,
        )
        db.session.add(appointment)
        notify(
            "New appointment scheduled",
            f"{patient.full_name} is scheduled for {appointment.scheduled_at.strftime('%d %b %Y %H:%M')}.",
            category="info",
            user_id=appointment.doctor_id,
        )
        notify(
            "Appointment added",
            f"{patient.full_name} has a new hepatology appointment.",
            category="success",
            role="admin",
        )
        db.session.commit()
        log_activity("Appointment scheduled", patient.full_name)
        flash("Appointment scheduled.", "success")
        return redirect(url_for("labtech.patient_detail", patient_id=patient.id))
    return render_template("shared/patient_detail.html", patient=patient, appointment_form=appointment_form)


@labtech_bp.route("/reports")
@login_required
@roles_required("labtech", "admin", "hepatologist")
def reports():
    reports = Report.query.order_by(Report.uploaded_at.desc()).all()
    return render_template("shared/reports.html", reports=reports)
