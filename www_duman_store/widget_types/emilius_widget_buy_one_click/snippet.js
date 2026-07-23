(function () {
  "use strict";
  
  window.__bocOrderInProgress = false;
  let cartStateBeforeBOC = null;
  let notificationObserver = null;

  document.addEventListener("DOMContentLoaded", function () {
    initBuyOneClick();
    console.log("v2.3.9.10");
  });

  function initBuyOneClick() {
    document.addEventListener("afterPopupOpen", function (e) {
      if (e.detail && e.detail.popup && e.detail.popup.hash === "#popup-buy-one-click") {
        handlePopupOpen(e.detail.popup);
      }
    });

    document.addEventListener("afterPopupClose", function (e) {
      if (e.detail && e.detail.popup && e.detail.popup.hash === "#popup-buy-one-click") {
        handlePopupClose();
      }
    });

    if (typeof EventBus !== "undefined") {
      EventBus.subscribe("add_items:insales:cart", function (data) {
        if (window.__bocOrderInProgress) {
          console.log("[BOC] Товар добавлен, оформляем заказ");
          handleCartUpdated(data);
        }
      });

      EventBus.subscribe("login:insales:client", function () {
        const popup = document.querySelector("#popup-buy-one-click.popup_show");
        if (popup) {
          const form = popup.querySelector("[data-boc-form]");
          if (form) checkAuthAndToggle(form);
        }
      });
    }

    document.addEventListener("submit", function (e) {
      const form = e.target;
      
      if (form && form.hasAttribute("data-boc-form")) {
        e.preventDefault();
        
        const popup = form.closest("#popup-buy-one-click");
        if (!popup) return;
        
        const variantId = popup.dataset.variantId;
        if (!variantId) {
          showError(popup, "Ошибка: не выбран вариант товара");
          return;
        }

        const errors = validateForm(form);
        if (errors.length > 0) {
          showError(popup, errors[0]);
          return;
        }

        const submitBtn = form.querySelector("[data-boc-submit]");
        const originalText = submitBtn ? submitBtn.textContent : "Оформить заказ";
        
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Добавление в корзину...";
        }

        // Включаем режим BOC
        window.__bocOrderInProgress = true;
        
        // Запускаем наблюдение за уведомлением
        startNotificationHider();

        // Добавляем товар в корзину
        if (typeof Cart !== "undefined") {
          try {
            Cart.add({
              items: {
                [variantId]: 1
              }
            });
          } catch (err) {
            console.error("[BOC] Ошибка при вызове Cart.add:", err);
            stopNotificationHider();
            window.__bocOrderInProgress = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
            }
            showError(popup, "Ошибка инициализации корзины");
          }
        } else {
          stopNotificationHider();
          window.__bocOrderInProgress = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
          showError(popup, "Модуль корзины не загружен");
        }
      }
    });
  }

  // Скрывает уведомление о добавлении в корзину
  function startNotificationHider() {
    console.log("[BOC] Запускаем скрытие уведомлений");
    
    // Сразу скрываем все возможные уведомления
    hideAllNotifications();
    
    // Создаем MutationObserver для отслеживания появления новых уведомлений
    notificationObserver = new MutationObserver(function(mutations) {
      hideAllNotifications();
    });
    
    // Начинаем наблюдение за body
    notificationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    // Дополнительная страховка - проверяем каждые 100мс в течение 3 секунд
    let checkInterval = setInterval(function() {
      if (!window.__bocOrderInProgress) {
        clearInterval(checkInterval);
        return;
      }
      hideAllNotifications();
    }, 100);
    
    // Останавливаем интервал через 3 секунды
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 3000);
  }

  function hideAllNotifications() {
    // Ищем и скрываем все возможные уведомления
    const notifications = document.querySelectorAll(
      '[data-notice-product], .notice__product, .notice, #notice, .cart-notification, .js-cart-notification'
    );
    
    notifications.forEach(function(notice) {
      if (notice.style.display !== 'none') {
        console.log("[BOC] Скрываем уведомление:", notice);
        notice.style.display = 'none';
        notice.style.visibility = 'hidden';
        notice.style.opacity = '0';
      }
    });
  }

  function stopNotificationHider() {
    if (notificationObserver) {
      notificationObserver.disconnect();
      notificationObserver = null;
      console.log("[BOC] Останавливаем скрытие уведомлений");
    }
  }

  function handlePopupOpen(popupObj) {
    const popupEl = popupObj.targetOpen?.element || document.querySelector(popupObj.hash || "#popup-buy-one-click");
    if (!popupEl) return;

    let variantId = popupEl.dataset.variantId;
    const productTitle = popupEl.dataset.productTitle;

    if (!variantId) {
      const variantInput = document.querySelector('input[name="variant_id"]');
      const variantSelect = document.querySelector('select[name="variant_id"]');
      if (variantInput && variantInput.value) {
        variantId = variantInput.value;
        popupEl.dataset.variantId = variantId;
      } else if (variantSelect && variantSelect.value) {
        variantId = variantSelect.value;
        popupEl.dataset.variantId = variantId;
      }
    }

    if (!variantId) {
      showError(popupEl, "Ошибка: не выбран вариант товара");
      return;
    }

    const form = popupEl.querySelector("[data-boc-form]");
    if (form) {
      form.reset();
      form.querySelectorAll(".popup-right__form-error, .popup-right__form-success, .form-error, .form-success").forEach((el) => {
        el.hidden = true;
        el.textContent = "";
      });
      const agreeCheckbox = form.querySelector('input[name="personal_data_agree"]');
      if (agreeCheckbox) agreeCheckbox.checked = true;
    }

    const titleElement = popupEl.querySelector("[data-boc-product-title]");
    if (titleElement && productTitle) {
      titleElement.textContent = productTitle;
    }

    if (form) checkAuthAndToggle(form);
  }

  function handlePopupClose() {
    window.__bocOrderInProgress = false;
    cartStateBeforeBOC = null;
    stopNotificationHider();
    hideAllNotifications(); // На всякий случай скрываем остатки
  }

  function checkAuthAndToggle(form) {
    const loginBlock = form.querySelector("#data-client-login");
    const submitBtn = form.querySelector("[data-boc-submit]");

    fetch("/client_account/contacts.json", {
      method: "GET",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Клиент не авторизован");
        return response.json();
      })
      .then((data) => {
        const client = data.client;
        if (loginBlock) loginBlock.style.display = "none";
        if (submitBtn) submitBtn.disabled = false;

        const fields = [
          { key: "name", input: form.querySelector('input[name="name"]') },
          { key: "surname", input: form.querySelector('input[name="surname"]') },
          { key: "phone", input: form.querySelector('input[name="phone"]') },
          { key: "email", input: form.querySelector('input[name="email"]') }
        ];

        fields.forEach(({ key, input }) => {
          if (client[key] && input && !input.value) {
            input.value = client[key];
          }
        });
      })
      .catch(() => {
        if (loginBlock) loginBlock.style.display = "";
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function handleCartUpdated(data) {
    const popup = document.querySelector("#popup-buy-one-click.popup_show");
    if (!popup) return;

    const form = popup.querySelector("[data-boc-form]");
    const variantId = popup.dataset.variantId;
    const submitBtn = form.querySelector("[data-boc-submit]");
    const originalText = submitBtn ? submitBtn.textContent : "Оформить заказ";

    const addedItem = data.action?.currentItems?.find(
      (item) => String(item.variant_id) === String(variantId)
    );

    if (!addedItem) {
      console.warn("[BOC] Товар НЕ найден в корзине!");
      stopNotificationHider();
      window.__bocOrderInProgress = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      showError(popup, "Товар не добавлен в корзину. Попробуйте еще раз.");
      return;
    }

    console.log("[BOC] Товар найден, переходим к оформлению");
    submitOrder(popup, form, variantId, originalText);
  }

  function submitOrder(popup, form, variantId, originalText) {
    const submitBtn = form.querySelector("[data-boc-submit]");
    if (submitBtn) submitBtn.textContent = "Оформление заказа...";

    const formData = {
      client: {
        name: form.querySelector('input[name="name"]')?.value.trim() || "",
        surname: form.querySelector('input[name="surname"]')?.value.trim() || "",
        phone: form.querySelector('input[name="phone"]')?.value.trim() || "",
        email: form.querySelector('input[name="email"]')?.value.trim() || "",
        consent_to_personal_data: form.querySelector('input[name="personal_data_agree"]')?.checked || false,
        messenger_subscription: form.querySelector('input[name="messenger_subscription"]')?.checked || false
      },
      order: {
        comment: form.querySelector('textarea[name="comment"]')?.value.trim() || "",
        delivery_variant_id: 6869435,
        payment_gateway_id: 6156350,
        line_items: [
          {
            variant_id: parseInt(variantId, 10),
            quantity: 1,
          },
        ],
      },
    };

    fetch("/fast_checkout.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => response.json())
      .then((order) => {
        // Останавливаем скрытие уведомлений только после успешного заказа
        stopNotificationHider();
        window.__bocOrderInProgress = false;
        
        if (order.status === "ok" || order.id) {
          showSuccess(popup, "Заказ успешно оформлен!");
          
          setTimeout(() => {
            const closeBtn = popup.querySelector("[data-close]");
            if (closeBtn) {
              closeBtn.click();
            } else {
              document.dispatchEvent(new CustomEvent('closePopup', { detail: { hash: '#popup-buy-one-click' } }));
            }
          }, 1500);
        } else {
          console.error("[BOC] Ошибка в ответе сервера:", order);
          showError(popup, order.errors?.base || order.errors?.client || "Ошибка при оформлении заказа");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        }
      })
      .catch((error) => {
        console.error("[BOC] Ошибка сети:", error);
        showError(popup, "Ошибка сети при оформлении заказа");
        stopNotificationHider();
        window.__bocOrderInProgress = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
  }

  function validateForm(form) {
    const errors = [];
    if (!form.querySelector('input[name="name"]')?.value.trim()) errors.push("Введите имя");
    if (!form.querySelector('input[name="surname"]')?.value.trim()) errors.push("Введите фамилию");
    if (!form.querySelector('input[name="phone"]')?.value.trim()) errors.push("Введите телефон");
    
    const agree = form.querySelector('input[name="personal_data_agree"]');
    if (agree && !agree.checked) errors.push("Необходимо согласие на обработку персональных данных");

    return errors;
  }

  function showError(popup, message) {
    const errorElement = popup.querySelector(".popup-right__form-error") || popup.querySelector(".form-error");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.hidden = false;
    } else {
      alert(message);
    }
  }

  function showSuccess(popup, message) {
    const successElement = popup.querySelector(".popup-right__form-success") || popup.querySelector(".form-success");
    if (successElement) {
      successElement.textContent = message;
      successElement.hidden = false;
    }
  }
})();