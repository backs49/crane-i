# 2단계: 오늘의 부탁(일일 미션) + 일일 접속 보너스 구현 플랜

**Goal:** "오늘의 부탁"이 실제로 날짜 기준 하루 한 번 고정되고, 진행도가 판을 넘어 유지되며, 하루 첫 완료 시 코인 +2를 준다. 하루 첫 게임 시작 시 접속 보너스 코인 +2를 준다.

**Architecture:** `Fun`에 날짜 키(`dayKey`)와 문자열 시드 RNG(`seededRng`)를 추가해 `dailyMission()`이 같은 날 항상 같은 미션을 반환하게 한다. 일일 상태(`daily: { date, missionCount, missionDone, loginBonus }`)는 1단계의 `Save` 데이터에 얹어 localStorage로 유지한다. 기존 "판마다 미션 +1 코인" 로직은 "하루 1회 +2 코인"으로 대체된다.

**Tech Stack:** Vanilla JS, mulberry32 시드 RNG.

**Spec:** `docs/plans/README.md`, 선행: `01-persistence.md` 완료 상태.

## Global Constraints

- `#missionBar` 텍스트에는 어떤 상태에서도 `부탁`이라는 단어가 포함되어야 한다 (chrome-play.mjs 검증).
- 날짜는 사용자 로컬 타임존 기준 `YYYY-MM-DD`.
- 같은 날짜 문자열 → 같은 미션. 미션 대상 타입은 `PLUSH_TYPES`의 키에서 선택.

---

### Task 1: Fun에 날짜 시드 미션 추가

**Files:**
- Modify: `js/fun.js`
- Modify: `tests/fun.test.js`

**Interfaces:**
- Produces: `Fun.dayKey(d?: Date) → "YYYY-MM-DD"`, `Fun.seededRng(str) → () => number(0~1)`, `Fun.dailyMission(typeKeys, dayKeyStr) → mission` (mission 형태는 기존 `pickMission`과 동일: `{ type, need, label }`).

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/fun.test.js`의 `console.log("fun.test.js ok");` 바로 위에 블록 추가:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/fun.test.js`
Expected: FAIL — `Fun.dayKey is not a function`

- [ ] **Step 3: 구현** — `js/fun.js`의 `pickMission(...)` 메서드 정의 바로 위에 추가:

```js
  dayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  },

  seededRng(str) {
    let a = this.hashSeed(str);
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  dailyMission(typeKeys, key) {
    return this.pickMission(typeKeys, this.seededRng("mission:" + key));
  },
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `node tests/fun.test.js`
Expected: `fun.test.js ok`

```bash
git add js/fun.js tests/fun.test.js
git commit -m "feat: add date-seeded daily mission helpers to Fun"
```

---

### Task 2: Save에 daily 블록 추가

**Files:**
- Modify: `js/save.js`
- Modify: `tests/save.test.js`

**Interfaces:**
- Produces: `Save.emptyDaily(dayKey) → daily`, `Save.touchDaily(data, dayKey) → { data, isNewDay }`, `Save.noteMissionCatch(data) → data`, `Save.completeMission(data) → data`, `Save.grantLogin(data) → data`.
- daily 형태: `{ date: string, missionCount: number, missionDone: boolean, loginBonus: boolean }`. `Save.defaults`/`normalize` 결과에 항상 `daily`가 존재한다.

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/save.test.js`의 `console.log("save.test.js ok");` 바로 위에 추가:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/save.test.js`
Expected: FAIL — daily 관련 assert에서 실패.

- [ ] **Step 3: 구현** — `js/save.js`에서

`defaults(typeKeys)`의 return을 다음으로 교체:
```js
    return { v: 1, bestScore: 0, totalPrizes: 0, totalPlays: 0, dexCounts, daily: this.emptyDaily("") };
```

`normalize()`에서 `out.dexCounts` 처리 블록 다음, `return out;` 앞에 추가:
```js
    out.daily = this.emptyDaily("");
    if (raw.daily && typeof raw.daily === "object") {
      out.daily = {
        date: typeof raw.daily.date === "string" ? raw.daily.date : "",
        missionCount: num(raw.daily.missionCount),
        missionDone: !!raw.daily.missionDone,
        loginBonus: !!raw.daily.loginBonus,
      };
    }
```

`defaults` 메서드 바로 위에 새 메서드들 추가:
```js
  emptyDaily(dayKey) {
    return { date: dayKey || "", missionCount: 0, missionDone: false, loginBonus: false };
  },

  touchDaily(data, dayKey) {
    const isNewDay = !data.daily || data.daily.date !== dayKey;
    const daily = isNewDay ? this.emptyDaily(dayKey) : data.daily;
    return { data: Object.assign({}, data, { daily }), isNewDay };
  },

  noteMissionCatch(data) {
    const daily = Object.assign({}, data.daily, { missionCount: (data.daily.missionCount || 0) + 1 });
    return Object.assign({}, data, { daily });
  },

  completeMission(data) {
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { missionDone: true }) });
  },

  grantLogin(data) {
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { loginBonus: true }) });
  },
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `node tests/save.test.js`
Expected: `save.test.js ok`

