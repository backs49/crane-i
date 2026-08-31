# 3단계: 하드 피티(연속 실패 상한) 구현 플랜

**Goal:** 인형을 제대로 잡았는데(coverage 충분) 연속 4번 미끄러졌다면, 5번째 시도는 반드시 성공(`hold`)하게 만들어 어린이 플레이어의 무한 좌절을 차단한다.

**Architecture:** `Grip.roll()`에 `pity`(연속 미끄러짐 횟수) 옵션을 추가한다. `pity >= Grip.PITY_AT`이고 coverage가 0.3 이상이면 RNG를 건너뛰고 `hold` 결과를 반환하며 `pity: true` 플래그를 붙인다. game.js는 이미 연속 미끄러짐을 추적하는 `state.streak.slips`(잡으면 0으로 리셋)를 그대로 전달하고, 피티 발동 시 전용 토스트를 띄운다. 허공 집기(miss)는 slips를 올리지 않으므로 피티에 영향을 주지 않는다(기존 동작 그대로).

**Tech Stack:** Vanilla JS, Node `assert`, `node -e` 시뮬레이션.

**Spec:** `docs/plans/README.md`

## Global Constraints

- `Grip.PITY_AT = 4` (연속 미끄러짐 4회 후 다음 유효 잡기가 보장 성공).
- coverage < 0.3이면 피티가 발동하지 않는다 (허공 근처를 집어서 공짜 성공을 얻는 것 방지).
- `pity` 미지정/0일 때 기존 확률 분포는 단 1비트도 달라지면 안 된다 (같은 rng 시퀀스 → 같은 결과).

---

### Task 1: Grip.roll에 피티 로직 추가

**Files:**
- Modify: `js/grip.js`
- Modify: `tests/fun.test.js`

**Interfaces:**
- Produces: `Grip.PITY_AT: number`, `Grip.roll({ ..., pity? }, rng)` — 피티 발동 시 반환 객체에 `pity: true` 포함.

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/fun.test.js`의 `console.log("fun.test.js ok");` 바로 위에 추가:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/fun.test.js`
Expected: FAIL — `Grip.PITY_AT`이 undefined.

- [ ] **Step 3: 구현** — `js/grip.js`에서

`const Grip = {` 바로 다음 줄에 추가:
```js
  PITY_AT: 4,

```

`roll()` 안에서 miss 분기(`if (coverage < 0.22) { ... }`)의 닫는 `}` 바로 다음, `if (r < pWin) {` 바로 앞에 추가:
```js
    if ((opts.pity || 0) >= this.PITY_AT && coverage >= 0.3) {
      return {
        kind: "hold",
        pity: true,
        slipAt: 1.2,
        wobble: 0.55,
        fingerGap: 0.05,
        stiffness: 0.028,
        stretch: 26,
        location: loc,
      };
    }
```

주의: 이 분기는 `const r = rng();` **이후에** 위치해도 되지만, rng 소비 횟수를 기존과 동일하게 유지하기 위해 위 위치(miss 분기 다음)에 정확히 넣는다. 기존 miss/hold/late/mid/dead 객체는 수정하지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `node tests/fun.test.js`
Expected: `fun.test.js ok`

- [ ] **Step 5: 승률 분포 시뮬레이션 (수치 확인용, 커밋 대상 아님)**

Run:
```bash
node -e "
const Grip = require('./js/grip.js');
const opts = { coverage: 0.75, crowded: false, radius: 24, points: 100, x: 210, y: 200 };
for (const pity of [0, 4]) {
  let hold = 0, n = 20000;
  for (let i = 0; i < n; i++) if (Grip.roll({ ...opts, pity }).kind === 'hold') hold++;
  console.log('pity', pity, 'hold rate', (hold / n).toFixed(3));
}
"
```
Expected: `pity 0`은 약 0.15~0.30 사이(기존 분포, coverage 0.75 기준 이론값 ≈ 0.26), `pity 4`는 1.000.

- [ ] **Step 6: 커밋**

```bash
git add js/grip.js tests/fun.test.js
git commit -m "feat: guarantee a hold after four consecutive slips (hard pity)"
```

---

### Task 2: game.js 연동 — slips 전달 + 피티 토스트

**Files:**
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `state.streak.slips` (기존 — `Fun.noteSlip`으로 증가, `Fun.noteCatch`로 0 리셋), Task 1의 `pity` 옵션/플래그.

- [ ] **Step 1: roll 호출에 pity 전달** — `evaluateGrips()`의 `Grip.roll({...})` 호출을 다음으로 교체:

```js
    const rolled = Grip.roll({
      coverage: best.coverage,
      crowded,
      radius: best.p.radius,
      points: best.p.points,
      x: claw.x,
      y: claw.y,
      bonus,
      pity: state.streak.slips,
    });
```

- [ ] **Step 2: 피티 발동 토스트** — `attachGrips()`에서

```js
    if (state.grips.length) {
      const kind = state.grips[0].kind;
      if (kind === "hold") toast("잡았다…?", "");
```
을 다음으로 교체:
```js
    if (state.grips.length) {
      const kind = state.grips[0].kind;
      if (state.grips[0].pity) toast("집게가 힘을 냈어!", "win");
      else if (kind === "hold") toast("잡았다…?", "");
```

- [ ] **Step 3: 스냅샷 확장** — `window.__crane`의 `snapshot()` 반환 객체에서 `streak: state.streak,` 를 다음으로 교체:

```js
        streak: state.streak,
        pityAt: Grip.PITY_AT,
```

- [ ] **Step 4: 검증**

Run: `node tests/load-scripts.js && node tests/fun.test.js`
Expected: 모두 ok.

브라우저 수동 검증 (서버 켜고 콘솔에서):
```js
__crane.start();
// 4회 연속 미끄러짐을 인위적으로 만들기 어려우므로 스냅샷으로 배선만 확인
__crane.snapshot().pityAt   // 4
__crane.snapshot().streak   // { slips, catches }
```
그 후 실제 플레이로 미끄러짐 4회 누적 시 다음 잡기에서 "집게가 힘을 냈어!" 토스트와 함께 성공하는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add js/game.js
git commit -m "feat: wire slip streak into grip pity with a rescue toast"
```
