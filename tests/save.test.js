const assert = require("assert");
const Save = require("../js/save.js");

const TYPES = ["bear", "bunny", "unicorn"];

{
  const d = Save.defaults(TYPES);
  assert.strictEqual(d.v, 1);
  assert.strictEqual(d.bestScore, 0);
  assert.strictEqual(d.totalPrizes, 0);
  assert.strictEqual(d.totalPlays, 0);
  assert.strictEqual(d.dexCounts.bear, 0);
  assert.strictEqual(d.dexCounts.unicorn, 0);
}

{
  assert.strictEqual(Save.load(null, TYPES).bestScore, 0);
  assert.strictEqual(Save.load(undefined, TYPES).totalPrizes, 0);
  const broken = { getItem() { return "{not json"; } };
  assert.strictEqual(Save.load(broken, TYPES).totalPlays, 0);
  const thrower = { getItem() { throw new Error("blocked"); } };
  assert.strictEqual(Save.load(thrower, TYPES).bestScore, 0);
  const partial = { getItem() { return JSON.stringify({ bestScore: 500, dexCounts: { bear: 2, ghost: 9 } }); } };
  const loaded = Save.load(partial, TYPES);
  assert.strictEqual(loaded.bestScore, 500);
  assert.strictEqual(loaded.dexCounts.bear, 2);
  assert.strictEqual(loaded.dexCounts.bunny, 0);
  assert.strictEqual(loaded.dexCounts.ghost, undefined);
}

{
  let d = Save.defaults(TYPES);
  const before = d;
  d = Save.recordCatch(d, "bear");
  d = Save.recordCatch(d, "bear");
  d = Save.recordCatch(d, "unicorn");
  assert.strictEqual(before.dexCounts.bear, 0);
  assert.strictEqual(d.dexCounts.bear, 2);
  assert.strictEqual(d.totalPrizes, 3);
  assert.strictEqual(Save.dexUnique(d), 2);
  d = Save.recordPlay(d);
  assert.strictEqual(d.totalPlays, 1);
}

{
  const d = Save.defaults(TYPES);
  const r1 = Save.recordGameOver(d, 300);
  assert.strictEqual(r1.isBest, true);
  assert.strictEqual(r1.data.bestScore, 300);
  const r2 = Save.recordGameOver(r1.data, 200);
  assert.strictEqual(r2.isBest, false);
  assert.strictEqual(r2.data.bestScore, 300);
  const r3 = Save.recordGameOver(d, 0);
  assert.strictEqual(r3.isBest, false);
}

{
  Save.store(null, Save.defaults(TYPES));
  const boom = { setItem() { throw new Error("quota"); } };
  Save.store(boom, Save.defaults(TYPES));
  const mem = {
    data: null,
    setItem(k, v) { assert.strictEqual(k, Save.KEY); this.data = v; },
    getItem(k) { assert.strictEqual(k, Save.KEY); return this.data; },
  };
  const d = Save.recordCatch(Save.defaults(TYPES), "bear");
  Save.store(mem, d);
  assert.strictEqual(Save.load(mem, TYPES).dexCounts.bear, 1);
}

{
  const d = Save.defaults(TYPES);
  assert.strictEqual(d.daily.date, "");
  assert.strictEqual(d.daily.missionCount, 0);
  const t1 = Save.touchDaily(d, "2026-08-31");
  assert.strictEqual(t1.isNewDay, true);
  assert.strictEqual(t1.data.daily.date, "2026-08-31");
  let cur = Save.grantLogin(t1.data);
  assert.strictEqual(cur.daily.loginBonus, true);
  cur = Save.noteMissionCatch(cur);
  cur = Save.noteMissionCatch(cur);
  assert.strictEqual(cur.daily.missionCount, 2);
  cur = Save.completeMission(cur);
  assert.strictEqual(cur.daily.missionDone, true);
  const same = Save.touchDaily(cur, "2026-08-31");
  assert.strictEqual(same.isNewDay, false);
  assert.strictEqual(same.data.daily.missionCount, 2);
  assert.strictEqual(same.data.daily.loginBonus, true);
  const next = Save.touchDaily(cur, "2026-09-01");
  assert.strictEqual(next.isNewDay, true);
  assert.strictEqual(next.data.daily.missionCount, 0);
  assert.strictEqual(next.data.daily.missionDone, false);
  assert.strictEqual(next.data.daily.loginBonus, false);
  const mem = { data: null, setItem(k, v) { this.data = v; }, getItem() { return this.data; } };
  Save.store(mem, cur);
  const back = Save.load(mem, TYPES);
  assert.strictEqual(back.daily.date, "2026-08-31");
  assert.strictEqual(back.daily.missionDone, true);
}

