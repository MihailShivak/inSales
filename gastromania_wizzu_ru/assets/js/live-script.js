(function() {
    /**
     * Live Script
     * Мониторинг состояние веб ресурса (упрощенная версия)
     * Version: 1.0.0 beta
     */
    class LiveScript {
        constructor(config = {}) {
            this._name = "[Live.Script]";

            if (!config.apiEndpoint) return;
            this.config = {
                apiEndpoint: config.apiEndpoint,
                batchSize: config.batchSize || 10,
                batchTimeout: config.batchTimeout || 30000, // 30 сек

                enableConsoleTracking: config.enableConsoleTracking !== false,
                enablePerformanceTracking: config.enablePerformanceTracking !== false,
                enableDeviceTracking: config.enableDeviceTracking !== false,
                enableNetworkTracking: config.enableNetworkTracking !== false,

                debug: config.debug || false,
                apiOff: config.apiOff || false,                 // Выключить отправку запросов через api
            };

            this.eventType = {
                sessionStart: "session_start", // Начало сессии
                sessionEnd: "session_end", // Завершение сессии

                CWV: "core_web_vital", // Core Web Vital

                performance: "page_performance", // Измерение производительности страницы
                resourceTiming: "resource_timing", // Отслеживание медленных ресурсов (>2s),
                longResource: "long_resource", //  Отслеживание загрузки ресурсов (css, js, fetch)
                longAnimationFrame: "long_animation_frame", // Отслеживание долгих кадров анимации

                memoryUsage: "memory_usage", // Отслеживание использования памяти
                networkStatus: "network_status", // Отслеживание состояния интернета

                blockingRender: "blocking_render_source", // Отслеживание ресурсов блокирующих рендеринг и эффект водопада
                deviceInfo: "device_info", // Информация об устройстве и браузере
            };

            // Данные о скрипте
            this.metadata = {
                appVersion: "1.0.0 beta",
                environment: "debug"
            };

            // Хранилище событий
            this._events = [];
            this.batchTimer = null;
            this.sessionStartTime = Date.now();

            this._fetch = false; // Отправка запроса
            // this._beaconSent = false; 

            // Флаги инициализации
            this._inited = false; // Флаг инициализации объекта
            this._initedPerformance = false; // performanceInitialized
            this._initedCWV = false; // cwvInitialized

            // Инициализация
            this._init();
        }

        _init() {
            if (this._inited) return;

            // Трекинг ошибок и предупреждений консоли
            if (this.config.enableConsoleTracking) {
                this.initConsoleTracking();
            }

            this.setupUnloadHandler();
            this._inited = true;
        }

        /**
         * Трекинг ошибок и предупреждений консоли
         */
        initConsoleTracking() {
            const originalError = console.error;
            const originalWarn = console.warn;
            // const originalLog = console.log;

            console.error = (...args) => {
                this.trackEvent('console_error', {
                    message: this.stringifyArgs(args),
                    stack: this.getStackTrace(),
                    timestamp: this.getForamteDate()
                });
                originalError.apply(console, args);
            };

            console.warn = (...args) => {
                this.trackEvent('console_warn', {
                    message: this.stringifyArgs(args),
                    timestamp: this.getForamteDate()
                });
                originalWarn.apply(console, args);
            };

            // Отслеживание ошибок в окне браузера
            window.addEventListener("error", (event) => {
                this.trackEvent('runtime_error', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack || null,
                    timestamp: this.getForamteDate()
                });
            });

            // Отслеживание unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                this.trackEvent('unhandled_rejection', {
                    reason: String(event.reason),
                    promise: String(event.promise),
                    timestamp: this.getForamteDate()
                });
            });

            this.log('Console tracking initialized');
        }

        /**
         * Управление событиями
         */
        trackEvent(eventType, data = {}) {
            const newEvent = {
                event_type: eventType,

                timestamp: this.getForamteDate(),
                url: window.location.href,
                data: data
            };

            this._events.push(newEvent);

            if (this._events.length >= this.config.batchSize) {
                this.flushEvents();
            } else if (!this.batchTimer) {
                this.batchTimer = setTimeout(() => this.flushEvents(), this.config.batchTimeout);
            }

            this.log(`Event tracked: ${eventType}`, newEvent);
        }

        // Отслеживание кастомного события
        trackCustomEvent(eventName, properties = {}) {
            if (this._inited) {
                this.trackEvent(`custom_${eventName}`, properties);
            }
            else {
                this.log("LiveScript not initialized", properties, "error");
            }
        }

        flushEvents() {
            if (this._events.length === 0 || this._fetch) return;

            const batch = this._events.splice(
                0, 
                this.config.batchSize + 3
            );

            this.send(batch).catch(error => {
                this.log('Failed to send batch', error, 'error');

                // Возвращаем события в очередь при ошибке
                this._events.unshift(...batch);
                this._fetch = false;
            });

            // clearTimeout(this.batchTimer);
            // this.batchTimer = null;
        }

        // Отправка данных
        async send(batch) {
            this._fetch = true;

            if (this.config.apiOff) {
                this._fetch = false;
                console.log(this._name, `POST '${this.config.apiEndpoint}':`, {
                    logs: batch,
                    device_info: this.getDeviceInfo()
                });
                return;
            }
            try {
                const response = await fetch(this.config.apiEndpoint, {
                    method: 'POST',
                    mode: "cors",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        logs: batch,
                        device_info: this.getDeviceInfo()
                    }),
                    keepalive: true, // Важно для отправки при выходе
                });

                this._fetch = false;
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                this.log(`Sent ${batch.length} events`, null);
                // return response.json();
            } catch (error) {
                this._fetch = false;
                this.log('Send error', error, 'error');
                // throw error;
            }
        }

        sendDataSync() {
            if (this._events.length === 0 || this._fetch) return;
            if (this.config.apiOff) {
                console.log(this._name, `POST '${this.config.apiEndpoint}':`, {
                    logs: this._events,
                    device_info: this.getDeviceInfo()
                });
                this._events = [];
                this._fetch = false;
            }
            // Используем navigator.sendBeacon если доступна (не блокирует)
            else if (navigator.sendBeacon) {
                this._fetch = true;

                try {
                    const payload = JSON.stringify({
                        logs: this._events,
                        device_info: this.getDeviceInfo()
                    });
                    const blob = new Blob([payload], { type: "text/plain; charset=UTF-8" });

                    const sent = navigator.sendBeacon(this.config.apiEndpoint, blob);

                    if (sent) {
                        this.log(`Sent ${allEvents.length} events via sendBeacon`, null);
                        // Очищаем только если успешно отправили
                        this._events = [];
                        // this._failedBatches = [];
                    } else {
                        this.log('sendBeacon returned false - data may not be sent', null, 'warn');
                    }
                    this._fetch = false;

                } catch (err) {
                    this._fetch = false;
                    this.log('sendBeacon error:', err, 'warn');
                    this.flushEvents();
                }
            }
            else {
                this.flushEvents();
            }
        }

        // Гарантированная отправка
        setupUnloadHandler() {
            if ("visibilityState" in document) {
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "hidden") {
                        this.sendDataSync();
                    }
                });
            }
            window.addEventListener("pagehide", () => {
                this.sendDataSync();
            }, { capture: true });
        }

        getDeviceInfo() {
            return {
                appParam: this.getAppParam(),
                screen_resolution: `${screen.width}x${screen.height}`,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                device_pixel_ratio: window.devicePixelRatio,
                touch_support: this.hasTouchSupport(),
                user_agent: navigator.userAgent,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                // processor_cores: navigator.hardwareConcurrency || null,
                // device_memory_gb: navigator.deviceMemory || null
            };
        }

        getAppParam() {
            try {
                const appParam = (new URLSearchParams(window.location.search)).get("app") || null;
                const isApp = document.cookie.split('; ').find(row => row.startsWith("app_hide" + '='))?.split('=')[1] || null;
                return appParam === "true" || isApp === "true" ? "webview" : "web";
            }
            catch (_) {}
            return "web";
        }

        getForamteDate() {
            const now = new Date();
            const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const date = now.toLocaleDateString('ru-RU');
            return `${time}:${date}`;
        }

        hasTouchSupport() {
            return (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0));
        }

        stringifyArgs(args) {
            return args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
        }

        getStackTrace() {
            try {
                throw new Error();
            } catch (e) {
                return e.stack?.split('\n').slice(2, 5).join('\n') || null;
            }
        }

        log(message, data, level = "log") {
            if (this.config.debug) {
                console[level](`${this._name} ${message}`, data ?? "");
            }
        }

        // Остановка мониторинга
        destroy() {
            clearInterval(this.memoryInterval);
            this.flushEvents();
        }
    }

    const startFN = () => {
        window.liveScript = new LiveScript({
            apiEndpoint: "https://api.wizzu.ru/api/debug",
            debug: false,
            // apiOff: true,

            enableConsoleTracking: true,

            batchSize: 6,
            batchTimeout: 60 * 1000 // 1 минута
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startFN);
    } else {
        startFN();
    }
})();
