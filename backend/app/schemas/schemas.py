"""
Pydantic схемы для API
"""
from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


# ==================== Auth Schemas ====================

class TokenData(BaseModel):
    username: Optional[str] = None
    type: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


# ==================== User Schemas ====================

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleResponse(RoleBase):
    id: int
    
    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    role_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    role: Optional[RoleResponse] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: Optional[UserResponse] = None


# ==================== Greenhouse Schemas ====================

class GreenhouseSettingBase(BaseModel):
    system_type: str  # watering, lighting, ventilation
    current_value: float = 0
    target_value: float = 0
    min_value: float = 0
    max_value: float = 100
    is_auto: bool = False


class GreenhouseSettingCreate(GreenhouseSettingBase):
    schedule_id: Optional[int] = None


class GreenhouseSettingUpdate(BaseModel):
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    is_auto: Optional[bool] = None
    schedule_id: Optional[int] = None


class GreenhouseSettingResponse(GreenhouseSettingBase):
    id: int
    schedule_id: Optional[int] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GreenhouseHistoryResponse(BaseModel):
    id: int
    system_type: str
    previous_value: Optional[float]
    new_value: Optional[float]
    changed_by: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class WateringRequest(BaseModel):
    action: str
    value: Optional[float] = None
    duration_minutes: Optional[int] = None


class LightingRequest(BaseModel):
    action: str
    value: Optional[float] = None
    duration_minutes: Optional[int] = None


class VentilationRequest(BaseModel):
    action: str
    value: Optional[float] = None
    duration_minutes: Optional[int] = None


# ==================== Air Monitoring Schemas ====================

class AirMetricsResponse(BaseModel):
    id: int
    temperature: Optional[float]
    humidity: Optional[float]
    co2: Optional[float]
    pressure: Optional[float]
    recorded_at: datetime
    
    class Config:
        from_attributes = True


class AirThresholdBase(BaseModel):
    metric_name: str
    min_value: float
    max_value: float
    unit: Optional[str] = None


class AirThresholdCreate(AirThresholdBase):
    pass


class AirThresholdUpdate(BaseModel):
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class AirThresholdResponse(AirThresholdBase):
    id: int
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AirAlert(BaseModel):
    id: int
    metric_name: str
    current_value: float
    threshold_min: float
    threshold_max: float
    status: str  # warning, critical
    created_at: datetime


class AirHistoryRequest(BaseModel):
    from_date: datetime
    to_date: datetime
    interval: str = "5m"
    metrics: List[str] = []


# ==================== Drone Schemas ====================

class DroneStatusEnum(str, Enum):
    active = "active"
    charging = "charging"
    returning = "returning"
    offline = "offline"


class DroneBase(BaseModel):
    name: str
    serial_number: Optional[str] = None
    model: Optional[str] = None


class DroneCreate(DroneBase):
    pass


class DroneUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[DroneStatusEnum] = None
    current_module: Optional[str] = None


class DroneResponse(DroneBase):
    id: int
    status: str
    current_module: Optional[str]
    battery_level: float
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    altitude: float
    speed: float
    last_telemetry_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DroneCommand(BaseModel):
    command: str
    parameters: Dict[str, Any] = {}


class DroneMissionBase(BaseModel):
    mission_type: str
    waypoints: List[Dict[str, Any]] = []


class DroneMissionCreate(DroneMissionBase):
    drone_id: int


