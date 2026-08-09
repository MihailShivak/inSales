class MapZones {
  constructor(wrapperMap) {
    this.mapDOMWrapper = wrapperMap;
    this.mapDOM = wrapperMap.querySelector("#zone-delivery-map");

    this.map = null; // Карта ymaps3
    this.polygonsMap = null;
    this.markersMap = null;

    this._mapReady = false;

    //         45.713399,
    // 43.299634
    this.MAP_CENTER = [45.694909, 43.317776];
    this.MAP_ZOOM = 10;

    this.loader = new EM_Module.Loader($(this.mapDOMWrapper));
  }

  async initMap() {
    if (this._mapReady) return;

    try {
      await this.initializeMap();
      console.log("Карта успешно инициализирована");
    } catch (error) {
      console.error("Ошибка инициализации карты:", error);
      this.hide();
    }
  }

  // Инициализация карты Yandex Maps
  async initializeMap() {
    try {
      // Проверяем доступность API
      if (typeof ymaps3 === "undefined") {
        throw new Error("Yandex Maps API не загружен");
      }

      // Ждем готовности API
      await ymaps3.ready;

      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ymaps3;

      this.polygonsMap = new Map();
      this.markersMap = new Map();

      // Создаем карту
      this.map = new YMap(this.mapDOM, {
        location: {
          center: this.MAP_CENTER,
          zoom: this.MAP_ZOOM,
        },
        showScaleInCopyrights: true,
      });

      // Добавляем слои карты
      const schemeLayer = new YMapDefaultSchemeLayer({});
      const featuresLayer = new YMapDefaultFeaturesLayer({});

      this.map.addChild(schemeLayer);
      this.map.addChild(featuresLayer);

      this._mapReady = true;

      // Добавляем обработчик готовности карты
      // map.addListener('load', () => {
      //     console.log('Карта полностью загружена');
      // });
    } catch (error) {
      console.error("Ошибка при создании карты:", error);
      this.hide();
      throw error;
    }
  }

  /**
   * Нормализует coordinates к массиву колец.
   * Поддерживает как старый формат (один полигон: массив точек),
   * так и новый MultiPolygon (массив колец, каждое кольцо — отдельный кусок зоны)
   */
  getPolygonRings(coordinates) {
    const isMulti = Array.isArray(coordinates[0][0]);
    return isMulti ? coordinates : [coordinates];
  }

  // Добавление полигона района (может состоять из нескольких отдельных кусков)
  addDistrictPolygon(shop) {
    try {
      const { YMapFeature } = ymaps3;

      const rings = this.getPolygonRings(shop.polygon.coordinates);
      const features = rings.map(
        (ring) =>
          new YMapFeature({
            geometry: {
              type: "Polygon",
              coordinates: [ring],
            },
            style: {
              fill: shop.polygon.properties.fill + "4D", // 30% прозрачность
              stroke: [
                {
                  color: shop.polygon.properties.fill,
                  width: shop.polygon.properties["stroke-width"] ?? 3,
                },
              ],
            },
          }),
      );

      // Добавляем все куски полигона на карту
      features.forEach((feature) => this.map.addChild(feature));
      this.polygonsMap.set(shop.id, features);
    } catch (error) {
      console.error("Ошибка при добавлении полигона:", error);
      this.hide();
    }
  }

  // Добавление метки центра района
  addDistrictMarker(shop, isPoint = false) {
    try {
      const { YMapMarker } = ymaps3;

      // Создаем HTML элемент для метки
      const markerElement = document.createElement("div");
      if (isPoint) {
        markerElement.style.cssText = `
                    width: 20px;
                    height: 20px;
                    background-color: ${shop.polygon.properties.fill};
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    cursor: pointer;
                    position: relative;
                    z-index: 1000;
                `;
      } else {
        // style="background-color: ${shop.polygon.properties.fill}"
        markerElement.className = "vitamin-marker";
        markerElement.innerHTML = `
                    <div class="vitamin-marker__icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="40" viewBox="0 0 26 40" fill="none">
                        <g clip-path="url(#clip0_2010_172)">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M11.3083 25.9017C4.92716 25.0722 0 19.6138 0 13.0054C0 5.82366 5.81937 0 13 0C20.1806 0 26 5.82366 26 13.0054C26 14.7335 25.662 16.3876 25.0468 17.9014C23.6987 21.4768 20.8429 26.3559 18.2575 30.4453C15.6392 34.5867 13.1829 38.0963 12.5474 38.9697C12.048 39.6559 11.2783 39.9965 10.5201 39.9965C8.83647 39.9965 7.62976 38.3765 8.10664 36.765" fill="white"/>
                        <path d="M13.8749 24.2678C13.9135 24.1384 13.8095 24.0097 13.6746 24.0129C13.4514 24.0181 13.2265 24.0109 13 24.0109C6.92487 24.0109 2 19.0836 2 13.0054C2 6.9273 6.92487 2 13 2C19.0751 2 24 6.9273 24 13.0054C24 14.4798 23.7102 15.8865 23.1845 17.1716C20.6578 23.8985 12.1494 36.1173 10.9302 37.793C10.8334 37.9259 10.6845 37.9965 10.5201 37.9965C10.1744 37.9965 9.92608 37.6634 10.0246 37.3318L13.8749 24.2678Z" fill="${shop.polygon.properties.fill}"/>
                        <path d="M13 20.998C17.4183 20.998 21 17.4163 21 12.998C21 8.57977 17.4183 4.99805 13 4.99805C8.58172 4.99805 5 8.57977 5 12.998C5 17.4163 8.58172 20.998 13 20.998Z" fill="white"/>
                        <path d="M10.2903 8.39941H8.27585C8.08771 8.39941 7.95486 8.58373 8.01436 8.76221L8.18315 9.26861C8.22067 9.38116 8.326 9.45708 8.44464 9.45708H9.25601C9.35768 9.45708 9.4511 9.51305 9.49906 9.60271L12.0217 14.319C12.0818 14.4313 12.2109 14.4878 12.3341 14.4558L17.7937 13.0363C17.9152 13.0047 18 12.895 18 12.7695V10.7904C18 10.6381 17.8766 10.5147 17.7244 10.5147H11.49C11.3763 10.5147 11.2743 10.445 11.2331 10.339L10.5472 8.57515C10.506 8.4692 10.404 8.39941 10.2903 8.39941Z" fill="#212121"/>
                        <circle cx="10.5958" cy="16.3897" r="1.05767" fill="#212121"/>
                        <circle cx="15.2969" cy="16.3897" r="1.05767" fill="#212121"/>
                        </g>
                        <defs>
                        <clipPath id="clip0_2010_172">
                        <rect width="26" height="40" fill="white"/>
                        </clipPath>
                        </defs>
                        </svg>
                    </div>
                    <div class="vitamin-marker__label">${shop.name}</div>`;
      }

      // Создаем метку
      const marker = new YMapMarker(
        {
          coordinates: shop.polygon.center,
          draggable: false,
        },
        markerElement,
      );

      // Добавляем метку на карту
      this.map.addChild(marker);
      this.markersMap.set(shop.id, marker);
    } catch (error) {
      console.error("Ошибка при добавлении метки:", error);
      this.hide();
    }
  }

  /**
   * Центрирование карты на районе по ID магазина
   */
  centerMapOnDistrict(center) {
    try {
      this.map.setLocation({
        center: center,
        zoom: this.MAP_ZOOM,
        duration: 1000,
      });
    } catch (error) {
      console.error("Ошибка при центрировании карты:", error);
      this.hide();
    }
  }

  // Получение геолокации клиента
  setUserLocation() {
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation не поддерживается браузером");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.addDistrictMarker({
          polygon: {
            properties: {
              fill: "#f7b21c",
            },
            center: [position.coords.longitude, position.coords.latitude],
          },
        });
      },
      (error) => {
        console.warn("Ошибка получения геолокации:", error);
      },
      {
        enableHighAccuracy: true, // Высокая точность (GPS)
        timeout: 10000, // Ждем 10 сек
        maximumAge: 0, // Не использовать кэш
      },
    );
  }

  /**
   * Удаление конкретного полигона и метки по ID магазина
   */
  removeDistrictPolygon(shopId) {
    try {
      // Удаляем полигон (может состоять из нескольких кусков)
      if (this.polygonsMap.has(shopId)) {
        for (const feature of this.polygonsMap.get(shopId)) {
          this.map.removeChild(feature);
        }
        this.polygonsMap.delete(shopId);
      }

      // Удаляем метку
      if (this.markersMap.has(shopId)) {
        this.map.removeChild(this.markersMap.get(shopId));
        this.markersMap.delete(shopId);
      }
    } catch (error) {
      console.error("[Shops] Ошибка при удалении полигона:", error);
    }
  }

  /**
   * Очистка всех полигонов и маркеров с карты
   */
  clearAllPolygons() {
    try {
      // Удаляем все полигоны (каждый может состоять из нескольких кусков)
      for (const [_, features] of this.polygonsMap.entries()) {
        for (const feature of features) {
          this.map.removeChild(feature);
        }
      }

      // Удаляем все маркеры
      for (const [_, marker] of this.markersMap.entries()) {
        this.map.removeChild(marker);
      }

      this.polygonsMap.clear();
      this.markersMap.clear();
    } catch (error) {
      console.error("Ошибка при очистке объектов карты:", error);
      this.hide();
    }
  }

  show() {
    this.mapDOMWrapper.removeAttribute("hidden");
  }

  hide() {
    this.loader.hide();
    this.mapDOMWrapper.setAttribute("hidden", true);
  }
}

