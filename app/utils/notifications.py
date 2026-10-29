from app.models import db
from app.models.notification import Notification


def notify(title, message, category="info", role=None, user_id=None, auto_commit=False):
    """
    Creates and persists a system notification.
    By default, flushes the session to assign an ID within the active transaction
    without forcing a premature commit.
    If auto_commit=True, commits immediately.
    """
    notification = Notification(
        title=title,
        message=message,
        category=category,
        role=role,
        user_id=user_id,
    )
    db.session.add(notification)
    try:
        if auto_commit:
            db.session.commit()
        else:
            db.session.flush()
    except Exception:
        db.session.rollback()
        raise
    return notification
