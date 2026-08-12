// Доработать:
// 1. Поправить вывод цен у товаров, включая скидки
// 2. Сделать вывод бейджей

//*** Новый каталог ***/
document.addEventListener("DOMContentLoaded", function () {
  const $catalog = $widget;

  const $ajaxProducts = $catalog.find("[data-ajax-products]:first");
  const $catalogState = $catalog.find(".catalog__error:first");
  const $paginationBody = $catalog.find("[data-em-pagin]:first");
  const $panel = $catalog.find(".catalog__top-panel:first");

  const pageFromURL = parseInt(
    new URLSearchParams(window.location.search).get("page"),
    10,
  );
  const initialPage =
    Number.isFinite(pageFromURL) && pageFromURL > 0
      ? pageFromURL
      : parseInt($catalog.find("input[name='current_page']").val(), 10) || 1;
  const isMobile = sessionStorage.getItem("isMobile") === "true";

  var filters;
  const loaders = {};
  const pagination = {
    instance: null,
    eventsInited: false,
  };

  var isFetching = false;
  var hasMorePages = false;

  function mapProductToTemplate(product, i) {
    return {
      product: product,
      images: EM_Module.func.getImagesForCatalog(product.images.slice(0, 4), i),
      badgesHTML: EM_Module.Badges.getBadges(product),
      article: product.variants[0].sku,
      urlNotAvailable: window.EM_Module.func.extractSection(product.url),
      isSoon: EM_Module.func.checkSoonCahrs(
        product.characteristics,
        product.url,
      ),
      isPreorder: EM_Module.func.checkPreorderChars(product.characteristics),
      // НОВОЕ: проверка характеристики "Доступен только офлайн"
      isOfflineOnly: (product.characteristics || []).some(
        (char) => char.property_id == 149717105 && char.id == 923169233,
      ),
    };
  }

  /**
   * Переставляет первые 4 товара в каталоге в зависимости от поддомена.
   * Для каждого города (subdomain) задан свой уникальный порядок отображения первых 4-х товаров каталога.
   * Вот соответствие домена и порядка (по индексам массива):
   *
   *   moscow        [3,0,1,2]
   *   spb           [1,0,2,3]
   *   nn            [2,1,0,3]
   *   krasnoyarsk   [0,2,1,3]
   *   ekaterinburg  [3,1,2,0]
   *   kazan         [0,3,2,1]
   *   chelyabinsk   [0,1,3,2]
   *   samara        [1,0,3,2]
   *   omsk          [2,3,0,1]
   *   rostov        [3,2,1,0]
   *   ufa           [2,0,1,3]
   *   voronezh      [1,2,0,3]
   *   perm          [1,3,2,0]
   *   kemerovo      [2,1,3,0]
   *   tolyatti      [2,3,1,0]
   *   default       [0,1,2,3] (при неизвестном поддомене)
   *
   * Принцип работы: для каждого поддомена поочередно меняем элементы местами так,
   * чтобы итоговый массив совпал с нужным порядком.
   */
  function reorderProductsBySubdomain(arr) {
    const n = arr.length;
    const swapAt = (i, j) => {
      if (i < n && j < n) [arr[i], arr[j]] = [arr[j], arr[i]];
    };

    switch (window.location.hostname) {
      case "spb.duman.store":
        swapAt(0, 1);
        break; // [1,0,2,3]
      case "nn.duman.store":
        swapAt(0, 2);
        break; // [2,1,0,3]
      case "krasnoyarsk.duman.store":
        swapAt(1, 2);
        break; // [0,2,1,3]
      case "ekaterinburg.duman.store":
        swapAt(0, 3);
        break; // [3,1,2,0]
      case "kazan.duman.store":
        swapAt(1, 3);
        break; // [0,3,2,1]
      case "chelyabinsk.duman.store":
        swapAt(2, 3);
        break; // [0,1,3,2]
      case "samara.duman.store":
        swapAt(0, 1);
        swapAt(2, 3);
        break; // [1,0,3,2]
      case "omsk.duman.store":
        swapAt(0, 2);
        swapAt(1, 3);
        break; // [2,3,0,1]
      case "rostov.duman.store":
        swapAt(0, 3);
        swapAt(1, 2);
        break; // [3,2,1,0]
      case "ufa.duman.store":
        swapAt(0, 1);
        swapAt(0, 2);
        break; // [2,0,1,3]
      case "voronezh.duman.store":
        swapAt(0, 2);
        swapAt(0, 1);
        break; // [1,2,0,3]
      case "perm.duman.store":
        swapAt(0, 3);
        swapAt(0, 1);
        break; // [1,3,2,0]
      case "kemerovo.duman.store":
        swapAt(0, 3);
        swapAt(0, 2);
        break; // [2,1,3,0]
      case "tolyatti.duman.store":
        swapAt(0, 3);
        swapAt(1, 2);
        swapAt(0, 1);
        break; // [2,3,1,0]
      case "moscow.duman.store":
        swapAt(0, 3);
        swapAt(1, 3);
        swapAt(2, 3);
        break; // [3,0,1,2]
    }

    return arr;
  }

  // Отрисовка товаров
  function drawProduct(products) {
    const currentOrder = filters.getSelectFilters()?.order || "";
    const isPriceSort =
      currentOrder === "price" || currentOrder === "descending_price";
    const orderedProducts = isPriceSort
      ? products
      : reorderProductsBySubdomain(products);

    let html = "";

    for (let i = 0; i < orderedProducts.length; i++) {
      const itemHtml = Template.render(
        mapProductToTemplate(orderedProducts[i], i),
        "catalog-item",
      );
      if (itemHtml) {
        html += itemHtml.trim();
      }
    }

    return html;
  }

  // Запрос получения товаров в каталоге
  async function fetchCatalog(data = {}) {
    isFetching = true;

    // Базовые параметры
    const page = filters?.currentPage || initialPage || 1;
    const pageSize = filters.pageSize;
    const order = data?.order ?? filters?._getSelectSorting?.() ?? "";

    // Опции и характеристики – берём напрямую из фильтров (с группировкой по ID)
    const options = filters?._getOptionsFilters?.() || {};
    const characteristics = filters?._getCharacteristicsFilters?.() || {};

    // Цена – из переданных данных (актуальные значения после применения)
    let priceMin = data?.price_min;
    let priceMax = data?.price_max;

    // Временно используем .aspx (тестовый обработчик)
    const baseUrl = `https://dumansto.re/front-api${window.location.pathname}.aspx`;
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("page_size", pageSize);
    if (order) params.set("order", order);
    if (priceMin != null && !isNaN(priceMin)) params.set("price_min", priceMin);
    if (priceMax != null && !isNaN(priceMax)) params.set("price_max", priceMax);

    let queryString = params.toString();
    const customParams = [];

    // [FIX] Опции – формат options[ID][]=значение (каждое значение отдельным параметром)
    Object.entries(options).forEach(([id, values]) => {
      if (values && values.length) {
        values.forEach((value) => {
          customParams.push(`options[${id}][]=${value}`);
        });
      }
    });

    // [FIX] Характеристики – формат characteristics[ID]=значение1,значение2
    Object.entries(characteristics).forEach(([id, values]) => {
      if (values && values.length) {
        customParams.push(`characteristics[${id}]=${values.join(",")}`);
      }
    });

    // Склеиваем вручную, чтобы скобки/запятые не кодировались в %5B/%5D/%2C
    if (customParams.length > 0) {
      queryString += (queryString ? "&" : "") + customParams.join("&");
    }

    const url = `${baseUrl}?${queryString}`;

    try {
      const response = await $.ajax({
        url: url,
        method: "GET",
        dataType: "json",
        timeout: 10000,
      });
      return response;
    } catch (error) {
      console.warn(
        "[New.Catalog]",
        "Ошибка выполнения запроса каталога:",
        error,
      );
      return null;
    } finally {
      isFetching = false;
    }
  }

  function updateURL(page) {
    if (!page || Number(page) < 1) return;

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("page", String(page));

    const query = urlParams.toString();
    const newURL = `${window.location.pathname}${query ? `?${query}` : ""}`;

    try {
      window.history.pushState({ page: Number(page) }, "", newURL);
    } catch (error) {
      console.warn("[New.Catalog]", "Не удалось обновить URL:", error);
    }
  }

  function scrollToCatalogTop() {
    const top = $catalog.offset()?.top ?? 0;
    window.scrollTo({
      top: Math.max(top - 20, 0),
      behavior: "smooth",
    });
  }

  function getPagesCount(response) {
    const directPages = Number(
      response?.pages ??
        response?.total_pages ??
        response?.pagination?.pages ??
        response?.paginate?.pages,
    );
    if (Number.isFinite(directPages) && directPages > 0) return directPages;

    const totalItems = Number(
      response?.count ??
        response?.total_count ??
        response?.products_count ??
        response?.total ??
        response?.pagination?.total ??
        response?.paginate?.items,
    );
    if (!Number.isFinite(totalItems) || totalItems < 1) return 0;

    return Math.ceil(totalItems / filters.pageSize);
  }

  function initPagination(products, response) {
    if (!pagination.instance || !$paginationBody.length) return;

    if (!products.length) {
      pagination.instance.hide(true);
      return;
    }

    const pagesCount = getPagesCount(response);
    if (!pagesCount || pagesCount <= 1) {
      pagination.instance.hide(true);
      return;
    }

    $paginationBody.attr("data-em-pagin", pagesCount);
    pagination.instance.init(filters.currentPage, pagesCount);

    if (!pagination.eventsInited) {
      pagination.instance.initEvent();
      pagination.eventsInited = true;
    }
  }

  function handlePaginationPageSwitch(page) {
    const newPage = Number(page);
    if (
      !Number.isFinite(newPage) ||
      newPage < 1 ||
      newPage === filters.currentPage
    )
      return;

    filters.currentPage = newPage;
    updateURL(newPage);
    scrollToCatalogTop();
    renderCatalog(true);
  }

  function initPaginationEvents() {
    if (!$paginationBody.length) return;

    $catalog.on("click", ".pagin__number[data-pagin-index]", function (event) {
      event.preventDefault();
      handlePaginationPageSwitch(event.currentTarget.dataset.paginIndex);
    });
  }

  // Рендер каталога
  async function renderCatalog(clear = false) {
    $catalogState.attr("hidden", true);
    $panel.addClass("_panel_disabled");

    if (clear) {
      hasMorePages = false;
      loaders.skeleton.show(filters.pageSize, true);
      loaders.loader.visibleLoader(false);
    } else {
      loaders.loader.visibleLoader(true);
    }

    const response = await fetchCatalog(filters.getSelectFilters());
    const products = Array.isArray(response?.products) ? response.products : [];

    $panel.removeClass("_panel_disabled");
    $catalog.find(".catalog__title-count:first").text(response.count);

    if (!response) {
      if (clear) {
        loaders.skeleton.hide();
        $catalogState
          .text("Не удалось загрузить товары. Попробуйте обновить страницу.")
          .removeAttr("hidden");
      } else {
        loaders.loader.visibleLoader(false);
      }
      return;
    }

    if (!products.length) {
      if (clear) {
        loaders.skeleton.hide();
        $catalogState.text("Товары не найдены").removeAttr("hidden");
      } else {
        loaders.loader.visibleLoader(false);
      }
      hasMorePages = false;
      filters.visibleBtnMore(false, false);
      initPagination([], response);
      return;
    }

    const html = drawProduct(products);
    if (clear) {
      loaders.skeleton.hide(html.length > 0 ? html : "");
      if (!html.length) {
        $catalogState.text("Товары не найдены").removeAttr("hidden");
      }
    } else if (html.length > 0) {
      $ajaxProducts.append(html);
      loaders.loader.visibleLoader(false);
    }

    const canLoadMore = html.length > 0 && products.length >= filters.pageSize;
    hasMorePages = canLoadMore;
    filters.visibleBtnMore(canLoadMore, false);
    initPagination(products, response);

    if (!clear) loaders.loader.visibleLoader(false);
    else EM_Module.Wishlist.forceUpdate();
  }

  // Отслеживание обновления фильтров
  function updateFilters(filter) {
    if (filter.method == filters.typesEvent.init) {
      updateURL(filters.currentPage);
      renderCatalog(true);
    } else if (filter.method == filters.typesEvent.change) {
      filters.currentPage = 1;
      updateURL(1);
      scrollToCatalogTop();
      renderCatalog(true);
    } else if (filter.method == filters.typesEvent.clear) {
      filters.currentPage = 1;
      updateURL(1);
      scrollToCatalogTop();
      renderCatalog(true);
    }
  }

  // Загрузка следующей страницы (дозагрузка товаров)
  function loadNextPage() {
    if (isFetching || !hasMorePages) return;

    filters.currentPage++;
    updateURL(filters.currentPage);
    renderCatalog(false);
  }

  // Автозагрузка при достижении конца контейнера товаров
  function initInfiniteScroll() {
    const productsContainer = $ajaxProducts.get(0);
    if (!productsContainer) return;

    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    productsContainer.after(sentinel);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadNextPage();
      },
      { rootMargin: "0px 0px 300px 0px" },
    );

    observer.observe(sentinel);
  }

  // Кнопка "Загрузить ещё" — перехватываем клик через loadNextPage
  function initLoadMoreBtn() {
    $catalog.on("click", "[data-load-more]", function (e) {
      e.preventDefault();
      loadNextPage();
    });
  }

  function initCatalog() {
    loaders.skeleton = new window.EM_Module.Loaders.Skeleton($ajaxProducts);
    loaders.loader = new window.EM_Module.Loaders.Loader(
      null,
      $catalog.find(".catalog__loader:first"),
    );

    filters = new window.EM_Module.Filters({
      mode: "catalog",
      pageSize: window.matchMedia("(max-width: 63.9988em)").matches ? 10 : 16,
      currentPage: initialPage,
    });
    filters.init();

    if (
      $paginationBody.length &&
      typeof window.EM_Module.Pagination === "function"
    ) {
      pagination.instance = new window.EM_Module.Pagination($catalog, isMobile);
    }
    initPaginationEvents();

    EventBus.subscribe(filters.nameEvent, updateFilters);

    initInfiniteScroll();
    // initLoadMoreBtn();
  }

  function setActiveMenu() {
    $catalog
      .find(
        `.catalog__navigation .catalog__navigation-item-link[href='${window.location.pathname}']:first`,
      )
      .addClass("_active");
  }

  setActiveMenu();
  initCatalog();
});

