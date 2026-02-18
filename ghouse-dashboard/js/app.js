/**
 * GHouse Dashboard - Main Application
 * Центральное управление приложением, навигация, уведомления
 * Интеграция с Backend API и WebSocket
 */

const App = (function() {
    // Конфигурация
    const config = {
        title: 'GHouse | Автономный Агрокомплекс',
        version: '2.0.0',
        apiVersion: 'v1',
        updateInterval: 5000, // 5 секунд для polling fallback
        toastDuration: 5000,
        dataRefreshInterval: 10000 // 10 секунд
    };

    // Состояние
    let state = {
        currentSection: 'dashboard',
        notifications: [],
        alerts: [],
        isInitialized: false,
        isAuthenticated: false,
        useWebSocket: true,
        lastDataUpdate: null
    };

    // DOM элементы
    let elements = {};

    // Таймеры для polling
    let dataRefreshInterval = null;

    /**
     * Инициализация приложения
     */
    async function init() {
        console.log('[App] Инициализация GHouse Dashboard v' + config.version);

        // Инициализация базовых модулей
        if (window.ApiClient) {
            window.ApiClient.init();
        }

        if (window.AuthModule) {
            window.AuthModule.init();
        }

        if (window.WebSocketModule) {
            window.WebSocketModule.init();
        }

        cacheElements();
        bindEvents();
        
        // Проверка аутентификации
        state.isAuthenticated = window.ApiClient?.isAuthenticated() || false;
        
        // Если не аутентифицированы - перенаправление на login
        if (!state.isAuthenticated && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }

        // Инициализация модулей
        await initModules();
        
        // Настройка WebSocket обработчиков
        setupWebSocketHandlers();
        
        // Запуск периодического обновления данных
        startDataRefresh();
        
        startClock();
        updateCurrentTime();

        state.isInitialized = true;

        console.log('[App] Инициализация завершена');

        // Приветственное уведомление
        notify({
            type: 'success',
            title: 'Добро пожаловать',
            message: 'Система GHouse готова к работе'
        });
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            navItems: document.querySelectorAll('.nav-item'),
            contentSections: document.querySelectorAll('.content-section'),
            currentTime: document.getElementById('currentTime'),
            notificationBell: document.getElementById('notificationBell'),
            notificationBadge: document.getElementById('notificationBadge'),
            alertModal: document.getElementById('alertModal'),
            alertModalBody: document.getElementById('alertModalBody'),
            closeAlertModal: document.getElementById('closeAlertModal'),
            acknowledgeAlert: document.getElementById('acknowledgeAlert'),
            fixAlert: document.getElementById('fixAlert'),
            systemStatus: document.querySelector('.system-status'),
            logoutBtn: document.getElementById('logoutBtn')
        };
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        // Навигация
        elements.navItems.forEach(item => {
            item.addEventListener('click', handleNavigation);
        });

        // Уведомления
        if (elements.notificationBell) {
            elements.notificationBell.addEventListener('click', showNotifications);
        }

        // Модальное окно алертов
        if (elements.closeAlertModal) {
            elements.closeAlertModal.addEventListener('click', closeAlertModal);
        }

        if (elements.acknowledgeAlert) {
            elements.acknowledgeAlert.addEventListener('click', acknowledgeAlertHandler);
        }

        if (elements.fixAlert) {
            elements.fixAlert.addEventListener('click', fixAlertHandler);
        }

        // Закрытие модального окна по клику вне
        if (elements.alertModal) {
            elements.alertModal.addEventListener('click', (e) => {
                if (e.target === elements.alertModal) {
                    closeAlertModal();
                }
            });
        }

        // Обработка клавиши Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAlertModal();
            }
        });

        // Обработка изменения размера окна
        window.addEventListener('resize', debounce(handleResize, 250));

        // Кнопка выхода
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleLogout);
        }

        // Обновление статуса соединения
        if (elements.systemStatus) {
            updateSystemStatus();
        }
    }

    /**
     * Инициализация модулей
     */
    async function initModules() {
        const modules = [
            { name: 'GreenhouseModule', init: () => window.GreenhouseModule?.init() },
            { name: 'AirMonitoringModule', init: () => window.AirMonitoringModule?.init() },
            { name: 'DronesModule', init: () => window.DronesModule?.init() },
            { name: 'ConveyorModule', init: () => window.ConveyorModule?.init() },
            { name: 'SoilModule', init: () => window.SoilModule?.init() },
            { name: 'TelegramModule', init: () => window.TelegramModule?.init() }
        ];

        for (const module of modules) {
            try {
                await module.init();
                console.log('[App] Модуль', module.name, 'инициализирован');
            } catch (error) {
                console.error('[App] Ошибка инициализации модуля', module.name, ':', error);
            }
        }

        // Периодическая проверка обслуживания конвейера
        if (window.ConveyorModule) {
            setInterval(() => {
                window.ConveyorModule.checkMaintenance?.();
            }, 3600000); // Каждый час
        }

        // Отправка ежедневного отчета в 18:00
        scheduleDailyReport();
    }

    /**
     * Настройка WebSocket обработчиков
     */
    function setupWebSocketHandlers() {
        if (!window.WebSocketModule) return;

        const ws = window.WebSocketModule;

        // Обработчик для канала теплицы
        ws.onChannel(ws.channels.GREENHOUSE, (message) => {
            console.log('[App] Событие теплицы:', message);
            if (window.GreenhouseModule?.handleWebSocketEvent) {
                window.GreenhouseModule.handleWebSocketEvent(message);
            }
        });

        // Обработчик для канала воздуха
        ws.onChannel(ws.channels.AIR, (message) => {
            console.log('[App] Событие воздуха:', message);
            if (window.AirMonitoringModule?.handleWebSocketEvent) {
                window.AirMonitoringModule.handleWebSocketEvent(message);
            }
        });

        // Обработчик для канала дронов
        ws.onChannel(ws.channels.DRONES, (message) => {
            console.log('[App] Событие дронов:', message);
            if (window.DronesModule?.handleWebSocketEvent) {
                window.DronesModule.handleWebSocketEvent(message);
            }
        });

        // Обработчик для канала конвейера
        ws.onChannel(ws.channels.CONVEYOR, (message) => {
            console.log('[App] Событие конвейера:', message);
            if (window.ConveyorModule?.handleWebSocketEvent) {
                window.ConveyorModule.handleWebSocketEvent(message);
            }
        });

        // Обработчик для канала почвы
        ws.onChannel(ws.channels.SOIL, (message) => {
            console.log('[App] Событие почвы:', message);
            if (window.SoilModule?.handleWebSocketEvent) {
                window.SoilModule.handleWebSocketEvent(message);
            }
        });

        // Обработчик для алертов
        ws.onChannel(ws.channels.ALERTS, (message) => {
            console.log('[App] Системный алерт:', message);
            handleSystemAlert(message);
        });

        // Обработчик для уведомлений
        ws.onChannel(ws.channels.NOTIFICATIONS, (message) => {
            console.log('[App] Уведомление:', message);
            handleNotification(message);
        });

        // Системные события
        ws.onChannel('system', (event) => {
            if (event.type === 'connected') {
                state.useWebSocket = true;
                stopDataRefresh(); // Отключаем polling при наличии WebSocket
                updateSystemStatus();
            } else if (event.type === 'disconnected') {
                state.useWebSocket = false;
                startDataRefresh(); // Включаем polling при отсутствии WebSocket
                updateSystemStatus();
            }
        });
    }

    /**
     * Обработка системного алерта
     */
    function handleSystemAlert(message) {
        const { type, title, description, severity } = message.data || message;
        
        addAlert({
            id: Date.now(),
            type: severity || 'warning',
            title: title || 'Системное уведомление',
            message: description || '',
            time: new Date().toISOString()
        });

        notify({
            type: severity === 'critical' ? 'error' : 'warning',
            title: title || 'Внимание!',
            message: description || 'Произошло системное событие'
        });
    }

    /**
     * Обработка уведомления
     */
    function handleNotification(message) {
        const { type, title, body } = message.data || message;
        
        notify({
            type: type || 'info',
            title: title || 'Уведомление',
            message: body || ''
        });
    }

    /**
     * Планирование ежедневного отчета
     */
    function scheduleDailyReport() {
        const now = new Date();
        const reportTime = new Date();
        reportTime.setHours(18, 0, 0, 0);

        // Если время уже прошло сегодня, запланировать на завтра
        if (now > reportTime) {
            reportTime.setDate(reportTime.getDate() + 1);
        }

        const delay = reportTime.getTime() - now.getTime();

        setTimeout(() => {
            sendDailyReport();
            // Повторять каждый день
            setInterval(sendDailyReport, 86400000);
        }, delay);
    }

    /**
     * Отправка ежедневного отчета
     */
    function sendDailyReport() {
        if (window.TelegramModule?.sendDailyReport) {
            window.TelegramModule.sendDailyReport();
        }
    }

    /**
     * Запуск периодического обновления данных
     */
    function startDataRefresh() {
        stopDataRefresh();
        
        dataRefreshInterval = setInterval(() => {
            refreshAllData();
        }, config.dataRefreshInterval);
    }

    /**
     * Остановка периодического обновления
     */
    function stopDataRefresh() {
        if (dataRefreshInterval) {
            clearInterval(dataRefreshInterval);
            dataRefreshInterval = null;
        }
    }

    /**
     * Обновление всех данных
     */
    async function refreshAllData() {
        if (!state.isAuthenticated) return;

        try {
            state.lastDataUpdate = new Date();
            
            // Параллельное обновление данных из всех модулей
            const promises = [];
            
            if (window.AirMonitoringModule?.refreshData) {
                promises.push(window.AirMonitoringModule.refreshData());
            }
            if (window.GreenhouseModule?.refreshData) {
                promises.push(window.GreenhouseModule.refreshData());
            }
            if (window.DronesModule?.refreshData) {
                promises.push(window.DronesModule.refreshData());
            }
            if (window.ConveyorModule?.refreshData) {
                promises.push(window.ConveyorModule.refreshData());
            }
            if (window.SoilModule?.refreshData) {
                promises.push(window.SoilModule.refreshData());
            }

            await Promise.all(promises);
            
            console.log('[App] Данные обновлены:', state.lastDataUpdate);
            
        } catch (error) {
            console.error('[App] Ошибка обновления данных:', error);
        }
    }

    /**
     * Обработка навигации
     */
    function handleNavigation(e) {
        e.preventDefault();

        const navItem = e.currentTarget;
        const sectionId = navItem.dataset.section;

        if (!sectionId) return;

        // Обновление активной навигации
        elements.navItems.forEach(item => {
            item.classList.toggle('active', item === navItem);
        });

        // Обновление активной секции
        elements.contentSections.forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });

        // Обновление заголовка страницы
        updatePageTitle(sectionId);

        state.currentSection = sectionId;

        // Сохранение в URL (без перезагрузки)
        history.pushState({ section: sectionId }, '', '#' + sectionId);

        console.log('[App] Переход на секцию:', sectionId);
    }

    /**
     * Обновление заголовка страницы
     */
    function updatePageTitle(sectionId) {
        const titles = {
            dashboard: 'Панель управления',
            greenhouse: 'Умная теплица',
            air: 'Мониторинг воздуха',
            drones: 'Дроны',
            conveyor: 'Конвейер',
            soil: 'Аналитика почвы',
            telegram: 'Telegram'
        };

        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[sectionId] || 'GHouse';
        }
    }

    /**
     * Запуск часов
     */
    function startClock() {
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
    }

    /**
     * Обновление текущего времени
     */
    function updateCurrentTime() {
        if (!elements.currentTime) return;

        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateString = now.toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'long'
        });

        elements.currentTime.textContent = `${dateString} | ${timeString}`;
    }

    /**
     * Показ уведомлений (toast)
     */
    function notify(options) {
        const {
            type = 'info',
            title,
            message,
            duration = config.toastDuration
        } = options;

        const toast = createToast(type, title, message);
        document.body.appendChild(toast);

        // Добавление в состояние
        state.notifications.push({
            id: Date.now(),
            type,
            title,
            message,
            time: new Date().toISOString()
        });

        updateNotificationBadge();

        // Автоматическое удаление
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);

        console.log('[App] Уведомление:', title, message);
    }

    /**
     * Создание toast элемента
     */
    function createToast(type, title, message) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons['info']}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        // Закрытие по клику
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        });

        return toast;
    }

    /**
     * Обновление бейджа уведомлений
     */
    function updateNotificationBadge() {
        if (!elements.notificationBadge) return;

        const count = state.notifications.length;
        elements.notificationBadge.textContent = count;
        elements.notificationBadge.style.display = count > 0 ? 'block' : 'none';
    }

    /**
     * Показ списка уведомлений
     */
    function showNotifications() {
        if (state.notifications.length === 0) {
            notify({
                type: 'info',
                title: 'Уведомления',
                message: 'Нет новых уведомлений'
            });
            return;
        }

        // Создание списка уведомлений
        const notificationList = state.notifications.slice(-10).reverse().map(n => {
            const time = new Date(n.time).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
            return `[${time}] ${n.title}: ${n.message}`;
        }).join('\n');

        console.log('[App] Последние уведомления:\n' + notificationList);

        notify({
            type: 'info',
            title: 'Последние уведомления',
            message: `Показано ${Math.min(state.notifications.length, 10)} из ${state.notifications.length}`
        });
    }

    /**
     * Показ алерта (модальное окно)
     */
    function showAlert(options) {
        const { title, message, onAcknowledge, onFix } = options;

        if (!elements.alertModal || !elements.alertModalBody) return;

        elements.alertModalBody.innerHTML = `
            <p><strong>${title}</strong></p>
            <p>${message}</p>
        `;

        elements.alertModal.classList.add('active');

        // Сохранение текущих обработчиков
        state.currentAlert = {
            onAcknowledge,
            onFix
        };
    }

    /**
     * Закрытие модального окна алерта
     */
    function closeAlertModal() {
        if (elements.alertModal) {
            elements.alertModal.classList.remove('active');
        }
        state.currentAlert = null;
    }

    /**
     * Подтверждение алерта
     */
    function acknowledgeAlertHandler() {
        if (state.currentAlert && state.currentAlert.onAcknowledge) {
            state.currentAlert.onAcknowledge();
        }
        closeAlertModal();
    }

    /**
     * Исправление проблемы (алерт)
     */
    function fixAlertHandler() {
        if (state.currentAlert && state.currentAlert.onFix) {
            state.currentAlert.onFix();
        }
        closeAlertModal();
    }

    /**
     * Добавление алерта в список
     */
    function addAlert(alert) {
        state.alerts.push({
            id: Date.now(),
            ...alert,
            acknowledged: false
        });

        updateNotificationBadge();

        // Показ алерта
        showAlert({
            title: alert.title,
            message: alert.message,
            onAcknowledge: () => acknowledgeAlertById(Date.now()),
            onFix: () => fixAlertById(Date.now())
        });
    }

    /**
     * Подтверждение алерта по ID
     */
    function acknowledgeAlertById(id) {
        const alert = state.alerts.find(a => a.id === id);
        if (alert) {
            alert.acknowledged = true;
        }
    }

    /**
     * Исправление алерта по ID
     */
    function fixAlertById(id) {
        const alertIndex = state.alerts.findIndex(a => a.id === id);
        if (alertIndex !== -1) {
            state.alerts.splice(alertIndex, 1);
            updateNotificationBadge();
        }
    }

    /**
     * Обработка изменения размера окна
     */
    function handleResize() {
        console.log('[App] Изменение размера окна');
    }

    /**
     * Debounce функция
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Восстановление состояния из URL
     */
    function restoreFromURL() {
        const hash = window.location.hash.slice(1);
        if (hash && elements.contentSections.length > 0) {
            const navItem = document.querySelector(`[data-section="${hash}"]`);
            if (navItem) {
                navItem.click();
            }
        }
    }

    /**
     * Обновление статуса системы
     */
    function updateSystemStatus() {
        if (!elements.systemStatus) return;

        const wsStatus = window.WebSocketModule?.getStatus();
        const statusIndicator = elements.systemStatus.querySelector('.status-indicator');
        const statusText = elements.systemStatus.querySelector('.status-text');

        if (wsStatus?.isConnected) {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = 'WebSocket: Подключено';
        } else if (wsStatus?.isConnecting) {
            statusIndicator.className = 'status-indicator warning';
            statusText.textContent = 'WebSocket: Подключение...';
        } else {
            statusIndicator.className = 'status-indicator polling';
            statusText.textContent = 'Polling: Активно';
        }
    }

    /**
     * Обработка выхода
     */
    async function handleLogout() {
        if (confirm('Вы уверены, что хотите выйти из системы?')) {
            try {
                if (window.AuthModule) {
                    await window.AuthModule.logout();
                } else if (window.ApiClient) {
                    await window.ApiClient.logout();
                }
                window.location.href = 'login.html';
            } catch (error) {
                console.error('[App] Ошибка выхода:', error);
                notify({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось выполнить выход'
                });
            }
        }
    }

    /**
     * Получение состояния приложения
     */
    function getState() {
        return {
            ...state,
            version: config.version,
            websocket: window.WebSocketModule?.getStatus() || null
        };
    }

    /**
     * Экспорт данных приложения
     */
    function exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            version: config.version,
            state: state,
            modules: {
                greenhouse: window.GreenhouseModule?.getState?.() || null,
                air: window.AirMonitoringModule?.getState?.() || null,
                drones: window.DronesModule?.getState?.() || null,
                conveyor: window.ConveyorModule?.getState?.() || null,
                soil: window.SoilModule?.getState?.() || null,
                telegram: window.TelegramModule?.getState?.() || null
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ghouse-export-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Полная перезагрузка приложения
     */
    function reload() {
        if (confirm('Перезагрузить дашборд?')) {
            window.location.reload();
        }
    }

    // Публичный API
    return {
        init,
        notify,
        showAlert,
        addAlert,
        getState,
        exportData,
        reload,
        restoreFromURL,
        refreshAllData,
        handleLogout
    };
})();

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Восстановление состояния из URL после небольшой задержки
    setTimeout(() => {
        App.restoreFromURL();
    }, 100);
});

// Обработка кнопок навигации браузера
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.section) {
        const navItem = document.querySelector(`[data-section="${e.state.section}"]`);
        if (navItem) {
            navItem.click();
        }
    }
});

// Экспорт для глобального доступа
window.App = App;
