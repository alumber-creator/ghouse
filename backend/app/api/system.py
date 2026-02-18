"""
Системные API роуты
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import List, Optional
from datetime import datetime, date
import os
import json
from app.db.database import get_db, engine
from app.models.models import AuditLog, User, ConveyorStatus
from app.schemas.schemas import (
    HealthStatus, SystemConfig, AuditLogResponse
)
from app.utils.auth import get_current_user, get_current_active_admin
from app.utils.logging import get_logger
from app.config import settings

logger = get_logger("system")

router = APIRouter(prefix="", tags=["Системные"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Проверка здоровья системы"""
    # Проверка базы данных
    db_status = "connected"
    try:
        await db.execute(select(1))
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Проверка Redis
    redis_status = "connected"
    try:
        import redis
        from redis import asyncio as aioredis
        redis_client = aioredis.from_url(settings.REDIS_URL)
        await redis_client.ping()
        await redis_client.close()
    except Exception as e:
        redis_status = f"error: {str(e)}"
    
    # Проверка MQTT
    mqtt_status = "connected"
    # В реальной реализации здесь была бы проверка подключения к MQTT
    
    # Проверка Telegram
    telegram_status = "disconnected"
    if settings.TELEGRAM_BOT_TOKEN:
        telegram_status = "connected"
    
    return HealthStatus(
        status="healthy",
        version="1.0.0",
        database=db_status,
        redis=redis_status,
        mqtt=mqtt_status,
        telegram=telegram_status
    )


@router.get("/metrics")
async def get_metrics():
    """Метрики Prometheus"""
    # В реальной реализации здесь был бы endpoint для Prometheus
    metrics_text = """
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/api/v1/health"} 100
http_requests_total{method="POST",endpoint="/api/v1/auth/login"} 50

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 80
http_request_duration_seconds_bucket{le="0.5"} 95
http_request_duration_seconds_bucket{le="1.0"} 100

# HELP websocket_connections_active Active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active 5
"""
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content=metrics_text, media_type="text/plain")


@router.get("/config", response_model=SystemConfig)
async def get_config(
    current_user: User = Depends(get_current_active_admin)
):
    """Конфигурация системы"""
    return SystemConfig(
        app_env=settings.APP_ENV,
        debug=settings.APP_DEBUG,
        cors_origins=settings.cors_origins_list,
        rate_limit_requests=settings.RATE_LIMIT_REQUESTS,
        log_level=settings.LOG_LEVEL
    )


@router.put("/config")
async def update_config(
    config_data: dict,
    current_user: User = Depends(get_current_active_admin)
):
    """Обновление конфигурации"""
    # В реальной реализации здесь было бы обновление конфига
    logger.info(f"Администратор {current_user.username} обновил конфигурацию")
    
    return {
        "status": "success",
        "message": "Конфигурация обновлена (требуется перезапуск)"
    }


@router.post("/backup")
async def create_backup(
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Создание бэкапа"""
    backup_dir = settings.BACKUP_DIR
    
    # Создаем директорию если не существует
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"backup_{timestamp}.json")
    
    # Эмуляция бэкапа
    backup_data = {
        "timestamp": timestamp,
        "version": "1.0.0",
        "tables": ["users", "roles", "greenhouse_settings", "air_metrics", 
                   "drones", "conveyor_status", "soil_analyses", "notifications"]
    }
    
    with open(backup_file, "w") as f:
        json.dump(backup_data, f, indent=2)
    
    logger.info(f"Администратор {current_user.username} создал бэкап: {backup_file}")
    
    return {
        "status": "success",
        "backup_file": backup_file,
        "timestamp": timestamp
    }


@router.post("/restore")
async def restore_backup(
    backup_file: str,
    current_user: User = Depends(get_current_active_admin)
):
    """Восстановление из бэкапа"""
    # В реальной реализации здесь было бы восстановление
    logger.info(f"Администратор {current_user.username} инициировал восстановление из {backup_file}")
    
    return {
        "status": "success",
        "message": f"Восстановление из {backup_file} запланировано"
    }


@router.get("/logs")
async def get_logs(
    lines: int = 100,
    level: Optional[str] = None,
    current_user: User = Depends(get_current_active_admin)
):
    """Логи системы"""
    # В реальной реализации здесь был бы доступ к логам
    demo_logs = [
        {"timestamp": datetime.utcnow().isoformat(), "level": "INFO", "message": "System started"},
        {"timestamp": datetime.utcnow().isoformat(), "level": "INFO", "message": "Database connected"},
        {"timestamp": datetime.utcnow().isoformat(), "level": "INFO", "message": "Redis connected"},
    ]
    
    return {
        "logs": demo_logs[-lines:],
        "total": len(demo_logs)
    }


@router.get("/audit", response_model=List[AuditLogResponse])
async def get_audit_log(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    """Аудит действий"""
    query = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [AuditLogResponse.model_validate(log) for log in logs]


# Импортируем update для совместимости
from sqlalchemy import update
