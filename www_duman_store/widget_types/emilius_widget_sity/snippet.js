$(document).ready(() => {
	function getRootDomain() {
		const hostname = window.location.hostname;
		const parts = hostname.split(".");
		if (parts.length >= 2) {
			return "." + parts.slice(-2).join(".");
		}
		return hostname;
	}
	const rootDomain = getRootDomain();

	const CITY_DOMAIN_MAP = {
		"новосибирск": "www.duman.store",
		"санкт-петербург": "spb.duman.store",
		"нижний новгород": "nn.duman.store",
		"красноярск": "krasnoyarsk.duman.store",
		"екатеринбург": "ekaterinburg.duman.store",
		"казань": "kazan.duman.store",
		"челябинск": "chelyabinsk.duman.store",
		"самара": "samara.duman.store",
		"омск": "omsk.duman.store",
		"ростов-на-дону": "rostov.duman.store",
		"уфа": "ufa.duman.store",
		"воронеж": "voronezh.duman.store",
		"пермь": "perm.duman.store",
		"кемерово": "kemerovo.duman.store",
		"тольятти": "tolyatti.duman.store",
		"москва": "moscow.duman.store",
	};

	function getDomainByCity(cityName) {
		if (!cityName) return "www.duman.store";
		const normalized = cityName.trim().toLowerCase();
		return CITY_DOMAIN_MAP[normalized] || "www.duman.store";
	}

	function getCityByDomain(hostname) {
		const parts = hostname.split(".");
		if (parts.length >= 3 && parts[0] !== "www") {
			const subdomain = parts[0];
			for (const [city, domain] of Object.entries(CITY_DOMAIN_MAP)) {
				if (domain === `${subdomain}.duman.store`) {
					return city;
				}
			}
		}
		return "новосибирск";
	}

	function redirectToCityDomain(cityName) {
		const targetDomain = getDomainByCity(cityName);
		const currentHostname = window.location.hostname;

		// Если домены совпадают - просто перезагружаем страницу для обновления всех данных
		if (currentHostname === targetDomain) {
			window.location.reload();
		} else {
			// Если домены разные - переходим на другой домен
			const protocol = window.location.protocol;

			// Прокидываем theme_preview из куки
			const themePreviewId = Cookies.get("11305001");
			let search = window.location.search;
			if (themePreviewId) {
				search += `${search ? "&" : "?"}theme_preview=${themePreviewId}`;
			}

			const newUrl = `${protocol}//${targetDomain}${window.location.pathname}${search}`;
			window.location.href = newUrl;
		}
	}

	function updateCityInHeader(cityName) {
		if (!cityName) return;
		const displayCity = cityName.charAt(0).toUpperCase() + cityName.slice(1);
		const $cityElement = $("[data-city-name]");
		if ($cityElement.length) {
			$cityElement.text(displayCity);
			console.log("[City] Header обновлен на:", displayCity);
		}
	}

	const isMobile = sessionStorage.getItem("isMobile") === "true";
	const isCart = window.location.pathname.includes("/cart_items");
	const isProduct = window.location.pathname.includes("/product");

	let country = Cookies.get("rev-country-location");
	let city = Cookies.get("rev-current-location");
	let indexKladr;
	let nameDelivery = localStorage.getItem("nameDelivery");
	let priceFreeDelivery = Number(localStorage.getItem("priceFreeDelivery"));
	let isFreeShipping = false;

	const $popup = $("#popup-city");
	const $deliveryInfo = isCart ? $("[data-delivery-info]") : null;
	let kladr = [];
	let keyupTimer;

	function getProductIdInCart() {
		let id = [];
		if (
			typeof Cart !== "undefined" &&
			Cart.order &&
			Cart.order.order_line_comments
		) {
			for (const key in Cart.order.order_line_comments) {
				id.push(key);
			}
		}
		return id;
	}

    function outputListDeliveriesProduct(deliveries) {
        let html = '';

		for (const key in deliveries) {
			const delivery = deliveries[key];
            const price = delivery.show_price ? delivery.price ??  Number(delivery.price_min) : 0;

             html += `<div class="product-delivery__item">
                <button type="button" data-spoller class="product-delivery__item-title">${delivery.title}</button>
                <div class="product-delivery__item-body" hidden>
                    ${delivery.description ? `<div class="product-delivery__item-text"> ${delivery.description}</div>` : "" }
                    <button type="button" class="product-delivery__item-more">Подробнее об условиях акции</button>
                </div>
                <div class="product-delivery__item-price-wrapper">
                    <div class="product-delivery__item-price">
                        <span>
                        ${delivery.show_price && price !== undefined && !isNaN(price) 
                            ? price == 0 ? "Бесплатно" : Shop.money.format(price)
                            : "Будет рассчитана далее"}
                        </span>
                        <span>
                            ${delivery.delivery_interval.min_days < delivery.delivery_interval.max_days
                                ?  `от ${delivery.delivery_interval.min_days} до ${delivery.delivery_interval.max_days} дней`
                                : (
                                    delivery.delivery_interval?.min_days ? `от ${delivery.delivery_interval.min_days} дней` : ""
                                )}
                        </span>
                        </div>
                    <div class="product-delivery__item-time"></div>
                </div>
            </div>`;
        }
        $(".product-card [data-delivery-options]").html(html);
    }

	function setDeliveryInCart(deliveries, free, priceFree, data) {
		let html = "";
		for (const key in deliveries) {
			const delivery = deliveries[key];
			if (delivery.selected) free = Number(delivery.charge_up_to);
			html += `<li>- ${delivery.title}</li>`;
		}
		$(".delivery-info__list").html(html);
		if (typeof Shop !== "undefined") {
			$(".delivery-info__subtitle span").text(Shop.money.format(free));
		}
		if (priceFree >= 0) {
			$(".cart__grid-items-delivery").attr("hidden", false);
			$("[data-delivery-text] span").text(
				typeof Shop !== "undefined" ? Shop.money.format(priceFree) : priceFree,
			);
		} else {
			$(".cart__grid-items-delivery").attr("hidden", true);
		}
		$(".delivery-info__title span").text(
			(data.last_level_type ? data.last_level_type + " " : "") +
			data.last_level,
		);
	}

	function setListDeliveris(deliveryLine, deliveryLineSelect) {
		const $popup_delivery = $("#popup-delivery-change");
		if (!$popup_delivery.length) return;
		$popup_delivery.find(".popup__button").attr("disabled", true);
		$popup_delivery.find(".select__options").attr("data-new-animate", true);

		if (!deliveryLine || !deliveryLineSelect) {
			deliveryLine =
				'<button hidden="" class="select__option" data-value="0" type="button">- доставка -</button>';
			deliveryLineSelect = '<option value="0">- доставка -</option>';
			$popup_delivery.find(".select__content").text("- доставка -");
		}

		let iteration = 0,
			timerId = setInterval(() => {
				if ($popup_delivery.find(".select__options").length || iteration > 8) {
					clearInterval(timerId);
					$popup_delivery.find(".select__options").html(deliveryLine);
					$popup_delivery.find("select").html(deliveryLineSelect);
					$popup_delivery
						.find(".select__content")
						.text(nameDelivery || "Доставка");
				} else {
					iteration++;
				}
			}, 350);
	}

	async function fetchDeliveryCalculate(kladrData) {
		const variants = isProduct
			? {
					[$(`.product-card:first input[name="variant_id"]:first`).val()]: 1,
				}
			: {};
		try {
			const deliveries = await $.ajax({
				url: "/front_api/deliveries/calculate.json",
				method: "POST",
				dataType: "json",
				data: {
					address_data: kladrData,
					variants: variants,
				},
				timeout: 10000,
			});

			console.log("[City] Доставка рассчитана:", deliveries);

			if (!deliveries || !deliveries?.deliveries || !deliveries.deliveries.length) {
				console.log("[City] Ошибка получения списка доставок");
				return;
			}

			let name_delivery = "",
				selectDelivery = 0,
				free = 0,
				deliveryLine = "",
				deliveryLineSelect = "";

			for (const key in deliveries.deliveries) {
				const delivery = deliveries.deliveries[key];
				if (!selectDelivery && delivery.title.includes("России"))
					selectDelivery = key;
				if (delivery.selected) {
					free = Number(delivery.charge_up_to);
					name_delivery = delivery.title;
				}
				deliveryLine += `<button class="select__option" data-value="${key}" type="button">${delivery.title}</button>`;
				deliveryLineSelect += `<option value="${key}">${delivery.title}</option>`;
			}

			if (!free) {
				if (!selectDelivery) {
					for (const key in deliveries.deliveries) {
						selectDelivery = key;
						break;
					}
				}
				free = Number(deliveries.deliveries[selectDelivery].charge_up_to);
				name_delivery = deliveries.deliveries[selectDelivery].title;
			}

			// Обновляем localStorage для косметики
			if (priceFreeDelivery !== free) {
				localStorage.setItem("priceFreeDelivery", free);
				priceFreeDelivery = free;
			}
			if (nameDelivery !== name_delivery) {
				localStorage.setItem("nameDelivery", name_delivery);
				nameDelivery = name_delivery;
			}

			const priceFree =
				free -
				(typeof Cart !== "undefined" && Cart.order
					? Cart.order.total_price
					: 0);

			setListDeliveris(deliveryLine, deliveryLineSelect);

			// Дальше только для страницы корзины или товара
			if (isCart) {
				setDeliveryInCart(deliveries.deliveries, free, priceFree, kladrData);
			}
			if (isProduct) {
				outputListDeliveriesProduct(deliveries.deliveries);
				$(".product-card .product-card-descr__title span:last").text(
					`Доставка в ${kladrData.last_level_type} ${kladrData.last_level}`,
				);
			}
		} catch (err) {
			console.error("[City] Ошибка расчета доставки:", err);
		}
	}

	function initCityNotice() {
		const noticeShown = Cookies.get("city-notice-shown");
		if (noticeShown) return;

		const $notice = $("#city-notice");
		const $noticeName = $("[data-city-notice-name]");
		if ($notice.length && $noticeName.length) {
			const displayCity = city
				? city.charAt(0).toUpperCase() + city.slice(1)
				: "Новосибирск";
			$noticeName.text(displayCity);
			$notice.removeAttr("hidden");
		}
	}

	$("[data-city-confirm]").on("click", (e) => {
		e.preventDefault();
		Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
		$("#city-notice").prop("hidden", true);

		const confirmCity = city || getCityByDomain(window.location.hostname);

		Cookies.set("rev-country-location", "RU", {
			expires: 365,
			path: "/",
			domain: rootDomain,
		});
		Cookies.set("rev-current-location", confirmCity, {
			expires: 365,
			path: "/",
			domain: rootDomain,
		});

		country = "RU";
		city = confirmCity;
		updateCityInHeader(city);

		if (isProduct || isCart) {
			inputCity(city, country, true);
		}

		console.log("[City Confirm] Город подтверждён:", city);
	});

	$("[data-city-change]").on("click", (e) => {
		e.preventDefault();
		e.stopPropagation(); // Останавливаем всплытие события
		e.stopImmediatePropagation();

		Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });
		$("#city-notice").prop("hidden", true);

		console.log(
			"[City Change] Клик по кнопке 'Нет, другой'. Ждем завершения анимации меню...",
		);

		setTimeout(() => {
			openCityPopup();
			console.log("[City Change] Popup успешно открыт");
		}, 200);
	});

	function openCityPopup() {
		// Нативное открытие через эмуляцию клика (триггерим родной обработчик темы)
		const $tempTrigger = $("<button>", {
			"data-popup": "#popup-city",
			style: "display: none;",
		}).appendTo("body");

		$tempTrigger.trigger("click");
		$tempTrigger.remove();

		// Заполняем форму и сбрасываем состояния
		$popup.find('[name="country"]').val(country);
		$popup.find('[name="name-city"]').val("").focus();
		$popup.find("[data-select-sity-list]").html("");
		$popup.find("[data-select-container-sity]").prop("hidden", true);
		$popup.find("[data-city-save]").prop("disabled", true);

		// Блокировка скролла (дублируем для надежности, если тема не добавила)
		$("body").addClass("popup_open");

		console.log("[City Popup] Открыт с country:", country, "city:", city);
	}

	$("[data-city-open]").on("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		console.log("[City Open] Клик по кнопке выбора города");

		// Проверяем, находится ли нажатая кнопка внутри мобильного меню
		const $mobPopup = $(e.currentTarget).closest("[data-mob-popup='main']");
		if ($mobPopup.length) {
			console.log(
				"[City Mob Menu] Кнопка внутри мобильного меню. Закрываем меню.",
			);
			$mobPopup.removeClass("_active").css("transform", "translateX(-100%)");
		}

		// Открываем уведомление
		const $notice = $("#city-notice");
		const $noticeName = $("[data-city-notice-name]");
		if ($notice.length && $noticeName.length) {
			const displayCity = city
				? city.charAt(0).toUpperCase() + city.slice(1)
				: "Новосибирск";
			$noticeName.text(displayCity);
			$notice.prop("hidden", false);
			console.log("[City Notice] Открыто уведомление для города:", displayCity);
		} else {
			console.warn("[City Notice] Элементы уведомления не найдены");
		}
	});

	// Обработчик для кнопки в мобильном меню
	//   $("[data-mob-popup='main'] [data-city-open]").on("click", (e) => {
	//     e.preventDefault();
	//     e.stopPropagation();
	//     e.stopImmediatePropagation();

	//     console.log("[City Mob Menu] Клик по кнопке города в мобильном меню");

	//     // Закрываем мобильное меню через нативную кнопку темы
	//     const $closeBtn = $("[data-mob-popup='main']").find(
	//       "[data-mob-popup-close]",
	//     );
	//     if ($closeBtn.length) {
	//       $closeBtn.trigger("click");
	//       console.log("[City Mob Menu] Клик по нативной кнопке закрытия меню");
	//     }

	//     // Ждем завершения анимации закрытия меню (500мс), потом открываем уведомление
	//     setTimeout(() => {
	//       const $notice = $("#city-notice");
	//       const $noticeName = $("[data-city-notice-name]");
	//       if ($notice.length && $noticeName.length) {
	//         const displayCity = city
	//           ? city.charAt(0).toUpperCase() + city.slice(1)
	//           : "Новосибирск";
	//         $noticeName.text(displayCity);
	//         $notice.prop("hidden", false);
	//         console.log(
	//           "[City Mob Menu] Открыто уведомление для города:",
	//           displayCity,
	//         );
	//       }
	//     }, 550);
	//   });

	$popup.find("[data-close]").on("click", () => {
		$popup.attr("aria-hidden", "true");
		$("body").removeClass("popup_open");
	});

	$(document).on("click", ".popup_open .popup__wrapper", (e) => {
		if (e.target === e.currentTarget) {
			$popup.attr("aria-hidden", "true");
			$("body").removeClass("popup_open");
		}
	});

	function changeCountryInForm(value) {
		if (!value) return;
		const $countrySelect = $popup.find('[name="country"]');
		if ($countrySelect.val() === value) return;
		$countrySelect.val(value);
		$popup.find("[data-select-sity-list]").html("");
		$popup.find("[data-select-container-sity]").prop("hidden", true);
		$popup.find('[name="name-city"]').val("");
		$popup.find("[data-city-save]").prop("disabled", true);
	}

	async function inputCity(elVal, countryVal, change = false) {
		const $container = $popup.find("[data-select-container-sity]");
		const $list = $popup.find("[data-select-sity-list]");
		const $saveBtn = $popup.find("[data-city-save]");

		if (!elVal || elVal.length < 2) {
			$container.prop("hidden", true);
			$saveBtn.prop("disabled", true);
			return;
		}

		try {
			const cities = await $.ajax({
				type: "post",
				url: `//kladr.insales.ru/fulltext_search.json?country=${countryVal}&state=`,
				data: { q: elVal, search: "1" },
				dataType: "jsonp",
				cache: false,
			});

			let html = "";
			if (
				!cities ||
				cities.error ||
				!Array.isArray(cities) ||
				cities.length === 0
			) {
				html =
					'<button class="select__option" type="button" disabled>Город не найден</button>';
				$list.html(html);
				$container.prop("hidden", false);
				$saveBtn.prop("disabled", true);
				return;
			}

			kladr = cities;
			if (change && cities.length > 0) {
				indexKladr = 0;
				fetchDeliveryCalculate(kladr[0]); // Сразу считаем доставку при инициализации
			}

			if (!change) {
				for (const index in cities) {
					const cityName = cities[index].city ?? cities[index].last_level;
					html += `<button class="select__option" data-value="${index}" type="button" data-select-city="${cityName}">${cities[index].result}</button>`;
				}
				$list.html(html);
				$container.prop("hidden", false);
				$saveBtn.prop("disabled", false);
			}
		} catch (err) {
			console.error("Ошибка поиска города:", err);
			$container.prop("hidden", true);
			$saveBtn.prop("disabled", true);
		}
	}

	$popup.find('[name="name-city"]').on("input", function () {
		const _this = $(this);
		const val = _this.val().trim();
		clearTimeout(keyupTimer);
		keyupTimer = setTimeout(() => {
			if (val.length >= 2) {
				inputCity(val, $popup.find('[name="country"]').val());
			} else {
				$popup.find("[data-select-container-sity]").prop("hidden", true);
				$popup.find("[data-city-save]").prop("disabled", true);
			}
		}, 300);
	});

	$popup.find('[data-js="input-clear"]').on("click", () => {
		$popup.find('[name="name-city"]').val("").focus();
		$popup.find("[data-select-container-sity]").prop("hidden", true);
		$popup.find("[data-city-save]").prop("disabled", true);
	});

	$popup
		.find("[data-select-sity-list]")
		.on("click", "[data-select-city]", function (event) {
			event.preventDefault();
			const $btn = $(this);
			const newCity = $btn.data("select-city");
			const index = $btn.data("value");
			if (!newCity) return;
			indexKladr = index;
			$popup.find('[name="name-city"]').val(newCity);
			$popup.find("[data-city-save]").prop("disabled", false);
			$popup.find("[data-select-container-sity]").prop("hidden", true);
			$popup.find("[data-city-save]").focus();
		});

	// Сохранение города и редирект
	$popup.find("[data-city-save]").on("click", async function () {
		const newCountry = $popup.find('[name="country"]').val();
		const newCityName = $popup
			.find('[name="name-city"]')
			.val()
			.trim();
		if (!newCityName) return;

		// 1. Находим корректные данные Kladr
		let targetKladr = null;
		if (indexKladr !== undefined && kladr[indexKladr]) {
			const kladrCityName = (
				kladr[indexKladr].city ||
				kladr[indexKladr].last_level ||
				""
			).toLowerCase();
			if (kladrCityName === newCityName) {
				targetKladr = kladr[indexKladr];
			}
		}
		if (!targetKladr && kladr.length > 0) {
			const matchIndex = kladr.findIndex(
				(k) => (k.city || k.last_level || "").toLowerCase() === newCityName,
			);
			if (matchIndex !== -1) {
				targetKladr = kladr[matchIndex];
				indexKladr = matchIndex;
			}
		}
		if (!targetKladr) {
			try {
				const cities = await $.ajax({
					type: "post",
					url: `//kladr.insales.ru/fulltext_search.json?country=${newCountry}&state=`,
					data: { q: newCityName, search: "1" },
					dataType: "jsonp",
					cache: false,
				});
				if (cities && cities.length > 0) {
					targetKladr = cities[0];
					kladr = cities;
					indexKladr = 0;
				}
			} catch (err) {
				console.error("[City] Не удалось получить Kladr данные:", err);
			}
		}

		// 2. Считаем доставку для нового адреса
		if (targetKladr) {
			await fetchDeliveryCalculate(targetKladr);
		}

		// 3. МЯГКОЕ СОХРАНЕНИЕ КУКИ
		Cookies.set("rev-country-location", newCountry, {
			expires: 365,
			path: "/",
			domain: rootDomain,
		});
		Cookies.set("rev-current-location", newCityName, {
			expires: 365,
			path: "/",
			domain: rootDomain,
		});

		// 4. Обновляем шапку мгновенно для UX
		updateCityInHeader(newCityName);

		// 5. Закрываем popup и делаем редирект
		Cookies.set("city-notice-shown", "1", { expires: 365, path: "/" });

		// Нативное закрытие через триггер крестика темы + страховка классами
		$popup.find("[data-close]").trigger("click");
		$popup.removeClass("popup_show");
		$("body").removeClass("popup_open");
		$popup.attr("aria-hidden", "true");

		if (location.pathname === "/new_order") {
			setTimeout(() => {
				window.location.reload();
			}, 350);
		} else {
			redirectToCityDomain(newCityName); // Эта функция сама решит, нужен ли редирект
		}
	});

	$popup.find('[name="country"]').on("change", function () {
		changeCountryInForm($(this).val());
	});

	/** 
	 * Пустая конструкция 
	if (typeof EventBus !== "undefined") {
	  EventBus.subscribe("update_items:insales:cart", (cart) => {
		if (window.__bocOrderInProgress) return;
		if (isCart && !isNaN(priceFreeDelivery)) {
		  // Логика обновления корзины при изменении
		}
	  });
	}
	*/

	if (!country || !city) {
		console.log(
			"[City] Город не найден в куки, запрашиваем через Kladr API...",
		);
		$.ajax({
			url: "https://kladr.insales.ru/current_location.json",
			type: "get",
			dataType: "jsonp",
			success: function (data) {
				if (data.country && data.city) {
					country = data.country;
					city = data.city;
					Cookies.set("rev-country-location", country, {
						expires: 365,
						path: "/",
						domain: rootDomain,
					});
					Cookies.set("rev-current-location", city, {
						expires: 365,
						path: "/",
						domain: rootDomain,
					});
					updateCityInHeader(city);
					console.log("[City] Автоопределен и сохранен город:", city);
				} else {
					// Fallback на домен
					city = getCityByDomain(window.location.hostname);
					updateCityInHeader(city);
				}
			},
			error: function (err) {
				console.log("Ошибка автоопределения города, используем домен", err);
				city = getCityByDomain(window.location.hostname);
				updateCityInHeader(city);
			},
		});
	} else {
		// МЯГКАЯ ЛОГИКА
		console.log("[City] Город успешно прочитан из cookie:", city);
		updateCityInHeader(city);
	}

	initCityNotice();

	if ((isProduct || isCart) && city && country) {
		inputCity(city, country, true);
	}
});