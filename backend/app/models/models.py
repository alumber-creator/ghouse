"""
Модели данных GHouse Backend API
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, Date, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Role(Base):
    """Роль пользователя"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSON, default=list)
    
    users = relationship("User", back_populates="role")


class User(Base):
    """Пользователь"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    role = relationship("Role", back_populates="users")
    notifications = relationship("Notification", back_populates="user")
    notification_settings = relationship("NotificationSettings", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")


class GreenhouseSetting(Base):
    """Настройки теплицы"""
    __tablename__ = "greenhouse_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    system_type = Column(String(50), nullable=False)  # watering, lighting, ventilation
    current_value = Column(Numeric(5, 2), default=0)
    target_value = Column(Numeric(5, 2), default=0)
    min_value = Column(Numeric(5, 2), default=0)
    max_value = Column(Numeric(5, 2), default=100)
    is_auto = Column(Boolean, default=False)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    schedule = relationship("Schedule", back_populates="greenhouse_settings")
    history = relationship("GreenhouseHistory", back_populates="setting")


class Schedule(Base):
    """Расписание работы систем"""
    __tablename__ = "schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    system_type = Column(String(50), nullable=False)
    cron_expression = Column(String(100), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    greenhouse_settings = relationship("GreenhouseSetting", back_populates="schedule")


class GreenhouseHistory(Base):
    """История изменений теплицы"""
    __tablename__ = "greenhouse_history"
    
    id = Column(Integer, primary_key=True, index=True)
    setting_id = Column(Integer, ForeignKey("greenhouse_settings.id"), nullable=True)
    system_type = Column(String(50), nullable=False)
    previous_value = Column(Numeric(5, 2), nullable=True)
    new_value = Column(Numeric(5, 2), nullable=True)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    setting = relationship("GreenhouseSetting", back_populates="history")
    user = relationship("User")


class AirMetric(Base):
    """Метрики воздуха"""
    __tablename__ = "air_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    temperature = Column(Numeric(5, 2), nullable=True)
    humidity = Column(Numeric(5, 2), nullable=True)
    co2 = Column(Numeric(8, 2), nullable=True)
    pressure = Column(Numeric(6, 2), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AirThreshold(Base):
    """Пороговые значения для воздуха"""
    __tablename__ = "air_thresholds"
    
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(50), unique=True, nullable=False)
    min_value = Column(Numeric(10, 2), nullable=False)
    max_value = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(20), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Drone(Base):
    """Дрон"""
    __tablename__ = "drones"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    serial_number = Column(String(100), unique=True, nullable=True)
    model = Column(String(100), nullable=True)
    status = Column(String(20), default="offline")  # active, charging, returning, offline
    current_module = Column(String(50), nullable=True)  # grab, spray, soil, charging
    battery_level = Column(Numeric(5, 2), default=0)
    gps_lat = Column(Numeric(10, 8), nullable=True)
    gps_lng = Column(Numeric(11, 8), nullable=True)
    altitude = Column(Numeric(8, 2), default=0)
    speed = Column(Numeric(5, 2), default=0)
    last_telemetry_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    missions = relationship("DroneMission", back_populates="drone")


class DroneMission(Base):
    """Миссия дрона"""
    __tablename__ = "drone_missions"
    
    id = Column(Integer, primary_key=True, index=True)
    drone_id = Column(Integer, ForeignKey("drones.id"), nullable=False)
    mission_type = Column(String(50), nullable=True)
    status = Column(String(20), default="pending")  # pending, in_progress, completed, failed
    waypoints = Column(JSON, default=list)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    drone = relationship("Drone", back_populates="missions")


class ChargingStation(Base):
    """Зарядная станция"""
    __tablename__ = "charging_stations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    is_occupied = Column(Boolean, default=False)
    occupied_by_drone_id = Column(Integer, ForeignKey("drones.id"), nullable=True)
    charge_level = Column(Numeric(5, 2), default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    occupied_drone = relationship("Drone")


class ConveyorStatus(Base):
    """Статус конвейера"""
    __tablename__ = "conveyor_status"
    
    id = Column(Integer, primary_key=True, index=True)
    is_running = Column(Boolean, default=False)
    speed = Column(Numeric(4, 2), default=0)  # м/с
    interval_seconds = Column(Integer, default=0)
    total_transported = Column(Integer, default=0)
    shift_count = Column(Integer, default=0)
    work_time_seconds = Column(Integer, default=0)
    efficiency = Column(Numeric(5, 2), default=0)
    last_maintenance = Column(Date, nullable=True)
    next_maintenance = Column(Date, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ConveyorStatistic(Base):
    """Статистика конвейера"""
    __tablename__ = "conveyor_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False)
    items_transported = Column(Integer, default=0)
    work_time_seconds = Column(Integer, default=0)
    avg_speed = Column(Numeric(4, 2), default=0)
    avg_efficiency = Column(Numeric(5, 2), default=0)
    downtime_seconds = Column(Integer, default=0)


class SoilAnalysis(Base):
    """Анализ почвы"""
    __tablename__ = "soil_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(10), nullable=True, index=True)
    moisture = Column(Numeric(5, 2), nullable=True)
    ph = Column(Numeric(3, 1), nullable=True)
    npk_n = Column(Numeric(5, 2), nullable=True)
    npk_p = Column(Numeric(5, 2), nullable=True)
    npk_k = Column(Numeric(5, 2), nullable=True)
    temperature = Column(Numeric(5, 2), nullable=True)
    conductivity = Column(Numeric(5, 2), nullable=True)
    status = Column(String(20), default="optimal")  # optimal, warning, critical
    recommendations = Column(JSON, default=list)
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class SoilZone(Base):
    """Зона почвы"""
    __tablename__ = "soil_zones"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    area_sqm = Column(Numeric(10, 2), nullable=True)
    coordinates = Column(JSON, default=list)
    current_analysis_id = Column(Integer, ForeignKey("soil_analyses.id"), nullable=True)
    
    current_analysis = relationship("SoilAnalysis")


class Notification(Base):
    """Уведомление"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # info, warning, error, success
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    acknowledged = Column(Boolean, default=False)
    source = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    user = relationship("User", back_populates="notifications")


class NotificationSettings(Base):
    """Настройки уведомлений"""
    __tablename__ = "notification_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    telegram_enabled = Column(Boolean, default=False)
    email_enabled = Column(Boolean, default=False)
    push_enabled = Column(Boolean, default=False)
    notify_critical = Column(Boolean, default=True)
    notify_warning = Column(Boolean, default=True)
    notify_info = Column(Boolean, default=False)
    notify_report = Column(Boolean, default=False)
    frequency = Column(String(20), default="immediate")  # immediate, 5min, 15min, hourly
    
    user = relationship("User", back_populates="notification_settings")


class AuditLog(Base):
    """Аудит действий"""
    __tablename__ = "audit_log"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(100), nullable=True)
    resource_id = Column(Integer, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    user = relationship("User", back_populates="audit_logs")


class TelegramLog(Base):
    """Лог Telegram сообщений"""
    __tablename__ = "telegram_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(String(100), nullable=True, index=True)
    message_text = Column(Text, nullable=True)
    direction = Column(String(10), nullable=True)  # incoming, outgoing
    status = Column(String(20), default="sent")  # sent, delivered, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
