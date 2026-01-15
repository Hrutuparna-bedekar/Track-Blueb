"""
Router for PPE Equipment endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.database import get_db
from app.models.equipment import PPEEquipment
from pydantic import BaseModel


router = APIRouter(prefix="/api/equipment", tags=["equipment"])


# Pydantic schemas
class EquipmentResponse(BaseModel):
    id: int
    video_id: int
    equipment_type: str
    confidence: float
    frame_number: int
    timestamp: float
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None
    image_path: Optional[str] = None
    
    class Config:
        from_attributes = True


class EquipmentListResponse(BaseModel):
    items: List[EquipmentResponse]
    total: int
    page: int
    page_size: int


class EquipmentTypeCount(BaseModel):
    equipment_type: str
    count: int


@router.get("", response_model=EquipmentListResponse)
async def list_equipment(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    video_id: Optional[int] = None,
    equipment_type: Optional[str] = None
):
    """List detected PPE equipment with filtering and pagination."""
    
    query = select(PPEEquipment)
    count_query = select(func.count(PPEEquipment.id))
    
    if video_id:
        query = query.where(PPEEquipment.video_id == video_id)
        count_query = count_query.where(PPEEquipment.video_id == video_id)
    
    if equipment_type:
        query = query.where(PPEEquipment.equipment_type == equipment_type)
        count_query = count_query.where(PPEEquipment.equipment_type == equipment_type)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    offset = (page - 1) * page_size
    query = query.order_by(PPEEquipment.id.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    equipment = result.scalars().all()
    
    return EquipmentListResponse(
        items=[EquipmentResponse.model_validate(e) for e in equipment],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/types")
async def get_equipment_types(
    db: AsyncSession = Depends(get_db),
    video_id: Optional[int] = None
) -> List[EquipmentTypeCount]:
    """Get count of equipment by type."""
    
    query = select(
        PPEEquipment.equipment_type,
        func.count(PPEEquipment.id).label('count')
    ).group_by(PPEEquipment.equipment_type)
    
    if video_id:
        query = query.where(PPEEquipment.video_id == video_id)
    
    result = await db.execute(query)
    rows = result.all()
    
    return [EquipmentTypeCount(equipment_type=row[0], count=row[1]) for row in rows]


@router.get("/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get specific equipment by ID."""
    
    result = await db.execute(
        select(PPEEquipment).where(PPEEquipment.id == equipment_id)
    )
    equipment = result.scalar_one_or_none()
    
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    return EquipmentResponse.model_validate(equipment)
