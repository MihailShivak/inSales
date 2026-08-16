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

document.addEventListener("DOMContentLoaded",function(){!function(){if(!document.getElementById("comminucate-max")){var t=document.createElement("div");t.innerHTML='\n    <a href="https://max.ru/u/f9LHodD0cOI-rRBMBTnZ_yCHvDWsNpaTWlxqL5rrEUEVHqB_IU0mg7BqicI" target="_blank" rel="noopener" class="amocrm-max-button" id="comminucate-max" aria-label="Макс">\n      <span class="amocrm-max-button-tooltip">Макс</span>\n      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-185 -180 1100 1100"><path fill="#fff" d="M350.4,9.6C141.8,20.5,4.1,184.1,12.8,390.4c3.8,90.3,40.1,168,48.7,253.7,2.2,22.2-4.2,49.6,21.4,59.3,31.5,11.9,79.8-8.1,106.2-26.4,9-6.1,17.6-13.2,24.2-22,27.3,18.1,53.2,35.6,85.7,43.4,143.1,34.3,299.9-44.2,369.6-170.3C799.6,291.2,622.5-4.6,350.4,9.6h0ZM269.4,504c-11.3,8.8-22.2,20.8-34.7,27.7-18.1,9.7-23.7-.4-30.5-16.4-21.4-50.9-24-137.6-11.5-190.9,16.8-72.5,72.9-136.3,150-143.1,78-6.9,150.4,32.7,183.1,104.2,72.4,159.1-112.9,316.2-256.4,218.6h0Z"></path></svg>\n    </a>\n  ',document.body.appendChild(t.firstElementChild)}}(),function(){var t=document.getElementById("comminucate-max"),e=null,n=null,i=null,o=!1;function a(){if(n&&e){var i=n.getBoundingClientRect();t.style.right=window.innerWidth-e.getBoundingClientRect().right+0-(window.innerWidth<=768?-12:3)+"px",t.style.top=i.top-31+"px"}}setTimeout(function d(){e=document.querySelector(".amo-button-holder"),n=document.getElementById("social_iframe"),i=document.getElementById("amobutton"),e&&n&&i?(i.addEventListener("click",function(){setTimeout(function(){o?(o=!1,t.classList.remove("visible")):(o=!0,a(),t.classList.add("visible"))},50)}),window.addEventListener("resize",function(){o&&a()}),window.visualViewport&&(window.visualViewport.addEventListener("resize",function(){o&&a()}),window.visualViewport.addEventListener("scroll",function(){o&&a()}))):setTimeout(d,300)},500)}()});