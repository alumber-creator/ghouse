"""
API роуты для управления дронами
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.models.models import Drone, DroneMission, ChargingStation, User
from app.schemas.schemas import (
    DroneResponse, DroneCreate, DroneUpdate,
    DroneCommand, DroneMissionResponse,
    ChargingStationResponse
)
from app.utils.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger("drones")

router = APIRouter(prefix="/drones", tags=["Дроны"])


@router.get("", response_model=List[DroneResponse])
async def get_drones(db: AsyncSession = Depends(get_db)):
    """Список всех дронов"""
    result = await db.execute(select(Drone))
    drones = result.scalars().all()
    
    if not drones:
        # Демо-данные
        demo_drones = [
            Drone(
                id=1, name="Drone-1", model="AgroX1", status="active",
                current_module="spray", battery_level=87.5,
                gps_lat=55.7558, gps_lng=37.6173, altitude=15, speed=5
            ),
            Drone(
                id=2, name="Drone-2", model="AgroX1", status="charging",
                current_module="grab", battery_level=45.0,
                gps_lat=55.7560, gps_lng=37.6175, altitude=0, speed=0
            ),
            Drone(
                id=3, name="Drone-3", model="AgroX2", status="offline",
                current_module=None, battery_level=0,
                gps_lat=None, gps_lng=None, altitude=0, speed=0
            )
        ]
        return demo_drones
    
    return [DroneResponse.model_validate(d) for d in drones]


@router.get("/{drone_id}", response_model=DroneResponse)
async def get_drone(
    drone_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Информация о дроне"""
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Дрон не найден"
        )
    
    return DroneResponse.model_validate(drone)


@router.post("/{drone_id}/command")
async def send_command(
    drone_id: int,
    command: DroneCommand,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отправка команды дрону"""
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Дрон не найден"
        )
    
    logger.info(f"Пользователь {current_user.username} отправил команду {command.command} дрону {drone_id}")
    
    # Обработка команд
    if command.command == "navigate":
        params = command.parameters
        drone.gps_lat = params.get("latitude", drone.gps_lat)
        drone.gps_lng = params.get("longitude", drone.gps_lng)
        drone.altitude = params.get("altitude", drone.altitude)
        drone.speed = params.get("speed", drone.speed)
        drone.status = "active"
    elif command.command == "takeoff":
        drone.status = "active"
        drone.altitude = 10
    elif command.command == "land":
        drone.status = "returning"
        drone.altitude = 0
        drone.speed = 0
    elif command.command == "hover":
        drone.speed = 0
    elif command.command == "return_to_base":
        drone.status = "returning"
    
    drone.last_telemetry_at = datetime.utcnow()
    await db.commit()
    
    return {
        "status": "success",
        "drone_id": drone_id,
        "command": command.command,
        "timestamp": datetime.utcnow()
    }


@router.get("/{drone_id}/telemetry")
async def get_telemetry(
    drone_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Телеметрия в реальном времени"""
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Дрон не найден"
        )
    
    return {
        "drone_id": drone_id,
        "battery": float(drone.battery_level),
        "gps": {"lat": float(drone.gps_lat) if drone.gps_lat else None, "lng": float(drone.gps_lng) if drone.gps_lng else None},
        "altitude": float(drone.altitude),
        "speed": float(drone.speed),
        "status": drone.status,
        "current_module": drone.current_module,
        "last_update": drone.last_telemetry_at
    }


@router.get("/{drone_id}/history")
async def get_drone_history(
    drone_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """История полётов"""
    result = await db.execute(
        select(DroneMission)
        .where(DroneMission.drone_id == drone_id)
        .order_by(desc(DroneMission.created_at))
        .limit(limit)
    )
    missions = result.scalars().all()
    
    return {
        "drone_id": drone_id,
        "missions": [DroneMissionResponse.model_validate(m) for m in missions]
    }


@router.post("/{drone_id}/module/change")
async def change_module(
    drone_id: int,
    module_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Смена модуля дрона"""
    valid_modules = ["grab", "spray", "soil", "charging"]
    if module_type not in valid_modules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверный тип модуля. Доступны: {valid_modules}"
        )
    
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Дрон не найден"
        )
    
    previous_module = drone.current_module
    drone.current_module = module_type
    
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} сменил модуль дрона {drone_id}: {previous_module} -> {module_type}")
    
    return {
        "status": "success",
        "drone_id": drone_id,
        "previous_module": previous_module,
        "new_module": module_type
    }


@router.post("/{drone_id}/return-to-base")
async def return_to_base(
    drone_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Возврат дрона на базу"""
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Дрон не найден"
        )
    
    drone.status = "returning"
    drone.speed = 5
    await db.commit()
    
    logger.info(f"Пользователь {current_user.username} инициировал возврат дрона {drone_id}")
    
    return {
        "status": "success",
        "drone_id": drone_id,
        "message": "Дрон возвращается на базу"
    }


@router.post("/{drone_id}/mission")
async def create_mission(
    drone_id: int,
    mission_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Назначение миссии"""
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Дрон не найден"
        )
    
    mission = DroneMission(
        drone_id=drone_id,
        mission_type=mission_data.get("type", "survey"),
        waypoints=mission_data.get("waypoints", []),
        status="pending"
    )
    
    db.add(mission)
    await db.commit()
    await db.refresh(mission)
    
    logger.info(f"Пользователь {current_user.username} создал миссию {mission.id} для дрона {drone_id}")
    
    return DroneMissionResponse.model_validate(mission)


@router.get("/stations", response_model=List[ChargingStationResponse])
async def get_stations(db: AsyncSession = Depends(get_db)):
    """Зарядные станции"""
    result = await db.execute(select(ChargingStation))
    stations = result.scalars().all()
    
    if not stations:
        # Демо-данные
        demo_stations = [
            ChargingStation(id=1, name="Station-1", is_occupied=False, charge_level=100),
            ChargingStation(id=2, name="Station-2", is_occupied=True, occupied_by_drone_id=2, charge_level=85),
            ChargingStation(id=3, name="Station-3", is_occupied=False, charge_level=100)
        ]
        return demo_stations
    
    return [ChargingStationResponse.model_validate(s) for s in stations]


@router.get("/stations/{station_id}/status")
async def get_station_status(
    station_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Статус станции"""
    result = await db.execute(select(ChargingStation).where(ChargingStation.id == station_id))
    station = result.scalar_one_or_none()
    
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Станция не найдена"
        )
    
    return ChargingStationResponse.model_validate(station)
