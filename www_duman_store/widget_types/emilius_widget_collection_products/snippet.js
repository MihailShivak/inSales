$(document).ready(() => {
    var $widget_collection = $widget,
        $favorites = $widget_collection.find("[data-type-select='get-favorites']"),
        articles = new Set();
    // const colorsImage = JSON.parse($widget.find("#colorsImages").attr("data-color-images") ?? "{}");

    function messageFail(onFail) {
        console.warn("[Сетка Товаров]", onFail);
    }

    function loaderHide(loader) {
        setTimeout(() => {
            loader?.hide();
        }, 250);
    }

    function drawIconColors(productsMatrix) {
        if (!productsMatrix|| !productsMatrix?.length) {
            console.warn("[Цвте] Ошибка иттерации цветов", productsMatrix);
            return;
        }
        console.log("Debug Colors", productsMatrix);
        for (const products of productsMatrix) {
            let colors = "", sku = "";
            for (const product of products) {
                const variant = product.variants?.[0];
                if (!variant) continue;
                if (!sku) sku = variant.sku;
                colors += `<span class="products-item__colors-item color"><img src="${ variant.option_values.find((option) => option.option_name_id == 1607435)?.image_url ?? "" }" class="entered _lazy-loaded"></span>`;
            }
            if (colors.length) {
                $(`[data-article="${sku}"] .products-item__colors`).html(colors);
            }
        }
    }

    async function setIconColors(newArticles) {
        if (!newArticles.length) {
            console.log("[Цвет] Артикулы не найдены");
            return;
        }
        try {
            const promises = newArticles.map(sku => 
                $.get('/search.json', {
                    q: sku,
                    page_size: 10
                })
            );
            drawIconColors( await Promise.all(promises) );
        }
        catch (err) {
            console.warn("[Цвета] Ошибка формирования поиска", err);
        }
    }

    function drawProducts(products, append=false) {
        let html = "", newArticles = [];
        for (const key in products) {
            const product = products[key], sku = product.variants[0].sku;
            html += Template.render({
                product_id: product.id,
                available: product.available,
                show_variants: (product.list_card_mode_with_variants === "show_variants"),
                
                isSoon: EM_Module.func.checkSoonCahrs(product.characteristics, product.url),
                isPreorder: EM_Module.func.checkPreorderChars(product.characteristics),
                // isCusctom: false,

                url: product.url,
                urlNotAvailable: window.EM_Module.func.extractSection(product.url),
                
                title: product.title,
                price: Shop.money.format(product.price ?? product.price_min),
                image: product.images.length > 0 && product.first_image.large_url,
                values: product.variants,
                badges: 
                    (product.url.includes("/novinki") ? EM_Module.Badges.renderBadgeHTML("Новинка") : "") 
                    + EM_Module.Badges.getBadges(product),

                isBadgeSale: product.url.includes("/sale"), 
                article: sku
            }, "widget-product");
            if (!articles.has(sku)) {
                newArticles.push(sku);
                articles.add(sku);
            }
            else if (append) newArticles.push(sku);
        }
        const setHTML = ($wrapper) => {
            if (append) $wrapper.append(html);
            else $wrapper.html(html);
        };
        setHTML( this.$block.find(".products-wrapper__list").attr("hidden", !html.length) );
        this.$block.find(".products-wrapper").attr("hidden", false);
        loaderHide(this.loader);

        // setIconColors(newArticles);
    }

    function getRecently(productIds) {
        if (productIds?.length) {
            Products.getList(productIds.slice(0, this.limit)).done(drawProducts.bind(this));
        }
        else {
            this.$block.find(".products-wrapper").attr("hidden", true);
            messageFail("Товаров нет");
            loaderHide(this.loader);
        }
    }

    function getFavorites() {
        const self = this;
        var count = 0;
        var timerId = setInterval(() => {
            if (count > 10) {
                clearInterval(timerId);
                self.$block.find(".products-wrapper").attr("hidden", true);
                loaderHide(self.loader);
                return;
            }
            count++;
    
            var favoritesState = FavoritesProducts.getFavoritesProducts();
            if (!favoritesState?.products || !favoritesState.products.length) return;
            else clearInterval(timerId);
            
            ( drawProducts.bind(self) )(favoritesState.products.slice(0, self.limit));
            loaderHide(self.loader);
        }, 250);
    }

    function setWidget($block) {
        const funcBind = (func) => {
            return func.bind({
                $block: $block,
                loader: loader,
                limit: limit
            });
        };

        const
            type = $block.find("[data-type-select]").attr("data-type-select") ?? "get-recetly-viewed",
            loader = new EM_Module.Loader($block.find('.products-wrapper__list:first'));
        let limit = Number($block.find("[data-limit-products]").attr("data-limit-products"));

        // ! Нужно доработать вывод нового избранного
        if (type === "get-favorites") return; 
        if (type === "get-recommended") {
            if ($block.find(".products-wrapper .products-wrapper__list > *").length > 0) {
                $block.find(".products-wrapper").attr("hidden", false);
            }
            return;
        }
        if (isNaN(limit)) limit = 12;
        
        loader.call();
        if (type === "get-recetly-viewed") {
            Products.getRecentlyViewed().done(funcBind(getRecently));
        }
        else if (type === "get-favorites") {
            // ! Нужно доработать вывод нового избранного
            // funcBind(getFavorites)();
        }
        else {
            $block.find(".products-wrapper").attr("hidden", true);
        }
    }

    function initBlock() {
        const isFavorites = window.location.pathname.includes("/favorites");
        let count = 0;
        for (const block of $widget_collection) {
            const $block = $(block);
            if (!isFavorites || $block.find("[data-show-block]:first").attr("data-show-block") !== "true") {
                setWidget($block);
            }
            else count++;
        }
        if (!(count != 0 && isFavorites)) return;
        // if (count == 0) {
        //     setTimeout(() => {
        //         FavoritesProducts.update();
        //     }, 50);
        // }

        // if (count == 0 || !isFavorites) {
        //     EventBus.subscribe('update_items:insales:favorites_products', function (data) {
        //         if (data.action.method == "add_item") {
        //             (drawProducts.bind({
        //                 $block: $favorites,
        //                 loader: {hide() {}}
        //             }))(
        //                 [data.products.find((item) => item.id == data.action.item)], true
        //             );
        //         }
        //         else if (data.action.method == "remove_item") {
        //             $favorites.find(`[data-cust-product-id="${data.action.item}"]`).remove();
        //         }
        //     }); 
        //     return;
        // }

        // EventBus.subscribe('update_items:insales:favorites_products', function (data) {
        //     if (data.products?.length === 0) {
        //         let count = 0;
        //         for (const block of $widget_collection) {
        //             const $block = $(block);
        //             if ($block.find("[data-show-block]:first").attr("data-show-block") === "true") {
        //                 setWidget($block);
        //                 count++;
        //             }
        //         }
        //     }
        // });

        EM_Module.Badges.renderBadgesInHTML($favorites);
    }

    EventBus.subscribe('eventLoader', initBlock);
});