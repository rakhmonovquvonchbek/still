(() => {
  const root = document.querySelector(".art");
  if (!root) return;

  const STORAGE_RECENT = "still.art.recent";
  const STORAGE_QUEUE = "still.art.queue";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const INTERVALS = {
    off: 0,
    "20s": 20000,
    "45s": 45000,
    "2m": 120000,
    session: -1,
  };

  let catalog = [];
  let settings = {
    backdropMode: "both", // photos | artworks | both
    backdropInterval: "20s",
  };
  let queue = [];
  let recent = [];
  let current = null;
  let timer = 0;
  let showingA = true;

  const a = document.createElement("img");
  const b = document.createElement("img");
  a.className = "art-still is-active";
  b.className = "art-still";
  a.alt = "";
  b.alt = "";
  a.decoding = "async";
  b.decoding = "async";

  const caption = document.createElement("p");
  caption.className = "art-caption";
  caption.hidden = true;

  root.replaceChildren(a, b, caption);

  function loadRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_RECENT) || "[]");
      recent = Array.isArray(parsed) ? parsed.slice(-10) : [];
    } catch {
      recent = [];
    }
  }

  function saveRecent() {
    localStorage.setItem(STORAGE_RECENT, JSON.stringify(recent.slice(-10)));
  }

  function loadQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_QUEUE) || "[]");
      queue = Array.isArray(parsed) ? parsed : [];
    } catch {
      queue = [];
    }
  }

  function saveQueue() {
    localStorage.setItem(STORAGE_QUEUE, JSON.stringify(queue));
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pool() {
    const mode = settings.backdropMode || "both";
    return catalog.filter((item) => {
      if (mode === "photos") return item.kind === "photo";
      if (mode === "artworks") return item.kind === "artwork";
      return true;
    });
  }

  function rebuildQueue(preferFresh = true) {
    const ids = pool().map((item) => item.id);
    let next = shuffle(ids);
    if (preferFresh && recent.length) {
      const blocked = new Set(recent.slice(-10));
      const fresh = next.filter((id) => !blocked.has(id));
      const rest = next.filter((id) => blocked.has(id));
      next = fresh.concat(rest);
    }
    queue = next;
    saveQueue();
  }

  function ensureQueue() {
    const ids = new Set(pool().map((item) => item.id));
    queue = queue.filter((id) => ids.has(id));
    if (!queue.length) rebuildQueue(true);
  }

  function findItem(id) {
    return catalog.find((item) => item.id === id) || null;
  }

  function pickSrc(item) {
    if (!item) return null;
    const webp = `${item.src}.webp`;
    const jpg = `${item.src}.jpg`;
    // Prefer WebP when supported
    if (window.StillArtSupportsWebp !== false) return { primary: webp, fallback: jpg };
    return { primary: jpg, fallback: jpg };
  }

  function setCaption(item) {
    if (item && item.kind === "artwork" && item.caption) {
      caption.hidden = false;
      caption.textContent = item.caption;
    } else {
      caption.hidden = true;
      caption.textContent = "";
    }
  }

  function applyTo(img, item) {
    const srcs = pickSrc(item);
    if (!srcs) return Promise.reject(new Error("missing item"));
    return new Promise((resolve, reject) => {
      const onError = () => {
        img.onerror = null;
        if (img.getAttribute("src") !== srcs.fallback) {
          img.src = srcs.fallback;
          return;
        }
        reject(new Error("image failed"));
      };
      img.onload = () => {
        img.onload = null;
        img.onerror = null;
        resolve();
      };
      img.onerror = onError;
      img.src = srcs.primary;
    });
  }

  function preload(item) {
    if (!item) return;
    const srcs = pickSrc(item);
    const img = new Image();
    img.src = srcs.primary;
    img.onerror = () => {
      img.src = srcs.fallback;
    };
  }

  function remember(id) {
    recent = recent.filter((x) => x !== id);
    recent.push(id);
    if (recent.length > 10) recent = recent.slice(-10);
    saveRecent();
  }

  async function showItem(item, { fade = true } = {}) {
    if (!item) return;
    const incoming = showingA ? b : a;
    const outgoing = showingA ? a : b;
    try {
      await applyTo(incoming, item);
    } catch {
      return;
    }
    if (!fade) {
      incoming.classList.add("is-active");
      outgoing.classList.remove("is-active");
    } else {
      incoming.classList.add("is-active");
      outgoing.classList.remove("is-active");
    }
    showingA = !showingA;
    current = item;
    setCaption(item);
    remember(item.id);

    // Preload only the next queued image
    ensureQueue();
    const nextId = queue[0];
    if (nextId) preload(findItem(nextId));
  }

  function nextItem() {
    ensureQueue();
    // Avoid last ~10 when choosing from queue head if possible
    const blocked = new Set(recent.slice(-10));
    let idx = queue.findIndex((id) => !blocked.has(id));
    if (idx < 0) idx = 0;
    const id = queue.splice(idx, 1)[0];
    saveQueue();
    if (!queue.length) rebuildQueue(true);
    return findItem(id);
  }

  async function advance() {
    if (document.hidden) return;
    const item = nextItem();
    if (item) await showItem(item, { fade: true });
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  }

  function schedule() {
    clearTimer();
    const key = settings.backdropInterval || "20s";
    const ms = INTERVALS[key];
    if (!ms || ms < 0 || reduceMotion.matches) return;
    timer = window.setInterval(() => {
      advance();
    }, ms);
  }

  async function boot() {
    loadRecent();
    loadQueue();
    ensureQueue();
    // Random image on every load, never one of the last ~10 when possible
    const item = nextItem();
    if (item) await showItem(item, { fade: false });
    else if (catalog[0]) await showItem(catalog[0], { fade: false });
    schedule();
  }

  function applySettings(next = {}) {
    const prevMode = settings.backdropMode;
    settings = {
      backdropMode: next.backdropMode || settings.backdropMode || "both",
      backdropInterval: next.backdropInterval || settings.backdropInterval || "20s",
    };
    if (settings.backdropMode !== prevMode) {
      rebuildQueue(true);
    }
    schedule();
  }

  function onSessionComplete() {
    if ((settings.backdropInterval || "20s") !== "session") return;
    advance();
  }

  // Detect WebP once
  (function detectWebp() {
    const img = new Image();
    img.onload = () => {
      window.StillArtSupportsWebp = img.width > 0 && img.height > 0;
    };
    img.onerror = () => {
      window.StillArtSupportsWebp = false;
    };
    img.src =
      "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  })();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimer();
    else schedule();
  });
  reduceMotion.addEventListener("change", schedule);

  window.StillArt = {
    applySettings,
    onSessionComplete,
    refresh: () => advance(),
    getCurrent: () => current,
  };

  fetch("media/catalog.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      catalog = Array.isArray(data.items) ? data.items : [];
      return boot();
    })
    .catch(() => {
      // Fallback to legacy single scene if catalog missing
      catalog = [
        {
          id: "legacy-0",
          kind: "photo",
          src: "media/scene-00",
          caption: null,
        },
      ];
      return boot();
    });
})();
