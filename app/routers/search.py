"""
Search router for querying violations and videos by date.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel

from app.database import get_db
from app.models.video import Video
from app.models.individual import TrackedIndividual
from app.models.violation import Violation

router = APIRouter()


# ============ Schemas ============

class ViolationSummary(BaseModel):
    """Summary of a violation."""
    id: int
    type: str
    confidence: float
    timestamp: float
    frame_number: int
    image_path: Optional[str] = None
    person_id: int
    
    class Config:
        from_attributes = True


class VideoSummaryResponse(BaseModel):
    """Detailed video summary with violations."""
    id: int
    filename: str
    original_filename: str
    duration: Optional[float] = None
    fps: Optional[float] = None
    shift: Optional[str] = None
    status: str
    uploaded_at: datetime
    processed_at: Optional[datetime] = None
    total_individuals: int
    total_violations: int
    annotated_video_path: Optional[str] = None
    violations: List[ViolationSummary] = []
    violation_types: dict = {}  # type -> count
    
    class Config:
        from_attributes = True


class DateGroupedVideos(BaseModel):
    """Videos grouped by date."""
    date: str
    morning_videos: List[VideoSummaryResponse] = []
    evening_videos: List[VideoSummaryResponse] = []
    night_videos: List[VideoSummaryResponse] = []
    total_videos: int = 0
    total_violations: int = 0


class SearchResponse(BaseModel):
    """Search results response."""
    results: List[DateGroupedVideos]
    total_videos: int
    total_violations: int


# ============ Endpoints ============

@router.get("/videos", response_model=SearchResponse)
async def search_videos(
    date_str: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    shift: Optional[str] = Query(None, description="Shift: morning, evening, night"),
    violation_type: Optional[str] = Query(None, description="Filter by violation type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search videos by date with violations grouped by shift.
    
    Returns videos grouped by date, then by shift (morning/evening/night).
    Each video includes its violations with snapshots.
    
    Only returns videos that have been reviewed (is_reviewed = 1).
    If no date is provided, returns all completed and reviewed videos.
    """
    # Build base query - only show completed AND reviewed videos
    query = select(Video).where(
        and_(
            Video.status == "completed",
            Video.is_reviewed == 1
        )
    )
    
    # Filter by date if provided - use date range for better compatibility
    if date_str:
        try:
            search_date = datetime.strptime(date_str, "%Y-%m-%d")
            # Create date range for the entire day
            start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            query = query.where(
                and_(
                    Video.uploaded_at >= start_of_day,
                    Video.uploaded_at <= end_of_day
                )
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Filter by shift if provided
    if shift:
        query = query.where(Video.shift == shift)
    
    # Order by date descending
    query = query.order_by(Video.uploaded_at.desc())
    
    result = await db.execute(query)
    videos = result.scalars().all()
    
    # Group videos by date
    date_groups = {}
    total_videos = 0
    total_violations = 0
    
    for video in videos:
        # Get date key
        video_date = video.uploaded_at.strftime("%Y-%m-%d")
        
        if video_date not in date_groups:
            date_groups[video_date] = {
                "date": video_date,
                "morning_videos": [],
                "evening_videos": [],
                "night_videos": [],
                "total_videos": 0,
                "total_violations": 0
            }
        
        # Get violations for this video
        viol_query = select(Violation).join(TrackedIndividual).where(
            TrackedIndividual.video_id == video.id
        )
        
        # Filter by violation type if provided
        if violation_type:
            viol_query = viol_query.where(Violation.violation_type == violation_type)
        
        viol_result = await db.execute(viol_query)
        violations = viol_result.scalars().all()
        
        # Build violation summaries
        violation_summaries = []
        violation_types = {}
        
        for v in violations:
            violation_summaries.append(ViolationSummary(
                id=v.id,
                type=v.violation_type,
                confidence=v.confidence or 0.0,
                timestamp=v.timestamp or 0.0,
                frame_number=v.frame_number,
                image_path=v.image_path,
                person_id=v.individual_id
            ))
            
            # Count violation types
            vtype = v.violation_type
            violation_types[vtype] = violation_types.get(vtype, 0) + 1
        
        # Get individual count
        ind_query = select(func.count()).select_from(TrackedIndividual).where(
            TrackedIndividual.video_id == video.id
        )
        ind_result = await db.execute(ind_query)
        individual_count = ind_result.scalar() or 0
        
        # Build video summary
        video_summary = VideoSummaryResponse(
            id=video.id,
            filename=video.filename,
            original_filename=video.original_filename,
            duration=video.duration,
            fps=video.fps,
            shift=video.shift,
            status=video.status,
            uploaded_at=video.uploaded_at,
            processed_at=video.processed_at,
            total_individuals=individual_count,
            total_violations=len(violation_summaries),
            annotated_video_path=video.annotated_video_path,
            violations=violation_summaries,
            violation_types=violation_types
        )
        
        # Add to appropriate shift group
        shift_key = video.shift or "morning"  # Default to morning if not set
        if shift_key == "morning":
            date_groups[video_date]["morning_videos"].append(video_summary)
        elif shift_key == "evening":
            date_groups[video_date]["evening_videos"].append(video_summary)
        else:  # night
            date_groups[video_date]["night_videos"].append(video_summary)
        
        date_groups[video_date]["total_videos"] += 1
        date_groups[video_date]["total_violations"] += len(violation_summaries)
        
        total_videos += 1
        total_violations += len(violation_summaries)
    
    # Convert to list of DateGroupedVideos
    results = [
        DateGroupedVideos(**data) for data in date_groups.values()
    ]
    
    # Sort by date descending
    results.sort(key=lambda x: x.date, reverse=True)
    
    return SearchResponse(
        results=results,
        total_videos=total_videos,
        total_violations=total_violations
    )


@router.get("/videos/{video_id}/summary", response_model=VideoSummaryResponse)
async def get_video_summary(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed summary of a specific video with all violations.
    """
    # Get video
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Get violations
    viol_query = select(Violation).join(TrackedIndividual).where(
        TrackedIndividual.video_id == video.id
    )
    viol_result = await db.execute(viol_query)
    violations = viol_result.scalars().all()
    
    # Build violation summaries
    violation_summaries = []
    violation_types = {}
    
    for v in violations:
        violation_summaries.append(ViolationSummary(
            id=v.id,
            type=v.violation_type,
            confidence=v.confidence or 0.0,
            timestamp=v.timestamp or 0.0,
            frame_number=v.frame_number,
            image_path=v.image_path,
            person_id=v.individual_id
        ))
        
        vtype = v.violation_type
        violation_types[vtype] = violation_types.get(vtype, 0) + 1
    
    # Get individual count
    ind_query = select(func.count()).select_from(TrackedIndividual).where(
        TrackedIndividual.video_id == video.id
    )
    ind_result = await db.execute(ind_query)
    individual_count = ind_result.scalar() or 0
    
    return VideoSummaryResponse(
        id=video.id,
        filename=video.filename,
        original_filename=video.original_filename,
        duration=video.duration,
        fps=video.fps,
        shift=video.shift,
        status=video.status,
        uploaded_at=video.uploaded_at,
        processed_at=video.processed_at,
        total_individuals=individual_count,
        total_violations=len(violation_summaries),
        annotated_video_path=video.annotated_video_path,
        violations=violation_summaries,
        violation_types=violation_types
    )


@router.get("/dates")
async def get_available_dates(
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of dates that have analyzed videos.
    Useful for populating date picker options.
    """
    # Use SQLite-compatible date extraction - filter out NULL uploaded_at
    query = select(
        func.date(Video.uploaded_at).label("date"),
        func.count(Video.id).label("video_count")
    ).where(
        and_(
            Video.status == "completed",
            Video.uploaded_at.isnot(None)
        )
    ).group_by(
        func.date(Video.uploaded_at)
    ).order_by(
        func.date(Video.uploaded_at).desc()
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return {
        "dates": [
            {
                "date": row.date if isinstance(row.date, str) else str(row.date) if row.date else None,
                "video_count": row.video_count
            }
            for row in rows
            if row.date is not None
        ]
    }
