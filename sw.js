const CACHE = "still-v18";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=18",
  "./app.js",
  "./app.js?v=18",
  "./art.js",
  "./art.js?v=18",
  "./audio.js",
  "./audio.js?v=18",
  "./auth.js",
  "./auth.js?v=18",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./media/catalog.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Images: cache-as-you-go only (do not precache the full library).
  const isMedia =
    url.pathname.includes("/media/photos/") ||
    url.pathname.includes("/media/artworks/") ||
    /\.(?:jpg|jpeg|webp|png)$/i.test(url.pathname);

  if (isMedia) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
