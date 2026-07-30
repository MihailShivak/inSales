// Поиск, нижняя панель в моб. версии
$(document).ready(() => {
    const isMobile = sessionStorage.getItem("isMobile") === "true";
    const prefix = isMobile ? "last" : "first";

    const className = {
        btnClear: isMobile ? "mob-popup__form-clear" : "submit__clear",
    };
    const sampleMenu = isMobile
        ? (url, title, isHref = false) => {
            return `<div class="mob-popup__list-item"><a href="${isHref ? url : `/search?q=${url}`}" class="mob-popup__list-link mob-popup__list-link_recently">${title}</a></div>`;
        }
        : (url, title, isHref = false) => {
            return `<li class="header-search__list-item"><a href="${isHref ? url : `/search?q=${url}`}" class="header-search__list-link header-search__list-link_recently">${title}</a></li>`;
        };

    var $header = $widget;
    var $error = $header.find("[data-search-error]:" + prefix),
        $history = $header.find("[data-search-history]:" + prefix),
        $often = $header.find("[data-search-often]:" + prefix),
        $result = $header.find("[data-search-result]:" + prefix);
    var loader = {};

    var history = {
        search: [],
        get: () => {
            history.search = JSON.parse(
                sessionStorage.getItem("historySearch") ?? "[]",
            );
            return history.search;
        },
        set: (item) => {
            const search = history.search;
            if (!item || search.includes(item)) return;

            search.unshift(item);
            if (search.length > 8) search.pop();
            sessionStorage.setItem("historySearch", JSON.stringify(search));
        },
        show: () => {
            history.visibility(!history.search.length);
        },
        visibility: (falg = false) => {
            $history.attr("hidden", falg);
        },
        draw: () => {
            let html = "";
            for (const search of history.search) {
                html += sampleMenu(search, search);
            }
            $history.find("[data-history-list]").html(html);
            history.visibility(!html.length);
        },
    };

    function message(m) {
        console.warn("[Header]", m);
    }

    function clearSearch() {
        history.draw();
        $often.attr("hidden", false);
        $result.attr("hidden", true);
        $header.find("." + className.btnClear).attr("hidden", true);
        messageError(true);
    }

    function messageError(flag = false) {
        $error.attr("hidden", flag);
        if (!flag) {
            $header
                .find(
                    isMobile
                        ? '[data-mob-popup="search"] .mob-popup__list-wrapper'
                        : ".header-search__group" + ":not([data-search-error])",
                )
                .attr("hidden", true);
        }
    }

    // Поиск через API insales
    async function getRequestOld(search) {
        if (!search.length) {
            clearSearch();
            return;
        }
        loader.call();
        $header.find("." + className.btnClear).attr("hidden", false);
        const products = await $.get("/search.json", {
            q: search,
            page_size: 10,
        });

        $header.find(".header-search__form:first, .mob-popup__form:first").attr({
            // "hidden": false,
            action: "/search?q=" + search,
        });

        console.log("[Header] Result:", products?.length);
        history.set(search);

        let html = "";
        if (!products?.length) {
            message("Error search " + search);
            messageError();
            loader.hide();
            return;
        }

        for (const product of products) {
            html += sampleMenu(product.url, product.title, true);
        }
        $often.attr("hidden", true);

        if (!html.length) messageError();
        else {
            history.visibility(true);
            $result.attr("hidden", false);
            $result.find("[data-history-list]").html(html);
            messageError(true);
        }
        loader.hide();
    }

    // Поиск через нашу API
    async function getRequestNew(search) {
        if (!search.length) {
            clearSearch();
            return;
        }
        loader.call();
        $header.find("." + className.btnClear).attr("hidden", false);

        var formData = new FormData();
        formData.append("flow_id", "62b2caa5-7874-40a9-b7f2-1b9561fe9e83");
        formData.append("query", search);

        const response = await $.ajax({
            url: "https://insales.widgets.ibice.ru/api/jls-gateway/search",
            method: "POST",
            processData: false,
            contentType: false,
            data: formData,
            timeout: 5000,
        }).catch(() => {
            console.warn("[Поиск] Ошибка поискового запроса /jls-gateway/search");
        });
        const products = response?.product;
        // $header.find(`[data-submit-search]:${isMobile ? "last" : "first"}`).attr({

        $header.find(".header-search__form:first, .mob-popup__form:first").attr({
            // "hidden": false,
            action: "/search?q=" + search,
        });

        console.log("[Header] Result:", products?.length);
        history.set(search);

        let html = "";
        if (!response || !products?.length) {
            // message("Error search " + search);
            // messageError();
            // loader.hide();
            // Переключение на ins поиск
            getRequestOld(search);
            return;
        }

        for (const product of products) {
            html += sampleMenu(product.url, product.title, true);
        }
        $often.attr("hidden", true);

        if (!html.length) messageError();
        else {
            history.visibility(true);
            $result.attr("hidden", false);
            $result.find("[data-history-list]").html(html);
            messageError(true);
        }
        loader.hide();
    }

    function inputSearchText() {
        const time = new Date().getTime(),
            delay = 700;
        var self = $(this);

        if (window.matchMedia("(min-width: 63.9988em)").matches) {
            if (this.value) {
                this.style["border-left"] = "none";
            } else {
                this.style.removeProperty("border-left");
            }
        }

        self.attr({ keyup: time });
        self.off("keydown");
        self.off("keypress");
        self.on("keydown", function () {
            $(this).attr({ keyup: time });
        });
        self.on("keypress", function () {
            $(this).attr({ keyup: time });
        });

        setTimeout(function () {
            oldtime = parseFloat(self.attr("keyup"));
            if (
                (oldtime <= new Date().getTime() - delay) &
                (oldtime > 0) &
                (self.attr("keyup") != "") &
                (typeof self.attr("keyup") !== "undefined")
            ) {
                // Заменил поиск
                getRequestNew(self.val());
            }
        }, delay);
    }

    function actionToBar() {
        const pathname = window.location.pathname;
        const $tabItems = $header.find(".tap-bar__actions-item");
        for (let tabbar of $tabItems) {
            const dataPath = tabbar.dataset.pathname;
            if (
                pathname === dataPath ||
                (pathname.includes("/client_account/") && dataPath == "/login") ||
                (dataPath == "/collection" &&
                    (pathname.includes("/product/") || pathname.includes("/collection/")))
            ) {
                tabbar.classList.add("_active");
                break;
            }
        }
    }
    console.log("[Header.Mob] run...");
    EventBus.subscribe("eventLoader", function () {
        loader = new EM_Module.Loader(
            $header.find(
                isMobile
                    ? "[data-mob-popup='search'] .mob-popup__title:first"
                    : ".header-search__grid:first",
            ),
        );
    });
    history.get();
    history.draw();

    $header
        .find(
            "input." +
            (isMobile ? "mob-popup__form-input" : "header-search__form-input"),
        )
        .keyup(inputSearchText);
    $header.find("." + className.btnClear).on("click", function () {
        $header
            .find(
                "input." +
                (isMobile ? "mob-popup__form-input" : "header-search__form-input"),
            )
            .val("");
        clearSearch();
    });
    if (isMobile) {
        $header.find("[data-mob-popup-open='search']").on("click", function () {
            setTimeout(() => {
                $header.find("input.mob-popup__form-input").trigger("focus");
            }, 250);
        });
    } else {
        $header.find("[data-js-sub-btn='search']").on("click", function () {
            setTimeout(() => {
                $header.find("input.header-search__form-input").trigger("focus");
            }, 250);
        });
    }
    actionToBar();

    if (isMobile) {
        const path = window.location.pathname;

        // $header.find("[data-pathname='/login']:first").attr({
        //     "data-popup": "#popup-account-nav"
        // });

        $header.find(".popup__account-nav__title").each(function () {
            if (this.pathname == path) {
                this.classList.add("_active");
                return false;
            }
        });
    }
});

