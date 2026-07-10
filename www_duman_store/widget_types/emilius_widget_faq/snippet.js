document.addEventListener("DOMContentLoaded", function () {
    const dataEl = document.getElementById("faq-data");
    const wrapper = document.querySelector(".block__faq-wrapper");

    if (!dataEl || !wrapper) return;

    const container = wrapper.closest(".faq__container");
    const faqItems = JSON.parse(dataEl.textContent || "[]");

    const pathMatch = window.location.pathname.match(/\/collection\/([^/]+)/);
    const currentCollection = pathMatch ? pathMatch[1] : null;

    if (!currentCollection) return;

    const filtered = faqItems.filter(function (item) {
        return item.collection === currentCollection;
    });

    if (!filtered.length) return;

    wrapper.innerHTML = filtered
        .map(function (item, index) {
            return (
                '<div class="block__faq-item">' +
                '<button type="button" data-spoller class="block__faq-item__title">' +
                '<span class="product-card-descr__title-icon"></span>' +
                "<span>" + (index + 1) + ". " + item.question + "</span>" +
                "</button>" +
                '<div class="block__faq-item__body" hidden>' + item.answer + "</div>" +
                "</div>"
            );
        })
        .join("");

    if (container) container.removeAttribute("hidden");
    // setTimeout(() => window.EM_Module.spollers(wrapper), 150);
});

// upd