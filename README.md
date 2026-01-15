# Individual Association & Violation Tracking System

An AI-powered video analytics system that automatically detects safety violations, tracks individuals with temporary IDs, aggregates violations per person, and provides an admin-centric review interface.

## Features

- **🎯 Violation Detection**: YOLO-based detection for safety violations (PPE, restricted zones)
- **👤 Individual Tracking**: Deep SORT multi-object tracking with session-scoped IDs
- **📊 Aggregation**: Per-individual violation history and pattern analysis
- **✅ Admin Review**: Confirm/reject workflow for human-in-the-loop validation
- **🔒 Privacy-First**: No biometric storage, temporary IDs only

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg (optional, for video snippets)
- CUDA/GPU (recommended for faster processing)

### Backend Setup

```bash
# Navigate to project directory
cd market

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The admin UI will be available at `http://localhost:5173`

## Project Structure

```
market/
├── main.py                 # FastAPI entry point
├── requirements.txt        # Python dependencies
├── ppe_model.pt           # YOLO model for PPE detection
├── app/
│   ├── config.py          # Application settings
│   ├── database.py        # SQLAlchemy setup
│   ├── models/            # Database models
│   ├── schemas/           # Pydantic schemas
│   ├── routers/           # API endpoints
│   ├── ai/                # AI pipeline components
│   │   ├── detector.py    # YOLO detector
│   │   ├── tracker.py     # Deep SORT tracker
│   │   ├── aggregator.py  # Violation aggregation
│   │   └── pipeline.py    # Video processing pipeline
│   └── services/          # Business logic
├── frontend/              # React admin dashboard
│   ├── src/
│   │   ├── pages/         # Dashboard, Videos, Violations, etc.
│   │   ├── components/    # Reusable UI components
│   │   └── services/      # API client
│   └── package.json
├── uploads/               # Uploaded video storage
├── snippets/              # Violation video clips
└── docs/                  # Documentation
    ├── tracking_logic.md
    ├── privacy_handling.md
    └── admin_workflow.md
```

## API Endpoints

### Videos
- `POST /api/videos/upload` - Upload video for processing
- `GET /api/videos` - List all videos
- `GET /api/videos/{id}` - Get video details
- `GET /api/videos/{id}/status` - Check processing status
- `DELETE /api/videos/{id}` - Delete video

### Violations
- `GET /api/violations` - List violations (with filters)
- `GET /api/violations/{id}` - Get violation details
- `POST /api/violations/{id}/review` - Submit review
- `POST /api/violations/bulk-review` - Bulk review

### Individuals
- `GET /api/individuals/{video_id}` - List tracked individuals
- `GET /api/individuals/{video_id}/{track_id}` - Get individual profile
- `GET /api/individuals/{video_id}/{track_id}/analysis` - Pattern analysis

### Dashboard
- `GET /api/dashboard/stats` - Overall statistics
- `GET /api/dashboard/repeat-offenders` - High-risk individuals

## Configuration

Edit `app/config.py` or use environment variables:

```python
# AI Pipeline
YOLO_MODEL_PATH = "ppe_model.pt"
CONFIDENCE_THRESHOLD = 0.5
FRAME_SKIP = 2  # Process every Nth frame

# Deep SORT
MAX_AGE = 30    # Frames before track deletion
N_INIT = 3      # Detections to confirm track

# Storage
UPLOAD_DIR = "uploads"
SNIPPETS_DIR = "snippets"
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB
```

## Documentation

- [Tracking Logic](docs/tracking_logic.md) - How Deep SORT tracking works
- [Privacy Handling](docs/privacy_handling.md) - Privacy-first design principles
- [Admin Workflow](docs/admin_workflow.md) - Step-by-step admin guide

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite (async) |
| AI/ML | Ultralytics YOLO, Deep SORT |
| Video | OpenCV, FFmpeg |
| Frontend | React, Vite, Axios |
| Styling | Custom CSS with dark theme |

## License

MIT License - See LICENSE for details
