(function () {
  "use strict";
  
  window.__bocOrderInProgress = false;

  document.addEventListener("DOMContentLoaded", function () {
    initBuyOneClick();
    console.log("v2.3.9.11");
  });

  function initBuyOneClick() {
    // Слушаем открытие попапа (только один раз)
    document.addEventListener("afterPopupOpen", function (e) {
      if (e.detail && e.detail.popup && e.detail.popup.hash === "#popup-buy-one-click") {
        handlePopupOpen(e.detail.popup);
      }
    }, { once: true });

    // Слушаем добавление товара в корзину
    if (typeof EventBus !== "undefined") {
      EventBus.subscribe("add_items:insales:cart", function (data) {
        if (window.__bocOrderInProgress) {
          handleCartUpdated(data);
        }
      });
    }

    // Перехватываем отправку формы
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

        // Устанавливаем флаг
        window.__bocOrderInProgress = true;

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
            window.__bocOrderInProgress = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
            }
            showError(popup, "Ошибка инициализации корзины");
          }
        } else {
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

    // Проверяем авторизацию и заполняем данные
    if (form) {
      checkAuthAndFill(form);
    }
  }

  function checkAuthAndFill(form) {
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
        // Клиент не авторизован — ничего не делаем
      });
  }

  function handleCartUpdated(data) {
    const popup = document.querySelector("#popup-buy-one-click.popup_show");
    if (!popup) {
      window.__bocOrderInProgress = false;
      return;
    }

    const form = popup.querySelector("[data-boc-form]");
    const variantId = popup.dataset.variantId;
    const submitBtn = form.querySelector("[data-boc-submit]");
    const originalText = submitBtn ? submitBtn.textContent : "Оформить заказ";

    const addedItem = data.action?.currentItems?.find(
      (item) => String(item.variant_id) === String(variantId)
    );

    if (!addedItem) {
      console.warn("[BOC] Товар НЕ найден в корзине!");
      window.__bocOrderInProgress = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      showError(popup, "Товар не добавлен в корзину. Попробуйте еще раз.");
      return;
    }

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
        window.__bocOrderInProgress = false;
        
        if (order.status === "ok" || order.id) {
          // Редирект на страницу заказа
          if (order.location) {
            window.location.href = order.location;
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
        window.__bocOrderInProgress = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
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