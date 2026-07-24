console.log("[EM_Module] Start...");

window.EM_Module = window.EM_Module || {};

// Определение типа устройства
(() => {
    const isMobile = {
        Android: function () {
            return navigator.userAgent.match(/Android/i);
        },
        BlackBerry: function () {
            return navigator.userAgent.match(/BlackBerry/i);
        },
        iOS: function () {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
        },
        Opera: function () {
            return navigator.userAgent.match(/Opera Mini/i);
        },
        Windows: function () {
            return navigator.userAgent.match(/IEMobile/i);
        },
        any: function () {
            return isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows();
        }
    };
    if (isMobile.any()) {
        window.EM_Module.isMobile = true;
        sessionStorage.setItem('isMobile', true);
    }
    else {
        window.EM_Module.isMobile = false;
        sessionStorage.removeItem('isMobile');
    }
})();

// Лоадер
window.EM_Module.Loader = class {
    constructor($block) {
        this.$_block = $block;
        this.className = "local-loader";
        this.svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><style>.spinner_b2T7{animation:spinner_xe7Q .8s linear infinite}.spinner_YRVV{animation-delay:-.65s}.spinner_c9oY{animation-delay:-.5s}@keyframes spinner_xe7Q{93.75%,100%{r:3px}46.875%{r:.2px}}</style><circle class="spinner_b2T7" cx="4" cy="12" r="3"/><circle class="spinner_b2T7 spinner_YRVV" cx="12" cy="12" r="3"/><circle class="spinner_b2T7 spinner_c9oY" cx="20" cy="12" r="3"/></svg>';
    }

    call() {
        this.callStatic(this.$_block);
    }

    hide() {
        this.hideStatic(this.$_block);
    }

    callStatic($block) {
        if ($block.find("." + this.className).length > 0) {
            $block.find("." + this.className).remove();
        }
        $block.append(`<div class="${this.className}">${this.svg}</div>`);
    }

    hideStatic($block) {
        $block.find("." + this.className).remove();
    }

    checkPreloader() {
        return this.$_block.find("." + this.className).length > 0;
    }

    callAdd(container) {
        if (!container) return;
        container.insertAdjacentHTML("beforeend",
            `<div class="loader-added">
                <div class="loader-icon_added"></div>
                <p>Товар добавлен в корзину</p>
            </div>`
        );
        setTimeout(() => {
            container.querySelector(".loader-added")?.remove();
        }, 3000);
    }
}

// Попап
window.EM_Module.Modal = class {
    constructor(modal) {
        this.modal = modal;
    }

    /**
     * @param {Function} callbeckOpen - Выполняется при открытии модалки
     * @param {Function} callbeckClose - Выполняется при закрытии модалки
     */
    init(callbeckOpen, callbeckClose) {
        if (typeof callbeckOpen === "function") {
            this.funcOpen = callbeckOpen;
        }
        if (typeof callbeckClose === "function") {
            this.funcClose = callbeckClose;
        }
        document.addEventListener("click", this.onClick.bind(this));
    }

    onClick(e) {
        // Закрыть модалку
        if (
            e.target.getAttribute("data-close-popup") !== null ||
            e.target.classList.contains("modal-close") || e.target.classList.contains("icon_close") ||
            e.target.nodeName == "svg" && e.target.parentElement.classList.contains("modal-close")
        ) {
            if (e.target.getAttribute("data-close-popup") && e.target.getAttribute("data-close-popup") === this.modal.id) {
                this.close();
                return;
            }
            const popup = e.target.closest("#" + this.modal.id);
            if (popup && popup.id == this.modal.id) {
                this.close();
            }
        }
        // Открыть модалку
        else if (
            e.target.classList.contains("modal-open") || e.target.getAttribute("data-popup") !== null || 
            e.target.parentElement.getAttribute("data-popup") !== null 
        ) {
            if (
                e.target.getAttribute("data-popup") === "#" + this.modal.id && 
                e.target.closest("[data-popup]")?.getAttribute("data-popup") === "#" + this.modal.id
            ) {
                setTimeout(() => this.open(), 150);
            }
            else if (
                e.target.getAttribute("data-close-other-popup") === "all" || 
                e.target.parentElement.getAttribute("data-close-other-popup") === "all"
            ) {
                this.close();
            }
        }
    }

    open() {
        if (
            (this.modal.classList.contains("popup") || this.modal.getAttribute("data-lock-page") === "true") 
            && window.matchMedia('(max-width: 760px)').matches
        ) {
            document.querySelector("html").classList.add("lock");
        }

        this.modal.style.display = 'flex';
        this.modal.classList.remove('popup_hide');
        this.modal.classList.add('popup_show');

        if (this.funcOpen) this.funcOpen();
    }

    close() {
        const modal = this.modal;
        
        if (modal.classList.contains("popup_hide")) return;

        modal.classList.remove('popup_show');
        modal.classList.add('popup_hide');
        modal.addEventListener('animationend',
            // () => modal.classList.remove('show'), 
            () => modal.style.display = 'none',
            { once: true }
        );
        if (
            (this.modal.classList.contains("popup") || this.modal.getAttribute("data-lock-page") === "true") 
            && window.matchMedia('(max-width: 760px)').matches
        ) {
            document.querySelector("html").classList.remove("lock");
        }

        if (this.funcClose) this.funcClose();
    }
};