// Вывод сообщений
(() => {
    const isProduct = window.location.pathname.includes("/product/"),
        $cartItemCount = $widget.find("[data-em-cart-count]");

    var loader = {},
        // $notice = $("[data-popup-notice]:first");
        $notice = isProduct
            ? $("[data-notice-product]:first")
            : $("[data-popup-notice]:first");

    function noticeAddInCart(data) {
        console.log(
            "[Header][DEBUG] noticeAddInCart вызван. Флаг __bocOrderInProgress =",
            window.__bocOrderInProgress,
        );

        if (window.__bocOrderInProgress) {
            console.log(
                "[Header][DEBUG] Флаг BOC активен — уведомление НЕ показываем.",
            );
            return;
        }

        if (!$notice.length) return;

        let title = "";
        for (const items of data.action.currentItems) {
            title += items.product.title + ",";
        }
        if (!isProduct) {
            $notice.find(".notice__message span").text(title.slice(0, -1));
        }
        $notice.fadeIn(350, function () {
            setTimeout(function () {
                $notice.fadeOut(350);
            }, 2500);
        });
    }

    function setIconAddCart(order_lines) {
        for (const product of order_lines) {
            const $block = $(`[data-cust-product-id="${product.product_id}"]`);

            $block.find(".products-item__action-addcart").addClass("_active");
            $block
                .find(`input[value="${product.variant_id}"]`)
                .closest(".checkbox-btn__label")
                .addClass("checkbox-item__circle");
        }
    }

    function onChangeSize() {
        const lable = this.parentElement,
            content = this.closest(".products-item__sizes-content");

        if (!lable || !content) return;

        const btnAdd = content.querySelector("[data-size-cart-add]");

        if (lable.classList.contains("checkbox-item__circle")) {
            btnAdd.querySelector("span").innerText = "Перейти в корзину";
            content.querySelector("[data-size-remove]")?.removeAttribute("hidden");
        } else {
            btnAdd.querySelector("span").innerText = "Добавить в корзину";
            content
                .querySelector("[data-size-remove]")
                ?.setAttribute("hidden", "true");
        }
        if (btnAdd.hasAttribute("disabled")) {
            btnAdd.removeAttribute("disabled");
        }
    }

    function removeSize() {
        const wrapper = this.closest(".products-item__sizes-wrapper"),
            input = wrapper?.querySelector("input:checked"),
            variant_id = input?.value,
            product_id = input.name;

        if (!wrapper || !variant_id || !product_id) return;
        if (wrapper.querySelectorAll(".checkbox-item__circle").length < 2) {
            $(`[data-add-cart="${product_id}"]`).removeClass("_active");
        }
        wrapper.querySelector("[data-size-cart-add] span").innerText =
            "Добавить в корзину";
        wrapper.querySelector("[data-size-remove]")?.setAttribute("hidden", "true");
        input.parentElement.classList.remove("checkbox-item__circle");

        Cart.delete({
            items: [variant_id],
        });
    }

    function btnAddInCart() {
        const variantId = Number(this.dataset.btnCartAdd ?? 0);

        if (!variantId || isNaN(variantId)) return;

        if (Cart.order.getItemByID(variantId) === undefined) {
            this.classList.add("_active");
            Cart.add({
                items: { [variantId]: 1 },
            });
        } else {
            this.classList.remove("_active");
            Cart.delete({
                items: [variantId],
            });
        }
    }

    function sizeAddInCart() {
        const wrapper = this.closest(".products-item__sizes-wrapper"),
            input = wrapper?.querySelector("input:checked");

        if (!wrapper || !input) return;

        const variant_id = input.value,
            product_id = input.name;

        if (!variant_id || !product_id) {
            console.warn(
                "[Header] Ошибка добавления товара в корзину,",
                variant_id,
                product_id,
            );
            return;
        }
        const btnAdded = wrapper.querySelector("[data-size-cart-add]");
        if (!btnAdded) return;
        if (input.parentElement.classList.contains("checkbox-item__circle")) {
            window.location.href = "/cart_items";
            return;
        }

        btnAdded.querySelector("span").innerText = "Размер не выбран";
        btnAdded.setAttribute("disabled", true);
        // input.checked = false;
        // input.parentElement.classList.add("checkbox-item__circle");

        Cart.add({
            items: { [variant_id]: 1 },
        });

        const $btnAddCart = $(`[data-add-cart="${product_id}"]`);

        $btnAddCart.addClass("_active");
        $btnAddCart.closest(".products-item__img-wrapper").each(function () {
            const input = this.querySelector(`input[value="${variant_id}"]`);
            if (input) {
                input.checked = false;
                input.parentElement.classList.add("checkbox-item__circle");
            }
            loader.callAdd(this);
        });

        setTimeout(() => {
            wrapper.querySelector(".products-item__sizes-close").click();
        }, 150);
    }

    function changeItemCount(count) {
        if (count > 0) {
            $cartItemCount.text(count);
            if ($cartItemCount.attr("hidden")) $cartItemCount.removeAttr("hidden");
        } else {
            $cartItemCount.attr("hidden", true);
        }
    }

    EventBus.subscribe("eventLoader", function () {
        loader = new EM_Module.Loader();
    });

    EventBus.subscribe("update_items:insales:cart", function (cart) {
        if (
            cart.action.method === "add_items" ||
            cart.action.method === "delete_items"
        ) {
            changeItemCount(cart.positions_count);
        } else if (cart.action.method === "update_items") {
            setIconAddCart(cart.order_lines);
            changeItemCount(cart.positions_count);
        } else if (cart.action.method === "clear_items") {
            changeItemCount(cart.positions_count);
            $(".checkbox-item__circle").removeClass("checkbox-item__circle");
        }
    });

    EventBus.subscribe("add_items:insales:cart", noticeAddInCart);
    // EventBus.subscribe('delete_items:insales:cart', function (data) {
    //     console.log('Товары удалены', data);
    // });

    $(document).on("change", "input[data-size-select]", onChangeSize);
    $(document).on("click", "[data-size-remove]", removeSize);
    $(document).on("click", "[data-size-cart-add]", sizeAddInCart);
    $(document).on("click", "[data-btn-cart-add]", btnAddInCart);

    $notice.on("click", function () {
        $notice.fadeOut(350);
    });
})();

