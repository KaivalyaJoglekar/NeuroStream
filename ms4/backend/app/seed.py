from sqlalchemy import select

from .database import SessionLocal, Base, engine
from .models import Subscription, User, Video, WorkflowStatusLog, BillingUsage, CallbackEvent, DeletedVideoCleanupLog
from .security import hash_password


def main() -> None:
    # Ensure all models are known to SQLAlchemy
    _ = (User, Video, WorkflowStatusLog, Subscription, BillingUsage, CallbackEvent, DeletedVideoCleanupLog)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        email = "demo@neurostream.ai"
        existing = db.scalar(select(User).where(User.email == email))

        if existing:
            print("Demo user already exists.")
            return

        user = User(
            email=email,
            name="Demo User",
            password_hash=hash_password("DemoPassword123!"),
            role="USER",
        )
        db.add(user)
        db.flush()

        db.add(
            Subscription(
                user_id=user.id,
                plan_name="PRO",
                max_videos=100,
                max_storage_bytes=53_687_091_200,
                max_minutes=600,
            )
        )

        db.commit()
        print("Seeded demo user demo@neurostream.ai / DemoPassword123!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
