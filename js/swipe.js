/* === Baby Names — Swipe Screen === */

const Swipe = (() => {
    let deck = [];         // filtered & shuffled name IDs
    let deckIndex = 0;     // current position in deck
    let filters = {};      // active filters
    let initialized = false;
    let dragging = false;
    let startX = 0;
    let deltaX = 0;
    let currentCard = null;

    const GRADIENTS = ['card-gradient-1','card-gradient-2','card-gradient-3','card-gradient-4','card-gradient-5','card-gradient-6'];

    function init() {
        if (App.activeProfile < 0) return;
        filters = App.getFilters(App.activeProfile);
        buildDeck();
        renderCards();
        updateProgress();
        if (!initialized) {
            initListeners();
            initialized = true;
        }
    }

    // Build the deck based on filters
    function buildDeck() {
        let ids = [];
        for (let i = 0; i < NAMES.length; i++) {
            if (passesFilters(NAMES[i])) {
                ids.push(i);
            }
        }
        // Shuffle with seeded RNG
        const seed = App.getSeed(App.activeProfile);
        const shuffled = App.seededShuffle(ids, seed);

        // Migrate old seenData format (numeric index) to seenIds format (name IDs)
        const filterKey = JSON.stringify(filters);
        migrateOldSeenData(shuffled, filterKey);

        // Load seen names for this filter set
        const seenIds = new Set(App.LS.get('seenIds_' + App.activeProfile + '_' + filterKey) || []);

        // Split into seen and unseen
        const unseen = shuffled.filter(id => !seenIds.has(id));

        // Prioritize: put the other partner's liked names first among unseen
        const otherProfile = App.activeProfile === 0 ? 1 : 0;
        const otherLiked = new Set(App.getLiked(otherProfile));
        if (otherLiked.size > 0) {
            const prioritized = [];
            const rest = [];
            for (const id of unseen) {
                if (otherLiked.has(id)) {
                    prioritized.push(id);
                } else {
                    rest.push(id);
                }
            }
            deck = prioritized.concat(rest);
        } else {
            deck = unseen;
        }
        deckIndex = 0;
    }

    // One-time migration from old seenData (deckIndex number) to seenIds (array of IDs)
    function migrateOldSeenData(shuffled, filterKey) {
        const oldKey = 'seenData_' + App.activeProfile;
        const oldData = App.LS.get(oldKey);
        if (!oldData) return;

        // Convert numeric deckIndex to actual seen name IDs for current filter
        if (oldData[filterKey] && !App.LS.get('seenIds_' + App.activeProfile + '_' + filterKey)) {
            const idx = oldData[filterKey];
            const seenIds = shuffled.slice(0, idx);
            App.LS.set('seenIds_' + App.activeProfile + '_' + filterKey, seenIds);
        }

        // Clean up old format
        delete oldData[filterKey];
        if (Object.keys(oldData).length === 0) {
            localStorage.removeItem('bn_seenData_' + App.activeProfile);
        } else {
            App.LS.set(oldKey, oldData);
        }
    }

    function saveDeckIndex() {
        const filterKey = JSON.stringify(filters);
        // Save IDs of all seen names (already seen + newly seen from current deck)
        const prevSeen = App.LS.get('seenIds_' + App.activeProfile + '_' + filterKey) || [];
        const seenSet = new Set(prevSeen);
        for (let i = 0; i < deckIndex; i++) {
            seenSet.add(deck[i]);
        }
        App.LS.set('seenIds_' + App.activeProfile + '_' + filterKey, Array.from(seenSet));
        App.setSeen(App.activeProfile, seenSet.size);
    }

    function passesFilters(name) {
        if (!filters || Object.keys(filters).length === 0) return true;

        // Letter filter
        if (filters.letters && filters.letters.length > 0) {
            const first = name.name[0].toUpperCase();
            if (!filters.letters.includes(first)) return false;
        }

        // Length filter
        if (filters.length) {
            const len = name.len;
            if (filters.length === 'short' && len > 4) return false;
            if (filters.length === 'medium' && (len < 5 || len > 6)) return false;
            if (filters.length === 'long' && len < 7) return false;
        }

        // Popularity filter
        if (filters.pop) {
            const pop = name.pop;
            if (filters.pop === 'popular' && pop < getPopThreshold(500)) return false;
            if (filters.pop === 'common' && (pop < getPopThreshold(2000) || pop >= getPopThreshold(500))) return false;
            if (filters.pop === 'uncommon' && (pop < 10 || pop >= getPopThreshold(2000))) return false;
            if (filters.pop === 'rare' && (pop < 1 || pop >= 10)) return false;
            if (filters.pop === 'unknown' && pop !== 0) return false;
        }

        // Syllable filter
        if (filters.syl) {
            const syl = name.syl;
            const target = parseInt(filters.syl, 10);
            if (target === 4) {
                if (syl < 4) return false;
            } else {
                if (syl !== target) return false;
            }
        }

        // Ending filter
        if (filters.end) {
            if (name.end !== filters.end && !name.name.toLowerCase().endsWith(filters.end)) return false;
        }

        return true;
    }

    // Get the pop threshold for top N names
    let popThresholds = null;
    function getPopThreshold(topN) {
        if (!popThresholds) {
            // Sort names by popularity descending, get the pop value at position topN
            const pops = NAMES.map(n => n.pop).filter(p => p > 0).sort((a, b) => b - a);
            popThresholds = {};
            popThresholds[500] = pops[Math.min(499, pops.length - 1)] || 1;
            popThresholds[2000] = pops[Math.min(1999, pops.length - 1)] || 1;
        }
        return popThresholds[topN] || 1;
    }

    function countFiltered() {
        let count = 0;
        for (let i = 0; i < NAMES.length; i++) {
            if (passesFilters(NAMES[i])) count++;
        }
        return count;
    }

    // Card rendering
    function renderCards() {
        const stack = document.getElementById('card-stack');
        const empty = document.getElementById('swipe-empty');

        // Clear existing cards
        stack.querySelectorAll('.name-card').forEach(c => c.remove());

        if (deckIndex >= deck.length) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        // Render back card (next)
        if (deckIndex + 1 < deck.length) {
            const backCard = mkCard(deck[deckIndex + 1], true);
            stack.appendChild(backCard);
        }

        // Render front card (current)
        const frontCard = mkCard(deck[deckIndex], false);
        stack.appendChild(frontCard);
        currentCard = frontCard;
    }

    function mkCard(nameId, isBack) {
        const name = NAMES[nameId];
        const card = document.createElement('div');
        card.className = 'name-card ' + GRADIENTS[nameId % GRADIENTS.length];
        if (isBack) card.classList.add('back-card');
        card.dataset.nameId = nameId;

        // Front
        const front = document.createElement('div');
        front.className = 'card-front';

        const deco = document.createElement('span');
        deco.className = 'card-decoration';
        deco.textContent = '♥';
        front.appendChild(deco);

        const nameEl = document.createElement('div');
        nameEl.className = 'card-name';
        nameEl.textContent = name.name;
        front.appendChild(nameEl);

        const hint = document.createElement('div');
        hint.className = 'card-hint';
        hint.textContent = 'Tryk for detaljer';
        front.appendChild(hint);

        // Stamps
        const stampLike = document.createElement('div');
        stampLike.className = 'card-stamp stamp-like';
        stampLike.textContent = 'JA!';
        front.appendChild(stampLike);

        const stampSkip = document.createElement('div');
        stampSkip.className = 'card-stamp stamp-skip';
        stampSkip.textContent = 'NEJ';
        front.appendChild(stampSkip);

        card.appendChild(front);

        // Back (details)
        const back = document.createElement('div');
        back.className = 'card-back';

        const backName = document.createElement('div');
        backName.className = 'card-name';
        backName.textContent = name.name;
        back.appendChild(backName);

        // Popularity
        const popDetail = document.createElement('div');
        popDetail.className = 'card-detail';
        const popLabel = document.createElement('div');
        popLabel.className = 'card-detail-label';
        popLabel.textContent = 'Popularitet';
        popDetail.appendChild(popLabel);
        const popVal = document.createElement('div');
        popVal.className = 'card-detail-value';
        if (name.pop > 0) {
            popVal.textContent = name.pop.toLocaleString('da-DK') + ' kvinder i Danmark';
        } else {
            popVal.textContent = 'Ingen data';
        }
        popDetail.appendChild(popVal);
        back.appendChild(popDetail);

        // Origin
        const originDetail = document.createElement('div');
        originDetail.className = 'card-detail';
        const originLabel = document.createElement('div');
        originLabel.className = 'card-detail-label';
        originLabel.textContent = 'Oprindelse';
        originDetail.appendChild(originLabel);
        const originVal = document.createElement('div');
        originVal.className = 'card-detail-value';
        originVal.textContent = name.origin || 'Ukendt';
        originDetail.appendChild(originVal);
        back.appendChild(originDetail);

        // Meaning
        const meaningDetail = document.createElement('div');
        meaningDetail.className = 'card-detail';
        const meaningLabel = document.createElement('div');
        meaningLabel.className = 'card-detail-label';
        meaningLabel.textContent = 'Betydning';
        meaningDetail.appendChild(meaningLabel);
        const meaningVal = document.createElement('div');
        meaningVal.className = 'card-detail-value';
        meaningVal.textContent = name.meaning || 'Ukendt';
        meaningDetail.appendChild(meaningVal);
        back.appendChild(meaningDetail);

        // Length & syllables
        const infoDetail = document.createElement('div');
        infoDetail.className = 'card-detail';
        const infoLabel = document.createElement('div');
        infoLabel.className = 'card-detail-label';
        infoLabel.textContent = 'Info';
        infoDetail.appendChild(infoLabel);
        const infoVal = document.createElement('div');
        infoVal.className = 'card-detail-value';
        infoVal.textContent = name.len + ' bogstaver · ' + name.syl + ' stavelser';
        infoDetail.appendChild(infoVal);
        back.appendChild(infoDetail);

        card.appendChild(back);

        return card;
    }

    function updateProgress() {
        const filterKey = JSON.stringify(filters);
        const seenIds = App.LS.get('seenIds_' + App.activeProfile + '_' + filterKey) || [];
        const totalSeen = seenIds.length + deckIndex;
        document.getElementById('swipe-count').textContent = totalSeen;
        document.getElementById('swipe-total').textContent = totalSeen + deck.length - deckIndex;
    }

    // Swipe mechanics
    function initListeners() {
        const stack = document.getElementById('card-stack');

        // Pointer events for dragging
        stack.addEventListener('pointerdown', onPointerDown);
        stack.addEventListener('pointermove', onPointerMove);
        stack.addEventListener('pointerup', onPointerUp);

        // Tap to flip
        stack.addEventListener('click', onCardTap);

        // Action buttons
        document.getElementById('btn-skip').addEventListener('click', () => swipe('left'));
        document.getElementById('btn-like').addEventListener('click', () => swipe('right'));

        // Filter button
        document.getElementById('btn-filter').addEventListener('click', toggleFilterPanel);

        // Filter chips
        initFilterListeners();

        // Apply / Clear filters
        document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);
        document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
    }

    function onPointerDown(e) {
        const card = e.target.closest('.name-card:not(.back-card)');
        if (!card || card.classList.contains('flipped')) return;
        dragging = true;
        startX = e.clientX;
        deltaX = 0;
        card.style.transition = 'none';
        card.setPointerCapture(e.pointerId);
        currentCard = card;
    }

    function onPointerMove(e) {
        if (!dragging || !currentCard) return;
        deltaX = e.clientX - startX;
        const rotation = deltaX * 0.07;
        currentCard.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

        // Show stamps
        const stampLike = currentCard.querySelector('.stamp-like');
        const stampSkip = currentCard.querySelector('.stamp-skip');
        if (stampLike) stampLike.style.opacity = Math.min(1, Math.max(0, deltaX / 100));
        if (stampSkip) stampSkip.style.opacity = Math.min(1, Math.max(0, -deltaX / 100));
    }

    function onPointerUp(e) {
        if (!dragging || !currentCard) return;
        dragging = false;

        if (Math.abs(deltaX) < 5) return; // This was a tap, not a swipe

        if (deltaX > 100) {
            fly(currentCard, 'right');
        } else if (deltaX < -100) {
            fly(currentCard, 'left');
        } else {
            // Snap back
            currentCard.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            currentCard.style.transform = '';
            const stampLike = currentCard.querySelector('.stamp-like');
            const stampSkip = currentCard.querySelector('.stamp-skip');
            if (stampLike) stampLike.style.opacity = '0';
            if (stampSkip) stampSkip.style.opacity = '0';
        }
    }

    function onCardTap(e) {
        if (Math.abs(deltaX) > 5) return; // Was a drag
        const card = e.target.closest('.name-card:not(.back-card)');
        if (!card) return;
        card.classList.toggle('flipped');
    }

    function swipe(direction) {
        if (!currentCard || deckIndex >= deck.length) return;
        fly(currentCard, direction);
    }

    function fly(card, direction) {
        const isRight = direction === 'right';
        const nameId = parseInt(card.dataset.nameId, 10);

        // Animate off screen
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = `translateX(${isRight ? 600 : -600}px) rotate(${isRight ? 42 : -42}deg)`;
        card.style.opacity = '0';

        // Like if right
        if (isRight) {
            const liked = App.getLiked(App.activeProfile);
            if (!liked.includes(nameId)) {
                liked.push(nameId);
                App.setLiked(App.activeProfile, liked);
            }
        }

        // Haptic
        if (navigator.vibrate) navigator.vibrate(isRight ? [30] : [15]);

        // Next card
        setTimeout(() => {
            deckIndex++;
            saveDeckIndex();
            updateProgress();
            renderCards();
        }, 280);
    }

    // Filter panel
    function toggleFilterPanel() {
        const panel = document.getElementById('filter-panel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            populateFilterPanel();
        }
    }

    function populateFilterPanel() {
        // Letters
        const letterContainer = document.getElementById('filter-letters');
        if (letterContainer.children.length === 0) {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
            letters.forEach(l => {
                const btn = document.createElement('button');
                btn.className = 'chip';
                btn.dataset.letter = l;
                btn.textContent = l;
                if (filters.letters && filters.letters.includes(l)) btn.classList.add('active');
                letterContainer.appendChild(btn);
            });
        }
        updateFilterCount();
    }

    function initFilterListeners() {
        // Letter clicks
        document.getElementById('filter-letters').addEventListener('click', e => {
            const btn = e.target.closest('.chip');
            if (!btn) return;
            btn.classList.toggle('active');
            updateFilterCount();
        });

        // Length, Pop, Syl, End — single select per group
        ['filter-length', 'filter-pop', 'filter-syl', 'filter-end'].forEach(id => {
            document.getElementById(id).addEventListener('click', e => {
                const btn = e.target.closest('.chip');
                if (!btn) return;
                const siblings = btn.parentElement.querySelectorAll('.chip');
                const wasActive = btn.classList.contains('active');
                siblings.forEach(s => s.classList.remove('active'));
                if (!wasActive) btn.classList.add('active');
                updateFilterCount();
            });
        });
    }

    function updateFilterCount() {
        const tempFilters = readFiltersFromUI();
        const oldFilters = filters;
        filters = tempFilters;
        const count = countFiltered();
        filters = oldFilters;
        document.getElementById('filter-match-count').textContent = count.toLocaleString('da-DK') + ' navne matcher';
    }

    function readFiltersFromUI() {
        const f = {};

        // Letters
        const activeLetters = Array.from(document.querySelectorAll('#filter-letters .chip.active'))
            .map(b => b.dataset.letter);
        if (activeLetters.length > 0) f.letters = activeLetters;

        // Length
        const activeLen = document.querySelector('#filter-length .chip.active');
        if (activeLen) f.length = activeLen.dataset.len;

        // Popularity
        const activePop = document.querySelector('#filter-pop .chip.active');
        if (activePop) f.pop = activePop.dataset.pop;

        // Syllables
        const activeSyl = document.querySelector('#filter-syl .chip.active');
        if (activeSyl) f.syl = activeSyl.dataset.syl;

        // Ending
        const activeEnd = document.querySelector('#filter-end .chip.active');
        if (activeEnd) f.end = activeEnd.dataset.end;

        return f;
    }

    function applyFilters() {
        filters = readFiltersFromUI();
        App.setFilters(App.activeProfile, filters);
        document.getElementById('filter-panel').classList.add('hidden');
        buildDeck();
        renderCards();
        updateProgress();
        updateActiveFilterChips();
    }

    function clearFilters() {
        document.querySelectorAll('#filter-panel .chip.active').forEach(c => c.classList.remove('active'));
        filters = {};
        App.setFilters(App.activeProfile, {});
        updateFilterCount();
    }

    function updateActiveFilterChips() {
        const container = document.getElementById('active-filters');
        container.innerHTML = '';
        const labels = [];

        if (filters.letters) labels.push(...filters.letters);
        if (filters.length) {
            const map = { short: 'Kort', medium: 'Medium', long: 'Lang' };
            labels.push(map[filters.length]);
        }
        if (filters.pop) {
            const map = { popular: 'Populær', common: 'Almindelig', uncommon: 'Ualmindelig', rare: 'Sjælden', unknown: 'Ukendt' };
            labels.push(map[filters.pop]);
        }
        if (filters.syl) labels.push(filters.syl + ' stav.');
        if (filters.end) labels.push('-' + filters.end);

        if (labels.length > 0) {
            container.classList.remove('hidden');
            labels.forEach(label => {
                const chip = document.createElement('span');
                chip.className = 'chip';
                chip.textContent = label;
                chip.addEventListener('click', () => {
                    // Remove this specific filter
                    if (filters.letters && filters.letters.includes(label)) {
                        filters.letters = filters.letters.filter(l => l !== label);
                        if (filters.letters.length === 0) delete filters.letters;
                    }
                    else if (label === 'Kort' || label === 'Medium' || label === 'Lang') delete filters.length;
                    else if (label === 'Populær' || label === 'Almindelig' || label === 'Ualmindelig' || label === 'Sjælden' || label === 'Ukendt') delete filters.pop;
                    else if (label.includes('stav.')) delete filters.syl;
                    else if (label.startsWith('-')) delete filters.end;
                    App.setFilters(App.activeProfile, filters);
                    buildDeck();
                    renderCards();
                    updateProgress();
                    updateActiveFilterChips();
                });
                container.appendChild(chip);
            });
        } else {
            container.classList.add('hidden');
        }
    }

    return { init };
})();
