from pathlib import Path



from flask import Flask, abort, flash, jsonify, redirect, request, send_from_directory

from flask_cors import CORS

from flask_login import LoginManager, current_user, login_required

from flask_wtf.csrf import CSRFProtect



from config import Config

from app.models import db

from app.utils.files import migrate_existing_uploads

from app.utils.migrations import ensure_sqlite_schema



login_manager = LoginManager()

csrf = CSRFProtect()

cors = CORS()





def create_app(portal="admin", test_config=None):

    app = Flask(__name__)

    app.config.from_object(Config)

    app.config["PORTAL"] = portal



    if test_config:

        app.config.update(test_config)



    db_uri = str(app.config.get("SQLALCHEMY_DATABASE_URI", ""))

    normalized_db_uri = db_uri.replace("\\", "/")



    # Database isolation safeguard: Prevent tests from targeting live instance databases

    if app.config.get("TESTING"):

        if (

            "instance/cirrhosis.db" in normalized_db_uri

            or "instance/demo_cirrhosis.db" in normalized_db_uri

            or normalized_db_uri.endswith("/cirrhosis.db")

            or normalized_db_uri.endswith("/demo_cirrhosis.db")

        ):

            raise RuntimeError(

                f"DATABASE ISOLATION CRITICAL FAILURE: create_app() was called with TESTING=True but database URI points to non-test instance database ({db_uri})! "

                "All test suites must specify a dedicated temporary SQLite database via test_config."

            )



    if "postgres" in db_uri.lower():
        try:
            from urllib.parse import urlparse
            p = urlparse(db_uri)
            db_target = f"PostgreSQL ({p.hostname}:{p.port or 5432}{p.path})"
        except Exception:
            db_target = "PostgreSQL (Supabase)"
    else:
        db_target = db_uri.split("instance/")[-1] if "instance/" in db_uri else db_uri.split("///")[-1]

    is_demo = getattr(Config, "DEMO_MODE", False) or "demo_cirrhosis.db" in db_uri

    print(f"[CirrhoCare AI] Active Database: {db_target} | DEMO_MODE={'ENABLED' if is_demo else 'DISABLED'}")



    db.init_app(app)

    login_manager.init_app(app)

    csrf.init_app(app)

    cors.init_app(

        app,

        supports_credentials=True,

        origins=[

            "http://localhost:5173",

            "http://127.0.0.1:5173",

            "http://localhost:3000",

            "http://127.0.0.1:3000",

            "http://localhost:5000",

            "http://127.0.0.1:5000",

        ],

    )

    login_manager.login_message_category = "info"



    @login_manager.unauthorized_handler

    def handle_unauthorized():

        if request.path.startswith("/api/") or request.is_json:

            return jsonify({"error": "Authentication required. Please log in.", "success": False}), 401

        flash("Please log in to access this page.", "info")

        return redirect("/login")



    @app.errorhandler(403)

    def handle_forbidden(e):

        if request.path.startswith("/api/") or request.is_json:

            desc = getattr(e, "description", "Forbidden")

            return jsonify({"error": desc, "success": False}), 403

        return e



    @app.errorhandler(404)

    def handle_not_found(e):

        if request.path.startswith("/api/") or request.is_json:

            desc = getattr(e, "description", "Resource not found")

            return jsonify({"error": desc, "success": False}), 404

        return e



    from app.models.user import User



    @login_manager.user_loader

    def load_user(user_id):

        return db.session.get(User, int(user_id))



    # Register only api_bp under /api (Option A: Legacy blueprints retired)

    from app.api.routes import api_bp



    csrf.exempt(api_bp)

    app.register_blueprint(api_bp, url_prefix="/api")



    # -------------------------------------------------------------------------

    # Legacy Compatibility & Bridge Routes

    # -------------------------------------------------------------------------

    from app.api.helpers import process_user_registration, serialize_user

    from app.utils.exports import generate_patients_csv, generate_summary_pdf

    from app.utils.security import roles_required



    @app.route("/admin/export.csv", methods=["GET"])

    @login_required

    @roles_required("admin")

    def admin_export_csv():

        return generate_patients_csv(user=current_user, args=request.args)



    @app.route("/admin/report.pdf", methods=["GET"])

    @login_required

    @roles_required("admin")

    def admin_report_pdf():

        return generate_summary_pdf(user=current_user, args=request.args)



    @app.route("/auth/register", methods=["GET", "POST"])

    @csrf.exempt

    def legacy_auth_register():

        if request.method == "POST":

            data = request.get_json(silent=True) or request.form.to_dict()

            user, error = process_user_registration(data)

            if error:

                if request.is_json:

                    return jsonify({"error": error, "success": False}), 400

                flash(error, "danger")

                return redirect("/login")

            if request.is_json:

                return jsonify({

                    "success": True,

                    "message": "Account created successfully. You may now sign in.",

                    "user": serialize_user(user),

                }), 201

            flash("Account created successfully. You may now sign in.", "success")

            return redirect("/login")

        return redirect("/login")



    @app.route("/auth/reset-password/<int:user_id>", methods=["GET", "POST"])

    @csrf.exempt

    def legacy_reset_password_blocked(user_id):

        abort(403, description="Insecure password reset by user ID is permanently disabled. Please request a secure reset link.")



    @app.route("/reports/<int:report_id>/download", methods=["GET"])

    @login_required

    def legacy_download_report(report_id):

        from app.api.routes import api_download_report

        return api_download_report(report_id)



    @app.route("/logout")

    def app_logout():

        from flask_login import logout_user

        if current_user.is_authenticated:

            logout_user()

        return redirect("/")

    @app.route("/auth/google", methods=["GET"])
    def app_google_login_bridge():
        return redirect("/api/auth/google")

    @app.route("/auth/google/callback", methods=["GET"])
    def app_google_callback_bridge():
        qs = request.query_string.decode("utf-8") if request.query_string else ""
        dest = f"/api/auth/google/callback?{qs}" if qs else "/api/auth/google/callback"
        return redirect(dest)




    # -------------------------------------------------------------------------

    # React SPA Static & Client-Side Routing

    # -------------------------------------------------------------------------

    dist_dir = Path(app.root_path).parent / "frontend" / "dist"



    @app.route("/assets/<path:filename>")

    def serve_spa_assets(filename):

        assets_dir = dist_dir / "assets"

        asset_file = assets_dir / filename

        if not asset_file.is_file():

            abort(404, description="Static asset not found")

        return send_from_directory(assets_dir, filename)



    @app.route("/", defaults={"path": ""})

    @app.route("/<path:path>")

    def serve_spa(path):

        if path.startswith("api/") or path == "api":

            return jsonify({"error": "Resource not found", "success": False}), 404



        file_candidate = dist_dir / path

        if path and file_candidate.is_file():

            return send_from_directory(dist_dir, path)



        index_file = dist_dir / "index.html"

        if not index_file.is_file():

            return "React frontend build not found. Please run 'npm run build' inside frontend/.", 500



        return send_from_directory(dist_dir, "index.html")



    with app.app_context():

        db.create_all()

        ensure_sqlite_schema()

        migrate_existing_uploads()

        from app.models.patient import Patient

        from app.models.user import User

        from app.utils.demo_provisioning import is_demo_allowed



        if is_demo_allowed(app):

            from app.utils.demo_provisioning import ensure_demo_accounts_provisioned

            ensure_demo_accounts_provisioned(app)

            from app.utils.demo_prescriptions import ensure_demo_prescriptions_seeded

            ensure_demo_prescriptions_seeded(app)

        else:

            print("[CirrhoCare AI] Production mode: Demo account and prescription seeders skipped.")



        if not app.config.get("TESTING"):

            if User.query.count() == 0 or Patient.query.count() == 0:

                print("[CirrhoCare AI] Baseline clinical records missing. Initializing verified clinical dataset...")

                from app.utils.clinical_seed import seed_baseline_clinical_data

                seed_baseline_clinical_data(app)



            # Ensure baseline patient Krishna Singh (CC-2026-5817) is always present

            try:

                from app.utils.clinical_seed import ensure_baseline_krishna_patient

                ensure_baseline_krishna_patient(app)

            except Exception as e:

                print(f'[CirrhoCare AI] Warning: ensure_baseline_krishna_patient error: {e}')



    return app

