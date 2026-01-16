"""
Video model for uploaded video metadata.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class ProcessingStatus(str, enum.Enum):
    """Video processing status states."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Shift(str, enum.Enum):
    """Time-of-day shifts for video recording."""
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"


class Video(Base):
    """Model for uploaded video files."""
    
    __tablename__ = "videos"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)  # Size in bytes
    duration = Column(Float)  # Duration in seconds
    fps = Column(Float)  # Frames per second
    width = Column(Integer)
    height = Column(Integer)
    
    # Processing status
    status = Column(String(50), default=ProcessingStatus.PENDING.value)
    processing_progress = Column(Float, default=0.0)  # 0-100
    error_message = Column(String(1000), nullable=True)
    annotated_video_path = Column(String(500), nullable=True)  # Path to video with bounding boxes
    
    # Processing results
    total_individuals = Column(Integer, default=0)
    total_violations = Column(Integer, default=0)
    
    # Time-of-day shift when video was recorded
    shift = Column(String(50), nullable=True)  # morning, evening, night
    
    # Source of the video: 'upload' for uploaded videos, 'webcam' for webcam recordings
    source = Column(String(50), default="upload")  # upload, webcam
    
    # Review status - video must be reviewed before appearing in search
    is_reviewed = Column(Integer, default=0)  # 0 = not reviewed, 1 = reviewed
    reviewed_at = Column(DateTime, nullable=True)
    
    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.now)
    processed_at = Column(DateTime, nullable=True)
    
    # Relationships
    individuals = relationship("TrackedIndividual", back_populates="video", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Video {self.id}: {self.original_filename}>"
