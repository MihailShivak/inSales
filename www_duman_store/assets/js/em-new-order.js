document.addEventListener("DOMContentLoaded", function () {
    'use strict';

    const Print = {
        name: "[EM-Order]",

        printLog: function (mess, params = "") {
            console.log(this.name, mess, params);
        },

        printWarn: function (mess, params = "") {
            console.warn(this.name, mess, params);
        },

        printError: function (mess, params = "") {
            console.error(this.name, mess, params);
        },

        throwException: function (mess, params = "") {
            throw `${this.name} ${mess}`;
        }
    };

    // import options from "../options.js";

    async function getClient() {
        try {
            const client = await ajaxAPI.shop.client.get();
            if (client?.status == "error" || !client?.authorized || !client?.id) {
                return { authorized: false };
            }
            return client;
        }
        catch (exp) {
            const message = exp?.message ?? "";

            if ((!message || !message.includes("ot authorized")) && window.em_order_instance) {
                Print.printWarn("Ошибка получения данных о клиенте:", exp);
                window.em_order_instance.showErrors([{
                    type: "all",
                    text: "Ошибка получения данных о клиенте. Попробуйте обновить страницу."
                }]);
            }
            return { authorized: false };
        }
    }

    var Fetch = { getClient };

    class EMGeo {
        constructor() {
            this.print = Print;
            this.print.name = "[EM-Geo]";

            // const delivery = JSON.parse(localStorage.getItem("deliveryData") ?? "{}");
            this.default_locale = "RU";
            this.v2 = $('[data-checkout2]').length > 0;
            this.delivery = {
                selectedId: null,
                data: null,
                name: localStorage.getItem("nameDelivery"),
                priceFree: Number(localStorage.getItem("priceFreeDelivery")),
                price: undefined
            };

            this.country = Cookies.get('rev-country-location') ?? "RU";
            this.city = Cookies.get('rev-current-location');

            this.payments = {};
            // Общие данные, нужны для запросов в insales. Не полные, например, нет цены
            this.deliveries = {};
            // Полные данные, без подробностей о доставках. Есть цена
            this.deliveriesExtended = [];
            // Кэширование данных
            this._cachedDeliveryData = null;
        }

        // Является ли текущая доставка самовывозом
        get isCustomerPickup() {
            return this.delivery.customer_pickup ?? false;
        }

        /**
         * Получить данные о пункте самовывоза
         * @returns {string} Данные JSON, конвернированные в строку
         */
        get customerPickupData() {
            return this.delivery.customerPickupData ?? "";
        }

        /**
         * Получить данные о пункте самовывоза
         * @returns {object} Данные JSON
         */
        get customerPickupDataJSON() {
            try {
                return JSON.parse(this.delivery.customerPickupData);
            }
            catch (_) {
                return null;
            }
        }

        // New
        async init() {
            this.client = await Fetch.getClient();

            if (!this.city || !this.country) {
                const data = await $.ajax({
                    url: 'https://kladr.insales.ru/current_location.json',
                    type: 'get',
                    dataType: 'jsonp',
                    cache: true
                });
                if (data.city && data.country) {
                    this.setCookies(data.country, data.city);
                }
                else this.print.printWarn("Ошибка получения данных о текущем положении", data);
            }
            EventBus.publish('em-geo:init', this.client);
        }

        /**
         * Поиск по городам / поселениям / и др.
         * @param {string} elVal 
         * @returns {object/undefined} Вернет найденные города / поселения / и др. или undefined в случае ошибки
         */
        async getSearchLocation(elVal, country = this.country) {
            if (!elVal || !country) return;

            try {
                var cities = await $.ajax({
                    type: 'post',
                    url: `//kladr.insales.ru/fulltext_search.json?country=${country}&state=`,
                    data: {
                        q: elVal,
                        search: '1'
                    },
                    dataType: 'jsonp',
                    cache: false
                });

                if (!cities.length || cities?.error) {
                    this.print.printWarn("Не удалось получить местоположение", cities);
                    if (window.em_order_instance) {
                        window.em_order_instance.showErrors([{
                            type: "all",
                            text: "Не удалось найти указанное местоположение. Попробуйте другой вариант."
                        }]);
                    }
                }
                else return cities;
            }
            catch (err) {
                this.print.printWarn("Ошибка запроса на получение местоположения:", err, elVal, country);
                if (window.em_order_instance) {
                    window.em_order_instance.showErrors([{
                        type: "all",
                        text: "Ошибка поиска местоположения. Попробуйте обновить страницу."
                    }]);
                }
            }
        }

        /**
         * Получение актуальных данных о доставках
         * city будет сохранена в this.kladr. Если city нет, то возьем из this.kladr
         * @param {object|undefined} city Подробное описание местоположения (getSearchLocation)
         * @param {boolean} [returnAll=false] Нужно ли вернуть весь список доставок
         * @param {boolean} viewProduct Стоит ли прикрепить просмотренные товары
         * @returns {boolean|object}, успех получения данных о доставке || список доставок
         */
        async getDeliveries(city, returnAll = false, viewProduct = false) {
            if (!city || !this.kladr) {
                this.print.printError("Нет начальных данных о местоположении");
                if (window.em_order_instance) {
                    window.em_order_instance.showErrors([{
                        type: "all",
                        text: "Не удалось определить местоположение. Попробуйте выбрать город."
                    }]);
                }
                return false;
            }
            if (city && this.kladr && this.kladr.result !== city.result) {
                this.kladr = city;
            }

            const forOrder = await $.ajax({
                url: `/delivery/for_order.json?lang=${this.default_locale}&v2=${this.v2}`,
                method: 'PUT',
                dataType: 'json',
                data: this.getDataForOrder(
                    false, city, viewProduct && await Products.getRecentlyViewed(), 
                    this.delivery?.data && this.delivery.data.delivery_info.outlet?.external_id
                ),
                timeout: 10000
            });
            if (!forOrder?.deliveries || $.isEmptyObject(forOrder.deliveries)) {
                this.print.printError("Доставка не найдена", forOrder);
                if (window.em_order_instance) {
                    window.em_order_instance.showErrors([{
                        type: "all",
                        text: "Варианты доставки не найдены для выбранного местоположения."
                    }]);
                }
                return false;
            }
            if (forOrder.order?.fields_values) {
                let fields_values = {};
                for (const field of forOrder.order.fields_values) {
                    fields_values[field.field_id] = {
                        hack: "",
                        field_id: field.field_id,
                        value: field.value
                    };
                }

                this.orderFields = fields_values;
            }
            if (forOrder.order.delivery_info?.outlet && forOrder.order.delivery_info?.outlet?.id) {
                this.delivery_info = forOrder.order.delivery_info;
            }
            else {
                this.delivery_info = undefined;
            }
            let id;
            // Активная доставка
            for (const key in forOrder.deliveries) {
                const delivery = forOrder.deliveries[key];
                if (delivery.selected) {
                    id = key;
                    break;
                }
                else if (!id && delivery.title.includes("России")) id = key;

            }
            if (!id) {
                this.delivery.selectedId = 0;
                this.delivery.data = {};
                return false;
            }
            this.deliveries = forOrder.deliveries;
            this.deliveriesExtended = undefined;

            // New
            this.setActiveDelivery(
                forOrder.deliveries[id], 
                id,
                await this.getPriceExternalDelivery(forOrder, id)
            );

            return !returnAll || forOrder;
        }

        // Получить список доставок с подробной информацией: стоимость, сроки доставки
        async getFullDeliveries() {
            // Используем кешированные данные, если они есть
            this._cachedDeliveryData = await this.getDeliveries(this.kladr, true);
            // if (!this._cachedDeliveryData) {
            //     this._cachedDeliveryData = await this.getDeliveries(this.kladr, true);
            // }
            
            const data = this._cachedDeliveryData;
            const deliveries = data.deliveries;
            const order = data.order;
            
            if (!data || !order) return [];

            if (this.kladr?.zip) {
                order.location = {
                    zip: this.kladr.zip
                };
            }
            
            let info = [];
            for (const key in deliveries) {
                const delivery = deliveries[key];

                if (!delivery.available_for_individual_clients) continue;
                if (delivery.external_url) {
                    let moreDeliveries;
                    try {
                        moreDeliveries = await $.ajax({
                            url: delivery.external_url,
                            method: 'POST',
                            contentType: 'application/json',
                            dataType: 'json',
                            data: JSON.stringify({
                                order: {
                                    account_id: order.account_id,
                                    currency_iso_code: order.currency_iso_code,
                                    delivery_variant_id: delivery.id,
                                    items_price: Cart.order?.items_price ?? order.items_price,
                                    discounts: Cart.order?.discounts ?? order.discounts,
                                    order_lines: order.order_lines,
                                    shipping_address: {
                                        full_locality_name: order.shipping_address.full_locality_name,
                                        location: order.shipping_address.location
                                    },
                                    total_weight: order.total_weight,
                                    warehouse_id: order.warehouse_id
                                }
                            }),
                            timeout: 10000
                        });
                    }
                    catch (err) {
                        Print.printWarn(`Ошибка выполнения запрсоа '${delivery.external_url}' (${delivery.id}:${delivery.title}),`, err);
                        continue;
                    }
                    
                    if (!moreDeliveries) {
                        Print.printWarn(`Ошибка получения доп. информацию о доставке ${delivery.id}:${delivery.title},`);
                        continue;
                    }
                    
                    // Создаем уникальные ID для каждого варианта внешней доставки
                    for (let index = 0; index < moreDeliveries.length; index++) {
                        const moreDelivery = moreDeliveries[index];
                        const uniqueId = `${delivery.id}_${moreDelivery.tariff_id || index}`;
                        
                        
                        info.push({
                            id: delivery.id, // оригинальный ID для API
                            uniqueId: uniqueId, // уникальный ID для внутреннего использования
                            title: delivery.title + (moreDelivery.title ? ` - ${moreDelivery.title}` : ""),
                            description: delivery.description,
                            // title: `${delivery.title} - ${moreDelivery.title || ''}`,
                            charge_up_to: delivery?.charge_up_to == null ? null : Number(delivery.charge_up_to),
                            interval: moreDelivery.delivery_interval,
                            price: moreDelivery.price,
                            shipping_company_handle: moreDelivery.shipping_company_handle,
                            tariff_id: moreDelivery.tariff_id,
                            type: delivery.type,
                            customer_pickup: false,
                            selected: delivery.selected && index === 0 && !moreDelivery?.errors?.length, // только первый выбран по умолчанию
                            originalDelivery: delivery, // сохраняем оригинальные данные
                            isError: moreDelivery?.errors?.length > 0,
                            message: moreDelivery?.errors ? moreDelivery.errors.join(", ") : ""
                        });
                    }
                } else {
                    info.push({
                        id: delivery.id,
                        uniqueId: String(delivery.id), // для обычных доставок uniqueId = id
                        title: delivery.title,
                        description: delivery.description,
                        charge_up_to: delivery?.charge_up_to == null ? null : Number(delivery.charge_up_to),
                        type: delivery.type,
                        customer_pickup: delivery.customer_pickup && !delivery.type.includes("None"),
                        selected: delivery.selected,
                        originalDelivery: delivery
                    });
                }
            }

            this.deliveriesExtended = info;
            return info;
        }

        async getPointsMap() {
            // Используем кешированные данные
            if (!this._cachedDeliveryData) {
                this._cachedDeliveryData = await this.getDeliveries(this.kladr, true);
            }
            
            const deliveries = this._cachedDeliveryData;
            const order = deliveries.order;
            var points = [];
            if (!deliveries || !order) return [];

            try {
                points = await $.ajax({
                    url: "https://cost-rater.insales.ru/api/checkout/v1/delivery_points",
                    method: 'POST',
                    dataType: 'json',
                    contentType: "application/json; charset=UTF-8",
                    data: JSON.stringify({
                        order: {
                            account_id: order.account_id,
                            currency_iso_code: order.currency_iso_code,
                            items_price: order.items_price,
                            order_lines: order.order_lines,
                            shipping_address: {
                                full_locality_name: order.shipping_address.full_locality_name,
                                location: {
                                    kladr_code: this.kladr.code,
                                    zip: this.kladr.zip ?? null,
                                    region_zip: this.kladr.region_zip ?? null,
                                    country: this.kladr.country,
                                    state: this.kladr.state,
                                    state_type: this.kladr.state_type,
                                    area: this.kladr.area ?? "",
                                    area_type: this.kladr.area_type ?? "",
                                    city: this.kladr.city,
                                    city_type: this.kladr.city_type,
                                    settlement: this.kladr.settlement ?? "",
                                    settlement_type: this.kladr.settlement_type ?? "",
                                    bounds: this.getBoundsByCenter(Number(this.kladr.latitude), Number(this.kladr.longitude))
                                }
                            },
                            total_weight: order.total_weight,
                            warehouse_id: order.warehouse_id
                        }
                    }),
                    timeout: 10000
                });
            }
            catch (_) {
                return [];
            }
            
            if (points.length > 0) this.points = points;
            return points;
        }

        async getPriceExternalDelivery(forOrder, id) {
            const selectedDelivery = forOrder.deliveries[id];
            let deliveryPrice = undefined;

            // Если это внешняя доставка, получаем детальную информацию с ценой
            if (selectedDelivery.external_url) {
                try {
                    const moreDeliveries = await $.ajax({
                        url: selectedDelivery.external_url,
                        method: 'POST',
                        contentType: 'application/json',
                        dataType: 'json',
                        data: JSON.stringify({
                            order: {
                                account_id: forOrder.order.account_id,
                                currency_iso_code: forOrder.order.currency_iso_code,
                                delivery_variant_id: selectedDelivery.id,
                                items_price: Cart.order?.items_price ?? forOrder.order.items_price,
                                discounts: Cart.order?.discounts ?? forOrder.order.discounts,

                                order_lines: forOrder.order.order_lines,
                                shipping_address: {
                                    full_locality_name: forOrder.order.shipping_address.full_locality_name,
                                    location: forOrder.order.shipping_address.location
                                },
                                total_weight: forOrder.order.total_weight,
                                warehouse_id: forOrder.order.warehouse_id
                            }
                        }),
                        timeout: 10000
                    });

                    if (moreDeliveries && moreDeliveries.length > 0 && !moreDeliveries.errors) {
                        // Берем цену первого варианта (по умолчанию выбранного)
                        deliveryPrice = moreDeliveries[0].price;
                    }
                } catch (error) {
                    this.print.printWarn(`Ошибка получения цены для доставки ${selectedDelivery.id}:`, error);
                    if (window.em_order_instance) {
                        window.em_order_instance.showErrors([{
                            type: "all",
                            text: `Ошибка получения цены для доставки "${selectedDelivery.title}". Попробуйте выбрать другой вариант.`
                        }]);
                    }
                }
            }
            else if (selectedDelivery.customer_pickup && !selectedDelivery.type.includes("None")) {
                
            }
            return deliveryPrice;
        }

        // Расчет центра для location в запросе delivery_points
        getBoundsByCenter(N, W) {
            if (isNaN(N) || isNaN(W)) return {};
            const be = 5e4;
            var pe, q, ie, le, Ae;
            Ae = Math.cos(N) * 111321.377778;
            pe = 1 / 111134.861111;
            ie = 1 / Ae;
            q = pe * be;
            le = ie * be;
            return {
                bottom_left: {
                    latitude: N - q,
                    longitude: W - le
                },
                top_right: {
                    latitude: N + q,
                    longitude: W + le
                }
            };
        }

        /**
         * Получение актуальных данных о оплате
         * @param {string|undefined} point_id ID точкти самовывоза
         * @returns {object/boolean}, список способов оплаты || успех получения данных
         */
        async getPayments(point_id) {
            if (!this.kladr) {
                this.print.printError("Нет начальных данных о местоположении");
                if (window.em_order_instance) {
                    window.em_order_instance.showErrors([{
                        type: "all",
                        text: "Не удалось определить местоположение для получения способов оплаты."
                    }]);
                }
                return false;
            }

            const forOrder = await $.ajax({
                url: `/payment/for_order.json?lang=${this.default_locale}&v2=${this.v2}`,
                method: 'PUT',
                dataType: 'json',
                // contentType: 'application/json',
                data: this.getDataForOrder(true, this.kladr, undefined, point_id),
                timeout: 10000
            });
            if (!forOrder?.payments || !forOrder?.order || $.isEmptyObject(forOrder.payments)) {
                this.print.printError("Оплата не найдена", forOrder);
                if (window.em_order_instance) {
                    window.em_order_instance.showErrors([{
                        type: "all",
                        text: "Способы оплаты не найдены для выбранного местоположения."
                    }]);
                }
                return false;
            }
            if (forOrder.order?.fields_values) {
                let fields_values = {};
                for (const field of forOrder.order.fields_values) {
                    fields_values[field.field_id] = {
                        hack: "",
                        field_id: field.field_id,
                        value: field.value
                    };
                }

                this.orderFields = fields_values;
            }
            let payments = {};
            for (const key in forOrder.payments) {
                const payment = forOrder.payments[key];
                payments[key] = {
                    availableForIndividualClients: payment.available_for_individual_clients,
                    availableForJuridicalClients: payment.available_for_juridical_clients,
                    id: payment.id,
                    price: payment.price,
                    deliverVariantsIds: payment.working_delivery_variants_ids,
                    selected: payment.selected
                };
            }
            this.payments = payments;

            if (this.delivery.price === undefined) {
                this.delivery.price = forOrder.order.delivery_info.price;
                // this.setActiveDelivery(
                //     forOrder.order.delivery_info.outlet,
                //     forOrder.order.delivery_variant_id,
                //     forOrder.order.delivery_info.price
                // );
            }
            return forOrder;
        }

        /**
         * Формирует тело запроса для /delivery/for_order.json и  /payment/for_order.json
         * @param {boolean} isPay 
         * @param {object} city 
         * @param {Array|undefined} ids ID просмотренных товаров 
         * @param {string|undefined} ids ID точки самовывоза
         * @returns 
         */
        getDataForOrder(isPay, city, viewed_ids, point_id) {
            let address = {
                    kladr_json: JSON.stringify(city),
                    country: city.country,
                    full_locality_name: city.result,
                    no_delivery: 0
                },
                order = {
                    use_bonus_points: 0,
                };
            if (this.client.authorized) {
                address.name = this.client.name;
                address.surname = this.client.surname;
                address.phone = this.client.phone;
            }
            if (viewed_ids && viewed_ids?.length > 0) {
                order.viewed_product_ids = viewed_ids;
            }
            if (this.orderFields && this.orderFields["38266508"] !== undefined) {
                this.orderFields["38266508"].value = Math.round(Math.random() * 100) + (new Date()).getMilliseconds();
                order.fields_values_attributes = this.orderFields;
            }

            if (isPay && point_id && this.points) {
                const point = this.points.find(point => point.id == point_id),
                    tariff = point?.tariffs?.[0];
                if (point && tariff) {
                    // this.delivery.customerPickupData = JSON.stringify({
                    this.delivery.data.delivery_info = {
                        delivery_interval: tariff.delivery_interval,
                        outlet: {
                            id: this.MD5(`https://cost-rater.insales.ru/api/checkout/v1/delivery_points_${point_id}_${point.longitude}_${point.latitude}`),
                            external_id: point_id,
                            type: point.type,
                            longitude: point.longitude,
                            latitude: point.latitude,
                            title: point.title + (tariff?.title ? ` (${tariff.title})` : ""),
                            address: point.address,
                            description: point.description,
                            payment_method: point.payment_method,
                            source_id: 4197172 // !!! Не знаю откуда брать этот параметр, он фикс у всех ПВЗ
                        },
                        fields_values: [],
                        delivery_variant_id: this.delivery.selectedId,
                        tariff_id: tariff.id,
                        title: this.delivery?.name ?? null,
                        description: this.delivery?.description ?? null,
                        price: tariff.price,
                        shipping_company: point.shipping_company_handle,
                        shipping_company_handle: point.shipping_company_handle,
                        errors: [],
                        warnings: [],
                        not_available: null
                    };
                    order.delivery_info_attributes = this.delivery.data.delivery_info;
                    // order.delivery_info_attributes = this.delivery.customerPickupData;
                }
            }
            else if (this.delivery?.data) {
                const deliveryExtenden = this.getOriginalDeliversFull(this.delivery.data.id, this.delivery.data.position);
                const deliveryInfo = this.delivery.data.delivery_info;

                if (deliveryExtenden && !deliveryInfo?.shipping_company) {
                    if (deliveryExtenden?.shipping_company_handle) {
                        deliveryInfo.shipping_company_handle = deliveryExtenden.shipping_company_handle;
                    }
                    if (!deliveryInfo.delivery_interval?.description) {
                        deliveryInfo.delivery_interval = deliveryExtenden.delivery_interval;
                    }
                    deliveryInfo.shipping_company = deliveryExtenden.shipping_company;
                    deliveryInfo.tariff_id = deliveryExtenden.tariff_id;
                    deliveryInfo.title = deliveryExtenden.title;
                    deliveryInfo.price = deliveryExtenden.price;
                }
                order.delivery_info_attributes = JSON.stringify(deliveryInfo);
            }
            // else if (isPay && this.delivery_info) {
            //     order.delivery_info_attributes = JSON.stringify(this.delivery_info);
            // }
            // else if (isPay && !point_id && this.delivery?.data?.delivery_info) {
            //     order.delivery_info_attributes = this.delivery.data.delivery_info;
            // }
            if (this.delivery.selectedId) {
                order.delivery_variant_id = this.delivery.selectedId;
            }
            // if (!isPay && this.delivery?.customer_pickup && this.delivery?.data) {
            //     order.delivery_info_attributes = JSON.stringify(this.delivery.data.delivery_info);
            // }

            return {
                shipping_address: address,
                order: order,
                client: {
                    consent_to_personal_data: 0,
                    consent_to_personal_data: 1
                },
                "g-recaptcha-response": null,
                recaptcha_type: "invisible"
            };
        }

        // Получить доставки, доступные для выбранного способа оплаты
        getDeliverAvailable(payment_id) {
            if ($.isEmptyObject(this.payments)) return;
            let deliverIds = {};

            for (const key in this.payments) {
                if (payment_id == key) {
                    const deliverVariantsIds = this.payments[key].deliverVariantsIds;

                    for (const key in this.deliveries) {
                        const delivery_id = Number(key);
                        deliverIds[key] = deliverVariantsIds.findIndex(id => id == delivery_id) != -1;
                    }
                    return deliverIds;
                }
            }
        }

        // [New] В классе EMGeo добавить метод для получения оригинального ID по uniqueId
        getOriginalIdByUniqueId(uniqueId) {
            if (!this.deliveriesExtended) return null;
            
            const delivery = this.deliveriesExtended.find(info => info.uniqueId === uniqueId);
            return delivery ? delivery.id : null;
        }

        getOriginalDeliversFull(id, position) {
            if (!this.deliveriesExtended || !id || !position) return null;
            
            return this.deliveriesExtended.find(
                info => info.id === id && info.originalDelivery?.position === position
            );
        }

        // [New] Обновить метод getDeliverAvailable для работы с uniqueId из DOM
        getDeliverAvailableForDOM(payment_id) {
            if ($.isEmptyObject(this.payments)) return;
            let deliverIds = {};

            for (const key in this.payments) {
                if (payment_id == key) {
                    const deliverVariantsIds = this.payments[key].deliverVariantsIds;

                    // Проверяем как обычные доставки, так и расширенные
                    if (this.deliveriesExtended) {
                        for (const delivery of this.deliveriesExtended) {
                            const isAvailable = deliverVariantsIds.findIndex(el => el.id == delivery.id) != -1;
                            deliverIds[delivery.uniqueId] = isAvailable;
                        }
                    } else {
                        for (const key in this.deliveries) {
                            deliverIds[key] = deliverVariantsIds.findIndex(el => el.id == key) != -1;
                        }
                    }
                    return deliverIds;
                }
            }
        }

        // Получить и установить данные о доставке
        async setDataDelivery() {
            if (!this.city || !this.country) {
                this.print.printWarn("Нет данных о текущем местоположении", {
                    country: this.country,
                    city: this.city
                });
                if (window.em_order_instance) {
                    window.em_order_instance.showErrors([{
                        type: "all",
                        text: "Не удалось определить текущее местоположение. Попробуйте выбрать город вручную."
                    }]);
                }
                return false;
            }

            for (const city of await this.getSearchLocation(this.city)) {
                if (city.country == this.country && city.last_level == this.city) {
                    this.kladr = city;
                    return await this.getDeliveries(city);
                }
            }
        }

        // Установить актуальную ифнормацию о доставке
        setActiveDelivery(delivery, id, price) {
            if (
                this.delivery.selectedId === id && price === this.delivery.price
            ) return;

            this.delivery.selectedId = id;
            this.delivery.data = delivery;
            this.delivery.name = delivery?.title ?? null;
            this.delivery.description = delivery?.description ?? null;
            this.delivery.free = typeof delivery?.free === "boolean" ? delivery.free : false;
            this.delivery.priceFree = delivery?.charge_up_to == null ? null : Number(delivery.charge_up_to);
            this.delivery.price = price;
            this.delivery.customer_pickup = delivery.customer_pickup;
            this.delivery.delivery_info = null;

            if (delivery.tariff_id) {
                this.delivery.tariff_id = delivery.tariff_id;
                this.delivery.shipping_company_handle = delivery.shipping_company_handle;
            }
            
            // if (delivery.customer_pickup) {
            //     this.delivery.customerPickupData = JSON.stringify(delivery.delivery_info);
            // }
            // else {
            //     this.delivery.customerPickupData = null;
            // }
            
            // Очищаем кеш при смене доставки
            // this.clearDeliveryCache();
        }

        // New
        // Запомнить новую точку самовывоза
        setPoint(point_id) {
            if (!point_id || !this.points) return;

            //  if (!this.points) await em_geo.getPointsMap();

            const point = this.points.find(point => point.id == point_id),
                tariff = point?.tariffs?.[0];
            if (point && tariff) {
                // this.delivery.customerPickupData = JSON.stringify(

                this.delivery.data.delivery_info = {
                    delivery_interval: tariff.delivery_interval,
                    outlet: {
                        id: this.MD5(`https://cost-rater.insales.ru/api/checkout/v1/delivery_points_${point_id}_${point.longitude}_${point.latitude}`),
                        external_id: point_id,
                        type: point.type,
                        longitude: point.longitude,
                        latitude: point.latitude,
                        title: point.title + (tariff?.title ? ` (${tariff.title})` : ""),
                        address: point.address,
                        description: point.description,
                        payment_method: point.payment_method,
                        source_id: 4197172 // !!! Не знаю откуда брать этот параметр, он фикс у всех ПВЗ
                    },
                    fields_values: [],
                    delivery_variant_id: this.delivery.selectedId,
                    tariff_id: tariff.id,
                    title: this.delivery?.name ?? null,
                    description: this.delivery?.description ?? null,
                    price: tariff.price,
                    shipping_company: point.shipping_company_handle,
                    shipping_company_handle: point.shipping_company_handle,
                    errors: [],
                    warnings: [],
                    not_available: null
                };
            }
        }

        setCookies(newCountry, newCity, kladr) {
            if (
                !newCountry || !newCity ||
                newCountry === this.country && newCity === this.city
            ) {
                return false;
            }
            Cookies.set('rev-country-location', newCountry);
            Cookies.set('rev-current-location', newCity);
            this.country = newCountry;
            this.city = newCity;
            if (kladr) this.kladr = kladr;

            return true;
        }

        // Смена активной доставки по id доставки
        async changeActiveDelivery(uniqueId) {
            if (!this.deliveriesExtended) {
                this.deliveriesExtended = await this.getFullDeliveries();
            }
            
            // Ищем доставку по уникальному ID
            const selectedDelivery = this.deliveriesExtended.find(info => info.uniqueId === uniqueId);
            
            if (selectedDelivery) {
                this.print.printLog("Доставка успешно изменена:", uniqueId);
                
                // Используем оригинальные данные для API совместимости
                this.setActiveDelivery(
                    selectedDelivery.originalDelivery, 
                    selectedDelivery.id, // оригинальный ID для API
                    selectedDelivery.price ?? selectedDelivery.originalDelivery.price
                );
                
                // Сохраняем дополнительные данные для внешних доставок
                // if (selectedDelivery.tariff_id) {
                //     this.delivery.tariff_id = selectedDelivery.tariff_id;
                //     this.delivery.shipping_company_handle = selectedDelivery.shipping_company_handle;
                // }
                
                return;
            }
            
            this.print.printWarn("Не удалось сменить доставку, данные не найдены", uniqueId);
            if (window.em_order_instance) {
                window.em_order_instance.showErrors([{
                    type: "all",
                    text: "Не удалось сменить доставку. Попробуйте выбрать другой вариант."
                }]);
            }
        }

        MD5(d) {
            if (!d) {
                window.em_order_instance.showErrors([{
                    type: "all",
                    text: "Ошибка выбора пункта ПВЗ, попробуйте другой вариант доставки или обратитесь в поддержку."
                }]);
                return;
            }
            function M(d) { for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++)_ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _); return f } function X(d) { for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++)_[m] = 0; for (m = 0; m < 8 * d.length; m += 8)_[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32; return _ } function V(d) { for (var _ = "", m = 0; m < 32 * d.length; m += 8)_ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255); return _ } function Y(d, _) { d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _; for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) { var h = m, t = f, g = r, e = i; f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e); } return Array(m, f, r, i) } function md5_cmn(d, _, m, f, r, i) { return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m) } function md5_ff(d, _, m, f, r, i, n) { return md5_cmn(_ & m | ~_ & f, d, _, r, i, n) } function md5_gg(d, _, m, f, r, i, n) { return md5_cmn(_ & f | m & ~f, d, _, r, i, n) } function md5_hh(d, _, m, f, r, i, n) { return md5_cmn(_ ^ m ^ f, d, _, r, i, n) } function md5_ii(d, _, m, f, r, i, n) { return md5_cmn(m ^ (_ | ~f), d, _, r, i, n) } function safe_add(d, _) { var m = (65535 & d) + (65535 & _); return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m } function bit_rol(d, _) { return d << _ | d >>> 32 - _ }
            d = unescape(encodeURIComponent(d));
            return (
                M(V(Y(X(d), 8 * d.length)))
            ).toLowerCase();
        }

        // Очистка кэша
        clearDeliveryCache() {
            this._cachedDeliveryData = null;
            this.deliveriesExtended = null;
            // this.points = null;
        }
    }

    // import EMGeo from "../geo/index.js";

    // var em_geo = new EMGeo();
    // data-em-form-city
    class KladrForm {
        constructor($container, data) {
            this.print = Print;
            this.print.name = "[EM-Kladr]";

            this.$container = $container;

            this.kladr = [];
            this.indexKladr = null;
            this.acceptInput = data.acceptInput ?? false;

            this.classes = {
                selectCountry: data.selectCountry,
                inputCity: data.inputCity
            };
            this.data = {
                // selectCountry: "select-country",
                selectCity: "select-sity"
            };

            this.$btnAccept = $container.find("[data-em-accept-city]");
            this.$inputCity = $container.find("[data-em-input-city]");
            // this.$selectCity = $container.find("[data-em-select-sity]");
            this.$selectContainerCity = $container.find("[data-em-select-container-city]");

            // Обертка для ввода текста с задержкой 500 мс
            this.debounce = (function (func) {
                let timer;
                return function (query) {
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => func.call(this, query), 500);
                };
            })(this.fetchCities);
        }

        init() {
            const $selectCountry = this.$container.find(`.${this.classes.selectCountry} + .select__body`);

            this.country = em_geo.country;

            // Установить страну
            if (this.country !== "RU") {
                const $button = $selectCountry.find(`[data-value="${this.country}"]:first`);

                this.$container.find(`.${this.classes.selectCountry}:first`).val(this.country);
                $selectCountry.find(".select__content:first").text($button.text());
                $selectCountry.find(`.select__option[hidden]:first`).attr("hidden", false);
                $button.attr("hidden", true);
            }
            // Установить город
            if (em_geo.city) {
                this.$container.find(`.${this.classes.inputCity}`).val(em_geo.city);
            }

            // Установка событий
            this.$inputCity.on("input", (e) => {
                if (e.target.value) {
                    this.debounce(e.target.value);
                }
            });
            this.$selectContainerCity.on("click", "[data-select-city]", this.onClickCity.bind(this));
            this.$btnAccept.on("click", this.onAccept.bind(this));

            $selectCountry.on("click", ".select__option", (e) => {
                this.country = e.target.dataset.value;
                this.$selectContainerCity.attr("hidden", true);
                this.$selectContainerCity.find(`[data-em-${this.data.selectCity}]`).html("");
                this.$inputCity.val("");
            });
        }

        async onAccept() {
            const kladr = this.kladr[this.indexKladr];
            if (kladr && em_geo.setCookies(this.country, kladr.city ?? kladr.last_level, kladr)) {
                window.em_order_instance.showLoaders();

                const deliveries = await em_geo.getFullDeliveries();

                // this.print.printWarn("Город успешно выбран:", deliveries);
                this.createEvent({
                    data: deliveries,
                    kladr: kladr
                });
            }
        }

        onClickCity(e) {
            const
                newCity = e.target.dataset.selectCity,
                indexKladr = Number(e.currentTarget.dataset.value);

            if (newCity && !isNaN(indexKladr)) {

                this.indexKladr = indexKladr;
                this.$inputCity.val(newCity);
                this.$btnAccept.removeAttr("disabled");
                this.$selectContainerCity.attr("hidden", true);

                if (this.acceptInput) this.onAccept();
            }
        }

        async fetchCities(query) {
            const cities = await em_geo.getSearchLocation(query, this.country);

            let html = "";
            if (cities && cities?.length) {
                this.kladr = cities;
                for (const i in cities) {
                    const city = cities[i];
                    html += `<button class="select__option" data-value="${i}" type="button" data-select-city="${city.city ?? city.last_level}">${city.result}</button>`;
                }
            }
            else {
                this.kladr = [];
                html = `<button class="select__option" type="button">Не найдено</button>`;
            }

            this.$selectContainerCity.attr("hidden", false);
            this.$selectContainerCity.find(`[data-em-${this.data.selectCity}]`).html(html);
        }

        createEvent(data) {
            // Вернет полное описание доставок
            document.dispatchEvent(new CustomEvent("update-city", {
                detail: data
            }));
        }
    }

    // import Map from "./map.js";

    // отрисовка составка корзины
    function cart(orders) {
        let html = "";
        for (const order of orders) {
            const price = order.sale_price;
            const oldPrice = order.product?.old_price ? Number(order.product.old_price) : order.sale_price;

            html += Template.render({
                variant_id: order.variant_id,
                title: order.title,
                image: order.first_image.large_url,
                price: price,
                priceFormat: Shop.money.format(price),
                priceOld: oldPrice,
                quantity: order.quantity,
                maxQuantity: order.variant_quantity,
                // options: true,
                isDiscount: price < oldPrice,
            }, "order-item");
        }

        return html;
    }

    function getPickupLabelHTML(delivery, point) {
        if (!point || !delivery.customer_pickup || !point.outlet?.title || Number(point.delivery_variant_id) != delivery.id) return "";
       
        return "<span class='order__options-pickup__name' data-em-pickup-name>" +
            `<span style="color:#585858;">${point.delivery_interval.description}</span>` + 
            `<span>Пунтк: ${point.outlet.title}</span>` +
            `<span>Адрес: ${point.outlet.address ?? "не выбран"}</span>` +
        "</span>";
    }

    function delivery(deliveries, point) {
        let html = "";
        if (deliveries.length == 0) return "";

        for (const key in deliveries) {
            const delivery = deliveries[key];
            // Используем uniqueId для HTML элементов, но оригинальный id сохраняем как data-атрибут
            // const elementId = delivery.uniqueId || delivery.id;
            const price = point && delivery.customer_pickup && Number(point.delivery_variant_id) == delivery.id ? 
                Shop.money.format(point.price) : 
                delivery.price ? Shop.money.format(delivery.price) : "";

            html += Template.render({
                delivery: delivery,
                elementId: delivery.uniqueId || delivery.id,
                price: price,
                deliveryItemPrice: options.data.deliveryItemPrice,
                pickupLabelHTML: getPickupLabelHTML(delivery, point)

            }, "delivery-item");
        }
        return html;
    }

    function getPatIcons(title, handle) {
        if (title == "Долями") {
            return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_284_37469)"><path d="M20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20C15.5228 20 20 15.5228 20 10Z" fill="white"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M15 4H17V13H15V4ZM11 5H13V14H11V5ZM8.99997 5.99999H6.99999V15H8.99997V5.99999ZM3 7.00003H4.99999V16H3V7.00003Z" fill="black"></path></g><defs><clipPath id="clip0_284_37469"><rect width="20" height="20" fill="white"></rect></clipPath></defs></svg>';
        }
        else if (handle == "sbp") {
            return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.84689 0L8.78281 9.073L11.2827 10.5962V4.37091L8.84689 0Z" fill="#FAB719"></path><path d="M8.84535 11.2581V20L11.2811 15.4966V12.8476L8.84535 11.2581Z" fill="#61B42C"></path><path d="M17.6922 14.1738L2.30859 4.37229L4.61614 8.61079L13.3335 14.1738H17.6922Z" fill="#208BC9"></path><path d="M8.84535 0L17.6909 5.56298H13.3322L11.2811 4.37091L8.84535 0Z" fill="#F77C1C"></path><path d="M11.2833 6.99354L13.3344 5.56305H17.6932L11.2833 9.93396V6.99354Z" fill="#D60B4C"></path><path d="M11.2811 15.4948L13.3322 14.1703H17.6909L8.84535 19.9982L11.2811 15.4948Z" fill="#097F2D"></path><path d="M2.30859 4.37229V15.4983L4.48792 11.3923L4.61614 8.61079L2.30859 4.37229Z" fill="#5B59A1"></path><path d="M6.69292 9.93534L4.48792 11.3923L2.30859 15.4983L8.84663 11.2599L6.69292 9.93534Z" fill="#9F4393"></path></svg>';
        }
        else {
            return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.125 3.75C2.09473 3.75 1.25 4.59473 1.25 5.625V14.375C1.25 15.4004 2.09473 16.25 3.125 16.25H16.875C17.9053 16.25 18.75 15.4053 18.75 14.375V5.625C18.75 4.59473 17.9004 3.75 16.875 3.75H3.125ZM3.125 5H16.875C17.2266 5 17.5 5.27344 17.5 5.625V6.25H2.5V5.625C2.5 5.26855 2.76855 5 3.125 5ZM2.5 7.5H17.5V14.375C17.5 14.7266 17.2266 15 16.875 15H3.125C2.77344 15 2.5 14.7266 2.5 14.375V7.5Z" fill="#111111"></path></svg>';
        }
    }

    // отрисовка оплаты
    function payment(payments) {
        let html = "";
        if (payments.length == 0) return "";

        for (const key in payments) {
            // const payment = payments[key];
            html += Template.render({
                key: key,
                payment: payments[key]
                // funcGetPatIcons: getPatIcons
            }, "payment-item");

            // html += `<div class="order__options-item">
            //     <input id="order-pay_${key}" class="order__options-input" ${payment.selected ? "checked" : ""} type="radio" value="${key}" name="em-payments" hidden>
            //     <label for="order-pay_${key}" class="order__options-label">
            //         <span class="order__options-text">${payment.title}</span>
            //         ${getPatIcons(payment.title, payment.style_handle)}
            //     </label>
            // </div>`;
        }
        return html;
    }

    function pointMap(point) {
        let html = "";
        for (const tariff of point.tariffs) {
            html += `Стоимость: ${Shop.money.format(tariff.price)}<br>
            Срок: ${tariff.delivery_interval.description}<br>
            Доставка: ${tariff.title}`;
        }

        return `<b>${point.address}</b><br>
        <button class="em-ymap__btn" data-em-pickup-delivery-id="${point.id}">Выбрать</button>
        <div>${html}</div>`;
    }

    var Draw = { cart, delivery, payment, pointMap };

    var options = {
        data: {
            orderLine: "basket-items", // Состав корзины
            btnOpenMap: "map-open-modal",
            value: "value",

            orderTotal: "order-total",
            bonusSize: "bonus-size",
            salePrice: "sale-price",
            deliveryPrice: "delivery-price",
            itemsPrice: "items-price",
            totalPrice: "total-price",
            btnSubmit: "btn-submit",
            btnInputClear: "input-clear",

            quantity: "item-quantity", // кол-ва товара
            checkbox: "checkbox",
            btnSubmitPromo: "submit-promo",
            btnSubmitSertificate: "submit-sertificate",

            typeInput: "type",

            payments: "payments",
            deliveries: "deliveries",
            deliveryItemPrice: "del-price",

            name: "name",
            surname: "surname",
            phone: "phone",
            email: "email",
            channel: "select-channel",
            birthday: "birthday",
            comment: "comment",
            address: "address",
            // New fields
            entrance: "entrance", // Подъезда
            floor: "Floor", // Этаж
        },
        classes: {
            orderWrapper: "order__input-wrap",
            orderItem: "order-options__item",

            input: "em-input",
            // inputPay: "em-input__pay", // Не использовал
            inputCity: "em-input__city",
            inputPromo: "em-input__promo",
            // inputDelivery: "em-input__delivery", // Не использовал
            inputClear: "em-input__clear",
            selectCountry: "em-select__country",
            checkbox: "em-checkbox",
            messPromoError: "em-message__promo-error"
        },
        names: {
            inputdelivery: "em-deliveries",
            inputPay: "em-payments"
        }
    };

    /**
     * @typedef {Object} ClassesType
     * @property {string} wrap - CSS-класс для контейнера с полем
     * @property {string} success - CSS-класс добавляется к общему блоку уведомелния об успехе
     * @property {string} error - CSS-класс добавляется к общему блоку уведомелния об ошибке
     * @property {string} spanError - CSS-класс для блока с выводом ошибки локально
     */

    /**
     * @typedef {Object} ErrorType
     * @property {string} type - Тип ошибка / name input с ошибкой
     * @property {string} text - Текст ошибки
     */

    class MessageForm {
        /**
         * Уведомления об ошибках при заполнении формы
         * @param {JQeryObject} $form - Форма, в рамкаках которой работают уведомелния
         * @param {ClassesType} formClasses - Список классов
         * @param {string} dataMessage - Data-атрибут общего блока уведомления 
         */
        constructor($form, formClasses, dataMessage) {
            this.$form = $form;
            this.$message = dataMessage ? $form.find(`[${dataMessage}]`) : null;
            this.formClasses = formClasses;

            if (this.$message?.length) {
                // Кнопка закрытия статичной формы ошибки
                this.$message.find(".message-form__close").on("click", () => {
                    this.$message.fadeOut(300);
                });
            }
        }

        showSuccess() {
            this.$form.find(`.${this.formClasses.wrap}`).removeClass(this.formClasses.wrap);
            if (this.$message?.length) {
                this.$message.attr("hidden", false)
                    .addClass(this.formClasses.success)
                    .removeClass(this.formClasses.error)
                    .find("span:first").text("данные сохранены");
            }
        }

        /**
         * @param {ErrorType[]} errors - Массив ошибок
         */
        showErrors(errors) {
            this.$form.find(`.${this.formClasses.wrap}`).removeClass(this.formClasses.wrap);
            this.$form.find(`.${this.formClasses.spanError}`).remove();

            let errorTitle = "", scrollToError = false;
            for (const error of errors) {
                if (error.type == "all" || error.type == "access") {
                    errorTitle += error.text + ", "
                    continue;
                }
                const $parent = error.type.includes("em-") ? 
                    this.$form.find(`[data-${error.type}]`) :
                    this.$form.find(`[name="${error.type}"]`).closest("[data-em-wrapper]"),
                    $spanError = $parent.find(`.${this.formClasses.spanError}`);

                if ($spanError.length) {
                    $spanError.text(error.text);
                    $parent.addClass(this.formClasses.wrap);
                }
                else if ($parent.length) {
                    $parent.addClass(this.formClasses.wrap).append(`<span class="${this.formClasses.spanError}">${error.text}</span>`);
                }
                if (!scrollToError) {
                    scrollToError = true;
                    const top = $parent.offset()?.top ?? 100;
                    $("html").animate({
                        scrollTop: top - 100
                    }, 500);
                }
            }
            if (!this.$message?.length) return;
            if (errorTitle) {
                this.$message.attr("hidden", false)
                    .css("display", "")
                    .addClass(this.formClasses.error)
                    .removeClass(this.formClasses.success)
                    .find("span:first").text(errorTitle ? errorTitle.substring(0, errorTitle.length - 2) : "ошибка, заполните поля корректно!");

                if (!scrollToError) {
                    $("html").animate({
                        scrollTop: this.$message.offset().top - 100
                    }, 500);
                }
            }
            else {
                this.$message.attr("hidden", true);
            }
        }

        hideErrors() {
            this.$message.attr("hidden", true);
        }

        hideErrorsInBlock($block) {
            $block.find(`.${this.formClasses.wrap}`).removeClass(this.formClasses.wrap);
            $block.find(`.${this.formClasses.spanError}`).remove();
        }
    }

    class EM_Order extends MessageForm {
        constructor() {
            const $order = $("[data-em-order]");

            super($order, {
                    wrap: "message-form__wrap",
                    success: "order-message__success",
                    error: "order-message__error",
                    spanError: "order__field-error"
                },
                "data-em-order-message"
            );
            this.print = Print;
            this.print.name = "[EM-Order]";

            this.data = options.data;
            this.classes = options.classes;
            this.names = options.names;
            // this.params = params;
            this.items = {
                $promo: $order.find(`input.${this.classes.inputPromo}`),
                $btnPromo: $order.find("button[data-em-submot-promo]"),
                $orderLine: $order.find(`[data-em-${options.data.orderLine}]`),
                $deliveryLine: $order.find(`[data-em-${this.data.deliveries}]`),
                $orderTotal: $order.find(`[data-em-${options.data.orderTotal}]`)
            };
            this.$popupMap = $order.find("#popup-ym-pickup-map");
            this.$order = $order;
            this.loaders = {
                delivery: new EM_Module.Loader(this.items.$deliveryLine),
                order: new EM_Module.Loader($order.find(".order__right:first")),
                pay: new EM_Module.Loader($order.find(`[data-em-${options.data.payments}]`)),
                wishes: new EM_Module.Loader($order.find(".order__step-wishes:first")) // Подарочная упаковка
            };
            this.isInit = false;
        }

        init() {
            this.showLoaders();

            if (!Cart || !Cart.order._inited || EventBus === undefined) {
                setTimeout(this.init.bind(this), 350);
                return;
            }
            /*
            * [Отключил] Проверка определния всех элементов
            for (const key in this.items) {
                if (!this.items[key].length) {
                    Print.throwException(`Элемент "${key} не найден!"`);
                }
            }
            */
            const em_kladar = new KladrForm(this.$order.find("[data-em-form-city]"), {
                selectCountry: this.classes.selectCountry,
                inputCity: this.classes.inputCity,
                acceptInput: true
            });

            this.initForm();
            this.initEvent();

            em_kladar.init();

            this.updateCart();
            this.hideLoaders();
        }

        initEvent() {
            // === Слушатели событий ===
            document.addEventListener("click", this.onClick.bind(this));
            // document.addEventListener("input", this.input.bind(this));
            // document.addEventListener("focusout", this.blur.bind(this));
            document.addEventListener("change", this.change.bind(this));
            document.addEventListener("update-city", this.updateCity.bind(this));

            // document.addEventListener("change", this.change.bind(this));
            // this.$order.find(`.${this.classes.inputCity}`).keyup(this.keyup.bind(this));

            EventBus.subscribe('update_items:insales:cart', this.update.bind(this));
        }

        async initForm() {
            const $order = this.$order;
            // Вынести в другое место
            await em_geo.init();
            await em_geo.setDataDelivery();

            if (em_geo.client.authorized) {
                $order.find(`[data-em-${this.data.name}]`).val(em_geo.client.name);
                $order.find(`[data-em-${this.data.surname}]`).val(em_geo.client.surname);
                $order.find(`[data-em-${this.data.phone}]`).val(phoneMask.formatPhone(em_geo.client.phone, false));
                
                if (em_geo.client.comment) {
                    $order.find(`[data-em-${this.data.comment}]`).val(em_geo.client.comment);
                }
            } else {
                $order.find(`[data-em-${this.data.email}]:first`).closest(".order__row").removeAttr("hidden");
                $order.find(`[data-em-${this.data.birthday}]:first`).closest(".order__row").removeAttr("hidden");
            }

            if (!em_geo.kladr) {
                this.items.$orderTotal.find("[data-em-value]").text("страна не найдена");
            }
            // ! Скрыл
            // const coupon = Cart.order.coupon;
            // if (coupon) {
            //     $order.find(`[${this.classes.inputPromo}]`).val(coupon.value);
            //     if (coupon.error.length) {
            //         $order.find(`[${this.classes.messPromoError}]`).attr("hidden", false).text(coupon.error);
            //     }
            // }
            $order.find(`[data-em-${this.data.btnSubmit}]:first`).prop("disabled", false).removeAttr("hidden");
            this.isInit = true;

            await this.updateDelivery(true);
            if (em_geo.isCustomerPickup) {
                this.$order.find(`[data-em-${this.data.address}]`)
                    .val("")
                    .closest(".order__row-wrapper").attr("hidden", true);
            }
            else {
                this.$order.find(`[data-em-${this.data.address}]`)
                    .closest(".order__row-wrapper").removeAttr("hidden");
            }
        }

        initMap() {
            if (!em_geo.kladr || !em_geo.kladr.latitude || !em_geo.kladr.longitude) {
                this.print.printError("Ошибка инициализации ymaps карты, Kladr не найден!");
                this.showErrors([{
                    type: "all",
                    text: "Ошибка инициализации карты. Попробуйте обновить страницу."
                }]); // Затираем предыдущие ошибки для критической ошибки
                return;
            }

            try {
                this.myMap = new ymaps.Map("em-pickup-map", {
                    center: [em_geo.kladr.latitude, em_geo.kladr.longitude],
                    zoom: 11
                });

                this.clusterer = new ymaps.Clusterer({
                    preset: 'islands#blueClusterIcons', // стиль кластеров, как на вашем скриншоте
                    groupByCoordinates: false,
                    clusterDisableClickZoom: false
                });

                this.myMap.geoObjects.add(this.clusterer);

                // this.GeoObject = new ymaps.GeoObjectCollection();
                // this.myMap.geoObjects.add(this.GeoObject);

                this.updateMapPoints();
            }
            catch (_) {
                this.showErrors([{
                    type: "all",
                    text: "Ошибка инициализации карты. Попробуйте обновить страницу."
                }]);
            }
        }

        async updateMapPoints(center) {
            const points = await em_geo.getPointsMap();
            if (!points.length) {
                this.print.printWarn("Ошибка, точки самовывоза не найдены!", points);
                this.showErrors([{
                    type: "all",
                    text: "Точки самовывоза не найдены для выбранного местоположения."
                }]);
                return;
            }
            this.myMap.setCenter(
                center ?? [em_geo.kladr.latitude, em_geo.kladr.longitude],
                11, { duration: 500 }
            );

            this.clusterer.removeAll();
            // this.GeoObject.removeAll();

            for (const point of points) {
                const placemark = new ymaps.Placemark([point.latitude, point.longitude], {
                    balloonContent: Draw.pointMap(point)
                });
                this.clusterer.add(placemark);
                // this.GeoObject.add(placemark);
            }
        }

        /* === Обновления элементов заказа === */
        update(cart) {
            switch (cart.action?.method) {
                case "update_items":
                    if (this.isInit) {
                        this.updateDelivery(true);
                    }
                    break;
                case "add_items":
                    this.updateCart(cart.action.currentItems, true);
                    this.updateDelivery(true);
                    break;
                case "delete_items":
                    this.deleteItemCart(cart.order_lines, cart.action.items);
                    this.updateDelivery(true);
                    break;
                case "set_items":
                    this.changeCartItems(cart.action.items);
                    this.checkAvailabilityInDOM(cart.action.currentItems);
                    this.updateDelivery(true);
                    break;
                case "set_coupon":
                    this.setCupon(cart);
                    break;
                case "clear_items":
                    this.items.$orderLine.html("");
                    break;
                default:
                    this.print.printWarn(`Метод '${cart.action?.method}' не определен`, cart.action);
            }
        }

        updateCity(data) {
            this.updateDelivery(true, data.detail);
        }

        async updateDelivery(change, detail) {
            this.showLoaders();

            var deliveries = detail?.deliveries ?? await em_geo.getFullDeliveries();

            if (!deliveries.length) {
                this.print.printError("Варианты доставки не найдены", deliveries);
                this.hideLoaders();
                this.showErrors([{
                    type: "all",
                    text: "Варианты доставки не найдены для выбранного местоположения."
                }]); // Затираем предыдущие ошибки для критической ошибки
                return;
            }

            let point;
            if (em_geo.delivery?.customer_pickup && em_geo.delivery?.data) {
                // if (!em_geo.points) await em_geo.getPointsMap();
                // point = em_geo.customerPickupDataJSON;.outlet?.external_id
                point = em_geo.delivery.data.delivery_info;
            }

            if (change) {
                // Обновить html доставки
                this.items.$deliveryLine.html(Draw.delivery(
                    deliveries, point
                ));
            }
            else {
                const $line = this.items.$deliveryLine;
                for (const key in deliveries) {
                    const delivery = deliveries[key];
                    if (delivery.customer_pickup) continue;
                    
                    // Ищем элемент по uniqueId
                    const elementId = delivery.uniqueId || delivery.id;
                    $line.find(`#item-delivery_${elementId}`)
                        .closest('.order__options-item')
                        .find(`[data-em-${this.data.deliveryItemPrice}]`)
                        .text(Shop.money.format(delivery.price));
                }
            }

            // if (em_geo.delivery?.customer_pickup && !em_geo.points) {
            //     await em_geo.getPointsMap();
            //     const point = em_geo.customerPickupDataJSON
                
            //     this.updatePayment(change, point ? point.outlet.external_id : null);
            // }
            // else {
            //     this.updatePayment(change);
            // }

            this.updatePayment(change, point ? point.outlet.external_id : null);
        }

        async updatePayment(change, point_id) {
            // Запрос
            const forOrder = await em_geo.getPayments(point_id);
            // Стоиомость доставки в ПВЗ forOrder.delivery_info.price
            if (!forOrder) return;

            // Отрисовка способов оплаты
            if (change) {
                this.$order.find(`[data-em-${this.data.payments}]`).html(
                    Draw.payment(forOrder.payments)
                );
            }
            if (point_id && this.$popupMap.hasClass("popup_show")) {
                const btn = this.$popupMap.find("[data-close]:first").get(0);
                if (btn) btn.dispatchEvent(new Event("click", { bubbles: true }));
            }
            // this.updateOrderPrice(forOrder.order);
            this.updateOrderPrice(Cart.order);
            // const order = forOrder.order;
            // this.updateOrderPrice({
            //     items_price: order.items_price,
            //     discounts: order.discounts,

            // });
        }

        // Обновление общей стоимостей корзины: доставка, скидки, итого
        updateOrderPrice(order) {
            const $total = this.items.$orderTotal;
            // Интеграция с бонусной системой
            // $total.find(`[data-em-${this.data.bonusSize}]`).text();

            let sale = 0;
            for (const discount of order.discounts) {
                sale += discount.amount;
            }

            $total.find(`[data-em-${this.data.salePrice}]`)
                .attr("hidden", !sale)
                .find(`[data-em-${this.data.value}]`).text(Shop.money.format(sale));

            $total.find(`[data-em-${this.data.itemsPrice}]`)
                .removeAttr("hidden")
                .find(`[data-em-${this.data.value}]`).text(Shop.money.format(order.items_price)); // Без скидок

                // em_geo.delivery.selectedId
            $total.find(`[data-em-${this.data.deliveryPrice}]`)
                .attr("hidden", false)
                .find(`[data-em-${this.data.value}]`).text(
                    em_geo.delivery.free || em_geo.delivery.priceFree === 0 ? 
                        "бесплатно" : 
                        em_geo.delivery.selectedId && em_geo.delivery?.price && em_geo.delivery.price !== 0 ? 
                            Shop.money.format(em_geo.delivery.price) : 
                            "не выбрана"
                );

            // Полная стоимость
            $total
                .find(`[data-em-${this.data.totalPrice}]`)
                .find(`[data-em-${this.data.value}]`).text(
                    Shop.money.format(
                        Cart.order.items_price 
                        + (em_geo.delivery.free || em_geo.delivery.priceFree === 0 ? 0 : Number(em_geo.delivery?.price ?? 0) )
                        - sale
                    )
                );


            setTimeout(() => {
                this.hideLoaders();
            }, 300);
        }

        // Обновление состава корзины
        updateCart(order_lines = Cart.order.order_lines, append = false) {
            if (this.checkEmptinessCart(order_lines)) return;
            if (append) {
                this.items.$orderLine.append(Draw.cart(order_lines));
            }
            else {
                this.items.$orderLine.html(Draw.cart(order_lines));
            }

            this.hideErrors();
            this.items.$orderLine.removeAttr("hidden");
            this.$order.find(`[data-em-${this.data.btnSubmit}]:first`).prop("disabled", false);
        }

        // Изменение кол-ва элементов
        changeCartItems(itemsID) {
            for (const variant_id in itemsID) {
                this.items.$orderLine
                    .find(`[data-em-cart-id="${variant_id}"] [data-em-${this.data.quantity}]`)
                    .text(itemsID[variant_id]);
            }
        }

        async changeDelivery(uniqueId) {
            const oldOrderIsPickup = em_geo.isCustomerPickup;
            // Теперь принимает uniqueId вместо обычного id
            await em_geo.changeActiveDelivery(uniqueId);
            if (em_geo.isCustomerPickup) {
                this.$order.find(`[data-em-${this.data.address}]`)
                    .val("")
                    .closest(".order__row-wrapper").attr("hidden", true);
            }
            else {
                this.$order.find(`[data-em-${this.data.address}]`)
                    .closest(".order__row-wrapper").removeAttr("hidden");
            }
            if (!em_geo.isCustomerPickup && oldOrderIsPickup) {
                this.items.$deliveryLine.find("[data-em-pickup-name]:first").html("");
            }
            this.loaders.delivery.call();
            this.loaders.pay.call();
            this.updatePayment(true);
        }

        // Очистка поля ввода
        clearInput(btnClear) {
            const wrapper = btnClear?.closest("._active");

            if (!btnClear || !wrapper) return;

            const input = wrapper.querySelector("input");
            if (input) {
                wrapper.classList.remove("_active");
                input.value = "";
            }
        }

        setCupon(cart) {
            // ??? Стоит ли обновлять доставку или только цены
            for (const product of this.items.$orderLine.children()) {
                const 
                    variant_id = Number(product.dataset.emCartId),
                    order = Cart.order.getItemByID(variant_id);
                if (!variant_id || !order) {
                    product.remove();
                    continue;
                }

                const
                    productPrice = product.querySelector("[data-is-discount]"),
                    isDiscount = productPrice.dataset.isDiscount === "true",
                    price = Number(productPrice.dataset.customPrice ?? 0);

                if (!productPrice) continue;

                const discount = {
                    price: order.sale_price,
                    oldPrice: order.product?.old_price ? Number(order.product.old_price) : order.sale_price
                };

                if (isDiscount) {
                    if (discount.price == discount.priceOld) {
                        // Убрать скидку
                        productPrice.innerHTML = Shop.money.format(discount.price);
                        productPrice.dataset.customPrice = discount.price;
                        productPrice.dataset.isDiscount = "false";
                    }
                    else if (price !== discount.price) {
                        // Изменить размер скидки
                        productPrice.children[0].innerText = Shop.money.format(discount.price);
                        productPrice.dataset.customPrice = discount.price;
                    }
                }
                else if (discount.price < discount.priceOld) {
                    // Установить скидку
                    productPrice.innerHTML = 
                        `<span class="products-item__price products-item__price-new">${Shop.money.format(discount.price)}</span>
                        <span class="products-item__price-old"><s>${Shop.money.format(discount.priceOld)}</s></span>`;
                    productPrice.dataset.customPrice = discount.price;
                    productPrice.dataset.isDiscount = "true";
                }
            }
            this.updateDelivery(false);
        }

        /**
         * Удалить товары из верстки
         * @param {Array} order_lines 
         * @param {Object} items 
         */
        deleteItemCart(order_lines, items) {
            if (this.checkEmptinessCart(order_lines)) return;
            for (const variant_id of items) {
                this.items.$orderLine.find(`[data-em-cart-id="${variant_id}"]`).remove();
            }
        }

        // Проверка корзины на пустоту
        checkEmptinessCart(order_lines) {
            if (!order_lines || !order_lines.length) {
                this.print.printError("Ошибка, корзина пуста", order_lines);
                this.showErrors([{
                    type: "all",
                    text: "корзина пуста"
                }]);
                this.items.$orderLine.html("").attr("hidden", true);
                this.$order.find(`[data-em-${this.data.btnSubmit}]:first`).prop("disabled", true);
                return true;
            }
            return false;
        }

        // Проверка доставок на доступность с выбранным способом оплаты
        checkAvailableDeliveries(payment_id) {
            const deliverIds = em_geo.getDeliverAvailable(payment_id);

            if (!deliverIds) {
                this.print.printWarn("Способ оплаты не найден:", payment_id);
                this.items.$deliveryLine.attr("disabled", true);
                return;
            }
            this.items.$deliveryLine.removeAttr("disabled");

            for (const delivery of this.items.$deliveryLine.children()) {
                const input = delivery.querySelector("input");
                const uniqueId = input?.value;
                const originalId = input?.getAttribute("data-original-id");
                
                if (originalId && deliverIds[originalId]) {
                    input.removeAttribute("disabled");
                } else {
                    input.setAttribute("disabled", true);
                }
            }
            this.print.printLog("Способ оплаты успешно изменен:", payment_id);
        }

        // Проверить наличие товара в верстке
        checkAvailabilityInDOM(products) {
            let drawProduct = [];

            for (const product of products) {
                if (
                    this.items.$orderLine.find(`[data-em-cart-id="${product.variant_id}"]:first`).length == 0
                ) {
                    drawProduct.push(product);
                }
            }

            if (drawProduct.length > 0) {
                this.updateCart(drawProduct, true);
            }
        }

        // Проверка принятия систмой inSales заказа
        checkOrderSuccess() {
            // if (!em_geo.client.authorized) {
            //     this.showErrors([{
            //         type: "all",
            //         text: "Для оформления заказа войдите или зарегистрируйтесь"
            //     }]);
            //     return;
            // }
            this.showLoaders();

            const $order = this.$order;
            const
                name = $order.find(`[data-em-${this.data.name}]:first`).val(),
                surname = $order.find(`[data-em-${this.data.surname}]:first`).val(),
                phone = $order.find(`[data-em-${this.data.phone}]:first`).val(),
                email = $order.find(`[data-em-${this.data.email}]:first`).val(),
                selectChannel = $order.find(`[data-em-${this.data.channel}]:first`).val(),
                comment = $order.find(`[data-em-${this.data.comment}]:first`).val() ?? "",
                birthday = $order.find(`[data-em-${this.data.birthday}]:first`).val(),
                address = $order.find(`[data-em-${this.data.address}]:first`).val(),
                entrance = $order.find(`[data-em-${this.data.entrance}]:first`).val(),
                floor = $order.find(`[data-em-${this.data.floor}]:first`).val(),
                paymentId = $order.find(`input[name="${this.names.inputPay}"]:checked:first`).val(),
                checkedPersonalData = $order.find(`input[name="consent_to_personal_data"]:first`).prop("checked");
                
            let errors = [], selectAddress = null;

            if (!name) {
                errors.push({
                    type: "name",
                    text: "Заполните имя"
                });
            }
            if (!surname) {
                errors.push({
                    type: "surname",
                    text: "Заполните фамилию"
                });
            }
            if (!phone || !phoneMask.validatePhone(phone)) {
                errors.push({
                    type: "phone",
                    text: "Заполните телефон"
                });
            }
            if (!em_geo.client.authorized) {
                if (!email || !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
                    errors.push({
                        type: "email",
                        text: "Введите корректный email"
                    });
                }
                if (!birthday) {
                    errors.push({
                        type: "birthday",
                        text: "Заполните дату рождения"
                    });
                }
            }
            if (!checkedPersonalData) {
                errors.push({
                    type: "consent_to_personal_data",
                    text: "Необходимо подтвердить согласие"
                });
            }
            if (errors.length == 0 && !em_geo.delivery.selectedId) {
                errors.push({
                    type: "all",
                    text: "Произошла ошибка, не найдена доставка"
                });
                this.print.printError("Не найдена доставка", em_geo.delivery);
            }

            // "DeliveryVariant::PickUp"
            if (errors.length == 0) {
                const delvierySelect = em_geo.delivery.selectedId && em_geo.deliveriesExtended && em_geo.deliveriesExtended.find(
                    del => del.id == Number(em_geo.delivery.selectedId)
                );
                if (!delvierySelect) {
                    errors.push({
                        type: "em-deliveries",
                        text: "Доставка не выбрана"
                    });
                    // this.print.printError("Доставка не выбрана", em_geo.delivery.selectedId , em_geo.delivery);
                }
                else if (delvierySelect?.isError) {
                    errors.push({
                        type: "em-deliveries",
                        text: "Ошибка выбора доставки: " + (delvierySelect.message ?? "Данную доставку нельзя выбрать")
                    });
                    this.print.printError("Не найдена доставка", em_geo.delivery);
                }
                else if (
                    delvierySelect.customer_pickup && (
                        !delvierySelect.selected ||
                        !delvierySelect?.originalDelivery?.delivery_info || 
                        !delvierySelect.originalDelivery.delivery_info?.outlet?.external_id
                    )
                ) {
                    errors.push({
                        type: "em-deliveries",
                        text: "Не выбран пунтк ПВЗ"
                    });
                }
                else if (!delvierySelect.customer_pickup && !em_geo.isCustomerPickup) {
                    if (address) selectAddress = address;
                    else errors.push({
                        type: "address",
                        text: "Заполните поле адреса"
                    });
                }
                if (!paymentId) {
                    errors.push({
                        type: "em-payments",
                        text: "Вы не выбрали способ оплаты"
                    });
                }
            }
            if (errors.length > 0) {
                // Вывод ошибок
                this.print.printWarn("Ошибка отправка формы, заполните поля:", errors);

                this.showErrors(errors);
                this.hideLoaders();
            }
            else {
                const client = {
                    name: name,
                    surname: surname,
                    phone: phone,
                    consent_to_personal_data: true,
                    subscribe: $order.find(`input[name="subscribe"]:first`).prop("checked") ?? false,
                    messenger_subscription: $order.find(`input[name="messenger_subscription"]:first`).prop("checked") ?? false
                };
                if (!em_geo.client.authorized) {
                    client.email = email;
                    client.fields_values_attributes = {
                        16729835: {
                            value: birthday
                        }
                    };
                }
                const order = {
                    comment: comment,
                    delivery_variant_id: em_geo.delivery.selectedId,
                    payment_gateway_id: paymentId,
                    fields_values_attributes: []
                }

                if (selectChannel?.length) {
                    order.fields_values_attributes.push({
                        field_id: 134631377, // Выбранный канал связи
                        value: selectChannel
                    });
                }
                if (entrance) {
                    order.fields_values_attributes.push({
                        field_id: 21559013, // Подъезд
                        value: entrance
                    });
                }
                if (floor) {
                    order.fields_values_attributes.push({
                        field_id: 21558913, // Этаж
                        value: floor
                    });
                }

                // Отправка формы
                this.fetchNewOrder(client, order, selectAddress);
            }
        }

        // Создание заказа
        async fetchNewOrder(client, order, address) {
            if (!Cart.order.positions_count) {
                this.showErrors([{
                    type: "all",
                    text: "корзина пуста"
                }]);
                return;
            }

            const shipping_address = {
                kladr_json: JSON.stringify(em_geo.kladr) ?? ""
            };
            // !!! По другому получать это значение
            // Через this.delivery.data.delivery_info.outlet?.external_id
            if (em_geo.delivery.data?.delivery_info) {
                order.delivery_info_attributes = em_geo.delivery.data.delivery_info;
            }
            if (address)  {
                shipping_address.address = address;
            }

            console.log("[EM.Order] Отправка формы заказа", client, order, shipping_address);
            // alert("Отправка формы заказа...");
            // this.loaders.order.hide();
            // return;
            const response = await $.ajax({
                url: '/fast_checkout.json',
                type: 'post',
                data: {
                    client: client,
                    order: order,
                    shipping_address: shipping_address
                },
                dataType: 'json',
                cache: false
            });

            this.print.printLog("Создание заказа:", response);

            if (response?.status == "ok") {
                this.showSuccess();
                this.showLoaders();

                window.location.href = response.location;
            }
            else if (response?.errors) {
                // Список ошибок
                for (const key in response.errors) {
                    const arrErrs = response?.errors[key];
                    if (arrErrs && arrErrs.length) {
                        this.showErrors(
                            arrErrs.map((err) => {
                                return {
                                    type: "all",
                                    text: err
                                };
                            })
                        );
                    }
                }
            }
            else {
                this.showErrors([{
                    type: "all",
                    text: "Ошибка оформления заказа"
                }]);
            }
            this.hideLoaders();
        }

        showLoaders() {
            this.loaders.delivery.call();
            this.loaders.wishes.call();
            this.loaders.order.call();
            this.loaders.pay.call();
        }

        hideLoaders() {
            this.loaders.delivery.hide();
            this.loaders.wishes.hide();
            this.loaders.order.hide();
            this.loaders.pay.hide();
        }

        /* === Установка событий === */
        onClick(e) {
            // Очистка полей
            // if (e.target.classList.contains(this.classes.inputClear)) {}

            // Открытие карты ПВЗ
            // else if (e.target.classList.contains(this.classes.input)) {}

            // Открытие карты точек самовывоза
            if (e.target.getAttribute("data-popup") === "#popup-ym-pickup-map") {
                const input = e.target.closest("." + this.classes.orderItem)?.querySelector("input");
                if (input && !input.checked) {
                    input.checked = true;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    // Теперь передаем uniqueId
                    em_geo.changeActiveDelivery(input.value);
                }

                if (window.ymaps && this.myMap) {
                    this.updateMapPoints();
                } else if (window.ymaps) {
                    this.initMap();
                }
            }

            // Выбор пункта самовывоза
            else if (e.target.getAttribute("data-em-pickup-delivery-id")) {
                this.loaders.delivery.call();
                this.loaders.pay.call();

                if (this.$popupMap.hasClass("popup_show")) {
                    const btn = this.$popupMap.find("[data-close]:first").get(0);
                    if (btn) btn.dispatchEvent(new Event("click", { bubbles: true }));
                }

                em_geo.setPoint(e.target.getAttribute("data-em-pickup-delivery-id"));
                this.updateDelivery(true);
                // this.updatePayment(true, e.target.getAttribute("data-em-pickup-delivery-id"));
            }

            // Отправка формы Создания заказа
            else if (e.target.getAttribute(`data-em-${this.data.btnSubmit}`) !== null) {
                this.checkOrderSuccess();
            }

            // Выбор страны доставки
            else if (
                e.target.classList.contains("select__option") 
                && e.target.dataset.value !== undefined && e.target.dataset.selectCity === undefined
                && e.target.dataset.value.length == 2
                && e.target.dataset.value !== "RU" && e.target.dataset.value !== "BY" 
                && e.target.dataset.value !== "KZ" && e.target.dataset.value !== "KG"
            ) {
                this.showErrors([{
                    type: "em-form-city",
                    text: "Если возникнет проблема с поиском населенного пункта для выбранной страны, то попробуйте перейти в старую версию <a href='/new_order'>оформления заказа</a>"
                }]);
            }
            
            // Очистка поля ввода
            else if (e.target.getAttribute(`data-em-${this.data.btnInputClear}`) !== null) {
                this.clearInput(e.target);
            }
        }

        input(e) {
            // Заполнение полей формы
            // if (e.target.classList.contains(this.classes.input)) {
            //     // Проверка ввода
            //     // e.target.getAttribute(`data-em-${this.data.typeInput}`);
            // }
            // Чекбокс
            // else if (e.target.classList.contains(this.classes.checkbox));
        }

        change(e) {
            // Выбор доставки
            if (e.target.name == this.names.inputdelivery) {
                const uniqueId = e.target.value; // Теперь это uniqueId
                if (uniqueId) {
                    this.changeDelivery(uniqueId);
                }
            }

            // Выбор способа оплаты
            else if (e.target.name == this.names.inputPay) {
                const id = Number(e.target.value);
                if (!isNaN(id)) {
                    this.checkAvailableDeliveries(id);
                }
            }

            // Ввод промо
            /*
            else if (e.target.getAttribute(`[data-em-${this.data.btnSubmitPromo}]`)) {
                const promo = e.target.value;
                Cart.setCoupon({
                    coupon: promo ? promo : " "
                });
            }*/
        }
    }

    console.log("[EM.New Order #1] Loading...");
    
    var em_geo,
        phoneMask;

    EventBus.subscribe("eventLoader", function() {
        try {
            window.EM_Module.Geo = new EMGeo();
            em_geo = window.EM_Module.Geo;

            // Основной код
            const order = new EM_Order();

            window.em_order_instance = order; // Сохраняем экземпляр для доступа из других функций
            setTimeout(() => {
                order.init();
            }, 250);

            phoneMask = new window.EM_Module.PhoneMaskManager();
            phoneMask.initializeInputMasks("[data-input-phone]");
        } catch (error) {
            console.error("[EM.New Order] Ошибка инициализации модуля:", error);

            const $order = $("[data-em-order]:first");
            if ($order.length) {
                const $message = $order.find("[data-em-order-message]");

                if ($message.length) {
                    $message.attr("hidden", false)
                        .addClass("order-message__error")
                        .removeClass("order-message__success")
                        .find("span:first").text("Ошибка инициализации модуля. Попробуйте обновить страницу.");
                }
            }
        }
    });
});
