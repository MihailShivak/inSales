$(document).ready(function() {
  if (window.innerWidth <= 768) {
    if ($('.hidden-breadcrumbs').hasClass("js-hidden-bread")) {
      $('.breadcrumb-item').each(function(index) {
        if (index > 2 && index != $(".breadcrumb-item").length - 1) {
          $(this).not('.button-breadcrumb').addClass("hidden");
        }
      });

      $('.js-hidden-bread').click(function() {
        $('.breadcrumb-item').removeClass("hidden");
        $('.js-hidden-bread').parent().addClass("hidden");
      });
    }
  }
});
