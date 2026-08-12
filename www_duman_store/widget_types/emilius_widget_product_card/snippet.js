$(document).ready(() => {
  const isMobile = sessionStorage.getItem("isMobile") === "true";
  productId = Shop.config.getProductId();

  var $product = $widget,
    $buttonAdd = isMobile
      ? $(".tap-bar [data-em-select-variant]:first")
      : $product.find("[data-em-select-variant]:first"),
    $titleLast = $product.find(".options__title-last:first"),
    isInit = false,
    actionVariantId = 0,
    loaderBtn = { call() {}, hide() {} };

  function drawVariants(product) {
    if (!product) {
      console.warn("[ERROR] get product:", product);
      return;
    }
    // Проверка характеристики "Доступен только офлайн"
    const isOfflineOnly =
      product.characteristics &&
      product.characteristics.some(
        (c) => c.property_id == 149717105 && c.id == 923169233,
      );

    const isPreorder = EM_Module.func.checkPreorder(product.properties);
    const isSoon =
      isPreorder && EM_Module.func.checkSoon(product.properties, product.url);
    let html = "";
    for (const variant of product.variants) {
      const isInCart = Cart.order.getItemByID(variant.id) !== undefined;

      for (const option_value of variant.option_values) {
        if (option_value.option_name_id == 1607434) {
          // ${isInCart ? " style='opacity:0.6;'" : ""}
          // [Перенести]
          const className =
            (isInCart ? " checkbox-item__circle" : "") +
            (variant.available || (isPreorder && !isSoon)
              ? ""
              : " checkbox__item-not-available");
          html += `<div class="checkbox-list__item checkbox-btn">
                        <label class="checkbox-btn__label${className}">
                            <input class="checkbox-btn__input" type="radio" value="${variant.id}" name="variant_id"
                                data-variant-title="${option_value.title}"
                                data-product-available="${variant.available}"
                                data-product-soon="${isSoon}"
                                data-product-preorder="${isPreorder}"
                                data-variant-last="${variant.quantity === 1}">
                            <div class="checkbox-btn__text-wrapper">
                                <span class="checkbox-btn__text">${option_value.title}</span>
                            </div>
                        </label>
                    </div>`;
          break;
        }
      }
    }
    // [Перенести]
    if (!html) {
      $product
        .find("[data-variant-select]:first")
        .closest(".product-card-info__options-wrapper")
        .attr("hidden", true);
      // Не меняем кнопку "В корзину", если товар доступен только офлайн
      if (!isOfflineOnly) {
        if (!$buttonAdd.attr("data-popup"))
          $buttonAdd.attr("data-popup", "#popup-subscribe");
        $buttonAdd
          .addClass("button__hide")
          .removeClass("button__in-cart")
          .find("span:first")
          .text("Узнать о поступлении");
      }
    }
    $product.find("[data-product-variants-list]").html(html);
  }

  function changeButton(label, flag, variantId) {
    if (!label || !$buttonAdd.length) return;

    if (flag === "inCart") {
      $buttonAdd
        .removeClass("button__hide")
        .addClass("button__in-cart")
        .find("span:first")
        .text("Перейти в корзину");
      if (isMobile) $buttonAdd.find("span:last").text("");
      label.classList.add("checkbox-item__circle");
    } else if (flag === "hidden") {
      if (!$buttonAdd.attr("data-popup"))
        $buttonAdd.attr("data-popup", "#popup-subscribe");
      $buttonAdd
        .addClass("button__hide")
        .removeClass("button__in-cart")
        .find("span:first")
        .text("Узнать о поступлении");
      label.classList.add("checkbox__item-not-available");
    }
    // else if (checked) {
    //     $buttonAdd.addClass("button__hide").removeClass("button__in-cart").find("span:first").text("Выберите размер");
    //     label.classList.add("checkbox__item-hidden");
    // }
    else {
      $buttonAdd
        .removeClass(["button__hide", "button__in-cart"])
        .find("span:first")
        .text(
          flag !== "preorder"
            ? isMobile
              ? "Добавить в корзину"
              : "В корзину"
            : "Предзаказ",
        );

      label.classList.remove("checkbox__item-hidden", "checkbox-item__circle");
      if (isMobile && variantId) {
        Products.get(productId).done(function (product) {
          if (!product || !product.variants?.length) return;
          for (const varinat of product.variants) {
            if (varinat.id == variantId) {
              $buttonAdd
                .find("span:last")
                .text(Shop.money.format(varinat.price));
              break;
            }
          }
        });
      }
    }
    if (flag !== "hidden" && $buttonAdd.attr("data-popup")) {
      $buttonAdd.removeClass("button__hide").removeAttr("data-popup");
    }
  }

  function addInCart() {
    if (this.classList.contains("button__hide")) return;
    // Блокировка добавления в корзину для offline-товаров
    if ($product.find(".product-card-info__offline-notice").length > 0) return;

    if ($buttonAdd.find("span:first").text() == "Перейти в корзину") {
      document.location.href = "/cart_items";
      return;
    }
    const $variant = $product.find(
      "input.checkbox-btn__input:not(.checkbox__item-hidden):checked:first",
    );
    if (!$variant.length) return;

    const variantId = $variant.val();
    if (!variantId) return;

    loaderBtn.call();
    Cart.add({
      items: {
        [variantId]: 1,
      },
    });
  }

  function selectVariant(input) {
    const variantId = input.value;
    if (!variantId) return;
    $product.find("[data-variant-select]").text(input.dataset.variantTitle);

    // Если товар только для офлайна, не обрабатываем кнопку добавления в корзину
    if ($product.find(".product-card-info__offline-notice").length > 0) return;

    if (Cart.order.getItemByID(variantId)) {
      changeButton(input.closest("label.checkbox-btn__label"), "inCart");
    } else {
      const isPreorder = input.dataset.productPreorder === "true";
      const isSoon = input.dataset.productSoon === "true";
      const isAvailable = input.dataset.productAvailable === "true";
      changeButton(
        input.closest("label.checkbox-btn__label"),
        isAvailable
          ? "available"
          : isPreorder && !isSoon
            ? "preorder"
            : "hidden",
        variantId,
      );
    }
    $titleLast.attr("hidden", input.dataset.variantLast === "false");
  }

  // Дата для оплаты Долями и Сплайтом
  function getDataForPayments(count) {
    let dataNew = new Date();

    return Array.from({ length: count }, (_) => {
      dataNew.setDate(dataNew.getDate() + 14);
      return dataNew
        .toLocaleString("ru", {
          month: "short",
          day: "numeric",
        })
        .replace(".", "");
    });
  }

  function setPaymentsSteps($blocks, data, maxCount = 4) {
    let i = 0;

    for (const span of $blocks.find(
      ".popup__parts-steps-item-text span:not(:first)",
    )) {
      if (i >= maxCount) break;
      span.innerHTML = data[i] + span.innerHTML;
      i++;
    }
  }

  function setPayments() {
    const $parts = $("#popup-parts");
    const $plait = $("#popup-plait");
    // const dataNew = new Date( $parts.attr("data-date-order") ?? "" );
    // if (!dataNew) return;

    const data = getDataForPayments(4);

    for (const $block of [$parts, $plait]) {
      setPaymentsSteps($block, data, 4);
    }
  }

  function changePlait() {
    if (this.classList.contains("_active")) return;

    const btn = this.parentElement.querySelector("button._active");
    if (!btn) return;

    const count = btn.getAttribute("data-payplait-four") === null ? 4 : 6;

    this.classList.add("_active");
    btn.classList.remove("_active");

    const $btns =
      this.parentElement.getAttribute("data-payments-popup") === null
        ? $("[data-payments-popup]:first")
        : $("[data-payments-card]:first");

    const $btnActive = $btns.find("._active");
    $btns.find(":not(._active)").addClass("_active");
    $btnActive.removeClass("_active");

    const $body =
      this.parentElement.getAttribute("data-payments-popup") === null
        ? $btns.closest(".popup__body")
        : $(this.closest(".popup__body"));

    if (count == 4) {
      $body
        .find(".popup__plait-steps:first")
        .removeClass("_active")
        .children()
        .slice(-2)
        .addClass("_steps-hidden");
    } else {
      const price = Number($body.attr("data-plait-price") ?? "0");

      $body
        .find(".popup__plait-steps:first")
        .addClass("_active")
        .find("> ._steps-hidden")
        .removeClass("_steps-hidden");

      if (!isNaN(price)) {
        $body
          .find(".popup__plait-price_6:first .popup__parts-steps-item-price")
          .text(Shop.money.format((price - price / 4) / 5));
      }
    }
    // setPaymentsSteps($body, getDataForPayments(count), count);
  }

  EventBus.subscribe("eventLoader", function () {
    loaderBtn = new EM_Module.Loader($buttonAdd);

    const color = new EM_Module.Colors($product, "product");
    const variantId = $product
      .find("[data-first-variant]:first")
      .attr("data-first-variant");

    if (!variantId) {
      $product.find("[data-product-colors]:first").attr("hidden", true);
      return;
    }
    color.draw(variantId);
  });

  EventBus.subscribe("update_items:insales:cart", function (data) {
    console.log("[Cart.Update]", data.action.method, data);
    if (
      data.action.method == "add_items" ||
      data.action.method == "delete_items"
    ) {
      for (const product of data.action.currentItems) {
        if (product.product_id == productId) {
          selectVariant(
            $product
              .find(`input[name="variant_id"][value="${product.id}"]`)
              .get(0),
          );
          loaderBtn.hide();
          break;
        }
      }
    }
  });

  EventBus.subscribe("update_variant:insales:product", function (data) {
    actionVariantId = data.id;
  });

  EventBus.subscribe("init_instance:insales:product", function (data) {
    if (isInit) return;
    var index = 0;
    const timerId = setInterval(() => {
      index++;
      const input = $product
        .find(`.checkbox-btn__input[value="${actionVariantId}"]:first`)
        .get(0);

      if (input) {
        clearInterval(timerId);
        actionVariantId = 0;

        input.checked = true;
        selectVariant(input);
      }
    }, 250);

    console.log("init_instance", data);

    const productJSON = data?.action.productJSON;
    isInit = true;
    drawVariants(productJSON);
    applyOfflineOnly(productJSON);

    if (EM_Module && EM_Module.Badges._inited) {
      $product
        .find(".product-card__badges:first")
        .append(EM_Module.Badges.getBadges(productJSON));
    } else {
      EventBus.subscribe("eventLoader", () => {
        $product
          .find(".product-card__badges:first")
          .append(EM_Module.Badges.getBadges(productJSON));
      });
    }
  });

  function applyOfflineOnly(product) {
    if (!product) return;
    const isOfflineOnly = (product.characteristics || []).some(
      (c) => c.property_id == 149717105 && c.id == 923169233,
    );
    if (
      !isOfflineOnly ||
      $product.find(".product-card-info__offline-notice").length
    )
      return;

    // Бейдж
    $product
      .find(".product-card__badges:first")
      .append(
        '<span class="products-item__badge">Доступен только офлайн</span>',
      );

    // Плашка под строкой размера
    $product
      .find("[data-product-variants-list]:first")
      .after(
        '<div class="product-card-info__offline-notice" style="display:flex;align-items:flex-start;gap:8px;margin-top:12px;margin-bottom:16px;font-size:14px;line-height:1.4;">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="#A46C4A" style="flex-shrink:0;margin-top:2px;"><path d="M7.99967 1.33203C4.3237 1.33203 1.33301 4.32272 1.33301 7.9987C1.33301 11.6747 4.3237 14.6654 7.99967 14.6654C11.6757 14.6654 14.6663 11.6747 14.6663 7.9987C14.6663 4.32272 11.6757 1.33203 7.99967 1.33203ZM7.99967 2.33203C11.1352 2.33203 13.6663 4.86316 13.6663 7.9987C13.6663 11.1342 11.1352 13.6654 7.99967 13.6654C4.86414 13.6654 2.33301 11.1342 2.33301 7.9987C2.33301 4.86316 4.86414 2.33203 7.99967 2.33203ZM7.99967 4.66536C7.82286 4.66536 7.65329 4.7356 7.52827 4.86063C7.40325 4.98565 7.33301 5.15522 7.33301 5.33203C7.33301 5.50884 7.40325 5.67841 7.52827 5.80344C7.65329 5.92846 7.82286 5.9987 7.99967 5.9987C8.17649 5.9987 8.34606 5.92846 8.47108 5.80344C8.5961 5.67841 8.66634 5.50884 8.66634 5.33203C8.66634 5.15522 8.5961 4.98565 8.47108 4.86063C8.34606 4.7356 8.17649 4.66536 7.99967 4.66536ZM7.99186 6.99154C7.85937 6.99361 7.73311 7.04818 7.64083 7.14327C7.54854 7.23837 7.49777 7.3662 7.49967 7.4987V11.1654C7.49874 11.2316 7.51098 11.2974 7.53569 11.3589C7.56039 11.4204 7.59707 11.4763 7.64359 11.5235C7.69012 11.5707 7.74555 11.6082 7.80668 11.6337C7.86781 11.6593 7.93341 11.6725 7.99967 11.6725C8.06594 11.6725 8.13154 11.6593 8.19267 11.6337C8.2538 11.6082 8.30923 11.5707 8.35575 11.5235C8.40228 11.4763 8.43896 11.4204 8.46366 11.3589C8.48837 11.2974 8.50061 11.2316 8.49967 11.1654V7.4987C8.50063 7.43178 8.48815 7.36534 8.46296 7.30333C8.43777 7.24133 8.40039 7.18501 8.35304 7.13771C8.30568 7.09041 8.24931 7.05311 8.18727 7.028C8.12523 7.00289 8.05878 6.99049 7.99186 6.99154Z" fill="#A46C4A"></path></svg>' +
          "<span>Товар доступен для примерки и покупки только в офлайн-магазине</span></div>",
      );

    // Кнопки: скрываем "В корзину" и "Купить в 1 клик", показываем "На карте"
    $product.find("[data-em-select-variant]").css("display", "none");

    const $favBoc = $product.find(
      ".product-card-info__buttons .fav_boc_btns:first",
    );
    $favBoc.find(".buy-one-click").hide();
    $favBoc.find("[data-em-favorites-trigger]").css("flex", "0 0 auto");
    $favBoc.append(
      '<a class="map-link product-card-info__button btn btn_large btn_primary" href="https://yandex.ru/maps/?text=г. Новосибирск, Советская ул., дом 49" rel="noopener" target="_blank" style="flex:1 1 auto;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">На карте</a>',
    );
  }

  $product
    .find("[data-product-variants-list]")
    .on("change", 'input[name="variant_id"]', function () {
      selectVariant(this);
    });
  $buttonAdd.on("click", addInCart);

  setPayments();
  $(".btn_payment").on("click", changePlait);

  if (isMobile) {
    $product.find("[data-mob-breadcrumbs]").removeAttr("hidden");
  }
});

