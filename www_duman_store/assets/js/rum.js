const RUM_BASE =
  typeof window !== "undefined" && typeof window.__RUM_BASE__ === "string"
    ? window.__RUM_BASE__.replace(/\/$/, "")
    : "";
const RUM_INGEST_URL = `${RUM_BASE}/rum`;

function ngrokFetchHeaders() {
  if (!/ngrok-free\.(app|dev)|\.ngrok\.io/i.test(RUM_BASE)) return {};
  return { "ngrok-skip-browser-warning": "69420" };
}

// Never name this `$` — on storefronts jQuery owns global `$`; shadowing it breaks theme scripts.
function byId(id) {
  return document.getElementById(id);
}

const ui = {
  lcp: byId("lcp"),
  inp: byId("inp"),
  cls: byId("cls"),
  fcp: byId("fcp"),
  ttfb: byId("ttfb"),
  queue: byId("queue"),
  log: byId("ui-log"),
  btnInteract: byId("btn-interact"),
  btnLayout: byId("btn-layout"),
  btnSend: byId("btn-send"),
  shiftTarget: byId("shift-target"),
};

let queue = [];

function nowIso() {
  return new Date().toISOString();
}

function logLine(obj) {
  if (!ui.log) return;
  const line = `[${nowIso()}] ${typeof obj === "string" ? obj : JSON.stringify(obj)}\n`;
  ui.log.textContent = line + ui.log.textContent;
}

function setQueueLen(n) {
  if (ui.queue) ui.queue.textContent = String(n);
}

const ENV =
  typeof window !== "undefined" && typeof window.__RUM_ENV__ === "string"
    ? window.__RUM_ENV__
    : "dev";

/**
 * Карта страниц.
 *
 * Формат каждой строки: ["Читаемое название", /regexp/]
 * Первое совпадение с location.pathname побеждает.
 *
 * КАК НАСТРОИТЬ ПОД КОНКРЕТНЫЙ САЙТ — два способа:
 *
 * 1. Полная замена через window.__RUM_PATH_MAP__ (рекомендуется для клиентов).
 *    В теме магазина, ДО подключения rum.js, добавьте:
 *
 *    <script>
 *      window.__RUM_PATH_MAP__ = [
 *        ["Главная",              "^/$"],
 *        ["Заказ оформлен",       "^/orders/"],
 *        ["Оформление заказа",    "^/new_order"],
 *        ["Корзина",              "^/cart_items"],
 *        ["Карточка товара",      "^/collection/.+/product/"],
 *        ["Карточка товара",      "^/product/"],
 *        ["Каталог (все товары)", "^/collection/all"],
 *        ["Каталог (категория)",  "^/collection/"],
 *      ];
 *    </script>
 *
 *    Значения — строки (не RegExp), потому что JSON не поддерживает /regex/.
 *    rum.js сам преобразует их в RegExp.
 *
 * 2. Дополнение через window.__RUM_PATH_MAP_EXTRA__ — если хотите дописать
 *    к стандартным страницам несколько своих:
 *
 *    <script>
 *      window.__RUM_PATH_MAP_EXTRA__ = [
 *        ["Акции",      "^/sale"],
 *        ["О компании", "^/about"],
 *      ];
 *    </script>
 */
