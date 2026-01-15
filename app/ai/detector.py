"""
YOLO-based violation detector.

Uses Ultralytics YOLOv8 for detecting safety violations in video frames.
Filters detections to only track: helmet, goggles, face-mask, boots.
"""

from ultralytics import YOLO
import numpy as np
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Safety equipment to track (case-insensitive matching)
TRACKED_EQUIPMENT = {
    'helmet', 'hard hat', 'hardhat', 'no helmet', 'no_helmet', 'with helmet', 'without helmet',
    'goggles', 'glasses', 'safety glasses', 'eye protection', 'no goggles', 'no_goggles',
    'face mask', 'face-mask', 'facemask', 'mask', 'no mask', 'no_mask', 'with mask', 'without mask',
    'boots', 'boot', 'safety boots', 'safety shoes', 'no boots', 'no_boots',
    'person',  # Track persons to associate violations
}

# Violation keywords - detections containing these are violations
VIOLATION_KEYWORDS = {
    'no helmet': 'No Helmet',
    'no_helmet': 'No Helmet',
    'without helmet': 'No Helmet',
    'no goggles': 'No Goggles',
    'no_goggles': 'No Goggles',
    'no glasses': 'No Goggles',
    'no_glasses': 'No Goggles',
    'no mask': 'No Face Mask',
    'no_mask': 'No Face Mask',
    'no face mask': 'No Face Mask',
    'without mask': 'No Face Mask',
    'no boots': 'No Safety Boots',
    'no_boots': 'No Safety Boots',
    'no safety boots': 'No Safety Boots',
}


@dataclass
class Detection:
    """Represents a single detection from YOLO."""
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    is_violation: bool = True
    is_person: bool = False


class ViolationDetector:
    """
    YOLO-based detector for safety violations.
    
    Loads a trained YOLO model and performs inference on video frames
    to detect violations. Only tracks: helmet, goggles, face-mask, boots.
    """
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or settings.YOLO_MODEL_PATH
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD
        self.iou_threshold = settings.IOU_THRESHOLD
        self.model = None
        self.class_names = {}
        
        self._load_model()
    
    def _load_model(self):
        """Load the YOLO model."""
        try:
            self.model = YOLO(self.model_path)
            if hasattr(self.model, 'names'):
                self.class_names = self.model.names
            logger.info(f"Loaded YOLO model from {self.model_path}")
            logger.info(f"Model classes: {self.class_names}")
            
            # Log which classes will be tracked
            tracked = []
            for cls_id, cls_name in self.class_names.items():
                if self._should_track(cls_name):
                    tracked.append(f"{cls_id}:{cls_name}")
            logger.info(f"Will track classes: {tracked}")
            
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise
    
    def _should_track(self, class_name: str) -> bool:
        """Check if this class should be tracked."""
        class_lower = class_name.lower()
        
        for tracked in TRACKED_EQUIPMENT:
            if tracked in class_lower or class_lower in tracked:
                return True
        return False
    
    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Detect violations in a single frame.
        
        Only returns detections for: helmet, goggles, face-mask, boots, person.
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        results = self.model(
            frame,
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            verbose=False
        )
        
        detections = []
        
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
                
            for i in range(len(boxes)):
                xyxy = boxes.xyxy[i].cpu().numpy()
                x1, y1, x2, y2 = xyxy
                cls_id = int(boxes.cls[i].cpu().numpy())
                conf = float(boxes.conf[i].cpu().numpy())
                cls_name = self.class_names.get(cls_id, f"class_{cls_id}")
                
                # Only track relevant equipment
                if not self._should_track(cls_name):
                    continue
                
                # Determine if violation and violation type
                violation_type = self._map_to_violation(cls_id, cls_name)
                is_violation = violation_type is not None
                is_person = 'person' in cls_name.lower()
                
                detection = Detection(
                    class_id=cls_id,
                    class_name=violation_type or cls_name,
                    confidence=conf,
                    bbox=(float(x1), float(y1), float(x2), float(y2)),
                    is_violation=is_violation,
                    is_person=is_person
                )
                
                detections.append(detection)
        
        return detections
    
    def _map_to_violation(self, class_id: int, class_name: str) -> Optional[str]:
        """
        Map YOLO class to violation type.
        
        Returns violation type string or None if not a violation.
        """
        class_lower = class_name.lower()
        
        # Check violation keywords
        for keyword, violation_type in VIOLATION_KEYWORDS.items():
            if keyword in class_lower:
                return violation_type
        
        # Check configured violation classes
        if class_id in settings.VIOLATION_CLASSES:
            return settings.VIOLATION_CLASSES[class_id]
        
        # Not a violation (e.g., "with helmet", "person")
        return None
    
    def get_class_names(self) -> Dict[int, str]:
        """Get the mapping of class IDs to names."""
        return self.class_names.copy()
