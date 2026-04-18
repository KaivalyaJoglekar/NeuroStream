from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import BillingUsage, Subscription
from ..utils import get_current_month


def ensure_subscription(db: Session, user_id: str) -> Subscription:
    subscription = db.scalar(select(Subscription).where(Subscription.user_id == user_id))
    if subscription:
        return subscription

    subscription = Subscription(
        user_id=user_id,
        plan_name="FREE",
        max_videos=10,
        max_storage_bytes=5_368_709_120,
        max_minutes=60,
    )
    db.add(subscription)
    db.flush()
    return subscription


def increment_usage(db: Session, user_id: str, file_size: int) -> BillingUsage:
    month = get_current_month()
    usage = db.scalar(
        select(BillingUsage).where(BillingUsage.user_id == user_id, BillingUsage.month == month)
    )
    if usage is None:
        usage = BillingUsage(
            user_id=user_id,
            month=month,
            videos_uploaded=1,
            storage_used_bytes=file_size,
            minutes_processed=0,
        )
        db.add(usage)
    else:
        usage.videos_uploaded += 1
        usage.storage_used_bytes += file_size
    db.flush()
    return usage


def add_processed_minutes(db: Session, user_id: str, minutes: float) -> BillingUsage:
    month = get_current_month()
    usage = db.scalar(
        select(BillingUsage).where(BillingUsage.user_id == user_id, BillingUsage.month == month)
    )
    if usage is None:
        usage = BillingUsage(
            user_id=user_id,
            month=month,
            videos_uploaded=0,
            storage_used_bytes=0,
            minutes_processed=minutes,
        )
        db.add(usage)
    else:
        usage.minutes_processed += minutes
    db.flush()
    return usage
