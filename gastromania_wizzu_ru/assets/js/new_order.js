(function () {
  "use strict";

  const CONFIG = {
    DEBUG: false, // false в продакшене

    PAYMENT_SBP: 12350201, // СБП (Онлайн-оплата)
    PAYMENT_COD: 12036633, // Наличными курьеру

    DELIVERY_TITLE_MAP: {},
    ADDRESS_HEADING_MAP: {
      Доставка: "Адрес доставки",
    },

    ADDRESS_PLACEHOLDER:
      "в поле Найти укажите улицу и номер дома на карте выше",
    ADDRESS_POLL_MS: 700,
    DEBOUNCE_MS: 300,

    DOOR_STORAGE_KEY: "cheked-door",
    PRODUCT_UNAVAILABLE_COOKIE: "em_product-unavailable",

    PHONE_MIN_DIGITS: 11,
    EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  };

  const log = (...a) => CONFIG.DEBUG && console.log("[EM_order]", ...a);
  const warn = (...a) => CONFIG.DEBUG && console.warn("[EM_order]", ...a);
  const err = (...a) => console.error("[EM_order]", ...a);

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  const getCookieSafe = (name) => {
    try {
      return typeof Cookies !== "undefined" ? Cookies.get(name) : null;
    } catch (e) {
      return null;
    }
  };

  const doorHTML = (isDoor) => `
    <div class="order__delivery-door co-input--radio">
      <label for="door-radio_gates" class="order__door-item ${isDoor ? "" : "checked-label"}">
        <span class="order__door-radio">
          <input class="order__door-input" type="radio" id="door-radio_gates" name="custom[door]" value="false" ${isDoor ? "" : "checked"} hidden>
          <span></span>
        </span>
        <div class="order__door-item__title">Оставить у ворот</div>
      </label>
      <label for="door-radio_door" class="order__door-item ${isDoor ? "checked-label" : ""}">
        <span class="order__door-radio">
          <input class="order__door-input" type="radio" id="door-radio_door" name="custom[door]" value="true" ${isDoor ? "checked" : ""} hidden>
          <span></span>
        </span>
        <div class="order__door-item__title">Поднять до двери</div>
      </label>
    </div>`;

  const floorWarningHTML = () => `
    <div class="order__floor-warning co-input co-input--text" hidden>
      <div class="order__floor-warning-title">А у вас лифт работает?</div>
      <div class="order__floor-warning-text">Если нет, то пеший подъем заказа выше 5-го стоит 40₽ за каждый этаж</div>
    </div>`;

  const deliveryMessageHTML = (isHidden) => `
    <div class="order_message-delivery" ${isHidden ? "hidden" : ""} id="em_message-delivery">
      <div class="co-input-label">Что нужно знать о доставке?</div>
      <div class="order_message-list">
        <div class="order_message-item">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.33497 16.223C8.21997 16.223 9.47247 15.6005 10.4625 12.623L11.0025 11.003L12.6225 10.463C15.5925 9.47298 16.215 8.22048 16.215 7.33548C16.215 6.45798 15.5925 5.19798 12.6225 4.20048L6.25497 2.07798C4.66497 1.54548 3.33747 1.70298 2.51997 2.51298C1.70247 3.32298 1.54497 4.65798 2.07747 6.24798L4.19997 12.6155C5.19747 15.6005 6.44997 16.223 7.33497 16.223ZM12.27 5.27298C14.355 5.97048 15.0975 6.79548 15.0975 7.33548C15.0975 7.87548 14.355 8.70048 12.27 9.39048L10.38 10.0205C10.215 10.073 10.08 10.208 10.0275 10.373L9.39747 12.263C8.70747 14.348 7.87497 15.0905 7.33497 15.0905C6.79497 15.0905 5.96997 14.348 5.27247 12.263L3.14997 5.89548C2.76747 4.74048 2.83497 3.79548 3.32247 3.30798C3.80997 2.82048 4.75497 2.76048 5.90247 3.14298L12.27 5.27298Z" fill="#646464"/><path d="M10.4174 10.8C10.5599 10.8 10.7024 10.7475 10.8149 10.635C11.0324 10.4175 11.0324 10.0575 10.8149 9.84L8.1299 7.1475C7.9124 6.93 7.5524 6.93 7.3349 7.1475C7.1174 7.365 7.1174 7.725 7.3349 7.9425L10.0199 10.635C10.1249 10.7475 10.2749 10.8 10.4174 10.8Z" fill="#646464"/></svg>
          <p>Ниже приведена карта с зонами доставки. Нажмите кнопку <strong>Найти</strong> и появится поисковая строка. В ней <strong>укажите вашу улицу и номер дома</strong></p>
        </div>
        <div class="order_message-item">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 17.0628C6 17.0628 3.5625 14.9103 3.5625 12.2628V9.48779C3.5625 9.18029 3.8175 8.92529 4.125 8.92529C4.4325 8.92529 4.6875 9.18029 4.6875 9.48779C4.6875 11.4528 6.54 12.9378 9 12.9378C11.46 12.9378 13.3125 11.4528 13.3125 9.48779C13.3125 9.18029 13.5675 8.92529 13.875 8.92529C14.1825 8.92529 14.4375 9.18029 14.4375 9.48779V12.2628C14.4375 14.9103 12 17.0628 9 17.0628ZM4.6875 12.3453C4.74 14.3328 6.6525 15.9378 9 15.9378C11.3475 15.9378 13.26 14.3328 13.3125 12.3453C12.3375 13.4028 10.7925 14.0628 9 14.0628C7.2075 14.0628 5.67 13.4028 4.6875 12.3453Z" fill="#646464"/><path d="M9 10.3125C6.93 10.3125 5.06999 9.3825 4.16249 7.8825C3.77249 7.245 3.5625 6.5025 3.5625 5.7375C3.5625 4.4475 4.14 3.2325 5.1825 2.3175C6.2025 1.425 7.56 0.9375 9 0.9375C10.44 0.9375 11.79 1.425 12.8175 2.31C13.86 3.2325 14.4375 4.4475 14.4375 5.7375C14.4375 6.5025 14.2275 7.2375 13.8375 7.8825C12.93 9.3825 11.07 10.3125 9 10.3125ZM9 2.0625C7.83 2.0625 6.73501 2.4525 5.91751 3.1725C5.12251 3.8625 4.6875 4.7775 4.6875 5.7375C4.6875 6.3 4.83749 6.825 5.12249 7.2975C5.83499 8.4675 7.32 9.1875 9 9.1875C10.68 9.1875 12.165 8.46 12.8775 7.2975C13.17 6.825 13.3125 6.3 13.3125 5.7375C13.3125 4.7775 12.8775 3.8625 12.075 3.1575C11.2575 2.4525 10.17 2.0625 9 2.0625Z" fill="#646464"/><path d="M9 14.0625C5.9025 14.0625 3.5625 12.0975 3.5625 9.4875V5.7375C3.5625 3.09 6 0.9375 9 0.9375C10.44 0.9375 11.79 1.425 12.8175 2.31C13.86 3.2325 14.4375 4.4475 14.4375 5.7375V9.4875C14.4375 12.0975 12.0975 14.0625 9 14.0625ZM9 2.0625C6.6225 2.0625 4.6875 3.7125 4.6875 5.7375V9.4875C4.6875 11.4525 6.54 12.9375 9 12.9375C11.46 12.9375 13.3125 11.4525 13.3125 9.4875V5.7375C13.3125 4.7775 12.8775 3.8625 12.075 3.1575C11.2575 2.4525 10.17 2.0625 9 2.0625Z" fill="#646464"/></svg>
          <p>Автоматически будет рассчитана <strong>стоимость и зона доставки</strong>, к которой относится ваш адрес</p>
        </div>
        <div class="order_message-item">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.00001 17.07C7.89001 17.07 6.77251 16.65 5.90251 15.8175C3.69001 13.6875 1.24501 10.29 2.16751 6.2475C3.00001 2.58 6.20251 0.9375 9.00001 0.9375C9.00001 0.9375 9.00001 0.9375 9.00751 0.9375C11.805 0.9375 15.0075 2.58 15.84 6.255C16.755 10.2975 14.31 13.6875 12.0975 15.8175C11.2275 16.65 10.11 17.07 9.00001 17.07ZM9.00001 2.0625C6.81751 2.0625 4.01251 3.225 3.27001 6.495C2.46001 10.0275 4.68001 13.0725 6.69001 15C7.98751 16.2525 10.02 16.2525 11.3175 15C13.32 13.0725 15.54 10.0275 14.745 6.495C13.995 3.225 11.1825 2.0625 9.00001 2.0625Z" fill="#646464"/><path d="M8.06246 10.3126C7.91996 10.3126 7.77746 10.2601 7.66496 10.1476L6.53996 9.02258C6.32246 8.80508 6.32246 8.44508 6.53996 8.22758C6.75746 8.01008 7.11746 8.01008 7.33496 8.22758L8.06246 8.95508L10.665 6.35258C10.8825 6.13508 11.2425 6.13508 11.46 6.35258C11.6775 6.57008 11.6775 6.93008 11.46 7.14758L8.45996 10.1476C8.34746 10.2601 8.20496 10.3126 8.06246 10.3126Z" fill="#646464"/></svg>
          <p>Если не получается найти нужный адрес или он не попадает в зону доставки на карте, то <strong>напишите в службу поддержки</strong> по номеру, указанному в разделе Контакты</p>
        </div>
      </div>
    </div>`;

  const authBlockHTML = () => `
    <div class="section__auth">
      <a class="btn-auth" href="/client_account/contacts/new">Зарегистрироваться</a>
      <p>Создайте аккаунт, чтобы сохранить историю заказов и контактные данные, которые вам не придется повторно указывать</p>
    </div>`;

  const errorsContainerHTML = () => `
    <div class="em-validation-errors" style="background:#fff3cd;border:2px solid #ffc107;border-radius:8px;padding:15px;margin:20px 0;display:none;">
      <h4 style="margin:0 0 10px 0;color:#856404;font-size:16px;">⚠️ Исправьте ошибки перед отправкой:</h4>
      <ul id="em-errors-list" style="margin:0;padding-left:20px;color:#856404;"></ul>
    </div>`;

  document.addEventListener("DOMContentLoaded", function () {
    log("Start... (limemart)");
    const $form = $("#order_form");
    if (!$form.length) {
      warn("Форма #order_form не найдена — инициализация прекращена");
      return;
    }

    injectValidationStyles();
    initTitles($form);
    injectCustomBlocks($form);
    initDoorLogic($form);
    initAddressSync($form);
    initPaymentLogic($form);
    initServiceHandlers($form);
    initAuthBlock();
    initValidation($form);
    log("Инициализация завершена ✅");
  });

  function injectValidationStyles() {
    if (document.getElementById("em-validation-style")) return;
    $(
      "<style id='em-validation-style'>.em-invalid{border:2px solid #dc3545 !important;background-color:#fff5f5 !important;}.em-pulse{outline:3px solid #dc3545 !important;outline-offset:2px;animation:em-pulse 1s ease-in-out 2;}@keyframes em-pulse{50%{outline-color:transparent;}}</style>",
    ).appendTo("head");
  }

  function initTitles($form) {
    const fixHeadings = () => {
      $form.find(".co-title--h2").each(function () {
        const txt = this.innerText.trim();
        if (CONFIG.ADDRESS_HEADING_MAP[txt]) {
          this.innerText = CONFIG.ADDRESS_HEADING_MAP[txt];
        }
      });
    };

    const fixDeliveryTitles = () => {
      $form.find(".co-delivery_method-title").each(function () {
        const txt = this.textContent.trim();
        const replacement = CONFIG.DELIVERY_TITLE_MAP[txt];
        if (replacement) {
          this.textContent = replacement;
          log(`Заголовок доставки: "${txt}" → "${replacement}"`);
        }
      });
    };

    fixHeadings();
    fixDeliveryTitles();

    const target = document.getElementById("delivery_variants");
    if (target && "MutationObserver" in window) {
      const mo = new MutationObserver(debounce(fixDeliveryTitles, 100));
      mo.observe(target, { subtree: true, childList: true, characterData: true });
    }
    $(document).on("updated:insales:payment updated:insales:delivery", fixDeliveryTitles);
  }

  function injectCustomBlocks($form) {
    const productUnavailable = getCookieSafe(CONFIG.PRODUCT_UNAVAILABLE_COOKIE);
    $form
      .find(".co-input--product-unavailable > input.co-input-field")
      .val(
        productUnavailable === "change-on-any"
          ? "Позвонить для замены"
          : "Заменить самостоятельно",
      );

    if (!$form.find("#em-address").length) {
      const street = ($form.find("#shipping_address_street").val() || "").trim();
      const house = ($form.find("#shipping_address_house").val() || "").trim();
      const value = buildAddressValue(street, house);
      $form.find(".delivery_variants:first").after(`
        <div class="co-input co-input--required co-input--text em-input--address co-input--nested">
          <label class="co-input-label" for="em-address">Ваш адрес</label>
          <textarea class="em-text__input" name="em-address" id="em-address" autocomplete="off" readonly style="${value ? "" : "color:red;"}">${value || CONFIG.ADDRESS_PLACEHOLDER}</textarea>
        </div>`);
    }

    if (!$form.find("#em-cash-change").length) {
      $form.find(".co-payment_method-list:first").after(`
        <div class="co-input co-input--text co-input--nested em-input--cash" id="em-cash-change-wrapper" hidden>
          <label class="co-input-label" for="em-cash-change">Сумма для сдачи</label>
          <input class="co-input-field js-input-field" autocomplete="off" id="em-cash-change" name="em-cash-change" type="number" min="0" max="120000" inputmode="numeric" placeholder="Укажите '0', если сдача не требуется">
        </div>`);
    }
  }

  function initDoorLogic($form) {
    const isDoorStored = () =>
      localStorage.getItem(CONFIG.DOOR_STORAGE_KEY) === "true";

    const checkFloorWarning = () => {
      const floor = parseInt(
        $form.find(".co-input--floor:first .co-input-field").val(),
        10,
      );
      const show = isDoorStored() && !isNaN(floor) && floor > 5;
      $form.find(".order__floor-warning:first").prop("hidden", !show);
    };

    const changeOrderDoor = (isDoor) => {
      $form
        .find(
          ".co-input--entrance:first, .co-input--flat:first, .co-input--floor:first, .co-input--intercom:first",
        )
        .prop("hidden", !isDoor);
      $form.find(".order__floor-warning:first").prop("hidden", !isDoor);
      $form
        .find(".co-input--entrance")
        .css("margin-right", isDoor ? "1rem" : "0");

      if (!isDoor) {
        $form
          .find(
            ".co-input--entrance:first, .co-input--floor:first .co-input-field, .co-input--intercom:first .co-input-field, input[name='shipping_address[flat]']:first",
          )
          .val("");
      } else {
        checkFloorWarning();
      }
      $form
        .find(".co-input--type-delivery .co-input-field:first")
        .val(isDoor ? "Поднять до двери" : "Оставить у ворот");
    };

    const injectDoor = () => {
      if ($form.find(".order__delivery-door").length) return;
      if (!$form.find(".order__floor-warning:first").length) {
        $form.find(".co-input--intercom:first").after(floorWarningHTML());
      }
      const isDoor = isDoorStored();
      $form.find("#shipping_address").before(doorHTML(isDoor));
      changeOrderDoor(isDoor);
      log("Блок 'дверь/ворота' отрисован, isDoor =", isDoor);
    };

    $form.on("change", "input.order__door-input", function () {
      markChecked(this);
      const isDoor = this.value === "true";
      localStorage.setItem(CONFIG.DOOR_STORAGE_KEY, String(isDoor));
      changeOrderDoor(isDoor);
    });
    $form.on(
      "input",
      ".co-input--floor:first .co-input-field",
      checkFloorWarning,
    );

    let injected = false;
    const tryInject = () => {
      if (injected) return;
      injected = true;
      injectDoor();
    };
    $(document).on("updated:insales:payment", () => setTimeout(tryInject, 350));
    setTimeout(tryInject, 4000);
  }

  function buildAddressValue(street, house) {
    street = (street || "").trim();
    house = (house || "").trim();
    if (!street && !house) return "";
    return house ? `${street}, ${house}` : street;
  }

  function initAddressSync($form) {
    const $street = $form.find("#shipping_address_street");
    const $house = $form.find("#shipping_address_house");
    const $display = $form.find("#em-address");
    if (!$display.length) return;

    const sync = () => {
      const value = buildAddressValue($street.val(), $house.val());
      const target = value || CONFIG.ADDRESS_PLACEHOLDER;
      if ($display.val() !== target) {
        $display.val(target).css("color", value ? "" : "red");
        log("Синхронизация адреса:", target);
      }
    };

    sync();

    $street.on("input change", sync);
    $house.on("input change", sync);
    $(document).on("updated:insales:delivery selected:insales:delivery", sync);

    let lastStreet = $street.val();
    let lastHouse = $house.val();
    setInterval(() => {
      if ($street.val() !== lastStreet || $house.val() !== lastHouse) {
        lastStreet = $street.val();
        lastHouse = $house.val();
        sync();
      }
    }, CONFIG.ADDRESS_POLL_MS);

    $street
      .add($house)
      .add($display)
      .attr("readonly", true)
      .css({ "pointer-events": "none", "user-select": "none" });
  }

  function initPaymentLogic($form) {
    const $wrapper = $form.find("#em-cash-change-wrapper");
    const $cash = $form.find("#em-cash-change");
    const $storeCash = $form.find(".co-input--cash-change .co-input-field:last");
    if (!$wrapper.length) return;

    const applyState = (paymentId) => {
      const isCod = Number(paymentId) === CONFIG.PAYMENT_COD;
      $wrapper.prop("hidden", !isCod);
      if (!isCod) {
        $cash.val("").removeClass("em-invalid");
        $storeCash.val("");
      }
      log(
        "Выбран способ оплаты:",
        paymentId,
        isCod ? "(наличные — поле сдачи показано)" : "(поле сдачи скрыто)",
      );
    };

    $(document).on("selected:insales:payment", (e) => {
      applyState(e.originalEvent?.detail?.id);
    });

    $cash.on("input", function () {
      const raw = this.value.trim();
      const num = Number(raw);
      $storeCash.val(raw !== "" && !isNaN(num) && num >= 0 ? num : "");
    });

    const $checked = $form.find("input[data-payment-id]:checked");
    if ($checked.length) applyState($checked.data("payment-id"));
  }

  function markChecked(input) {
    const $label = $(input).closest("label");
    $label
      .closest(".co-input--radio, .co-input--required")
      .find(".checked-label")
      .removeClass("checked-label");
    $label.addClass("checked-label");
  }

  function initServiceHandlers($form) {
    $form.on("change", "input[data-payment-id]", function () {
      markChecked(this);
    });

    $form.on("change", "input[data-delivery-id]", function () {
      markChecked(this);
      $form
        .find("#em_message-delivery")
        .prop("hidden", this.getAttribute("data-delivery-map-zones") === null);
    });

    let paymentInited = false;
    $(document).on("updated:insales:payment", function (event) {
      const $input = $(event.target);
      setTimeout(() => {
        $input
          .closest(".payment_variants")
          .find(".checked-label:first")
          .removeClass("checked-label");
        $input.closest("label").addClass("checked-label");

        if (paymentInited) return;
        paymentInited = true;

        const $deliveryInput = $form.find("input[data-delivery-id]:checked:first");
        if (!$deliveryInput.length) return;
        const $deliveryVariants = $deliveryInput.closest(".delivery_variants");

        $deliveryInput.closest("label").addClass("checked-label");
        $form
          .find(".co-input--em-select-zone:first")
          .insertBefore($deliveryVariants);
        if (!$form.find("#em_message-delivery").length) {
          $deliveryVariants.before(
            deliveryMessageHTML(
              $deliveryInput.attr("data-delivery-map-zones") === undefined,
            ),
          );
        }
      }, 350);
    });
  }

  function initAuthBlock() {
    const show = () => {
      if (!$(".section__auth").length) {
        $(".co-section--checkout_order:first").prepend(authBlockHTML());
      }
    };
    try {
      if (typeof ajaxAPI === "undefined") {
        warn("ajaxAPI недоступен — показываем блок регистрации");
        show();
        return;
      }
      ajaxAPI.shop.client
        .get()
        .done((client) => {
          if (!client?.authorized) show();
        })
        .fail(show);
    } catch (e) {
      err("Ошибка проверки авторизации:", e);
      show();
    }
  }

  function pickControl($wrapper) {
    let $input = $wrapper
      .find(
        "select.co-input-field, textarea.co-input-field, input.co-input-field, input.co-input-checkbox",
      )
      .first();
    if (!$input.length) $input = $wrapper.find("input[type='radio']").first();
    if (!$input.length)
      $input = $wrapper
        .find("input:not([type='hidden']), select, textarea")
        .first();
    return $input;
  }

  function initValidation($form) {
    const $submit = $("#create_order");
    if (!$submit.length) return warn("Кнопка #create_order не найдена");

    $form.attr("novalidate", "novalidate");

    const $container = $(errorsContainerHTML());
    $submit.before($container);
    const $list = $container.find("#em-errors-list");

    function checkControl($input, labelText) {
      const node = $input[0];
      const tag = node.tagName.toLowerCase();
      const type = ($input.attr("type") || tag).toLowerCase();
      const value = ($input.val() || "").trim();

      if (tag === "select") {
        const $selected = $input.find("option:selected");
        const selectedText = $selected.text();
        if (!value || $selected.prop("disabled")) {
          return `Выберите "${labelText}" (сейчас: ${selectedText || "не выбрано"})`;
        }
        return null;
      }
      if (type === "checkbox") {
        return $input.is(":checked") ? null : `Отметьте "${labelText}"`;
      }
      if (type === "radio") {
        const name = $input.attr("name");
        return $form.find(`input[name="${name}"]:checked`).length
          ? null
          : `Выберите "${labelText}"`;
      }
      if (type === "tel") {
        if (!value) return `Заполните поле "${labelText}"`;
        const digits = value.replace(/\D/g, "");
        return digits.length >= CONFIG.PHONE_MIN_DIGITS
          ? null
          : `Введите полный номер телефона в поле "${labelText}"`;
      }
      if (type === "password") {
        if (!value) return `Заполните поле "${labelText}"`;
        if (node.id === "client_password_confirmation") {
          const pass = $form.find("#client_password").val() || "";
          if (pass !== value) return "Пароли не совпадают";
        }
        return null;
      }
      if (!value) return `Заполните поле "${labelText}"`;
      if (node.checkValidity && !node.checkValidity() && node.validationMessage) {
        return `"${labelText}": ${node.validationMessage}`;
      }
      return null;
    }

    function validateForm(highlight = true) {
      const errors = [];

      if (highlight)
        $form
          .find(".em-invalid")
          .removeClass("em-invalid")
          .removeAttr("aria-invalid");

      const $street = $form.find("#shipping_address_street");
      const $house = $form.find("#shipping_address_house");
      const street = ($street.val() || "").trim();
      const house = ($house.val() || "").trim();

      if (!street || !house) {
        errors.push({
          field: "Адрес доставки",
          message:
            "Карта не распознала адрес: поля «Улица» и «Дом» пустые. Нажмите «Найти» над картой, введите улицу и дом, выберите вариант из подсказок — адрес появится в поле «Ваш адрес». Если видели сообщение «Сервер не смог обработать запрос» — повторите поиск.",
          $input: $form.find("#em-address"),
          scrollTarget: $form.find(".co-map_zones-map:first"),
        });
        if (highlight) $form.find("#em-address").addClass("em-invalid");
      }

      $form.find(".co-input--required").each(function () {
        const $wrapper = $(this);
        const $label = $wrapper.find(".co-input-label").first();
        const $input = pickControl($wrapper);
        if (!$input.length) return;

        const inputId = $input.attr("id");
        if (
          inputId === "shipping_address_street" ||
          inputId === "shipping_address_house"
        ) {
          return;
        }

        const labelText =
          $label.text().trim().replace("*", "").trim() ||
          $input.attr("name") ||
          "Поле";
        const type = (
          $input.attr("type") || $input.prop("tagName").toLowerCase()
        ).toLowerCase();

        if (!$wrapper.is(":visible")) {
          log(`⏭️ SKIP скрытый блок: "${labelText}"`);
          return;
        }

        if (type !== "checkbox" && type !== "radio" && !$input.is(":visible")) {
          log(`⏭️ SKIP скрытое поле: "${labelText}"`);
          return;
        }

        const message = checkControl($input, labelText);
        if (message) {
          errors.push({ field: labelText, message, $input });
          if (highlight)
            $input.addClass("em-invalid").attr("aria-invalid", "true");
        }
      });

      $form.find("input[type='email']:visible").each(function () {
        const value = (this.value || "").trim();
        if (value && !CONFIG.EMAIL_RE.test(value)) {
          const labelText =
            $(this)
              .closest(".co-input")
              .find(".co-input-label")
              .first()
              .text()
              .trim() || "Email";
          errors.push({
            field: labelText,
            message: "Некорректный формат email",
            $input: $(this),
          });
          if (highlight)
            $(this).addClass("em-invalid").attr("aria-invalid", "true");
        }
      });

      const $cashWrapper = $form.find("#em-cash-change-wrapper");
      if ($cashWrapper.length && !$cashWrapper.prop("hidden")) {
        const $cash = $form.find("#em-cash-change");
        const raw = ($cash.val() || "").trim();
        let message = null;
        if (raw === "") message = "Укажите '0', если сдача не требуется";
        else if (isNaN(Number(raw)) || Number(raw) < 0)
          message = "Неверный формат суммы сдачи";
        if (message) {
          errors.push({ field: "Сумма для сдачи", message, $input: $cash });
          if (highlight)
            $cash.addClass("em-invalid").attr("aria-invalid", "true");
        }
      }

      log(
        errors.length === 0
          ? "✅ Проверка формы: ошибок нет"
          : `❌ Проверка формы: ошибок ${errors.length}`,
        errors.map((e) => e.message),
      );
      return errors;
    }

    function showErrors(errors) {
      if (!errors.length) return hideErrors();
      $list.empty();
      errors.forEach((e, i) => {
        $list.append(
          `<li style="margin-bottom:8px;padding:5px 0;border-bottom:1px solid rgba(133,100,4,.1);"><strong>${i + 1}. ${e.field}:</strong> ${e.message}</li>`,
        );
      });
      $container.show();
      $form.find(".em-pulse").removeClass("em-pulse");
      const $addrTarget =
        errors[0].scrollTarget && errors[0].scrollTarget.length
          ? errors[0].scrollTarget.first()
          : null;
      const $scrollTo = $addrTarget || $container;
      $("html, body").animate({ scrollTop: $scrollTo.offset().top - 100 }, 400);
      if ($addrTarget) {
        $addrTarget.addClass("em-pulse");
        setTimeout(() => $addrTarget.removeClass("em-pulse"), 2500);
        const $mapSearch = $form.find(
          ".ymaps-2-1-79-searchbox-input__input:first",
        );
        if ($mapSearch.length)
          setTimeout(() => $mapSearch.trigger("focus"), 500);
      } else {
        const $first = errors[0].$input;
        if ($first && $first.is(":visible"))
          setTimeout(() => $first.focus(), 450);
      }
    }

    function hideErrors() {
      $container.hide();
      $form.find(".em-invalid").removeClass("em-invalid").removeAttr("aria-invalid");
    }

    document.addEventListener(
      "click",
      function (e) {
        const btn = e.target.closest ? e.target.closest("#create_order") : null;
        if (!btn) return;
        log("🖱️ Клик по кнопке (capture)");
        const errors = validateForm(true);
        if (errors.length) {
          e.preventDefault();
          e.stopPropagation();
          showErrors(errors);
        } else {
          hideErrors();
          log("✅ Ошибок нет, пропускаем отправку");
        }
      },
      true,
    );

    $form[0].addEventListener(
      "submit",
      function (e) {
        log("🚀 SUBMIT (capture)");
        const errors = validateForm(true);
        if (errors.length) {
          e.preventDefault();
          e.stopPropagation();
          showErrors(errors);
        } else {
          hideErrors();
          log("✅ Форма отправляется");
        }
      },
      true,
    );

    $form.on(
      "input change",
      "input, select, textarea",
      debounce(function () {
        if (!$container.is(":visible")) return;
        const errors = validateForm(true);
        errors.length ? showErrors(errors) : hideErrors();
      }, CONFIG.DEBOUNCE_MS),
    );

    let initialDone = false;
    const runInitial = () => {
      if (initialDone) return;
      initialDone = true;
      setTimeout(() => validateForm(false), 800);
    };
    $(document).one("selected:insales:payment", runInitial);
    setTimeout(runInitial, 6000);
  }
})();
