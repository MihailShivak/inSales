$(document).ready(() => {
  const CITY_DOMAIN_MAP = {
    новосибирск: "www.duman.store",
    "санкт-петербург": "spb.duman.store",
    "нижний новгород": "nn.duman.store",
    красноярск: "krasnoyarsk.duman.store",
    екатеринбург: "ekaterinburg.duman.store",
    казань: "kazan.duman.store",
    челябинск: "chelyabinsk.duman.store",
    самара: "samara.duman.store",
    омск: "omsk.duman.store",
    "ростов-на-дону": "rostov.duman.store",
    уфа: "ufa.duman.store",
    воронеж: "voronezh.duman.store",
    пермь: "perm.duman.store",
    кемерово: "kemerovo.duman.store",
    тольятти: "tolyatti.duman.store",
    москва: "moscow.duman.store",
  };

  function getDomainByCity(cityName) {
    if (!cityName) return "www.duman.store";
    const normalized = cityName.trim().toLowerCase();
    return CITY_DOMAIN_MAP[normalized] || "www.duman.store";
  }

  function getCityByDomain(hostname) {
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[0] !== "www") {
      const subdomain = parts[0];
      for (const [city, domain] of Object.entries(CITY_DOMAIN_MAP)) {
        if (domain === `${subdomain}.duman.store`) {
          return city;
        }
      }
    }
    return "новосибирск";
  }

  function redirectToCityDomain(cityName) {
    const targetDomain = getDomainByCity(cityName);
    const currentHostname = window.location.hostname;
    if (currentHostname !== targetDomain) {
      const protocol = window.location.protocol;
      const newUrl = `${protocol}//${targetDomain}${window.location.pathname}${window.location.search}`;
      window.location.href = newUrl;
    }
  }

  // Функция обновления города в шапке
  function updateCityInHeader(cityName) {
    if (!cityName) return;
    const displayCity = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    const $cityElement = $("[data-city-name]");
    if ($cityElement.length) {
      $cityElement.text(displayCity);
    }
  }

  const isMobile = sessionStorage.getItem("isMobile") === "true";
  const isCart = window.location.pathname.includes("/cart_items");
  const isProduct = window.location.pathname.includes("/product");

  // Получаем город из домена или cookies
  let country = Cookies.get("rev-country-location") || "Россия";
  let city =
    Cookies.get("rev-current-location") ||
    getCityByDomain(window.location.hostname) ||
    "новосибирск";

  let indexKladr;
  let nameDelivery = localStorage.getItem("nameDelivery");
  let priceFreeDelivery = Number(localStorage.getItem("priceFreeDelivery"));
  let isFreeShipping = false;

  const $popup = $("#popup-city");
  const $deliveryInfo = isCart ? $("[data-delivery-info]") : null;
  let kladr = [];
  let keyupTimer;

  // Инициализация уведомления - показываем только если cookie не установлен
  function initCityNotice() {
    const noticeShown = Cookies.get("city-notice-shown");
    if (noticeShown) {
      console.log("[City Notice] Уведомление уже было показано");
      return;
    }

    const $notice = $("#city-notice");
    const $noticeName = $("[data-city-notice-name]");

    if ($notice.length && $noticeName.length) {
      const displayCity = city
        ? city.charAt(0).toUpperCase() + city.slice(1)
        : "Новосибирск";
      $noticeName.text(displayCity);
      $notice.removeAttr("hidden");
      console.log(
        "[City Notice] Показано уведомление для города:",
        displayCity,
      );
    } else {
      console.log("[City Notice] Элементы уведомления не найдены");
    }
  }

  // Кнопка "Да" в уведомлении
  $("[data-city-confirm]").on("click", (e) => {
    e.preventDefault();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    // используем .prop() вместо .attr()
    $("#city-notice").prop("hidden", true);

    const domainCity = getCityByDomain(window.location.hostname);
    Cookies.set("rev-country-location", "Россия", { expires: 365, path: "/" });
    Cookies.set("rev-current-location", domainCity, {
      expires: 365,
      path: "/",
    });
    country = "Россия";
    city = domainCity;
    updateCityInHeader(city);
    if (isProduct || isCart) {
      inputCity(city, country, true);
    }
    console.log("[City Confirm] Город подтвержден:", domainCity);
  });

  // Кнопка "Нет" в уведомлении - открываем popup
  $("[data-city-change]").on("click", (e) => {
    e.preventDefault();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    // используем .prop() вместо .attr()
    $("#city-notice").prop("hidden", true);

    openCityPopup();
    console.log("[City Change] Открыт popup для выбора города");
  });

  // Функция открытия popup
  function openCityPopup() {
    // скрываем уведомление через .prop()
    $("#city-notice").prop("hidden", true);

    // Нативное открытие через эмуляцию клика (из предыдущего ответа)
    const $tempTrigger = $("<button>", {
      "data-popup": "#popup-city",
      style: "display: none;",
    }).appendTo("body");

    $tempTrigger.trigger("click");
    $tempTrigger.remove();

    // Заполняем форму и сбрасываем состояния
    $popup.find('[name="country"]').val(country);
    $popup.find('[name="name-city"]').val("").focus();
    $popup.find("[data-select-sity-list]").html("");
    // используем .prop() вместо .attr()
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);

    // Блокировка скролла
    $("body").addClass("popup_open");

    console.log("[City Popup] Открыт с country:", country, "city:", city);
  }

  // Открытие popup по кнопке в хедере
  $("[data-city-open]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие
    e.stopImmediatePropagation(); // Предотвращаем другие обработчики

    console.log("[Header Button] Клик по кнопке города в header");

    // ПРЯМОЕ открытие уведомления, игнорируя куку
    const $notice = $("#city-notice");
    const $noticeName = $("[data-city-notice-name]");

    if ($notice.length && $noticeName.length) {
      const displayCity = city
        ? city.charAt(0).toUpperCase() + city.slice(1)
        : "Новосибирск";
      $noticeName.text(displayCity);

      // Принудительно показываем, игнорируя куки city-notice-shown
      $notice.prop("hidden", false);

      console.log(
        "[City Notice] Принудительно открыто уведомление для города:",
        displayCity,
      );
    } else {
      console.log("[City Notice] Элементы уведомления не найдены в DOM");
    }
  });

  // Закрытие popup
  $popup.find("[data-close]").on("click", () => {
    $popup.attr("aria-hidden", "true");
    $("body").removeClass("popup_open");
    console.log("[City Popup] Закрыт");
  });

  // Закрытие по клику на оверлей
  $(document).on("click", ".popup_open .popup__wrapper", (e) => {
    if (e.target === e.currentTarget) {
      $popup.attr("aria-hidden", "true");
      $("body").removeClass("popup_open");
    }
  });

  function outputListDeliveriesProduct(deliveries) {
    let html = "";
    for (const delivery of deliveries) {
      const price = delivery.show_price
        ? (delivery.price ?? Number(delivery.price_min))
        : 0;
      html += `<div class="product-delivery__item">
            <button type="button" data-spoller class="product-delivery__item-title">${delivery.title}</button>
            <div class="product-delivery__item-body" hidden>
                ${delivery.description ? `<div class="product-delivery__item-text">${delivery.description}</div>` : ""}
                <button type="button" class="product-delivery__item-more">Подробнее об условиях акции</button>
            </div>
            <div class="product-delivery__item-price-wrapper">
                <div class="product-delivery__item-price">
                    <span>${
                      delivery.show_price &&
                      price !== undefined &&
                      !isNaN(price)
                        ? price == 0
                          ? "Бесплатно"
                          : typeof Shop !== "undefined"
                            ? Shop.money.format(price)
                            : price
                        : "Будет рассчитана далее"
                    }</span>
                    <span>${
                      delivery.delivery_interval.min_days <
                      delivery.delivery_interval.max_days
                        ? `от ${delivery.delivery_interval.min_days} до ${delivery.delivery_interval.max_days} дней`
                        : delivery.delivery_interval?.min_days
                          ? `от ${delivery.delivery_interval.min_days} дней`
                          : ""
                    }</span>
                </div>
                <div class="product-delivery__item-time"></div>
            </div>
        </div>`;
    }
    $(".product-card [data-delivery-options]").html(html);
  }

  function changeCountryInForm(value) {
    if (!value) return;
    const $countrySelect = $popup.find('[name="country"]');
    if ($countrySelect.val() === value) return;

    $countrySelect.val(value);
    $popup.find("[data-select-sity-list]").html("");
    // используем .prop()
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find('[name="name-city"]').val("");
    $popup.find("[data-city-save]").prop("disabled", true);
  }

  async function inputCity(elVal, countryVal, change = false) {
    const $container = $popup.find("[data-select-container-sity]");
    const $list = $popup.find("[data-select-sity-list]");
    const $saveBtn = $popup.find("[data-city-save]");

    if (!elVal || elVal.length < 2) {
      // используем .prop()
      $container.prop("hidden", true);
      $saveBtn.prop("disabled", true);
      return;
    }

    try {
      const cities = await $.ajax({
        type: "post",
        url: `//kladr.insales.ru/fulltext_search.json?country=${countryVal}&state=`,
        data: { q: elVal, search: "1" },
        dataType: "jsonp",
        cache: false,
      });

      let html = "";
      if (
        !cities ||
        cities.error ||
        !Array.isArray(cities) ||
        cities.length === 0
      ) {
        html =
          '<button class="select__option" type="button" disabled>Город не найден</button>';
        $list.html(html);
        // используем .prop()
        $container.prop("hidden", false);
        $saveBtn.prop("disabled", true);
        return;
      }

      kladr = cities;
      if (change && cities.length > 0) {
        indexKladr = 0;
        fetchDeliveryCalculate(kladr[0]);
      }

      if (!change) {
        for (const index in cities) {
          const cityName = cities[index].city ?? cities[index].last_level;
          html += `<button class="select__option" data-value="${index}" type="button" data-select-city="${cityName}">${cities[index].result}</button>`;
        }
        $list.html(html);
        // используем .prop()
        $container.prop("hidden", false);
        $saveBtn.prop("disabled", false);
      }
    } catch (err) {
      console.error("Ошибка поиска города:", err);
      // используем .prop()
      $container.prop("hidden", true);
      $saveBtn.prop("disabled", true);
    }
  }

  function setCookies(newCountry, newCity) {
    if (newCountry === country && newCity === city) return;

    Cookies.set("rev-country-location", newCountry, {
      expires: 365,
      path: "/",
    });
    Cookies.set("rev-current-location", newCity, { expires: 365, path: "/" });

    country = newCountry;
    city = newCity;
    updateCityInHeader(city);

    if (indexKladr !== undefined && kladr[indexKladr]) {
      fetchDeliveryCalculate(kladr[indexKladr]);
    }

    if (location.pathname === "/new_order") {
      setTimeout(() => {
        window.location.reload();
      }, 350);
    }
  }

  function getProductIdInCart() {
    let id = [];
    if (
      typeof Cart !== "undefined" &&
      Cart.order &&
      Cart.order.order_line_comments
    ) {
      for (const key in Cart.order.order_line_comments) {
        id.push(key);
      }
    }
    return id;
  }

  function getDeliveryFree(deliveries) {
    let selectDelivery;
    let priceFree = 0;

    for (const delivery of deliveries) {
      if (!delivery.charge_up_to) continue;
      const charge_up_to = Number(delivery.charge_up_to);
      if (
        !isNaN(charge_up_to) &&
        charge_up_to > 0 &&
        (charge_up_to < priceFree || priceFree == 0)
      ) {
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
      id: selectDelivery.id,
      priceFree: priceFree,
      title: selectDelivery.title,
    };
  }

  function setFreeDeliveryTitle(priceFree) {
    if (
      !isFreeShipping ||
      (typeof Cart !== "undefined" && Cart.order && Cart.order.items_count == 0)
    )
      return;

    if (priceFree > 0) {
      $("[data-delivery-to-free]")
        .attr("hidden", false)
        .find("span")
        .text(
          typeof Shop !== "undefined"
            ? Shop.money.format(priceFree)
            : priceFree,
        );
      $("[data-delivery-free]").attr("hidden", true);
      if ($deliveryInfo) $deliveryInfo.text("Будет рассчитана далее");
    } else {
      $("[data-delivery-to-free]").attr("hidden", true);
      $("[data-delivery-free]").attr("hidden", false);
      if ($deliveryInfo) $deliveryInfo.text("Бесплатно по России");
    }
  }

  function setDeliveryCart(deliveries) {
    const selectDelivery = getDeliveryFree(deliveries);
    if (selectDelivery) {
      isFreeShipping = true;
      $(".basket__info-total-item_dilivery:first").removeAttr("hidden");
      if (typeof Cart !== "undefined" && Cart.order) {
        setFreeDeliveryTitle(selectDelivery.priceFree - Cart.order.total_price);
      }
    }
  }

  function setDeliveryProduct(deliveries, typeDelivery) {
    outputListDeliveriesProduct(deliveries);
    $(".product-card .product-card-descr__title span:last").text(
      `Доставка в ${typeDelivery}`,
    );
  }

  async function fetchDeliveryCalculate(kladrData) {
    const variants = isProduct
      ? {
          [$(`.product-card:first input[name="variant_id"]:first`).val()]: 1,
        }
      : {};

    try {
      const deliveries = await $.ajax({
        url: "/front_api/deliveries/calculate.json",
        method: "POST",
        dataType: "json",
        data: {
          address_data: kladrData,
          variants: variants,
        },
        timeout: 10000,
      });

      if (!deliveries?.deliveries || !deliveries.deliveries.length) {
        console.log(
          "[ProductCard.Delivery] Ошибка получения доставки",
          deliveries,
        );
      } else if (isProduct) {
        setDeliveryProduct(
          deliveries.deliveries,
          `${kladrData.last_level_type} ${kladrData.last_level}`,
        );
      } else if (isCart) {
        setDeliveryCart(deliveries.deliveries);
      }
    } catch (err) {
      console.error("Ошибка расчета доставки:", err);
    }
  }

  // Ввод города с debounce
  $popup.find('[name="name-city"]').on("input", function () {
    const _this = $(this);
    const val = _this.val().trim();
    clearTimeout(keyupTimer);
    keyupTimer = setTimeout(() => {
      if (val.length >= 2) {
        inputCity(val, $popup.find('[name="country"]').val());
      } else {
        // используем .prop()
        $popup.find("[data-select-container-sity]").prop("hidden", true);
        $popup.find("[data-city-save]").prop("disabled", true);
      }
    }, 300);
  });

  // Очистка поля города
  $popup.find('[data-js="input-clear"]').on("click", () => {
    $popup.find('[name="name-city"]').val("").focus();
    // используем .prop()
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);
  });

  // Выбор города из списка
  $popup
    .find("[data-select-sity-list]")
    .on("click", "[data-select-city]", function (event) {
      event.preventDefault();
      const $btn = $(this);
      const newCity = $btn.data("select-city");
      const index = $btn.data("value");

      if (!newCity) return;
      indexKladr = index;
      $popup.find('[name="name-city"]').val(newCity);
      $popup.find("[data-city-save]").prop("disabled", false);
      // используем .prop()
      $popup.find("[data-select-container-sity]").prop("hidden", true);
      $popup.find("[data-city-save]").focus();
    });

  // Сохранение города и редирект
  $popup.find("[data-city-save]").on("click", () => {
    const newCountry = $popup.find('[name="country"]').val();
    const newCity = $popup.find('[name="name-city"]').val();

    if (!newCity) return;

    setCookies(newCountry, newCity);
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $("body").removeClass("popup_open");
    $popup.attr("aria-hidden", "true");
    redirectToCityDomain(newCity);
  });

  // Смена страны
  $popup.find('[name="country"]').on("change", function () {
    changeCountryInForm($(this).val());
  });

  if (typeof EventBus !== "undefined") {
    EventBus.subscribe("eventLoader", function () {
      // loader = new EM_Module.Loader($popup.find(".popup-right__body"));
    });

    EventBus.subscribe("update_items:insales:cart", (cart) => {
      if (isCart && !isNaN(priceFreeDelivery)) {
        setFreeDeliveryTitle(priceFreeDelivery - cart.total_price);
      }
    });
  }

  // Инициализация при загрузке
  // Обновляем город в шапке только если элемент существует
  updateCityInHeader(city);

  // Показываем уведомление только если cookie не установлен
  initCityNotice();

  // Инициализируем доставку для продукта/корзины
  if ((isProduct || isCart) && city && country) {
    inputCity(city, country, true);
  }

  // --- Обработчики для popup-delivery-change ---
  $("#popup-delivery-change .form-popup__input-wrapper").on(
    "click",
    "button",
    (event) => {
      const value = event.currentTarget.dataset.value;
      if (!value || value === "0") return;
      $("#popup-delivery-change .popup__button").attr("disabled", false);
    },
  );

  $("#popup-delivery-change .popup__button").on("click", () => {
    const $popup_delivery = $("#popup-delivery-change");
    const value = $popup_delivery.find('[name="delivers"]').val();

    if (!value || value === "0") return;

    if (typeof Preloader !== "undefined") {
      const preload = new Preloader(
        $("#popup-delivery-change .popup__body-delivery"),
      );
      preload.call();
    }

    if (typeof ajaxAPI !== "undefined" && ajaxAPI.checkout) {
      ajaxAPI.checkout
        .order({}, { delivery: value })
        .done(() => {
          if (typeof Preloader !== "undefined") {
            // preload.hide();
          }
        })
        .fail(function (onFail) {
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
            console.log("Ошибка изменения доставки", onFail);
          } else {
            inputCity(city, country, true);
            console.log("Доставка изменена: ", onFail);
            setTimeout(() => {
              $popup_delivery.find(".popup__close").trigger("click");
            }, 850);
          }
        });
    }
  });
});
