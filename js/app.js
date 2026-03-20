/* === Baby Names — Core App === */

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

const App = (() => {
    // State
    let currentScreen = 'login';
    let activeProfile = -1; // -1 = not logged in
    let pin = '';
    let setupPin = '';

    // localStorage helpers
    const LS = {
        get(key) {
            try { return JSON.parse(localStorage.getItem('bn_' + key)); }
            catch { return null; }
        },
        set(key, val) {
            localStorage.setItem('bn_' + key, JSON.stringify(val));
        },
        getRaw(key) {
            return localStorage.getItem('bn_' + key);
        },
        setRaw(key, val) {
            localStorage.setItem('bn_' + key, val);
        }
    };

    // Check if profiles exist
    function hasProfiles() {
        return LS.get('pin') !== null && LS.get('profiles') !== null;
    }

    function getProfiles() {
        return LS.get('profiles') || ['Partner 1', 'Partner 2'];
    }

    function getLiked(profileIdx) {
        return LS.get('liked_' + profileIdx) || [];
    }

    function setLiked(profileIdx, arr) {
        LS.set('liked_' + profileIdx, arr);
    }

    function isLiked(profileIdx, nameId) {
        const liked = getLiked(profileIdx);
        return liked.includes(nameId);
    }

    function toggleLike(nameId) {
        const liked = getLiked(activeProfile);
        const idx = liked.indexOf(nameId);
        if (idx >= 0) {
            liked.splice(idx, 1);
        } else {
            liked.push(nameId);
        }
        setLiked(activeProfile, liked);
        return idx < 0; // returns true if now liked
    }

    function getSeen(profileIdx) {
        return parseInt(LS.getRaw('seen_' + profileIdx) || '0', 10);
    }

    function setSeen(profileIdx, val) {
        LS.setRaw('seen_' + profileIdx, String(val));
    }

    function getSeed(profileIdx) {
        let seed = LS.get('seed_' + profileIdx);
        if (seed === null) {
            seed = Math.floor(Math.random() * 2147483647);
            LS.set('seed_' + profileIdx, seed);
        }
        return seed;
    }

    function getFilters(profileIdx) {
        return LS.get('filters_' + profileIdx) || {};
    }

    function setFilters(profileIdx, filters) {
        LS.set('filters_' + profileIdx, filters);
    }

    // Seeded PRNG (mulberry32)
    function mulberry32(seed) {
        return function() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // Fisher-Yates shuffle with seeded RNG
    function seededShuffle(arr, seed) {
        const rng = mulberry32(seed);
        const shuffled = arr.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Navigation
    function goScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById('screen-' + name);
        if (screen) screen.classList.add('active');

        // Show/hide nav
        const nav = document.getElementById('bottom-nav');
        if (name === 'login') {
            nav.classList.remove('visible');
        } else {
            nav.classList.add('visible');
        }

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === name);
        });

        currentScreen = name;

        // Trigger screen-specific init
        if (name === 'swipe' && typeof Swipe !== 'undefined') Swipe.init();
        if (name === 'browse' && typeof Browse !== 'undefined') Browse.init();
        if (name === 'match' && typeof Match !== 'undefined') Match.init();
    }

    // PIN handling
    function initPinPad() {
        // Login PIN pad
        const pinEntry = document.getElementById('pin-entry');
        pinEntry.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.num !== undefined) {
                    pin += btn.dataset.num;
                    updatePinDots(pinEntry.querySelector('.pin-dots'), pin);
                    if (pin.length === 4) {
                        checkPin();
                    }
                } else if (btn.dataset.action === 'delete') {
                    pin = pin.slice(0, -1);
                    updatePinDots(pinEntry.querySelector('.pin-dots'), pin);
                }
            });
        });

        // Setup PIN pad
        const setupPad = document.getElementById('setup-pin-pad');
        setupPad.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.num !== undefined) {
                    setupPin += btn.dataset.num;
                    updatePinDots(document.getElementById('setup-pin-dots'), setupPin);
                    if (setupPin.length === 4) {
                        document.getElementById('setup-names').classList.remove('hidden');
                        document.getElementById('setup-name1').focus();
                    }
                } else if (btn.dataset.action === 'delete') {
                    setupPin = setupPin.slice(0, -1);
                    updatePinDots(document.getElementById('setup-pin-dots'), setupPin);
                }
            });
        });

        // First time button
        document.getElementById('btn-first-time').addEventListener('click', () => {
            document.getElementById('pin-entry').classList.add('hidden');
            document.getElementById('setup-form').classList.remove('hidden');
            setupPin = '';
            updatePinDots(document.getElementById('setup-pin-dots'), '');
        });

        // Back to login
        document.getElementById('btn-back-login').addEventListener('click', () => {
            document.getElementById('setup-form').classList.add('hidden');
            document.getElementById('setup-names').classList.add('hidden');
            document.getElementById('pin-entry').classList.remove('hidden');
            pin = '';
            setupPin = '';
            updatePinDots(document.querySelector('#pin-entry .pin-dots'), '');
        });

        // Create button enable/disable
        const name1 = document.getElementById('setup-name1');
        const name2 = document.getElementById('setup-name2');
        const createBtn = document.getElementById('btn-create');
        function checkCreate() {
            createBtn.disabled = !(name1.value.trim() && name2.value.trim());
        }
        name1.addEventListener('input', checkCreate);
        name2.addEventListener('input', checkCreate);

        // Create profiles
        createBtn.addEventListener('click', () => {
            if (setupPin.length !== 4) return;
            const p1 = name1.value.trim();
            const p2 = name2.value.trim();
            if (!p1 || !p2) return;

            LS.set('pin', setupPin);
            LS.set('profiles', [p1, p2]);
            // Show profile selection
            showProfileSelect();
        });

        // If profiles exist, show PIN entry. Otherwise show setup.
        if (!hasProfiles()) {
            document.getElementById('pin-entry').classList.add('hidden');
            document.getElementById('setup-form').classList.remove('hidden');
        }
    }

    function updatePinDots(container, currentPin) {
        const dots = container.querySelectorAll('.pin-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < currentPin.length);
            dot.classList.remove('error');
        });
    }

    function checkPin() {
        const stored = LS.get('pin');
        if (pin === stored) {
            showProfileSelect();
        } else {
            // Error animation
            const dots = document.querySelectorAll('#pin-entry .pin-dot');
            dots.forEach(d => d.classList.add('error'));
            if (navigator.vibrate) navigator.vibrate(200);
            setTimeout(() => {
                pin = '';
                updatePinDots(document.querySelector('#pin-entry .pin-dots'), '');
            }, 500);
        }
    }

    function showProfileSelect() {
        const profiles = getProfiles();
        document.getElementById('profile-name-0').textContent = profiles[0];
        document.getElementById('profile-name-1').textContent = profiles[1];

        document.getElementById('pin-entry').classList.add('hidden');
        document.getElementById('setup-form').classList.add('hidden');
        document.getElementById('profile-select').classList.remove('hidden');
    }

    function initProfileSelect() {
        document.querySelectorAll('.profile-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeProfile = parseInt(btn.dataset.profile, 10);
                LS.set('active', activeProfile);
                updateProfileDisplay();
                goScreen('swipe');
            });
        });

        // Switch profile button
        document.getElementById('btn-switch-profile').addEventListener('click', () => {
            goScreen('login');
            document.getElementById('profile-select').classList.remove('hidden');
            document.getElementById('pin-entry').classList.add('hidden');
            document.getElementById('setup-form').classList.add('hidden');
            const profiles = getProfiles();
            document.getElementById('profile-name-0').textContent = profiles[0];
            document.getElementById('profile-name-1').textContent = profiles[1];
        });
    }

    function updateProfileDisplay() {
        const profiles = getProfiles();
        const name = profiles[activeProfile] || '?';
        document.getElementById('active-profile-initial').textContent = name[0].toUpperCase();
    }

    // Nav
    function initNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                goScreen(btn.dataset.screen);
            });
        });
    }

    // Init
    function init() {
        initPinPad();
        initProfileSelect();
        initNav();
    }

    document.addEventListener('DOMContentLoaded', init);

    // Public API
    return {
        LS, goScreen, getProfiles, getLiked, setLiked, isLiked, toggleLike,
        getSeen, setSeen, getSeed, seededShuffle, getFilters, setFilters,
        get activeProfile() { return activeProfile; },
        get currentScreen() { return currentScreen; },
        updateProfileDisplay
    };
})();
