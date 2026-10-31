"""
CirrhoCare AI - Production WSGI Entry Point
==========================================
Production server startup (using Waitress):
    python wsgi.py
Or via the Waitress runner:
    python -m waitress --host=127.0.0.1 --port=5000 wsgi:app

Environment variables:
    HOST: Host to bind (default: 127.0.0.1)
    PORT: Port to bind (default: 5000)
    WAITRESS_THREADS: Number of worker threads (default: 4)
    SECRET_KEY: Flask secret key (override in .env)
    DATABASE_URL: Database connection string (override in .env)
    UPLOAD_FOLDER: Directory for private uploads (override in .env)
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)

from app import create_app

app = create_app()

if __name__ == "__main__":
    from waitress import serve

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))
    threads = int(os.getenv("WAITRESS_THREADS", "4"))
    print(f"Starting CirrhoCare AI production WSGI server (Waitress) on http://{host}:{port} ({threads} threads)...")
    serve(app, host=host, port=port, threads=threads)
