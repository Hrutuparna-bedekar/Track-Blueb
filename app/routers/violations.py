"""
Violation management and review endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime
import os

from app.database import get_db
from app.models.violation import Violation, ReviewStatus
from app.models.individual import TrackedIndividual
from app.models.review import ViolationReview
from app.schemas.violation import (
    ViolationResponse, ViolationListResponse, BoundingBox
)
from app.schemas.review import ReviewCreate, ReviewResponse, BulkReviewRequest
from app.config import settings

router = APIRouter()


@router.get("", response_model=ViolationListResponse)
async def list_violations(
    page: int = 1,
    page_size: int = 20,
    video_id: Optional[int] = None,
    individual_id: Optional[int] = None,
    violation_type: Optional[str] = None,
    review_status: Optional[str] = None,
    min_confidence: Optional[float] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all violations with filtering options.
    
    Filters:
    - video_id: Filter by video
    - individual_id: Filter by tracked individual
    - violation_type: Filter by type
    - review_status: pending, confirmed, or rejected
    - min_confidence: Minimum detection confidence
    """
    query = select(Violation).join(TrackedIndividual)
    
    # Apply filters
    conditions = []
    if video_id:
        conditions.append(TrackedIndividual.video_id == video_id)
    if individual_id:
        conditions.append(Violation.individual_id == individual_id)
    if violation_type:
        conditions.append(Violation.violation_type == violation_type)
    if review_status:
        conditions.append(Violation.review_status == review_status)
    if min_confidence:
        conditions.append(Violation.confidence >= min_confidence)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Count total
    count_query = select(func.count()).select_from(Violation).join(TrackedIndividual)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get page
    query = query.order_by(Violation.detected_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    violations = result.scalars().all()
    
    items = []
    for v in violations:
        # Get related data
        ind_result = await db.execute(
            select(TrackedIndividual).where(TrackedIndividual.id == v.individual_id)
        )
        individual = ind_result.scalar_one_or_none()
        
        bbox = None
        if v.bbox_x1 is not None:
            bbox = BoundingBox(
                x1=v.bbox_x1, y1=v.bbox_y1,
                x2=v.bbox_x2, y2=v.bbox_y2
            )
        
        items.append(ViolationResponse(
            id=v.id,
            individual_id=v.individual_id,
            violation_type=v.violation_type,
            violation_class_id=v.violation_class_id,
            confidence=v.confidence,
            frame_number=v.frame_number,
            timestamp=v.timestamp,
            bbox=bbox,
            image_path=v.image_path,
            snippet_path=v.snippet_path,
            snippet_start_time=v.snippet_start_time,
            snippet_end_time=v.snippet_end_time,
            review_status=v.review_status,
            detected_at=v.detected_at,
            reviewed_at=v.reviewed_at,
            video_id=individual.video_id if individual else None,
            track_id=individual.track_id if individual else None
        ))
    
    return ViolationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{violation_id}", response_model=ViolationResponse)
async def get_violation(
    violation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get violation details by ID."""
    result = await db.execute(
        select(Violation).where(Violation.id == violation_id)
    )
    violation = result.scalar_one_or_none()
    
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    # Get individual
    ind_result = await db.execute(
        select(TrackedIndividual).where(TrackedIndividual.id == violation.individual_id)
    )
    individual = ind_result.scalar_one_or_none()
    
    bbox = None
    if violation.bbox_x1 is not None:
        bbox = BoundingBox(
            x1=violation.bbox_x1, y1=violation.bbox_y1,
            x2=violation.bbox_x2, y2=violation.bbox_y2
        )
    
    return ViolationResponse(
        id=violation.id,
        individual_id=violation.individual_id,
        violation_type=violation.violation_type,
        violation_class_id=violation.violation_class_id,
        confidence=violation.confidence,
        frame_number=violation.frame_number,
        timestamp=violation.timestamp,
        bbox=bbox,
        image_path=violation.image_path,
        snippet_path=violation.snippet_path,
        snippet_start_time=violation.snippet_start_time,
        snippet_end_time=violation.snippet_end_time,
        review_status=violation.review_status,
        detected_at=violation.detected_at,
        reviewed_at=violation.reviewed_at,
        video_id=individual.video_id if individual else None,
        track_id=individual.track_id if individual else None
    )


@router.post("/{violation_id}/review", response_model=ReviewResponse)
async def review_violation(
    violation_id: int,
    review_data: ReviewCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit admin review for a violation.
    
    - is_confirmed: true to confirm, false to reject
    - notes: Optional admin notes
    
    Only admin-confirmed violations appear in the final violator list.
    """
    # Get violation
    result = await db.execute(
        select(Violation).where(Violation.id == violation_id)
    )
    violation = result.scalar_one_or_none()
    
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    # Check if already reviewed
    existing_review = await db.execute(
        select(ViolationReview).where(ViolationReview.violation_id == violation_id)
    )
    existing = existing_review.scalar_one_or_none()
    
    if existing:
        # Update existing review
        existing.is_confirmed = review_data.is_confirmed
        existing.notes = review_data.notes
        existing.reviewed_at = datetime.utcnow()
        review = existing
    else:
        # Create new review
        review = ViolationReview(
            violation_id=violation_id,
            is_confirmed=review_data.is_confirmed,
            notes=review_data.notes
        )
        db.add(review)
    
    # Update violation status
    violation.review_status = (
        ReviewStatus.CONFIRMED.value if review_data.is_confirmed 
        else ReviewStatus.REJECTED.value
    )
    violation.reviewed_at = datetime.utcnow()
    
    # Update individual counts
    ind_result = await db.execute(
        select(TrackedIndividual).where(
            TrackedIndividual.id == violation.individual_id
        )
    )
    individual = ind_result.scalar_one_or_none()
    
    if individual:
        if review_data.is_confirmed:
            individual.confirmed_violations += 1
        else:
            individual.rejected_violations += 1
    
    await db.commit()
    await db.refresh(review)
    
    return ReviewResponse(
        id=review.id,
        violation_id=review.violation_id,
        is_confirmed=review.is_confirmed,
        notes=review.notes,
        reviewed_by=review.reviewed_by,
        reviewed_at=review.reviewed_at
    )


@router.post("/bulk-review")
async def bulk_review_violations(
    review_data: BulkReviewRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Review multiple violations at once.
    
    Useful for confirming/rejecting multiple violations from the same offender.
    """
    reviewed_count = 0
    
    for violation_id in review_data.violation_ids:
        result = await db.execute(
            select(Violation).where(Violation.id == violation_id)
        )
        violation = result.scalar_one_or_none()
        
        if not violation:
            continue
        
        # Check existing review
        existing_result = await db.execute(
            select(ViolationReview).where(ViolationReview.violation_id == violation_id)
        )
        existing = existing_result.scalar_one_or_none()
        
        if existing:
            existing.is_confirmed = review_data.is_confirmed
            existing.notes = review_data.notes
            existing.reviewed_at = datetime.utcnow()
        else:
            review = ViolationReview(
                violation_id=violation_id,
                is_confirmed=review_data.is_confirmed,
                notes=review_data.notes
            )
            db.add(review)
        
        # Update violation
        violation.review_status = (
            ReviewStatus.CONFIRMED.value if review_data.is_confirmed 
            else ReviewStatus.REJECTED.value
        )
        violation.reviewed_at = datetime.utcnow()
        reviewed_count += 1
    
    await db.commit()
    
    return {
        "message": f"Reviewed {reviewed_count} violations",
        "reviewed_count": reviewed_count,
        "is_confirmed": review_data.is_confirmed
    }


@router.get("/{violation_id}/snippet")
async def get_violation_snippet(
    violation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get video snippet for a violation."""
    result = await db.execute(
        select(Violation).where(Violation.id == violation_id)
    )
    violation = result.scalar_one_or_none()
    
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    if not violation.snippet_path or not os.path.exists(violation.snippet_path):
        raise HTTPException(status_code=404, detail="Snippet not available")
    
    return FileResponse(
        violation.snippet_path,
        media_type="video/mp4",
        filename=f"violation_{violation_id}.mp4"
    )


@router.get("/types/list")
async def get_violation_types(
    db: AsyncSession = Depends(get_db)
):
    """Get list of all detected violation types."""
    result = await db.execute(
        select(Violation.violation_type).distinct()
    )
    types = [row[0] for row in result.all()]
    
    return {"violation_types": types}
