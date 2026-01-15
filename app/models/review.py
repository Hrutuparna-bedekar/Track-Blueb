"""
ViolationReview model for admin review records.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class ViolationReview(Base):
    """
    Model for admin violation reviews.
    
    Records the admin's decision on each violation:
    - Confirmation or rejection
    - Review notes
    - Timestamp
    """
    
    __tablename__ = "violation_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    violation_id = Column(Integer, ForeignKey("violations.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Review decision
    is_confirmed = Column(Boolean, nullable=False)
    
    # Admin notes
    notes = Column(Text, nullable=True)
    
    # Admin info (for audit trail)
    reviewed_by = Column(String(100), default="admin")  # Placeholder for multi-admin support
    
    # Timestamps
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    violation = relationship("Violation", back_populates="review")
    
    def __repr__(self):
        return f"<ViolationReview {self.id}: {'Confirmed' if self.is_confirmed else 'Rejected'}>"
