# 1단계: localStorage 영속화 구현 플랜

**Goal:** 평생 도감(잡은 인형 누적), 최고 점수, 누적 통계를 localStorage에 저장해 새로고침·재방문 후에도 유지한다.

**Architecture:** 순수 로직 전역 `Save`를 새 파일 `js/save.js`에 정의한다(Node 로드 가능, 스토리지 객체는 파라미터로 주입). `game.js`가 부팅 시 로드하고 잡기/게임오버 시점에 갱신·저장한다. 도감 바(`#dexBar`)는 판 단위 `state.collection` 대신 평생 기록 `state.save.dexCounts`를 표시하도록 바꾼다.

**Tech Stack:** Vanilla JS, localStorage, Node `assert` 테스트.

**Spec:** `docs/plans/README.md` (전역 제약 포함)

## Global Constraints

- `js/save.js`는 최상위에서 DOM/`window` 접근 금지. `if (typeof module !== "undefined") module.exports = Save;` 가드 필수.
- 스토리지 키: `"molang-crane:v1"` (정확히 이 문자열).
- `Save.load`/`Save.store`는 스토리지가 없거나(null/undefined), JSON이 깨졌거나, setItem이 throw해도 절대 예외를 밖으로 던지지 않는다.
- 판 단위 상태(`state.collection`, `state.score`)의 기존 동작은 유지. 저장 데이터는 별도 레이어.

---

### Task 1: `js/save.js` 모듈 생성 (테스트 먼저)

**Files:**
- Create: `tests/save.test.js`
- Create: `js/save.js`
- Modify: `index.html` (스크립트 태그 추가)
- Modify: `tests/load-scripts.js` (files 배열)

**Interfaces (이후 단계가 의존하는 시그니처):**
- `Save.KEY: string`
- `Save.defaults(typeKeys: string[]) → data`
- `Save.normalize(raw: any, typeKeys) → data` (깨진 입력을 defaults와 병합)
- `Save.load(storage, typeKeys) → data`
- `Save.store(storage, data) → void`
- `Save.recordCatch(data, type) → data` (불변 갱신)
- `Save.recordPlay(data) → data`
- `Save.recordGameOver(data, score) → { data, isBest }`
- `Save.dexUnique(data) → number`
- data 형태: `{ v: 1, bestScore, totalPrizes, totalPlays, dexCounts: { [type]: number } }`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/save.test.js`를 아래 내용 그대로 생성:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/save.test.js`
Expected: FAIL — `Cannot find module '../js/save.js'`

- [ ] **Step 3: `js/save.js` 구현** — 아래 내용 그대로 생성:

```js
const Save = {
  KEY: "molang-crane:v1",

  defaults(typeKeys) {
    const dexCounts = Object.create(null);
    for (const t of typeKeys) dexCounts[t] = 0;
    return { v: 1, bestScore: 0, totalPrizes: 0, totalPlays: 0, dexCounts };
  },

  normalize(raw, typeKeys) {
    const base = this.defaults(typeKeys);
    if (!raw || typeof raw !== "object") return base;
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    const out = Object.assign({}, base, raw);
    out.v = 1;
    out.bestScore = num(raw.bestScore);
    out.totalPrizes = num(raw.totalPrizes);
    out.totalPlays = num(raw.totalPlays);
    out.dexCounts = Object.assign(Object.create(null), base.dexCounts);
    if (raw.dexCounts && typeof raw.dexCounts === "object") {
      for (const t of typeKeys) out.dexCounts[t] = num(raw.dexCounts[t]);
    }
    return out;
  },

  load(storage, typeKeys) {
    try {
      const raw = storage && storage.getItem ? JSON.parse(storage.getItem(this.KEY)) : null;
      return this.normalize(raw, typeKeys);
    } catch (_) {
      return this.defaults(typeKeys);
    }
  },

  store(storage, data) {
    try {
      if (storage && storage.setItem) storage.setItem(this.KEY, JSON.stringify(data));
    } catch (_) {
      /* 저장 불가 환경(사파리 프라이빗 등)에서는 조용히 무시 */
    }
  },

  recordCatch(data, type) {
    const dexCounts = Object.assign(Object.create(null), data.dexCounts);
    dexCounts[type] = (dexCounts[type] || 0) + 1;
    return Object.assign({}, data, { dexCounts, totalPrizes: (data.totalPrizes || 0) + 1 });
  },

  recordPlay(data) {
    return Object.assign({}, data, { totalPlays: (data.totalPlays || 0) + 1 });
  },

  recordGameOver(data, score) {
    const isBest = score > (data.bestScore || 0);
    const next = Object.assign({}, data, { bestScore: isBest ? score : data.bestScore || 0 });
    return { data: next, isBest };
  },

  dexUnique(data) {
    return Object.keys(data.dexCounts || {}).filter((k) => data.dexCounts[k] > 0).length;
  },
};

if (typeof module !== "undefined") module.exports = Save;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node tests/save.test.js`
Expected: `save.test.js ok`

- [ ] **Step 5: 로드 순서 등록** — `index.html`에서

```html
    <script src="js/config.js"></script>
```
바로 다음 줄에 추가:
```html
    <script src="js/save.js"></script>
```

`tests/load-scripts.js`의 `files` 배열에서 `"js/config.js",` 다음 줄에 `"js/save.js",` 추가.

- [ ] **Step 6: 스모크 테스트 + 커밋**

