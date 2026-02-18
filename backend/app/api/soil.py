"""
API роуты для аналитики почвы
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.db.database import get_db
from app.models.models import SoilAnalysis, SoilZone, User
from app.schemas.schemas import (
    SoilAnalysisResponse, SoilZoneResponse,
    SoilRecommendation
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger("soil")

router = APIRouter(prefix="/soil", tags=["Почва"])


@router.get("/current")
async def get_current_soil_analysis(
    zone_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Текущие показатели почвы"""
    query = select(SoilAnalysis).order_by(desc(SoilAnalysis.analyzed_at))
    
    if zone_id:
        query = query.where(SoilAnalysis.zone_id == zone_id)
    
    result = await db.execute(query.limit(1))
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        # Демо-данные
        demo_data = {
            "analysis_id": "demo-001",
            "timestamp": datetime.utcnow(),
            "zones": [
                {
                    "zone_id": "A",
                    "moisture": 78,
                    "ph": 6.5,
                    "npk": {"n": 85, "p": 72, "k": 92},
                    "temperature": 22,
                    "conductivity": 1.8,
                    "status": "optimal"
                },
                {
                    "zone_id": "B",
                    "moisture": 65,
                    "ph": 6.8,
                    "npk": {"n": 78, "p": 68, "k": 88},
                    "temperature": 21,
                    "conductivity": 1.6,
                    "status": "optimal"
                }
            ],
            "recommendations": [
                {"type": "info", "zone": "A", "action": "Параметры в норме"},
                {"type": "info", "zone": "B", "action": "Параметры в норме"}
            ]
        }
        return demo_data
    
    return {
        "analysis_id": analysis.id,
        "timestamp": analysis.analyzed_at,
        "zones": [{
            "zone_id": analysis.zone_id,
            "moisture": float(analysis.moisture) if analysis.moisture else None,
            "ph": float(analysis.ph) if analysis.ph else None,
            "npk": {
                "n": float(analysis.npk_n) if analysis.npk_n else None,
                "p": float(analysis.npk_p) if analysis.npk_p else None,
                "k": float(analysis.npk_k) if analysis.npk_k else None
            },
            "temperature": float(analysis.temperature) if analysis.temperature else None,
            "conductivity": float(analysis.conductivity) if analysis.conductivity else None,
            "status": analysis.status
        }],
        "recommendations": analysis.recommendations
    }


