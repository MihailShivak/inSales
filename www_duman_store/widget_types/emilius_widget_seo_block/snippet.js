(() => {
    var $seo = $widget;
    const video = $widget.find("#seo-video").get(0);

    let hasAutoPlayed = false; // Флаг для автозапуска только один раз

    if (!video) return;

    function showLoader() {
        $seo.find(".catalog__loader:first").removeAttr("hidden");
    }

    function hideLoader() {
        $seo.find(".catalog__loader:first").attr("hidden", true);
    }

    video.addEventListener('click', () => {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    });

    // Обработчик события загрузки видео
    video.addEventListener('loadstart', showLoader);
    video.addEventListener('canplay', hideLoader);
    video.addEventListener('playing', hideLoader);

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Запуск, когда 50% видео видно
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasAutoPlayed) {
                // Видео попало в viewport
                hasAutoPlayed = true;
                video.play();
            } else if (!entry.isIntersecting && hasAutoPlayed) {
                // Видео вышло из viewport
                if (!video.paused) {
                    video.pause();
                }
                hasAutoPlayed = false;
            }
        });
    }, observerOptions);

    observer.observe(video); 
})();