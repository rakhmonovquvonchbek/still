(() => {
  const META_KEY = "still-accounts-meta-v1";
  const stateKey = (id) => `still-pomodoro-v3:${id}`;
  const LEGACY_KEYS = ["still-pomodoro-v3", "still-pomodoro-v2", "still-pomodoro-v1"];
  const COLORS = ["#7f9f86", "#9fbfa5", "#6f8f9a", "#b7a57a", "#8a9e7a", "#a3b4a8"];

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return { activeId: null, accounts: [] };
      const parsed = JSON.parse(raw);
      return {
        activeId: parsed.activeId || null,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      };
    } catch {
      return { activeId: null, accounts: [] };
    }
  }

  function saveMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function readLegacyState() {
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // continue
        }
      }
    }
    return null;
  }

  const api = {
    meta: loadMeta(),

    list() {
      return this.meta.accounts.slice().sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || ""));
    },

    active() {
      return this.meta.accounts.find((a) => a.id === this.meta.activeId) || null;
    },

    storageKey() {
      const current = this.active();
      return current ? stateKey(current.id) : LEGACY_KEYS[0];
    },

    create(name) {
      const cleaned = String(name || "").trim().slice(0, 24);
      if (!cleaned) throw new Error("Name required");
      const account = {
        id: uid(),
        name: cleaned,
        color: COLORS[this.meta.accounts.length % COLORS.length],
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };
      this.meta.accounts.push(account);
      this.meta.activeId = account.id;
      saveMeta(this.meta);
      return account;
    },

    switchTo(id) {
      const account = this.meta.accounts.find((a) => a.id === id);
      if (!account) throw new Error("Account not found");
      account.lastUsedAt = new Date().toISOString();
      this.meta.activeId = account.id;
      saveMeta(this.meta);
      return account;
    },

    rename(id, name) {
      const account = this.meta.accounts.find((a) => a.id === id);
      if (!account) throw new Error("Account not found");
      const cleaned = String(name || "").trim().slice(0, 24);
      if (!cleaned) throw new Error("Name required");
      account.name = cleaned;
      saveMeta(this.meta);
      return account;
    },

    remove(id) {
      this.meta.accounts = this.meta.accounts.filter((a) => a.id !== id);
      localStorage.removeItem(stateKey(id));
      if (this.meta.activeId === id) {
        this.meta.activeId = this.meta.accounts[0]?.id || null;
      }
      saveMeta(this.meta);
      return this.active();
    },

    signOut() {
      this.meta.activeId = null;
      saveMeta(this.meta);
    },

    loadState(defaults) {
      const key = this.storageKey();
      try {
        let raw = localStorage.getItem(key);

        // Guest / first launch: use legacy blob if present.
        if (!raw && !this.active()) {
          const legacy = readLegacyState();
          if (legacy) return legacy;
        }

        if (!raw) return structuredClone(defaults);
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return structuredClone(defaults);
        return parsed;
      } catch {
        return structuredClone(defaults);
      }
    },

    saveState(state) {
      localStorage.setItem(this.storageKey(), JSON.stringify(state));
      // Keep a guest/legacy mirror when signed out so old code paths stay safe.
      if (!this.active()) {
        localStorage.setItem(LEGACY_KEYS[0], JSON.stringify(state));
      }
    },

    /** One-tap migrate: turn current guest data into a named account. */
    claimGuest(name) {
      const legacy = readLegacyState();
      const account = this.create(name);
      if (legacy) {
        localStorage.setItem(stateKey(account.id), JSON.stringify(legacy));
      }
      return account;
    },

    exportSyncCode(state) {
      const account = this.active();
      const payload = {
        v: 1,
        app: "still",
        account: account ? { name: account.name, color: account.color } : null,
        state,
        at: new Date().toISOString(),
      };
      const json = JSON.stringify(payload);
      return btoa(unescape(encodeURIComponent(json)));
    },

    importSyncCode(code) {
      const json = decodeURIComponent(escape(atob(String(code || "").trim())));
      const payload = JSON.parse(json);
      if (!payload || payload.app !== "still" || !payload.state) {
        throw new Error("Invalid sync code");
      }
      return payload;
    },

    ensureWelcomeNeeded() {
      return this.meta.accounts.length === 0 && !this.meta.activeId;
    },
  };

  window.StillAuth = api;
})();
