const CACHE = "still-v15";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=15",
  "./app.js",
  "./app.js?v=15",
  "./art.js",
  "./art.js?v=15",
  "./audio.js",
  "./audio.js?v=15",
  "./auth.js",
  "./auth.js?v=15",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./media/scene-00.jpg",
  "./media/scene-01.jpg",
  "./media/scene-02.jpg",
  "./media/scene-03.jpg",
  "./media/scene-04.jpg",
  "./media/scene-05.jpg",
  "./media/scene-06.jpg",
  "./media/scene-07.jpg",
  "./media/scene-08.jpg",
  "./media/scene-09.jpg",
  "./media/scene-10.jpg",
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
