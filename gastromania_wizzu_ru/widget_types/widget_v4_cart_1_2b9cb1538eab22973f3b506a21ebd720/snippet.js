$(document).ready(function () {
    MicroModal.init({
        disableFocus: true,
        disableScroll: true,
        // onShow: ,
        onClose: function (modal, element, event) {
            event.preventDefault();
            event.stopPropagation();
        },
    });

    // Функция для правильного определения формы слов в зависимости от количества
    function declinationText(number, txt) {
        var cases = [2, 0, 1, 1, 1, 2];
        return txt[number % 100 > 4 && number % 100 < 20 ? 2 : cases[number % 10 < 5 ? number % 10 : 5]];
    }

    $widget.each(function (index, el) {
        const cartItems = $(el).find('.cart-item');
        cartItems.each(function () {
            const reviewsCount = parseInt($(this).find('.review-count').text(), 10);

            let reviewForm1 = $(this).data('form-word-review-1');
            let reviewForm2 = $(this).data('form-word-review-2');
            let reviewForm3 = $(this).data('form-word-review-3');

            let reviewText = declinationText(reviewsCount, [reviewForm1, reviewForm2, reviewForm3]);
            $(this).find('.review-text').text(reviewText);
        });
    });

    $widget.each(function () {
        initAccessoriesExpander(this);
    })

    const $removeCouponBtn = $widget.find('[data-remove-coupon]');

    $removeCouponBtn.on('click', function (e) {
        e.preventDefault();

        Cart.setCoupon({ coupon: ' ' });
        $(this).parents('.coupon-input').find('input').val('');
        $(this).removeClass('show-btn');
    })

    var $btnClear = $widget.find("[data-cart-clear-all]");

    $btnClear.on("click", () => {
        if (Cart.order.items_count > 0) {
            Cart.clear();
            setTimeout(() => {
                window.location.reload();
            }, 150);
        }
    });

    EventBus.subscribe('update_items:insales:cart', function (cart) {
        if (cart.coupon) {
            $removeCouponBtn.addClass('show-btn')
        }
        if (cart.items_count == 0 && $btnClear.attr("hidden") === undefined) {
            $btnClear.attr("hidden", true);
        }
        else if (cart.items_count > 0 && $btnClear.attr("hidden") !== undefined) {
            $btnClear.removeAttr("hidden");
        }
    });

    $widget.find(".js-item-delete").on("click", function () {
        $(this).parents('.cart-item:first').slideUp(300, function () {
            $(this).remove();
        });
    });

    EventBus.subscribe('delete_items:insales:cart', function (data) {
        var $emptyMessage = $widget.find('.js-cart-empty');
        var $cartForm = $widget.find('[data-cart-form]');
        if (data.order_lines.length == 0) {
            $cartForm.addClass('hidden');
            $emptyMessage.removeClass('hidden');
        }
    });

    EventBus.subscribe('add_items:insales:cart', function () {
        window.location.reload();
    });

    EventBus.subscribe('remove_items:insales:cart', function () {
        window.location.reload();
    });

    $widget.find("input.cart__not-item__input").on("change", function() {
        $(this).closest(".cart__not-list").find(".checked-label").removeClass("checked-label");
        if (this.checked) {
            this.closest(".cart__not-item").classList.add("checked-label");
        }
        Cookies.set("em_product-unavailable", this.value);
        checkingDistrict();

        // $("[data-cart-submit]:first").text("Оформить заказ").prop("disabled", false);
        // $("#cart__message-error").attr("hidden", true);
    });

    try {
        if (Cookies.get("em_product-unavailable")) {
            const $input = $widget.find(`.cart__not-item__input[value="${Cookies.get("em_product-unavailable")}"]:first`);

            if ($input.length > 0) {
                $input
                    .prop("checked", "checked")
                    .closest(".cart__not-item").addClass("checked-label");
            }
        }
    }
    catch (err) {
        if (window.liveScript) window.liveScript.trackCustomEvent("[Cart] Error in em_product-unavailable", {
            message: err?.message,
            filename: err?.filename,
            lineno: err?.lineno,
            colno: err?.colno,
            stack: err?.error?.stack || null,
        });
        // console.warn(err);
    }

    // [EM] Дополнение
    var cartInit = false;

    function scrollToControls() {
        if (!window.matchMedia('(max-width: 900px)').matches) return;

        const $cartControls = $(".cart__area-controls");

        if ($cartControls.length > 0) {
            setTimeout(() => {
                $('html, body').animate({
                    scrollTop: $cartControls.offset().top - 60
                }, 450);
            }, 150);
        }
        else {
            console.warn("[Cart] Элемент '.cart__area-controls' не найден");
        }
    }

    const $btnAcceptPromo = $widget.find("[data-coupon-submit]:first");
    
    $widget.find("input[name='cart[coupon]']:first").on("input", function() {
        if (this.value.length) {
            $btnAcceptPromo.removeAttr("disabled");
        }
        else {
            $btnAcceptPromo.attr("disabled", true);
        }
    });

    EventBus.subscribe('update_items:insales:cart', function (cart) {
        if (cart.coupon && cart.coupon.value.length) {
            $btnAcceptPromo.removeAttr("disabled");
        }
        else {
            $btnAcceptPromo.attr("disabled", true);
        }
        if (!cartInit) {
            cartInit = true;
            scrollToControls();
        }
    });

    const minItemsPrice = Number(
        $("[data-minimum-items-price]:first").attr("data-minimum-items-price") ?? "0"
    );

    var isInit = false;

    function checkingDistrict() {
        const $btnCartSubmit = $("[data-cart-submit]:first");

        if (!isInit) {
            isInit = true;
            $btnCartSubmit
                .attr("type", "submit")
                .removeAttr("data-popup")
                .text("Оформить заказ");
        }
            
        if (minItemsPrice === undefined || isNaN(minItemsPrice)) {
            $btnCartSubmit.prop("disabled", false);
            return;
        }
        
        // Cookies.get("selected_delivery_zone")?.length > 5 || 

        try {
            if (Cart.order.total_price < minItemsPrice) {
                $btnCartSubmit.prop("disabled", true);
                $("#cart__message-error")
                    .text(`Минимальная сумма заказа ${Shop.money.format(minItemsPrice)}, добавьте еще товаров`)
                    .attr("hidden", false);
            }
            else if (Cookies.get("em_product-unavailable")) {
                $btnCartSubmit.prop("disabled", false);
                $("#cart__message-error").attr("hidden", true);
            }
            else {
                $btnCartSubmit.prop("disabled", true);
                $("#cart__message-error")
                    .text("Отметьте, что нам делать, если товара не будет в наличии")
                    .attr("hidden", false);
            }
        }
        catch (err) {
            if (window.liveScript) window.liveScript.trackCustomEvent("[Cart] Error in checkingDistrict", {
                message: err?.message,
                filename: err?.filename,
                lineno: err?.lineno,
                colno: err?.colno,
                stack: err?.error?.stack || null,
            });
            // console.warn("[Cart] Error:", err);
            
            $btnCartSubmit.prop("disabled", false);
            $("#cart__message-error").attr("hidden", true);
        }
    }

    setTimeout(checkingDistrict, 150);

    if (minItemsPrice && !isNaN(minItemsPrice)) {
        EventBus.subscribe('update_items:insales:cart', checkingDistrict);
    }
});

