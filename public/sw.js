// OKtv service worker — minimal offline shell.
//
// Strategy:
//   - Navigation requests (HTML): network-first, fall back to cached /.
//   - Static assets (JS/CSS/images): cache-first.
//   - Everything else (API, Firebase realtime, YouTube): always network.
//     We never intercept these because Firebase uses WebSockets and we don't
//     want to break the queue when offline.
//
// Spec: specs/03-tv-remote-navigation.md §5.1

const CACHE_NAME = "oktv-shell-v1";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                )
            )
    );
    self.clients.claim();
});

const NEVER_INTERCEPT = [/^https:\/\//];

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET, cross-origin, and Firebase/YouTube traffic entirely.
    if (
        request.method !== "GET" ||
        url.origin !== self.location.origin ||
        NEVER_INTERCEPT.some((re) => re.test(url.href))
    ) {
        return;
    }

    if (request.mode === "navigate") {
        // Network-first for HTML, fall back to cached shell.
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches
                        .open(CACHE_NAME)
                        .then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match("/").then((c) => c || Response.error()))
        );
        return;
    }

    // Cache-first for static assets.
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ||
                fetch(request).then((response) => {
                    const copy = response.clone();
                    caches
                        .open(CACHE_NAME)
                        .then((cache) => cache.put(request, copy));
                    return response;
                })
        )
    );
});