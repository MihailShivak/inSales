/* eslint-disable no-useless-escape */
$(function() {
  EventBus.subscribe('send-feedback:insales:ui_feedback', (data) => {
    data.form.addClass("is-sended");

    setTimeout(function() {
      data.form.removeClass("is-sended");
    }, 10000);
  });

  function getWidget(item) {
    return item.closest('.layout');
  }

  $(function() {
    function printContent(thisWidget) {
      let content = "";
      thisWidget.find('form .js-form-field').each(function() {
        content = content + '<b>' + this.getAttribute('placeholder') + '</b>: ' + this.value + '<br>';
      });
      thisWidget.find('form .js-form-content').val(content);
    }

    $widget.find('form .js-form-field').on("input", function() {
      let thisWidget = getWidget($(this));
      printContent(thisWidget);
    });

    $widget.find('.phone').on('input', function() {
      $(this).val($(this).val().replace(/[A-Za-zА-Яа-яЁё]/, ''))
    });

    $.fn.hasAttr = function(name) {
      return this.attr(name) !== undefined;
    };

    // eslint-disable-next-line no-useless-escape
    // var pattern = /^([a-z0-9 \.-])+@[a-z0-9-]+\.([a-z]{2,4}\.)?[a-z]{2,4}$/i;
    var pattern = /^[A-Za-z0-9]+(([_\.\-](?=[A-Za-z0-9]))[a-zA-Z0-9]+([\-\.](?=[A-Za-z0-9]))*?)*@(\w+([\.\-](?=(\w|\d))))+[a-zA-Z]{2,6}$/i;


    $widget.find('.email').on('input', function() {

      if (pattern.test($(this).val())) {
        $(this).parent('.feedback__field-area').find('.feedback__field-error').hide();
        $(this).parents('form').find(':input[type=submit]').prop('disabled', false);

      } else {
        $(this).parent('.feedback__field-area').find('.feedback__field-error').show();
        $(this).parents('form').find(':input[type=submit]').prop('disabled', true);

      }

      if ($(this).val() == '' && !$(this).hasAttr('required')) {
        $(this).parent('.feedback__field-area').find('.feedback__field-error').hide();
        $(this).parents('form').find(':input[type=submit]').prop('disabled', false);
      }
    });
  });

  function validate(thisWidget) {
    var validation = true;
    thisWidget.find("form .form-control.required").each(function() {
      $(this).parent('.feedback__field-area').find('.feedback__field-error').hide();
      if ($(this).val().replace(/^\s+/, "").length == 0) {
        $(this).parent('.feedback__field-area').find('.feedback__field-error').show();
        validation = false;
      }
    });
    return validation;
  }

  $widget.find('form').on('submit', function() {
    let thisWidget = getWidget($(this));

    if (validate(thisWidget) == false) {
      return false;
    }
  });
});
