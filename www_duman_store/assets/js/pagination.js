// Модуль работы с блоком пагинации
window.EM_Module.Pagination = class {
    constructor($container, isMobile) {
        this.data = {
            container: "em-pagin",
        }
        this.classes = {
            slider: "pagin__slider",
            btn: "pagin__btn",
            disabledPagind: "pagin__body-disabled",
            disabled: "pagin__disabled",
            action: "pagin__action",
            disabled: "pagin__disabled"
        };
        this.$pagin = $container.find(`[data-${this.data.container}]:first`);
        this.wrapperSlider = this.$pagin.find(".pagin__wrapper:first").get(0);
        this.slider = this.$pagin.find(`.${this.classes.slider}`).get(0);
        this.$input = this.$pagin.find("input[name='em-pagin']");
        this.$arrows = this.$pagin.find(`.${this.classes.btn}`);
        // this.$pagin.each(function() {
        this.isMobile = isMobile;

        // this.page = 0;
        this.startX = 0;
        this.offsetX = 0;
        this.isDragging = false,
        this.animationID = null;
        this.len = 32 + 10;
        this.maxCount = 5;

        this.params = {
            KOEFF_SPEED: isMobile ? 1.2 : 2.1,
            // KOEFF_SHIFT: 0.25
        }
        this.isInit = false;
        // this.setAttribute("data-" + this.data.container, index);
    }

    init(page, newCount) {
        const count = newCount ? newCount : Number(this.$pagin.attr(`data-${this.data.container}`));

        if (page < 1 || count == 1) {
            // this.$pagin.find(`.${this.classes.btn}`).attr("hidden", true);
            this.$pagin.attr("hidden", true);
            if (this.slider) this.slider.innerHTML = "";
            return;
        }
        if (!this.$pagin.length || !this.slider) {
            this.throwException("Ошибка инициализации, не найдена пагинация");
        }
        else if (!count || count < 1 || count > 100) {
            this.$pagin.attr("hidden", true);
            this.slider.innerHTML = "";
            this.throwException("Ошибка инициализации пагинации:", `page=${page ?? 1}, count=${count}`);
        }

        // if (page < 1) page = 1;
        this.page = page > count ? 1 : (page ?? 1);
        this.count = count;

        const pathname = window.location.pathname;
        const querySearch = this._getQuery(pathname);
        
        let html = "";
        for (let i = 1; i < count + 1; i++) {
            html += `<a href="${pathname}?page=${i}${querySearch}" class="pagin__number${i == page ? ` ${this.classes.action}`:""}" data-pagin-index="${i}" draggable="false">${i}</a>`;
        }
        if (count < this.maxCount + 1) {
            this.$pagin.find(`.${this.classes.btn}`).attr("hidden", true);
        }
        else if (this.page == 1 || this.page == count) {
            this.$pagin
                .find(`.${this.classes.btn}:${this.page == 1 ? "first" : "last"}`)
                .addClass(this.classes.disabled);
            this.$pagin.find(`.${this.classes.btn}`).removeAttr("hidden");
        }
        this.slider.innerHTML = html;

        this.offsetX = this._getOffsetX(page);
        this.slider.style.transform = `translate(${this.offsetX}px, 0)`;

         this.$pagin.removeAttr("hidden");
        this.isInit = true;
    }

    initEvent() {
        if (!this.wrapperSlider || !this.slider) return;

        this.$pagin.on("click", `.${this.classes.btn}`, this.onPaginArrow.bind(this));
        // this.$pagin.find(`.${this.classes.slider}`).on("click", ".pagin__number", this.onPaginBtn.bind(this));
        // this.$input.on("change", function() {
        //     console.log(this.value);
        // });
        if (this.count <= this.maxCount) return;
        // Свайп
        if (this.isMobile) {
            this.wrapperSlider.addEventListener("touchstart", this.swipeStart.bind(this));
            this.wrapperSlider.addEventListener("touchmove", this.swipeMove.bind(this));
            this.wrapperSlider.addEventListener("touchend",  this.swipeEnd.bind(this)); 
        }
        else {
            this.wrapperSlider.addEventListener("mousedown", this.swipeStart.bind(this));
            this.wrapperSlider.addEventListener("mousemove", this.swipeMove.bind(this));
        }
    
        // Отпуск 
        this.wrapperSlider.addEventListener("mouseup",  this.swipeEnd.bind(this));
        this.wrapperSlider.addEventListener("mouseleave", this.swipeEnd.bind(this));
    }

    onPaginBtn(event) {
        this.switchPage(
            Number(event.currentTarget.dataset.paginIndex)
        );
    }

    onPaginArrow(event) {
        const isLeft = event.currentTarget.dataset?.paginRight === undefined;

        let page = this.page + (isLeft ? -1 : 1);
        if (page < 1 || page > this.count) {
            event.currentTarget.classList.add(this.classes.disabled);
            if (this.count > this.maxCount) {
                this.$arrows[isLeft ? 1 : 0].classList.remove(this.classes.disabled);
            }
            // this.offsetX = this._getOffsetX(page);
        }
        else {
            // this.$pagin.find(`[data-pagin-index="${this.page}"]`).removeClass(this.classes.action);
            // this.$pagin.find(`[data-pagin-index="${page}"]`).addClass(this.classes.action);

            this.page = page;
            // // this.$input.val(page);
            // this.$input.val(page).trigger("change");
            this._changeArrowsAttr(page);

            this.offsetX = this._getOffsetX(page - 1);
            this.slider.style.transform = `translate(${this.offsetX}px, 0)`;
        }
        // window.scrollTo(0, 0);
    }

    swipeStart(event) {
        let evt = this.returnEvent(event);
        
        this.isDragging = true;
        this.cursorPntX = this.offsetX;
        this.startX = evt.clientX;
    
        this.animationID = requestAnimationFrame(this._animation.bind(this));
    }

    swipeMove(event) {
        if (!this.isDragging) return;
    
        const evt = this.returnEvent(event);
        this.offsetX = this.cursorPntX - this.params.KOEFF_SPEED*(this.startX - evt.clientX);
    }

    swipeEnd() {
        if (!this.isDragging) return;
        
        cancelAnimationFrame(this.animationID);
    
        this.offsetX = this._getOffsetX();
        this.page = this._getCurretnPage();
        this._changeArrowsAttr(this.page);

        this.isDragging = false;
        this._setPositionSlide();
    }

    _animation() {
        this._setPositionSlide();
    
        if (this.isDragging) requestAnimationFrame(this._animation.bind(this));
    }

    _getOffsetX(page) {
        const temp = page ?? -this.offsetX / this.len;
        let action;

        if (temp < 0 || temp < this.maxCount) {
            action = 0;
        }
        else if (temp + this.maxCount > this.count) {
            action = this.count - this.maxCount;
        }
        else {
            action = Math.floor(temp);
        }
        return -action * (this.len);
    }

    _getCurretnPage() {
        const page = Math.ceil(-this.offsetX / this.len) + 1;

        if (page < 1) return 1;
        else if (page > this.count) return this.count;
        return page
    }

    _getQuery(pathname) {
        if (!pathname.includes("/search")) return "";

        return "&q=" + (new URLSearchParams(window.location.search)).get('q') ?? "";
    }

    _changeArrowsAttr(page) {
        const $arrows = this.$arrows;
        if (page + this.maxCount > this.count) {
            $arrows[1].classList.add(this.classes.disabled);
            $arrows[0].classList.remove(this.classes.disabled);
         }
         else if (page == 1) {
            $arrows[0].classList.add(this.classes.disabled);
            if (page < this.count) {
                $arrows[1].classList.remove(this.classes.disabled);
            }
         }
         else {
            $arrows.removeClass(this.classes.disabled);
         }
    }

    // Переключение выбранного пункта в пагинации
    switchPage(newPage) {
        if (newPage === undefined || isNaN(newPage) || newPage == this.page) return;

        this.$pagin.find(`[data-pagin-index="${this.page}"]`).removeClass(this.classes.action);
        this.$pagin.find(`[data-pagin-index="${newPage}"]`).addClass(this.classes.action);
        this.page = newPage;
        // this.$input.val(newPage);
        // this.$input.val(newPage).trigger("change");
        this._changeArrowsAttr(newPage);
        this.offsetX = this._getOffsetX(newPage - 1);
        this.slider.style.transform = `translate(${this.offsetX}px, 0)`;

        // window.scrollTo(0, 0);
    }
    
    _setPositionSlide() {
        this.slider.style.transform = `translate(${this.offsetX}px, 0px)`;
    }

    returnEvent(evt) {
        return evt.changedTouches === undefined ? evt : evt.changedTouches[0]; 
    }

    disabled(isOn) {
        if (isOn) this.$pagin.addClass(this.classes.disabled);
        else this.$pagin.removeClass(this.classes.disabled);
    }

    hide(isHide) {
        this.$pagin.attr("hidden", isHide);
    }

    printWarn(mess, params="") {
        console.warn("[Pagin]", mess, params);
    }

    printError(mess, params="") { 
        console.error("[Pagin]", mess, params);
    }

    throwException(mess) {
        throw new Error(`[Pagin] ${mess}`);
    }
}
;