// Вывод новинок
(() => {
    var $header = $widget,
        newcomes = JSON.parse(localStorage.getItem("newcomesList"));

    const isMobile = sessionStorage.getItem("isMobile") === "true",
        handle = $header.find("#collectionID").attr("data-collection-handle") ?? "",
        className = isMobile ? ".mob-popup" : ".header__body";

    async function getNewcomes() {
        const response = await $.ajax({
            url: "https://insales.widgets.ibice.ru/api/jls-gateway/newcomes",
            method: "POST",
            dataType: "json",
            data: {
                flow_id: "62b2caa5-7874-40a9-b7f2-1b9561fe9e83",
            },
            timeout: 10000,
        });

        if (!response || !response?.newcomes) {
            console.warn("[Newcomes] Не удалось получить Новинки", response);
            newcomes = null;
        } else {
            newcomes = response;
            localStorage.setItem("newcomesList", JSON.stringify(response));
            setNewcomes();
        }
    }

    function setNewcomes() {
        if (!newcomes?.newcomes) return;
        const $main = $("main");

        for (const key in newcomes.newcomes) {
            newCollection = newcomes.newcomes[key];
            // $(`${className} [data-coll-permalink="/collection/${newCollection.permalink}"]`).addClass("submenu__link_new");
            $(
                `[data-coll-permalink="/collection/${newCollection.permalink}"]`,
            ).addClass("submenu__link_new");

            if (handle.length && handle != newCollection.permalink) continue;
            for (const id of newCollection.products) {
                $main
                    .find(`[data-cust-product-id="${id}"]:first .products-item__badges`)
                    .removeAttr("hidden");
            }
        }
    }

    // Вывод Новинок
    if (
        newcomes === null ||
        !newcomes?.effective_time ||
        (new Date() - new Date(newcomes.effective_time * 1000)) / 3600000 > 6
    ) {
        getNewcomes();
    } else setNewcomes();

    // Вывод цветов
    // const $catalog = $("[data-ajax-products] [data-first-variant]");
    // let listIds = "";
    // for (const block of $catalog.find("[data-first-variant]")) {
    //     if (block.dataset.firstVariant) {
    //         listIds += block.dataset.firstVariant + ",";
    //     }
    // }

    // // Временно отключил Цвета
    // drawColors(listIds);
})();

