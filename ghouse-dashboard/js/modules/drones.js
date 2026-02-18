/**
 * GHouse Dashboard - Drones Module
 * Управление и мониторинг беспилотников: заряд, GPS, модули
 * Интеграция с Backend API: /api/v1/drones/*
 */

const DronesModule = (function() {
    // Конфигурация
    const config = {
        drones: [
            { id: 1, name: 'Дрон #1', defaultModule: 'grab' },
            { id: 2, name: 'Дрон #2', defaultModule: 'spray' },
            { id: 3, name: 'Дрон #3', defaultModule: 'soil' }
        ],
        modules: {
            grab: { name: 'Захват', icon: '🤖' },
            spray: { name: 'Орошение', icon: '💦' },
            soil: { name: 'Забор почвы', icon: '🌱' },
            charging: { name: 'Зарядка', icon: '🔋' }
        },
        chargingStations: 3,
        batteryLow: 30,
        batteryCritical: 15,
        apiEndpoints: {
            list: '/drones',
            command: '/drones/{id}/command',
            returnToBase: '/drones/{id}/return-to-base'
        },
        useApi: true,
        updateInterval: 3000
    };

    // Состояние
    let state = {
        drones: [],
        chargingStations: [],
        selectedModule: null,
        lastUpdate: null
    };

    // DOM элементы
    let elements = {};

    // Таймер обновления
    let updateTimer = null;

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
                console.warn('[DronesModule] Не удалось загрузить из API, используем эмуляцию:', error);
                loadState();
                initEmulation();
            }
        } else {
            loadState();
            initEmulation();
        }
        
        bindEvents();
        updateUI();
        startMonitoring();
        
        console.log('[DronesModule] Инициализирован');
    }

    /**
     * Загрузка данных из API
     */
    async function loadFromApi() {
        try {
            const drones = await window.ApiClient.getDrones();
            
            if (drones && Array.isArray(drones)) {
                state.drones = drones.map(drone => ({
                    id: drone.id,
                    name: drone.name || `Дрон #${drone.id}`,
                    battery: drone.battery ?? 100,
                    status: drone.status || 'active',
                    module: drone.module || 'grab',
                    gps: drone.gps || { lat: 55.75, lng: 37.61 },
                    altitude: drone.altitude || 0,
                    speed: drone.speed || 0,
                    mission: drone.mission || 'Готов к миссии'
                }));
                
                state.lastUpdate = new Date().toISOString();
                saveState();
            }
            
        } catch (error) {
            console.error('[DronesModule] Ошибка загрузки из API:', error);
            throw error;
        }
    }

    /**
     * Инициализация эмуляции (fallback)
     */
    function initEmulation() {
        if (state.drones.length === 0) {
            state.drones = [
                {
                    id: 1,
                    name: 'Дрон #1',
                    battery: 87,
                    status: 'active',
                    module: 'grab',
                    gps: { lat: 55.75, lng: 37.61 },
                    altitude: 15,
                    speed: 5,
                    mission: 'Мониторинг сектора A'
                },
                {
                    id: 2,
                    name: 'Дрон #2',
                    battery: 62,
                    status: 'active',
                    module: 'spray',
                    gps: { lat: 55.76, lng: 37.62 },
                    altitude: 12,
                    speed: 3,
                    mission: 'Орошение зоны B'
                },
                {
                    id: 3,
                    name: 'Дрон #3',
                    battery: 23,
                    status: 'charging',
                    module: 'charging',
                    gps: { lat: 0, lng: 0 },
                    altitude: 0,
                    speed: 0,
                    mission: 'Зарядка на станции'
                }
            ];
        }
        
        if (state.chargingStations.length === 0) {
            state.chargingStations = [
                { id: 1, occupied: true, droneId: 3, charge: 23 },
                { id: 2, occupied: false, droneId: null, charge: 0 },
                { id: 3, occupied: false, droneId: null, charge: 0 }
            ];
        }
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            dronesStatus: document.getElementById('dronesStatus'),
            droneDetailList: document.getElementById('droneDetailList'),
            chargingSlots: document.querySelector('.charging-slots'),
            moduleBtns: document.querySelectorAll('.module-btn')
        };
    }

    /**
     * Загрузка сохраненного состояния
     */
    function loadState() {
        try {
            const saved = localStorage.getItem('drones_state');
            if (saved) {
                const loaded = JSON.parse(saved);
                state = { ...state, ...loaded };
            }
        } catch (e) {
            console.warn('[DronesModule] Не удалось загрузить состояние:', e);
        }
    }

    /**
     * Сохранение состояния
     */
    function saveState() {
        try {
            localStorage.setItem('drones_state', JSON.stringify(state));
        } catch (e) {
            console.warn('[DronesModule] Не удалось сохранить состояние:', e);
        }
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        // Кнопки модулей
        elements.moduleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const module = btn.dataset.module;
                selectModule(module);
            });
        });
    }

    /**
     * Запуск мониторинга
     */
    function startMonitoring() {
        if (updateTimer) {
            clearInterval(updateTimer);
        }

        updateTimer = setInterval(() => {
            if (config.useApi && window.ApiClient) {
                refreshData();
            } else {
                simulateDroneUpdates();
                updateUI();
                checkBatteryLevels();
            }
        }, config.updateInterval);
    }

    /**
     * Эмуляция обновлений дронов (fallback)
     */
    function simulateDroneUpdates() {
        state.drones.forEach(drone => {
            if (drone.status === 'active') {
                // Эмуляция разряда батареи
                drone.battery = Math.max(0, drone.battery - (Math.random() * 0.5));

                // Эмуляция изменения GPS координат
                drone.gps.lat += (Math.random() - 0.5) * 0.001;
                drone.gps.lng += (Math.random() - 0.5) * 0.001;

                // Эмуляция изменения высоты и скорости
                drone.altitude = Math.max(5, Math.min(30, drone.altitude + (Math.random() - 0.5) * 2));
                drone.speed = Math.max(0, Math.min(10, drone.speed + (Math.random() - 0.5) * 1));

                // Проверка на низкий заряд - возврат на зарядку
                if (drone.battery < config.batteryCritical && drone.status !== 'returning') {
                    drone.status = 'returning';
                    drone.mission = 'Возврат на базу';
                    notifyAboutLowBattery(drone);
                }
            } else if (drone.status === 'charging') {
                // Эмуляция зарядки
                const station = state.chargingStations.find(s => s.droneId === drone.id);
                if (station) {
                    station.charge = Math.min(100, station.charge + 1);
                    drone.battery = station.charge;

                    if (station.charge >= 100) {
                        drone.status = 'active';
                        drone.module = drone.defaultModule;
                        drone.mission = 'Готов к миссии';
                        station.occupied = false;
                        station.droneId = null;
                    }
                }
            }
        });

        saveState();
    }

    /**
     * Уведомление о низком заряде
     */
    function notifyAboutLowBattery(drone) {
        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'warning',
                title: `Низкий заряд: ${drone.name}`,
                message: `Батарея: ${Math.round(drone.battery)}%. Дрон возвращается на базу.`
            });
        }
    }

    /**
     * Проверка уровня батареи
     */
    function checkBatteryLevels() {
        state.drones.forEach(drone => {
            if (drone.status === 'active' && drone.battery < config.batteryLow) {
                // Отправка алерта через Telegram модуль
                if (window.TelegramModule) {
                    window.TelegramModule.sendAlert({
                        type: 'warning',
                        title: `Низкий заряд дрона`,
                        message: `${drone.name}: ${Math.round(drone.battery)}%`
                    });
                }
            }
        });
    }

    /**
     * Обновление UI
     */
    function updateUI() {
        updateDronesStatus();
        updateDroneDetailList();
        updateChargingStations();
        updateModuleButtons();
        updateSummary();
    }

    /**
     * Обновление статуса дронов (главная карточка)
     */
    function updateDronesStatus() {
        if (!elements.dronesStatus) return;

        elements.dronesStatus.innerHTML = state.drones.map(drone => `
            <div class="drone-item">
                <div class="drone-header">
                    <span class="drone-name">${drone.name}</span>
                    <span class="drone-module">${getModuleName(drone.module)}</span>
                </div>
                <div class="drone-info">
                    <span class="battery-level" style="color: ${getBatteryColor(drone.battery)}">
                        ${Math.round(drone.battery)}%
                    </span>
                    <span class="drone-gps">
                        ${drone.status === 'charging' ? 'Станция' : `GPS: ${drone.gps.lat.toFixed(2)}, ${drone.gps.lng.toFixed(2)}`}
                    </span>
                </div>
                <div class="drone-progress">
                    <div class="progress-bar" style="width: ${drone.battery}%; background: ${getBatteryColor(drone.battery)}"></div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Обновление детальной информации о дронах
     */
    function updateDroneDetailList() {
        if (!elements.droneDetailList) return;

        elements.droneDetailList.innerHTML = state.drones.map(drone => `
            <div class="drone-detail-item">
                <div class="drone-detail-header">
                    <span>${drone.name}</span>
                    <span class="status-badge ${getStatusClass(drone.status)}">${getStatusName(drone.status)}</span>
                </div>
                <div class="drone-detail-body">
                    <div class="drone-specs">
                        <div class="drone-spec">
                            <span class="drone-spec-value" style="color: ${getBatteryColor(drone.battery)}">
                                ${Math.round(drone.battery)}%
                            </span>
                            <span class="drone-spec-label">Заряд</span>
                        </div>
                        <div class="drone-spec">
                            <span class="drone-spec-value">${drone.altitude.toFixed(1)} м</span>
                            <span class="drone-spec-label">Высота</span>
                        </div>
                        <div class="drone-spec">
                            <span class="drone-spec-value">${drone.speed.toFixed(1)} м/с</span>
                            <span class="drone-spec-label">Скорость</span>
                        </div>
                    </div>
                    <div style="margin-top: 12px; font-size: 0.85rem; color: var(--text-secondary);">
                        <strong>Миссия:</strong> ${drone.mission}
                    </div>
                    <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
                        <strong>GPS:</strong> ${drone.gps.lat.toFixed(4)}, ${drone.gps.lng.toFixed(4)}
                    </div>
                    <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
                        <strong>Модуль:</strong> ${getModuleName(drone.module)}
                    </div>
                    <div class="drone-actions">
                        <button class="btn-secondary" onclick="DronesModule.returnToBase(${drone.id})">
                            🏠 Возврат
                        </button>
                        <button class="btn-secondary" onclick="DronesModule.changeModule(${drone.id})">
                            🔧 Сменить модуль
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Обновление зарядных станций
     */
    function updateChargingStations() {
        if (!elements.chargingSlots) return;

        elements.chargingSlots.innerHTML = state.chargingStations.map(station => `
            <div class="charging-slot ${station.occupied ? 'occupied' : 'free'}">
                <span class="slot-icon">${station.occupied ? '🔋' : '➖'}</span>
                <span class="slot-status">${station.occupied ? 'Занято' : 'Свободно'}</span>
                ${station.occupied ? `<span class="slot-charge">${station.charge}%</span>` : ''}
            </div>
        `).join('');
    }

    /**
     * Обновление кнопок модулей
     */
    function updateModuleButtons() {
        elements.moduleBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.module === state.selectedModule);
        });
    }

    /**
     * Обновление сводки
     */
    function updateSummary() {
        const summaryBattery = document.getElementById('summaryBattery');
        if (summaryBattery) {
            const avgBattery = state.drones.reduce((sum, d) => sum + d.battery, 0) / state.drones.length;
            summaryBattery.textContent = Math.round(avgBattery) + '%';
        }
    }

    /**
     * Выбор модуля
     */
    function selectModule(module) {
        state.selectedModule = module;

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Выбор модуля',
                message: `Выбран модуль: ${getModuleName(module)}`
            });
        }
    }

    /**
     * Возврат дрона на базу
     */
    async function returnToBase(droneId) {
        const drone = state.drones.find(d => d.id === droneId);
        if (!drone) return;

        if (config.useApi && window.ApiClient) {
            try {
                await window.ApiClient.returnDroneToBase(droneId);
                
                drone.status = 'returning';
                drone.mission = 'Возврат на базу';
                saveState();
                updateUI();

                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'info',
                        title: drone.name,
                        message: 'Дрон возвращается на базу'
                    });
                }
                return;
            } catch (error) {
                console.error('[DronesModule] Ошибка возврата на базу:', error);
            }
        }

        // Fallback (эмуляция)
        drone.status = 'returning';
        drone.mission = 'Возврат на базу';
        saveState();
        updateUI();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: drone.name,
                message: 'Дрон возвращается на базу'
            });
        }
    }

    /**
     * Смена модуля дрона
     */
    async function changeModule(droneId) {
        const drone = state.drones.find(d => d.id === droneId);
        if (!drone) return;

        if (!state.selectedModule) {
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'warning',
                    title: 'Выбор модуля',
                    message: 'Сначала выберите модуль в панели справа'
                });
            }
            return;
        }

        if (config.useApi && window.ApiClient) {
            try {
                await window.ApiClient.sendDroneCommand(droneId, 'change_module', { module: state.selectedModule });
                
                drone.module = state.selectedModule;
                drone.mission = `Миссия с модулем: ${getModuleName(state.selectedModule)}`;
                saveState();
                updateUI();

                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'success',
                        title: drone.name,
                        message: `Модуль изменен на: ${getModuleName(state.selectedModule)}`
                    });
                }
                return;
            } catch (error) {
                console.error('[DronesModule] Ошибка смены модуля:', error);
            }
        }

        // Fallback (эмуляция)
        drone.module = state.selectedModule;
        drone.mission = `Миссия с модулем: ${getModuleName(state.selectedModule)}`;
        saveState();
        updateUI();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: drone.name,
                message: `Модуль изменен на: ${getModuleName(state.selectedModule)}`
            });
        }
    }

    /**
     * Отправка команды дрону
     */
    async function sendCommand(droneId, command, params = {}) {
        if (!config.useApi || !window.ApiClient) {
            console.warn('[DronesModule] API отключено, команда не отправлена');
            return false;
        }

        try {
            const response = await window.ApiClient.sendDroneCommand(droneId, command, params);
            
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'success',
                    title: 'Команда отправлена',
                    message: `Дрону ${droneId} отправлена команда: ${command}`
                });
            }
            
            return response;
        } catch (error) {
            console.error('[DronesModule] Ошибка отправки команды:', error);
            
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось отправить команду дрону'
                });
            }
            
            return false;
        }
    }

    /**
     * Получение названия модуля
     */
    function getModuleName(moduleKey) {
        return config.modules[moduleKey]?.name || moduleKey;
    }

    /**
     * Получение цвета батареи
     */
    function getBatteryColor(level) {
        if (level < config.batteryCritical) return 'var(--status-error)';
        if (level < config.batteryLow) return 'var(--status-warning)';
        return 'var(--status-success)';
    }

    /**
     * Получение класса статуса
     */
    function getStatusClass(status) {
        const classes = {
            active: 'active',
            charging: 'connected',
            returning: 'warning',
            offline: 'error'
        };
        return classes[status] || '';
    }

    /**
     * Получение названия статуса
     */
    function getStatusName(status) {
        const names = {
            active: 'Активен',
            charging: 'Зарядка',
            returning: 'Возврат',
            offline: 'Оффлайн'
        };
        return names[status] || status;
    }

    /**
     * Обработка WebSocket событий
     */
    function handleWebSocketEvent(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'drone_update':
                const drone = state.drones.find(d => d.id === data.id);
                if (drone) {
                    Object.assign(drone, data);
                    updateUI();
                }
                break;
                
            case 'drone_added':
                state.drones.push({
                    id: data.id,
                    name: data.name || `Дрон #${data.id}`,
                    battery: 100,
                    status: 'active',
                    module: 'grab',
                    ...data
                });
                updateUI();
                break;
                
            case 'drone_removed':
                state.drones = state.drones.filter(d => d.id !== data.id);
                updateUI();
                break;
                
            case 'battery_low':
                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'warning',
                        title: `Низкий заряд: ${data.name}`,
                        message: `Батарея: ${data.battery}%`
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
            console.warn('[DronesModule] Не удалось обновить данные:', error);
        }
    }

    /**
     * Получение состояния
     */
    function getState() {
        return { ...state };
    }

    /**
     * Добавление нового дрона
     */
    function addDrone(droneConfig) {
        const newDrone = {
            id: Date.now(),
            name: `Дрон #${state.drones.length + 1}`,
            battery: 100,
            status: 'active',
            module: droneConfig.module || 'grab',
            gps: { lat: 55.75, lng: 37.61 },
            altitude: 0,
            speed: 0,
            mission: 'Готов к миссии',
            ...droneConfig
        };

        state.drones.push(newDrone);
        saveState();
        updateUI();

        return newDrone;
    }

    /**
     * Удаление дрона
     */
    function removeDrone(droneId) {
        const index = state.drones.findIndex(d => d.id === droneId);
        if (index !== -1) {
            state.drones.splice(index, 1);
            saveState();
            updateUI();
        }
    }

    // Публичный API
    return {
        init,
        getState,
        returnToBase,
        changeModule,
        sendCommand,
        selectModule,
        addDrone,
        removeDrone,
        handleWebSocketEvent,
        refreshData
    };
})();

// Экспорт для глобального доступа
window.DronesModule = DronesModule;
