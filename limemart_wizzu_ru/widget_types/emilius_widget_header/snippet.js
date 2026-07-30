document.addEventListener("DOMContentLoaded", function() {
    const MIN_QUANTITY = 2;         // Минимальный остаток товара
    const isMobile = sessionStorage.getItem('isMobile') === "true";

    var $header = $widget,
        loader = {};
    let popupSearch = new EM_Module.Modal(
        document.getElementById("popup-search")
    );
    const 
        $notFound = $header.find(".search__not-found:first"),
        $products = $header.find("[data-em-products-list]:first"),
        $collcetions = $header.find("[data-em-collcetions-list]:first");

    let searchState = {
        query: "",
        page: 1,
        isLoadingMore: false
    };

    function getPageSize() {
        return window.matchMedia("(min-width: 561px)").matches ? 9 : 10;
    }

    function renderProductHtml(products) {
        let html = "";

        for (const product of products) {
            if (product.variants.length == 0 || product.variants[0].quantity < MIN_QUANTITY) continue;
            const 
                price = Number(product.price_min),
                old_price = Number(product.variants[0].old_price),
                isOld = old_price && price < old_price,
                order = Cart.order.getItemByID(product.variants[0].id),
                gram = EM_Module.props.getCharacteristicGram(product.characteristics);

            html += Template.render({
                avialable: true,
                product_id: product.id,
                variant_id : product.variants[0].id,
                url: product.url,
                title: product.title,
                descript: product.short_description ?? "",
                image: product.first_image.large_url,

                // maxQuantity: EM_Module.props.getMaxQuantityProp(product),
                maxQuantity: EM_Module.props.getMaxQuantity(product),
                // package: EM_Module.props.getCharacteristic(product),
                package: gram && gram < 11 
                    ? (1 / gram).toFixed(1).replace(/\.0$/, '') 
                    : EM_Module.props.getCharacteristic(product),

                unit: window.matchMedia("(max-width: 760px)").matches ? EM_Module.props.getCharacteristic(product, "unit") : "",
                quantity: order ? order.quantity : 0,
                gram: gram && gram < 11 ? gram : 0,

                priceNotFormat: price,
                price: Shop.money.format(price),
                // old_price: isOld ? Shop.money.format(old_price) : "",
                old_price: isOld ? old_price : 0,
                deltPrice: isOld ? Math.floor((1 - price / old_price) * 100) : "",
                isInCart: order !== undefined
            }, "product-viewed");
        }

        return html;
    }

    function buildFooterHtml(searchQuery, showLoadMore) {
        // const encodedQ = encodeURIComponent(searchQuery || "");
        let footer = "";

        if (showLoadMore) {
            footer += `<div class="search__btn-more">
                <button type="button" class="search__btn-more__btn btn" data-btn-load-more>Загрузить еще</button>
            </div>`;
        }

        // footer += `<a href="/search?q=${encodedQ}&lang=ru" class="product-item swiper-slide product-item__more">
        //     <div>Смотреть все товары</div>
        // </a>`;

        return footer;
    }

    function drawSearch(products, options) {
        const { searchQuery, append } = options || {};

        const productHtml = renderProductHtml(products);
        const showLoadMore = products.length === getPageSize();
        const footerHtml = buildFooterHtml(searchQuery, showLoadMore);

        if (append) {
            $products.find(".search__btn-more, a.product-item__more[href*='/search']").remove();
            $products.append(productHtml + footerHtml);
        } else {
            if (productHtml.length) {
                $products.html(productHtml + footerHtml);
                $products.removeAttr("hidden");
                $collcetions.attr("hidden", true);
                $notFound.attr("hidden", true);
            } else {
                $products.attr("hidden", true);    
                $collcetions.removeAttr("hidden");    
                $notFound.removeAttr("hidden");
            }
        }

        if (productHtml.length && showLoadMore) {
            $products.find("[data-btn-load-more]:last").on("click", onLoadMoreClick);
        }

        loader.hide();
    }

    function onLoadMoreClick() {
        if (searchState.isLoadingMore) return;
        searchState.isLoadingMore = true;
        searchState.page += 1;
        loader.call();

        $.get('/search.json', {
            q: searchState.query,
            page_size: getPageSize(),
            page: searchState.page
        }, function(products) {
            drawSearch(products, { searchQuery: searchState.query, append: true });
        }).fail(function() {
            searchState.page -= 1;
            loader.hide();
            console.warn('[Search] Ошибка загрузки');
        }).always(function() {
            searchState.isLoadingMore = false;
        });
    }

    function inputSearch() {
        this.preventDefault(); 
        const search = String(this.target.value || "").trim();

        if (!search.length) {
            searchState.query = "";
            searchState.page = 1;
            $products.attr("hidden", true);    
            $collcetions.removeAttr("hidden");  
            return;
        }

        // [Edit] Переадресация на страницу поиска
        window.location.href = "/search?q=" + search;
        return;

        const isNewSearch = search !== searchState.query;
        if (isNewSearch) {
            searchState.query = search;
            searchState.page = 1;
            $products.empty();
        }

        loader.call();

        $.get('/search.json', {
            q: search,
            page_size: getPageSize(),
            page: searchState.page
        }, function(products) {
            drawSearch(products, { searchQuery: search, append: false });
        }).fail(function() {
            loader.hide();
            console.warn('[Search] Ошибка поиска');
            $products.attr("hidden", true);    
            $collcetions.removeAttr("hidden");
            $notFound.removeAttr("hidden");
        });
    }

    popupSearch.init();
    (new EM_Module.Modal(
        document.getElementById("popup-message")
    )).init();

    const isNotApp = 
        Cookies.get("app_hide") !== "true" && 
        (new URLSearchParams(window.location.search)).get("app") !== "true";

    if (isMobile && isNotApp) {
        var $headerFixed = $header.find("[data-em-header-fix]:first"),
            isTop = true;

        document.addEventListener("scroll", function() {
            if (isTop && window.pageYOffset > 150) {
                $headerFixed.addClass("_active");
                isTop = false;
            }
            else if (window.pageYOffset < 150 && !isTop) {
                $headerFixed.removeClass("_active");
                isTop = true;
            }
        });
        // if (window.location.pathname != "/" && window.history.length > 2) {
        //     const $bar__actions = $header.find(".tap-bar__actions:first");
        //     $bar__actions.find(".tap-bar__btn-home:first").attr("hidden", true);
        //     $bar__actions.find(".tap-bar__btn-back:first").removeAttr("hidden");
        // }
    }
    
    if (isMobile) {
        $header.find("[data-btn-clear-input]:first").on("click", function() {
            const input = this.closest("[data-js-search]")?.querySelector("input")

            if (input && input.value.length > 0) {
                input.value = "";
                searchState.query = "";
                searchState.page = 1;

                $products.attr("hidden", true);
                $notFound.attr("hidden", true);
                $collcetions.removeAttr("hidden");
            }
        });
    }

    if (location.pathname.includes("/orders/") || location.pathname.includes("/client_account/orders")) {
        const phone = ($header.find("[data-em-link]:first").attr("data-em-link") ?? "").replaceAll("tel", "").replaceAll("+", "").replaceAll(":", "");
        const orderId = $header.find("[data-em-id-order]:first").attr("data-em-id-order");

        if (phone && phone.length == 11) {
            $("[data-em-order-inform]").attr("href", 
                `https://wa.me/${phone}?text=Здравствуйте! У меня вопрос по заказу ${orderId ? `#${orderId}` : ""}`
            );
        }
    }

    EventBus.subscribe('em_module-init', function () {
        loader = new EM_Module.Loader($header.find(".search__body:first"));
    });

    var timerId;
    function setupSearchInput(inputEl) {
        if (!inputEl) return;
        inputEl.addEventListener("input", function(e) {
            if (timerId) {
                clearTimeout(timerId);
            }
            timerId = setTimeout(inputSearch.bind(e), 650);
        });
    }
    setupSearchInput(document.querySelector("[data-search-input]"));
    setupSearchInput(document.querySelector("[data-mob-search-input]"));
});

