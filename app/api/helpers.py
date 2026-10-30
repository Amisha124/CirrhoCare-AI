def serialize_user(user):
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "portal_id": user.portal_id,
        "active": user.active,
        "must_change_password": bool(getattr(user, "must_change_password", False)),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_prediction(pred):
    if not pred:
        return None
    return {
        "id": pred.id,
        "patient_id": pred.patient_id,
        "probability": pred.probability,
        "risk_label": pred.risk_label,
        "confidence": pred.confidence,
        "model_name": pred.model_name,
        "created_at": pred.created_at.isoformat() if pred.created_at else None,
    }


def serialize_prescription(rx):
    if not rx:
        return None
    return {
        "id": rx.id,
        "patient_id": rx.patient_id,
        "patient_name": rx.patient.full_name if rx.patient else None,
        "doctor_id": rx.doctor_id,
        "doctor_name": rx.doctor.name if rx.doctor else None,
        "medicine": rx.medicine,
        "dosage": rx.dosage,
        "frequency_days": rx.frequency_days,
        "clinical_notes": rx.clinical_notes,
        "diet_suggestion": rx.diet_suggestion,
        "follow_up_date": rx.follow_up_date.isoformat() if rx.follow_up_date else None,
        "created_at": rx.created_at.isoformat() if rx.created_at else None,
    }


def serialize_appointment(appnt):
    if not appnt:
        return None
    return {
        "id": appnt.id,
        "patient_id": appnt.patient_id,
        "patient_name": appnt.patient.full_name if appnt.patient else None,
        "patient_portal_id": appnt.patient.portal_id if appnt.patient else None,
        "doctor_id": appnt.doctor_id,
        "doctor_name": appnt.doctor.name if appnt.doctor else None,
        "scheduled_at": appnt.scheduled_at.isoformat() if appnt.scheduled_at else None,
        "reason": appnt.reason,
        "status": appnt.status,
        "appointment_type": getattr(appnt, "appointment_type", "Consultation") or "Consultation",
        "doctor_notes": getattr(appnt, "doctor_notes", None),
        "reschedule_message": getattr(appnt, "doctor_notes", None),
        "created_at": appnt.created_at.isoformat() if appnt.created_at else None,
    }


def serialize_report(rep):
    if not rep:
        return None
    return {
        "id": rep.id,
        "patient_id": rep.patient_id,
        "patient_name": rep.patient.full_name if rep.patient else None,
        "filename": rep.filename,
        "original_filename": rep.original_filename,
        "category": rep.category,
        "lab_order_id": getattr(rep, "lab_order_id", None),
        "test_type": rep.lab_order.test_type if getattr(rep, "lab_order", None) else rep.category,
        "uploaded_at": rep.uploaded_at.isoformat() if rep.uploaded_at else None,
        "is_reviewed": bool(getattr(rep, "is_reviewed", False)),
        "reviewed_at": rep.reviewed_at.isoformat() if getattr(rep, "reviewed_at", None) else None,
        "reviewed_by_name": rep.reviewed_by.name if getattr(rep, "reviewed_by", None) else None,
    }


def serialize_lab_order(order):
    if not order:
        return None
    return {
        "id": order.id,
        "patient_id": order.patient_id,
        "patient_name": order.patient.full_name if order.patient else None,
        "patient_portal_id": order.patient.portal_id if order.patient else None,
        "doctor_id": order.doctor_id,
        "doctor_name": order.doctor.name if order.doctor else None,
        "test_type": order.test_type,
        "clinical_indication": order.clinical_indication,
        "priority": order.priority,
        "order_status": order.order_status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        "sample_collected_at": order.sample_collected_at.isoformat() if getattr(order, "sample_collected_at", None) else None,
        "status_reason": getattr(order, "status_reason", None),
        "clarification_requested_at": order.clarification_requested_at.isoformat() if getattr(order, "clarification_requested_at", None) else None,
        "clarification_requested_by_id": getattr(order, "clarification_requested_by_id", None),
        "clarification_requested_by": order.clarification_requested_by.name if getattr(order, "clarification_requested_by", None) else None,
        "doctor_decision": getattr(order, "doctor_decision", None),
        "doctor_decision_at": order.doctor_decision_at.isoformat() if getattr(order, "doctor_decision_at", None) else None,
        "doctor_decision_by_id": getattr(order, "doctor_decision_by_id", None),
        "doctor_decision_by": order.doctor_decision_by.name if getattr(order, "doctor_decision_by", None) else None,
        "doctor_notes": getattr(order, "doctor_notes", None),
        "reports": [serialize_report(r) for r in (getattr(order, "reports", None) or [])],
    }


