"""
Video processing pipeline with YOLO built-in tracking.

Uses YOLO's native tracking (BoTSORT or ByteTrack) for maximum performance:
- GPU-accelerated tracking
- Single pass detection + tracking
- Minimal latency
- Browser-compatible video output
"""

import cv2
import numpy as np
from typing import Optional, Callable, Dict, List, Tuple
import os
import uuid
import logging
import subprocess
import shutil
from dataclasses import dataclass

from ultralytics import YOLO

from app.ai.aggregator import ViolationAggregator, ViolationRecord
from app.config import settings

logger = logging.getLogger(__name__)

VIOLATION_CAPTURE_COOLDOWN = 2.0

# Body part detections that indicate missing PPE
# If we detect these body parts, it means the person is NOT wearing the required PPE
BODY_PART_VIOLATIONS = {
    'head': 'No Helmet',      # head visible = no helmet
    'face': 'No Face Mask',   # face visible = no face mask  
    'foot': 'No Safety Boots', # foot visible = no boots
    'eyes': 'No Goggles',     # eyes visible = no goggles/glasses
    'eye': 'No Goggles',      # eye visible = no goggles/glasses
}

# PPE equipment classes that indicate COMPLIANCE (wearing PPE)
# If we detect these, the person IS wearing PPE (not a violation)
PPE_EQUIPMENT = ['helmet', 'face-mask', 'facemask', 'mask', 'glasses', 'goggles', 
                 'shoes', 'boots', 'safety-glasses', 'safety-vest', 'gloves']

# Mapping from violation types to PPE equipment that would prevent the violation
# If a person is detected wearing any of these PPE items, skip the corresponding violation
VIOLATION_TO_PPE = {
    'No Helmet': ['helmet'],
    'No Face Mask': ['face-mask', 'facemask', 'mask'],
    'No Safety Boots': ['shoes', 'boots'],
    'No Goggles': ['glasses', 'goggles', 'safety-glasses', 'safety glasses', 'eye protection']
}


