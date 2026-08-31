const Save = {
  KEY: "molang-crane:v1",

  emptyDaily(dayKey) {
    return { date: dayKey || "", missionCount: 0, missionDone: false, loginBonus: false };
  },

  touchDaily(data, dayKey) {
    const isNewDay = !data.daily || data.daily.date !== dayKey;
    const daily = isNewDay ? this.emptyDaily(dayKey) : data.daily;
    return { data: Object.assign({}, data, { daily }), isNewDay };
  },

  noteMissionCatch(data) {
    const daily = Object.assign({}, data.daily, { missionCount: (data.daily.missionCount || 0) + 1 });
    return Object.assign({}, data, { daily });
  },

  completeMission(data) {
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { missionDone: true }) });
  },

  grantLogin(data) {
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { loginBonus: true }) });
  },

  defaults(typeKeys) {
    const dexCounts = Object.create(null);
    for (const t of typeKeys) dexCounts[t] = 0;
    return { v: 1, bestScore: 0, totalPrizes: 0, totalPlays: 0, dexCounts, daily: this.emptyDaily(""), moonUnlocked: false };
  },

  normalize(raw, typeKeys) {
    const base = this.defaults(typeKeys);
    if (!raw || typeof raw !== "object") return base;
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    const out = {
      v: 1,
      bestScore: num(raw.bestScore),
      totalPrizes: num(raw.totalPrizes),
      totalPlays: num(raw.totalPlays),
      dexCounts: Object.assign(Object.create(null), base.dexCounts),
      daily: this.emptyDaily(""),
      moonUnlocked: !!raw.moonUnlocked,
    };
    if (raw.dexCounts && typeof raw.dexCounts === "object") {
      for (const t of typeKeys) out.dexCounts[t] = num(raw.dexCounts[t]);
    }
    if (raw.daily && typeof raw.daily === "object") {
      out.daily = {
        date: typeof raw.daily.date === "string" ? raw.daily.date : "",
        missionCount: num(raw.daily.missionCount),
        missionDone: !!raw.daily.missionDone,
        loginBonus: !!raw.daily.loginBonus,
      };
    }
    return out;
  },

  merge(a, b) {
    const dexCounts = Object.assign(Object.create(null), a.dexCounts);
    for (const k of Object.keys(b.dexCounts || {})) {
      dexCounts[k] = Math.max(dexCounts[k] || 0, b.dexCounts[k] || 0);
    }
    let daily;
    if (a.daily.date === b.daily.date) {
      daily = {
        date: a.daily.date,
        missionCount: Math.max(a.daily.missionCount || 0, b.daily.missionCount || 0),
        missionDone: !!(a.daily.missionDone || b.daily.missionDone),
        loginBonus: !!(a.daily.loginBonus || b.daily.loginBonus),
      };
    } else {
      // date는 YYYY-MM-DD라 사전순 비교가 곧 시간순 비교
      daily = Object.assign({}, a.daily.date > b.daily.date ? a.daily : b.daily);
    }
    return {
      v: 1,
      bestScore: Math.max(a.bestScore || 0, b.bestScore || 0),
      totalPrizes: Math.max(a.totalPrizes || 0, b.totalPrizes || 0),
      totalPlays: Math.max(a.totalPlays || 0, b.totalPlays || 0),
      dexCounts,
      daily,
      moonUnlocked: !!(a.moonUnlocked || b.moonUnlocked),
    };
  },

  load(storage, typeKeys) {
    try {
      const raw = storage && storage.getItem ? JSON.parse(storage.getItem(this.KEY)) : null;
      return this.normalize(raw, typeKeys);
    } catch (_) {
      return this.defaults(typeKeys);
    }
  },

  store(storage, data) {
    try {
      if (!storage || !storage.setItem) return;
      let merged = data;
      try {
        // 다른 탭이 먼저 저장한 진행을 덮어쓰지 않도록 디스크 사본과 병합
        const disk = this.normalize(JSON.parse(storage.getItem(this.KEY)), Object.keys(data.dexCounts));
        merged = this.merge(disk, data);
      } catch (_) {
        merged = data;
      }
      storage.setItem(this.KEY, JSON.stringify(merged));
    } catch (_) {
      /* 저장 불가 환경(사파리 프라이빗 등)에서는 조용히 무시 */
    }
  },

  wipe(storage) {
    try {
      if (storage && storage.removeItem) storage.removeItem(this.KEY);
    } catch (_) {
      /* 저장 불가 환경에서는 조용히 무시 */
    }
  },

  recordCatch(data, type) {
    const dexCounts = Object.assign(Object.create(null), data.dexCounts);
    dexCounts[type] = (dexCounts[type] || 0) + 1;
    return Object.assign({}, data, { dexCounts, totalPrizes: (data.totalPrizes || 0) + 1 });
  },

  recordPlay(data) {
    return Object.assign({}, data, { totalPlays: (data.totalPlays || 0) + 1 });
  },

  recordGameOver(data, score) {
    const isBest = score > (data.bestScore || 0);
    const next = Object.assign({}, data, { bestScore: isBest ? score : data.bestScore || 0 });
    return { data: next, isBest };
  },

  dexUnique(data) {
    return Object.keys(data.dexCounts || {}).filter((k) => data.dexCounts[k] > 0).length;
  },

  dexComplete(data, keys) {
    return keys.every((k) => (data.dexCounts[k] || 0) > 0);
  },

  unlockMoon(data) {
    return Object.assign({}, data, { moonUnlocked: true });
  },
};

if (typeof module !== "undefined") module.exports = Save;
