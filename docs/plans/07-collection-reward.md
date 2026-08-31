# 7단계: 도감 완성 보상 — 비밀 인형 "달토끼" 구현 플랜

**Goal:** 평생 도감에서 기본 12종을 모두 잡으면 비밀 인형 "달토끼"(400점, secret 등급)가 영구 해금되어 이후 모든 박스에 2마리씩 섞인다. 도감 바에는 해금 전까지 물음표 슬롯으로 표시된다.

**Architecture:** `PLUSH_TYPES`에 `rarity: "secret"`인 `moonbunny`를 추가하되 `SPAWN_BAG`에는 넣지 않는다. `BASE_TYPE_KEYS`(secret 제외)를 도입해 미션 선택과 도감 완성 판정에 사용한다. 해금 여부는 `Save.moonUnlocked`로 영속화하고, `fillBox()`가 해금 시 가방에 달토끼 2마리를 덧붙인다. 그리기는 토끼 형태 + 배의 금빛 초승달.

**Tech Stack:** Vanilla JS, Canvas 2D.

**Spec:** `docs/plans/README.md`, 선행: 1·2단계 필수(Save/일일 미션), 4단계 권장(fillBox가 4단계 버전이라는 전제로 작성됨), 6단계 완료 시 `sw.js` CACHE 버전 올리기.

## Global Constraints

- 미션은 절대 달토끼를 요구하면 안 된다 (해금 전 완료 불가능한 미션 방지) — 미션 선택은 항상 `BASE_TYPE_KEYS`.
- 도감 완성 판정도 `BASE_TYPE_KEYS` 기준 (달토끼 자신은 완성 조건에 불포함).
- 기존 저장 데이터와 호환: 이전 세이브를 로드하면 `moonUnlocked: false`, `dexCounts.moonbunny: 0`으로 채워져야 한다 (`Save.normalize`가 처리).

---

### Task 1: Save에 해금 플래그

**Files:**
- Modify: `js/save.js`
- Modify: `tests/save.test.js`

**Interfaces:**
- Produces: `Save.dexComplete(data, keys) → boolean`, `Save.unlockMoon(data) → data`, data에 `moonUnlocked: boolean` 필드.

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/save.test.js`의 `console.log("save.test.js ok");` 바로 위에 추가:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/save.test.js`
Expected: FAIL — `moonUnlocked` undefined 관련.

- [ ] **Step 3: 구현** — `js/save.js`에서

`defaults()`의 return 객체에 `daily: this.emptyDaily("")` 다음 필드로 `moonUnlocked: false` 추가:
```js
    return { v: 1, bestScore: 0, totalPrizes: 0, totalPlays: 0, dexCounts, daily: this.emptyDaily(""), moonUnlocked: false };
```

`normalize()`의 `return out;` 바로 앞에 추가:
```js
    out.moonUnlocked = !!raw.moonUnlocked;
```

`dexUnique()` 메서드 다음에 추가:
```js
  dexComplete(data, keys) {
    return keys.every((k) => (data.dexCounts[k] || 0) > 0);
  },

  unlockMoon(data) {
    return Object.assign({}, data, { moonUnlocked: true });
  },
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `node tests/save.test.js`
Expected: `save.test.js ok`

```bash
git add js/save.js tests/save.test.js
git commit -m "feat: persist moonbunny unlock with dex completion check"
```

---

### Task 2: 달토끼 타입 + 그리기

**Files:**
- Modify: `js/config.js`
- Modify: `js/draw.js`

**Interfaces:**
- Produces: `PLUSH_TYPES.moonbunny` (`rarity: "secret"`), `Draw.moonbunny(ctx, r, c, blink)`.

- [ ] **Step 1: 타입 추가** — `js/config.js`의 `PLUSH_TYPES`에서 `star: { ... },` 다음 줄에 추가:

```js
  moonbunny: { name: "달토끼", points: 400, radius: 25, mass: 1.0, color: "#e8e6ff", rarity: "secret" },
