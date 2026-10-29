import re
import time
import unicodedata
from collections import defaultdict
from functools import wraps

from flask import abort
from flask_login import current_user

_IP_ATTEMPTS = defaultdict(list)


def roles_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not current_user.is_authenticated:
                abort(401)
            if current_user.role not in roles:
                abort(403)
            return view(*args, **kwargs)

        return wrapped

    return decorator


def normalize_name(name: str) -> str:
    """
    Normalizes patient name for consistent verification:
    - Unicode NFKD normalization (accents stripped)
    - Lowercase
    - Strip bracketed tags (e.g. [Demo])
    - Strip common titles/honorifics (mr, mrs, ms, dr, miss) and suffixes (jr, sr)
    - Strip punctuation and symbols
    - Collapse extra whitespace
    """
    if not name:
        return ""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_text = nfkd.encode("ASCII", "ignore").decode("utf-8")
    cleaned = ascii_text.lower().strip()
    cleaned = re.sub(r'\[.*?\]|\(.*?\)', '', cleaned)
    cleaned = re.sub(r'^(mr|mrs|ms|dr|miss)\.?\s+', '', cleaned)
    cleaned = re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?', '', cleaned)
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def names_match(input_name: str, stored_name: str) -> bool:
    """
    Checks if input_name matches stored_name after normalization.
    Supports exact match, and first+last token match for names with middle initials.
    """
    norm_in = normalize_name(input_name)
    norm_stored = normalize_name(stored_name)
    if not norm_in or not norm_stored:
        return False
    if norm_in == norm_stored:
        return True

    # Check if first and last name tokens match
    parts_in = norm_in.split()
    parts_stored = norm_stored.split()
    if len(parts_in) >= 2 and len(parts_stored) >= 2:
        if parts_in[0] == parts_stored[0] and parts_in[-1] == parts_stored[-1]:
            return True

    return False


def check_ip_rate_limit(ip: str, max_attempts: int = 15, window_seconds: int = 600) -> tuple:
    """
    Returns (True, "") if IP is within allowed threshold, or (False, message) if rate limited.
    """
    if not ip:
        return True, ""
    now = time.time()
    attempts = [t for t in _IP_ATTEMPTS[ip] if now - t < window_seconds]
    _IP_ATTEMPTS[ip] = attempts
    if len(attempts) >= max_attempts:
        return False, "Too many failed login attempts from this network. Please try again in 10 minutes."
    return True, ""


def record_ip_attempt(ip: str):
    if ip:
        _IP_ATTEMPTS[ip].append(time.time())


def reset_ip_attempts(ip: str):
    if ip and ip in _IP_ATTEMPTS:
        _IP_ATTEMPTS[ip].clear()
