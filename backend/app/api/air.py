"""
API роуты для мониторинга воздуха
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from datetime import datetime, timedelta
from app.db.database import get_db
from app.models.models import AirMetric, AirThreshold, User, Notification
from app.schemas.schemas import (
    AirMetricsResponse, AirThresholdResponse,
    AirThresholdUpdate, AirAlert
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger("air_monitoring")

router = APIRouter(prefix="/air", tags=["Мониторинг воздуха"])


@router.get("/current")
async def get_current_air_metrics(db: AsyncSession = Depends(get_db)):
    """Текущие показатели воздуха"""
    # Получаем последнюю запись
    result = await db.execute(
        select(AirMetric).order_by(desc(AirMetric.recorded_at)).limit(1)
    )
    metric = result.scalar_one_or_none()
    
    if not metric:
        # Возвращаем демо-данные
        return {
            "temperature": 24.5,
            "humidity": 65.0,
            "co2": 450,
            "pressure": 760,
            "timestamp": datetime.utcnow(),
            "status": "optimal"
        }
    
    # Проверка порогов
    thresholds_result = await db.execute(select(AirThreshold))
    thresholds = {t.metric_name: t for t in thresholds_result.scalars().all()}
    
    alerts = []
    status = "optimal"
    
    for metric_name, value in [
        ("temperature", metric.temperature),
        ("humidity", metric.humidity),
        ("co2", metric.co2),
        ("pressure", metric.pressure)
    ]:
        if value is None:
            continue
        threshold = thresholds.get(metric_name)
        if threshold:
            if value < float(threshold.min_value) or value > float(threshold.max_value):
                alerts.append({
                    "metric": metric_name,
                    "value": float(value),
                    "min": float(threshold.min_value),
                    "max": float(threshold.max_value)
                })
                status = "warning"
    
    return {
        "id": metric.id,
        "temperature": float(metric.temperature) if metric.temperature else None,
        "humidity": float(metric.humidity) if metric.humidity else None,
        "co2": float(metric.co2) if metric.co2 else None,
        "pressure": float(metric.pressure) if metric.pressure else None,
        "recorded_at": metric.recorded_at,
        "status": status,
        "alerts": alerts
    }


@router.get("/history")
async def get_air_history(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    interval: str = "5m",
    metrics: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """История показателей"""
    if not from_date:
        from_date = datetime.utcnow() - timedelta(hours=24)
    if not to_date:
        to_date = datetime.utcnow()
    
    query = select(AirMetric).where(
        AirMetric.recorded_at >= from_date,
        AirMetric.recorded_at <= to_date
    ).order_by(AirMetric.recorded_at)
    
    result = await db.execute(query)
    metrics_list = result.scalars().all()
    
    # Фильтрация по метрикам
    metric_fields = metrics.split(",") if metrics else ["temperature", "humidity", "co2", "pressure"]
    
    history = []
    for m in metrics_list:
        data_point = {"timestamp": m.recorded_at}
        for field in metric_fields:
            if hasattr(m, field):
                value = getattr(m, field)
                data_point[field] = float(value) if value else None
        history.append(data_point)
    
    return {
        "from": from_date,
        "to": to_date,
        "interval": interval,
        "data": history
    }


@router.get("/thresholds", response_model=List[AirThresholdResponse])
async def get_thresholds(db: AsyncSession = Depends(get_db)):
    """Пороговые значения"""
    result = await db.execute(select(AirThreshold))
    thresholds = result.scalars().all()
    
    if not thresholds:
        # Создаем дефолтные пороги
        default_thresholds = [
            AirThreshold(metric_name="temperature", min_value=18, max_value=30, unit="°C"),
            AirThreshold(metric_name="humidity", min_value=40, max_value=80, unit="%"),
            AirThreshold(metric_name="co2", min_value=300, max_value=1000, unit="ppm"),
            AirThreshold(metric_name="pressure", min_value=740, max_value=780, unit="мм рт.ст.")
        ]
        db.add_all(default_thresholds)
        await db.commit()
        return [AirThresholdResponse.model_validate(t) for t in default_thresholds]
    
    return [AirThresholdResponse.model_validate(t) for t in thresholds]


@router.put("/thresholds")
async def update_thresholds(
    threshold_id: int,
    threshold_data: AirThresholdUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление порогов"""
    result = await db.execute(select(AirThreshold).where(AirThreshold.id == threshold_id))
    threshold = result.scalar_one_or_none()
    
    if not threshold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Порог не найден"
        )
    
    update_data = threshold_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(threshold, field, value)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} обновил порог {threshold_id}")
    
    return AirThresholdResponse.model_validate(threshold)


