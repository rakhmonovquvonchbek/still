(() => {
  const STORAGE_KEY = "still-pomodoro-v2";
  const CIRCUMFERENCE = 2 * Math.PI * 54;
  const { TRACKS, player } = window.StillAudio;

  const defaults = {
    settings: {
      focus: 25,
      short: 5,
      long: 15,
      longEvery: 4,
      autoStart: true,
      soundOn: true,
    },
    ambient: {
      trackId: "pink",
      volume: 0.35,
      playing: false,
    },
    stats: {
      today: 0,
      total: 0,
      streak: 0,
      lastActiveDate: null,
      focusSinceLong: 0,
    },
    memory: [],
    session: {
      mode: "focus",
      remainingMs: 25 * 60 * 1000,
      running: false,
      endsAt: null,
      startedAt: null,
      durationMs: 25 * 60 * 1000,
    },
  };

  const els = {
    time: document.getElementById("time"),
    status: document.getElementById("status"),
    toggleBtn: document.getElementById("toggleBtn"),
    resetBtn: document.getElementById("resetBtn"),
    skipBtn: document.getElementById("skipBtn"),
    todayCount: document.getElementById("todayCount"),
    streakCount: document.getElementById("streakCount"),
    totalCount: document.getElementById("totalCount"),
    settingsToggle: document.getElementById("settingsToggle"),
    settingsPanel: document.getElementById("settingsPanel"),
    focusMins: document.getElementById("focusMins"),
    shortMins: document.getElementById("shortMins"),
    longMins: document.getElementById("longMins"),
    longEvery: document.getElementById("longEvery"),
    autoStart: document.getElementById("autoStart"),
    soundOn: document.getElementById("soundOn"),
    progress: document.querySelector(".ring-progress"),
    modes: [...document.querySelectorAll(".mode")],
    noiseToggle: document.getElementById("noiseToggle"),
    noiseVolume: document.getElementById("noiseVolume"),
    noisePlaylist: document.getElementById("noisePlaylist"),
    noteForm: document.getElementById("noteForm"),
    noteInput: document.getElementById("noteInput"),
    memoryList: document.getElementById("memoryList"),
    reflectDialog: document.getElementById("reflectDialog"),
    reflectForm: document.getElementById("reflectForm"),
    reflectInput: document.getElementById("reflectInput"),
  };

  let state = loadState();
  let tickId = null;
  let chimeCtx = null;
  let pendingReflect = null;

  function todayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("still-pomodoro-v1");
      if (!raw) return structuredClone(defaults);
      const parsed = JSON.parse(raw);
      return {
        settings: { ...defaults.settings, ...(parsed.settings || {}) },
        ambient: { ...defaults.ambient, ...(parsed.ambient || {}) },
        stats: { ...defaults.stats, ...(parsed.stats || {}) },
        memory: Array.isArray(parsed.memory) ? parsed.memory.slice(0, 100) : [],
        session: { ...defaults.session, ...(parsed.session || {}) },
      };
    } catch {
      return structuredClone(defaults);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function modeDurationMs(mode = state.session.mode) {
    const mins = state.settings[mode] ?? state.settings.focus;
    return Math.max(1, Number(mins)) * 60 * 1000;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatStamp(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function statusCopy() {
    if (state.session.running) {
      if (state.session.mode === "focus") return "Stay with it";
      if (state.session.mode === "short") return "Short rest";
      return "Longer rest";
    }
    if (state.session.remainingMs < modeDurationMs()) return "Paused";
    if (state.session.mode === "focus") return "Ready when you are";
    return "Break ready";
  }

  function refreshStatsDay() {
    const today = todayKey();
    if (state.stats.lastActiveDate === today) return;
    if (state.stats.lastActiveDate && state.stats.lastActiveDate !== yesterdayKey()) {
      state.stats.streak = 0;
    }
    state.stats.today = 0;
  }

  function updateRing() {
    const total = state.session.durationMs || modeDurationMs();
    const remaining = Math.max(0, state.session.remainingMs);
    const progress = 1 - remaining / total;
    els.progress.style.strokeDasharray = String(CIRCUMFERENCE);
    els.progress.style.strokeDashoffset = String(CIRCUMFERENCE * progress);
  }

  function renderMemory() {
    els.memoryList.innerHTML = "";
    state.memory.slice(0, 30).forEach((item) => {
      const li = document.createElement("li");
      li.className = "memory-item";
      const kind =
        item.kind === "focus"
          ? "Focus"
          : item.kind === "note"
            ? "Note"
            : item.kind;
      li.innerHTML = `<p class="meta">${kind} · ${formatStamp(item.at)}</p><p class="text"></p>`;
      li.querySelector(".text").textContent = item.text;
      els.memoryList.appendChild(li);
    });
  }

  function renderAmbient() {
    els.noiseToggle.setAttribute("aria-pressed", state.ambient.playing ? "true" : "false");
    els.noiseToggle.textContent = state.ambient.playing ? "Sound on" : "Sound off";
    els.noiseVolume.value = String(Math.round(state.ambient.volume * 100));
    [...els.noisePlaylist.querySelectorAll(".track")].forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.track === state.ambient.trackId);
    });
  }

  function render() {
    els.time.textContent = formatTime(state.session.remainingMs);
    els.status.textContent = statusCopy();
    els.toggleBtn.textContent = state.session.running ? "Pause" : "Start";
    document.body.classList.toggle("is-running", state.session.running);
    els.todayCount.textContent = String(state.stats.today);
    els.streakCount.textContent = String(state.stats.streak);
    els.totalCount.textContent = String(state.stats.total);

    els.modes.forEach((btn) => {
      const active = btn.dataset.mode === state.session.mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    updateRing();
    renderAmbient();
    document.title = state.session.running
      ? `${formatTime(state.session.remainingMs)} · Still`
      : "Still — Pomodoro";
  }

  function syncSettingsForm() {
    els.focusMins.value = state.settings.focus;
    els.shortMins.value = state.settings.short;
    els.longMins.value = state.settings.long;
    els.longEvery.value = state.settings.longEvery;
    els.autoStart.checked = state.settings.autoStart;
    els.soundOn.checked = state.settings.soundOn;
  }

  function readSettingsFromForm() {
    state.settings.focus = clamp(Number(els.focusMins.value) || 25, 1, 90);
    state.settings.short = clamp(Number(els.shortMins.value) || 5, 1, 30);
    state.settings.long = clamp(Number(els.longMins.value) || 15, 1, 60);
    state.settings.longEvery = clamp(Number(els.longEvery.value) || 4, 2, 12);
    state.settings.autoStart = els.autoStart.checked;
    state.settings.soundOn = els.soundOn.checked;
    syncSettingsForm();
  }

  function addMemory({ kind, text }) {
    const cleaned = String(text || "").trim();
    if (!cleaned) return;
    state.memory.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      text: cleaned.slice(0, 140),
      at: new Date().toISOString(),
    });
    state.memory = state.memory.slice(0, 100);
    saveState();
    renderMemory();
  }

  function setMode(mode) {
    stopTicker();
    state.session.mode = mode;
    state.session.durationMs = modeDurationMs(mode);
    state.session.remainingMs = state.session.durationMs;
    state.session.running = false;
    state.session.endsAt = null;
    state.session.startedAt = null;
    saveState();
    render();
  }

  function syncRemainingFromClock() {
    if (!state.session.running || !state.session.endsAt) return;
    state.session.remainingMs = Math.max(0, state.session.endsAt - Date.now());
  }

  function stopTicker() {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function startTicker() {
    stopTicker();
    tickId = setInterval(() => {
      syncRemainingFromClock();
      if (state.session.remainingMs <= 0) {
        completeSession();
        return;
      }
      render();
      saveState();
    }, 250);
  }

  function startTimer() {
    if (state.session.remainingMs <= 0) {
      state.session.remainingMs = modeDurationMs();
      state.session.durationMs = state.session.remainingMs;
    }
    state.session.running = true;
    state.session.startedAt = Date.now();
    state.session.endsAt = Date.now() + state.session.remainingMs;
    saveState();
    startTicker();
    render();
    requestNotifyPermission();
  }

  function pauseTimer() {
    syncRemainingFromClock();
    state.session.running = false;
    state.session.endsAt = null;
    state.session.startedAt = null;
    stopTicker();
    saveState();
    render();
  }

  function resetTimer() {
    stopTicker();
    state.session.running = false;
    state.session.endsAt = null;
    state.session.startedAt = null;
    state.session.durationMs = modeDurationMs();
    state.session.remainingMs = state.session.durationMs;
    saveState();
    render();
  }

  function nextModeAfter(completedMode) {
    if (completedMode === "focus") {
      state.stats.focusSinceLong += 1;
      if (state.stats.focusSinceLong >= state.settings.longEvery) {
        state.stats.focusSinceLong = 0;
        return "long";
      }
      return "short";
    }
    return "focus";
  }

  function recordFocusComplete() {
    refreshStatsDay();
    const today = todayKey();
    if (state.stats.lastActiveDate !== today) {
      if (state.stats.lastActiveDate === yesterdayKey()) state.stats.streak += 1;
      else state.stats.streak = 1;
      state.stats.lastActiveDate = today;
    } else if (state.stats.streak === 0) {
      state.stats.streak = 1;
    }
    state.stats.today += 1;
    state.stats.total += 1;
  }

  function askReflection() {
    return new Promise((resolve) => {
      pendingReflect = resolve;
      els.reflectInput.value = "";
      if (typeof els.reflectDialog.showModal === "function") {
        els.reflectDialog.showModal();
      } else {
        resolve(null);
      }
    });
  }

  async function completeSession() {
    stopTicker();
    const finished = state.session.mode;
    state.session.running = false;
    state.session.endsAt = null;
    state.session.startedAt = null;
    state.session.remainingMs = 0;

    if (finished === "focus") {
      recordFocusComplete();
      playChime();
      notifyDone(finished);
      const note = await askReflection();
      addMemory({
        kind: "focus",
        text: note || `Focused for ${state.settings.focus} minutes`,
      });
    } else {
      playChime();
      notifyDone(finished);
    }

    const upcoming = nextModeAfter(finished);
    state.session.mode = upcoming;
    state.session.durationMs = modeDurationMs(upcoming);
    state.session.remainingMs = state.session.durationMs;
    saveState();
    render();

    if (state.settings.autoStart) startTimer();
  }

  function skipSession() {
    const finished = state.session.mode;
    stopTicker();
    state.session.running = false;
    state.session.endsAt = null;
    state.session.startedAt = null;
    const upcoming = nextModeAfter(finished);
    state.session.mode = upcoming;
    state.session.durationMs = modeDurationMs(upcoming);
    state.session.remainingMs = state.session.durationMs;
    saveState();
    render();
  }

  function playChime() {
    if (!state.settings.soundOn) return;
    try {
      chimeCtx = chimeCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = chimeCtx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = chimeCtx.createOscillator();
        const gain = chimeCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02 + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 + i * 0.08);
        osc.connect(gain);
        gain.connect(chimeCtx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + 0.5 + i * 0.08);
      });
    } catch {
      // ignore
    }
  }

  function requestNotifyPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  function notifyDone(mode) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const title = mode === "focus" ? "Focus complete" : "Break over";
    const body =
      mode === "focus" ? "Nice work. Leave a memory if you like." : "Ready for another focus block.";
    try {
      new Notification(title, { body, silent: true });
    } catch {
      // ignore
    }
  }

  function buildPlaylist() {
    els.noisePlaylist.innerHTML = "";
    TRACKS.forEach((track) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track";
      btn.dataset.track = track.id;
      btn.textContent = track.name;
      btn.setAttribute("role", "option");
      btn.addEventListener("click", async () => {
        state.ambient.trackId = track.id;
        saveState();
        renderAmbient();
        if (state.ambient.playing) {
          await player.play(track.id);
        }
      });
      els.noisePlaylist.appendChild(btn);
    });
  }

  async function resumeIfNeeded() {
    refreshStatsDay();
    if (state.session.running && state.session.endsAt) {
      syncRemainingFromClock();
      if (state.session.remainingMs <= 0) {
        await completeSession();
        return;
      }
      startTicker();
    } else {
      state.session.running = false;
      state.session.endsAt = null;
      if (!state.session.durationMs) state.session.durationMs = modeDurationMs();
      if (state.session.remainingMs == null) state.session.remainingMs = state.session.durationMs;
    }
    // Browsers block autoplay — keep preference but start stopped until user taps.
    state.ambient.playing = false;
    player.trackId = state.ambient.trackId;
    player.setVolume(state.ambient.volume);
    saveState();
    render();
    renderMemory();
  }

  els.toggleBtn.addEventListener("click", () => {
    if (state.session.running) pauseTimer();
    else startTimer();
  });

  els.resetBtn.addEventListener("click", resetTimer);
  els.skipBtn.addEventListener("click", skipSession);

  els.modes.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.mode === state.session.mode) return;
      setMode(btn.dataset.mode);
    });
  });

  els.settingsToggle.addEventListener("click", () => {
    const open = els.settingsPanel.hasAttribute("hidden");
    if (open) els.settingsPanel.removeAttribute("hidden");
    else els.settingsPanel.setAttribute("hidden", "");
    els.settingsToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  [
    els.focusMins,
    els.shortMins,
    els.longMins,
    els.longEvery,
    els.autoStart,
    els.soundOn,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      const wasRunning = state.session.running;
      const ratio =
        state.session.durationMs > 0
          ? state.session.remainingMs / state.session.durationMs
          : 1;
      readSettingsFromForm();
      state.session.durationMs = modeDurationMs(state.session.mode);
      if (!wasRunning && ratio >= 0.999) {
        state.session.remainingMs = state.session.durationMs;
      } else {
        state.session.remainingMs = Math.round(state.session.durationMs * ratio);
        if (wasRunning) state.session.endsAt = Date.now() + state.session.remainingMs;
      }
      saveState();
      render();
    });
  });

  els.noiseToggle.addEventListener("click", async () => {
    player.trackId = state.ambient.trackId;
    player.setVolume(state.ambient.volume);
    const playing = await player.toggle();
    state.ambient.playing = playing;
    saveState();
    renderAmbient();
  });

  els.noiseVolume.addEventListener("input", () => {
    state.ambient.volume = clamp(Number(els.noiseVolume.value) / 100, 0, 1);
    player.setVolume(state.ambient.volume);
    saveState();
  });

  els.noteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addMemory({ kind: "note", text: els.noteInput.value });
    els.noteInput.value = "";
  });

  els.reflectForm.addEventListener("submit", (e) => {
    const submitter = e.submitter;
    const value = submitter ? submitter.value : "skip";
    const note = value === "save" ? els.reflectInput.value.trim() : null;
    if (pendingReflect) {
      pendingReflect(note);
      pendingReflect = null;
    }
  });

  els.reflectDialog.addEventListener("close", () => {
    if (pendingReflect) {
      pendingReflect(null);
      pendingReflect = null;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncRemainingFromClock();
      if (state.session.running && state.session.remainingMs <= 0) completeSession();
      else {
        render();
        saveState();
      }
    }
  });

  window.addEventListener("beforeunload", saveState);

  buildPlaylist();
  syncSettingsForm();
  resumeIfNeeded();
})();
