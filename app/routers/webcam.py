"""
Webcam streaming endpoint for real-time PPE violation detection.
Uses WebSocket for bidirectional frame streaming.
"""

import base64
import cv2
import numpy as np
import logging
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel

from app.ai.pipeline import VideoPipeline
from app.config import settings
from app.database import get_db
from app.models.video import Video, ProcessingStatus
from app.models.individual import TrackedIndividual
from app.models.violation import Violation

logger = logging.getLogger(__name__)

router = APIRouter()

# Global pipeline instance for webcam processing
# Using a single instance avoids model reload overhead
_webcam_pipeline: Optional[VideoPipeline] = None


def get_webcam_pipeline() -> VideoPipeline:
    """Get or create the webcam pipeline instance."""
    global _webcam_pipeline
    if _webcam_pipeline is None:
        # Use the webcam-specific model (old.pt) instead of the default video model
        _webcam_pipeline = VideoPipeline(model_path=settings.WEBCAM_MODEL_PATH)
        logger.info(f"Initialized webcam pipeline with model: {settings.WEBCAM_MODEL_PATH}")
    return _webcam_pipeline


def save_webcam_violation_image(frame: np.ndarray, bbox: tuple, session_id: str, 
                                 frame_num: int, vtype: str, track_id: int) -> Optional[str]:
    """Save violation snapshot image for webcam session."""
    try:
        x1, y1, x2, y2 = [int(c) for c in bbox]
        h, w = frame.shape[:2]
        
        # Create copy for drawing
        img = frame.copy()
        
        # Draw violation box (RED) on the image BEFORE cropping
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 3)
        
        # Add padding around the violation area for the crop
        # 50% padding for context
        pad_x, pad_y = int((x2 - x1) * 0.5), int((y2 - y1) * 0.5)
        
        crop_x1 = max(0, x1 - pad_x)
        crop_y1 = max(0, y1 - pad_y)
        crop_x2 = min(w, x2 + pad_x)
        crop_y2 = min(h, y2 + pad_y)
        
        # perform crop
        crop_img = img[crop_y1:crop_y2, crop_x1:crop_x2].copy()
        
        # Add text label to the crop
        cv2.putText(crop_img, f"Person-{track_id}: {vtype}", (5, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
        safe = vtype.replace(" ", "_").lower()
        fname = f"webcam_p{track_id}_{safe}_{session_id}_{frame_num}.jpg"
        path = os.path.join(settings.VIOLATIONS_IMG_DIR, fname)
        cv2.imwrite(path, crop_img)
        
        return f"/violation_images/{fname}"
    except Exception as e:
        logger.error(f"Save webcam violation image failed: {e}")
        return None


@router.websocket("/stream")
async def webcam_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time webcam frame processing.
    
    Protocol:
    - Client sends: base64-encoded JPEG frame
    - Server responds: JSON with base64 annotated frame and stats
    - On disconnect: Server sends session summary with all violations
    """
    await websocket.accept()
    logger.info("Webcam WebSocket connection established")
    
    pipeline = get_webcam_pipeline()
    # Reset pipeline state for new session
    pipeline.reset()
    
    frame_num = 0
    fps = 30.0  # Assumed webcam fps
    session_id = uuid.uuid4().hex[:8]
    video_id = f"webcam_{session_id}"
    
    # Session violation tracking
    session_violations = []  # List of violations captured during session
    captured_violations_set = set()  # (track_id, violation_type) - prevent duplicates
    
    try:
        while True:
            # Receive frame from client
            data = await websocket.receive_text()
            
            try:
                # Decode base64 image
                img_data = base64.b64decode(data)
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    logger.warning("Failed to decode frame")
                    continue
                
                # Process frame using existing pipeline method
                annotated = pipeline._process_frame_with_tracking(
                    frame, frame_num, video_id, fps
                )
                
                # Encode annotated frame back to base64 JPEG
                _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
                annotated_b64 = base64.b64encode(buffer).decode('utf-8')
                
                # Gather statistics
                profiles = pipeline.aggregator.get_all_profiles()
                total_violations = sum(p.violation_count for p in profiles.values())
                persons_count = len(pipeline.person_tracker.tracks)
                
                # Capture NEW violations for session review
                for p in profiles.values():
                    for v in p.violations:
                        key = (p.track_id, v.violation_type)
                        if key not in captured_violations_set:
                            captured_violations_set.add(key)
                            
                            # Save image if we have bbox
                            image_path = None
                            if v.bbox:
                                image_path = save_webcam_violation_image(
                                    frame, v.bbox, session_id, 
                                    v.frame_number, v.violation_type, p.track_id
                                )
                            
                            # Get worn PPE for this person
                            worn_ppe = list(pipeline.person_worn_ppe.get(p.track_id, set()))
                            
                            session_violations.append({
                                "id": len(session_violations) + 1,
                                "person_id": p.track_id,
                                "type": v.violation_type,
                                "confidence": round(v.confidence, 2),
                                "timestamp": round(v.timestamp, 1),
                                "frame_num": v.frame_number,
                                "image_path": image_path or v.image_path,
                                "detected_at": datetime.now().isoformat(),
                                "worn_ppe": worn_ppe  # PPE worn by this person
                            })
                
                # Get recent violations for live display
                recent_violations = []
                for p in profiles.values():
                    for v in p.violations:  # All violations per person
                        recent_violations.append({
                            "person_id": p.track_id,
                            "type": v.violation_type,
                            "confidence": round(v.confidence, 2),
                            "timestamp": round(v.timestamp, 1)
                        })
                
                # Build person_ppe map for individuals view
                person_ppe = {}
                for track_id, ppe_set in pipeline.person_worn_ppe.items():
                    person_ppe[track_id] = list(ppe_set)
                
                # Send response with full session violations and worn PPE
                await websocket.send_json({
                    "frame": annotated_b64,
                    "stats": {
                        "frame_num": frame_num,
                        "persons": persons_count,
                        "total_violations": total_violations,
                        "recent_violations": recent_violations  # All violations
                    },
                    "session_violations": session_violations,  # Full list for review
                    "person_ppe": person_ppe  # PPE worn by each person
                })
                
                frame_num += 1
                
            except Exception as e:
                logger.error(f"Frame processing error: {e}")
                await websocket.send_json({
                    "error": str(e)
                })
                
    except WebSocketDisconnect:
        logger.info(f"Webcam WebSocket disconnected - session had {len(session_violations)} violations")
        # Try to send final session summary before disconnect
        try:
            await websocket.send_json({
                "session_ended": True,
                "session_summary": {
                    "total_frames": frame_num,
                    "total_violations": len(session_violations),
                    "violations": session_violations
                }
            })
        except:
            pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Reset pipeline for next session
        pipeline.reset()


@router.get("/status")
async def webcam_status():
    """Check if webcam processing is available."""
    try:
        pipeline = get_webcam_pipeline()
        return {
            "available": True,
            "model_loaded": pipeline.model is not None,
            "tracking_method": pipeline.tracking_method
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }


# ============ Pydantic Models for Save Session ============

class WebcamViolation(BaseModel):
    """Violation data from webcam session."""
    id: int
    person_id: int
    type: str
    confidence: float
    timestamp: float
    frame_num: int
    image_path: Optional[str] = None
    review_status: str  # 'confirmed', 'rejected', 'pending'


class WebcamIndividual(BaseModel):
    """Individual data from webcam session."""
    person_id: int
    first_seen: float
    last_seen: float
    violations: List[WebcamViolation] = []
    worn_ppe: List[str] = []


class SaveSessionRequest(BaseModel):
    """Request body for saving webcam session."""
    session_id: str
    duration: float  # Total session duration in seconds
    total_frames: int
    recording_timestamp: str  # ISO format datetime when recording started
    violations: List[WebcamViolation]
    individuals: List[WebcamIndividual]


def determine_shift_from_time(dt: datetime) -> str:
    """
    Determine shift based on time of day.
    - Morning: 6AM - 2PM (6:00 - 13:59)
    - Evening: 2PM - 10PM (14:00 - 21:59)
    - Night: 10PM - 6AM (22:00 - 5:59)
    """
    hour = dt.hour
    if 6 <= hour < 14:
        return "morning"
    elif 14 <= hour < 22:
        return "evening"
    else:
        return "night"


@router.post("/save-session")
async def save_webcam_session(
    request: SaveSessionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Save a webcam session to the database.
    
    This creates:
    - A Video entry with source='webcam'
    - TrackedIndividual entries for each person
    - Violation entries for each detected violation (with review status)
    
    The session is automatically marked as reviewed and will appear in
    Search Violations, Dashboard graphs, and Chat queries.
    """
    try:
        # Parse recording timestamp - ensure we use local naive datetime
        try:
            # Parse the ISO timestamp
            parsed_time = datetime.fromisoformat(request.recording_timestamp.replace('Z', '+00:00'))
            # Convert to naive local datetime (remove timezone info)
            if parsed_time.tzinfo is not None:
                # Convert to local time and make naive
                recording_time = parsed_time.replace(tzinfo=None)
            else:
                recording_time = parsed_time
        except:
            recording_time = datetime.now()
        
        # Determine shift based on recording time
        shift = determine_shift_from_time(recording_time)
        
        # Create Video entry
        video = Video(
            filename=f"webcam_{request.session_id}.mp4",
            original_filename=f"Webcam Recording - {recording_time.strftime('%Y-%m-%d %H:%M')}",
            file_path=f"webcam_sessions/{request.session_id}",  # Virtual path
            file_size=0,
            duration=request.duration,
            fps=30.0,
            width=640,
            height=480,
            status=ProcessingStatus.COMPLETED.value,
            processing_progress=100.0,
            total_individuals=len(request.individuals),
            total_violations=len([v for v in request.violations if v.review_status == 'confirmed']),
            shift=shift,
            source="webcam",
            is_reviewed=1,  # Auto-mark as reviewed
            reviewed_at=datetime.now(),
            uploaded_at=recording_time,
            processed_at=datetime.now()
        )
        
        db.add(video)
        await db.flush()  # Get video.id
        
        # Create TrackedIndividual entries
        individual_id_map = {}  # person_id -> TrackedIndividual.id
        
        for ind in request.individuals:
            # Count confirmed violations for this person
            confirmed_count = len([v for v in request.violations 
                                   if v.person_id == ind.person_id and v.review_status == 'confirmed'])
            rejected_count = len([v for v in request.violations 
                                  if v.person_id == ind.person_id and v.review_status == 'rejected'])
            total_violations = len([v for v in request.violations if v.person_id == ind.person_id])
            
            # Calculate risk score
            risk_score = min(1.0, confirmed_count / 3) if confirmed_count > 0 else 0.0
            
            tracked_ind = TrackedIndividual(
                video_id=video.id,
                track_id=ind.person_id,
                first_seen_frame=int(ind.first_seen * 30),  # Approx frame
                last_seen_frame=int(ind.last_seen * 30),
                first_seen_time=ind.first_seen,
                last_seen_time=ind.last_seen,
                total_frames_tracked=int((ind.last_seen - ind.first_seen) * 30),
                total_violations=total_violations,
                confirmed_violations=confirmed_count,
                rejected_violations=rejected_count,
                risk_score=risk_score,
                worn_equipment=",".join(ind.worn_ppe) if ind.worn_ppe else None,
                created_at=datetime.now()
            )
            
            db.add(tracked_ind)
            await db.flush()
            individual_id_map[ind.person_id] = tracked_ind.id
        
        # Create Violation entries
        for v in request.violations:
            individual_id = individual_id_map.get(v.person_id)
            if not individual_id:
                continue
            
            violation = Violation(
                individual_id=individual_id,
                violation_type=v.type,
                confidence=v.confidence,
                frame_number=v.frame_num,
                timestamp=v.timestamp,
                image_path=v.image_path,
                review_status=v.review_status,
                detected_at=recording_time,
                reviewed_at=datetime.now() if v.review_status != 'pending' else None
            )
            
            db.add(violation)
        
        await db.commit()
        await db.refresh(video)
        
        logger.info(f"Saved webcam session {request.session_id} as video ID {video.id}")
        
        return {
            "success": True,
            "message": "Webcam session saved successfully",
            "video_id": video.id,
            "total_individuals": len(request.individuals),
            "total_violations": video.total_violations,
            "shift": shift,
            "recording_date": recording_time.strftime("%Y-%m-%d")
        }
        
    except Exception as e:
        logger.error(f"Failed to save webcam session: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")
