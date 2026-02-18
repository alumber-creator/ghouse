"""
API роуты для управления теплицей
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.models.models import GreenhouseSetting, GreenhouseHistory, User, Schedule
from app.schemas.schemas import (
    GreenhouseSettingResponse, GreenhouseSettingUpdate,
    GreenhouseHistoryResponse, WateringRequest, LightingRequest,
    VentilationRequest
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger("greenhouse")

router = APIRouter(prefix="/greenhouse", tags=["Теплица"])


@router.get("/status")
async def get_greenhouse_status(db: AsyncSession = Depends(get_db)):
    """Текущее состояние всех систем теплицы"""
    result = await db.execute(select(GreenhouseSetting))
    settings = result.scalars().all()
    
    status_data = {
        "watering": None,
        "lighting": None,
        "ventilation": None
    }
    
    for setting in settings:
        if setting.system_type in status_data:
            status_data[setting.system_type] = {
                "current_value": float(setting.current_value),
                "target_value": float(setting.target_value),
                "is_auto": setting.is_auto,
                "updated_at": setting.updated_at
            }
    
    return {
        "status": "online",
        "systems": status_data,
        "timestamp": datetime.utcnow()
    }


@router.get("/settings", response_model=List[GreenhouseSettingResponse])
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Получение настроек систем"""
    result = await db.execute(select(GreenhouseSetting))
    settings = result.scalars().all()
    return [GreenhouseSettingResponse.model_validate(s) for s in settings]


@router.put("/settings", response_model=GreenhouseSettingResponse)
async def update_settings(
    setting_data: GreenhouseSettingUpdate,
    system_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление настроек системы"""
    result = await db.execute(
        select(GreenhouseSetting).where(GreenhouseSetting.system_type == system_type)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Создание новой настройки
        setting = GreenhouseSetting(
            system_type=system_type,
            current_value=setting_data.current_value or 0,
            target_value=setting_data.target_value or 0,
            min_value=setting_data.min_value or 0,
            max_value=setting_data.max_value or 100,
            is_auto=setting_data.is_auto or False
        )
        db.add(setting)
    else:
        # Обновление существующей
        update_data = setting_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(setting, field, value)
    
    await db.commit()
    await db.refresh(setting)
    
    logger.info(f"Пользователь {current_user.username} обновил настройки {system_type}")
    
    return GreenhouseSettingResponse.model_validate(setting)


@router.post("/watering")
async def control_watering(
    request: WateringRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Управление поливом"""
    result = await db.execute(
        select(GreenhouseSetting).where(GreenhouseSetting.system_type == "watering")
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = GreenhouseSetting(system_type="watering", current_value=0)
        db.add(setting)
    
    previous_value = float(setting.current_value)
    
    if request.action == "set_level" and request.value is not None:
        setting.current_value = request.value
        setting.target_value = request.value
    elif request.action == "start":
        setting.current_value = 100
    elif request.action == "stop":
        setting.current_value = 0
    
    # Запись в историю
    history = GreenhouseHistory(
        system_type="watering",
        previous_value=previous_value,
        new_value=float(setting.current_value),
        changed_by=current_user.id
    )
    db.add(history)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} изменил полив: {previous_value} -> {setting.current_value}")
    
    return {
        "status": "success",
        "data": {
            "system": "watering",
            "previous_value": previous_value,
            "new_value": float(setting.current_value),
            "estimated_completion": datetime.utcnow()
        }
    }


@router.post("/lighting")
async def control_lighting(
    request: LightingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Управление освещением"""
    result = await db.execute(
        select(GreenhouseSetting).where(GreenhouseSetting.system_type == "lighting")
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = GreenhouseSetting(system_type="lighting", current_value=0)
        db.add(setting)
    
    previous_value = float(setting.current_value)
    
    if request.action == "set_level" and request.value is not None:
        setting.current_value = request.value
    elif request.action == "start":
        setting.current_value = 100
    elif request.action == "stop":
        setting.current_value = 0
    
    history = GreenhouseHistory(
        system_type="lighting",
        previous_value=previous_value,
        new_value=float(setting.current_value),
        changed_by=current_user.id
    )
    db.add(history)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} изменил освещение: {previous_value} -> {setting.current_value}")
    
    return {
        "status": "success",
        "data": {
            "system": "lighting",
            "previous_value": previous_value,
            "new_value": float(setting.current_value)
        }
    }


@router.post("/ventilation")
async def control_ventilation(
    request: VentilationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Управление вентиляцией"""
    result = await db.execute(
        select(GreenhouseSetting).where(GreenhouseSetting.system_type == "ventilation")
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = GreenhouseSetting(system_type="ventilation", current_value=0)
        db.add(setting)
    
    previous_value = float(setting.current_value)
    
    if request.action == "set_level" and request.value is not None:
        setting.current_value = request.value
    elif request.action == "start":
        setting.current_value = 100
    elif request.action == "stop":
        setting.current_value = 0
    
    history = GreenhouseHistory(
        system_type="ventilation",
        previous_value=previous_value,
        new_value=float(setting.current_value),
        changed_by=current_user.id
    )
    db.add(history)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} изменил вентиляцию: {previous_value} -> {setting.current_value}")
    
    return {
        "status": "success",
        "data": {
            "system": "ventilation",
            "previous_value": previous_value,
            "new_value": float(setting.current_value)
        }
    }


@router.get("/history", response_model=List[GreenhouseHistoryResponse])
async def get_history(
    system_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """История изменений параметров"""
    query = select(GreenhouseHistory).order_by(GreenhouseHistory.created_at.desc()).limit(limit)
    
    if system_type:
        query = query.where(GreenhouseHistory.system_type == system_type)
    
    result = await db.execute(query)
    history = result.scalars().all()
    
    return [GreenhouseHistoryResponse.model_validate(h) for h in history]


@router.get("/schedules")
async def get_schedules(db: AsyncSession = Depends(get_db)):
    """Получение расписаний работы"""
    result = await db.execute(select(Schedule))
    schedules = result.scalars().all()
    return {"schedules": schedules}


@router.put("/schedules")
async def update_schedule(
    schedule_id: int,
    schedule_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление расписания"""
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Расписание не найдено"
        )
    
    for key, value in schedule_data.items():
        if hasattr(schedule, key):
            setattr(schedule, key, value)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} обновил расписание {schedule_id}")
    
    return {"status": "success", "schedule_id": schedule_id}
