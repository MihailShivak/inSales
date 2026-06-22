$(document).ready(() => {
    const isMobile = sessionStorage.getItem('isMobile') === 'true';
    const isCart = window.location.pathname.includes('/cart_items');
    const isProduct = window.location.pathname.includes('/product');

    var country = Cookies.get('rev-country-location'),
        city = Cookies.get('rev-current-location'),
        indexKladr,
        nameDelivery = localStorage.getItem("nameDelivery"),
        priceFreeDelivery = Number(localStorage.getItem("priceFreeDelivery")),
        isFreeShipping = false;

    var $popup = $widget,
        $deliveryInfo = isCart ? $("[data-delivery-info]") : null,  
        kladr = [];

    function outputListDeliveriesProduct(deliveries) {
        let html = '';

        for (const delivery of deliveries) {
            const price = delivery.show_price ? delivery.price ??  Number(delivery.price_min) : 0;

             html += `<div class="product-delivery__item">
                <button type="button" data-spoller class="product-delivery__item-title">${delivery.title}</button>
                <div class="product-delivery__item-body" hidden>
                    ${delivery.description ? `<div class="product-delivery__item-text"> ${delivery.description}</div>` : "" }
                    <button type="button" class="product-delivery__item-more">Подробнее об условиях акции</button>
                </div>
                <div class="product-delivery__item-price-wrapper">
                    <div class="product-delivery__item-price">
                        <span>
                        ${delivery.show_price && price !== undefined && !isNaN(price) 
                            ? price == 0 ? "Бесплатно" : Shop.money.format(price)
                            : "Будет рассчитана далее"}
                        </span>
                        <span>
                            ${delivery.delivery_interval.min_days < delivery.delivery_interval.max_days
                                ?  `от ${delivery.delivery_interval.min_days} до ${delivery.delivery_interval.max_days} дней`
                                : (
                                    delivery.delivery_interval?.min_days ? `от ${delivery.delivery_interval.min_days} дней` : ""
                                )}
                        </span>
                        </div>
                    <div class="product-delivery__item-time"></div>
                </div>
            </div>`;
        }
        $(".product-card [data-delivery-options]").html(html);
    }

    // Смена страны в форме Выбора города
    function changeCountryInForm(value) {
        if (!value || value == $popup.find('[name="country"]').val()) return;

        const $button = $popup.find(`.select__option[data-value="${value}"]`);
        $popup.find('[name="country"]').val(value);

        if (!$button.length) return;
        
        $popup.find(`.select__content`).text($button.text());
        $popup.find(`.select__option[hidden]`).attr("hidden", false);
        $button.attr("hidden", true);
    }

    async function inputCity(elVal, country, change=false) {
        if (!elVal) {
            $popup.find('[data-select-container-sity]').attr("hidden", true);
            return;
        }
        var cities = await $.ajax({
            type: 'post',
            url: `//kladr.insales.ru/fulltext_search.json?country=${country}&state=`,
            data: {
                q: elVal, 
                search: '1'
            },
            dataType: 'jsonp',
            cache: false,
        });
        let html = '';
        if (!cities.length || cities?.error) {
            console.log('[popup-city] Города не найдены');
            // Изменить кнопку сохранения 
            html = '<button class="select__option" type="button">Не найдено</button>';
        }
        kladr = cities;
        if (change && cities.length > 0) {
            indexKladr = 0;
            fetchDeliveryCalculate(kladr[0]);
        }
        if (change) return; 
        if (cities?.error === undefined) {
            for (const index in cities) {
                html += `<button class="select__option" data-value="${index}" type="button" data-select-city="${cities[index].city ?? cities[index].last_level}">${cities[index].result}</button>`
            }
        }

        $popup.find('[data-select-sity-list]').html(html);
        $popup.find('[data-select-container-sity]').attr("hidden", false);
    }

    function setCookies(newCountry, newCity) {
        if (newCountry === country && newCity === city) return;

        Cookies.set('rev-country-location', newCountry);
        Cookies.set('rev-current-location', newCity);
        country = newCountry;
        city = newCity;
        
        if (indexKladr) fetchDeliveryCalculate(kladr[indexKladr]);
        if (location.pathname === '/new_order') {
            setTimeout(() => {
                window.location.reload();
            }, 350);
        }
    }

    function getProductIdInCart() {
        let id = [];
        for (const key in Cart.order.order_line_comments) {
            id.push(key);
        }
        return id;
    }

    function getDeliveryFree(deliveries) {
        let selectDelivery;
        let priceFree = 0;

        for (const delivery of deliveries) {
            if (!delivery.charge_up_to) continue;

            const charge_up_to = Number(delivery.charge_up_to);
            if (!isNaN(charge_up_to) && charge_up_to > 0 && (charge_up_to < priceFree || priceFree == 0)) {
                selectDelivery = delivery;
                priceFree = charge_up_to;
            }
        }
        if (!selectDelivery || priceFree == 0 || priceFree > 30000) return;
        if (priceFreeDelivery !== priceFree) {
            localStorage.setItem("priceFreeDelivery", priceFree);
            priceFreeDelivery = priceFree;
        }
        if (nameDelivery !== selectDelivery.title) {
            localStorage.setItem("nameDelivery", selectDelivery.title);
            nameDelivery = selectDelivery.title;
        }

        return {
            // selected: selected,
            id: selectDelivery.id,
            priceFree: priceFree,
            title: selectDelivery.title,
        };
    }
    
    function setFreeDeliveryTitle(priceFree) {
        if (!isFreeShipping || Cart.order.items_count == 0) return;
        if (priceFree > 0) {
            // Осталось до бесплатной
            $("[data-delivery-to-free]").attr("hidden", false).find("span").text(Shop.money.format(priceFree));
            $("[data-delivery-free]").attr("hidden", true);
            $deliveryInfo.text("Будет рассчитана далее");
        }
        else {
            // Бесплатная
            $("[data-delivery-to-free]").attr("hidden", true);
            $("[data-delivery-free]").attr("hidden", false);
            $deliveryInfo.text("Бесплатно по России");
        }
    }

    function setDeliveryCart(deliveries) {
        const selectDelivery = getDeliveryFree(deliveries);
        if (selectDelivery) {
            isFreeShipping = true;
            $(".basket__info-total-item_dilivery:first").removeAttr("hidden");
            setFreeDeliveryTitle(selectDelivery.priceFree - Cart.order.total_price);
        }
    }

    function setDeliveryProduct(deliveries, typeDelivery) {
        outputListDeliveriesProduct(deliveries);
        $(".product-card .product-card-descr__title span:last").text(`Доставка в ${typeDelivery}`);
    }

    // Запрос к api ins на получение доставок
    async function fetchDeliveryCalculate(kladr) {
        const variants = isProduct ? {
            [
                // $(`.product-card:first input[name="variant_id"][value="${Shop.config.getProductId()}"]`).val()
                $(`.product-card:first input[name="variant_id"]:first`).val()
            ]: 1
        } : {};

        const deliveries = await $.ajax({
            url: "/front_api/deliveries/calculate.json",
            method: 'POST',
            dataType: 'json',
            data: {
                address_data: kladr,
                variants: variants
            },
            timeout: 10000
        });
        // console.log('Доставка:', deliveries);
        if (!deliveries?.deliveries || !deliveries.deliveries.length) {
            console.log("[ProductCard.Delivery] Ошибка получения доставки", deliveries);
        }
        else if (isProduct) {
            setDeliveryProduct(deliveries.deliveries, `${kladr.last_level_type} ${kladr.last_level}`);
        }
        else if (isCart) {
            setDeliveryCart(deliveries.deliveries);
        }
    }

    // Старая версия
    async function setDeliveryInfo(data) {
        const default_locale = $('meta[name=default-locale]').attr('content').toUpperCase();
        const deliveries = await $.ajax({
            url: `/delivery/for_order.json?lang=${ default_locale ? default_locale : 'RU'}&v2=${ $('[data-checkout2]').length > 0 }`,
            method: 'PUT',
            dataType: 'json',
            data: {
                "shipping_address[country]": data.country,
                'shipping_address[full_locality_name]': data.result,
                'shipping_address[kladr_json]': data,
                'shipping_address[no_delivery]': 0,
                'order[viewed_product_ids]': getProductIdInCart()
            },
            timeout: 10000
        });
        console.log('Доставка:', deliveries);
        if (!deliveries || $.isEmptyObject(deliveries?.deliveries)) {
            console.log("Ошибка получения доставки");
            return;
        }
        if (isProduct) setDeliveryProduct(deliveries.deliveries, `${data.last_level_type} ${data.last_level}`);
        else if (isCart) setDeliveryCart(deliveries.deliveries);
    }

    function messageDeleviry($deliveryPopup, flag=false) {
        $deliveryPopup.find(".cart-popup__promocode-error").attr("hidden", !flag);
        $deliveryPopup.find(".cart-popup__promocode-success").attr("hidden", flag);
    }

    // if (!pathname.includes("/cart_items") || !pathname.includes("/product")) return;

    $popup.find('[name="name-city"]').keyup(function() {
        let _this = $(this);

        const time = (new Date()).getTime(),
            delay = 500;

        _this.attr({'keyup':time});
        _this.off('keydown');
        _this.off('keypress');
        _this.on('keydown',function(e){$(this).attr({'keyup':time});});
        _this.on('keypress',function(e){$(this).attr({'keyup':time});});
    
        setTimeout(function(){
            oldtime = parseFloat(_this.attr('keyup'));
            if(oldtime <= (new Date()).getTime()-delay & oldtime>0 & _this.attr('keyup')!='' & typeof _this.attr('keyup')!=='undefined') {
                inputCity(_this.val(), $popup.find('[name="country"]').val());
            }
        }, delay);
    });

    // Открытие формы
    $('[data-popup="#popup-city"]').on("click", () => { changeCountryInForm(country); });

    $(".header__sity-body .btn-primary").on("click", () => {
        if (!country || !city) return;
        Cookies.set('rev-country-location', country);
        Cookies.set('rev-current-location', city);
    });

    // Выбрать доставку
    $("#popup-delivery-change .form-popup__input-wrapper").on("click", "button", (event) => {
        const value = event.currentTarget.dataset.value;
        if (!value || value === "0") return;
        $("#popup-delivery-change .popup__button").attr("disabled", false);
    });

    // Сохранить доставку
    $("#popup-delivery-change .popup__button").on("click", () => {
        const $popup_delivery = $("#popup-delivery-change");
        const value = $popup_delivery.find('[name="delivers"]').val();

        if (!value || value === "0") return;
        const preload = new Preloader($("#popup-delivery-change .popup__body-delivery"));
        preload.call();

        ajaxAPI.checkout.order({}, {delivery: value})
            .done(() => {
                preload.hide();
            })
            .fail(function(onFail) {
                var checkChange = false;
                if (onFail.errors?.delivery_variant_id !== undefined) {
                    for (const err of onFail.errors.delivery_variant_id) {
                        if (err.includes("доставки")) {
                            checkChange = true;
                            break;
                        }
                    }
                }
                if (checkChange) {
                    console.log('Ошибка изменения доставки', onFail);
                    messageDeleviry($popup_delivery , true);
                }
                else {
                    inputCity(city, country, true);
                    messageDeleviry($popup_delivery);
                    console.log('Доставка изменена: ', onFail);
                    setTimeout(() => {
                        $popup_delivery.find(".popup__close").trigger("click");
                    }, 850);
                }
                preload.hide();
            });
    });

    // Выбор страны (клик на выпадающий список)
    $popup.find(".form-popup__input-wrapper:first").on("click", "button", () => {
        $popup.find('[data-select-sity-list]').html('');
        $popup.find('[data-select-container-sity]').attr("hidden", true);
    });

    // Городы выбран
    $popup.find(".form-popup__input-wrapper:last").on("click", "[data-select-city]", (event) => {
        const newCity = event.currentTarget.dataset.selectCity;

        if (!newCity) return;
        indexKladr = event.currentTarget.dataset.value;
        $popup.find('[name="name-city"]').val(newCity);
        $popup.find(".popup__button").removeAttr("disabled");
        $popup.find('[data-select-container-sity]').attr("hidden", true);
    });

    // Нажата кнопка сохранения города
    $popup.find(".popup__button").on("click", () => {
        const newCountry =  $popup.find('[name="country"]').val();
        const newCity = $popup.find('[name="name-city"]').val();

        setCookies(newCountry, newCity);
        // setCityInHeader(newCountry, newCity);
    });

    EventBus.subscribe('eventLoader', function () {
        loader = new EM_Module.Loader($popup.find(".popup__body"));
    });

    EventBus.subscribe('update_items:insales:cart', (cart) => {
        if (isCart && !isNaN(priceFreeDelivery)) setFreeDeliveryTitle(priceFreeDelivery - cart.total_price);
    });

    // Проверка установки города в куки
    if (!city || !country) {
        $.ajax({
            url: 'https://kladr.insales.ru/current_location.json',
            type: 'get',
            dataType: 'jsonp',
            success: function(data) {
                if (!data.city || !data.country) return;
                // if (!setCityInHeader(data.country, data.city)) return;
                setCookies(data.country, data.city);

                if (isProduct || isCart) inputCity(city, country, true);
                if (!isMobile) document.querySelector(".header__sity-name")?.click()
            },
            error: function(err) {
                console.log("Ошибка получения данных о текущем положении", err);
            }
        });
    }

    // Установить доставку
    if ((isProduct || isCart) && city && country) inputCity(city, country, true);
});