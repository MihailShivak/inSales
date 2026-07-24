/* eslint-disable linebreak-style */
$(function() {
  var isTouch = !!('ontouchstart' in window || navigator.msMaxTouchPoints);
  var mobilePoint = 768;

  $(document).ready(function() {
    if (isTouch) {
      $(widget).find(".header").addClass("is-touch");
    }

    if ($(window).width() >= mobilePoint) {
      $(widget).find(".js-cut-list").cutList({
        moreBtnTitle: '<span class="icon icon-ellipsis-h"></span>',
        alwaysVisibleElem: '.is-current'
      });

      $(widget).find(".js-cut-list-collections").cutList({
        moreBtnTitle: '<span class="icon icon-ellipsis-h"></span>',
        showMoreOnHover: true
      });
    }

    $(window).on('load', function() {
      $(widget).find(".js-cut-list").resize();
      $(widget).find(".js-cut-list-collections").resize();
    });

    if ($(widget).find(".header__collections .is-current").length) {
      if ($(window).width() < mobilePoint ) {
        $(widget).find(".header__collections .is-current").addClass("is-show");
      }
    }

    $(".header__collections-item").hover(
      function() {
        var submenu = $(this).find("> .header__collections-submenu");

        if (submenu.length && submenu.offset().left + submenu.innerWidth() > $(window).width()) {
          submenu.addClass("is-right");
        }
      },
      function() {
        $(this).find("> .header__collections-submenu").removeClass("is-right");
      }
    )

    $(widget).find(".js-show-touch-submenu").on("click", function() {
      var root_item = $(this).parents(".header__collections-item:last");
      var cur_item = $(this).parents(".header__collections-item:first");
      var submenu = cur_item.find("> .header__collections-submenu");

      if ($(window).width() >= mobilePoint) {
        if ($(this).parents(".cut-list__more-content").length) {
          $(this).parents(".cut-list__more-content").find("> .header__collections-item.is-show").each(function() {
            if ($(this).is(root_item) == false) {
              $(this).removeClass("is-show is-right").find(".header__collections-item.is-show").removeClass("is-show is-right");
            }
          });
        } else {
          $(widget).find(".header__collections > .header__collections-item.is-show").each(function() {
            if ($(this).is(root_item) == false) {
              $(this).removeClass("is-show is-right").find(".header__collections-item.is-show").removeClass("is-show is-right");
            }
          });
        }
      }

      cur_item.toggleClass("is-show");

      if (submenu.length && submenu.offset().left + submenu.innerWidth() > $(window).width()) {
        submenu.addClass("is-right");
      }
    });

    $(document).on("click", function(event) {
      if ($(event.target).closest(".header__collections").length) {
        return;
      }

      if ($(window).width() >= mobilePoint) {
        $(widget).find(".header__collections-item").removeClass("is-show is-right");
      }
    });

    $(widget).find(".cut-list__drop-toggle").on("click", function() {
      if ($(window).width() >= mobilePoint) {
        $(widget).find(".header__collections-item").removeClass("is-show is-right");
      }
    });

    $(widget).find(".js-show-mobile-menu").on("click", function() {
      let targetElement = $(widget).find(".header").get(0);
      if (targetElement) {
        bodyScrollLock.disableBodyScroll(targetElement);
      }
      $(widget).find(".header").addClass("is-show-mobile");
    });

    $(widget).find(".js-hide-mobile-menu").on("click", function() {
      bodyScrollLock.clearAllBodyScrollLocks();
      $(widget).find(".header").removeClass("is-show-mobile");
    });

    $(window).on('resize', function() {
      if ($(window).width() >= mobilePoint && $(widget).find(".header").is('.is-show-mobile')) {
        bodyScrollLock.clearAllBodyScrollLocks();
      }
    });

    $(widget).find(".js-show-mobile-search").on("click", function() {
      $(this).parents(".header__search").toggleClass("is-show-mobile").find(".header__search-field").focus();
    });
  });

  EventBus.subscribe('widget:input-setting:insales:system:editor', () => {
    $(widget).find(".js-cut-list").resize();
    $(widget).find(".js-cut-list-collections").resize();
  });

  EventBus.subscribe('widget:change-setting:insales:system:editor', () => {
    $(widget).find(".js-cut-list").resize();
    $(widget).find(".js-cut-list-collections").resize();
  });
});