```bash
git add js/save.js tests/save.test.js
git commit -m "feat: track daily mission progress and login bonus in Save"
```

---

### Task 3: game.js 연동 — 일일 미션과 보너스

**Files:**
- Modify: `js/game.js`
- Modify: `index.html` (타이틀 안내 문구)

**Interfaces:**
- Consumes: Task 1의 `Fun.dayKey`/`Fun.dailyMission`, Task 2의 `Save.touchDaily`/`noteMissionCatch`/`completeMission`/`grantLogin`.

- [ ] **Step 1: 초기 상태를 일일 미션으로** — `state` 리터럴에서

```js
    save: Save.load(window.localStorage, TYPE_KEYS),
```
을 다음으로 교체:
```js
    save: Save.touchDaily(Save.load(window.localStorage, TYPE_KEYS), Fun.dayKey()).data,
```

```js
    mission: Fun.pickMission(Object.keys(PLUSH_TYPES)),
```
을 다음으로 교체:
```js
    mission: Fun.dailyMission(TYPE_KEYS, Fun.dayKey()),
```

그리고 `const claw = {` 정의 **바로 위**에 한 줄 추가 (state 리터럴 밖):
```js
  state.missionDone = !!state.save.daily.missionDone;
```

- [ ] **Step 2: resetMatch 갱신** — `resetMatch()`의 `if (freshCoins) {` 블록 안에서

```js
      state.mission = Fun.pickMission(TYPE_KEYS);
      state.missionDone = false;
```
을 다음으로 교체:
```js
      state.mission = Fun.dailyMission(TYPE_KEYS, Fun.dayKey());
      state.missionDone = !!state.save.daily.missionDone;
```

- [ ] **Step 3: startGame 갱신** — `startGame()` 전체를 다음으로 교체:

```js
  function startGame() {
    AudioFx.unlock();
    AudioFx.bgmOn = true;
    AudioFx.coin();
    titleOverlay.classList.add("hidden");
    overOverlay.classList.add("hidden");
    state.save = Save.touchDaily(state.save, Fun.dayKey()).data;
    resetMatch(true);
    state.save = Save.recordPlay(state.save);
    let bonusToast = null;
    if (!state.save.daily.loginBonus) {
      state.save = Save.grantLogin(state.save);
      state.coins += 2;
      coinEl.textContent = String(state.coins);
      bonusToast = "오늘의 첫 코인! +2";
    }
    Save.store(window.localStorage, state.save);
    state.ignoreGrab = 0.35;
    syncKidHud();
    setMode("aiming");
    if (bonusToast) toast(bonusToast, "win");
  }
```

- [ ] **Step 4: collect의 미션 판정 교체** — `collect()`에서

```js
    let msg = `${plush.name} +${plush.points}`;
    if (!state.missionDone && Fun.missionComplete(state.mission, state.collection)) {
      state.missionDone = true;
      state.coins += 1;
      coinEl.textContent = String(state.coins);
      msg = `부탁 성공! ${plush.name} +${plush.points}`;
    }
```
을 다음으로 교체:
```js
    let msg = `${plush.name} +${plush.points}`;
    if (!state.missionDone && plush.type === state.mission.type) {
      state.save = Save.noteMissionCatch(state.save);
      if (state.save.daily.missionCount >= state.mission.need) {
        state.save = Save.completeMission(state.save);
        state.missionDone = true;
        state.coins += 2;
        coinEl.textContent = String(state.coins);
        msg = `부탁 성공! 코인 +2`;
      }
    }
    Save.store(window.localStorage, state.save);
```

- [ ] **Step 5: HUD 진행도를 일일 기준으로** — `syncKidHud()`에서

```js
    const have = Fun.missionCaught(mission, state.collection);
```
을 다음으로 교체:
```js
    const have = Math.min(state.save.daily.missionCount || 0, mission.need);
```

- [ ] **Step 6: 안내 문구** — `index.html`의

```html
        <p class="fine" id="titleFine">코인 8개 · 오늘의 부탁을 끝내면 보너스 코인</p>
```
을 다음으로 교체:
```html
        <p class="fine" id="titleFine">코인 8개 · 하루 첫 방문 +2 · 오늘의 부탁 완료 시 +2</p>
```

- [ ] **Step 7: 검증**

Run: `node tests/fun.test.js && node tests/save.test.js && node tests/load-scripts.js`
Expected: 모두 ok.

Run: `GAME_URL=http://127.0.0.1:8765/ node tests/chrome-play.mjs`
Expected: `chrome-play ok`, 그리고 `afterCoins`가 9 이상(시작 8 − 1회 사용 + 접속 보너스 2 = 9)이어야 함. 출력의 `fill.mission`에 `부탁` 포함 확인.

추가 수동 검증(브라우저 콘솔):
```js
__crane.snapshot().mission          // 새로고침해도 같은 type/need여야 함
localStorage.getItem("molang-crane:v1")  // daily.date가 오늘 날짜
```

- [ ] **Step 8: 커밋**

```bash
git add js/game.js index.html
git commit -m "feat: make mission truly daily with cross-run progress and login bonus"
```
