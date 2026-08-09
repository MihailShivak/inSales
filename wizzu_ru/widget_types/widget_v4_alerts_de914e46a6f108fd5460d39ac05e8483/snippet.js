let alertsSettings = $widget.find('[data-micro-alerts-settings]').data('micro-alerts-settings');

function replaceAlertCheckIcon(message) {
  let iconCheck = '<span class="icon-check" style="margin-right:5px;"></span>';
  if (message.indexOf('✓') != -1 ) {
    return message.replace(/✓/gi, iconCheck);
  } else {
    return `${iconCheck} ${message}`;
  }
}

function replaceAlertWarningIcon(message) {
  let iconWarning = '<span class="icon-exclamation-triangle" style="margin-right:5px;"></span>';
  if (message.indexOf('⚠') != -1 ) {
    return message.replace(/⚠/gi, iconWarning);
  } else {
    return `${iconWarning} ${message}`;
  }
}

EventBus.subscribe('error-feedback:insales:ui_feedback', function(data) {
  let iconWarning = '<span class="icon-exclamation-triangle" style="margin-right:5px;"></span>';
  $.each(data.errors, function(i, val) {
    let errorText = typeof val == 'string' ? val : val[0];

    microAlert(iconWarning + errorText, 2000, {
      modificator: 'warning-notice'
    });
  });
});

EventBus.subscribe('send-feedback:insales:ui_feedback', function(data) {
  let success_feedback = alertsSettings['success_feedback'];
  let preorder = false;

  if ($(data.form[0]).find('[name="is-preorder-form"]').length) {
    success_feedback = alertsSettings['success_preorder'];
    preorder = true;
  }

  if ($(window).width() >= '767' && preorder) {
    microAlert(replaceAlertCheckIcon(success_feedback), 2000, {
      modificator: 'success-notice'
    });
  } else if ($(window).width() <= '768' && !preorder) {
    microAlert(replaceAlertCheckIcon(success_feedback), 2000, {
      modificator: 'success-notice'
    });
  }
});

EventBus.subscribe('overload:insales:compares', function() {
  let overload_compares = alertsSettings['overload_compares'];
  microAlert(replaceAlertWarningIcon(overload_compares), 2000, {
    modificator: 'warning-notice'
  });
});

EventBus.subscribe('copy:link:insales', function() {
  const copy_link = alertsSettings['copy_link'];
  microAlert(copy_link, 2000, {
    modificator: 'success-notice'
  });
});

EventBus.subscribe('add_item:insales:compares', () => {
  let add_item_compares = alertsSettings['add_item_compares'];

  microAlert(replaceAlertCheckIcon(add_item_compares), 2000, {
    modificator: 'success-notice'
  });
});

EventBus.subscribe('remove_item:insales:compares', () => {
  let remove_item_compares = alertsSettings['remove_item_compares'];
  microAlert(remove_item_compares, 2000, {
    modificator: 'success-notice'
  });
});

EventBus.subscribe('add_item:insales:favorites_products', () => {
  let add_item_favorites = alertsSettings['add_item_favorites'];
  microAlert(replaceAlertCheckIcon(add_item_favorites), 2000, {
    modificator: 'success-notice'
  });
});

EventBus.subscribe('remove_item:insales:favorites_products', () => {
  let remove_item_favorites = alertsSettings['remove_item_favorites'];
  microAlert(remove_item_favorites, 2000, {
    modificator: 'success-notice'
  });
});

EventBus.subscribe('overload:insales:favorites_products', function() {
  let overload_favorites = alertsSettings['overload_favorites'];
  microAlert(replaceAlertWarningIcon(overload_favorites), 2000, {
    modificator: 'warning-notice'
  });
});

EventBus.subscribe(['overload:quantity:insales:product', 'unchange_quantity:insales:ui_add-cart-counter'], () => {
  let overload_quantity = alertsSettings['overload_quantity'];
  microAlert(replaceAlertWarningIcon(overload_quantity), 2000, {
    modificator: 'warning-notice'
  });
});

EventBus.subscribe('add_items:insales:cart', function(data) {
  if (!data.action.button) {
    // microAlert("Товар добавлен в корзину", 2000, {
    //   modificator: 'success-notice'
    // });
    return;
  }

  const success_cart = alertsSettings['success_cart'];

  const btn_add_cart_counter_attr = $(data.action.button).is("[data-add-cart-counter-btn]") || $(data.action.button).is("[data-add-cart-counter]");
  const show_alert_always = $(data.action.button.prevObject).is("[data-show-alert-always]");

  const accessoriesData = (data.action && data.action.button && data.action.button.length > 0) ? getAccessoriesData(data.action.button[0]) : {};

  if (btn_add_cart_counter_attr && data.action.currentItems && data.action.currentItems.length) {
    let current_id = data.action.currentItems[0].variant_id;
    let first_added = false;

    Cart.order.order_lines.forEach(cartItem => {
      if (
        cartItem.variant_id === current_id &&
        (
          !Object.keys(accessoriesData).length && !cartItem.accessory_value_ids ||
          !cartItem.accessory_value_ids ||
          haveSameKeys(accessoriesData, cartItem.accessory_value_ids)
        )
      ) {
        first_added = cartItem.quantity === 1;
      }
    });

    if (first_added || show_alert_always) {
      microAlert(replaceAlertCheckIcon(success_cart), 3000, {
        modificator: 'success-notice'
      });
    }
  }
});

EventBus.subscribe('accessories-errors:insales:ui_accessories', function() {
  const accessories_error = alertsSettings['accessories_count_error'];

  microAlert(replaceAlertWarningIcon(accessories_error), 3000, {
    modificator: 'error-notice'
  });
})


if (window.location.pathname == '/' && Cookies.get('lite_preorder')) {
  let success_feedback = alertsSettings['success_preorder'];

  microAlert(replaceAlertCheckIcon(success_feedback), 2000, {
    modificator: 'success-notice'
  });
  Cookies.remove('lite_preorder');
}

function getAccessoriesData(btn) {
  const productNode = btn.closest('[data-product-id]');

  if (!productNode) { return; }

  const accessoriesData = {};

  const accessoriesItemNodes =
    productNode.querySelectorAll('[data-product-accessory-values-item] input:checked');

  for (const accessoriesItemNode of accessoriesItemNodes) {
    accessoriesData[accessoriesItemNode.value] = 1;
  }

  return accessoriesData;
}

function haveSameKeys(obj1, obj2) {
  let keys1 = Object.keys(obj1);
  let keys2 = Object.keys(obj2);

  let difference = xor(keys1, keys2);

  return difference.length === 0;
}

// Функция для нахождения уникальных элементов в двух массивах
function xor(array1, array2) {
  return array1
    .filter(key => !array2.includes(key))
    .concat(array2.filter(key => !array1.includes(key)));
}
