"""
Video processing service.
Handles background video processing and result persistence.
"""

import asyncio
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Video, TrackedIndividual, Violation
from app.ai import VideoPipeline
from app.config import settings
from app.database import async_session_maker
from app.services.snippet_service import create_violation_snippets

logger = logging.getLogger(__name__)


async def process_video_background(video_id: int, video_path: str):
    """
    Process a video in the background.
    Creates its own database session to avoid concurrency issues.
    """
    # Create a fresh session for this background task
    async with async_session_maker() as db:
        try:
            # Get the video record
            result = await db.execute(select(Video).where(Video.id == video_id))
            video = result.scalar_one_or_none()
            
            if not video:
                logger.error(f"Video {video_id} not found")
                return
            
            # Update status to processing
            video.status = "processing"
            video.processing_progress = 0.0
            await db.commit()
            
            # Create and run the pipeline
            pipeline = VideoPipeline()
            
            # Store progress in a variable (don't update DB on every frame)
            current_progress = 0.0
            last_saved_progress = 0.0
            
            def progress_callback(progress: float):
                nonlocal current_progress
                current_progress = progress
            
            # Process video synchronously (the pipeline handles frames)
            loop = asyncio.get_event_loop()
            processing_result = await loop.run_in_executor(
                None, 
                lambda: pipeline.process_video_sync(video_path, progress_callback)
            )
            
            if processing_result is None:
                raise Exception("Video processing returned no results")
            
            # Refresh video object after processing
            await db.refresh(video)
            
            # Save results to database
            await save_processing_results(db, video, processing_result)
            
            # Update video status to completed
            video.status = "completed"
            video.processing_progress = 100.0
            
            # Save annotated video path (convert to URL path)
            if processing_result.annotated_video_path:
                # Get just the filename part and create URL path
                import os
                annotated_filename = os.path.basename(processing_result.annotated_video_path)
                video.annotated_video_path = f"/uploads/{annotated_filename}"
            
            await db.commit()
            
            # Snippet creation disabled (requires ffmpeg)
            # try:
            #     await create_violation_snippets(db, video.id, video_path)
            # except Exception as e:
            #     logger.warning(f"Failed to create snippets: {e}")
            
            logger.info(f"Successfully processed video {video_id}")
            
        except Exception as e:
            logger.error(f"Error processing video {video_id}: {e}")
            
            try:
                # Try to update status to failed
                result = await db.execute(select(Video).where(Video.id == video_id))
                video = result.scalar_one_or_none()
                if video:
                    video.status = "failed"
                    video.error_message = str(e)[:500]
                    await db.commit()
            except Exception as inner_e:
                logger.error(f"Failed to update video status: {inner_e}")


async def save_processing_results(
    db: AsyncSession, 
    video: Video, 
    result
):
    """Save processing results to the database."""
    
    # Create tracked individuals
    individual_map = {}  # track_id -> TrackedIndividual
    
    for profile in result.individual_profiles.values():
        individual = TrackedIndividual(
            video_id=video.id,
            track_id=profile.track_id,
            first_seen_frame=profile.first_seen_frame,
            last_seen_frame=profile.last_seen_frame,
            first_seen_time=profile.first_seen_time,
            last_seen_time=profile.last_seen_time,
            total_frames_tracked=profile.total_frames,
            total_violations=len(profile.violations),
            confirmed_violations=0,
            rejected_violations=0,
            risk_score=profile.risk_score
        )
        db.add(individual)
        await db.flush()
        individual_map[profile.track_id] = individual
    
    # Create violations - only for those with tracked individuals
    for violation_data in result.violations:
        track_id = violation_data.get("track_id")
        individual = individual_map.get(track_id) if track_id else None
        
        # Skip violations without an associated individual
        if individual is None:
            continue
        
        violation = Violation(
            individual_id=individual.id,
            violation_type=violation_data["type"],
            confidence=violation_data["confidence"],
            frame_number=violation_data["frame"],
            timestamp=violation_data["timestamp"],
            bbox_x1=violation_data["bbox"][0] if violation_data.get("bbox") else None,
            bbox_y1=violation_data["bbox"][1] if violation_data.get("bbox") else None,
            bbox_x2=violation_data["bbox"][2] if violation_data.get("bbox") else None,
            bbox_y2=violation_data["bbox"][3] if violation_data.get("bbox") else None,
            image_path=violation_data.get("image_path"),
            review_status="pending"
        )
        db.add(violation)
    
    # Update video stats
    video.total_individuals = len(individual_map)
    video.total_violations = len(result.violations)
    
    await db.commit()


def calculate_risk_score(
    total_violations: int, 
    confirmed_violations: int
) -> float:
    """Calculate a risk score for an individual based on violations."""
    if total_violations == 0:
        return 0.0
    
    # Base score from total violations
    base_score = min(total_violations / 10, 0.5)
    
    # Confirmation rate multiplier
    if confirmed_violations > 0:
        confirmation_rate = confirmed_violations / total_violations
        base_score += confirmation_rate * 0.5
    
    return min(base_score, 1.0)
