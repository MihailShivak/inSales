/**
 * Скрипты шаблона Page, Blog и Article
 */


console.log("[EM.Page] Run...");

/*** Страница Контакты ***/
document.addEventListener("DOMContentLoaded", function () {
  const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
  const isMaskToken = (value) =>
    typeof value === "string" && /^%[a-z0-9_]+%$/i.test(value.trim());
  const isMessagingHref = (href) =>
    /^tel:/i.test(href) || href.includes("wa.me") || href.includes("t.me");

  function normalizePhoneDigits(value) {
    let d = digitsOnly(value);
    if (d.length === 11 && d[0] === "8") {
      d = "7" + d.slice(1);
    }
    if (d.length === 10) {
      d = "7" + d;
    }
    return d;
  }

  function parseContactsData() {
    const el = document.getElementById("contacts-data");
    if (!el || !el.textContent) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.warn("[EM.Page] contacts-data JSON parse error", e);
      return null;
    }
  }

  function resolveContacts(payload) {
    const defaults = payload.default || {};
    const current = payload.current || {};
    const keys = new Set([...Object.keys(defaults), ...Object.keys(current)]);
    const resolved = {};

    keys.forEach(function (key) {
      const cur = current[key];
      const def = defaults[key];
      if (cur === undefined || cur === null || String(cur).trim() === "") {
        resolved[key] = def !== undefined && def !== null ? String(def) : "";
        return;
      }
      const str = String(cur);
      if (
        isMaskToken(str) &&
        str.trim().toLowerCase() === `%${key.toLowerCase()}%`
      ) {
        resolved[key] = def !== undefined && def !== null ? String(def) : "";
        return;
      }
      resolved[key] = str;
    });

    return { resolved, defaults };
  }

  function replacePlaceholdersInTextNodes(root, resolved) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n = walker.nextNode();
    while (n) {
      nodes.push(n);
      n = walker.nextNode();
    }
    nodes.forEach(function (node) {
      let t = node.textContent;
      if (!t || !t.includes("%")) {
        return;
      }
      Object.keys(resolved).forEach(function (key) {
        const ph = `%${key}%`;
        if (t.includes(ph)) {
          t = t.split(ph).join(resolved[key] ?? "");
        }
      });
      node.textContent = t;
    });
  }

  function replaceLegacyDefaultText(root, dataset, from, to) {
    if (!from || !to || !from.length || to.length < 2) return;

    const block = root.querySelector(`[${dataset}]`);

    if (!block) return;
    const value = to[0] === "%" && to[to.length - 1] === "%" ? from : to;

    block.innerText = dataset.includes("address") ? "г. " + value : value;
  }

  function applyPhoneToHref(href, phoneDigits) {
    let h = href;
    if (h.includes("%phone%")) {
      if (/^tel:/i.test(h)) {
        h = `tel:+${phoneDigits}`;
      } else if (h.includes("wa.me")) {
        h = h.replace(/%phone%/g, phoneDigits);
      } else if (h.includes("t.me")) {
        h = h.replace(/\+?%phone%/g, `+${phoneDigits}`);
      } else {
        h = h.replace(/%phone%/g, phoneDigits);
      }
    }
    return h;
  }

  function patchMessagingPhoneDigits(href, oldDigits, newDigits) {
    if (
      !oldDigits ||
      !newDigits ||
      oldDigits === newDigits ||
      !isMessagingHref(href)
    )
      return href;

    return href.split(oldDigits).join(newDigits);
  }

  function applyContactsHrefs(root, resolved, oldDigits, newDigits) {
    const email = resolved.email ?? "";
    root.querySelectorAll("a").forEach(function (el) {
      const href = el.getAttribute("href");
      if (!href || el.classList.contains("contact-btn_icon-mini")) return;

      let next = href;
      if (next.includes("%email%")) {
        next = next.split("%email%").join(email);
      }
      next = applyPhoneToHref(next, newDigits);
      if (/^tel:/i.test(next) && !next.includes("%")) {
        next = `tel:+${newDigits}`;
      }
      next = patchMessagingPhoneDigits(next, oldDigits, newDigits);
      el.setAttribute("href", next);
    });
  }

  /**
   * Календарная дата (год, месяц, день) в указанной IANA-зоне для заданного момента.
   */
  function getYmdInTimeZone(timeZone, date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    return {
      y: +parts.find((p) => p.type === "year").value,
      m: +parts.find((p) => p.type === "month").value,
      d: +parts.find((p) => p.type === "day").value,
    };
  }

  /**
   * UTC-момент, когда в зоне timeZone на календарной дате year-month-day часы:минуты по «настенным» часам.
   */
  function findInstantForWallClockInZone(
    timeZone,
    year,
    month,
    day,
    hour,
    minute,
  ) {
    const month0 = month - 1;
    const start = Date.UTC(year, month0, day - 1, 0, 0, 0);
    const end = Date.UTC(year, month0, day + 1, 23, 59, 59);
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    for (let t = start; t <= end; t += 60 * 1000) {
      const d = new Date(t);
      const parts = dtf.formatToParts(d);
      const y = +parts.find((p) => p.type === "year").value;
      const mo = +parts.find((p) => p.type === "month").value;
      const da = +parts.find((p) => p.type === "day").value;
      const h = +parts.find((p) => p.type === "hour").value;
      const mi = +parts.find((p) => p.type === "minute").value;
      if (
        y === year &&
        mo === month &&
        da === day &&
        h === hour &&
        mi === minute
      ) {
        return d;
      }
    }
    return null;
  }

  function parseHm(str) {
    const m = String(str ?? "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = +m[1];
    const min = +m[2];
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return { hour: h, minute: min };
  }

  function getTimeZoneCityRu(iana) {
    try {
      const dn = new Intl.DisplayNames(["ru-RU"], { type: "timeZone" });
      return dn.of(iana) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Текст графика: время работы по Новосибирску → в локальной зоне браузера; пояс и город (по IANA).
   */
  function updateContactStoreHours(root, from, to) {
    if (!from || !to || !from.length || !to.length) return;

    const city = to !== "%city%" ? to : from;
    const el = root.querySelector("#js-store-hours");
    if (!el) return;

    const storeTz = el.getAttribute("data-store-tz") || "Asia/Novosibirsk";
    const fromStr = el.getAttribute("data-nsk-from") || "11:00";
    const toStr = el.getAttribute("data-nsk-to") || "20:00";
    const fromHm = parseHm(fromStr);
    const toHm = parseHm(toStr);
    if (!fromHm || !toHm) return;

    const now = new Date();
    const { y, m, d } = getYmdInTimeZone(storeTz, now);
    const startInst = findInstantForWallClockInZone(
      storeTz,
      y,
      m,
      d,
      fromHm.hour,
      fromHm.minute,
    );
    const endInst = findInstantForWallClockInZone(
      storeTz,
      y,
      m,
      d,
      toHm.hour,
      toHm.minute,
    );
    if (!startInst || !endInst) return;

    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const timeFmt = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const startLabel = timeFmt.format(startInst);
    const endLabel = timeFmt.format(endInst);

    const offsetParts = new Intl.DateTimeFormat("ru-RU", {
      timeZone: localTz,
      timeZoneName: "shortOffset",
    }).formatToParts(startInst);
    let tzCode =
      offsetParts.find((p) => p.type === "timeZoneName")?.value?.trim() || "";
    if (!tzCode) {
      const longOffParts = new Intl.DateTimeFormat("ru-RU", {
        timeZone: localTz,
        timeZoneName: "longOffset",
      }).formatToParts(startInst);
      tzCode =
        longOffParts.find((p) => p.type === "timeZoneName")?.value?.trim() ||
        localTz;
    }

    const cityRu = getTimeZoneCityRu(localTz).trim();
    const zoneCity = [tzCode, cityRu].filter(Boolean).join(" ");

    el.textContent = `Ежедневно с ${startLabel} до ${endLabel}, часовой пояс ${zoneCity} ${city}`;
  }

  function applyStoreYandexMap(defaults, resolved) {
    const address =
      resolved.address !== "%address%" ? resolved.address : defaults.address;

    if (!address) return;

    const container = document.querySelector(".store-map");
    if (!container) return;

    const iframe = document.createElement("iframe");

    iframe.src = `https://yandex.ru/map-widget/v1/?l=map&z=16&text=${encodeURIComponent(address)}`;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.loading = "lazy";
    iframe.title = `Карта: г. ${address}`;
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");

    container.appendChild(iframe);
  }

  function initContactsPage() {
    const payload = parseContactsData();
    if (!payload) return;

    // console.log("[EM.Page] payload", payload);
    const { resolved, defaults } = resolveContacts(payload);

    // console.log("[EM.Page] resolved", resolved);
    // console.log("[EM.Page] defaults", defaults);

    const root = document.querySelector(".store-info");
    if (!root) return;

    const newDigits = normalizePhoneDigits(resolved.phone);
    const oldDigits = normalizePhoneDigits(defaults.phone);

    // replacePlaceholdersInTextNodes(root, resolved);
    replaceLegacyDefaultText(
      root,
      "data-contact-phone",
      defaults.phone,
      resolved.phone,
    );
    replaceLegacyDefaultText(
      root,
      "data-contact-email",
      defaults.email,
      resolved.email,
    );
    // replaceLegacyDefaultText(root, defaults.city, resolved.city);
    replaceLegacyDefaultText(
      root,
      "data-contact-address",
      defaults.address,
      resolved.address,
    );

    applyContactsHrefs(root, resolved, oldDigits, newDigits);
    updateContactStoreHours(root, defaults.city, resolved.city);
    applyStoreYandexMap(defaults, resolved);

    const loader = new EM_Module.Loaders.Loader();
    setTimeout(() => {
      loader.hide($(root));
    }, 350);
  }

  if (window.location.pathname.includes("/contacts")) {
    if (EM_Module.Loaders !== undefined) initContactsPage();
    else EventBus.subscribe("eventLoader", initContactsPage);
  }
});

/**
 * Форматирование даты
 * Вывод оглавления статьи
 */
document.addEventListener("DOMContentLoaded", function () {
  function initSpollersTitile() {
    if (window.matchMedia("(max-width: 63.9988em)").matches && this) {
      window.EM_Module.spollers([this]);
    }
  }

  /* Форматирование даты */
  for (const el of document.querySelectorAll("[data-em-date]")) {
    const dateStr = el.dataset.emDate;
    if (!dateStr) continue;

    // Парсим дату: dd.mm.yyyy -> Date объект
    const parts = dateStr.split(".");
    if (parts.length !== 3) continue;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);

    // Получить название месяца по-русски в нужном падеже
    const longMonth = date.toLocaleString("ru-RU", { month: "long" });
    const formatted = `${day} ${longMonth} ${year}`;

    el.textContent = formatted;
  }

  /* Вывод оглавления статьи */
  const $articles = $("[data-table-contents]");
  if (!$articles.length) return;

  const offset = window.matchMedia("(max-width: 63.9988em)").matches ? 30 : 70;
  const $headings = $("[data-article-content]:first").find(
    "h2, h3, h4, h5, h6",
  );

  let titlesHTML = "",
    i = 0;
  for (const tag of $headings) {
    const id = `titles-${tag.tagName}-${i}`;
    tag.id = id;
    titlesHTML += `<button type="button" class="article__block-link" data-link-id="${id}">${tag.textContent}</button>`;
    i++;
  }
  if (titlesHTML.length) {
    $articles.find(".article__block-contents:first").html(titlesHTML);
    $articles.removeAttr("hidden");

    if (window?.EM_Module?.spollers) {
      initSpollersTitile.call($articles.filter(".article__block-mob").get(0));
    } else {
      EventBus.subscribe(
        "eventLoader",
        initSpollersTitile.bind($articles.filter(".article__block-mob").get(0)),
      );
    }
  }

  $(document).on("click", ".article__block-link", function (e) {
    const id = e.target.dataset.linkId;
    if (!id) return;

    const $tag = $headings.filter(`#${id}:first`);
    if ($tag.length) {
      $("html, body").animate(
        {
          scrollTop: $tag.offset().top - offset,
        },
        400,
      );
    }
  });
});

