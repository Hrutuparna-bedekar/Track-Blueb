"""
Comprehensive test to see exactly what is detected and how PPE matches to persons.
"""
import cv2
from ultralytics import YOLO
import os
import sys
sys.path.insert(0, '.')

from app.ai.pipeline import VideoPipeline, REQUIRED_PPE, PPE_ALIASES

# Find a test video
uploads_dir = "uploads"
videos = [f for f in os.listdir(uploads_dir) if f.endswith('.mp4') and not f.startswith('annotated')]

if not videos:
    print("No videos found! Please upload a video first.")
    exit(1)

video_path = os.path.join(uploads_dir, videos[0])
print(f"Testing with: {video_path}\n")

# Load model
model = YOLO("ppe_model.pt")

# Get a frame from the middle
cap = cv2.VideoCapture(video_path)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
ret, frame = cap.read()
cap.release()

if not ret:
    print("Cannot read frame!")
    exit(1)

# Initialize pipeline for PPE checking
pipeline = VideoPipeline()

# Run detection with low confidence
print("=" * 60)
print("ALL DETECTIONS (conf >= 0.15)")
print("=" * 60)
results = model(frame, conf=0.15, verbose=False)

persons = []
ppe_items = []

if results and results[0].boxes is not None:
    boxes = results[0].boxes
    for i in range(len(boxes)):
        xyxy = boxes.xyxy[i].cpu().numpy()
        x1, y1, x2, y2 = [float(c) for c in xyxy]
        conf = float(boxes.conf[i].cpu().numpy())
        cls_id = int(boxes.cls[i].cpu().numpy())
        cls_name = model.names.get(cls_id, f"class_{cls_id}")
        bbox = (x1, y1, x2, y2)
        
        print(f"  {cls_name:15} conf={conf:.2f}  bbox=({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
        
        if cls_name.lower() == 'person':
            persons.append((bbox, i+1, conf))
        else:
            is_ppe, ppe_type = pipeline._is_ppe_class(cls_name)
            if is_ppe:
                ppe_items.append((bbox, ppe_type, conf, cls_name))
                print(f"    ^ This is PPE: {ppe_type}")

print(f"\n{'=' * 60}")
print(f"SUMMARY: {len(persons)} persons, {len(ppe_items)} PPE items")
print(f"{'=' * 60}")

print(f"\nPersons:")
for bbox, tid, conf in persons:
    print(f"  Person-{tid}: bbox=({bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f})")

print(f"\nPPE Items:")
for bbox, ppe_type, conf, cls_name in ppe_items:
    print(f"  {ppe_type} ({cls_name}): bbox=({bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f})")

# Check overlaps
print(f"\n{'=' * 60}")
print("PPE-PERSON OVERLAP CHECK")
print(f"{'=' * 60}")

for person_bbox, tid, pconf in persons:
    print(f"\nPerson-{tid} at ({person_bbox[0]:.0f},{person_bbox[1]:.0f},{person_bbox[2]:.0f},{person_bbox[3]:.0f}):")
    ppe_found = set()
    for ppe_bbox, ppe_type, ppe_conf, cls_name in ppe_items:
        overlaps = pipeline._boxes_overlap(person_bbox, ppe_bbox, threshold=0.1)
        status = "✓ OVERLAP" if overlaps else "✗ no overlap"
        print(f"  {ppe_type}: {status}")
        if overlaps:
            ppe_found.add(ppe_type)
    
    missing = []
    for req_ppe in REQUIRED_PPE:
        if req_ppe not in ppe_found:
            missing.append(REQUIRED_PPE[req_ppe])
    
    print(f"  PPE Found: {ppe_found if ppe_found else 'NONE'}")
    print(f"  Violations: {missing if missing else 'NONE (compliant)'}")