window.EM_Module.props = {
    // Набор часто используемых кодов UNECE Rec 20 (EDIFACT 6411) -> RU
    UNIT_MAP_RU: {
        KGM: 'кг',          // kilogram [web:2]
        GRM: 'г',           // gram [web:2]
        TNE: 'т',           // tonne (metric ton) [web:2]
        LTR: 'л',           // litre [web:2]
        MLT: 'мл',          // millilitre [web:2]
        MTK: 'м²',          // square metre [web:2]
        MTQ: 'м³',          // cubic metre [web:2]
        MTR: 'м',           // metre [web:2]
        CMT: 'см',          // centimetre [web:2]
        MM:  'мм',          // millimetre (код может быть MM или MMT в разных листах) [web:2]
        H87: 'шт',          // piece (common “each”) [web:2]
        NAR: 'шт',          // number of articles (часто трактуют как штуки) [web:2]
        PCE: 'шт',          // piece (альтернативный код) [web:2]
        PR:  'пар',         // pair [web:2]
        DZN: 'дюж',         // dozen [web:2]
        HUR: 'ч',           // hour [web:2]
        MIN: 'мин',         // minute [web:2]
        SEC: 'с'            // second [web:2]
    },

    types: {
        limit:  120213737,  // макс. кол-вао 
        pack:   139893897,  // кол-во для добавлени
        unit:   120213753,  // единица измерения
        gram:   139894121   // граммовка 
    },

    unitToRu: function(code) {
        if (!code) return this.UNIT_MAP_RU.PCE;

        const norm = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return this.UNIT_MAP_RU[norm] ?? this.UNIT_MAP_RU.PCE;
    },

    // Получить значение параметра через properties
    getMaxQuantityProp: function(product) {
        const maxQuantity = !product?.variants ? 0 : product.variants[0].quantity;

        for (const key in product.properties) {
            if (product.properties[key].permalink == "limit") {
                return {
                    isAccept: true,
                    quantity: product.properties[key].characteristics[0]?.title ?? product.variants[0].quantity,
                    maxQuantityDefault: maxQuantity
                };
            }
        }
        return {
            isAccept: false,
            quantity: maxQuantity,
            maxQuantityDefault: maxQuantity
        };
    },

    // Получить значение параметра через properties
    getCharacteristicPermalink: function(product, type="pack") {
        for (const key in product.properties) {
            if (product.properties[key].permalink == type) {
                return product.properties[key].characteristics[0]?.title ?? (type == "pack" ? 1 : "шт.");
            }
        }
        return type == "pack" ? 1 : this.unitToRu(product.unit);
    },

    // Получить значение параметра через characteristics
    getMaxQuantity: function(product) {
        const id = EM_Module.props.types.limit;
        const maxQuantity = !product?.variants ? 0 : product.variants[0].quantity;
        
        for (const characteristic of product.characteristics) {
            if (characteristic.property_id == id) {
                return {
                    isAccept: true,
                    quantity: characteristic.title,
                    maxQuantityDefault: maxQuantity
                };
            }
        }
        return {
            isAccept: false,
            quantity: maxQuantity,
            maxQuantityDefault: maxQuantity
        };
    },

    // Получить значение параметра через characteristics
    getCharacteristic: function(product, type="pack") {
        const id = EM_Module.props.types[type];
        
        for (const characteristic of product.characteristics) {
            if (characteristic.property_id == id) {
                return characteristic.title;
            }
        }
        return type == "pack" ? 1 : this.unitToRu(product.unit);
    },
    
    // Получить граммовку товара
    getCharacteristicGram: function(characteristics) {
        const id = EM_Module.props.types.gram;
        for (const characteristic of characteristics) {
            if (characteristic.property_id == id) {
                const gram = Number(characteristic.title);
                return (isNaN(gram) || !gram) ? 0 : gram;
            }
        }
        return 0;
    },

    /**
     * Возвращает числовое значение из отформатированной цены.
     * @param {string} formattedPrice - Форматированная цена (например, "1 234,56 ₽")
     * @param {object} options - Опции форматирования (delimiter, separator, unit, format)
     * @returns {number} - Числовое значение
     */
    parseFormattedPrice(formattedPrice, options = Shop.money.options) {
        // Удаляем валюту/единицу из строки
        let str = formattedPrice.replace(options.unit, '').replace(/&#8381/, '').trim();

        // Удаляем форматирующий шаблон и лишние пробелы
        if (options.format) {
            str = str.replace(options.format.replace('%n', '').replace('%u', ''), '').trim();
        }

        // Удаляем пробелы и тысячные разделители
        if (options.delimiter !== '.') {
            str = str.replace(new RegExp('\\' + options.delimiter, 'g'), '');
        }

        // Меняем separator на ".", если используется нестандартный разделитель (например, ",")
        if (options.separator && options.separator !== '.') {
            str = str.replace(options.separator, '.');
        }

        // Заменяем запятую на точку, если decimal separator — запятая
        str = str.replace(',', '.');

        // Удаляем все нецифровые символы, кроме точки
        str = str.replace(/[^\d.]/g, '');

        // Преобразуем в число
        return parseFloat(str);
    }
};

// Готовность
(() => {
    var timerId = setInterval(() => {
        if (typeof EventBus !== 'undefined' && typeof window?.EM_Module?.Loader !== 'undefined') {
            clearInterval(timerId);

            document.dispatchEvent(new CustomEvent("em_module:ready", {
                cancelable: true
            }));
        
            EventBus.publish('em_module-init', {
                isTest: false,
                title: 'Init EM module',
                status: 'ok'
            });
        }
    }, 250);
})();

// Работа с корзиной
(() => {
    // const isMobile = window.EM_Module.isMobile;
    const MIN_QUANTITY = 3; // Минимальный остаток товара
    var timerId = null,
        $btnCart = EM_Module.isMobile ? $("[data-btn-mob-cart]:first") : $("[data-btn-cart]:first");

    function updateBtnAdd(products, idRemove) {
        if (idRemove) {
            for (const product of products) {
                $(`[data-product-add="${product.id}"]`).removeClass("cart-added");
            }
        }
        else {
            for (const product of products) {
                const $btn = $(`[data-product-add="${product.id}"]`);
                const $input = $btn.find(".quantity__input");
                const unit = $input.attr("data-product-unit");

                $btn.addClass("cart-added");
                $input.val(product.quantity + (unit ? " " + unit : ""));
            }
        }
    }

    function changeBtnAdd(cart) {
        const positions_count = cart.positions_count;
        if (positions_count > 0) {
            $btnCart.addClass("_active")
        }
        else {
            $btnCart.removeClass("_active");
        }
        $btnCart.find("[data-em-cart-count]").text(positions_count)
        $btnCart.find("[data-em-cart-price]").text(Shop.money.format(cart.total_price));
    }

    function checkProductInCart(order_lines) {
        let ids = [];
        for (const order of order_lines) {
            if (order.variant_quantity < MIN_QUANTITY) ids.push(order.id);
        }
        if (ids.length > 0) {
            Cart.delete({
                items: ids
            });
        }
    }

    function updateCart(cart) {
        console.log("[EM_Module] Update cart:", cart);
        const method = cart.action.method;

        if (method == "update_items") {
            updateBtnAdd(cart.order_lines);
        }
        // else if (method == "remove_items" || method == "delete_items" || method == "add_items" || method == "set_items") {
        else if (cart.action?.currentItems && cart.action.currentItems.length > 0) {
            updateBtnAdd(
                cart.action.currentItems,
                (method == "remove_items" || method == "delete_items")
            );
        }
        changeBtnAdd(cart);
        checkProductInCart(cart.order_lines);
    }

    function onClickBtnAdd(btn) {
        if (btn.classList.contains("cart-added")) return;

        const id = Number(btn.getAttribute("data-product-add")),
            input = btn.parentElement.querySelector("input"),
            pack = Number(input.getAttribute("data-package-qantity"));
        
        if (isNaN(id)) return;
        Cart.add({
            items: {
                [id]: isNaN(pack) ? 1 : pack
            }
        });
        setTimeout(() => {
            btn.classList.add("cart-added");
            btn.parentElement.querySelector("input").value = isNaN(pack) ? 1 : pack;
        }, 150);
    }

    function toNumber(s) {
        const parseNumber = Number(
            parseFloat(s.replace(',', '.').replace(/[^0-9.-]/g, ''))
        );
        return isNaN(parseNumber) ? 1 : parseNumber;
    }

    function changeQuantity(quantityBtn) {
        const isMinus = quantityBtn.getAttribute("data-btn-plus") === null,
            input = quantityBtn.parentElement.querySelector("input"),
            vairantId = Number(quantityBtn.parentElement.getAttribute("data-product-add")),
            error = input.closest("[data-variant-id]")?.querySelector(".product__message-error");

        if (!input || isNaN(vairantId)) {
            quantityBtn.parentElement.classList.add("btn__disbled");
            return;
        }
        const 
            unit = input.getAttribute("data-product-unit"),
            pack = Number(input.getAttribute("data-package-qantity")),
            quantity = toNumber(input.value),
            maxQuantityDefault = Number(input.getAttribute("data-max-qantity-default")),
            maxQuantityCustom = Number(input.getAttribute("data-max-qantity")),
            newQuantity = quantity + (isMinus ? -pack : pack);

        let maxQuantity = maxQuantityCustom < maxQuantityDefault ? maxQuantityCustom : maxQuantityDefault;

        if (newQuantity <= 0 || quantity > maxQuantity && (quantity - (isMinus ? -pack : pack)) <= 0) {
            if (error) $(error).fadeOut(150);

            quantityBtn.parentElement.classList.remove("cart-added");
            if (timerId) clearTimeout(timerId);
            Cart.delete({
                items: [vairantId]
            });
            timerId = null;
        }
        else if (newQuantity > maxQuantity) {
            if (error) $(error).fadeIn(150);
            if (quantity > maxQuantity) {
                Cart.set({
                    items: {
                        [vairantId]: quantity - (isMinus ? -pack : pack)
                    }
                });
                input.value = quantity - (isMinus ? -pack : pack) + (unit ? " " + unit : "");
            }
        }
        else {
            if (error) $(error).fadeOut(150);
            input.value = newQuantity.toFixed(1).replace(/\.0$/, '') + (unit ? " " + unit : "");

            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(() => {
                timerId = null;
                Cart.set({
                    items: {
                        [vairantId]: newQuantity.toFixed(1).replace(/\.0$/, '')
                    }
                });
            }, 500);
        }
    }

    function initCart() {
        EventBus.subscribe('update_items:insales:cart', updateCart);

        // if (isMobile && !window.location.pathname !== "/") {
        //     $(".header:first, [data-em-header-fix]:first").attr("hidden", true);
        // }

        // Кнопка для добавления в корзину
        document.addEventListener("click", function (e) {
            if (e.target.getAttribute("data-product-add")) {
                onClickBtnAdd(e.target);
            }
            else if (e.target.parentElement?.getAttribute("data-product-add")) {
                if (e.target.classList.contains("quantity__button")) {
                    changeQuantity(e.target);
                }
                else {
                    onClickBtnAdd(e.target.parentElement);
                }
            }
            else if (e.target.localName == "span" && e.target.parentElement.getAttribute("data-product-add")) {
                onClickBtnAdd(e.target.parentElement);
            }
        });
    }

    if (typeof EventBus !== 'undefined' && typeof window?.EM_Module?.Loader !== 'undefined') {
        initCart();
    }
    else {
        document.addEventListener("em_module:ready", initCart);
    }
})();

$(document).ready(() => {
    function EMmaskPhone() {
        function formatInternationalPhone(formatted, digits) {
            const rest = digits.substring(3);
            if (rest.length === 0) return formatted + digits;

            formatted += digits.substring(0, 3) + '(' + rest.substring(0, Math.min(2, rest.length));
            if (rest.length > 2) {
                formatted += ')' + rest.substring(2, 5);
            }
            if (rest.length > 5) {
                formatted += '-' + rest.substring(5, 7);
            }
            if (rest.length > 7) {
                formatted += '-' + rest.substring(7, 9);
            }
            return formatted;
        }

        function formatRussianPhone(formatted, digits) {
            const rest = digits.substring(1);
            if (rest.length === 0) return formatted + digits;

            formatted += digits[0] + '(' + rest.substring(0, Math.min(3, rest.length));
            if (rest.length > 3) {
                formatted += ')' + rest.substring(3, 6);
            }
            if (rest.length > 6) {
                formatted += '-' + rest.substring(6, 8);
            }
            if (rest.length > 8) {
                formatted += '-' + rest.substring(8, 10);
            }
            return formatted;
        }

        function formatPhoneNumber(input, check) {
            // Извлекаем только цифры
            const digits = input.value.replace(/\D/g, '');

            // Если цифр нет (например, пользователь стер значение),
            // оставляем поле пустым, чтобы можно было ввести номер
            if (digits.length === 0) {
                input.value = "";
                return false;
            }

            let formatted = '+';

            // Выбираем форматирование в зависимости от первой цифры
            if (digits[0] === '7' || digits[0] === '8') {
                formatted = formatRussianPhone(formatted, digits);
            } else {
                formatted = formatInternationalPhone(formatted, digits);
            }

            input.value = formatted;
            return true;
        }

        console.log('[EM_Module] Инициализация маски для телефона...');

        document.querySelectorAll("#shipping_address_phone, #client_phone, [data-input-phone], #client_field_38536811")
            .forEach(input => {
                // При инициализации заполняем значение по умолчанию, если поле пустое
                if (!input.value.trim()) {
                    input.value = "+7";
                }
                // Первичная обработка текущего значения
                formatPhoneNumber(input, undefined);
                // Используем function() для корректного использования this
                input.addEventListener('input', function () {
                    formatPhoneNumber(this, undefined);
                });
            });
    }

    // Скрытие блока района при запросе ?app=true
    const appParam = (new URLSearchParams(window.location.search)).get("app");
    // const appDistrictId = Number((new URLSearchParams(window.location.search)).get("district"));

    const setCookie = (name, value, days = 30) => {
        const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${name}=${value}; expires=${expires}; path=/`;
    };

    const getCookie = (name) => {
        return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1] || null;
    };

    const cahngeAvailable = (isApp) => {
        if (!isApp) {
            $("._app-header:first").removeClass("_app-header");
            $("footer [data-footer-hide-app]:first").removeAttr("hidden");
        }
    }

    if (appParam && appParam !== 'true') {
        setCookie('app_hide', appParam);
        // setCookie('app_district_Id', "");
        
        cahngeAvailable(false);
    }
    else if (appParam === 'true') {
        setCookie('app_hide', 'true');
        // if (!isNaN(appDistrictId)) {
        //     setCookie('app_district_Id', appDistrictId);
        // }
        cahngeAvailable(true);
    } else if (getCookie('app_hide') === 'true') {
        // if (!isNaN(appDistrictId)) {
        //     setCookie('app_district_Id', appDistrictId);
        // }
        cahngeAvailable(true);
    }
    else {
        cahngeAvailable(false);
    }

    const pathname = window.location.pathname;
    if (pathname.includes("/new_order") || pathname.includes("/contacts/new") || pathname.includes("/client_account/contacts")) {
        EMmaskPhone();
    }
    if (pathname.includes("/client_account/orders")) {
        $("[data-href-scroll]").on("click", function() {
            const id = this.dataset.hrefScroll;
            if (id) {
                $('html, body').animate({
                    scrollTop: $("#" + id).offset().top - 10
                }, 350);
            }
        });
    }
    else if (pathname.includes("/page/app")) {
        if (navigator.userAgent.match(/Android/i)) {
            document.location.href = "https://play.google.com/store/apps/details?id=com.mycompany.wizzu";
        }
        else if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
            document.location.href = "https://apps.apple.com/ru/app/wizzu/id6747611030";
        }
    }
});