/*** Модалки соглашения куки ***/
(() => {
    if (
        (typeof Cookies === "object" && Cookies.get("accept-cookies") === "true") ||
        localStorage.getItem("accept-cookies") === "true"
    )
        return;

    function acceptCookies() {
        try {
            if (typeof Cookies === "object") {
                Cookies.set("accept-cookies", "true");
            } else {
                localStorage.setItem("accept-cookies", "true");
            }
            $cookies.fadeOut(350);
        } catch (err) {
            console.warn("[Popup.Cookies] Ошибка сохранения кукуи", err);
            $cookies
                .find(".cookies__title")
                .text("Ошибка сохранения кукуи")
                .css("color", "#f06363");
        }
    }

    function rejectCookies() {
        const $bodyFirst = $cookies.find(".cookies__body:first");
        const $bodyLast = $cookies.find(".cookies__body:last");

        // $bodyFirst.attr("aria-hidden", "true");
        $bodyFirst.fadeOut(350, () => {
            // $bodyFirst.attr("aria-hidden", "false");
            $bodyLast.fadeIn(350);
        });
    }

    console.log("[Cookies] Run");
    const $cookies = $("#popup-cookies");

    setTimeout(() => {
        if (
            window.matchMedia("(max-width: 63.99875em)").matches &&
            window.location.pathname.includes("/product/")
        ) {
            $cookies.css("bottom", ($(".tap-bar:first").height() ?? 55) + 20 + "px");
        }
        // $cookies.find(".cookies__body:first").attr("aria-hidden", "false");
        $cookies.fadeIn(350);
    }, 250);

    $cookies.find("[data-cookies-close]").on("click", acceptCookies);
    $cookies.find("[data-cookies-reject]:first").on("click", rejectCookies);
})();

