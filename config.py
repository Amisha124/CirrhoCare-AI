import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load .env file if available
load_dotenv(BASE_DIR / ".env", override=True)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
    DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1")
    DEMO_UPLOAD_FOLDER = Path(os.getenv("DEMO_UPLOAD_FOLDER", BASE_DIR / "instance" / "demo_uploads"))
    raw_db_url = os.getenv("DATABASE_URL")
    is_render = bool(os.getenv("RENDER"))
    is_production = os.getenv("FLASK_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"

    db_url_clean = raw_db_url.strip().strip("'\"") if raw_db_url else ""

    if db_url_clean.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = "postgresql+psycopg2://" + db_url_clean[len("postgres://"):]
        UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", DEMO_UPLOAD_FOLDER if DEMO_MODE else BASE_DIR / "instance" / "uploads"))
    elif db_url_clean.startswith("postgresql://"):
        SQLALCHEMY_DATABASE_URI = "postgresql+psycopg2://" + db_url_clean[len("postgresql://"):]
        UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", DEMO_UPLOAD_FOLDER if DEMO_MODE else BASE_DIR / "instance" / "uploads"))
    elif db_url_clean.startswith("postgresql+psycopg2://"):
        SQLALCHEMY_DATABASE_URI = db_url_clean
        UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", DEMO_UPLOAD_FOLDER if DEMO_MODE else BASE_DIR / "instance" / "uploads"))
    elif is_render or is_production:
        raise RuntimeError(
            "CRITICAL CONFIGURATION ERROR: Running in production / Render environment, "
            "but DATABASE_URL is missing or not a valid PostgreSQL URI! "
            "CirrhoCare AI refuses to silently fall back to ephemeral SQLite in production to prevent patient data loss."
        )
    elif DEMO_MODE:
        SQLALCHEMY_DATABASE_URI = os.getenv(
            "DEMO_DATABASE_URL", f"sqlite:///{BASE_DIR / 'instance' / 'demo_cirrhosis.db'}"
        )
        UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", DEMO_UPLOAD_FOLDER))
    else:
        SQLALCHEMY_DATABASE_URI = os.getenv(
            "DATABASE_URL", f"sqlite:///{BASE_DIR / 'instance' / 'cirrhosis.db'}"
        )
        UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", BASE_DIR / "instance" / "uploads"))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    WTF_CSRF_TIME_LIMIT = None
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 8 * 1024 * 1024))
    ALLOWED_UPLOADS = {"pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"}
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() in ("true", "1")
    EXPOSE_DEV_RESET_URL = os.getenv("EXPOSE_DEV_RESET_URL", "false").lower() in ("true", "1")
    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173")

    # Transactional Email Providers (Resend / Brevo)
    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")
    RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "CirrhoCare AI <onboarding@resend.dev>")
    BREVO_API_KEY = os.getenv("BREVO_API_KEY")
    BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "no-reply@cirrhocare.ai")

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "").strip()
