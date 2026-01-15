"""
Video snippet extraction service.

Creates short video clips around violation timestamps for admin review.
"""

import asyncio
import os
import logging
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.violation import Violation
from app.models.individual import TrackedIndividual
from app.config import settings

logger = logging.getLogger(__name__)


async def create_violation_snippets(
    db: AsyncSession,
    video_id: int,
    video_path: str,
    duration_before: float = 2.0,
    duration_after: float = 3.0
):
    """
    Create video snippets for all violations in a video.
    
    Args:
        db: Database session.
        video_id: Video ID.
        video_path: Path to source video.
        duration_before: Seconds before violation to include.
        duration_after: Seconds after violation to include.
    """
    # Get all violations for this video
    result = await db.execute(
        select(Violation)
        .join(TrackedIndividual)
        .where(TrackedIndividual.video_id == video_id)
    )
    violations = result.scalars().all()
    
    if not violations:
        logger.info(f"No violations found for video {video_id}")
        return
    
    # Ensure snippets directory exists
    os.makedirs(settings.SNIPPETS_DIR, exist_ok=True)
    
    for violation in violations:
        try:
            output_filename = f"violation_{violation.id}.mp4"
            output_path = os.path.join(settings.SNIPPETS_DIR, output_filename)
            
            success = await extract_snippet(
                video_path=video_path,
                output_path=output_path,
                timestamp=violation.timestamp,
                duration_before=duration_before,
                duration_after=duration_after
            )
            
            if success:
                violation.snippet_path = output_path
                violation.snippet_start_time = max(0, violation.timestamp - duration_before)
                violation.snippet_end_time = violation.timestamp + duration_after
                
                logger.debug(f"Created snippet for violation {violation.id}")
            else:
                logger.warning(f"Failed to create snippet for violation {violation.id}")
                
        except Exception as e:
            logger.error(f"Error creating snippet for violation {violation.id}: {e}")
    
    await db.commit()
    logger.info(f"Created snippets for {len(violations)} violations from video {video_id}")


async def extract_snippet(
    video_path: str,
    output_path: str,
    timestamp: float,
    duration_before: float = 2.0,
    duration_after: float = 3.0
) -> bool:
    """
    Extract a video snippet around a timestamp.
    
    Uses ffmpeg for efficient video cutting.
    
    Args:
        video_path: Path to source video.
        output_path: Path for output snippet.
        timestamp: Center timestamp in seconds.
        duration_before: Seconds before timestamp.
        duration_after: Seconds after timestamp.
        
    Returns:
        True if extraction succeeded.
    """
    try:
        start_time = max(0, timestamp - duration_before)
        total_duration = duration_before + duration_after
        
        # Build ffmpeg command
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(start_time),
            '-i', video_path,
            '-t', str(total_duration),
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '28',
            '-c:a', 'aac',
            '-b:a', '96k',
            '-movflags', '+faststart',
            output_path
        ]
        
        # Run ffmpeg
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"ffmpeg error: {stderr.decode()}")
            return False
        
        return os.path.exists(output_path)
        
    except FileNotFoundError:
        logger.warning("ffmpeg not found. Snippets will not be created.")
        return False
    except Exception as e:
        logger.error(f"Error extracting snippet: {e}")
        return False


async def delete_snippets_for_video(video_id: int, db: AsyncSession):
    """
    Delete all snippets associated with a video.
    
    Args:
        video_id: Video ID.
        db: Database session.
    """
    result = await db.execute(
        select(Violation)
        .join(TrackedIndividual)
        .where(TrackedIndividual.video_id == video_id)
    )
    violations = result.scalars().all()
    
    for violation in violations:
        if violation.snippet_path and os.path.exists(violation.snippet_path):
            try:
                os.remove(violation.snippet_path)
            except Exception as e:
                logger.warning(f"Failed to delete snippet {violation.snippet_path}: {e}")
