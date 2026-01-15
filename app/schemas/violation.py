"""
Violation schemas for API request/response validation.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ReviewStatus(str, Enum):
    """Review status enum."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class BoundingBox(BaseModel):
    """Bounding box schema."""
    x1: float
    y1: float
    x2: float
    y2: float


class ViolationBase(BaseModel):
    """Base violation schema."""
    violation_type: str
    confidence: float
    frame_number: int
    timestamp: float


class ViolationCreate(ViolationBase):
    """Schema for creating violations."""
    individual_id: int
    violation_class_id: Optional[int] = None
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None


class ViolationResponse(BaseModel):
    """Schema for violation responses."""
    id: int
    individual_id: int
    violation_type: str
    violation_class_id: Optional[int] = None
    confidence: float
    frame_number: int
    timestamp: float
    bbox: Optional[BoundingBox] = None
    image_path: Optional[str] = None  # Path to violation snapshot image
    snippet_path: Optional[str] = None
    snippet_start_time: Optional[float] = None
    snippet_end_time: Optional[float] = None
    review_status: str
    detected_at: datetime
    reviewed_at: Optional[datetime] = None
    
    # Related data
    video_id: Optional[int] = None
    track_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class ViolationListResponse(BaseModel):
    """Schema for paginated violation list."""
    items: List[ViolationResponse]
    total: int
    page: int
    page_size: int


class ViolationFilterParams(BaseModel):
    """Filter parameters for violations."""
    video_id: Optional[int] = None
    individual_id: Optional[int] = None
    violation_type: Optional[str] = None
    review_status: Optional[ReviewStatus] = None
    min_confidence: Optional[float] = None
