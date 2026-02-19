"""
Конфигурация приложения GHouse Backend API
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Настройки приложения"""
    
    # Приложение
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str = "change_me_in_production"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    
    # База данных
    DATABASE_URL: str = "postgresql+asyncpg://ghouse:ghouse_password@localhost:5432/ghouse"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PREFIX: str = "ghouse"
    
    # JWT
    JWT_SECRET_KEY: str = "change_me_in_production"
    JWT_ACCESS_EXPIRE: int = 3600  # 1 час
    JWT_REFRESH_EXPIRE: int = 604800  # 7 дней
    JWT_ALGORITHM: str = "HS256"
    
    # Telegram
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_WEBHOOK_URL: Optional[str] = None
    TELEGRAM_WEBHOOK_SECRET: Optional[str] = None
    
    # MQTT
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883
    MQTT_USERNAME: Optional[str] = "ghouse"
    MQTT_PASSWORD: Optional[str] = None
    MQTT_CLIENT_ID: str = "ghouse_backend"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:8000,http://localhost:3000,http://127.0.0.1:8000,http://127.0.0.1:3000,http://0.0.0.0:8000,http://0.0.0.0:3000"
    
    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # секунд
    
    # Логирование
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # Резервное копирование
    BACKUP_DIR: str = "/app/backups"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"
    
    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Получение настроек приложения (кэшируется)"""
    return Settings()


settings = get_settings()
