"""
Dashboard statistics and analytics endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models.video import Video, ProcessingStatus
from app.models.individual import TrackedIndividual
from app.models.violation import Violation
from app.schemas.dashboard import (
    DashboardStats, RepeatOffendersResponse, RepeatOffender, RecentEvent
)

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive dashboard statistics with analytics.
    
    Returns:
    - Total counts and compliance rates
    - PPE-wise violation breakdown
    - Shift-based analysis
    - Confidence metrics
    - Daily trends
    - Recent events feed
    """
    # Total videos
    videos_result = await db.execute(select(func.count()).select_from(Video))
    total_videos = videos_result.scalar() or 0
    
    # Processing videos
    processing_result = await db.execute(
        select(func.count()).select_from(Video)
        .where(Video.status == ProcessingStatus.PROCESSING.value)
    )
    videos_processing = processing_result.scalar() or 0
    
    # Total individuals
    individuals_result = await db.execute(
        select(func.count()).select_from(TrackedIndividual)
    )
    total_individuals = individuals_result.scalar() or 0
    
    # Individuals with at least one violation
    violators_result = await db.execute(
        select(func.count()).select_from(TrackedIndividual)
        .where(TrackedIndividual.total_violations > 0)
    )
    total_violators = violators_result.scalar() or 0
    
    # Compliance rates
    compliance_rate = ((total_individuals - total_violators) / total_individuals * 100) if total_individuals > 0 else 100.0
    violation_rate = (total_violators / total_individuals * 100) if total_individuals > 0 else 0.0
    
    # Total violations
    violations_result = await db.execute(
        select(func.count()).select_from(Violation)
    )
    total_violations = violations_result.scalar() or 0
    
    # Confirmed violations
    confirmed_result = await db.execute(
        select(func.count()).select_from(Violation)
        .where(Violation.review_status == 'confirmed')
    )
    confirmed_violations = confirmed_result.scalar() or 0
    
    # Rejected violations
    rejected_result = await db.execute(
        select(func.count()).select_from(Violation)
        .where(Violation.review_status == 'rejected')
    )
    rejected_violations = rejected_result.scalar() or 0
    
    # Pending violations
    pending_violations = total_violations - confirmed_violations - rejected_violations
    
    # Repeat offenders (2+ violations)
    repeat_result = await db.execute(
        select(func.count()).select_from(TrackedIndividual)
        .where(TrackedIndividual.total_violations >= 2)
    )
    repeat_offenders_count = repeat_result.scalar() or 0
    
    # Violations by type (PPE-wise) - Verified Videos Only
    type_result = await db.execute(
        select(Violation.violation_type, func.count())
        .join(TrackedIndividual, Violation.individual_id == TrackedIndividual.id)
        .join(Video, TrackedIndividual.video_id == Video.id)
        .where(Video.is_reviewed == 1)
        .group_by(Violation.violation_type)
    )
    violations_by_type = {row[0]: row[1] for row in type_result.all()}
    
    # Violations by shift - Verified Videos Only
    shift_result = await db.execute(
        select(Video.shift, func.count(Violation.id))
        .join(TrackedIndividual, TrackedIndividual.video_id == Video.id)
        .join(Violation, Violation.individual_id == TrackedIndividual.id)
        .where(Video.shift.isnot(None))
        .where(Video.is_reviewed == 1)
        .group_by(Video.shift)
    )
    violations_by_shift = {row[0]: row[1] for row in shift_result.all()}
    
    # Confidence metrics
    confidence_result = await db.execute(
        select(func.avg(Violation.confidence))
    )
    avg_confidence = confidence_result.scalar() or 0.0
    
    low_conf_result = await db.execute(
        select(func.count()).select_from(Violation)
        .where(Violation.confidence < 0.5)
    )
    low_confidence_count = low_conf_result.scalar() or 0
    
    # Recent videos (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_result = await db.execute(
        select(func.count()).select_from(Video)
        .where(Video.uploaded_at >= yesterday)
    )
    recent_videos_count = recent_result.scalar() or 0
    
    # Daily trends (last 7 days)
    daily_violations = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        
        day_result = await db.execute(
            select(func.count()).select_from(Violation)
            .join(TrackedIndividual, Violation.individual_id == TrackedIndividual.id)
            .join(Video, TrackedIndividual.video_id == Video.id)
            .where(and_(Violation.detected_at >= day_start, Violation.detected_at < day_end))
            .where(Video.is_reviewed == 1)
        )
        count = day_result.scalar() or 0
        daily_violations.append({"date": day.strftime("%Y-%m-%d"), "count": count})
    
    # Recent events feed (last 10)
    events_result = await db.execute(
        select(Violation, TrackedIndividual, Video)
        .join(TrackedIndividual, Violation.individual_id == TrackedIndividual.id)
        .join(Video, TrackedIndividual.video_id == Video.id)
        .order_by(Violation.detected_at.desc())
        .limit(10)
    )
    recent_events = []
    for violation, individual, video in events_result.all():
        recent_events.append(RecentEvent(
            id=violation.id,
            person_id=individual.track_id,
            video_name=video.original_filename,
            violation_type=violation.violation_type,
            confidence=violation.confidence,
            detected_at=violation.detected_at,
            image_path=violation.image_path
        ))
    
    # Correlation Data (Violations vs People Count per Video)
    correlation_data = []
    recent_videos_result = await db.execute(
        select(Video)
        .where(Video.is_reviewed == 1)
        .order_by(Video.uploaded_at.desc())
        .limit(20)
    )
    for vid in recent_videos_result.scalars().all():
        correlation_data.append({
            "video_name": vid.original_filename,
            "people_count": vid.total_individuals,
            "violation_count": vid.total_violations
        })
    
    # Real data only for correlation chart requested by user


    # PPE Trends with Dummy Data Injection for Tue/Wed/Thu as requested
    ppe_trends = []
    today = datetime.utcnow().date()
    for i in range(29, -1, -1):
        date_obj = today - timedelta(days=i)
        date_str = date_obj.strftime("%Y-%m-%d")
        day_name = date_obj.strftime("%a")
        
        # Base random data
        import random
        helmet = random.randint(0, 5)
        goggles = random.randint(0, 5)
        shoes = random.randint(0, 5)
        
        # Boost specific days (Tue/Wed/Thu) or ensure data exists
        if day_name in ['Tue', 'Wed', 'Thu']:
             helmet = max(helmet, random.randint(3, 8))
             goggles = max(goggles, random.randint(2, 6))
             shoes = max(shoes, random.randint(2, 6))
             
        # "Missing Goggles" growing trend simulation (last 10 days)
        if i < 10:
             goggles += random.randint(2, 5)
             
        ppe_trends.append({
            "date": date_str,
            "Missing Helmet": helmet,
            "Missing Goggles": goggles,
            "Missing Shoes": shoes
        })

    return DashboardStats(
        total_videos=total_videos,
        total_individuals=total_individuals,
        total_violations=total_violations,
        confirmed_violations=confirmed_violations,
        rejected_violations=rejected_violations,
        pending_violations=pending_violations,
        repeat_offenders_count=repeat_offenders_count,
        videos_processing=videos_processing,
        compliance_rate=round(compliance_rate, 1),
        violation_rate=round(violation_rate, 1),
        violations_by_type=violations_by_type,
        violations_by_shift=violations_by_shift,
        avg_detection_confidence=round(avg_confidence, 2),
        low_confidence_count=low_confidence_count,
        recent_videos_count=recent_videos_count,
        daily_violations=daily_violations,
        recent_events=recent_events,
        correlation_data=correlation_data,
        ppe_trends=ppe_trends
    )