/*** Черная пятница ***/
(() => {
    if (!$widget.find("#promo-data").length) return;

    // Время хранения кэша: 10 минут
    const TimeUpdate = 600000;
    const isIndex = window.location.pathname === "/";
    const $promo = $(
        isIndex
            ? "#promoTimerBFBanner"
            : window.matchMedia("(max-width: 63.99875em)").matches
                ? "#headerBFTimerMob"
                : "#headerBFTimer",
        // (isIndex ? "#promoTimerBFBanner,": "") +
        // ( window.matchMedia('(max-width: 63.99875em)').matches ? "#headerBFTimerMob" : "#headerBFTimer")
    );
    const timeObj = new (class {
        constructor() {
            this.flowId = "62b2caa5-7874-40a9-b7f2-1b9561fe9e83";
            this.$productsCount = $promo.find("[data-promo-count]:first");
            this.resrve = 0;

            this.timer = {
                $day: $promo.find("[data-promo-day]:first"),
                $hour: $promo.find("[data-promo-hour]:first"),
                $minute: $promo.find("[data-promo-minute]:first"),
            };
        }

        init() {
            var data;
            try {
                data = JSON.parse($("#promo-data").text());
                if (!data && !data?.dataEnd) {
                    this.hiddenTimer();
                    return;
                }
            } catch (err) {
                this.hiddenTimer();
                console.error("[Promo.Timer] Ошибка парсинга тегов", err);
                return;
            }

            if (!this.timer.$day.length) this.hiddenTimer();
            else this.showTimer();
            $("[data-discount-size]").text(`${data.discount ?? "0"}%`);

            this.endDate = this.getDate(data.dataEnd ?? "");
            this.startDateStamp = Math.floor(
                this.getDate(data.dataStart ?? "19.11.24").getTime() / 1000,
            );
            this.endDateStamp = Math.floor(this.endDate.getTime() / 1000);
            this.makeRequest = true;
            this.offset = Number(data.offset ?? 0);

            const isUpdate = this.getRemainder();
            if (this.remainder.count > 0) this.setTimerAnim();
            else this.setTimerDateAnim();

            // Милисекунды
            if (isUpdate) this.getProductsCount();
            this.timerId = setInterval(this.update.bind(this), 60000);
            // this.update();
        }

        update() {
            // console.log("[Timer.BF]", this.timestampEnd < this.getNewDate(true), this.timestampEnd, this.getNewDate(true));
            if (this.timestampEnd < this.getNewDate(true)) this.getProductsCount();
            else this.setTimer();
        }

        hiddenTimer() {
            console.warn("[Баннер] Не найдена скидка");
            $promo.find("[data-promo-disabled]").removeAttr("hidden");
            $promo
                .find(isIndex ? ".promotion__timer" : ".promo__info-container")
                .attr("hidden", true);
        }

        showTimer() {
            if ($promo.attr("hidden")) {
                $promo.find("[data-promo-disabled]").attr("hidden", true);
                $promo
                    .find(isIndex ? ".promotion__timer" : ".promo__info-container")
                    .removeAttr("hidden");
            }
        }

        getProductsCount() {
            $.post(
                "https://insales.widgets.ibice.ru/api/jls-gateway/products-count",
                {
                    flow_id: this.flowId,
                },
                function (response) {
                    if (!response?.products_count) {
                        console.warn("[Баннер:запрос] Ошибка запроса:", response);
                        this.hiddenTimer();
                        this.clearRemainder();
                        return;
                    }
                    const NotCount = this.count === undefined;
                    // Кэш на 10 минут
                    // this.timestampEnd = Math.floor(response.effective_time * 1000) + TimeUpdate;
                    this.timestampEnd = this.getNewDate(true) + TimeUpdate;
                    this.count = response.products_count;

                    if (NotCount) this.setTimer(false);
                    // const fun = this.getReserveCount.bind(this);
                    this.getReserveCount();
                    // if (this.makeRequest) this.getReserveCount();
                    // else this.makeRequest = true;
                }.bind(this),
                "json",
            ).fail(function (err) {
                console.warn("[Баннер] Ошибка запроса:", err);
            });
        }

        getReserveCount() {
            // this.makeRequest = false;
            $.post(
                "https://insales.widgets.ibice.ru/api/jls-gateway/products-count/reserved",
                {
                    flow_id: this.flowId,
                    begin_period: this.startDateStamp,
                    end_period: this.endDateStamp,
                },
                function (response) {
                    if (!response?.products_count) {
                        console.warn("[Баннер:запрос 2] Ошибка запроса:", response);
                        return;
                    }
                    // const resrveOld = this.resrve;
                    // && Math.abs(resrveOld - this.resrve) > 3
                    this.resrve = response.products_count;
                    this.setRemainder(this.count - this.resrve - this.offset);

                    if (this.$productsCount.text() === "0") this.setTimerAnim();
                    else this.setTimer();
                }.bind(this),
                "json",
            ).fail(function (err) {
                console.warn("[Баннер] Ошибка запроса:", err);
            });
        }

        getDate(date_str) {
            const [day, month, year] = date_str.split(".").map(Number);
            if (isNaN(day) || isNaN(month) || isNaN(year)) return this.getNewDate();
            return new Date(
                Date.UTC(year.length > 2 ? year : "20" + year, month - 1, day) -
                10800000,
            );
        }

        // Вернуть дату относительно МСК
        getNewDate(time = false) {
            const newDate = new Date();
            const newTime =
                newDate.getTime() + (newDate.getTimezoneOffset() + 180) * 60000;

            if (time) return newTime;
            return new Date(newTime);
        }

        getRemainder() {
            let data,
                isUpdate = false;
            try {
                data = JSON.parse(localStorage.getItem("remainder-product") ?? "{}");
            } catch (_) { }

            const currentDate = this.getNewDate(true);
            if (
                data !== undefined &&
                data?.count &&
                data?.offset &&
                Number.isInteger(data.count) &&
                Number.isInteger(data.offset)
            ) {
                this.timestampEnd = data.dateEndUpdate;
                this.remainder = {
                    count: data.count,
                    offset: data.offset,
                    dateEndUpdate: data.dateEndUpdate,
                };
            } else {
                this.timestampEnd = currentDate + TimeUpdate;
                this.remainder = {
                    count: 0,
                    offset: 0,
                    dateEndUpdate: currentDate + TimeUpdate,
                };
                isUpdate = true;
            }

            // if (this.offset !== data?.offset) {
            //     localStorage.removeItem("remainder-product");
            //     isUpdate = true;
            // }
            return isUpdate || this.timestampEnd < currentDate; // 10 минут
        }

        getDataCache() { }

        setRemainder(count) {
            localStorage.setItem(
                "remainder-product",
                JSON.stringify({
                    count: count,
                    offset: this.offset,
                    dateEndUpdate: this.timestampEnd,
                }),
            );
        }

        setTimer(set = true) {
            const diff = this.endDate - this.getNewDate(),
                count =
                    this.count === undefined && this.remainder.count > 0
                        ? this.remainder.count
                        : (this.count ?? 0) - this.resrve - this.offset;
            if (count < 1 || diff < 1) {
                this.hiddenTimer();
                this.clearRemainder();
                return;
            }
            this.showTimer();
            if (set) this._setDate(diff);
            this.$productsCount.text(count);
        }

        setTimerAnim() {
            const diff = this.endDate - this.getNewDate(),
                count =
                    this.count === undefined && this.remainder.count > 0
                        ? this.remainder.count
                        : (this.count ?? 0) - this.resrve - this.offset;
            if (count < 1 || diff < 1) {
                this.hiddenTimer();
                this.clearRemainder();
                return;
            }
            this.showTimer();
            if (!this.isAnimateDate) {
                animateNumber(
                    this.timer.$day.get(0),
                    Math.floor(diff / (1000 * 60 * 60 * 24)),
                    450,
                );
                animateNumber(
                    this.timer.$hour.get(0),
                    Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    450,
                );
                animateNumber(
                    this.timer.$minute.get(0),
                    Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                    450,
                );
            }
            animateNumber(this.$productsCount.get(0), count, 1500);
        }

        setTimerDateAnim() {
            const diff = this.endDate - this.getNewDate();
            if (diff < 1) {
                this.hiddenTimer();
                return;
            }
            this.showTimer();
            this.isAnimateDate = true;
            this._setDate(diff);
        }

        _setDate(diff) {
            this.timer.$day.text(Math.floor(diff / (1000 * 60 * 60 * 24)));
            this.timer.$hour.text(
                Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            );
            this.timer.$minute.text(
                Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            );
        }
        clearRemainder() {
            localStorage.removeItem("remainder-product");
            this.remainder = {
                count: 0,
                offset: 0,
            };
        }
    })();

    function animateNumber(element, targetNumber, duration) {
        const startTime = performance.now() - 150,
            fps = 1000 / 25;

        function update(currentTime) {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            element.textContent = Math.floor(progress * targetNumber);
            if (progress < 1)
                setTimeout(() => {
                    requestAnimationFrame(update);
                }, fps);
        }
        requestAnimationFrame(update);
    }

    // Для черной пятницы
    // if (localStorage.getItem("closeBanner") === "true") {
    //     $promo.filter('.header__notice').attr("hidden", true);
    // }
    // if (localStorage.getItem("closeBanner") !== "true" || isIndex) {
    //     timeObj.init();
    // }
    timeObj.init();
    // $widget.find(
    //     "[data-close-promo]" + (window.matchMedia('(max-width: 63.99875em)').matches ? ":last" : ":first")
    // ).on("click", function() {
    //     localStorage.setItem("closeBanner", true);
    //     $promo.filter('.header__notice').attr("hidden", true);
    // });
})();

