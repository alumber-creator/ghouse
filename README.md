# GHouse | Автономный Агрокомплекс

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![PostgreSQL 15+](https://img.shields.io/badge/postgresql-15+-blue.svg)](https://www.postgresql.org/download/)
[![Redis 7+](https://img.shields.io/badge/redis-7+-blue.svg)](https://redis.io/download/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

Система управления автономным агрокомплексом с умными теплицами, дронами, конвейером и мониторингом окружающей среды.

## 📁 Структура репозитория

```
project GHouse/
├── backend/                 # Backend сервер (FastAPI/Python)
│   ├── app/                # Исходный код приложения
│   ├── migrations/         # SQL миграции
│   ├── tests/              # Тесты
│   ├── docker-compose.yml  # Docker Compose конфигурация
│   └── README.md           # Документация backend
│
├── ghouse-dashboard/       # Frontend дашборд (HTML/CSS/JS)
│   ├── index.html          # Главная страница
│   ├── login.html          # Страница входа
│   ├── css/                # Стили
│   ├── js/                 # JavaScript модули
│   └── README.md           # Документация frontend
│
├── README.md               # Этот файл
├── CONTRIBUTING.md         # Руководство по внесению вклада
└── LICENSE                 # Лицензия MIT
```

## 🚀 Быстрый старт

### Backend

```bash
cd backend

# Запуск через Docker Compose (рекомендуется)
docker-compose up -d

# Или ручная установка
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

📖 **Подробная документация:** [backend/README.md](backend/README.md)

### Frontend

```bash
cd ghouse-dashboard

# Открыть в браузере
# или запустить локальный сервер
python -m http.server 8080
```

📖 **Подробная документация:** [ghouse-dashboard/README.md](ghouse-dashboard/README.md)

## 📋 Содержание

- [Возможности](#-возможности)
- [Архитектура](#-архитектура)
- [Требования](#-требования)
- [Быстрый старт](#-быстрый-старт)
- [Установка Backend](#-установка-backend)
- [Установка Frontend](#-установка-frontend)
- [Конфигурация](#-конфигурация)
- [API Документация](#-api-документация)
- [Тестирование](#-тестирование)
- [Мониторинг](#-мониторинг)
- [Troubleshooting](#-troubleshooting)
- [Лицензия](#-лицензия)

## 🚀 Возможности

### Умная теплица
- 🌡️ Контроль температуры, влажности, освещения
- 💧 Автоматический полив (0-100%)
- 💡 Управление освещением (0-100%)
- 💨 Вентиляция (0-100%)
- 📊 Realtime мониторинг показателей

### Мониторинг воздуха
- 🌡️ Температура (°C)
- 💧 Влажность (%)
- 🌬️ CO₂ (ppm)
- ⚡ Давление (мм рт.ст.)
- 📈 Графики и история
- ⚠️ Система алертов

### Дроны
- 🔋 Мониторинг заряда батарей
- 📍 GPS отслеживание
- 🤖 Сменные модули (захват, орошение, забор почвы)
- 🏠 Автоматический возврат на базу
- 🔌 Зарядные станции

### Конвейер
- 🔄 Управление скоростью (0.5-3 м/с)
- 📦 Статистика транспортировки
- ⚙️ Контроль обслуживания
- 📊 Эффективность работы

### Аналитика почвы
- 💧 Влажность почвы
- 🧪 pH уровень
- 🌿 NPK анализ (Азот, Фосфор, Калий)
- 📜 История анализов
- 💡 Рекомендации

### Telegram интеграция
- 📱 Уведомления в Telegram
- 📊 Ежедневные отчеты
- ⚠️ Критические алерты
- 📋 Лог событий

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      GHouse System                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │  Frontend   │◄───────►│   Backend   │                   │
│  │  (Dashboard)│  HTTP/WS│   (API)     │                   │
│  │  Port: 80   │         │  Port: 8000 │                   │
│  └─────────────┘         └──────┬──────┘                   │
│                                 │                           │
│         ┌───────────────────────┼───────────────────────┐   │
│         │                       │                       │   │
│         ▼                       ▼                       ▼   │
│  ┌─────────────┐         ┌─────────────┐         ┌──────────┐│
│  │ PostgreSQL  │         │    Redis    │         │   MQTT   ││
│  │   Port:5432 │         │  Port: 6379 │         │Port: 1883││
│  └─────────────┘         └─────────────┘         └──────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Структура проекта

```
project GHouse/
├── backend/                    # Backend сервер (Python/FastAPI)
│   ├── app/
│   │   ├── api/               # API роуты
│   │   ├── db/                # База данных
│   │   ├── models/            # SQLAlchemy модели
│   │   ├── schemas/           # Pydantic схемы
│   │   ├── services/          # Сервисы (WebSocket, MQTT, Telegram)
│   │   ├── utils/             # Утилиты
│   │   ├── config.py          # Конфигурация
│   │   └── main.py            # Главное приложение
│   ├── migrations/            # SQL миграции
│   ├── tests/                 # Тесты
│   ├── docker-compose.yml     # Docker Compose
│   ├── Dockerfile             # Docker образ
│   ├── requirements.txt       # Python зависимости
│   └── .env.example          # Пример переменных окружения
│
├── ghouse-dashboard/          # Frontend дашборд
│   ├── index.html             # Главная страница
│   ├── login.html             # Страница входа
│   ├── css/
│   │   ├── main.css          # Основные стили
│   │   ├── components.css    # Компоненты
│   │   └── widgets.css       # Виджеты
│   ├── js/
│   │   ├── app.js            # Главное приложение
│   │   └── modules/
│   │       ├── api.js        # API клиент
│   │       ├── auth.js       # Аутентификация
│   │       ├── websocket.js  # WebSocket
│   │       ├── greenhouse.js # Теплица
│   │       ├── air-monitoring.js
│   │       ├── drones.js
│   │       ├── conveyor.js
│   │       └── soil.js
│   └── assets/
│
└── README.md                  # Эта документация
```

## 📋 Требования

### Обязательные
- **Python 3.11+**
- **PostgreSQL 15+**
- **Redis 7+**
- **Node.js 18+** (опционально, для frontend dev server)

### Опциональные
- **Docker 20+** и **Docker Compose 2+**
- **MQTT брокер** (Mosquitto)

## 🚀 Быстрый старт

### Вариант 1: Docker Compose (Рекомендуется)

```bash
# Перейдите в директорию backend
cd backend

# Запуск всех сервисов
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f api
```

**Доступ:**
- Frontend: http://localhost:8000 (через backend proxy)
- Backend API: http://localhost:8000/api/v1
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Вариант 2: Ручная установка

#### 1. Запуск зависимостей (PostgreSQL + Redis)

```bash
# Docker (только зависимости)
cd backend
docker-compose up -d postgres redis

# Или локальная установка
# PostgreSQL: https://www.postgresql.org/download/
# Redis: https://redis.io/download
```

#### 2. Backend

```bash
cd backend

# Создание виртуального окружения
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Установка зависимостей
pip install -r requirements.txt

# Копирование .env
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Запуск миграций БД
python -c "from app.db.database import init_db; import asyncio; asyncio.run(init_db())"

# Запуск сервера (development)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Запуск сервера (production)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### 3. Frontend

```bash
# Вариант A: Открыть файл напрямую
# Откройте ghouse-dashboard/login.html в браузере

# Вариант B: Локальный сервер (Python)
cd ghouse-dashboard
python -m http.server 8080
# Откройте http://localhost:8080/login.html

# Вариант C: Node.js http-server
cd ghouse-dashboard
npx http-server -p 8080
# Откройте http://localhost:8080/login.html
```

## 🔧 Установка Backend

### Шаг 1: Подготовка окружения

```bash
cd backend

# Создание виртуального окружения
python -m venv venv

# Активация
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### Шаг 2: Установка зависимостей

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Шаг 3: Настройка переменных окружения

```bash
# Копирование примера
copy .env.example .env  # Windows
cp .env.example .env    # Linux/Mac

# Редактирование .env (обязательные переменные):
DATABASE_URL=postgresql://ghouse:ghouse_password@localhost:5432/ghouse
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=your-secret-key-change-in-production
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### Шаг 4: Инициализация базы данных

```bash
# Автоматическая инициализация при первом запуске
# Или вручную:

# Через Python
python -c "from app.db.database import init_db; import asyncio; asyncio.run(init_db())"

# Через psql
psql -U postgres -h localhost
CREATE DATABASE ghouse;
CREATE USER ghouse WITH PASSWORD 'ghouse_password';
GRANT ALL PRIVILEGES ON DATABASE ghouse TO ghouse;
\c ghouse
\i migrations/001_init.sql
```

### Шаг 5: Запуск сервера

```bash
# Development режим (auto-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production режим
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# С логированием
uvicorn app.main:app --reload --log-level debug
```

### Шаг 6: Проверка

```bash
# Health check
curl http://localhost:8000/api/v1/health

# Swagger UI
# Откройте http://localhost:8000/docs

# ReDoc
# Откройте http://localhost:8000/redoc
```

## 🔧 Установка Frontend

### Вариант 1: Прямой запуск (без сервера)

```bash
# Просто откройте файл в браузере
# ghouse-dashboard/login.html
```

### Вариант 2: Python HTTP сервер

```bash
cd ghouse-dashboard

# Запуск сервера
python -m http.server 8080

# Откройте в браузере
# http://localhost:8080/login.html
```

### Вариант 3: Node.js http-server

```bash
cd ghouse-dashboard

# Установка (если нет)
npm install -g http-server

# Запуск
npx http-server -p 8080

# Откройте в браузере
# http://localhost:8080/login.html
```

### Вариант 4: Через backend (production)

Backend настроен на раздачу статических файлов из `ghouse-dashboard/`.

```bash
#Backend автоматически раздает frontend на порту 8000
# Откройте http://localhost:8000/login.html
```

## ⚙️ Конфигурация

### Backend (.env)

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `APP_ENV` | Окружение | `development` |
| `APP_DEBUG` | Режим отладки | `true` |
| `DATABASE_URL` | URL PostgreSQL | `postgresql://ghouse:ghouse_password@localhost:5432/ghouse` |
| `REDIS_URL` | URL Redis | `redis://localhost:6379` |
| `JWT_SECRET_KEY` | Секрет JWT | `change_me_in_production` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни access токена | `30` |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Время жизни refresh токена | `7` |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота | - |
| `MQTT_BROKER` | MQTT брокер | `localhost` |
| `MQTT_PORT` | MQTT порт | `1883` |

### Frontend

Frontend автоматически определяет backend:

```javascript
// Development (localhost)
const baseUrl = 'http://localhost:8000/api/v1'

// Production (на домене)
const baseUrl = '/api/v1'
```

## 📡 API Документация

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/v1/auth/login` | Вход (username, password) |
| POST | `/api/v1/auth/logout` | Выход |
| POST | `/api/v1/auth/refresh` | Обновление токена |
| GET | `/api/v1/auth/me` | Текущий пользователь |

### Теплица

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/greenhouse/status` | Статус систем |
| GET | `/api/v1/greenhouse/settings` | Настройки |
| PUT | `/api/v1/greenhouse/settings` | Обновление настроек |
| POST | `/api/v1/greenhouse/watering` | Управление поливом |
| POST | `/api/v1/greenhouse/lighting` | Управление освещением |
| POST | `/api/v1/greenhouse/ventilation` | Управление вентиляцией |

### Воздух

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/air/current` | Текущие показатели |
| GET | `/api/v1/air/history` | История |
| GET | `/api/v1/air/thresholds` | Пороги |
| GET | `/api/v1/air/alerts` | Алерты |

### Дроны

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/drones` | Список дронов |
| GET | `/api/v1/drones/{id}` | Информация о дроне |
| POST | `/api/v1/drones/{id}/command` | Команда дрону |
| POST | `/api/v1/drones/{id}/return-to-base` | Возврат на базу |

### Конвейер

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/conveyor/status` | Статус |
| POST | `/api/v1/conveyor/start` | Запуск |
| POST | `/api/v1/conveyor/stop` | Остановка |
| PUT | `/api/v1/conveyor/speed` | Скорость |

### Почва

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/soil/current` | Текущий анализ |
| POST | `/api/v1/soil/analyze` | Запуск анализа |
| GET | `/api/v1/soil/zones` | Зоны |
| GET | `/api/v1/soil/recommendations` | Рекомендации |

### Telegram

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/telegram/status` | Статус |
| POST | `/api/v1/telegram/send` | Отправка сообщения |
| POST | `/api/v1/telegram/broadcast` | Рассылка |

### WebSocket

```
ws://localhost:8000/ws?token=<access_token>
```

**Каналы:**
- `greenhouse` - События теплицы
- `air` - События воздуха
- `drones` - События дронов
- `conveyor` - События конвейера
- `soil` - События почвы
- `alerts` - Системные алерты
- `notifications` - Уведомления

**Пример подписки:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws?token=' + token);
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log(message.channel, message.data);
};
```

## 🧪 Тестирование

### Backend тесты

```bash
cd backend

# Запуск всех тестов
pytest

# Запуск с coverage
pytest --cov=app --cov-report=html

# Запуск конкретных тестов
pytest tests/test_api.py -v

# Запуск с логированием
pytest -v -s
```

### Frontend тестирование

```bash
# Откройте DevTools в браузере (F12)
# Console для логов

# Проверка API через Swagger
# http://localhost:8000/docs
```

## 📊 Мониторинг

### Prometheus метрики

```bash
# Метрики доступны по адресу
http://localhost:8000/metrics
```

### Health checks

```bash
# Liveness probe
curl http://localhost:8000/api/v1/health

# Readiness probe
curl http://localhost:8000/api/v1/health/ready
```

### Grafana Dashboard (опционально)

```bash
# В docker-compose раскомментировать grafana сервис
# Доступ: http://localhost:3000
# Логин: admin, Пароль: admin
```

## 🔐 Безопасность

### Реализовано
- ✅ JWT аутентификация (access + refresh)
- ✅ RBAC (роли: admin, operator, viewer, maintenance)
- ✅ HTTPS поддержка (в production)
- ✅ Rate limiting (100 запросов/мин)
- ✅ CORS настройка
- ✅ Аудит операций

### Рекомендации для production
1. Смените `JWT_SECRET_KEY` на уникальный
2. Включите HTTPS (nginx/traefik)
3. Настройте firewall правила
4. Регулярно обновляйте зависимости
5. Включите логирование безопасности

## 🐛 Troubleshooting

### Backend не запускается

```bash
# Проверка Python версии
python --version  # Должна быть 3.11+

# Проверка зависимостей
pip install -r requirements.txt --upgrade

# Проверка подключения к БД
psql -U ghouse -h localhost -d ghouse
```

### Ошибка подключения к базе данных

```bash
# Проверка статуса PostgreSQL
docker-compose ps postgres

# Перезапуск
docker-compose restart postgres

# Проверка логов
docker-compose logs postgres
```

### Frontend не подключается к API

```bash
# Проверка доступности API
curl http://localhost:8000/api/v1/health

# Проверка CORS в браузере (F12 Console)

# Очистка кэша браузера
```

### WebSocket не подключается

```bash
# Проверка доступности WebSocket
# Откройте Browser DevTools -> Network -> WS

# Проверка токена аутентификации
# Токен должен быть действительным
```

### Ошибка аутентификации

```bash
# Сброс токенов в localStorage
# Откройте Console и выполните:
localStorage.clear()

# Перезагрузка страницы
location.reload()
```

## 📝 Лицензия

Этот проект распространяется под лицензией MIT. См. файл [LICENSE](LICENSE) для деталей.

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие проекта! Пожалуйста, ознакомьтесь с [CONTRIBUTING.md](CONTRIBUTING.md) перед началом работы.

## 📚 Документация

- [Backend документация](backend/README.md) — API, установка, конфигурация
- [Frontend документация](ghouse-dashboard/README.md) — модули, интеграция, дизайн-система
- [Техническое задание](back.md) — детальная спецификация системы

## 🔗 Ссылки

- [GitHub Repository](https://github.com/ghouse/ghouse)
- [Issues](https://github.com/ghouse/ghouse/issues)
- [Discussions](https://github.com/ghouse/ghouse/discussions)

## 🤝 Поддержка

По вопросам обращайтесь:
- Email: support@ghouse.local
- Telegram: @ghouse_support

---

**GHouse v2.0.0** | Автономный Агрокомплекс | © 2026 GHouse
