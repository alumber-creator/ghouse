# Техническое задание на разработку бэкенда для GHouse Dashboard

## 1. Общие сведения

### 1.1. Наименование проекта
**GHouse Backend API** — серверная часть системы управления автономным агрокомплексом

### 1.2. Назначение системы
Предоставление API для веб-дашборда, мобильных приложений и внешних систем мониторинга агрокомплекса GHouse.

### 1.3. Требования к стеку технологий

| Компонент | Рекомендуемая технология | Альтернативы |
|-----------|------------------------|--------------|
| Язык | Python 3.11+ | Node.js 20+, Go 1.21+ |
| Фреймворк | FastAPI | Express.js, Gin |
| База данных | PostgreSQL 15+ | MySQL 8+, TimescaleDB |
| Кэш | Redis 7+ | Memcached |
| Message Broker | RabbitMQ | Apache Kafka, Redis Streams |
| WebSocket | Socket.IO / FastAPI WebSocket | ws, uWebSockets |
| Контейнеризация | Docker + Docker Compose | Podman |
| Мониторинг | Prometheus + Grafana | Datadog |

---

## 2. Архитектура системы

```
┌─────────────────────────────────────────────────────────────────┐
│                         Клиенты                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Web Dashboard│  │ Mobile App  │  │ External Monitoring     │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway / Load Balancer                 │
│                         (Nginx / Traefik)                        │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   REST API  │  │  WebSocket  │  │    Task Scheduler       │ │
│  │   Service   │  │   Service   │  │      Service            │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │   TimescaleDB (metrics) │ │
│  │  (primary)  │  │   (cache)   │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   External Integrations                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Telegram  │  │   MQTT      │  │    Cloud Storage        │ │
│  │    Bot API  │  │  (devices)  │  │    (S3-compatible)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. API Endpoints

### 3.1. Аутентификация и авторизация

| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| POST | `/api/v1/auth/login` | Вход пользователя | ❌ |
| POST | `/api/v1/auth/logout` | Выход пользователя | ✅ |
| POST | `/api/v1/auth/refresh` | Обновление токена | ✅ |
| POST | `/api/v1/auth/register` | Регистрация (admin only) | ✅ |
| GET | `/api/v1/auth/me` | Текущий пользователь | ✅ |
| PUT | `/api/v1/auth/password` | Смена пароля | ✅ |

**Пример запроса login:**
```json
POST /api/v1/auth/login
{
  "username": "operator",
  "password": "secure_password"
}
```

**Пример ответа:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "username": "operator",
    "role": "operator",
    "permissions": ["greenhouse:read", "greenhouse:write"]
  }
}
```

---

### 3.2. Умная теплица

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/greenhouse/status` | Текущее состояние всех систем |
| GET | `/api/v1/greenhouse/settings` | Настройки систем |
| PUT | `/api/v1/greenhouse/settings` | Обновление настроек |
| POST | `/api/v1/greenhouse/watering` | Управление поливом |
| POST | `/api/v1/greenhouse/lighting` | Управление освещением |
| POST | `/api/v1/greenhouse/ventilation` | Управление вентиляцией |
| GET | `/api/v1/greenhouse/history` | История изменений параметров |
| GET | `/api/v1/greenhouse/schedules` | Расписания работы |
| PUT | `/api/v1/greenhouse/schedules` | Обновление расписаний |

**Пример запроса управления поливом:**
```json
POST /api/v1/greenhouse/watering
{
  "action": "set_level",
  "value": 75,
  "duration_minutes": 30
}
```

**Пример ответа:**
```json
{
  "status": "success",
  "data": {
    "system": "watering",
    "previous_value": 65,
    "new_value": 75,
    "estimated_completion": "2026-02-18T15:45:00Z"
  }
}
```

---

### 3.3. Мониторинг воздуха

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/air/current` | Текущие показатели |
| GET | `/api/v1/air/history` | История показателей |
| GET | `/api/v1/air/thresholds` | Пороговые значения |
| PUT | `/api/v1/air/thresholds` | Обновление порогов |
| GET | `/api/v1/air/alerts` | Активные алерты |
| POST | `/api/v1/air/alerts/acknowledge` | Подтверждение алерта |
| GET | `/api/v1/air/analytics` | Аналитика и тренды |