/*** Обычный таймер под Sale ***/
(() => {
    // if (localStorage.getItem("closeBanner")) return;
    if (!$widget.find("#promo-data-sale").length) return;

    // const isIndex = window.location.pathname === "/";
    // var $promo = isIndex ? $("#promoTimerBanner") : $widget.find(".header__promo-body:first");
    const $promo = $widget.find(
        window.matchMedia("(max-width: 63.99875em)").matches
            ? "#headerSaleTimerMob"
            : "#headerSaleTimer",
    );

    if (!$promo) return;

    const timeObj = new (class {
        constructor() {
            // console.log("[Таймер] Найденные элементы:", {
            //   day: this.timer.$day.length,
            //   hour: this.timer.$hour.length,
            //   minute: this.timer.$minute.length,
            //   second: this.timer.$second.length,
            //   daysDisplay: this.timerDisplay.$days.length,
            //   secondsDisplay: this.timerDisplay.$seconds.length
            // });
        }

        init() {
            this.timerData = this.getDataTimer();
            if (!this.timerData) {
                this.hiddenTimer();
                return;
            }

            // ! Дописать потом включение баннера
            // if (this.enableBanner) {}
            this.$productsCount = $promo.find("[data-promo-count]:first"); // This is now unused but kept for context

            this.timer = {
                $day: $promo.find("[data-promo-day]"),
                $hour: $promo.find("[data-promo-hour]"),
                $minute: $promo.find("[data-promo-minute]"),
                $second: $promo.find("[data-promo-second]"),
            };

            this.timerDisplay = {
                $days: $promo.find(".timer-days"),
                $seconds: $promo.find(".timer-seconds"),
            };

            if (!this.timer.$day.length) this.hiddenTimer();
            // else this.showTimer();

            this.endDate = this.getDate(this.timerData.dataEnd ?? "");
            this.setTimerDateAnim();
        }

        getDataTimer() {
            try {
                let data = JSON.parse($("#promo-data-sale").text());
                if (!data && !data?.dataEnd) {
                    this.hiddenTimer();
                }
                return data;
            } catch (err) {
                this.hiddenTimer();
                console.error("[Promo.Timer] Ошибка парсинга тегов", err);
            }
        }

        hiddenTimer() {
            console.warn("[Баннер] Не найдена дата окончания акции");
            setTimeout(() => $promo.attr("hidden", true), 150);
        }

        showTimer() {
            if ($promo.attr("hidden")) {
                $promo.removeAttr("hidden");
            }
        }

        getDate(date_str) {
            const [day, month, year] = date_str.split(".").map(Number);
            if (isNaN(day) || isNaN(month) || isNaN(year)) return this.getNewDate();
            return new Date(
                Date.UTC(year.length > 2 ? year : "20" + year, month - 1, day) -
                10800000,
            );
        }

        // Вернуть дату относительно МСК
        getNewDate(time = false) {
            const newDate = new Date();
            const newTime =
                newDate.getTime() + (newDate.getTimezoneOffset() + 180) * 60000;

            if (time) return newTime;
            return new Date(newTime);
        }

        setTimerDateAnim() {
            const diff = this.endDate - this.getNewDate();
            if (diff < 1) {
                if (this.timerId) clearInterval(this.timerId);
                this.hiddenTimer();
                return;
            }
            this.showTimer();
            this.isAnimateDate = true;
            this._setDate(diff);

            // Определяем интервал обновления в зависимости от режима таймера
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const updateInterval = days > 0 ? 60000 : 1000; // 1 минута для дней, 1 секунда для часов

            // console.log("[Таймер] Устанавливаем интервал:", updateInterval, "мс, дней осталось:", days);

            // Очищаем предыдущий интервал если есть
            if (this.timerId) {
                clearInterval(this.timerId);
            }

            // Обновляем таймер с оптимальным интервалом
            this.timerId = setInterval(() => {
                const currentDiff = this.endDate - this.getNewDate();
                if (currentDiff < 1) {
                    this.hiddenTimer();
                    clearInterval(this.timerId);
                    return;
                }

                // Проверяем, нужно ли переключить режим
                const currentDays = Math.floor(currentDiff / (1000 * 60 * 60 * 24));
                const shouldUseSeconds = currentDays === 0;
                const currentInterval = shouldUseSeconds ? 1000 : 60000;

                // Если режим изменился, перезапускаем таймер
                if (currentInterval !== updateInterval) {
                    // console.log("[Таймер] Переключаем режим, перезапускаем таймер");
                    clearInterval(this.timerId);
                    this.setTimerDateAnim();
                    return;
                }

                this._setDate(currentDiff);
            }, updateInterval);
        }

        _setDate(diff) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(
                (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
            );
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            // console.log("[Таймер] Осталось:", { days, hours, minutes, seconds });

            // Переключаем отображение таймера в зависимости от оставшегося времени
            if (days > 0) {
                // Показываем дни, часы, минуты
                // console.log("[Таймер] Показываем режим дней");
                this.timerDisplay.$days.removeAttr("hidden");
                this.timerDisplay.$seconds.attr("hidden", true);
                this.timer.$day.text(days);
                this.timer.$hour.text(hours);
                this.timer.$minute.text(minutes);
                // console.log("[Таймер] Элементы скрыты/показаны:", {
                //   daysHidden: this.timerDisplay.$days.attr("hidden"),
                //   secondsHidden: this.timerDisplay.$seconds.attr("hidden")
                // });
            } else {
                // Показываем часы, минуты, секунды
                // console.log("[Таймер] Показываем режим секунд");
                this.timerDisplay.$days.attr("hidden", true);
                this.timerDisplay.$seconds.removeAttr("hidden");
                this.timer.$hour.text(hours);
                this.timer.$minute.text(minutes);
                this.timer.$second.text(seconds);
                // console.log("[Таймер] Элементы скрыты/показаны:", {
                //   daysHidden: this.timerDisplay.$days.attr("hidden"),
                //   secondsHidden: this.timerDisplay.$seconds.attr("hidden")
                // });
            }
        }
    })();

    timeObj.init();
})();

