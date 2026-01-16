"""
Dashboard schemas for API request/response validation.
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class RecentEvent(BaseModel):
    """Recent violation event for the activity feed."""
    id: int
    person_id: int
    video_name: str
    violation_type: str
    confidence: float
    detected_at: datetime
    image_path: Optional[str] = None


class DashboardStats(BaseModel):
    """Overall dashboard statistics with compliance analytics."""
    total_videos: int
    total_individuals: int
    total_violations: int
    confirmed_violations: int
    rejected_violations: int
    pending_violations: int
    repeat_offenders_count: int
    videos_processing: int
    
    # Compliance rates
    compliance_rate: float = 0.0  # Percentage of compliant individuals
    violation_rate: float = 0.0   # Percentage of individuals with violations
    
    # Violation breakdown by type (PPE-wise)
    violations_by_type: dict[str, int] = {}
    
    # Shift-based analysis
    violations_by_shift: dict[str, int] = {}  # morning, evening, night
    
    # Confidence metrics
    avg_detection_confidence: float = 0.0
    low_confidence_count: int = 0  # Detections below 0.5 confidence
    
    # Recent activity
    recent_videos_count: int = 0  # Last 24 hours
    
    # Daily trends (last 7 days)
    daily_violations: List[dict] = []  # [{date: str, count: int}]
    
    # Recent events feed
    recent_events: List[RecentEvent] = []

    # New Analytics
    correlation_data: List[dict] = []  # [{video_name, people_count, violation_count}]
    ppe_trends: List[dict] = []        # [{date, "Missing Helmet": int...}]


class RepeatOffender(BaseModel):
    """Repeat offender summary."""
    individual_id: int
    video_id: int
    track_id: int
    video_name: Optional[str] = None
    total_violations: int
    confirmed_violations: int
    most_common_violation: Optional[str] = None
    risk_score: float
    snapshot_path: Optional[str] = None


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
