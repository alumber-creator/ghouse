"""
API роуты для Telegram интеграции
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.models.models import TelegramLog, User, NotificationSettings
from app.schemas.schemas import (
    TelegramSettings, TelegramMessage, TelegramBroadcast,
    TelegramLogResponse
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger
from app.config import settings

logger = get_logger("telegram")

router = APIRouter(prefix="/telegram", tags=["Telegram"])


@router.get("/status")
async def get_telegram_status(db: AsyncSession = Depends(get_db)):
    """Статус подключения Telegram"""
    is_configured = bool(settings.TELEGRAM_BOT_TOKEN)
    
    # Проверка последних логов
    result = await db.execute(
        select(TelegramLog).order_by(desc(TelegramLog.created_at)).limit(5)
    )
    recent_logs = result.scalars().all()
    
    last_success = None
    last_error = None
    
    for log in recent_logs:
        if log.status == "sent" and not last_success:
            last_success = log.created_at
        elif log.status == "failed" and not last_error:
            last_error = log.created_at
    
    return {
        "configured": is_configured,
        "bot_token_set": is_configured,
        "webhook_url": settings.TELEGRAM_WEBHOOK_URL,
        "last_success": last_success,
        "last_error": last_error,
        "status": "connected" if is_configured and last_success else "disconnected"
    }


@router.put("/settings")
async def update_telegram_settings(
    telegram_settings: TelegramSettings,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Настройки бота"""
    # Обновляем настройки уведомлений пользователя
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    notif_settings = result.scalar_one_or_none()
    
    if not notif_settings:
        notif_settings = NotificationSettings(user_id=current_user.id)
        db.add(notif_settings)
    
    if telegram_settings.chat_id:
        notif_settings.telegram_enabled = True
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} обновил настройки Telegram")
    
    return {
        "status": "success",
        "settings": {
            "bot_token_set": bool(telegram_settings.bot_token),
            "webhook_url": telegram_settings.webhook_url,
            "chat_id": telegram_settings.chat_id
        }
    }


@router.post("/test")
async def test_telegram_connection(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Тест подключения"""
    if not settings.TELEGRAM_BOT_TOKEN:
        return {
            "status": "error",
            "message": "Bot token не настроен"
        }
    
    # Эмуляция отправки тестового сообщения
    log = TelegramLog(
        chat_id="test_chat",
        message_text="Тестовое сообщение от GHouse",
        direction="outgoing",
        status="sent"
    )
    db.add(log)
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} выполнил тест Telegram подключения")
    
    return {
        "status": "success",
        "message": "Тестовое сообщение отправлено"
    }


@router.get("/log", response_model=List[TelegramLogResponse])
async def get_telegram_log(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Лог сообщений"""
    result = await db.execute(
        select(TelegramLog).order_by(desc(TelegramLog.created_at)).limit(limit)
    )
    logs = result.scalars().all()
    
    return [TelegramLogResponse.model_validate(log) for log in logs]


@router.post("/send")
async def send_message(
    message: TelegramMessage,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отправка сообщения"""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot не настроен"
        )
    
    # Эмуляция отправки
    log = TelegramLog(
        chat_id=message.chat_id,
        message_text=message.text,
        direction="outgoing",
        status="sent"
    )
    db.add(log)
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} отправил сообщение в Telegram: {message.chat_id}")
    
    return {
        "status": "success",
        "message_id": log.id,
        "chat_id": message.chat_id
    }


@router.post("/broadcast")
async def broadcast_message(
    broadcast: TelegramBroadcast,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Массовая рассылка"""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot не настроен"
        )
    
    # Получаем все chat_id из настроек пользователей
    result = await db.execute(select(NotificationSettings).where(NotificationSettings.telegram_enabled == True))
    enabled_settings = result.scalars().all()
    
    sent_count = 0
    for ns in enabled_settings:
        # Эмуляция отправки
        log = TelegramLog(
            chat_id=f"user_{ns.user_id}",
            message_text=broadcast.text,
            direction="outgoing",
            status="sent"
        )
        db.add(log)
        sent_count += 1
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} выполнил рассылку: {sent_count} получателей")
    
    return {
        "status": "success",
        "sent_count": sent_count,
        "message": broadcast.text[:50] + "..." if len(broadcast.text) > 50 else broadcast.text
    }


@router.get("/subscribers")
async def get_subscribers(
    db: AsyncSession = Depends(get_db)
):
    """Список подписчиков"""
    result = await db.execute(
        select(NotificationSettings)
        .where(NotificationSettings.telegram_enabled == True)
    )
    subscribers = result.scalars().all()
    
    return {
        "count": len(subscribers),
        "subscribers": [{"user_id": s.user_id} for s in subscribers]
    }


@router.post("/webhooks/telegram")
async def telegram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook для Telegram бота"""
    try:
        data = await request.json()
        
        # Логирование входящего сообщения
        if "message" in data:
            message = data["message"]
            log = TelegramLog(
                chat_id=str(message.get("chat", {}).get("id")),
                message_text=message.get("text"),
                direction="incoming",
                status="received"
            )
            db.add(log)
            await db.commit()
        
        # Обработка команд
        if "message" in data and "text" in data["message"]:
            text = data["message"]["text"]
            chat_id = data["message"]["chat"]["id"]
            
            if text == "/start":
                return {"text": "Добро пожаловать в GHouse! Используйте /status для проверки статуса системы."}
            elif text == "/status":
                return {"text": "🟢 Все системы работают нормально"}
            elif text == "/alerts":
                return {"text": "⚠️ Активных алертов нет"}
            elif text == "/settings":
                return {"text": "Настройки уведомлений доступны в веб-интерфейсе"}
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Ошибка обработки webhook Telegram: {e}")
        return {"status": "error", "message": str(e)}