def serialize_notification(notif):
    if not notif:
        return None
    return {
        "id": notif.id,
        "user_id": notif.user_id,
        "role": notif.role,
        "title": notif.title,
        "message": notif.message,
        "category": notif.category,
        "read": notif.read,
        "created_at": notif.created_at.isoformat() if notif.created_at else None,
    }


def parse_biomarker_float(val):
    """
    Distinguishes missing/unmeasured biomarker values from genuine measured zero values.
    Returns None for missing/unmeasured values, and float for genuine measurements (including 0.0).
    """
    if val is None:
        return None
    val_str = str(val).strip()
    if val_str == "" or val_str.lower() in ("none", "null", "n/a", "not available", "undefined", "—"):
        return None
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return None


def evaluate_biomarkers(patient):
    """
    Evaluates patient laboratory markers against clinical reference intervals.
    Provides clinicians with instant flagging of abnormal biomarkers without fabricating data.
    Missing/unmeasured biomarkers (None) are excluded from flagging, while genuine zero measurements are evaluated.
    """
    flags = []

    # Bilirubin (normal 0.2 - 1.2 mg/dL)
    bili = getattr(patient, "bilirubin", None)
    if bili is not None:
        if bili > 3.0:
            flags.append({"marker": "Bilirubin", "value": bili, "unit": "mg/dL", "severity": "critical", "message": "Severely elevated (Jaundice risk)"})
        elif bili > 1.2:
            flags.append({"marker": "Bilirubin", "value": bili, "unit": "mg/dL", "severity": "warning", "message": "Elevated above normal"})

    # Albumin (normal 3.5 - 5.0 g/dL)
    alb = getattr(patient, "albumin", None)
    if alb is not None:
        if alb < 2.8:
            flags.append({"marker": "Albumin", "value": alb, "unit": "g/dL", "severity": "critical", "message": "Significantly depressed (Liver synthetic failure)"})
        elif alb < 3.5:
            flags.append({"marker": "Albumin", "value": alb, "unit": "g/dL", "severity": "warning", "message": "Hypoalbuminemia"})

    # Platelets (normal 150 - 450 x10^3/uL)
    plt = getattr(patient, "platelets", None)
    if plt is not None:
        if plt < 100:
            flags.append({"marker": "Platelets", "value": plt, "unit": "x10³/µL", "severity": "critical", "message": "Severe thrombocytopenia (Portal hypertension sign)"})
        elif plt < 150:
            flags.append({"marker": "Platelets", "value": plt, "unit": "x10³/µL", "severity": "warning", "message": "Low platelet count"})

    # SGOT / AST (normal 8 - 48 U/L)
    sgot = getattr(patient, "sgot", None)
    if sgot is not None:
        if sgot > 120:
            flags.append({"marker": "SGOT (AST)", "value": sgot, "unit": "U/L", "severity": "critical", "message": "Severe hepatic injury"})
        elif sgot > 48:
            flags.append({"marker": "SGOT (AST)", "value": sgot, "unit": "U/L", "severity": "warning", "message": "Elevated transaminase"})

    # SGPT / ALT (normal 7 - 56 U/L)
    sgpt = getattr(patient, "sgpt", None)
    if sgpt is not None:
        if sgpt > 120:
            flags.append({"marker": "SGPT (ALT)", "value": sgpt, "unit": "U/L", "severity": "critical", "message": "Acute hepatocellular damage"})
        elif sgpt > 56:
            flags.append({"marker": "SGPT (ALT)", "value": sgpt, "unit": "U/L", "severity": "warning", "message": "Elevated transaminase"})

    # Prothrombin time (normal 11.0 - 13.5 s)
    pt = getattr(patient, "prothrombin", None)
    if pt is not None:
        if pt > 15.0:
            flags.append({"marker": "Prothrombin Time", "value": pt, "unit": "seconds", "severity": "critical", "message": "Marked coagulopathy"})
        elif pt > 13.5:
            flags.append({"marker": "Prothrombin Time", "value": pt, "unit": "seconds", "severity": "warning", "message": "Prolonged clotting time"})

    # Clinical physical signs
    signs = []
    if getattr(patient, "ascites", False):
        signs.append("Ascites present")
    if getattr(patient, "hepatomegaly", False):
        signs.append("Hepatomegaly present")
    if getattr(patient, "spiders", False):
        signs.append("Spider angiomas present")
    if getattr(patient, "edema", False):
        signs.append("Peripheral edema present")

    return {"flags": flags, "clinical_signs": signs}


