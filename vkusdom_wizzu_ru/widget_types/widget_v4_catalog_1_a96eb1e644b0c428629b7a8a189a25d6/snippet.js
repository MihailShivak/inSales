(function() {
    class ProductLoader {
        constructor(options = {}) {
            this.pageSize = this.getPageSize();
            this.loadMultiplier = options.loadMultiplier || 2;
            this.maxAttempts = options.maxAttempts || 3;
            this.baseLoadLimit = this.pageSize * this.loadMultiplier;
            
            // Максимальный размер кэша (кол-во элементов в массиве)
            this.maxCachePages = options.maxCachePages || 2;
            this.maxCacheSize = this.pageSize * this.maxCachePages;

            this.currentPage = 1;
            this.cachedFilteredItems = [];
            this.cachePosition = 0;
            this.cacheStartOffset = 0; // Смещение начала кэша относительно общего списка товаров
            this.isExhausted = false;
            this.isLoading = false;
            this.loadHistory = [];

            this.minQuantity = 3; // Минимальный остаток товара

            this.isSearch = window.location.pathname.includes("/search");
            this.fetchFn = this.isSearch ? this.fetchSearch : this.fetchCatalog;

            if (this.isSearch) {
                const params = new URLSearchParams(window.location.search);
                this.query = params.get("q")
            }
        }

        getPageSize() {
            return window.matchMedia('(max-width: 480px)').matches ? 10 :
                window.matchMedia('(max-width: 760px)').matches ? 9 : 
                    window.matchMedia('(max-width: 1150px)').matches ? 12 : 10;
        }

        async getPageItems(pageNumber = 1) {
            if (this.isLoading) return [];
            this.isLoading = true;
            this.currentPage = pageNumber;

            try {
                const absoluteStartIndex = (pageNumber - 1) * this.pageSize;
                const absoluteEndIndex = absoluteStartIndex + this.pageSize;
                
                // Вычисляем относительные индексы в кэше
                let relativeStartIndex = absoluteStartIndex - this.cacheStartOffset;
                let relativeEndIndex = absoluteEndIndex - this.cacheStartOffset;

                // Если нужные товары выходят за пределы кэша, очищаем кэш и начинаем с нужной позиции
                if (relativeStartIndex < 0 || relativeStartIndex >= this.cachedFilteredItems.length) {
                    // Вычисляем backend-страницу для нужной позиции
                    const backendPageForStart = Math.floor(absoluteStartIndex / this.baseLoadLimit);
                    const newCachePosition = backendPageForStart * this.baseLoadLimit;
                    
                    this.clearCache();
                    this.cacheStartOffset = absoluteStartIndex;
                    this.cachePosition = newCachePosition;
                    this.isExhausted = false; // Сбрасываем флаг, так как начинаем заново
                    
                    // Пересчитываем относительные индексы после очистки
                    relativeStartIndex = absoluteStartIndex - this.cacheStartOffset;
                    relativeEndIndex = absoluteEndIndex - this.cacheStartOffset;
                }

                // Проверяем, есть ли нужные товары в кэше (после возможной очистки)
                if (relativeStartIndex >= 0 && relativeEndIndex <= this.cachedFilteredItems.length) {
                    return this.cachedFilteredItems.slice(relativeStartIndex, relativeEndIndex);
                }

                await this.fillCache(relativeEndIndex);
                this.trimCache(); // Ограничиваем размер кэша
                
                // Пересчитываем индексы после возможной обрезки кэша
                relativeStartIndex = absoluteStartIndex - this.cacheStartOffset;
                relativeEndIndex = absoluteEndIndex - this.cacheStartOffset;
                
                const result = this.cachedFilteredItems.slice(
                    Math.max(0, relativeStartIndex), 
                    Math.min(relativeEndIndex, this.cachedFilteredItems.length)
                );

                return result;

            } finally {
                this.isLoading = false;
            }
        }

        async fillCache(requiredRelativeLength) {
            let attempts = 0;

            while (
                this.cachedFilteredItems.length < requiredRelativeLength &&
                attempts < this.maxAttempts &&
                !this.isExhausted
            ) {
                attempts++;

                try {
                    // Вычисляем backend-страницу для текущей позиции
                    const backendPage = Math.floor(this.cachePosition / this.baseLoadLimit) + 1;
                    
                    const batch = await this.loadBatch(
                        this.cachePosition,
                        this.baseLoadLimit
                    );

                    if (!batch || batch.length === 0) {
                        this.isExhausted = true;
                        break;
                    }

                    const filteredBatch = this.applyFilters(batch);
                    
                    // Проверяем, нет ли дубликатов в кэше (по product.id)
                    const existingIds = new Set(this.cachedFilteredItems.map(item => item.id));
                    const newItems = filteredBatch.filter(item => !existingIds.has(item.id));
                    
                    this.cachedFilteredItems.push(...newItems);
                    this.loadHistory.push({
                        timestamp: Date.now(),
                        offset: this.cachePosition,
                        backendPage: backendPage,
                        loaded: batch.length,
                        filtered: newItems.length
                    });

                    this.cachePosition += this.baseLoadLimit;
                    this.adaptLoadMultiplier(batch.length, filteredBatch.length);

                } catch (error) {
                    addLog(`Ошибка: ${error.message}`, 'error');
                    this.isExhausted = true;
                    break;
                }
            }
        }

        trimCache() {
            // Если кэш превышает максимальный размер, удаляем старые элементы с начала
            if (this.cachedFilteredItems.length > this.maxCacheSize) {
                const itemsToRemove = this.cachedFilteredItems.length - this.maxCacheSize;

                this.cachedFilteredItems.splice(0, itemsToRemove);
                this.cacheStartOffset += itemsToRemove;

                // Не меняем this.cachePosition, чтобы не перезапрашивать уже загруженные страницы
                // и не зацикливаться на одних и тех же товарах при подгрузке.
                // this.cachePosition = Math.floor(this.cacheStartOffset / this.baseLoadLimit) * this.baseLoadLimit;
            }
        }

        async loadBatch(offset, limit) {
            const pageNumber = Math.floor(offset / limit) + 1;

            return await this.fetchFn({
                order: this.isSearch ? "" : ($(".js-sorting-trigger-radio:checked:first").val() || ""),
                page_size: limit,
                page: pageNumber
            });
        }

        applyFilters(items) {
            return items.filter(item => {
                const variant = item.variants[0];
                
                return variant?.quantity && variant.quantity >= this.minQuantity;
            });
        }

        adaptLoadMultiplier(loadedCount, filteredCount) {
            if (loadedCount === 0) return;
            const filterRate = (loadedCount - filteredCount) / loadedCount;

            if (filterRate > 0.7) {
                this.loadMultiplier = Math.min(4, this.loadMultiplier + 0.5);
            } else if (filterRate < 0.2 && this.loadMultiplier > 1.5) {
                this.loadMultiplier = Math.max(1.5, this.loadMultiplier - 0.3);
            }
        }

        setFilters() {
            this.clearCache();
        }

        setPageSize(newPageSize) {
            if (this.pageSize !== newPageSize) {
                this.pageSize = newPageSize;
                this.maxCacheSize = this.pageSize * this.maxCachePages;
                this.clearCache();
            }
        }

        clearCache() {
            this.cachedFilteredItems = [];
            this.cachePosition = 0;
            this.cacheStartOffset = 0;
            this.isExhausted = false;
            // this.currentPage = 1;
            this.loadHistory = [];
        }

        isLastPage() {
            const absoluteStartIndex = (this.currentPage - 1) * this.pageSize;
            const relativeStartIndex = absoluteStartIndex - this.cacheStartOffset;
            const visibleCount = Math.max(0, this.cachedFilteredItems.length - relativeStartIndex);
            return (visibleCount < this.pageSize) && this.isExhausted;
        }

        getStatus() {
            return {
                currentPage: this.currentPage,
                pageSize: this.pageSize,
                totalInCache: this.cachedFilteredItems.length,
                cacheStartOffset: this.cacheStartOffset,
                maxCacheSize: this.maxCacheSize,
                loadMultiplier: this.loadMultiplier.toFixed(2),
                loadAttempts: this.loadHistory.length
            };
        }

        async fetchSearch(data) {
            try {
                const response = await fetch(
                    `/search.json?q=${this.query}&page_size=${data.page_size}&page=${data.page}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json;charset=utf-8'
                    }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();

            } catch (error) {
                console.error('[Search.FetchError]', error);
                throw error;
            }
        }

        async fetchCatalog(data) {
            try {
                const response = await fetch(`${window.location.pathname}.json`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;charset=utf-8'
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return (await response.json())?.products;

            } catch (error) {
                console.error('[Catalog.FetchError]', error);
                throw error;
            }
        }
    }

    const 
        windowHeight = (window.innerHeight || document.documentElement.clientHeight) + 100,
        isSearch = window.location.pathname.includes("/search");
    
    const
        $catalog = $widget,
        $products = $catalog.find("[data-collection-infinity]:first"),
        $btnMore = $(".infinity-products-controls:first .infinity-products-controls__btn:first");

    // UI Logic
    var productLoader;
    var metrics = { totalLoads: 0, cacheHits: 0, totalLoadTime: 0 };

    async function initLoader() {
        productLoader = new ProductLoader();

        await loadPage(1);

        // Обработчики событий
        $btnMore.on("click", nextPage);
        if (window.location.pathname.includes("/favorites")) {
            EventBus.subscribe('remove_item:insales:favorites_products', (data) => {
                if (data.products.length == 0) {
                    $catalog.find('.empty-catalog-message:first').removeClass('hidden');
                    $catalog.find('.catalog:first').attr('hidden', true);
                }
            });
        }
        else if (!productLoader.isSearch) {
            // Сброс при изменении сортировки
            $(".collection-sort:first .js-sorting-trigger-radio").on("change", clearFilters);
        }
    }

    async function loadPage(pageNumber, isReset) {
        if (productLoader.isLoading) return;
        
        if (isReset) {
            $products.html("");
        }
        $btnMore.addClass("is-loading").prop("disabled", true);

        const start = performance.now();
        const cacheSize = productLoader.cachedFilteredItems.length;
        const previousPage = productLoader.currentPage;

        const products = await productLoader.getPageItems(pageNumber);

        const end = performance.now();
        const loadTime = end - start;

        metrics.totalLoads++;
        metrics.totalLoadTime += loadTime;

        if (cacheSize === productLoader.cachedFilteredItems.length) {
            metrics.cacheHits++;
        }

        if (pageNumber === 1 || (previousPage > pageNumber)) {
            $products.html("");
        }
        
        renderProducts(products);
        $btnMore
            .attr("hidden", productLoader.isLastPage() || productLoader.isExhausted)
            .removeClass("is-loading");
    }

    function renderProducts(products) {
        if (products.length === 0) {
            if ($products.find(".product-item:first").length === 0) {
                // $products.html("Товаров пока нет");
                $btnMore.attr("hidden", true).removeClass("is-loading");
            }
            return;
        }
        
        let html = "";
        let skippedDuplicates = 0;

        for (const product of products) {
            const variant = product.variants[0];
            
            console.log('snippet.js widget_v4_catalog_1_a96');
            console.log('[widget_v4_catalog_1_a96] Товар:', product.title);
            console.log('[widget_v4_catalog_1_a96]  variant.old_price:', variant?.old_price);
            console.log('[widget_v4_catalog_1_a96]  product.old_price:', product.old_price);
            console.log('[widget_v4_catalog_1_a96]  price_min:', product.price_min);
            console.log('snippet.js widget_v4_catalog_1_a96');

            // Проверяем, не добавлен ли уже товар с таким ID в DOM
            // Это предотвращает дублирование при повторных вызовах
            const productSelector = `[data-product-id="${product.id}"]`;
            if ($products.find(productSelector).length > 0) {
                skippedDuplicates++;
                continue;
            }
            
            const
                price = Number(variant?.price ?? product.price_min),
                old_price = Number(variant?.old_price ?? 0),
                isOld = old_price && price < old_price,
                order = Cart.order.getItemByID(variant.id),
                gram = EM_Module.props.getCharacteristicGram(product.characteristics);

            html += Template.render({
                avialable: variant !== undefined,
                product_id: product.id,
                variant_id: variant.id,
                url: product.url,
                title: product.title,
                descript: product.short_description ? product.short_description.slice(0, 120) : "",
                image: product.first_image.large_url.replace('static.insales-cdn.com', 'ibicecdn.com/wizzu'),
                
                maxQuantity: EM_Module.props.getMaxQuantity(product),
                package: gram && gram < 11 
                    ? (1 / gram).toFixed(1).replace(/\.0$/, '') 
                    : EM_Module.props.getCharacteristic(product),
                unit: EM_Module.props.getCharacteristic(product, "unit"),
                quantity: order ? order.quantity : 0,
                gram: gram && gram < 11 ? gram : 0,

                priceNotFormat: price,
                price: Shop.money.format(price),
                // old_price: isOld ? product.old_price : 0,
                old_price: isOld ? old_price : 0,
                deltPrice: isOld ? Math.floor((1 - price / old_price) * 100) : "",
                isInCart: order !== undefined
            }, "product-viewed");
        }

        if (html.length > 0) {
            $products.append(html);
            FavoritesProducts.update();
            
            // if (skippedDuplicates > 0) {
            //     addLog(`⚠️ Пропущено ${skippedDuplicates} дубликатов товаров`, 'warning');
            // }
        }
    }

    function applyFilters() {
        productLoader.setFilters();

        loadPage(1);
    }

    function clearFilters() {
        productLoader.clearCache();
        loadPage(1, true);
    }

    async function nextPage() {
        if (!productLoader.isLastPage()) {
            await loadPage(productLoader.currentPage + 1);
            // window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    async function previousPage() {
        if (productLoader.currentPage > 1) {
            await loadPage(productLoader.currentPage - 1);
            // window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**Изменение page size
    document.getElementById('pageSize').addEventListener('change', (e) => {
        loader.setPageSize(parseInt(e.target.value));
        addLog(`Размер страницы: ${e.target.value}`, 'info');
        loadPage(1);
    });
    */

    function addLog(message, type = 'info') {
        console.log(`[${new Date().toLocaleTimeString()}][${type}] ${message}`);
    }

    // Для throttling scroll событий
    function throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    // Throttled scroll handler для автоподгрузки
    const handleScroll = throttle(() => {
        // Убрал !state.isCompleted 
        if (productLoader.currentPage != 0 && !productLoader.isExhausted && !productLoader.isLoading && $products.is(":visible")) {
            const rect = $products.get(0).getBoundingClientRect();
            // if (rect.bottom <= window.innerHeight + 200) {
            if (rect.bottom <= windowHeight) {
                // console.log("[Catalog.AutoLoad]", "Triggered by scroll");
                nextPage();
            }
        }
    }, 150);
    
    // Инициализация
    if ($products.length > 0) {
        initLoader();
        setTimeout(
            () => window.addEventListener('scroll', handleScroll, { passive: true }), 
            300
        );
    }
})();