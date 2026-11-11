(() => {
  const root = document.querySelector(".art");
  const video = document.getElementById("artLive");
  if (!root || !video) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setMotion(off) {
    root.classList.toggle("is-still", off);
    if (off) {
      video.pause();
      return;
    }
    const play = video.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  }

  function onVisibility() {
    if (document.hidden || reduceMotion.matches) {
      video.pause();
      return;
    }
    setMotion(false);
  }

  reduceMotion.addEventListener("change", () => setMotion(reduceMotion.matches));
  document.addEventListener("visibilitychange", onVisibility);
  video.addEventListener("loadeddata", () => {
    video.classList.add("is-ready");
    setMotion(reduceMotion.matches);
  });
  setMotion(reduceMotion.matches);
})();
