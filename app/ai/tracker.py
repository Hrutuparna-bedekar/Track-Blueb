"""
Simple IOU-based person tracker.

Uses Intersection over Union (IOU) to track individuals across frames.
Much simpler than Deep SORT, better for single/few person scenarios.
"""

from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
import numpy as np
import logging

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class TrackedPerson:
    """Represents a tracked individual in the current frame."""
    track_id: int
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    confidence: float
    is_confirmed: bool = True
    
    # Tracking metadata
    first_frame: int = 0
    current_frame: int = 0
    missed_frames: int = 0
    
    # Associated violations in current frame
    violations: List[dict] = field(default_factory=list)


class PersonTracker:
    """
    Simple IOU-based person tracker.
    
    Uses bounding box overlap to maintain consistent IDs across frames.
    Much more stable than Deep SORT for single/few person scenarios.
    
    Privacy considerations:
    - Uses position tracking only - no appearance features
    - IDs are reset for each video (session-scoped)
    """
    
    def __init__(self):
        """Initialize the tracker."""
        self.tracks: Dict[int, TrackedPerson] = {}
        self.next_id = 1
        self.max_missed_frames = settings.MAX_AGE
        self.iou_threshold = 0.3  # Minimum IOU to consider same person
        self.current_frame = 0
        
        # Track history for metadata
        self.track_history: Dict[int, dict] = {}
        
        logger.info(
            f"Initialized IOU tracker (max_missed={self.max_missed_frames}, "
            f"iou_threshold={self.iou_threshold})"
        )
    
    def reset(self):
        """Reset the tracker for a new video."""
        self.tracks = {}
        self.next_id = 1
        self.current_frame = 0
        self.track_history = {}
        logger.info("Tracker reset for new video session")
    
    def update(
        self,
        frame: np.ndarray,
        detections: List[Tuple[List[float], float, str]],
        frame_number: int
    ) -> List[TrackedPerson]:
        """
        Update tracks with new detections.
        
        Args:
            frame: Current video frame (not used in IOU tracker).
            detections: List of (bbox, confidence, class_name) tuples.
            frame_number: Current frame number.
            
        Returns:
            List of TrackedPerson objects for all active tracks.
        """
        self.current_frame = frame_number
        
        # Extract person detections (filter for 'person' class if needed)
        person_detections = []
        for det in detections:
            bbox, conf, cls_name = det
            # Accept all detections as potential persons for tracking
            person_detections.append({
                'bbox': tuple(bbox),
                'confidence': conf,
                'class_name': cls_name
            })
        
        # Match detections to existing tracks
        matched, unmatched_detections, unmatched_tracks = self._match_detections(
            person_detections
        )
        
        # Update matched tracks
        for track_id, det_idx in matched:
            det = person_detections[det_idx]
            self.tracks[track_id].bbox = det['bbox']
            self.tracks[track_id].confidence = det['confidence']
            self.tracks[track_id].current_frame = frame_number
            self.tracks[track_id].missed_frames = 0
            
            # Update history
            self.track_history[track_id]['last_frame'] = frame_number
            self.track_history[track_id]['frame_count'] += 1
        
        # Create new tracks for unmatched detections
        for det_idx in unmatched_detections:
            det = person_detections[det_idx]
            track_id = self.next_id
            self.next_id += 1
            
            self.tracks[track_id] = TrackedPerson(
                track_id=track_id,
                bbox=det['bbox'],
                confidence=det['confidence'],
                first_frame=frame_number,
                current_frame=frame_number,
                missed_frames=0
            )
            
            self.track_history[track_id] = {
                'first_frame': frame_number,
                'last_frame': frame_number,
                'frame_count': 1
            }
            
            logger.info(f"New track created: Person-{track_id}")
        
        # Increment missed frames for unmatched tracks
        for track_id in unmatched_tracks:
            self.tracks[track_id].missed_frames += 1
        
        # Remove tracks that have been missing too long
        tracks_to_remove = [
            tid for tid, track in self.tracks.items()
            if track.missed_frames > self.max_missed_frames
        ]
        for tid in tracks_to_remove:
            logger.info(f"Track lost: Person-{tid} (missed {self.tracks[tid].missed_frames} frames)")
            del self.tracks[tid]
        
        # Return active tracks
        return [track for track in self.tracks.values() if track.missed_frames == 0]
    
    def _match_detections(
        self,
        detections: List[dict]
    ) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """
        Match detections to existing tracks using IOU.
        
        Returns:
            - matched: List of (track_id, detection_idx) pairs
            - unmatched_detections: List of detection indices without matches
            - unmatched_tracks: List of track IDs without matches
        """
        if not detections or not self.tracks:
            return [], list(range(len(detections))), list(self.tracks.keys())
        
        # Calculate IOU matrix
        track_ids = list(self.tracks.keys())
        iou_matrix = np.zeros((len(track_ids), len(detections)))
        
        for i, track_id in enumerate(track_ids):
            track_bbox = self.tracks[track_id].bbox
            for j, det in enumerate(detections):
                iou_matrix[i, j] = self._calculate_iou(track_bbox, det['bbox'])
        
        # Greedy matching (simple but effective)
        matched = []
        used_detections = set()
        used_tracks = set()
        
        # Sort by IOU and match greedily
        while True:
            if iou_matrix.size == 0:
                break
                
            max_iou = iou_matrix.max()
            if max_iou < self.iou_threshold:
                break
            
            max_idx = np.unravel_index(iou_matrix.argmax(), iou_matrix.shape)
            track_idx, det_idx = max_idx
            
            track_id = track_ids[track_idx]
            matched.append((track_id, det_idx))
            used_tracks.add(track_id)
            used_detections.add(det_idx)
            
            # Zero out this row and column
            iou_matrix[track_idx, :] = 0
            iou_matrix[:, det_idx] = 0
        
        unmatched_detections = [i for i in range(len(detections)) if i not in used_detections]
        unmatched_tracks = [tid for tid in track_ids if tid not in used_tracks]
        
        return matched, unmatched_detections, unmatched_tracks
    
    def _calculate_iou(
        self,
        box1: Tuple[float, float, float, float],
        box2: Tuple[float, float, float, float]
    ) -> float:
        """Calculate Intersection over Union between two boxes."""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        
        union = area1 + area2 - intersection
        
        if union <= 0:
            return 0.0
        
        return intersection / union
    
    def get_track_info(self, track_id: int) -> Optional[dict]:
        """Get tracking information for a specific ID."""
        return self.track_history.get(track_id)
    
    def get_all_tracks(self) -> Dict[int, dict]:
        """Get all track histories."""
        return self.track_history.copy()
    
    def associate_violation_to_track(
        self,
        violation_bbox: Tuple[float, float, float, float],
        tracked_persons: List[TrackedPerson],
        iou_threshold: float = 0.2
    ) -> Optional[int]:
        """
        Associate a violation detection with a tracked person.
        
        Uses IoU to match violation bounding box to tracked person bounding boxes.
        """
        best_match_id = None
        best_iou = iou_threshold
        
        for person in tracked_persons:
            iou = self._calculate_iou(violation_bbox, person.bbox)
            if iou > best_iou:
                best_iou = iou
                best_match_id = person.track_id
        
        return best_match_id
