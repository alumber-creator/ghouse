/**
 * GHouse Dashboard - API Client Module
 * Клиент для взаимодействия с Backend API
 * Документация API: backend/README.md
 */

const ApiClient = (function() {
    // Конфигурация
    const config = {
        baseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8080/api/v1'
            : '/api/v1',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
    };

    // Состояние
    let state = {
        accessToken: null,
        refreshToken: null,
        user: null,
        isRefreshing: false
    };

    /**
     * Инициализация API клиента
     */
    function init() {
        loadTokens();
        console.log('[ApiClient] Инициализирован, baseUrl:', config.baseUrl);
    }

    /**
     * Загрузка токенов из localStorage
     */
    function loadTokens() {
        try {
            const access = localStorage.getItem('ghouse_access_token');
            const refresh = localStorage.getItem('ghouse_refresh_token');
            if (access && refresh) {
                state.accessToken = access;
                state.refreshToken = refresh;
            }
        } catch (e) {
            console.warn('[ApiClient] Не удалось загрузить токены:', e);
        }
    }

    /**
     * Сохранение токенов
     */
    function saveTokens(access, refresh) {
        try {
            localStorage.setItem('ghouse_access_token', access);
            localStorage.setItem('ghouse_refresh_token', refresh);
            state.accessToken = access;
            state.refreshToken = refresh;
        } catch (e) {
            console.warn('[ApiClient] Не удалось сохранить токены:', e);
        }
    }

    /**
     * Очистка токенов
     */
    function clearTokens() {
        try {
            localStorage.removeItem('ghouse_access_token');
            localStorage.removeItem('ghouse_refresh_token');
            state.accessToken = null;
            state.refreshToken = null;
            state.user = null;
        } catch (e) {
            console.warn('[ApiClient] Не удалось очистить токены:', e);
        }
    }

    /**
     * Получение заголовков для запроса
     */
    function getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (includeAuth && state.accessToken) {
            headers['Authorization'] = `Bearer ${state.accessToken}`;
        }
        return headers;
    }

    /**
     * Основной метод для HTTP запросов
     */
    async function request(endpoint, options = {}) {
        const url = `${config.baseUrl}${endpoint}`;
        const {
            method = 'GET',
            body = null,
            headers = {},
            requireAuth = true
        } = options;

        const fetchOptions = {
            method,
            headers: { ...getHeaders(requireAuth), ...headers },
            signal: AbortSignal.timeout(config.timeout)
        };

        if (body && method !== 'GET') {
            fetchOptions.body = JSON.stringify(body);
        }

        let lastError;
        for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, fetchOptions);

                // Обработка 401 - попыка обновить токен
                if (response.status === 401 && requireAuth && !state.isRefreshing) {
                    await refreshAccessToken();
                    fetchOptions.headers['Authorization'] = `Bearer ${state.accessToken}`;
                    continue;
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new ApiError(data.detail || data.message || 'Ошибка API', response.status, data);
                }

                return data;

            } catch (error) {
                lastError = error;
                
                if (error.name === 'AbortError') {
                    throw new ApiError('Превышено время ожидания ответа от сервера', 408);
                }

                if (error instanceof ApiError) {
                    throw error;
                }

                // Задержка перед повторной попыткой
                if (attempt < config.retryAttempts - 1) {
                    await sleep(config.retryDelay * (attempt + 1));
                }
            }
        }

        throw lastError || new ApiError('Неизвестная ошибка сети', 0);
    }

    /**
     * Обновление access токена
     */
    async function refreshAccessToken() {
        if (!state.refreshToken) {
            throw new ApiError('Refresh token отсутствует', 401);
        }

        state.isRefreshing = true;

        try {
            const response = await fetch(`${config.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: state.refreshToken })
            });

            if (!response.ok) {
                clearTokens();
                throw new ApiError('Не удалось обновить токен', 401);
            }

            const data = await response.json();
            saveTokens(data.access_token, data.refresh_token);
            
            return data.access_token;

        } catch (error) {
            clearTokens();
            throw error;
        } finally {
            state.isRefreshing = false;
        }
    }

    /**
     * Вспомогательная функция для задержки
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== AUTH ENDPOINTS ====================

    /**
     * Вход пользователя
     */
    async function login(username, password) {
        const response = await request('/auth/login', {
            method: 'POST',
            body: { username, password },
            requireAuth: false
        }, false);

        if (response.access_token && response.refresh_token) {
            saveTokens(response.access_token, response.refresh_token);
        }

        return response;
    }

    /**
     * Выход пользователя
     */
    async function logout() {
        try {
            await request('/auth/logout', { method: 'POST' });
        } finally {
            clearTokens();
        }
    }

    /**
     * Получение текущего пользователя
     */
    async function getCurrentUser() {
        const response = await request('/auth/me');
        state.user = response;
        return response;
    }

    // ==================== GREENHOUSE ENDPOINTS ====================

    /**
     * Получить статус теплицы
     */
    async function getGreenhouseStatus() {
        return request('/greenhouse/status');
    }

    /**
     * Получить настройки теплицы
     */
    async function getGreenhouseSettings() {
        return request('/greenhouse/settings');
    }

    /**
     * Обновить настройки теплицы
     */
    async function updateGreenhouseSettings(settings) {
        return request('/greenhouse/settings', {
            method: 'PUT',
            body: settings
        });
    }

    /**
     * Управление поливом
     */
    async function controlWatering(level) {
        return request('/greenhouse/watering', {
            method: 'POST',
            body: { level }
        });
    }

    /**
     * Управление освещением
     */
    async function controlLighting(level) {
        return request('/greenhouse/lighting', {
            method: 'POST',
            body: { level }
        });
    }

    /**
     * Управление вентиляцией
     */
    async function controlVentilation(level) {
        return request('/greenhouse/ventilation', {
            method: 'POST',
            body: { level }
        });
    }

    // ==================== AIR MONITORING ENDPOINTS ====================

    /**
     * Получить текущие показатели воздуха
     */
    async function getAirCurrent() {
        return request('/air/current');
    }

    /**
     * Получить историю показателей воздуха
     */
    async function getAirHistory(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return request(`/air/history${queryString ? '?' + queryString : ''}`);
    }

    /**
     * Получить пороги срабатывания
     */
    async function getAirThresholds() {
        return request('/air/thresholds');
    }

    /**
     * Получить алерты
     */
    async function getAirAlerts() {
        return request('/air/alerts');
    }

    // ==================== DRONES ENDPOINTS ====================

    /**
     * Получить список дронов
     */
    async function getDrones() {
        return request('/drones');
    }

    /**
     * Получить информацию о дроне
     */
    async function getDrone(id) {
        return request(`/drones/${id}`);
    }

    /**
     * Отправить команду дрону
     */
    async function sendDroneCommand(id, command, params = {}) {
        return request(`/drones/${id}/command`, {
            method: 'POST',
            body: { command, ...params }
        });
    }

    /**
     * Возврат дрона на базу
     */
    async function returnDroneToBase(id) {
        return request(`/drones/${id}/return-to-base`, { method: 'POST' });
    }

    // ==================== CONVEYOR ENDPOINTS ====================

    /**
     * Получить статус конвейера
     */
    async function getConveyorStatus() {
        return request('/conveyor/status');
    }

    /**
     * Запуск конвейера
     */
    async function startConveyor() {
        return request('/conveyor/start', { method: 'POST' });
    }

    /**
     * Остановка конвейера
     */
    async function stopConveyor() {
        return request('/conveyor/stop', { method: 'POST' });
    }

    /**
     * Установка скорости конвейера
     */
    async function setConveyorSpeed(speed) {
        return request('/conveyor/speed', {
            method: 'PUT',
            body: { speed }
        });
    }

    // ==================== SOIL ENDPOINTS ====================

    /**
     * Получить текущий анализ почвы
     */
    async function getSoilCurrent() {
        return request('/soil/current');
    }

    /**
     * Запустить анализ почвы
     */
    async function analyzeSoil() {
        return request('/soil/analyze', { method: 'POST' });
    }

    /**
     * Получить зоны почвы
     */
    async function getSoilZones() {
        return request('/soil/zones');
    }

    /**
     * Получить рекомендации
     */
    async function getSoilRecommendations() {
        return request('/soil/recommendations');
    }

    // ==================== TELEGRAM ENDPOINTS ====================

    /**
     * Получить статус Telegram бота
     */
    async function getTelegramStatus() {
        return request('/telegram/status');
    }

    /**
     * Отправить сообщение
     */
    async function sendTelegramMessage(text, chatId = null) {
        return request('/telegram/send', {
            method: 'POST',
            body: { text, chat_id: chatId }
        });
    }

    /**
     * Отправить рассылку
     */
    async function sendTelegramBroadcast(text) {
        return request('/telegram/broadcast', {
            method: 'POST',
            body: { text }
        });
    }

    // ==================== SYSTEM ENDPOINTS ====================

    /**
     * Проверка здоровья системы
     */
    async function healthCheck() {
        return request('/health', { requireAuth: false });
    }

    /**
     * Получить системную информацию
     */
    async function getSystemInfo() {
        return request('/system/info');
    }

    // Публичный API
    return {
        init,
        request,

        // Auth
        login,
        logout,
        getCurrentUser,

        // Greenhouse
        getGreenhouseStatus,
        getGreenhouseSettings,
        updateGreenhouseSettings,
        controlWatering,
        controlLighting,
        controlVentilation,

        // Air
        getAirCurrent,
        getAirHistory,
        getAirThresholds,
        getAirAlerts,

        // Drones
        getDrones,
        getDrone,
        sendDroneCommand,
        returnDroneToBase,

        // Conveyor
        getConveyorStatus,
        startConveyor,
        stopConveyor,
        setConveyorSpeed,

        // Soil
        getSoilCurrent,
        analyzeSoil,
        getSoilZones,
        getSoilRecommendations,

        // Telegram
        getTelegramStatus,
        sendTelegramMessage,
        sendTelegramBroadcast,

        // System
        healthCheck,
        getSystemInfo,

        // Утилиты
        isAuthenticated: () => !!state.accessToken,
        getToken: () => state.accessToken,
        getUser: () => state.user,
        clearTokens
    };
})();

/**
 * Класс ошибки API
 */
class ApiError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// Экспорт для глобального доступа
window.ApiClient = ApiClient;
window.ApiError = ApiError;
