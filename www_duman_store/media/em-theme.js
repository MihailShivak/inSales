/**
 * Общие скрипты для темы
 */



console.log("[EM.Theme] Run...");

/**
 * Модалка Запретограма 
 */
document.addEventListener("DOMContentLoaded", function() {
    const $socialBan = $(".social__ban");

    $socialBan.find("[data-modal-ban]").on("click", function(e) {
        const block = e.target.closest(".social__ban");
        if (block) {
            block.classList.toggle("_visible-modal");
        }
    });

    $socialBan.find("[data-modal-ban-close]").on("click", function(e) {
        const block = e.target.closest(".social__ban");
        if (block) {
            block.classList.remove("_visible-modal");
        }
    });
});

/**
 * Инициализация форм обратной связи
 */
document.addEventListener("DOMContentLoaded", function() {
    if (!window.location.pathname.includes("/blogs/")) return;

    function initForms() {
        // ! Использовать глобальное значение FormFeedback
        const $popupFeedback = $("#popup-feedback");
        if ($popupFeedback.length) {
            (new EM_Module.FormFeedback($popupFeedback, null, "primerka")).init();
        }

        const $formFeedback = $("#form-feedback");
        if ($formFeedback.length) {
            (new EM_Module.FormFeedback($formFeedback, null, "stilist")).init();
        }
    }

    if (window?.EM_Module?.FormFeedback) {
        initForms();
    }
    else {
        EventBus.subscribe('eventLoader', initForms);
    }
});
!function(){var t=document.getElementById("myAmoExtraBtn"),e=null,n=null,i=null,l=!1;function o(){if(n&&e){var i=n.getBoundingClientRect();t.style.right=window.innerWidth-e.getBoundingClientRect().right+0-(window.innerWidth<=768?-11:6)+"px",console.log(i.top),t.style.top=i.top-31+"px"}}function r(){if(e=document.querySelector(".amo-button-holder"),n=document.getElementById("social_iframe"),i=document.getElementById("amobutton"),!e||!n||!i){setTimeout(r,300);return}i.addEventListener("click",function(){setTimeout(function(){l?(l=!1,t.classList.remove("visible")):(l=!0,o(),t.classList.add("visible"))},50)}),window.addEventListener("resize",function(){l&&o()}),window.visualViewport&&(window.visualViewport.addEventListener("resize",function(){l&&o()}),window.visualViewport.addEventListener("scroll",function(){l&&o()}))}setTimeout(r,500)}();
