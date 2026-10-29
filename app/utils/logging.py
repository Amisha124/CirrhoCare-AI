from flask_login import current_user

from app.models import db
from app.models.activity_log import ActivityLog


def log_activity(action, details=""):
    user_id = current_user.id if current_user.is_authenticated else None
    db.session.add(ActivityLog(user_id=user_id, action=action, details=details))
    db.session.commit()
