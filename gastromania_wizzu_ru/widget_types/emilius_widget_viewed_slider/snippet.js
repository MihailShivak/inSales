$(document).ready(async () => {
    const MIN_QUANTITY = 3; // Минимальный остаток товара
    
    var $viewed = $widget,
        $wrapper = $viewed.find(".swiper-wrapper:first");

    function updateNavigationVisibility(swiper) {
        const $btn = $viewed.find(".viewed__arrows:first");

        if (!swiper.slides.length || !swiper.$wrapperEl.length) {
            $btn.attr("hidden", true);
            return;
        }
        
        const wrapperWidth = swiper.$wrapperEl[0].offsetWidth;
        const slidersWidth = swiper.slides[0].offsetWidth * swiper.slides.length;
        
        if (slidersWidth <= wrapperWidth) {
            $btn.attr("hidden", true);
        } else {
            $btn.removeAttr("hidden");
        }
    }

    function initSlider() {
        new Swiper($viewed.find(".swiper").get(0), {
            slidesPerView: 2,
            spaceBetween: 30,
            navigation: {
                // nextEl: $viewed.find(".swiper-btn-prev").get(0),
                // prevEl: $viewed.find(".swiper-btn-next").get(0)
                nextEl: ".swiper-btn-next",
                prevEl: ".swiper-btn-prev",
            },
            breakpoints: {
                760: {
                    slidesPerView: 'auto'
                }
            },
            on: {
                init: function () {
                    updateNavigationVisibility(this);
                },
                resize: function () {
                    updateNavigationVisibility(this);
                }
            }
        });
    }

    // Отрисовка продуктов
    async function drawViewedProduct() {
        const ids = await Products.getRecentlyViewed();
        if (!ids?.length) return;
    
        const maxProducts = Number($wrapper.find("[data-products-limit]").attr("data-products-limit"));
        const products = await Products.getList(
            ids.splice(0, maxProducts ? maxProducts : 10)
        );

        let html = "";
        for (const key in products) {
            const product = products[key];
            if (product.variants.length == 0 || product.variants[0].quantity < MIN_QUANTITY) continue;

            const isOld = Number(product.price) < Number(product.old_price),
                order = Cart.order.getItemByID(product.variants[0].id),
                gram = EM_Module.props.getCharacteristicGram(product.characteristics);
            
            html += Template.render({
                avialable: true,
                product_id: product.id,
                variant_id : product.variants[0].id,
                url: product.url,
                title: product.title,
                descript: product.short_description ? product.short_description.slice(0, 12) : "",
                image: product.first_image.large_url.replace('static.insales-cdn.com', 'ibicecdn.com/wizzu'),

                maxQuantity: EM_Module.props.getMaxQuantityProp(product),
                package: gram && gram < 11 
                    ? (1 / gram).toFixed(1).replace(/\.0$/, '') 
                    : EM_Module.props.getCharacteristic(product),
                unit: EM_Module.props.getCharacteristicPermalink(product, "unit"),
                quantity: order ? order.quantity : 0,
                gram: gram && gram < 11 ? gram : 0,

                priceNotFormat: Number(product.price),
                price: Shop.money.format(product.price),
                old_price: isOld ? product.old_price : 0,
                deltPrice: isOld ? Math.floor((1 - Number(product.price) / Number(product.old_price)) * 100) : "",
                isInCart: order !== undefined
            }, "product-viewed");
        }

        if (html.length) {
            $wrapper.append(html);
            $viewed.find(".viewed:first").removeAttr("hidden");
            setTimeout(initSlider, 250);
        }
        return html.length > 0;
    }
    

    if (await !drawViewedProduct() || !$viewed.length) return;
});