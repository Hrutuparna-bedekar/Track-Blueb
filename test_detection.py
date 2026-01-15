"""
Test script to verify YOLO detection on a video frame.
Run this to see what the model is actually detecting.
"""
import cv2
from ultralytics import YOLO
import os

# Find a test video
uploads_dir = "uploads"
videos = [f for f in os.listdir(uploads_dir) if f.endswith('.mp4') and not f.startswith('annotated')]

if not videos:
    print("No videos found in uploads/ directory")
    print("Please upload a video first via the frontend")
    exit(1)

video_path = os.path.join(uploads_dir, videos[0])
print(f"Testing with video: {video_path}")

# Load model
print("\nLoading model...")
model = YOLO("ppe_model.pt")
print(f"Model classes: {model.names}")

# Open video and get a frame
cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print(f"Cannot open video: {video_path}")
    exit(1)

# Skip to middle of video
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)

ret, frame = cap.read()
if not ret:
    print("Cannot read frame")
    exit(1)

print(f"\nFrame size: {frame.shape}")

# Run detection with LOW confidence
print("\n=== Running detection (conf=0.1) ===")
results = model(frame, conf=0.1, verbose=True)

if results and len(results) > 0:
    boxes = results[0].boxes
    if boxes is not None and len(boxes) > 0:
        print(f"\nDetected {len(boxes)} objects:")
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].cpu().numpy())
            conf = float(boxes.conf[i].cpu().numpy())
            cls_name = model.names.get(cls_id, f"class_{cls_id}")
            print(f"  {i+1}. {cls_name} (confidence: {conf:.2%}, class_id: {cls_id})")
    else:
        print("\nNo objects detected!")
else:
    print("\nNo results from model!")

cap.release()

# Save annotated frame for visual inspection
print("\n=== Saving annotated frame ===")
annotated_frame = results[0].plot() if results else frame
cv2.imwrite("test_detection.jpg", annotated_frame)
print("Saved to: test_detection.jpg")
print("\nOpen this file to see what the model detected!")
