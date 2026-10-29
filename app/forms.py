from flask_wtf import FlaskForm
from flask_wtf.file import FileAllowed, FileField
from wtforms import BooleanField, DateField, DateTimeLocalField, FloatField, IntegerField, PasswordField, SelectField, StringField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Email, EqualTo, Length, NumberRange, Optional


class LoginForm(FlaskForm):
    email = StringField("Email or Patient ID", validators=[DataRequired()])
    password = PasswordField("Password", validators=[DataRequired()])
    remember = BooleanField("Remember me")
    submit = SubmitField("Sign in")


class RegisterForm(FlaskForm):
    name = StringField("Full name", validators=[DataRequired(), Length(max=120)])
    email = StringField("Email", validators=[DataRequired(), Email()])
    role = SelectField("Role", choices=[
        ("patient", "Patient"),
        ("labtech", "Lab Technician"),
        ("hepatologist", "Hepatologist"),
        ("admin", "Admin"),
    ])
    password = PasswordField("Password", validators=[DataRequired(), Length(min=8)])
    confirm_password = PasswordField("Confirm password", validators=[DataRequired(), EqualTo("password")])
    submit = SubmitField("Create account")


class ForgotPasswordForm(FlaskForm):
    email = StringField("Registered email", validators=[DataRequired(), Email()])
    submit = SubmitField("Continue")


class ResetPasswordForm(FlaskForm):
    password = PasswordField("New password", validators=[DataRequired(), Length(min=8)])
    confirm_password = PasswordField("Confirm new password", validators=[DataRequired(), EqualTo("password")])
    submit = SubmitField("Reset password")


class PatientForm(FlaskForm):
    full_name = StringField("Full name", validators=[DataRequired(), Length(max=140)])
    age = IntegerField("Age", validators=[DataRequired(), NumberRange(min=1, max=120)])
    gender = SelectField("Gender", choices=[("Female", "Female"), ("Male", "Male"), ("Other", "Other")])
    phone = StringField("Phone", validators=[Optional(), Length(max=30)])
    email = StringField("Email", validators=[Optional(), Email()])
    bilirubin = FloatField("Bilirubin", validators=[DataRequired()])
    albumin = FloatField("Albumin", validators=[DataRequired()])
    sgot = FloatField("SGOT", validators=[DataRequired()])
    sgpt = FloatField("SGPT", validators=[DataRequired()])
    platelets = FloatField("Platelets", validators=[DataRequired()])
    cholesterol = FloatField("Cholesterol", validators=[DataRequired()])
    prothrombin = FloatField("Prothrombin", validators=[DataRequired()])
    ascites = BooleanField("Ascites")
    hepatomegaly = BooleanField("Hepatomegaly")
    spiders = BooleanField("Spiders")
    edema = BooleanField("Edema")
    copper = FloatField("Copper", validators=[DataRequired()])
    alk_phos = FloatField("Alk Phos", validators=[DataRequired()])
    triglycerides = FloatField("Triglycerides", validators=[DataRequired()])
    report = FileField("Upload report", validators=[Optional(), FileAllowed(["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"])])
    submit = SubmitField("Save and predict")


class PrescriptionForm(FlaskForm):
    medicine = StringField("Medicine", validators=[DataRequired(), Length(max=180)])
    dosage = StringField("Dosage", validators=[DataRequired(), Length(max=120)])
    frequency_days = IntegerField("Frequency days", validators=[DataRequired(), NumberRange(min=1, max=365)])
    clinical_notes = TextAreaField("Clinical notes", validators=[Optional()])
    diet_suggestion = TextAreaField("Diet suggestion for patient", validators=[Optional()])
    follow_up_date = DateField("Follow-up date", validators=[Optional()])
    treatment_status = SelectField("Treatment status", choices=[
        ("Under treatment", "Under treatment"),
        ("Stable", "Stable"),
        ("Needs urgent review", "Needs urgent review"),
        ("Discharged", "Discharged"),
    ])
    submit = SubmitField("Save prescription")


class AppointmentForm(FlaskForm):
    doctor_id = SelectField("Hepatologist", coerce=int, validators=[DataRequired()])
    scheduled_at = DateTimeLocalField("Appointment date and time", format="%Y-%m-%dT%H:%M", validators=[DataRequired()])
    reason = StringField("Reason", validators=[DataRequired(), Length(max=220)])
    submit = SubmitField("Schedule appointment")
