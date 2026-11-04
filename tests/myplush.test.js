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
  assert.ok(MyPlush.EARS.includes(d.ears));
  assert.ok(MyPlush.COLORS.includes(d.color));
  assert.ok(MyPlush.PERSONAS.includes(d.persona));
  assert.strictEqual(MyPlush.normalize(null), null);
  assert.strictEqual(MyPlush.normalize("x"), null);
}

{
  // 이상한 값은 기본값으로, 이름은 정리해서 8자까지
  const n = MyPlush.normalize({
    ears: "wings",
    color: "red",
    eyes: "laser",
    cheeks: "yes",
    accessory: "sword",
    persona: "mystic",
    name: "  <뽀>\u0007송이 친구 길다란이름 ",
  });
  const d = MyPlush.defaults();
  assert.strictEqual(n.ears, d.ears);
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
    seen.add(r.ears + r.accessory);
  }
  assert.ok(seen.size > 10, "다양한 조합이 나와야 한다");
  assert.strictEqual(MyPlush.random(() => 0, "").name, MyPlush.defaults().name);
}

{
  // 다음/이전 보기 넘기기는 목록을 한 바퀴 돈다
  let s = MyPlush.defaults();
  for (let i = 0; i < MyPlush.EARS.length; i++) s = MyPlush.cycle(s, "ears", 1);
  assert.strictEqual(s.ears, MyPlush.defaults().ears);
  assert.strictEqual(MyPlush.cycle(MyPlush.defaults(), "ears", -1).ears, MyPlush.EARS.at(-1));
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
  assert.strictEqual(Save.normalize({ myPlush: { ears: "bad" } }, TYPES).myPlush.ears, "round");
  // 다른 탭이 아직 못 만든 상태여도 만든 인형이 사라지지 않는다
  assert.deepStrictEqual(Save.merge(made, d).myPlush, made.myPlush);
  assert.deepStrictEqual(Save.merge(d, made).myPlush, made.myPlush);
}

{
  // 만들기 화면과 내 인형 대사 문구가 모두 표에 있다
  const keys = ["maker.title", "maker.save", "maker.born", "mine.caught", "mine.inBox", "talk.mine.extra"];
  for (const e of MyPlush.EARS) keys.push(`maker.ears.${e}`);
  for (const e of MyPlush.EYES) keys.push(`maker.eyes.${e}`);
  for (const a of MyPlush.ACCESSORIES) keys.push(`maker.acc.${a}`, `talk.mine.thing.${a}`);
  for (const p of MyPlush.PERSONAS) keys.push(`persona.${p}`, `talk.${p}.greet.new`);
  for (const f of ["ears", "color", "eyes", "cheeks", "accessory", "persona"]) keys.push(`maker.row.${f}`);
  assert.deepStrictEqual(keys.filter((k) => !I18N.has(k)), []);
  assert.strictEqual(I18N.t("mine.caught", { name: "콩이", points: 240 }), "내 인형 콩이를 데려왔어요! +240");
  assert.strictEqual(I18N.t("maker.born", { name: "몰랑" }), "몰랑이 태어났어요! 뽑기 기계에도 놀러 와요");
}

console.log("myplush.test.js ok");