// InSales: /cart_items, /collection/*, /product/*, /new_order, /orders/{key}
const _defaultPathMap = [
  ["Главная",              /^\/$/],
  ["Заказ оформлен",       /^\/orders\//],
  ["Оформление заказа",    /^\/new_order/],
  ["Корзина",              /^\/cart_items/],
  ["Карточка товара",      /^\/collection\/.+\/product\//],
  ["Карточка товара",      /^\/product\//],
  ["Каталог (все товары)", /^\/collection\/all/],
  ["Каталог (категория)",  /^\/collection\//],
  ["Личный кабинет",       /^\/client_account/],
  ["Поиск",                /^\/search/],
  ["Блог",                 /^\/blog/],
  ["Страница",             /^\/page\//],
];

function _toPathMap(raw) {
  return raw.map(([label, pattern]) => [
    label,
    typeof pattern === "string" ? new RegExp(pattern) : pattern,
  ]);
}

const pathMap = (() => {
  if (typeof window === "undefined") return _defaultPathMap;
  if (Array.isArray(window.__RUM_PATH_MAP__))
    return _toPathMap(window.__RUM_PATH_MAP__);
  const base = _defaultPathMap.slice();
  if (Array.isArray(window.__RUM_PATH_MAP_EXTRA__))
    base.push(..._toPathMap(window.__RUM_PATH_MAP_EXTRA__));
  return base;
})();

function getPathLabel() {
  const p = location.pathname;
  for (const [label, re] of pathMap) if (re.test(p)) return label;
  return "Другая страница";
}

/**
 * Достаёт читаемый ярлык элемента, на котором произошло взаимодействие.
 *
 * КОНТРАКТ для клиента (тот, кто верстает магазин):
 *   К ВАЖНЫМ элементам (кнопкам, формам, полям) нужно добавить
 *   атрибут data-rum-label="Понятное название на русском".
 *   Пример:
 *     <button data-rum-label="Добавить в корзину">Купить</button>
 *     <form   data-rum-label="Форма оформления заказа">…</form>
 *     <input  data-rum-label="Поле «телефон»" name="phone">
 *   Тогда в Grafana появится отдельная строка с этим названием.
 *
 * Без data-rum-label элемент попадёт в общую корзину "—" в Grafana —
 * это специально, чтобы дашборд оставался читаемым и в нём не появлялся
 * мусор вроде классов CSS-фреймворка.
 *
 * Если очень нужно ловить элементы без разметки (для разовой диагностики),
 * включите режим эвристики:
 *   <script>window.__RUM_LOOSE_ELEMENT__ = true;</script>
 * Тогда дополнительно используются aria-label, name и #id.
 *
 * Аргумент `selector` — CSS-селектор из web-vitals attribution
 * (доступен только при использовании web-vitals.attribution.iife.js).
 */
const LOOSE_ELEMENT =
  typeof window !== "undefined" && window.__RUM_LOOSE_ELEMENT__ === true;

function sanitizeLabel(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  if (v.length < 2) return null;
  if (/^\d+$/.test(v)) return null;
  return v;
}

function normalizeElement(selector) {
  if (!selector || selector === "html" || selector === "body") return null;

  try {
    const el = document.querySelector(selector);
    if (!el) return null;

    const explicit = sanitizeLabel(el.dataset.rumLabel);
    if (explicit) return explicit;

    if (!LOOSE_ELEMENT) return null;

    return (
      sanitizeLabel(el.getAttribute("aria-label")) ||
      sanitizeLabel(el.name) ||
      sanitizeLabel(el.id) ||
      null
    );
  } catch (_) {
    return null;
  }
}

/** Достаёт ярлык из произвольной DOM-ноды (для JS-ошибок). */
function labelOfNode(node) {
  if (!node || node.nodeType !== 1) return null;
  let cur = node;
  for (let depth = 0; depth < 5 && cur; depth++, cur = cur.parentElement) {
    const explicit = sanitizeLabel(cur.dataset?.rumLabel);
    if (explicit) return explicit;
  }
  if (!LOOSE_ELEMENT) return null;
  return (
    sanitizeLabel(node.getAttribute?.("aria-label")) ||
    sanitizeLabel(node.name) ||
    sanitizeLabel(node.id) ||
    null
  );
}

function getDevice() {
  if (matchMedia("(pointer: coarse)").matches) return "mobile";
  if (matchMedia("(pointer: fine)").matches) return "desktop";
  return "other";
}

function pushMetric(metric) {
  const item = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    ts: Date.now(),
    env: ENV,
    path: getPathLabel(),
    device: getDevice(),
  };

  // INP attribution: определяем, какой элемент вызвал задержку отклика.
  // Работает только с web-vitals.attribution.iife.js.
  if (metric.name === "INP" && metric.attribution?.interactionTarget) {
    const el = normalizeElement(metric.attribution.interactionTarget);
    if (el) item.element = el;
  }

  // LCP attribution: какой элемент (картинка/баннер/заголовок) стал LCP.
  // Помогает в drill-down "из-за чего конкретно медленный LCP на этой странице".
  // Так же требует web-vitals.attribution.iife.js.
  if (metric.name === "LCP" && metric.attribution?.element) {
    const el = normalizeElement(metric.attribution.element);
    if (el) item.element = el;
  }

  queue.push(item);
  setQueueLen(queue.length);
  logLine({ queued: item.name, value: item.value, path: item.path, device: item.device });

  if (metric.name === "LCP" && ui.lcp)
    ui.lcp.textContent = `${metric.value.toFixed(0)} ms (${metric.rating})`;
  if (metric.name === "INP" && ui.inp)
    ui.inp.textContent = `${metric.value.toFixed(0)} ms (${metric.rating})`;
  if (metric.name === "CLS" && ui.cls)
    ui.cls.textContent = `${metric.value.toFixed(3)} (${metric.rating})`;
  if (metric.name === "FCP" && ui.fcp)
    ui.fcp.textContent = `${metric.value.toFixed(0)} ms (${metric.rating})`;
  if (metric.name === "TTFB" && ui.ttfb)
    ui.ttfb.textContent = `${metric.value.toFixed(0)} ms (${metric.rating})`;
}

async function flushWithFetch(reason) {
  if (!queue.length) return;

  const batch = queue;
  queue = [];
  setQueueLen(0);

  const res = await fetch(RUM_INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      ...ngrokFetchHeaders(),
    },
    body: JSON.stringify(
      batch.map((m) => ({
        ...m,
        reason,
        url: location.href,
      }))
    ),
    keepalive: true,
    mode: "cors",
  });

  if (!res.ok) {
    logLine({ flushError: { reason, status: res.status, url: RUM_INGEST_URL } });
    return;
  }
  logLine({ flushOk: { reason, status: res.status, count: batch.length } });
}

function pushJsError(kind, element) {
  queue.push({
    name: "JS_ERROR",
    kind,
    env: ENV,
    path: getPathLabel(),
    device: getDevice(),
    element: element || undefined,
    ts: Date.now(),
  });
  setQueueLen(queue.length);
  logLine({ queued: "JS_ERROR", kind, element: element || null });
  void flushWithFetch("js_error");
}

// Запоминаем последний элемент, с которым взаимодействовал пользователь.
// При необработанном промисе (unhandledrejection) у нас нет цели события,
// но скорее всего ошибка связана с этим элементом.
let lastInteractedElement = null;
const REMEMBER_EVENTS = ["pointerdown", "click", "submit", "input", "change"];
for (const evName of REMEMBER_EVENTS) {
  window.addEventListener(
    evName,
    (ev) => {
      const label = labelOfNode(ev.target);
      if (label) lastInteractedElement = label;
    },
    { capture: true, passive: true }
  );
}

if (typeof webVitals === "undefined") {
  console.warn(
    "[RUM] webVitals is missing. Load /vendor/web-vitals.iife.js (or CDN) before rum.js."
  );
} else {
  webVitals.onLCP(pushMetric, { reportAllChanges: true });
  webVitals.onINP(pushMetric, { reportAllChanges: true });
  webVitals.onCLS(pushMetric, { reportAllChanges: true });
  webVitals.onFCP(pushMetric, { reportAllChanges: true });
  webVitals.onTTFB(pushMetric, { reportAllChanges: true });
}

window.addEventListener("error", (ev) => {
  // ev.target часто оказывается window/document для script-ошибок —
  // в таких случаях lastInteractedElement даёт самую полезную атрибуцию.
  pushJsError("error", labelOfNode(ev.target) || lastInteractedElement);
});

window.addEventListener("unhandledrejection", () => {
  pushJsError("unhandledrejection", lastInteractedElement);
});

if (ui.btnInteract) {
  ui.btnInteract.addEventListener("click", () => {
    logLine("clicked");
  });
}

if (ui.btnLayout) {
  ui.btnLayout.addEventListener("click", () => {
    if (!ui.shiftTarget) return;
    const isShown = ui.shiftTarget.style.display !== "none";
    ui.shiftTarget.style.display = isShown ? "none" : "block";
    logLine({ layoutShiftDemo: ui.shiftTarget.style.display });
  });
}

if (ui.btnSend) {
  ui.btnSend.addEventListener("click", async () => {
    await flushWithFetch("manual");
  });
}

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void flushWithFetch("hidden");
});
window.addEventListener("pagehide", () => void flushWithFetch("pagehide"));

logLine("ready");
