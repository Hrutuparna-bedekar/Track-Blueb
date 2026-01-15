"""
Dashboard schemas for API request/response validation.
"""

from pydantic import BaseModel
from typing import List, Optional


class DashboardStats(BaseModel):
    """Overall dashboard statistics."""
    total_videos: int
    total_individuals: int
    total_violations: int
    confirmed_violations: int
    rejected_violations: int
    pending_violations: int
    repeat_offenders_count: int
    videos_processing: int
    
    # Violation breakdown by type
    violations_by_type: dict[str, int] = {}
    
    # Recent activity
    recent_videos_count: int = 0  # Last 24 hours


class RepeatOffender(BaseModel):
    """Repeat offender summary."""
    individual_id: int
    video_id: int
    track_id: int
    total_violations: int
    confirmed_violations: int
    most_common_violation: Optional[str] = None
    risk_score: float


class RepeatOffendersResponse(BaseModel):
    """Response for repeat offenders endpoint."""
    offenders: List[RepeatOffender]
    total: int
    threshold: int  # Min violations to be considered repeat offender


class ViolationTrend(BaseModel):
    """Violation trend data point."""
    date: str
    count: int
    confirmed: int
    rejected: int


class TrendsResponse(BaseModel):
    """Response for trends endpoint."""
    daily_violations: List[ViolationTrend]
    by_type: dict[str, int]
    by_video: List[dict]
