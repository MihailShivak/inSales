$(function() {
  $(widget).find(".js-show-mobile-submenu").on("click", function() {
    $(this).parents(".menu-item:first").toggleClass("is-show-mobile");
  });
});
