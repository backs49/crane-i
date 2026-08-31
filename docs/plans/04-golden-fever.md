# 4단계: 황금 인형 + 피버 타임 구현 플랜

**Goal:** 세션에 짜릿한 스파이크를 만든다. (a) 박스를 채울 때 18% 확률로 인형 하나가 점수 3배짜리 "황금 인형"이 된다(금빛 후광으로 표시). (b) 박스를 비우면 보너스 코인에 더해 다음 3회 집기 동안 집게가 강해지는 "피버 타임"이 발동한다.

**Architecture:** 상수는 `config.js`(`GOLDEN`, `FEVER`). 황금 선택은 순수 함수 `Fun.pickGoldenIndex()`로 분리해 Node 테스트한다. 표시는 `Draw.plush`가 `p.golden` 플래그를 읽어 후광/링을 그린다. 피버는 `state.fever`(남은 집기 횟수)로 관리하며 `evaluateGrips()`의 bonus에 가산되고 코인을 쓸 때마다 감소한다.

**Tech Stack:** Vanilla JS, Canvas 2D.

**Spec:** `docs/plans/README.md`

## Global Constraints

- `GOLDEN = { chance: 0.18, mult: 3 }`, `FEVER = { grabs: 3, bonus: 0.1 }` — 정확히 이 값.
- 황금 인형의 잡기 난이도는 별도 보정하지 않는다. 점수가 3배가 되면 `Grip.winChance`의 `points >= 250` 페널티(×0.75)가 자연히 적용되는데, 이는 "희귀한 것은 더 어렵다"는 의도된 동작이다.
- `Grip.roll` 자체는 이 단계에서 수정하지 않는다 (bonus 경로만 사용).

---

### Task 1: 상수 + 순수 헬퍼

**Files:**
- Modify: `js/config.js`
- Modify: `js/fun.js`
- Modify: `tests/fun.test.js`

**Interfaces:**
- Produces: 전역 상수 `GOLDEN`, `FEVER`; `Fun.pickGoldenIndex(count, chance, rng?) → number` (선택된 인덱스 또는 -1).

- [ ] **Step 1: 실패하는 테스트 추가** — `tests/fun.test.js`의 `console.log("fun.test.js ok");` 바로 위에 추가:

```js
{
  assert.strictEqual(Fun.pickGoldenIndex(10, 0.18, () => 0.9), -1);
  const seq2 = [0.1, 0.5];
  let j = 0;
  const rngG = () => seq2[j++];
  assert.strictEqual(Fun.pickGoldenIndex(10, 0.18, rngG), 5);
  assert.strictEqual(Fun.pickGoldenIndex(0, 1, () => 0), -1);
  const idx = Fun.pickGoldenIndex(7, 1, Math.random);
  assert.ok(idx >= 0 && idx < 7);
}
```

- [ ] **Step 2: 실패 확인**

Run: `node tests/fun.test.js`
Expected: FAIL — `Fun.pickGoldenIndex is not a function`

- [ ] **Step 3: 구현** — `js/fun.js`의 `dayKey(...)` 메서드 바로 위에 추가:

```js
  pickGoldenIndex(count, chance, rng = Math.random) {
    if (count <= 0 || rng() >= chance) return -1;
    return Math.floor(rng() * count) % count;
  },
```

`js/config.js`의 `const SPAWN_BAG = [` 바로 위에 추가:

```js
const GOLDEN = { chance: 0.18, mult: 3 };
const FEVER = { grabs: 3, bonus: 0.1 };

```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `node tests/fun.test.js && node tests/load-scripts.js`
Expected: 모두 ok.

```bash
git add js/config.js js/fun.js tests/fun.test.js
git commit -m "feat: add golden plush and fever tuning constants with pure picker"
```

---

### Task 2: 황금 인형 — 스폰, 표시, 획득

**Files:**
- Modify: `js/game.js`
- Modify: `js/draw.js`
- Modify: `js/particles.js`

**Interfaces:**
- Produces: plush 객체의 `golden: boolean` 플래그(스폰 시 확정, points는 이미 3배로 반영됨), `Particles.emit(x, y, "gold", n)` 팔레트.

