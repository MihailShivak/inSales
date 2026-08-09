/* eslint-disable linebreak-style */
const isTouch = !!('ontouchstart' in window || navigator.msMaxTouchPoints);

$(function() {
  $widget.each(function(widgetIndex, thisWidget) {
    const thisWidgetSelector = `.layout.${thisWidget.classList.value.split(' ').slice(1).join(' ')}`
    const widgetModalClass = thisWidget.classList.value.split(' ').slice(1).join(' ');
    const hideRowAttr = 'switch-row-hide-item';

    $(thisWidget).not('.modal-product-preview, .modal-product-preview-overlay').attr('data-widget-current-version', widgetIndex).data('widget-current-version', widgetIndex);

    let product_preview = $(thisWidget).find('.product-preview');
    if (product_preview.length == 0 ) { $(thisWidget).addClass('is-loaded'); }

    /* TABS */
    const tabsSliderBlock = $(thisWidget).find('.js-tabs-head');

    tabsSliderBlock.each(function() {
      const tabsSlider = $(this);

      tabsSlider[0].splide = new Splide(tabsSlider[0], {
        autoWidth: true,
        gap: 0,
        perMove: 1,
        pagination: false,
      });

      tabsSlider[0].splide.mount();

      if (window.ResizeObserver) {
        initTabsSliderObserver(tabsSlider[0]);
      }
    });

    $(thisWidget).on('click', '[data-tabs-item]', function() {
      const tabs = $(this).closest('.tabs');
      const tabItemId = $(this).data('tabsItem');
      const tabItemIndex = $(this).data('tabsIndex');
      const openTab = tabs.find('#' + tabItemId);

      if (openTab.length) {
        tabs
          .find('.tabs__item.is-active, .tabs__head-item.is-active')
          .removeClass('is-active');

        const contentTab = tabs.find('#' + tabItemId);
        contentTab.addClass('is-active');
        $(this).addClass('is-active');
        $(this).parents('.js-tabs-head')[0].splide.go(Number(tabItemIndex));

        const ajaxProductsNode = contentTab[0].querySelector('[data-ajax-products-list]');
        if (ajaxProductsNode) {
          EventBus.publish('ui-ajax-products:load-products-list', ajaxProductsNode);
        }
      }
    });

    function initTabsSliderObserver(tabsSlider) {
      const tabsSliderObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const sliderInst = entry.target.splide;
          const listWidth = $(sliderInst.Components.Elements.list).innerWidth();
          const trackWidth = $(sliderInst.Components.Elements.track).innerWidth();

          if (listWidth > trackWidth) {
            sliderInst.options = {
              focus: 'center',
            };
          } else {
            sliderInst.options = {
              focus: 0,
            };
          }
        });
      });

      tabsSliderObserver.observe(tabsSlider);
    }

    EventBus.subscribe('init-products:ui-ajax-products', initAjaxProductsCallback);

    function initAjaxProductsCallback(data) {
      if (!$(thisWidgetSelector).is(`[data-widget-current-version="${widgetIndex}"]`)) {
        EventBus.unsubscribe('init-products:ui-ajax-products', initAjaxProductsCallback);

        return;
      }

      if (Tools.url.keys['lang']) {
        data.productsListNode.querySelectorAll('a:not([href*="lang="]):not([href^="#"])').forEach(elem => {
          const link = elem.getAttribute('href');

          if (link) {
            elem.setAttribute('href', Tools.getLinkCurrentLang(link, Tools.url.keys['lang']));
          }
        });
      }

      const dataWidget = data.productsListNode.closest('.layout');
      const dataWidgetId = dataWidget ? parseInt(dataWidget.dataset['widgetCurrentVersion']) : null;
      const dataWidgetClassList = dataWidget ? dataWidget.classList.value : null;

      if (dataWidgetClassList && thisWidget.classList.value.includes(dataWidgetClassList) && dataWidgetId === widgetIndex) {
        const $dataProductList = $(data.productsListNode);
        const modalProductPreview = new ModalProductPreview();

        $dataProductList.off('click', '.js-show-modal-product');
        $dataProductList.on('click', '.js-show-modal-product', { modalProductPreview }, function(event) {
          showModalHandler(event.data.modalProductPreview, $(this));
        });

        const wrappRowHideElem = $(thisWidget).find(`[data-${hideRowAttr}]`);
        const currentTabId = data.productsListNode.closest('[id*="tab-"]').id

        if (wrappRowHideElem.length > 0 && wrappRowHideElem.attr(`data-${hideRowAttr}`) === 'true') {
          hidePartialRows($dataProductList);

          $(thisWidget).on('click', '.tabs .splide__slide', function() {
            const tabBtnId = $(this).find('[data-tabs-item]').data('tabsItem')
            if (currentTabId === tabBtnId) {
              checkItemsCount($dataProductList);
            }
          });
        }

        $(thisWidget).addClass('is-loaded');

        if (isTouch) {
          $(thisWidget).find('.product-preview').addClass('is-touch');
        }

        FavoritesProducts.update();
      }
    }

    EventBus.subscribe(
      [
        'widget:input-setting:insales:system:editor',
        'widget:change-setting:insales:system:editor',
      ],
      function(data) {
        if (
          data.widget_id === $(thisWidget).parents('.editable-widget').data('widgetId')
        ) {
          const wrappRowHideElem = $(thisWidget).find(`[data-${hideRowAttr}]`);
          const productLists = wrappRowHideElem.find('[data-ajax-products-list]');

          if (data.setting_name === hideRowAttr && data.value === false) {
            productLists.each(function(index, list) {
              showPartialRows($(list));
            });
          } else if (
            data.setting_name === hideRowAttr &&
            wrappRowHideElem.attr(`data-${hideRowAttr}`) === 'false'
          ) {
            productLists.each(function(index, list) {
              hidePartialRows($(list));
            });
          }

          if (data.setting_name === hideRowAttr) {
            wrappRowHideElem.attr(
              `data-${hideRowAttr}`,
              data.value === false ? 'false' : 'true'
            );
          }
        }
      }
    );

    function hidePartialRows(productsList) {
      // Получаем ширину
      const productItemWidth = productsList.find('.product-preview').width();

      const attrGap = 'catalog-grid-list-column-gap';
      const gapProduct = $(thisWidget)
        .find(`[data-${attrGap}]`)
        .attr(`data-${attrGap}`);

      const gapProductPx = gapProduct * 16;
      const productItemWidthOffset = gapProductPx + productItemWidth;

      // Получаем количество товаров
      const productCounts = productsList.find('.product-preview').length;

      const widthContent = $(thisWidget).find('.layout__content').width(); //ширина текущего контента
      const indexProductRowUn = widthContent / productItemWidthOffset;
      const indexProductRow = Math.round(indexProductRowUn);

      if (indexProductRow < productCounts) {
        const ostatokRowProducts = productCounts % indexProductRow; //сколько остается товаров вне строки

        if (ostatokRowProducts > 0) {
          productsList
            .find(
              `.product-preview-elem:gt(-${ostatokRowProducts + 1})`
            )
            .attr('is-hidden', true);
        }
      }
    }

    function showPartialRows(productsList) {
      productsList.find('.product-preview-elem').attr('is-hidden', false);
    }

    // Скрытие товаров, выпавших за диапазон
    function checkItemsCount(productsList) {
      const wrappRowHideElem = $(thisWidget).find(`[data-${hideRowAttr}]`);

      if (
        wrappRowHideElem.length > 0 &&
        wrappRowHideElem.attr(`data-${hideRowAttr}`) === 'true'
      ) {
        hidePartialRows(productsList);
      } else {
        showPartialRows(productsList);
      }
    }

    let productsListNode = thisWidget.querySelector('[data-ajax-products-list]');

    if (productsListNode) {
      EventBus.publish('ui-ajax-products:load-products-list', productsListNode)
    }

    /* SHOW MODAL PREVIEW */
    function ModalProductPreview() {
      // Если модалка для нужного виджета уже есть на странице, то не создаём её повторно
      if (!checkIfWidgetModalExists()) {
        this.rootNode = $(`.modal-product-preview.${widgetModalClass}[data-widget-modal-current-version="${widgetIndex}"]`);
        this.contentNode = this.rootNode.find('.modal-product-preview__content');
        this.overlayNode = $(`.modal-product-preview-overlay.${widgetModalClass}[data-widget-modal-current-version="${widgetIndex}"]`);
        this.closeBtnNode = this.rootNode.find('.button.modal-product-preview__close-btn');
      } else {
        this.rootNode = $(`<div class="modal-product-preview ${widgetModalClass}" data-widget-modal-current-version="${widgetIndex}"></div>`).appendTo('body');
        this.contentNode = $('<div class="modal-product-preview__content"></div>').appendTo(this.rootNode);
        this.overlayNode = $(`<div class="modal-product-preview-overlay ${widgetModalClass}" data-widget-modal-current-version="${widgetIndex}"></div>`).appendTo('body');
        this.closeBtnNode = $('<button class="button modal-product-preview__close-btn"><span class="icon icon-times"></span></button>').appendTo(this.rootNode);
      }

      const self = this;

      this.closeBtnNode.on('click', function() {
        self.close();
      });

      this.overlayNode.on('click', function() {
        self.close();
      });

      this.open = function(content, productId) {
        content.removeClass('hidden-product-preview-modal');
        self.contentNode.html('');
        self.contentNode.addClass('is-rendering');
        content.appendTo(self.contentNode);

        self.contentNode[0].dataset['ajaxProduct'] = JSON.stringify({
          productId,
          productData: ['variants', 'short_description', 'price_kinds', 'first_image', 'images', 'properties', 'characteristics', 'option_names'],
          initOnLoadPage: false,
          imageResizingRules: [
            { size: 240, format: "webp", resizing_type: "fit_width", quality: 100 },
            { size: 240, resizing_type: "fit_width", quality: 100 }
          ],
          hideVariants: false
        });

        self.loader = $('<div class="loader"></div>').appendTo(self.contentNode);
        self.loader.removeClass('hidden');

        EventBus.publish('ui-ajax-product:load-product', self.contentNode[0]);
        self.overlayNode.addClass('is-open');
        self.rootNode.addClass('is-open');

        EventBus.subscribe('init-product:ui-ajax-product', function() {
          self.renderEndingTimer = function() {
            setTimeout(function() {
              self.loader.addClass('hidden');
              self.contentNode.removeClass('is-rendering');
            }, 1000);
          };

          self.renderEndingTimer();
        });
      };

      this.close = function() {
        self.contentNode.html('');
        self.contentNode.removeClass('is-rendering');
        self.contentNode.removeClass('ajax-product-is-init');
        self.contentNode[0].dataset['ajaxProduct'] = '';
        self.overlayNode.removeClass('is-open');
        self.rootNode.removeClass('is-open');
        clearTimeout(self.renderEndingTimer);

        // Если модальное окно закрыли до того как пришёл ответ на запрос, то отменяем этот запрос
        EventBus.publish('abort-request:ui-ajax-product');
      };
    }

    function checkIfWidgetModalExists() {
      return $(thisWidgetSelector).is(`[data-widget-current-version="${widgetIndex}"]`) && (!$(`.modal-product-preview.${widgetModalClass}[data-widget-modal-current-version="${widgetIndex}"]`).length || !$(`.modal-product-preview-overlay.${widgetModalClass}[data-widget-modal-current-version="${widgetIndex}"]`).length);
    }

    function showModalHandler(modalProductPreview, btn) {
      const productId = $(btn).closest('[data-product-id]').data('productId');
      const modalProductBlock = $(btn).closest('.layout').find('[data-ajax-product]').clone();

      modalProductPreview.open(modalProductBlock, productId);
    }

    EventBus.subscribe('change_variant:insales:product', function(data) {
      const isProductInstanceInModalPanel = !!$(data.action.product[0]).parents('.modal-product-preview.is-open').length;

      if (
        data.action &&
        data.action.product &&
        data.first_image.url &&
        isProductInstanceInModalPanel
      ) {
        const productNode = $(data.action.product[0]);

        productNode
          .find('.product-preview__photo source')
          .attr('srcset', data.first_image.medium_url);

        productNode
          .find('.product-preview__photo img')
          .attr('src', data.first_image.medium_url);
      }
    });
  });
});
