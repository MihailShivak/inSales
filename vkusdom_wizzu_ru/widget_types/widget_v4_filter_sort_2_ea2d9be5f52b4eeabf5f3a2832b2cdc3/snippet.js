/* eslint-disable linebreak-style */
$(function() {
  initFilterRangeSlider($widget.find(".js-filter-range"));

  $widget.find(".js-reset-filter").on("click", function() {
    let filter_form = $(this).parents('form.filter');

    filter_form.find(".filter-option__field").prop('checked', false);
    filter_form.find(".filter-range__field").prop('disabled', true);

    filter_form.submit();
  });

  $(window).on('load', function() {
    $(widget).find(".filter").css("visibility", "");
  });

  $widget.find(".filter-option__field:checked").parents(".filter-item").addClass("is-show");
  $widget.find(".js-filter-range .filter-range__field:not(:disabled)").parents(".filter-item").addClass("is-show");

  if ($widget.find(".filter-option__field:checked").length > 0 || $widget.find(".js-filter-range .filter-range__field:not(:disabled)").length > 0) {
    $widget.find(".js-show-filter, .filter__head-reset").addClass("is-active-filters");
  }

  $widget.find(".filter-range__field-disabled-click").on("click", function() {
    $(this).parents(".filter-range__values-item").find(".filter-range__field").prop('disabled', false).focus();
  });

  $widget.find(".js-toggle-show-filter-item").on("click", function() {
    let filter_item = $(this).parents(".filter-item");

    if (filter_item.is(".is-show")) {
      filter_item.find(".filter-item__content").stop().slideUp(250, function() {
        filter_item.removeClass("is-show");
      });
    } else {
      filter_item.find(".filter-item__content").stop().slideDown(250, function() {
        filter_item.addClass("is-show");
      });
    }
  });

  $widget.find(".js-show-filter").on("click", function() {
    $(widget).find(".filter").css("visibility", "");
    $widget.find(".filter, .filter-overlay").addClass("is-show");
  });

  $widget.find(".js-hide-filter").on("click", function() {
    $widget.find(".filter, .filter-overlay").removeClass("is-show");
  });

  $widget.find(".js-open-order-list").on("click", function() {
    $(this).parents(".collection-order").toggleClass("is-show");
    $widget.find(".order-overlay").toggleClass("is-show");
  });

  $widget.find(".js-hide-order-list").on("click", function() {
    $widget.find(".collection-order, .order-overlay").removeClass("is-show");
  });

  $(document).on("click", function(event) {
    if ($(event.target).closest(".collection-order").length) {
      return;
    }

    $widget.find(".collection-order.is-show, .order-overlay").removeClass("is-show");
  });

  // Сортировка
  /*
  $(document).on("change", ".js-sorting-trigger-radio", function() {
    let thisEl = $(this);
    let thisForm = thisEl.parents('form:first');
    let defaultSize = $('.js-show-page-size').html();

    let order_val = thisEl.val();
    let page_size = thisForm.find('[name="page_size"]').val();

    if (order_val == '') {
      $('[name="order"]').attr('disabled', 'disabled');
    }

    if (page_size == defaultSize) {
      $('[name="page_size"]').attr('disabled', 'disabled');
    }

    thisForm.submit();
    thisForm.find(".collection-order").addClass("is-submit");
  }); */

});


function initFilterRangeSlider(filterRange) {
  filterRange.each(function() {
    let filter_range = $(this);
    let filter_range_slider = filter_range.find(".filter-range__slider")[0];
    let filter_range_field_min = filter_range.find(".filter-range__field-min");
    let filter_range_field_max = filter_range.find(".filter-range__field-max");

    let slider_min_value = Math.floor(filter_range.data("range-min"));
    let slider_max_value = Math.floor(filter_range.data("range-max"));
    let slider_start_val = Math.floor(filter_range.data("range-start"));
    let slider_end_val = Math.floor(filter_range.data("range-end"));
    let slider_step = Math.floor(filter_range.data("range-step"));

    noUiSlider.create(filter_range_slider, {
      start: [slider_start_val, slider_end_val],
      range: {
        'min': slider_min_value,
        'max': slider_max_value
      },
      step: slider_step,
      connect: true
    });

    filter_range_slider.noUiSlider.on('slide', function() {
      changeRangeValue(
        filter_range_slider.noUiSlider.get()[0],
        filter_range_slider.noUiSlider.get()[1]
      );
    });

    filter_range_slider.noUiSlider.on('set', function() {
      changeRangeValue(
        filter_range_slider.noUiSlider.get()[0],
        filter_range_slider.noUiSlider.get()[1]
      );
    });

    changeRangeValue(
      filter_range_slider.noUiSlider.get()[0],
      filter_range_slider.noUiSlider.get()[1]
    );

    function changeRangeValue(curMinValue, curMaxValue) {
      filter_range_field_min.val(Math.floor(curMinValue));
      filter_range_field_max.val(Math.floor(curMaxValue));

      curMinValue > slider_min_value
        ? filter_range_field_min.prop('disabled', false)
        : filter_range_field_min.prop('disabled', true);

      curMaxValue < slider_max_value
        ? filter_range_field_max.prop('disabled', false)
        : filter_range_field_max.prop('disabled', true);
    }

    filter_range_field_min.on("blur", function() {
      filter_range_slider.noUiSlider.set(
        [$(this).val(), filter_range_slider.noUiSlider.get()[1]]
      );
    });

    filter_range_field_max.on("blur", function() {
      filter_range_slider.noUiSlider.set(
        [filter_range_slider.noUiSlider.get()[0], $(this).val()]
      );
    });
  });
}

// ! Заменили функционал
// $widget.find(".filter__title-close").on("click", () => {
//   if (history.length > 1) {
//     history.back();
//   }
//   else {
//     window.location.pathname = "/";
//   }
// });