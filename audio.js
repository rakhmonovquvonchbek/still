(() => {
  const TRACKS = [
    { id: "white", name: "White hush", src: "sounds/white.wav" },
    { id: "pink", name: "Pink drift", src: "sounds/pink.wav" },
    { id: "brown", name: "Brown depth", src: "sounds/brown.wav" },
    { id: "rain", name: "Soft rain", src: "sounds/rain.wav" },
    { id: "wind", name: "Night wind", src: "sounds/wind.wav" },
    { id: "tide", name: "Distant tide", src: "sounds/tide.wav" },
  ];

  class AmbientPlayer {
    constructor() {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.preload = "auto";
      this.playing = false;
      this.trackId = "rain";
      this.volume = 0.55;
      this.audio.volume = this.volume;
    }

    trackSrc(id = this.trackId) {
      return TRACKS.find((t) => t.id === id)?.src || TRACKS[0].src;
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      this.audio.volume = this.volume;
    }

    async play(trackId = this.trackId) {
      this.trackId = trackId;
      const next = this.trackSrc(trackId);
      const needsLoad = !this.audio.src.endsWith(next) && !this.audio.src.includes(`/${next}`);

      if (needsLoad || !this.audio.src) {
        this.audio.src = next;
        this.audio.load();
      }

      this.audio.volume = this.volume;
      try {
        await this.audio.play();
        this.playing = true;
        return true;
      } catch (err) {
        this.playing = false;
        console.warn("Still audio blocked or failed:", err);
        return false;
      }
    }

    pause() {
      this.audio.pause();
      this.playing = false;
    }

    async toggle() {
      if (this.playing && !this.audio.paused) {
        this.pause();
        return false;
      }
      return this.play(this.trackId);
    }
  }

  window.StillAudio = {
    TRACKS,
    player: new AmbientPlayer(),
  };
})();