- [ ] **Step 1: 스폰** — `js/game.js`의 `fillBox()`를 다음으로 교체:

```js
  function fillBox(bag) {
    const born = [];
    for (const type of bag) {
      const p = createPlush(type, spawnPos());
      state.plushes.push(p);
      born.push(p);
      Composite.add(engine.world, p.body);
    }
    const gi = Fun.pickGoldenIndex(born.length, GOLDEN.chance);
    if (gi >= 0) {
      born[gi].golden = true;
      born[gi].points = born[gi].points * GOLDEN.mult;
      if (state.mode !== "title") toast("황금 인형 등장!", "win");
    }
    for (let i = 0; i < 120; i++) Engine.update(engine, 1000 / 60);
  }
```

`createPlush()`의 반환 객체에서 `collected: false,` 다음 줄에 추가:
```js
      golden: false,
```

- [ ] **Step 2: 렌더에 golden 전달** — `js/game.js`의 `render()` 안, floor 루프와 air 루프의 `Draw.plush(ctx, {` 객체 **둘 다**에서 `type: p.type,` 다음 줄에 추가:

```js
        golden: p.golden,
```

`addPrizeChip`을 다음으로 교체하고, `collect()` 안의 호출부 `addPrizeChip(plush.type);`을 `addPrizeChip(plush);`로 교체:

```js
  function addPrizeChip(plush) {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const cctx = c.getContext("2d");
    cctx.scale(2, 2);
    Draw.plush(cctx, { type: plush.type, golden: plush.golden, x: 24, y: 28, radius: 14, angle: -0.12, liftZ: 0, blink: 1, react: "success" });
    prizeRail.appendChild(c);
  }
```

- [ ] **Step 3: Draw에 후광/링** — `js/draw.js`의 `plush(ctx, p)`에서

`this.shadow(ctx, x, y, r, lift);` 바로 다음에 추가:
```js
    if (p.golden) {
      ctx.save();
      ctx.translate(x, y);
      const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.6);
      halo.addColorStop(0, "rgba(255, 227, 106, 0.4)");
      halo.addColorStop(1, "rgba(255, 227, 106, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
```

함수 끝의 `ctx.restore();` 바로 다음(함수의 마지막)에 추가:
```js
    if (p.golden) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = "rgba(255, 200, 60, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * scale + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffe36a";
      this.star(ctx, -r * 0.9, -r * 0.95, 4.5, 4, 0.45);
      ctx.fill();
      this.star(ctx, r * 0.95, -r * 0.55, 3.5, 4, 0.45);
      ctx.fill();
      ctx.restore();
    }
```

- [ ] **Step 4: gold 파티클** — `js/particles.js`의 `emit()` 메서드 전체를 다음으로 교체:

```js
  emit(x, y, kind, count) {
    const lively = kind === "win" || kind === "gold";
    const palette =
      kind === "gold"
        ? ["#ffe36a", "#ffc44d", "#fff7fb", "#ffb347"]
        : kind === "win"
          ? ["#ff79c7", "#63f0c8", "#ffe36a", "#cbb6ff", "#fff7fb"]
          : kind === "slip"
            ? ["#c9b6c4", "#8a709c", "#ffeaf4"]
            : ["#ffe36a", "#ff79c7", "#fff7fb"];

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = lively ? 70 + Math.random() * 160 : 40 + Math.random() * 90;
      const shapes = lively ? ["star", "heart", "circle", "petal"] : ["circle", "puff"];
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (lively ? 40 : 10),
        life: 0,
        max: 0.55 + Math.random() * 0.55,
        size: 3 + Math.random() * 6,
        color: palette[i % palette.length],
        shape: shapes[i % shapes.length],
        spin: Math.random() * Math.PI * 2,
        spinV: (Math.random() - 0.5) * 8,
      });
    }
  },
```

- [ ] **Step 5: 획득 연출** — `js/game.js`의 `collect()`에서

