const assert = require("assert");
const I18N = require("../js/i18n.js");
require("../js/lang/ko.js");
global.I18N = I18N;
const Village = require("../js/village.js");
const Fun = require("../js/fun.js");

const TYPES = ["bear", "bunny", "cat", "chick", "frog", "penguin", "pig", "puppy", "panda", "berry", "unicorn", "star", "moonbunny"];

{
  // 문구 표: 언어 고르기, 빈 키 대신 키 이름, 변수 채우기, 받침에 맞는 조사
  assert.strictEqual(I18N.detect(["ja-JP", "ko-KR"]), "ko");
  assert.strictEqual(I18N.detect(["fr"]), "ko");
  assert.strictEqual(I18N.setLang("xx"), "ko");
  assert.strictEqual(I18N.t("no.such.key"), "no.such.key");
  assert.strictEqual(I18N.t("village.friends", { n: 3 }), "몰랑 마을 · 친구 3");
  assert.strictEqual(I18N.format("{name|이야/야}", { name: "토끼" }), "토끼야");
  assert.strictEqual(I18N.format("{name|이야/야}", { name: "곰돌" }), "곰돌이야");
  assert.strictEqual(I18N.format("{name|과/와}", { name: "Momo" }), "Momo와");
  assert.strictEqual(I18N.format("{name|과/와}", {}), "{name|과/와}");
  assert.strictEqual(I18N.pick("talk.time.night", {}, () => 0.99), "달님이 우리를 보고 있어.");
}

{
  // 모든 인형이 성격을 갖고, 모든 성격의 대사가 표에 빠짐없이 있다
  const keys = [];
  for (const type of TYPES) {
    const p = Village.persona(type);
    keys.push(`persona.${p}`);
    for (const mood of ["new", "friend", "best"]) keys.push(`talk.${p}.greet.${mood}`);
    for (const c of Village.CHOICES) keys.push(`talk.${p}.${c.id}`, `village.choice.${c.id}`);
  }
  for (const tod of ["morning", "day", "evening", "night"]) keys.push(`talk.time.${tod}`);
  const missing = keys.filter((k) => !I18N.has(k));
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(new Set(TYPES.map((t) => Village.persona(t))).size, TYPES.length);
}

{
  // 시간대와 관계 단계
  assert.strictEqual(Village.timeOfDay(7), "morning");
  assert.strictEqual(Village.timeOfDay(13), "day");
  assert.strictEqual(Village.timeOfDay(18), "evening");
  assert.strictEqual(Village.timeOfDay(23), "night");
  assert.strictEqual(Village.timeOfDay(3), "night");
  assert.strictEqual(Village.mood(0), "new");
  assert.strictEqual(Village.mood(2), "friend");
  assert.strictEqual(Village.mood(5), "best");
}

{
  // 첫마디: 부탁 대상이면 부탁 대사, 아니면 성격·관계 대사 (이름이 들어간다)
  const p = { type: "bunny", name: "솜사탕" };
  const always = (v) => () => v;
  assert.strictEqual(Village.greet(p, { hour: 13, missionType: "bunny", hearts: 0 }, always(0)), I18N.t("talk.mission"));
  const g = Village.greet(p, { hour: 13, missionType: "bear", hearts: 0 }, always(0.5));
  assert.ok(I18N.raw("talk.shy.greet.new").map((x) => I18N.format(x, { name: "솜사탕" })).includes(g));
  assert.strictEqual(Village.greet(p, { hour: 13, hearts: 0 }, always(0.4)), "아, 안녕… 나 솜사탕이야.");
  const best = Village.greet(p, { hour: 13, hearts: 4 }, always(0.5));
  assert.ok(I18N.raw("talk.shy.greet.best").includes(best));
  const r = Village.reply(p, "snack", always(0));
  assert.strictEqual(r, I18N.raw("talk.shy.snack")[0]);
  assert.strictEqual(Village.reply(p, "weird", always(0)), I18N.raw("talk.shy.hello")[0]);
}

{
  // 걷기: 연못·미끄럼틀·화면 밖으로 나가지 않고, 대화 중인 친구는 멈춘다
  const rng = Fun.seededRng("village");
  for (let i = 0; i < 300; i++) {
    const s = Village.randomSpot(rng);
    assert.ok(Village.walkable(s.x, s.y), `spot ${s.x},${s.y}`);
  }
  const walkers = Village.spawn(TYPES.map((t) => ({ type: t, name: t, pets: 0 })), rng);
  walkers[0].talking = true;
  const frozen = { x: walkers[0].x, y: walkers[0].y };
  for (let i = 0; i < 2000; i++) {
    Village.step(walkers, 1 / 30, rng);
    for (const w of walkers) assert.ok(Village.walkable(w.x, w.y), `${w.type} at ${w.x},${w.y}`);
  }
  assert.deepStrictEqual({ x: walkers[0].x, y: walkers[0].y }, frozen);
  assert.ok(walkers.slice(1).some((w) => w.walkT > 1), "others should walk");
  assert.strictEqual(Village.hit(walkers, walkers[3].x, walkers[3].y) !== null, true);
  assert.strictEqual(Village.hit(walkers, -100, -100), null);
}

console.log("village.test.js ok");
