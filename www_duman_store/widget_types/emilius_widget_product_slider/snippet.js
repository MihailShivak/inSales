// Слайдеры через js
(() => {
    const isMobile = sessionStorage.getItem('isMobile') === 'true';
    const sliders = document.querySelectorAll("[data-em-slider]");

    function preloadSource(source) {
        if (!source || !source.dataset.srcset) return Promise.resolve();
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = resolve;
            img.srcset = source.dataset.srcset; // Триггерит все варианты
            img.src = source.dataset.srcset.split(',')[0].trim().split(' ')[0]; // fallback
        });
    }

    function preloadImage(img) {
        return new Promise((resolve, reject) => {
            const loader = new Image();
            loader.onload = () => {
                // Применяем загруженные данные
                const picture = img.closest('picture');
                const source = picture.querySelector('source');
                
                if (source) {
                    source.srcset = source.dataset.srcset;
                }
                img.src = img.dataset.src;
                img.classList.add('_lazy-loaded');
                resolve(loader);
            };
            loader.onerror = reject;
            loader.src = img.dataset.src;
        });
    }

    function loadImageAsync(picture) {
        return Promise.all([
            preloadSource(picture.querySelector('source')),
            preloadImage(picture.querySelector('img'))
        ]);
    }

    // Добавить обрабтку ошибок
    function preloadInBatches(wrapper) {
        const batchSize = 100;

        const imgElements = Array.from(wrapper.querySelectorAll("picture"));
        for (let i = 0; i < imgElements.length; i += batchSize) {
            const batch = imgElements.slice(i, i + batchSize).map(
                picture => loadImageAsync(picture)
            );
            // Promise.allSettled(batch);
            Promise.all(batch).catch(err => console.error('Batch error:', err));
        }
    }

    // Установка иконок
    function setIconInCart() {
        if (!Cart.order?.order_lines) return;
        for (const order of Cart.order.order_lines) {
            for (const product of document.querySelectorAll(`[data-cust-product-id="${order.product_id}"]`)) {
                const btnAdd = product.querySelector(".products-item__action-addcart");

                if (btnAdd) {
                    btnAdd.classList.add("_active");
                }
            }
        }
        FavoritesProducts.update();
    }

    function getSliderJSON(block) {
        try {
            const script = block.querySelector("script[type='application/ld+json']");
            if (script) {
                return JSON.parse(script.innerHTML);
            }
        } catch (err) {
            console.error("[AJAX.Slider] Ошибка парсинга данных", err);
        }
        return null;
    }

    function drawSlider(slider, products, handle) {
        // console.log("[EM.Slider.drawSlider]", handle, slider, products);
        let html = "";
        for (const product of products) {
            html += Template.render({
                product: product,
                urlNotAvailable: window.EM_Module.func.extractSection(product.url),

                isSoon: EM_Module.func.checkSoonCahrs(product.characteristics, product.url),
                isPreorder: EM_Module.func.checkPreorderChars(product.characteristics),

                // !Переделать: подумать как сделать динамический размер фото
                // image: product.images.length > 0 && product.first_image.original_url,
                
                badgesHTML: EM_Module.Badges.getBadges(product),
                image: EM_Module.func.getImage(product.first_image),
                // image: product.images.length > 0 && product.first_image.large_url,
            }, "item-slider") ?? "";
        }

        const wrapper = slider.querySelector(".swiper-wrapper");
        if (html.length > 0 && wrapper) {
            wrapper.innerHTML = html + `<div class="products-slider__slide products-item swiper-slide" data-js="product-item">
                <div class="products-item__img-wrapper">
                    <a href="/collection/${handle}" class="products-item__img products-item__more" target="_blank">
                        <div class="products-item__more-text">Смотреть все</div>
                    </a>
                </div>
            </div>`;

            // preloadInBatches(wrapper);
            // const loader = new AsyncImageLoader({
            //     selector: wrapper,
            //     imageLoadedClass: 'loaded',
            //     errorClass: 'load-error',
            //     timeout: 10000
            // });

            // loader.loadAll();

            return new Promise(resolve => {
                requestAnimationFrame(() => resolve(slider));
            });
        } else {
            slider.setAttribute("hidden", true);
            return Promise.resolve(slider);
        }
    }

    const promiseEventBus = () => new Promise(r => EventBus.subscribe("eventLoader", r, { once: true }));

    async function getProductsSlider(slider) {
        if (!slider) return Promise.resolve();
        
        const data = getSliderJSON(slider);
        if (!data) {
            slider.setAttribute("hidden", true);
            return Promise.resolve(slider);
        }

        try {
            const result = await ajaxAPI.collection.get(data.handle, {}, {
                page: 1,
                page_size: !data.limit ? 15 : data.limit
            });
            // console.log("[AJAX.Slider] Загружен:", slider, result.status, result, data);
            
            if (result.status === "ok" && result.count > 0) {
                // await drawSlider(slider, result.products, data.handle);
                if (window.EM_Module?.func === undefined) await promiseEventBus();
                await drawSlider(slider, result.products, data.handle);
            } else {
                slider.setAttribute("hidden", true);
            }
        } catch (err) {
            console.warn("[AJAX.Slider] Ошибка загрузки слайдера:", err);
            slider.setAttribute("hidden", true);
        }
        return slider;
    }

    function setIcons(renderedSliders) {
        EM_Module.Wishlist.forceUpdate();

        (new EM_Module.Colors( $(renderedSliders) )).drawColors();
        setIconInCart();
    }

    if (sliders.length > 0) {
        Promise.all(
            Array.from(sliders).map(slider => getProductsSlider(slider))
        )
        .then((renderedSliders) => {
            console.log("[AJAX.Sliders] Все слайдеры отрисованы:", renderedSliders.length);
            
            if (!renderedSliders.length) return;
            if (window.EM_Module?.Colors) setIcons(renderedSliders);
            else EventBus.subscribe("eventLoader", () => setIcons(renderedSliders));
            
            document.body.classList.add("settings_loaded");
        })
        .catch((err) => {
            console.error("[AJAX.Sliders] Критическая ошибка:", err);
        });
    }
})();