**Параметры для history:**
```
GET /api/v1/air/history?from=2026-02-18T00:00:00Z&to=2026-02-18T23:59:59Z&interval=5m&metrics=temperature,humidity,co2,pressure
```

---

### 3.4. Дроны

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/drones` | Список всех дронов |
| GET | `/api/v1/drones/{id}` | Информация о дроне |
| POST | `/api/v1/drones/{id}/command` | Отправка команды |
| GET | `/api/v1/drones/{id}/telemetry` | Телеметрия в реальном времени |
| GET | `/api/v1/drones/{id}/history` | История полётов |
| POST | `/api/v1/drones/{id}/module/change` | Смена модуля |
| GET | `/api/v1/drones/stations` | Зарядные станции |
| GET | `/api/v1/drones/stations/{id}/status` | Статус станции |
| POST | `/api/v1/drones/{id}/return-to-base` | Возврат на базу |
| POST | `/api/v1/drones/{id}/mission` | Назначение миссии |

**Пример команды дрону:**
```json
POST /api/v1/drones/1/command
{
  "command": "navigate",
  "parameters": {
    "latitude": 55.7558,
    "longitude": 37.6173,
    "altitude": 20,
    "speed": 5
  }
}
```

---

### 3.5. Конвейер

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/conveyor/status` | Текущий статус |
| POST | `/api/v1/conveyor/start` | Запуск |
| POST | `/api/v1/conveyor/stop` | Остановка |
| POST | `/api/v1/conveyor/reset` | Сброс счётчиков |
| PUT | `/api/v1/conveyor/speed` | Установка скорости |
| PUT | `/api/v1/conveyor/interval` | Установка интервала |
| GET | `/api/v1/conveyor/statistics` | Статистика работы |
| GET | `/api/v1/conveyor/maintenance` | Информация об обслуживании |
| POST | `/api/v1/conveyor/maintenance/log` | Запись об обслуживании |

---

### 3.6. Аналитика почвы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/soil/current` | Текущие показатели |
| POST | `/api/v1/soil/analyze` | Запуск анализа |
| GET | `/api/v1/soil/history` | История анализов |
| GET | `/api/v1/soil/zones` | Зоны мониторинга |
| GET | `/api/v1/soil/recommendations` | Рекомендации |
| POST | `/api/v1/soil/auto-adjust` | Авто-корректировка |
| GET | `/api/v1/soil/export` | Экспорт данных |

**Пример ответа анализа:**
```json
{
  "analysis_id": "a1b2c3d4",
  "timestamp": "2026-02-18T14:30:00Z",
  "zones": [
    {
      "zone_id": "A",
      "moisture": 78,
      "ph": 6.5,
      "npk": { "n": 85, "p": 72, "k": 92 },
      "temperature": 22,
      "conductivity": 1.8,
      "status": "optimal"
    }
  ],
  "recommendations": [
    {
      "type": "info",
      "zone": "A",
      "action": "Параметры в норме"
    }
  ]
}
```

---

### 3.7. Telegram интеграция

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/telegram/status` | Статус подключения |
| PUT | `/api/v1/telegram/settings` | Настройки бота |
| POST | `/api/v1/telegram/test` | Тест подключения |
| GET | `/api/v1/telegram/log` | Лог сообщений |
| POST | `/api/v1/telegram/send` | Отправка сообщения |
| POST | `/api/v1/telegram/broadcast` | Массовая рассылка |
| GET | `/api/v1/telegram/subscribers` | Список подписчиков |

**Webhook для Telegram:**
```
POST /api/v1/webhooks/telegram
```

---

### 3.8. Пользователи и роли

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/users` | Список пользователей |
| GET | `/api/v1/users/{id}` | Информация о пользователе |
| POST | `/api/v1/users` | Создание пользователя |
| PUT | `/api/v1/users/{id}` | Обновление пользователя |
| DELETE | `/api/v1/users/{id}` | Удаление пользователя |
| GET | `/api/v1/roles` | Список ролей |
| POST | `/api/v1/roles` | Создание роли |
| PUT | `/api/v1/roles/{id}` | Обновление роли |
| GET | `/api/v1/permissions` | Список разрешений |

---

