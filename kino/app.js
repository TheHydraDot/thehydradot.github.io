document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsSection = document.getElementById('results-section');
    const resultsGrid = document.getElementById('results-grid');
    const resultsTitle = document.getElementById('results-title');
    const playerSection = document.getElementById('player-section');
    const playerContainer = document.getElementById('player-container');
    const movieTitleElem = document.getElementById('movie-title');
    const playerInfo = document.getElementById('player-info');
    const backBtn = document.getElementById('back-btn');
    const featuresSection = document.getElementById('features-section');

    
    const BACKEND_URL = 'kino-backend-6qscy4wcp-hydradot.vercel.app';
    const KINOBD_API = `${BACKEND_URL}/api`;

    // Кнопка «Назад»
    backBtn.addEventListener('click', () => {
        playerSection.style.display = 'none';
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Обработчик поиска
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;

        // Скрываем лишнее, показываем результаты
        featuresSection.style.display = 'none';
        playerSection.style.display = 'none';
        resultsSection.style.display = 'block';
        resultsTitle.textContent = `Результаты поиска: «${query}»`;
        resultsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:3rem 0; color:var(--text-muted);">
                <div class="spinner" style="margin:0 auto 1rem;"></div>
                <p>Ищем «${query}» в базе KinoBD...</p>
            </div>
        `;

        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        try {
            const response = await fetch(`${KINOBD_API}/player/search?q=${encodeURIComponent(query)}&type=title`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                renderResults(data.data, query);
            } else {
                resultsGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align:center; padding:3rem 0; color:var(--warning);">
                        <i class="fa-solid fa-circle-info" style="font-size:2rem; margin-bottom:1rem;"></i>
                        <p>По запросу «${query}» ничего не найдено. Попробуйте другое название.</p>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Search error:', err);
            resultsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:3rem 0; color:var(--danger);">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
                    <p>Ошибка при поиске. Проверьте соединение и попробуйте снова.</p>
                    <p style="font-size:0.8rem; color:var(--text-dim); margin-top:0.5rem;">${err.message}</p>
                </div>
            `;
        }
    });

    function renderResults(items, query) {
        // Убираем дубликаты — API иногда возвращает одинаковые записи (один и тот же id)
        const uniqueMap = new Map();
        items.forEach(item => uniqueMap.set(item.id, item));
        const uniqueItems = [...uniqueMap.values()];

        resultsTitle.textContent = `Найдено ${uniqueItems.length} результатов для «${query}»`;
        resultsGrid.innerHTML = '';

        uniqueItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.style.animation = 'fadeSlideIn 0.4s ease';

            const title = item.name_russian || item.name_original || 'Без названия';
            const year = item.year || item.year_start || '';
            const rating = item.rating_kp ? `★ ${item.rating_kp}` : '';
            const type = item.type === 'serial' ? 'Сериал' : 'Фильм';
            // KinoBD API часто возвращает small_poster/big_poster как null,
            // поэтому используем Кинопоиск CDN как фоллбэк по kinopoisk_id
            const posterUrl = item.small_poster || item.big_poster
                || (item.kinopoisk_id ? `https://st.kp.yandex.net/images/film_iphone/iphone360_${item.kinopoisk_id}.jpg` : null);

            let posterHtml;
            if (posterUrl) {
                posterHtml = `<img class="poster" src="${posterUrl}" alt="${title}" loading="lazy" onerror="this.outerHTML='<div class=\\'poster-placeholder\\'><i class=\\'fa-solid fa-film\\'></i></div>'">`;
            } else {
                posterHtml = `<div class="poster-placeholder"><i class="fa-solid fa-film"></i></div>`;
            }

            card.innerHTML = `
                ${posterHtml}
                <div class="card-type">${type}</div>
                <div class="card-info">
                    <div class="card-title">${title}</div>
                    <div class="card-meta">
                        ${year ? `<span class="card-year">${year}</span>` : ''}
                        ${rating ? `<span class="card-rating">${rating}</span>` : ''}
                    </div>
                </div>
            `;

            card.addEventListener('click', () => openPlayer(item));
            resultsGrid.appendChild(card);
        });
    }

    function openPlayer(item) {
        const title = item.name_russian || item.name_original || 'Без названия';
        const origTitle = item.name_original || '';
        const year = item.year || item.year_start || '';

        // Скрываем результаты, показываем плеер
        resultsSection.style.display = 'none';
        playerSection.style.display = 'block';
        movieTitleElem.textContent = origTitle ? `${title} / ${origTitle} (${year})` : `${title} (${year})`;

        // Загрузка
        playerContainer.innerHTML = `
            <div class="loading-player">
                <div class="spinner"></div>
                <p>Загружаем плеер для «${title}»...</p>
            </div>
        `;

        setTimeout(() => {
            playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        // Используем проксированный скрипт KinoBD (player_.js) через наш бэкенд.
        // Бэкенд перенаправляет все iframe-ы через /proxy, вырезая рекламу.
        const filmId = item.id;

        if (filmId) {
            // Удаляем старый скрипт, если он есть
            const oldScript = document.getElementById('kinobd-player-script');
            if (oldScript) oldScript.remove();

            // Очищаем контейнер и вставляем div-контейнер для плеера KinoBD
            playerContainer.innerHTML = '';
            
            const playerDiv = document.createElement('div');
            playerDiv.id = 'kinobd';
            playerDiv.setAttribute('data-inid', filmId);
            playerDiv.setAttribute('data-fast', '1');
            playerContainer.appendChild(playerDiv);

            // Запускаем клиентский ad-blocker для контейнера плеера
            startAdBlocker(playerContainer);

            // Кэшируем оригинальный метод
            const origCreateElement = document.createElement;
            document.createElement = function(tagName) {
                const el = origCreateElement.call(document, tagName);
                if (tagName.toLowerCase() === 'iframe') {
                    // Перехватываем создание iframe плеером
                    // и принудительно вешаем на него песочницу без allow-popups!
                    // Это заблокирует кликандеры и редиректы внутри плеера.
                    setTimeout(() => {
                        if (el.id === 'kinobd-iframe' || el.src.includes('http')) {
                            el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
                            console.log('[AdBlock] Injected sandbox into player iframe:', el.src);
                        }
                    }, 0);
                }
                return el;
            };

            // Загружаем наш модифицированный скрипт KinoBD (бэкенд вырезает мусорные плееры из кода)
            const script = document.createElement('script');
            script.id = 'kinobd-player-script';
            script.src = `${BACKEND_URL}/js/player_.js?v=` + Date.now();
            script.onerror = () => {
                playerContainer.innerHTML = `
                    <div class="loading-player" style="color: var(--danger);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;"></i>
                        <p>Не удалось загрузить скрипт плеера. Проверьте соединение.</p>
                    </div>
                `;
            };
            document.body.appendChild(script);
        } else {
            playerContainer.innerHTML = `
                <div class="loading-player" style="color: var(--warning);">
                    <i class="fa-solid fa-circle-info" style="font-size:2rem;"></i>
                    <p>Плеер для этого фильма временно недоступен. Попробуйте другой результат.</p>
                </div>
            `;
        }

        // Описание фильма
        if (item.description) {
            playerInfo.innerHTML = `
                <div class="info-row"><span class="info-label">Описание:</span> ${item.description}</div>
                ${item.country_ru ? `<div class="info-row" style="margin-top:0.5rem;"><span class="info-label">Страна:</span> ${item.country_ru}</div>` : ''}
                ${item.time ? `<div class="info-row" style="margin-top:0.5rem;"><span class="info-label">Длительность:</span> ${item.time}</div>` : ''}
            `;
            playerInfo.classList.add('visible');
        } else {
            playerInfo.classList.remove('visible');
        }
    }

    // ══════════════════════════════════════════════
    // Клиентский Ad-Blocker (MutationObserver)
    // ══════════════════════════════════════════════
    let adBlockObserver = null;

    function startAdBlocker(container) {
        // Остановить предыдущий observer
        if (adBlockObserver) {
            adBlockObserver.disconnect();
            adBlockObserver = null;
        }

        adBlockObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    removeAdElement(node);
                }
            }
        });

        adBlockObserver.observe(container, { childList: true, subtree: true });

        // Также запускаем периодическую очистку
        let cleanupCount = 0;
        const cleanupInterval = setInterval(() => {
            cleanupCount++;
            if (cleanupCount > 60) { // Остановить через 60 секунд
                clearInterval(cleanupInterval);
                return;
            }
            cleanupAds(container);
        }, 1000);
    }

    function removeAdElement(el) {
        if (!el || !el.parentNode) return;

        const tag = el.tagName;
        const id = (el.id || '').toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();
        const style = (el.getAttribute('style') || '').toLowerCase();

        // Не трогаем основной iframe плеера и контролы
        if (id === 'kinobd-iframe' || id === 'kinobd-loading' || 
            id === 'kinobd-buttons' || id === 'kinobd-wrapper' ||
            id === 'kinobd-style' || id === 'kinobd') return;

        // Удаляем подозрительные ссылки (target=_blank, рекламные)
        if (tag === 'A' && el.target === '_blank') {
            const href = (el.href || '').toLowerCase();
            if (!href.includes(window.location.hostname)) {
                el.remove();
                console.log('[AdBlock] Removed ad link:', href);
                return;
            }
        }

        // Удаляем div-оверлеи поверх плеера (рекламные)
        if (tag === 'DIV' && !id.includes('kinobd') && !id.includes('player') && !cls.includes('kinobd')) {
            // Проверяем z-index и позиционирование
            if (style.includes('position') && (style.includes('fixed') || style.includes('absolute'))) {
                const zMatch = style.match(/z-index\s*:\s*(\d+)/);
                if (zMatch && parseInt(zMatch[1]) > 100) {
                    // Высокий z-index + позиционирование = скорее всего рекламный оверлей
                    if (!id.includes('kinobd') && !cls.includes('kinobd')) {
                        el.remove();
                        console.log('[AdBlock] Removed ad overlay div, z-index:', zMatch[1]);
                        return;
                    }
                }
            }

            // Прозрачные кликабельные оверлеи
            if (style.includes('cursor') && style.includes('pointer') &&
                (style.includes('width: 100%') || style.includes('width:100%'))) {
                el.remove();
                console.log('[AdBlock] Removed clickjacking overlay');
                return;
            }
        }

        // Удаляем рекламные iframe (не основной плеер)
        if (tag === 'IFRAME' && id !== 'kinobd-iframe') {
            const src = (el.src || '').toLowerCase();
            const adDomains = ['googlesyndication', 'doubleclick', 'adservice', 'adfox',
                'mc.yandex', 'an.yandex', 'marketgid', 'mgid', 'adriver',
                'popads', 'popcash', 'propellerads', 'clickadu', 'juicyads',
                'exoclick', 'trafficjunky', 'trafficfactory', 'adsterra',
                'monetag', 'pushprofit', 'realsrv', 'hilltopads'];
            if (adDomains.some(d => src.includes(d))) {
                el.remove();
                console.log('[AdBlock] Removed ad iframe:', src);
                return;
            }

            // Iframe без src с подозрительным стилем
            if (!src && style.includes('z-index') && style.includes('position')) {
                el.remove();
                console.log('[AdBlock] Removed suspicious iframe');
                return;
            }
        }
    }

    function cleanupAds(container) {
        // Удаляем фиксированные оверлеи на body
        document.querySelectorAll('body > div[style*="position: fixed"], body > div[style*="position:fixed"]').forEach(div => {
            const id = (div.id || '').toLowerCase();
            const cls = (div.className || '').toString().toLowerCase();
            if (!id.includes('player') && !id.includes('kinobd') && !id.includes('video') &&
                !cls.includes('player') && !cls.includes('kinobd') && !cls.includes('video') &&
                !cls.includes('app') && !id.includes('app')) {
                const style = (div.getAttribute('style') || '').toLowerCase();
                const zMatch = style.match(/z-index\s*:\s*(\d+)/);
                if (zMatch && parseInt(zMatch[1]) > 1000) {
                    div.remove();
                    console.log('[AdBlock] Removed body overlay:', id || cls);
                }
            }
        });

        // Удаляем рекламные классы внутри контейнера
        if (container) {
            container.querySelectorAll('.ad, .ads, .ad-block, .ad-banner, .ad-container, .overlay-ad, .preroll').forEach(el => {
                const id = (el.id || '').toLowerCase();
                if (!id.includes('kinobd') && !id.includes('player')) {
                    el.remove();
                }
            });
        }
    }

    // ══════════════════════════════════════════════
    // Глобальная защита: блокировка window.open (попандеры)
    // ══════════════════════════════════════════════
    const origWindowOpen = window.open;
    window.open = function(...args) {
        // Разрешаем только если вызвано из пользовательского действия с явным намерением
        console.log('[AdBlock] Blocked window.open:', args[0]);
        return null;
    };
});