class DroneMissionResponse(BaseModel):
    id: int
    drone_id: int
    mission_type: str
    status: str
    waypoints: List[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChargingStationBase(BaseModel):
    name: str


class ChargingStationCreate(ChargingStationBase):
    pass


class ChargingStationResponse(BaseModel):
    id: int
    name: str
    is_occupied: bool
    occupied_by_drone_id: Optional[int]
    charge_level: float
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Conveyor Schemas ====================

class ConveyorStatusResponse(BaseModel):
    id: int
    is_running: bool
    speed: float
    interval_seconds: int
    total_transported: int
    shift_count: int
    work_time_seconds: int
    efficiency: float
    last_maintenance: Optional[date]
    next_maintenance: Optional[date]
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConveyorSpeedUpdate(BaseModel):
    speed: float = Field(..., ge=0, le=10)


class ConveyorIntervalUpdate(BaseModel):
    interval_seconds: int = Field(..., ge=0)


class ConveyorStatisticsResponse(BaseModel):
    id: int
    date: date
    items_transported: int
    work_time_seconds: int
    avg_speed: float
    avg_efficiency: float
    downtime_seconds: int
    
    class Config:
        from_attributes = True


class MaintenanceLogCreate(BaseModel):
    maintenance_type: str
    description: str
    performed_by: str


# ==================== Soil Schemas ====================

class SoilAnalysisResponse(BaseModel):
    id: int
    zone_id: str
    moisture: Optional[float]
    ph: Optional[float]
    npk_n: Optional[float]
    npk_p: Optional[float]
    npk_k: Optional[float]
    temperature: Optional[float]
    conductivity: Optional[float]
    status: str
    recommendations: List[Dict[str, Any]]
    analyzed_at: datetime
    
    class Config:
        from_attributes = True


class SoilZoneBase(BaseModel):
    name: str
    area_sqm: Optional[float] = None
    coordinates: List[Dict[str, float]] = []


class SoilZoneCreate(SoilZoneBase):
    pass


class SoilZoneResponse(SoilZoneBase):
    id: int
    current_analysis_id: Optional[int]
    
    class Config:
        from_attributes = True


class SoilRecommendation(BaseModel):
    type: str  # info, warning, action
    zone: str
    action: str
    priority: int = 1


# ==================== Notification Schemas ====================

class NotificationType(str, Enum):
    info = "info"
    warning = "warning"
    error = "error"
    success = "success"


class NotificationBase(BaseModel):
    type: NotificationType
    title: str
    message: str
    source: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: int


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    is_read: bool
    acknowledged: bool
    source: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationSettingsBase(BaseModel):
    telegram_enabled: bool = False
    email_enabled: bool = False
    push_enabled: bool = False
    notify_critical: bool = True
    notify_warning: bool = True
    notify_info: bool = False
    notify_report: bool = False
    frequency: str = "immediate"


class NotificationSettingsCreate(NotificationSettingsBase):
    user_id: int


class NotificationSettingsUpdate(BaseModel):
    telegram_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    notify_critical: Optional[bool] = None
    notify_warning: Optional[bool] = None
    notify_info: Optional[bool] = None
    notify_report: Optional[bool] = None
    frequency: Optional[str] = None


class NotificationSettingsResponse(NotificationSettingsBase):
    id: int
    user_id: int
    
    class Config:
        from_attributes = True


# ==================== Telegram Schemas ====================

class TelegramSettings(BaseModel):
    bot_token: Optional[str] = None
    webhook_url: Optional[str] = None
    chat_id: Optional[str] = None


class TelegramMessage(BaseModel):
    chat_id: str
    text: str
    parse_mode: Optional[str] = "HTML"


class TelegramBroadcast(BaseModel):
    text: str
    parse_mode: Optional[str] = "HTML"


class TelegramLogResponse(BaseModel):
    id: int
    chat_id: Optional[str]
    message_text: Optional[str]
    direction: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== System Schemas ====================

class HealthStatus(BaseModel):
    status: str
    version: str
    database: str = "connected"
    redis: str = "connected"
    mqtt: str = "connected"
    telegram: str = "disconnected"


class SystemConfig(BaseModel):
    app_env: str
    debug: bool
    cors_origins: List[str]
    rate_limit_requests: int
    log_level: str


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource: Optional[str]
    resource_id: Optional[int]
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== WebSocket Schemas ====================

class WSMessage(BaseModel):
    type: str
    channel: str
    payload: Optional[Dict[str, Any]] = None


class WSResponse(BaseModel):
    type: str
    channel: str
    timestamp: datetime
    payload: Dict[str, Any]