```js
    Particles.emit(CHUTE.x, CHUTE.y, "win", juice);
    let msg = `${plush.name} +${plush.points}`;
```
을 다음으로 교체:
```js
    Particles.emit(CHUTE.x, CHUTE.y, plush.golden ? "gold" : "win", juice);
    let msg = plush.golden ? `황금 ${plush.name} +${plush.points}` : `${plush.name} +${plush.points}`;
```

- [ ] **Step 6: 스냅샷** — `window.__crane`의 `snapshot()`에서 plushes 매핑을 다음으로 교체:

```js
        plushes: state.plushes.filter((p) => !p.collected).map((p) => ({
          type: p.type,
          golden: !!p.golden,
          x: p.body.position.x,
          y: p.body.position.y,
          r: p.radius,
        })),
```

- [ ] **Step 7: 검증 + 커밋**

Run: `node tests/load-scripts.js && node tests/fun.test.js`
Expected: 모두 ok.

브라우저 검증: 새로고침을 몇 번 반복해 황금 인형(금빛 후광+링)이 가끔 등장하는지, `__crane.snapshot().plushes.some(p => p.golden)`으로도 확인. 황금 인형을 `__crane.aim(x, y); __crane.grab()`으로 잡으면 토스트가 `황금 …`으로 뜨고 점수가 3배(예: 곰돌이 300)인지 확인.

```bash
git add js/game.js js/draw.js js/particles.js
git commit -m "feat: spawn rare golden plushes worth triple points"
```

---

### Task 3: 피버 타임

**Files:**
- Modify: `js/game.js`

**Interfaces:**
- Produces: `state.fever: number`(남은 강화 집기 횟수), `window.__crane.snapshot().fever`.

- [ ] **Step 1: 상태 추가** — `state` 리터럴에서 `streak: Fun.emptyStreak(),` 다음 줄에 추가:

```js
    fever: 0,
```

`resetMatch()`의 `if (freshCoins) {` 블록 안 `state.streak = Fun.emptyStreak();` 다음 줄에 추가:
```js
      state.fever = 0;
```

- [ ] **Step 2: 발동** — `collect()`의 박스 클리어 블록을 다음으로 교체:

```js
    const remain = state.plushes.filter((p) => !p.collected);
    if (!remain.length) {
      setTimeout(() => {
        state.fever = FEVER.grabs;
        toast("박스 클리어! 피버 타임 + 코인 2개", "win");
        state.coins += 2;
        coinEl.textContent = String(state.coins);
        fillBox(SPAWN_BAG);
      }, 700);
    }
```

- [ ] **Step 3: 보너스 적용** — `evaluateGrips()`에서

```js
    const bonus = Fun.clawBonus(state.streak) + Fun.pendingBoost(state.consolation);
```
을 다음으로 교체:
```js
    let bonus = Fun.clawBonus(state.streak) + Fun.pendingBoost(state.consolation);
    if (state.fever > 0) bonus += FEVER.bonus;
```

- [ ] **Step 4: 소모** — `spendAndDrop()`에서 `state.coins -= 1;` 바로 다음 줄에 추가:

```js
    if (state.fever > 0) state.fever -= 1;
```

- [ ] **Step 5: 시각 표시** — `render()`의 조준 링 블록에서

```js
      ctx.strokeStyle = "rgba(255, 227, 106, 0.35)";
```
을 다음으로 교체:
```js
      ctx.strokeStyle = state.fever > 0 ? "rgba(255, 196, 77, 0.85)" : "rgba(255, 227, 106, 0.35)";
```

- [ ] **Step 6: 스냅샷** — `snapshot()` 반환 객체의 `streak: state.streak,` 다음 줄에 추가:

```js
        fever: state.fever,
```

- [ ] **Step 7: 검증 + 커밋**

Run: `node tests/load-scripts.js`
Expected: `load-scripts ok`

브라우저 검증(콘솔): 
```js
__crane.start();
// 박스를 다 비우는 대신 배선 확인: 
__crane.snapshot().fever   // 0
```
실제 박스 클리어까지 확인하려면 `__crane.aim()`/`grab()` 루프로 반복 시도(승률 캡 때문에 오래 걸릴 수 있음 — 배선 확인이 통과면 충분).

```bash
git add js/game.js
git commit -m "feat: grant a three-grab fever after clearing the box"
```
