/* === Baby Names — Browse Screen === */

const Browse = (() => {
    const ROW_HEIGHT = 52;
    const BUFFER = 20;
    let currentTab = 'all';
    let searchQuery = '';
    let filteredNames = [];
    let initialized = false;
    let listContainer = null;
    let nameList = null;

    function init() {
        if (App.activeProfile < 0) return;
        filterNames();
        if (!initialized) {
            initListeners();
            buildAlphabetBar();
            initialized = true;
        }
        renderList();
    }

    function filterNames() {
        const query = searchQuery.toLowerCase();
        const liked = new Set(App.getLiked(App.activeProfile));

        filteredNames = [];
        for (let i = 0; i < NAMES.length; i++) {
            const name = NAMES[i];
            // Tab filter
            if (currentTab === 'liked' && !liked.has(i)) continue;
            // Search filter
            if (query && !name.name.toLowerCase().includes(query)) continue;
            filteredNames.push(i);
        }
    }

    function renderList() {
        if (!listContainer) {
            listContainer = document.querySelector('.name-list-container');
            nameList = document.getElementById('name-list');
        }

        // Set total height for scrollbar
        const totalHeight = filteredNames.length * ROW_HEIGHT;
        nameList.style.height = totalHeight + 'px';

        // Remove existing rows
        nameList.innerHTML = '';

        // Virtual scroll: render visible rows
        renderVisibleRows();
    }

    function renderVisibleRows() {
        if (!listContainer || !nameList) return;
        const scrollTop = listContainer.scrollTop;
        const viewHeight = listContainer.clientHeight;

        const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
        const endIdx = Math.min(filteredNames.length, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + BUFFER);

        // Clear and re-render (simple approach — could optimize with diff)
        nameList.innerHTML = '';

        const liked = new Set(App.getLiked(App.activeProfile));

        for (let i = startIdx; i < endIdx; i++) {
            const nameId = filteredNames[i];
            const name = NAMES[nameId];
            const isLiked = liked.has(nameId);

            const row = document.createElement('div');
            row.className = 'name-row';
            row.style.top = (i * ROW_HEIGHT) + 'px';

            const textDiv = document.createElement('div');
            const nameSpan = document.createElement('div');
            nameSpan.className = 'name-row-text';
            nameSpan.textContent = name.name;
            textDiv.appendChild(nameSpan);

            if (name.pop > 0) {
                const subSpan = document.createElement('div');
                subSpan.className = 'name-row-sub';
                subSpan.textContent = name.pop.toLocaleString('da-DK') + ' i DK';
                textDiv.appendChild(subSpan);
            }

            row.appendChild(textDiv);

            const heartBtn = document.createElement('button');
            heartBtn.className = 'name-heart' + (isLiked ? ' liked' : '');
            heartBtn.textContent = isLiked ? '♥' : '♡';
            heartBtn.dataset.nameId = nameId;
            row.appendChild(heartBtn);

            nameList.appendChild(row);
        }
    }

    function buildAlphabetBar() {
        const bar = document.getElementById('alphabet-bar');
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
        letters.forEach(l => {
            const span = document.createElement('span');
            span.className = 'alpha-letter';
            span.textContent = l;
            span.dataset.letter = l;
            bar.appendChild(span);
        });

        // Touch/click on alphabet bar
        bar.addEventListener('click', onAlphaClick);

        // Touch drag on alphabet bar
        let touching = false;
        bar.addEventListener('pointerdown', e => {
            touching = true;
            bar.setPointerCapture(e.pointerId);
            jumpToLetter(e);
        });
        bar.addEventListener('pointermove', e => {
            if (touching) jumpToLetter(e);
        });
        bar.addEventListener('pointerup', () => { touching = false; });
    }

    function onAlphaClick(e) {
        const span = e.target.closest('.alpha-letter');
        if (!span) return;
        scrollToLetter(span.dataset.letter);
    }

    function jumpToLetter(e) {
        const bar = document.getElementById('alphabet-bar');
        const rect = bar.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const ratio = y / rect.height;
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ';
        const idx = Math.max(0, Math.min(letters.length - 1, Math.floor(ratio * letters.length)));
        scrollToLetter(letters[idx]);
    }

    function scrollToLetter(letter) {
        const idx = filteredNames.findIndex(id => {
            return NAMES[id].name[0].toUpperCase() === letter;
        });
        if (idx >= 0 && listContainer) {
            listContainer.scrollTop = idx * ROW_HEIGHT;
        }
    }

    function initListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            filterNames();
            renderList();
        });

        // Tab switching
        document.querySelectorAll('.browse-tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.browse-tabs .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                filterNames();
                renderList();
            });
        });

        // Heart toggle (delegated)
        document.getElementById('name-list').addEventListener('click', e => {
            const heartBtn = e.target.closest('.name-heart');
            if (!heartBtn) return;
            const nameId = parseInt(heartBtn.dataset.nameId, 10);
            const nowLiked = App.toggleLike(nameId);
            heartBtn.className = 'name-heart' + (nowLiked ? ' liked' : '');
            heartBtn.textContent = nowLiked ? '♥' : '♡';
            // If on liked tab and un-liked, refresh
            if (currentTab === 'liked' && !nowLiked) {
                filterNames();
                renderList();
            }
        });

        // Scroll handler for virtual scrolling
        if (!listContainer) listContainer = document.querySelector('.name-list-container');
        let scrollTicking = false;
        listContainer.addEventListener('scroll', () => {
            if (!scrollTicking) {
                requestAnimationFrame(() => {
                    renderVisibleRows();
                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        });
    }

    return { init };
})();
