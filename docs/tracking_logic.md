# Individual Tracking Logic

## Overview

This system uses **Deep SORT (Simple Online and Realtime Tracking)** to track individuals across video frames. Deep SORT extends the original SORT algorithm by adding a deep association metric for improved tracking accuracy.

## How Tracking Works

### 1. Detection Phase (YOLO)

Each video frame is processed by a YOLO-based detector to identify:
- Individuals in the scene
- Associated violations (missing PPE, safety equipment, etc.)

The detector outputs bounding boxes with coordinates, confidence scores, and class labels.

### 2. Tracking Phase (Deep SORT)

Deep SORT maintains persistent identities across frames using:

#### Motion Estimation (Kalman Filter)
- Predicts the next position of each tracked individual
- Uses an 8-dimensional state space: `[x, y, a, h, vx, vy, va, vh]`
  - `(x, y)`: Bounding box center
  - `a`: Aspect ratio
  - `h`: Height
  - `(vx, vy, va, vh)`: Velocities

#### Appearance Encoding
- Lightweight MobileNet-based embedder extracts appearance features
- Features are used for re-identification when tracks are lost
- **Note**: These are NOT biometric features - they describe clothing/general appearance

#### Association Algorithm
1. Predict new track positions using Kalman filter
2. Calculate cost matrix using:
   - Mahalanobis distance (motion)
   - Cosine distance (appearance)
3. Apply Hungarian algorithm for optimal assignment
4. Handle unmatched detections and tracks

### 3. Track Lifecycle

```
New Detection → Tentative Track → Confirmed Track → Deleted Track
                     │                    │              ↑
                     └──── n_init hits ───┘              │
                                                         │
                     Track lost for max_age frames ──────┘
```

- **n_init** (default: 3): Minimum consecutive detections to confirm a track
- **max_age** (default: 30): Maximum frames a track survives without detection

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MAX_AGE` | 30 | Frames before a lost track is deleted |
| `N_INIT` | 3 | Detections needed to confirm track |
| `FRAME_SKIP` | 2 | Process every Nth frame for performance |
| `CONFIDENCE_THRESHOLD` | 0.5 | Minimum detection confidence |

## Violation-to-Track Association

When a violation is detected, it's associated with a tracked individual using IoU (Intersection over Union):

```python
def associate_violation_to_track(violation_bbox, tracked_persons, iou_threshold=0.3):
    best_match = None
    best_iou = iou_threshold
    
    for person in tracked_persons:
        iou = calculate_iou(violation_bbox, person.bbox)
        if iou > best_iou:
            best_iou = iou
            best_match = person.track_id
    
    return best_match
```

## Session-Scoped IDs

**Critical Privacy Feature**: Track IDs are reset for each video:

- Each video upload creates a fresh tracking session
- IDs start from 1 for every video
- No cross-video identity persistence
- Prevents long-term surveillance tracking

## Performance Considerations

1. **Frame Skipping**: Process every Nth frame to reduce computation
2. **Batch Processing**: Detections are batched per frame
3. **GPU Acceleration**: YOLO inference uses GPU when available
4. **Async Processing**: Video processing runs in background tasks

## Known Limitations

1. **Occlusion**: Tracks may be lost when individuals are occluded
2. **Similar Appearance**: Multiple individuals with similar clothing may be confused
3. **Fast Movement**: Rapid motion between frames may cause track loss
4. **Re-entry**: An individual leaving and re-entering the scene gets a new ID
