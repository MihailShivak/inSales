$(function() {
  var mobile_point = 767;

  $(document).ready(function() {
    $widget.each(function(index, el) {
      let specialProducts = $(el).find(".js-special-products");

      if (specialProducts.length == 0 ) {
        $(el).addClass('is-loaded');
      }

      specialProducts.each(function() {
        let special_products_block = $(this);
        let slider_block = special_products_block.find(".js-special-products-slider");

        let slide_min_width = 220;
        let slide_min_width_mobile = 150;
        let slide_gap = 30;

        if (slider_block.is("[data-slide-min-width]")) {
          slide_min_width = parseInt(slider_block.data("slideMinWidth"));
        } else {
          slider_block.data("slideMinWidth", slide_min_width);
        }

        if (slider_block.is("[data-slide-min-width-mobile]")) {
          slide_min_width_mobile = parseInt(slider_block.data("slideMinWidthMobile"));
        } else {
          slider_block.data("slideMinWidthMobile", slide_min_width_mobile);
        }

        if (slider_block.is("[data-slide-gap]")) {
          slide_gap = parseInt(slider_block.data("slideGap"));
        } else {
          slider_block.data("slideGap", slide_gap);
        }
        slider_block[0].splide = new Splide(slider_block[0], {
          perPage: getSlidesPerView(slider_block, isMobileWidth() ? slide_min_width_mobile : slide_min_width, slide_gap),
          gap: slide_gap,
          perMove: 1
        });

        special_products_block.parents(".layout:first").addClass('is-loaded');

        $(window).on("resize", function() {
          let slide_min_width = parseInt(slider_block[0].dataset.slideMinWidth);
          let slide_min_width_mobile = parseInt(slider_block[0].dataset.slideMinWidthMobile);
          let slide_gap = parseInt(slider_block[0].dataset.slideGap);

          slider_block[0].splide.options = { perPage: getSlidesPerView(slider_block, isMobileWidth() ? slide_min_width_mobile : slide_min_width, slide_gap)};
          configureDragOption(slider_block);
        });

        slider_block[0].splide.on( 'arrows:updated', function() {
          let special_products = slider_block.parents(".js-special-products");
          let prev_btn = special_products.find(".special-products__slider-arrow-prev");
          let next_btn = special_products.find(".special-products__slider-arrow-next");

          if (special_products.find(".splide__arrow--prev").prop("disabled") === true) {
            prev_btn.addClass("is-disabled");
          } else {
            prev_btn.removeClass("is-disabled");
          }

          if (special_products.find(".splide__arrow--next").prop("disabled") === true) {
            next_btn.addClass("is-disabled");
          } else {
            next_btn.removeClass("is-disabled");
          }
        });

        slider_block[0].splide.on( 'mounted updated', function() {
          displaySliderControls(slider_block);
        });

        slider_block[0].splide.on( 'mounted', function() {
          configureDragOption(slider_block);
        });

        slider_block[0].splide.mount();

        $widget.find(".js-move-slide").on("click", function() {
          let slider_node = $(this).parents(".js-special-products").find(".js-special-products-slider");

          if (slider_node.length) {
            let sliderInst = slider_node[0].splide;

            if ($(this).is(".special-products__slider-arrow-prev")) {
              sliderInst.go( '-' );
            }

            if ($(this).is(".special-products__slider-arrow-next")) {
              sliderInst.go( '+' );
            }
          }
        });
      });
    });

  });

  $(function() {
    EventBus.subscribe(['widget:input-setting:insales:system:editor', 'widget:change-setting:insales:system:editor'], (data) => {
      $widget.each(function(index, el) {
        if (data.widget_id == $(el).parents(".editable-widget").data("widgetId")) {
          let widget_slider_node = $('[data-widget-id="' + data.widget_id + '"] .js-special-products-slider');

          if (widget_slider_node.length) {
            widget_slider_node.each(function() {
              updateSpecialProductSlider($(this), data);
            });
          }
        }
      });
    });
  });

  function updateSpecialProductSlider(slider, data) {
    let sliderInst = slider[0].splide;

    let slide_min_width = parseInt(slider.data("slideMinWidth"));
    let slide_min_width_mobile = parseInt(slider.data("slideMinWidthMobile"));
    let slide_gap = parseInt(slider.data("slideGap"));

    if (data.setting_name == 'slide-width') {
      let new_slide_min_width = parseInt(data.value);
      slider.attr("data-slide-min-width", new_slide_min_width);

      if (!isMobileWidth()) {
        let new_per_page = getSlidesPerView(slider, new_slide_min_width, slide_gap);
        sliderInst.options = { perPage: new_per_page };
      }
    } else if (data.setting_name == 'slide-width-mobile') {
      let new_slide_min_width_mobile = parseInt(data.value);
      slider.attr("data-slide-min-width-mobile", new_slide_min_width_mobile);

      if (isMobileWidth()) {
        let new_per_page = getSlidesPerView(slider, new_slide_min_width_mobile, slide_gap);
        sliderInst.options = { perPage: new_per_page };
      }
    } else if (data.setting_name == 'slide-gap') {
      let new_slide_gap = parseInt(data.value);
      let new_per_page = getSlidesPerView(slider, slide_min_width, new_slide_gap);
      slider.attr("data-slide-gap", new_slide_gap);

      sliderInst.options = { gap: new_slide_gap, perPage: new_per_page };
    } else {
      setTimeout(function() {
        let new_per_page = getSlidesPerView(slider, isMobileWidth() ? slide_min_width_mobile : slide_min_width, slide_gap);
        sliderInst.options = { perPage: new_per_page };
      }, 0);
    }

    configureDragOption(slider);
  }

  function getSlidesPerView(sliderBlock, slideMinWidth, slideGap) {
    return Math.floor((sliderBlock.width() + slideGap) / (slideMinWidth + slideGap));
  }

  function displaySliderControls(slider) {
    let sliderInst = slider[0].splide;
    let special_products = slider.parents(".js-special-products");
    let prev_btn = special_products.find(".special-products__slider-arrow-prev");
    let next_btn = special_products.find(".special-products__slider-arrow-next");

    if (sliderInst.length <= sliderInst.options.perPage) {
      prev_btn.addClass("is-hide");
      next_btn.addClass("is-hide");
      slider.addClass("is-hide-paging");
    } else {
      prev_btn.removeClass("is-hide");
      next_btn.removeClass("is-hide");
      slider.removeClass("is-hide-paging");
    }
  }

  function configureDragOption(slider) {
    if (slider[0].splide.length <= slider[0].splide.options.perPage) {
      slider[0].splide.options = { drag: false };
    } else {
      slider[0].splide.options = { drag: true };
    }
  }

  function isMobileWidth() {
    return $(window).width() <= mobile_point;
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