function initAccessoriesExpander(thisWidget) {
    const cartItems = Array.from(thisWidget.querySelectorAll('[data-item-id]'));

    cartItems.forEach(cartItem => {
        const accessories = cartItem.querySelector('[data-item-accessories]');
        if (!accessories) { return; }

        const accessoriesExpander = accessories.querySelector('.item-accessories__expander');
        if (!accessoriesExpander) { return; }

        const accessoryItems = accessories.querySelector('.item-accessories__items');
        if (!accessoryItems) { return; }

        // Изначально измеряем высоту скрытого элемента
        accessoryItems.style.maxHeight = 'none';
        let fullHeight = accessoryItems.scrollHeight + "px";
        accessoryItems.style.maxHeight = '0';

        accessoriesExpander.addEventListener('click', (e) => {
            e.preventDefault();

            // Переключаем класс для иконки
            const iconUp = accessories.querySelector('.icon.icon-sort-asc');
            const iconDown = accessories.querySelector('.icon.icon-sort-desc');
            if (iconUp && iconDown) {
                iconUp.classList.toggle('hidden');
                iconDown.classList.toggle('hidden');
            }

            // Анимируем раскрытие/закрытие
            if (accessoryItems.style.maxHeight === '0px') {
                accessoryItems.style.maxHeight = fullHeight;
                accessoryItems.classList.toggle('is-hidden');
            } else {
                accessoryItems.style.maxHeight = '0';
                accessoryItems.classList.toggle('is-hidden')
            }
        });
    });
}

$(document).ready(function () {
    const currentWidget = document.querySelector(widget);
    const copyButtons = currentWidget.querySelectorAll('.js-copy-url');
    const cartItems = Array.from(currentWidget.querySelectorAll('.item-title'));
    const shopTitleNode = currentWidget.querySelector('[data-shop-title]');
    const shopHostNode = currentWidget.querySelector('[data-shop-host]');
    const itemsInCartNode = currentWidget.querySelector('[data-items-in-cart]');
    const dataShareItemsNode = currentWidget.querySelector('[data-share-items]');
    const shopTitle = shopTitleNode ? shopTitleNode.getAttribute('data-shop-title') : '';
    const shopHost = shopHostNode ? shopHostNode.getAttribute('data-shop-host') : '';
    const itemsInCart = itemsInCartNode ? itemsInCartNode.getAttribute('data-items-in-cart') : '';
    const dataShareItems = dataShareItemsNode ? dataShareItemsNode.getAttribute('data-share-items') : '';

    function isMobileDevice() {
        const mobileWidthThreshold = 768;
        const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        return screenWidth < mobileWidthThreshold;
    }

    function allProductName() {
        let allProductName = '';
        cartItems.forEach((cartItem) => {
            const productName = cartItem.text.trim();
            const productLink = cartItem.getAttribute('href');
            if (!productName) {
                return;
            }
            allProductName += `${productName} - ${shopHost}${productLink}\n`;
        })
        return `${itemsInCart} ${allProductName} \n`;
    }

    function copyLink(link) {
        let inputElement = document.querySelector('.shared-cart-link');
        inputElement.value = link;
        navigator.clipboard.writeText(inputElement.value);
    }
    copyButtons.forEach(function (button) {
        button.addEventListener('click', async () => {
            try {
                const data = await $.ajax({
                    url: '/front_api/cart/share.json',
                    method: 'POST'
                });
                const urlToCopy = data.shared_cart_link;
                const shareData = {
                    text: `${dataShareItems} ${shopTitle}: \n`,
                    url: urlToCopy
                };
                if (isMobileDevice()) {
                    navigator.share(shareData).then(() => EventBus.publish('copy:link:insales'));
                } else {
                    copyLink(urlToCopy);
                    EventBus.publish('copy:link:insales');
                }
            } catch (error) {
                console.error(error);
            }
        });
    });
});