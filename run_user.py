import os
from app import create_app

app = create_app(portal="user")

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1")
    app.run(host="127.0.0.1", port=3000, debug=debug_mode)