### 3.9. Система уведомлений

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/notifications` | Список уведомлений |
| GET | `/api/v1/notifications/unread` | Непрочитанные |
| POST | `/api/v1/notifications/read` | Отметить прочитанным |
| POST | `/api/v1/notifications/read-all` | Прочитать все |
| DELETE | `/api/v1/notifications/{id}` | Удалить уведомление |
| GET | `/api/v1/notifications/settings` | Настройки уведомлений |
| PUT | `/api/v1/notifications/settings` | Обновление настроек |

---

### 3.10. Системные endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/health` | Проверка здоровья |
| GET | `/api/v1/metrics` | Метрики Prometheus |
| GET | `/api/v1/config` | Конфигурация системы |
| PUT | `/api/v1/config` | Обновление конфигурации |
| POST | `/api/v1/backup` | Создание бэкапа |
| POST | `/api/v1/restore` | Восстановление из бэкапа |
| GET | `/api/v1/logs` | Логи системы |
| GET | `/api/v1/audit` | Аудит действий |

---

## 4. WebSocket события

### 4.1. Подключение
```
ws://api.ghouse.local/ws?token=<access_token>
```

### 4.2. Каналы (Rooms)

| Канал | Описание |
|-------|----------|
| `greenhouse` | События теплицы |
| `air` | События мониторинга воздуха |
| `drones` | События дронов |
| `conveyor` | События конвейера |
| `soil` | События почвы |
| `alerts` | Системные алерты |
| `notifications` | Уведомления пользователей |

### 4.3. Формат сообщений

**Клиент → Сервер:**
```json
{
  "type": "subscribe",
  "channel": "drones",
  "payload": {
    "drone_ids": [1, 2, 3]
  }
}
```

**Сервер → Клиент:**
```json
{
  "type": "telemetry_update",
  "channel": "drones",
  "timestamp": "2026-02-18T14:30:00Z",
  "payload": {
    "drone_id": 1,
    "battery": 87,
    "gps": { "lat": 55.75, "lng": 37.61 },
    "altitude": 15,
    "speed": 5,
    "status": "active"
  }
}
```

### 4.4. Типы событий

| Тип | Направление | Описание |
|-----|-------------|----------|
| `subscribe` | C→S | Подписка на канал |
| `unsubscribe` | C→S | Отписка от канала |
| `ping` | C→S | Проверка соединения |
| `pong` | S→C | Ответ на ping |
| `telemetry_update` | S→C | Обновление телеметрии |
| `alert` | S→C | Системный алерт |
| `command_response` | S→C | Ответ на команду |
| `error` | S→C | Ошибка |

---

## 5. Модели данных

### 5.1. Пользователь (User)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2. Роль (Role)
```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'
);
```