// (() => {
// 	if (localStorage.getItem("closeBanner")) return;

// 	// const isIndex = window.location.pathname === "/";
// 	// var $promo = isIndex ? $("#promoTimerBanner") : $widget.find(".header__promo-body:first");
// 	var $promo = $widget.find(".header__notice-timer:first");

// 	const timeObj = new class {
// 		constructor() {
// 			this.$productsCount = $promo.find("[data-promo-count]:first"); // This is now unused but kept for context

// 			this.timer = {
// 				$day: $promo.find("[data-promo-day]"),
// 				$hour: $promo.find("[data-promo-hour]"),
// 				$minute: $promo.find("[data-promo-minute]"),
// 				$second: $promo.find("[data-promo-second]")
// 			};

// 			this.timerDisplay = {
// 				$days: $promo.find(".timer-days"),
// 				$seconds: $promo.find(".timer-seconds")
// 			};

// 			// console.log("[Таймер] Найденные элементы:", {
// 			//   day: this.timer.$day.length,
// 			//   hour: this.timer.$hour.length,
// 			//   minute: this.timer.$minute.length,
// 			//   second: this.timer.$second.length,
// 			//   daysDisplay: this.timerDisplay.$days.length,
// 			//   secondsDisplay: this.timerDisplay.$seconds.length
// 			// });
// 		}