```
(`SPAWN_BAG`에는 추가하지 않는다.)

- [ ] **Step 2: 그리기** — `js/draw.js`의 `starPlush(...)` 메서드 다음에 추가:

```js
  moonbunny(ctx, r, c, blink) {
    this.felt(ctx, -r * 0.38, -r * 0.95, r * 0.22, r * 0.52, c);
    this.felt(ctx, r * 0.38, -r * 0.95, r * 0.22, r * 0.52, c);
    this.felt(ctx, -r * 0.38, -r * 0.92, r * 0.1, r * 0.34, "#cbb6ff");
    this.felt(ctx, r * 0.38, -r * 0.92, r * 0.1, r * 0.34, "#cbb6ff");
    this.felt(ctx, 0, r * 0.22, r * 0.72, r * 0.64, c);
    this.felt(ctx, 0, -r * 0.1, r * 0.8, r * 0.72, c);
    ctx.fillStyle = "#ffe36a";
    ctx.beginPath();
    ctx.arc(0, r * 0.28, r * 0.2, 0, Math.PI * 2);
    ctx.arc(r * 0.09, r * 0.24, r * 0.15, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    this.face(ctx, 0, -r * 0.06, r * 0.68, blink);
  },
```

- [ ] **Step 3: 디스패치 연결** — `Draw.plush()`의 타입 분기에서

```js
    else if (type === "star") this.starPlush(ctx, r, c, blink);
```
다음 줄에 추가:
```js
    else if (type === "moonbunny") this.moonbunny(ctx, r, c, blink);
```

- [ ] **Step 4: 검증 + 커밋**

Run: `node tests/load-scripts.js && node tests/fun.test.js && node tests/save.test.js`
Expected: 모두 ok.

```bash
git add js/config.js js/draw.js
git commit -m "feat: add secret moonbunny plush type and artwork"
```

---

### Task 3: game.js 연동 — 해금, 스폰, 도감 표시

**Files:**
- Modify: `js/game.js`
- Modify: `css/game.css`
- Modify: `sw.js` (6단계 완료 상태라면 CACHE 버전 올리기)

**Interfaces:**
- Consumes: Task 1의 `Save.dexComplete`/`unlockMoon`, Task 2의 `moonbunny` 타입.
- Produces: `BASE_TYPE_KEYS`, `window.__crane.snapshot().moonUnlocked`.

- [ ] **Step 1: BASE_TYPE_KEYS 정의** — `js/game.js`의

```js
  const TYPE_KEYS = Object.keys(PLUSH_TYPES);
```
바로 다음 줄에 추가:
```js
  const BASE_TYPE_KEYS = TYPE_KEYS.filter((k) => PLUSH_TYPES[k].rarity !== "secret");
```

- [ ] **Step 2: 미션을 BASE로 제한** — 두 곳의 `Fun.dailyMission(TYPE_KEYS, Fun.dayKey())`(state 리터럴, `resetMatch` 내부)를 모두 `Fun.dailyMission(BASE_TYPE_KEYS, Fun.dayKey())`로 교체.

- [ ] **Step 3: 스폰** — `fillBox()`의 첫 줄 `const born = [];` 다음을

```js
    for (const type of bag) {
```
에서 다음으로 교체:
```js
    const full = state.save.moonUnlocked ? bag.concat(["moonbunny", "moonbunny"]) : bag;
    for (const type of full) {
```
(4단계를 건너뛴 경우 fillBox 원본의 `for (const type of bag) {` 앞에 같은 `full` 줄을 넣고 루프 대상을 `full`로 바꾼다.)

- [ ] **Step 4: 해금 판정** — `collect()`에서 미션 판정 블록 뒤의 `Save.store(window.localStorage, state.save);` 바로 앞에 추가:

```js
    if (!state.save.moonUnlocked && Save.dexComplete(state.save, BASE_TYPE_KEYS)) {
      state.save = Save.unlockMoon(state.save);
      msg = "도감 완성! 달토끼가 찾아와요";
      Particles.emit(CHUTE.x, CHUTE.y, "gold", 60);
    }
```
(4단계 미적용 시 `"gold"` 대신 `"win"` 사용.)

- [ ] **Step 5: 도감 물음표 슬롯** — `syncKidHud()`의 for 루프 본문을 다음으로 교체:

```js
    for (const type of TYPE_KEYS) {
      const dot = document.createElement("span");
      const spec = PLUSH_TYPES[type];
      const n = state.save.dexCounts[type] || 0;
      const hidden = spec.rarity === "secret" && !n;
      dot.className = "dex-dot" + (n ? " on" : "") + (hidden ? " secret" : "");
      dot.style.setProperty("--c", spec.color);
      dot.title = hidden ? "???" : `${spec.name} ${n}`;
      dexBar.appendChild(dot);
    }
```

`css/game.css`의 `.dex-dot.on { ... }` 규칙 다음에 추가:
```css
.dex-dot.secret {
  border-style: dashed;
  border-color: var(--neon-lemon);
}
```

- [ ] **Step 6: 스냅샷** — `snapshot()` 반환 객체의 `save: { ... },` 블록 안 `dexUnique: Save.dexUnique(state.save),` 다음 줄에 추가:

```js
          moonUnlocked: state.save.moonUnlocked,
```

- [ ] **Step 7: 서비스 워커 캐시 버전** — 6단계가 완료된 상태라면 `sw.js`의 `const CACHE = "molang-crane-v1";`을 `"molang-crane-v2"`로 올린다.

- [ ] **Step 8: 검증**

Run: `node tests/load-scripts.js && node tests/fun.test.js && node tests/save.test.js`
Expected: 모두 ok.

Run: `GAME_URL=http://127.0.0.1:8765/ node tests/chrome-play.mjs`
Expected: `chrome-play ok` (dex-dot이 13개가 되지만 기존 `>= 8` 검사는 통과).

브라우저 수동 검증(콘솔):
```js
// 해금 시나리오 강제 재현
const Save2 = Save; const keys = Object.keys(PLUSH_TYPES).filter(k => PLUSH_TYPES[k].rarity !== "secret");
let d = Save2.defaults(Object.keys(PLUSH_TYPES));
for (const k of keys) d = Save2.recordCatch(d, k);
d = Save2.unlockMoon(d);
Save2.store(localStorage, d);
location.reload();
```
새로고침 후: 도감 마지막 슬롯이 점선 노란 테두리(아직 안 잡음) → `__crane.snapshot().plushes.filter(p => p.type === "moonbunny").length`가 2, 필드에 연보라 달토끼 2마리 확인. `__crane.wipeSave()` 후 새로고침하면 달토끼가 스폰되지 않아야 함.

- [ ] **Step 9: 커밋**

```bash
git add js/game.js css/game.css sw.js
git commit -m "feat: unlock moonbunny spawns after completing the base dex"
```