### 5.3. Теплица (Greenhouse)
```sql
CREATE TABLE greenhouse_settings (
    id SERIAL PRIMARY KEY,
    system_type VARCHAR(50) NOT NULL, -- watering, lighting, ventilation
    current_value DECIMAL(5,2),
    target_value DECIMAL(5,2),
    min_value DECIMAL(5,2),
    max_value DECIMAL(5,2),
    is_auto BOOLEAN DEFAULT false,
    schedule_id INTEGER REFERENCES schedules(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE greenhouse_history (
    id SERIAL PRIMARY KEY,
    system_type VARCHAR(50) NOT NULL,
    previous_value DECIMAL(5,2),
    new_value DECIMAL(5,2),
    changed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.4. Параметры воздуха (AirMetrics)
```sql
CREATE TABLE air_metrics (
    id SERIAL PRIMARY KEY,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    co2 DECIMAL(8,2),
    pressure DECIMAL(6,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрых запросов по времени
CREATE INDEX idx_air_metrics_recorded_at ON air_metrics(recorded_at DESC);
```

### 5.5. Дроны (Drones)
```sql
CREATE TABLE drones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    serial_number VARCHAR(100) UNIQUE,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'offline', -- active, charging, returning, offline
    current_module VARCHAR(50), -- grab, spray, soil, charging
    battery_level DECIMAL(5,2),
    gps_lat DECIMAL(10,8),
    gps_lng DECIMAL(11,8),
    altitude DECIMAL(8,2),
    speed DECIMAL(5,2),
    last_telemetry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drone_missions (
    id SERIAL PRIMARY KEY,
    drone_id INTEGER REFERENCES drones(id),
    mission_type VARCHAR(50),
    status VARCHAR(20), -- pending, in_progress, completed, failed
    waypoints JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE charging_stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    is_occupied BOOLEAN DEFAULT false,
    occupied_by_drone_id INTEGER REFERENCES drones(id),
    charge_level DECIMAL(5,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.6. Конвейер (Conveyor)
```sql
CREATE TABLE conveyor_status (
    id SERIAL PRIMARY KEY,
    is_running BOOLEAN DEFAULT false,
    speed DECIMAL(4,2), -- м/с
    interval_seconds INTEGER,
    total_transported INTEGER DEFAULT 0,
    shift_count INTEGER DEFAULT 0,
    work_time_seconds INTEGER DEFAULT 0,
    efficiency DECIMAL(5,2),
    last_maintenance DATE,
    next_maintenance DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conveyor_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    items_transported INTEGER DEFAULT 0,
    work_time_seconds INTEGER DEFAULT 0,
    avg_speed DECIMAL(4,2),
    avg_efficiency DECIMAL(5,2),
    downtime_seconds INTEGER DEFAULT 0,
    UNIQUE(date)
);
```

### 5.7. Почва (Soil)
```sql
CREATE TABLE soil_analyses (
    id SERIAL PRIMARY KEY,
    zone_id VARCHAR(10),
    moisture DECIMAL(5,2),
    ph DECIMAL(3,1),
    npk_n DECIMAL(5,2),
    npk_p DECIMAL(5,2),
    npk_k DECIMAL(5,2),
    temperature DECIMAL(5,2),
    conductivity DECIMAL(5,2),
    status VARCHAR(20), -- optimal, warning, critical
    recommendations JSONB,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE soil_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    area_sqm DECIMAL(10,2),
    coordinates JSONB, -- полигон зоны
    current_analysis_id INTEGER REFERENCES soil_analyses(id)
);
```

### 5.8. Уведомления (Notifications)
```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(20) NOT NULL, -- info, warning, error, success
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    acknowledged BOOLEAN DEFAULT false,
    source VARCHAR(50), -- module name
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    telegram_enabled BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT false,
    notify_critical BOOLEAN DEFAULT true,
    notify_warning BOOLEAN DEFAULT true,
    notify_info BOOLEAN DEFAULT false,
    notify_report BOOLEAN DEFAULT false,
    frequency VARCHAR(20) DEFAULT 'immediate' -- immediate, 5min, 15min, hourly
);
```

### 5.9. Аудит (Audit Log)
```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

---

## 6. Интеграции

### 6.1. Telegram Bot

**Конфигурация:**
```python
TELEGRAM_BOT_TOKEN = "your_bot_token"
TELEGRAM_WEBHOOK_URL = "https://api.ghouse.local/api/v1/webhooks/telegram"
```

**Обработчики:**
- `/start` — Приветствие и меню
- `/status` — Текущий статус системы
- `/alerts` — Активные алерты
- `/settings` — Настройки уведомлений

**Отправка уведомлений:**
```python
async def send_notification(chat_id: str, message: str, parse_mode: str = "HTML"):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": parse_mode
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            return await response.json()
```

### 6.2. MQTT (IoT устройства)

**Топики:**
```
ghouse/greenhouse/+/status      # Статус систем теплицы
ghouse/greenhouse/+/command     # Команды системам
ghouse/air/+/metrics            # Метрики воздуха
ghouse/drones/+/telemetry       # Телеметрия дронов
ghouse/drones/+/command         # Команды дронам
ghouse/conveyor/status          # Статус конвейера
ghouse/conveyor/command         # Команды конвейеру
ghouse/soil/+/analysis          # Анализы почвы
```

**Пример подписки:**
```python
import asyncio
from gmqtt import Client as MQTTClient

client = MQTTClient("ghouse_backend")
await client.connect("mqtt://localhost:1883")
client.subscribe("ghouse/+/+/+")

def on_message(client, topic, payload, qos, properties):
    # Обработка сообщений от устройств
    pass
```

### 6.3. Видеонаблюдение

**Интеграция с RTSP камерами:**
```python
# Конфигурация камер
CAMERAS = {
    "greenhouse_1": {
        "rtsp_url": "rtsp://camera1.local/stream",
        "location": "Теплица зона A"
    },
    "greenhouse_2": {
        "rtsp_url": "rtsp://camera2.local/stream",
        "location": "Теплица зона B"
    }
}

# Endpoint для получения потока
GET /api/v1/cameras/{camera_id}/stream
```

---

## 7. Требования к безопасности

### 7.1. Аутентификация
- JWT токены (access + refresh)
- Время жизни access токена: 1 час
- Время жизни refresh токена: 7 дней
- Хранение токенов в httpOnly cookie

### 7.2. Авторизация
- RBAC (Role-Based Access Control)
- Роли: `admin`, `operator`, `viewer`, `maintenance`
- Permissions на уровне endpoints

### 7.3. Защита данных
- HTTPS обязательен
- Пароли: bcrypt/argon2
- Чувствительные данные в БД: шифрование на уровне приложения
- Rate limiting: 100 запросов/мин на IP

### 7.4. Аудит
- Логирование всех критических операций
- Хранение аудит-лога: 1 год
- Экспорт логов по запросу

---

## 8. Требования к производительности

| Метрика | Значение |
|---------|----------|
| Время ответа API (p95) | < 200ms |
| Время ответа API (p99) | < 500ms |
| WebSocket задержка | < 100ms |
| Доступность | 99.9% |
| Одновременных подключений WS | до 1000 |
| Запросов в секунду | до 5000 |

### 8.1. Кэширование
- Redis для кэширования частых запросов
- TTL для кэша: 30 секунд (телеметрия), 5 минут (статистика)
- Инвалидация кэша при изменении данных

### 8.2. База данных
- Connection pooling: 20 соединений
- Read replicas для аналитических запросов
- Партиционирование таблиц истории по месяцам

---

## 9. Мониторинг и логирование

### 9.1. Метрики Prometheus
```python
# Количество запросов
http_requests_total{method, endpoint, status}

# Время ответа
http_request_duration_seconds{method, endpoint}

# WebSocket подключения
websocket_connections_active

# Ошибки интеграций
integration_errors_total{service}

# Задержка телеметрии
telemetry_latency_seconds{device_type}
```

### 9.2. Логирование
```python
# Структурированные логи (JSON)
{
    "timestamp": "2026-02-18T14:30:00Z",
    "level": "INFO",
    "service": "api",
    "message": "Greenhouse watering updated",
    "context": {
        "user_id": 1,
        "previous_value": 65,
        "new_value": 75
    }
}
```

### 9.3. Health Checks
```
GET /health/live   # Liveness probe
GET /health/ready  # Readiness probe
```

---

## 10. Развёртывание

### 10.1. Docker Compose (development)
```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/ghouse
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  mqtt:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"

volumes:
  postgres_data:
```

### 10.2. Переменные окружения
```bash
# Приложение
APP_ENV=production
APP_DEBUG=false
APP_SECRET_KEY=your_secret_key

# База данных
DATABASE_URL=postgresql://user:pass@localhost:5432/ghouse
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=ghouse

# Telegram
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_WEBHOOK_SECRET=your_secret

# JWT
JWT_SECRET_KEY=your_jwt_secret
JWT_ACCESS_EXPIRE=3600
JWT_REFRESH_EXPIRE=604800

# MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_USERNAME=ghouse
MQTT_PASSWORD=your_password
```

---

## 11. Тестирование

### 11.1. Покрытие тестами
- Unit тесты: > 80%
- Integration тесты: все endpoints
- E2E тесты: критические сценарии

### 11.2. Типы тестов
```bash
# Запуск тестов
pytest tests/unit           # Unit тесты
pytest tests/integration    # Integration тесты
pytest tests/e2e           # E2E тесты
pytest --cov=app           # Coverage report
```

---

## 12. Сроки и этапы

| Этап | Длительность | Результат |
|------|--------------|-----------|
| 1. Проектирование API | 1 неделя | Спецификация API |
| 2. Базовая реализация | 2 недели | CRUD операции, аутентификация |
| 3. WebSocket | 1 неделя | Real-time обновления |
| 4. Интеграции | 1 неделя | Telegram, MQTT |
| 5. Тестирование | 1 неделя | Тесты, багфикс |
| 6. Деплой | 3 дня | Production-ready |

**Общая длительность:** 6-7 недель

---

## 13. Контакты

| Роль | Ответственный |
|------|---------------|
| Product Owner | [Имя] |
| Tech Lead | [Имя] |
| Backend Developer | [Имя] |
| QA Engineer | [Имя] |

---

**Версия документа:** 1.0  
**Дата создания:** 18.02.2026  
**Статус:** На согласовании
