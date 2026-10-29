from flask import Blueprint, render_template
from flask_login import current_user, login_required

from app.models.patient import Patient
from app.utils.security import roles_required

patient_bp = Blueprint("patient", __name__)


def risk_medicine_guidance(risk_label):
    guidance = {
        "High Risk": [
            "Urgent hepatologist consultation is recommended.",
            "Medication must be finalized by the doctor after clinical review.",
            "Avoid alcohol completely and avoid self-medication."
        ],
        "Medium Risk": [
            "Schedule follow-up and repeat liver function tests as advised.",
            "Doctor may prescribe liver-supportive treatment depending on symptoms.",
            "Avoid alcohol, high-salt food, and unnecessary painkillers."
        ],
        "Low Risk": [
            "Continue preventive care and periodic monitoring.",
            "No medicine should be started without doctor consultation.",
            "Maintain healthy diet, hydration, and regular checkups."
        ],
    }
    return guidance.get(risk_label, guidance["Low Risk"])


@patient_bp.route("/")
@login_required
@roles_required("patient")
def dashboard():
    records = Patient.query.filter_by(portal_id=current_user.portal_id).order_by(Patient.created_at.desc()).all()
    return render_template("patient/dashboard.html", records=records, risk_medicine_guidance=risk_medicine_guidance)


@patient_bp.route("/records/<int:patient_id>")
@login_required
@roles_required("patient")
def record_detail(patient_id):
    patient = Patient.query.filter_by(id=patient_id, portal_id=current_user.portal_id).first_or_404()
    return render_template("patient/record_detail.html", patient=patient, guidance=risk_medicine_guidance(patient.latest_risk_label))
