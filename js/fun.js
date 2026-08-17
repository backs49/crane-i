const Fun = {
  CONVERT_AT: 3,
  STREAK_BONUS_PER: 0.06,
  STREAK_BONUS_MAX: 0.18,

  emptyCollection(types) {
    const counts = Object.create(null);
    for (const t of types) counts[t] = 0;
    return { counts };
  },

  typeCount(col, type) {
    return (col.counts && col.counts[type]) || 0;
  },

  uniqueCount(col) {
    return Object.keys(col.counts || {}).filter((k) => col.counts[k] > 0).length;
  },

  recordCatch(col, type) {
    const counts = Object.assign(Object.create(null), col.counts);
    counts[type] = (counts[type] || 0) + 1;
    return { counts };
  },

  collectionProgress(col, types) {
    return { caught: this.uniqueCount(col), total: types.length };
  },

  emptyConsolation() {
    return { scraps: 0, converts: 0, boost: 0 };
  },

  awardSlip(bag) {
    const scraps = bag.scraps + 1;
    const converts = bag.converts || 0;
    let boost = bag.boost || 0;
    if (scraps < this.CONVERT_AT) {
      return { scraps, converts, boost, reward: null };
    }
    const reward = converts % 2 === 0 ? "coin" : "boost";
    if (reward === "boost") boost = this.STREAK_BONUS_PER;
    return { scraps: scraps - this.CONVERT_AT, converts: converts + 1, boost, reward };
  },

  pendingBoost(bag) {
    return bag.boost || 0;
  },

  consumeBoost(bag) {
    return { scraps: bag.scraps, converts: bag.converts || 0, boost: 0 };
  },

  emptyStreak() {
    return { slips: 0, catches: 0 };
  },

  noteSlip(streak) {
    return { slips: streak.slips + 1, catches: 0 };
  },

  noteCatch(streak) {
    return { slips: 0, catches: streak.catches + 1 };
  },

  clawBonus(streak) {
    return Math.min(this.STREAK_BONUS_MAX, (streak.slips || 0) * this.STREAK_BONUS_PER);
  },

  juiceScale(streak) {
    return 1 + (streak.catches || 0) * 0.35;
  },

  pickMission(typeKeys, rng = Math.random) {
    const type = typeKeys[Math.floor(rng() * typeKeys.length) % typeKeys.length];
    const need = rng() < 0.45 ? 2 : 1;
    const names = typeof PLUSH_TYPES !== "undefined" && PLUSH_TYPES[type] ? PLUSH_TYPES[type].name : type;
    return { type, need, label: `${names} ${need}마리` };
  },

  missionCaught(mission, col) {
    return this.typeCount(col, mission.type);
  },

  missionComplete(mission, col) {
    return this.missionCaught(mission, col) >= mission.need;
  },
};

if (typeof module !== "undefined") module.exports = Fun;
