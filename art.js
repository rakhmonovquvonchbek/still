(() => {
  const root = document.querySelector(".art");
  if (!root) return;

  const SCENES = [
    "media/scene-00.jpg",
    "media/scene-01.jpg",
    "media/scene-02.jpg",
    "media/scene-03.jpg",
    "media/scene-04.jpg",
    "media/scene-05.jpg",
    "media/scene-06.jpg",
    "media/scene-07.jpg",
    "media/scene-08.jpg",
    "media/scene-09.jpg",
    "media/scene-10.jpg",
  ];

  const INTERVAL_MS = 52000;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const a = document.createElement("img");
  const b = document.createElement("img");
  a.className = "art-still is-active";
  b.className = "art-still";
  a.alt = "";
  b.alt = "";
  a.decoding = "async";
  b.decoding = "async";
  a.src = SCENES[0];
  root.replaceChildren(a, b);

  let index = 0;
  let showingA = true;
  let timer = 0;

  function preload(src) {
    const img = new Image();
    img.src = src;
  }

  function nextIndex() {
    return (index + 1) % SCENES.length;
  }

  function swap() {
    if (document.hidden || reduceMotion.matches) return;

    const next = nextIndex();
    const incoming = showingA ? b : a;
    const outgoing = showingA ? a : b;
    const src = SCENES[next];

    const reveal = () => {
      incoming.classList.add("is-active");
      outgoing.classList.remove("is-active");
      showingA = !showingA;
      index = next;
      preload(SCENES[nextIndex()]);
    };

    if (incoming.getAttribute("src") === src && incoming.complete) {
      reveal();
      return;
    }

    incoming.onload = () => {
      incoming.onload = null;
      reveal();
    };
    incoming.src = src;
  }

  function schedule() {
    clearInterval(timer);
    if (reduceMotion.matches) return;
    timer = window.setInterval(swap, INTERVAL_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInterval(timer);
    else schedule();
  });

  reduceMotion.addEventListener("change", schedule);
  preload(SCENES[1]);
  schedule();
})();
