document.addEventListener("DOMContentLoaded", function () {
    const slider = document.querySelector(`${widget}`);
    if (!slider) return;

    // Данные блоков из Liquid
    const blocksData = window.storiesBlocksData || [];
    
    // Отладочная информация (можно убрать в продакшене)
    // console.log('Stories blocks data:', blocksData);
    
    var promoSlider,
        storiesSwiper,
        currentStoryIndex = 0,
        currentImageIndex = 0,
        progressInterval,
        isModalOpen = false;

    // Инициализация промо-слайдера
    function initPromoSlider() {
        promoSlider = new Swiper(slider.querySelector(".slider-promo"), {
        width: 132,
        slidesPerView: 'auto',
        spaceBetween: 15,
        pagination: {
            el: slider.querySelector(".slider__pagination"),
            clickable: true,
        },
        breakpoints: {
            760: {
                spaceBetween: 30,
                slidesPerView: 2,
                width: "auto"
            }
        }
    });
    }

    // Создание прогресс-баров для текущего сторис
    function createProgressBars(imageCount) {
        const progressContainer = slider.querySelector('.stories__progress');
        progressContainer.innerHTML = '';
        
        for (let i = 0; i < imageCount; i++) {
            const progressBar = document.createElement('div');
            progressBar.className = 'stories__progress-bar';
            progressBar.innerHTML = '<div class="stories__progress-bar-fill"></div>';
            progressContainer.appendChild(progressBar);
        }
    }

    // Обновление прогресс-баров
    function updateProgressBars(activeIndex) {
        const progressFills = slider.querySelectorAll('.stories__progress-bar-fill');

        progressFills.forEach((fill, index) => {
            fill.style.transition = 'none';
            if (index < activeIndex) {
                fill.style.width = '100%';
            } else if (index === activeIndex) {
                fill.style.width = '0%';
                void fill.offsetWidth; // Принудительный reflow
                fill.style.transition = 'width 5000ms linear';
                fill.style.width = '100%';
            } else {
                fill.style.width = '0%';
            }
        });
    }
    
    // Запуск автопрокрутки
    function startAutoplay() {
        if (progressInterval) clearInterval(progressInterval);
        
        const currentBlock = blocksData[currentStoryIndex];
        if (!currentBlock || !currentBlock.images || currentBlock.images.length < 1) return;

        progressInterval = setInterval(() => {
            currentImageIndex++;
            if (currentImageIndex >= currentBlock.images.length) {
                // Переход к следующему сторис
                if (currentStoryIndex < blocksData.length - 1) {
                    currentStoryIndex++;
                    currentImageIndex = 0;
                    const nextBlock = blocksData[currentStoryIndex];
                    if (nextBlock && nextBlock.images) {
                        showStory(currentStoryIndex);
                        createProgressBars(nextBlock.images.length);
                        showImage(currentImageIndex);
                        updateProgressBars(currentImageIndex);
                        // Перезапускаем автопрокрутку для нового сторис
                        startAutoplay();
                    }
                } else {
                    // Закрытие модалки в конце
                    closeModal();
                }
            } else {
                // Переход к следующему изображению в текущем сторис
                showImage(currentImageIndex);
                updateProgressBars(currentImageIndex);
            }
        }, 5000);
    }

    // Остановка автопрокрутки
    function stopAutoplay() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    // Создание изображений для сторис
    function createStoryImages(blockIndex) {
        const block = blocksData[blockIndex];
        if (!block || !block.images || block.images.length === 0) {
            return;
        }

        const imagesContainer = slider.querySelector(`[data-story-block="${blockIndex}"] .stories__images-container`);
        if (!imagesContainer) {
            return;
        }
        
        imagesContainer.innerHTML = '';

        block.images.forEach((imageUrl, index) => {
            if (imageUrl && imageUrl.trim() !== '') {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.className = 'stories__slide-img';
                img.alt = `Изображение ${index + 1}`;
                img.style.display = index === 0 ? 'block' : 'none';
                imagesContainer.appendChild(img);
            }
        });
    }

    // Показ изображения по индексу
    function showImage(imageIndex) {
        const currentSlide = slider.querySelector(`[data-story-block="${currentStoryIndex}"]`);
        if (!currentSlide) return;

        const images = currentSlide.querySelectorAll('.stories__slide-img');
        images.forEach((img, index) => {
            img.style.display = index === imageIndex ? 'block' : 'none';
        });
    }

    // Показ конкретного сторис
    function showStory(storyIndex) {
        // Скрываем все сторис
        const allSlides = slider.querySelectorAll('.stories__slide');
        allSlides.forEach((slide, index) => {
            slide.style.display = index === storyIndex ? 'block' : 'none';
        });
    }

    // Инициализация сторис-слайдера
    function initStoriesSlider() {
        // Создаем изображения для всех блоков сразу
        blocksData.forEach((block, index) => {
            if (block && block.images) {
                createStoryImages(index);
            }
        });

        // Показываем текущий сторис
        showStory(currentStoryIndex);

        // Инициализируем текущий блок
        const block = blocksData[currentStoryIndex];
        if (block && block.images) {
            createProgressBars(block.images.length);
            showImage(currentImageIndex);
            updateProgressBars(currentImageIndex);
            startAutoplay();
        }
    }

    // Открытие модалки
    function openModal(storyIndex) {
        currentStoryIndex = storyIndex;
        currentImageIndex = 0;
        isModalOpen = true;

        const modal = slider.querySelector('#stories');
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';

        // Фокус на модалке
        const closeBtn = modal.querySelector('.stories__close');
        closeBtn.focus();

        // Инициализация слайдера после открытия
        setTimeout(() => {
            initStoriesSlider();
        }, 100);
    }

    // Закрытие модалки
    function closeModal() {
        isModalOpen = false;
        stopAutoplay();

        const modal = slider.querySelector('#stories');
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // Обработка кликов по превью
    function handlePreviewClick(slideItem) {
        const storyIndex = parseInt(slideItem.dataset.storyIndex);
        openModal(storyIndex);
    }

    // Обработка навигации по изображениям
    function handleImageNavigation(direction) {
        if (!isModalOpen) return;

        const block = blocksData[currentStoryIndex];
        if (!block || !block.images) return;

        stopAutoplay();

        if (direction === 'next') {
            if (currentImageIndex < block.images.length - 1) {
                currentImageIndex++;
                showImage(currentImageIndex);
                updateProgressBars(currentImageIndex);
                startAutoplay();
            } else if (currentStoryIndex < blocksData.length - 1) {
                // Переход к следующему сторис
                currentStoryIndex++;
                currentImageIndex = 0;
                const nextBlock = blocksData[currentStoryIndex];
                if (nextBlock && nextBlock.images) {
                    showStory(currentStoryIndex);
                    createProgressBars(nextBlock.images.length);
                    showImage(currentImageIndex);
                    updateProgressBars(currentImageIndex);
                    startAutoplay();
                }
            } else {
                // Закрытие в конце
                closeModal();
            }
        } else if (direction === 'prev') {
            if (currentImageIndex > 0) {
                currentImageIndex--;
                showImage(currentImageIndex);
                updateProgressBars(currentImageIndex);
                startAutoplay();
            } else if (currentStoryIndex > 0) {
                // Переход к предыдущему сторис
                currentStoryIndex--;
                const prevBlock = blocksData[currentStoryIndex];
                currentImageIndex = prevBlock && prevBlock.images ? prevBlock.images.length - 1 : 0;
                if (prevBlock && prevBlock.images) {
                    showStory(currentStoryIndex);
                    createProgressBars(prevBlock.images.length);
                    showImage(currentImageIndex);
                    updateProgressBars(currentImageIndex);
                    startAutoplay();
                }
            }
        }
    }

    // Обработка клавиатуры
    function handleKeydown(event) {
        if (!isModalOpen) return;

        switch (event.key) {
            case 'Escape':
                closeModal();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                handleImageNavigation('prev');
                break;
            case 'ArrowRight':
                event.preventDefault();
                handleImageNavigation('next');
                break;
        }
    }

    // Инициализация
    function init() {
        initPromoSlider();

        // Делегирование событий
        slider.addEventListener('click', (e) => {
            // Предотвращаем всплытие для навигации
            if (e.target.closest('.stories__nav-prev')) {
                e.preventDefault();
                e.stopPropagation();
                handleImageNavigation('prev');
                return;
            }
            
            if (e.target.closest('.stories__nav-next')) {
                e.preventDefault();
                e.stopPropagation();
                handleImageNavigation('next');
                return;
            }

            // Обработка кликов по превью
            if (e.target.closest('.slide-item')) {
                handlePreviewClick(e.target.closest('.slide-item'));
                return;
            }

            // Обработка закрытия
            if (e.target.closest('[data-modal-close]')) {
                closeModal();
                return;
            }

            // Обработка клика по оверлею (только если клик именно по оверлею)
            if (e.target.classList.contains('stories__overlay')) {
                closeModal();
                return;
            }
        });

        // Обработка клавиатуры
        document.addEventListener('keydown', handleKeydown);
    }

    init();
});