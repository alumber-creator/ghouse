/**
 * GHouse Dashboard - WebSocket Module
 * Realtime обновления через WebSocket соединение
 * Интеграция с backend API: ws://localhost:8000/ws?token=<access_token>
 */

const WebSocketModule = (function() {
    // Конфигурация
    const config = {
        // Каналы (channels) согласно документации backend
        channels: {
            GREENHOUSE: 'greenhouse',
            AIR: 'air',
            DRONES: 'drones',
            CONVEYOR: 'conveyor',
            SOIL: 'soil',
            ALERTS: 'alerts',
            NOTIFICATIONS: 'notifications'
        },
        reconnectInterval: 3000, // 3 секунды
        maxReconnectInterval: 30000, // 30 секунд
        pingInterval: 25000, // 25 секунд
        messageTimeout: 10000 // 10 секунд
    };

    // Состояние
    let state = {
        ws: null,
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 0,
        subscribedChannels: new Set(),
        messageHandlers: new Map(),
        pingInterval: null,
        url: null
    };

    // Callbacks для каналов
    let channelCallbacks = {
        greenhouse: [],
        air: [],
        drones: [],
        conveyor: [],
        soil: [],
        alerts: [],
        notifications: []
    };

    /**
     * Инициализация WebSocket
     */
    function init() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname === 'localhost' 
            ? 'localhost:8000' 
            : window.location.host;
        
        state.url = `${protocol}//${host}/ws`;
        
        console.log('[WebSocket] Конфигурация:', { url: state.url });
        
        // Попытка подключения если есть токен
        if (window.ApiClient && window.ApiClient.isAuthenticated()) {
            connect();
        }

        console.log('[WebSocket] Инициализирован');
    }

    /**
     * Подключение к WebSocket
     */
    function connect() {
        if (state.isConnected || state.isConnecting) {
            return;
        }

        const token = window.ApiClient?.getToken();
        if (!token) {
            console.warn('[WebSocket] Нет токена для подключения');
            return;
        }

        state.isConnecting = true;

        try {
            const wsUrl = `${state.url}?token=${encodeURIComponent(token)}`;
            state.ws = new WebSocket(wsUrl);

            state.ws.onopen = onOpen;
            state.ws.onclose = onClose;
            state.ws.onmessage = onMessage;
            state.ws.onerror = onError;

        } catch (error) {
            console.error('[WebSocket] Ошибка создания соединения:', error);
            state.isConnecting = false;
            scheduleReconnect();
        }
    }

    /**
     * Обработка открытия соединения
     */
    function onOpen() {
        state.isConnected = true;
        state.isConnecting = false;
        state.reconnectAttempts = 0;

        console.log('[WebSocket] Соединение установлено');

        // Запуск ping-pong
        startPingInterval();

        // Подписка на каналы
        resubscribeChannels();

        // Уведомление о подключении
        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'WebSocket',
                message: 'Realtime соединение установлено'
            });
        }

        // Вызов callback'ов
        callChannelCallbacks('system', { type: 'connected' });
    }

    /**
     * Обработка закрытия соединения
     */
    function onClose(event) {
        state.isConnected = false;
        state.isConnecting = false;

        stopPingInterval();

        console.log('[WebSocket] Соединение закрыто:', event.code, event.reason);

        // Вызов callback'ов
        callChannelCallbacks('system', { 
            type: 'disconnected', 
            code: event.code, 
            reason: event.reason 
        });

        // Попытка переподключения
        if (event.code !== 1000) { // 1000 = нормальное закрытие
            scheduleReconnect();
        }
    }

    /**
     * Обработка сообщений
     */
    function onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('[WebSocket] Получено сообщение:', message);

            const { channel, type, data } = message;

            // Обработка по каналу
            if (channel && channelCallbacks[channel]) {
                channelCallbacks[channel].forEach(callback => {
                    try {
                        callback({ type, data, channel });
                    } catch (error) {
                        console.error('[WebSocket] Ошибка в callback:', error);
                    }
                });
            }

            // Обработка системных сообщений
            if (type === 'ping') {
                send({ type: 'pong' });
            }

            // Глобальные обработчики
            if (state.messageHandlers.has(type)) {
                state.messageHandlers.get(type).forEach(handler => {
                    try {
                        handler(message);
                    } catch (error) {
                        console.error('[WebSocket] Ошибка в handler:', error);
                    }
                });
            }

        } catch (error) {
            console.error('[WebSocket] Ошибка парсинга сообщения:', error);
        }
    }

    /**
     * Обработка ошибок
     */
    function onError(error) {
        console.error('[WebSocket] Ошибка соединения:', error);
        state.isConnecting = false;
    }

    /**
     * Планирование переподключения
     */
    function scheduleReconnect() {
        if (state.reconnectAttempts >= 10) {
            console.error('[WebSocket] Превышено максимальное количество попыток');
            return;
        }

        const delay = Math.min(
            config.reconnectInterval * Math.pow(2, state.reconnectAttempts),
            config.maxReconnectInterval
        );

        state.reconnectAttempts++;

        console.log(`[WebSocket] Переподключение через ${delay}мс (попытка ${state.reconnectAttempts})`);

        setTimeout(() => {
            if (window.ApiClient?.isAuthenticated()) {
                connect();
            }
        }, delay);
    }

    /**
     * Запуск ping-pong
     */
    function startPingInterval() {
        stopPingInterval();
        
        state.pingInterval = setInterval(() => {
            if (state.isConnected) {
                send({ type: 'ping' });
            }
        }, config.pingInterval);
    }

    /**
     * Остановка ping-pong
     */
    function stopPingInterval() {
        if (state.pingInterval) {
            clearInterval(state.pingInterval);
            state.pingInterval = null;
        }
    }

    /**
     * Отправка сообщения
     */
    function send(message) {
        if (!state.isConnected || !state.ws) {
            console.warn('[WebSocket] Нельзя отправить: нет соединения');
            return false;
        }

        try {
            state.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('[WebSocket] Ошибка отправки:', error);
            return false;
        }
    }

    /**
     * Подписка на канал
     */
    function subscribe(channel) {
        if (state.subscribedChannels.has(channel)) {
            return true;
        }

        const success = send({
            type: 'subscribe',
            channel: channel
        });

        if (success) {
            state.subscribedChannels.add(channel);
            console.log('[WebSocket] Подписка на канал:', channel);
        }

        return success;
    }

    /**
     * Отписка от канала
     */
    function unsubscribe(channel) {
        if (!state.subscribedChannels.has(channel)) {
            return true;
        }

        const success = send({
            type: 'unsubscribe',
            channel: channel
        });

        if (success) {
            state.subscribedChannels.delete(channel);
            console.log('[WebSocket] Отписка от канала:', channel);
        }

        return success;
    }

    /**
     * Переподписка на каналы после переподключения
     */
    function resubscribeChannels() {
        state.subscribedChannels.forEach(channel => {
            subscribe(channel);
        });
    }

    /**
     * Регистрация callback для канала
     */
    function onChannel(channel, callback) {
        if (!channelCallbacks[channel]) {
            channelCallbacks[channel] = [];
        }
        channelCallbacks[channel].push(callback);

        // Автоматическая подписка
        subscribe(channel);

        // Возврат функции для отписки
        return () => {
            channelCallbacks[channel] = channelCallbacks[channel].filter(cb => cb !== callback);
            if (channelCallbacks[channel].length === 0) {
                unsubscribe(channel);
            }
        };
    }

    /**
     * Регистрация обработчика для типа сообщения
     */
    function onMessage(type, handler) {
        if (!state.messageHandlers.has(type)) {
            state.messageHandlers.set(type, []);
        }
        state.messageHandlers.get(type).push(handler);

        return () => {
            const handlers = state.messageHandlers.get(type);
            state.messageHandlers.set(type, handlers.filter(h => h !== handler));
        };
    }

    /**
     * Вызов callback'ов канала
     */
    function callChannelCallbacks(channel, data) {
        if (channelCallbacks[channel]) {
            channelCallbacks[channel].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[WebSocket] Ошибка в callback канала:', error);
                }
            });
        }
    }

    /**
     * Отправка команды в канал
     */
    function sendToChannel(channel, type, data = {}) {
        return send({
            type: type,
            channel: channel,
            data: data
        });
    }

    /**
     * Получение статуса соединения
     */
    function getStatus() {
        return {
            isConnected: state.isConnected,
            isConnecting: state.isConnecting,
            subscribedChannels: Array.from(state.subscribedChannels),
            reconnectAttempts: state.reconnectAttempts
        };
    }

    /**
     * Принудительное отключение
     */
    function disconnect() {
        stopPingInterval();
        
        if (state.ws) {
            state.ws.close(1000, 'Client disconnect');
            state.ws = null;
        }
        
        state.isConnected = false;
        state.isConnecting = false;
        state.subscribedChannels.clear();
    }

    /**
     * Переподключение
     */
    function reconnect() {
        disconnect();
        state.reconnectAttempts = 0;
        connect();
    }

    // Публичный API
    return {
        init,
        connect,
        disconnect,
        reconnect,
        send,
        subscribe,
        unsubscribe,
        onChannel,
        onMessage,
        sendToChannel,
        getStatus,
        isConnected: () => state.isConnected,

        // Каналы
        channels: config.channels
    };
})();

// Экспорт для глобального доступа
window.WebSocketModule = WebSocketModule;
