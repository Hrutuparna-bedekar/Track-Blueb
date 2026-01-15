"""
Simple test - just list ALL detections from the model.
"""
import cv2
from ultralytics import YOLO
import os

# Find a test video
uploads_dir = "uploads"
videos = [f for f in os.listdir(uploads_dir) if f.endswith('.mp4') and not f.startswith('annotated')]
if not videos:
    print("No videos found!")
    exit(1)

video_path = os.path.join(uploads_dir, videos[0])
print(f"Video: {video_path}")

# Load model and print classes
model = YOLO("ppe_model.pt")

# Get frame
cap = cv2.VideoCapture(video_path)
cap.set(cv2.CAP_PROP_POS_FRAMES, 50)
ret, frame = cap.read()
cap.release()

# Run detection
results = model(frame, conf=0.10, verbose=False)  # Even lower conf

print("\nALL detections at conf >= 0.10:")
if results and results[0].boxes is not None:
    for i in range(len(results[0].boxes)):
        boxes = results[0].boxes
        cls_id = int(boxes.cls[i].cpu().numpy())
        conf = float(boxes.conf[i].cpu().numpy())
        cls_name = model.names.get(cls_id, "?")
        print(f"  {i+1}. {cls_name} (conf={conf:.2f})")
else:
    print("  No detections!")

# Count PPE-related
ppe_classes = ['helmet', 'glasses', 'face-mask', 'shoes', 'mask', 'goggles', 'boots']
print(f"\nPPE classes in model: {[n for n in model.names.values() if any(p in n.lower() for p in ppe_classes)]}")