// 		init() {
// 			const dateEnd = $("[data-promo-data]:first").attr("data-promo-data");

// 			if (!dateEnd) {
// 				this.hiddenTimer();
// 				return;
// 			}
// 			else if (!this.timer.$day.length) this.hiddenTimer();
// 			else this.showTimer();

// 			this.endDate = this.getDate(dateEnd ?? "");
// 			this.setTimerDateAnim();
// 		}

// 		hiddenTimer() {
// 			console.warn("[Баннер] Не найдена дата окончания акции");
// 			$promo.attr("hidden", true);
// 		}

// 		showTimer() {
// 			if ($promo.attr("hidden")) {
// 				$promo.removeAttr("hidden");
// 			}
// 		}

// 		getDate(date_str) {
// 			const [day, month, year] = date_str.split(".").map(Number);
// 			if (isNaN(day) || isNaN(month) || isNaN(year)) return this.getNewDate();
// 			return new Date(Date.UTC(
// 				year.length > 2 ? year : "20" + year,
// 				month - 1, day
// 			) - 10800000);
// 		}

// 		// Вернуть дату относительно МСК
// 		getNewDate(time = false) {
// 			const newDate = new Date();
// 			const newTime = newDate.getTime() + (newDate.getTimezoneOffset() + 180) * 60000;

// 			if (time) return newTime;
// 			return new Date(newTime);
// 		}

// 		setTimerDateAnim() {
// 			const diff = this.endDate - this.getNewDate();
// 			if (diff < 1) {
// 				this.hiddenTimer();
// 				return;
// 			}
// 			this.showTimer();
// 			this.isAnimateDate = true;
// 			this._setDate(diff);

// 			// Определяем интервал обновления в зависимости от режима таймера
// 			const days = Math.floor(diff / (1000 * 60 * 60 * 24));
// 			const updateInterval = days > 0 ? 60000 : 1000; // 1 минута для дней, 1 секунда для часов

// 			// console.log("[Таймер] Устанавливаем интервал:", updateInterval, "мс, дней осталось:", days);

// 			// Очищаем предыдущий интервал если есть
// 			if (this.timerId) {
// 				clearInterval(this.timerId);
// 			}

// 			// Обновляем таймер с оптимальным интервалом
// 			this.timerId = setInterval(() => {
// 				const currentDiff = this.endDate - this.getNewDate();
// 				if (currentDiff < 1) {
// 					this.hiddenTimer();
// 					clearInterval(this.timerId);
// 					return;
// 				}

// 				// Проверяем, нужно ли переключить режим
// 				const currentDays = Math.floor(currentDiff / (1000 * 60 * 60 * 24));
// 				const shouldUseSeconds = currentDays === 0;
// 				const currentInterval = shouldUseSeconds ? 1000 : 60000;

// 				// Если режим изменился, перезапускаем таймер
// 				if (currentInterval !== updateInterval) {
// 					// console.log("[Таймер] Переключаем режим, перезапускаем таймер");
// 					clearInterval(this.timerId);
// 					this.setTimerDateAnim();
// 					return;
// 				}

// 				this._setDate(currentDiff);
// 			}, updateInterval);
// 		}

// 		_setDate(diff) {
// 			const days = Math.floor(diff / (1000 * 60 * 60 * 24));
// 			const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
// 			const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
// 			const seconds = Math.floor((diff % (1000 * 60)) / 1000);

// 			// console.log("[Таймер] Осталось:", { days, hours, minutes, seconds });

// 			// Переключаем отображение таймера в зависимости от оставшегося времени
// 			if (days > 0) {
// 				// Показываем дни, часы, минуты
// 				// console.log("[Таймер] Показываем режим дней");
// 				this.timerDisplay.$days.removeAttr("hidden");
// 				this.timerDisplay.$seconds.attr("hidden", true);
// 				this.timer.$day.text(days);
// 				this.timer.$hour.text(hours);
// 				this.timer.$minute.text(minutes);
// 				// console.log("[Таймер] Элементы скрыты/показаны:", {
// 				//   daysHidden: this.timerDisplay.$days.attr("hidden"),
// 				//   secondsHidden: this.timerDisplay.$seconds.attr("hidden")
// 				// });
// 			} else {
// 				// Показываем часы, минуты, секунды
// 				// console.log("[Таймер] Показываем режим секунд");
// 				this.timerDisplay.$days.attr("hidden", true);
// 				this.timerDisplay.$seconds.removeAttr("hidden");
// 				this.timer.$hour.text(hours);
// 				this.timer.$minute.text(minutes);
// 				this.timer.$second.text(seconds);
// 				// console.log("[Таймер] Элементы скрыты/показаны:", {
// 				//   daysHidden: this.timerDisplay.$days.attr("hidden"),
// 				//   secondsHidden: this.timerDisplay.$seconds.attr("hidden")
// 				// });
// 			}
// 		}
// 	}

// 	timeObj.init();
// })();

// upd
