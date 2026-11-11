(() => {
  const TRACKS = [
    { id: "rain", name: "Soft rain", src: "sounds/rain.wav" },
    { id: "forest", name: "Forest hush", src: "sounds/forest.wav" },
    { id: "fire", name: "Low fire", src: "sounds/fire.wav" },
    { id: "tide", name: "Distant tide", src: "sounds/tide.wav" },
    { id: "wind", name: "Night wind", src: "sounds/wind.wav" },
    { id: "pink", name: "Pink drift", src: "sounds/pink.wav" },
    { id: "brown", name: "Brown depth", src: "sounds/brown.wav" },
    { id: "white", name: "White hush", src: "sounds/white.wav" },
  ];

  class AmbientPlayer {
    constructor() {
      this.current = new Audio();
      this.next = new Audio();
      [this.current, this.next].forEach((a) => {
        a.loop = true;
        a.preload = "auto";
      });
      this.playing = false;
      this.trackId = "rain";
      this.volume = 0.55;
      this.fading = false;
    }

    trackSrc(id = this.trackId) {
      return TRACKS.find((t) => t.id === id)?.src || TRACKS[0].src;
    }

    sameSrc(audio, src) {
      if (!audio.src) return false;
      return audio.src.endsWith(src) || audio.src.includes(`/${src}`);
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (!this.fading) this.current.volume = this.volume;
    }

    async play(trackId = this.trackId) {
      const src = this.trackSrc(trackId);
      const switching =
        this.playing && !this.current.paused && this.trackId !== trackId;

      this.trackId = trackId;

      if (switching) {
        return this.crossfadeTo(src);
      }

      if (!this.sameSrc(this.current, src)) {
        this.current.src = src;
        this.current.load();
      }
      this.current.volume = this.volume;
      try {
        await this.current.play();
        this.playing = true;
        return true;
      } catch (err) {
        this.playing = false;
        console.warn("Still audio blocked or failed:", err);
        return false;
      }
    }

    async crossfadeTo(src) {
      this.fading = true;
      this.next.src = src;
      this.next.load();
      this.next.volume = 0;
      try {
        await this.next.play();
      } catch (err) {
        this.fading = false;
        console.warn("Still audio blocked or failed:", err);
        return false;
      }

      const steps = 18;
      const startVol = this.current.volume;
      for (let i = 1; i <= steps; i += 1) {
        const g = i / steps;
        this.current.volume = startVol * (1 - g);
        this.next.volume = this.volume * g;
        await new Promise((r) => setTimeout(r, 30));
      }

      this.current.pause();
      const tmp = this.current;
      this.current = this.next;
      this.next = tmp;
      this.next.pause();
      this.current.volume = this.volume;
      this.fading = false;
      this.playing = true;
      return true;
    }

    pause() {
      this.current.pause();
      this.next.pause();
      this.playing = false;
      this.fading = false;
    }

    async toggle() {
      if (this.playing && !this.current.paused) {
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
