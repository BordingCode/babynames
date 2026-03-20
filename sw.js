const CACHE = 'babynavne-v1';
const ASSETS = [
    './',
    'index.html',
    'css/shared.css',
    'css/swipe.css',
    'css/browse.css',
    'css/match.css',
    'js/names.js',
    'js/app.js',
    'js/swipe.js',
    'js/browse.js',
    'js/match.js',
    'manifest.json',
    'icons/favicon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

// Install: cache all assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                const clone = resp.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, clone));
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