/**
 * Система выбора зон доставки для insales
 * Обеспечивает функционал выбора района доставки с картой и перенаправлением
 * @version 3.0
 * @author Разработано для insales
 */
class DeliveryZoneSelector {
  constructor($container, options = {}) {
    this.$container = $container;
    this.options = {
      mapCenter: [43.345, 45.678], // Центр Грозного
      mapZoom: 12,
      ...options,
    };

    // Ключи для сохранения данных в памяти
    this.key = {
      shops: "em_shops",
      selectShop: "em_select_shop_id",
      appHide: "app_hide",
      openPopup: "popup-count",
    };

    this.shops = {};
    this.selectShop = null;

    this.map = null;
    // this.isShopSelected = false;
    this.polygons = [];
    this._initMap = false;
    this._isOpen = false;

    // DOM элементы
    this.$popupShops = null; // Попап выбора магазина
    this.$btnRedirect = null;

    // this.demoModal = null;
    this.deliveryModal = null;
    this.deliveryModalSuccess = null;

    if (this.options.isApp) this.initForApp();
    else this.init();
  }

  /**
   * Инициализация системы
   */
  init() {
    // if (window.location.pathname !== "/") {
    //     this.demoModal = new EM_Module.Modal(document.getElementById("popup-warning"));
    //     this.demoModal.init(undefined, (function() {
    //         Cookies.set(this, "true");
    //     }).bind(this.options.demoCookiesKey));
    // }

    this.$popupShops = this.$container.find("#popup-delivery-shop");

    if (!this.$popupShops.length) {
      console.warn("[Shops] Попап выбора магазина не найден");
      return;
    }

    this.deliveryModal = new EM_Module.Modal(this.$popupShops.get(0));
    this.deliveryModal.init(this.openDeliveryModal.bind(this));

    this.loadShops()
      .then(() => {
        this.initDOM();
        this.initEvents();

        // Открываем модалку при каждом заходе на сайт
        this.deliveryModal.open();
      })
      .catch((error) => {
        this.printError("Ошибка инициализации системы доставки");
        console.error("Ошибка инициализации системы доставки:", error);
        this.$btnRedirect.addClass("btn__disabled-grey");
      });
  }