/**
 * Уведомление об активном заказке
 */
(function() {
    var saveOrder = {};

    if (typeof(Storage) === 'undefined' || !window.localStorage) return;

    // !window.location.pathname.includes("/orders/") && !localStorage.getItem("save-order")

    // Получение активного заказа из памяти
    function readingOrder() {
        try {
            const currentOrder = localStorage.getItem("save-order");
            if (currentOrder) {
                saveOrder = JSON.parse(currentOrder);
            }
        } catch (err) {
            console.error("[EM.SaveOrder] Ошибка парсинга данных о заказе", err);
        }
    }

    // Сохранить информацию о заказе
    async function saveOrderData() {
        const $title = $("[data-order-number]:first");

        const orderNumber = Number($title.attr("data-order-number") ?? 0);
        const orderStatus = $title.attr("data-order-status") ?? "";

        if (!orderNumber || isNaN(orderNumber) || saveOrder?.status === "Отменен") {
            localStorage.removeItem("save-order");
            return;
        }
        if (
            saveOrder?.number !== undefined 
            && saveOrder.number == orderNumber 
            && saveOrder.status == orderStatus
        ) return;

        // localStorage.removeItem("save-order_open");
        localStorage.setItem("save-order", JSON.stringify({
            number: orderNumber,
            status: orderStatus,
            clientID: await getClientID(),
            link: window.location.href
        }));
    }

    function resetSaveOrder() {
        localStorage.removeItem("save-order");
        // localStorage.removeItem("save-order_open");
    }

    async function getClientID() {
        let client;
        try {
            client = await ajaxAPI.shop.client.get();
        }
        catch (_) {}

        if (client?.id !== undefined) return client.id;

        try {
            const _ym_uid = Number(localStorage.getItem("_ym_uid").replaceAll('"', ""));
            return !_ym_uid || isNaN(_ym_uid) ? 0 : _ym_uid;
        }
        catch (_) {
            return 0;
        }
    }

    async function openModalNotice() {
        const clientID = await getClientID();

        if (clientID !== saveOrder.clientID || saveOrder.status == "Отменен") {
            resetSaveOrder();
            return;
        }

        const $modalOrder = $("#modal-order");

        $modalOrder.find(".modal__order-head:first").attr("href", saveOrder.link);
        $modalOrder.find(".modal__order-text:first").text(`Заказ №${saveOrder.number}`);

        // $modalOrder.on("click", () => {
        //     localStorage.setItem("save-order_open", false);
        // });

        $modalOrder.fadeIn(300);
    }

    readingOrder();

    if (window.location.pathname.includes("/orders/")) {
        saveOrderData();
    }
    else if (window.location.pathname.includes("/client_account/")) {
        $(".item__info-exit:first").on("click", resetSaveOrder);
    }
    else if (window.location.pathname == "/" && saveOrder?.number !== undefined) {
        openModalNotice();
    }
}());