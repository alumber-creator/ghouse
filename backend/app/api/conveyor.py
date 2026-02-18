"""
API роуты для управления конвейером
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.db.database import get_db
from app.models.models import ConveyorStatus, ConveyorStatistic, User, AuditLog
from app.schemas.schemas import (
    ConveyorStatusResponse, ConveyorSpeedUpdate,
    ConveyorIntervalUpdate, ConveyorStatisticsResponse
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger("conveyor")

router = APIRouter(prefix="/conveyor", tags=["Конвейер"])


@router.get("/status", response_model=ConveyorStatusResponse)
async def get_conveyor_status(db: AsyncSession = Depends(get_db)):
    """Текущий статус конвейера"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        # Демо-данные
        return {
            "id": 1,
            "is_running": False,
            "speed": 0.5,
            "interval_seconds": 30,
            "total_transported": 1250,
            "shift_count": 3,
            "work_time_seconds": 14400,
            "efficiency": 92.5,
            "last_maintenance": date.today() - timedelta(days=14),
            "next_maintenance": date.today() + timedelta(days=16),
            "updated_at": datetime.utcnow()
        }
    
    return ConveyorStatusResponse.model_validate(conveyor)


@router.post("/start")
async def start_conveyor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Запуск конвейера"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        conveyor = ConveyorStatus(
            is_running=False,
            speed=0.5,
            interval_seconds=30,
            total_transported=0,
            work_time_seconds=0,
            efficiency=100
        )
        db.add(conveyor)
    
    if conveyor.is_running:
        return {"status": "already_running", "message": "Конвейер уже запущен"}
    
    conveyor.is_running = True
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} запустил конвейер")
    
    return {
        "status": "success",
        "message": "Конвейер запущен",
        "timestamp": datetime.utcnow()
    }


@router.post("/stop")
async def stop_conveyor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Остановка конвейера"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Конвейер не найден"
        )
    
    if not conveyor.is_running:
        return {"status": "already_stopped", "message": "Конвейер уже остановлен"}
    
    conveyor.is_running = False
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} остановил конвейер")
    
    return {
        "status": "success",
        "message": "Конвейер остановлен",
        "timestamp": datetime.utcnow()
    }


@router.post("/reset")
async def reset_counters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Сброс счётчиков"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Конвейер не найден"
        )
    
    conveyor.shift_count = 0
    conveyor.work_time_seconds = 0
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} сбросил счётчики конвейера")
    
    return {
        "status": "success",
        "message": "Счётчики сброшены"
    }


@router.put("/speed")
async def set_speed(
    speed_data: ConveyorSpeedUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Установка скорости"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        conveyor = ConveyorStatus(speed=speed_data.speed)
        db.add(conveyor)
    else:
        conveyor.speed = speed_data.speed
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} установил скорость конвейера: {speed_data.speed}")
    
    return {
        "status": "success",
        "speed": speed_data.speed
    }


@router.put("/interval")
async def set_interval(
    interval_data: ConveyorIntervalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Установка интервала"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Конвейер не найден"
        )
    
    conveyor.interval_seconds = interval_data.interval_seconds
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} установил интервал конвейера: {interval_data.interval_seconds}")
    
    return {
        "status": "success",
        "interval_seconds": interval_data.interval_seconds
    }


@router.get("/statistics")
async def get_statistics(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """Статистика работы"""
    if not from_date:
        from_date = date.today() - timedelta(days=7)
    if not to_date:
        to_date = date.today()
    
    result = await db.execute(
        select(ConveyorStatistic).where(
            ConveyorStatistic.date >= from_date,
            ConveyorStatistic.date <= to_date
        ).order_by(ConveyorStatistic.date.desc())
    )
    statistics = result.scalars().all()
    
    if not statistics:
        # Демо-данные
        demo_stats = []
        for i in range(7):
            d = date.today() - timedelta(days=i)
            demo_stats.append({
                "date": d,
                "items_transported": 150 + i * 10,
                "work_time_seconds": 28800,
                "avg_speed": 0.5,
                "avg_efficiency": 92.0,
                "downtime_seconds": 3600
            })
        return {"statistics": demo_stats}
    
    return {
        "statistics": [ConveyorStatisticsResponse.model_validate(s) for s in statistics]
    }


@router.get("/maintenance")
async def get_maintenance_info(db: AsyncSession = Depends(get_db)):
    """Информация об обслуживании"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        return {
            "last_maintenance": date.today() - timedelta(days=14),
            "next_maintenance": date.today() + timedelta(days=16),
            "maintenance_interval_days": 30,
            "status": "ok"
        }
    
    days_until = (conveyor.next_maintenance - date.today()).days if conveyor.next_maintenance else 0
    
    return {
        "last_maintenance": conveyor.last_maintenance,
        "next_maintenance": conveyor.next_maintenance,
        "maintenance_interval_days": 30,
        "days_until_maintenance": days_until,
        "status": "warning" if days_until < 7 else "ok"
    }


@router.post("/maintenance/log")
async def log_maintenance(
    maintenance_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Запись об обслуживании"""
    result = await db.execute(select(ConveyorStatus).limit(1))
    conveyor = result.scalar_one_or_none()
    
    if not conveyor:
        conveyor = ConveyorStatus()
        db.add(conveyor)
    
    maintenance_type = maintenance_data.get("type", "regular")
    description = maintenance_data.get("description", "")
    
    if maintenance_type == "regular":
        conveyor.last_maintenance = date.today()
        conveyor.next_maintenance = date.today() + timedelta(days=30)
    
    # Запись в аудит
    audit = AuditLog(
        user_id=current_user.id,
        action="maintenance_log",
        resource="conveyor",
        new_values=maintenance_data
    )
    db.add(audit)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} записал обслуживание конвейера: {maintenance_type}")
    
    return {
        "status": "success",
        "last_maintenance": conveyor.last_maintenance,
        "next_maintenance": conveyor.next_maintenance
    }
