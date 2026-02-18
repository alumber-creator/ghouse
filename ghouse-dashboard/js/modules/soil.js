/**
 * GHouse Dashboard - Soil Analysis Module
 * Аналитика почвы: влажность, pH, NPK, история анализов
 * Интеграция с Backend API: /api/v1/soil/*
 */

const SoilModule = (function() {
    // Конфигурация
    const config = {
        moisture: {
            min: 60,
            max: 90,
            optimal: 78,
            unit: '%'
        },
        ph: {
            min: 5.5,
            max: 7.5,
            optimal: 6.5,
            unit: ''
        },
        npk: {
            n: { min: 70, max: 100, optimal: 85 },
            p: { min: 60, max: 100, optimal: 72 },
            k: { min: 75, max: 100, optimal: 92 }
        },
        apiEndpoints: {
            current: '/soil/current',
            analyze: '/soil/analyze',
            zones: '/soil/zones',
            recommendations: '/soil/recommendations'
        },
        useApi: true
    };

    // Состояние
    let state = {
        moisture: 78,
        ph: 6.5,
        npk: {
            n: 85,
            p: 72,
            k: 92
        },
        temperature: 22,
        conductivity: 1.8,
        lastAnalysis: null,
        history: [],
        zones: [],
        recommendations: [],
        lastUpdate: null
    };

    // DOM элементы
    let elements = {};

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
                console.warn('[SoilModule] Не удалось загрузить из API, используем localStorage:', error);
                loadState();
            }
        } else {
            loadState();
        }
        
        bindEvents();
        updateUI();
        
        console.log('[SoilModule] Инициализирован');
    }

    /**
     * Загрузка данных из API
     */
    async function loadFromApi() {
        try {
            const [current, zones, recommendations] = await Promise.all([
                window.ApiClient.getSoilCurrent().catch(() => null),
                window.ApiClient.getSoilZones().catch(() => null),
                window.ApiClient.getSoilRecommendations().catch(() => null)
            ]);

            if (current) {
                state.moisture = current.moisture ?? state.moisture;
                state.ph = current.ph ?? state.ph;
                state.npk = current.npk ?? state.npk;
                state.temperature = current.temperature ?? state.temperature;
                state.conductivity = current.conductivity ?? state.conductivity;
                state.lastAnalysis = current.lastAnalysis ?? state.lastAnalysis;
                state.lastUpdate = new Date().toISOString();
            }

            if (zones) {
                state.zones = zones;
            }

            if (recommendations) {
                state.recommendations = recommendations;
            }

            saveState();

        } catch (error) {
            console.error('[SoilModule] Ошибка загрузки из API:', error);
            throw error;
        }
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            analyzeSoilBtn: document.getElementById('analyzeSoilBtn'),
            soilHistoryList: document.getElementById('soilHistoryList')
        };
    }

    /**
     * Загрузка сохраненного состояния
     */
    function loadState() {
        try {
            const saved = localStorage.getItem('soil_state');
            if (saved) {
                const loaded = JSON.parse(saved);
                state = { ...state, ...loaded };
            }
            
            // Инициализация истории по умолчанию если пуста
            if (state.history.length === 0) {
                state.history = [
                    { date: new Date().toLocaleDateString('ru-RU') + ' 10:30', result: 'ok', details: 'Все параметры в норме' },
                    { date: '17.02.2026 14:15', result: 'ok', details: 'Все параметры в норме' },
                    { date: '16.02.2026 09:00', result: 'warning', details: 'Требуется полив' }
                ];
            }
        } catch (e) {
            console.warn('[SoilModule] Не удалось загрузить состояние:', e);
        }
    }

    /**
     * Сохранение состояния
     */
    function saveState() {
        try {
            localStorage.setItem('soil_state', JSON.stringify(state));
        } catch (e) {
            console.warn('[SoilModule] Не удалось сохранить состояние:', e);
        }
    }

    /**
     * Привязка событий
     */
    function bindEvents() {
        if (elements.analyzeSoilBtn) {
            elements.analyzeSoilBtn.addEventListener('click', performAnalysis);
        }
    }

    /**
     * Выполнение анализа почвы
     */
    async function performAnalysis() {
        // Блокировка кнопки
        if (elements.analyzeSoilBtn) {
            elements.analyzeSoilBtn.disabled = true;
            elements.analyzeSoilBtn.textContent = 'Анализ...';
        }

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Анализ почвы',
                message: 'Запуск анализа... Ожидайте результатов'
            });
        }

        try {
            if (config.useApi && window.ApiClient) {
                // Реальный запрос к API
                const result = await window.ApiClient.analyzeSoil();
                
                if (result) {
                    state.moisture = result.moisture ?? state.moisture;
                    state.ph = result.ph ?? state.ph;
                    state.npk = result.npk ?? state.npk;
                    state.lastAnalysis = new Date().toISOString();
                    state.lastUpdate = new Date().toISOString();
                    
                    // Добавление в историю
                    addToHistory(result);
                    saveState();
                    updateUI();
                    
                    const analysisResult = determineAnalysisResult();
                    
                    if (window.App && window.App.notify) {
                        window.App.notify({
                            type: analysisResult === 'ok' ? 'success' : 'warning',
                            title: 'Анализ почвы завершен',
                            message: analysisResult === 'ok' ? 'Все параметры в норме' : 'Обнаружены отклонения от нормы'
                        });
                    }
                    
                    // Отправка в Telegram если есть отклонения
                    if (analysisResult !== 'ok' && window.TelegramModule) {
                        window.TelegramModule.sendAlert({
                            type: 'warning',
                            title: 'Анализ почвы',
                            message: 'Обнаружены отклонения параметров почвы от нормы'
                        });
                    }
                }
            } else {
                // Эмуляция (fallback)
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Обновление показателей с небольшими случайными изменениями
                state.moisture = normalize(state.moisture + (Math.random() - 0.5) * 5, 60, 90);
                state.ph = normalize(state.ph + (Math.random() - 0.5) * 0.3, 5.5, 7.5);
                state.npk.n = normalize(state.npk.n + (Math.random() - 0.5) * 10, 70, 100);
                state.npk.p = normalize(state.npk.p + (Math.random() - 0.5) * 10, 60, 100);
                state.npk.k = normalize(state.npk.k + (Math.random() - 0.5) * 10, 75, 100);

                const result = determineAnalysisResult();
                addToHistory(result);
                state.lastAnalysis = new Date().toISOString();
                state.lastUpdate = new Date().toISOString();
                saveState();
                updateUI();

                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: result === 'ok' ? 'success' : 'warning',
                        title: 'Анализ почвы завершен',
                        message: result === 'ok' ? 'Все параметры в норме' : 'Обнаружены отклонения от нормы'
                    });
                }

                if (result !== 'ok' && window.TelegramModule) {
                    window.TelegramModule.sendAlert({
                        type: 'warning',
                        title: 'Анализ почвы',
                        message: 'Обнаружены отклонения параметров почвы от нормы'
                    });
                }
            }
        } catch (error) {
            console.error('[SoilModule] Ошибка анализа:', error);
            
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось выполнить анализ почвы'
                });
            }
        } finally {
            // Восстановление кнопки
            if (elements.analyzeSoilBtn) {
                elements.analyzeSoilBtn.disabled = false;
                elements.analyzeSoilBtn.textContent = '🔬 Анализировать';
            }
        }
    }

    /**
     * Нормализация значения
     */
    function normalize(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Определение результата анализа
     */
    function determineAnalysisResult() {
        const issues = [];

        if (state.moisture < config.moisture.min || state.moisture > config.moisture.max) {
            issues.push('Влажность');
        }

        if (state.ph < config.ph.min || state.ph > config.ph.max) {
            issues.push('pH');
        }

        if (state.npk.n < config.npk.n.min || state.npk.n > config.npk.n.max) {
            issues.push('Азот (N)');
        }

        if (state.npk.p < config.npk.p.min || state.npk.p > config.npk.p.max) {
            issues.push('Фосфор (P)');
        }

        if (state.npk.k < config.npk.k.min || state.npk.k > config.npk.k.max) {
            issues.push('Калий (K)');
        }

        if (issues.length > 0) {
            return {
                status: 'warning',
                issues: issues
            };
        }

        return 'ok';
    }

    /**
     * Добавление в историю
     */
    function addToHistory(result) {
        const now = new Date();
        const timeString = now.toLocaleDateString('ru-RU') + ' ' +
                          now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        const historyItem = {
            date: timeString,
            result: typeof result === 'string' ? result : result.status,
            details: typeof result === 'string'
                ? 'Все параметры в норме'
                : 'Отклонения: ' + (result.issues || []).join(', ')
        };

        state.history.unshift(historyItem);

        // Ограничение истории 20 записями
        if (state.history.length > 20) {
            state.history = state.history.slice(0, 20);
        }
    }

    /**
     * Обновление UI
     */
    function updateUI() {
        updateMetrics();
        updateHistory();
        updateZones();
        updateSummary();
    }

    /**
     * Обновление метрик
     */
    function updateMetrics() {
        // Обновление круговых диаграмм
        updateMetricCircle('.soil-metric[data-value]', state.moisture);

        // Обновление NPK баров
        const npkBars = document.querySelectorAll('.npk-item');
        if (npkBars.length >= 3) {
            updateNpkBar(npkBars[0], state.npk.n);
            updateNpkBar(npkBars[1], state.npk.p);
            updateNpkBar(npkBars[2], state.npk.k);
        }

        // Обновление индикатора pH
        const phIndicator = document.querySelector('.ph-indicator');
        if (phIndicator) {
            const percent = ((state.ph - config.ph.min) / (config.ph.max - config.ph.min)) * 100;
            phIndicator.style.left = percent + '%';
        }
    }

    /**
     * Обновление круговой метрики
     */
    function updateMetricCircle(selector, value) {
        const circle = document.querySelector(selector);
        if (circle) {
            circle.setAttribute('data-value', value);
            const circlePath = circle.querySelector('.circle');
            if (circlePath) {
                circlePath.setAttribute('stroke-dasharray', value + ', 100');
            }
            const valueText = circle.querySelector('.metric-value');
            if (valueText) {
                valueText.textContent = value.toFixed(0) + '%';
            }
        }
    }

    /**
     * Обновление NPK бара
     */
    function updateNpkBar(element, value) {
        const fill = element.querySelector('.npk-fill');
        const valueEl = element.querySelector('.npk-value');
        if (fill) {
            fill.style.width = value + '%';
        }
        if (valueEl) {
            valueEl.textContent = value.toFixed(0) + '%';
        }
    }

    /**
     * Обновление истории
     */
    function updateHistory() {
        if (!elements.soilHistoryList) return;

        elements.soilHistoryList.innerHTML = state.history.map(item => `
            <div class="history-item">
                <span class="history-date">${item.date}</span>
                <span class="history-result">${getResultIcon(item.result)} ${getResultText(item.result)}</span>
            </div>
        `).join('');
    }

    /**
     * Получение иконки результата
     */
    function getResultIcon(result) {
        return result === 'ok' ? '✅' : '⚠️';
    }

    /**
     * Получение текста результата
     */
    function getResultText(result) {
        return result === 'ok' ? 'Норма' : 'Требуется внимание';
    }

    /**
     * Обновление зон
     */
    function updateZones() {
        // Здесь можно добавить отображение зон на карте/схеме
        console.log('[SoilModule] Зоны:', state.zones);
    }

    /**
     * Обновление сводки
     */
    function updateSummary() {
        const summaryStatus = document.getElementById('summaryStatus');
        if (summaryStatus) {
            const result = determineAnalysisResult();
            summaryStatus.textContent = result === 'ok' ? 'OK' : 'ВНИМАНИЕ';
            summaryStatus.style.color = result === 'ok' ? 'var(--status-success)' : 'var(--status-warning)';
        }
    }

    /**
     * Получение состояния
     */
    function getState() {
        return { ...state };
    }

    /**
     * Получение истории анализов
     */
    function getHistory() {
        return state.history;
    }

    /**
     * Экспорт данных анализа
     */
    function exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            current: {
                moisture: state.moisture,
                ph: state.ph,
                npk: state.npk,
                temperature: state.temperature,
                conductivity: state.conductivity
            },
            zones: state.zones,
            history: state.history
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'soil-analysis-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Получение рекомендаций
     */
    function getRecommendations() {
        const recommendations = [];

        if (state.moisture < config.moisture.optimal - 10) {
            recommendations.push({
                type: 'warning',
                title: 'Низкая влажность',
                action: 'Увеличьте полив на 15-20%'
            });
        }

        if (state.moisture > config.moisture.optimal + 10) {
            recommendations.push({
                type: 'warning',
                title: 'Высокая влажность',
                action: 'Сократите полив на 10-15%'
            });
        }

        if (state.ph < 6.0) {
            recommendations.push({
                type: 'warning',
                title: 'Кислая почва',
                action: 'Внесите известь или доломитовую муку'
            });
        }

        if (state.ph > 7.0) {
            recommendations.push({
                type: 'warning',
                title: 'Щелочная почва',
                action: 'Внесите торф или серу'
            });
        }

        if (state.npk.n < 75) {
            recommendations.push({
                type: 'info',
                title: 'Недостаток азота',
                action: 'Внесите азотные удобрения'
            });
        }

        if (state.npk.p < 65) {
            recommendations.push({
                type: 'info',
                title: 'Недостаток фосфора',
                action: 'Внесите фосфорные удобрения'
            });
        }

        if (state.npk.k < 80) {
            recommendations.push({
                type: 'info',
                title: 'Недостаток калия',
                action: 'Внесите калийные удобрения'
            });
        }

        return recommendations;
    }

    /**
     * Автоматическая корректировка параметров
     */
    function autoAdjust() {
        const recommendations = getRecommendations();

        if (recommendations.length === 0) {
            if (window.App && window.App.notify) {
                window.App.notify({
                    type: 'success',
                    title: 'Авто-корректировка',
                    message: 'Все параметры в норме, корректировка не требуется'
                });
            }
            return;
        }

        // Применение автоматических корректировок
        recommendations.forEach(rec => {
            if (rec.title === 'Низкая влажность' && window.GreenhouseModule) {
                window.GreenhouseModule.updateSystem('watering', 80);
            }
            if (rec.title === 'Высокая влажность' && window.GreenhouseModule) {
                window.GreenhouseModule.updateSystem('watering', 50);
            }
        });

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'info',
                title: 'Авто-корректировка',
                message: `Применено ${recommendations.length} корректировок`
            });
        }
    }

    /**
     * Обработка WebSocket событий
     */
    function handleWebSocketEvent(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'analysis_complete':
                state.moisture = data.moisture ?? state.moisture;
                state.ph = data.ph ?? state.ph;
                state.npk = data.npk ?? state.npk;
                state.lastAnalysis = new Date().toISOString();
                state.lastUpdate = new Date().toISOString();
                addToHistory({ status: determineAnalysisResult() });
                saveState();
                updateUI();
                
                if (window.App && window.App.notify) {
                    window.App.notify({
                        type: 'success',
                        title: 'Анализ почвы',
                        message: 'Анализ завершен'
                    });
                }
                break;
                
            case 'zone_update':
                if (data.zones) {
                    state.zones = data.zones;
                    updateZones();
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
            console.warn('[SoilModule] Не удалось обновить данные:', error);
        }
    }

    // Публичный API
    return {
        init,
        performAnalysis,
        getState,
        getHistory,
        exportData,
        getRecommendations,
        autoAdjust,
        handleWebSocketEvent,
        refreshData
    };
})();

// Экспорт для глобального доступа
window.SoilModule = SoilModule;
