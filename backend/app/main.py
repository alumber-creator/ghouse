"""
GHouse Backend API - Главное приложение
"""
from fastapi import FastAPI, WebSocket, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from prometheus_client import make_asgi_app, Counter, Histogram
import time

from app.config import settings
from app.db.database import init_db, close_db
from app.utils.logging import setup_logging, get_logger
from app.utils.auth import decode_token

# Импорт роутов
from app.api.auth import router as auth_router
from app.api.greenhouse import router as greenhouse_router
from app.api.air import router as air_router
from app.api.drones import router as drones_router
from app.api.conveyor import router as conveyor_router
from app.api.soil import router as soil_router
from app.api.telegram import router as telegram_router
from app.api.users import router as users_router, roles_router, permissions_router
from app.api.notifications import router as notifications_router
from app.api.system import router as system_router

# Импорт сервисов
from app.services.websocket import manager, websocket_endpoint
from app.services.mqtt import init_mqtt, close_mqtt
from app.services.telegram import init_telegram

# Настройка логирования
logger = setup_logging()


# Prometheus метрики
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"]
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    logger.info("Запуск GHouse Backend API...")
    
    # Инициализация базы данных
    await init_db()
    logger.info("База данных инициализирована")
    
    # Инициализация MQTT
    await init_mqtt()
    
    # Инициализация Telegram
    await init_telegram()
    
    logger.info(f"GHouse Backend API запущен на порту {settings.APP_PORT}")
    
    yield
    
    # Shutdown
    logger.info("Остановка GHouse Backend API...")
    await close_mqtt()
    await close_db()
    logger.info("GHouse Backend API остановлен")


# Создание приложения
app = FastAPI(
    title="GHouse Backend API",
    description="API для системы управления автономным агрокомплексом GHouse",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware для метрик
@app.middleware("http")
async def metrics_middleware(request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    REQUEST_DURATION.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_route(websocket: WebSocket, token: str = None):
    """WebSocket подключение для real-time обновлений"""
    await websocket_endpoint(websocket, token)


# Подключение роутов
app.include_router(auth_router, prefix="/api/v1")
app.include_router(greenhouse_router, prefix="/api/v1")
app.include_router(air_router, prefix="/api/v1")
app.include_router(drones_router, prefix="/api/v1")
app.include_router(conveyor_router, prefix="/api/v1")
app.include_router(soil_router, prefix="/api/v1")
app.include_router(telegram_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(permissions_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(system_router, prefix="/api/v1")

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# Root endpoint
@app.get("/")
async def root():
    """Информация о API"""
    return {
        "name": "GHouse Backend API",
        "version": "1.0.0",
        "description": "API для системы управления автономным агрокомплексом GHouse",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


# Health check
@app.get("/api/v1/health")
async def health():
    """Проверка здоровья (публичный endpoint)"""
    return {
        "status": "healthy",
        "version": "1.0.0"
    }


# Обработка ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Необработанная ошибка: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера"}
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_DEBUG
    )
