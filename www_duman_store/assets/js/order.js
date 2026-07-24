$(document).ready(() => {
    const isLogin = $("#data-client-login").length == 0;
    var myForm = $("#new_order_form"),
        origForm = $("#order_form"),
        loader = {
            call: () => {},
            hide: () => {}
        };

    if (!window.location.pathname.includes("/new_order")) return;

    function triggerClick(block) {
        if (block) {
            block.dispatchEvent(new Event("click", {
                bubbles: true,
                cancelable: true
            }));
        }
    }

    function moveEl(el1, el2) {
        if (!el1.length || !el2.length) return;
        origForm.find(el1).prependTo(myForm.find(el2));
    }

    function moveElAttr(el1, el2, className) {
        if (!el1.length || !el2.length) return;
        const
            block_1 = origForm.find(el1),
            block_2 = myForm.find(el2);
        let attr = {};
        if (block_2.attr("data-wrapper-error")) attr["data-error"] = block_2.attr("data-wrapper-error");
        if (block_2.attr("data-wrapper-required") !== undefined) attr["data-required"] = block_2.attr("data-wrapper-required");

        const $wrapperError = block_1.closest(".co-input--required.co-input--error");
        if ($wrapperError.length) {
            block_2.closest("[data-wrapper-error]").after(
                `<div class="form-error">${$wrapperError.find(".co-input-notice:first").text()}</div>`
            );
        }
        block_1.removeClass("co-input-field").addClass(className).attr(attr).prependTo(block_2);

    }

    // На удаление
    function initDeliveries(e) {
        console.log("[inited:deliveries]", e?.originalEvent?.detail);
        const 
            deliveriesList = origForm.find(`[data-delivery-methods]`);
            deliveries = e?.originalEvent?.detail;
        if (!deliveries) return;
        let html = "";

        for (const id in deliveries) {
            const 
                delivery = deliveries[id]
                isExternal = delivery.external_data?.length > 0;

            if (!delivery.active || !delivery.available) {
                deliveriesList.find(`[data-delivery-item="${id}"]`).attr("hidden", true);
                continue;
            }
            let origDeliveries;
            if (isExternal) {
                const container = origForm.find(`[data-delivery-variants] [data-delivery-tariffs-${id}]`);
                origDeliveries = delivery.external_data.map(function(item) {
                    return container.find(`[for="tariff_${item.tariff_id}"]:first`);
                });
            }
            else {
                origDeliveries = origForm.find(`[data-delivery-variants] [for="order_delivery_variant_id_${id}"]:first`);
            }
            if (!origDeliveries || !origDeliveries.length) continue;
            for (const data of origDeliveries) {
                const $data = $(data);
                html = `<div class="order-options__item" data-delivery-item="${id}" data-delivery-item-extern="${$data.attr("for") ?? ""}">
                <label class="order-options__item-label">
                    <input hidden class="order-options__item-input" ${delivery.selected ? "checked" : ""} type="radio" value="${id}" name="option-del">
                    <span class="order-options__item-body">
                        <span class="order-options__item-point"></span>
                        <span class="order-options__item-info">
                            <span class="order-options__item-title-wrapper">
                                <span class="order-options__item-title">${$data.find(".co-delivery_method-title").text()}</span>
                                <span class="order-options__item-price">${$data.find(".co-delivery_method-price").text()}</span>
                            </span>
                            ${id == 7971470 ? `<button type="button" class="order-options__item-link" data-btn-rev-pickup="">Выбрать на карте</button>` : `<span class="order-options__item-note">${$data.find(".co-delivery_method-description").text()}</span>`}
                        </span>
                    </span>
                </label>
            </div>` + html;
            }
        }

        // for (const key in deliveryItems) {
        //     deliveriesList.find(`[data-payment-item="${deliveryItems[key]}"]`).remove();
        // }
        if (html.length) {
            deliveriesList.html(html);
        }
    }

    function getTitlePayment(payId, title) {
        // Плайт
        if (payId === 11901145) {
            return `<span class="order-options__item-title order-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="23" height="12" viewBox="0 0 23 12" fill="none">
                <path d="M22.8805 11.4403H17.8656C17.8656 9.73616 17.1887 8.10185 15.9837 6.89686C14.7787 5.69187 13.1444 5.01491 11.4403 5.01491C9.73616 5.01491 8.10185 5.69187 6.89686 6.89686C5.69187 8.10185 5.01491 9.73616 5.01491 11.4403H0C0 8.40612 1.20531 5.49624 3.35078 3.35078C5.49624 1.20531 8.40612 0 11.4403 0C14.4744 0 17.3843 1.20531 19.5298 3.35078C21.6752 5.49624 22.8805 8.40612 22.8805 11.4403Z" fill="#6969FF"/>
                </svg>
                <span>${title}</span>
            </span>`;
        }
        // Долями
        else if (payId === 4485816) {
            return `<span class="order-options__item-title order-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="13" viewBox="0 0 17 13" fill="none">
                <path d="M16.1513 0H13.9822V10.9994H16.1513V0Z" fill="black"/>
                <path d="M11.4905 0.615491H9.32147V11.6147H11.4905V0.615491Z" fill="black"/>
                <path d="M6.82981 1.30263H4.66073V12.3039H6.82981V1.30263Z" fill="black"/>
                <path d="M2.16908 1.9974H0L8.26518e-06 13H2.16909L2.16908 1.9974Z" fill="black"/>
                </svg>
                <span>${title}</span>
            </span>`;
        }
        else  {
            return `<span class="order-options__item-title">${title}</span>`;
        }
    }

    function initPayments(e) {
        console.log("[inited:payments]", e?.originalEvent?.detail);
        const 
            paymentList = origForm.find(`[data-payment-list]`);
            payments = e?.originalEvent?.detail;
        if (!payments) return;
        let html = "", paymentItems = {};

        paymentList.find("[data-payment-item]").each(function() {
            paymentItems[this.dataset.paymentList] = 1;
        });

        for (const key in payments) {
            const pay = payments[key];
            let payHTML;
            if (paymentItems[pay.id]) {
                payHTML = paymentList.find(`[data-payment-item="${pay.id}"]`);
                paymentItems[pay.id] = null;
            }
            if (!pay.active || !pay.available) {
                if (payHTML?.length) payHTML.attr("hidden", true);
                continue;
            }
            if (payHTML?.length) {
                payHTML.attr("hidden", false);
                continue;
            }
            const title = origForm.find(`[for="${pay.html_id.replace("#", "")}"] .co-payment_method-title`).text();
            html = `<div class="order-options__item">
                <label class="order-options__item-label">
                    <input hidden="" class="order-options__item-input" ${pay.selected ? "checked" : ""} type="radio" value="${pay.id}" name="option-pay">
                    <span class="order-options__item-body">
                        <span class="order-options__item-point"></span>
                        <span class="order-options__item-info">
                            ${pay.id == 6156350 || pay.id == 11901065 ? '<span class="order-options__item-info-label">Удобно!</span>': ""}
                            <span class="order-options__item-title-wrapper">
                                ${getTitlePayment(pay.id, title ?? "Ошибка загрузки")}
                            </span>
                            <span class="order-options__note">${pay.description}</span>
                        </span>
                    </span>
                </label>
            </div>` + html;
        }

        for (const key in paymentItems) {
            paymentList.find(`[data-payment-item="${paymentItems[key]}"]`).remove();
        }
        if (html.length) {
            paymentList.html(html);
        }
    }

    if (!myForm.length || !origForm.length) {
        throw new Error("Ошибка инициализации формы оформления заказа!");
    }

    $(document).on("inited:insales:payments", initPayments);

    // updated:insales:checkout:bonus_points
    // $(document).on("updated:insales:checkout:bonus_points", function(t, n) {
    //     console.log("[checkout:bonus_points]", t, n);
    // });

    // $(document).on("loaded:insales:order", function(e) {
    //     const data = e.originalEvent?.detail;
    //     console.log("[loaded:order]", data);
    //     if (!data) return;

    //     origForm.find("#items_price").text(Shop.money.forma(data.items_price));
    // });

    myForm.find("[data-payment-list]").on("change", ".order-options__item-input", function() {
        if (!this.value) return;
        triggerClick(origForm.find(`[for="order_payment_gateway_id_${this.value}"] .radio_button`).get(0));
    });

    myForm.find("[data-delivery-methods]").on("change", ".order-options__item-input", function(e) {
        if (e.target.classList.contains(".order-options__item-link")) {
            triggerClick($("[data-open-pickup-map]").get(0));
            return;
        }
        if (this.value) {
            triggerClick(origForm.find(`[data-delivery-variants] .co-tabs-content > div [data-delivery-id="${this.value}"]`).get(0));
        }
    });

    EventBus.subscribe('eventLoader', function () {
        loader = new EM_Module.Loader($("main .layout__content:first"));
        if (Cart?.order?.items_price === undefined) loader.call();
    });

    /*
    origForm.on("submit", function(event) {
        event.preventDefault();
        event.stopPropagation();
        console.log("Block submit");
    });*/
    const adress = origForm.find("[data-address-autocomplete]");

    adress.find(".co-input--nested").addClass("order__row");
    adress.find(".co-input-label").removeClass("co-input-label").addClass("order__label");
    adress.find("input.co-input-field").removeClass("co-input-field").addClass(["order__input", "input"]);
    adress.prependTo(myForm.find("#orderAddress"));

    moveEl("[data-delivery-variants]", "[data-delivery-methods]");
    moveEl("#payment_gateways", "[data-new-payment-list]");

    // [Перенос]    
    moveEl(".co-input--order-channel", "[data-new-select-channel]");
    
    moveElAttr("[name='order[comment]']", "[data-form-comment]", ["order__input", "input"]);
    moveElAttr("#client_messenger_subscription", "[data-form-subscription]", "checkbox__input");

    const addressDelivery = origForm.find("#shipping_address");
    addressDelivery.find(".co-input-field").addClass(["order__input", "input"]);
    addressDelivery.find(".co-delivery_adress-form > *").addClass("order__row").css("margin-top", 0);
    moveEl(addressDelivery, "[data-adress-delivery]");
    
    if (isLogin) {
        myForm.find("[data-wrapper-client-hidd]").attr("hidden", true);

        moveElAttr("[name='shipping_address[name]']", "[data-form-client-name]", ["order__input", "input"]);
        moveElAttr("[name='shipping_address[surname]']", "[data-form-client-surname]", ["order__input", "input"]);
        moveElAttr("[name='shipping_address[phone]']", "[data-form-phone]", ["order__input", "input"]);
    }
    else {
        moveElAttr("[name='client[name]']", "[data-form-client-name]", ["order__input", "input"]);
        moveElAttr("[name='client[surname]']", "[data-form-client-surname]", ["order__input", "input"]);
        moveElAttr("[name='client[phone]']", "[data-form-phone]", ["order__input", "input"]);
        
        moveElAttr(
            origForm.find("[name='client[email]']").attr("type", "email"), 
            "[data-form-email]", ["order__input", "input"]
        );
        moveElAttr("[name='client[fields_values_attributes][16729835][value]']", "[data-from-datebirth]", ["order__input", "input", "input_datepicker"]);
        moveElAttr("#client_subscribe", "[data-from-subscribe]", "checkbox__input");
    }
    // order[delivery_date]

    origForm.find("[for='client_subscribe']").remove();

    origForm.find("[data-delivery-variants] .co-delivery_method, #create_order, .co-delivery_method-list, .co-delivery_method-list + .co-checkout-block").attr("hidden", true);
    origForm.addClass(["order__container", "order__container_alt"]);
    // origForm.attr("data-ajax", "true");
    if ($("#checkout_order_errors").css("display") === "none") {
        // myForm.find("#create_new_order").removeAttr("disabled");
        myForm.find("#create_order").removeAttr("disabled");
    }

    myForm.on("click", "[data-js='input-clear']", function() {
        if (this.parentElement && this.previousElementSibling) {
            this.previousElementSibling.value = "";
            this.parentElement.classList.remove("_active");
        }
    });

    myForm.prependTo(origForm);
    var i = 0;
    var idTimer = setInterval(() => {
        i++
        if (i > 10) {
            clearInterval(idTimer);
            loader.hide();
        }
        if (Cart?.order?.items_price === undefined) return;

        clearInterval(idTimer);
        const delt = Cart.order.total_price - Cart.order.items_price;
        if (delt < 0) {
            origForm.find("#discount-title").text(Cart.order.coupon?.valid ? "Промокод" : "Скидка");
            origForm.find("#discounts-price").text(Shop.money.format(delt));
        }
        origForm.find(".order__sidebar-total-item_discount").attr("hidden", delt >= 0);
        origForm.find("#items_price").text(Shop.money.format(Cart.order.items_price));

        loader.hide();
    }, 250);

    var isScroll = false;

    myForm.on("click", "#create_order", function() {
        isScroll = false;
    });
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!isScroll && mutation.target.classList.contains("_form-error")) {
                    isScroll = true;
                    $('html, body').animate({
                        scrollTop: $(mutation.target).offset().top - 60
                    }, 500);
                }
            }
        });
    });

    myForm.find("[data-wrapper-error]").each(function() {
        observer.observe(this, {
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ['class']
        });
    });
});
