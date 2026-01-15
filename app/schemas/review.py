"""
Review schemas for API request/response validation.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ReviewCreate(BaseModel):
    """Schema for creating a review."""
    is_confirmed: bool
    notes: Optional[str] = None


class ReviewResponse(BaseModel):
    """Schema for review responses."""
    id: int
    violation_id: int
    is_confirmed: bool
    notes: Optional[str] = None
    reviewed_by: str
    reviewed_at: datetime
    
    class Config:
        from_attributes = True


class BulkReviewRequest(BaseModel):
    """Schema for bulk review operations."""
    violation_ids: list[int]
    is_confirmed: bool
    notes: Optional[str] = None
