from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


RESET_SALT = "cirrhocare-password-reset"


def get_reset_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=RESET_SALT)


def generate_reset_token(user):
    """
    Generates a secure, time-limited, single-use password reset token.
    Embedding a slice of password_hash ensures the token is automatically
    invalidated once the password has been reset.
    """
    serializer = get_reset_serializer()
    token_sig = user.password_hash[-12:] if user.password_hash else ""
    payload = {
        "user_id": user.id,
        "email": user.email,
        "sig": token_sig,
    }
    return serializer.dumps(payload)


def verify_reset_token(token, max_age_seconds=900):
    """
    Verifies the reset token. Returns User instance if valid and unused, else None.
    Default validity: 15 minutes (900 seconds).
    """
    if not token:
        return None
    serializer = get_reset_serializer()
    try:
        data = serializer.loads(token, max_age=max_age_seconds)
    except (SignatureExpired, BadSignature, Exception):
        return None

    from app.models import db
    from app.models.user import User

    user_id = data.get("user_id")
    if not user_id:
        return None

    user = db.session.get(User, user_id)
    if not user or user.email.lower() != str(data.get("email", "")).lower():
        return None

    current_sig = user.password_hash[-12:] if user.password_hash else ""
    if current_sig != data.get("sig"):
        # Password has already been updated since token creation (single-use enforcement)
        return None

    return user
