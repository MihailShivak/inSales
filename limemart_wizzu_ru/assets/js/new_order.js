document.addEventListener("DOMContentLoaded", function() {
    console.log("[EM_order] Start...");
    const $orderForm = $("#order_form");

    var actionDoor = "";
    // const isMobile = sessionStorage.getItem('isMobile') === "true";

    // ajaxAPI.shop.client.get()
    //     .done(function (client) {
    //         if (!client?.authorized) {
    //             window.location.pathname = "/client_account/orders";
    //         }
    //     })
    //     .fail(function () {
    //         window.location.pathname = "/client_account/orders";
    //     });

    /* Старая логика
    const $addressInput = $("textarea[name='shipping_address[address]']");

    $addressInput.attr("data-popup", "#popup-map");
    if (Cookies.get("map_address")) {
        $addressInput.val(Cookies.get("map_address"));
    }
    */

    function getStoredZone() {
        try {
            const stored = Cookies.get("selected_delivery_zone");
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Ошибка чтения сохраненной зоны:', error);
            return null;
        }
    }

    function setZone() {
        const zone = getStoredZone();
        if (zone.name && Cookies.get("app_hide") !== "true") {
            $orderForm.find("label[for='shipping_address_field_95893505']")
                .css("display", "block");
            $orderForm.find("#shipping_address_field_95893505")
                .css("display", "block")
                .val(zone.name);
        }
    }

    // ! Выключили
    function setDoorPrice(isDoor) {
        const 
            door = Cart.order.getItemByID(1823943729),
            $price = $(".order__total:first");

        if (isDoor && door !== undefined) {
            if (actionDoor == "set") {
                const $totalPrice = $price.find("#total_price");
                const newTotalPrice = window.EM_Module.props.parseFormattedPrice($totalPrice.text());

                if (newTotalPrice && !isNaN(newTotalPrice)) {
                    $totalPrice
                        .text(
                            Shop.money.format(newTotalPrice + door.total_price)
                        );
                }
            }
            $price.find("#em-price__door")
                .removeAttr("hidden")
                .find("span:last").text(Shop.money.format(door.total_price));
        }
        else {
            if (actionDoor == "del") {
                const $totalPrice = $price.find("#total_price");
                const newTotalPrice = window.EM_Module.props.parseFormattedPrice($totalPrice.text());

                if (newTotalPrice && !isNaN(newTotalPrice)) {
                    $totalPrice.text(
                        Shop.money.format(newTotalPrice < 59 ? 0 : newTotalPrice - 59)
                    );
                }
            }

            $price.find("#em-price__door")
                .attr("hidden", true)
                .find("span:last").text(Shop.money.format(0));
        }
    }

    function changeOrderDoor(isDoor) {
        $orderForm.find(
            ".co-input--entrance:first," +
            ".co-input--flat:first, .co-input--floor:first, .co-input--intercom:first"
        ).attr("hidden", !isDoor);
        $orderForm.find(".co-input--entrance").css("margin-right", isDoor ? "1rem" : "0");

        if (!isDoor) {
            $orderForm.find(
                ".co-input--entrance:first," +
                ".co-input--floor:first .co-input-field, .co-input--intercom:first .co-input-field, input[name='shipping_address[flat]']:first"
            ).val("");
        }
        $orderForm.find(".co-input--type-delivery .co-input-field:first").val(isDoor ? "Поднять до двери" : "Оставить у ворот");
    }

    function cheangeProductDoor(isDoor) {
        const isDoorInOrder = Cart.order.getItemByID(1823943729) !== undefined;
        if (isDoorInOrder) {
            Cart.delete({
                items: [1823943729]
            });
        }
        // !Выключили доставку до двери
        // if (isDoor) {
        //     if (!isDoorInOrder) {
        //         actionDoor = "set";
        //         Cart.set({
        //             items: {
        //                 1823943729: 1
        //             }
        //         });
        //     }
        // }
        // else if (isDoorInOrder) {
        //     actionDoor = "del";
        //     Cart.delete({
        //         items: [1823943729]
        //     });
        // }
    }

    function chekedInput() {
        $(this).closest(".co-input--radio").find(".checked-label").removeClass("checked-label");
        if (this.checked) {
            this.closest("label").classList.add("checked-label");

            // Смена доставки
            if (this.getAttribute("data-delivery-id") !== null) {
                $orderForm.find("#em_message-delivery").attr(
                    "hidden", 
                    this.getAttribute("data-delivery-map-zones") === null
                );
            }
            // Смена доставки до двери
            else if (this.classList.contains("order__door-input")) {
                changeOrderDoor(this.value === "true");
                localStorage.setItem("cheked-door", this.value === "true");

                // cheangeProductDoor(this.value === "true");
            }
        }
    }

    function getRadioToDoorHTML() {
        const isDoor = localStorage.getItem("cheked-door") === "true";

        changeOrderDoor(isDoor);
        // setDoorPrice(isDoor);
        // cheangeProductDoor(isDoor);

        return `<div class="order__delivery-door co-input--radio">
            <label for="door-radio_gates" class="order__door-item ${isDoor ? "" : "checked-label"}">
                <span class="order__door-radio">
                    <input class="order__door-input" type="radio" id="door-radio_gates" name="custom[door]" value="false" ${isDoor ? "" : "checked"} hidden>
                    <span></span>
                </span>
                <div class="order__door-item__title">
                    Оставить у ворот
                </div>
            </label>
            <label for="door-radio_door" class="order__door-item ${isDoor ? "checked-label" : ""}">
                <span class="order__door-radio">
                    <input class="order__door-input" type="radio" id="door-radio_door" name="custom[door]" value="true" ${isDoor ? "checked" : ""} hidden>
                    <span></span>
                </span>
                <div class="order__door-item__title">
                    Поднять до двери
                </div>
            </label>
        </div>`;
    }
    
    function getMessageDeliveryHTML(isHidden) {
        return `<div class="order_message-delivery" ${isHidden ? "hidden" : ""} id="em_message-delivery">
            <div class="co-input-label">Что нужно знать о доставке?</div>
            <div class="order_message-list">
                <div class="order_message-item">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.33497 16.223C8.21997 16.223 9.47247 15.6005 10.4625 12.623L11.0025 11.003L12.6225 10.463C15.5925 9.47298 16.215 8.22048 16.215 7.33548C16.215 6.45798 15.5925 5.19798 12.6225 4.20048L6.25497 2.07798C4.66497 1.54548 3.33747 1.70298 2.51997 2.51298C1.70247 3.32298 1.54497 4.65798 2.07747 6.24798L4.19997 12.6155C5.19747 15.6005 6.44997 16.223 7.33497 16.223ZM12.27 5.27298C14.355 5.97048 15.0975 6.79548 15.0975 7.33548C15.0975 7.87548 14.355 8.70048 12.27 9.39048L10.38 10.0205C10.215 10.073 10.08 10.208 10.0275 10.373L9.39747 12.263C8.70747 14.348 7.87497 15.0905 7.33497 15.0905C6.79497 15.0905 5.96997 14.348 5.27247 12.263L3.14997 5.89548C2.76747 4.74048 2.83497 3.79548 3.32247 3.30798C3.80997 2.82048 4.75497 2.76048 5.90247 3.14298L12.27 5.27298Z" fill="#646464"/>
                    <path d="M10.4174 10.8C10.5599 10.8 10.7024 10.7475 10.8149 10.635C11.0324 10.4175 11.0324 10.0575 10.8149 9.84L8.1299 7.1475C7.9124 6.93 7.5524 6.93 7.3349 7.1475C7.1174 7.365 7.1174 7.725 7.3349 7.9425L10.0199 10.635C10.1249 10.7475 10.2749 10.8 10.4174 10.8Z" fill="#646464"/>
                    </svg>
                    <p>Ниже приведена карта с зонами доставки. Нажмите кнопку <strong>Найти</strong> и появится поисковая строка. В ней <strong>укажите вашу улицу и номер дома</strong></p>
                </div>
                <div class="order_message-item">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 17.0628C6 17.0628 3.5625 14.9103 3.5625 12.2628V9.48779C3.5625 9.18029 3.8175 8.92529 4.125 8.92529C4.4325 8.92529 4.6875 9.18029 4.6875 9.48779C4.6875 11.4528 6.54 12.9378 9 12.9378C11.46 12.9378 13.3125 11.4528 13.3125 9.48779C13.3125 9.18029 13.5675 8.92529 13.875 8.92529C14.1825 8.92529 14.4375 9.18029 14.4375 9.48779V12.2628C14.4375 14.9103 12 17.0628 9 17.0628ZM4.6875 12.3453C4.74 14.3328 6.6525 15.9378 9 15.9378C11.3475 15.9378 13.26 14.3328 13.3125 12.3453C12.3375 13.4028 10.7925 14.0628 9 14.0628C7.2075 14.0628 5.67 13.4028 4.6875 12.3453Z" fill="#646464"/>
                    <path d="M9 10.3125C6.93 10.3125 5.06999 9.3825 4.16249 7.8825C3.77249 7.245 3.5625 6.5025 3.5625 5.7375C3.5625 4.4475 4.14 3.2325 5.1825 2.3175C6.2025 1.425 7.56 0.9375 9 0.9375C10.44 0.9375 11.79 1.425 12.8175 2.31C13.86 3.2325 14.4375 4.4475 14.4375 5.7375C14.4375 6.5025 14.2275 7.2375 13.8375 7.8825C12.93 9.3825 11.07 10.3125 9 10.3125ZM9 2.0625C7.83 2.0625 6.73501 2.4525 5.91751 3.1725C5.12251 3.8625 4.6875 4.7775 4.6875 5.7375C4.6875 6.3 4.83749 6.825 5.12249 7.2975C5.83499 8.4675 7.32 9.1875 9 9.1875C10.68 9.1875 12.165 8.46 12.8775 7.2975C13.17 6.825 13.3125 6.3 13.3125 5.7375C13.3125 4.7775 12.8775 3.8625 12.075 3.1575C11.2575 2.4525 10.17 2.0625 9 2.0625Z" fill="#646464"/>
                    <path d="M9 14.0625C5.9025 14.0625 3.5625 12.0975 3.5625 9.4875V5.7375C3.5625 3.09 6 0.9375 9 0.9375C10.44 0.9375 11.79 1.425 12.8175 2.31C13.86 3.2325 14.4375 4.4475 14.4375 5.7375V9.4875C14.4375 12.0975 12.0975 14.0625 9 14.0625ZM9 2.0625C6.6225 2.0625 4.6875 3.7125 4.6875 5.7375V9.4875C4.6875 11.4525 6.54 12.9375 9 12.9375C11.46 12.9375 13.3125 11.4525 13.3125 9.4875V5.7375C13.3125 4.7775 12.8775 3.8625 12.075 3.1575C11.2575 2.4525 10.17 2.0625 9 2.0625Z" fill="#646464"/>
                    </svg>
                    <p>Автоматически будет рассчитана <strong>стоимость и зона доставки</strong>, к которой относится ваш адрес</p>
                </div>
                <div class="order_message-item">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.00001 17.07C7.89001 17.07 6.77251 16.65 5.90251 15.8175C3.69001 13.6875 1.24501 10.29 2.16751 6.2475C3.00001 2.58 6.20251 0.9375 9.00001 0.9375C9.00001 0.9375 9.00001 0.9375 9.00751 0.9375C11.805 0.9375 15.0075 2.58 15.84 6.255C16.755 10.2975 14.31 13.6875 12.0975 15.8175C11.2275 16.65 10.11 17.07 9.00001 17.07ZM9.00001 2.0625C6.81751 2.0625 4.01251 3.225 3.27001 6.495C2.46001 10.0275 4.68001 13.0725 6.69001 15C7.98751 16.2525 10.02 16.2525 11.3175 15C13.32 13.0725 15.54 10.0275 14.745 6.495C13.995 3.225 11.1825 2.0625 9.00001 2.0625Z" fill="#646464"/>
                    <path d="M8.06246 10.3126C7.91996 10.3126 7.77746 10.2601 7.66496 10.1476L6.53996 9.02258C6.32246 8.80508 6.32246 8.44508 6.53996 8.22758C6.75746 8.01008 7.11746 8.01008 7.33496 8.22758L8.06246 8.95508L10.665 6.35258C10.8825 6.13508 11.2425 6.13508 11.46 6.35258C11.6775 6.57008 11.6775 6.93008 11.46 7.14758L8.45996 10.1476C8.34746 10.2601 8.20496 10.3126 8.06246 10.3126Z" fill="#646464"/>
                    </svg>
                    <p>Если не получается найти нужный адрес или он не попадает в зону доставки на карте, то <strong>напишите в службу поддержки</strong> по номеру, указанному в разделе Контакты</p>
                </div>
            </div>
        </div>`;
    }

    var address = {
        stree: "",
        house: ""
    };

    function changeCash() {
        const value = Number(this.value);
        const $input = $orderForm.find(".co-input--cash-change:first .co-input-field:last");
        if (!this.value.length || isNaN(value)) {
            $input.val("");

            this.setCustomValidity(
                isNaN(value) ? "Неверный формат!" : "Укажите '0' если сдача не требуется"
            );
            this.reportValidity();
            this.focus();
        }
        else {
            this.value = value;
            $input.val(value);
            this.setCustomValidity('');
        }
    }

    function inputAddress(input) {
        if (input.id === "shipping_address_street") {
            address.stree = input.value;
        }
        else {
            address.house = input.value;
        }
        const value = `${address.stree ? address.stree : ""}${address.stree && address.house ? ", " + address.house : ""}`;
        $orderForm.find("#em-address")
            .val(value.length > 0 ? value : "в поле Найти укажите улицу и номер дома на карте выше")
            .css("color", value.length > 0 ? "" : "red");
    }

    function setHTMLBlocks() {
        const productUnavailable = Cookies.get("em_product-unavailable");

        $orderForm.find(".co-input--product-unavailable > input.co-input-field").val(
            productUnavailable == "change-on-any" ? "Позвонить для замены" : "Заменить самостоятельно" 

        );

        // em-cash-change
        $orderForm.find(".co-payment_method-list:first").after(
            `<input class="co-input-field js-input-field" autocomplete="off" id="em-cash-change" value="" name="em-cash-change" type="number" min="0" max="120000" placeholder="Укажите с какой суммы нужна сдача">`
        );

        const street = $orderForm.find("#shipping_address_street").val();
        const house = $orderForm.find("#shipping_address_house").val();

        $orderForm.find(".delivery_variants:first").after(
            `<div class="co-input co-input--required co-input--text em-input--address  co-input--nested">
                <label class="co-input-label" for="em-address">Ваш адрес</label>
                <textarea class="em-text__input" name="em-address" id="em-address" autocomplete="off" value="${street}${street && house ? ", " + house : ""}" style="color: red;">в поле Найти укажите улицу и номер дома на карте выше</textarea>
            </div>`
        );

        $orderForm.find("#em-cash-change").on("input", changeCash);
    }

    function setBtnAuth() {
        $(".co-section--checkout_order:first").prepend(
            `<div class="section__auth">
                <a class="btn-auth" href="/client_account/contacts/new">Зарегистрироваться</a>
                <p>Создайте аккаунт, чтобы сохранить историю заказов и контактные данные, которые вам не придется повторно указывать</p>
            </div>`
        );
    }

    function watchInput(input, callback) {
        if (!input) return;
        var lastValue = input.value;

        // Перехватываем setter value (программные изменения)
        const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        const valueSetter = valueDescriptor.set;
        
        Object.defineProperty(input, 'value', {
            get() { return lastValue; },
            set(newValue) {
                lastValue = newValue;
                valueSetter.call(this, newValue);
                callback(input);
            },
            configurable: true
        });

        input.addEventListener("input", () => callback(input));
        callback(input);
    }

    const $titles = $(".co-title--h2");
    for (const title of $titles) {
        if (title.innerText == 'Доставка') {
            title.innerText = "Адрес доставки";
            break;
        }
    }

    $orderForm.on("change", "input[data-payment-id]", chekedInput);
    $orderForm.on("change", "input[data-delivery-id]", chekedInput);
    $orderForm.on("change", "input.order__door-input", chekedInput);

    setHTMLBlocks();

    watchInput($orderForm.find("#shipping_address_street").get(0), inputAddress);
    watchInput($orderForm.find("#shipping_address_house").get(0), inputAddress);

    var isInitPayment = false;
    $(document).on("updated:insales:payment", function(event) {
        const $input = $(event.target);
        setTimeout(() => {
            $input.closest(".payment_variants").find(".checked-label:first").removeClass("checked-label");
            $input.closest("label").addClass("checked-label");

            if (isInitPayment) return;
            isInitPayment = true;
            const 
                $deliveryInput = $orderForm.find("input[data-delivery-id]:checked:first"),
                $deliveryVariants = $deliveryInput.closest(".delivery_variants");

            $deliveryInput.closest("label").addClass("checked-label");
            $orderForm.find(".co-input--em-select-zone:first").insertBefore($deliveryVariants);
            $deliveryVariants.before(
                getMessageDeliveryHTML($deliveryInput.attr("data-delivery-map-zones") === undefined)
            );

            $orderForm.find("#shipping_address").before(
                getRadioToDoorHTML()
            );
        }, 350);
        // console.log("updated:insales:payment", el, this);
    });

    $(document).on("selected:insales:payment", function(event) {
        const $input = $orderForm.find("#em-cash-change");
        if (!$input.length) return;

        if (event.originalEvent.detail.id === 12024769) {
            $input.show(250);
            $input.get(0).setCustomValidity("Укажите '0' если сдача не требуется");
        }
        else {
            $input.hide(250);
            $input.get(0).setCustomValidity("");
            $input.get(0).reportValidity();
        }
    });

    $orderForm.find(
        "input[name='shipping_address[street]'], input[name='shipping_address[house]'], #em-address"
    )
        .on('keydown', e => e.preventDefault())
        .on('keypress', e => e.preventDefault())
        // .on('input', e => e.preventDefault())
        .on('mousedown', e => e.preventDefault())
        .on('focus', e => e.target.blur());
    
    ajaxAPI.shop.client.get().done(function (client) {
        if (!client?.authorized) setBtnAuth();

    }).fail(setBtnAuth);

    // !Выключили 
    // EventBus.subscribe('update_items:insales:cart', function() {
    //     setDoorPrice(localStorage.getItem("cheked-door") === "true");
    // });
    
    // $(document).on("selected:payment", function(el) {
    //     console.log("selected:payment", el, this)
    // });
    // $(document).on("unselected:payment", function(el) {
    //     console.log("unselected:payment", el, this)
    // });

    
    // EventBus.subscribe('selected:payment', function(data) {
    //     console.log("selected:payment", data);
    // });
    

    // setZone();
});
