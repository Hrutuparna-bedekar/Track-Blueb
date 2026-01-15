"""
Violation model for detected safety violations.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class ReviewStatus(str, enum.Enum):
    """Violation review status."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class Violation(Base):
    """
    Model for detected violations.
    
    Each violation is:
    - Timestamped
    - Linked to a tracked individual
    - Subject to admin review
    """
    
    __tablename__ = "violations"
    
    id = Column(Integer, primary_key=True, index=True)
    individual_id = Column(Integer, ForeignKey("tracked_individuals.id", ondelete="CASCADE"), nullable=False)
    
    # Violation details
    violation_type = Column(String(100), nullable=False)
    violation_class_id = Column(Integer)
    confidence = Column(Float)  # Detection confidence 0-1
    
    # Location in video
    frame_number = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)  # Seconds from start
    
    # Bounding box (for visualization)
    bbox_x1 = Column(Float)
    bbox_y1 = Column(Float)
    bbox_x2 = Column(Float)
    bbox_y2 = Column(Float)
    
    # Violation image snapshot for admin review
    image_path = Column(String(500), nullable=True)
    
    # Video snippet
    snippet_path = Column(String(500), nullable=True)
    snippet_start_time = Column(Float, nullable=True)
    snippet_end_time = Column(Float, nullable=True)
    
    # Review status
    review_status = Column(String(50), default=ReviewStatus.PENDING.value)
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Relationships
    individual = relationship("TrackedIndividual", back_populates="violations")
    review = relationship("ViolationReview", back_populates="violation", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Violation {self.id}: {self.violation_type} at {self.timestamp}s>"
