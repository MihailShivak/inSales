$(function() {
  var isTouch = !!('ontouchstart' in window || navigator.msMaxTouchPoints);
  var infinityProductsTempPage = [];

  function isMobileWidth() {
    return $(window).width() <= 767;
  }

  if (isTouch) {
    $(widget).find(".product-preview").addClass("is-touch");
  }

  function loadMoreCollectionProducts(productListBlock, showMoreBtn) {
    let next_page = productListBlock.data('collectionInfinity');

    if (next_page && next_page != '') {
      if (infinityProductsTempPage.indexOf(next_page) > -1) {
        return;
      }

      infinityProductsTempPage.push(next_page);
      showMoreBtn.addClass('is-loading');

      $.ajax({
        url: next_page,
        dataType: 'html'
      })
        .done(function(resultDom) {
          let new_products = $(resultDom).find('[data-collection-infinity]');
          if (!isMobileWidth()) {
            new_products = $(resultDom).find('[data-collection-infinity]:not([hide-desktop])');
          } else {
            new_products = $(resultDom).find('[data-collection-infinity]:not([hide-mobile])');
          }
          console.log(new_products);
          let next = new_products.data('collectionInfinity');
          productListBlock.append( new_products.html() );
          productListBlock.data('collectionInfinity', next);

          const productIds = Array.from(productListBlock[0].querySelectorAll('[data-product-id]')).map(prod => prod.dataset.productId)

          if (productIds.length) {
            window.Products.getList(productIds)
          }

          if (productListBlock.data('collectionInfinity') == '') {
            showMoreBtn.parents(".layout").hide();
          }
        })
        .always(function() {
          showMoreBtn.removeClass('is-loading');
        })
    }
  }

  EventBus.subscribe('load-more-products:insales:site', function(data) {
    let product_list_block = $widget.find("[data-collection-infinity]");
    let btn = $(data.event_target);

    if (product_list_block.is(":visible")) {
      console.log('visible')
      loadMoreCollectionProducts(product_list_block, btn);
    }
  });

  if (window.location.pathname == '/favorites') {
    EventBus.subscribe('remove_item:insales:favorites_products', (data) => {
      $widget.find('[data-product-id="' + data.action.item + '"]').remove();
      if (data.products.length == 0 ) {
        $widget.find('.empty-catalog-message').removeClass('hidden');
      }
    })
  }

EventBus.subscribe("change_variant:insales:product", function(data) {
    let product_node = $(data.action.product[0]);
    let imagesContainer = product_node.find(".product-preview__photo .product-preview__photo-variant");
    let images = []

    if (imagesContainer.length === 0) {
      return;
    }

    if (data.image_ids.length <= 1) {
      let defaultImage = data.images[0];
      if (!defaultImage) {
        return
      }
      images = [`
        <picture>
          <source media="(min-width:768px)" srcset="${defaultImage.large_url}" type="image/webp" loading="lazy">
          <source media="(max-width:767px)" srcset="${defaultImage.large_url}" type="image/webp" loading="lazy">
          <img src="${defaultImage.large_url}" class="product-preview__img" loading="lazy">
        </picture>
        `]

    } else {
      let variantImages = data.action.productJSON.images.filter(img => data.image_ids.includes(img.id))
      let firstImage = variantImages[0];
      // Если нет картинки к варианту, берем первую в товаре
      if (!firstImage) {
        firstImage = data.action.productJSON.images[0]
      }
        images.push(`
          <picture>
            <source media="(min-width:768px)" srcset="${firstImage.large_url}" type="image/webp" loading="lazy">
            <source media="(max-width:767px)" srcset="${firstImage.large_url}" type="image/webp" loading="lazy">
            <img src="${firstImage.large_url}" class="product-preview__img" loading="lazy">
            </picture>
        `);

    }

    imagesContainer.html(images.join(''))
  })
});