def normalize_clinical_status(status_str):
    if not status_str:
        return "Awaiting Doctor Review"
    raw = str(status_str).strip()
    if raw in ("Under treatment", "Under Treatment", "Awaiting review", "Awaiting Doctor Review", "Follow-up Required", "Treatment Completed"):
        return raw
    s = raw.lower()
    if s == "completed":
        return "Completed"
    if "complete" in s:
        return "Treatment Completed"
    if "follow" in s:
        return "Follow-up Required"
    if "under" in s or "treatment" in s:
        return "Under Treatment"
    if "await" in s or "review" in s or "urgent" in s or "pending" in s:
        return "Awaiting Doctor Review"
    return raw


def normalize_lab_workflow_status(status_str):
    if not status_str:
        return "Registered"
    s = str(status_str).strip().lower()
    if "complete" in s:
        return "Completed"
    if "upload" in s or "report" in s:
        return "Report Uploaded"
    if "progress" in s:
        return "Test In Progress"
    return "Registered"


def serialize_patient(patient, include_relations=False):
    if not patient:
        return None
    data = {
        "id": patient.id,
        "full_name": patient.full_name,
        "portal_id": patient.portal_id,
        "age": patient.age,
        "gender": patient.gender,
        "phone": patient.phone,
        "email": patient.email,
        "bilirubin": patient.bilirubin,
        "direct_bilirubin": getattr(patient, "direct_bilirubin", None),
        "albumin": patient.albumin,
        "sgot": patient.sgot,
        "sgpt": patient.sgpt,
        "platelets": patient.platelets,
        "cholesterol": patient.cholesterol,
        "prothrombin": patient.prothrombin,
        "ascites": bool(patient.ascites),
        "hepatomegaly": bool(patient.hepatomegaly),
        "spiders": bool(patient.spiders),
        "edema": bool(patient.edema),
        "copper": patient.copper,
        "alk_phos": patient.alk_phos,
        "triglycerides": patient.triglycerides,
        "latest_risk_label": patient.latest_risk_label,
        "latest_risk_percent": patient.latest_risk_percent,
        "treatment_status": normalize_clinical_status(patient.treatment_status),
        "treatment_status_updated_at": (
            patient.treatment_status_updated_at.isoformat()
            if getattr(patient, "treatment_status_updated_at", None)
            else (patient.updated_at.isoformat() if patient.updated_at else None)
        ),
        "lab_workflow_status": normalize_lab_workflow_status(getattr(patient, "lab_workflow_status", None)),
        "treatment_completed_at": patient.treatment_completed_at.isoformat() if getattr(patient, "treatment_completed_at", None) else None,
        "treatment_completed_by_id": getattr(patient, "treatment_completed_by_id", None),
        "treatment_completed_by": patient.treatment_completed_by.name if getattr(patient, "treatment_completed_by", None) else None,
        "treatment_completed_notes": getattr(patient, "treatment_completed_notes", None),
        "diet_plan": getattr(patient, "diet_plan", None),
        "care_instructions": getattr(patient, "care_instructions", None),
        "follow_up_date": patient.follow_up_date.isoformat() if getattr(patient, "follow_up_date", None) else None,
        "created_by_id": patient.created_by_id,
        "assigned_doctor_id": getattr(patient, "assigned_doctor_id", None),
        "assigned_doctor_name": (
            patient.assigned_doctor.name if getattr(patient, "assigned_doctor", None)
            else (patient.created_by.name if patient.created_by and getattr(patient.created_by, "role", None) == "hepatologist" else None)
        ),
        "created_at": patient.created_at.isoformat() if patient.created_at else None,
        "updated_at": patient.updated_at.isoformat() if patient.updated_at else None,
        "latest_test": (
            patient.lab_orders[-1].test_type if getattr(patient, "lab_orders", None) and len(patient.lab_orders) > 0
            else (
                patient.reports[-1].category if getattr(patient, "reports", None) and len(patient.reports) > 0
                else "Liver Function Test"
            )
        ),
        "evaluation": evaluate_biomarkers(patient),
    }

    # Distinct doctor-confirmed clinical status from AI model predictions (Requirement 4)
    is_confirmed = bool(patient.treatment_status and patient.treatment_status not in ("Awaiting review", "Pending"))
    doctor_name = None
    confirmed_at = None
    if is_confirmed:
        if patient.treatment_status == "Treatment Completed" and getattr(patient, "treatment_completed_at", None):
            doctor_name = patient.treatment_completed_by.name if getattr(patient, "treatment_completed_by", None) else (
                patient.assigned_doctor.name if getattr(patient, "assigned_doctor", None) else "Attending Hepatologist"
            )
            confirmed_at = patient.treatment_completed_at.isoformat()
        else:
            latest_rx = sorted(patient.prescriptions or [], key=lambda r: r.created_at or datetime.min, reverse=True)
            if latest_rx and latest_rx[0].doctor:
                doctor_name = latest_rx[0].doctor.name
                confirmed_at = latest_rx[0].created_at.isoformat() if latest_rx[0].created_at else None
            elif getattr(patient, "assigned_doctor", None):
                doctor_name = patient.assigned_doctor.name
                confirmed_at = patient.updated_at.isoformat() if patient.updated_at else (patient.created_at.isoformat() if patient.created_at else None)
            elif patient.created_by and getattr(patient.created_by, "role", None) == "hepatologist":
                doctor_name = patient.created_by.name
                confirmed_at = patient.updated_at.isoformat() if patient.updated_at else (patient.created_at.isoformat() if patient.created_at else None)
            else:
                doctor_name = "Attending Hepatologist"
                confirmed_at = patient.updated_at.isoformat() if patient.updated_at else (patient.created_at.isoformat() if patient.created_at else None)

    data["doctor_confirmed_status"] = patient.treatment_status if is_confirmed else None
    data["doctor_confirmed_by"] = doctor_name
    data["doctor_confirmed_at"] = confirmed_at
    data["is_doctor_confirmed"] = is_confirmed

    # Report review calculations
    reports_list = patient.reports or []
    has_reports = len(reports_list) > 0
    unreviewed_reports_count = sum(1 for r in reports_list if not getattr(r, "is_reviewed", False))
    reviewed_reports_count = sum(1 for r in reports_list if getattr(r, "is_reviewed", False))

    if not has_reports:
        report_review_status = "No reports uploaded"
    elif unreviewed_reports_count > 0:
        report_review_status = "Awaiting doctor review"
    else:
        report_review_status = "Reviewed"

    data["report_review_status"] = report_review_status
    data["unreviewed_reports_count"] = unreviewed_reports_count
    data["reviewed_reports_count"] = reviewed_reports_count
    data["prescriptions_count"] = len(patient.prescriptions or [])
    data["lab_orders"] = [serialize_lab_order(o) for o in reversed(patient.lab_orders or [])]
    data["reports"] = [serialize_report(rep) for rep in reversed(patient.reports or [])]

    if include_relations:
        data["predictions"] = [serialize_prediction(p) for p in reversed(patient.predictions or [])]
        data["prescriptions"] = [serialize_prescription(r) for r in reversed(patient.prescriptions or [])]
        data["appointments"] = [serialize_appointment(a) for a in reversed(patient.appointments or [])]

    # Seamless fallback to latest prescription notes if direct patient advice fields are unset
    latest_rx_for_fallback = sorted(patient.prescriptions or [], key=lambda r: r.created_at or datetime.min, reverse=True)
    if not data.get("diet_plan") and latest_rx_for_fallback and latest_rx_for_fallback[0].diet_suggestion:
        data["diet_plan"] = latest_rx_for_fallback[0].diet_suggestion
    if not data.get("care_instructions") and latest_rx_for_fallback and latest_rx_for_fallback[0].clinical_notes:
        data["care_instructions"] = latest_rx_for_fallback[0].clinical_notes
    if not data.get("follow_up_date") and latest_rx_for_fallback and latest_rx_for_fallback[0].follow_up_date:
        data["follow_up_date"] = latest_rx_for_fallback[0].follow_up_date.isoformat()

    return data


