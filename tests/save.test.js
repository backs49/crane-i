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

console.log("save.test.js ok");