/**
 * [NEW] Новый попап фото
 * [NEW] Инициализация слайдеров (Swiper.js)
 */
(function () {
  var isInitPopup = false,
    gallerySwiper;

  class OptimizedImageZoomPan {
    constructor(container) {
      this.container = container;
      if (!this.container) return;

      // Определяем тип устройства
      this.isMobile = sessionStorage.getItem("isMobile") === "true";

      // Параметры зума (зависят от устройства)
      if (this.isMobile) {
        // Mobile: 2 → 5 (кнопка) → 10 (пинч)
        this.minScale = 2;
        this.midScale = 5; // При нажатии кнопки +
        this.maxScale = 10; // Максимум при пинч-зуме
      } else {
        // Desktop: 2 → 3.5 (кнопка) → 5 (двойной клик)
        this.minScale = 2;
        this.midScale = 3.5; // При нажатии кнопки +
        this.maxScale = 5; // Максимум при двойном клике
      }
      this.zoomLevel = this.midScale; // Для совместимости

      // Состояние для каждого IMG элемента
      this.imageStates = new Map();

      // Флаги состояния
      this.isPanning = false;
      this.isTouch = false;
      this.isTouching = false;
      this.lastTouchDistance = 0;
      this.lastTapTime = 0;
      this.swiperDisabled = false;

      // Координаты для панорамирования
      this.panStart = { x: 0, y: 0 };
      this.panDelta = { x: 0, y: 0 };

      // Храним обработчики для удаления
      this.eventHandlers = new Map();

      // AnimationFrame ID для отмены
      this.animFrameId = null;

      // Инициализация
      this.init();
    }

    /**
     * Инициализация - вешаем события прямо на IMG элементы
     */
    init() {
      this.container.querySelectorAll("img").forEach((img) => {
        if (this.imageStates.has(img)) return;

        this.imageStates.set(img, {
          scale: 2,
          translateX: 0,
          translateY: 0,
          isZoomed: true,
          isScrolling: false,
        });

        const handlers = {
          dblclick: (e) => this.handleDoubleClick(e, img),
          mousedown: (e) => this.handleMouseDown(e, img),
          mousemove: (e) => this.handleMouseMove(e, img),
          mouseup: () => this.handleMouseUp(img),
          mouseleave: () => this.handleMouseUp(img),
          touchstart: (e) => this.handleTouchStart(e, img),
          touchmove: (e) => this.handleTouchMove(e, img),
          touchend: (e) => this.handleTouchEnd(e, img),
          wheel: (e) => this.handleWheel(e, img),
        };

        img.addEventListener("dblclick", handlers.dblclick);
        img.addEventListener("mousedown", handlers.mousedown);
        img.addEventListener("mousemove", handlers.mousemove);
        img.addEventListener("mouseup", handlers.mouseup);
        img.addEventListener("mouseleave", handlers.mouseleave);
        img.addEventListener("touchstart", handlers.touchstart, {
          passive: false,
        });
        img.addEventListener("touchmove", handlers.touchmove, {
          passive: false,
        });
        img.addEventListener("touchend", handlers.touchend, { passive: true });
        img.addEventListener("wheel", handlers.wheel, { passive: false });

        this.eventHandlers.set(img, handlers);
        this.setImageStyle(img);
        this.applyTransform(img, false);
      });

      this.btnPlus = this.container
        .closest("#popup-gallery")
        ?.querySelector(".gallery-slider__plus");
      if (this.btnPlus) {
        this.btnPlus.innerText = "+";
        this.btnPlus.addEventListener("click", (e) => {
          this.clickBtnPlus(e);
        });
      }

      this.observeNewImages();

      const timerID = setInterval(() => {
        if (gallerySwiper) {
          clearInterval(timerID);
          gallerySwiper.on("slideChange", (e) => this.resetZoomState(e));
        }
      }, 150);
    }

    /**
     * Обновить состояние кнопки в зависимости от текущего scale
     */
    updateButtonState(img) {
      const state = this.imageStates.get(img);
      if (!state) return;

      if (this.isMobile) {
        // Mobile: "-" если scale > 2, иначе "+"
        this.btnPlus.innerText = state.scale > 2 ? "-" : "+";
      } else {
        // Desktop: зависит от точных значений scale
        if (state.scale === 2) {
          this.btnPlus.innerText = "+";
        } else if (state.scale < this.maxScale) {
          this.btnPlus.innerText = "+";
        } else {
          this.btnPlus.innerText = "-";
        }
      }
    }

    /**
     * Установка базовых стилей
     */
    setImageStyle(img) {
      img.style.cursor = "grab";
      img.style.userSelect = "none";
      // img.style.WebkitUserSelect = 'none';
      // img.style.WebkitTouchCallout = 'none';
      img.style.touchAction = "none";
      img.style.transformOrigin = "center center";
      img.style.willChange = "transform";
      img.style.backfaceVisibility = "hidden";
      img.style.WebkitBackfaceVisibility = "hidden";
      img.style.contain = "paint";
      img.style.display = "block";
    }

    /**
     * Получить координаты центра камеры (центра экрана) в координатах изображения
     */
    getCameraCenter(img) {
      const state = this.imageStates.get(img);
      const container = img.parentElement;
      const containerRect = container.getBoundingClientRect();

      // Центр экрана в координатах контейнера (0, 0)
      const centerX = 0;
      const centerY = 0;

      // Преобразуем координаты экрана в координаты изображения
      // Если картинка трансформирована: translate(X, Y) scale(S)
      // То координаты экрана в координаты изображения: (screenX - translateX) / scale
      const imageX = (centerX - state.translateX) / state.scale + img.width / 2;
      const imageY =
        (centerY - state.translateY) / state.scale + img.height / 2;

      return { x: imageX, y: imageY };
    }

    /**
     * Вычислить смещение при зуме в точку на изображении
     */
    getTranslateForZoom(img, targetScale, imagePointX, imagePointY) {
      const containerRect = img.parentElement.getBoundingClientRect();

      // Нам нужно, чтобы точка (imagePointX, imagePointY) из изображения
      // была в центре экрана (0, 0) при новом масштабе targetScale
      const newTranslateX = -(imagePointX - img.width / 2) * targetScale;
      const newTranslateY = -(imagePointY - img.height / 2) * targetScale;

      return { translateX: newTranslateX, translateY: newTranslateY };
    }

    // Кнопка Увеличить / уменьшить
    clickBtnPlus(e) {
      const img = this.container.querySelector(".swiper-slide-active img");
      if (!img) return;
      const state = this.imageStates.get(img);

      // Запомнить текущий центр камеры в координатах изображения
      const cameraCenter = this.getCameraCenter(img);

      if (this.isMobile) {
        // Mobile: простое переключение 2x ↔ 5x
        if (state.scale === 2) {
          this.btnPlus.innerText = "-";
          const newScale = this.midScale; // 2x → 5x

          const newTranslate = this.getTranslateForZoom(
            img,
            newScale,
            cameraCenter.x,
            cameraCenter.y,
          );
          state.scale = newScale;
          state.translateX = newTranslate.translateX;
          state.translateY = newTranslate.translateY;

          state.isZoomed = true;
          this.clampTranslate(img);
          this.disableSwiperIfNeeded(img);
        } else {
          // Любой scale > 2 возвращает в 2x
          this.btnPlus.innerText = "+";
          const newScale = 2;

          const newTranslate = this.getTranslateForZoom(
            img,
            newScale,
            cameraCenter.x,
            cameraCenter.y,
          );
          state.scale = newScale;
          state.translateX = newTranslate.translateX;
          state.translateY = newTranslate.translateY;

          state.isZoomed = false;
          state.isScrolling = false;
          this.clampTranslate(img);
        }
      } else {
        // Desktop: три этапа через кнопку
        if (state.scale === 2) {
          // 2x → 3.5x
          this.btnPlus.innerText = "+";
          const newScale = this.midScale;

          const newTranslate = this.getTranslateForZoom(
            img,
            newScale,
            cameraCenter.x,
            cameraCenter.y,
          );
          state.scale = newScale;
          state.translateX = newTranslate.translateX;
          state.translateY = newTranslate.translateY;

          state.isZoomed = true;
          this.clampTranslate(img);
          this.disableSwiperIfNeeded(img);
        } else if (state.scale === this.midScale) {
          // 3.5x → 5x
          this.btnPlus.innerText = "-";
          const newScale = this.maxScale;

          const newTranslate = this.getTranslateForZoom(
            img,
            newScale,
            cameraCenter.x,
            cameraCenter.y,
          );
          state.scale = newScale;
          state.translateX = newTranslate.translateX;
          state.translateY = newTranslate.translateY;

          state.isZoomed = true;
          this.clampTranslate(img);
          this.disableSwiperIfNeeded(img);
        } else {
          // 5x → 2x
          this.btnPlus.innerText = "+";
          const newScale = 2;

          const newTranslate = this.getTranslateForZoom(
            img,
            newScale,
            cameraCenter.x,
            cameraCenter.y,
          );
          state.scale = newScale;
          state.translateX = newTranslate.translateX;
          state.translateY = newTranslate.translateY;

          state.isZoomed = false;
          state.isScrolling = false;
          this.clampTranslate(img);
        }
      }

      this.applyTransform(img, true);
      this.updateButtonState(img); // Обновить текст кнопки
    }

    /**
     * MutationObserver для новых IMG
     */
    observeNewImages() {
      if (!("MutationObserver" in window)) return;

      const observer = new MutationObserver(() => {
        const images = this.container.querySelectorAll("img");
        images.forEach((img) => {
          if (!this.imageStates.has(img)) {
            this.imageStates.set(img, {
              scale: 2,
              translateX: 0,
              translateY: 0,
              isZoomed: true,
              isScrolling: false,
            });

            const handlers = {
              dblclick: (e) => this.handleDoubleClick(e, img),
              mousedown: (e) => this.handleMouseDown(e, img),
              mousemove: (e) => this.handleMouseMove(e, img),
              mouseup: () => this.handleMouseUp(img),
              mouseleave: () => this.handleMouseUp(img),
              touchstart: (e) => this.handleTouchStart(e, img),
              touchmove: (e) => this.handleTouchMove(e, img),
              touchend: (e) => this.handleTouchEnd(e, img),
              wheel: (e) => this.handleWheel(e, img),
            };

            img.addEventListener("dblclick", handlers.dblclick);
            img.addEventListener("mousedown", handlers.mousedown);
            img.addEventListener("mousemove", handlers.mousemove);
            img.addEventListener("mouseup", handlers.mouseup);
            img.addEventListener("mouseleave", handlers.mouseleave);
            img.addEventListener("touchstart", handlers.touchstart, {
              passive: false,
            });
            img.addEventListener("touchmove", handlers.touchmove, {
              passive: false,
            });
            img.addEventListener("touchend", handlers.touchend, {
              passive: true,
            });
            img.addEventListener("wheel", handlers.wheel, { passive: false });

            this.eventHandlers.set(img, handlers);
            this.setImageStyle(img);
            this.applyTransform(img, false);
          }
        });
      });

      observer.observe(this.container, {
        childList: true,
        subtree: true,
      });
    }

    /**
     * Блокировка Swiper при панорамировании
     */
    disableSwiperIfNeeded(img) {
      const state = this.imageStates.get(img);

      // Блокируем Swiper если фото зумировано
      if (state && state.scale > 1 && gallerySwiper && !this.swiperDisabled) {
        gallerySwiper.allowTouchMove = false;
        this.swiperDisabled = true;
      }
    }

    /**
     * Разблокировка Swiper когда панорамирование завершено
     */
    enableSwiperIfNeeded(img) {
      const state = this.imageStates.get(img);

      // Разблокируем Swiper если фото вернулось в нормальное состояние
      if (state && state.scale === 1 && gallerySwiper && this.swiperDisabled) {
        gallerySwiper.allowTouchMove = true;
        this.swiperDisabled = false;
      }
    }

    /**
     * Вычисляем максимальные границы для панорамирования
     */
    calculateBounds(img) {
      const state = this.imageStates.get(img);

      // Получаем размеры видимой области (контейнер)
      const container = img.parentElement;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Получаем размеры изображения
      const imgWidth = img.width;
      // const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.height;
      // const imgHeight = img.naturalHeight || img.height;

      // Масштабированные размеры
      const scaledWidth = imgWidth * state.scale;
      const scaledHeight = imgHeight * state.scale;

      // Максимальное смещение (чтобы изображение не выходило за границы)
      const maxTranslateX = Math.max(
        0,
        scaledWidth / 2 - window.innerWidth / 2,
      );
      const maxTranslateY = Math.max(
        0,
        scaledHeight / 2 - window.innerHeight / 2,
      );

      return {
        maxTranslateX,
        maxTranslateY,
        scaledWidth,
        scaledHeight,
        containerWidth,
        containerHeight,
      };
    }

    /**
     * Ограничиваем перемещение в пределах границ
     */
    clampTranslate(img) {
      const state = this.imageStates.get(img);
      const bounds = this.calculateBounds(img);

      // Ограничиваем X
      state.translateX = Math.max(
        -bounds.maxTranslateX,
        Math.min(bounds.maxTranslateX, state.translateX),
      );

      // Ограничиваем Y
      state.translateY = Math.max(
        -bounds.maxTranslateY,
        Math.min(bounds.maxTranslateY, state.translateY),
      );
    }

    /**
     * Двойной клик - переключение зума
     */
    handleDoubleClick(event, img) {
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();

      const state = this.imageStates.get(img);

      // Логика двойного клика отличается для desktop и mobile
      if (this.isMobile) {
        // Mobile: простое переключение 2x ↔ 10x
        if (state.scale === 2) {
          state.scale = this.maxScale;
          this.btnPlus.innerText = "-";
        } else {
          state.scale = 2;
          this.btnPlus.innerText = "+";
        }
      } else {
        // Desktop: трехэтапное переключение 2x → 3.5x → 5x → 2x
        if (state.scale === 2) {
          state.scale = this.midScale; // 2x → 3.5x
          this.btnPlus.innerText = "+";
        } else if (state.scale === this.midScale) {
          state.scale = this.maxScale; // 3.5x → 5x
          this.btnPlus.innerText = "-";
        } else {
          state.scale = 2; // 5x → 2x
          this.btnPlus.innerText = "+";
        }
      }

      state.isZoomed = state.scale > 2;

      if (event.offsetX !== undefined) {
        this.positionCursorZoom(img, {
          clientX: event.offsetX,
          clientY: event.offsetY,
        });
      }
      this.clampTranslate(img);

      if (state.scale > 2) {
        this.disableSwiperIfNeeded(img);
      }

      state.isScrolling = false;

      this.applyTransform(img, true);
      this.updateButtonState(img); // Обновить текст кнопки
    }

    /**
     * Центрируем зум
     */
    centerZoom(img) {
      const state = this.imageStates.get(img);
      state.translateX = 0;
      state.translateY = 0;
    }

    /**
     * Позиция зума в клик
     */
    positionCursorZoom(img, pos) {
      const state = this.imageStates.get(img);

      state.translateX = (img.width / 2 - pos.clientX) * state.scale;
      state.translateY = (img.height / 2 - pos.clientY) * state.scale;
    }

    /**
     * Mouse down - начало панорамирования/скролла
     */
    handleMouseDown(event, img) {
      const state = this.imageStates.get(img);

      event.preventDefault();
      event.stopPropagation();

      this.isPanning = true;
      this.panStart = {
        x: event.clientX,
        y: event.clientY,
      };
      this.panDelta = { x: 0, y: 0 };

      // Если есть зум - панорамирование, если нет - скролл
      if (state.scale > 1) {
        state.isScrolling = false;
        this.disableSwiperIfNeeded(img);
        img.style.cursor = "grabbing";
      } else {
        state.isScrolling = true; // Режим скролла БЕЗ зума
      }

      // Отменяем предыдущий анимейшн фрейм
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }
    }

    /**
     * Mouse move - панорамирование/скролл
     */
    handleMouseMove(event, img) {
      if (!this.isPanning) return;

      const state = this.imageStates.get(img);

      const deltaX = event.clientX - this.panStart.x;
      const deltaY = event.clientY - this.panStart.y;

      this.panDelta = { x: deltaX, y: deltaY };

      // Используем requestAnimationFrame для плавной анимации
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }

      this.animFrameId = requestAnimationFrame(() => {
        if (state.scale > 1) {
          // РЕЖИМ ПАНОРАМИРОВАНИЯ (при зуме)
          // БЕЗ ограничений - можно двигать фото по всей площади
          state.translateX += this.panDelta.x;
          state.translateY += this.panDelta.y;

          this.clampTranslate(img);

          this.panStart = {
            x: event.clientX,
            y: event.clientY,
          };

          this.applyTransform(img, false);
        } else if (state.isScrolling) {
          // РЕЖИМ СКРОЛЛА (без зума)
          // Можно скролить БЕЗ увеличения - имитируем поведение как при скролле страницы
          state.translateX += this.panDelta.x;
          state.translateY += this.panDelta.y;

          this.clampTranslate(img);

          this.panStart = {
            x: event.clientX,
            y: event.clientY,
          };

          this.applyTransform(img, false);
        }
      });

      img.style.cursor = "grabbing";
    }

    /**
     * Mouse up - конец панорамирования
     */
    handleMouseUp(img) {
      const state = this.imageStates.get(img);

      this.isPanning = false;
      state.isScrolling = false;

      this.enableSwiperIfNeeded(img);

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }

      img.style.cursor = state.scale > 1 ? "grab" : "zoom-in";
    }

    /**
     * Wheel - скролл мышью при зуме
     */
    handleWheel(event, img) {
      const state = this.imageStates.get(img);

      if (state.scale <= 1) return; // Только при зуме

      event.preventDefault();
      event.stopPropagation();

      const deltaX = event.deltaX;
      const deltaY = event.deltaY;

      // Берем из ScrollUp/Down и преобразуем в панорамирование
      state.translateX -= deltaX;
      state.translateY -= deltaY;

      this.clampTranslate(img);
      this.applyTransform(img, false);
    }

    /**
     * Touch start
     */
    handleTouchStart(event, img) {
      const state = this.imageStates.get(img);

      // Пинч-зум (два пальца)
      if (event.touches.length === 2) {
        event.preventDefault();
        this.isTouch = true;
        this.isTouching = true;
        this.lastTouchDistance = this.getTouchDistance(event.touches);
        this.disableSwiperIfNeeded(img);

        if (this.animFrameId) {
          cancelAnimationFrame(this.animFrameId);
        }
      }
      // Двойной тап или одиночный тап
      else if (event.touches.length === 1) {
        this.isTouching = true;
        const now = Date.now();

        if (this.lastTapTime && now - this.lastTapTime < 300) {
          // Двойной тап
          this.handleDoubleClick(event, img);
          this.lastTapTime = 0;
          return;
        }

        this.lastTapTime = now;

        // Начало панорамирования/скролла
        this.panStart = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        this.panDelta = { x: 0, y: 0 };

        if (state.scale > 1) {
          state.isScrolling = false;
          this.disableSwiperIfNeeded(img);
        } else {
          state.isScrolling = true; // Режим скролла БЕЗ зума на мобильных
        }
      }
    }

    /**
     * Touch move
     */
    handleTouchMove(event, img) {
      const state = this.imageStates.get(img);

      // Пинч-зум (два пальца)
      if (event.touches.length === 2 && this.isTouch) {
        event.preventDefault();
        event.stopPropagation();

        const currentDistance = this.getTouchDistance(event.touches);
        const scale = currentDistance / this.lastTouchDistance;
        const newScale = Math.max(
          this.minScale,
          Math.min(this.maxScale, state.scale * scale),
        );

        if (Math.abs(newScale - state.scale) > 0.01) {
          state.scale = newScale;
          this.clampTranslate(img);
          this.applyTransform(img, false);
          this.updateButtonState(img); // Обновить кнопку при пинч-зуме
        }

        this.lastTouchDistance = currentDistance;
      }
      // Панорамирование/скролл при одном пальце
      else if (event.touches.length === 1) {
        if (state.scale > 1) {
          event.preventDefault();
          event.stopPropagation();
        }

        const deltaX = event.touches[0].clientX - this.panStart.x;
        const deltaY = event.touches[0].clientY - this.panStart.y;

        // Используем requestAnimationFrame для оптимизации
        if (!this.animFrameId) {
          this.animFrameId = requestAnimationFrame(() => {
            if (state.scale > 1) {
              state.translateX += deltaX;
              state.translateY += deltaY;

              this.clampTranslate(img);

              this.panStart = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY,
              };

              this.applyTransform(img, false);
            }

            this.animFrameId = null;
          });
        }
      }
    }

    /**
     * Touch end
     */
    handleTouchEnd(event, img) {
      const state = this.imageStates.get(img);

      if (event.touches.length < 2) {
        this.isTouch = false;
      }

      this.isTouching = false;

      // Сбрасываем скролл при возврате к нормальному размеру
      if (state.scale === 1) {
        state.isScrolling = false;
      }

      this.enableSwiperIfNeeded(img);

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }

    // Поставить на паузу / запустить видео
    handlePopupVideoPlay(e) {
      if (!e.slides || !e.slides.length) return;

      // e.preventDefault();
      // e.stopPropagation();

      try {
        const slideActive = e.slides[e.activeIndex].querySelector(
          ".popup__gallery-video",
        );
        const slidePrev = e.slides[e.previousIndex].querySelector(
          ".popup__gallery-video",
        );

        if (
          slideActive &&
          slideActive.getAttribute("data-em-video") !== null &&
          slideActive.paused
        ) {
          slideActive.play().catch((error) => {
            console.warn("[VIDEO] Popup video play failed:", error);
          });
        }
        if (
          slidePrev &&
          slidePrev.getAttribute("data-em-video") !== null &&
          !slidePrev.paused
        ) {
          setTimeout(() => {
            slidePrev.pause();
          }, 150);
        }
      } catch (err) {
        console.warn("[VIDEO] Ошибка запуска / паузы видео:", err);
      }
    }

    /**
     * Расстояние между касаниями
     */
    getTouchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Применение трансформации (оптимизированная версия)
     */
    applyTransform(img, smooth = false) {
      const state = this.imageStates.get(img);
      const transform = `translate3d(${state.translateX}px, ${state.translateY}px, 0) scale(${state.scale})`;

      img.style.transform = transform;
      img.style.WebkitTransform = transform;

      // Плавный переход только при необходимости
      if (smooth) {
        img.style.transition = "transform 0.3s ease-in-out";
      } else {
        img.style.transition = "none";
      }
    }

    /**
     * Сброс зума при смене слайда
     */
    resetZoomState(e) {
      // Поставить на паузу / запустить видео
      this.handlePopupVideoPlay(e);

      const img = e.clickedSlide?.querySelector("img");

      if (!img) return;

      const state = this.imageStates.get(img);

      this.btnPlus.innerText = "+";
      state.scale = 2;
      state.translateX = 0;
      state.translateY = this.getTopImgY(img);
      this.clampTranslate(img);

      state.isZoomed = true;
      state.isScrolling = false;

      this.applyTransform(img, true);
      this.updateButtonState(img); // Обновить текст кнопки

      // Убедимся что Swiper включен при смене слайда
      if (gallerySwiper && this.swiperDisabled) {
        gallerySwiper.allowTouchMove = true;
        this.swiperDisabled = false;
      }
    }

    /**
     * Удаление всех обработчиков
     */
    destroy() {
      this.eventHandlers.forEach((handlers, img) => {
        img.removeEventListener("dblclick", handlers.dblclick);
        img.removeEventListener("mousedown", handlers.mousedown);
        img.removeEventListener("mousemove", handlers.mousemove);
        img.removeEventListener("mouseup", handlers.mouseup);
        img.removeEventListener("mouseleave", handlers.mouseleave);
        img.removeEventListener("touchstart", handlers.touchstart);
        img.removeEventListener("touchmove", handlers.touchmove);
        img.removeEventListener("touchend", handlers.touchend);
        img.removeEventListener("wheel", handlers.wheel);
      });

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }
      if (gallerySwiper && this.swiperDisabled) {
        gallerySwiper.allowTouchMove = true;
        this.swiperDisabled = false;
      }

      this.eventHandlers.clear();
      this.imageStates.clear();
    }

    /**
     * Получить состояние
     */
    getState(img) {
      return this.imageStates.get(img) || null;
    }

    /**
     * Получить расстояние до вверха изображения
     */
    getTopImgY(img) {
      const containerRect = img.parentElement.getBoundingClientRect();
      const scaledHeight = img.height * this.imageStates.get(img).scale;

      return Math.max(0, (scaledHeight - containerRect.height / 2) / 2 - 10);
    }
  }

  document.addEventListener("beforePopupOpen", function (e) {
    if (
      e.detail.popup.hash !== "#popup-gallery" &&
      e.detail.popup?.targetOpen?.element
    )
      return;

    const idImage = e.detail.popup.lastFocusEl
      ? Number(e.detail.popup.lastFocusEl.dataset.popupId)
      : 0;
    if (
      !isNaN(idImage) &&
      gallerySwiper &&
      gallerySwiper.activeIndex !== idImage - 1
    ) {
      gallerySwiper.slideTo(idImage - 1);
    }
    if (isInitPopup) return;

    const galleryList = e.detail.popup.targetOpen.element.querySelector(
      ".popup-gallery__list",
    );
    // const activeImg = galleryList?.querySelector(".swiper-slide-active img");

    if (!galleryList) return;
    isInitPopup = true;

    // Добавляем overflow: hidden на контейнер слайдов и каждый слайд
    galleryList.style.overflow = "hidden";
    galleryList.querySelectorAll(".swiper-slide").forEach((slide) => {
      slide.style.overflow = "hidden";
    });

    const zoomPan = new OptimizedImageZoomPan(galleryList);
    window.imageZoomPan = zoomPan;
  });

  // Функция активного thumb
  function setActiveThumbScale(swiper) {
    if (swiper.slides[swiper.activeIndex]) {
      swiper.slides[swiper.activeIndex].style.transform = "scale(1.2)";
    }
    swiper.slides.forEach((slide) => (slide.style.transform = "scale(1)"));
  }

  const sliderGallery = document.querySelector(
    "[data-js-slider='gallery-slider']",
  );
  if (sliderGallery) {
    const thumbsSwiper = new Swiper(
      sliderGallery.querySelector(".popup-gallery__thumbs"),
      {
        observer: true,
        observeParents: true,
        // freeMode: true,
        slidesPerView: "auto",
        spaceBetween: 8,
        slidesPerGroup: 1,
        watchSlidesProgress: true,
        slideToClickedSlide: true,
        allowTouchMove: true,
        speed: 800,
        on: {
          click: function () {
            gallerySwiper.allowTouchMove = true;
            gallerySwiper.slideTo(this.clickedIndex);
          },
        },
      },
    );

    gallerySwiper = new Swiper(
      sliderGallery.querySelector(".popup-gallery__list"),
      {
        observer: true,
        observeParents: true,
        slidesPerView: 1,
        spaceBetween: 0,
        slidesPerGroup: 1,
        allowTouchMove: true,
        // Иначе Swiper вызывает preventDefault на touchstart — iOS/Android не показывают меню «Сохранить фото»
        touchStartPreventDefault: false,
        speed: 800,
        // thumbs: {
        //     swiper: thumbsSwiper,
        // },
        navigation: {
          prevEl: sliderGallery.querySelector(".swiper-button-prev"),
          nextEl: sliderGallery.querySelector(".swiper-button-next"),
        },
        on: {
          slideChange: function () {
            thumbsSwiper.slideTo(this.activeIndex);
            setActiveThumbScale(thumbsSwiper);
          },
        },
      },
    );
  }

  const productCardGallery = document.querySelector(".product-card__gallery");
  if (productCardGallery) {
    new Swiper(productCardGallery, {
      observer: true,
      observeParents: true,
      slidesPerView: 2,
      spaceBetween: 8,
      speed: 800,
      pagination: {
        el: ".product-card__gallery-pagination",
        clickable: true,
      },
      breakpoints: {
        320: {
          slidesPerView: 1,
          spaceBetween: 8,
        },
        1023.98: {
          slidesPerView: 2,
          spaceBetween: 0,
        },
      },
      on: {
        beforeInit: function () {
          if (window.innerWidth > 1023.98) this.allowTouchMove = false;
          else this.allowTouchMove = true;
        },
        resize: function () {
          if (window.innerWidth > 1023.98) {
            this.slideTo(0);
            this.allowTouchMove = false;
          } else this.allowTouchMove = true;
        },
      },
    });
  }
})();