  initForApp() {
    this.loadShops()
      .then(() => {
        setTimeout(() => this.openModalWarningTime(), 200);
      })
      .catch((error) => {
        console.error("Ошибка инициализации системы доставки:", error);
      });
  }

  /**
   * Инициализация DOM элементов
   */
  initDOM() {
    this.$btnRedirect = this.$popupShops.find("[data-change-store]:first");
  }

  /**
   * Привязка событий
   */
  initEvents() {
    this.$popupShops.on(
      "click",
      "[data-select-shop]",
      this.clickShop.bind(this),
    );

    // Кнопка "Перейти в магазин"
    this.$btnRedirect.on("click", this.openNewShop.bind(this));

    setTimeout(() => this.openModalWarningTime(), 200);
  }

  /**
   * Выбор магазина
   * !! Дописать
   */
  clickShop(e) {
    const selectShopID = Number(
      e.currentTarget.getAttribute("data-select-shop") ?? "0",
    );
    if (isNaN(selectShopID)) {
      this.printError("Не удалось загрузить информацию о магазинах");
      this.$btnRedirect.addClass("btn__disabled-grey");
      return;
    }

    const selectShop = this.shops.shops.find((shop) => shop.id == selectShopID);

    $(e.currentTarget.parentElement).find("> ._active").removeClass("_active");
    if (selectShop) {
      Cookies.set(this.key.openPopup, 4);

      this.selectShopID = selectShopID;
      this.selectShop = selectShop;

      if (window.innerWidth < 550 && window.innerHeight < 690) {
        const $block = this.$popupShops.find(".modal__content:first");
        $block.animate(
          {
            scrollTop: $block.get(0).scrollHeight - 200,
          },
          600,
        );
      }

      e.currentTarget.classList.add("_active");

      this.MapZones.clearAllPolygons();
      this.MapZones.addDistrictPolygon(selectShop);
      this.MapZones.addDistrictMarker(selectShop);
      this.MapZones.centerMapOnDistrict(selectShop.polygon.center);

      this.MapZones.setUserLocation();

      this.$popupShops
        .find(".modal__map-descript:first")
        .html(
          "Вы можете увеличивать и двигать карту, чтобы детальнее изучить зону доставки",
        );
      // .html(`<span>Адрес магазина:</span> ${selectShop.address}`);

      const isCurrentShop = window.location.origin.includes(
        `https://${selectShop.shop_url}`,
      );
      this.$btnRedirect
        .text(isCurrentShop ? "Остаться" : "Перейти в магазин")
        .removeClass("btn__disabled-grey");

      if (!isCurrentShop && Cart.order.items_count > 0) {
        this.printError(
          "В вашей корзине уже есть товары. Если вы измените магазин, то все товары из корзины придется собирать заново",
        );
      } else {
        this.visibleError();
      }
    } else {
      this.printError("Не удалось загрузить информацию о магазинах");
      this.$btnRedirect
        .text("Перейти в магазин")
        .addClass("btn__disabled-grey");
      this.$popupShops
        .find(".modal__map-descript:first")
        .html("<span>Выберите магазин</span>, чтобы увидеть его зону доставки");
    }
  }

