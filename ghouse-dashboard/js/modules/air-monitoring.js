/**
 * GHouse Dashboard - Air Monitoring Module
 * Мониторинг параметров воздуха: температура, влажность, CO2, давление
 * Интеграция с Backend API: /api/v1/air/*
 */

const AirMonitoringModule = (function() {
    // Конфигурация
    const config = {
        temperature: {
            min: 18,
            max: 30,
            optimal: 24,
            unit: '°C',
            key: 'air_temperature'
        },
        humidity: {
            min: 40,
            max: 80,
            optimal: 65,
            unit: '%',
            key: 'air_humidity'
        },
        co2: {
            min: 300,
            max: 1000,
            optimal: 420,
            unit: 'ppm',
            key: 'air_co2'
        },
        pressure: {
            min: 740,
            max: 780,
            optimal: 760,
            unit: 'мм рт.ст.',
            key: 'air_pressure'
        },
        apiEndpoints: {
            current: '/air/current',
            history: '/air/history',
            thresholds: '/air/thresholds',
            alerts: '/air/alerts'
        },
        useApi: true,
        updateInterval: 5000
    };

    // Состояние
    let state = {
        temperature: { value: 24.5, status: 'ok', history: [] },
        humidity: { value: 65, status: 'ok', history: [] },
        co2: { value: 420, status: 'ok', history: [] },
        pressure: { value: 760, status: 'ok', history: [] },
        thresholds: {},
        alerts: [],
        lastUpdate: null
    };

    // История данных для графиков
    let history = {
        temperature: [],
        humidity: []
    };

    const MAX_HISTORY_POINTS = 24;

    // DOM элементы
    let elements = {};

    // Chart.js объект
    let chart = null;

    // Таймер обновления
    let updateTimer = null;

    /**
     * Инициализация модуля
     */
    async function init() {
        cacheElements();
        
        // Инициализация графика
        initChart();
        
        // Загрузка данных
        if (config.useApi && window.ApiClient) {
            try {
                await loadFromApi();
            } catch (error) {
                console.warn('[AirMonitoringModule] Не удалось загрузить из API:', error);
                loadState();
            }
        } else {
            loadState();
        }
        
        bindEvents();
        startMonitoring();
        
        console.log('[AirMonitoringModule] Инициализирован');
    }

    /**
     * Загрузка данных из API
     */
    async function loadFromApi() {
        try {
            const [current, thresholds, alerts] = await Promise.all([
                window.ApiClient.getAirCurrent().catch(() => null),
                window.ApiClient.getAirThresholds().catch(() => null),
                window.ApiClient.getAirAlerts().catch(() => null)
            ]);

            if (current) {
                state.temperature.value = current.temperature ?? state.temperature.value;
                state.humidity.value = current.humidity ?? state.humidity.value;
                state.co2.value = current.co2 ?? state.co2.value;
                state.pressure.value = current.pressure ?? state.pressure.value;
                state.lastUpdate = new Date().toISOString();
                
                updateStatuses();
                addToHistory();
                saveState();
            }

            if (thresholds) {
                state.thresholds = thresholds;
            }

            if (alerts) {
                state.alerts = alerts;
                updateAlertsUI(alerts);
            }

        } catch (error) {
            console.error('[AirMonitoringModule] Ошибка загрузки из API:', error);
            throw error;
        }
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            airTemp: document.getElementById('airTemp'),
            airHumidity: document.getElementById('airHumidity'),
            airCO2: document.getElementById('airCO2'),
            airPressure: document.getElementById('airPressure'),
            airStatus: document.getElementById('airStatus'),
            alertCount: document.getElementById('alertCount'),
            alertsList: document.getElementById('alertsList'),
            airChartCanvas: document.getElementById('airChartCanvas')
        };
    }

    /**
     * Инициализация графика
     */
    function initChart() {
        if (!elements.airChartCanvas) return;

        const ctx = elements.airChartCanvas.getContext('2d');

        // Проверка наличия Chart.js
        if (typeof Chart === 'undefined') {
            console.warn('[AirMonitoringModule] Chart.js не найден, график не будет отображен');
            return;
        }

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Температура (°C)',
                        data: [],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Влажность (%)',
                        data: [],
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#b0b0b0',
                            font: { size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    }
                },
                animation: {
                    duration: 500
                }
            }
        });
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        // Обработка кликов по алертам
        if (elements.alertsList) {
            elements.alertsList.addEventListener('click', handleAlertClick);
        }
    }

    /**
     * Запуск мониторинга
     */
    function startMonitoring() {
        // Очистка предыдущего таймера
        if (updateTimer) {
            clearInterval(updateTimer);
        }

        // Обновление каждые 5 секунд
        updateTimer = setInterval(() => {
            if (config.useApi && window.ApiClient) {
                refreshData();
            } else {
                simulateSensorReadings();
                updateUI();
                updateChart();
                checkAlerts();
            }
        }, config.updateInterval);
    }

    /**
     * Эмуляция показаний сенсоров (fallback)
     */
    function simulateSensorReadings() {
        // Добавляем небольшие случайные изменения
        state.temperature.value = normalize(
            state.temperature.value + (Math.random() - 0.5) * 0.5,
            config.temperature.min,
            config.temperature.max
        );

        state.humidity.value = normalize(
            state.humidity.value + (Math.random() - 0.5) * 2,
            config.humidity.min,
            config.humidity.max
        );

        state.co2.value = normalize(
            state.co2.value + (Math.random() - 0.5) * 10,
            config.co2.min,
            config.co2.max
        );

        state.pressure.value = normalize(
            state.pressure.value + (Math.random() - 0.5) * 2,
            config.pressure.min,
            config.pressure.max
        );

        // Обновление статусов
        updateStatuses();

        // Добавление в историю
        addToHistory();
    }

    /**
     * Нормализация значения в пределах
     */
    function normalize(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Обновление статусов параметров
     */
    function updateStatuses() {
        state.temperature.status = getStatus(state.temperature.value, config.temperature.min, config.temperature.max);
        state.humidity.status = getStatus(state.humidity.value, config.humidity.min, config.humidity.max);
        state.co2.status = getStatus(state.co2.value, config.co2.min, config.co2.max);
        state.pressure.status = getStatus(state.pressure.value, config.pressure.min, config.pressure.max);
    }

    /**
     * Получение статуса значения
     */
    function getStatus(value, min, max) {
        const range = max - min;
        const warningMargin = range * 0.1;

        if (value < min + warningMargin || value > max - warningMargin) {
            return 'warning';
        }
        if (value < min || value > max) {
            return 'error';
        }
        return 'ok';
    }

    /**
     * Добавление данных в историю
     */
    function addToHistory() {
        const now = new Date();
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' +
                         now.getMinutes().toString().padStart(2, '0');

        history.temperature.push({ time: timeLabel, value: state.temperature.value });
        history.humidity.push({ time: timeLabel, value: state.humidity.value });

        // Ограничение размера истории
        if (history.temperature.length > MAX_HISTORY_POINTS) {
            history.temperature.shift();
            history.humidity.shift();
        }
    }

    /**
     * Загрузка сохраненного состояния
     */
    function loadState() {
        try {
            const saved = localStorage.getItem('air_monitoring_state');
            if (saved) {
                const loaded = JSON.parse(saved);
                state = { ...state, ...loaded };
                history = loaded.history || history;
            }
        } catch (e) {
            console.warn('[AirMonitoringModule] Не удалось загрузить состояние:', e);
        }
    }

    /**
     * Сохранение состояния
     */
    function saveState() {
        try {
            localStorage.setItem('air_monitoring_state', JSON.stringify({
                ...state,
                history: history
            }));
        } catch (e) {
            console.warn('[AirMonitoringModule] Не удалось сохранить состояние:', e);
        }
    }

    /**
     * Обновление UI
     */
    function updateUI() {
        if (elements.airTemp) {
            elements.airTemp.textContent = state.temperature.value.toFixed(1) + config.temperature.unit;
            updateParamIndicator(elements.airTemp.closest('.air-param-item'), state.temperature.status);
        }

        if (elements.airHumidity) {
            elements.airHumidity.textContent = state.humidity.value.toFixed(0) + config.humidity.unit;
            updateParamIndicator(elements.airHumidity.closest('.air-param-item'), state.humidity.status);
        }

        if (elements.airCO2) {
            elements.airCO2.textContent = state.co2.value.toFixed(0) + config.co2.unit;
            updateParamIndicator(elements.airCO2.closest('.air-param-item'), state.co2.status);
        }

        if (elements.airPressure) {
            elements.airPressure.textContent = state.pressure.value.toFixed(0) + config.pressure.unit;
            updateParamIndicator(elements.airPressure.closest('.air-param-item'), state.pressure.status);
        }

        // Общий статус
        if (elements.airStatus) {
            const allOk = Object.values(state).every(s => s.status === 'ok');
            const hasWarning = Object.values(state).some(s => s.status === 'warning');
            const hasError = Object.values(state).some(s => s.status === 'error');

            if (hasError) {
                elements.airStatus.textContent = 'Внимание!';
                elements.airStatus.className = 'status-badge error';
            } else if (hasWarning) {
                elements.airStatus.textContent = 'Предупреждение';
                elements.airStatus.className = 'status-badge warning';
            } else {
                elements.airStatus.textContent = 'В норме';
                elements.airStatus.className = 'status-badge ok';
            }
        }

        // Обновление счетчика алертов
        if (elements.alertCount) {
            elements.alertCount.textContent = state.alerts.length;
        }
    }

    /**
     * Обновление индикатора параметра
     */
    function updateParamIndicator(paramEl, status) {
        if (!paramEl) return;

        const indicator = paramEl.querySelector('.param-indicator');
        if (indicator) {
            indicator.className = 'param-indicator ' + status;

            const dot = indicator.querySelector('.indicator-dot');
            const text = indicator.querySelector('.indicator-text');

            if (dot && text) {
                const statusTexts = {
                    ok: 'Норма',
                    warning: 'Внимание',
                    error: 'Критично'
                };
                text.textContent = statusTexts[status];
            }
        }

        // Обновление полоски диапазона
        const rangeFill = paramEl.querySelector('.range-fill');
        if (rangeFill) {
            const rangeEl = paramEl.querySelector('.param-range');
            if (rangeEl) {
                const minVal = parseFloat(rangeEl.querySelector('.range-min').textContent);
                const maxVal = parseFloat(rangeEl.querySelector('.range-max').textContent);
                const currentVal = parseFloat(paramEl.querySelector('.param-value').textContent);
                const percent = ((currentVal - minVal) / (maxVal - minVal)) * 100;
                rangeFill.style.left = Math.max(0, Math.min(100, percent)) + '%';
            }
        }
    }

    /**
     * Обновление графика
     */
    function updateChart() {
        if (!chart) return;

        chart.data.labels = history.temperature.map(h => h.time);
        chart.data.datasets[0].data = history.temperature.map(h => h.value);
        chart.data.datasets[1].data = history.humidity.map(h => h.value);
        chart.update('none');
    }

    /**
     * Проверка алертов
     */
    function checkAlerts() {
        const alerts = [];

        Object.keys(state).forEach(key => {
            if (state[key]?.status === 'warning' || state[key]?.status === 'error') {
                alerts.push({
                    type: state[key].status === 'error' ? 'critical' : 'warning',
                    param: getParamName(key),
                    value: state[key].value,
                    unit: config[key]?.unit || '',
                    status: state[key].status
                });
            }
        });

        state.alerts = alerts;
        updateAlertsUI(alerts);
    }

    /**
     * Получение названия параметра
     */
    function getParamName(key) {
        const names = {
            temperature: 'Температура',
            humidity: 'Влажность',
            co2: 'CO₂',
            pressure: 'Давление'
        };
        return names[key] || key;
    }

    /**
     * Обновление UI алертов
     */
    function updateAlertsUI(alerts) {
        if (elements.alertCount) {
            elements.alertCount.textContent = alerts.length;
        }

        if (elements.alertsList) {
            if (alerts.length === 0) {
                elements.alertsList.innerHTML = `
                    <div class="alert-empty">
                        <span class="alert-empty-icon">✅</span>
                        <span class="alert-empty-text">Нет активных алертов</span>
                    </div>
                `;
            } else {
                elements.alertsList.innerHTML = alerts.map(alert => `
                    <div class="alert-item ${alert.type}" data-param="${alert.param}">
                        <span class="alert-icon">${alert.type === 'critical' ? '🚨' : '⚠️'}</span>
                        <div class="alert-content">
                            <div class="alert-title">${alert.param}: отклонение от нормы</div>
                            <div class="alert-message">Текущее: ${alert.value.toFixed(1)} ${alert.unit}</div>
                        </div>
                        <span class="alert-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                `).join('');
            }
        }
    }

    /**
     * Обработка клика по алерту
     */
    function handleAlertClick(e) {
        const alertItem = e.target.closest('.alert-item');
        if (alertItem) {
            const param = alertItem.dataset.param;
            if (window.App && window.App.showAlert) {
                window.App.showAlert({
                    title: param + ': отклонение от нормы',
                    message: 'Рекомендуется проверить систему и при необходимости скорректировать параметры.'
                });
            }
        }
    }

    /**
     * Обработка WebSocket событий
     */
    function handleWebSocketEvent(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'sensor_update':
                if (data.temperature !== undefined) {
                    state.temperature.value = data.temperature;
                    state.temperature.status = getStatus(data.temperature, config.temperature.min, config.temperature.max);
                }
                if (data.humidity !== undefined) {
                    state.humidity.value = data.humidity;
                    state.humidity.status = getStatus(data.humidity, config.humidity.min, config.humidity.max);
                }
                if (data.co2 !== undefined) {
                    state.co2.value = data.co2;
                    state.co2.status = getStatus(data.co2, config.co2.min, config.co2.max);
                }
                if (data.pressure !== undefined) {
                    state.pressure.value = data.pressure;
                    state.pressure.status = getStatus(data.pressure, config.pressure.min, config.pressure.max);
                }
                state.lastUpdate = new Date().toISOString();
                addToHistory();
                updateUI();
                updateChart();
                checkAlerts();
                break;
                
            case 'alert':
                if (data) {
                    state.alerts.push(data);
                    updateAlertsUI(state.alerts);
                    
                    if (window.App && window.App.notify) {
                        window.App.notify({
                            type: data.type === 'critical' ? 'error' : 'warning',
                            title: data.param + ': отклонение',
                            message: `Текущее значение: ${data.value}`
                        });
                    }
                }
                break;
        }
    }

    /**
     * Обновление данных (для polling)
     */
    async function refreshData() {
        if (!config.useApi || !window.ApiClient) return;
        
        try {
            await loadFromApi();
            updateUI();
            updateChart();
        } catch (error) {
            console.warn('[AirMonitoringModule] Не удалось обновить данные:', error);
        }
    }

    /**
     * Получение текущего состояния
     */
    function getState() {
        return { ...state };
    }

    /**
     * Получение истории
     */
    function getHistory() {
        return { ...history };
    }

    /**
     * Экспорт данных
     */
    function exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            current: state,
            history: history
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'air-monitoring-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Публичный API
    return {
        init,
        getState,
        getHistory,
        exportData,
        handleWebSocketEvent,
        refreshData
    };
})();

// Экспорт для глобального доступа
window.AirMonitoringModule = AirMonitoringModule;
