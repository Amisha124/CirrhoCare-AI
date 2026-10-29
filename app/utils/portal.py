from datetime import datetime
from secrets import randbelow

from app.models.patient import Patient
from app.models.user import User


def generate_patient_portal_id(prefix="CC", year=None) -> str:
    """
    Generates a unique, readable Patient ID in format CC-<YEAR>-<4-DIGIT-NUM>.
    e.g. CC-2026-1042
    Guarantees database-level uniqueness across both patients and users tables.
    """
    if not year:
        year = datetime.utcnow().year

    while True:
        seq = 1000 + randbelow(9000)
        candidate = f"{prefix}-{year}-{seq}"
        if not Patient.query.filter_by(portal_id=candidate).first() and not User.query.filter_by(portal_id=candidate).first():
            return candidate


def generate_patient_pin(length=6) -> str:
    """
    Generates a cryptographically secure numeric PIN for initial patient portal access.
    Default: 6 digits (100000 to 999999).
    """
    return str(100000 + randbelow(900000))