@router.get("/alerts")
async def get_alerts(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Активные алерты"""
    # Получаем текущие метрики
    result = await db.execute(
        select(AirMetric).order_by(desc(AirMetric.recorded_at)).limit(1)
    )
    metric = result.scalar_one_or_none()
    
    if not metric:
        return {"alerts": []}
    
    # Получаем пороги
    thresholds_result = await db.execute(select(AirThreshold))
    thresholds = {t.metric_name: t for t in thresholds_result.scalars().all()}
    
    alerts = []
    for metric_name, value in [
        ("temperature", metric.temperature),
        ("humidity", metric.humidity),
        ("co2", metric.co2),
        ("pressure", metric.pressure)
    ]:
        if value is None:
            continue
        threshold = thresholds.get(metric_name)
        if threshold:
            value_float = float(value)
            min_val = float(threshold.min_value)
            max_val = float(threshold.max_value)
            
            if value_float < min_val or value_float > max_val:
                severity = "critical" if (
                    value_float < min_val * 0.8 or value_float > max_val * 1.2
                ) else "warning"
                
                alerts.append({
                    "id": metric.id,
                    "metric_name": metric_name,
                    "current_value": value_float,
                    "threshold_min": min_val,
                    "threshold_max": max_val,
                    "status": severity,
                    "created_at": metric.recorded_at
                })
    
    return {"alerts": alerts}


@router.post("/alerts/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Подтверждение алерта"""
    logger.info(f"Пользователь {current_user.username} подтвердил алерт {alert_id}")
    
    return {
        "status": "success",
        "message": f"Алерт {alert_id} подтвержден"
    }


@router.get("/analytics")
async def get_analytics(
    period: str = "24h",
    db: AsyncSession = Depends(get_db)
):
    """Аналитика и тренды"""
    # Определяем период
    if period == "24h":
        from_date = datetime.utcnow() - timedelta(hours=24)
    elif period == "7d":
        from_date = datetime.utcnow() - timedelta(days=7)
    elif period == "30d":
        from_date = datetime.utcnow() - timedelta(days=30)
    else:
        from_date = datetime.utcnow() - timedelta(hours=24)
    
    # Получаем метрики за период
    result = await db.execute(
        select(AirMetric).where(AirMetric.recorded_at >= from_date)
    )
    metrics = result.scalars().all()
    
    if not metrics:
        return {
            "period": period,
            "temperature": {"avg": 0, "min": 0, "max": 0},
            "humidity": {"avg": 0, "min": 0, "max": 0},
            "co2": {"avg": 0, "min": 0, "max": 0},
            "pressure": {"avg": 0, "min": 0, "max": 0}
        }
    
    # Вычисляем статистику
    def calc_stats(values):
        valid = [v for v in values if v is not None]
        if not valid:
            return {"avg": 0, "min": 0, "max": 0}
        return {
            "avg": round(sum(valid) / len(valid), 2),
            "min": round(min(valid), 2),
            "max": round(max(valid), 2)
        }
    
    return {
        "period": period,
        "data_points": len(metrics),
        "temperature": calc_stats([m.temperature for m in metrics]),
        "humidity": calc_stats([m.humidity for m in metrics]),
        "co2": calc_stats([m.co2 for m in metrics]),
        "pressure": calc_stats([m.pressure for m in metrics])
    }