{
  let d = Save.defaults(TYPES);
  assert.strictEqual(d.moonUnlocked, false);
  assert.strictEqual(Save.dexComplete(d, TYPES), false);
  d = Save.recordCatch(d, "bear");
  d = Save.recordCatch(d, "bunny");
  assert.strictEqual(Save.dexComplete(d, TYPES), false);
  d = Save.recordCatch(d, "unicorn");
  assert.strictEqual(Save.dexComplete(d, TYPES), true);
  assert.strictEqual(Save.dexComplete(d, ["bear", "bunny"]), true);
  d = Save.unlockMoon(d);
  assert.strictEqual(d.moonUnlocked, true);
  const mem = { data: null, setItem(k, v) { this.data = v; }, getItem() { return this.data; } };
  Save.store(mem, d);
  assert.strictEqual(Save.load(mem, TYPES).moonUnlocked, true);
  const legacy = { getItem() { return JSON.stringify({ bestScore: 10 }); } };
  assert.strictEqual(Save.load(legacy, TYPES).moonUnlocked, false);
}

{
  const a = Object.assign({}, Save.defaults(TYPES), {
    bestScore: 300,
    totalPrizes: 5,
    totalPlays: 8,
    dexCounts: Object.assign(Object.create(null), { bear: 3, bunny: 0, unicorn: 1 }),
    daily: { date: "2026-08-30", missionCount: 4, missionDone: true, loginBonus: false },
    moonUnlocked: true,
  });
  const b = Object.assign({}, Save.defaults(TYPES), {
    bestScore: 200,
    totalPrizes: 9,
    totalPlays: 2,
    dexCounts: Object.assign(Object.create(null), { bear: 1, bunny: 2, unicorn: 0 }),
    daily: { date: "2026-08-31", missionCount: 1, missionDone: false, loginBonus: true },
    moonUnlocked: false,
  });
  const m = Save.merge(a, b);
  assert.strictEqual(m.bestScore, 300);
  assert.strictEqual(m.totalPrizes, 9);
  assert.strictEqual(m.totalPlays, 8);
  assert.strictEqual(m.dexCounts.bear, 3);
  assert.strictEqual(m.dexCounts.bunny, 2);
  assert.strictEqual(m.dexCounts.unicorn, 1);
  assert.strictEqual(m.moonUnlocked, true);
  assert.strictEqual(m.daily.date, "2026-08-31");
  assert.strictEqual(m.daily.missionCount, 1);
  assert.strictEqual(m.daily.missionDone, false);
  assert.strictEqual(m.daily.loginBonus, true);
  assert.notStrictEqual(m, a);
  assert.notStrictEqual(m, b);
  assert.strictEqual(a.bestScore, 300);
  assert.strictEqual(b.daily.missionCount, 1);
  const sameDay = Object.assign({}, a, {
    daily: { date: "2026-08-31", missionCount: 4, missionDone: true, loginBonus: false },
  });
  const m2 = Save.merge(sameDay, b);
  assert.strictEqual(m2.daily.date, "2026-08-31");
  assert.strictEqual(m2.daily.missionCount, 4);
  assert.strictEqual(m2.daily.missionDone, true);
  assert.strictEqual(m2.daily.loginBonus, true);
}

{
  const mem = { data: null, setItem(k, v) { this.data = v; }, getItem() { return this.data; } };
  let a = Save.recordCatch(Save.defaults(TYPES), "bear");
  a = Save.recordGameOver(a, 400).data;
  Save.store(mem, a);
  const b = Save.recordGameOver(Save.defaults(TYPES), 100).data;
  Save.store(mem, b);
  const loaded = Save.load(mem, TYPES);
  assert.strictEqual(loaded.bestScore, 400);
  assert.strictEqual(loaded.dexCounts.bear, 1);
}

{
  const mem = {
    data: null,
    setItem(k, v) { this.data = v; },
    getItem() { return this.data; },
    removeItem(k) { assert.strictEqual(k, Save.KEY); this.data = null; },
  };
  Save.store(mem, Save.recordCatch(Save.defaults(TYPES), "bear"));
  Save.wipe(mem);
  const loaded = Save.load(mem, TYPES);
  assert.strictEqual(loaded.bestScore, 0);
  assert.strictEqual(loaded.dexCounts.bear, 0);
  Save.wipe(null);
  Save.wipe({ removeItem() { throw new Error("blocked"); } });
}

{
  const hacked = { getItem() { return JSON.stringify({ hacked: true, bestScore: 5 }); } };
  const loaded = Save.load(hacked, TYPES);
  assert.strictEqual(loaded.hacked, undefined);
  assert.strictEqual(loaded.bestScore, 5);
}

console.log("save.test.js ok");
