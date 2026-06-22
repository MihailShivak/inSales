/**
 * ! Нужно расширить ответы в /jls-gateway/search
 * !product:
 * - characteristics
 * - url товара 
 * - quantity
 * - флаг доступности товара (available)
 * - image (не везде он есть)
 * 
 * !product.variants[]:
 * - добавить old_price
 * - variant.quantity
 * 
 * !filters:
 * - для цветов нужна иконка цвета
 */

/**
 * ! Посмотреть и убрать / удалить
 * - Удалил классы цветов по типу _color-powder
 */

// ! Настроить применение фильтров, чтобы правильно загружалось
document.addEventListener("DOMContentLoaded", function() {
    var $catalog, $products, $catalogState, $panel;
    var filters, loaders = {}, query;
    var isFetching = false;
    var hasMorePages = false;

    function checkAvailable(variants) {
        if (!variants?.length) return false;

        for (const variant of variants) {
            if (Boolean(variant.available) && variant.quantity > 0) {
                return true;
            }
        }

        return false;
    }

    function drawProduct(products) {
        let html = "", i = 0;

        for (const product of products) {
            i++;
            html += Template.render({
                available: checkAvailable(product.variants),
                product: product,
                
                images: EM_Module.func.getImagesForCatalog(product.images.slice(0, 4), i),
                // urlNotAvailable: false,
                urlNotAvailable: window.EM_Module.func.extractSection(product.url),

                // isSoon: false,
                // ! Тут поле characteristics задано как properties
                isSoon: EM_Module.func.checkSoonCahrs(product.properties, "not"),

                // isPreorder: false,
                // ! Тут поле characteristics задано как properties
                isPreorder: EM_Module.func.checkPreorderChars(product.properties),

                isBadgeSale: false,
                // isBadgeSale: product.url.includes("/sale"),

                // !Переделать: подумать как сделать динамический размер фото
                // image: product.images.length > 0 && product.first_image.original_url,
                
                badgesHTML: "",
                // badgesHTML: EM_Module.Badges.getBadges(product),

                article: "", // sku
                wishlistAdded: EM_Module.Wishlist.hasProduct(product.product_id)
                // image: product.images.length > 0 && product.first_image.large_url,
            }, "product-item") ?? "";
        }
        return html;
    }

    // Запросить товары
    async function fetchSearch(formData) {
        isFetching = true;

        const response = await $.ajax({
            url: "https://insales.widgets.ibice.ru/api/jls-gateway/search",
            method: 'POST',
            // dataType: 'json',
            data: formData,
            processData: false,
            contentType: false,
            timeout: 10000
        }).fail((err) => {
            console.warn("[New.Catalog]", "Ошибка выполнения запроса:", err);
        });

        // filters.
        if (!response) {
            console.warn("[New.Catalog]", "Ошибка выполнения запроса:", response);
        }
        isFetching = false;
        return response;
    } 

    async function renderSearchProducts(clear = false) {
        // const products = await filters.getProducts();
        
        $catalogState.attr("hidden", true);
        $panel.addClass("_panel_disabled");

        if (clear) {
             hasMorePages = false;
            loaders.skeleton.show(filters.pageSize, true);
        }
        else {
            loaders.loader.visibleLoader();
            filters.visibleBtnMore(true, true);
        }
        const formData = filters.getSelectFilters();
        formData.append("flow_id", "62b2caa5-7874-40a9-b7f2-1b9561fe9e83");
        formData.append("query", query);

        const response = await fetchSearch(formData);

        $panel.removeClass("_panel_disabled");
        $catalog.find("[data-search-count]:first").text(response.summary);

        if (!response || !response?.products) {
            // ! Завршение
            if (clear) {
                loaders.skeleton.hide();
                $catalogState.text("Товары не найдены").removeAttr("hidden");
            } else {
                loaders.loader.visibleLoader(false);
            }
            hasMorePages = false;
            return;
        }

        const htmlProducts = drawProduct(response.products);

        console.log("[Search]", clear, filters, response, htmlProducts.length);
        if (clear) {
            loaders.skeleton.hide(htmlProducts.length > 0 ? htmlProducts : "");
            if (!htmlProducts.length) {
                $catalogState.text("Товары не найдены").removeAttr("hidden");
            }
        }
        else if (htmlProducts.length > 0) {
            $products.append(htmlProducts);
        }

        const canLoadMore = htmlProducts.length > 0 && response.products.length == filters.pageSize;

        hasMorePages = canLoadMore;
        filters.visibleBtnMore(canLoadMore, false);

        if (!clear) loaders.loader.visibleLoader(false);
        // if (htmlProducts.length > 0) EM_Module.Wishlist.forceUpdate();
    }

    function updateFilters(data) {
        // filter.options
        if (data.method == filters.typesEvent.init) {
            renderSearchProducts(true);
        }

        else if (data.method == filters.typesEvent.change) {
            // loaders.loader.visibleLoader();
            renderSearchProducts(filters.currentPage == 1);
        }
        
        else if (data.method == filters.typesEvent.clear) {
            renderSearchProducts(true);
        }
    }

    // Загрузка следующей страницы (дозагрузка товаров)
    function loadNextPage() {
        if (isFetching || !hasMorePages) return;

        filters.currentPage++;
        renderSearchProducts(false);
    }

    // Автозагрузка при достижении конца контейнера товаров
    function initInfiniteScroll() {
        const productsContainer = $products.get(0);
        if (!productsContainer) return;

        const sentinel = document.createElement("div");
        sentinel.setAttribute("aria-hidden", "true");
        productsContainer.after(sentinel);

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadNextPage();
            },
            { rootMargin: "0px 0px 300px 0px" }
        );

        observer.observe(sentinel);
    }

    function initSearch() {
        query = (new URLSearchParams(window.location.search)).get('q');

        $catalog = $("#search-catalog"), 
        $products = $catalog.find("[data-js='catalog-list']:first");
        $catalogState = $catalog.find(".catalog__error:first");
        $panel = $catalog.find("[data-filter-panel]:first");

        if (!query) {
            $panel.attr("hidden", true);
            return;
        }

        loaders.skeleton = new window.EM_Module.Loaders.Skeleton( $products );

        // Статичный лоадер
        loaders.loader = new window.EM_Module.Loaders.Loader( null, $catalog.find(".catalog__loader:first") );

        filters = new window.EM_Module.Filters();
        filters.init();

        EventBus.subscribe(filters.nameEvent, updateFilters);
        initInfiniteScroll();
    }

    initSearch();
    // EventBus.subscribe
});