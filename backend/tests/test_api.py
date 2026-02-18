"""
Тесты API GHouse Backend
"""
import pytest
from httpx import AsyncClient
from app.main import app
from app.config import settings


@pytest.fixture
async def client():
    """Фикстура для HTTP клиента"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_user():
    """Тестовый пользователь"""
    return {
        "username": "testuser",
        "password": "testpass123",
        "email": "test@example.com"
    }


# ==================== Auth Tests ====================

@pytest.mark.asyncio
async def test_health_check(client):
    """Тест проверки здоровья"""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Тест корневого endpoint"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "GHouse" in data["name"]


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    """Тест неверных учетных данных"""
    response = await client.post("/api/v1/auth/login", data={
        "username": "invalid",
        "password": "invalid"
    })
    assert response.status_code == 401


# ==================== Greenhouse Tests ====================

@pytest.mark.asyncio
async def test_get_greenhouse_status(client):
    """Тест получения статуса теплицы"""
    response = await client.get("/api/v1/greenhouse/status")
    assert response.status_code == 200
    data = response.json()
    assert "systems" in data


@pytest.mark.asyncio
async def test_get_greenhouse_settings(client):
    """Тест получения настроек теплицы"""
    response = await client.get("/api/v1/greenhouse/settings")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ==================== Air Monitoring Tests ====================

@pytest.mark.asyncio
async def test_get_air_current(client):
    """Тест получения текущих показателей воздуха"""
    response = await client.get("/api/v1/air/current")
    assert response.status_code == 200
    data = response.json()
    assert "temperature" in data or "status" in data


@pytest.mark.asyncio
async def test_get_air_thresholds(client):
    """Тест получения порогов воздуха"""
    response = await client.get("/api/v1/air/thresholds")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ==================== Drones Tests ====================

@pytest.mark.asyncio
async def test_get_drones(client):
    """Тест получения списка дронов"""
    response = await client.get("/api/v1/drones")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_drone_not_found(client):
    """Тест получения несуществующего дрона"""
    response = await client.get("/api/v1/drones/999")
    assert response.status_code == 404


# ==================== Conveyor Tests ====================

@pytest.mark.asyncio
async def test_get_conveyor_status(client):
    """Тест получения статуса конвейера"""
    response = await client.get("/api/v1/conveyor/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data


@pytest.mark.asyncio
async def test_get_conveyor_statistics(client):
    """Тест получения статистики конвейера"""
    response = await client.get("/api/v1/conveyor/statistics")
    assert response.status_code == 200
    data = response.json()
    assert "statistics" in data


# ==================== Soil Tests ====================

@pytest.mark.asyncio
async def test_get_soil_current(client):
    """Тест получения текущих показателей почвы"""
    response = await client.get("/api/v1/soil/current")
    assert response.status_code == 200
    data = response.json()
    assert "zones" in data or "analysis_id" in data


@pytest.mark.asyncio
async def test_get_soil_zones(client):
    """Тест получения зон почвы"""
    response = await client.get("/api/v1/soil/zones")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ==================== Telegram Tests ====================

@pytest.mark.asyncio
async def test_get_telegram_status(client):
    """Тест получения статуса Telegram"""
    response = await client.get("/api/v1/telegram/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


# ==================== Users Tests ====================

@pytest.mark.asyncio
async def test_get_roles(client):
    """Тест получения ролей"""
    response = await client.get("/api/v1/roles")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_permissions(client):
    """Тест получения разрешений"""
    response = await client.get("/api/v1/permissions")
    assert response.status_code == 200
    data = response.json()
    assert "permissions" in data


# ==================== System Tests ====================

@pytest.mark.asyncio
async def test_metrics_endpoint(client):
    """Тест endpoint метрик"""
    response = await client.get("/metrics")
    assert response.status_code == 200


# ==================== Integration Tests ====================

@pytest.mark.asyncio
async def test_full_workflow(client):
    """Тест полного рабочего процесса"""
    # 1. Проверка здоровья
    health = await client.get("/api/v1/health")
    assert health.status_code == 200
    
    # 2. Получение статуса всех систем
    greenhouse = await client.get("/api/v1/greenhouse/status")
    assert greenhouse.status_code == 200
    
    air = await client.get("/api/v1/air/current")
    assert air.status_code == 200
    
    drones = await client.get("/api/v1/drones")
    assert drones.status_code == 200
    
    conveyor = await client.get("/api/v1/conveyor/status")
    assert conveyor.status_code == 200
    
    soil = await client.get("/api/v1/soil/current")
    assert soil.status_code == 200
