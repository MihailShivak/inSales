window.EM_Module = window.EM_Module || {};
// if (!window.EM_Module) window.EM_Module = {};

// Модуль фильтров
window.EM_Module.Filters = class {
  constructor(data = {}) {
    this._name = "[EM.Filters]";
    this._inited = false; // Инициализация
    this._loading = false; // Выполнение запроса
    this._ending = false; //
    this._availableLocalStorage = true; // Провекра работы LocalStorage

    this.typePage = window.location.pathname.includes("/favorites")
      ? "wishlist"
      : "search";

    this.nameEvent = "em_filter:update";
    this.nameKeyCached = "em_cached_filter:" + this.typePage;

    this.$filtres = $("#filters"); // Общий блок фильтров, включая ПК
    this.$filtresMob = null; // Мобильный блок фильтров
    this.$filtresMobColor = null; // Мобильный блок фильтров цветов
    this.$panelSelectFilters = this.$filtres.find(".selected-filters:first"); // Панель выбранных фильтров

    this.$btnMore = $("[data-load-more]:first"); // Кнопка "Загрузить еще"
    this.$btnMobApply = null; // Кнопка применения моб фильтров
    this.$btnReset = null; // Кнопка сброса фильтров без применения
    this.$btnResetColor = null; // Кнопка сброса фильтров без применения
    this.$btnMobCounter = null;

    this.filters = {}; // Хранение параметров фильтров

    this.currentPage = data.currentPage ?? 1;
    this.pageSize = data.pageSize ?? 16;
    this.clientID = null;

    // Режим каталога: использовать фильтры из Liquid, не запрашивать API
    this.modeCatalog = data.mode === "catalog" || data.skipFetch === true;
    this.typeFiltersFetch = data.favorites === "favorites";

    // Примененные фильтры
    this.applied = {
      quantity: 0,
      quantityColor: 0,
      change: false,
      sort: false,
    };

    // ID фильтров
    this.filtersID = {
      color: 1607435,
    };

    // События у фильтров
    this.typesEvent = {
      init: "init", // Инициализация фильтров
      change: "change", // Изменение фильтров
      render: "render", // Отрисовка фильтров
      remove: "remove", // Удаление фильтров
      clear: "clear", // Очистка
    };

    // Список доступных шаблонов
    this.templates = {
      filterSelected: "filter-selected", // Шаблон выбранного фильтра
      filterSelectedPrice: "filter-selected-price", // Шаблон выбранного фильтра цены

      // ПК шаблоны
      filterItem: "filter-item", // Шаблон фильтра
      filterItemPrice: "filter-price", // Шаблон фильтра цен

      // Мобильные шаблоны
      filterMobItem: "filter-item-mob", // Шаблон фильтра
      filterMobColor: "filter-color-mob", // Шаблон фильтра цветов
      filterPopupMobColor: "filter-popup-color-mob", // Шаблон попапа фильтра цветов
      filterMobItemPrice: "filter-price-mob", // Шиблон фильтра цен
    };

    this.TTL_MS = 60 * 60 * 1000; // 1 час
  }

  async init() {
    // ! Перенести в другое место
    this.isMobile = sessionStorage.getItem("isMobile") === "true"; // Проверка типа устрйства
    this.isMobStyle = window.matchMedia("(max-width: 63.9988em)").matches; // Провекра размера экрана

    if (this.isMobStyle) {
      this.$filtresMob = $("[data-mob-popup='filters']:first");
      this.$filtresMobColor = $("[data-mob-popup='filter-colors']:first");

      this.$btnMobApply = this.$filtresMob.find("[data-mob-apply]:first");
      this.$btnReset = this.$filtresMob.find(
        "[data-mob-btn-clear='filters']:first",
      );
      this.$btnMobCounter = this.$filtres.find(
        "[data-mob-popup-open]:first .icon-counter",
      );

      this.$btnResetColor = this.$filtresMobColor.find(
        "[data-mob-btn-clear='filter-colors']:first",
      );
    }

    this.readingFilters();
    this.initEvent();
  }

  initEvent() {
    /*** Общие слушатели ***/
    document.addEventListener("click", this.click.bind(this));
    document.addEventListener("change", this.change.bind(this));

    /*** Мобильные слушатели ***/
    if (this.isMobStyle) {
      this.$filtresMob.on("click", this.clickMob.bind(this));
      this.$filtresMob.on("change", this.changeMob.bind(this));

      // Сброс выбранных цветов в попапе фильтров
      this.$filtresMobColor.on(
        "click",
        "[data-mob-btn-clear='filter-colors']",
        () => this.clearColorMobFilters(false),
      );
    } else {
      /*** ПК слушатели ***/
      // Выбор сортировки (кастомный селект или нативный)
      const $customSort = this.$filtres.find(".select_catalog-sort:first");
      if ($customSort.length) {
        $customSort.on("click", ".select__option", this.changeSort.bind(this));
      } else {
        this.$filtres
          .find(".catalog__sort:first")
          .on("change", this.changeSort.bind(this));
      }

      // Применение фильтров
      document.addEventListener("click", (e) => {
        if (
          this.applied.change &&
          !e.target.closest(".filters__body") &&
          !e.target.closest(".filters__title-wrapper")
        ) {
          this.applyPCiltres();
        }
      });
    }
  }

  // Общий слушатель
  click(e) {
    // Очистка фильтров
    if (e.target.hasAttribute("data-clear-filtres")) {
      this.clearFilters();
    }
    // Удаление фильтра
    else if (e.target.hasAttribute("data-remove-filter")) {
      this.removeFilter(e.target.closest(".selected-filters__item"));
    }
  }

  // Мобильный слушатель
  clickMob(e) {
    // Применение выбранных фильтров
    if (e.target.hasAttribute("data-mob-apply")) {
      this.applyMobFiltres();
    }

    // Сброс выбранных фильтров
    else if (e.target.getAttribute("data-mob-btn-clear") === "filters") {
      this.clearFilters(false);
    }

    // Кнопка "Загрузить еще"
    else if (e.target.hasAttribute("data-load-more")) {
      this.nextPages();
    }
  }

  // Общий слушатель
  change(e) {
    // Изменение состояние фильтра цены
    if (e.target.classList.contains("price-filter__input")) {
      this.changePriceFilter(e.target);
    }

    // Изменение состояние фильтра
    else if (
      e.target.classList.contains("checkbox__input") ||
      e.target.classList.contains("checkbox-btn__input")
    ) {
      this.changeFilter(e.target);
    }
  }

  // Мобильный слушатель
  changeMob(e) {
    // Выбор сортировки
    if (e.target.name == "filters-sort") {
      this.changeSort(e);
    }
  }

  // Изменение состояние фильтра
  changeFilter(input) {
    const isMobFilter =
      input.classList.contains("checkbox-btn__input") ||
      input.dataset.index !== undefined;
    const filterID = input.getAttribute("data-property-id");
    const filterItemID = input.value;

    if (!filterID || !filterItemID) return;

    const img = input.parentElement.querySelector("img");
    const title = input.parentElement.querySelector(
      isMobFilter ? ".checkbox-btn__text" : ".checkbox__text",
    );

    // Передача состояния между попапом цветов и селектом (мобилка)
    if (
      isMobFilter &&
      input.dataset.index !== undefined &&
      Number(input.dataset.index) < 8
    ) {
      this.$filtresMob
        .find(`.checkbox-btn__input[value="${filterItemID}"]`)
        .attr("checked", input.checked);
    } else if (isMobFilter && filterID === String(this.filtersID.color)) {
      this.$filtresMobColor
        .find(`.checkbox__input[value="${filterItemID}"]`)
        .attr("checked", input.checked);
    }

    if (filterID === String(this.filtersID.color)) {
      this.applied.quantityColor += input.checked ? 1 : -1;
    } else {
      this.applied.quantity += input.checked ? 1 : -1;
    }
    this.visibleBtnsFilters(true);

    if (input.checked) {
      this.addFilter(
        {
          id: filterID,
          itemID: filterItemID,
          title: title?.innerText ?? "Фильтр",
          img: img?.src,
        },
        false,
      );
    } else {
      this.removeFilter(
        this.$panelSelectFilters
          .find(`[data-selected-filter-id="${filterItemID}"]:first`)
          .get(0),
      );
    }
  }

  // Изменение сортировки
  changeSort(e) {
    let typeSort;
    if (e.target.localName === "input") {
      typeSort = e.target.value;
    } else if (e.target.localName === "select") {
      typeSort = e.target.value;
    } else {
      typeSort = e.target.dataset?.value;
    }

    if (!typeSort) return;
    if (e.target.localName !== "input" && e.target.localName !== "select") {
      $(e.target.parentElement).find("._active").removeClass("_active");
      e.target.classList.add("_active");
    }
    this.applied.sort = true;
    this.visibleBtnsFilters(true);

    if (!this.isMobStyle) {
      this.currentPage = 1;
      this.applied.change = false;
      this._saveToURL();
      EventBus.publish(this.nameEvent, {
        added: {
          id: "sort",
          type: this.getNameSort(typeSort),
        },
        method: this.typesEvent.change,
        filters: this.filters,
      });
    }
  }

  // Изменение цены
  changePriceFilter(input) {
    const wrapper = input.closest(".price-filter__inputs");

    const inputPriceMin = wrapper.querySelector("input[name='price_min']");
    const inputPriceMax = wrapper.querySelector("input[name='price_max']");

    if (!inputPriceMin || !inputPriceMax) return;

    const priceMin = Number(inputPriceMin.getAttribute("data-range-from"));
    const priceMax = Number(inputPriceMax.getAttribute("data-range-to"));
    const selectPriceMin = Number(inputPriceMin.value);
    const selectPriceMax = Number(inputPriceMax.value);

    if (
      isNaN(priceMin) ||
      isNaN(priceMax) ||
      isNaN(selectPriceMin) ||
      isNaN(selectPriceMax)
    ) {
      this.removeFilter(
        this.$panelSelectFilters.find("[data-filter-id='price']:first").get(0),
      );
      return;
    }

    if (selectPriceMin > priceMin || selectPriceMax < priceMax) {
      this.applied.quantity++;
      this.addFilterPrice(
        {
          id: "price",
          priceMin: Math.max(priceMin, selectPriceMin),
          priceMax: Math.min(priceMax, selectPriceMax),
        },
        false,
      );
    } else {
      this.applied.quantity--;
      this.removeFilter(
        this.$panelSelectFilters.find("[data-filter-id='price']:first").get(0),
      );
    }
    this.visibleBtnsFilters(true);
  }

  // Применение Фильтров на ПК
  applyPCiltres() {
    this.applied.change = false;
    this._saveToURL();
    EventBus.publish(this.nameEvent, {
      method: this.typesEvent.change,
      filters: this.filters,
    });
  }

  // Применение Фильтров на мобильной устройстве
  applyMobFiltres() {
    if (this.applied.change) {
      this.applied.change = false;
      this.$filtresMob.find("[data-mob-popup-close]:first").trigger("click");
      this._saveToURL();
      EventBus.publish(this.nameEvent, {
        method: this.typesEvent.change,
        filters: this.filters,
      });
    }
  }

  // Следующая страница в пагинации
  nextPages() {
    if (!this.currentPage) return;

    this.currentPage++;
    this.triggerSelectFiters();
  }

  /**
   * Изменение отображения кнопки "Загрузить еще"
   * @param {Boolean} isShow Показать / скрыть кнопку
   * @param {Boolean} isDisabled Вкл / выкл работу кнопки
   */
  visibleBtnMore(isShow = true, isDisabled = false) {
    this.$btnMore.attr({
      hidden: !isShow,
      disabled: isDisabled,
    });
  }

  // Изменение отображения кнопок в форме фильтров
  visibleBtnsFilters(isApply = false) {
    this.applied.change = isApply;

    if (!this.isMobStyle) return;

    this.$btnReset.attr("hidden", !isApply);
    this.$btnResetColor.attr("hidden", this.applied.quantityColor < 1);
    this.$btnMobApply
      .find("span")
      .text(isApply ? "Применить" : "Показать все товары");

    if (this.applied.quantity < 0) this.applied.quantity = 0;
    if (this.applied.quantityColor < 0) this.applied.quantityColor = 0;

    const counter =
      this.applied.quantity + this.applied.quantityColor + this.applied.sort;
    if (counter > 0) {
      this.$btnMobCounter.removeAttr("hidden").text(counter);
    } else {
      this.$btnMobCounter.attr("hidden", true);
    }
  }

  /**
   * Получить данные фильтров для каталога/поиска/вишлиста.
   *
   * В зависимости от режима возвращает либо объект (для catalog),
   * либо экземпляр FormData (для поиска/вишлиста).
   *
   * @param {boolean} isObject - Если true, возвращает объект фильтров (исп. в каталоге).
   *                             Если false, возвращает FormData (исп. в поиске/вишлисте).
   * @returns {Object|FormData} Данные фильтров для отправки в API.
   *
   * Структура возвращаемого объекта:
   * {
   *   order: string,
   *   page_size: number,
   *   page: number,
   *   options: { [filterID: string]: number[] },
   *   price_min?: number,
   *   price_max?: number
   * }
   *
   * Для FormData эти же поля добавляются как параметры формы,
   * а фильтры опций в формате options[ID][]
   */
  getSelectFilters(isObject = this.modeCatalog) {
    const $fitlers = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const priceMin = Number(
      $fitlers.find("input[name='price_min']:first").val(),
    );
    const priceMax = Number(
      $fitlers.find("input[name='price_max']:first").val(),
    );
    const priceRange = this._getPriceRange();

    // Если необходим обычный объект
    if (isObject) {
      const data = {
        order: this._getSelectSorting(),
        page_size: this.pageSize,
        page: this.currentPage,
        options: this._getOptionsFilters(),
      };

      if (!isNaN(priceMin) && priceMin > priceRange.min) {
        data.price_min = priceMin;
      }
      if (!isNaN(priceMax) && priceMax < priceRange.max) {
        data.price_max = priceMax;
      }
      return data;
    }

    // Если необходимы данные в виде FormData
    const formData = new FormData();
    formData.append("order", this._getSelectSorting() ?? "");
    formData.append("page_size", String(this.pageSize));
    formData.append("page", String(this.currentPage));

    if (!isNaN(priceMin) && priceMin > priceRange.min) {
      formData.append("price_min", String(priceMin));
    }
    if (!isNaN(priceMax) && priceMax < priceRange.max) {
      formData.append("price_max", String(priceMax));
    }

    const options = this._getOptionsFilters();
    Object.entries(options || {}).forEach(([filterID, values]) => {
      if (!Array.isArray(values)) return;
      values.forEach((value) => {
        formData.append(`options[${filterID}][]`, String(value));
      });
    });

    return formData;
  }

  /**
   * Получить диапазон цен (для проверки активности фильтра)
   * Использует filters.pricing из API или данные из DOM
   */
  _getPriceRange() {
    if (
      this.filters?.pricing?.min != null &&
      this.filters?.pricing?.max != null
    ) {
      return {
        min: Number(this.filters.pricing.min),
        max: Number(this.filters.pricing.max),
      };
    }
    const $f = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const $min = $f.find("input[name='price_min']:first");
    const $max = $f.find("input[name='price_max']:first");
    return {
      min: Number($min.attr("data-range-from") || $min.val() || 0),
      max: Number($max.attr("data-range-to") || $max.val() || Infinity),
    };
  }

  // Получить выбранные опции в фильтрах
  _getOptionsFilters() {
    let options = {};

    const $fitlers = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const className =
      (this.isMobStyle ? ".mob-popup__group" : ".filters__group") +
      "[data-filter-id]";

    for (const block of $fitlers.find(className)) {
      if (block.dataset.filterId == "sort" || block.dataset.filterId == "price")
        continue;

      const filterID = block.dataset.filterId;
      if (!filterID || !filterID.length) continue;

      let values = [];
      for (const input of $(block).find("input:checked")) {
        values.push(Number(input.value));
      }
      // if (values.length) options[propertyID] = values;
      if (values.length) {
        options[filterID] = values;
        // options.push({
        //     [filterID]: values
        // });
      }
    }

    return options;
  }

  // Получить примененную сортировку
  _getSelectSorting() {
    let value;
    if (this.isMobStyle) {
      value = this.$filtresMob.find(".options-sort__input:checked:first").val();
    } else {
      const $active = this.$filtres.find(
        ".select_catalog-sort .select__option._active:first",
      );
      value = $active.length ? $active.attr("data-value") : null;
      if (value == null) {
        value = this.$filtres.find(".catalog__sort option:selected").val();
      }
    }
    return this.getNameSort(value);
  }

  // Получить название сортировки
  getNameSort(value) {
    return this.modeCatalog
      ? this._getNameSortCatalog(value)
      : this._getNameSortWishlist(value);
  }

  // Получить название сортировки для каталога
  _getNameSortCatalog(value) {
    switch (value) {
      case "1":
        return "";
      case "2":
        return "popular";
      case "3":
        return "price";
      case "4":
        return "descending_price";
    }
    return "";
  }

  // Получить название сортировки для вишлиста
  _getNameSortWishlist(value) {
    switch (value) {
      case "1":
        return "";
      case "2":
        return "asc";
      case "3":
        return "desc";
    }
    return "";
  }

  // вызов события изменения фильтров
  triggerSelectFiters() {
    this.applied.change = false;
    EventBus.publish(this.nameEvent, {
      method: this.typesEvent.change,
      filters: this.filters,
    });
  }

  /**
   * Сохранить фильтры в localStorage с датой сохранения
   * @param {Object} data - объект для сохранения
   */
  saveFiltres(data) {
    if (this.typePage === "search" || !this._availableLocalStorage) return;
    try {
      localStorage.setItem(
        this.nameKeyCached,
        JSON.stringify({
          data: data,
          savedAt: Date.now(),
        }),
      );
    } catch (err) {
      console.warn(this._name, "Ошибка сохранения фильтров:", err);
      this._availableLocalStorage = false;
    }
  }

  // Чтение фильтров из памяти или, если его нет/неактуален, запросить новый
  async readingFilters() {
    if (this.modeCatalog) {
      this.filters = this.filters || {};
      this._checkInputsFromURL();
      this._restoreFromCheckedInputs();
      EventBus.publish(this.nameEvent, {
        method: this.typesEvent.init,
        filters: this.filters,
      });
      this._inited = true;
      return;
    }

    let cached;

    if (this.typePage === "wishlist") {
      try {
        const client = await ajaxAPI.shop.client.get();
        this.clientID = client?.authorized && client?.id ? client.id : null;
      } catch (_) {}
    } else {
      try {
        const data = localStorage.getItem(this.nameKeyCached);
        if (data) cached = JSON.parse(data);
      } catch (err) {
        console.warn(this._name, "Ошибка чтения фильтров из памяти:", err);
        this._availableLocalStorage = false;
      }
    }

    if (
      cached &&
      cached?.savedAt &&
      typeof cached.savedAt === "number" &&
      Date.now() - cached.savedAt < this.TTL_MS
    ) {
      this.filters = cached.data;
    } else {
      const formData = new FormData();
      formData.append("flow_id", "62b2caa5-7874-40a9-b7f2-1b9561fe9e83");

      if (this.clientID) {
        formData.append("customer[id]", this.clientID);
      }

      const newFitlers = await this.fetch(formData, "/filters", this.typePage);

      if (newFitlers && newFitlers?.options) {
        this.filters = newFitlers;
        this.saveFiltres(newFitlers, this.nameKeyCached);
      }
    }
    this.renderFilters();

    EventBus.publish(this.nameEvent, {
      method: this.typesEvent.init,
      filters: this.filters,
    });
    this._inited = true;
  }

  // Отрисовка фильтров
  renderFilters() {
    if (!this.filters.options || !this.filters.pricing) {
      this.$filtres.find("[data-filter-panel]:first").attr("hidden", true);
      console.warn(this._name, "Фильтры не найдены");
      return;
    }

    if (this.isMobStyle) this._renderMobFilters();
    else this._renderPCFilters();

    this._restoreFromURL();

    EventBus.publish(this.nameEvent, {
      method: this.typesEvent.render,
      filters: this.filters,
    });
  }

  // Рендер ПК фильтров
  _renderPCFilters() {
    const filtres = this.filters;

    // Фильтры цены
    const priceMin = Number(filtres.pricing.min ?? "0");
    const priceMax = Number(filtres.pricing.max ?? "0");

    let html = Template.render(
      {
        priceMin: Math.ceil(priceMin),
        priceMax: Math.floor(priceMax),
      },
      this.templates.filterItemPrice,
    );

    // Остальные фильтры
    // ! Дописать правильность вывода цветов
    for (const option of filtres.options) {
      if (!option.values.length) continue;

      html += Template.render(option, this.templates.filterItem);
    }

    if (html.length > 0) {
      // this.$filtres.find(".select_catalog-sort:first").after(html);
      this.$filtres.find(".catalog__filters-group:first").html(html);
      window.EM_Module.spollers([
        this.$filtres.get(0).querySelector(".catalog__filters-group"),
      ]);
      window.EM_Module.rangeInit();
    } else {
      this.$filtres.find(".catalog__filters-group:first").html("");
    }
  }

  // Рендер мобильных фильтров
  _renderMobFilters() {
    const filtres = this.filters;

    let html = "";
    for (const option of filtres.options) {
      if (!option.values.length) continue;

      html +=
        option.id == this.filtersID.color
          ? Template.render(option, this.templates.filterMobColor)
          : Template.render(option, this.templates.filterMobItem);

      Template.render(
        option,
        option.id == this.filtersID.color
          ? this.templates.filterMobColor
          : this.templates.filterMobItem,
      );

      if (option.id == this.filtersID.color && option.values.length > 8) {
        this.$filtresMobColor
          .find(".mob-popup__filter-list:first")
          .html(Template.render(option, this.templates.filterPopupMobColor));
      }
    }

    const priceMin = Number(filtres.pricing.min ?? "0");
    const priceMax = Number(filtres.pricing.max ?? "0");

    html += Template.render(
      {
        priceMin: Math.ceil(priceMin),
        priceMax: Math.floor(priceMax),
      },
      this.templates.filterMobItemPrice,
    );

    if (html.length > 0) {
      // this.$filtres.find(".select_catalog-sort:first").after(html);
      this.$filtresMob.find("[data-filter-id='sort']:first").after(html);
      window.EM_Module.rangeInit();
    } else {
      // this.$filtres.find(".catalog__filters-group:first").html("");
    }
  }

  // Принудительно обновить фильтры
  // ! Дописать
  forceUpdate() {
    this.currentPage = 1;
  }

  /**
   * Добавить фильтр
   * @param {Object} filter Фильтра: id, itemID, img (если есть)
   * @param {Boolean} isApply Добавить с примененеим фильтров
   */
  addFilter(filter, isApply = true) {
    if (!filter.id || !filter.itemID) return;

    this.$panelSelectFilters
      .find(`[data-selected-filter-id="${filter.itemID}"]`)
      .remove();
    this.$panelSelectFilters
      .find(".selected-filters__list")
      .append(Template.render(filter, this.templates.filterSelected));
    this.$panelSelectFilters.removeAttr("hidden");

    if (isApply) {
      this.currentPage = 1;
      this.applied.change = false;

      EventBus.publish(this.nameEvent, {
        method: this.typesEvent.change,
        filters: this.filters,
        added: filter,
      });
    }
  }

  /**
   * Добавить фильтр цены
   * @param {Object} filter Фильтр: id, priceMin, priceMax
   * @param {Boolean} isApply Добавить с примененеим фильтров
   */
  addFilterPrice(filter, isApply = true) {
    if (!filter.id || !filter.priceMin || !filter.priceMax) return;

    const $filterPrice = this.$panelSelectFilters.find(
      `[data-filter-id="${filter.id}"]:first`,
    );

    if ($filterPrice.length) {
      $filterPrice
        .find(".selected-filters__item-title")
        .html(
          `<span>${Shop.money.format(filter.priceMin)}</span> - <span>${Shop.money.format(filter.priceMax)}</span>`,
        );
    } else {
      this.$panelSelectFilters
        .find(".selected-filters__list")
        .append(Template.render(filter, this.templates.filterSelectedPrice));
      this.$panelSelectFilters.removeAttr("hidden");
    }

    if (isApply) {
      this.currentPage = 1;
      this.applied.change = false;

      EventBus.publish(this.nameEvent, {
        method: this.typesEvent.change,
        filters: this.filters,
        added: filter,
      });
    }
  }

  /**
   * Удаление фильтра
   * @param {Object} element Элемент в DOM-дереве
   * @param {Boolean} isApply Удалить с примененеим фильтров
   */
  removeFilter(element, isApply = true) {
    if (!element) return;

    const filterID = element.getAttribute("data-filter-id");
    const filterItemID =
      element?.getAttribute("data-selected-filter-id") ?? null;

    if (!filterID) return;

    if (
      this.$panelSelectFilters.find(".selected-filters__list:first").children()
        .length < 2
    ) {
      this.$panelSelectFilters
        .attr("hidden", true)
        .find(".selected-filters__list:first")
        .html("");
    } else {
      element.remove();
    }

    if (filterID == "price") {
      this._clearFilterPrice();
    } else if (this.isMobStyle) {
      this.$filtresMob
        .find(
          `[data-filter-id="${filterID}"] .checkbox-btn__input[value="${filterItemID}"]:first`,
        )
        .prop("checked", false);

      if (filterID === String(this.filtersID.color)) {
        this.$filtresMobColor
          .find(
            `.checkbox__input[data-property-id="${filterID}"][value="${filterItemID}"]:first`,
          )
          .prop("checked", false);
      }
    } else {
      this.$filtres
        .find(
          `[data-filter-id="${filterID}"] .checkbox__input[value="${filterItemID}"]:first`,
        )
        .prop("checked", false);
    }

    if (isApply) {
      this.currentPage = 1;
      this.applied.change = false;
      this._saveToURL();
      EventBus.publish(this.nameEvent, {
        method: this.typesEvent.change,
        filters: this.filters,
        deleted: {
          filterID: filterID,
          filterItemID: filterItemID,
        },
      });
    }
  }

  /**
   * Очистка фильтров
   * @param {Boolean} isApply Очистка с примененеим фильтров
   */
  clearFilters(isApply = true) {
    this._clearFilterPrice();

    if (this.isMobStyle) this._clearMobFilters();
    else this._clearPCFilters();

    this.$panelSelectFilters
      .attr("hidden", true)
      .find(".selected-filters__list:first")
      .html("");

    this.currentPage = 1;
    this.applied.quantity = 0;
    this.applied.quantityColor = 0;
    this.applied.sort = false;

    this.visibleBtnsFilters(true);

    if (!isApply) return;

    this.applied.change = false;
    this._saveToURL();
    EventBus.publish(this.nameEvent, {
      method: this.typesEvent.clear,
      filters: this.filters,
    });
  }

  /**
   * Очистка мобильных цветов в фильтре
   * @param {Boolean} isApply Очистка с примененеим фильтров
   */
  clearColorMobFilters(isApply = true) {
    if (!this.isMobStyle) return;

    this.$filtresMob
      .find(
        `[data-filter-id="${this.filtersID.color}"]:first .checkbox-btn__input:checked`,
      )
      .prop("checked", false);
    this.$filtresMobColor
      .find(".checkbox__input:checked")
      .prop("checked", false);

    this.applied.quantityColor = 0;
    this.visibleBtnsFilters();
    ``;
    if (isApply) {
      this.currentPage = 1;
      this.applied.change = false;

      EventBus.publish(this.nameEvent, {
        method: this.typesEvent.change,
        filters: this.filters,
      });
    }
  }

  _clearPCFilters() {
    const $sort = this.$filtres.find(".select_catalog-sort:first");
    const $nativeSort = this.$filtres.find(".catalog__sort:first");

    if ($sort.length) {
      $sort.find("select:first").val("");
      $sort.find(".select__option._active:first").removeClass("_active");
      $sort.find(".select__option:first").addClass("_active");
    } else if ($nativeSort.length) {
      $nativeSort.find("option:first").prop("selected", true);
    }

    this.$filtres.find(".checkbox__input:checked").prop("checked", false);
  }

  _clearMobFilters() {
    const $sort = this.$filtresMob.find("[data-filter-id='sort']:first");

    $sort.find(".options-sort__input:checked:first").prop("checked", false);
    $sort.find(".options-sort__input:first").prop("checked", true);

    this.$filtresMob
      .find(".checkbox-btn__input:checked")
      .prop("checked", false);
    this.$filtresMobColor
      .find(".checkbox__input:checked")
      .prop("checked", false);
  }

  _clearFilterPrice() {
    const $fitlers = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const priceMin = $fitlers.find("input[name='price_min']:first").get(0);
    const priceMax = $fitlers.find("input[name='price_max']:first").get(0);

    if (priceMin) {
      priceMin.value = priceMin.dataset.rangeFrom;
      priceMin.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (priceMax) {
      priceMax.value = priceMax.dataset.rangeTo;
      priceMax.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // Восстанавливает состояние чекбоксов из параметров URL при загрузке страницы
  _checkInputsFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    const $container = this.isMobStyle ? this.$filtresMob : this.$filtres;

    for (const [key, value] of params.entries()) {
      const match = key.match(/^f\[(\d+)\]\[\]$/);
      if (!match) continue;

      const filterID = match[1];
      const selector = this.isMobStyle
        ? `[data-filter-id="${filterID}"] .checkbox-btn__input[value="${value}"]`
        : `[data-filter-id="${filterID}"] .checkbox__input[value="${value}"]`;

      $container.find(selector + ":first").prop("checked", true);
    }

    const priceMinParam = params.get("price_min");
    const priceMaxParam = params.get("price_max");
    const $f = this.isMobStyle ? this.$filtresMob : this.$filtres;
    if (priceMinParam) {
      const input = $f
        .find("input[name='price_min']:first")
        .val(priceMinParam)
        .get(0);
      const slider = input
        ?.closest("[data-range]")
        ?.querySelector("[data-range-item]");
      if (slider?.noUiSlider) slider.noUiSlider.set([priceMinParam, null]);
    }
    if (priceMaxParam) {
      const input = $f
        .find("input[name='price_max']:first")
        .val(priceMaxParam)
        .get(0);
      const slider = input
        ?.closest("[data-range]")
        ?.querySelector("[data-range-item]");
      if (slider?.noUiSlider) slider.noUiSlider.set([null, priceMaxParam]);
    }

    const sortParam = params.get("sort");
    if (sortParam && sortParam !== "1") {
      if (this.isMobStyle) {
        this.$filtresMob
          .find(".options-sort__input:first")
          .prop("checked", false);
        this.$filtresMob
          .find(`.options-sort__input[value="${sortParam}"]`)
          .prop("checked", true);
      } else {
        this.$filtres
          .find(".catalog__sort:first")
          .find(`option[value="${sortParam}"]`)
          .prop("selected", true);
      }
    }
  }

  // Перебирает отмеченные чекбоксы и строит панель выбранных фильтров (режим modeCatalog)
  _restoreFromCheckedInputs() {
    const $container = this.isMobStyle ? this.$filtresMob : this.$filtres;
    let hasFilters = false;
    for (const input of $container.find("[data-filter-id] input:checked")) {
      const filterID = input.getAttribute("data-property-id");
      const filterItemID = input.value;
      if (!filterID || !filterItemID) continue;
      // Восстановление изображения
      let savedImg;
      try {
        savedImg = sessionStorage.getItem(`em_fimg_${filterItemID}`);
      } catch (_) {}
      const imgEl = input.parentElement.querySelector("img");
      const img =
        savedImg ||
        (imgEl
          ? imgEl.dataset.src ||
            (imgEl.getAttribute("src") && imgEl.src !== window.location.href
              ? imgEl.src
              : null) ||
            undefined
          : undefined);
      // Восстановление текста (с приоритетом из sessionStorage)
      let savedTitle;
      try {
        savedTitle = sessionStorage.getItem(`em_ftitle_${filterItemID}`);
      } catch (_) {}
      const isMobFilter =
        input.classList.contains("checkbox-btn__input") ||
        input.dataset.index !== undefined;
      const titleEl = input.parentElement.querySelector(
        isMobFilter ? ".checkbox-btn__text" : ".checkbox__text",
      );
      const titleText = savedTitle || titleEl?.innerText?.trim() || "Фильтр";
      this.addFilter(
        {
          id: filterID,
          itemID: filterItemID,
          title: titleText,
          img: img,
        },
        false,
      );
      if (filterID === String(this.filtersID.color)) {
        this.applied.quantityColor++;
      } else {
        this.applied.quantity++;
      }
      hasFilters = true;
    }
    const $f = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const priceRange = this._getPriceRange();
    const priceMin = Number($f.find("input[name='price_min']:first").val());
    const priceMax = Number($f.find("input[name='price_max']:first").val());
    if (
      !isNaN(priceMin) &&
      !isNaN(priceMax) &&
      (priceMin > priceRange.min || priceMax < priceRange.max)
    ) {
      this.applied.quantity++;
      this.addFilterPrice({ id: "price", priceMin, priceMax }, false);
      hasFilters = true;
    }
    const sortRaw = this._getRawSortValue();
    if (sortRaw && sortRaw !== "1") {
      this.applied.sort = true;
      hasFilters = true;
    }
    if (hasFilters) this.visibleBtnsFilters(false);
  }

  // Восстанавливает фильтры из URL после получения данных API (не-catalog режим)
  _restoreFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;
    const $container = this.isMobStyle ? this.$filtresMob : this.$filtres;
    for (const [key, value] of params.entries()) {
      const match = key.match(/^f\[(\d+)\]\[\]$/);
      if (!match) continue;
      const filterID = match[1];
      const filterItemID = value;
      const selector = this.isMobStyle
        ? `[data-filter-id="${filterID}"] .checkbox-btn__input[value="${filterItemID}"]`
        : `[data-filter-id="${filterID}"] .checkbox__input[value="${filterItemID}"]`;
      const $input = $container.find(selector + ":first");
      if (!$input.length) continue;
      $input.prop("checked", true);
      // Восстановление изображения
      let savedImg2;
      try {
        savedImg2 = sessionStorage.getItem(`em_fimg_${filterItemID}`);
      } catch (_) {}
      const imgEl2 = $input[0].parentElement.querySelector("img");
      const img2 =
        savedImg2 ||
        (imgEl2
          ? imgEl2.dataset.src ||
            (imgEl2.getAttribute("src") && imgEl2.src !== window.location.href
              ? imgEl2.src
              : null) ||
            undefined
          : undefined);
      // Восстановление текста (с приоритетом из sessionStorage)
      let savedTitle2;
      try {
        savedTitle2 = sessionStorage.getItem(`em_ftitle_${filterItemID}`);
      } catch (_) {}
      const isMobFilter =
        $input[0].classList.contains("checkbox-btn__input") ||
        $input[0].dataset.index !== undefined;
      const titleEl2 = $input[0].parentElement.querySelector(
        isMobFilter ? ".checkbox-btn__text" : ".checkbox__text",
      );
      const titleText2 = savedTitle2 || titleEl2?.innerText?.trim() || "Фильтр";
      this.addFilter(
        {
          id: filterID,
          itemID: filterItemID,
          title: titleText2,
          img: img2,
        },
        false,
      );
      if (filterID === String(this.filtersID.color)) {
        this.applied.quantityColor++;
      } else {
        this.applied.quantity++;
      }
    }
    const priceMinParam = params.get("price_min");
    const priceMaxParam = params.get("price_max");
    if (priceMinParam || priceMaxParam) {
      const priceRange = this._getPriceRange();
      const priceMin = priceMinParam ? Number(priceMinParam) : priceRange.min;
      const priceMax = priceMaxParam ? Number(priceMaxParam) : priceRange.max;
      if (priceMin > priceRange.min || priceMax < priceRange.max) {
        this.applied.quantity++;
        this.addFilterPrice({ id: "price", priceMin, priceMax }, false);
      }
      const $f = this.isMobStyle ? this.$filtresMob : this.$filtres;
      if (priceMinParam) {
        const input = $f
          .find("input[name='price_min']:first")
          .val(priceMin)
          .get(0);
        const slider = input
          ?.closest("[data-range]")
          ?.querySelector("[data-range-item]");
        if (slider?.noUiSlider) slider.noUiSlider.set([priceMin, null]);
      }
      if (priceMaxParam) {
        const input = $f
          .find("input[name='price_max']:first")
          .val(priceMax)
          .get(0);
        const slider = input
          ?.closest("[data-range]")
          ?.querySelector("[data-range-item]");
        if (slider?.noUiSlider) slider.noUiSlider.set([null, priceMax]);
      }
    }
    const sortParam = params.get("sort");
    if (sortParam && sortParam !== "1") {
      if (this.isMobStyle) {
        this.$filtresMob
          .find(".options-sort__input:first")
          .prop("checked", false);
        this.$filtresMob
          .find(`.options-sort__input[value="${sortParam}"]`)
          .prop("checked", true);
      } else {
        const $nativeSort = this.$filtres.find(".catalog__sort:first");
        if ($nativeSort.length) {
          $nativeSort.find("option:selected").prop("selected", false);
          $nativeSort
            .find(`option[value="${sortParam}"]`)
            .prop("selected", true);
        }
      }
      this.applied.sort = true;
    }
    this.visibleBtnsFilters(false);
  }

  // Сохранить текущее состояние фильтров в URL
  _saveToURL() {
    const params = new URLSearchParams();
    const $container = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const options = this._getOptionsFilters();
    for (const [filterID, values] of Object.entries(options)) {
      for (const value of values) {
        params.append(`f[${filterID}][]`, value);
        const selector = this.isMobStyle
          ? `[data-filter-id="${filterID}"] .checkbox-btn__input[value="${value}"]`
          : `[data-filter-id="${filterID}"] .checkbox__input[value="${value}"]`;
        const input = $container.find(selector + ":first").get(0);
        if (input) {
          // Сохранение изображения
          const imgEl = input.parentElement.querySelector("img");
          if (imgEl) {
            const imgUrl =
              imgEl.dataset.src ||
              (imgEl.getAttribute("src") && imgEl.src !== window.location.href
                ? imgEl.src
                : null);
            if (imgUrl) {
              try {
                sessionStorage.setItem(`em_fimg_${value}`, imgUrl);
              } catch (_) {}
            }
          }
          // Сохранение текста фильтра
          const isMobFilter =
            input.classList.contains("checkbox-btn__input") ||
            input.dataset.index !== undefined;
          const titleEl = input.parentElement.querySelector(
            isMobFilter ? ".checkbox-btn__text" : ".checkbox__text",
          );
          if (titleEl && titleEl.innerText) {
            try {
              sessionStorage.setItem(
                `em_ftitle_${value}`,
                titleEl.innerText.trim(),
              );
            } catch (_) {}
          }
        }
      }
    }
    const $f = this.isMobStyle ? this.$filtresMob : this.$filtres;
    const priceMin = Number($f.find("input[name='price_min']:first").val());
    const priceMax = Number($f.find("input[name='price_max']:first").val());
    const priceRange = this._getPriceRange();
    if (!isNaN(priceMin) && priceMin > priceRange.min)
      params.set("price_min", priceMin);
    if (!isNaN(priceMax) && priceMax < priceRange.max)
      params.set("price_max", priceMax);
    const sortRaw = this._getRawSortValue();
    if (sortRaw && sortRaw !== "1") params.set("sort", sortRaw);
    const search = params.toString();
    history.replaceState(
      null,
      "",
      window.location.pathname + (search ? "?" + search : ""),
    );
  }

  // Получить числовое значение сортировки из UI
  _getRawSortValue() {
    if (this.isMobStyle) {
      return (
        this.$filtresMob.find(".options-sort__input:checked:first").val() || "1"
      );
    }
    const $active = this.$filtres.find(
      ".select_catalog-sort .select__option._active:first",
    );
    if ($active.length) return $active.attr("data-value") || "1";
    return (
      this.$filtres.find(".catalog__sort option:selected:first").val() || "1"
    );
  }

  async fetch(formData, type = "", typePage = "") {
    const response = await $.ajax({
      url: `https://insales.widgets.ibice.ru/api/jls-gateway/${typePage}${type}`,
      method: "POST",
      // dataType: 'json',
      data: formData,
      processData: false,
      contentType: false,
      timeout: 10000,
    }).fail((err) => {
      console.warn(this._name, "Ошибка выполнения запроса:", err);
    });

    if (!response) {
      console.warn(this._name, "Ошибка выполнения запроса:", response);
    }
    return response;
  }
};

/**
 * Новая версия лоадера
 * Типы: обычный и скелетон
 */
window.EM_Module.Loaders = {
  // Скелетон загрузки
  Skeleton: class {
    constructor($block) {
      this.$block = $block;
      // this.isMobile = sessionStorage.getItem('isMobile') === 'true';
      this.template =
        "<div class='catalog__list-item products-item loading-item'><div class='products-item__img-wrapper'><div class='products-item__img'></div></div></div>";
    }

    show(count, clear) {
      this.$block.addClass("loading");
      if (clear) {
        this.$block.html(this.template.repeat(count));
      } else {
        this.$block.append(this.template.repeat(count));
      }
    }

    hide(html = "") {
      // ! Нужно задать css свойство "transition: opacity 0.2s ease;" для блока this.$block
      this.$block
        .removeClass("loading")
        .css("opacity", "0.5")
        .one("transitionend", () => {
          this.$block.html(html).css("opacity", "1");
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
      this.svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><circle class="spinner_b2T7" cx="4" cy="12" r="3" /><circle class="spinner_b2T7 spinner_YRVV" cx="12" cy="12" r="3" /><circle class="spinner_b2T7 spinner_c9oY" cx="20" cy="12" r="3" /></svg>';
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
      container.insertAdjacentHTML(
        "beforeend",
        `<div class="loader-added">
                    <div class="loader-icon_added"></div>
                    <p>Товар добавлен в корзину</p>
                </div>`,
      );
      setTimeout(() => {
        container.querySelector(".loader-added")?.remove();
      }, 3000);
    }
  },
};

// Модуль работы с блоком пагинации
window.EM_Module.Pagination = class {
  constructor($container, isMobile) {
    this.data = {
      container: "em-pagin",
    };
    this.classes = {
      slider: "pagin__slider",
      btn: "pagin__btn",
      disabledPagind: "pagin__body-disabled",
      disabled: "pagin__disabled",
      action: "pagin__action",
      disabled: "pagin__disabled",
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
    ((this.isDragging = false), (this.animationID = null));
    this.len = 32 + 10;
    this.maxCount = 5;

    this.params = {
      KOEFF_SPEED: isMobile ? 1.2 : 2.1,
      // KOEFF_SHIFT: 0.25
    };
    this.isInit = false;
    // this.setAttribute("data-" + this.data.container, index);
  }

  init(page, newCount) {
    const count = newCount
      ? newCount
      : Number(this.$pagin.attr(`data-${this.data.container}`));

    if (page < 1 || count == 1) {
      // this.$pagin.find(`.${this.classes.btn}`).attr("hidden", true);
      this.$pagin.attr("hidden", true);
      if (this.slider) this.slider.innerHTML = "";
      return;
    }
    if (!this.$pagin.length || !this.slider) {
      this.throwException("Ошибка инициализации, не найдена пагинация");
    } else if (!count || count < 1 || count > 100) {
      this.$pagin.attr("hidden", true);
      this.slider.innerHTML = "";
      this.throwException(
        "Ошибка инициализации пагинации:",
        `page=${page ?? 1}, count=${count}`,
      );
    }

    // if (page < 1) page = 1;
    this.page = page > count ? 1 : (page ?? 1);
    this.count = count;

    const pathname = window.location.pathname;
    const querySearch = this._getQuery(pathname);

    let html = "";
    for (let i = 1; i < count + 1; i++) {
      html += `<a href="${pathname}?page=${i}${querySearch}" class="pagin__number${i == page ? ` ${this.classes.action}` : ""}" data-pagin-index="${i}" draggable="false">${i}</a>`;
    }
    if (count < this.maxCount + 1) {
      this.$pagin.find(`.${this.classes.btn}`).attr("hidden", true);
    } else if (this.page == 1 || this.page == count) {
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

    this.$pagin.on(
      "click",
      `.${this.classes.btn}`,
      this.onPaginArrow.bind(this),
    );
    // this.$pagin.find(`.${this.classes.slider}`).on("click", ".pagin__number", this.onPaginBtn.bind(this));
    // this.$input.on("change", function() {
    //     console.log(this.value);
    // });
    if (this.count <= this.maxCount) return;
    // Свайп
    if (this.isMobile) {
      this.wrapperSlider.addEventListener(
        "touchstart",
        this.swipeStart.bind(this),
      );
      this.wrapperSlider.addEventListener(
        "touchmove",
        this.swipeMove.bind(this),
      );
      this.wrapperSlider.addEventListener("touchend", this.swipeEnd.bind(this));
    } else {
      this.wrapperSlider.addEventListener(
        "mousedown",
        this.swipeStart.bind(this),
      );
      this.wrapperSlider.addEventListener(
        "mousemove",
        this.swipeMove.bind(this),
      );
    }

    // Отпуск
    this.wrapperSlider.addEventListener("mouseup", this.swipeEnd.bind(this));
    this.wrapperSlider.addEventListener("mouseleave", this.swipeEnd.bind(this));
  }

  onPaginBtn(event) {
    this.switchPage(Number(event.currentTarget.dataset.paginIndex));
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
    } else {
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
    this.offsetX =
      this.cursorPntX - this.params.KOEFF_SPEED * (this.startX - evt.clientX);
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
    } else if (temp + this.maxCount > this.count) {
      action = this.count - this.maxCount;
    } else {
      action = Math.floor(temp);
    }
    return -action * this.len;
  }

  _getCurretnPage() {
    const page = Math.ceil(-this.offsetX / this.len) + 1;

    if (page < 1) return 1;
    else if (page > this.count) return this.count;
    return page;
  }

  _getQuery(pathname) {
    if (!pathname.includes("/search")) return "";

    return "&q=" + new URLSearchParams(window.location.search).get("q") ?? "";
  }

  _changeArrowsAttr(page) {
    const $arrows = this.$arrows;
    if (page + this.maxCount > this.count) {
      $arrows[1].classList.add(this.classes.disabled);
      $arrows[0].classList.remove(this.classes.disabled);
    } else if (page == 1) {
      $arrows[0].classList.add(this.classes.disabled);
      if (page < this.count) {
        $arrows[1].classList.remove(this.classes.disabled);
      }
    } else {
      $arrows.removeClass(this.classes.disabled);
    }
  }

  // Переключение выбранного пункта в пагинации
  switchPage(newPage) {
    if (newPage === undefined || isNaN(newPage) || newPage == this.page) return;

    this.$pagin
      .find(`[data-pagin-index="${this.page}"]`)
      .removeClass(this.classes.action);
    this.$pagin
      .find(`[data-pagin-index="${newPage}"]`)
      .addClass(this.classes.action);
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

  printWarn(mess, params = "") {
    console.warn("[Pagin]", mess, params);
  }

  printError(mess, params = "") {
    console.error("[Pagin]", mess, params);
  }

  throwException(mess) {
    throw new Error(`[Pagin] ${mess}`);
  }
};

// Старый лоадер
window.EM_Module.Loader = class {
  constructor($block) {
    this.$_block = $block;
    this.className = "local-loader";
    this.svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><style>.spinner_b2T7{animation:spinner_xe7Q .8s linear infinite}.spinner_YRVV{animation-delay:-.65s}.spinner_c9oY{animation-delay:-.5s}@keyframes spinner_xe7Q{93.75%,100%{r:3px}46.875%{r:.2px}}</style><circle class="spinner_b2T7" cx="4" cy="12" r="3"/><circle class="spinner_b2T7 spinner_YRVV" cx="12" cy="12" r="3"/><circle class="spinner_b2T7 spinner_c9oY" cx="20" cy="12" r="3"/></svg>';
  }

  call() {
    this.callStatic(this.$_block);
  }

  hide() {
    this.hideStatic(this.$_block);
  }

  callStatic($block) {
    if ($block.find("." + this.className).length > 0) {
      $block.find("." + this.className).remove();
    }
    $block.append(`<div class="${this.className}">${this.svg}</div>`);
  }

  hideStatic($block) {
    $block.find("." + this.className).remove();
  }

  checkPreloader() {
    return this.$_block.find("." + this.className).length > 0;
  }

  callAdd(container) {
    if (!container) return;
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="loader-added">
                <div class="loader-icon_added"></div>
                <p>Товар добавлен в корзину</p>
            </div>`,
    );
    setTimeout(() => {
      container.querySelector(".loader-added")?.remove();
    }, 3000);
  }
};

// Вывод цветов
window.EM_Module.Colors = class {
  constructor($container, type) {
    this.$container = $container;
    this.type = type;
  }

  /**
   * Отрисовка цветов в контейнере
   * @param {Object} Контейнер для поиска
   */
  drawColors($container) {
    this.draw(this.getLineIds($container));
  }

  /**
   * Формирование списка id вариантов для запроса
   * @param {Object} Контейнер для поиска
   * @returns {string} Строка variant_id, разделенных символом ","
   */
  getLineIds($container = this.$container) {
    let listIds = "";
    for (const block of $container.find("[data-first-variant]")) {
      if (block.dataset.firstVariant) {
        listIds += block.dataset.firstVariant + ",";
      }
    }
    return listIds;
  }

  /**
   * Отрисова цветов
   * @param {string} variantIds Строка variant_id, разделенных символом ","
   */
  async draw(variantIds, ignoreSize = true) {
    if (variantIds.length < 2) return;

    const formData = new FormData();
    formData.append("flow_id", "62b2caa5-7874-40a9-b7f2-1b9561fe9e83");
    formData.append(
      "variant_id",
      variantIds.at(-1) !== ","
        ? variantIds
        : variantIds.substring(0, variantIds.length - 1),
    );
    formData.append("ignore_size", ignoreSize);

    const response = await $.ajax({
      url: "https://insales.widgets.ibice.ru/api/jls-gateway/characteristics",
      method: "POST",
      // dataType: 'json',
      data: formData,
      processData: false,
      contentType: false,
      timeout: 10000,
    });

    if (!response?.products || !this.$container.length) return;

    const products = response.products;
    for (const sku in products) {
      const products_sku = products[sku];

      let html = "",
        i = 0;
      for (const product of products_sku) {
        for (const key in product.colors) {
          if (i > 20) break;
          i++;
          html += this.render(product.colors[key].image_url, product);
        }
      }

      if (html.length > 0) {
        if (i > 20) {
          html +=
            this.this.type == "product"
              ? "<div class='colors-list__item'>...</div>"
              : "<span class='products-item__colors-item color'>...</span>";
        }
        this.$container.find(`[data-variant-sku="${sku}"]`).html(html);
      }
    }
  }

  render(imgLink, product) {
    if (this.type == "product") {
      const roductId = Shop.config.getProductId();
      if (roductId == product.product_id) {
        return `<div class="colors-list__item _active">
                    <img src="${imgLink ?? ""}" data-ll-status="loading" class="entered loading" alt="">
                </div>`;
      }
      return `<a href="/product/${product.permalink}" class="colors-list__item">
                <img src="${imgLink ?? ""}" data-ll-status="loading" class="entered loading" alt="">
            </a>`;
    } else {
      return `<span class="products-item__colors-item color">
                <img src="${imgLink ?? ""}" data-ll-status="loading" class="entered loading" alt="">
            </span>`;
    }
  }
};

// Работа с бейджами
window.EM_Module.Badges = {
  _inited: false,
  badges: [], // парсинг бейджей

  // Спарсить настройки бейджей
  readingBages: function () {
    if (this._inited) return;
    try {
      const badges = document.getElementById("badges-data");
      if (badges) {
        this.badges = JSON.parse(badges.innerHTML);
      }
    } catch (err) {
      console.error("[EM.Badges] Ошибка парсинга данных", err);
    }
    this._inited = true;
  },

  // Получить параметры бейджа: исходные значение или с поиском настроек данного бейджа
  getPropertyBadges: function (
    properties,
    characteristics,
    isFindType = false,
  ) {
    let badgeProp;
    for (const key in properties) {
      if (properties[key].permalink == "badge") {
        badgeProp = properties[key];
        break;
      }
    }
    if (!badgeProp) return [];

    let badges = [];
    for (const characteristic of characteristics) {
      if (characteristic.property_id == badgeProp.id) {
        badges.push(
          isFindType
            ? this.findBadge(characteristic.title)
            : characteristic.title,
        );
      }
    }
    return badges;
  },

  // Найти настройки бейджа по его имени
  findBadge: function (titleBadge) {
    const lowerTitle = titleBadge.toLowerCase();
    return (
      this.badges.find((badge) => badge.title.toLowerCase() === lowerTitle) ?? {
        title: titleBadge,
      }
    );
  },

  renderBadgeHTML: (title, cssString) => {
    return !title
      ? ""
      : `<span class="products-item__badge" ${cssString ?? ""}>${title}</span>`;
  },

  // Ренден HTML бейджей
  renderBadges: function (badges) {
    let html = "";
    for (let badge of badges) {
      html += `<span class="products-item__badge" ${this._getCSS(badge)}>${badge.title}</span>`;
    }
    return html;
  },

  // Отрисовка бейджей в верстке
  renderBadgesInHTML: function ($container) {
    if (!this._inited) this.readingBages();

    for (const badgeBlock of $container.find("[data-badges-id]")) {
      const names = badgeBlock.dataset.badgesId.split(",");

      if (names.length == 0) {
        const disabledBadge = badgeBlock.querySelector("._disabled-badge");
        if (disabledBadge) {
          disabledBadge.classList.remove("_disabled-badge");
        }
        continue;
      }

      names.forEach((name, i) => {
        const badge = this.findBadge(name);
        if (!badge || !badge?.title) return;

        if (i > 0 || !badgeBlock.querySelector("._disabled-badge")) {
          badgeBlock.innerHTML += `<span class="products-item__badge" ${this._getCSS(badge)}>${badge.title}</span>`;
          return;
        }

        const itemBadge = badgeBlock.querySelector("._disabled-badge");

        itemBadge.innerText = badge.title;
        itemBadge.style.color = badge.color ?? "";
        itemBadge.style["background-color"] = badge.background ?? "";
        itemBadge.classList.remove("_disabled-badge");
      });

      const disabledBadge = badgeBlock.querySelector("._disabled-badge");
      if (disabledBadge) {
        disabledBadge.classList.remove("_disabled-badge");
      }
    }
  },

  // Получить полностью отрисованные бейджы с примененными настройками
  getBadges: function (product) {
    const badges = this.getPropertyBadges(
      product.properties,
      product.characteristics,
      true,
    );

    if (badges) return this.renderBadges(badges);
  },

  // Получить стили
  _getCSS: (css) => {
    return css.color || css.background
      ? `style="color:${css.color};background-color:${css.background}";`
      : "";
  },
};

// Сбор полезных функций
window.EM_Module.func = {
  property_ids: {
    preorder: 42134720, // предзаказ
    soon: 52261463, // скоро в продажах
  },

  extractSection: (str, prefix = "/collection/") => {
    const start = str.indexOf(prefix);
    if (start === -1) return null;

    const afterPrefix = start + prefix.length;
    const end = str.indexOf("/", afterPrefix);

    if (end === -1) return str.slice(start);

    return str.slice(start, end + 1);
  },

  // Предзаказ 1. Проверка через characteristics
  checkPreorder: function (properties) {
    for (const key in properties) {
      const property = properties[key];
      if (
        property.permalink === "predzakaz" &&
        property.characteristics.find((item) => item.permalink === "da")
      ) {
        return true;
      }
    }
    return false;
  },

  // Предзаказ 2. Проверка через properties
  checkPreorderChars: function (chars) {
    if (!chars) return false;

    const id = this.property_ids.preorder;
    for (const char of chars) {
      if (char.property_id == id && char.permalink === "da") {
        return true;
      }
    }
    return false;
  },

  // !Важно: url больше не учитывается
  // Скоро в продажах 1. Проверка через characteristics
  checkSoon: function (properties, url) {
    // if (!url || !url.includes("/skoro-v-prodazhe")) return false;

    for (const key in properties) {
      const property = properties[key];
      if (
        property.permalink === "skoro-v-prodazhe" &&
        property.characteristics.find((item) => item.permalink === "da")
      ) {
        return true;
      }
    }
    return false;
  },

  // !Важно: url больше не учитывается
  // Скоро в продажах 2. Проверка через properties
  checkSoonCahrs: function (chars) {
    if (!chars) return false;
    // if (!url || !url.includes("/skoro-v-prodazhe")) return false;

    const id = this.property_ids.soon;
    for (const char of chars) {
      if (char.property_id == id && char.permalink === "da") {
        return true;
      }
    }
    return false;
  },

  /**
   * Коэффициент разрешения у фота для каталога.
   * Реализация под гибкую сетку в каталоге
   */
  matchesNthChild:
    window.innerWidth > 1023
      ? (i) => {
          return i === 7 || (i >= 7 && ((i - 7) % 8 === 0 || (i - 8) % 8 === 0))
            ? 1.4
            : 1;
        }
      : (i) => {
          return i % 5 === 0 ? 1.8 : 1;
        },

  /**
   * Получить URL фото (1 вариант)
   * @param {Object<InSales>} image Фото товара
   * @returns {Object<String, String>} URL фото с 2 типа изображениями (x1, x2)
   */
  getImage: function (image) {
    if (!image) return;

    const coeff = { x1: 1.5, x2: 1.9 };
    const originalUrl = image.original_url || "";
    const baseUrl = originalUrl.replace(
      originalUrl.includes("static.insales-cdn.com")
        ? "static.insales-cdn.com"
        : "ibicecdn.com/dumanstore",
      "ibicecdn.com/dumanstore/%size%",
    );

    const getUrl = (size, ratio) =>
      baseUrl.replace("%size%", `l60/${Math.floor(size * ratio)}`);
    const innerWidth = window.innerWidth;

    let size = 565;
    if (innerWidth < 480) {
      size = 400;
    } else if (
      innerWidth > 1920 ||
      (innerWidth > 768 && innerWidth <= 1023.98)
    ) {
      size = 730;
    } else if (innerWidth > 1320) {
      size = 565;
    } else if (innerWidth > 1023.98) {
      size = 382;
    }

    return {
      x1: getUrl(size, coeff.x1),
      x2: getUrl(size, coeff.x2),
    };
  },

  /**
   * Получить URL фото (2 вариант)
   * @param {Object<InSales>} image Фото товара
   * @returns {Object<String, String>} URL фото с 2 типа изображениями (x1, x2)
   */
  getImageForCatalog: function (image, x = 1) {
    if (!image) return;

    const originalUrl = image.original_url || "";
    const baseUrl = originalUrl.replace(
      originalUrl.includes("static.insales-cdn.com")
        ? "static.insales-cdn.com"
        : "ibicecdn.com/dumanstore",
      "ibicecdn.com/dumanstore/%size%",
    );

    const getUrl = (size) =>
      baseUrl.replace("%size%", `l60/${Math.floor(size * x)}`);
    const innerWidth = window.innerWidth;

    let sizeMin, sizeMax;
    if (innerWidth < 351) {
      sizeMin = 480;
      sizeMax = 700;
    } else if (innerWidth < 701) {
      sizeMin = 700;
      sizeMax = 1000;
    } else if (innerWidth < 1021) {
      sizeMin = 980;
      sizeMax = 1400;
    } else if (innerWidth < 1701) {
      sizeMin = 800;
      sizeMax = 1200;
    } else {
      sizeMin = 1400;
      sizeMax = 1600;
    }

    return {
      x1: getUrl(sizeMin),
      x2: getUrl(sizeMax),
    };
  },

  getImages: function (images) {
    return images.map((image) => this.getImage(image));
  },

  getImagesForCatalog: function (images, i) {
    const x = this.matchesNthChild(i + 1);
    return images.map((image) => this.getImageForCatalog(image, x));
  },
};

// Работа с масками телефонов
window.EM_Module.PhoneMaskManager = class {
  constructor() {
    this.masks = {
      // Российские номера
      ru_mobile_7: {
        pattern: "+7(###)###-##-##",
        regex: /^\+?7\d{10}$/,
        countryCode: "7",
        maxLength: 11,
      },
      ru_mobile_8: {
        pattern: "8(###)###-##-##",
        regex: /^8\d{10}$/,
        countryCode: "8",
        maxLength: 11,
      },
      // Американские номера
      us_phone: {
        pattern: "+1(###)###-####",
        regex: /^\+?1\d{10}$/,
        countryCode: "1",
        maxLength: 11,
      },
      // Немецкие номера
      de_phone: {
        pattern: "+49(###)####-####",
        regex: /^\+?49\d{10,11}$/,
        countryCode: "49",
        maxLength: 13,
      },
      // Украинские номера
      ua_phone: {
        pattern: "+380(##)###-##-##",
        regex: /^\+?380\d{9}$/,
        countryCode: "380",
        maxLength: 12,
      },
    };

    this.observers = [];
    this.currentMask = null;
    this.activeInputs = new Set();
  }

  // Метод для добавления новой маски
  addMask(key, maskConfig) {
    this.masks[key] = maskConfig;
  }

  // Определение подходящей маски по номеру
  detectMask(phone) {
    const digits = this.getDigitsOnly(phone);

    if (digits.startsWith("7")) {
      return this.masks.ru_mobile_7;
    }
    if (digits.startsWith("8")) {
      return this.masks.ru_mobile_8;
    }
    if (digits.startsWith("1")) {
      return this.masks.us_phone;
    }
    if (digits.startsWith("49")) {
      return this.masks.de_phone;
    }
    if (digits.startsWith("380")) {
      return this.masks.ua_phone;
    }

    // Если не найдена подходящая маска, используем базовую международную
    return {
      pattern: "+###############",
      regex: /^\+?\d{7,15}$/,
      countryCode: "",
      maxLength: 15,
    };
  }

  // Основной метод форматирования телефона
  formatPhone(phone, update = true) {
    if (!phone) return "";

    const digits = this.getDigitsOnly(phone);
    if (!digits) return "";

    const mask = this.detectMask(digits);
    if (update) this.currentMask = mask;

    let formatted = "";

    // Специальная обработка для российских номеров
    if (mask === this.masks.ru_mobile_7) {
      formatted = this.formatRussianMobile7(digits);
    } else if (mask === this.masks.ru_mobile_8) {
      formatted = this.formatRussianMobile8(digits);
    } else if (mask === this.masks.us_phone) {
      formatted = this.formatUSPhone(digits);
    } else if (mask === this.masks.de_phone) {
      formatted = this.formatGermanPhone(digits);
    } else if (mask === this.masks.ua_phone) {
      formatted = this.formatUkrainianPhone(digits);
    } else {
      // Общее форматирование для других стран
      formatted = "+" + digits;
    }

    // Уведомляем наблюдателей
    if (update) {
      const isValid = this.validatePhone(formatted);
      this.notifyObservers(formatted, digits, isValid);
    }

    return formatted;
  }

  // Форматирование российских номеров (+7)
  formatRussianMobile7(digits) {
    let formatted = "+7";

    if (digits.length > 1) {
      const rest = digits.substring(1);
      formatted += "(" + rest.substring(0, Math.min(3, rest.length));

      if (rest.length > 3) {
        formatted += ")" + rest.substring(3, 6);

        if (rest.length > 6) {
          formatted += "-" + rest.substring(6, 8);

          if (rest.length > 8) {
            formatted += "-" + rest.substring(8, 10);
          }
        }
      }
    }

    return formatted;
  }

  // Форматирование российских номеров (8)
  formatRussianMobile8(digits) {
    let formatted = "8";

    if (digits.length > 1) {
      const rest = digits.substring(1);
      formatted += "(" + rest.substring(0, Math.min(3, rest.length));

      if (rest.length > 3) {
        formatted += ")" + rest.substring(3, 6);

        if (rest.length > 6) {
          formatted += "-" + rest.substring(6, 8);

          if (rest.length > 8) {
            formatted += "-" + rest.substring(8, 10);
          }
        }
      }
    }

    return formatted;
  }

  // Форматирование американских номеров
  formatUSPhone(digits) {
    let formatted = "+1";

    if (digits.length > 1) {
      const rest = digits.substring(1);
      formatted += "(" + rest.substring(0, Math.min(3, rest.length));

      if (rest.length > 3) {
        formatted += ")" + rest.substring(3, 6);

        if (rest.length > 6) {
          formatted += "-" + rest.substring(6, 10);
        }
      }
    }

    return formatted;
  }

  // Форматирование немецких номеров
  formatGermanPhone(digits) {
    let formatted = "+49";

    if (digits.length > 2) {
      const rest = digits.substring(2);
      formatted += "(" + rest.substring(0, Math.min(3, rest.length));

      if (rest.length > 3) {
        formatted += ")" + rest.substring(3, 7);

        if (rest.length > 7) {
          formatted += "-" + rest.substring(7, 11);
        }
      }
    }

    return formatted;
  }

  // Форматирование украинских номеров
  formatUkrainianPhone(digits) {
    let formatted = "+380";

    if (digits.length > 3) {
      const rest = digits.substring(3);
      formatted += "(" + rest.substring(0, Math.min(2, rest.length));

      if (rest.length > 2) {
        formatted += ")" + rest.substring(2, 5);

        if (rest.length > 5) {
          formatted += "-" + rest.substring(5, 7);

          if (rest.length > 7) {
            formatted += "-" + rest.substring(7, 9);
          }
        }
      }
    }

    return formatted;
  }

  // Метод проверки корректности телефона
  validatePhone(phone) {
    if (!phone) return false;

    const digits = this.getDigitsOnly(phone);
    const mask = this.detectMask(digits);

    return mask.regex.test("+" + digits) || mask.regex.test(digits);
  }

  // Метод получения номера без форматирования
  getUnformattedPhone(formattedPhone) {
    if (!formattedPhone) return "";
    return this.getDigitsOnly(formattedPhone);
  }

  // Получение только цифр из строки
  getDigitsOnly(str) {
    return str.replace(/\D/g, "");
  }

  // Инициализация масок для input полей
  initializeInputMasks(selector) {
    const inputs = document.querySelectorAll(selector);

    inputs.forEach((input) => {
      if (this.activeInputs.has(input)) return;

      this.activeInputs.add(input);

      // Форматируем существующее значение
      if (input.value) {
        input.value = this.formatPhone(input.value);
      }

      // Добавляем обработчик событий
      input.addEventListener("input", (e) => {
        const digits = this.getDigitsOnly(e.target.value);
        const mask = this.detectMask(digits);

        if (digits.length > mask.maxLength) {
          const trimmedDigits = digits.substring(0, mask.maxLength);
          e.target.value = this.formatPhone(trimmedDigits);
        } else {
          e.target.value = this.formatPhone(digits);
        }
      });

      input.addEventListener("paste", (e) => {
        setTimeout(() => {
          const digits = this.getDigitsOnly(e.target.value);
          const mask = this.detectMask(digits);
          if (digits.length > mask.maxLength) {
            e.target.value = this.formatPhone(
              digits.substring(0, mask.maxLength),
            );
          } else {
            e.target.value = this.formatPhone(digits);
          }
        }, 0);
      });

      input.addEventListener("keydown", (e) => {
        // Разрешаем только цифры, backspace, delete, стрелки, tab
        const allowedKeys = [
          "Backspace",
          "Delete",
          "Tab",
          "Escape",
          "Enter",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
        ];

        if (
          !allowedKeys.includes(e.key) &&
          !e.ctrlKey &&
          !e.metaKey &&
          !/\d/.test(e.key)
        ) {
          e.preventDefault();
        }
      });
    });
  }

  // Корректировка позиции курсора после форматирования
  setCursorPosition(input, cursorPosition, oldValue, newValue) {
    const oldDigits = this.getDigitsOnly(oldValue.substring(0, cursorPosition));
    let newPosition = 0;
    let digitCount = 0;

    for (let i = 0; i < newValue.length; i++) {
      if (/\d/.test(newValue[i])) {
        digitCount++;
        if (digitCount > oldDigits.length) {
          break;
        }
      }
      newPosition = i + 1;
    }

    setTimeout(() => {
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  }

  // Добавление наблюдателя
  addObserver(observer) {
    this.observers.push(observer);
  }

  // Удаление наблюдателя
  removeObserver(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  // Уведомление наблюдателей
  notifyObservers(formattedPhone, rawPhone, isValid) {
    this.observers.forEach((observer) => {
      if (typeof observer === "function") {
        observer(formattedPhone, rawPhone, isValid);
      } else if (observer.onPhoneChange) {
        observer.onPhoneChange(formattedPhone, rawPhone, isValid);
      }
    });
  }

  // Получение информации о текущей маске
  getCurrentMaskInfo() {
    return this.currentMask;
  }

  // Получение всех доступных масок
  getAvailableMasks() {
    return Object.keys(this.masks);
  }

  // Очистка всех активных input полей
  clearActiveInputs() {
    this.activeInputs.clear();
  }
};

// Форма обратной связи
window.EM_Module.FormFeedback = class {
  constructor($form, productID, typeForm) {
    this.$form = $form;
    this.productID = productID ?? "";
    this.isInit = false;
    this.typesForms = {
      subscription: "default",
      primerka: "primerka",
      stilist: "stilist",
    };
    this.typeForm = this.typesForms[typeForm] ?? this.typesForms.subscription;
    this.url =
      this.typeForm == this.typesForms.subscription
        ? "https://dumansto.re/api/product-subscription"
        : "https://dumansto.re/api/feedback-forms";
  }

  async init() {
    if (!this.$form.length || this.isInit) return;

    let client;
    try {
      client = await ajaxAPI.shop.client.get();
      this.client = client;
    } catch (_) {}

    this.$form
      .find("[data-em-message-close]")
      .on("click", this.closeForm.bind(this));

    if (client?.id) {
      this.preventDoubleSubmit();

      this.$form
        .find("[data-em-form-submit]:first")
        .on("click", this.submit.bind(this));

      this.setDateClient();
    }
    // else if (!this.client?.id) {
    //     this.$form.find("[data-em-form-submit]:first").attr("disabled", true);
    //     this.showErrors([{
    //         text: "нужно сначала авторизироваться!",
    //         type: "all"
    //     }]);
    // }
    this.isInit = true;
  }

  checkPhone(phone) {
    const clearPhone = phone.replace(/\D/g, "");
    return (
      (clearPhone.length === 11 &&
        (clearPhone[0] === "7" || clearPhone[0] === "8")) ||
      (clearPhone.length === 12 &&
        clearPhone[0] !== "7" &&
        clearPhone[0] !== "8")
    );
  }

  submit() {
    if (!this.client?.id) {
      this.showErrors([
        {
          text: "Нужно сначала авторизироваться!",
          type: "all",
        },
      ]);
      return;
    }
    if (!this.preventDoubleSubmit(true)) return;

    const name = this.$form.find("input[name='name']:first").val(),
      email = this.$form.find("input[name='email']:first").val(),
      phone = this.$form.find("input[name='phone']:first").val(),
      $recaptcha = this.$form.find(
        "textarea[name='g-recaptcha-response']:first",
      );
    let errors = [];

    if (this.typeForm == this.typesForms.subscription && !this.productID) {
      errors.push({
        text: "Вы не выбрали товар!",
        type: "all",
      });
    }

    if (!name || name.length < 2) {
      errors.push({
        text: "Некорректное имя!",
        type: "name",
      });
    }
    if (name.length > 90) {
      errors.push({
        text: "Имя слишком длинное (не более 90 символов)!",
        type: "name",
      });
    }
    if (
      this.typeForm != this.typesForms.stilist &&
      !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)
    ) {
      errors.push({
        text: "Некорректный email!",
        type: "email",
      });
    }
    if (!phone || !this.checkPhone(phone)) {
      errors.push({
        text: "Некорректный номер телефона!",
        type: "phone",
      });
    }

    if ($recaptcha.length && !$recaptcha.val()) {
      errors.push({
        text: "Пройдите капчу!",
        type: "em-recaptcha",
      });
    }
    if (errors.length > 0) {
      this.showErrors(errors);
      return;
    }
    this.isChange = false;

    if (this.typeForm == this.typesForms.subscription) {
      this.fetchForm({
        // id: this.client.id,
        // token: this.client.fields_values.find(field => field.handle == "client_uuid")?.value
        source: "c261670d-2b73-4efe-a841-3e8f14a43a4f",
        product_id: Number(this.productID ?? 0),
        subscriber: email,
      });
    } else {
      const formData = {
        name: name,
        phone: phone,
      };
      if (this.typeForm != this.typesForms.stilist) {
        formData.email = email;
      }
      this.fetchForm({
        // id: this.client.id,
        // token: this.client.fields_values.find(field => field.handle == "client_uuid")?.value
        source: "c261670d-2b73-4efe-a841-3e8f14a43a4f",
        form_type: this.typeForm,
        form_data: formData,
      });
    }
  }

  setDateClient() {
    if (!this.client) return;

    this.$form.find("input[name='name']").val(this.client.name ?? "");
    this.$form.find("input[name='email']").val(this.client.email ?? "");

    const inputPhone = this.$form.find("input[name='phone']").get(0);
    if (inputPhone) {
      inputPhone.value = this.client.phone ?? "";
      inputPhone.dispatchEvent(
        new Event("input", {
          bubbles: true,
        }),
      );
    }
  }

  async fetchForm(data) {
    const response = await fetch(this.url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(data),
    });
    let json = await response.json();
    if (json.success) {
      this.showSuccess();
    } else {
      this.printError(json?.errors);
    }
  }

  // Функция форматирования времени в формате MM:SS
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Проверка на повторную отправку
  preventDoubleSubmit(isSave = false) {
    const lastSubmitTime = localStorage.getItem(
      "lastFormPromoSubmit-" + this.typeForm,
    );

    const now = Date.now();
    const cooldown = 5 * 60 * 1000; // 5 минут

    if (lastSubmitTime && now - parseInt(lastSubmitTime) < cooldown) {
      const timeLeft = Math.ceil(
        (cooldown - (now - parseInt(lastSubmitTime))) / 1000,
      );
      this.showErrors([
        {
          text: `подождите ${this.formatTime(timeLeft)} минут перед повторной отправкой`,
          type: "all",
        },
      ]);
      return false;
    }

    if (isSave) {
      localStorage.setItem(
        "lastFormPromoSubmit-" + this.typeForm,
        now.toString(),
      );
    }
    return true;
  }

  // Обработка ошибок от запроса
  printError(errors) {
    let message = "";
    if (!errors || !errors.length) {
      message = "Непредвиденная ошибка, обратитесь в поддержку";
    } else {
      for (const err of errors) {
        const textError = err.error;
        if (textError.includes("roduct is not specified")) {
          message += "не удалось подписаться на данный товар" + ", ";
        } else if (textError.includes("ubscriber is not specified")) {
          message += "не указан адрес электронной почты" + ", ";
        } else if (textError.includes("nvalid subscriber email specified")) {
          message +=
            "данный адрес электронной почты недействителен — на него невозможно доставить письмо с оповещением" +
            ", ";
        } else if (textError.includes("is available already")) {
          message +=
            "данный товар на момент получения запроса есть в наличии" + ", ";
        } else if (textError.includes("does not exist")) {
          message +=
            "данный товар не существует в системе, поэтому на него невозможно оформить подписку" +
            ", ";
        } else if (
          textError.includes(
            "pecified customer already has a subscription to this product",
          )
        ) {
          message += "уже оформлена подписка на данный товар" + ", ";
        } else if (textError.includes("equest was sent too often")) {
          message += "слишком много запросов" + ", ";
        }
      }
    }

    if (!message) {
      message = "Непредвиденная ошибка, обратитесь в поддержку";
    } else if (message[message.length - 2] == ",") {
      message = message.substring(0, message.length - 2);
    }
    console.warn("[EM.Page.Form] Ошибка изменения данных:", message, errors);
    this.showErrors([
      {
        text: message,
        type: "all",
      },
    ]);
  }

  closeForm(e) {
    e.target.closest("[data-em-message]").setAttribute("hidden", true);

    this.$form.find(".input-error").removeClass("input-error");
    this.$form.find("[data-em-message]").removeClass("account-errors");
  }

  showSuccess() {
    // this.$form.find("textarea[name='wish']:first").val("");
    this.$form.find(".input-error").removeClass("input-error");
    this.$form
      .find("[data-em-message]")
      .attr("hidden", false)
      .addClass("account-success")
      .removeClass("account-errors")
      .find("span:first")
      .text(
        this.typeForm == this.typesForms.subscription
          ? "Данные сохранены"
          : "Ваш запрос успешно отправлен",
      );
  }

  showErrors(errors) {
    this.$form.find(".input-error").removeClass("input-error");

    let errorTitle = "";
    for (const error of errors) {
      if (error.type == "all" || error.type == "access") {
        errorTitle += error.text + ", ";
        continue;
      }
      const $parent = this.$form
          .find(`.input[name="${error.type}"]`)
          .closest(".input-group"),
        $inputError = $parent.find(".form-mess__error");

      if ($inputError.length) {
        $inputError.text(error.text);
        $parent.addClass("input-error");
      } else if ($parent.length) {
        $parent
          .addClass("input-error")
          .append(`<span class="form-mess__error">${error.text}</span>`);
      }
    }

    this.$form
      .find("[data-em-message]")
      .attr("hidden", false)
      .addClass("account-errors")
      .removeClass("account-success")
      .find("span:first")
      .text(
        errorTitle
          ? errorTitle.substring(0, errorTitle.length - 2)
          : "ошибка, заполните поля корректно!",
      );
  }
};

// Wishlist JS для InSales
window.EM_Module.Wishlist = null;

console.log("[EM.Modules] Initiated successfully");

EventBus.publish("eventLoader", {
  isTest: false,
  title: "Loader",
  status: "ok",
});

/**
 * Wishlist JS для InSales
 * Модуль для реализации вишлииста JLS API
 * Версия: 1.0.0
 */
document.addEventListener("DOMContentLoaded", function () {
  class WishlistAPI {
    constructor(config = {}) {
      this._name = "[EM.Wishlist]";
      this._inited = false;
      this._tracking = config.trackingWishlist ?? true;

      // Ограничение списка избранного
      this.maxItems = 30;

      // Список вишлиста
      this.wishlistIDs = [];
      this.clientID = null;

      this.classes = {
        iconAdded: "favorites-added",
        // iconCounterEmpty: "favorites-empty"
      };
      // Типы операций с вишлистом
      this.type = {
        remove: "remove",
        getIDs: "get-list",
        get: "get",
        add: "add",
        init: "init",
      };
      this.nameEventUpdate = "em_wishlist:update";

      this.$favoritesCounter = $("[data-em-favorites-counter]");
    }

    async init(renderIcon = true) {
      try {
        const client = await ajaxAPI.shop.client.get();
        // console.warn(this._name, "Ошибка инициализации, клиент не авторизирован:", client);

        // Проверка на авторизацию клиента
        this.clientID = client?.authorized && client?.id ? client.id : null;
      } catch (_) {}

      if (this.clientID) {
        await this.setWishlist();
        this.checkOverflowWishilst();

        if (renderIcon) this.renderIcons();

        EventBus.subscribe(
          this.nameEventUpdate,
          this.updateWishlist.bind(this),
        );
        EventBus.publish(this.nameEventUpdate, {
          wishlist: this.wishlistIDs,
          items: this.wishlistIDs,
          method: this.type.init,
        });
      } else {
        this.wishlistIDs = [];
      }

      document.addEventListener("click", this.click.bind(this));

      this._inited = true;
    }

    click(e) {
      if (e.target.getAttribute("data-em-favorites-trigger")) {
        if (this.clientID) {
          this.switch(e.target);
        } else {
          e.preventDefault();
          this.openLoginForWishlist();
        }
      }
    }

    openLoginForWishlist() {
      const popupRoot = document.querySelector("#popup-login");
      const errorEl = popupRoot?.querySelector(".popup-right__form-error");
      if (errorEl) {
        errorEl.textContent = "Вишлист будет доступ после авторизации";
        errorEl.removeAttribute("hidden");
      }

      const opener = document.querySelector('[data-popup="#popup-login"]');
      if (opener) opener.click();
    }

    // Отслеживание обновления вишлиста
    updateWishlist(data) {
      const count = data.wishlist?.length ?? 0;

      this.$favoritesCounter.html(count).attr("hidden", count === 0);

      if (!this._tracking || !data?.items || !data.items?.length) return;

      for (const productID of data.items) {
        document
          .querySelectorAll(`[data-em-favorites-trigger="${productID}"]`)
          .forEach((icon) => {
            if (data.method == this.type.remove) {
              icon.classList.remove(this.classes.iconAdded);
            } else {
              icon.classList.add(this.classes.iconAdded);
            }
          });
      }
    }

    async setWishlist() {
      const formData = new FormData();

      formData.append("page_size", String(this.maxItems + 2));

      const response = await this.getIDs(formData);
      if (!response.wishlist || !response.wishlist.length) return;

      this.wishlistIDs = response.wishlist;

      if (this.wishlistIDs.length > this.maxItems) {
        const delItems = this.wishlistIDs.splice(
          this.maxItems - 1,
          this.wishlistIDs.length - this.maxItems,
        );

        for (const productID of delItems) {
          this.remove(productID);
        }
      }
    }

    async switch(btn) {
      const productID = Number(btn?.getAttribute("data-em-favorites-trigger"));
      if (!btn || !productID || isNaN(productID)) return;

      if (btn.classList.contains(this.classes.iconAdded)) {
        btn.classList.remove(this.classes.iconAdded);
        await this.remove(productID);
      } else {
        btn.classList.add(this.classes.iconAdded);
        await this.add(productID);
      }
    }

    // Получить список вишлиста
    get(filtresFormData, isCache = false) {
      if (isCache) return this.wishlistIDs;

      return this.fetch(this.type.get, filtresFormData);
    }

    // Получить список productIDs в вишлисте
    getIDs(filtresFormData, isCache = false) {
      if (isCache) return this.wishlistIDs;

      return this.fetch(this.type.getIDs, filtresFormData);
    }

    /**
     * Проверка, есть ли товар в вишлисте (по локальному списку после init).
     * @param {number|string} productID — id товара InSales
     * @returns {boolean}
     */
    hasProduct(productID) {
      const id = Number(productID);
      if (!id || isNaN(id)) return false;

      return this.wishlistIDs.includes(id);
    }

    // Добавить товар в избранное
    async add(productID, variantID) {
      if (!productID) return false;

      if (this.wishlistIDs.length + 1 > this.maxItems) {
        const delItems = this.wishlistIDs.splice(
          this.maxItems - 2,
          this.wishlistIDs.length - this.maxItems + 1,
        );

        for (const productID of delItems) {
          this.remove(productID);
        }
      }

      const formData = new FormData();
      formData.append("product_id", String(productID));
      formData.append("variant_id", String(variantID ?? ""));

      const response = await this.fetch(this.type.add, formData);

      if (!response?.success) return false;

      this.wishlistIDs.push(productID);

      EventBus.publish(this.nameEventUpdate, {
        wishlist: this.wishlistIDs,
        items: [productID],
        method: this.type.add,
      });

      return true;
    }

    // Удалить товар из избранного
    async remove(productID, variantID) {
      if (!productID) return false;

      const formData = new FormData();
      formData.append("product_id", String(productID));
      formData.append("variant_id", String(variantID ?? ""));

      const response = await this.fetch(this.type.remove, formData);

      if (!response?.success) return false;

      const index = this.wishlistIDs.indexOf(productID);
      if (index > -1) {
        this.wishlistIDs.splice(index, 1);
      }

      EventBus.publish(this.nameEventUpdate, {
        wishlist: this.wishlistIDs,
        items: [productID],
        method: this.type.remove,
      });

      return true;
    }

    // Провекра вишлиста на переполнение
    checkOverflowWishilst() {
      if (this.wishlistIDs.length <= this.maxItems) return;

      const delItems = this.wishlistIDs.splice(
        this.maxItems,
        this.wishlistIDs.length - this.maxItems,
      );

      for (const productID of delItems) {
        setTimeout(() => {
          this.fetch(
            this.type.remove,
            new FormData().append("product_id", String(productID)),
          );
        }, 50);
      }
    }

    // Принудительно обновить избранное
    async forceUpdate(isCache = true) {
      if (!isCache) {
        await this.setWishlist();
        this.checkOverflowWishilst();
      }

      this.renderIcons();

      if (!isCache) {
        EventBus.publish(this.nameEventUpdate, {
          wishlist: this.wishlistIDs,
          method: this.type.update,
        });
      }
    }

    // Отрисовка состояния активных иконок
    async renderIcons() {
      for (const productID of this.wishlistIDs) {
        document
          .querySelectorAll(`[data-em-favorites-trigger="${productID}"]`)
          .forEach((icon) => {
            icon.classList.add(this.classes.iconAdded);
          });
      }
    }

    async fetch(type, formData = new FormData()) {
      formData.append("flow_id", "62b2caa5-7874-40a9-b7f2-1b9561fe9e83");
      formData.append("customer_id", String(this.clientID ?? ""));

      const response = await $.ajax({
        url: `https://insales.widgets.ibice.ru/api/jls-gateway/wishlist/${type}`,
        method: "POST",
        data: formData,
        processData: false,
        contentType: false,
        // dataType: "json",
        timeout: 10000,
      }).fail((err) => {
        console.warn(this._name, "Ошибка получения списка избранного:", err);
      });

      if (!response) {
        console.warn(
          this._name,
          "Ошибка получения списка избранного:",
          response,
        );
      }
      return response;
    }
  }

  EM_Module.Wishlist = new WishlistAPI();
  EM_Module.Wishlist.init(!window.location.pathname.includes("/favorites"));
});

// Переключение фото у товаров
window.addEventListener("DOMContentLoaded", () => {
  const isMobile = sessionStorage.getItem("isMobile") === "true",
    loader = new EM_Module.Loader();

  function observeDynamicElements(targetSelector, callback) {
    const targetNode = document.querySelector(targetSelector);

    if (!targetNode) {
      console.error("Элемент не найден:", targetSelector);
      return;
    }

    const observer = new MutationObserver(function (mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (
              node.classList &&
              node.classList.contains("products-item") &&
              node instanceof HTMLElement
            ) {
              callback(node);
            }
          });
        }
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  function handleSwipe(element, callback) {
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50; // Минимальное расстояние свайпа в пикселях

    element.addEventListener(
      "touchstart",
      function (event) {
        touchStartX = event.changedTouches[0].screenX;
      },
      false,
    );

    element.addEventListener(
      "touchend",
      function (event) {
        touchEndX = event.changedTouches[0].screenX;
        const swipeDistance = touchEndX - touchStartX;

        if (Math.abs(swipeDistance) > minSwipeDistance) {
          if (swipeDistance > 0) {
            callback(1);
          } else {
            callback(-1);
          }
        }
      },
      false,
    );
  }

  const ConnectImagesPreview = (element) => {
    if (
      element.classList.contains("imageViewer") ||
      element.classList.contains("loading-item")
    )
      return;
    element.classList.add("imageViewer");

    const ProductImages = element.querySelector(".products-item__img-list"),
      SectionsParent = element.querySelector(".products-item__sections"),
      width = element.clientWidth,
      SourcesCount = ProductImages?.children?.length,
      SectionWidth = width / SourcesCount,
      dotsParent = element.querySelector(".catalog__dots");

    if (!ProductImages || !SourcesCount) return;

    const setSlide = (index) => {
      for (let i = 0; i < dotsParent.children.length; i++) {
        if (i != index) {
          dotsParent.children[i].classList.remove("catalog__dot--active");
          ProductImages.children[i].classList.remove("is-active");
        }
      }
      ProductImages.children[index].classList.add("is-active");
      dotsParent.children[index].classList.add("catalog__dot--active");

      const img = ProductImages.children[index].querySelector("img");
      if (!img.complete) {
        loader.callStatic($(ProductImages.parentElement));
        img.onload = () => {
          setTimeout(() => {
            loader.hideStatic($(ProductImages.parentElement));
          }, 150);
        };
        img.onerror = () => {
          setTimeout(() => {
            loader.hideStatic($(ProductImages.parentElement));
          }, 150);
        };
      }
    };
    let fragmentHover = new DocumentFragment(),
      fragmentDot = new DocumentFragment();

    for (let i = 0; i < SourcesCount; i++) {
      const hoverSection = document.createElement("div"),
        dot = document.createElement("div");

      hoverSection.className = "products-item__section";
      hoverSection.style.width = `${SectionWidth}px`;
      hoverSection.style.left = `${SectionWidth * i}px`;

      dot.className = "catalog__dot";
      if (i === 0) {
        dot.classList.add("catalog__dot--active");
      }

      fragmentDot.appendChild(dot);
      fragmentHover.appendChild(hoverSection);
    }

    SectionsParent.appendChild(fragmentHover);
    dotsParent.appendChild(fragmentDot);

    ProductImages.firstElementChild.classList.add("is-active");

    const sections = SectionsParent.querySelectorAll(".products-item__section");

    sections.forEach((section) => {
      section.addEventListener("mouseenter", (e) => {
        for (let i = 0; i < SectionsParent.children.length; i++) {
          const children = SectionsParent.children[i];

          if (children == section) {
            setSlide(i);
          }
        }
      });
    });

    // swipes
    if (isMobile) {
      var currentSlide = 0;
      handleSwipe(element, function (direction) {
        currentSlide -= direction;

        if (currentSlide < 0) {
          currentSlide = SourcesCount - 1;
        } else if (currentSlide >= SourcesCount) {
          currentSlide = 0;
        }

        setSlide(currentSlide);
      });
    }
  };
  document
    .querySelectorAll("[data-js='product-item']")
    .forEach(ConnectImagesPreview);
  observeDynamicElements("[data-js='catalog-list']", (node) => {
    ConnectImagesPreview(node);
  });
});

/**
 * Инициализация основных слайдеров
 * Инициализация бейджей
 * Инициализация маски телефона
 */
document.addEventListener("DOMContentLoaded", function () {
  // Инициализация бейджей
  EM_Module.Badges.readingBages();

  // Инициализация маски телефона
  window.EM_Module.phoneMask = new window.EM_Module.PhoneMaskManager();
  EM_Module.phoneMask.initializeInputMasks("[data-mask-phone]");

  // Инициализация слайдеров
  const productsSliderWrappers = document.querySelectorAll(
    "[data-js-slider='products-slider-wrapper']",
  );
  if (!productsSliderWrappers) return;

  for (const wrapper of productsSliderWrappers) {
    new Swiper(wrapper.querySelector(".products-slider__list"), {
      observer: true,
      observeParents: true,
      slidesPerView: 5,
      spaceBetween: 0,
      slidesPerGroup: 2,
      speed: 800,
      navigation: {
        prevEl: wrapper.querySelector(".swiper-button-prev"),
        nextEl: wrapper.querySelector(".swiper-button-next"),
      },
      watchOverflow: true,
      breakpoints: {
        320: {
          slidesPerView: 2.1,
        },
        1023.98: {
          slidesPerView: 5,
        },
      },
      // on: {}
    });
  }

  /** Данный сладйер видимо больше не актуален
     * ! Удалить в следующем релизе
    const wishlistSliderWrappers = document.querySelectorAll('[data-js-slider="wishlist-slider-wrapper"]');
    if (wishlistSliderWrappers) wishlistSliderWrappers.forEach((wrapper => {
        const slider = wrapper.querySelector(".products-slider__list"), prev = wrapper.querySelector(".swiper-button-prev"), next = wrapper.querySelector(".swiper-button-next");
        if (slider) new swiper_core_Swiper(slider, {
            modules: [ Navigation ],
            observer: true,
            observeParents: true,
            slidesPerView: 4,
            spaceBetween: 0,
            slidesPerGroup: 2,
            speed: 800,
            navigation: {
                prevEl: prev,
                nextEl: next
            },
            breakpoints: {
                320: {
                    slidesPerView: 2
                },
                1023.98: {
                    slidesPerView: 4
                }
            },
            on: {}
        });
    }));
    */
});

// Авторизация / регистрация
document.addEventListener("DOMContentLoaded", function () {
  const isMobile = sessionStorage.getItem("isMobile") === "true";

  const formError = {
    _html: (mess) => {
      return `<div class="form-error" data-form-error>${mess}</div>`;
    },
    _set: ($block, mess, $input) => {
      if ($block.find("[data-form-error]").length) {
        $block.find("[data-form-error]").text(mess);
      } else if ($block.attr("data-login-code") !== undefined) {
        const $timer = $block.find("[data-timer]");
        if ($timer.length) {
          $timer.before(formError._html(mess));
        } else {
          $block.append(formError._html(mess));
        }
      } else {
        $block.append(formError._html(mess));
      }
      $block.find(".input-group__wrapper").addClass("_form-error");
      if ($input) $input.addClass("_form-error");
      else $block.find("input").addClass("_form-error");
    },
    set: ($block, mess, isCustomWrapper = true) => {
      if ($block.hasClass("input")) {
        formError._set(
          $block.closest(
            isCustomWrapper ? ".input-group__wrapper" : ".input-group",
          ),
          mess,
          $block,
        );
      } else {
        formError._set($block, mess);
      }
      return true;
    },
    remove: ($block) => {
      $block.find(".input-group__wrapper").removeClass("_form-error");
      $block.find("input").removeClass("_form-error");
      $block.find("[data-form-error]").remove();
    },
  };
  const messageError = (mess, err = "") => console.warn("[Login]", mess, err);
  const checkEmail = (email) => {
    return !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email);
  };
  const checkPhone = (phone) => {
    const clearPhone = phone.replace(/\D/g, "");
    return (
      (clearPhone.length === 11 &&
        (clearPhone[0] === "7" || clearPhone[0] === "8")) ||
      (clearPhone.length === 12 &&
        clearPhone[0] !== "7" &&
        clearPhone[0] !== "8")
    );
  };
  const checkDate = (date) => {
    const year = new Date(date).getFullYear();
    return /^\d{4}\-\d{2}\-\d{2}$/.test(date) && year > 1850 && year < 2022;
  };
  const getFormateDate = (date_str) => {
    if (!date_str.length) return "";
    const [year, month, day] = date_str.split("-");
    return `${day}.${month}.${year}`;
  };

  // var $popup = $widget,data-em-login
  var $popup = $("[data-em-login]"),
    // checkRequsts = false,
    $loginBtn = $popup.find("[data-login-button]"),
    state = "email",
    loader = { call() {}, hide() {} };

  function goBack() {
    if (isMobile) this.classList.add("_disabled-back");
    else this.setAttribute("hidden", true);
    if (state == "reg") return;

    state = "email";
    formError.remove($popup.find("[data-login-email]"));

    $popup
      .find(".input-group__wrapper._active")
      .removeClass("_active")
      .find("input")
      .val("");
    $popup
      .find("[data-login-code], .input-group__get-code")
      .attr("hidden", true);
    $popup
      .find("[data-login-button], [data-login-code] input")
      .prop("disabled", false);
    $popup
      .find("[data-login-email] input")
      .prop("disabled", false)
      .next()
      .removeAttr("hidden");
    $popup.find(".popup__form-message:first").attr("hidden", true);

    $loginBtn.text("Получить код");
  }

  function redirect(redirect_to, name) {
    if (!redirect_to) {
      document.location.href = "/client_account/orders";
    } else if (redirect_to.includes("/client_account/contacts") || !name) {
      setRegistration();
    } else if (redirect_to.includes("/client_account/orders")) {
      document.location.href = document.location.pathname;
    } else {
      document.location.href = redirect_to;
    }
  }

  function registration(clinet) {
    loader.call();
    $.post("/client_account/contacts.json", {
      authenticity_token: "",
      client: {
        registered: "1",
        phone: clinet.phone,
        name: clinet.name,
        surname: clinet.surname,
        email: clinet.email,
        fields_values_attributes: {
          16728777: { hack: "", field_id: "16728777", value: "" },
          16728778: { hack: "", field_id: "16728778", value: "" },
          16728779: { hack: "", field_id: "16728779", value: "" },
          16728780: { hack: "", field_id: "16728780", value: "" },
          16729835: {
            field_id: "16729835",
            value: clinet.birtdate,
          },
        },
        subscribe: clinet.subscribe,
        // messenger_subscription: "0"
      },
    })
      .done(function (response) {
        if (response.status !== "ok") {
          messageError("Ошибка регистрации ", response);
          $popup
            .find(".popup-right__form-error")
            .attr("hidden", false)
            .text(
              "Ошибка регистрации: " +
                (response?.fields_values.old_field ?? response?.errors).join(
                  ", ",
                ),
            );
        } else {
          console.log("[Login] Успешная регистрация", response.client);
          redirect(response.redirect_to, response.client.name);
        }
      })
      .fail(function (fail) {
        // checkRequsts = false;
        messageError("Ошибка регистрации", fail);
        $popup
          .find(".popup-right__form-error")
          .attr("hidden", false)
          .text("Ошибка регистрации: " + fail);
        loader.hide();
      });
  }

  function inputRegistration() {
    let notCorrect = false;
    const email = $popup.find('[name="login"]'),
      name = $popup.find('[name="client[name]"]'),
      surname = $popup.find('[name="client[surname]"]'),
      phone = $popup.find('[name="client[phone]"]'),
      birtdate = $popup.find('[name="client[birthdate]"]'),
      subscribe = $popup.find('[name="offers"]').prop("checked") ? "1" : "0";

    if (!email.val() || checkEmail(email.val()))
      notCorrect = formError.set(email, "Ошибка в email");
    else formError.remove(email);
    if (!name.val()) notCorrect = formError.set(name, "Заполните имя", false);
    else formError.remove(name);
    if (!surname.val())
      notCorrect = formError.set(surname, "Заполните фамилию", false);
    else formError.remove(surname);
    if (!phone.val() || !checkPhone(phone.val()))
      notCorrect = formError.set(phone, "Заполните телефон", false);
    else formError.remove(phone);
    if (birtdate.val() && !checkDate(birtdate.val()))
      notCorrect = formError.set(
        birtdate,
        "Введите корректную дату рождения",
        false,
      );
    else {
      birtdate.closest(".input-group").find(".form-error").remove();
      formError.remove(birtdate);
    }
    if (notCorrect) return;

    registration({
      email: email.val(),
      name: name.val(),
      surname: surname.val(),
      phone: phone.val(),
      birtdate: getFormateDate(birtdate.val()),
      subscribe: subscribe,
    });
  }

  function setRegistration() {
    state = "reg";

    loader.call();
    $popup
      .find(
        "[data-login-code], .popup-right__form-back-wrapper, [data-login-email] .input-group__capture",
      )
      .attr("hidden", true);
    $popup
      .find(
        "[data-login-name],[data-login-offers],[data-login-datebirth],[data-login-phone]",
      )
      .attr("hidden", false);
    $popup
      .find("[data-login-offers] label")
      .addClass("_active")
      .find("input")
      .prop("checked", true);
    $popup.find(".popup-right__back").addClass("_disabled-back");
    $loginBtn.text("Зарегистрироваться");
    $popup.find(".popup-right__form-title").text("Регистрация");
    $popup
      .find(".popup-right__form")
      .attr("action", "/client_account/contacts");
    $popup.find("[data-em-policy-name]").text("Зарегистрироваться");
    $popup.find(".popup__form-message:first").attr("hidden", true);

    setTimeout(() => {
      loader.hide();
    }, 400);
  }

  function authorization(code) {
    if (!code) return;
    const email = $popup.find('[name="login"]').val();

    console.log("Отправка кода", code);

    // checkRequsts = true;
    $.post("/client_account/session.json", {
      login: email,
      code: code,
    })
      .done(function (response) {
        console.log("[Login] Авторизация", response);
        // checkRequsts = false;

        // cart_items#popup-cart registered
        if (response.status !== "ok") {
          console.log("[Request Login Code] Ошибка", response);
          // $popup.find(".cart-popup__promocode-error").attr("hidden", false).text( response.errors[0] );
          const errorTitle = response.errors.join(", ");
          formError.set(
            $popup.find("[data-login-code]"),
            errorTitle.includes("неверный код")
              ? "Введён неверный код"
              : errorTitle,
          );
        } else {
          console.log("[Login] Успех", response.client.registered);
          redirect(response.redirect_to, response.client.name);
        }
      })
      .fail(function (fail) {
        messageError("Ошибка получения кода", fail);
        formError.set(
          $popup.find("[data-login-code]"),
          "Непредвиденная ошибка, попробуйте позже",
        );
        // checkRequsts = false;
      });
  }

  function checkCaptcha(message, nameForm) {
    if (!message.includes("робот")) return;

    reCaptchaCommon.render($popup.find("#recaptchaBlockLogin"), nameForm);
  }

  function getAccessCode(response) {
    var timerId = null,
      counter = 60,
      $timer = $popup.find("[data-timer]");

    function getCode(message, timeout) {
      let $textTimer = $timer.find("span:last");
      counter = timeout;

      // $timer.attr("hidden", false).html(`${message}:<span>${timeout}</span>`);
      $timer.attr("hidden", false).find("span:first").text(message);
      $textTimer.text(timeout);
      if (timerId === null) {
        timerId = setInterval(() => {
          counter--;
          if (counter < 0) {
            clearInterval(timerId);
            $textTimer.text("00");

            $timer.attr("hidden", true);
            $popup.find(".input-group__get-code").attr("hidden", false);
          }
          $textTimer.text(String(counter).padStart(2, "0"));
        }, 1000);
      }
    }

    state = "code";
    // checkRequsts = false;
    if (response.status == "error") {
      const messError = response.errors.join(", ");
      if (response.timeout) {
        // formError.remove($popup.find("[data-login-code]"));
        $loginBtn.prop("disabled", true);
        getCode(messError + ": 00:", response.timeout);
      } else {
        formError.set($popup.find("[data-login-code]"), messError);
        $popup
          .find("[data-login-code] input, [data-login-button]")
          .prop("disabled", true);
      }
      checkCaptcha(messError, "one_time_code");
      $popup.find(".input-group__get-code").attr("hidden", true);
      return;
    }
    formError.remove($popup.find("[data-login-code]"));
    $loginBtn.prop("disabled", true);
    $popup.find(".input-group__get-code").attr("hidden", true);

    getCode("Получить новый код можно через 00:", response.timeout);
  }

  // Получение кода Авторизации / Регистрации
  function sendingCode(email) {
    console.log("Запрос кода", email);

    $popup.find(".popup__form-message:first").removeAttr("hidden");
    $.post("/client_account/one_time_code.json", {
      login: email,
    })
      .done(getAccessCode)
      .fail(function (fail) {
        // checkRequsts = false;
        messageError("Ошибка получения кода", fail);
        formError.set(
          $popup.find("[data-login-code]"),
          "Возникла ошибка при получении кода, перезагрузите страницу или попробуйте позже",
        );
        $popup
          .find("[data-login-code] input, [data-login-button]")
          .prop("disabled", true);
      });
  }

  function getCodeInput() {
    let code = "";
    for (const input of $popup.find(".input_code")) {
      if (input.value.length > 1) input.value = input.value[0];
      if (input.value) code += input.value;
    }
    return {
      isCorrect: code.length == 5 && !isNaN(Number(code)),
      code: code,
    };
  }

  function clearInput() {
    if (this.disabled) return;
    if (this.parentElement && this.previousElementSibling) {
      this.previousElementSibling.value = "";
      this.previousElementSibling.disabled = false;
      this.parentElement.classList.remove("_active");

      // if (state == "code") {
      //     state = "email";
      //     $popup.find("[data-login-code]").attr("hidden", true);
      // }
      if (this.previousElementSibling.classList.contains("input_code")) {
        $loginBtn.prop("disabled", true);
      } else if (state == "code") {
        state = "email";
        $loginBtn.prop("disabled", false);
        $popup
          .find("[data-login-code]")
          .attr("hidden", true)
          .find(".input_code")
          .removeAttr("disabled");

        // formError.remove(
        //     $popup.find("[data-login-code]").attr("hidden", true)
        // );
      }
    }
  }

  function pasteCode(event) {
    event.preventDefault();
    if (event.target.dataset.nextInput === undefined) return;
    const next = Number(event.target.dataset.nextInput) - 2;
    const paste = (event.clipboardData || window.clipboardData)?.getData(
      "text",
    );
    if (!paste || Number(isNaN(paste)) || paste.length < 1 || isNaN(next))
      return;

    let index = 0;
    for (let input of $popup.find(".input_code").slice(next)) {
      if (index + 1 > paste.length) break;
      input.value = paste[index];
      input.offsetParent.classList.add("_active");
      index++;
    }
    if (next + paste.length > 4) {
      $loginBtn.prop("disabled", false);
    }
  }

  function inputCode() {
    if (!this.value) {
      $loginBtn.prop("disabled", true);
      return;
    }
    state == "code";

    const code = getCodeInput();
    $loginBtn.prop("disabled", !code.isCorrect);

    if (this.dataset.nextInput) {
      $popup
        .find(
          `.input-group__wrapper:nth-child(${this.dataset.nextInput}) .input_code`,
        )
        .trigger("focus");
    }
    // if (code.isCorrect) {
    //     buttonOnClick();
    // }
  }

  function buttonOnClick() {
    if (state == "email") {
      const $input = $popup.find('[name="login"]');
      const $emailWrapper = $popup.find("[data-login-email]");
      const email = $input.val().replaceAll(" ", "");
      if (!email || checkEmail(email)) {
        formError.set(
          $emailWrapper,
          email.length ? "Некорректный формат почты" : "Заполните почту",
        );
        return;
      }
      $input.prop("disabled", true);
      $input.next().attr("hidden", true);
      $emailWrapper.find(".input-group__capture").attr("hidden", true);
      $popup
        .find("[data-login-code], .popup-right__form-back")
        .attr("hidden", false);
      $loginBtn.text("Подтвердить код");
      if (isMobile) {
        $popup.find(".popup-right__back").removeClass("_disabled-back");
      }
      formError.remove($emailWrapper);

      $popup.find(".input_code:first").trigger("focus");
      sendingCode(email);
    } else if (state == "code") {
      const code = getCodeInput();
      if (code.isCorrect) authorization(code.code);
      else {
        formError.set(
          $popup.find("[data-login-code]"),
          "Введите корректный код",
        );
      }
    } else if (state == "reg") {
      $loginBtn.text("Зарегистрироваться");
      inputRegistration();
    }
  }

  if (!$popup.length) {
    messageError("Форма не найдена");
    return;
  }
  if (isMobile) {
    $popup.find(".popup-right__back").on("click", goBack);
  } else {
    $popup.find(".popup-right__form-back").on("click", goBack);
    // Нажатие клавиши enter при вводе кода
    $popup.find(".input_code").on("keydown", function (e) {
      if (e.key === "Enter" || e.which === 13) {
        state = "code";
        buttonOnClick();
      }
    });
    $popup.find("[data-login-email] input:first").on("keydown", function (e) {
      if (e.key === "Enter" || e.which === 13) {
        state = "email";
        buttonOnClick();
      }
    });
  }

  $loginBtn.on("click", buttonOnClick);
  $popup.find(".input-group__get-code").on("click", function () {
    state = "email";
    buttonOnClick();
  });
  $popup.find('[data-js="input-clear"]').on("click", clearInput);
  $popup.find(".input_code").on("input", inputCode);
  // $popup.find(".input_code").on("paste", pasteCode);
  $popup
    .get(0)
    .querySelectorAll(".input_code")
    .forEach((input) => input.addEventListener("paste", pasteCode));
  $popup.find(".input_code").on("onkeydown", function (e) {
    return isNumberKey(e);
  });

  EventBus.subscribe("eventLoader", function () {
    loader = new EM_Module.Loader($popup.find(".popup-right__form:first"));
    // setRegistration();
  });

  $("button[data-popup='#popup-login']").on("click", function () {
    setTimeout(() => {
      $popup.find("[data-login-email] input:first").trigger("focus");
    }, 550);
  });
  /* Отслеживание ввода текста
    $popup.find("input").each(function() {
        const self = this;

        this.onkeyup = this.oninput = () => changeInput(self);
        this.onpropertychange = function(event) {
            if (event.propertyName == "value") changeInput(self);
        }
        this.oncut = function() {       1``
            setTimeout(() => changeInput(self), 1);
        };
    });
    */
});

