$(document).ready(() => {
  // Универсальная функция для получения корневого домена (например, ".duman.store")
  function getRootDomain() {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return "." + parts.slice(-2).join(".");
    }
    return hostname;
  }
  const rootDomain = getRootDomain();

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
      console.log("[City] Редирект на домен:", targetDomain);
      window.location.href = newUrl;
    }
  }

  function updateCityInHeader(cityName) {
    if (!cityName) return;
    const displayCity = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    const $cityElement = $("[data-city-name]");
    if ($cityElement.length) {
      $cityElement.text(displayCity);
      console.log("[City] Header обновлен на:", displayCity);
    }
  }

  const isMobile = sessionStorage.getItem("isMobile") === "true";
  const isCart = window.location.pathname.includes("/cart_items");
  const isProduct = window.location.pathname.includes("/product");

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

  function initCityNotice() {
    const noticeShown = Cookies.get("city-notice-shown");
    if (noticeShown) return;
    const $notice = $("#city-notice");
    const $noticeName = $("[data-city-notice-name]");
    if ($notice.length && $noticeName.length) {
      const displayCity = city
        ? city.charAt(0).toUpperCase() + city.slice(1)
        : "Новосибирск";
      $noticeName.text(displayCity);
      $notice.removeAttr("hidden");
    }
  }

  $("[data-city-confirm]").on("click", (e) => {
    e.preventDefault();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $("#city-notice").prop("hidden", true);
    const domainCity = getCityByDomain(window.location.hostname);

    // rootDomain
    Cookies.set("rev-country-location", "Россия", {
      expires: 365,
      path: "/",
      domain: rootDomain,
    });
    Cookies.set("rev-current-location", domainCity, {
      expires: 365,
      path: "/",
      domain: rootDomain,
    });

    country = "Россия";
    city = domainCity;
    updateCityInHeader(city);
    if (isProduct || isCart) {
      inputCity(city, country, true);
    }
  });

  $("[data-city-change]").on("click", (e) => {
    e.preventDefault();
    Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
    $("#city-notice").prop("hidden", true);
    openCityPopup();
  });

  function openCityPopup() {
    $("#city-notice").prop("hidden", true);
    const $tempTrigger = $("<button>", {
      "data-popup": "#popup-city",
      style: "display: none;",
    }).appendTo("body");
    $tempTrigger.trigger("click");
    $tempTrigger.remove();

    $popup.find('[name="country"]').val(country);
    $popup.find('[name="name-city"]').val("").focus();
    $popup.find("[data-select-sity-list]").html("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find("[data-city-save]").prop("disabled", true);
    $("body").addClass("popup_open");
  }

  // Обработчик для кнопки в мобильном меню — закрывает меню через нативную кнопку, потом открывает уведомление
  $("[data-mob-popup='main'] [data-city-open]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    console.log("[City Mob Menu] Клик по кнопке города в мобильном меню");

    // Находим нативную кнопку закрытия меню и кликаем по ней
    const $closeBtn = $("[data-mob-popup='main']").find(
      "[data-mob-popup-close]",
    );

    if ($closeBtn.length) {
      console.log("[City Mob Menu] Клик по нативной кнопке закрытия меню");
      $closeBtn.trigger("click");
    } else {
      console.warn(
        "[City Mob Menu] Кнопка закрытия меню не найдена, используем fallback",
      );
      $("[data-mob-popup='main']")
        .removeClass("_active")
        .css("transform", "translateX(-100%)");
    }

    // Ждем завершения анимации закрытия меню (500мс — время анимации из CSS), потом открываем уведомление
    setTimeout(() => {
      const $notice = $("#city-notice");
      const $noticeName = $("[data-city-notice-name]");
      if ($notice.length && $noticeName.length) {
        const displayCity = city
          ? city.charAt(0).toUpperCase() + city.slice(1)
          : "Новосибирск";
        $noticeName.text(displayCity);
        $notice.prop("hidden", false);
        console.log(
          "[City Mob Menu] Открыто уведомление для города:",
          displayCity,
        );
      } else {
        console.warn("[City Mob Menu] Элементы уведомления не найдены");
      }
    }, 550);
  });

  $("[data-city-open]").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const $notice = $("#city-notice");
    const $noticeName = $("[data-city-notice-name]");
    if ($notice.length && $noticeName.length) {
      const displayCity = city
        ? city.charAt(0).toUpperCase() + city.slice(1)
        : "Новосибирск";
      $noticeName.text(displayCity);
      $notice.prop("hidden", false);
    }
  });

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
    if ($countrySelect.val() === value) return;
    $countrySelect.val(value);
    $popup.find("[data-select-sity-list]").html("");
    $popup.find("[data-select-container-sity]").prop("hidden", true);
    $popup.find('[name="name-city"]').val("");
    $popup.find("[data-city-save]").prop("disabled", true);
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
        fetchDeliveryCalculate(kladr[0]);
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

  function setCookies(newCountry, newCity) {
    if (newCountry === country && newCity === city) return;

    // rootDomain
    Cookies.set("rev-country-location", newCountry, {
      expires: 365,
      path: "/",
      domain: rootDomain,
    });
    Cookies.set("rev-current-location", newCity, {
      expires: 365,
      path: "/",
      domain: rootDomain,
    });

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
      if (!deliveries?.deliveries || !deliveries.deliveries.length) {
        console.log(
          "[ProductCard.Delivery] Ошибка получения доставки",
          deliveries,
        );
      } else if (isProduct) {
        // Логика для продукта
      } else if (isCart) {
        // Логика для корзины
      }
    } catch (err) {
      console.error("Ошибка расчета доставки:", err);
    }
  }

  $popup.find('[name="name-city"]').on("input", function () {
    const _this = $(this);
    const val = _this.val().trim();
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
    });

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

  $popup.find('[name="country"]').on("change", function () {
    changeCountryInForm($(this).val());
  });

  if (typeof EventBus !== "undefined") {
    EventBus.subscribe("update_items:insales:cart", (cart) => {
      if (isCart && !isNaN(priceFreeDelivery)) {
        // setFreeDeliveryTitle(priceFreeDelivery - cart.total_price);
      }
    });
  }

  updateCityInHeader(city);
  initCityNotice();
  if ((isProduct || isCart) && city && country) {
    inputCity(city, country, true);
  }
});