class PersonTracker:
    """
    Custom person tracker using IOU-based matching.
    
    Maintains consistent person IDs by matching new detections to existing tracks
    based on bounding box overlap (IOU). This is more robust than relying solely
    on ByteTrack which can lose track when appearance changes.
    """
    
    def __init__(self, iou_threshold: float = 0.3, max_frames_missing: int = 30):
        self.tracks = {}  # track_id -> {'bbox': (x1,y1,x2,y2), 'last_seen': frame_num}
        self.next_id = 1
        self.iou_threshold = iou_threshold
        self.max_frames_missing = max_frames_missing
    
    def reset(self):
        """Reset tracker for new video."""
        self.tracks = {}
        self.next_id = 1
    
    def _compute_iou(self, box1: tuple, box2: tuple) -> float:
        """Compute Intersection over Union between two boxes."""
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        # Intersection
        xi1 = max(x1_1, x1_2)
        yi1 = max(y1_1, y1_2)
        xi2 = min(x2_1, x2_2)
        yi2 = min(y2_1, y2_2)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        inter_area = (xi2 - xi1) * (yi2 - yi1)
        
        # Union
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union_area = area1 + area2 - inter_area
        
        return inter_area / union_area if union_area > 0 else 0.0
    
    def _compute_center_distance(self, box1: tuple, box2: tuple) -> float:
        """Compute distance between centers of two boxes."""
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        cx1, cy1 = (x1_1 + x2_1) / 2, (y1_1 + y2_1) / 2
        cx2, cy2 = (x1_2 + x2_2) / 2, (y1_2 + y2_2) / 2
        
        return ((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2) ** 0.5
    
    def update(self, detections: list, frame_num: int) -> list:
        """
        Update tracks with new detections.
        
        Uses IOU matching first, then falls back to center-distance matching
        to handle cases where bbox changes significantly (e.g., PPE transitions).
        
        Args:
            detections: List of (bbox, conf) tuples for detected persons
            frame_num: Current frame number
            
        Returns:
            List of (bbox, track_id, conf) with assigned track IDs
        """
        # Remove stale tracks
        stale_ids = [tid for tid, data in self.tracks.items() 
                     if frame_num - data['last_seen'] > self.max_frames_missing]
        for tid in stale_ids:
            del self.tracks[tid]
        
        results = []
        matched_tracks = set()
        
        for bbox, conf in detections:
            best_track_id = None
            best_score = 0  # Higher is better
            
            # Try IOU matching first
            for track_id, track_data in self.tracks.items():
                if track_id in matched_tracks:
                    continue
                iou = self._compute_iou(bbox, track_data['bbox'])
                if iou >= self.iou_threshold and iou > best_score:
                    best_score = iou
                    best_track_id = track_id
            
            # Fallback: center-distance matching if IOU didn't match
            # Person's center should be within 150 pixels to be considered same person
            if best_track_id is None:
                CENTER_DISTANCE_THRESHOLD = 150  # pixels
                for track_id, track_data in self.tracks.items():
                    if track_id in matched_tracks:
                        continue
                    dist = self._compute_center_distance(bbox, track_data['bbox'])
                    # Convert distance to a score (inverse, closer = higher)
                    if dist < CENTER_DISTANCE_THRESHOLD:
                        score = 1 - (dist / CENTER_DISTANCE_THRESHOLD)
                        if score > best_score:
                            best_score = score
                            best_track_id = track_id
            
            if best_track_id is not None:
                # Update existing track
                self.tracks[best_track_id] = {'bbox': bbox, 'last_seen': frame_num}
                matched_tracks.add(best_track_id)
                results.append((bbox, best_track_id, conf))
            else:
                # Create new track
                new_id = self.next_id
                self.next_id += 1
                self.tracks[new_id] = {'bbox': bbox, 'last_seen': frame_num}
                results.append((bbox, new_id, conf))
        
        return results


@dataclass
class ProcessingResultSimple:
    """Processing result."""
    success: bool
    total_frames: int
    processed_frames: int
    fps: float
    duration: float
    width: int
    height: int
    individual_profiles: dict
    violations: list
    person_worn_ppe: dict = None  # track_id -> set of PPE items worn
    annotated_video_path: str = None
    error_message: Optional[str] = None


class VideoPipeline:
    """
    Pipeline using YOLO detection with configurable person tracking.
    
    Supports two tracking methods (configurable in config.py):
    - IOU: Position-based overlap matching (robust to appearance changes)
    - Cosine: Appearance-based matching (better re-identification)
    """
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or settings.YOLO_MODEL_PATH
        self.model = YOLO(self.model_path)
        self.aggregator = ViolationAggregator()
        
        # Tracking method from config
        self.tracking_method = settings.TRACKING_METHOD
        
        # Custom person tracker for consistent IDs (used when tracking_method = "iou")
        self.person_tracker = PersonTracker(
            iou_threshold=settings.IOU_TRACKING_THRESHOLD,
            max_frames_missing=settings.IOU_MAX_FRAMES_MISSING
        )
        
        # Detection interval calculation
        # If DETECTION_INTERVAL_SECONDS > 0, calculate frame_skip based on video fps
        # Otherwise, use FRAME_SKIP directly
        self.detection_interval_seconds = settings.DETECTION_INTERVAL_SECONDS
        self.frame_skip = settings.FRAME_SKIP
        
        self.is_processing = False
        self.progress = 0.0
        
        # Track metadata
        self.track_first_seen: Dict[int, int] = {}
        
        # Track which (track_id, vtype) pairs have been captured (one snapshot per person per violation type)
        self.captured_violations: set = set()
        
        # Track PPE worn by each person (track_id -> set of PPE types)
        # If PPE is detected, corresponding violations are skipped
        self.person_worn_ppe: Dict[int, set] = {}
        
        # Detected PPE equipment for the equipment tab
        self.detected_equipment: List[dict] = []
        
        # Violation display threshold
        self.violation_display_threshold = settings.VIOLATION_DISPLAY_THRESHOLD
        
        # Get model classes
        self.class_names = self.model.names if hasattr(self.model, 'names') else {}
        
        logger.info(f"Pipeline with custom person tracking initialized")
        logger.info(f"Model classes: {self.class_names}")
    
    def reset(self):
        """Reset for new video."""
        self.aggregator.reset()
        self.person_tracker.reset()
        self.is_processing = False
        self.progress = 0.0
        self.track_first_seen = {}
        self.captured_violations = set()
        self.person_worn_ppe = {}
        self.detected_equipment = []
        # Reset model
        self.model = YOLO(self.model_path)
    
    def _is_violation(self, class_name: str) -> Tuple[bool, str]:
        """
        Check if a detected class indicates a violation.
        
        Body parts visible = missing PPE = violation
        Only checks for: helmet (head), face-mask (face), boots (foot)
        """
        class_lower = class_name.lower()
        
        # Check if it's a body part that indicates missing PPE
        for body_part, violation_type in BODY_PART_VIOLATIONS.items():
            if body_part == class_lower:
                return True, violation_type
        
        # Not a violation
        return False, class_name
    
    def _is_ppe_equipment(self, class_name: str) -> bool:
        """Check if class is PPE equipment (indicates compliance)."""
        class_lower = class_name.lower()
        return any(ppe in class_lower or class_lower in ppe for ppe in PPE_EQUIPMENT)
    
    def _can_capture(self, track_id: int, vtype: str, ts: float) -> bool:
        """Check if we should capture - only one snapshot per person per violation type."""
        key = (track_id, vtype)
        if key in self.captured_violations:
            return False  # Already captured this violation type for this person
        self.captured_violations.add(key)
        return True
    
    def _should_skip_violation(self, track_id: int, violation_type: str) -> bool:
        """
        Check if violation should be skipped because person has worn corresponding PPE.
        
        If a person is detected wearing PPE at any point, they don't get violations
        for that missing PPE type.
        """
        worn_ppe = self.person_worn_ppe.get(track_id, set())
        required_ppe = VIOLATION_TO_PPE.get(violation_type, [])
        
        # If person has worn any of the PPE that would prevent this violation, skip it
        for ppe in required_ppe:
            # Case-insensitive check
            for worn_item in worn_ppe:
                if ppe in worn_item or worn_item in ppe:
                    logger.debug(f"Skipping {violation_type} for Person-{track_id}: detected wearing {worn_item}")
                    return True
        return False
    
    def _record_person_ppe(self, track_id: int, ppe_type: str):
        """Record that a person has been detected wearing a specific PPE item."""
        if track_id not in self.person_worn_ppe:
            self.person_worn_ppe[track_id] = set()
        
        ppe_lower = ppe_type.lower()
        if ppe_lower not in self.person_worn_ppe[track_id]:
            self.person_worn_ppe[track_id].add(ppe_lower)
            logger.info(f"PPE Detected: Person-{track_id} wearing {ppe_type}")
    
    def _convert_to_browser_compatible(self, input_path: str, output_path: str) -> bool:
        """Convert video to browser-compatible format using ffmpeg."""
        try:
            # Check if ffmpeg is available
            if not shutil.which('ffmpeg'):
                logger.warning("ffmpeg not found, video may not play in browser")
                return False
            
            cmd = [
                'ffmpeg', '-y',
                '-i', input_path,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                output_path
            ]
            
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except Exception as e:
            logger.error(f"ffmpeg conversion failed: {e}")
            return False
    
    def process_video_sync(
        self,
        video_path: str,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> ProcessingResultSimple:
        """Process video with YOLO native tracking."""
        self.reset()
        self.is_processing = True
        
        logger.info(f"Processing with YOLO native tracking: {video_path}")
        
        video_id = uuid.uuid4().hex[:8]
        temp_output = os.path.join(settings.UPLOAD_DIR, f"temp_{video_id}.mp4")
        final_output = os.path.join(settings.UPLOAD_DIR, f"annotated_{video_id}.mp4")
        
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise ValueError(f"Cannot open: {video_path}")
            
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = total_frames / fps if fps > 0 else 0
            
            logger.info(f"Video: {total_frames} frames, {fps:.1f} FPS, {width}x{height}")
            
            # Try H264 codec first (browser compatible), fall back to mp4v
            codecs_to_try = [
                ('avc1', '.mp4'),   # H.264
                ('H264', '.mp4'),   # H.264 alternative
                ('X264', '.mp4'),   # x264
                ('mp4v', '.mp4'),   # MPEG-4 (fallback)
            ]
            
            out = None
            for codec, ext in codecs_to_try:
                try:
                    fourcc = cv2.VideoWriter_fourcc(*codec)
                    test_path = os.path.join(settings.UPLOAD_DIR, f"annotated_{video_id}{ext}")
                    out = cv2.VideoWriter(test_path, fourcc, fps, (width, height))
                    if out.isOpened():
                        final_output = test_path
                        logger.info(f"Using codec: {codec}")
                        break
                    out.release()
                except:
                    continue
            
            if out is None or not out.isOpened():
                # Last resort
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                final_output = os.path.join(settings.UPLOAD_DIR, f"annotated_{video_id}.mp4")
                out = cv2.VideoWriter(final_output, fourcc, fps, (width, height))
                logger.warning("Using mp4v codec - video may not play in browser")
            
            self.aggregator.fps = fps
            
            # Calculate effective frame skip
            # If DETECTION_INTERVAL_SECONDS > 0, calculate based on fps
            # Otherwise, use FRAME_SKIP directly
            if self.detection_interval_seconds > 0:
                effective_frame_skip = max(1, int(fps * self.detection_interval_seconds))
                logger.info(f"Using time-based detection: every {self.detection_interval_seconds}s = every {effective_frame_skip} frames")
            else:
                effective_frame_skip = self.frame_skip
                logger.info(f"Using frame-based detection: every {effective_frame_skip} frames")
            
            frame_num = 0
            processed = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                if frame_num % effective_frame_skip == 0:
                    annotated = self._process_frame_with_tracking(
                        frame, frame_num, video_id, fps
                    )
                    processed += 1
                    self.progress = (frame_num / total_frames) * 100
                    if progress_callback:
                        try:
                            progress_callback(self.progress)
                        except:
                            pass
                else:
                    # For skipped frames, just add the last frame's annotations
                    annotated = frame
                
                out.write(annotated)
                frame_num += 1
            
            cap.release()
            out.release()
            
            # Set annotated path
            annotated_path = final_output
            
            # Build results
            profiles = self.aggregator.get_all_profiles()
            violations = []
            for p in profiles.values():
                for v in p.violations:
                    violations.append({
                        "track_id": p.track_id,
                        "person_name": f"Person-{p.track_id}",
                        "type": v.violation_type,
                        "confidence": v.confidence,
                        "frame": v.frame_number,
                        "timestamp": v.timestamp,
                        "bbox": v.bbox,
                        "image_path": v.image_path
                    })
            
            logger.info(f"Complete: {len(violations)} violations, {len(profiles)} persons")
            
            for tid, profile in profiles.items():
                if profile.violation_count > 0:
                    types_str = ', '.join(f'{t}:{c}' for t, c in profile.violation_types.items())
                    logger.info(f"Person-{tid}: {profile.violation_count} violations ({types_str})")
            
            return ProcessingResultSimple(
                success=True, total_frames=total_frames, processed_frames=processed,
                fps=fps, duration=duration, width=width, height=height,
                individual_profiles={tid: p for tid, p in profiles.items()},
                violations=violations, 
                person_worn_ppe=self.person_worn_ppe.copy(),
                annotated_video_path=annotated_path
            )
            
        except Exception as e:
            logger.error(f"Error: {e}")
            import traceback
            traceback.print_exc()
            return ProcessingResultSimple(
                success=False, total_frames=0, processed_frames=0,
                fps=0, duration=0, width=0, height=0,
                individual_profiles={}, violations=[], error_message=str(e)
            )
        finally:
            self.is_processing = False
    
    def _process_frame_with_tracking(
        self, frame: np.ndarray, frame_num: int, video_id: str, fps: float
    ) -> np.ndarray:
        """
        Process frame with custom IOU-based person tracking.
        
        1. Detect all objects using YOLO
        2. Use custom PersonTracker for consistent person IDs
        3. Associate violations with nearest tracked person
        4. Record detected PPE equipment
        """
        timestamp = frame_num / fps
        
        # Run YOLO detection (not tracking - we use our own tracker)
        results = self.model.predict(
            frame,
            conf=settings.CONFIDENCE_THRESHOLD,
            iou=settings.IOU_THRESHOLD,
            verbose=False
        )
        
        annotated = frame.copy()
        
        if not results or len(results) == 0:
            return annotated
        
        result = results[0]
        boxes = result.boxes
        
        if boxes is None or len(boxes) == 0:
            return annotated
        
        # Collect raw detections
        person_detections = []  # List of (bbox, conf) for PersonTracker
        violations = []  # List of (bbox, vtype, conf)
        ppe_items = []  # List of (bbox, cls_name, conf)
        
        for i in range(len(boxes)):
            xyxy = boxes.xyxy[i].cpu().numpy()
            x1, y1, x2, y2 = [int(c) for c in xyxy]
            conf = float(boxes.conf[i].cpu().numpy())
            cls_id = int(boxes.cls[i].cpu().numpy())
            cls_name = self.class_names.get(cls_id, f"class_{cls_id}")
            bbox = (x1, y1, x2, y2)
            
            if cls_name.lower() == 'person':
                person_detections.append((bbox, conf))
            else:
                is_violation, vtype = self._is_violation(cls_name)
                if is_violation:
                    violations.append((bbox, vtype, conf))
                elif self._is_ppe_equipment(cls_name):
                    ppe_items.append((bbox, cls_name, conf))
                    # Record PPE for equipment tab
                    self.detected_equipment.append({
                        'frame': frame_num,
                        'timestamp': timestamp,
                        'type': cls_name,
                        'confidence': conf,
                        'bbox': bbox
                    })
        
        # Use custom tracker to get consistent person IDs
        persons = self.person_tracker.update(person_detections, frame_num)
        
        # Debug logging
        if frame_num % 30 == 0:
            logger.info(f"Frame {frame_num}: {len(persons)} persons (tracked), {len(violations)} violations, {len(ppe_items)} PPE")
        
        # Helper: find closest person to a bbox
        def find_closest_person(vbox):
            """Find person whose bbox is closest/overlapping with violation bbox."""
            vx1, vy1, vx2, vy2 = vbox
            vcx, vcy = (vx1 + vx2) / 2, (vy1 + vy2) / 2  # Center of violation
            
            best_person = None
            best_dist = float('inf')
            
            # persons is list of (bbox, track_id, conf) from our custom tracker
            for person_bbox, person_tid, person_conf in persons:
                px1, py1, px2, py2 = person_bbox
                # Check if violation is inside person bbox (or close)
                pcx, pcy = (px1 + px2) / 2, (py1 + py2) / 2
                dist = ((vcx - pcx) ** 2 + (vcy - pcy) ** 2) ** 0.5
                
                # Also check if violation overlaps with person
                if vx1 >= px1 - 50 and vx2 <= px2 + 50 and vy1 >= py1 - 50 and vy2 <= py2 + 50:
                    dist = 0  # Strong match
                
                if dist < best_dist:
                    best_dist = dist
                    best_person = (person_bbox, person_tid)
            
            return best_person
        
        # Draw persons FIRST (GREEN boxes)
        for person_bbox, track_id, person_conf in persons:
            px1, py1, px2, py2 = person_bbox
            
            # Track this person
            if track_id not in self.track_first_seen:
                self.track_first_seen[track_id] = frame_num
                logger.info(f"Tracking: New Person-{track_id}")
            
            cv2.rectangle(annotated, (px1, py1), (px2, py2), (0, 255, 0), 2)
            label = f"Person-{track_id}"
            cv2.putText(annotated, label, (px1, py1 - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        # PROCESS PPE FIRST - Associate PPE with person ONLY if PPE is inside person's bbox
        # This is stricter than find_closest_person to prevent cross-person PPE association
        for ppe_bbox, cls_name, conf in ppe_items:
            ex1, ey1, ex2, ey2 = ppe_bbox
            cv2.rectangle(annotated, (ex1, ey1), (ex2, ey2), (255, 0, 0), 2)
            cv2.putText(annotated, cls_name, (ex1, ey1 - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            
            # Associate PPE with person ONLY if PPE bbox center is INSIDE person bbox
            # This is stricter to avoid cross-contamination of PPE between nearby persons
            ppe_cx, ppe_cy = (ex1 + ex2) / 2, (ey1 + ey2) / 2  # PPE center
            
            for person_bbox, person_tid, person_conf in persons:
                px1, py1, px2, py2 = person_bbox
                # Check if PPE center is inside person bbox (with small tolerance)
                tolerance = 30  # pixels
                if (px1 - tolerance <= ppe_cx <= px2 + tolerance and 
                    py1 - tolerance <= ppe_cy <= py2 + tolerance):
                    self._record_person_ppe(person_tid, cls_name)
                    break  # Only associate with one person
        
        # Inference-based No Goggles detection:
        # If person doesn't have goggles/glasses detected, trigger No Goggles violation
        GOGGLES_PPE_ITEMS = ['glasses', 'goggles', 'safety-glasses', 'safety glasses', 'eye protection']
        
        for person_bbox, track_id, person_conf in persons:
            # Check if this person has goggles/glasses in their worn PPE
            person_ppe = self.person_worn_ppe.get(track_id, set())
            has_goggles = False
            for ppe_item in person_ppe:
                ppe_lower = ppe_item.lower()
                for goggles_type in GOGGLES_PPE_ITEMS:
                    if goggles_type in ppe_lower:
                        has_goggles = True
                        break
                if has_goggles:
                    break
            
            # If no goggles detected, add to violations list (let the main loop process it)
            # Only add once per person - check captured_violations
            if not has_goggles:
                vtype = 'No Goggles'
                key = (track_id, vtype)
                if key not in self.captured_violations:
                    px1, py1, px2, py2 = person_bbox
                    violations.append(((int(px1), int(py1), int(px2), int(py2)), vtype, 0.85))
                    logger.info(f"Adding No Goggles violation for Person-{track_id}")
        
        # THEN Process violations - skip if person has worn corresponding PPE
        for vbox, vtype, conf in violations:
            vx1, vy1, vx2, vy2 = vbox
            
            # Find which person this violation belongs to
            closest = find_closest_person(vbox)
            if closest:
                person_bbox, track_id = closest
            else:
                # No person found, use fallback ID
                track_id = 1
                if track_id not in self.track_first_seen:
                    self.track_first_seen[track_id] = frame_num
            
            # Check if this violation should be skipped because person has worn corresponding PPE
            if self._should_skip_violation(track_id, vtype):
                continue  # Skip this violation - person has worn the required PPE
            
            # Draw violation box (RED)
            cv2.rectangle(annotated, (vx1, vy1), (vx2, vy2), (0, 0, 255), 3)
            if vtype == 'No Goggles':
                logger.info(f"Drawing No Goggles box at ({vx1},{vy1})-({vx2},{vy2}) for Person-{track_id}")
            
            # Violation label
            label = f"Person-{track_id}: {vtype}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(annotated, (vx1, vy1 - label_size[1] - 10),
                         (vx1 + label_size[0] + 10, vy1), (0, 0, 255), -1)
            cv2.putText(annotated, label, (vx1 + 5, vy1 - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Update aggregator with PERSON's track ID
            self.aggregator.update_individual(
                track_id=track_id,
                frame_number=frame_num,
                first_seen_frame=self.track_first_seen.get(track_id, frame_num)
            )
            
            # Capture violation image with cooldown
            # Only capture if confidence meets the display threshold
            if conf >= self.violation_display_threshold and self._can_capture(track_id, vtype, timestamp):
                bbox = (float(vx1), float(vy1), float(vx2), float(vy2))
                img_path = self._save_image(frame, bbox, video_id, frame_num, vtype, track_id)
                
                record = ViolationRecord(
                    violation_type=vtype,
                    confidence=conf,
                    frame_number=frame_num,
                    timestamp=timestamp,
                    bbox=bbox,
                    image_path=img_path
                )
                self.aggregator.profiles[track_id].add_violation(record)
                logger.info(f"VIOLATION: Person-{track_id} - {vtype}")
        
        # Frame info overlay
        active_persons = len([p for p in persons])
        total_violations = sum(p.violation_count for p in self.aggregator.profiles.values())
        info = f"Time: {timestamp:.1f}s | Persons: {len(set(p[1] for p in persons))} | Violations: {total_violations}"
        cv2.rectangle(annotated, (5, 5), (500, 40), (0, 0, 0), -1)
        cv2.putText(annotated, info, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return annotated
    
    def _save_image(self, frame, bbox, video_id, frame_num, vtype, track_id) -> str:
        """Save violation snapshot."""
        try:
            x1, y1, x2, y2 = [int(c) for c in bbox]
            h, w = frame.shape[:2]
            
            pad_x, pad_y = int((x2 - x1) * 0.5), int((y2 - y1) * 0.5)
            x1, y1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
            x2, y2 = min(w, x2 + pad_x), min(h, y2 + pad_y)
            
            img = frame[y1:y2, x1:x2].copy()
            cv2.putText(img, f"Person-{track_id}: {vtype}", (5, 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            safe = vtype.replace(" ", "_").lower()
            fname = f"p{track_id}_{safe}_{video_id}_{frame_num}.jpg"
            path = os.path.join(settings.VIOLATIONS_IMG_DIR, fname)
            cv2.imwrite(path, img)
            
            return f"/violation_images/{fname}"
        except Exception as e:
            logger.error(f"Save failed: {e}")
            return None
    
    def get_progress(self) -> float:
        return self.progress
    
    def is_active(self) -> bool:
        return self.is_processing
