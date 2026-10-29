from app import create_app
from app.models.patient import Patient
from app.models.user import User


app = create_app()


with app.app_context():
    print("\nPATIENT RECORD LINKS")
    print("-" * 80)
    for patient in Patient.query.order_by(Patient.id).all():
        user = User.query.filter_by(portal_id=patient.portal_id).first()
        print(
            f"Patient DB ID: {patient.id} | Name: {patient.full_name} | "
            f"Login ID: {patient.portal_id} | Login User: {user.email if user else 'missing'} | "
            f"Prescriptions: {len(patient.prescriptions)} | Reports: {len(patient.reports)}"
        )