/*** Слайдеры ***/
document.addEventListener("DOMContentLoaded", function () {
  function initSliderReviews() {
    const slider = document.querySelector(".page__reviews .swiper");

    if (!slider) return;
    new Swiper(slider, {
      // Свободный режим, слайды не привязаны к ширине контейнера
      freeMode: true,
      slidesPerView: "auto",

      // Направление по размеру экрана
      // direction: window.matchMedia("(min-width: 35em)").matches ? "horizontal" : "vertical",

      // Общие настройки
      grabCursor: true,
      loop: false,
      breakpoints: {
        0: {
          direction: "vertical",
          spaceBetween: 8,
        },
        560: {
          direction: "horizontal",
          spaceBetween: 20,
        },
      },

      // Автообновление параметров при изменении размера экрана
      on: {
        resize: function () {
          const isDesktop = window.matchMedia("(min-width: 35em)").matches;
          this.params.direction = isDesktop ? "horizontal" : "vertical";
          this.changeDirection(isDesktop);
        },
      },
    });
  }

  if (window.location.pathname.includes("/page/duman")) initSliderReviews();
});

if (window.location.pathname.includes("/chasto-zadavaemye-voprosy") || document.querySelector("[data-faq]")) {
  document.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector("[data-faq]");
    if (!root) return;

    const input = root.querySelector("[data-faq-search]");
    const clear = root.querySelector("[data-faq-clear]");
    const groupsContainer = root.querySelector("[data-faq-groups]");
    const results = root.querySelector("[data-faq-results]");
    const list = root.querySelector("[data-faq-results-list]");
    const empty = root.querySelector("[data-faq-empty]");

    let faqData = [];
    try {
      const dataScript = document.getElementById("faq-data");
      if (dataScript && dataScript.textContent.trim()) {
        faqData = JSON.parse(dataScript.textContent);
      }
    } catch (err) {
      console.error("[FAQ] Ошибка парсинга данных блоков", err);
    }

    if (faqData.length > 0) {
      const grouped = faqData.reduce((acc, item) => {
        if (!acc[item.group_id]) {
          acc[item.group_id] = {
            name: item.group_name,
            items: []
          };
        }
        acc[item.group_id].items.push(item);
        return acc;
      }, {});

      const fragment = document.createDocumentFragment();
      Object.values(grouped).forEach(group => {
        const section = document.createElement("section");
        section.className = "faq-page__group";
        
        const h2 = document.createElement("h2");
        h2.className = "faq-page__group-title";
        h2.textContent = group.name;
        section.appendChild(h2);

        const listWrap = document.createElement("div");
        listWrap.className = "faq-page__list";
        
        group.items.forEach(item => {
          const details = document.createElement("details");
          details.className = "faq-page__item";
          
          const summary = document.createElement("summary");
          summary.className = "faq-page__question";
          summary.textContent = item.title;
          
          const answer = document.createElement("div");
          answer.className = "faq-page__answer";
          
          answer.innerHTML = item.body; 
          
          details.appendChild(summary);
          details.appendChild(answer);
          listWrap.appendChild(details);
        });
        
        section.appendChild(listWrap);
        fragment.appendChild(section);
      });
      
      groupsContainer.appendChild(fragment);
    }

    const norm = (s) =>
      s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

    const items = [...groupsContainer.querySelectorAll("details")].map((d) => ({
      el: d,
      q: norm(d.querySelector("summary")?.textContent ?? ""),
      a: norm(d.textContent),
    }));

    const show = (el) => (el.hidden = false);
    const hide = (el) => (el.hidden = true);

    function apply(raw) {
      const q = norm(raw);
      clear.hidden = !q;

      if (!q) {
        hide(results);
        hide(empty);
        show(groupsContainer);
        list.replaceChildren();
        return;
      }

      const found = items.filter((i) => i.q.includes(q) || i.a.includes(q));
      hide(groupsContainer);

      if (!found.length) {
        hide(results);
        show(empty);
        return;
      }

      list.replaceChildren(
        ...found.map((i) => {
          const clone = i.el.cloneNode(true);
          clone.removeAttribute("open");
          return clone;
        }),
      );
      hide(empty);
      show(results);
    }

    let t;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => apply(input.value), 150);
    });
    
    clear.addEventListener("click", () => {
      input.value = "";
      apply("");
      input.focus();
    });
  });
}
;
