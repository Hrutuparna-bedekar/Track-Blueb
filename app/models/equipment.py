"""
PPE Equipment model for detected equipment.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class PPEEquipment(Base):
    """Model for detected PPE equipment."""
    
    __tablename__ = "ppe_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    
    # Equipment details
    equipment_type = Column(String(100), nullable=False)  # helmet, glasses, mask, shoes
    confidence = Column(Float, nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)  # Time in video (seconds)
    
    # Bounding box
    bbox_x1 = Column(Float)
    bbox_y1 = Column(Float)
    bbox_x2 = Column(Float)
    bbox_y2 = Column(Float)
    
    # Image path (snapshot)
    image_path = Column(String(500), nullable=True)
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    video = relationship("Video", backref="equipment")
    
    def __repr__(self):
        return f"<PPEEquipment {self.id}: {self.equipment_type} in Video {self.video_id}>"