/**
 * [NEW] Видео в карточке товара
 */
document.addEventListener("DOMContentLoaded", function () {
  const $product = $widget;
  const VIDEO_TIMEOUT = 1500000; // Таймаут для загрузки видео

  const utils = {
    // Debounce функция для оптимизации событий
    debounce(func, wait) {
      let timeout;
      return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    },

    // Promise с таймаутом
    withTimeout(promise, ms) {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), ms),
        ),
      ]);
    },

    // Безопасная очистка видео элемента
    cleanupVideo(video) {
      try {
        if (video) {
          // Паузим видео
          if (!video.paused) {
            video.pause();
          }

          // Очищаем src для предотвращения утечек памяти
          video.removeAttribute("src");
          video.load(); // Принудительная очистка буфера
          // Удаляем все source элементы
          const sources = video.querySelectorAll("source");
          sources.forEach((source) => {
            source.removeAttribute("src");
            source.remove();
          });
        }
      } catch (error) {
        console.warn("[VIDEO] Cleanup error:", error);
      }
    },

    // Проверка мобильного устройства
    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    },

    // Проверка iOS
    isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent);
    },
  };

  // Класс для управления HLS
  class HLSManager {
    constructor(video) {
      this.video = video;
      this.hls = null;
      this.loadTimeout = null;
    }

    // Загрузка HLS с таймаутом
    async loadHLS(hlsUrl) {
      if (typeof Hls === "undefined" || !Hls.isSupported()) {
        throw new Error("HLS not supported");
      }

      return new Promise((resolve, reject) => {
        this.hls = new Hls({
          startLevel: -1,
          capLevelToPlayerSize: true,
          maxLoadingDelay: 1, // Быстрый старт
          maxBufferLength: 10,
          lowLatencyMode: true,
          // Оптимизированные настройки для быстрой загрузки
          maxMaxBufferLength: 20,
          maxBufferSize: 30 * 1000 * 1000, // 60MB
          maxBufferHole: 0.5,
        });

        // Обработка ошибок HLS
        this.hls.on(Hls.Events.ERROR, (_, data) => {
          console.warn("[VIDEO] HLS error:", data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                  reject(new Error("Manifest load failed"));
                } else {
                  // Попытка восстановления для сетевых ошибок
                  this.hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                this.hls.recoverMediaError();
                break;
              default:
                reject(new Error("Fatal HLS error: " + data.details));
                break;
            }
          }
        });

        // Успешная загрузка манифеста
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          clearTimeout(this.loadTimeout);
          resolve();
        });

        // Установка таймаута
        this.loadTimeout = setTimeout(() => {
          reject(new Error("HLS load timeout"));
        }, VIDEO_TIMEOUT);

        try {
          this.hls.loadSource(hlsUrl);
          this.hls.attachMedia(this.video);
        } catch (error) {
          clearTimeout(this.loadTimeout);
          reject(error);
        }
      });
    }

    // Очистка HLS ресурсов
    destroy() {
      if (this.loadTimeout) {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = null;
      }
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
    }
  }

  // Основная функция загрузки видео
  async function LoadVideo(video, controls = false) {
    const scr = video.getAttribute("data-em-video");
    if (!scr) {
      console.warn("[VIDEO] No data-em-video attribute found");
      return;
    }
    var loaderVideo;
    const hlsUrl = `${scr}.m3u8`;
    // const hlsUrl = `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`; // Тестовое видео
    const mp4Url = `${scr}.mp4`;
    const video_i = video.getAttribute("data-video-i") ?? 0;

    var hlsManager = null;
    var loadSuccess = false;

    const loadMP4 = () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("MP4 load timeout"));
        }, VIDEO_TIMEOUT);

        const onCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          resolve();
        };

        const onError = (error) => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          reject(new Error("MP4 load error: " + error.message));
        };

        video.addEventListener("canplay", onCanPlay, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.src = mp4Url;
      });
    };

    if (!controls) {
      video.loop = true;
      video.volume = 0;
      loaderVideo = new EM_Module.Loader($(video.parentElement));
      loaderVideo.call();
    }
    try {
      // Проверка нативной поддержки HLS (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        console.log("[VIDEO] Using native HLS support");
        await utils.withTimeout(
          new Promise((resolve, reject) => {
            const onCanPlay = () => {
              video.removeEventListener("canplay", onCanPlay);
              video.removeEventListener("error", onError);
              resolve();
            };

            const onError = (error) => {
              video.removeEventListener("canplay", onCanPlay);
              video.removeEventListener("error", onError);
              reject(error);
            };

            video.addEventListener("canplay", onCanPlay, { once: true });
            video.addEventListener("error", onError, { once: true });
            video.src = hlsUrl;
          }),
          VIDEO_TIMEOUT,
        );
        loadSuccess = true;
      }
      // HLS.js поддержка
      else if (typeof Hls !== "undefined" && Hls.isSupported()) {
        console.log("[VIDEO] Using HLS.js");
        hlsManager = new HLSManager(video);
        await hlsManager.loadHLS(hlsUrl);
        loadSuccess = true;
      }
      // Fallback на MP4
      else {
        console.log("[VIDEO] No HLS support, using MP4");
        await loadMP4();

        loadSuccess = true;
      }
    } catch (error) {
      console.warn(
        "[VIDEO] Primary load failed, trying MP4 fallback:",
        error.message,
      );

      // Очистка предыдущих попыток
      if (hlsManager) {
        hlsManager.destroy();
        hlsManager = null;
      }

      try {
        await loadMP4();
        loadSuccess = true;
        console.log("[VIDEO] MP4 fallback successful");
      } catch (mp4Error) {
        console.error("[VIDEO] All loading attempts failed:", mp4Error.message);
        if (loaderVideo) loaderVideo.hide();

        // Выходим, если ничего не получилось
        return;
      }
    }

    if (!loadSuccess) {
      if (loaderVideo) loaderVideo.hide();
      return;
    }

    // Настройка основных свойств видео
    video.controls = controls;

    if (!controls) {
      // Принудительная попытка воспроизведения с обработкой ошибок
      setTimeout(async () => {
        try {
          console.log("[VIDEO] Autoplay successful");
          if (video.nextElementSibling) {
            video.nextElementSibling.setAttribute("hidden", true);
          }
          loaderVideo.hide();
          try {
            await video.play();
          } catch (err) {
            console.warn("Autoplay blocked:", err);
          }

          // $product.find(".product-card-info__title:first").append('[VIDEO] Autoplay successful');
        } catch (error) {
          // $product.find(".product-card-info__title:first").append('[VIDEO] Autoplay failed, will try on user interaction: ' + error.message);
          console.warn(
            "[VIDEO] Autoplay failed, will try on user interaction:",
            error.message,
          );

          // Добавляем обработчик для первого взаимодействия пользователя
          const playOnInteraction = () => {
            video
              .play()
              .catch((e) =>
                console.warn("[VIDEO] Play on interaction failed:", e),
              );
            document.removeEventListener("click", playOnInteraction);
            document.removeEventListener("touchstart", playOnInteraction);
          };

          document.addEventListener("click", playOnInteraction, { once: true });
          document.addEventListener("touchstart", playOnInteraction, {
            once: true,
          });
        }
      }, 650);
    }

    // Настройка обработчиков событий
    setupVideoHandlers(video, video_i, controls, hlsManager);
  }

  // Функция настройки обработчиков событий
  function setupVideoHandlers(video, video_i, controls, hlsManager) {
    var isPaused = false;
    // let observer = null;

    // Обработчики для видео в карточке товара
    if (!controls) {
      const videoPopup = $product
        .find(`.popup-gallery video[data-video-i="${video_i}"]:first`)
        .get(0);

      // Клик по видео в карточке
      const handleCardVideoClick = () => {
        if (!video.paused) {
          video.pause();
        }

        if (videoPopup) {
          videoPopup.currentTime = video.currentTime;
          videoPopup.muted = false;
          if (videoPopup.paused) {
            videoPopup.play().catch((error) => {
              console.warn("[VIDEO] Popup video play failed:", error);
            });
          }
        }
      };

      // Добавляем обработчики событий для мобильных и десктопных устройств
      video.addEventListener("click", handleCardVideoClick);

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.intersectionRatio < 0.4 && !video.paused) {
              video.pause();
              isPaused = true;
            } else if (isPaused && entry.intersectionRatio >= 0.4) {
              video.play().catch((error) => {
                console.warn("[VIDEO] Auto-play failed:", error);
              });
              isPaused = false;
            }
          });
        },
        { threshold: 0.4 },
      );
      observer.observe(video);
    }
    // Обработчики для видео в попапе
    else {
      const videoProduct = $product
        .find(`.product-card video[data-video-i="${video_i}"]:first`)
        .get(0);

      const handlePopupVideoClick = (e) => {
        console.log("[VIDEO] Popup video clicked/touched");

        // Останавливаем всплытие события для предотвращения конфликтов
        e.preventDefault();
        e.stopPropagation();

        if (!video.paused) {
          video.muted = true;
          setTimeout(() => {
            video.pause();
          }, 150);
        }

        if (videoProduct) {
          videoProduct.currentTime = video.currentTime;
          if (videoProduct.paused) {
            setTimeout(() => {
              videoProduct.play().catch((error) => {
                console.warn("[VIDEO] Product video play failed:", error);
              });
            }, 150);
          }
        }

        // Закрытие попапа
        const popupBody = e.target.closest(".popup__body");
        if (popupBody) {
          setTimeout(() => {
            popupBody.click();
          }, 150);
        }
      };

      // Добавляем обработчики для всех типов устройств
      video.addEventListener("click", handlePopupVideoClick);
      video.addEventListener("touchstart", handlePopupVideoClick);

      document.addEventListener("afterPopupClose", function (e) {
        if (!e.detail.popup.hash === "#popup-gallery") return;
        if (!video.paused) {
          video.muted = true;
          setTimeout(() => {
            video.pause();
          }, 150);
        }
        if (videoProduct) {
          videoProduct.currentTime = video.currentTime;
          if (videoProduct.paused) {
            setTimeout(() => {
              videoProduct.play().catch((error) => {
                console.warn("[VIDEO] Product video play failed:", error);
              });
            }, 150);
          }
        }
      });
    }

    // Логирование событий (можно убрать в продакшене)
    /*
        video.addEventListener('play', () => {
            console.log("[VIDEO]", video.classList, "play");
            // $product.find(".product-card-info__price:first").append("<div>[VIDEO] " +  video.classList + " play</div>");
        }, DEBOUNCE_DELAY);

        video.addEventListener('pause', () => {
            console.log("[VIDEO]", video.classList, "pause");
        }, DEBOUNCE_DELAY);
        */
  }

  // Инициализация всех видео на странице
  const initializeAllVideos = () => {
    const videos = $product.find("[data-em-video]");
    console.log(`[VIDEO] Initializing ${videos.length} videos`);

    videos.each((_, video) => {
      const hasControls =
        video.getAttribute("data-em-video-controls") === "true";
      LoadVideo(video, hasControls);
    });
  };

  // Запуск инициализации
  EventBus.subscribe("eventLoader", initializeAllVideos);

  // Экспорт функций для внешнего использования
  // window.VideoManager = {
  //     LoadVideo,
  //     cleanupVideo: utils.cleanupVideo,
  //     reinitialize: initializeAllVideos,
  //     isMobile: utils.isMobile,
  //     isIOS: utils.isIOS
  // };
});