@router.post("/analyze")
async def trigger_analysis(
    zone_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Запуск анализа почвы"""
    # Получаем зоны
    zones_query = select(SoilZone)
    if zone_id:
        zones_query = zones_query.where(SoilZone.name == zone_id)
    
    zones_result = await db.execute(zones_query)
    zones = zones_result.scalars().all()
    
    if not zones:
        # Создаем демо-зоны
        zones = [
            SoilZone(id=1, name="A", area_sqm=100),
            SoilZone(id=2, name="B", area_sqm=150)
        ]
    
    analyses = []
    for zone in zones:
        # Эмуляция анализа
        analysis = SoilAnalysis(
            zone_id=zone.name,
            moisture=70 + (hash(zone.name) % 20),
            ph=6.0 + (hash(zone.name) % 10) / 10,
            npk_n=80 + (hash(zone.name) % 15),
            npk_p=70 + (hash(zone.name) % 20),
            npk_k=85 + (hash(zone.name) % 10),
            temperature=20 + (hash(zone.name) % 5),
            conductivity=1.5 + (hash(zone.name) % 5) / 10,
            status="optimal",
            recommendations=[{"type": "info", "action": "Параметры в норме"}]
        )
        db.add(analysis)
        analyses.append(analysis)
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} запустил анализ почвы для зон: {[z.name for z in zones]}")
    
    return {
        "status": "success",
        "message": f"Анализ завершен для {len(analyses)} зон",
        "analyses": [SoilAnalysisResponse.model_validate(a) for a in analyses]
    }


@router.get("/history")
async def get_soil_history(
    zone_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """История анализов"""
    query = select(SoilAnalysis).order_by(desc(SoilAnalysis.analyzed_at)).limit(limit)
    
    if zone_id:
        query = query.where(SoilAnalysis.zone_id == zone_id)
    
    result = await db.execute(query)
    analyses = result.scalars().all()
    
    return {
        "history": [SoilAnalysisResponse.model_validate(a) for a in analyses]
    }


@router.get("/zones", response_model=List[SoilZoneResponse])
async def get_zones(db: AsyncSession = Depends(get_db)):
    """Зоны мониторинга"""
    result = await db.execute(select(SoilZone))
    zones = result.scalars().all()
    
    if not zones:
        # Демо-данные
        demo_zones = [
            SoilZone(id=1, name="A", area_sqm=100, coordinates=[
                {"lat": 55.7558, "lng": 37.6173},
                {"lat": 55.7560, "lng": 37.6173},
                {"lat": 55.7560, "lng": 37.6180},
                {"lat": 55.7558, "lng": 37.6180}
            ]),
            SoilZone(id=2, name="B", area_sqm=150, coordinates=[
                {"lat": 55.7560, "lng": 37.6173},
                {"lat": 55.7565, "lng": 37.6173},
                {"lat": 55.7565, "lng": 37.6185},
                {"lat": 55.7560, "lng": 37.6185}
            ])
        ]
        return demo_zones
    
    return [SoilZoneResponse.model_validate(z) for z in zones]


@router.get("/recommendations")
async def get_recommendations(
    zone_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Рекомендации"""
    # Получаем последний анализ
    query = select(SoilAnalysis).order_by(desc(SoilAnalysis.analyzed_at))
    
    if zone_id:
        query = query.where(SoilAnalysis.zone_id == zone_id)
    
    result = await db.execute(query.limit(5))
    analyses = result.scalars().all()
    
    recommendations = []
    
    for analysis in analyses:
        zone_recs = []
        
        # Проверка влажности
        if analysis.moisture:
            moisture = float(analysis.moisture)
            if moisture < 50:
                zone_recs.append({
                    "type": "action",
                    "zone": analysis.zone_id,
                    "action": "Требуется полив - низкая влажность",
                    "priority": 1
                })
            elif moisture > 85:
                zone_recs.append({
                    "type": "warning",
                    "zone": analysis.zone_id,
                    "action": "Избыточная влажность - сократить полив",
                    "priority": 2
                })
        
        # Проверка pH
        if analysis.ph:
            ph = float(analysis.ph)
            if ph < 5.5:
                zone_recs.append({
                    "type": "action",
                    "zone": analysis.zone_id,
                    "action": "Почва слишком кислая - требуется известкование",
                    "priority": 1
                })
            elif ph > 7.5:
                zone_recs.append({
                    "type": "warning",
                    "zone": analysis.zone_id,
                    "action": "Почва щелочная - требуется подкисление",
                    "priority": 2
                })
        
        # Проверка NPK
        if analysis.npk_n and float(analysis.npk_n) < 60:
            zone_recs.append({
                "type": "action",
                "zone": analysis.zone_id,
                "action": "Недостаток азота - внести азотные удобрения",
                "priority": 1
            })
        
        if not zone_recs:
            zone_recs.append({
                "type": "info",
                "zone": analysis.zone_id,
                "action": "Параметры в норме",
                "priority": 3
            })
        
        recommendations.extend(zone_recs)
    
    return {"recommendations": recommendations}


@router.post("/auto-adjust")
async def auto_adjust(
    zone_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Авто-корректировка параметров"""
    # Получаем последний анализ зоны
    result = await db.execute(
        select(SoilAnalysis)
        .where(SoilAnalysis.zone_id == zone_id)
        .order_by(desc(SoilAnalysis.analyzed_at))
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Анализ для зоны {zone_id} не найден"
        )
    
    adjustments = []
    
    # Авто-корректировка на основе анализа
    if analysis.moisture and float(analysis.moisture) < 50:
        adjustments.append({"action": "watering", "value": 80, "duration_minutes": 30})
    
    if analysis.ph and float(analysis.ph) < 5.5:
        adjustments.append({"action": "lime", "amount_kg": 5})
    
    if analysis.npk_n and float(analysis.npk_n) < 60:
        adjustments.append({"action": "fertilize", "type": "nitrogen", "amount_kg": 3})
    
    logger.info(f"Пользователь {current_user.username} запустил авто-корректировку для зоны {zone_id}")
    
    return {
        "status": "success",
        "zone_id": zone_id,
        "adjustments": adjustments
    }


@router.get("/export")
async def export_data(
    format: str = "json",
    zone_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Экспорт данных"""
    query = select(SoilAnalysis).order_by(desc(SoilAnalysis.analyzed_at))
    
    if zone_id:
        query = query.where(SoilAnalysis.zone_id == zone_id)
    
    result = await db.execute(query.limit(100))
    analyses = result.scalars().all()
    
    data = [SoilAnalysisResponse.model_validate(a) for a in analyses]
    
    if format == "csv":
        # CSV экспорт
        import io
        output = io.StringIO()
        if data:
            headers = ["id", "zone_id", "moisture", "ph", "npk_n", "npk_p", "npk_k", "temperature", "conductivity", "status", "analyzed_at"]
            output.write(",".join(headers) + "\n")
            for item in data:
                row = [str(getattr(item, h, "")) for h in headers]
                output.write(",".join(row) + "\n")
        
        return {
            "format": "csv",
            "data": output.getvalue()
        }
    
    return {
        "format": format,
        "count": len(data),
        "data": data
    }
