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
    DashboardStats, RepeatOffendersResponse, RepeatOffender
)

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall dashboard statistics.
    
    Returns:
    - Total videos, individuals, violations
    - Confirmed/rejected/pending violation counts
    - Repeat offenders count
    - Violations by type breakdown
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
    
    # Violations by type
    type_result = await db.execute(
        select(Violation.violation_type, func.count())
        .group_by(Violation.violation_type)
    )
    violations_by_type = {row[0]: row[1] for row in type_result.all()}
    
    # Recent videos (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_result = await db.execute(
        select(func.count()).select_from(Video)
        .where(Video.uploaded_at >= yesterday)
    )
    recent_videos_count = recent_result.scalar() or 0
    
    return DashboardStats(
        total_videos=total_videos,
        total_individuals=total_individuals,
        total_violations=total_violations,
        confirmed_violations=confirmed_violations,
        rejected_violations=rejected_violations,
        pending_violations=pending_violations,
        repeat_offenders_count=repeat_offenders_count,
        videos_processing=videos_processing,
        violations_by_type=violations_by_type,
        recent_videos_count=recent_videos_count
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
        select(TrackedIndividual)
        .where(TrackedIndividual.total_violations >= min_violations)
        .order_by(TrackedIndividual.total_violations.desc())
        .limit(limit)
    )
    individuals = result.scalars().all()
    
    offenders = []
    for ind in individuals:
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
