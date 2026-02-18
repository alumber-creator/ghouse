/**
 * GHouse Dashboard - Conveyor Module
 * Управление ленточным конвейером для транспортировки сырья
 * Интеграция с Backend API: /api/v1/conveyor/*
 */

const ConveyorModule = (function() {
    // Конфигурация
    const config = {
        speed: {
            min: 0.5,
            max: 3,
            default: 1.2,
            unit: 'м/с'
        },
        interval: {
            min: 1,
            max: 10,
            default: 3,
            unit: 'сек'
        },
        maxItems: 50,
        apiEndpoints: {
            status: '/conveyor/status',
            start: '/conveyor/start',
            stop: '/conveyor/stop',
            speed: '/conveyor/speed'
        },
        useApi: true,
        maintenanceInterval: 30 * 24 * 60 * 60 * 1000 // 30 дней
    };

    // Состояние
    let state = {
        running: false,
        speed: 1.2,
        interval: 3,
        items: [],
        totalTransported: 1247,
        shiftCount: 124,
        workTime: '8ч 32м',
        efficiency: 94,
        lastMaintenance: null,
        nextMaintenance: null,
        lastUpdate: null
    };

    // DOM элементы
    let elements = {};

    // Таймеры
    let moveInterval = null;
    let itemInterval = null;
    let workTimeInterval = null;

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
                console.warn('[ConveyorModule] Не удалось загрузить из API, используем localStorage:', error);
                loadState();
            }
        } else {
            loadState();
        }
        
        bindEvents();
        updateUI();
        
        // Запуск таймера работы если конвейер активен
        if (state.running) {
            startWorkTimeTimer();
        }
        
        console.log('[ConveyorModule] Инициализирован');
    }

    /**
     * Загрузка данных из API
     */
    async function loadFromApi() {
        try {
            const status = await window.ApiClient.getConveyorStatus();
            
            if (status) {
                state.running = status.running ?? state.running;
                state.speed = status.speed ?? state.speed;
                state.totalTransported = status.totalTransported ?? state.totalTransported;
                state.shiftCount = status.shiftCount ?? state.shiftCount;
                state.efficiency = status.efficiency ?? state.efficiency;
                state.lastMaintenance = status.lastMaintenance ?? state.lastMaintenance;
                state.nextMaintenance = status.nextMaintenance ?? state.nextMaintenance;
                state.lastUpdate = new Date().toISOString();
                
                saveState();
            }
            
        } catch (error) {
            console.error('[ConveyorModule] Ошибка загрузки из API:', error);
            throw error;
        }
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            conveyorStatus: document.getElementById('conveyorStatus'),
            conveyorSpeed: document.getElementById('conveyorSpeed'),
            conveyorLoad: document.getElementById('conveyorLoad'),
            conveyorItems: document.getElementById('conveyorItems'),
            conveyorItemsLarge: document.getElementById('conveyorItemsLarge'),
            conveyorStart: document.getElementById('conveyorStart'),
            conveyorStop: document.getElementById('conveyorStop'),
            conveyorReset: document.getElementById('conveyorReset'),
            conveyorSpeedSlider: document.getElementById('conveyorSpeedSlider'),
            conveyorIntervalSlider: document.getElementById('conveyorIntervalSlider'),
            conveyorSpeedValue: document.getElementById('conveyorSpeedValue'),
            conveyorIntervalValue: document.getElementById('conveyorIntervalValue'),
            statTotal: document.getElementById('statTotal'),
            statShift: document.getElementById('statShift'),
            statWorkTime: document.getElementById('statWorkTime'),
            statEfficiency: document.getElementById('statEfficiency')
        };
    }

    /**
     * Загрузка сохраненного состояния
     */
    function loadState() {
        try {
            const saved = localStorage.getItem('conveyor_state');
            if (saved) {
                const loaded = JSON.parse(saved);
                state = { ...state, ...loaded };
            }
        } catch (e) {
            console.warn('[ConveyorModule] Не удалось загрузить состояние:', e);
        }
    }

    /**
     * Сохранение состояния
     */
    function saveState() {
        try {
            localStorage.setItem('conveyor_state', JSON.stringify(state));
        } catch (e) {
            console.warn('[ConveyorModule] Не удалось сохранить состояние:', e);
        }
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        // Кнопки управления
        if (elements.conveyorStart) {
            elements.conveyorStart.addEventListener('click', start);
        }

        if (elements.conveyorStop) {
            elements.conveyorStop.addEventListener('click', stop);
        }

        if (elements.conveyorReset) {
            elements.conveyorReset.addEventListener('click', reset);
        }

        // Слайдеры
        if (elements.conveyorSpeedSlider) {
            elements.conveyorSpeedSlider.addEventListener('input', (e) => {
                setSpeed(parseFloat(e.target.value));
            });
            elements.conveyorSpeedSlider.addEventListener('change', (e) => {
                sendSpeedToApi(parseFloat(e.target.value));
            });
        }

        if (elements.conveyorIntervalSlider) {
            elements.conveyorIntervalSlider.addEventListener('input', (e) => {
                setInterval(parseFloat(e.target.value));
            });
        }
    }

    /**
     * Запуск конвейера
     */
    async function start() {
        if (state.running) return;

        if (config.useApi && window.ApiClient) {
            try {
                await window.ApiClient.startConveyor();
                state.running = true;
                saveState();
                updateUI();
                startAnimation();
                startItemGeneration();
                startWorkTimeTimer();

                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'success',
                        title: 'Конвейер',
                        message: 'Конвейер запущен'
                    });
                }
                return;
            } catch (error) {
                console.error('[ConveyorModule] Ошибка запуска:', error);
            }
        }

        // Fallback (эмуляция)
        state.running = true;
        saveState();
        updateUI();
        startAnimation();
        startItemGeneration();
        startWorkTimeTimer();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Конвейер',
                message: 'Конвейер запущен'
            });
        }
    }

    /**
     * Остановка конвейера
     */
    async function stop() {
        if (!state.running) return;

        if (config.useApi && window.ApiClient) {
            try {
                await window.ApiClient.stopConveyor();
                state.running = false;
                saveState();
                updateUI();
                stopAnimation();
                stopItemGeneration();
                stopWorkTimeTimer();

                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'info',
                        title: 'Конвейер',
                        message: 'Конвейер остановлен'
                    });
                }
                return;
            } catch (error) {
                console.error('[ConveyorModule] Ошибка остановки:', error);
            }
        }

        // Fallback (эмуляция)
        state.running = false;
        saveState();
        updateUI();
        stopAnimation();
        stopItemGeneration();
        stopWorkTimeTimer();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Конвейер',
                message: 'Конвейер остановлен'
            });
        }
    }

    /**
     * Сброс счетчиков
     */
    function reset() {
        state.shiftCount = 0;
        state.workTime = '0ч 0м';
        saveState();
        updateUI();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Конвейер',
                message: 'Счетчики сброшены'
            });
        }
    }

    /**
     * Установка скорости
     */
    function setSpeed(speed) {
        state.speed = Math.max(config.speed.min, Math.min(config.speed.max, speed));
        saveState();
        updateUI();

        if (state.running) {
            stopAnimation();
            startAnimation();
        }
    }

    /**
     * Отправка скорости в API
     */
    async function sendSpeedToApi(speed) {
        if (!config.useApi || !window.ApiClient) return;

        try {
            await window.ApiClient.setConveyorSpeed(speed);
            
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'success',
                    title: 'Конвейер',
                    message: `Скорость установлена: ${speed} м/с`
                });
            }
        } catch (error) {
            console.error('[ConveyorModule] Ошибка установки скорости:', error);
            
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось установить скорость'
                });
            }
        }
    }

    /**
     * Установка интервала
     */
    function setInterval(interval) {
        state.interval = Math.max(config.interval.min, Math.min(config.interval.max, interval));
        saveState();
        updateUI();

        if (state.running) {
            stopItemGeneration();
            startItemGeneration();
        }
    }

    /**
     * Запуск анимации
     */
    function startAnimation() {
        const itemsContainer = elements.conveyorItemsLarge;
        if (!itemsContainer) return;

        const animationDuration = 10 / state.speed;
        itemsContainer.style.animationDuration = animationDuration + 's';
        itemsContainer.style.animationPlayState = 'running';
    }

    /**
     * Остановка анимации
     */
    function stopAnimation() {
        const itemsContainer = elements.conveyorItemsLarge;
        if (!itemsContainer) return;

        itemsContainer.style.animationPlayState = 'paused';
    }

    /**
     * Запуск генерации предметов
     */
    function startItemGeneration() {
        if (itemInterval) clearInterval(itemInterval);

        itemInterval = setInterval(() => {
            if (state.items.length < config.maxItems) {
                addItem();
            }
        }, state.interval * 1000);
    }

    /**
     * Остановка генерации предметов
     */
    function stopItemGeneration() {
        if (itemInterval) {
            clearInterval(itemInterval);
            itemInterval = null;
        }
    }

    /**
     * Добавление предмета
     */
    function addItem() {
        const item = {
            id: Date.now(),
            position: 0,
            type: getRandomItemType()
        };

        state.items.push(item);
        state.totalTransported++;
        state.shiftCount++;

        updateItemsUI();
        updateStats();
        saveState();
    }

    /**
     * Получение случайного типа предмета
     */
    function getRandomItemType() {
        const types = ['📦', '🌿', '🥬', '🌱'];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * Удаление предмета
     */
    function removeItem(id) {
        state.items = state.items.filter(item => item.id !== id);
        updateItemsUI();
    }

    /**
     * Обновление UI предметов
     */
    function updateItemsUI() {
        if (!elements.conveyorItemsLarge) return;

        elements.conveyorItemsLarge.innerHTML = state.items.map((item, index) => `
            <span class="conveyor-item-large" style="left: ${index * (100 / config.maxItems)}%">
                ${item.type}
            </span>
        `).join('');

        // Обновление индикатора загрузки
        const loadPercent = (state.items.length / config.maxItems) * 100;
        if (elements.conveyorLoad) {
            elements.conveyorLoad.textContent = Math.round(loadPercent) + '%';
        }
    }

    /**
     * Обновление статистики
     */
    function updateStats() {
        if (elements.statTotal) {
            elements.statTotal.textContent = state.totalTransported.toLocaleString();
        }

        if (elements.statShift) {
            elements.statShift.textContent = state.shiftCount.toLocaleString();
        }
    }

    /**
     * Запуск таймера времени работы
     */
    function startWorkTimeTimer() {
        if (workTimeInterval) clearInterval(workTimeInterval);

        workTimeInterval = setInterval(() => {
            updateWorkTime();
        }, 60000); // Каждую минуту
    }

    /**
     * Остановка таймера времени работы
     */
    function stopWorkTimeTimer() {
        if (workTimeInterval) {
            clearInterval(workTimeInterval);
            workTimeInterval = null;
        }
    }

    /**
     * Обновление времени работы
     */
    function updateWorkTime() {
        if (!state.running) return;

        const parts = state.workTime.split('ч ');
        let hours = parseInt(parts[0]) || 0;
        let minutes = parseInt(parts[1]) || 0;

        minutes++;
        if (minutes >= 60) {
            minutes = 0;
            hours++;
        }

        state.workTime = `${hours}ч ${minutes.toString().padStart(2, '0')}м`;

        if (elements.statWorkTime) {
            elements.statWorkTime.textContent = state.workTime;
        }

        saveState();
    }

    /**
     * Обновление UI
     */
    function updateUI() {
        // Статус
        if (elements.conveyorStatus) {
            elements.conveyorStatus.textContent = state.running ? 'Работает' : 'Остановлен';
            elements.conveyorStatus.className = 'status-badge ' + (state.running ? 'active' : '');
        }

        // Скорость
        if (elements.conveyorSpeed) {
            elements.conveyorSpeed.textContent = state.speed.toFixed(1) + ' м/с';
        }

        if (elements.conveyorSpeedSlider) {
            elements.conveyorSpeedSlider.value = state.speed;
        }

        if (elements.conveyorSpeedValue) {
            elements.conveyorSpeedValue.textContent = state.speed.toFixed(1);
        }

        // Интервал
        if (elements.conveyorIntervalSlider) {
            elements.conveyorIntervalSlider.value = state.interval;
        }

        if (elements.conveyorIntervalValue) {
            elements.conveyorIntervalValue.textContent = state.interval.toFixed(0);
        }

        // Загрузка
        const loadPercent = (state.items.length / config.maxItems) * 100;
        if (elements.conveyorLoad) {
            elements.conveyorLoad.textContent = Math.round(loadPercent) + '%';
        }

        // Предметы на главной карточке
        if (elements.conveyorItems) {
            const items = state.items.slice(0, 3).map((item, index) => `
                <span class="conveyor-item" style="left: ${(index + 1) * 25}%; animation-duration: ${10 / state.speed}s">
                    ${item.type}
                </span>
            `).join('');
            elements.conveyorItems.innerHTML = items || `
                <span class="conveyor-item" style="left: 10%">📦</span>
                <span class="conveyor-item" style="left: 40%">📦</span>
                <span class="conveyor-item" style="left: 70%">📦</span>
            `;
        }

        // Статистика
        updateStats();

        // Эффективность (эмуляция)
        if (elements.statEfficiency) {
            const baseEfficiency = 90;
            const speedFactor = state.speed <= 2 ? 5 : 0;
            const loadFactor = loadPercent >= 50 ? 4 : 0;
            state.efficiency = Math.min(100, baseEfficiency + speedFactor + loadFactor);
            elements.statEfficiency.textContent = state.efficiency + '%';
        }

        // Анимация
        if (state.running) {
            startAnimation();
        } else {
            stopAnimation();
        }
    }

    /**
     * Обработка WebSocket событий
     */
    function handleWebSocketEvent(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'status_update':
                state.running = data.running ?? state.running;
                state.speed = data.speed ?? state.speed;
                state.totalTransported = data.totalTransported ?? state.totalTransported;
                state.efficiency = data.efficiency ?? state.efficiency;
                state.lastUpdate = new Date().toISOString();
                updateUI();
                break;
                
            case 'item_transported':
                state.totalTransported++;
                state.shiftCount++;
                updateStats();
                saveState();
                break;
                
            case 'maintenance_required':
                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'warning',
                        title: 'Обслуживание конвейера',
                        message: 'Требуется техническое обслуживание'
                    });
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
        } catch (error) {
            console.warn('[ConveyorModule] Не удалось обновить данные:', error);
        }
    }

    /**
     * Получение состояния
     */
    function getState() {
        return { ...state };
    }

    /**
     * Экспорт статистики
     */
    function exportStats() {
        const data = {
            timestamp: new Date().toISOString(),
            totalTransported: state.totalTransported,
            shiftCount: state.shiftCount,
            workTime: state.workTime,
            efficiency: state.efficiency,
            lastMaintenance: state.lastMaintenance,
            nextMaintenance: state.nextMaintenance
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'conveyor-stats-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Запись обслуживания
     */
    function recordMaintenance() {
        state.lastMaintenance = new Date().toISOString().slice(0, 10);
        // Следующее обслуживание через 30 дней
        const next = new Date();
        next.setDate(next.getDate() + 30);
        state.nextMaintenance = next.toISOString().slice(0, 10);

        saveState();
        updateUI();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Обслуживание',
                message: 'Запись об обслуживании добавлена'
            });
        }
    }

    /**
     * Проверка необходимости обслуживания
     */
    function checkMaintenance() {
        const today = new Date().toISOString().slice(0, 10);
        
        if (state.nextMaintenance && state.nextMaintenance <= today) {
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'warning',
                    title: 'Обслуживание конвейера',
                    message: 'Пора провести техническое обслуживание'
                });
            }

            // Отправка уведомления через Telegram модуль
            if (window.TelegramModule) {
                window.TelegramModule.sendAlert({
                    type: 'warning',
                    title: 'Обслуживание конвейера',
                    message: 'Требуется техническое обслуживание конвейера'
                });
            }
        }
    }

    // Публичный API
    return {
        init,
        start,
        stop,
        reset,
        setSpeed,
        setInterval,
        getState,
        exportStats,
        recordMaintenance,
        checkMaintenance,
        handleWebSocketEvent,
        refreshData
    };
})();

// Экспорт для глобального доступа
window.ConveyorModule = ConveyorModule;
