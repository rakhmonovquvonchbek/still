(() => {
  const CIRCUMFERENCE = 2 * Math.PI * 54;
  const { TRACKS, player } = window.StillAudio;
  const auth = window.StillAuth;

  const defaults = {
    settings: {
      focus: 25,
      short: 5,
      long: 15,
      longEvery: 4,
      autoStart: true,
      soundOn: true,
      layout: null,
    },
    ambient: {
      trackId: "rain",
      volume: 0.55,
      playing: false,
    },
    stats: {
      today: 0,
      total: 0,
      streak: 0,
      lastActiveDate: null,
      focusSinceLong: 0,
    },
    history: {},
    tasks: [],
    activeTaskId: null,
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
    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    taskList: document.getElementById("taskList"),
    activeTaskLabel: document.getElementById("activeTaskLabel"),
    calPrev: document.getElementById("calPrev"),
    calNext: document.getElementById("calNext"),
    calLabel: document.getElementById("calLabel"),
    calGrid: document.getElementById("calGrid"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    dataStatus: document.getElementById("dataStatus"),
    installBtn: document.getElementById("installBtn"),
    accountBtn: document.getElementById("accountBtn"),
    accountAvatar: document.getElementById("accountAvatar"),
    accountLabel: document.getElementById("accountLabel"),
    accountDialog: document.getElementById("accountDialog"),
    accountClose: document.getElementById("accountClose"),
    accountCreateForm: document.getElementById("accountCreateForm"),
    accountNameInput: document.getElementById("accountNameInput"),
    accountListWrap: document.getElementById("accountListWrap"),
    accountList: document.getElementById("accountList"),
    accountSyncExport: document.getElementById("accountSyncExport"),
    accountSyncImport: document.getElementById("accountSyncImport"),
    accountSignOut: document.getElementById("accountSignOut"),
    accountStatus: document.getElementById("accountStatus"),
    accountTitle: document.getElementById("accountTitle"),
    accountHint: document.getElementById("accountHint"),
    accountSubmit: document.getElementById("accountSubmit"),
  };

  let state = null;
  let tickId = null;
  let chimeCtx = null;
  let pendingReflect = null;
  let calCursor = startOfMonth(new Date());
  let deferredInstall = null;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateKey(d);
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeState(parsed) {
    const next = {
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      ambient: { ...defaults.ambient, ...(parsed.ambient || {}) },
      stats: { ...defaults.stats, ...(parsed.stats || {}) },
      history: { ...(parsed.history || {}) },
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 50) : [],
      activeTaskId: parsed.activeTaskId || null,
      memory: Array.isArray(parsed.memory) ? parsed.memory.slice(0, 100) : [],
      session: { ...defaults.session, ...(parsed.session || {}) },
    };

    const today = localDateKey();
    if (!next.history[today] && next.stats.today > 0) {
      next.history[today] = next.stats.today;
    }
    if (next.activeTaskId && !next.tasks.some((t) => t.id === next.activeTaskId)) {
      next.activeTaskId = null;
    }
    if (!next.settings.layout) {
      next.settings.layout = window.innerWidth >= 980 ? "laptop" : "mobile";
    }
    return next;
  }

  function loadState() {
    try {
      const parsed = auth.loadState(defaults) || defaults;
      return normalizeState(parsed);
    } catch {
      return structuredClone(defaults);
    }
  }

  function saveState() {
    auth.saveState(state);
  }

  function renderAccount() {
    const current = auth.active();
    if (current) {
      els.accountBtn.classList.remove("is-guest");
      els.accountLabel.textContent = current.name;
      els.accountAvatar.textContent = current.name.slice(0, 1).toUpperCase();
      els.accountAvatar.style.background = current.color || "rgba(127, 159, 134, 0.28)";
      els.accountTitle.textContent = `Hey, ${current.name}`;
      els.accountSignOut.hidden = false;
      if (els.accountHint) {
        els.accountHint.textContent = "Switch people below, or add another name.";
      }
      if (els.accountSubmit) els.accountSubmit.textContent = "Add another person";
      if (els.accountClose) els.accountClose.textContent = "Done";
    } else {
      els.accountBtn.classList.add("is-guest");
      els.accountLabel.textContent = "Get started";
      els.accountAvatar.textContent = "+";
      els.accountAvatar.style.background = "";
      els.accountTitle.textContent = "What's your name?";
      els.accountSignOut.hidden = true;
      if (els.accountHint) {
        els.accountHint.textContent = "This keeps your focus streak and notes under your name.";
      }
      if (els.accountSubmit) els.accountSubmit.textContent = "Start focusing";
      if (els.accountClose) els.accountClose.textContent = "Skip";
    }

    const accounts = auth.list();
    els.accountListWrap.hidden = accounts.length === 0;
    els.accountList.innerHTML = "";
    accounts.forEach((account) => {
      const li = document.createElement("li");
      li.className = "account-item" + (account.id === auth.meta.activeId ? " is-active" : "");
      li.innerHTML = `
        <span class="account-avatar" style="background:${account.color}"></span>
        <button type="button" class="who">
          <strong></strong>
          <span></span>
        </button>
        <button type="button" class="tiny-action danger" data-remove>Remove</button>
      `;
      li.querySelector(".account-avatar").textContent = account.name.slice(0, 1).toUpperCase();
      li.querySelector("strong").textContent = account.name;
      li.querySelector("span").textContent =
        account.id === auth.meta.activeId ? "You're here" : "Switch to this person";
      li.querySelector(".who").addEventListener("click", () => {
        reloadAsAccount(() => auth.switchTo(account.id));
        closeAccountDialog();
      });
      li.querySelector("[data-remove]").addEventListener("click", (event) => {
        event.stopPropagation();
        if (!confirm(`Remove ${account.name} from this device?`)) return;
        reloadAsAccount(() => auth.remove(account.id));
      });
      els.accountList.appendChild(li);
    });
  }

  function reloadAsAccount(mutate) {
    stopTicker();
    if (state) saveState();
    mutate();
    state = loadState();
    player.pause();
    state.ambient.playing = false;
    player.trackId = state.ambient.trackId;
    player.setVolume(state.ambient.volume);
    syncSettingsForm();
    render();
    renderTasks();
    renderMemory();
    renderCalendar();
    renderAccount();
    renderAmbient();
    els.accountStatus.textContent = auth.active()
      ? `Signed in as ${auth.active().name}`
      : "Using guest mode";
    saveState();
  }

  function openAccountDialog() {
    els.accountStatus.textContent = "";
    els.accountNameInput.value = "";
    renderAccount();
    if (typeof els.accountDialog.showModal === "function") {
      els.accountDialog.showModal();
      setTimeout(() => els.accountNameInput.focus(), 50);
    }
  }

  function closeAccountDialog() {
    if (els.accountDialog.open) els.accountDialog.close();
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
    return `${pad(m)}:${pad(s)}`;
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

  function activeTask() {
    return state.tasks.find((t) => t.id === state.activeTaskId) || null;
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
    const today = localDateKey();
    if (state.stats.lastActiveDate === today) return;
    if (state.stats.lastActiveDate && state.stats.lastActiveDate !== yesterdayKey()) {
      state.stats.streak = 0;
    }
    state.stats.today = state.history[today] || 0;
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
      const kind = item.kind === "focus" ? "Focus" : item.kind === "note" ? "Note" : item.kind;
      li.innerHTML = `<p class="meta"></p><p class="text"></p>`;
      li.querySelector(".meta").textContent = `${kind} · ${formatStamp(item.at)}`;
      li.querySelector(".text").textContent = item.text;
      els.memoryList.appendChild(li);
    });
  }

  function renderTasks() {
    const current = activeTask();
    els.activeTaskLabel.textContent = current ? current.text : "No task selected";
    els.activeTaskLabel.classList.toggle("is-empty", !current);

    els.taskList.innerHTML = "";
    if (!state.tasks.length) {
      const empty = document.createElement("li");
      empty.className = "empty-hint";
      empty.textContent = "Add something to the queue, then select it before you start.";
      els.taskList.appendChild(empty);
      return;
    }

    state.tasks.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.id === state.activeTaskId ? " is-active" : "") + (task.done ? " is-done" : "");

      const select = document.createElement("button");
      select.type = "button";
      select.className = "task-select";
      select.textContent = task.text;
      select.addEventListener("click", () => {
        state.activeTaskId = task.id === state.activeTaskId ? null : task.id;
        saveState();
        renderTasks();
      });

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const doneBtn = document.createElement("button");
      doneBtn.type = "button";
      doneBtn.className = "tiny-action";
      doneBtn.textContent = task.done ? "Undo" : "Done";
      doneBtn.addEventListener("click", () => {
        task.done = !task.done;
        saveState();
        renderTasks();
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "tiny-action danger";
      delBtn.textContent = "Remove";
      delBtn.addEventListener("click", () => {
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        if (state.activeTaskId === task.id) state.activeTaskId = null;
        saveState();
        renderTasks();
      });

      actions.append(doneBtn, delBtn);
      li.append(select, actions);
      els.taskList.appendChild(li);
    });
  }

  function renderCalendar() {
    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    els.calLabel.textContent = calCursor.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });

    const first = new Date(year, month, 1);
    // Monday-first offset
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = localDateKey();

    let max = 1;
    Object.values(state.history).forEach((v) => {
      if (v > max) max = v;
    });

    els.calGrid.innerHTML = "";
    for (let i = 0; i < offset; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cal-cell is-blank";
      els.calGrid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${pad(month + 1)}-${pad(day)}`;
      const count = state.history[key] || 0;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell";
      if (key === today) cell.classList.add("is-today");
      if (count > 0) {
        const level = Math.min(4, Math.ceil((count / max) * 4));
        cell.classList.add(`lvl-${level}`);
      }
      cell.innerHTML = `<span class="day">${day}</span><span class="count">${count || ""}</span>`;
      cell.title = count ? `${count} focus${count === 1 ? "" : "es"}` : "No focus yet";
      cell.addEventListener("click", () => {
        els.dataStatus.textContent = count
          ? `${key}: ${count} focus session${count === 1 ? "" : "s"}`
          : `${key}: no focus sessions`;
      });
      els.calGrid.appendChild(cell);
    }
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

  function applyLayout(layout = state.settings.layout || "mobile") {
    const mode = layout === "laptop" ? "laptop" : "mobile";
    state.settings.layout = mode;
    document.body.classList.remove("layout-laptop", "layout-mobile");
    document.body.classList.add(mode === "laptop" ? "layout-laptop" : "layout-mobile");
    document.querySelectorAll(".layout-btn").forEach((btn) => {
      const on = btn.getAttribute("data-layout") === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncSettingsForm() {
    els.focusMins.value = state.settings.focus;
    els.shortMins.value = state.settings.short;
    els.longMins.value = state.settings.long;
    els.longEvery.value = state.settings.longEvery;
    els.autoStart.checked = state.settings.autoStart;
    els.soundOn.checked = state.settings.soundOn;
    applyLayout();
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
      id: uid(),
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
    const today = localDateKey();
    if (state.stats.lastActiveDate !== today) {
      if (state.stats.lastActiveDate === yesterdayKey()) state.stats.streak += 1;
      else state.stats.streak = 1;
      state.stats.lastActiveDate = today;
    } else if (state.stats.streak === 0) {
      state.stats.streak = 1;
    }
    state.stats.today += 1;
    state.stats.total += 1;
    state.history[today] = (state.history[today] || 0) + 1;

    const task = activeTask();
    if (task && !task.done) {
      task.focusCount = (task.focusCount || 0) + 1;
    }
  }

  function askReflection() {
    return new Promise((resolve) => {
      pendingReflect = resolve;
      const task = activeTask();
      els.reflectInput.value = "";
      els.reflectInput.placeholder = task ? `Note on “${task.text}”` : "What clicked?";
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
      const task = activeTask();
      recordFocusComplete();
      playChime();
      notifyDone(finished);
      const note = await askReflection();
      const fallback = task
        ? `Focused on ${task.text} · ${state.settings.focus}m`
        : `Focused for ${state.settings.focus} minutes`;
      addMemory({ kind: "focus", text: note || fallback });
      renderTasks();
      renderCalendar();
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
        player.setVolume(state.ambient.volume);
        const ok = await player.play(track.id);
        state.ambient.playing = ok;
        saveState();
        renderAmbient();
      });
      els.noisePlaylist.appendChild(btn);
    });
  }

  function exportData() {
    const payload = {
      app: "still",
      version: 3,
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `still-backup-${localDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    els.dataStatus.textContent = "Backup downloaded.";
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed.data || parsed;
        if (!data || typeof data !== "object") throw new Error("Invalid file");
        if (!confirm("Import will replace your current Still data on this device. Continue?")) {
          els.dataStatus.textContent = "Import cancelled.";
          return;
        }
        state = {
          settings: { ...defaults.settings, ...(data.settings || {}) },
          ambient: { ...defaults.ambient, ...(data.ambient || {}), playing: false },
          stats: { ...defaults.stats, ...(data.stats || {}) },
          history: { ...(data.history || {}) },
          tasks: Array.isArray(data.tasks) ? data.tasks.slice(0, 50) : [],
          activeTaskId: data.activeTaskId || null,
          memory: Array.isArray(data.memory) ? data.memory.slice(0, 100) : [],
          session: { ...defaults.session, ...(data.session || {}), running: false, endsAt: null },
        };
        saveState();
        syncSettingsForm();
        render();
        renderTasks();
        renderMemory();
        renderCalendar();
        els.dataStatus.textContent = "Import complete.";
      } catch {
        els.dataStatus.textContent = "Could not import that file.";
      }
    };
    reader.readAsText(file);
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
    state.ambient.playing = false;
    player.trackId = state.ambient.trackId;
    player.setVolume(state.ambient.volume);
    saveState();
    render();
    renderTasks();
    renderMemory();
    renderCalendar();
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
    if (!playing) els.status.textContent = "Tap Sound on again if audio is blocked";
    saveState();
    renderAmbient();
  });

  els.noiseVolume.addEventListener("input", () => {
    state.ambient.volume = clamp(Number(els.noiseVolume.value) / 100, 0, 1);
    player.setVolume(state.ambient.volume);
    saveState();
  });

  els.taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.taskInput.value.trim();
    if (!text) return;
    const task = { id: uid(), text: text.slice(0, 80), done: false, focusCount: 0, createdAt: new Date().toISOString() };
    state.tasks.unshift(task);
    if (!state.activeTaskId) state.activeTaskId = task.id;
    state.tasks = state.tasks.slice(0, 50);
    els.taskInput.value = "";
    saveState();
    renderTasks();
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

  els.calPrev.addEventListener("click", () => {
    calCursor = addMonths(calCursor, -1);
    renderCalendar();
  });
  els.calNext.addEventListener("click", () => {
    calCursor = addMonths(calCursor, 1);
    renderCalendar();
  });

  els.exportBtn.addEventListener("click", exportData);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) importData(file);
    els.importFile.value = "";
  });

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    els.installBtn.textContent = "Install app";
    els.installBtn.hidden = false;
  });

  if (isIos && !isStandalone) {
    els.installBtn.hidden = false;
    els.installBtn.textContent = "Add to Home Screen";
  }

  els.installBtn.addEventListener("click", async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      els.installBtn.hidden = true;
      return;
    }
    if (isIos && !isStandalone) {
      els.dataStatus.textContent = "In Safari: Share → Add to Home Screen";
      els.settingsPanel.removeAttribute("hidden");
      els.settingsToggle.setAttribute("aria-expanded", "true");
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=15").then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }

  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".layout-btn");
    if (!btn) return;
    event.preventDefault();
    applyLayout(btn.getAttribute("data-layout"));
    saveState();
  });

  els.accountBtn.addEventListener("click", openAccountDialog);
  els.accountClose.addEventListener("click", closeAccountDialog);

  els.accountCreateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.accountNameInput.value.trim();
    if (!name) return;
    try {
      reloadAsAccount(() => {
        if (!auth.active() && auth.list().length === 0) auth.claimGuest(name);
        else auth.create(name);
      });
      els.accountNameInput.value = "";
      closeAccountDialog();
    } catch (err) {
      if (els.accountStatus) {
        els.accountStatus.hidden = false;
        els.accountStatus.textContent = err.message || "Could not create account";
      }
    }
  });

  els.accountSignOut.addEventListener("click", () => {
    reloadAsAccount(() => auth.signOut());
    closeAccountDialog();
  });

  els.accountSyncExport.addEventListener("click", async () => {
    try {
      const code = auth.exportSyncCode(state);
      await navigator.clipboard.writeText(code);
      els.accountStatus.textContent = "Sync code copied. Paste it on another device to restore.";
    } catch {
      els.accountStatus.textContent = "Could not copy sync code.";
    }
  });

  els.accountSyncImport.addEventListener("click", () => {
    const code = prompt("Paste your Still sync code");
    if (!code) return;
    try {
      const payload = auth.importSyncCode(code);
      const name = payload.account?.name || "Imported";
      reloadAsAccount(() => {
        const account = auth.create(name);
        if (payload.account?.color) {
          account.color = payload.account.color;
          const row = auth.meta.accounts.find((a) => a.id === account.id);
          if (row) row.color = account.color;
          localStorage.setItem("still-accounts-meta-v1", JSON.stringify(auth.meta));
        }
        auth.saveState(payload.state);
      });
      state = normalizeState(payload.state);
      saveState();
      syncSettingsForm();
      render();
      renderTasks();
      renderMemory();
      renderCalendar();
      renderAccount();
      els.accountStatus.textContent = `Imported ${auth.active()?.name || "account"}`;
    } catch {
      els.accountStatus.textContent = "That sync code looks invalid.";
    }
  });

  state = loadState();
  buildPlaylist();
  syncSettingsForm();
  renderAccount();
  resumeIfNeeded();

  if (auth.ensureWelcomeNeeded()) {
    openAccountDialog();
  }
})();
