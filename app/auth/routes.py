from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from app.forms import ForgotPasswordForm, LoginForm, RegisterForm, ResetPasswordForm
from app.models import db
from app.models.patient import Patient
from app.models.user import User
from app.utils.logging import log_activity
from app.utils.portal import generate_patient_portal_id
from app.utils.tokens import generate_reset_token, verify_reset_token

auth_bp = Blueprint("auth", __name__)


def role_home(user):
    if user.role == "admin":
        return "admin.dashboard"
    if user.role == "hepatologist":
        return "hepatologist.dashboard"
    if user.role == "patient":
        return "patient.dashboard"
    return "labtech.dashboard"


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for(role_home(current_user)))
    form = LoginForm()
    if form.validate_on_submit():
        identifier = form.email.data.strip()
        user = User.query.filter_by(email=identifier.lower()).first()
        if not user:
            user = User.query.filter_by(portal_id=identifier.upper()).first()
        if user and user.check_password(form.password.data):
            if not user.active:
                flash("This account has been disabled. Please contact an administrator.", "danger")
                return render_template("auth/login.html", form=form)
            login_user(user, remember=form.remember.data)
            log_activity("Login", f"{user.email} signed in")
            return redirect(request.args.get("next") or url_for(role_home(user)))
        flash("Invalid email/ID or password.", "danger")
    return render_template("auth/login.html", form=form)


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    form = RegisterForm()
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        if User.query.filter_by(email=email).first():
            flash("An account with this email already exists.", "danger")
            return render_template("auth/register.html", form=form)

        user = User(name=form.name.data.strip(), email=email, role=form.role.data)
        if user.role == "patient":
            # Check if a clinical Patient profile already exists with this email
            existing_patient = Patient.query.filter_by(email=email).first()
            if existing_patient and existing_patient.portal_id:
                user.portal_id = existing_patient.portal_id
            else:
                user.portal_id = generate_patient_portal_id()
                if existing_patient:
                    existing_patient.portal_id = user.portal_id

        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        log_activity("User registered", f"New {user.role} account created: {user.email}")
        flash("Account created successfully. You may now sign in.", "success")
        return redirect(url_for("auth.login"))
    return render_template("auth/register.html", form=form)


@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    form = ForgotPasswordForm()
    dev_reset_url = None
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        user = User.query.filter_by(email=email).first()
        if user:
            token = generate_reset_token(user)
            reset_url = url_for("auth.reset_password", token=token, _external=True)
            log_activity("Password reset requested", f"Token generated for {user.email}")
            if current_app.debug or current_app.config.get("ENV") == "development":
                dev_reset_url = reset_url
                flash("Dev Mode: A secure time-limited reset link has been generated (see below).", "info")
            else:
                flash("If an account exists with this email, password reset instructions have been issued.", "info")
        else:
            # Constant-time/generic message prevents user enumeration in production
            flash("If an account exists with this email, password reset instructions have been issued.", "info")
        return render_template("auth/forgot_password.html", form=form, dev_reset_url=dev_reset_url)
    return render_template("auth/forgot_password.html", form=form)


@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    user = verify_reset_token(token)
    if not user:
        flash("The password reset link is invalid, expired, or has already been used.", "danger")
        return redirect(url_for("auth.forgot_password"))

    form = ResetPasswordForm()
    if form.validate_on_submit():
        user.set_password(form.password.data)
        db.session.commit()
        log_activity("Password reset completed", f"Password changed for {user.email}")
        flash("Password reset successful. Please sign in with your new password.", "success")
        return redirect(url_for("auth.login"))
    return render_template("auth/reset_password.html", form=form, user=user, token=token)


@auth_bp.route("/reset-password/<int:user_id>", methods=["GET", "POST"])
def legacy_reset_password_blocked(user_id):
    """
    Blocks legacy insecure reset attempts by User ID.
    """
    abort(403, description="Insecure password reset by user ID is permanently disabled. Please request a secure reset link.")


@auth_bp.route("/logout")
@login_required
def logout():
    log_activity("Logout", f"{current_user.email} signed out")
    logout_user()
    flash("You have been signed out.", "info")
    return redirect("/")