// Лимпкая шапка
document.addEventListener("DOMContentLoaded", function () {
  // Обработка вслытия шапки на ПК
  function setHeaderEvent($headerWrapper) {
    var isClick = false;
    const observer = new MutationObserver((mutations) => {
      if ($(this).scrollTop() > 125) return;

      mutations.forEach((mutation) => {
        if (
          mutation.attributeName !== "class" ||
          !mutation.target ||
          !mutation.target.classList
        )
          return;
        if (mutation.target.classList.contains("_active")) {
          $headerWrapper.removeClass("_header-not-white");
        } else if (!isClick) {
          $headerWrapper.addClass("_header-not-white");
        }
      });
    });
    observer.observe($headerWrapper.find(".header__sub-wrapper:first").get(0), {
      attributes: true,
    });
    observer.observe($headerWrapper.find(".menu__sub-wrapper:first").get(0), {
      attributes: true,
    });

    $headerWrapper
      .find(".menu__item, [data-js-sub-btn='search']:first")
      .on("mouseover", function () {
        if (
          $(this).scrollTop() < 126 &&
          $headerWrapper.hasClass("_header-not-white")
        ) {
          $headerWrapper.removeClass("_header-not-white");
        }
      })
      .on("mouseleave", function () {
        if (
          $(this).scrollTop() < 126 &&
          !$headerWrapper.hasClass("_header-not-white") &&
          !$headerWrapper.find(".sub-wrapper._active:first").length
        ) {
          $headerWrapper.addClass("_header-not-white");
        }
      });

    $headerWrapper.find(".menu__item").on("click", function () {
      if ($(this).scrollTop() < 126) {
        isClick = true;
        // $headerWrapper.removeClass("_header-not-white");
      }
    });
  }

  function handleMediaChange(event) {
    if (
      event.matches !== noticeBlock.classList.contains("header__notice-mob")
    ) {
      noticeBlock = document.querySelector(
        mediaQuery.matches
          ? "header .header__notice-mob"
          : "header .header__notice",
      );
    }
    const height = noticeBlock?.offsetHeight ?? 0;
    document.documentElement.style.setProperty(
      "--notice-basic-height",
      height + "px",
    );
    document.documentElement.style.setProperty(
      "--notice-height",
      event.matches ? height + "px" : "0px",
    );
    // popupNotice.style.top = `calc(3.5rem + ${height}px)`;
  }

  function setEventNotice() {
    mediaQuery.addEventListener("change", handleMediaChange);
    handleMediaChange(mediaQuery);

    if (mediaQuery.matches) {
      const initialTop = noticeBlock?.offsetHeight ?? 0;
      const menuTop = document.querySelector("[data-em-menu-top]");

      if (menuTop) {
        if (initialTop > 0) {
          window.addEventListener("scroll", function () {
            menuTop.style.top =
              Math.max(0, initialTop - window.pageYOffset) + "px";
          });
        }
        menuTop.style.top = Math.max(0, initialTop - window.pageYOffset) + "px";
      }
    } else {
      const changeVisablNotice = () => {
        const hideBlock = $(this).scrollTop() > 125;
        if (hideBlock && noticeBlock.style.display !== "none") {
          $(noticeBlock).slideUp(350);
          document.documentElement.style.setProperty("--notice-add-top", "0px");
        } else if (
          !hideBlock &&
          (noticeBlock.style.display === "none" || !noticeBlock.style.display)
        ) {
          $(noticeBlock).slideDown(350);
          document.documentElement.style.setProperty(
            "--notice-add-top",
            document.documentElement.style.getPropertyValue(
              "--notice-basic-height",
            ),
          );
        }
      };
      changeVisablNotice();
      window.addEventListener("scroll", changeVisablNotice);
    }
  }

  // Скролл для состояния шапки
  function scrollForHeader($headerWrapper) {
    const changeColorHeader = () => {
      const hideBlock = $(this).scrollTop() > 125;
      if (hideBlock && $headerWrapper.hasClass("_header-not-white")) {
        $headerWrapper.removeClass("_header-not-white");
      } else if (!hideBlock && !$headerWrapper.hasClass("_header-not-white")) {
        if (!$headerWrapper.find(".sub-wrapper._active:first").length) {
          $headerWrapper.addClass("_header-not-white");
        }
      }
    };

    window.addEventListener("scroll", changeColorHeader);
    changeColorHeader();
  }

  function shwoNotice() {
    noticeBlock.removeAttribute("hidden");
    setTimeout(setEventNotice, 250);
  }

  const mediaQuery = window.matchMedia("(max-width: 63.99875em)");
  // const popupNotice = document.querySelector("[data-popup-notice]");
  var noticeBlock = document.querySelector(
    mediaQuery.matches
      ? "header .header__notice-mob"
      : "header .header__notice",
  );

  if (window.location.pathname === "/" && !mediaQuery.matches) {
    const $headerWrapper = $(".header__wrapper:first");

    setHeaderEvent($headerWrapper);
    scrollForHeader($headerWrapper);
  }
  if (window.location.pathname !== "/" && !mediaQuery.matches) {
    $(".header:first").css(
      "min-height",
      "calc(3.5rem + var(--notice-basic-height))",
    );
  }
  if (!noticeBlock) return;
  if (noticeBlock.classList.contains("header__bf-timer")) {
    if (window.location.pathname !== "/") {
      shwoNotice();
    }
  } else {
    ajaxAPI.shop.client
      .get()
      .done(function (client) {
        if (!client.authorized || !client.orders_count) {
          shwoNotice();
        }
      })
      .fail(shwoNotice);
  }
});
// upd
;
