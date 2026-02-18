/**
 * GHouse Dashboard - Greenhouse Module
 * Управление умной теплицей: полив, освещение, вентиляция
 * Интеграция с Backend API: /api/v1/greenhouse/*
 */

const GreenhouseModule = (function() {
    // Конфигурация
    const config = {
        watering: {
            min: 0,
            max: 100,
            default: 65,
            key: 'greenhouse_watering'
        },
        lighting: {
            min: 0,
            max: 100,
            default: 80,
            key: 'greenhouse_lighting'
        },
        ventilation: {
            min: 0,
            max: 100,
            default: 45,
            key: 'greenhouse_ventilation'
        },
        apiEndpoints: {
            status: '/greenhouse/status',
            settings: '/greenhouse/settings',
            watering: '/greenhouse/watering',
            lighting: '/greenhouse/lighting',
            ventilation: '/greenhouse/ventilation'
        },
        useApi: true // Переключатель API/эмуляция
    };

    // Состояние
    let state = {
        watering: { value: 65, active: true, auto: false },
        lighting: { value: 80, active: true, auto: false },
        ventilation: { value: 45, active: true, auto: false },
        temperature: 24,
        humidity: 65,
        soilMoisture: 78,
        lastUpdate: null,
        settings: {}
    };

    // DOM элементы
    let elements = {};

    /**
     * Инициализация модуля
     */
    async function init() {
        cacheElements();
        
        // Попытка загрузки с API
        if (config.useApi && window.ApiClient) {
            try {
                await loadFromApi();
            } catch (error) {
                console.warn('[GreenhouseModule] Не удалось загрузить из API, используем localStorage:', error);
                loadState();
            }
        } else {
            loadState();
        }
        
        bindEvents();
        updateUI();
        console.log('[GreenhouseModule] Инициализирован');
    }

    /**
     * Загрузка данных из API
     */
    async function loadFromApi() {
        try {
            // Загрузка статуса и настроек параллельно
            const [status, settings] = await Promise.all([
                window.ApiClient.getGreenhouseStatus().catch(() => null),
                window.ApiClient.getGreenhouseSettings().catch(() => null)
            ]);

            if (status) {
                state.watering.value = status.watering?.level ?? state.watering.value;
                state.watering.active = status.watering?.active ?? state.watering.active;
                
                state.lighting.value = status.lighting?.level ?? state.lighting.value;
                state.lighting.active = status.lighting?.active ?? state.lighting.active;
                
                state.ventilation.value = status.ventilation?.level ?? state.ventilation.value;
                state.ventilation.active = status.ventilation?.active ?? state.ventilation.active;
                
                state.temperature = status.temperature ?? state.temperature;
                state.humidity = status.humidity ?? state.humidity;
                state.soilMoisture = status.soilMoisture ?? state.soilMoisture;
                state.lastUpdate = new Date().toISOString();
            }

            if (settings) {
                state.settings = settings;
                state.watering.auto = settings.wateringAuto ?? state.watering.auto;
                state.lighting.auto = settings.lightingAuto ?? state.lighting.auto;
                state.ventilation.auto = settings.ventilationAuto ?? state.ventilation.auto;
            }

            saveState();

        } catch (error) {
            console.error('[GreenhouseModule] Ошибка загрузки из API:', error);
            throw error;
        }
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            wateringSlider: document.getElementById('wateringSlider'),
            lightSlider: document.getElementById('lightSlider'),
            ventSlider: document.getElementById('ventSlider'),
            wateringStatus: document.getElementById('wateringStatus'),
            lightStatus: document.getElementById('lightStatus'),
            ventStatus: document.getElementById('ventStatus')
        };
    }

    /**
     * Загрузка сохраненного состояния
     */
    function loadState() {
        try {
            const saved = localStorage.getItem('greenhouse_state');
            if (saved) {
                state = { ...state, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('[GreenhouseModule] Не удалось загрузить состояние:', e);
        }
    }

    /**
     * Сохранение состояния
     */
    function saveState() {
        try {
            localStorage.setItem('greenhouse_state', JSON.stringify(state));
        } catch (e) {
            console.warn('[GreenhouseModule] Не удалось сохранить состояние:', e);
        }
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        // Слайдеры
        if (elements.wateringSlider) {
            elements.wateringSlider.addEventListener('input', (e) => {
                updateSystem('watering', parseInt(e.target.value));
            });
            elements.wateringSlider.addEventListener('change', (e) => {
                sendToApi('watering', parseInt(e.target.value));
            });
        }

        if (elements.lightSlider) {
            elements.lightSlider.addEventListener('input', (e) => {
                updateSystem('lighting', parseInt(e.target.value));
            });
            elements.lightSlider.addEventListener('change', (e) => {
                sendToApi('lighting', parseInt(e.target.value));
            });
        }

        if (elements.ventSlider) {
            elements.ventSlider.addEventListener('input', (e) => {
                updateSystem('ventilation', parseInt(e.target.value));
            });
            elements.ventSlider.addEventListener('change', (e) => {
                sendToApi('ventilation', parseInt(e.target.value));
            });
        }
    }

    /**
     * Обновление системы
     * @param {string} system - watering, lighting, ventilation
     * @param {number} value - значение 0-100
     */
    function updateSystem(system, value) {
        state[system].value = value;
        state[system].active = value > 0;

        saveState();
        updateUI();

        // Уведомление об изменении
        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: `Изменение: ${getSystemName(system)}`,
                message: `Уровень установлен на ${value}%`
            });
        }
    }

    /**
     * Отправка команды в API
     */
    async function sendToApi(system, value) {
        if (!config.useApi || !window.ApiClient) return;

        try {
            let response;
            switch (system) {
                case 'watering':
                    response = await window.ApiClient.controlWatering(value);
                    break;
                case 'lighting':
                    response = await window.ApiClient.controlLighting(value);
                    break;
                case 'ventilation':
                    response = await window.ApiClient.controlVentilation(value);
                    break;
            }

            if (response) {
                state.lastUpdate = new Date().toISOString();
                saveState();
                console.log(`[GreenhouseModule] Команда отправлена: ${system} = ${value}%`);
            }

        } catch (error) {
            console.error(`[GreenhouseModule] Ошибка отправки команды ${system}:`, error);
            
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось изменить ${getSystemName(system)}`
                });
            }
        }
    }

    /**
     * Получение названия системы
     */
    function getSystemName(system) {
        const names = {
            watering: 'Полив',
            lighting: 'Освещение',
            ventilation: 'Вентиляция'
        };
        return names[system] || system;
    }

    /**
     * Обновление UI
     */
    function updateUI() {
        // Обновление слайдеров
        if (elements.wateringSlider) {
            elements.wateringSlider.value = state.watering.value;
            updateSliderValue(elements.wateringSlider, state.watering.value);
        }
        if (elements.lightSlider) {
            elements.lightSlider.value = state.lighting.value;
            updateSliderValue(elements.lightSlider, state.lighting.value);
        }
        if (elements.ventSlider) {
            elements.ventSlider.value = state.ventilation.value;
            updateSliderValue(elements.ventSlider, state.ventilation.value);
        }

        // Обновление статусов
        if (elements.wateringStatus) {
            elements.wateringStatus.textContent = state.watering.active ? 'Активно' : 'Отключено';
            elements.wateringStatus.className = 'status-badge ' + (state.watering.active ? 'active' : '');
        }
        if (elements.lightStatus) {
            elements.lightStatus.textContent = state.lighting.active ? 'Активно' : 'Отключено';
            elements.lightStatus.className = 'status-badge ' + (state.lighting.active ? 'active' : '');
        }
        if (elements.ventStatus) {
            elements.ventStatus.textContent = state.ventilation.active ? 'Активно' : 'Отключено';
            elements.ventStatus.className = 'status-badge ' + (state.ventilation.active ? 'active' : '');
        }
    }

    /**
     * Обновление значения слайдера
     */
    function updateSliderValue(slider, value) {
        const parent = slider.closest('.control-slider');
        if (parent) {
            const valueEl = parent.querySelector('.slider-value');
            if (valueEl) {
                valueEl.textContent = value + '%';
            }
        }
    }

    /**
     * Переключение системы
     */
    function toggleSystem(system) {
        const newValue = state[system].active ? 0 : state[system].value || config[system].default;
        updateSystem(system, newValue);
        sendToApi(system, newValue);
    }

    /**
     * Получение текущего состояния
     */
    function getState() {
        return { ...state };
    }

    /**
     * Сброс к настройкам по умолчанию
     */
    async function resetToDefaults() {
        state = {
            ...state,
            watering: { value: config.watering.default, active: true, auto: false },
            lighting: { value: config.lighting.default, active: true, auto: false },
            ventilation: { value: config.ventilation.default, active: true, auto: false }
        };
        saveState();
        updateUI();

        // Отправка в API
        if (config.useApi && window.ApiClient) {
            try {
                await window.ApiClient.updateGreenhouseSettings({
                    wateringAuto: false,
                    lightingAuto: false,
                    ventilationAuto: false
                });
            } catch (error) {
                console.warn('[GreenhouseModule] Не удалось сбросить настройки в API:', error);
            }
        }

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Сброс настроек',
                message: 'Все системы теплицы сброшены к значениям по умолчанию'
            });
        }
    }

    /**
     * Автоматический режим
     */
    async function enableAutoMode() {
        if (config.useApi && window.ApiClient) {
            try {
                await window.ApiClient.updateGreenhouseSettings({
                    wateringAuto: true,
                    lightingAuto: true,
                    ventilationAuto: true
                });
                
                state.watering.auto = true;
                state.lighting.auto = true;
                state.ventilation.auto = true;
                saveState();

            } catch (error) {
                console.warn('[GreenhouseModule] Не удалось включить авто-режим:', error);
            }
        }

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Авто-режим',
                message: 'Системы теплицы работают в автоматическом режиме'
            });
        }
    }

    /**
     * Обработка WebSocket событий
     */
    function handleWebSocketEvent(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'status_update':
                if (data.watering) state.watering = { ...state.watering, ...data.watering };
                if (data.lighting) state.lighting = { ...state.lighting, ...data.lighting };
                if (data.ventilation) state.ventilation = { ...state.ventilation, ...data.ventilation };
                if (data.temperature) state.temperature = data.temperature;
                if (data.humidity) state.humidity = data.humidity;
                state.lastUpdate = new Date().toISOString();
                updateUI();
                break;
                
            case 'command_executed':
                console.log('[GreenhouseModule] Команда выполнена:', data);
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
        } catch (error) {
            console.warn('[GreenhouseModule] Не удалось обновить данные:', error);
        }
    }

    // Публичный API
    return {
        init,
        updateSystem,
        toggleSystem,
        getState,
        resetToDefaults,
        enableAutoMode,
        handleWebSocketEvent,
        refreshData
    };
})();

// Экспорт для глобального доступа
window.GreenhouseModule = GreenhouseModule;
