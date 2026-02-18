/**
 * GHouse Dashboard - Telegram Integration Module
 * Интеграция с Telegram ботом для уведомлений и управления
 * Интеграция с Backend API: /api/v1/telegram/*
 */

const TelegramModule = (function() {
    // Конфигурация
    const config = {
        defaultBotName: '@GHouse_Bot',
        reconnectInterval: 30000, // 30 секунд
        maxLogEntries: 50,
        apiEndpoints: {
            status: '/telegram/status',
            send: '/telegram/send',
            broadcast: '/telegram/broadcast'
        },
        useApi: true
    };

    // Состояние
    let state = {
        connected: false,
        botName: config.defaultBotName,
        botToken: '',
        chatId: '',
        notifyFrequency: 'immediate',
        notifyTypes: {
            critical: true,
            warning: true,
            info: false,
            report: false
        },
        uptime: 0,
        messagesSent: 0,
        lastMessage: null,
        log: [],
        queue: [],
        lastUpdate: null
    };

    // DOM элементы
    let elements = {};

    // Таймеры
    let uptimeInterval = null;
    let queueInterval = null;
    let reconnectTimeout = null;

    /**
     * Инициализация модуля
     */
    async function init() {
        cacheElements();
        
        // Загрузка данных
        if (config.useApi && window.ApiClient) {
            try {
                await loadFromApi();
            } catch (error) {
                console.warn('[TelegramModule] Не удалось загрузить из API, используем localStorage:', error);
                loadState();
            }
        } else {
            loadState();
        }
        
        bindEvents();
        updateUI();
        startUptimeCounter();
        startQueueProcessor();
        
        // Подключение если есть токен и chatId
        if (state.botToken && state.chatId) {
            connect();
        }
        
        console.log('[TelegramModule] Инициализирован');
    }

    /**
     * Загрузка данных из API
     */
    async function loadFromApi() {
        try {
            const status = await window.ApiClient.getTelegramStatus();
            
            if (status) {
                state.connected = status.connected ?? state.connected;
                state.botName = status.botName ?? state.botName;
                state.messagesSent = status.messagesSent ?? state.messagesSent;
                state.lastUpdate = new Date().toISOString();
            }
            
            saveState();
        } catch (error) {
            console.error('[TelegramModule] Ошибка загрузки из API:', error);
            throw error;
        }
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            telegramStatus: document.getElementById('telegramStatus'),
            testNotifyBtn: document.getElementById('testNotifyBtn'),
            telegramSettingsBtn: document.getElementById('telegramSettingsBtn'),
            telegramToken: document.getElementById('telegramToken'),
            telegramChatId: document.getElementById('telegramChatId'),
            notifyFrequency: document.getElementById('notifyFrequency'),
            saveTelegramSettings: document.getElementById('saveTelegramSettings'),
            testTelegramConnection: document.getElementById('testTelegramConnection'),
            telegramLogList: document.getElementById('telegramLogList')
        };
    }

    /**
     * Загрузка сохраненного состояния
     */
    function loadState() {
        try {
            const saved = localStorage.getItem('telegram_state');
            if (saved) {
                const loaded = JSON.parse(saved);
                state = { ...state, ...loaded };
            }
            
            // Инициализация лога по умолчанию если пуст
            if (state.log.length === 0) {
                state.log = [
                    { time: getCurrentTime(), type: 'success', message: 'Система запущена' },
                    { time: '09:15:22', type: 'warning', message: 'Низкий заряд дрона #3' },
                    { time: '08:00:00', type: 'info', message: 'Ежедневный отчет отправлен' }
                ];
            }
        } catch (e) {
            console.warn('[TelegramModule] Не удалось загрузить состояние:', e);
        }
    }

    /**
     * Сохранение состояния
     */
    function saveState() {
        try {
            localStorage.setItem('telegram_state', JSON.stringify(state));
        } catch (e) {
            console.warn('[TelegramModule] Не удалось сохранить состояние:', e);
        }
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        if (elements.testNotifyBtn) {
            elements.testNotifyBtn.addEventListener('click', sendTestNotification);
        }

        if (elements.telegramSettingsBtn) {
            elements.telegramSettingsBtn.addEventListener('click', openSettings);
        }

        if (elements.saveTelegramSettings) {
            elements.saveTelegramSettings.addEventListener('click', saveSettings);
        }

        if (elements.testTelegramConnection) {
            elements.testTelegramConnection.addEventListener('click', testConnection);
        }
    }

    /**
     * Подключение к Telegram API (через backend)
     */
    async function connect() {
        if (!state.botToken || !state.chatId) {
            setDisconnected();
            return;
        }

        if (config.useApi && window.ApiClient) {
            try {
                const status = await window.ApiClient.getTelegramStatus();
                
                if (status && status.connected) {
                    setConnected();
                } else {
                    setDisconnected();
                    scheduleReconnect();
                }
            } catch (error) {
                console.warn('[TelegramModule] Ошибка подключения:', error);
                setDisconnected();
                scheduleReconnect();
            }
        } else {
            // Эмуляция подключения
            setTimeout(() => {
                setConnected();
            }, 1000);
        }
    }

    /**
     * Установка статуса "подключено"
     */
    function setConnected() {
        state.connected = true;
        updateUI();
        addLogEntry('success', 'Подключение к Telegram установлено');

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Telegram',
                message: 'Бот подключен и готов к работе'
            });
        }
    }

    /**
     * Установка статуса "отключено"
     */
    function setDisconnected() {
        state.connected = false;
        updateUI();

        // Попытка переподключения
        if (state.botToken && state.chatId) {
            scheduleReconnect();
        }
    }

    /**
     * Планирование переподключения
     */
    function scheduleReconnect() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }

        reconnectTimeout = setTimeout(() => {
            connect();
        }, config.reconnectInterval);
    }

    /**
     * Запуск счетчика времени работы
     */
    function startUptimeCounter() {
        if (uptimeInterval) clearInterval(uptimeInterval);
        
        uptimeInterval = setInterval(() => {
            if (state.connected) {
                state.uptime++;
                updateUptimeUI();
            }
        }, 1000);
    }

    /**
     * Запуск обработчика очереди
     */
    function startQueueProcessor() {
        if (queueInterval) clearInterval(queueInterval);
        
        queueInterval = setInterval(() => {
            processQueue();
        }, 5000);
    }

    /**
     * Обработка очереди сообщений
     */
    function processQueue() {
        if (state.queue.length === 0 || !state.connected) return;

        const message = state.queue.shift();
        sendMessageToApi(message.type, message.title, message.message);
        saveState();
    }

    /**
     * Отправка сообщения через API
     */
    async function sendMessageToApi(type, title, message, chatId = null) {
        if (!config.useApi || !window.ApiClient) {
            return false;
        }

        try {
            const formattedMessage = formatMessage(type, title, message);
            
            const response = await window.ApiClient.sendTelegramMessage(formattedMessage, chatId);
            
            state.messagesSent++;
            state.lastMessage = new Date().toISOString();
            addLogEntry(getLogType(type), message);
            saveState();
            updateUI();
            
            return response;
        } catch (error) {
            console.error('[TelegramModule] Ошибка отправки сообщения:', error);
            addLogEntry('error', 'Не удалось отправить сообщение: ' + error.message);
            return false;
        }
    }

    /**
     * Отправка сообщения
     */
    function sendMessage(type, title, message) {
        // Проверка типа уведомления
        if (!shouldSendNotification(type)) {
            console.log('[TelegramModule] Уведомление типа ' + type + ' отключено');
            return false;
        }

        if (!state.connected) {
            // Добавление в очередь
            state.queue.push({ type, title, message, time: Date.now() });
            addLogEntry('error', 'Не удалось отправить: нет подключения');
            return false;
        }

        return sendMessageToApi(type, title, message);
    }

    /**
     * Проверка необходимости отправки уведомления
     */
    function shouldSendNotification(type) {
        const typeMapping = {
            'critical': 'critical',
            'error': 'critical',
            'warning': 'warning',
            'info': 'info',
            'success': 'info',
            'report': 'report'
        };

        const mappedType = typeMapping[type] || 'info';
        return state.notifyTypes[mappedType] || false;
    }

    /**
     * Получение типа для лога
     */
    function getLogType(type) {
        const mapping = {
            'critical': 'error',
            'error': 'error',
            'warning': 'warning',
            'info': 'info',
            'success': 'success'
        };
        return mapping[type] || 'info';
    }

    /**
     * Форматирование сообщения
     */
    function formatMessage(type, title, message) {
        const icons = {
            'critical': '🚨',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'success': '✅',
            'report': '📊'
        };

        const icon = icons[type] || 'ℹ️';
        const time = getCurrentTime();

        return `<b>${icon} GHouse Dashboard</b>\n\n` +
               `<b>${title}</b>\n\n` +
               `<code>${message}</code>\n\n` +
               `<i>⏰ ${time}</i>`;
    }

    /**
     * Получение текущего времени
     */
    function getCurrentTime() {
        return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /**
     * Отправка алерта
     */
    function sendAlert(alert) {
        const type = alert.type || 'warning';
        return sendMessage(type, alert.title, alert.message);
    }

    /**
     * Отправка тестового уведомления
     */
    async function sendTestNotification() {
        const success = await sendMessageToApi('info', 'Тестовое уведомление', 'Это тестовое сообщение от GHouse Dashboard');

        if (window.App && window.App.notify) {
            window.App.notify({
                type: success ? 'success' : 'error',
                title: 'Тест уведомления',
                message: success ? 'Уведомление отправлено' : 'Не удалось отправить уведомление'
            });
        }
    }

    /**
     * Тест подключения
     */
    async function testConnection() {
        if (!state.botToken || !state.chatId) {
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'error',
                    title: 'Тест подключения',
                    message: 'Заполните токен бота и Chat ID'
                });
            }
            return;
        }

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Тест подключения',
                message: 'Проверка соединения...'
            });
        }

        // Попытка подключения
        await connect();
    }

    /**
     * Сохранение настроек
     */
    function saveSettings() {
        if (elements.telegramToken) {
            state.botToken = elements.telegramToken.value.trim();
        }
        if (elements.telegramChatId) {
            state.chatId = elements.telegramChatId.value.trim();
        }
        if (elements.notifyFrequency) {
            state.notifyFrequency = elements.notifyFrequency.value;
        }

        // Сохранение типов уведомлений
        const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
        const types = ['critical', 'warning', 'info', 'report'];
        checkboxes.forEach((cb, index) => {
            if (types[index]) {
                state.notifyTypes[types[index]] = cb.checked;
            }
        });

        saveState();
        updateUI();

        // Переподключение с новыми настройками
        if (state.botToken && state.chatId) {
            connect();
        }

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Настройки',
                message: 'Настройки Telegram сохранены'
            });
        }
    }

    /**
     * Открытие настроек
     */
    function openSettings() {
        // Заполнение полей текущими значениями
        if (elements.telegramToken) {
            elements.telegramToken.value = state.botToken;
        }
        if (elements.telegramChatId) {
            elements.telegramChatId.value = state.chatId;
        }
        if (elements.notifyFrequency) {
            elements.notifyFrequency.value = state.notifyFrequency;
        }

        // Установка чекбоксов
        const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
        const types = ['critical', 'warning', 'info', 'report'];
        checkboxes.forEach((cb, index) => {
            if (types[index]) {
                cb.checked = state.notifyTypes[types[index]] !== false;
            }
        });
    }

    /**
     * Добавление записи в лог
     */
    function addLogEntry(type, message) {
        const time = getCurrentTime();

        state.log.unshift({
            time,
            type,
            message
        });

        // Ограничение размера лога
        if (state.log.length > config.maxLogEntries) {
            state.log = state.log.slice(0, config.maxLogEntries);
        }

        updateLogUI();
        saveState();
    }

    /**
     * Обновление UI
     */
    function updateUI() {
        // Статус подключения
        if (elements.telegramStatus) {
            elements.telegramStatus.textContent = state.connected ? 'Подключен' : 'Отключен';
            elements.telegramStatus.className = 'status-badge ' + (state.connected ? 'connected' : 'error');
        }

        updateLogUI();
        updateUptimeUI();
    }

    /**
     * Обновление UI лога
     */
    function updateLogUI() {
        if (!elements.telegramLogList) return;

        elements.telegramLogList.innerHTML = state.log.map(entry => `
            <div class="log-item ${entry.type}">
                <span class="log-time">${entry.time}</span>
                <span class="log-message">${entry.message}</span>
            </div>
        `).join('');
    }

    /**
     * Обновление UI времени работы
     */
    function updateUptimeUI() {
        const botUptime = document.querySelector('.bot-uptime');
        if (botUptime) {
            botUptime.textContent = 'В сети: ' + formatUptime(state.uptime);
        }
    }

    /**
     * Форматирование времени работы
     */
    function formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}ч ${minutes}м`;
    }

    /**
     * Отправка ежедневного отчета
     */
    async function sendDailyReport() {
        const report = generateReportMessage();
        
        await sendMessageToApi('report', '📊 Ежедневный отчет', report);
    }

    /**
     * Генерация сообщения отчета
     */
    function generateReportMessage() {
        // Получение данных от других модулей
        const greenhouseState = window.GreenhouseModule ? window.GreenhouseModule.getState() : null;
        const dronesState = window.DronesModule ? window.DronesModule.getState() : null;
        const soilState = window.SoilModule ? window.SoilModule.getState() : null;
        const airState = window.AirMonitoringModule ? window.AirMonitoringModule.getState() : null;

        let message = 'Сводка за сегодня:\n\n';

        if (airState) {
            message += `💨 Воздух:\n`;
            message += `  • Температура: ${airState.temperature?.value?.toFixed(1) || '—'}°C\n`;
            message += `  • Влажность: ${airState.humidity?.value?.toFixed(0) || '—'}%\n`;
            message += `  • CO₂: ${airState.co2?.value?.toFixed(0) || '—'} ppm\n\n`;
        }

        if (greenhouseState) {
            message += `🏠 Теплица:\n`;
            message += `  • Полив: ${greenhouseState.watering?.value || '—'}%\n`;
            message += `  • Освещение: ${greenhouseState.lighting?.value || '—'}%\n`;
            message += `  • Вентиляция: ${greenhouseState.ventilation?.value || '—'}%\n\n`;
        }

        if (dronesState && dronesState.drones) {
            const avgBattery = dronesState.drones.reduce((sum, d) => sum + d.battery, 0) / dronesState.drones.length;
            const activeCount = dronesState.drones.filter(d => d.status === 'active').length;
            message += `🚁 Дроны:\n`;
            message += `  • Средний заряд: ${Math.round(avgBattery)}%\n`;
            message += `  • Активных: ${activeCount}\n\n`;
        }

        if (soilState) {
            message += `🌱 Почва:\n`;
            message += `  • Влажность: ${soilState.moisture}%\n`;
            message += `  • pH: ${soilState.ph}\n`;
            message += `  • NPK: ${soilState.npk?.n}/${soilState.npk?.p}/${soilState.npk?.k}\n\n`;
        }

        message += `📈 Всего сообщений: ${state.messagesSent}`;

        return message;
    }

    /**
     * Получение состояния
     */
    function getState() {
        return { ...state };
    }

    /**
     * Экспорт лога
     */
    function exportLog() {
        const data = {
            timestamp: new Date().toISOString(),
            log: state.log
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'telegram-log-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Очистка лога
     */
    function clearLog() {
        state.log = [];
        updateLogUI();
        saveState();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Лог Telegram',
                message: 'Лог очищен'
            });
        }
    }

    /**
     * Отключение модуля
     */
    function disconnect() {
        if (uptimeInterval) {
            clearInterval(uptimeInterval);
        }
        if (queueInterval) {
            clearInterval(queueInterval);
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }

        state.connected = false;
        updateUI();
        console.log('[TelegramModule] Отключен');
    }

    // Публичный API
    return {
        init,
        sendAlert,
        sendMessage,
        sendDailyReport,
        getState,
        exportLog,
        clearLog,
        disconnect
    };
})();

// Экспорт для глобального доступа
window.TelegramModule = TelegramModule;
