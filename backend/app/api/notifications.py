"""
API роуты для системы уведомлений
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.models.models import Notification, NotificationSettings, User
from app.schemas.schemas import (
    NotificationResponse, NotificationSettingsResponse,
    NotificationSettingsUpdate
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger("notifications")

router = APIRouter(prefix="/notifications", tags=["Уведомления"])


@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Список уведомлений"""
    query = select(Notification).where(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(desc(Notification.created_at)).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return [NotificationResponse.model_validate(n) for n in notifications]


@router.get("/unread")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Количество непрочитанных уведомлений"""
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    )
    unread = result.scalars().all()
    
    return {
        "count": len(unread),
        "notifications": [NotificationResponse.model_validate(n) for n in unread[:10]]
    }


@router.post("/read")
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отметить уведомление прочитанным"""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Уведомление не найдено"
        )
    
    notification.is_read = True
    await db.commit()
    
    return {"status": "success", "notification_id": notification_id}


@router.post("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Прочитать все уведомления"""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
        .values(is_read=True)
    )
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} прочитал все уведомления")
    
    return {"status": "success"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить уведомление"""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Уведомление не найдено"
        )
    
    await db.delete(notification)
    await db.commit()
    
    return {"status": "success", "notification_id": notification_id}


@router.get("/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Настройки уведомлений"""
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = NotificationSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return NotificationSettingsResponse.model_validate(settings)


@router.put("/settings", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    settings_data: NotificationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление настроек уведомлений"""
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = NotificationSettings(user_id=current_user.id)
        db.add(settings)
    
    update_data = settings_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    await db.commit()
    await db.refresh(settings)
    
    logger.info(f"Пользователь {current_user.username} обновил настройки уведомлений")
    
    return NotificationSettingsResponse.model_validate(settings)


# Импортируем update для SQLAlchemy
from sqlalchemy import update
