const assert = require("assert");
const MyPlush = require("../js/myplush.js");
const Save = require("../js/save.js");
const Fun = require("../js/fun.js");
const I18N = require("../js/i18n.js");
require("../js/lang/ko.js");

const TYPES = ["bear", "bunny", "mine"];

{
  // 기본값은 모든 목록 안의 값이고, 검사 후에도 그대로다
  const d = MyPlush.defaults();
  assert.deepStrictEqual(MyPlush.normalize(d), d);
  assert.ok(MyPlush.animalIds().includes(d.animal));
  assert.ok(MyPlush.COLORS.includes(d.color));
  assert.ok(MyPlush.PERSONAS.includes(d.persona));
  assert.strictEqual(MyPlush.normalize(null), null);
  assert.strictEqual(MyPlush.normalize("x"), null);
}

{
  // 이상한 값은 기본값으로, 이름은 정리해서 8자까지
  const n = MyPlush.normalize({
    animal: "dragon",
    color: "red",
    eyes: "laser",
    cheeks: "yes",
    accessory: "sword",
    persona: "mystic",
    name: "  <뽀>\u0007송이 친구 길다란이름 ",
  });
  const d = MyPlush.defaults();
  assert.strictEqual(n.animal, d.animal);
  assert.strictEqual(n.color, d.color);
  assert.strictEqual(n.eyes, d.eyes);
  assert.strictEqual(n.cheeks, d.cheeks);
  assert.strictEqual(n.accessory, d.accessory);
  assert.strictEqual(n.persona, d.persona, "달토끼 전용 성격은 고를 수 없다");
  assert.strictEqual(n.name, "뽀송이 친구 길");
  assert.strictEqual(MyPlush.normalize({ name: "   " }).name, d.name);
}

{
  // 아무거나: 항상 올바른 조합이고, 입력한 이름은 지킨다
  const rng = Fun.seededRng("dice");
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const r = MyPlush.random(rng, "콩이");
    assert.deepStrictEqual(MyPlush.normalize(r), r);
    assert.strictEqual(r.name, "콩이");
    seen.add(r.animal + r.accessory);
  }
  assert.ok(seen.size > 10, "다양한 조합이 나와야 한다");
  assert.strictEqual(MyPlush.random(() => 0, "").name, MyPlush.defaults().name);
}

{
  // 다음/이전 보기 넘기기는 목록을 한 바퀴 돈다
  let s = MyPlush.defaults();
  const ids = MyPlush.animalIds();
  for (let i = 0; i < ids.length; i++) s = MyPlush.cycle(s, "animal", 1);
  assert.strictEqual(s.animal, MyPlush.defaults().animal);
  assert.strictEqual(MyPlush.cycle(MyPlush.defaults(), "animal", -1).animal, ids.at(-1));
  assert.strictEqual(MyPlush.cycle(MyPlush.defaults(), "cheeks", 1).cheeks, false);
  assert.deepStrictEqual(MyPlush.cycle(s, "nope", 1), s);
}

{
  // 저장: 기본은 없음, 만들면 저장·정리되고, 방에서 붙인 이름은 지워진다
  const d = Save.defaults(TYPES);
  assert.strictEqual(d.myPlush, null);
  const withRoomName = Save.setRoom(d, { mine: { x: 10, y: 20, name: "옛이름", pets: 3 } });
  const made = Save.setMyPlush(withRoomName, Object.assign(MyPlush.defaults(), { name: "콩이", color: "#7ec8ff" }));
  assert.strictEqual(made.myPlush.name, "콩이");
  assert.strictEqual(made.myPlush.color, "#7ec8ff");
  assert.deepStrictEqual(made.room.mine, { x: 10, y: 20, pets: 3 });
  assert.strictEqual(withRoomName.room.mine.name, "옛이름", "원본은 그대로");
  const loaded = Save.normalize(JSON.parse(JSON.stringify(made)), TYPES);
  assert.deepStrictEqual(loaded.myPlush, made.myPlush);
  assert.strictEqual(Save.normalize({ myPlush: { animal: "bad" } }, TYPES).myPlush.animal, "bear");
  // 예전 저장 데이터(귀 선택)는 같은 동물로 옮겨진다
  assert.strictEqual(Save.normalize({ myPlush: { ears: "long" } }, TYPES).myPlush.animal, "bunny");
  assert.strictEqual(Save.normalize({ myPlush: { ears: "pointy" } }, TYPES).myPlush.animal, "cat");
  assert.strictEqual(Save.normalize({ myPlush: { ears: "none" } }, TYPES).myPlush.animal, "blob");
  assert.strictEqual(Save.normalize({ myPlush: { ears: "long" } }, TYPES).myPlush.ears, undefined);
  // 예전 색은 그대로 쓸 수 있다
  for (const old of ["#ffb3c7", "#fff0e0", "#ffb37a", "#ffe36a", "#7de3b0", "#7ec8ff", "#d7c2ff", "#e8b07a", "#c9c9d6"]) {
    assert.strictEqual(Save.normalize({ myPlush: { color: old } }, TYPES).myPlush.color, old);
  }
  // 다른 탭이 아직 못 만든 상태여도 만든 인형이 사라지지 않는다
  assert.deepStrictEqual(Save.merge(made, d).myPlush, made.myPlush);
  assert.deepStrictEqual(Save.merge(d, made).myPlush, made.myPlush);
}

{
  // 만들기 화면과 내 인형 대사 문구가 모두 표에 있다
  const keys = ["maker.title", "maker.save", "maker.born", "mine.caught", "mine.inBox", "talk.mine.extra"];
  for (const a of MyPlush.animalIds()) keys.push(`maker.animal.${a}`, `animal.${a}`);
  for (const e of MyPlush.EYES) keys.push(`maker.eyes.${e}`);
  for (const a of MyPlush.ACCESSORIES) keys.push(`maker.acc.${a}`, `talk.mine.thing.${a}`);
  for (const p of MyPlush.PERSONAS) keys.push(`persona.${p}`, `talk.${p}.greet.new`);
  for (const f of ["animal", "color", "eyes", "cheeks", "accessory", "persona"]) keys.push(`maker.row.${f}`);
  assert.deepStrictEqual(keys.filter((k) => !I18N.has(k)), []);
  assert.strictEqual(I18N.t("mine.caught", { name: "콩이", points: 240 }), "내 인형 콩이를 데려왔어요! +240");
  assert.strictEqual(I18N.t("maker.born", { name: "몰랑" }), "몰랑이 태어났어요! 뽑기 기계에도 놀러 와요");
}

{
  // 동물: 스무 가지 이상, 모두 그리는 방법과 대표 색(팔레트 안)이 있다
  const ids = MyPlush.animalIds();
  assert.ok(ids.length >= 20);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const a of MyPlush.ANIMALS) {
    assert.ok(MyPlush.PARTS[a.id], a.id);
    assert.ok(MyPlush.COLORS.includes(a.color), a.id);
  }
  assert.strictEqual(MyPlush.animalColor("fox"), "#ff9a4a");
  assert.strictEqual(MyPlush.animalColor("nope"), MyPlush.COLORS[0]);
}

console.log("myplush.test.js ok");
