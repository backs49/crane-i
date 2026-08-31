const Save = {
  KEY: "molang-crane:v1",

  defaults(typeKeys) {
    const dexCounts = Object.create(null);
    for (const t of typeKeys) dexCounts[t] = 0;
    return { v: 1, bestScore: 0, totalPrizes: 0, totalPlays: 0, dexCounts };
  },

  normalize(raw, typeKeys) {
    const base = this.defaults(typeKeys);
    if (!raw || typeof raw !== "object") return base;
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    const out = Object.assign({}, base, raw);
    out.v = 1;
    out.bestScore = num(raw.bestScore);
    out.totalPrizes = num(raw.totalPrizes);
    out.totalPlays = num(raw.totalPlays);
    out.dexCounts = Object.assign(Object.create(null), base.dexCounts);
    if (raw.dexCounts && typeof raw.dexCounts === "object") {
      for (const t of typeKeys) out.dexCounts[t] = num(raw.dexCounts[t]);
    }
    return out;
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
      if (storage && storage.setItem) storage.setItem(this.KEY, JSON.stringify(data));
    } catch (_) {
      /* 저장 불가 환경(사파리 프라이빗 등)에서는 조용히 무시 */
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
};

if (typeof module !== "undefined") module.exports = Save;
