document.addEventListener("DOMContentLoaded", function () {
    const slider = document.querySelector(`${widget}`);
    if (!slider) return;

    new Swiper(slider.querySelector(".swiper"), {
        spaceBetween: 15,
        // slidesPerView: 'auto',
        slidesPerView: 2,
        pagination: {
            el: slider.querySelector(".slider__pagination"),
            clickable: true,
        },
        breakpoints: {
            760: {
                slidesPerView: 'auto',
                spaceBetween: 30,
            }
        }
    });
});