"""
Video schemas for API request/response validation.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ProcessingStatus(str, Enum):
    """Video processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoBase(BaseModel):
    """Base video schema."""
    original_filename: str


class VideoCreate(VideoBase):
    """Schema for video creation (internal use)."""
    filename: str
    file_path: str
    file_size: Optional[int] = None


class VideoResponse(BaseModel):
    """Schema for video responses."""
    id: int
    filename: str
    original_filename: str
    file_size: Optional[int] = None
    duration: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    status: str
    processing_progress: float
    error_message: Optional[str] = None
    annotated_video_path: Optional[str] = None  # Path to video with bounding boxes
    uploaded_at: datetime
    processed_at: Optional[datetime] = None
    
    # Computed fields
    total_individuals: Optional[int] = 0
    total_violations: Optional[int] = 0
    confirmed_violations: Optional[int] = 0
    
    class Config:
        from_attributes = True


class VideoListResponse(BaseModel):
    """Schema for paginated video list."""
    items: List[VideoResponse]
    total: int
    page: int
    page_size: int


class VideoStatusResponse(BaseModel):
    """Schema for video processing status check."""
    id: int
    status: str
    progress: float
    error_message: Optional[str] = None
    individuals_detected: int = 0
    violations_detected: int = 0
