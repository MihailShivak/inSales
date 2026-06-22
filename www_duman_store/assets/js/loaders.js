// Новый лоадер с 2 типами: обычный и скелетон
window.EM_Module.Loaders = {
    // Скелетон загрузки
    Skeleton: class {
        constructor($block) {
            this.$block = $block;
            // this.isMobile = sessionStorage.getItem('isMobile') === 'true';
            this.template = "<div class='catalog__list-item products-item loading-item'><div class='products-item__img-wrapper'><div class='products-item__img'></div></div></div>";
        }
        
        show(count, clear) {
            this.$block.addClass("loading");
            if (clear) {
                this.$block.html(this.template.repeat(count));
            }
            else {
                this.$block.append(this.template.repeat(count));
            }
        }

        hide(html = "") {
            // ! Нужно задать css свойство "transition: opacity 0.2s ease;" для блока this.$block
            this.$block
                .removeClass("loading")
                .css("opacity", "0.5")
                .one("transitionend", () => {
                    this.$block
                        .html(html)
                        .css("opacity", "1");
                });
        }
    },

    // Лоадер загрузки
    // ! Изменить вызовы: callStatic -> call, hideStatic -> hide
    Loader: class {
        constructor($wrapper, $staticBlock = null) {
            this.$_wrapper = $wrapper; // Блок, в котором лоадер
            this._$staticBlock = $staticBlock; // Лоадер из вертски

            this.className = "local-loader";
            this.svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><style>.spinner_b2T7{animation:spinner_xe7Q .8s linear infinite}.spinner_YRVV{animation-delay:-.65s}.spinner_c9oY{animation-delay:-.5s}@keyframes spinner_xe7Q{93.75%,100%{r:3px}46.875%{r:.2px}}</style><circle class="spinner_b2T7" cx="4" cy="12" r="3"/><circle class="spinner_b2T7 spinner_YRVV" cx="12" cy="12" r="3"/><circle class="spinner_b2T7 spinner_c9oY" cx="20" cy="12" r="3"/></svg>';
        }

        /**
         * Показать лоадер
         * @param {JQuery} $wrapper Блок, в котором добавляется лоадер
         */
        call($wrapper = this.$_wrapper) {
            const $existing = $wrapper.find(`.${this.className}`);

            if ($existing.length > 0) $existing.remove();
            $wrapper.append(`<div class="${this.className}">${this.svg}</div>`);
        }

        /**
         * Скрыть лоадер
         * @param {JQuere} $wrapper Блок, в котором скрывается лоадер
         */
        hide($wrapper = this.$_wrapper) {
            $wrapper.find(`.${this.className}`).remove();
        }

        /**
         * Изменение отображения лоадера
         * @param {Boolean} isShow Показать / скрыть лоадер
         */
        visibleLoader(isShow = true) {
            if (this._$staticBlock) this._$staticBlock.attr("hidden", !isShow);
        }

        /**
         * Получить кол-во лоадеров
         * @param {JQuere} $wrapper Блок, в котором ищутся лоадеры
         * @returns {Number} Кол-во найденных лоадеров
         */
        checkPreloader($wrapper = this.$_wrapper) {
            return $wrapper.find(`.${this.className}`).length > 0;
        }

        callAdd(container) {
            if (!container) return;
            container.insertAdjacentHTML("beforeend", 
                `<div class="loader-added">
                    <div class="loader-icon_added"></div>
                    <p>Товар добавлен в корзину</p>
                </div>`
            );
            setTimeout(() => {
                container.querySelector(".loader-added")?.remove();
            }, 3000);
        }
    }
};
