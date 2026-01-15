"""
Video upload and management endpoints.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import os
import uuid
import aiofiles
from pathlib import Path

from app.database import get_db
from app.models.video import Video, ProcessingStatus
from app.models.individual import TrackedIndividual
from app.models.violation import Violation
from app.schemas.video import VideoResponse, VideoListResponse, VideoStatusResponse
from app.config import settings
from app.services.video_service import process_video_background

router = APIRouter()


@router.post("/upload", response_model=VideoResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    shift: Optional[str] = Form(None),  # morning, evening, night
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a video file for processing.
    
    The video will be processed in the background using the AI pipeline:
    - YOLO-based violation detection
    - Deep SORT individual tracking
    - Violation aggregation per individual
    """
    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {settings.ALLOWED_EXTENSIONS}"
        )
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Save file
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
            file_size = len(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
    
    # Create database record
    video = Video(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        status=ProcessingStatus.PENDING.value,
        shift=shift  # morning, evening, night
    )
    
    db.add(video)
    await db.commit()
    await db.refresh(video)
    
    # Start background processing - pass video_id and path (not db session)
    background_tasks.add_task(process_video_background, video.id, file_path)
    
    return VideoResponse(
        id=video.id,
        filename=video.filename,
        original_filename=video.original_filename,
        file_size=video.file_size,
        status=video.status,
        processing_progress=video.processing_progress,
        uploaded_at=video.uploaded_at
    )


@router.get("", response_model=VideoListResponse)
async def list_videos(
    page: int = 1,
    page_size: int = 10,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all uploaded videos with pagination."""
    query = select(Video)
    
    if status:
        query = query.where(Video.status == status)
    
    # Count total
    count_query = select(func.count()).select_from(Video)
    if status:
        count_query = count_query.where(Video.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get page
    query = query.order_by(Video.uploaded_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    videos = result.scalars().all()
    
    # Get counts for each video
    items = []
    for video in videos:
        # Get individual count
        ind_query = select(func.count()).select_from(TrackedIndividual).where(
            TrackedIndividual.video_id == video.id
        )
        ind_result = await db.execute(ind_query)
        total_individuals = ind_result.scalar() or 0
        
        # Get violation count - join through TrackedIndividual
        viol_query = select(func.count()).select_from(Violation).join(
            TrackedIndividual, Violation.individual_id == TrackedIndividual.id
        ).where(TrackedIndividual.video_id == video.id)
        viol_result = await db.execute(viol_query)
        total_violations = viol_result.scalar() or 0
        
        items.append(VideoResponse(
            id=video.id,
            filename=video.filename,
            original_filename=video.original_filename,
            file_size=video.file_size,
            duration=video.duration,
            fps=video.fps,
            width=video.width,
            height=video.height,
            status=video.status,
            processing_progress=video.processing_progress,
            error_message=video.error_message,
            annotated_video_path=video.annotated_video_path,
            uploaded_at=video.uploaded_at,
            processed_at=video.processed_at,
            total_individuals=total_individuals,
            total_violations=total_violations
        ))
    
    return VideoListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get video details by ID."""
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Get counts
    ind_query = select(func.count()).select_from(TrackedIndividual).where(
        TrackedIndividual.video_id == video.id
    )
    ind_result = await db.execute(ind_query)
    total_individuals = ind_result.scalar() or 0
    
    return VideoResponse(
        id=video.id,
        filename=video.filename,
        original_filename=video.original_filename,
        file_size=video.file_size,
        duration=video.duration,
        fps=video.fps,
        width=video.width,
        height=video.height,
        status=video.status,
        processing_progress=video.processing_progress,
        error_message=video.error_message,
        uploaded_at=video.uploaded_at,
        processed_at=video.processed_at,
        total_individuals=total_individuals
    )


@router.get("/{video_id}/status", response_model=VideoStatusResponse)
async def get_video_status(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Check video processing status."""
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Get counts
    ind_query = select(func.count()).select_from(TrackedIndividual).where(
        TrackedIndividual.video_id == video.id
    )
    ind_result = await db.execute(ind_query)
    individuals_detected = ind_result.scalar() or 0
    
    viol_query = select(func.count()).select_from(Violation).join(TrackedIndividual).where(
        TrackedIndividual.video_id == video.id
    )
    viol_result = await db.execute(viol_query)
    violations_detected = viol_result.scalar() or 0
    
    return VideoStatusResponse(
        id=video.id,
        status=video.status,
        progress=video.processing_progress,
        error_message=video.error_message,
        individuals_detected=individuals_detected,
        violations_detected=violations_detected
    )


@router.delete("/{video_id}")
async def delete_video(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a video and all associated data."""
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Delete file
    if os.path.exists(video.file_path):
        os.remove(video.file_path)
    
    # Delete from database (cascade will handle related records)
    await db.delete(video)
    await db.commit()
    
    return {"message": "Video deleted successfully"}
