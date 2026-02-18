/**
 * GHouse Dashboard - Authentication Module
 * Модуль аутентификации с JWT поддержкой
 * Интеграция с backend API: /api/v1/auth/*
 */

const AuthModule = (function() {
    // Конфигурация
    const config = {
        roles: {
            admin: { level: 4, name: 'Администратор' },
            operator: { level: 3, name: 'Оператор' },
            viewer: { level: 2, name: 'Наблюдатель' },
            maintenance: { level: 1, name: 'Техник' }
        },
        sessionTimeout: 3600000, // 1 час
        refreshThreshold: 300000 // 5 минут до истечения
    };

    // Состояние
    let state = {
        isAuthenticated: false,
        user: null,
        role: null,
        loginTime: null,
        tokenExpiry: null
    };

    // DOM элементы
    let elements = {};

    // Таймер проверки сессии
    let sessionCheckInterval = null;

    /**
     * Инициализация модуля аутентификации
     */
    function init() {
        cacheElements();
        checkExistingSession();
        startSessionMonitor();
        console.log('[AuthModule] Инициализирован');
    }

    /**
     * Кэширование DOM элементов
     */
    function cacheElements() {
        elements = {
            userProfile: document.querySelector('.user-profile'),
            userName: document.querySelector('.user-name'),
            loginForm: document.getElementById('loginForm'),
            loginUsername: document.getElementById('loginUsername'),
            loginPassword: document.getElementById('loginPassword'),
            loginError: document.getElementById('loginError'),
            loginSubmit: document.getElementById('loginSubmit'),
            logoutBtn: document.getElementById('logoutBtn')
        };
    }

    /**
     * Проверка существующей сессии
     */
    async function checkExistingSession() {
        if (window.ApiClient && window.ApiClient.isAuthenticated()) {
            try {
                const user = await window.ApiClient.getCurrentUser();
                setAuthenticated(user);
            } catch (error) {
                console.warn('[AuthModule] Сессия недействительна:', error);
                window.ApiClient.clearTokens();
            }
        }
    }

    /**
     * Запуск монитора сессии
     */
    function startSessionMonitor() {
        // Проверка каждые 30 секунд
        sessionCheckInterval = setInterval(() => {
            if (state.isAuthenticated && state.tokenExpiry) {
                const remaining = state.tokenExpiry - Date.now();
                
                if (remaining < config.refreshThreshold) {
                    // Токен скоро истечет - обновить
                    refreshSession();
                }
                
                if (remaining <= 0) {
                    // Токен истек - logout
                    logout(true);
                }
            }
        }, 30000);
    }

    /**
     * Обновление сессии
     */
    async function refreshSession() {
        if (window.ApiClient && window.ApiClient.getToken()) {
            try {
                await window.ApiClient.getCurrentUser();
                console.log('[AuthModule] Сессия обновлена');
            } catch (error) {
                console.warn('[AuthModule] Не удалось обновить сессию:', error);
            }
        }
    }

    /**
     * Установка аутентифицированного состояния
     */
    function setAuthenticated(user) {
        state.isAuthenticated = true;
        state.user = user;
        state.role = user?.role || 'viewer';
        state.loginTime = new Date();
        // Токен действителен 1 час
        state.tokenExpiry = Date.now() + config.sessionTimeout;

        updateUserUI();
        updateAccessControl();

        if (window.App && window.App.notify) {
            window.App.notify({
                type: 'success',
                title: 'Вход выполнен',
                message: `Добро пожаловать, ${user?.username || 'Пользователь'}!`
            });
        }

        console.log('[AuthModule] Аутентификация успешна:', user);
    }

    /**
     * Обновление UI пользователя
     */
    function updateUserUI() {
        if (elements.userName && state.user) {
            elements.userName.textContent = state.user.username || state.user.email || 'Пользователь';
        }
    }

    /**
     * Обновление контроля доступа
     */
    function updateAccessControl() {
        const roleLevel = config.roles[state.role]?.level || 0;

        // Скрыть/показать элементы в зависимости от роли
        document.querySelectorAll('[data-role]').forEach(el => {
            const requiredRole = el.dataset.role;
            const requiredLevel = config.roles[requiredRole]?.level || 0;
            el.style.display = roleLevel >= requiredLevel ? '' : 'none';
        });

        document.querySelectorAll('[data-role-min]').forEach(el => {
            const minLevel = parseInt(el.dataset.roleMin) || 0;
            el.style.display = roleLevel >= minLevel ? '' : 'none';
        });
    }

    /**
     * Вход пользователя
     */
    async function login(username, password) {
        if (!username || !password) {
            throw new Error('Введите логин и пароль');
        }

        try {
            const response = await window.ApiClient.login(username, password);
            
            // Получаем информацию о пользователе
            const user = await window.ApiClient.getCurrentUser();
            setAuthenticated(user);

            return { success: true, user };

        } catch (error) {
            console.error('[AuthModule] Ошибка входа:', error);
            
            const message = error.status === 401 
                ? 'Неверный логин или пароль' 
                : error.message || 'Ошибка подключения к серверу';
            
            throw new Error(message);
        }
    }

    /**
     * Выход пользователя
     */
    async function logout(silent = false) {
        if (!state.isAuthenticated) return;

        try {
            await window.ApiClient.logout();
        } catch (error) {
            console.warn('[AuthModule] Ошибка при logout:', error);
        } finally {
            // Очистка состояния
            state.isAuthenticated = false;
            state.user = null;
            state.role = null;
            state.loginTime = null;
            state.tokenExpiry = null;

            updateUserUI();

            if (!silent && window.App && window.App.notify) {
                window.App.notify({
                    type: 'info',
                    title: 'Выход',
                    message: 'Вы вышли из системы'
                });
            }

            // Перенаправление на страницу входа
            if (!silent) {
                redirectToLogin();
            }

            console.log('[AuthModule] Выход выполнен');
        }
    }

    /**
     * Перенаправление на страницу входа
     */
    function redirectToLogin() {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }

    /**
     * Проверка прав доступа
     */
    function hasRole(requiredRole) {
        if (!state.isAuthenticated) return false;
        
        const userLevel = config.roles[state.role]?.level || 0;
        const requiredLevel = config.roles[requiredRole]?.level || 0;
        
        return userLevel >= requiredLevel;
    }

    /**
     * Проверка минимального уровня роли
     */
    function hasMinRole(level) {
        if (!state.isAuthenticated) return false;
        
        const userLevel = config.roles[state.role]?.level || 0;
        return userLevel >= level;
    }

    /**
     * Получение информации о роли
     */
    function getRoleInfo(roleName) {
        return config.roles[roleName] || null;
    }

    /**
     * Получение текущего пользователя
     */
    function getCurrentUser() {
        return state.user;
    }

    /**
     * Получение текущей роли
     */
    function getCurrentRole() {
        return state.role;
    }

    /**
     * Проверка аутентификации
     */
    function isAuthenticated() {
        return state.isAuthenticated;
    }

    /**
     * Получение времени оставшегося сеанса
     */
    function getSessionRemaining() {
        if (!state.tokenExpiry) return 0;
        return Math.max(0, state.tokenExpiry - Date.now());
    }

    /**
     * Форматирование времени сессии
     */
    function formatSessionTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}ч ${minutes % 60}м`;
        }
        return `${minutes}м`;
    }

    /**
     * Обработка формы входа (если есть на странице)
     */
    function handleLoginForm() {
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = elements.loginUsername?.value.trim();
                const password = elements.loginPassword?.value;
                const errorEl = elements.loginError;
                const submitBtn = elements.loginSubmit;

                if (!username || !password) {
                    if (errorEl) {
                        errorEl.textContent = 'Заполните все поля';
                        errorEl.style.display = 'block';
                    }
                    return;
                }

                // Блокировка кнопки
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Вход...';
                }

                try {
                    await login(username, password);
                    // Успешный вход - перенаправление
                    window.location.href = 'index.html';
                } catch (error) {
                    if (errorEl) {
                        errorEl.textContent = error.message;
                        errorEl.style.display = 'block';
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Войти';
                    }
                }
            });
        }

        // Кнопка выхода
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', () => logout());
        }
    }

    /**
     * Проверка и перенаправление если не аутентифицирован
     */
    function requireAuth() {
        if (!state.isAuthenticated && !window.ApiClient.isAuthenticated()) {
            redirectToLogin();
            return false;
        }
        return true;
    }

    // Публичный API
    return {
        init,
        login,
        logout,
        hasRole,
        hasMinRole,
        getRoleInfo,
        getCurrentUser,
        getCurrentRole,
        isAuthenticated,
        getSessionRemaining,
        formatSessionTime,
        handleLoginForm,
        requireAuth
    };
})();

// Экспорт для глобального доступа
window.AuthModule = AuthModule;
