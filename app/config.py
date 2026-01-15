"""
Application configuration settings.
"""

from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Literal


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./violation_tracking.db"
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    SNIPPETS_DIR: str = "snippets"
    VIOLATIONS_IMG_DIR: str = "violation_images"  # Screenshots of violations
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    ALLOWED_EXTENSIONS: list = [".mp4", ".avi", ".mov", ".mkv"]
    
    # AI Pipeline - Detection
    YOLO_MODEL_PATH: str = "ppe_model.pt"
    CONFIDENCE_THRESHOLD: float = 0.75 # Detection confidence (lower = more detections)
    IOU_THRESHOLD: float = 0.1  # Non-max suppression IOU threshold
    
    # Violation Display Threshold
    # Only violations with confidence >= this value will be saved/displayed
    # Set to 0.0 to show all violations, set higher (e.g., 0.85) to show only confident ones
    VIOLATION_DISPLAY_THRESHOLD: float = 0.6  # 0.0 = show all, 0.85 = show high confidence only
    
    # Person Tracking Method
    # "iou" = Custom IOU-based tracking (position overlap) - more robust to appearance changes
    # "cosine" = Deep SORT cosine distance (appearance similarity) - better for re-identification
    TRACKING_METHOD: Literal["iou", "cosine"] = "iou"
    
    # IOU Tracking Settings (when TRACKING_METHOD = "iou")
    # Lower threshold = more lenient matching (person can move more between frames)
    # Higher max_frames_missing = keep track alive longer during occlusions/PPE changes
    IOU_TRACKING_THRESHOLD: float = 0.15  # Lower: tolerates more movement between frames
    IOU_MAX_FRAMES_MISSING: int = 60  # Keep track alive for 2 seconds at 30fps
    
    # Deep SORT Configuration (when TRACKING_METHOD = "cosine")
    MAX_AGE: int = 150  # Keep track alive this many frames without detection
    N_INIT: int = 2     # Frames to confirm new track
    MAX_COSINE_DISTANCE: float = 0.8 # Max distance to consider same person (0-1)
    
    # Detection Interval
    # Time-based detection: run detection every N seconds (independent of frame rate)
    # Set to 0 to use FRAME_SKIP instead
    DETECTION_INTERVAL_SECONDS: float = 0.0  # 0 = disabled, use FRAME_SKIP instead
    
    # Frame-based detection (used when DETECTION_INTERVAL_SECONDS = 0)
    FRAME_SKIP: int = 6  # Process every Nth frame
    
    # Video Processing
    SNIPPET_DURATION: int = 5  # Seconds before/after violation for snippet
    
    # Violation Types (map class IDs to violation names)
    VIOLATION_CLASSES: dict = {
        0: "No Helmet",
        1: "No Safety Vest", 
        2: "No Gloves",
        3: "No Safety Boots",
        4: "Restricted Zone Entry"
    }
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