def is_patient_accessible_by_user(user, patient):
    """
    Checks whether a user has clinical or ownership authorization to access a patient.
    - Admin & Labtech: Authorized for clinical operations.
    - Patient: Only authorized for their own portal record.
    - Hepatologist: Authorized if patient is assigned (via appointment, prescription, or created_by_id),
      OR if patient is unassigned in the clinical intake queue.
      Access to patients assigned to a different hepatologist is rejected with 403 Forbidden.
    """
    if not user or not user.is_authenticated or not patient:
        return False

    if user.role in ("admin", "labtech"):
        return True

    if user.role == "patient":
        if patient.portal_id and patient.portal_id == user.portal_id:
            return True
        if patient.email and user.email and patient.email.lower() == user.email.lower():
            return True
        return False

    if user.role == "hepatologist":
        # Check explicit assigned doctor first
        assigned_doc_id = getattr(patient, "assigned_doctor_id", None)
        if assigned_doc_id is not None:
            return assigned_doc_id == user.id

        # 1. Created by this doctor
        if patient.created_by_id == user.id:
            return True
        # 2. Has an appointment with this doctor
        for appnt in (patient.appointments or []):
            if appnt.doctor_id == user.id:
                return True
        # 3. Has a prescription written by this doctor
        for rx in (patient.prescriptions or []):
            if rx.doctor_id == user.id:
                return True
        # 4. Has a lab order ordered by this doctor
        for order in (getattr(patient, "lab_orders", None) or []):
            if order.doctor_id == user.id:
                return True
        # 5. Check if patient is already assigned to a DIFFERENT doctor
        assigned_to_other = False
        if patient.created_by and patient.created_by.role == "hepatologist" and patient.created_by_id != user.id:
            assigned_to_other = True
        for appnt in (patient.appointments or []):
            if appnt.doctor_id and appnt.doctor_id != user.id:
                assigned_to_other = True
                break
        for rx in (patient.prescriptions or []):
            if rx.doctor_id and rx.doctor_id != user.id:
                assigned_to_other = True
                break
        for order in (getattr(patient, "lab_orders", None) or []):
            if order.doctor_id and order.doctor_id != user.id:
                assigned_to_other = True
                break

        if not assigned_to_other:
            return True

        return False

    return False


