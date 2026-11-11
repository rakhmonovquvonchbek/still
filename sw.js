const CACHE = "still-v16";
const CORE = [
  "./",\n  "./index.html",\n  "./styles.css",\n  "./styles.css?v=16",\n  "./app.js",\n  "./app.js?v=16",\n  "./art.js",\n  "./art.js?v=16",\n  "./audio.js",\n  "./audio.js?v=16",\n  "./auth.js",\n  "./auth.js?v=16",\n  "./manifest.webmanifest",\n  "./icons/icon-192.png",\n  "./icons/icon-512.png",\n  "./icons/apple-touch-icon.png",\n  "./media/scene-00.jpg",\n  "./media/scene-01.jpg",\n  "./media/scene-02.jpg",\n  "./media/scene-03.jpg",\n  "./media/scene-04.jpg",\n  "./media/scene-05.jpg",\n  "./media/scene-06.jpg",\n  "./media/scene-07.jpg",\n  "./media/scene-08.jpg",\n  "./media/scene-09.jpg",\n  "./media/scene-10.jpg",\n  "./media/scene-11.jpg",\n  "./media/scene-12.jpg",\n  "./media/scene-13.jpg",\n  "./media/scene-14.jpg",\n  "./media/scene-15.jpg",\n  "./media/scene-16.jpg",\n  "./media/scene-17.jpg",\n  "./media/scene-18.jpg",\n  "./media/scene-19.jpg",\n  "./media/scene-20.jpg",\n  "./media/scene-21.jpg",\n  "./media/scene-22.jpg",\n  "./media/scene-23.jpg",\n  "./media/scene-24.jpg",\n  "./media/scene-25.jpg",\n  "./media/scene-26.jpg",\n  "./media/scene-27.jpg",\n  "./media/scene-28.jpg",\n  "./media/scene-29.jpg",\n  "./media/scene-30.jpg",
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