  /**
   * Перенаправление в выбранный магазин
   */
  openNewShop() {
    if (this.selectShop && this.selectShop.shop_url) {
      setTimeout(() => this.redirectToZoneStore(this.selectShop), 150);
    } else {
      this.printError("Вы не выбрали магазин");
      this.$btnRedirect.addClass("btn__disabled-grey");
    }
  }

  /**
   * Перенаправление в магазин зоны
   */
  redirectToZoneStore(shop) {
    const shop_url = `https://${shop.shop_url}`;
    if (window.location.origin.includes(shop_url)) {
      if (window.location.pathname.includes("/new_order")) {
        window.location.reload();
      } else {
        // $("input[data-popup='#popup-delivery']").val(shop.name);
        this.deliveryModal.close();
      }
    } else if (shop.shop_url) {
      window.location.href = shop_url;
    }
  }

  // Открытие модалки
  async openDeliveryModal() {
    this._isOpen = true;
    if (this._initMap || !this.shops?.shops) {
      return;
    }

    this._initMap = true;
    this._isOpen = false;

    this.MapZones = new MapZones(
      this.$popupShops.find("[data-show-deliveries]:first").get(0),
    );
    await this.MapZones.initMap();

    if (this.selectShop) {
      this.MapZones.addDistrictMarker(this.selectShop);
      this.MapZones.addDistrictPolygon(this.selectShop);
      this.MapZones.centerMapOnDistrict(this.selectShop.polygon.center);
    } else {
      for (const key in this.shops.shops) {
        this.MapZones.addDistrictPolygon(this.shops.shops[key]);
        this.MapZones.centerMapOnDistrict(this.MapZones.MAP_CENTER);
      }
    }
    const $btns = this.$popupShops.find(".modal__delivery-select:first");
    for (const shop of this.shops.shops) {
      if (!shop.opening) continue;
      $btns
        .find(`[data-select-shop="${shop.id}"]:first span`)
        .text(shop.opening);
    }
    this.MapZones.setUserLocation();
  }

  closeDeliveryModal() {
    Cookies.set(this.key.openPopup, 4);
  }

