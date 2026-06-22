$(document).ready(() => {
    var formSubscribe;

    function notSelectProduct(popup) {
        const popupBody = popup.querySelector(".popup__body");
        const error = popup.querySelector(".popup__error");
        const errorNot = popup.querySelector(".popup__error-not");

        if (error && errorNot && popupBody) {
            popupBody.classList.add("_disabled-form");
            errorNot.removeAttribute("hidden");
            error.setAttribute("hidden", true);
        }
    }

    // Событие открытия попапа подписки на товар
    function popupSubscribeOpen(e) {
        if (e.detail.popup.hash != "#popup-subscribe") return;

        const popup = e.detail.popup.targetOpen.element;
        const popupBody = popup.querySelector(".popup__body");

        const btnClickOpen = e.detail.popup.lastFocusEl;
        var productID, titleProduct;

        if (!popup) return;
        if (!btnClickOpen) {
            notSelectProduct(popup);
            return;
        }

        if (btnClickOpen.classList.contains("product-card-info__button")) {
            productID = Shop.config.getProductId();
            titleProduct = document.querySelector(".product-card .product-card-info__title")?.innerText;
        }
        else {
            const form = btnClickOpen.closest("[data-cust-product-id]");
            if (form) {
                productID = form?.getAttribute("data-cust-product-id");
                titleProduct = form.querySelector(".products-item__title")?.innerText;
            }
        }

        if (!productID || !titleProduct) {
            notSelectProduct(popup);
            return;
        }

        if (!formSubscribe?.isInit) {
            const initForm = () => {
                formSubscribe = new window.EM_Module.FormFeedback($(popup), productID);
                formSubscribe.init();
            };
            if (window?.EM_Module?.FormFeedback) {
                initForm();
            }
            else {
                EventBus.subscribe('eventLoader', initForm);
            }
        }
        else {
            formSubscribe.productID = productID;
            // formSubscribe.setDateClient();
        }

        const span = popup.querySelector(".popup__subtitle > span");
        if (span) {
            span.innerText = titleProduct;
        }

        if (popupBody.getAttribute("data-subscribe-client") === "true" && popupBody.classList.contains("_disabled-form")) {
            popupBody.classList.remove("_disabled-form");
        }
        else if (popupBody.getAttribute("data-subscribe-client") !== "true") {
            // popup.querySelector(".popup__error").removeAttribute("hidden");
        }

        const errorNot = popup.querySelector(".popup__error-not");
        if (!errorNot.getAttribute("hidden")) {
            errorNot.setAttribute("hidden", "true");
        }
    }

    // setTimeout(() => ajaxAPI.shop.client.get().done(setDataClient), 150);
    document.addEventListener("afterPopupOpen", popupSubscribeOpen);
});