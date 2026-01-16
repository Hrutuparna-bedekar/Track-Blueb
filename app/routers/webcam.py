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
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

from app.ai.pipeline import VideoPipeline
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Global pipeline instance for webcam processing
# Using a single instance avoids model reload overhead
_webcam_pipeline: Optional[VideoPipeline] = None


def get_webcam_pipeline() -> VideoPipeline:
    """Get or create the webcam pipeline instance."""
    global _webcam_pipeline
    if _webcam_pipeline is None:
        _webcam_pipeline = VideoPipeline()
        logger.info("Initialized webcam pipeline")
    return _webcam_pipeline


def save_webcam_violation_image(frame: np.ndarray, bbox: tuple, session_id: str, 
                                 frame_num: int, vtype: str, track_id: int) -> Optional[str]:
    """Save violation snapshot image for webcam session."""
    try:
        x1, y1, x2, y2 = [int(c) for c in bbox]
        h, w = frame.shape[:2]
        
        # Add padding around the violation area
        pad_x, pad_y = int((x2 - x1) * 0.5), int((y2 - y1) * 0.5)
        x1, y1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
        x2, y2 = min(w, x2 + pad_x), min(h, y2 + pad_y)
        
        img = frame[y1:y2, x1:x2].copy()
        cv2.putText(img, f"Person-{track_id}: {vtype}", (5, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
        safe = vtype.replace(" ", "_").lower()
        fname = f"webcam_p{track_id}_{safe}_{session_id}_{frame_num}.jpg"
        path = os.path.join(settings.VIOLATIONS_IMG_DIR, fname)
        cv2.imwrite(path, img)
        
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
                    for v in p.violations[-3:]:  # Last 3 violations per person
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
                        "recent_violations": recent_violations[-10:]  # Last 10 overall
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