def process_user_registration(data):
    """
    Validates user registration input and creates user account.
    Ensures that self-registration does NOT create fake clinical patient records.
    """
    from app.models import db
    from app.models.patient import Patient
    from app.models.user import User
    from app.utils.logging import log_activity
    from app.utils.portal import generate_patient_portal_id

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role = (data.get("role") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password")

    if not name or not email or not role or not password:
        return None, "All fields (name, email, role, password) are required."

    if confirm_password is not None and password != confirm_password:
        return None, "Passwords do not match."

    if len(password) < 8:
        return None, "Password must be at least 8 characters long."

    valid_roles = {"admin", "hepatologist", "labtech", "patient"}
    if role not in valid_roles:
        return None, f"Invalid role '{role}'. Allowed roles: {', '.join(sorted(valid_roles))}."

    if role == "patient":
        return None, "Patient self-registration is permanently disabled. Patients must be registered by an authorized Lab Technician."

    if User.query.filter_by(email=email).first():
        return None, "An account with this email already exists."

    user = User(name=name, email=email, role=role)
    if user.role == "patient":
        existing_patient = Patient.query.filter_by(email=email).first()
        if existing_patient and existing_patient.portal_id:
            user.portal_id = existing_patient.portal_id
        else:
            user.portal_id = generate_patient_portal_id()
            if existing_patient:
                existing_patient.portal_id = user.portal_id

    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    log_activity("User registered", f"New {user.role} account created: {user.email}")
    return user, None


def is_notification_accessible_by_user(user, notification):
    """
    Checks whether a notification is authorized for viewing/modification by a user.
    - If user_id is assigned: must match user.id.
    - If user_id is None: role must match user.role, or be None (system broadcast).
    """
    if not user or not user.is_authenticated or not notification:
        return False
    if notification.user_id is not None:
        return notification.user_id == user.id
    if notification.role is not None:
        return notification.role == user.role
    return True

