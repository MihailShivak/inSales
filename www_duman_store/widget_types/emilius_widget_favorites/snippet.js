document.addEventListener("DOMContentLoaded", function() {
    const 
        $catalog = $("#wishlist-catalog"),
        $products = $catalog.find("[data-js='catalog-list']:first"),
        $catalogState = $catalog.find(".catalog__error:first"),
        $panel = $catalog.find("[data-filter-panel]:first");;

    var filters,
        loaders = {},
        isFetching = false,
        hasMorePages = false;

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
                wishlistAdded: true
                // image: product.images.length > 0 && product.first_image.large_url,
            }, "product-item") ?? "";
        }
        return html;
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

        const response = await EM_Module.Wishlist.get(filters.getSelectFilters());

        $panel.removeClass("_panel_disabled");
        
        if (!response || !response?.wishlist) {
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

        const htmlProducts = drawProduct(response.wishlist);

        console.log("[Wishlist]", clear, filters, response, htmlProducts.length);
        if (clear) {
            loaders.skeleton.hide(htmlProducts.length > 0 ? htmlProducts : "");
            if (!htmlProducts.length) {
                $catalogState.text("Вишлист пуст").removeAttr("hidden");
            }
        }
        else if (htmlProducts.length > 0) {
            $products.append(htmlProducts);
        }

        const canLoadMore = htmlProducts.length > 0 && response.wishlist.length == filters.pageSize;

        hasMorePages = canLoadMore;
        filters.visibleBtnMore(canLoadMore, false);

        if (!clear) loaders.loader.visibleLoader(false);
        // if (htmlProducts.length > 0) EM_Module.Wishlist.forceUpdate();
    }

    function updateFilters(data) {
        if (data.method == filters.typesEvent.init || data.method == filters.typesEvent.clear) {
            renderSearchProducts(true);
        }

        else if (data.method == filters.typesEvent.change) {
            renderSearchProducts(filters.currentPage == 1);
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

    function initWishlist() {
        loaders.skeleton = new window.EM_Module.Loaders.Skeleton($products);
        loaders.loader = new window.EM_Module.Loaders.Loader(
            null, 
            $catalog.find(".catalog__loader:first")
        );

        filters = new window.EM_Module.Filters({
            pageSize: 16
        });
        filters.init();

        // EM_Module.Wishlist.forceUpdate();
        // EM_Module.Badges.renderBadgesInHTML($products);

        EventBus.subscribe(filters.nameEvent, updateFilters);

        initInfiniteScroll();
    }

    // Отрисовка вишлиста
    if (window.EM_Module?.Loaders !== undefined) initWishlist();
    else EventBus.subscribe("eventLoader", initWishlist);
});