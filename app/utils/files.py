from pathlib import Path
from uuid import uuid4

from flask import current_app
from werkzeug.utils import secure_filename


DANGEROUS_SIGNATURES = [
    b"MZ",        # DOS/Windows PE Executable / DLL
    b"\x7fELF",   # Linux ELF binary
    b"<?php",     # PHP script
    b"#!/",       # Shell / script
    b"<script",   # HTML / JavaScript
]


def allowed_file(filename):
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return suffix in current_app.config["ALLOWED_UPLOADS"]


def save_upload(file_storage):
    if not file_storage or not file_storage.filename:
        return None
    if not allowed_file(file_storage.filename):
        raise ValueError("Unsupported file type")

    # Inspect stream header for dangerous binary or script signatures
    if hasattr(file_storage, "stream"):
        header = file_storage.stream.read(16)
        file_storage.stream.seek(0)
        for sig in DANGEROUS_SIGNATURES:
            if header.lower().startswith(sig.lower()):
                raise ValueError("Disallowed file content: executable or script signature detected")

    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    upload_dir.mkdir(parents=True, exist_ok=True)
    original = secure_filename(file_storage.filename)
    filename = f"{uuid4().hex}_{original}"
    file_storage.save(upload_dir / filename)
    return filename, original


def migrate_existing_uploads():
    """
    Safely migrates existing uploaded reports from app/static/uploads to the protected
    instance/uploads directory without overwriting or deleting originals.
    """
    import shutil
    target_dir = Path(current_app.config["UPLOAD_FOLDER"])
    target_dir.mkdir(parents=True, exist_ok=True)
    legacy_dir = Path(current_app.root_path) / "static" / "uploads"
    migrated = 0
    if legacy_dir.exists():
        for file in legacy_dir.iterdir():
            if file.is_file() and file.name != ".gitkeep":
                target_file = target_dir / file.name
                if not target_file.exists():
                    shutil.copy2(file, target_file)
                    migrated += 1
    return migrated
