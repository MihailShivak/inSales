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
    
    var $popup = $("#popup-city"),
        $cityNotice = $("#city-notice"),
        $deliveryInfo = isCart ? $("[data-delivery-info]") : null,  
        kladr = [];
    
    // --- ЛОГИКА УВЕДОМЛЕНИЯ О ГОРОДЕ ---
    function showCityNotice() {
        if (!city) return;
        $cityNotice.find('[data-city-notice-name]').text(city);
        $cityNotice.removeAttr('hidden');
        
        // Авто-скрытие через 10 секунд
        setTimeout(() => {
            $cityNotice.fadeOut(350);
        }, 10000);
    }
    
    function hideCityNotice() {
        $cityNotice.fadeOut(350);
    }
    
    function confirmCity() {
        hideCityNotice();
    }
    
    function changeCity() {
        hideCityNotice();
        openCityPopup();
    }
    
    // --- ЛОГИКА POPUP ---
    function openCityPopup() {
        if (country) {
            $popup.find('[name="country"]').val(country);
        }
        $popup.addClass('popup_show');
        setTimeout(() => {
            $popup.find('[name="name-city"]').trigger('focus');
        }, 350);
    }
    
    // --- ПОИСК ГОРОДОВ (Kladr API) ---
    async function inputCity(elVal, country, change = false) {
        if (!elVal) {
            $popup.find('[data-select-container-sity]').attr("hidden", true);
            return;
        }
        
        var cities = await $.ajax({
            type: 'post',
            url: `//kladr.insales.ru/fulltext_search.json?country=${country}&state=`,
            data: { q: elVal, search: '1' },
            dataType: 'jsonp',
            cache: false,
        });
        
        let html = '';
        if (!cities.length || cities?.error) {
            html = '<button class="select__option" type="button" disabled>Не найдено</button>';
        }
        
        kladr = cities;
        
        if (change && cities.length > 0) {
            indexKladr = 0;
            fetchDeliveryCalculate(kladr[0]);
        }
        
        if (change) return; 
        
        if (cities?.error === undefined) {
            for (const index in cities) {
                html += `<button class="select__option" data-value="${index}" type="button" data-select-city="${cities[index].city ?? cities[index].last_level}">${cities[index].result}</button>`;
            }
        }
        
        $popup.find('[data-select-sity-list]').html(html);
        $popup.find('[data-select-container-sity]').attr("hidden", false);
    }
    
    // --- СОХРАНЕНИЕ ---
    function setCookies(newCountry, newCity) {
        if (newCountry === country && newCity === city) return;
        
        Cookies.set('rev-country-location', newCountry);
        Cookies.set('rev-current-location', newCity);
        country = newCountry;
        city = newCity;
        
        // Обновляем текст в шапке
        $('[data-city-name]').text(newCity);
        
        if (indexKladr) fetchDeliveryCalculate(kladr[indexKladr]);
        
        if (location.pathname === '/new_order') {
            setTimeout(() => window.location.reload(), 350);
        }
    }
    
    // --- ОПРЕДЕЛЕНИЕ ГОРОДА ПРИ ПЕРВОМ ЗАХОДЕ ---
    function detectCity() {
        $.ajax({
            url: 'https://kladr.insales.ru/current_location.json',
            type: 'get',
            dataType: 'jsonp',
            success: function(data) {
                if (!data.city || !data.country) return;
                setCookies(data.country, data.city);
                showCityNotice();
                
                if (isProduct || isCart) inputCity(city, country, true);
            },
            error: function(err) {
                console.log("Ошибка получения данных о текущем положении", err);
            }
        });
    }
    
    // --- РАСЧЕТ ДОСТАВКИ (InSales API) ---
    function outputListDeliveriesProduct(deliveries) {
        let html = '';
        for (const delivery of deliveries) {
            const price = delivery.show_price ? delivery.price ?? Number(delivery.price_min) : 0;
            html += `<div class="product-delivery__item">
                <button type="button" data-spoller class="product-delivery__item-title">${delivery.title}</button>
                <div class="product-delivery__item-body" hidden>
                    ${delivery.description ? `<div class="product-delivery__item-text"> ${delivery.description}</div>` : ""}
                    <button type="button" class="product-delivery__item-more">Подробнее об условиях акции</button>
                </div>
                <div class="product-delivery__item-price-wrapper">
                    <div class="product-delivery__item-price">
                        <span>${delivery.show_price && price !== undefined && !isNaN(price) ? (price == 0 ? "Бесплатно" : Shop.money.format(price)) : "Будет рассчитана далее"}</span>
                        <span>${delivery.delivery_interval.min_days < delivery.delivery_interval.max_days ? `от ${delivery.delivery_interval.min_days} до ${delivery.delivery_interval.max_days} дней` : (delivery.delivery_interval?.min_days ? `от ${delivery.delivery_interval.min_days} дней` : "")}</span>
                    </div>
                    <div class="product-delivery__item-time"></div>
                </div>
            </div>`;
        }
        $(".product-card [data-delivery-options]").html(html);
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
        return { id: selectDelivery.id, priceFree: priceFree, title: selectDelivery.title };
    }
    
    function setFreeDeliveryTitle(priceFree) {
        if (!isFreeShipping || Cart.order.items_count == 0) return;
        if (priceFree > 0) {
            $("[data-delivery-to-free]").attr("hidden", false).find("span").text(Shop.money.format(priceFree));
            $("[data-delivery-free]").attr("hidden", true);
            $deliveryInfo.text("Будет рассчитана далее");
        } else {
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
    
    async function fetchDeliveryCalculate(kladr) {
        const variants = isProduct ? { [$( `.product-card:first input[name="variant_id"]:first`).val()]: 1 } : {};
        
        const deliveries = await $.ajax({
            url: "/front_api/deliveries/calculate.json",
            method: 'POST',
            dataType: 'json',
            data: { address_data: kladr, variants: variants },
            timeout: 10000
        });
        
        if (!deliveries?.deliveries || !deliveries.deliveries.length) {
            console.log("[ProductCard.Delivery] Ошибка получения доставки", deliveries);
        } else if (isProduct) {
            setDeliveryProduct(deliveries.deliveries, `${kladr.last_level_type} ${kladr.last_level}`);
        } else if (isCart) {
            setDeliveryCart(deliveries.deliveries);
        }
    }
    
    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    
    // Поиск города с задержкой
    $popup.find('[name="name-city"]').keyup(function() {
        let _this = $(this);
        const time = (new Date()).getTime(), delay = 500;
        _this.attr({'keyup': time});
        _this.off('keydown keypress');
        _this.on('keydown keypress', function() { $(this).attr({'keyup': time}); });
        
        setTimeout(function() {
            if (parseFloat(_this.attr('keyup')) <= (new Date()).getTime() - delay && _this.val()) {
                inputCity(_this.val(), $popup.find('[name="country"]').val());
            }
        }, delay);
    });
    
    // Уведомление: Да / Нет
    $cityNotice.on('click', '[data-city-confirm]', confirmCity);
    $cityNotice.on('click', '[data-city-change]', changeCity);
    
    // Открытие popup по клику на иконку в шапке
    $(document).on('click', '[data-popup="#popup-city"]', function(e) {
        e.preventDefault();
        openCityPopup();
    });
    
    // Сброс при смене страны
    $popup.find('[name="country"]').on('change', function() {
        $popup.find('[data-select-sity-list]').html('');
        $popup.find('[data-select-container-sity]').attr("hidden", true);
        $popup.find('[data-city-save]').attr('disabled', true);
    });
    
    // Выбор города из списка
    $popup.find('[data-select-container-sity]').on('click', '[data-select-city]', function(event) {
        const newCity = event.currentTarget.dataset.selectCity;
        if (!newCity) return;
        
        indexKladr = event.currentTarget.dataset.value;
        $popup.find('[name="name-city"]').val(newCity);
        $popup.find('[data-city-save]').removeAttr('disabled');
        $popup.find('[data-select-container-sity]').attr("hidden", true);
    });
    
    // Сохранение города
    $popup.on('click', '[data-city-save]', function() {
        const newCountry = $popup.find('[name="country"]').val();
        const newCity = $popup.find('[name="name-city"]').val();
        if (!newCity) return;
        
        setCookies(newCountry, newCity);
        $popup.removeClass('popup_show');
    });
    
    // Закрытие popup
    $popup.on('click', '[data-close]', function() {
        $popup.removeClass('popup_show');
    });
    
    // Очистка поля ввода
    $popup.on('click', '[data-js="input-clear"]', function() {
        $popup.find('[name="name-city"]').val('');
        $popup.find('[data-select-container-sity]').attr("hidden", true);
        $popup.find('[data-city-save]').attr('disabled', true);
    });
    
    // --- ИНИЦИАЛИЗАЦИЯ ---
    
    // Обновляем текст в шапке при загрузке
    if (city) {
        $('[data-city-name]').text(city);
    }
    
    // Если город не определен в cookies - определяем
    if (!city || !country) {
        detectCity();
    } else {
        // Если город есть - показываем уведомление
        showCityNotice();
    }
    
    // Установить доставку если есть город
    if ((isProduct || isCart) && city && country) {
        inputCity(city, country, true);
    }
    
    // Подписка на события
    EventBus.subscribe('eventLoader', function () {
        loader = new EM_Module.Loader($popup.find(".popup-right__form-body"));
    });
    
    EventBus.subscribe('update_items:insales:cart', (cart) => {
        if (isCart && !isNaN(priceFreeDelivery)) {
            setFreeDeliveryTitle(priceFreeDelivery - cart.total_price);
        }
    });
});