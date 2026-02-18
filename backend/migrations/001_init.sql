-- GHouse Database Initialization Script
-- PostgreSQL 15+

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== РОЛИ И ПОЛЬЗОВАТЕЛИ ====================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ==================== ТЕПЛИЦА ====================

CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    system_type VARCHAR(50) NOT NULL,
    cron_expression VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS greenhouse_settings (
    id SERIAL PRIMARY KEY,
    system_type VARCHAR(50) NOT NULL,
    current_value DECIMAL(5,2) DEFAULT 0,
    target_value DECIMAL(5,2) DEFAULT 0,
    min_value DECIMAL(5,2) DEFAULT 0,
    max_value DECIMAL(5,2) DEFAULT 100,
    is_auto BOOLEAN DEFAULT false,
    schedule_id INTEGER REFERENCES schedules(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS greenhouse_history (
    id SERIAL PRIMARY KEY,
    setting_id INTEGER REFERENCES greenhouse_settings(id),
    system_type VARCHAR(50) NOT NULL,
    previous_value DECIMAL(5,2),
    new_value DECIMAL(5,2),
    changed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_greenhouse_history_created_at ON greenhouse_history(created_at DESC);

-- ==================== МОНИТОРИНГ ВОЗДУХА ====================

CREATE TABLE IF NOT EXISTS air_metrics (
    id SERIAL PRIMARY KEY,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    co2 DECIMAL(8,2),
    pressure DECIMAL(6,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_air_metrics_recorded_at ON air_metrics(recorded_at DESC);

CREATE TABLE IF NOT EXISTS air_thresholds (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(50) UNIQUE NOT NULL,
    min_value DECIMAL(10,2) NOT NULL,
    max_value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== ДРОНЫ ====================

CREATE TABLE IF NOT EXISTS drones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    serial_number VARCHAR(100) UNIQUE,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'offline',
    current_module VARCHAR(50),
    battery_level DECIMAL(5,2) DEFAULT 0,
    gps_lat DECIMAL(10,8),
    gps_lng DECIMAL(11,8),
    altitude DECIMAL(8,2) DEFAULT 0,
    speed DECIMAL(5,2) DEFAULT 0,
    last_telemetry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_drones_status ON drones(status);

CREATE TABLE IF NOT EXISTS drone_missions (
    id SERIAL PRIMARY KEY,
    drone_id INTEGER REFERENCES drones(id),
    mission_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    waypoints JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_drone_missions_drone_id ON drone_missions(drone_id);

CREATE TABLE IF NOT EXISTS charging_stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    is_occupied BOOLEAN DEFAULT false,
    occupied_by_drone_id INTEGER REFERENCES drones(id),
    charge_level DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== КОНВЕЙЕР ====================

CREATE TABLE IF NOT EXISTS conveyor_status (
    id SERIAL PRIMARY KEY,
    is_running BOOLEAN DEFAULT false,
    speed DECIMAL(4,2) DEFAULT 0,
    interval_seconds INTEGER DEFAULT 0,
    total_transported INTEGER DEFAULT 0,
    shift_count INTEGER DEFAULT 0,
    work_time_seconds INTEGER DEFAULT 0,
    efficiency DECIMAL(5,2) DEFAULT 0,
    last_maintenance DATE,
    next_maintenance DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conveyor_statistics (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    items_transported INTEGER DEFAULT 0,
    work_time_seconds INTEGER DEFAULT 0,
    avg_speed DECIMAL(4,2) DEFAULT 0,
    avg_efficiency DECIMAL(5,2) DEFAULT 0,
    downtime_seconds INTEGER DEFAULT 0
);

-- ==================== ПОЧВА ====================

CREATE TABLE IF NOT EXISTS soil_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    area_sqm DECIMAL(10,2),
    coordinates JSONB DEFAULT '[]',
    current_analysis_id INTEGER
);

CREATE TABLE IF NOT EXISTS soil_analyses (
    id SERIAL PRIMARY KEY,
    zone_id VARCHAR(10),
    moisture DECIMAL(5,2),
    ph DECIMAL(3,1),
    npk_n DECIMAL(5,2),
    npk_p DECIMAL(5,2),
    npk_k DECIMAL(5,2),
    temperature DECIMAL(5,2),
    conductivity DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'optimal',
    recommendations JSONB DEFAULT '[]',
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_soil_analyses_zone_id ON soil_analyses(zone_id);
CREATE INDEX idx_soil_analyses_analyzed_at ON soil_analyses(analyzed_at DESC);

-- ==================== УВЕДОМЛЕНИЯ ====================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    acknowledged BOOLEAN DEFAULT false,
    source VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    telegram_enabled BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT false,
    notify_critical BOOLEAN DEFAULT true,
    notify_warning BOOLEAN DEFAULT true,
    notify_info BOOLEAN DEFAULT false,
    notify_report BOOLEAN DEFAULT false,
    frequency VARCHAR(20) DEFAULT 'immediate'
);

-- ==================== АУДИТ ====================

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ==================== TELEGRAM ====================

CREATE TABLE IF NOT EXISTS telegram_logs (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(100),
    message_text TEXT,
    direction VARCHAR(10),
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_telegram_logs_chat_id ON telegram_logs(chat_id);

-- ==================== ДЕФОЛТНЫЕ ДАННЫЕ ====================

-- Роли
INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'Администратор системы', '["*"]'),
    ('operator', 'Оператор', '["greenhouse:read", "greenhouse:write", "drones:read", "conveyor:read", "soil:read"]'),
    ('viewer', 'Наблюдатель', '["greenhouse:read", "air:read", "drones:read", "conveyor:read", "soil:read"]'),
    ('maintenance', 'Технический специалист', '["greenhouse:read", "greenhouse:write", "conveyor:read", "conveyor:write"]')
ON CONFLICT (name) DO NOTHING;

-- Пороги для воздуха
INSERT INTO air_thresholds (metric_name, min_value, max_value, unit) VALUES
    ('temperature', 18, 30, '°C'),
    ('humidity', 40, 80, '%'),
    ('co2', 300, 1000, 'ppm'),
    ('pressure', 740, 780, 'мм рт.ст.')
ON CONFLICT (metric_name) DO NOTHING;

-- Зоны почвы
INSERT INTO soil_zones (name, area_sqm) VALUES
    ('A', 100),
    ('B', 150)
ON CONFLICT (name) DO NOTHING;

-- Зарядные станции
INSERT INTO charging_stations (name, is_occupied, charge_level) VALUES
    ('Station-1', false, 100),
    ('Station-2', false, 100),
    ('Station-3', false, 100)
ON CONFLICT DO NOTHING;
