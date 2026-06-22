$(document).ready(() => {
    const isMobile = sessionStorage.getItem('isMobile') === 'true';
    const $cart = $widget,
        $basket = $cart.find("[data-basket-list]:first"),
        $basketInfo = $cart.find("[data-em-basket-info]:first"),
        $replace = $cart.find("#popup-replace"),
        $cartCountItem = $cart.find("[data-em-cart-item-count]:first"),
        $btn = {
            submit: isMobile ? $(".tap-bar [data-basket-submit]:first") : $cart.find("[data-basket-submit]:first"),
            acceptPromo: $basketInfo.find("[data-em-coupon-accept]:first"),
            clearPromo: $basketInfo.find("[data-em-coupon-clear]:first")
        };

    var loaderCart = loader = {
            call() {},
            hide() {}
        },
        loaderCart = loader,
        loaderQuantity = loader,
        currentCollection = "",
        countUpdate = 0,

        // Для отслеживания скролла в мобилке
        startY = 0,
        closeReady = false,
        sliderReplace = null;


    const UnavailableProducts = new function() {
        function getCount(products) {
            let count = 0;
            for (const _ in products) count++;
            return count;
        }
    
        this.isChange = false;
        this.removeProducts = [];
        try {
            this.products = JSON.parse( localStorage.getItem("productNotAvailable") ?? "{}" );
            this.count = getCount(this.products);
        }
        catch (e) {
            this.products = {};
            this.count = 0;
        }
    
        this.log = (mess) => console.log("[Save] " + mess);
        this.logError = (mess) => console.warn("[Save] " + mess);
        this.includes = (product_id, variant_id) => { 
            return this.products[variant_id] === product_id; 
        }
        this.isEmpaty = () => {
            return $.isEmptyObject(this.products); 
        }
    
        this.getArrayIds = function() {
            let arr = [];
            for (const key in this.products) {
                arr.push(this.products[key]);
            }
            return arr;
        }
        this.getAjaxproducts = async function() {
            let products = [];
            const product_ids = this.getArrayIds();
            const productsAll = await ajaxAPI.product.getList(product_ids);
            this.log("Ajax запрос на получение товаров: " + productsAll?.length);
    
            if (!productsAll?.length) return [];
            const listProducts = this.products;

            for (const product of productsAll) {
                const product_id = product.id;

                for (const variant of product.variants) {
                    // if (variant_id === variant.id) {
                    if (listProducts[variant.id] === product_id) {
                        products.push({
                            title: product.title,
                            id: variant.id,
                            variant_id: variant.id,
                            product_id: product_id,
                            product_url: product.url,
                            first_image: product.first_image,
                            sale_price: variant.price,
                            variant_quantity: variant.quantity,
                            product: {
                                available: product.available,
                                characteristics: product.characteristics,
                                variants: product.variants,
                            },
                        });
                        break;
                    }
                }
            }
            this.log("Обработано товаров: " + products.length);
            for (const id of product_ids) {
                if (!productsAll.find(product => product.id == id)) {
                    this.removeProductId(id);
                }
            }
            return products;
        }
        this.set = function(obj) {
            if (obj) {
                this.products = obj;
                this.isChange = true;
                this.save();
                this.count = getCount(this.products);
            }
            else {
                throw new TypeError("Аргумент должен быть массивом!");
            }
        }
        this.add = function(product_id, variant_id, save=true) {
            if (!product_id || !variant_id || typeof product_id !== 'number' || typeof variant_id !== 'number') {
                throw new TypeError("Элемент должен быть типа Number!");
            }
            this.removeProducts.push(variant_id);
            if (this.products[variant_id] !== product_id) {
                this.products[variant_id] = product_id;
                this.isChange = true;
                this.count++;
                if (save) this.save();
                return true;
            }
            return false;
        }
        this.save = function() {
            if (this.isChange) {
                this.isChange = false;
                localStorage.setItem("productNotAvailable", JSON.stringify(
                    this.products ?? {}
                ));
            }
        }
        this.remove = function(variant_id, save=true) {
            if (!variant_id || typeof variant_id !== 'number') {
                throw new TypeError("Элемент должен быть типа Number!");
            }
            delete this.products[variant_id];
            this.isChange = true;
            if (this.count > 0) this.count--;
            if (save) this.save();
        }
        this.removeProductId = function(product_id, save=true) {
            if (!product_id || typeof product_id !== 'number') {
                throw new TypeError("Элемент должен быть типа Number!");
            }
            for (const key in this.products) {
                if (this.products[key] == product_id) {
                    delete this.products[key];
                    this.isChange = true;
                    if (this.count > 0) this.count--;
                    if (save) this.save();
                    return true;
                }
            }
            return false;
        }
        this.removeCart = function() {
            if (!this.removeProducts.length) return;
            Cart.delete({
                items: this.removeProducts
            });
            this.removeProducts = [];
        }
        this.clear = function() {
            this.products = {};
            this.count = 0;
            $cart.find("[data-disabled-list]").html("");
            localStorage.removeItem("productNotAvailable");
        }
    };

    function messageError(message) {
        console.warn("[Error] Cart:", message);
    }

    function updateFavorites() {
        setTimeout(() => {
            FavoritesProducts.update();
        }, 150);
    }

    function getSizeName(variants, id) {
        for (const variant of variants) {
            if (variant.id == id) {
                return "Размер " + variant.option_values.find(opt => opt.option_name_id == 1607434)?.title ?? "";
            }
        }
        return "Размер";
    }

    function isInCart(varinats) {
        for (const order of Cart.order.order_lines) {
            if (varinats.find(item => item.id == order.id)) return order.id;
        }
    }

    function removeBtnActive(items) {
        if (!items?.length) return;

        for (const id of items) {
            $cart.find(`[data-item-id="${id}"]`).remove();
            $(`[data-btn-cart-add="${id}"]`).removeClass("_active");
        }
    }

    function removeBtnActiveAll() {
        const $products = $(`[data-product-add]:checked`).prop("checked", false).removeClass("_active");
        $products.closest(".products-item__img-wrapper").find("[data-add-cart]").removeClass("_active");
        for (const input of $products) {
            if (!input.value) continue;
            $replace.find(`.checkbox-btn__input[value="${input.value}"]`).closest(".checkbox-list__item").attr("disabled", true);
        }
    }

    function onReplaceInCart() {
        const variantId = this.dataset.replaceInCart;
        const replaceId = Number(this.closest("[data-popup-replace-id]")?.dataset.popupReplaceId);

        if (
            isNaN(replaceId) || isNaN(Number(variantId)) ||
            !variantId || !replaceId || variantId === replaceId
        ) return;

        const 
            wrapper = this.closest(".products-item__basket-wrapper"),
            buttonClose = this.closest(".products-item__basket-wrapper")?.querySelector(".products-item__size-title"),
            input = wrapper.querySelector(`input[value="${variantId}"]`),
            label = input.closest(".checkbox-btn__label");

        if (buttonClose && buttonClose.classList.contains("_spoller-active")) {
            buttonClose.dispatchEvent(new Event("click", {bubbles: true}));
        }

        loader.call();
        if (label.classList.contains("checkbox-item__circle")) {
            if (wrapper.querySelectorAll(".checkbox-item__circle").length < 2) {
                wrapper.querySelector("[data-replace-in-cart]").classList.remove("_active");
            }
            label.classList.remove("checkbox-item__circle");
            Cart.delete({
                items: [variantId]
            });
        }
        else {
            wrapper.querySelector("[data-replace-in-cart]").classList.add("_active");
            label.classList.add("checkbox-item__circle");
            Cart.add({
                items: { [variantId]: 1 }
            });
        }
        setTimeout(() => {
            loader.hide();
        }, 250);
    }

    function changeBasketHTML(data) {
        // if (data.action.method == "delete_items" || data.action.method != "add_items") return;
        if (data.action.method != "add_items") return;

        let html = "";
        for (const order of data.action.currentItems) {
            const $item = $basket.find(`[data-item-id="${order.variant_id}"]`);

            const isAvailable = order.variant_quantity > 0 && order.product.available;
            const isPreorder = !isAvailable && EM_Module.func.checkPreorderChars(order.product.characteristics);
            const isSoon = !isAvailable && EM_Module.func.checkSoonCahrs(order.product.characteristics, order.product.url);

            if (
                !isAvailable && (!isPreorder || isSoon) 
                // || UnavailableProducts.includes(order.product_id, order.variant_id)
            ) continue;
            
            if ($item.length) {
                $item.find("[data-quantity-change-init] input").val(order.quantity);
                continue;
            }
            const old_price = Number(order.product.variants.find(el => el.id == order.id)?.old_price ?? 0);
            html += Template.render({
                product_id: order.product_id,
                variant_id: order.id,
                title: order.product.title,
                image: order.first_image.large_url,
                price: Shop.money.format(order.sale_price),
                priceNotFormat: order.sale_price,
                price_old: order.sale_price < old_price && Shop.money.format(old_price),
                quantity: order.quantity,
                maxQuantity: order.variant_quantity,
                url: order.product.url,
                size_name: getSizeName(order.product.variants, order.id),
                isImags: order.images.length > 0,
                isPreorder: isPreorder,
                badges: 
                    (order.product.url.includes("/novinki") ? EM_Module.Badges.renderBadgeHTML("Новинка") : "") 
                    + EM_Module.Badges.getBadges(order.product),
                isBadgeSale: order.product.url.includes("/sale"), 
            }, "basket-product");
        }

        $cart.find(".basket__list:first").append(html);
        updateFavorites();
    }

    function basketDisplayMode(totalPrice) {
        const 
            $form = $cart.find("[data-cart-form]:first"),
            $empty = $cart.find("[data-basket-empty]"),
            $topBar = isMobile ? $("[data-mob-basket-submit]") : null,
            isBasketHidden = $basket.attr("hidden") !== undefined,
            hasProducts = totalPrice > 0 || UnavailableProducts.count > 0;

        // console.log("[TEST]", totalPrice, hasProducts, UnavailableProducts.count, $form);

        if (totalPrice == 0 && UnavailableProducts.count > 0 && !isBasketHidden) {
            $basket.attr("hidden", true);

            if (isMobile) {
                $topBar.find("[data-em-basket-hidden]").attr("hidden", false);
                $topBar.find("[data-delivery-to-free]").attr("hidden", true);
            }
            else {
                $cart.find("[data-em-unavailable]").attr("hidden", false);
            }
        }
        else if ((totalPrice > 0 || UnavailableProducts.count == 0) && isBasketHidden) {
            $basket.removeAttr("hidden");
                
            if (isMobile) {
                $topBar.find("[data-em-basket-hidden]").attr("hidden", true);
                $topBar.find("[data-delivery-to-free]").attr("hidden", false);
            }
            else {
                $cart.find("[data-em-unavailable]").attr("hidden", true);
            }
        }
        if (!hasProducts && $form.attr("hidden") === undefined) {
            $form.attr("hidden", true);
            $empty.attr("hidden", false);
            if (isMobile) $topBar.attr("hidden", true);
        }
        else if (hasProducts && $empty.attr("hidden") === undefined) {
            $form.attr("hidden", false);
            $empty.attr("hidden", true);
            if (isMobile) $topBar.removeAttr("hidden");
        }
        return !hasProducts;
    }

    function btnAddDisplayMode() {
        const isNone = Cart.order.items_count == 0 ;
        
        if (isNone && !$btn.submit.attr("disabled")) { 
            $btn.submit.prop("disabled", true);
            if (isMobile) $(".tap-ba [data-basket-empaty]").attr("hidden", false);
        }
        else if (!isNone && $btn.submit.attr("disabled")) {
            $btn.submit.removeAttr("disabled");
            if (isMobile) $(".tap-ba [data-basket-empaty]").attr("hidden", true);
        }
    }

    async function notAvailableProducts(data, method) {
        function draw(products) {
            let html = "", removeIds = [], addIds = {};

            for (const key in products) {
                const order = products[key];

                const available = order.variant_quantity > 0 && order.product.available;
                const isPreorder = !available && EM_Module.func.checkPreorderChars(order.product.characteristics);
                const isSoon = !available && EM_Module.func.checkSoonCahrs(order.product.characteristics, order.product_url);

                if (available || isPreorder && !isSoon) {
                    if (UnavailableProducts.includes(order.product_id, order.variant_id)) {
                        UnavailableProducts.remove(order.variant_id);
                        if (!Cart.order.getItemByID(order.variant_id)) {
                            addIds[order.variant_id] = 1;
                        }
                    }
                    continue;
                }
                if (!UnavailableProducts.includes(order.product_id, order.variant_id)) {
                    UnavailableProducts.add(order.product_id, order.variant_id);

                    if (Cart.order.getItemByID(order.variant_id)) {
                        removeIds.push(order.variant_id);
                    }
                }
                if ($basket.find(`[data-replace-variant-id="${order.variant_id}"]`).length > 0) {
                    continue;
                }

                html += Template.render({
                    image: order.first_image?.large_url ?? "",
                    price: order?.sale_price,
                    title: order.title,
                    href: order.product_url ?? "/collection/all",
                    value: getSizeName(order.product?.variants ?? [], order.variant_id),
                    product_id: order.product_id,
                    variant_id: order.variant_id
                }, "product-not-available");
            }
            if (removeIds.length) {
                Cart.delete({
                    items: removeIds
                });
            }
            if (!$.isEmptyObject(addIds)) {
                Cart.add({
                    items: addIds
                });
            }
            return html;
        }

        btnAddDisplayMode();

        // ! Возможно убрать
        if (method != "add_items" && method != "update_items") return;
        loaderCart.call();

        const orders = (method == "update_items") ? data.order_lines : data.action?.currentItems;

        let html = "";
        // ! Подумать как сделать

        if (method == "update_items") {
            html += draw(await UnavailableProducts.getAjaxproducts());
        }
        html += draw(orders);
        // if (method == "update_items") html += draw(await UnavailableProducts.getAjaxproducts());
        // html += draw(orders);
        // html += draw(await UnavailableProducts.getAjaxproducts());

        // UnavailableProducts.save();
        UnavailableProducts.removeCart();

        if (method == "update_items") $cart.find("[data-disabled-list]").html(html);
        else $cart.find("[data-disabled-list]").append(html);

        $cart.find("[data-basket-disabled]").attr("hidden", !UnavailableProducts.count);

        setTimeout(() => {
            loaderCart.hide();
        }, 250);
        updateFavorites();
    }

    function drawProductsReplace(products) {
        if (!products.length) {
            $cart.find("[data-replace-products]").html("<span>Нет товаров для замены</span>");
            return;
        }
        let html = "";
        for (const product of products) {
            const variant = product.variants[0];
            if (!variant) continue;
            const priceBlock = variant.old_price && Number(variant.old_price) < Number(variant.price) ? 
                `<span class="products-item__price products-item__price_new">${Shop.money.format(variant.price)}</span>` +
                `<span class="products-item__price products-item__price_old">${Shop.money.format(variant.old_price)}</span>` : 
                `<span class="products-item__price">${Shop.money.format(variant.price)}</span>`;

            var note = "", first_variant = "",
                variants = [];

            for (const item of product.variants) {
                if (!item.available) continue;
                
                const title = item.option_values[0]?.title ?? "";
                if (item.quantity == 1) note += title + ", ";
                if (!first_variant.length && item.quantity != 0) first_variant = title;
                variants.push({
                    id: item.id,
                    title: title,
                    quantity: item.quantity,
                    inCart: Cart.order.getItemByID(item.id) !== undefined
                });
            }
            if (!first_variant.length) continue;
            const orderId = isInCart(product.variants);

            html += Template.render({
                id: product.id,
                variant_id: orderId ?? variant.id,
                title: product.title,
                url: product.url,
                image: product.first_image.filename === null ? null : product.first_image.large_url,
                price_block: priceBlock,
                first_variant: first_variant ? first_variant : "",
                isAdded: orderId ? ' _active' : '',
                values: variants,
                note: note ? `<div class="products-item__size-note">${ note.indexOf(",") > 3? `${note.slice(0, -2)} — последние размеры` : `${note.slice(0, -2)} — последний размер`}</div>` : ""
            }, "popup-not-available");
        }
        const replaceProducts = $cart.find("[data-replace-products]").get(0);

        if (!replaceProducts) return;
        replaceProducts.innerHTML = html.length > 0 ? html : "<span>Нет товаров для замены</span>";

        if (html.length == 0 ) $replace.find("a.popup__button").attr("href", "/collection/all");
        updateFavorites();

        setTimeout(() => {
            window.EM_Module.spollers(
                replaceProducts.querySelectorAll("[data-spollers]")
            );
            // document.dispatchEvent( new Event("initSpollers"));
        }, 250);
    }

    function productReplace() {
        const $product = $(this.closest("[data-replace-id]"));
        const product_id = $product.attr("data-replace-id");
        const varinat_id = $product.attr("data-replace-variant-id");
        const $title = $product.find(".basket-item__name");
        const url = $title.attr("href");
        
        let collection = "";
        for (const sub of url.split("/")) {
            if (sub == "collection") collection = sub;
            else if (collection == "collection") {
                collection = sub;
                break;
            }
        }
        if (!collection.length || collection == "collection" || collection == "skoro-v-prodazhe") collection = "all";
        if (!$product.length || !$replace.length || !product_id || !varinat_id) return;
        
        loader.call();

        $replace.find("[data-popup-replace-id]").attr("data-popup-replace-id", varinat_id);
        $replace.find(".popup__basket-item img:first").attr("src", $product.find("img:first").attr("src") ?? "");
        $replace.find(".popup-basket-item__name")
            .text($title.text())
            .attr("href",  `/collection/${collection}`);
        $replace.find(".popup-basket-item__price").text(Shop.money.format($product.attr("data-replace-price") ?? "0"));
        $replace.find(".popup-basket-item__size").text($product.find(".basket-item__size").text());

        if (currentCollection == collection) {
            loader.hide();
            return;
        }
        currentCollection = collection;
        $replace.find("a.popup__button").attr("href", `/collection/${collection}`);
        ajaxAPI.collection.get(collection, {}, {
            page_size: 20,
            page: 1
        }).done(function (response) {
            if (response.status === "ok") drawProductsReplace(response.products);
            else messageError("Ошибка получения товаров для замены, status: " + response.status ?? "");

            window.matchMedia("(min-width: 1023.99px)").matches
            if (
                !sliderReplace && window.matchMedia("(min-width: 1023.99px)").matches &&
                response?.products && response.products.length > 0
            ) {
                initReplaceSliders();
            }
            loader.hide();
        })
        .fail(function (onFail) {
            messageError(onFail);
            loader.hide();
        });
    }

    function certificateSubmit() {
        const sertificate = this.closest(".popup__content").querySelector('input[name="certificate"]')?.value;
        if (!sertificate) return;

        $cart.find("[data-certificate]").attr("hidden", false).find(".basket__info-certificate-text span").text(sertificate);
        $cart.find("[data-certificate-open]").attr("hidden", true);
        // $cart.find("[data-certificate-price]").text();
    }

    function removeCertificate() {
        $cart.find("[data-certificate]").attr("hidden", true).find(".basket__info-certificate-text span").text("");
        $cart.find("[data-certificate-open]").attr("hidden", false);
    }

    function onInputCoupon() {
        if (this.value.length > 0 && $btn.acceptPromo.attr("hidden") !== "false") {
            $btn.acceptPromo.attr("hidden", false);
        }
    }

    function acceptCoupon() {
        const coupon = this.closest(".form-promocode__actions").previousElementSibling?.value ?? "";

        if (coupon.length > 100) return;
        loader.callStatic($basketInfo);
        Cart.setCoupon({
            coupon: coupon
        });
    }

    function clearCoupon() {
        loader.callStatic($basketInfo);
        Cart.setCoupon({
            coupon: " "
        });
    }

    function updateCoupon(data) {
        const
            error = data.errors.join(";"),
            className = ["bsk-form-error", "bsk-form-success"],

            changeMess = (mess, flag=true, couponPrice) => {
                $message.text(mess).attr("hidden", false)
                    .addClass(className[Number(flag)])
                    .removeClass(className[Number(!flag)]);
                    
                const $summPromo = $basketInfo.find("[data-summ-promo]:first").attr("hidden", !flag);
                if (flag) {
                    $summPromo.find("span:last").text(couponPrice); 
                }
            };

        const $input = $basketInfo.find("[data-em-input-coupon]:first"),
            $login = $basketInfo.find("[data-coupon-login]:first"),
            $message = $basketInfo.find("[data-coupon-message]:first"),
            $btnAccept = $btn.acceptPromo,
            $btnClear = $btn.clearPromo;

        setTimeout(() => {
            loader.hideStatic($basketInfo);
        }, 350);
        if (data.coupon?.valid === undefined) {
            $input.val("").prop("disabled", false);
            $basketInfo.find("[data-summ-promo]:first").attr("hidden", true);
            $btnAccept.attr("hidden", true);
            $btnClear.attr("hidden", true);
            $message.attr("hidden", true);
            $login.attr("hidden", true);
            $input.removeClass("input-none");
            return;
        }
        // [edit]
        if (data.coupon.valid) {
            // const discount = data.discounts.find(discount => discount.description.includes(data.coupon.value))?.amount;
            const discount = data.discounts.find(discount => discount.reference_type == "DiscountCode")?.amount;
            changeMess("Промокод активирован", true, discount ? `- ${Shop.money.format(discount)}` : "Без скидки");
            $login.attr("hidden", true);
        }
        else if (error.includes("зарегистрировать")) {
            $message.attr("hidden", true);
            $login.attr("hidden", false);
        }
        else if (error.includes("несуществующий")) {
            changeMess("Такого промокода нет", false);
            $login.attr("hidden", true);
        }
        else {
            changeMess(error ? error : "Купон не применен", false);
            $login.attr("hidden", true);
        }
        $btnAccept.attr("hidden", true);
        $btnClear.attr("hidden", false);
        $input.addClass("input-none").prop("disabled", error.includes("зарегистрировать"));
    }

    function setDiscountInCart(discounts) {
        let amount = 0;
        for (const discount of discounts) {
            if (discount.reference_type !== "DiscountCode") {
                amount += discount.amount;
            } 
        }
        const $sale = $basketInfo.find("[data-cart-sale]:first");
        if (amount > 0) {
            $sale.find("span:last").text("- " + Shop.money.format(amount));

            if ($sale.is(":hidden")) $sale.attr("hidden", false)
        }
        else if (amount == 0 && !$sale.is(":hidden")) {
            $sale.attr("hidden", true);
        }
    }

    function updateCart(cart) {
        // console.log("updateCart", cart);
        if (countUpdate < 2) countUpdate++;
        
        setTimeout(() => {
            loaderQuantity.hide();
        }, 300);

        // changeParts(cart.total_price);
        setPayments(cart.total_price);

        if (cart.action.method === "clear_items") removeBtnActiveAll();
        else if (cart.action.method === "delete_items") removeBtnActive(cart.action?.items);
        // else if (data.action.method === "add_items") addBtnActive(data.action?.items);

        if (!cart || basketDisplayMode(cart.total_price)) return;
        else if (
            cart.action.method === "update_items" 
            || cart.action.method === "delete_items" 
            || cart.action.method === "add_items"
        ) {
            $cartCountItem.text(cart.positions_count + UnavailableProducts.count);
        }

        if (cart.action.method === "set_coupon" || cart.coupon !== undefined || countUpdate == 1) updateCoupon(cart);

        setDiscountInCart(cart.discounts);
        changeBasketHTML(cart);
        notAvailableProducts(cart, cart.action.method);
    }

    async function chareCart() {
        const $info = isMobile ? $cart.find(".service-message_mob:first") : $(this.nextElementSibling);
        var urlToCopy;
        
        if (!$info.length || $info.css("display") !== "none" || !isMobile && !$info.hasClass("basket__actions-share-text")) return;
        const $basketTop = $cart.find(".basket__grid:first");
        loader.callStatic($basketTop);
        urlToCopy = "testCopy";
        try {
            urlToCopy = (await $.ajax({
                url: '/front_api/cart/share.json',
                method: 'POST'
            }))?.shared_cart_link;
        } catch (error) {
            console.error('[Cart] Ошибка генерации ссылки "Поделиться корзиной":', error);
        }

        setTimeout(() => {
            loader.hideStatic($basketTop);
        }, 350);

        if (!urlToCopy) return;
        if(isMobile) {
            navigator.share({
                text: `Поделиться корзиной: \n`,
                url: urlToCopy
            });
        }
        try {
            window.navigator.clipboard.writeText(urlToCopy);
        } catch (error) {
            console.warn("[Cart] Ошибка копирование ссылки:", error)
        }
        
        const self = this;
        this.setAttribute("hidden", true);
        $info.fadeIn(250);
        setTimeout(() => {
            $info.fadeOut(250, function() {
                self.removeAttribute("hidden");
            });
        }, 3250);
    }

    var countPaits = 4;

    // Дата для оплаты Долями и Сплайтом
    function getDataForPayments(count) {
        let dataNew = new Date();

        return Array.from({ length: count }, (_) => {
            dataNew.setDate(dataNew.getDate() + 14);
            return dataNew.toLocaleString("ru", {
                month: 'short',
                day: 'numeric'
            }).replace(".", "");
        });
    }

    function setPaymentsSteps($blocks, data, totalPrice, maxCount = 4) {
        const priceParts = Shop.money.format(totalPrice / 4);
        let i = 0;

        for (const item of $blocks.find(".popup__parts-steps-item-text:not(:first)")) {
            const 
                title = item.querySelector(".popup__parts-steps-item-price"),
                span = item.querySelector("span");

            if (i >= maxCount) break;
            if (countPaits > 4 && i > 0) {
                $(item.closest(".popup__parts-steps"))
                    .find(".popup__plait-price_6:first .popup__parts-steps-item-price").text(
                        Shop.money.format((totalPrice - totalPrice / 4) / 5)
                    );
            }

            // span.innerHTML = data[i] + span.innerHTML;
            span.innerHTML = data[i];
            title.innerHTML = priceParts;
            i++;
        }
    }

    function setPayments(totalPrice=Cart.order.total_price) {
        const $partsCart = $cart.find("[data-cart-parts]:first");
        const $plaitCart = $cart.find("[data-cart-plait]:first");
        const $plait = $("#popup-plait");

        const data = getDataForPayments(4);

        setPaymentsSteps($partsCart, data, totalPrice, 4);
        setPaymentsSteps($plaitCart, data, totalPrice, 4);
        setPaymentsSteps($plait, data, totalPrice, 4);

        if ($partsCart.attr("hidden")) {
            $partsCart.removeAttr("hidden");
            $plaitCart.removeAttr("hidden");
        }
        const priceParts = Shop.money.format(totalPrice / 4);
        $partsCart.find(".popup__parts-steps-item-text:first .popup__parts-steps-item-price").text(priceParts);
        $partsCart.find("[data-cart-parts-title]").text("4 платежа по " + priceParts);

        $plaitCart.find(".popup__parts-steps-item-text:first .popup__parts-steps-item-price").text(priceParts);
        $plait.find(".popup__parts-steps-item-text:first .popup__parts-steps-item-price").text(priceParts);
    }

    function changePlait() {
        if (this.classList.contains("_active")) return;

        const btn = this.parentElement.querySelector("button._active");
        if (!btn) return;

        countPaits = btn.getAttribute("data-payplait-four") === null ? 4 : 6;

        this.classList.add("_active");
        btn.classList.remove("_active");

        const $btns = this.parentElement.getAttribute("data-payments-popup") === null
            ? $("[data-payments-popup]:first")
            : $("[data-payments-card]:first");
        
        const $btnActive = $btns.find("._active");
        $btns.find(":not(._active)").addClass("_active");
        $btnActive.removeClass("_active");

        const $bodyPopup = this.parentElement.getAttribute("data-payments-popup") === null
            ? $btns.closest(".popup__body")
            : $(this.closest(".popup__body"));
        const $bodyCard = $cart.find("[data-cart-plait]:first");

        // const $body = this.parentElement.getAttribute("data-payments-popup") === null
        //     ? $btns.closest(".popup__body")
        //     : $(this.closest(".popup__body"))
        
        if (countPaits == 4) {
            $bodyPopup.find(".popup__plait-steps:first")
                .removeClass("_active")
                .children().slice(-2).addClass("_steps-hidden");
            $bodyCard.find(".popup__plait-steps:first")
                .removeClass("_active")
                .children().slice(-2).addClass("_steps-hidden");
        }
        else {
            const price = Cart.order.total_price;

            $bodyPopup.find(".popup__plait-steps:first")
                .addClass("_active")
                .find("> ._steps-hidden").removeClass("_steps-hidden");
            $bodyCard.find(".popup__plait-steps:first")
                .addClass("_active")
                .find("> ._steps-hidden").removeClass("_steps-hidden");

            if (!isNaN(price)) {
                $bodyPopup.find(".popup__plait-price_6:first .popup__parts-steps-item-price").text(
                    Shop.money.format((price - price / 4) / 5)
                );
                $bodyCard.find(".popup__plait-price_6:first .popup__parts-steps-item-price").text(
                    Shop.money.format((price - price / 4) / 5)
                );
            }
        }
        // setPaymentsSteps($body, getDataForPayments(count), count);
    }

    // Блок доялми
    function changeParts(totalPrice) {
        const $parts = $cart.find("[data-cart-parts]:first");

        const data_new = new Date( $parts.attr("data-cart-parts") );
        if (!data_new) {
            $parts.attr("hidden", true);
            return;
        }

        if (totalPrice > 0) {
            const priceParts = Shop.money.format(totalPrice / 4);

            $parts.find(".popup__parts-steps-item-text:not(:first)").each(function() {
                const 
                    title = this.querySelector(".popup__parts-steps-item-price"),
                    span = this.querySelector("span");

                data_new.setDate(data_new.getDate() + 14);
                span.innerHTML = data_new.toLocaleString("ru", {
                    month: 'short',
                    day: 'numeric'
                }).replace(".", "");

                title.innerHTML = priceParts;
            });
            $parts.find(".popup__parts-steps-item-text:first .popup__parts-steps-item-price").text(priceParts);
            $parts.find("[data-cart-parts-title]").text("4 платежа по " + priceParts);
            $parts.removeAttr("hidden");
        }
        else if (totalPrice == 0 && $parts.attr("hidden") === undefined) {
            $parts.attr("hidden", true);
        }
    }

    function returnProduct() {
        var $product = $(this.closest(".basket__list-item"));
        if ($product.length != 1) return;

        $product.data("removeTimer", true);
        $product.removeClass("basket-item_deleted");
        $product.find(".basket-item__timer").attr("hidden", true);
        $product.find(".basket-item__actions, [data-em-quantity], .basket-item__buttons" + (isMobile ? ",.basket-item__last": "")).attr("hidden", false);
    }

    function deleteItem() {
        const variantId = this.dataset.cartDelete;
        const button = this;
        var $product = $(this.closest(".basket__list-item"));
        if (!variantId || $product.length != 1) return;

        button.disabled = true;
        $product.data("removeTimer", false);
        $product.addClass("basket-item_deleted");
        $product.find(".basket-item__timer").attr("hidden", false);
        $product.find(".basket-item__actions, [data-em-quantity], .basket-item__buttons" + (isMobile ? ",.basket-item__last": "")).attr("hidden", true);
        
        var i = 5, timer = $product.find(`.basket-item__timer span > span`).get(0);
        timer.innerText = i;
        var idTimer = setInterval(() => {
            i--;
            const isTimer = $product.data("removeTimer");
            if (i < 1 || isTimer) {
                clearInterval(idTimer);
                button.disabled = false;
            }
            if (i < 1 && !isTimer) {
                $product.remove();
                Cart.delete({
                    items: [variantId]
                });
                if ($product.attr("data-replace-id")) UnavailableProducts.remove(Number(variantId));
                $cart.find("[data-basket-disabled]").attr("hidden", UnavailableProducts.isEmpaty());
            }
            else timer.innerText = i;
        }, 1000);
    }

    function changeQuantity(input, $btnPlus, $message, quantity) {
        let newQuantity;

        if (isNaN(quantity.current) || isNaN(quantity.new) || isNaN(quantity.max)) {
            $message.text("Ошибка изменений");
            $message.fadeIn(250, () => {
                setTimeout(() => $message.fadeOut(350), 3000);
            });
            return;
        }
        
        if (quantity.new < 1) {
            input.closest(".basket-item__body").querySelector("[data-cart-delete]")?.dispatchEvent(new Event("click", {bubbles: true}));
            $message.fadeOut(250);
            return;
        }
        if (quantity.max < 1) {
            if (quantity.new != 1) input.value = 1;
            $message.fadeOut(250);
            return;
        }
        if (quantity.new > quantity.max) {
            newQuantity = quantity.max;

            if ($message.css("display") === "none") {
                $message.text("Вы достигли максимума для выбора");
                $message.fadeIn(250, () => {
                    setTimeout(() => $message.fadeOut(350), 3000);
                });
            }
        }
        else {
            newQuantity = quantity.new;
            if ($message.css("display") !== "none") {
                $message.fadeOut(250);
            }
        }
        if (quantity.new >= quantity.max) {
            $btnPlus.prop("disabled", true);
        }
        else if ($btnPlus.attr("disabled")) {
            $btnPlus.removeAttr("disabled");
        }
        const variant_id = Number(input.closest("[data-item-id]").getAttribute("data-item-id"));
        if (newQuantity != quantity.current && variant_id) {
            Cart.set({
                items: {[variant_id]: newQuantity}
            });
            input.value = newQuantity;
            loaderQuantity.call();
        }
        // if (this.isMobile) {
        //     this.$carts.find()
        // }
    }

    // Ввод кол-во товара
    function onBlurQuantity(event) {
        const input = event.currentTarget;
        const value = getInputValue(input.value);
        let currentQuantity = Number(input.dataset.emCurrentQuantity);

        if (isNaN(currentQuantity)) {
            currentQuantity = value;
        }
        else {
            input.dataset.emCurrentQuantity = value;
        }

        const $quantityWrapper = $(input.closest("[data-em-quantity]"));
        changeQuantity(
            input,
            $quantityWrapper.find(".quantity__button_plus"),
            $quantityWrapper.find(".basket-item__max-quantity"),
            {
                current: currentQuantity,
                new: value,
                max: Number(input.dataset.maxQuantity)
            }
        );
    }

    // Изменение кол-во товара через кнопки
    function onClickBtnQuantity(event) {
        // data-em-quantity-change
        const input = event.currentTarget.parentElement.querySelector("input");

        if (!input) return;

        const deff = Number(this.dataset.emQuantityChange ?? 0);
        const value = getInputValue(input.value);
        
        const $quantityWrapper = $(input.closest("[data-em-quantity]"));
        changeQuantity(
            input,
            $quantityWrapper.find(".quantity__button_plus"),
            $quantityWrapper.find(".basket-item__max-quantity"),
            {
                current: value,
                new: value + deff,
                max: Number(input.dataset.maxQuantity) 
            }
        );
    }


    function getInputValue(value) {
        return Number(value.replace(/[A-Za-zА-Яа-яЁё]/, ''));
    }

    function changeInputReplace() {
        const button = this.closest(".products-item__basket-wrapper")?.querySelector("[data-replace-in-cart]");

        if (!button) return;
        if (!this.checked || !this.value) {
            button.classList.remove("_active");
            return;
        }
        if (this.closest(".checkbox-btn__label").classList.contains("checkbox-item__circle")) {
            button.classList.add("_active");
        }
        else {
            button.classList.remove("_active");
        }
        button.dataset.replaceInCart = this.value;
        const buttonClose = this.closest(".products-item__size-wrapper")?.querySelector(".products-item__size-title");
        if (buttonClose && buttonClose.classList.contains("_spoller-active")) {
            buttonClose.dispatchEvent(new Event("click", {bubbles: true}));
        }
    }

    function onPopupTouchStart(e) {
        startY = e.touches[0].clientY;
        closeReady = false;
    }
    
    function onPopupTouchMove(e) {
        if (e.currentTarget.scrollTop === 0 && e.touches[0].clientY - startY > 50 && !closeReady) {
            e.currentTarget.previousElementSibling.click();
            closeReady = true;
        }
    }

    function scrollPopupReplace(e) {
        const body = e.currentTarget;

        if (body.scrollTop < 100) {
            body.offsetParent.classList.remove("_popup-stretch");
        }
        else {
            body.offsetParent.classList.add("_popup-stretch");
        }
    }

    // Инициализация слайдера попапа замены
    function initReplaceSliders() {
        const wrapper = document.querySelector("#popup-replace .popup__products-list-wrapper");
        if (!wrapper) return;

        sliderReplace = new Swiper(wrapper.querySelector(".popup__products-list"), {
            observer: true,
            observeParents: true,
            slidesPerView: 4,
            spaceBetween: 0,
            slidesPerGroup: 4,
            speed: 800,
            watchSlidesProgress: true,
            navigation: {
                prevEl: wrapper.querySelector(".popup__products-list-arrow_left"),
                nextEl: wrapper.querySelector(".popup__products-list-arrow_right")
            }
        });

        wrapper.classList.remove("_hidden-btn");
    }

    // document.addEventListener("beforePopupOpen", function(e) {
    //     // && e.detail.popup?.targetOpen?.element
    //     if (!initedSlider && e.detail.popup.hash == "#popup-replace") {
    //         initReplaceSliders();
    //     }
    // });

    // Выбор платежа в плайте
    $(".btn_payment").on("click", changePlait);

    $btn.acceptPromo.on("click", acceptCoupon);
    $btn.clearPromo.on("click", clearCoupon);
    $basketInfo.find("[data-em-input-coupon]").on("change", onInputCoupon);

    $cart.on("click", "[data-cart-delete]", deleteItem);
    $cart.on("click", "[data-return-product]", returnProduct);
    $cart.on("click", '[data-popup="#popup-replace"]', productReplace);
    $cart.find("[data-share]").on("click", chareCart);
    $cart.find(".basket__list:first")
        .on("click", '[data-em-quantity-change]', onClickBtnQuantity)
        .on("blur", '.quantity__input input', onBlurQuantity)
        .on("keydown", '.quantity__input input', function(e) {
            if (e.key === 'Enter') e.preventDefault(); 
        });
    
    $replace.find(".popup__products-list").on("click", '[data-replace-in-cart]:not(._disabled)', onReplaceInCart);
    window.matchMedia("(min-width: 1023.99px)").addEventListener("change", (e) => {
        if (e.target.matches && !sliderReplace) {
            initReplaceSliders();
        }
        else if (!e.target.matches && sliderReplace) {
            sliderReplace.destroy(true, true);
            sliderReplace = null;
        }
    });

    $cart.find("[data-remove-certificate]").on("click", removeCertificate);
    $cart.find("[data-certificate-submit]").on("click", certificateSubmit);
    $cart.find("[data-cart-clear-all]").on("click", function() {
        UnavailableProducts.clear();
        Cart.clear();
        $cart.find(".basket__list-group:first .basket__list").html("");
    });

    // $replace.find(".popup__body").get(0).addEventListener("scroll", scrollPopupReplace)
    $replace.find(".popup__products-list-body").on("change", "input.checkbox-btn__input", changeInputReplace);
    $btn.submit.on("click", function() {
        // $cart.find("[data-cart-submit]").trigger("click");
        loader.callStatic($cart.find("form.basket__grid").trigger("submit"));
    });
    if (isMobile) {
        $replace.find(".popup__body")
            .on("scroll", scrollPopupReplace)
            .on("touchstart", onPopupTouchStart)
            .on("touchmove", onPopupTouchMove);

    }
    // $cart.find('#popup-certificate input[name="certificate"]').on("input", inputCertificate);
    
    EventBus.subscribe('update_items:insales:cart', updateCart);

    EventBus.subscribe("eventLoader", function () {
        loader = new EM_Module.Loader($replace.find('.popup__body'));
        loaderCart = new EM_Module.Loader($cart.find('.basket__list-wrapper:first'));
        loaderQuantity = new EM_Module.Loader($cart.find('[data-cart-parts]'));

        EM_Module.Badges.renderBadgesInHTML($basket);
    });

    EventBus.subscribe('send-feedback:insales:ui_feedback', function (data) {
        console.log('[Сертификат] Форма успешно отправлена', data);
    });

    EventBus.subscribe('error-feedback:insales:ui_feedback', function (data) {
        console.warn('[Сертификат] Ошибка отпарвки формы', data);
        alert("Ошибка отпарвки сертификата");
    });
    // updateCart(Cart.order.get());

    // Временный код
    // $cart.find("[data-empaty-products]").on("click", function() {
    //     Cart.add({
    //         items: {
    //             1979259065: 1,
    //             1929918593: 1, // product id: 1639432785
    //             // Недоступны
    //             // 771898886: 1,
    //             // 732686004: 1
    //         },
    //     });
    // });
});