@router.get("/repeat-offenders", response_model=RepeatOffendersResponse)
async def get_repeat_offenders(
    min_violations: int = 2,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """
    Get individuals with multiple violations.
    
    Args:
        min_violations: Minimum violation count (default: 2)
        limit: Maximum results to return (default: 20)
    """
    result = await db.execute(
        select(TrackedIndividual, Video.original_filename)
        .join(Video, TrackedIndividual.video_id == Video.id)
        .where(TrackedIndividual.total_violations >= min_violations)
        .where(Video.is_reviewed == 1)
        .order_by(TrackedIndividual.total_violations.desc())
        .limit(limit)
    )
    rows = result.all()
    
    offenders = []
    for ind, video_name in rows:
        # Get most common violation type
        type_result = await db.execute(
            select(Violation.violation_type, func.count())
            .where(Violation.individual_id == ind.id)
            .group_by(Violation.violation_type)
            .order_by(func.count().desc())
            .limit(1)
        )
        type_row = type_result.first()
        most_common = type_row[0] if type_row else None
        
        offenders.append(RepeatOffender(
            individual_id=ind.id,
            video_id=ind.video_id,
            video_name=video_name,
            track_id=ind.track_id,
            total_violations=ind.total_violations,
            confirmed_violations=ind.confirmed_violations,
            most_common_violation=most_common,
            risk_score=ind.risk_score
        ))
    
    return RepeatOffendersResponse(
        offenders=offenders,
        total=len(offenders),
        threshold=min_violations
    )


@router.get("/summary")
async def get_quick_summary(
    db: AsyncSession = Depends(get_db)
):
    """
    Get a quick summary for the dashboard header.
    """
    # Pending reviews
    pending_result = await db.execute(
        select(func.count()).select_from(Violation)
        .where(Violation.review_status == 'pending')
    )
    pending_reviews = pending_result.scalar() or 0
    
    # High risk individuals
    high_risk_result = await db.execute(
        select(func.count()).select_from(TrackedIndividual)
        .where(TrackedIndividual.risk_score >= 0.7)
    )
    high_risk_count = high_risk_result.scalar() or 0
    
    # Latest video
    latest_result = await db.execute(
        select(Video).order_by(Video.uploaded_at.desc()).limit(1)
    )
    latest_video = latest_result.scalar_one_or_none()
    
    return {
        "pending_reviews": pending_reviews,
        "high_risk_individuals": high_risk_count,
        "latest_video": {
            "id": latest_video.id,
            "filename": latest_video.original_filename,
            "status": latest_video.status
        } if latest_video else None
    }
