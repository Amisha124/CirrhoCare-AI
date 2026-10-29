from app import create_app
from app.models import db
from app.models.patient import Patient
from app.models.user import User
from app.utils.portal import generate_patient_portal_id


app = create_app()


with app.app_context():
    created = 0
    patient_users = User.query.filter_by(role="patient").all()
    for user in patient_users:
        if not user.portal_id:
            user.portal_id = generate_patient_portal_id()
        existing = Patient.query.filter_by(portal_id=user.portal_id).first()
        if existing:
            continue
        db.session.add(Patient(
            full_name=user.name,
            age=1,
            gender="Other",
            email=user.email,
            portal_id=user.portal_id,
            created_by_id=None,
        ))
        created += 1
    db.session.commit()
    print(f"Linked patient profiles created: {created}")
