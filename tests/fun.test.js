const assert = require("assert");
const Fun = require("../js/fun.js");
const Grip = require("../js/grip.js");

const TYPES = ["bear", "bunny", "unicorn"];

function collection() {
  return Fun.emptyCollection(TYPES);
}

{
  const col = collection();
  assert.strictEqual(Fun.uniqueCount(col), 0);
  assert.strictEqual(Fun.typeCount(col, "bear"), 0);
  const after = Fun.recordCatch(col, "bear");
  assert.strictEqual(Fun.typeCount(after, "bear"), Fun.typeCount(col, "bear") + 1);
  assert.strictEqual(Fun.uniqueCount(after), 1);
  const twice = Fun.recordCatch(after, "bear");
  assert.strictEqual(Fun.uniqueCount(twice), 1);
  assert.strictEqual(Fun.typeCount(twice, "bear"), Fun.typeCount(after, "bear") + 1);
  const other = Fun.recordCatch(twice, "unicorn");
  assert.strictEqual(Fun.uniqueCount(other), 2);
  const progress = Fun.collectionProgress(other, TYPES);
  assert.strictEqual(progress.caught, Fun.uniqueCount(other));
  assert.strictEqual(progress.total, TYPES.length);
}

{
  let bag = Fun.emptyConsolation();
  assert.strictEqual(bag.scraps, 0);
  const first = Fun.awardSlip(bag);
  assert.strictEqual(first.scraps, bag.scraps + 1);
  assert.strictEqual(first.reward, null);
  let next = first;
  let conversions = 0;
  const seen = new Set();
  for (let i = 0; i < Fun.CONVERT_AT * 4; i++) {
    next = Fun.awardSlip(next);
    if (next.reward) {
      conversions += 1;
      seen.add(next.reward);
      assert.ok(next.reward === "coin" || next.reward === "boost");
      assert.ok(next.scraps < Fun.CONVERT_AT);
    }
  }
  assert.ok(conversions >= 3);
  assert.ok(seen.has("coin") && seen.has("boost"));
  const boosted = Fun.awardSlip({ scraps: Fun.CONVERT_AT - 1, converts: 1 });
  assert.strictEqual(boosted.reward, "boost");
  assert.ok(Fun.pendingBoost(boosted) > 0);
  const afterUse = Fun.consumeBoost(boosted);
  assert.strictEqual(Fun.pendingBoost(afterUse), 0);
}

{
  let streak = Fun.emptyStreak();
  assert.strictEqual(Fun.clawBonus(streak), 0);
  const one = Fun.noteSlip(streak);
  const two = Fun.noteSlip(one);
  assert.ok(Fun.clawBonus(two) > Fun.clawBonus(one));
  assert.ok(Fun.clawBonus(one) > Fun.clawBonus(streak));
  const many = Fun.noteSlip(Fun.noteSlip(Fun.noteSlip(Fun.noteSlip(two))));
  assert.ok(Fun.clawBonus(many) <= Fun.STREAK_BONUS_MAX);
  assert.strictEqual(Fun.clawBonus(many), Fun.STREAK_BONUS_MAX);
  const caught = Fun.noteCatch(two);
  assert.strictEqual(caught.slips, 0);
  assert.ok(caught.catches > 0);
  assert.ok(Fun.juiceScale(caught) > Fun.juiceScale(Fun.emptyStreak()));
  const more = Fun.noteCatch(caught);
  assert.ok(Fun.juiceScale(more) > Fun.juiceScale(caught));
}

{
  const keys = Object.keys({ bear: 1, bunny: 1, unicorn: 1 });
  const seq = [0, 0.8, 0.99, 0.1];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  const mission = Fun.pickMission(keys, rng);
  assert.ok(keys.includes(mission.type));
  assert.ok(mission.need === 1 || mission.need === 2);
  assert.ok(String(mission.label).includes(String(mission.need)));
  let col = collection();
  assert.strictEqual(Fun.missionComplete(mission, col), false);
  for (let n = 0; n < mission.need; n++) col = Fun.recordCatch(col, mission.type);
  assert.strictEqual(Fun.missionComplete(mission, col), true);
  assert.ok(Fun.missionCaught(mission, col) >= mission.need);
}

{
  const base = { coverage: 1, crowded: false, radius: 24, points: 100, x: 210, y: 220 };
  const streak = Fun.noteSlip(Fun.noteSlip(Fun.emptyStreak()));
  const bonus = Fun.clawBonus(streak);
  const plain = Grip.winChance(base);
  const boosted = Grip.winChance({ ...base, bonus });
  assert.ok(bonus > 0);
  assert.ok(boosted > plain);
  assert.ok(boosted - plain <= bonus + 1e-9);
}

{
  assert.strictEqual(Fun.dayKey(new Date(2026, 7, 31)), "2026-08-31");
  assert.strictEqual(Fun.dayKey(new Date(2026, 0, 5)), "2026-01-05");
  const r1 = Fun.seededRng("mission:2026-08-31");
  const r2 = Fun.seededRng("mission:2026-08-31");
  for (let i = 0; i < 5; i++) assert.strictEqual(r1(), r2());
  const v = Fun.seededRng("a")();
  assert.ok(v >= 0 && v < 1);
  assert.notStrictEqual(Fun.seededRng("a")(), Fun.seededRng("b")());
  const keys = ["bear", "bunny", "unicorn"];
  const m1 = Fun.dailyMission(keys, "2026-08-31");
  const m2 = Fun.dailyMission(keys, "2026-08-31");
  assert.deepStrictEqual(m1, m2);
  assert.ok(keys.includes(m1.type));
  assert.ok(m1.need === 1 || m1.need === 2);
}

{
  const base = { coverage: 0.6, crowded: false, radius: 24, points: 100, x: 210, y: 200 };
  const alwaysLose = () => 0.999;
  assert.strictEqual(Grip.PITY_AT, 4);
  assert.notStrictEqual(Grip.roll({ ...base, pity: 0 }, alwaysLose).kind, "hold");
  assert.notStrictEqual(Grip.roll({ ...base, pity: 3 }, alwaysLose).kind, "hold");
  const saved = Grip.roll({ ...base, pity: 4 }, alwaysLose);
  assert.strictEqual(saved.kind, "hold");
  assert.strictEqual(saved.pity, true);
  assert.strictEqual(Grip.roll({ ...base, pity: 9 }, alwaysLose).kind, "hold");
  assert.notStrictEqual(Grip.roll({ ...base, coverage: 0.25, pity: 9 }, alwaysLose).kind, "hold");
  assert.strictEqual(Grip.roll({ ...base, coverage: 0.1, pity: 9 }, alwaysLose).kind, "miss");
  const seq = [0.5, 0.5, 0.5];
  let i = 0;
  const rngA = () => seq[i++ % seq.length];
  i = 0;
  const withoutPity = Grip.roll({ ...base }, rngA);
  i = 0;
  const withZeroPity = Grip.roll({ ...base, pity: 0 }, rngA);
  assert.strictEqual(withoutPity.kind, withZeroPity.kind);
}

console.log("fun.test.js ok");