  /**
   * Приводит новую схему /webapp (shop.features: GeoJSON Feature[])
   * к внутреннему формату shop.polygon.{coordinates,properties,center},
   * который уже понимают addDistrictPolygon/addDistrictMarker/centerMapOnDistrict
   */
  normalizeShopFeatures(shop) {
    if (!Array.isArray(shop.features)) return shop;

    const polygonFeatures = shop.features.filter(
      (f) => f.geometry.type === "Polygon",
    );
    const pointFeature = shop.features.find((f) => f.geometry.type === "Point");

    shop.polygon = {
      coordinates: polygonFeatures.map((f) => f.geometry.coordinates[0]),
      properties: polygonFeatures[0]?.properties ?? {},
      center: pointFeature ? pointFeature.geometry.coordinates : undefined,
    };

    return shop;
  }

  /**
   * Загрузка данных о зонах доставки
   */
  async loadShops() {
    if (this.getSaveShops()) {
      if (this._isOpen) this.openDeliveryModal();
      return;
    }
    try {
      const response = await fetch(this.options.zonesDataUrl);
      const data = await response.json();

      data.shops = data.shops.map((shop) => this.normalizeShopFeatures(shop));
      this.shops = data;
      this.saveShops();
      if (this._isOpen) this.openDeliveryModal();
      // this.popularZones = data.popular_zones || [];
    } catch (error) {
      console.error("[DeliveryZone] Ошибка загрузки зон доставки:", error);
      // ! Дописать вывод ошибок
    }
  }

  // [Edits] Перенос
  isTimeInRange(start, end) {
    if (!start || !end) return false;

    const now = new Date();

    // // CLOSED TIME FOR TESTING
    // now.setHours(0, 0, 0, 0); // Устанавливаем время на 00:00 для тестирования

    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;

    return (
      currentTotalMinutes >= startTotalMinutes &&
      currentTotalMinutes <= endTotalMinutes
    );
  }

  // Проверить сколько прошло с прошлого открытия попапа "Доставка уже не работает"
  checkAndUpdateLastVisit(valueStorage, isSetTime, keyStorage) {
    const HALF_DAY_MS = 60 * 60 * 1000; // 1 час
    const now = Date.now();

    if (!valueStorage || valueStorage === "false") {
      if (isSetTime) localStorage.setItem(keyStorage, String(now));
      return true;
    }

    const lastTime = Number(valueStorage);

    if (isNaN(lastTime) || now - lastTime >= HALF_DAY_MS) {
      // прошло больше пол суток
      if (isSetTime) localStorage.setItem(keyStorage, String(now));
      return true;
    }

    // меньше пол суток
    return false;
  }

  // вывод попапа предупреждения, что магазин закрыт
  openModalWarningTime() {
    const lastVisitTime = localStorage.getItem("lastVisitTime");

    // Находим текущий магазин
    const currentShop = this.shops.shops.find((shop) => {
      const shopUrl = (shop.shop_url || "").trim();
      return (
        window.location.host === shopUrl ||
        window.location.host.includes(shopUrl)
      );
    });

    if (!currentShop) {
      this.openModalCustomWarning();
      return;
    }

    // Получаем статус и время работы
    const shopStatus = (currentShop.status || "").trim();
    const openingStr = (currentShop.opening || "").trim();

    // Разделяем время
    const shopOpening = openingStr.split(/[—\-–]/).map((time) => time.trim());

    // Проверяем условия
    if (
      !shopOpening ||
      shopOpening.length < 2 ||
      shopStatus !== "available" || // ИСПРАВЛЕНО: проверяем статус самого магазина
      this.isTimeInRange(shopOpening[0], shopOpening[1]) // Если время входит в диапазон (магазин открыт)
    ) {
      if (lastVisitTime !== "false") {
        localStorage.setItem("lastVisitTime", "false");
      }
      this.openModalCustomWarning();
      return;
    }

    // магазин ЗАКРЫТ
    if (!this.checkAndUpdateLastVisit(lastVisitTime, false, "lastVisitTime")) {
      this.openModalCustomWarning();
      return;
    }

    const warningModal = new EM_Module.Modal(
      document.getElementById("popup-warning-time"),
    );
    warningModal.init(undefined, () => {
      this.checkAndUpdateLastVisit(lastVisitTime, true, "lastVisitTime");
    });

    const modalTextSpan = warningModal.modal.querySelector(".modal__text span");
    if (modalTextSpan) {
      modalTextSpan.innerText = shopOpening[0] ?? "10:00";
    }
    warningModal.open();
    this.openModalApp();
  }

