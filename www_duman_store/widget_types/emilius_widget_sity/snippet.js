$(document).ready(() => {
  const COOKIES_PARAMS = {
    expires: 7,
    path: "/",
    domain: ".duman.store",
  };
  const CITY_DEFAULT = "новосибирск";
  const DOMAIN_DEFAULT = "www.duman.store";
  const CITY_DOMAIN_MAP = {
    [DOMAIN_DEFAULT]: DOMAIN_DEFAULT,
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

  const KLADR_STORAGE_KEY = "kladr_current";

  const $popup = $("#popup-city");
  const $cityNotice = $("#city-notice");
  const $cityName = $("[data-city-name]");
  const $kladrHiddenInput = $popup.find("#kladr-data-hidden");
  const isMobile = sessionStorage.getItem("isMobile") === "true";
  const isCart = window.location.pathname.includes("/cart_items");
  const isProduct = window.location.pathname.includes("/product");
  const $deliveryInfo = isCart ? $("[data-delivery-info]:first") : null;
  var country = Cookies.get("rev-country-location");
  var city = Cookies.get("rev-current-location");
  var indexKladr;
  var nameDelivery = localStorage.getItem("nameDelivery");
  var priceFreeDelivery = Number(localStorage.getItem("priceFreeDelivery"));
  var isFreeShipping = false;
  var kladr = [];
  var keyupTimer;

  async function fetchKladrForCity(cityName, countryVal = "RU") {
    if (!cityName) return null;

    const cityLower = cityName.toLowerCase().trim();

    // Читаем кэш только если там лежит тот же город и страна
    try {
      const cached = localStorage.getItem(KLADR_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedCity = (parsed.city || parsed.last_level || "")
          .toLowerCase()
          .trim();
        const isSameCity = cachedCity === cityLower;
        const isSameCountry = !parsed.country || parsed.country === countryVal;

        if (parsed.code && isSameCity && isSameCountry) {
          console.log("[City] KLADR из localStorage:", cityName);
          return parsed;
        }
      }
    } catch (e) {}

    try {
      const cities = await $.ajax({
        type: "post",
        url: `//kladr.insales.ru/fulltext_search.json?country=${countryVal}&state=`,
        data: { q: cityName, search: "1" },
        dataType: "jsonp",
        cache: false,
      });

      if (
        !cities ||
        cities.error ||
        !Array.isArray(cities) ||
        cities.length === 0
      ) {
        console.warn("[City] KLADR API вернул пустой результат для:", cityName);
        return null;
      }

      let found = cities.find(
        (c) => (c.city || "").toLowerCase().trim() === cityLower,
      );
      if (!found) {
        found = cities.find(
          (c) => (c.last_level || "").toLowerCase().trim() === cityLower,
        );
      }
      if (!found) {
        found = cities[0];
        console.log(
          "[City] Точное совпадение не найдено, берём первый элемент:",
          found.city || found.last_level,
        );
      }

      // Один статичный ключ — просто перезаписываем
      try {
        localStorage.setItem(KLADR_STORAGE_KEY, JSON.stringify(found));
      } catch (e) {
        // ignore
      }

      console.log("[City] KLADR загружен из API и закэширован:", cityName);
      return found;
    } catch (err) {
      console.error("[City] Ошибка получения KLADR для города:", cityName, err);
      return null;
    }
  }

  function getCityByDomain(hostname) {
    const parts = hostname.split(".");
    if (parts.length < 2 || parts[0] === "wwww") return CITY_DEFAULT;
    const subdomain = `${parts[0]}.duman.store`;
    for (const keyCityDomain in CITY_DOMAIN_MAP) {
      const domain = CITY_DOMAIN_MAP[keyCityDomain];
      if (domain === subdomain) return keyCityDomain;
    }
    return CITY_DEFAULT;
  }

  function getDomainByCity(cityName) {
    if (!cityName) return DOMAIN_DEFAULT;
    return CITY_DOMAIN_MAP[cityName.toLowerCase()] ?? DOMAIN_DEFAULT;
  }

  function setCookies(newCountry, newCity) {
    if (newCountry === country && newCity === city) return;
    Cookies.set("rev-country-location", newCountry, COOKIES_PARAMS);
    Cookies.set("rev-current-location", newCity, COOKIES_PARAMS);
    country = newCountry;
    city = newCity;
    if (indexKladr !== undefined && kladr[indexKladr])
      setDeliveryInfo(kladr[indexKladr]);
    if (location.pathname === "/new_order") {
      setTimeout(() => {
        window.location.reload();
      }, 350);
    }
  }

  function redirectToCityDomain(cityName) {
    const targetDomain = getDomainByCity(cityName);
    if (window.location.hostname !== targetDomain) {
      Cookies.remove("rev-country-location");
      Cookies.remove("rev-current-location");
      window.location.href = `${window.location.protocol}//${targetDomain}${window.location.pathname}`;
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
          ${delivery.description ? `<div class="product-delivery__item-text">${delivery.description}</div>` : ""}
          <button type="button" class="product-delivery__item-more">Подробнее об условиях акции</button>
        </div>
        <div class="product-delivery__item-price-wrapper">
          <div class="product-delivery__item-price">
            <span>${delivery.show_price && price !== undefined && !isNaN(price) ? (price == 0 ? "Бесплатно" : typeof Shop !== "undefined" ? Shop.money.format(price) : price) : "Будет рассчитана далее"}</span>
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
      id: selectDelivery.id,
      priceFree: priceFree,
      title: selectDelivery.title,
    };
  }

  function setFreeDeliveryTitle(priceFree) {
    if (
      !isFreeShipping ||
      (typeof Cart !== "undefined" && Cart.order.items_count == 0)
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
    if (selectDelivery && typeof Cart !== "undefined") {
      isFreeShipping = true;
      $(".basket__info-total-item_dilivery:first").removeAttr("hidden");
      setFreeDeliveryTitle(selectDelivery.priceFree - Cart.order.total_price);
    }
  }

  async function setDeliveryInfo(data) {
    const default_locale =
      $("meta[name=default-locale]").attr("content")?.toUpperCase() || "RU";
    try {
      const deliveries = await $.ajax({
        url: `/delivery/for_order.json?lang=${default_locale}&v2=${$("[data-checkout2]").length > 0}`,
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
      console.log("Доставка: ", deliveries);
    } catch (err) {
      console.log("Ошибка сохранения доставки ", err);
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
      ? { [$(`.product-card:first input[name="variant_id"]:first`).val()]: 1 }
      : {};
    try {
      const deliveries = await $.ajax({
        url: "/front_api/deliveries/calculate.json",
        method: "POST",
        dataType: "json",
        data: { address_data: kladrData, variants: variants },
        timeout: 10000,
      });
      console.log("[City] Доставка рассчитана: ", deliveries);
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
      console.error("[City] Ошибка расчета доставки: ", err);
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

  function openCityPopup() {
    resetPopupActiveFields();
    const btnOpenPopup = document.getElementById("btn-popup-city");
    if (btnOpenPopup) {
      btnOpenPopup.dispatchEvent(
        new Event("click", { bubbles: true, cancelable: true }),
      );
    } else {
      const $tempTrigger = $("<button>", {
        "data-popup": "#popup-city",
        style: "display: none;",
      }).appendTo("body");
      $tempTrigger.trigger("click");
      $tempTrigger.remove();
    }
    $popup.find('[name="country"]').val(country || "RU");
    updateCustomSelectText($popup.find('[name="country"]'));
    updateDomainCityAvailability();
    $popup.find('[name="name-city"]').val("").focus();
    $kladrHiddenInput.val("");
    $popup.find("[data-select-sity-list]").html("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);
    $("body").addClass("popup_open");
    console.log("[City Popup] Открыт с country: ", country, "city: ", city);
  }

  function changeCountryInForm(value) {
    if (!value) return;
    const $countrySelect = $popup.find('[name="country"]');
    if ($countrySelect.val() === value && country === value) {
      updateDomainCityAvailability();
      return;
    }
    $countrySelect.val(value);
    updateCustomSelectText($countrySelect);
    country = value;
    resetCityFieldsAfterCountryChange();
    updateDomainCityAvailability();
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
        const cityLower = elVal.toLowerCase().trim();
        let foundIndex = cities.findIndex(
          (c) => (c.city || "").toLowerCase().trim() === cityLower,
        );
        if (foundIndex === -1) {
          foundIndex = cities.findIndex(
            (c) => (c.last_level || "").toLowerCase().trim() === cityLower,
          );
        }
        indexKladr = foundIndex !== -1 ? foundIndex : 0;

        try {
          localStorage.setItem(
            KLADR_STORAGE_KEY,
            JSON.stringify(kladr[indexKladr]),
          );
        } catch (e) {
          // ignore
        }

        fetchDeliveryCalculate(kladr[indexKladr]);
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

  function getDomainCityLabel(cityKey) {
    if (!cityKey) return "";
    const displayNames = {
      "ростов-на-дону": "Ростов-на-Дону",
      "нижний новгород": "Нижний Новгород",
      "санкт-петербург": "Санкт-Петербург",
    };
    return (
      displayNames[cityKey] ||
      cityKey.charAt(0).toUpperCase() + cityKey.slice(1)
    );
  }

  function initDomainCitySelect() {
    const $select = $popup.find("[data-city-domain-select]");
    if (!$select.length) return;

    async function handleDomainCityChange(cityKey) {
      const $input = $popup.find('[name="name-city"]');
      const $saveBtn = $popup.find("[data-city-save]");
      $popup.find("[data-select-container-sity]").prop("hidden", true);
      if (!cityKey) {
        $input.val("");
        $kladrHiddenInput.val("");
        $saveBtn.prop("disabled", true);
        indexKladr = undefined;
        return;
      }
      const key = String(cityKey).toLowerCase().trim();
      const cityLabel = getDomainCityLabel(key);

      $popup.find('[name="country"]').val("RU");
      updateCustomSelectText($popup.find('[name="country"]'));
      $saveBtn.prop("disabled", true);

      const kladrData = await fetchKladrForCity(cityLabel, "RU");

      if (!kladrData) {
        console.warn(
          "[City Select] Не удалось получить KLADR данные для:",
          key,
        );
        $saveBtn.prop("disabled", true);
        return;
      }

      $kladrHiddenInput.val(JSON.stringify(kladrData));

      kladr = [kladrData];
      indexKladr = 0;

      console.log(
        "[City Select] KLADR данные загружены. Ключ:",
        key,
        "Город:",
        kladrData.city || kladrData.last_level,
      );

      fetchDeliveryCalculate(kladr[indexKladr]);
      $saveBtn.prop("disabled", false);
      console.log("[City Select] Кнопка 'Сохранить' активирована.");
    }

    function remember(value) {
      $select.data("silentValue", value);
    }
    $select.off("change.domainCity").on("change.domainCity", function () {
      remember($select.val());
      handleDomainCityChange($select.val());
    });
    remember($select.val());
    setInterval(() => {
      const current = $select.val();
      if (current === $select.data("silentValue")) return;
      remember(current);
      if (current) handleDomainCityChange(current);
    }, 300);
  }

  const SELECT_OPEN_CLASSES = "_select-open _select-focus";

  let popupActiveField = null;

  function getPopupFieldWrappers() {
    return {
      country: $popup
        .find('[name="country"]')
        .closest(".form-popup__input-wrapper"),
      domainCity: $popup
        .find("[data-city-domain-select]")
        .closest(".form-popup__input-wrapper"),
      cityInput: $popup
        .find('[name="name-city"]')
        .closest(".form-popup__input-wrapper"),
    };
  }

  function closePopupFieldDropdown($wrapper) {
    if (!$wrapper || !$wrapper.length) return;

    const openSelector = SELECT_OPEN_CLASSES.split(" ")
      .map((cls) => `.${cls}`)
      .join(", ");

    $wrapper.find(openSelector).removeClass(SELECT_OPEN_CLASSES);
    $wrapper.find(".select__options").prop("hidden", true);
    $wrapper.find("[data-select-container-sity]").prop("hidden", true);
    // $wrapper.find(".select__options").prop("hidden", true).hide();
    $wrapper.find("select, input").trigger("blur");
  }

  function setPopupActiveField(key) {
    if (!key || popupActiveField === key) return;

    if (key === "domainCity") {
      const $domainCitySelect = $popup.find("[data-city-domain-select]");
      const $customSelect = $domainCitySelect.closest(".select");

      if($domainCitySelect.prop("disabled")) return;

      if ($customSelect.length && $customSelect.hasClass(_disabled)) return;
    }

    const wrappers = getPopupFieldWrappers();

    for (const fieldKey in wrappers) {
      if (fieldKey === key) continue;
      wrappers[fieldKey].removeClass("_field-active");
      closePopupFieldDropdown(wrappers[fieldKey]);
    }

    popupActiveField = key;
    wrappers[key].addClass("_field-active");
  }

  function resetPopupActiveFields() {
    const wrappers = getPopupFieldWrappers();
    for (const fieldKey in wrappers) {
      wrappers[fieldKey].removeClass("_field-active");
    }
    popupActiveField = null;
  }

  function updateDomainCityAvailability() {
    const $countrySelect = $popup.find('[name="country"]');
    const currentCountry = getSelectValueByUI($countrySelect);
    const $domainCitySelect = $popup.find("[data-city-domain-select]");
    const $customSelect = $domainCitySelect.closest(".select");
    const isRussia = currentCountry === "RU";

    $domainCitySelect.prop("disabled", !isRussia);

    if ($customSelect.length) {
      $customSelect.toggleClass("_disabled", !isRussia);
      $customSelect.find(".select__title").prop("disabled", !isRussia);
    }

    if (!isRussia) {
      $domainCitySelect.val("");
      updateCustomSelectText($domainCitySelect);
      $domainCitySelect.data("silentValue", "");

      if ($customSelect.length) {
        $customSelect.removeClass(SELECT_OPEN_CLASSES);
        $customSelect.find(".select__options").prop("hidden", true);
      }

      if (popupActiveField === "domainCity") {
        const wrappers = getPopupFieldWrappers();
        wrappers.domainCity.removeClass("_field-active");
        closePopupFieldDropdown(wrappers.domainCity);
        popupActiveField = null;
      }
    }
    updateDomainCityVisualState();
  }

  function updateDomainCityVisualState() {
    const $cityInput = $popup.find('[name="name-city"]');
    const inputValue = $cityInput.val().trim();
    const $domainCitySelect = $popup.find("[data-city-domain-select]");
    const $customSelect = $domainCitySelect.closest(".select");
    const $countrySelect = $popup.find('[name="country"]');
    const currentCountry = getSelectValueByUI($countrySelect);
    const isRussia = currentCountry === "RU";

    const shouldDisable = !isRussia || inputValue.length > 0;

    if ($customSelect.length) {
      $customSelect.toggleClass("_disabled", shouldDisable);
      $customSelect.find(".select__title").prop("disabled", shouldDisable);
    }

    if (inputValue.length > 0 && $customSelect.length) {
      $customSelect.removeClass(SELECT_OPEN_CLASSES);
      $customSelect.find(".select__options").prop("hidden", true);

      if (popupActiveField === "domainCity") {
        const wrappers = getPopupFieldWrappers();
        wrappers.domainCity.removeClass("_field-active");
        popupActiveField = null;
      }
    }
  }

  function updateCustomSelectText($nativeSelect) {
    if (!$nativeSelect || !$nativeSelect.length) return;

    const selectedText = $nativeSelect.find("option:selected").text();
    const $customSelect = $nativeSelect.closest(".select");

    if ($customSelect.length) {
      $customSelect.find(".select__content").text(selectedText);
    }
  }

  function getSelectValueByUI($nativeSelect) {
    if (!$nativeSelect || !$nativeSelect.length) return "";
    const $custom = $nativeSelect.closest(".select");
    if (!$custom.length) return $nativeSelect.val();

    const text = ($custom.find(".select__content").first().text() || "").trim();
    let value = null;
    $nativeSelect.find("option").each(function () {
      if ($(this).text().trim() === text) {
        value = this.value;
        return false;
      }
    });
    return value !== null ? value : $nativeSelect.val();
  }

  function resetCityFieldsAfterCountryChange() {
    $popup.find("[data-select-sity-list]").html("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find('[name="name-city"]').val("");
    $kladrHiddenInput.val("");
    $popup.find("[data-city-save]").prop("disabled", true);

    updateDomainCityVisualState();
  }

  function applyCountryState(newCountry) {
    if (!newCountry) return;
    const $countrySelect = $popup.find('[name="country"]');
    if ($countrySelect.val() !== newCountry) {
      $countrySelect.val(newCountry);
    }
    country = newCountry;
    resetCityFieldsAfterCountryChange();
    updateDomainCityAvailability();
  }

  function initCountryWatch() {
    const $countrySelect = $popup.find('[name="country"]');
    if (!$countrySelect.length) return;

    let lastValue = getSelectValueByUI($countrySelect);

    $popup.on("click", ".select__option", function () {
      const $custom = $(this).closest(".select");
      if (!$custom.find('select[name="country"]').length) return;
      const current = getSelectValueByUI($countrySelect);
      if (current !== lastValue) {
        lastValue = current;
        applyCountryState(current);
      }
    });

    setInterval(() => {
      const current = getSelectValueByUI($countrySelect);
      if (current === lastValue) return;
      lastValue = current;
      applyCountryState(current);
    }, 300);
  }

  function initPopupActiveFields() {
    const wrappers = getPopupFieldWrappers();

    if (
      !wrappers.country.length ||
      !wrappers.domainCity.length ||
      !wrappers.cityInput.length
    )
      return;

    wrappers.country.on("mousedown focusin", () => {
      setPopupActiveField("country");
    });

    wrappers.domainCity.on("mousedown focusin", () => {
      setPopupActiveField("domainCity");
    });

    wrappers.cityInput.on("mousedown focusin", () => {
      setPopupActiveField("cityInput");
    });

    $popup.on("mousedown.popupActiveFields", (e) => {
      const wrappersNow = getPopupFieldWrappers();
      const isInsideField = Object.values(wrappersNow).some(
        ($wrapper) => $wrapper.length && $wrapper[0].contains(e.target),
      );
      if (!isInsideField) resetPopupActiveFields();
    });
  }

  $("[data-city-confirm]").on("click", (e) => {
    e.preventDefault();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $cityNotice.prop("hidden", true);
    console.log("[City Confirm] Город подтверждён: ", city);
  });

  $("[data-city-change]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $cityNotice.prop("hidden", true);
    console.log("[City Change] Клик по кнопке 'Нет, другой'.");
    setTimeout(() => {
      openCityPopup();
      console.log("[City Change] Popup успешно открыт");
    }, 200);
  });

  $("[data-city-open]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log("[City Open] Клик по кнопке выбора города");
    const $mobPopup = $(e.currentTarget).closest("[data-mob-popup='main']");
    if ($mobPopup.length) {
      $mobPopup.removeClass("_active").css("transform", "translateX(-100%)");
    }
    openCityPopup();
  });

  $popup.find("[data-close]").on("click", () => {
    resetPopupActiveFields();
    $popup.attr("aria-hidden", "true");
    $("body").removeClass("popup_open");
  });

  $(document).on("click", ".popup_open .popup__wrapper", (e) => {
    if (e.target === e.currentTarget) {
      resetPopupActiveFields();
      $popup.attr("aria-hidden", "true");
      $("body").removeClass("popup_open");
    }
  });

  $popup.find('[name="name-city"]').on("input", function () {
    const _this = $(this);
    const val = _this.val().trim();

    updateDomainCityVisualState();

    clearTimeout(keyupTimer);
    keyupTimer = setTimeout(() => {
      if (val.length >= 2) {
        inputCity(val, $popup.find('[name="country"]').val());
      } else {
        $popup.find("[data-select-container-sity]").prop("hidden", true);
        $kladrHiddenInput.val("");
        $popup.find("[data-city-save]").prop("disabled", true);
      }
    }, 300);
  });

  $popup.find('[data-js="input-clear"]').on("click", () => {
    $popup.find('[name="name-city"]').val("").focus();
    $kladrHiddenInput.val("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);
    updateDomainCityVisualState();
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
      const selectedKladr = kladr[indexKladr];
      $popup.find('[name="name-city"]').val(newCity);
      if (selectedKladr) {
        $kladrHiddenInput.val(JSON.stringify(selectedKladr));
      }
      $popup.find("[data-city-save]").prop("disabled", false);
      $popup.find("[data-select-container-sity]").prop("hidden", true);
      $popup.find("[data-city-save]").focus();
    });

  $popup.find("[data-city-save]").on("click", async function () {
    const newCountry = $popup.find('[name="country"]:first').val();
    const kladrJson = $kladrHiddenInput.val();
    let selectKladr = null;
    let finalCityName = $popup.find('[name="name-city"]:first').val().trim();
    const isInputFilled = finalCityName.length > 0;

    if (kladrJson) {
      try {
        selectKladr = JSON.parse(kladrJson);
        if (!finalCityName && selectKladr.last_level) {
          finalCityName = selectKladr.last_level;
        }
      } catch (e) {
        console.error("Ошибка парсинга KLADR из скрытого инпута", e);
      }
    }

    if (!selectKladr && indexKladr !== undefined && kladr[indexKladr]) {
      selectKladr = kladr[indexKladr];
      if (!finalCityName && selectKladr.last_level) {
        finalCityName = selectKladr.last_level;
      }
    }

    if (!finalCityName && !isInputFilled) {
      const selectedDomainCity = $popup.find("[data-city-domain-select]").val();
      if (selectedDomainCity) {
        finalCityName = getDomainCityLabel(selectedDomainCity);
      }
    }

    if (!newCountry || !finalCityName || !selectKladr) {
      console.warn("Недостаточно данных для сохранения города", {
        newCountry,
        finalCityName,
        selectKladr,
      });
      return;
    }

    setCookies(newCountry, finalCityName);
    updateCityInHeader(finalCityName);
    fetchDeliveryCalculate(selectKladr);
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $popup.find("[data-close]:first").trigger("click");
    if (location.pathname === "/new_order") {
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } else {
      redirectToCityDomain(finalCityName);
    }
  });

  $popup.find('[name="country"]').on("change", function () {
    const newCountry = $(this).val();
    if (!newCountry || newCountry === country) return;
    updateCustomSelectText($(this));
    changeCountryInForm(newCountry);
  });

  if (typeof EventBus !== "undefined") {
    EventBus.subscribe("update_items:insales:cart", (cart) => {
      if (isCart && !isNaN(priceFreeDelivery)) {
        setFreeDeliveryTitle(priceFreeDelivery - cart.total_price);
      }
    });
  }

  const CityDomain = getCityByDomain(window.location.hostname);
  initDomainCitySelect();
  initPopupActiveFields();
  initCountryWatch();

  if (!country || !city) {
    console.log(
      "[City] Город не найден в куки, запрашиваем через Kladr API...",
    );
    $.ajax({
      url: "https://kladr.insales.ru/current_location.json",
      type: "get",
      dataType: "jsonp",
      success: async function (data) {
        if (data.country && data.city) {
          setCookies(data.country, data.city);
          // Кэшируем KLADR данные автоопределённого города в localStorage
          await fetchKladrForCity(data.city, data.country);
          if (
            !window.location.pathname.includes("/new_order") &&
            !window.location.pathname.includes("/page/new-order")
          ) {
            updateCityInHeader(city);
          }
          console.log("[City] Автоопределен и сохранен город: ", city);
        } else {
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
    console.log("[City] Город успешно прочитан из cookie: ", city);
    updateCityInHeader(city);
    initCityNotice();
    if (isProduct || isCart) inputCity(city, country, true);
  }
});
