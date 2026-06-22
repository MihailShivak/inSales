$(function () {
    function setSlider() {
        const swiper = document.querySelector(widget + " .swiper");

        if (!swiper) return;
        const swiperJS = new Swiper(swiper, {
            loop: true, // Бесконечная прокрутка
            speed: 500, // Скорость переключения слайдов
            slidesPerView: 1, // Показывать по одному слайду

            // Автоматическое переключение слайдов
            autoplay: {
                delay: 5000, // Задержка между переключениями 5 секунды
                disableOnInteraction: false, // Не останавливать автопрокрутку после взаимодействия
            },

            // Настройки пагинации
            pagination: {
                el: swiper.querySelector(".swiper-pagination"),
                clickable: true, // Возможность переключения по клику на пагинацию
            },

            // Настройки кнопок навигации
            navigation: {
                nextEl: swiper.querySelector(".swiper-button-next"),
                prevEl: swiper.querySelector(".swiper-button-prev")
            },

            // Отключение свайпа на мобильных устройствах
            allowTouchMove: true
        });

        if ($("#promo-data").length > 0) {
            swiperJS.autoplay.stop();
        }
    }

    setSlider();
});