  openModalCustomWarning() {
    const popup = document.getElementById("popup-message-warning");
    if (!popup) {
      this.openModalApp();
      return;
    }

    const lastVisitTimeWarning = localStorage.getItem("lastVisitTimeWarning");

    if (
      !this.checkAndUpdateLastVisit(
        lastVisitTimeWarning,
        false,
        "lastVisitTimeWarning",
      )
    ) {
      this.openModalApp();
      return;
    }

    const warningModal = new EM_Module.Modal(popup);

    warningModal.init(undefined, () => {
      this.checkAndUpdateLastVisit(
        lastVisitTimeWarning,
        true,
        "lastVisitTimeWarning",
      );
    });
    warningModal.open();
  }

  openModalApp() {
    if (
      window.location.pathname === "/" &&
      Cookies.get("show_modal_notice_app") !== "true" &&
      Cookies.get("app_hide") !== "true" &&
      new URLSearchParams(window.location.search).get("app") !== "true"
    ) {
      setTimeout(() => {
        const noticeModal = new EM_Module.Modal(
          document.getElementById("popup-notice-app"),
        );

        noticeModal.init(
          undefined,
          function () {
            Cookies.set(this, "true");
          }.bind("show_modal_notice_app"),
        );
        noticeModal.open();
      }, 150);
    }
  }

  /**
   * Сохранения в пямяти данных
   * @param {String} type Тип данных для сохранения: all - все, select - ID выбранного магазина, shops - магазины
   * @returns {Boolean} Успех выполнения операции
   */
  saveShops(type = "all") {
    try {
      if (type == "select" || type == "all") {
        localStorage.setItem(this.key.selectShop, this.selectShopID);
      }
      if (type == "shops" || type == "all") {
        localStorage.setItem(
          this.key.shops,
          JSON.stringify({
            shops: this.shops,
            timestamp: Date.now(),
          }),
        );
      }
      return true;
    } catch (err) {
      console.warn("[Shops] Ошибка сохранения данный в памяти:", err);
      return false;
    }
  }

  /**
   * Получить данные из памяти
   */
  getSaveShops() {
    const sixHourMs = 1000 * 60 * 60 * 6; // 6 часов
    let isSuccess = false;

    try {
      const shops = localStorage.getItem(this.key.shops);
      const selectShopID = Number(
        localStorage.getItem(this.key.selectShop) ?? "",
      );

      const shopsJSON = shops ? JSON.parse(shops) : null;

      if (!shopsJSON?.timestamp || Date.now() - shopsJSON.timestamp > sixHourMs)
        return false;
      if (shopsJSON) {
        this.shops = shopsJSON.shops;
        isSuccess = true;
      }
      if (selectShopID && !isNaN(selectShopID)) {
        this.selectShopID = selectShopID;
        this.selectShop = shopsJSON.shops.shops.find(
          (shop) => shop.id == selectShopID,
        );
      }
    } catch (err) {
      console.warn("[Shops] Ошибка сохранения данный в памяти:", err);
    }
    return isSuccess;
  }

  printError(message) {
    this.$popupShops
      .find(".message__delivery-error:first")
      .text(message)
      .removeAttr("hidden");
  }

  // Скрыть / показать сообщение об ошибке
  visibleError(isHidden = true) {
    this.$popupShops
      .find(".message__delivery-error:first")
      .attr("hidden", isHidden);
  }
}

(function () {
  const $delivery = $widget;
  var count = 0;

  // reCaptchaCommon.render(document.querySelector('#recaptchaBlock'), 'feedback');

  function pushEventReady() {
    if (typeof EventBus === "undefined") {
      count++;
      if (count < 20) setTimeout(pushEventReady, 250);
      else
        console.warn(
          "[Map] Ошибка инициализации карты: превышено время ожидания",
        );
    } else {
      let isApp;
      try {
        isApp =
          Cookies.get("app_hide") === "true" ||
          new URLSearchParams(window.location.search).get("app") === "true";
      } catch (_) {
        isApp = true;
      }

      new DeliveryZoneSelector($delivery, {
        mapCenter: [43.345, 45.678], // Центр карты
        mapZoom: 12, // Масштаб
        zonesDataUrl: "https://api.wizzu.ru/api/get/shop/webapp", // Путь к данным
        isApp: isApp,
      });
    }
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", pushEventReady);
    } else {
      pushEventReady();
    }

    console.log("[Map] start...");
  } catch (err) {
    console.warn("[Map] Ошибка инициализации карты", err);
  }
})();

// update 2024-06-05
