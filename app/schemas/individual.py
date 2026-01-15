"""
Individual tracking schemas for API request/response validation.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class IndividualBase(BaseModel):
    """Base individual schema."""
    track_id: int
    video_id: int


class IndividualResponse(BaseModel):
    """Schema for individual responses."""
    id: int
    video_id: int
    track_id: int
    first_seen_frame: Optional[int] = None
    last_seen_frame: Optional[int] = None
    first_seen_time: Optional[float] = None
    last_seen_time: Optional[float] = None
    total_frames_tracked: int = 0
    total_violations: int = 0
    confirmed_violations: int = 0
    rejected_violations: int = 0
    pending_violations: int = 0
    risk_score: float = 0.0
    created_at: datetime
    
    class Config:
        from_attributes = True


class IndividualDetailResponse(IndividualResponse):
    """Detailed individual response with violations."""
    violations: List["ViolationSummary"] = []


class ViolationSummary(BaseModel):
    """Brief violation info for individual details."""
    id: int
    violation_type: str
    timestamp: float
    confidence: float
    review_status: str


class IndividualListResponse(BaseModel):
    """Schema for paginated individual list."""
    items: List[IndividualResponse]
    total: int
    video_id: int


class IndividualPatternAnalysis(BaseModel):
    """Pattern analysis for an individual."""
    individual_id: int
    track_id: int
    violation_frequency: float  # Violations per minute
    most_common_violation: Optional[str] = None
    is_repeat_offender: bool = False
    risk_level: str = "low"  # low, medium, high
    violation_timeline: List[dict] = []


# Fix forward reference
IndividualDetailResponse.model_rebuild()
