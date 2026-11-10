(() => {
  const TRACKS = [
    { id: "white", name: "White hush", kind: "white" },
    { id: "pink", name: "Pink drift", kind: "pink" },
    { id: "brown", name: "Brown depth", kind: "brown" },
    { id: "rain", name: "Soft rain", kind: "rain" },
    { id: "wind", name: "Night wind", kind: "wind" },
    { id: "tide", name: "Distant tide", kind: "tide" },
  ];

  class AmbientPlayer {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.filter = null;
      this.sources = [];
      this.playing = false;
      this.trackId = "pink";
      this.volume = 0.35;
    }

    async ensure() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 1800;
        this.filter.connect(this.master);
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) {
        this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
    }

    stopNodes() {
      this.sources.forEach((node) => {
        try {
          node.stop();
        } catch {
          // already stopped
        }
        try {
          node.disconnect();
        } catch {
          // ignore
        }
      });
      this.sources = [];
    }

    noiseBuffer(seconds = 2) {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * seconds);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      const kind = TRACKS.find((t) => t.id === this.trackId)?.kind || "white";

      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        let sample = white;

        if (kind === "pink") {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          sample = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          sample *= 0.11;
          b6 = white * 0.115926;
        } else if (kind === "brown" || kind === "tide") {
          last = (last + 0.02 * white) / 1.02;
          sample = last * 3.5;
        } else if (kind === "rain") {
          last = (last + 0.02 * white) / 1.02;
          const drip = Math.random() > 0.995 ? (Math.random() * 2 - 1) * 0.6 : 0;
          sample = white * 0.25 + last * 1.2 + drip;
        } else if (kind === "wind") {
          b0 = 0.97 * b0 + white * 0.2;
          sample = b0;
        }

        data[i] = Math.max(-1, Math.min(1, sample * 0.7));
      }
      return buffer;
    }

    configureFilter() {
      const kind = TRACKS.find((t) => t.id === this.trackId)?.kind || "white";
      const now = this.ctx.currentTime;
      if (kind === "white") {
        this.filter.type = "lowpass";
        this.filter.frequency.setTargetAtTime(5200, now, 0.05);
        this.filter.Q.setTargetAtTime(0.5, now, 0.05);
      } else if (kind === "pink") {
        this.filter.type = "lowpass";
        this.filter.frequency.setTargetAtTime(2800, now, 0.05);
        this.filter.Q.setTargetAtTime(0.7, now, 0.05);
      } else if (kind === "brown") {
        this.filter.type = "lowpass";
        this.filter.frequency.setTargetAtTime(900, now, 0.05);
        this.filter.Q.setTargetAtTime(0.8, now, 0.05);
      } else if (kind === "rain") {
        this.filter.type = "bandpass";
        this.filter.frequency.setTargetAtTime(1400, now, 0.05);
        this.filter.Q.setTargetAtTime(0.6, now, 0.05);
      } else if (kind === "wind") {
        this.filter.type = "bandpass";
        this.filter.frequency.setTargetAtTime(700, now, 0.05);
        this.filter.Q.setTargetAtTime(0.9, now, 0.05);
      } else if (kind === "tide") {
        this.filter.type = "lowpass";
        this.filter.frequency.setTargetAtTime(500, now, 0.05);
        this.filter.Q.setTargetAtTime(1.1, now, 0.05);
      }
    }

    startSource() {
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer(3);
      source.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.value = 1;

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const kind = TRACKS.find((t) => t.id === this.trackId)?.kind || "white";

      if (kind === "tide" || kind === "wind") {
        lfo.frequency.value = kind === "tide" ? 0.08 : 0.12;
        lfoGain.gain.value = kind === "tide" ? 0.35 : 0.22;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start();
        this.sources.push(lfo);
      }

      source.connect(gain);
      gain.connect(this.filter);
      source.start();
      this.sources.push(source, gain);
    }

    async play(trackId = this.trackId) {
      await this.ensure();
      this.trackId = trackId;
      this.stopNodes();
      this.configureFilter();
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.startSource();
      this.playing = true;
    }

    async pause() {
      if (!this.ctx) return;
      this.stopNodes();
      this.playing = false;
    }

    async toggle() {
      if (this.playing) {
        await this.pause();
        return false;
      }
      await this.play(this.trackId);
      return true;
    }
  }

  window.StillAudio = {
    TRACKS,
    player: new AmbientPlayer(),
  };
})();
