"""
Логирование приложения
"""
import sys
from loguru import logger
from app.config import settings


def setup_logging():
    """Настройка логирования"""
    # Удаление стандартного обработчика
    logger.remove()
    
    # Консольный вывод
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.LOG_LEVEL,
        colorize=True,
    )
    
    # Файловый вывод (JSON формат для продакшена)
    log_format = "{time:ISO8601}|{level}|{name}|{function}|{line}|{message}" if settings.LOG_FORMAT == "json" else "{time} | {level} | {name}:{function}:{line} - {message}"
    
    logger.add(
        "logs/app_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="30 days",
        level=settings.LOG_LEVEL,
        format=log_format,
        serialize=settings.LOG_FORMAT == "json",
    )
    
    return logger


def get_logger(name: str = "ghouse"):
    """Получение логгера"""
    return logger.bind(name=name)
