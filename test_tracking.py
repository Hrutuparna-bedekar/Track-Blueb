"""
Test to see what's being detected in tracking mode vs detection mode.
"""
import cv2
from ultralytics import YOLO
import os

# Find a test video
uploads_dir = "uploads"
videos = [f for f in os.listdir(uploads_dir) if f.endswith('.mp4') and not f.startswith('annotated')]

if not videos:
    print("No videos found in uploads/ directory")
    exit(1)

video_path = os.path.join(uploads_dir, videos[0])
print(f"Testing with video: {video_path}")

# Load model
model = YOLO("ppe_model.pt")
print(f"Model classes: {list(model.names.values())}")

# Open video and get a frame
cap = cv2.VideoCapture(video_path)
cap.set(cv2.CAP_PROP_POS_FRAMES, 50)  # Skip to frame 50
ret, frame = cap.read()
cap.release()

if not ret:
    print("Cannot read frame")
    exit(1)

# Test 1: Regular detection
print("\n=== Regular Detection (conf=0.25) ===")
results = model(frame, conf=0.25, verbose=False)
if results and results[0].boxes is not None:
    boxes = results[0].boxes
    print(f"Detected {len(boxes)} objects:")
    for i in range(len(boxes)):
        cls_id = int(boxes.cls[i].cpu().numpy())
        conf = float(boxes.conf[i].cpu().numpy())
        cls_name = model.names.get(cls_id, f"class_{cls_id}")
        print(f"  {i+1}. {cls_name} (conf={conf:.2f})")
else:
    print("No detections!")

# Test 2: Tracking mode  
print("\n=== Tracking Mode (conf=0.25) ===")
results = model.track(frame, conf=0.25, persist=False, verbose=False)
if results and results[0].boxes is not None:
    boxes = results[0].boxes
    print(f"Detected {len(boxes)} objects:")
    for i in range(len(boxes)):
        cls_id = int(boxes.cls[i].cpu().numpy())
        conf = float(boxes.conf[i].cpu().numpy())
        cls_name = model.names.get(cls_id, f"class_{cls_id}")
        print(f"  {i+1}. {cls_name} (conf={conf:.2f})")
else:
    print("No detections!")
