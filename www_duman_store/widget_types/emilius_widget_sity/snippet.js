$(document).ready(() => {
  const COOKIES_PARAMS = {
    expires: 7,
    path: "/",
    domain: ".duman.store",
  };

  const CITY_DEFAULT = "новосибирск"; // Город по умолчанию
  const DOMAIN_DEFAULT = "www.duman.store"; // Домен по умолчанию
  const CITY_DOMAIN_MAP = {
    [CITY_DEFAULT]: DOMAIN_DEFAULT,
    "санкт-петербург": "spb.duman.store",
    "нижний новгород": "nn.duman.store",
    красноярск: "krasnoyarsk.duman.store",
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

  const CITY_LABEL_MAP = {
    [CITY_DEFAULT]: "Новосибирск",
    "санкт-петербург": "Санкт-Петербург",
    "нижний новгород": "Нижний Новгород",
    красноярск: "Красноярск",
    казань: "Казань",
    челябинск: "Челябинск",
    самара: "Самара",
    омск: "Омск",
    "ростов-на-дону": "Ростов-на-Дону",
    уфа: "Уфа",
    воронеж: "Воронеж",
    пермь: "Пермь",
    кемерово: "Кемерово",
    тольятти: "Тольятти",
    москва: "Москва",
  };

  const CityDomain = getCityByDomain(window.location.hostname);

  function setCookies(newCountry, newCity) {
    if (newCountry === country && newCity === city) return;

    Cookies.set("rev-country-location", newCountry, COOKIES_PARAMS);
    Cookies.set("rev-current-location", newCity, COOKIES_PARAMS);

    country = newCountry;
    city = newCity;

    if (indexKladr) setDeliveryInfo(kladr[indexKladr]);
    if (location.pathname === "/new_order") {
      setTimeout(() => {
        window.location.reload();
      }, 350);
    }
  }

  function getDomainByCity(cityName) {
    const key = String(cityName || "")
      .trim()
      .toLowerCase();

    if (!key) return DOMAIN_DEFAULT;

    return CITY_DOMAIN_MAP[key] ?? DOMAIN_DEFAULT;
  }

  function getCityByDomain(hostname) {
    const host = String(hostname || window.location.hostname || "")
      .split(":")[0]
      .toLowerCase();

    if (!host) return CITY_DEFAULT;

    if (
      host === DOMAIN_DEFAULT ||
      host === "duman.store" ||
      host === "www.duman.store"
    ) {
      return CITY_DEFAULT;
    }

    for (const keyCityDomain in CITY_DOMAIN_MAP) {
      const domain = CITY_DOMAIN_MAP[keyCityDomain];

      if (domain === host) {
        return keyCityDomain;
      }
    }

    return CITY_DEFAULT;
  }

  function redirectToCityDomain(cityName) {
    const targetDomain = getDomainByCity(cityName);
    // const currentLocation = Cookies.get("first_current_location") ?? window.location.hostname;

    if (window.location.hostname !== targetDomain) {
      Cookies.remove("rev-country-location");
      Cookies.remove("rev-current-location");
      window.location.href = `${window.location.protocol}//${targetDomain}${window.location.pathname}`;
    }
    // else {
    // 	window.location.reload();
    // }
  }

  const isMobile = sessionStorage.getItem("isMobile") === "true";
  const isCart = window.location.pathname.includes("/cart_items");
  const isProduct = window.location.pathname.includes("/product");

  var country = Cookies.get("rev-country-location"),
    city = Cookies.get("rev-current-location");

  var indexKladr,
    nameDelivery = localStorage.getItem("nameDelivery"),
    priceFreeDelivery = Number(localStorage.getItem("priceFreeDelivery"));

  var isFreeShipping = false;

  const $popup = $("#popup-city");
  const $cityNotice = $("#city-notice");
  const $cityName = $("[data-city-name]");
  const $deliveryInfo = isCart ? $("[data-delivery-info]:first") : null;

  var kladr = [],
    keyupTimer;

  function getDomainCityLabel(cityKey) {
    if (!cityKey) return "";

    return (
      CITY_LABEL_MAP[cityKey] ||
      cityKey.charAt(0).toUpperCase() + cityKey.slice(1)
    );
  }

  function isDomainCity(cityName) {
    const key = String(cityName || "")
      .trim()
      .toLowerCase();

    if (!key) return false;

    return Object.prototype.hasOwnProperty.call(CITY_DOMAIN_MAP, key);
  }

  function fillDomainCitySelect($select) {
    if (!$select.length) return;

    // Если options уже выведены в Liquid, не дублируем.
    if ($select.find("option").length > 1) return;

    let html = `<option value="" selected>Выберите город из списка</option>`;

    Object.keys(CITY_DOMAIN_MAP)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .forEach((cityKey) => {
        html += `<option value="${cityKey}">${getDomainCityLabel(cityKey)}</option>`;
      });

    $select.html(html);
  }

  function setDomainCitySelectValue(cityName) {
    const $select = $popup.find("[data-city-domain-select]");

    if (!$select.length) return;

    const cityKey = String(cityName || "")
      .trim()
      .toLowerCase();

    if (cityKey && isDomainCity(cityKey)) {
      $select.val(cityKey);
    } else {
      $select.val("");
    }

    $select.data("silentValue", $select.val());
  }

  async function loadKladrByCity(cityName, countryVal = "RU") {
    const query = String(cityName || "").trim();

    if (query.length < 2) return false;

    try {
      const cities = await $.ajax({
        type: "post",
        url: `//kladr.insales.ru/fulltext_search.json?country=${countryVal}&state=`,
        data: {
          q: query,
          search: "1",
        },
        dataType: "jsonp",
        cache: false,
      });

      if (
        !cities ||
        cities.error ||
        !Array.isArray(cities) ||
        cities.length === 0
      ) {
        console.warn("[City Selector] Kladr не вернул города для:", query);
        return false;
      }

      kladr = cities;

      const need = query.toLowerCase().replace(/ё/g, "е");

      let index = cities.findIndex((item) => {
        const name = String(item.city ?? item.last_level ?? "")
          .toLowerCase()
          .replace(/ё/g, "е");

        return name === need;
      });

      // Если точное совпадение не найдено — берём первый результат,
      // как это сделано в текущей логике inputCity(..., true).
      if (index === -1) {
        index = 0;
      }

      indexKladr = index;

      // Сразу считаем доставку для выбранного города.
      fetchDeliveryCalculate(kladr[indexKladr]);

      return true;
    } catch (err) {
      console.error("[City Selector] Ошибка запроса к Kladr:", err);
      return false;
    }
  }

  function initDomainCitySelect() {
    const $select = $popup.find("[data-city-domain-select]");
    if (!$select.length) return;

    fillDomainCitySelect($select);

    async function handleDomainCityChange(cityKey) {
      const $input = $popup.find('[name="name-city"]');
      const $saveBtn = $popup.find("[data-city-save]");

      $popup.find("[data-select-container-sity]").prop("hidden", true);

      if (!cityKey) {
        $input.val("");
        $saveBtn.prop("disabled", true);
        indexKladr = undefined;
        return;
      }

      const cityLabel = getDomainCityLabel(cityKey);

      // Города из CITY_DOMAIN_MAP относятся к России.
      $popup.find('[name="country"]').val("RU");
      $input.val(cityLabel);
      $saveBtn.prop("disabled", true);

      const isSuccess = await loadKladrByCity(cityLabel, "RU");

      if (isSuccess && indexKladr !== undefined && kladr[indexKladr]) {
        $saveBtn.prop("disabled", false);
      } else {
        $saveBtn.prop("disabled", true);
      }
    }

    function remember(value) {
      $select.data("silentValue", value);
    }

    // Штатное событие — сработает, если тема всё же триггерит change
    $select.off("change.domainCity").on("change.domainCity", function () {
      remember($select.val());
      handleDomainCityChange($select.val());
    });

    // Страховка: кастомный селект темы может не триггерить change
    // на нативном select. Тихо отслеживаем смену значения.
    remember($select.val());
    setInterval(() => {
      const current = $select.val();
      if (current === $select.data("silentValue")) return;
      remember(current);
      if (current) handleDomainCityChange(current);
    }, 300);

    setDomainCitySelectValue(city);
    remember($select.val());
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

  function outputListDeliveriesProduct(deliveries) {
    let html = "";

    for (const key in deliveries) {
      const delivery = deliveries[key];
      const price = delivery.show_price
        ? (delivery.price ?? Number(delivery.price_min))
        : 0;

      html += `<div class="product-delivery__item">
                <button type="button" data-spoller class="product-delivery__item-title">${delivery.title}</button>
                <div class="product-delivery__item-body" hidden>
                    ${delivery.description ? `<div class="product-delivery__item-text"> ${delivery.description}</div>` : ""}
                    <button type="button" class="product-delivery__item-more">Подробнее об условиях акции</button>
                </div>
                <div class="product-delivery__item-price-wrapper">
                    <div class="product-delivery__item-price">
                        <span>
                        ${
                          delivery.show_price &&
                          price !== undefined &&
                          !isNaN(price)
                            ? price == 0
                              ? "Бесплатно"
                              : Shop.money.format(price)
                            : "Будет рассчитана далее"
                        }
                        </span>
                        <span>
                            ${
                              delivery.delivery_interval.min_days <
                              delivery.delivery_interval.max_days
                                ? `от ${delivery.delivery_interval.min_days} до ${delivery.delivery_interval.max_days} дней`
                                : delivery.delivery_interval?.min_days
                                  ? `от ${delivery.delivery_interval.min_days} дней`
                                  : ""
                            }
                        </span>
                        </div>
                    <div class="product-delivery__item-time"></div>
                </div>
            </div>`;
    }
    $(".product-card [data-delivery-options]").html(html);
  }

  function setDeliveryInCart(deliveries, free, priceFree, data) {
    let html = "";
    for (const key in deliveries) {
      const delivery = deliveries[key];
      if (delivery.selected) free = Number(delivery.charge_up_to);
      html += `<li>- ${delivery.title}</li>`;
    }
    $(".delivery-info__list").html(html);
    if (typeof Shop !== "undefined") {
      $(".delivery-info__subtitle span").text(Shop.money.format(free));
    }
    if (priceFree >= 0) {
      $(".cart__grid-items-delivery").attr("hidden", false);
      $("[data-delivery-text] span").text(
        typeof Shop !== "undefined" ? Shop.money.format(priceFree) : priceFree,
      );
    } else {
      $(".cart__grid-items-delivery").attr("hidden", true);
    }
    $(".delivery-info__title span").text(
      (data.last_level_type ? data.last_level_type + " " : "") +
        data.last_level,
    );
  }

  function setListDeliveris(deliveryLine, deliveryLineSelect) {
    const $popup_delivery = $("#popup-delivery-change");
    if (!$popup_delivery.length) return;
    $popup_delivery.find(".popup__button").attr("disabled", true);
    $popup_delivery.find(".select__options").attr("data-new-animate", true);

    if (!deliveryLine || !deliveryLineSelect) {
      deliveryLine =
        '<button hidden="" class="select__option" data-value="0" type="button">- доставка -</button>';
      deliveryLineSelect = '<option value="0">- доставка -</option>';
      $popup_delivery.find(".select__content").text("- доставка -");
    }

    let iteration = 0,
      timerId = setInterval(() => {
        if ($popup_delivery.find(".select__options").length || iteration > 8) {
          clearInterval(timerId);
          $popup_delivery.find(".select__options").html(deliveryLine);
          $popup_delivery.find("select").html(deliveryLineSelect);
          $popup_delivery
            .find(".select__content")
            .text(nameDelivery || "Доставка");
        } else {
          iteration++;
        }
      }, 350);
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
      $("[data-delivery-to-free]")
        .attr("hidden", false)
        .find("span")
        .text(Shop.money.format(priceFree));
      $("[data-delivery-free]").attr("hidden", true);
      $deliveryInfo.text("Будет рассчитана далее");
    } else {
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

  async function setDeliveryInfo(data) {
    const default_locale = $("meta[name=default-locale]")
      .attr("content")
      .toUpperCase();
    const deliveries = await $.ajax({
      url: `/delivery/for_order.json?lang=${default_locale ? default_locale : "RU"}&v2=${$("[data-checkout2]").length > 0}`,
      method: "PUT",
      dataType: "json",
      data: {
        "shipping_address[country]": data.country,
        "shipping_address[full_locality_name]": data.result,
        "shipping_address[kladr_json]": data,
        "shipping_address[no_delivery]": 0,
        "order[viewed_product_ids]": getProductIdInCart(),
      },
      timeout: 10000,
    });
    console.log("Доставка:", deliveries);
    if (!deliveries || $.isEmptyObject(deliveries?.deliveries)) {
      console.log("Ошибка сохранения доставки");
      return;
    }
    // if (isProduct) setDeliveryProduct(deliveries.deliveries, `${data.last_level_type} ${data.last_level}`);
    // else if (isCart) setDeliveryCart(deliveries.deliveries);
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

      console.log("[City] Доставка рассчитана:", deliveries);

      if (!deliveries?.deliveries || !deliveries.deliveries.length) {
        console.log("[City] Ошибка получения списка доставок");
      } else if (isProduct) {
        setDeliveryProduct(
          deliveries.deliveries,
          `${kladrData.last_level_type} ${kladrData.last_level}`,
        );
      } else if (isCart) {
        setDeliveryCart(deliveries.deliveries);
      }
    } catch (err) {
      console.error("[City] Ошибка расчета доставки:", err);
    }
  }

  function updateCityInHeader(newCityName) {
    if (!newCityName) return;

    $cityName.text(newCityName);
    $cityNotice.find("[data-city-notice-name]:first").text(newCityName);
    console.log("[City] Header обновлен на:", newCityName);
  }

  function initCityNotice() {
    const noticeShown = Cookies.get("city-notice-shown");
    if (noticeShown !== "1" && city) {
      $cityNotice.removeAttr("hidden");
    }
  }

  $("[data-city-confirm]").on("click", (e) => {
    e.preventDefault();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $cityNotice.prop("hidden", true);

    // updateCityInHeader(city);

    // if (isProduct || isCart) {
    // 	inputCity(city, country, true);
    // }

    console.log("[City Confirm] Город подтверждён:", city);
  });

  $("[data-city-change]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие события
    e.stopImmediatePropagation();

    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $cityNotice.prop("hidden", true);

    console.log(
      "[City Change] Клик по кнопке 'Нет, другой'. Ждем завершения анимации меню...",
    );

    setTimeout(() => {
      openCityPopup();
      console.log("[City Change] Popup успешно открыт");
    }, 200);
  });

  function openCityPopup() {
    const btnOpenPopup = document.getElementById("btn-popup-city");

    if (btnOpenPopup) {
      btnOpenPopup.dispatchEvent(
        new Event("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
    } else {
      const $tempTrigger = $("<button>", {
        "data-popup": "#popup-city",
        style: "display: none;",
      }).appendTo("body");

      $tempTrigger.trigger("click");
      $tempTrigger.remove();
    }

    const currentCountry = String(country || "RU").trim();

    $popup.find('[name="country"]').val(currentCountry);
    $popup.find('[name="name-city"]').val("").focus();
    $popup.find("[data-select-sity-list]").html("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);

    const $domainSelect = $popup.find("[data-city-domain-select]");

    if ($domainSelect.length) {
      $domainSelect.prop("disabled", currentCountry !== "RU");

      if (currentCountry === "RU") {
        setDomainCitySelectValue(city);
      } else {
        $domainSelect.val("");
      }
    }

    $("body").addClass("popup_open");

    console.log(
      "[City Popup] Открыт с country:",
      currentCountry,
      "city:",
      city,
    );
  }

  $("[data-city-open]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    console.log("[City Open] Клик по кнопке выбора города");

    // Проверяем, находится ли нажатая кнопка внутри мобильного меню
    const $mobPopup = $(e.currentTarget).closest("[data-mob-popup='main']");
    if ($mobPopup.length) {
      console.log(
        "[City Mob Menu] Кнопка внутри мобильного меню. Закрываем меню.",
      );
      $mobPopup.removeClass("_active").css("transform", "translateX(-100%)");
    }

    $cityNotice.prop("hidden", false);

    // Открываем уведомление
    // ! На удаление
    // const $notice = $("#city-notice");
    // const $noticeName = $("[data-city-notice-name]");
    // if ($notice.length && $noticeName.length) {
    // 	const displayCity = city
    // 		? city.charAt(0).toUpperCase() + city.slice(1)
    // 		: "Новосибирск";
    // 	$noticeName.text(displayCity);
    // 	$notice.prop("hidden", false);
    // 	console.log("[City Notice] Открыто уведомление для города:", displayCity);
    // } else {
    // 	console.warn("[City Notice] Элементы уведомления не найдены");
    // }
  });

  // Обработчик для кнопки в мобильном меню
  //   $("[data-mob-popup='main'] [data-city-open]").on("click", (e) => {
  //     e.preventDefault();
  //     e.stopPropagation();
  //     e.stopImmediatePropagation();

  //     console.log("[City Mob Menu] Клик по кнопке города в мобильном меню");

  //     // Закрываем мобильное меню через нативную кнопку темы
  //     const $closeBtn = $("[data-mob-popup='main']").find(
  //       "[data-mob-popup-close]",
  //     );
  //     if ($closeBtn.length) {
  //       $closeBtn.trigger("click");
  //       console.log("[City Mob Menu] Клик по нативной кнопке закрытия меню");
  //     }

  //     // Ждем завершения анимации закрытия меню (500мс), потом открываем уведомление
  //     setTimeout(() => {
  //       const $notice = $("#city-notice");
  //       const $noticeName = $("[data-city-notice-name]");
  //       if ($notice.length && $noticeName.length) {
  //         const displayCity = city
  //           ? city.charAt(0).toUpperCase() + city.slice(1)
  //           : "Новосибирск";
  //         $noticeName.text(displayCity);
  //         $notice.prop("hidden", false);
  //         console.log(
  //           "[City Mob Menu] Открыто уведомление для города:",
  //           displayCity,
  //         );
  //       }
  //     }, 550);
  //   });

  $popup.find("[data-close]").on("click", () => {
    $popup.attr("aria-hidden", "true");
    $("body").removeClass("popup_open");
  });

  $(document).on("click", ".popup_open .popup__wrapper", (e) => {
    if (e.target === e.currentTarget) {
      $popup.attr("aria-hidden", "true");
      $("body").removeClass("popup_open");
    }
  });

  function changeCountryInForm(value) {
    if (!value) return;

    const $countrySelect = $popup.find('[name="country"]');
    const $domainSelect = $popup.find("[data-city-domain-select]");

    if ($countrySelect.val() !== value) {
      $countrySelect.val(value);
    }

    $popup.find("[data-select-sity-list]").html("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find('[name="name-city"]').val("");
    $popup.find("[data-city-save]").prop("disabled", true);

    if ($domainSelect.length) {
      $domainSelect.val("");
      $domainSelect.prop("disabled", value !== "RU");
    }
  }

  async function inputCity(elVal, countryVal, change = false) {
    const $container = $popup.find("[data-select-container-sity]");
    const $list = $popup.find("[data-select-sity-list]");
    const $saveBtn = $popup.find("[data-city-save]");

    if (!elVal || elVal.length < 2) {
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
        $container.prop("hidden", false);
        $saveBtn.prop("disabled", true);
        return;
      }

      kladr = cities;
      if (change && cities.length > 0) {
        indexKladr = 0;
        fetchDeliveryCalculate(kladr[0]); // Сразу считаем доставку при инициализации
      }

      if (!change) {
        for (const index in cities) {
          const cityName = cities[index].city ?? cities[index].last_level;
          html += `<button class="select__option" data-value="${index}" type="button" data-select-city="${cityName}">${cities[index].result}</button>`;
        }
        $list.html(html);
        $container.prop("hidden", false);
        $saveBtn.prop("disabled", false);
      }
    } catch (err) {
      console.error("Ошибка поиска города:", err);
      $container.prop("hidden", true);
      $saveBtn.prop("disabled", true);
    }
  }

  $popup.find('[name="name-city"]').on("input", function () {
    const _this = $(this);
    const val = _this.val().trim();

    const $domainSelect = $popup.find("[data-city-domain-select]");

    if ($domainSelect.length && $domainSelect.val()) {
      const selectedLabel = getDomainCityLabel(
        $domainSelect.val(),
      ).toLowerCase();

      if (!val || selectedLabel !== val.toLowerCase()) {
        $domainSelect.val("");
      }
    }

    clearTimeout(keyupTimer);

    keyupTimer = setTimeout(() => {
      if (val.length >= 2) {
        inputCity(val, $popup.find('[name="country"]').val());
      } else {
        $popup.find("[data-select-container-sity]").prop("hidden", true);
        $popup.find("[data-city-save]").prop("disabled", true);
      }
    }, 300);
  });

  $popup.find('[data-js="input-clear"]').on("click", () => {
    $popup.find('[name="name-city"]').val("").focus();
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);
    $popup.find("[data-city-domain-select]").val("");
  });

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
      $popup.find("[data-select-container-sity]").prop("hidden", true);
      $popup.find("[data-city-save]").focus();

      // Город выбран вручную из подсказок, а не из быстрого доменного списка.
      $popup.find("[data-city-domain-select]").val("");
    });

  // Сохранение города и редирект
  $popup.find("[data-city-save]").on("click", async function () {
    const newCountry = $popup.find('[name="country"]:first').val();
    const newCity = $popup.find('[name="name-city"]:first').val().trim();
    const selectedDomainCity = $popup
      .find("[data-city-domain-select]:first")
      .val();

    if (
      !newCountry ||
      !newCity ||
      indexKladr === undefined ||
      indexKladr === null
    ) {
      return;
    }

    const selectKladr = kladr[indexKladr];

    if (!selectKladr) return;

    setCookies(newCountry, newCity);
    updateCityInHeader(newCity);
    fetchDeliveryCalculate(selectKladr);

    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });

    $popup.find("[data-close]:first").trigger("click");

    const targetDomain = getDomainByCity(newCity);

    const isCityFromDomainList = Boolean(
      selectedDomainCity || isDomainCity(newCity),
    );

    // Для городов из списка доменов редирект обязателен,
    // если целевой домен отличается от текущего.
    if (isCityFromDomainList) {
      if (window.location.hostname !== targetDomain) {
        redirectToCityDomain(newCity);
        return;
      }

      // Если уже находимся на нужном домене, но страница оформления,
      // можно перезагрузить страницу для применения доставки.
      if (location.pathname === "/new_order") {
        setTimeout(() => {
          window.location.reload();
        }, 350);
      }

      return;
    }

    // Для городов не из доменного списка сохраняем прежнее поведение.
    if (location.pathname === "/new_order") {
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } else {
      redirectToCityDomain(newCity);
    }
  });

  $popup.find('[name="country"]').on("change", function () {
    changeCountryInForm($(this).val());
  });

  // EventBus.subscribe('eventLoader', function () {
  //     loader = new EM_Module.Loader($popup.find(".popup__body"));
  // });

  EventBus.subscribe("update_items:insales:cart", (cart) => {
    if (isCart && !isNaN(priceFreeDelivery))
      setFreeDeliveryTitle(priceFreeDelivery - cart.total_price);
  });

  /** 
   * Пустая конструкция 
  if (typeof EventBus !== "undefined") {
    EventBus.subscribe("update_items:insales:cart", (cart) => {
    if (window.__bocOrderInProgress) return;
    if (isCart && !isNaN(priceFreeDelivery)) {
      // Логика обновления корзины при изменении
    }
    });
  }
  */

  initDomainCitySelect();

  if (!country || !city) {
    console.log(
      "[City] Город не найден в куки, запрашиваем через Kladr API...",
    );
    $.ajax({
      url: "https://kladr.insales.ru/current_location.json",
      type: "get",
      dataType: "jsonp",
      success: function (data) {
        if (data.country && data.city) {
          setCookies(data.country, data.city);
          if (
            !window.location.pathname.includes("/new_order") &&
            !window.location.pathname.includes("/page/new-order")
          )
            updateCityInHeader(city);
          console.log("[City] Автоопределен и сохранен город:", city);
        } else {
          // Fallback на домен
          setCookies("RU", CityDomain);
          updateCityInHeader(city);
        }
        initCityNotice();
      },
      error: function (err) {
        console.log("Ошибка автоопределения города, используем домен", err);

        setCookies("RU", CityDomain);
        updateCityInHeader(city);
      },
    });
  } else if (getDomainByCity(city) !== window.location.hostname) {
    redirectToCityDomain(city);
  } else {
    // МЯГКАЯ ЛОГИКА
    console.log("[City] Город успешно прочитан из cookie:", city);
    updateCityInHeader(city);
    initCityNotice();

    if (isProduct || isCart) inputCity(city, country, true);
  }
});
