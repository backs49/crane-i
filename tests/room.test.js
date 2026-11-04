const assert = require("assert");
const Room = require("../js/room.js");
const Save = require("../js/save.js");
const Fun = require("../js/fun.js");

const TYPES = ["bear", "bunny", "cat", "unicorn"];
const NAMES = { bear: "곰돌이", bunny: "토끼", cat: "고양이", unicorn: "유니콘" };

{
  // 잡은 종류만 방에 살고, 저장된 위치가 없으면 기본 자리에 선다
  const dex = { bear: 2, bunny: 0, cat: 1, unicorn: 0 };
  const list = Room.residents(dex, {}, TYPES, NAMES);
  assert.deepStrictEqual(list.map((p) => p.type), ["bear", "cat"]);
  assert.deepStrictEqual({ x: list[0].x, y: list[0].y }, Room.slot(0));
  assert.deepStrictEqual({ x: list[1].x, y: list[1].y }, Room.slot(1));
  assert.strictEqual(list[0].name, "곰돌이");
  assert.strictEqual(list[0].pets, 0);
  assert.deepStrictEqual(Room.residents({}, {}, TYPES, NAMES), []);
}

{
  // 옮기기는 방 안으로 고정되고 원본을 바꾸지 않는다
  const room = {};
  const moved = Room.move(room, "bear", 9999, -50);
  assert.deepStrictEqual(room, {});
  assert.ok(moved.bear.x <= Room.W - Room.RADIUS);
  assert.strictEqual(moved.bear.y, Room.FLOOR_TOP);
  const list = Room.residents({ bear: 1 }, Room.move({}, "bear", 120, 300), TYPES, NAMES);
  assert.deepStrictEqual({ x: list[0].x, y: list[0].y }, { x: 120, y: 300 });
}

{
  // 이름은 8자로 자르고, 위험 문자를 지우고, 빈 이름이면 기본 이름으로 돌아간다
  const named = Room.rename({}, "bear", "  <몰랑>\n친구 길다란이름  ");
  assert.strictEqual(named.bear.name, "몰랑친구 길다란");
  assert.strictEqual(Array.from(named.bear.name).length, 8);
  const cleared = Room.rename(named, "bear", "   ");
  assert.strictEqual(cleared.bear.name, undefined);
  assert.strictEqual(Room.residents({ bear: 1 }, cleared, TYPES, NAMES)[0].name, "곰돌이");
}

{
  // 다섯 번 쓰다듬을 때마다 하트 하나, 최대 다섯 개
  let room = {};
  for (let i = 0; i < 4; i++) room = Room.pet(room, "cat");
  assert.strictEqual(room.cat.pets, 4);
  assert.strictEqual(Room.hearts(room.cat.pets), 0);
  room = Room.pet(room, "cat");
  assert.strictEqual(Room.hearts(room.cat.pets), 1);
  assert.strictEqual(Room.hearts(1000), Room.HEARTS_MAX);
}

{
  // 맨 위(나중에 그려진) 인형이 먼저 잡힌다
  const list = [
    { type: "bear", x: 100, y: 200 },
    { type: "cat", x: 110, y: 205 },
  ];
  assert.strictEqual(Room.hit(list, 105, 203).type, "cat");
  assert.strictEqual(Room.hit(list, 300, 380), null);
}

{
  // 저장: 이상한 값은 버리고, 병합 시 위치·이름은 최신, 쓰다듬은 횟수는 큰 쪽
  const raw = {
    room: {
      bear: { x: 120, y: 300, name: "  <곰>\u0007이 ", pets: 12.7 },
      cat: { x: "nope", pets: -3 },
      dragon: { x: 1, y: 1 },
    },
  };
  const n = Save.normalize(raw, TYPES);
  assert.deepStrictEqual(n.room, { bear: { x: 120, y: 300, name: "곰이", pets: 12 } });
  assert.deepStrictEqual(Save.defaults(TYPES).room, {});
  const disk = Save.setRoom(Save.defaults(TYPES), { bear: { x: 10, y: 10, pets: 30 } });
  const now = Save.setRoom(Save.defaults(TYPES), { bear: { x: 50, y: 60, name: "곰", pets: 5 } });
  assert.deepStrictEqual(Save.merge(disk, now).room.bear, { x: 50, y: 60, name: "곰", pets: 30 });
}

{
  // 보호자 확인 문제: 한 자리 곱셈, 서로 다른 보기 4개 중 정답 1개
  for (let seed = 0; seed < 200; seed++) {
    const q = Fun.parentQuestion(Fun.seededRng("gate:" + seed));
    assert.ok(q.a >= 6 && q.a <= 9 && q.b >= 6 && q.b <= 9);
    assert.strictEqual(q.answer, q.a * q.b);
    assert.strictEqual(q.choices.length, 4);
    assert.strictEqual(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.answer));
    assert.ok(q.choices.every((v) => v > 0));
    assert.strictEqual(Fun.checkParent(q, q.answer), true);
    assert.strictEqual(Fun.checkParent(q, String(q.answer)), true);
    assert.strictEqual(Fun.checkParent(q, q.answer + 1), false);
  }
  assert.strictEqual(Fun.checkParent(null, 1), false);
}

console.log("room.test.js ok");
