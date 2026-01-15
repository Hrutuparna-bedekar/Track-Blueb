"""
Individual tracking and profile endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.database import get_db
from app.models.individual import TrackedIndividual
from app.models.violation import Violation
from app.schemas.individual import (
    IndividualResponse, IndividualDetailResponse, 
    IndividualListResponse, IndividualPatternAnalysis,
    ViolationSummary
)

router = APIRouter()


@router.get("/{video_id}", response_model=IndividualListResponse)
async def list_individuals(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    List all tracked individuals in a video.
    
    Each individual has a temporary, session-specific ID that is:
    - Valid only for this video
    - Not linked across videos
    - Not associated with any biometric data
    """
    result = await db.execute(
        select(TrackedIndividual)
        .where(TrackedIndividual.video_id == video_id)
        .order_by(TrackedIndividual.total_violations.desc())
    )
    individuals = result.scalars().all()
    
    items = []
    for ind in individuals:
        pending = ind.total_violations - ind.confirmed_violations - ind.rejected_violations
        # Parse worn_equipment from comma-separated string to list
        worn_list = [e.strip() for e in (ind.worn_equipment or "").split(",") if e.strip()]
        items.append(IndividualResponse(
            id=ind.id,
            video_id=ind.video_id,
            track_id=ind.track_id,
            first_seen_frame=ind.first_seen_frame,
            last_seen_frame=ind.last_seen_frame,
            first_seen_time=ind.first_seen_time,
            last_seen_time=ind.last_seen_time,
            total_frames_tracked=ind.total_frames_tracked,
            total_violations=ind.total_violations,
            confirmed_violations=ind.confirmed_violations,
            rejected_violations=ind.rejected_violations,
            pending_violations=pending,
            risk_score=ind.risk_score,
            worn_equipment=worn_list,
            created_at=ind.created_at
        ))
    
    return IndividualListResponse(
        items=items,
        total=len(items),
        video_id=video_id
    )


@router.get("/{video_id}/{track_id}", response_model=IndividualDetailResponse)
async def get_individual(
    video_id: int,
    track_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed profile for a tracked individual.
    
    Includes all violations associated with this person.
    """
    result = await db.execute(
        select(TrackedIndividual).where(
            TrackedIndividual.video_id == video_id,
            TrackedIndividual.track_id == track_id
        )
    )
    individual = result.scalar_one_or_none()
    
    if not individual:
        raise HTTPException(status_code=404, detail="Individual not found")
    
    # Get violations
    violations_result = await db.execute(
        select(Violation)
        .where(Violation.individual_id == individual.id)
        .order_by(Violation.timestamp)
    )
    violations = violations_result.scalars().all()
    
    violation_summaries = [
        ViolationSummary(
            id=v.id,
            violation_type=v.violation_type,
            timestamp=v.timestamp,
            confidence=v.confidence,
            review_status=v.review_status
        )
        for v in violations
    ]
    
    pending = individual.total_violations - individual.confirmed_violations - individual.rejected_violations
    
    # Parse worn_equipment from comma-separated string to list
    worn_list = [e.strip() for e in (individual.worn_equipment or "").split(",") if e.strip()]
    
    return IndividualDetailResponse(
        id=individual.id,
        video_id=individual.video_id,
        track_id=individual.track_id,
        first_seen_frame=individual.first_seen_frame,
        last_seen_frame=individual.last_seen_frame,
        first_seen_time=individual.first_seen_time,
        last_seen_time=individual.last_seen_time,
        total_frames_tracked=individual.total_frames_tracked,
        total_violations=individual.total_violations,
        confirmed_violations=individual.confirmed_violations,
        rejected_violations=individual.rejected_violations,
        pending_violations=pending,
        risk_score=individual.risk_score,
        worn_equipment=worn_list,
        created_at=individual.created_at,
        violations=violation_summaries
    )


@router.get("/{video_id}/{track_id}/analysis", response_model=IndividualPatternAnalysis)
async def analyze_individual(
    video_id: int,
    track_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get pattern analysis for a tracked individual.
    
    Provides:
    - Violation frequency
    - Most common violation type
    - Repeat offender status
    - Risk level assessment
    """
    result = await db.execute(
        select(TrackedIndividual).where(
            TrackedIndividual.video_id == video_id,
            TrackedIndividual.track_id == track_id
        )
    )
    individual = result.scalar_one_or_none()
    
    if not individual:
        raise HTTPException(status_code=404, detail="Individual not found")
    
    # Get violations for analysis
    violations_result = await db.execute(
        select(Violation)
        .where(Violation.individual_id == individual.id)
        .order_by(Violation.timestamp)
    )
    violations = violations_result.scalars().all()
    
    # Calculate violation frequency (per minute)
    duration = (individual.last_seen_time or 0) - (individual.first_seen_time or 0)
    duration_mins = duration / 60.0 if duration > 0 else 1
    violation_frequency = len(violations) / duration_mins
    
    # Find most common violation
    type_counts = {}
    for v in violations:
        type_counts[v.violation_type] = type_counts.get(v.violation_type, 0) + 1
    
    most_common = None
    if type_counts:
        most_common = max(type_counts.keys(), key=lambda k: type_counts[k])
    
    # Determine risk level
    is_repeat = len(violations) >= 2
    
    if individual.risk_score >= 0.7 or len(violations) >= 5:
        risk_level = "high"
    elif individual.risk_score >= 0.4 or len(violations) >= 2:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    # Build timeline
    timeline = [
        {
            "timestamp": v.timestamp,
            "frame": v.frame_number,
            "type": v.violation_type,
            "status": v.review_status
        }
        for v in violations
    ]
    
    return IndividualPatternAnalysis(
        individual_id=individual.id,
        track_id=individual.track_id,
        violation_frequency=round(violation_frequency, 2),
        most_common_violation=most_common,
        is_repeat_offender=is_repeat,
        risk_level=risk_level,
        violation_timeline=timeline
    )
