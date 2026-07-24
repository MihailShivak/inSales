(function () {
  "use strict";
  
  // Глобальный флаг для координации между boc и header
  window.__bocOrderInProgress = false;
  let cartStateBeforeBOC = null;
  let bocTimeoutId = null; // Страховка от вечного зависания

  document.addEventListener("DOMContentLoaded", function () {
    initBuyOneClick();
    console.log("v2.3.9.13");
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
        console.log("[BOC][DEBUG] add_items:insales:cart получен. Флаг __bocOrderInProgress =", window.__bocOrderInProgress, "data =", data);
        if (window.__bocOrderInProgress) {
          clearTimeout(bocTimeoutId); 
          handleCartUpdated(data);
        } else {
          console.warn("[BOC][DEBUG] Флаг уже false в момент прихода события — кто-то сбросил его раньше нас.");
        }
      });
    } else {
      console.error("[BOC][DEBUG] EventBus не определён на момент инициализации!");
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

        // Валидация
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

        window.__bocOrderInProgress = true;
        document.body.classList.add("boc-order-in-progress");
        console.log("[BOC][DEBUG] Флаг выставлен в true, variantId =", variantId, "вызываем Cart.add");
        
        bocTimeoutId = setTimeout(() => {
          if (window.__bocOrderInProgress) {
            console.warn("[BOC] Таймаут 20 сек: товар не добавился в корзину");
            resetBOCState(form, popup, originalText);
            showError(popup, "Не удалось добавить товар. Попробуйте еще раз.");
          }
        }, 20000);

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
            clearTimeout(bocTimeoutId);
            resetBOCState(form, popup, originalText);
            showError(popup, "Ошибка инициализации корзины");
          }
        } else {
          clearTimeout(bocTimeoutId);
          resetBOCState(form, popup, originalText);
          showError(popup, "Модуль корзины не загружен");
        }
      }
    });
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
    resetBOCState();
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
    if (!popup) {
      console.warn("[BOC][DEBUG] Попап не найден открытым (popup_show) в момент прихода события — сбрасываем флаг и выходим.");
      resetBOCState();
      return;
    }

    const form = popup.querySelector("[data-boc-form]");
    const variantId = popup.dataset.variantId;
    const submitBtn = form.querySelector("[data-boc-submit]");
    const originalText = submitBtn ? submitBtn.textContent : "Оформить заказ";

    const currentItems = data?.action?.currentItems;
    console.log("[BOC][DEBUG] Ищем variantId =", variantId, "среди currentItems =", currentItems);

    const addedItem = currentItems?.find(
      (item) => String(item.variant_id) === String(variantId)
    );

    if (!addedItem) {
      console.warn("[BOC] Товар НЕ найден в корзине!");
      resetBOCState(form, popup, originalText);
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
        resetBOCState(); // Сбрасываем флаг и классы
        
        if (order.status === "ok" || order.id) {
          if (order.location) {
            window.location.href = order.location; // Редирект на страницу заказа
          } else {
            showSuccess(popup, "Заказ успешно оформлен!");
          }
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
        resetBOCState(form, popup, originalText);
      });
  }

  function resetBOCState(form = null, popup = null, originalText = "Оформить заказ") {
    window.__bocOrderInProgress = false;
    clearTimeout(bocTimeoutId);
    
    setTimeout(() => {
      document.body.classList.remove("boc-order-in-progress");
    }, 500);

    if (form) {
      const submitBtn = form.querySelector("[data-boc-submit]");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  function validateForm(form) {
    const errors = [];
    
    const name = form.querySelector('input[name="name"]')?.value.trim();
    if (!name) errors.push("Введите имя");

    const surname = form.querySelector('input[name="surname"]')?.value.trim();
    if (!surname) errors.push("Введите фамилию");

    const phone = form.querySelector('input[name="phone"]')?.value.trim();
    if (!phone) {
      errors.push("Введите телефон");
    } else if (typeof EM_Module !== "undefined" && EM_Module?.phoneMask?.validatePhone && !EM_Module.phoneMask.validatePhone(phone)) {
      errors.push("Введите корректный номер телефона");
    }

    const email = form.querySelector('input[name="email"]')?.value.trim();
    if (email && !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
      errors.push("Введите корректный email");
    }
    
    const agree = form.querySelector('input[name="personal_data_agree"]');
    if (agree && !agree.checked) {
      errors.push("Необходимо согласие на обработку персональных данных");
    }

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