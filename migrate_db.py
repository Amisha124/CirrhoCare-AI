from app import create_app
from app.utils.migrations import ensure_sqlite_schema


app = create_app()

with app.app_context():
    ensure_sqlite_schema()
    print("Database schema is up to date.")
