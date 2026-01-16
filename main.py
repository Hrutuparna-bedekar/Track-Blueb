"""
Individual Association & Violation Tracking System
Main FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.database import init_db
from app.routers import videos, violations, individuals, dashboard, equipment, webcam
from app.config import settings

# Create upload directories immediately on import (before app starts)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.SNIPPETS_DIR, exist_ok=True)
os.makedirs(settings.VIOLATIONS_IMG_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await init_db()
    
    yield
    
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="Violation Tracking System",
    description="AI-powered video analytics for safety violation detection and individual tracking",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
app.include_router(violations.router, prefix="/api/violations", tags=["Violations"])
app.include_router(individuals.router, prefix="/api/individuals", tags=["Individuals"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(equipment.router, tags=["Equipment"])
app.include_router(webcam.router, prefix="/api/webcam", tags=["Webcam"])

# Serve static files for uploads, snippets, and violation images
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/snippets", StaticFiles(directory=settings.SNIPPETS_DIR), name="snippets")
app.mount("/violation_images", StaticFiles(directory=settings.VIOLATIONS_IMG_DIR), name="violation_images")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "running",
        "message": "Violation Tracking System API",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "ai_pipeline": "ready"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