Run: `node tests/load-scripts.js`
Expected: 마지막 줄 `load-scripts ok` (Save는 game.js가 아직 안 쓰므로 `global` 목록엔 없어도 됨)

```bash
git add js/save.js tests/save.test.js index.html tests/load-scripts.js
git commit -m "feat: add Save module for persistent progress"
```

---

### Task 2: game.js 연동 — 저장/로드, 평생 도감, 최고 기록 표시

**Files:**
- Modify: `js/game.js`
- Modify: `index.html` (게임오버 다이얼로그에 최고 기록 칸)
- Modify: `css/game.css` (over-stats 3칸 대응)

**Interfaces:**
- Consumes: Task 1의 `Save` 전역 전체.
- Produces: `state.save` (game.js 내부 상태), `window.__crane.snapshot().save`, `window.__crane.wipeSave()`.

- [ ] **Step 1: 상태에 save 추가** — `js/game.js`의 `state` 리터럴에서

```js
    collection: Fun.emptyCollection(Object.keys(PLUSH_TYPES)),
```
바로 위 줄에 추가:
```js
    save: Save.load(window.localStorage, TYPE_KEYS),
```
(참고: `TYPE_KEYS`는 state 리터럴보다 위에서 이미 정의되어 있음. `tests/load-scripts.js` 샌드박스에는 localStorage가 없어 `undefined`가 넘어가는데, `Save.load`가 defaults로 처리하므로 안전.)

- [ ] **Step 2: 잡을 때 기록** — `collect()` 함수에서

```js
    state.collection = Fun.recordCatch(state.collection, plush.type);
```
바로 다음 줄에 추가:
```js
    state.save = Save.recordCatch(state.save, plush.type);
    Save.store(window.localStorage, state.save);
```

- [ ] **Step 3: 플레이 횟수 기록** — `startGame()`에서 `resetMatch(true);` 바로 다음 줄에 추가:

```js
    state.save = Save.recordPlay(state.save);
    Save.store(window.localStorage, state.save);
```

- [ ] **Step 4: 게임오버에 최고 기록** — `index.html`의 `.over-stats`를 다음으로 교체:

```html
        <div class="over-stats">
          <div>
            <span>점수</span>
            <strong id="overScore">0</strong>
          </div>
          <div>
            <span>인형</span>
            <strong id="overPrizes">0</strong>
          </div>
          <div id="overBestWrap">
            <span>최고</span>
            <strong id="overBest">0</strong>
          </div>
        </div>
```

`css/game.css`의 `.over-stats` 규칙에서 `grid-template-columns: 1fr 1fr;`를 `grid-template-columns: repeat(3, 1fr);`로 변경하고, 파일의 `.over-stats strong` 규칙 다음에 추가:

```css
#overBestWrap.new {
  outline: 2px solid var(--neon-lemon);
  outline-offset: -2px;
  border-radius: 14px;
}
```

- [ ] **Step 5: endGame 갱신** — `js/game.js`의 `endGame()`을 다음으로 교체:

```js
  function endGame() {
    detachGrips(true);
    setMode("gameover");
    AudioFx.over();
    const res = Save.recordGameOver(state.save, state.score);
    state.save = res.data;
    Save.store(window.localStorage, state.save);
    document.getElementById("overScore").textContent = String(state.score);
    document.getElementById("overPrizes").textContent = String(state.prizes);
    document.getElementById("overBest").textContent = String(state.save.bestScore);
    document.getElementById("overBestWrap").classList.toggle("new", res.isBest);
    document.getElementById("overEyebrow").textContent = res.isBest
      ? "최고 기록 갱신!"
      : state.missionDone
        ? "부탁도 해냈어요"
        : state.prizes === 0
          ? "집게가 오늘따라 더 약해요"
          : "오늘 밤의 수확";
    overOverlay.classList.remove("hidden");
  }
```

- [ ] **Step 6: 도감을 평생 기록으로** — `syncKidHud()`의 for 루프 안에서

```js
      const n = Fun.typeCount(state.collection, type);
```
를 다음으로 교체:
```js
      const n = state.save.dexCounts[type] || 0;
```

- [ ] **Step 7: 자동화 훅 확장** — `window.__crane` 객체의 `snapshot()` 반환 객체에서 `mission: {...},` 다음에 추가:

```js
        save: {
          bestScore: state.save.bestScore,
          totalPrizes: state.save.totalPrizes,
          totalPlays: state.save.totalPlays,
          dexUnique: Save.dexUnique(state.save),
        },
```

그리고 `end: endGame,` 다음 줄에 추가:
```js
    wipeSave() {
      state.save = Save.defaults(TYPE_KEYS);
      Save.store(window.localStorage, state.save);
      syncKidHud();
    },
```

- [ ] **Step 8: 검증**

Run: `node tests/load-scripts.js && node tests/save.test.js && node tests/fun.test.js`
Expected: 세 개 모두 ok.

Run (서버 켠 상태에서): `GAME_URL=http://127.0.0.1:8765/ node tests/chrome-play.mjs`
Expected: `chrome-play ok`. 출력 JSON의 `fill.snap.save`에 `bestScore` 필드가 보여야 함.

- [ ] **Step 9: 커밋**

```bash
git add js/game.js index.html css/game.css
git commit -m "feat: persist dex, best score, and lifetime stats across sessions"
```
