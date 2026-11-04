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

{
  // 숨을 곳: 나무·덤불·미끄럼틀이 서로 겹치지 않고, 누른 자리로 찾을 수 있다
  const spots = Village.spots();
  assert.strictEqual(spots.length, 6);
  for (const sp of spots) assert.strictEqual(Village.spotAt(sp.x, sp.y).id, sp.id);
  assert.strictEqual(Village.spotAt(180, 150), null);
  for (const b of Village.BUSHES) assert.ok(!Village.walkable(b.x, b.y), "덤불은 지나갈 수 없다");
  assert.ok(!Village.walkable(Village.TREE.x, Village.TREE.y));

  // 숨바꼭질: 틀리면 횟수가 늘고, 두 번 틀리면 힌트, 맞히면 끝
  const walkers = [{ type: "bear" }, { type: "cat" }];
  const game = Village.hideStart(walkers, () => 0);
  assert.strictEqual(game.hider, "bear");
  assert.strictEqual(game.spot, spots[0].id);
  const far = spots.find((sp) => Math.hypot(sp.x - spots[0].x, sp.y - spots[0].y) >= 130);
  const g1 = Village.hideGuess(game, far.id);
  assert.strictEqual(g1.result, "miss");
  assert.strictEqual(Village.hideHint(g1.game), false);
  const near = spots.find((sp) => sp.id !== spots[0].id && Math.hypot(sp.x - spots[0].x, sp.y - spots[0].y) < 130);
  if (near) assert.strictEqual(Village.hideGuess(g1.game, near.id).result, "near");
  const g2 = Village.hideGuess(g1.game, far.id);
  assert.strictEqual(Village.hideHint(g2.game), true);
  const g3 = Village.hideGuess(g2.game, game.spot);
  assert.strictEqual(g3.result, "found");
  assert.strictEqual(Village.hideHint(g3.game), false);
  assert.strictEqual(Village.hideGuess(g3.game, far.id).result, "done");
  assert.strictEqual(Village.hideStart([], Math.random), null);
}

{
  // 피크닉: 좋아하는 간식은 하트 2, 아니면 1, 세 번 먹으면 배불러서 그만
  assert.strictEqual(Village.favorite("shy"), "carrot");
  let eaten = {};
  let r = Village.feed(eaten, "bunny", "carrot");
  assert.deepStrictEqual([r.result, r.hearts], ["love", 2]);
  r = Village.feed(r.eaten, "bunny", "fish");
  assert.deepStrictEqual([r.result, r.hearts], ["like", 1]);
  r = Village.feed(r.eaten, "bunny", "carrot");
  r = Village.feed(r.eaten, "bunny", "carrot");
  assert.deepStrictEqual([r.result, r.hearts], ["full", 0]);
  assert.strictEqual(Village.feed({}, "pig", "fish").result, "love", "먹보는 뭐든 좋아한다");
  for (const sn of Village.SNACKS) assert.ok(I18N.has(`snack.${sn.id}`));
  for (const p of new Set(Object.values(Village.PERSONA))) {
    const fav = Village.favorite(p);
    assert.ok(fav === "*" || Village.SNACKS.some((sn) => sn.id === fav), p);
    assert.ok(I18N.has(`talk.${p}.found`), p);
  }
  for (const k of ["picnic.love", "picnic.like", "picnic.full", "hide.start", "hide.miss", "hide.near", "hide.hint"]) assert.ok(I18N.has(k), k);

  // 자리: 친구 수만큼, 화면 안에
  const seats = Village.seats(14);
  assert.strictEqual(seats.length, 14);
  for (const st of seats) assert.ok(st.x > 0 && st.x < Village.W && st.y > Village.HORIZON && st.y < Village.H);
}

{
  // 내 인형 걷기: 누른 곳(장애물이면 가장 가까운 빈자리)으로 걸어가 도착한다
  const rng = Fun.seededRng("walk");
  const [w] = Village.spawn([{ type: "mine", name: "콩이" }], rng);
  assert.ok(Village.goTo(w, Village.TREE.x, Village.TREE.y));
  assert.ok(Village.walkable(w.tx, w.ty));
  const target = w.path[w.path.length - 1];
  for (let i = 0; i < 3000 && !(w.wait > 0 && !w.manual); i++) Village.step([w], 1 / 30, rng);
  assert.ok(Math.hypot(w.x - target.x, w.y - target.y) <= 2, "도착해야 한다");
  assert.ok(w.wait >= 4, "도착하면 잠시 그 자리에 머문다");
}

{
  // 길 찾기: 아무 곳이나 눌러도 (갈 수 있는 곳이면) 도착한다
  const rng = Fun.seededRng("paths");
  let reached = 0;
  for (let k = 0; k < 120; k++) {
    const [w] = Village.spawn([{ type: "mine", name: "x" }], rng);
    w.wait = 0;
    assert.ok(Village.goTo(w, rng() * Village.W, Village.HORIZON + 40 + rng() * 320));
    const t = w.path[w.path.length - 1];
    for (let i = 0; i < 4000 && !(w.wait > 0 && !w.manual); i++) Village.step([w], 1 / 30, rng);
    if (Math.hypot(w.x - t.x, w.y - t.y) <= 2) reached++;
  }
  assert.strictEqual(reached, 120);
}

console.log("village.test.js ok");
