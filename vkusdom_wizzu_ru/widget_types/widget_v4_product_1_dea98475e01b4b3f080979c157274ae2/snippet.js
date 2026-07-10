$(function() {

  MicroModal.init({
    disableFocus: true,
    disableScroll: true,
    // onShow: ,
    onClose: function(modal, element, event) {
      event.preventDefault();
      event.stopPropagation();
    },
  });

  let videos = [...$("video.fslightbox-source")];
  for (var i = 0; i < videos.length; i++) {
    console.log(videos[i]);
    videos[i].controls = false;
    videos[i].autoplay = "true";
    videos[i].playsinline = "true";
    videos[i].loop = "true";
    videos[i].muted = "true";
  }

  $("video").each(function() {
    $(this).attr("autoplay", "true");
    $(this).attr("muted", "true");
    $(this).attr("playsinline", "true");
    $(this).attr("loop", "true");
  });

  $widget.each(function() {
    let productGalleryBlock = $(this).find(".js-product-gallery");

    if (productGalleryBlock.length > 0) {
      initProductGallerySlider(productGalleryBlock);
    }
  });

  $widget.on("click", ".js-product-gallery-tumbs-slide", function() {
    let slide_index = $(this).attr("data-product-img-index");
    let slider_main_inst = $(this)
      .parents(".js-product-gallery")
      .find(".js-product-gallery-main")[0].splide;

    if (slider_main_inst) {
      slider_main_inst.go(Number(slide_index));
    }
  });

  fixedBuyBtnOnMobile($widget);

  EventBus.subscribe(
    [
      "widget:input-setting:insales:system:editor",
      "widget:change-setting:insales:system:editor",
    ],
    (data) => {
      if (
        data.widget_id == $widget.parents(".editable-widget").data("widgetId")
      ) {
        if (data.setting_name == "show-selected-variant-photos") {
          let product_node = $widget.find("[data-product-id]:first");

          product_node.attr(
            "data-gallery-type",
            data.value ? "variant-photos" : "all-photos"
          );
          configurateVariantsPhoto(product_node);
        } else {
          updateProductGallerySlider(data);
        }
      }
    }
  );

  EventBus.subscribe("init_instance:insales:product", (data) => {
    if (data.action && data.action.productJSON) {
      let product_block = `[data-product-id="${data.action.productJSON.id}"]`;
      let $product_block = $(product_block);
      $product_block.addClass("product-inited");
    }
    if (Cart.order.getItemByID(data.action.productJSON.variants[0]?.id) !== undefined) {
      $widget.find("form.product:first").addClass("_product_add");
    }
  });

  EventBus.subscribe("update_items:insales:cart", (data) => {
    const product_id = Number(Shop.config.getProductId());
    if (data.action.method == "delete_items" || data.action.method == "add_items") {
      for (const product of data.action.currentItems) {
        if (product.product_id === product_id) {
          if (data.action.method == "add_items") {
            $widget.find("form.product:first").addClass("_product_add");
          }
          else {
            $widget.find("form.product:first").removeClass("_product_add");
          }
          return;
        }
      }
    }
  });

  EventBus.subscribe("change_variant:insales:product", function(data) {
    $widget.each(function(index, el) {
      let product_node = data.action.product || $('<div>');
      let product_id = product_node.attr("data-product-id");
      let is_cur_product_instance =
      $(data.action.product[0])
        .parents(".layout:first").is($(el));

      if (
        data.action &&
        data.action.product &&
        data.first_image.url &&
        data.product_id == product_id &&
        is_cur_product_instance
      ) {
        let variant_photos = [];
        let product_img_ids = [];

        let product_imgs = data.action.productJSON.images;
        let product_variants = data.action.productJSON.variants;

        if (data.image_id) {
          if (data.image_ids && data.image_ids.length > 0) {
            variant_photos.push.apply(variant_photos, data.image_ids);
          }

          product_imgs.forEach(function(item) {
            product_img_ids.push(item.id);
          });

          product_img_ids.forEach(function(imageId) {
            let is_image_for_all_variants = true;

            product_variants.forEach(function(variantItem) {
              let variant_imgs = variantItem.image_ids;

              if (variant_imgs.indexOf(imageId) != -1) {
                is_image_for_all_variants = false;
              }
            });

            if (is_image_for_all_variants) {
              variant_photos.push(imageId);
            }
          });
        }

        product_node.attr("data-variant-photos", variant_photos);
        product_node.attr("data-variant-id", data.id);
        product_node.attr("data-variant-first-img-id", data.first_image.id);

        let gallery_type = product_node.attr("data-gallery-type");

        if (gallery_type == "variant-photos") {
          configurateVariantsPhoto(product_node);
        } else {
          if (product_node.is("[data-is-gallery-type-all-photos]")) {
            goToCurrentVariantPhoto(product_node);
            configurateVariantsPhoto(product_node);
          } else {
            configurateVariantsPhoto(product_node);
          }
        }
      }
    });
  });

  function initProductGallerySlider(galleryBlock) {
    let mainSliderBlock = galleryBlock.find(".js-product-gallery-main");
    let tumbsSliderBlock = galleryBlock.find(".js-product-gallery-tumbs");

    mainSliderBlock.find('.product__slide-main.play-video').each(function(index, el) {
      let $splideVideoItem = $(el)

      $(el).find('iframe[src*="rutube"]').each(function(index, iframe) {
        let $controlPlay = $splideVideoItem.find('.control.play');
        $controlPlay[0].dataset.iframeSrc = iframe.src;
        iframe.src = '';

        $controlPlay.on('click', function(e) {
          let targetSrc = e.target.parentNode.dataset.iframeSrc;

          if (targetSrc === $controlPlay[0].dataset.iframeSrc) {
            $(`.fslightbox-absoluted .fslightbox-fade-in-strong #${iframe.id}`).attr('src', targetSrc);
          }
        })
      })
    });
    let img_id = mainSliderBlock.parents('[data-variant-first-img-id]:first').attr("data-variant-first-img-id");
    let startIndex = 0;
    let currentImage = mainSliderBlock.find(`[data-product-img-id="${img_id}"]`);
    if (currentImage.length) {
      startIndex = currentImage.index()
    }

    mainSliderBlock[0].splide = new Splide(mainSliderBlock[0], {
      gap: 1,
      start: startIndex
    });

    mainSliderBlock[0].splide.on("move", function(newIndex) {
      let slide_index = newIndex;
      let slider_tumbs_node = mainSliderBlock
        .parents(".js-product-gallery")
        .find(".js-product-gallery-tumbs");
      let slider_tumbs_inst = slider_tumbs_node[0].splide;

      if (slider_tumbs_inst) {
        slider_tumbs_inst.go(Number(slide_index));
        slider_tumbs_node
          .find(".splide__slide.is-current")
          .removeClass("is-current");
        slider_tumbs_node
          .find(".splide__slide[data-product-img-index=" + slide_index + "]")
          .addClass("is-current");
      }
    });

    mainSliderBlock[0].splide.mount();

    tumbsSliderBlock[0].splide = new Splide(tumbsSliderBlock[0], {
      direction: "ttb",
      autoHeight: true,
      perPage: 5,
      height: 1,
      perMove: 1,
      gap: 0,
      pagination: false,
      start: startIndex
    });

    tumbsSliderBlock[0].splide.on("mounted", function() {
      tumbsSliderBlock[0].splide.options = {
        perPage: getCountPerPageTumbs(tumbsSliderBlock),
      };
    });

    tumbsSliderBlock
      .find(".splide__slide.is-current")
      .removeClass("is-current");
    tumbsSliderBlock
      .find(".splide__slide[data-product-img-index=" + startIndex + "]")
      .addClass("is-current");

    tumbsSliderBlock[0].splide.mount();
  }

  function configurateVariantsPhoto(productNode) {
    let product_gallery_block = productNode.find(".js-product-gallery");
    let videoFirst = productNode.find(".js-product-all-images.video-first");

    if (product_gallery_block.length > 0) {
      let gallery_type = productNode.attr("data-gallery-type");
      let variant_id = productNode.attr("data-variant-id");
      let variant_photos_ids = productNode
        .attr("data-variant-photos")
        .split(",")
        .filter((element) => element !== "");
      let sizeVideo = productNode.data('video-size')

      if (variant_photos_ids.length > 0 && sizeVideo && sizeVideo > 0) {
        for (let i = sizeVideo - 1; i >= 0; i--) {
          if (videoFirst.length > 0) {
            variant_photos_ids.unshift(i);
          } else {
            variant_photos_ids.push(i);
          }
        }
      }

      let slider_main_inst = productNode.find(".js-product-gallery-main")[0]
        .splide;
      let slider_tumbs_inst = productNode.find(".js-product-gallery-tumbs")[0]
        .splide;

      let showVariantPhotos = () => {
        for (let i = 0; i < variant_photos_ids.length; i++) {
          let result_main_slide = productNode.find(
            '.js-product-all-images .product__slide-main[data-product-img-id="' +
              variant_photos_ids[i] +
              '"]'
          );
          let result_tumbs_slide = productNode.find(
            '.js-product-all-images .product__slide-tumbs[data-product-img-id="' +
              variant_photos_ids[i] +
              '"]'
          );

          if (result_main_slide.length > 0) {
            let main_slide_clone = result_main_slide
              .clone()
              .attr("data-product-img-index", i);
            main_slide_clone
              .find(".product__photo")
              .attr("data-fslightbox", "product-photos-lightbox-" + variant_id);
            main_slide_clone.appendTo(
              $(slider_main_inst.Components.Elements.list)
            );
          }

          if (result_tumbs_slide.length > 0) {
            let tumbs_slide_clone = result_tumbs_slide
              .clone()
              .attr("data-product-img-index", i);

            if (i == 0) {
              tumbs_slide_clone.addClass("is-current");
            }

            tumbs_slide_clone.appendTo(
              $(slider_tumbs_inst.Components.Elements.list)
            );
          }
        }

        if (variant_photos_ids.length > 1) {
          product_gallery_block.removeClass("is-shown-one-photo");
        } else {
          product_gallery_block.addClass("is-shown-one-photo");
        }
      };

      let showAllProductPhotos = () => {
        let all_main_photos = productNode.find(
          ".js-product-all-images .product__slide-main"
        );
        let all_tumbs_photos = productNode.find(
          ".js-product-all-images .product__slide-tumbs"
        );

        all_main_photos.each(function(index, el) {
          let main_slide_clone = $(el)
            .clone()
            .attr("data-product-img-index", index);
          main_slide_clone
            .find(".product__photo")
            .attr("data-fslightbox", "product-photos-lightbox-" + variant_id);
          main_slide_clone.appendTo(
            $(slider_main_inst.Components.Elements.list)
          );
        });

        all_tumbs_photos.each(function(index, el) {
          let tumbs_slide_clone = $(el)
            .clone()
            .attr("data-product-img-index", index);

          if (index == 0) {
            tumbs_slide_clone.addClass("is-current");
          }

          tumbs_slide_clone.appendTo(
            $(slider_tumbs_inst.Components.Elements.list)
          );
        });

        if (all_main_photos.length > 1) {
          product_gallery_block.removeClass("is-shown-one-photo");
        } else {
          product_gallery_block.addClass("is-shown-one-photo");
        }
      };

      $(slider_main_inst.Components.Elements.list).html("");
      $(slider_tumbs_inst.Components.Elements.list).html("");

      slider_main_inst.destroy();
      slider_tumbs_inst.destroy();

      if (gallery_type == "variant-photos") {
        if (variant_photos_ids.length > 0) {
          showVariantPhotos();
        } else {
          showAllProductPhotos();
        }
        initProductGallerySlider(product_gallery_block);
        productNode.removeAttr("data-is-gallery-type-all-photos");
      } else {
        showAllProductPhotos();
        initProductGallerySlider(product_gallery_block);
        goToCurrentVariantPhoto(productNode);
        productNode.attr("data-is-gallery-type-all-photos", "");
      }

      refreshFsLightbox();
    }
  }

  function updateProductGallerySlider(data) {
    let widget_slider_main_node = $(
      '[data-widget-id="' + data.widget_id + '"] .js-product-gallery-main'
    );
    let widget_slider_tumbs_node = $(
      '[data-widget-id="' + data.widget_id + '"] .js-product-gallery-tumbs'
    );

    if (widget_slider_main_node.length) {
      let sliderMainInst = widget_slider_main_node[0].splide;
      setTimeout(function() {
        sliderMainInst.refresh();
      }, 0);
    }

    if (widget_slider_tumbs_node.length) {
      let sliderTumbsInst = widget_slider_tumbs_node[0].splide;

      if (data.setting_name == "img-ratio") {
        sliderTumbsInst.options = {
          perPage: getCountPerPageTumbs(widget_slider_tumbs_node),
        };
      }

      setTimeout(function() {
        sliderTumbsInst.refresh();
      }, 0);
    }
  }

  function goToCurrentVariantPhoto(productNode) {
    let img_id = productNode.attr("data-variant-first-img-id");
    let videoFirst = productNode.find(".js-product-all-images.video-first").not('.after-inited');
    let result_slide_elem_first_video = productNode.find(
      '.js-product-gallery-main [data-product-img-id="0"]'
    );
    let result_slide_elem = productNode.find(
      '.js-product-gallery-main [data-product-img-id="' + img_id + '"]'
    );

    if (result_slide_elem.length > 0) {
      let sliderMainInst = productNode.find(".js-product-gallery-main")[0]
        .splide;

      if (sliderMainInst) {
        if (videoFirst.length > 0) {
          sliderMainInst.go(
            Number(result_slide_elem_first_video.attr("data-product-img-index"))
          );
        } else {
          sliderMainInst.go(
            Number(result_slide_elem.attr("data-product-img-index"))
          );
        }

        let slider_tumbs_node = productNode.find(".js-product-gallery-tumbs");
        slider_tumbs_node
          .find(".splide__slide.is-current")
          .removeClass("is-current");
        if (videoFirst.length > 0) {
          slider_tumbs_node
            .find(
              ".splide__slide[data-product-img-index=" +
              result_slide_elem_first_video.attr("data-product-img-index") +
              "]"
            )
            .addClass("is-current");
        } else {
          slider_tumbs_node
            .find(
              ".splide__slide[data-product-img-index=" +
                result_slide_elem.attr("data-product-img-index") +
                "]"
            )
            .addClass("is-current");
        }
      }
    }

    if (videoFirst.length > 0) {
      videoFirst.addClass('after-inited')
    }
  }

  function getCountPerPageTumbs(sliderBlock) {
    let tumbs_area_height = sliderBlock.height();
    let tumb_one_item = sliderBlock.find(".splide__slide:first");
    let tumb_outer_height = tumb_one_item.outerHeight(true);
    let tumb_gap = parseInt(tumb_one_item.css("marginBottom"));

    let perPage = Math.floor(
      (tumbs_area_height + tumb_gap) / tumb_outer_height
    );

    return perPage;
  }

  function fixedBuyBtnOnMobile(widgetLayout) {
    if (widgetLayout.find("#product-detail-buy-area").length === 0) {
      return false;
    }

    configureBuyBtn();

    $(window).on("scroll resize", configureBuyBtn);

    function configureBuyBtn() {
      if (widgetLayout.find('.hide-all-buttons').length || widgetLayout.find('.is-show-marketplace-button').length) {
        return; // Если один из классов найден, выходим из функции
      }
      let buy_area = widgetLayout.find("#product-detail-buy-area");
      let buy_area_top = buy_area.offset().top;
      let buy_area_height = buy_area.innerHeight();
      let fixed_bottom_panel = $('[data-fixed-panels="bottom"]');

      if (
        $(window).width() < 768 &&
        $(window).scrollTop() >= buy_area_top + buy_area_height
      ) {
        let fixed_bottom_panel_height = 0;

        if (
          fixed_bottom_panel.length &&
          !fixed_bottom_panel.is(".is-no-layouts")
        ) {
          fixed_bottom_panel_height = fixed_bottom_panel.innerHeight();
        }

        let btn_area_height = buy_area
          .find(".product__buy-btn-area-inner")
          .innerHeight();
        let new_bottom_offset = `${
          fixed_bottom_panel_height + btn_area_height
        }px`;

        // buy_area
        //   .css("height", buy_area_height)
        //   .addClass("is-fixed-state")
        //   .css(
        //     "--product-buy-fixed-position",
        //     `${fixed_bottom_panel_height}px`
        //   );
        $("html").css("--fixed-panels-bottom-offset", new_bottom_offset);
      } else {
        let fixed_bottom_panel_height = 0;

        if (
          fixed_bottom_panel.length &&
          !fixed_bottom_panel.is(".is-no-layouts")
        ) {
          fixed_bottom_panel_height = fixed_bottom_panel.innerHeight();
        }

        // buy_area.css("height", "auto").removeClass("is-fixed-state");
        $("html").css(
          "--fixed-panels-bottom-offset",
          `${fixed_bottom_panel_height}px`
        );
      }
    }
  }

  // Отключаем увеличение картинок в галерее
  let fs_gallery = document.querySelector(".product__area-photo");

  if (fs_gallery) {
    fs_gallery.addEventListener("click", (event) => {
      $(".fslightbox-absoluted video").each(function(i) {
        $(this).get(0).play();
        $(this).get(0).controls = false;
        $(this).get(0).autoplay = true;
        $(this).get(0).muted = true;
        $(this).get(0).playsinline = true;
        $(this).get(0).loop = true;
      });
      if (
        event.target.nodeName === "IMG" &&
        event.target.closest(".product__gallery-main")
      ) {
        let items = document.querySelectorAll(".fslightbox-absoluted");
        items.forEach(function(item) {
          item.addEventListener(
            "touchmove",
            (event) => {
              event.preventDefault();
            },
            { passive: false }
          );
        });
      }
    });
  }

  // Копирование товара
  $widget.find("[data-product-chare]").on("click", function(e) {
    const link = e.currentTarget.getAttribute("data-product-chare");
    if (!link) return;

    try {
        if(sessionStorage.getItem('isMobile') === 'true') {
            navigator.share({
                text: `Поделиться корзиной: \n`,
                url: link
            });
        }
        window.navigator.clipboard.writeText(link);
        
        EventBus.publish('copy:link:insales', link);
    }
    catch (e) {
        return;
    }
  });  
});
