from app import create_app
from app.models import db
from app.models.user import User


def create_user(name, email, role, password, portal_id=None):
    user = User.query.filter_by(email=email).first()
    if user:
        if portal_id and not user.portal_id:
            user.portal_id = portal_id
        return user
    user = User(name=name, email=email, role=role, portal_id=portal_id)
    user.set_password(password)
    db.session.add(user)
    return user


app = create_app()

with app.app_context():
    create_user("System Admin", "admin@careai.com", "admin", "Admin@123")
    create_user("Lab Technician", "lab@careai.com", "labtech", "Lab@123")
    create_user("Dr. Hepato Care", "doctor@careai.com", "hepatologist", "Doctor@123")
    create_user("Patient Demo", "patient@careai.com", "patient", "Patient@123", "PAT-1001")
    db.session.commit()
    print("Demo users are ready.")
