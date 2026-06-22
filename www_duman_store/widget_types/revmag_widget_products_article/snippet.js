$(document).ready(function(){
  $widget.find('.js-products-slider').each(function(){
    initProductsSlider($(this));
  });

  $widget.each(function(index, el) {
    let lazyLoadCollectionList = new LazyLoad({
      container: $(el).get(0),
      elements_selector: '.lazyload'
    });
  });

  $widget.find('.js-prevent-images').on('click', function(e){
    if($(window).width() <= 767){
      e.preventDefault();
    }
  });
});

function initProductsSlider(slider) {
  var slides_per_view = slider.data('slides-per-view');
  var slide_gap = slider.data('slide-gap');
  var slides_per_view_sm = slider.data('slides-per-view-sm');
  var slide_gap_sm = slider.data('slide-gap-sm');
  var autoplay_delay = slider.data('autoplay-delay') * 1;
  var autoplay_settings = (autoplay_delay > 0) ? ({ delay: autoplay_delay ? parseInt(autoplay_delay) * 1000 : 5000 }) : false;

  var products_slider = new Swiper(slider.get(0), {
    slidesPerView: slides_per_view_sm,
    spaceBetween: slide_gap_sm,
    loop: false,
    navigation: {
      prevEl: '.swiper-prev',
      nextEl: '.swiper-next'
    },
    pagination: {
      el: '.swiper-pagination',
      type: 'progressbar',
    },
    breakpoints: {
      768: {
        slidesPerView: slides_per_view,
        spaceBetween: slide_gap
      }
    },

    autoplay: autoplay_settings,
    watchOverflow: true
  });
}

$widget.find(".js-product-item-images").each(function(){
  initImagesSlider($(this));
});

function initImagesSlider(slider) {
  var imagesSlider = new Swiper(slider.get(0), {
    slidesPerView: 1,
    spaceBetween: 0,
    loop: false,
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    navigation: {
      prevEl: '.swiper-prev',
      nextEl: '.swiper-next',
    }
  });
}

$widget.find('.first-load').each(function(index, el){
  $(this).addClass('is-active');
});

$widget.find('.bttn-bubble').on('click', function(){
  var thisEl = $(this);

  thisEl.addClass('animate');
  setTimeout(function(){
    thisEl.removeClass('animate');
  }, 700);
});

$widget.find('.hover-image').mouseenter(function(e){
  var thisEl = $(this);
  var activeElem = thisEl.parent().find('.is-active').removeClass('is-active');
  thisEl.addClass('is-active');
});

EventBus.subscribe('update_variant:insales:product', function(variant){
  var widgetClass = widget.substring(1);
  if($(variant.action.product[0]).parents('.layout:first').hasClass(widgetClass)){
    $(variant.action.product[0]).find('.option-value.is-active').each(function(){
      var thisEl = $(this);
      var thisVal = '';
      if(thisEl.hasClass('is-preview')){
        thisVal = thisEl.find('img').attr('title');
      } else{
        thisVal = thisEl.html();
      }
      var thisParent = thisEl.parents('.option:first');

      if(!thisParent.hasClass('done')){
        var lbl = thisParent.find('.option-label')
        var lblHtml = lbl.html().slice(-1);
        var koma = '';
        if(lblHtml != ':'){
          var koma = ':'
        }
        lbl.append(`${koma} <span>${thisVal}</span>`);
      }
      thisParent.addClass('done');
    }); 

    if($(variant.action.product[0]).find('.hover-images').length > 0){
      $(variant.action.product[0]).find('.hover-image.is-active').removeClass('is-active');
      if(variant.image_id != null){
        $(variant.action.product[0]).find(`[data-image-id="${variant.image_id}"].hover-image`).addClass('is-active');
      } else{
        $(variant.action.product[0]).find('.hover-image:first-child').addClass('is-active');
      }
    } else{
      var imagesSlider = $(variant.action.product[0]).find('.js-product-item-images')[0].swiper;
      if(variant.image_id != null){
        var dataIndex = $(variant.action.product[0]).find(`[data-image-id="${variant.image_id}"].swiper-slide`).attr('data-image-index') * 1;
        imagesSlider.slideTo(dataIndex);
      } else{
        imagesSlider.slideTo(0);
      }
    }
  }
});

function updateSlider(slider, data){
  const sliderInst = slider[0].swiper;
  var variable = data.setting_name == 'slides-per-view' || data.setting_name == 'slides-per-view-sm' || data.setting_name == 'slide-gap' || data.setting_name == 'slide-gap-sm' || data.setting_name == 'autoplay-delay';

  if(variable){
    slider.data(data.setting_name, data.value);
  
    sliderInst.destroy();
    initProductsSlider(slider);
  }
}

EventBus.subscribe(['widget:input-setting:insales:system:editor', 'widget:change-setting:insales:system:editor'], (data) => {
  let widget_slider_node = $('[data-widget-id="'+ data.widget_id+'"] .js-products-slider');
  
  if(widget_slider_node.length){
    $widget.find(".js-products-slider").each(function(){
      updateSlider($(this), data);
    }); 
  }
});