//*** Теги + слайдер ***/
document.addEventListener("DOMContentLoaded", function () {
  const collHandle = $("#collectionID").attr("data-collection-handle") ?? "";
  // const isMobileWidth = window.matchMedia("(max-width: 63.9988em)").matches;
  const $tag = $widget.find("[data-js-slider='tag-slider-wrapper']:first");
  const $tagsList = $tag.find(".catalog__tag-list:first");
  var tags;

  function setTagsHTML() {
    let html = "",
      htmlFilter = "",
      i = 0;

    for (const tag of tags) {
      if (collHandle !== tag.handle) continue;

      if (i < 6) {
        html += `<a href="${tag.link}" class="catalog__tag-item swiper-slide">${tag.title}</a>`;
      } else {
        htmlFilter += `<a href="${tag.link}" class="filter__tag-item">${tag.title}</a>`;
      }
      i++;
    }
    // console.log("[Tag] End", html.length, htmlFilter.length, i, collHandle, tags);
    if (htmlFilter.length) {
      $tag.find(".filters__list:first").html(htmlFilter);
      $("#popup-tags .popup__tags-list:first").html(
        htmlFilter + htmlFilter + htmlFilter,
      );
      html +=
        '<button type="button" class="tag__btn-all swiper-slide" data-open-spoller>Все подборки</button>';
    }
    if (html.length) {
      $tagsList.html(html);
      $tag.find(".catalog__tag-swiper:first").removeAttr("hidden");
      $tagsList.removeAttr("hidden");
      $tag.removeAttr("hidden");
    }
  }

  try {
    const $tags = $("#seo-tags");
    if (!$tags.length) return;

    tags = JSON.parse($tags.text())?.tags;
    if (!tags.length) return;
  } catch (err) {
    console.error("[Tagse] Ошибка парсинга тегов", err);
    return;
  }

  setTagsHTML();

  const sliderTag = $tag.get(0);
  if (!collHandle || !sliderTag) return;
  /* render */

  new Swiper(sliderTag.querySelector(".swiper"), {
    observer: true,
    observeParents: true,
    slidesPerView: "auto",
    spaceBetween: 8,
    slidesPerGroup: 4,
    speed: 800,
    breakpoints: {
      1023.98: {
        // slidesPerView: "auto"
        navigation: {
          prevEl: sliderTag.querySelector(".swiper-button-prev"),
          nextEl: sliderTag.querySelector(".swiper-button-next"),
        },
        // disabledClass: "swiper-button-disabled"
      },
      0: {
        pagination: false,
      },
    },
  });

  /* set events */
  $tagsList.on("click", "[data-open-spoller]", function () {
    if (window.matchMedia("(max-width: 63.9988em)").matches) {
      $tag.find("[data-popup='#popup-tags']:first").trigger("click");
    } else {
      $tag.find("[data-spoller]:first").trigger("click");
    }
  });
});
