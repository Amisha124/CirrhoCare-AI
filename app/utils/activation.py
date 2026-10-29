import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple
from flask import current_app, has_request_context, request

from app.models import db
from app.models.activation_token import PatientActivationToken
from app.models.patient import Patient
from app.models.user import User
from app.utils.logging import log_activity
from app.utils.email_service import send_patient_activation_email, EmailDeliveryResult


def get_activation_base_url() -> str:
    """
    Determines frontend base URL for patient activation link.
    Respects APP_BASE_URL env var, or Origin/Host header in active request context.
    """
    configured_base = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    if configured_base:
        return configured_base

    if has_request_context():
        origin = request.headers.get("Origin") or request.headers.get("Referer")
        if origin:
            # strip trailing path if referer
            parts = origin.split("/")
            if len(parts) >= 3:
                return f"{parts[0]}//{parts[2]}"
        return request.host_url.rstrip("/")

    return "http://localhost:5173"


def generate_activation_token(
    user: User,
    patient: Optional[Patient] = None,
    expires_in_hours: int = 48,
) -> Tuple[str, PatientActivationToken]:
    """
    Generates a cryptographically secure, single-use, expiring activation token.
    Stores ONLY the SHA-256 hash in the database.
    Revokes any prior active tokens for this user.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = PatientActivationToken.hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    # Revoke any prior pending tokens for this user
    existing_tokens = PatientActivationToken.query.filter_by(
        user_id=user.id,
        used_at=None,
        revoked_at=None,
    ).all()
    now = datetime.utcnow()
    for old_tok in existing_tokens:
        old_tok.revoked_at = now

    token_record = PatientActivationToken(
        user_id=user.id,
        patient_id=patient.id if patient else None,
        token_hash=token_hash,
        expires_at=expires_at,
        delivery_status="pending",
        sent_to_email=(patient.email if patient and patient.email else user.email),
    )
    db.session.add(token_record)
    db.session.flush()

    return raw_token, token_record


def dispatch_activation_invitation(
    user: User,
    patient: Optional[Patient],
    raw_token: str,
    token_record: PatientActivationToken,
    expires_in_hours: int = 48,
) -> dict:
    """
    Sends the activation email using configured transactional provider.
    Updates the database token record with the actual delivery confirmation.
    """
    target_email = (patient.email if patient and patient.email else user.email or "").strip().lower()
    patient_name = patient.full_name if patient else user.name

    base_url = get_activation_base_url()
    activation_url = f"{base_url}/activate-account/{raw_token}"

    delivery_result: EmailDeliveryResult = send_patient_activation_email(
        patient_name=patient_name,
        recipient_email=target_email,
        activation_url=activation_url,
        expires_in_hours=expires_in_hours,
    )

    token_record.sent_to_email = target_email
    token_record.delivery_status = delivery_result.status
    token_record.delivery_provider = delivery_result.provider
    token_record.delivery_error = delivery_result.error

    if delivery_result.success:
        token_record.last_sent_at = datetime.utcnow()

    db.session.commit()

    is_dev = (
        current_app.config.get("DEMO_MODE", False)
        or current_app.config.get("EXPOSE_DEV_RESET_URL", False)
        or not delivery_result.success
    )

    return {
        "email_sent": delivery_result.success,
        "provider": delivery_result.provider,
        "delivery_status": delivery_result.status,
        "message": delivery_result.message,
        "activation_url": activation_url if is_dev else None,
    }


def verify_activation_token(
    raw_token: str,
) -> Tuple[bool, str, Optional[PatientActivationToken], Optional[User]]:
    """
    Verifies activation token from raw token string.
    Checks SHA-256 hash existence, expiration, single-use, and revocation.
    """
    if not raw_token or not raw_token.strip():
        return False, "Activation token is required.", None, None

    token_hash = PatientActivationToken.hash_token(raw_token.strip())
    record = PatientActivationToken.query.filter_by(token_hash=token_hash).first()

    if not record:
        return False, "The activation link is invalid or unrecognized.", None, None

    if record.is_revoked:
        return False, "This activation link has been revoked because a newer invitation was issued.", record, None

    if record.is_used:
        return False, "This activation link has already been used. Please log in with your credentials.", record, None

    if record.is_expired:
        return False, "This activation link has expired. Please contact clinical staff to request a new link.", record, None

    user = db.session.get(User, record.user_id)
    if not user:
        return False, "The user account associated with this activation link was not found.", record, None

    return True, "Activation link is valid.", record, user


def redeem_activation_token(
    raw_token: str,
    password: str,
    confirm_password: Optional[str] = None,
) -> Tuple[bool, str, Optional[User]]:
    """
    Redeems activation token, sets user password, activates account, and marks token as used.
    """
    if confirm_password is not None and password != confirm_password:
        return False, "Passwords do not match.", None

    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters.", None

    is_valid, message, record, user = verify_activation_token(raw_token)
    if not is_valid or not record or not user:
        return False, message, None

    # Update password and activate user
    user.set_password(password)
    user.active = True
    record.used_at = datetime.utcnow()

    # Revoke any remaining unused tokens for this user
    PatientActivationToken.query.filter(
        PatientActivationToken.user_id == user.id,
        PatientActivationToken.id != record.id,
        PatientActivationToken.used_at == None,
    ).update({"revoked_at": datetime.utcnow()})

    db.session.commit()
    log_activity(
        "Patient Account Activated",
        f"User {user.email} (Portal ID: {user.portal_id}) successfully set password and activated portal account.",
    )

    return True, "Your account has been successfully activated. You can now log in.", user
