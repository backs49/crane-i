(() => {
  const { Engine, Composite, Bodies, Body, Constraint, Vector } = Matter;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const coinEl = document.getElementById("coinVal");
  const scoreEl = document.getElementById("scoreVal");
  const statusEl = document.getElementById("statusPill");
  const toastEl = document.getElementById("toast");
  const prizeRail = document.getElementById("prizeRail");
  const prizeCount = document.getElementById("prizeCount");
  const grabLabel = document.getElementById("grabLabel");
  const titleOverlay = document.getElementById("titleOverlay");
  const overOverlay = document.getElementById("overOverlay");
  const muteBtn = document.getElementById("muteBtn");
  const missionBar = document.getElementById("missionBar");
  const scrapBar = document.getElementById("scrapBar");
  const dexBar = document.getElementById("dexBar");
  const TYPE_KEYS = Object.keys(PLUSH_TYPES);
  const BASE_TYPE_KEYS = TYPE_KEYS.filter((k) => PLUSH_TYPES[k].rarity !== "secret");
  const storage = (() => { try { return window.localStorage; } catch (_) { return null; } })();

  const engine = Engine.create({
    enableSleeping: true,
    gravity: { x: 0, y: 0 },
  });
  engine.positionIterations = 10;
  engine.velocityIterations = 8;

  const state = {
    mode: "title",
    coins: START_COINS,
    score: 0,
    prizes: 0,
    plushes: [],
    grips: [],
    toastTimer: 0,
    lastBump: 0,
    paused: false,
    ignoreGrab: 0,
    lastAim: { x: HOME.x, y: HOME.y },
    returnDist: 0,
    lastGrip: null,
    strainTimer: 0,
    save: Save.touchDaily(Save.load(storage, TYPE_KEYS), Fun.dayKey()).data,
    collection: Fun.emptyCollection(Object.keys(PLUSH_TYPES)),
    consolation: Fun.emptyConsolation(),
    streak: Fun.emptyStreak(),
    fever: 0,
    mission: Fun.dailyMission(BASE_TYPE_KEYS, Fun.dayKey()),
    missionDone: false,
    lastBest: false,
    goldenCaught: Object.create(null),
    debug: new URLSearchParams(location.search).has("debug"),
  };

  state.missionDone = !!state.save.daily.missionDone;

  const claw = {
    x: HOME.x,
    y: HOME.y,
    z: 1,
    open: 1,
    hub: null,
    fingers: [],
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeWalls() {
    const t = WORLD.wall;
    const w = WORLD.w;
    const h = WORLD.h;
    const opts = {
      isStatic: true,
      friction: 0.6,
      restitution: 0.08,
      collisionFilter: { category: CAT.WALL, mask: CAT.PLUSH | CAT.CLAW },
      label: "wall",
    };
    return [
      Bodies.rectangle(w / 2, t / 2, w, t, opts),
      Bodies.rectangle(w / 2, h - t / 2, w, t, opts),
      Bodies.rectangle(t / 2, h / 2, t, h, opts),
      Bodies.rectangle(w - t / 2, h / 2, t, h, opts),
    ];
  }

  function makeClawBodies() {
    const hub = Bodies.circle(claw.x, claw.y, 8, {
      isSensor: true,
      friction: 0.9,
      collisionFilter: { category: CAT.CLAW, mask: 0 },
      label: "hub",
    });
    const fingers = [0, 1, 2].map(() =>
      Bodies.rectangle(claw.x, claw.y, 14, 26, {
        friction: 0.95,
        restitution: 0.02,
        density: 0.04,
        collisionFilter: { category: CAT.CLAW, mask: 0 },
        label: "claw",
      }),
    );
    claw.hub = hub;
    claw.fingers = fingers;
    Composite.add(engine.world, [hub, ...fingers]);
  }

  function spawnPos() {
    return {
      x: WORLD.w * 0.5 + rand(-138, 138),
      y: 200 + rand(-88, 128),
    };
  }

  function createPlush(type, pos) {
    const spec = PLUSH_TYPES[type];
    const body = Bodies.circle(pos.x, pos.y, spec.radius, {
      restitution: 0.12,
      friction: 0.5,
      frictionAir: 0.11,
      density: 0.0018 * spec.mass,
      slop: 0.35,
      sleepThreshold: 28,
      collisionFilter: { category: CAT.PLUSH, mask: CAT.WALL | CAT.PLUSH | CAT.CLAW },
      label: "plush",
    });
    return {
      type,
      name: spec.name,
      points: spec.points,
      radius: spec.radius,
      body,
      liftZ: 0,
      blink: 1,
      blinkIn: rand(1.4, 4.2),
      squashX: 0,
      squashY: 0,
      collected: false,
      golden: false,
      react: "idle",
      reactT: 0,
    };
  }

  function fillBox(bag) {
    state.plushes = state.plushes.filter((p) => !p.collected);
    const born = [];
    const full = state.save.moonUnlocked ? bag.concat(["moonbunny", "moonbunny"]) : bag;
    for (const type of full) {
      const p = createPlush(type, spawnPos());
      state.plushes.push(p);
      born.push(p);
      Composite.add(engine.world, p.body);
    }
    const gi = Fun.pickGoldenIndex(born.length, GOLDEN.chance);
    if (gi >= 0) {
      born[gi].golden = true;
      born[gi].points = born[gi].points * GOLDEN.mult;
      if (state.mode !== "title") {
        setTimeout(() => {
          if (state.mode !== "title" && state.mode !== "gameover") toast("황금 인형 등장!", "win");
        }, 1400);
      }
    }
    for (let i = 0; i < 120; i++) Engine.update(engine, 1000 / 60);
  }

  function clearPlushes() {
    for (const p of state.plushes) Composite.remove(engine.world, p.body);
    state.plushes = [];
  }

  function setAirborne(plush, up) {
    plush.body.collisionFilter.mask = up ? CAT.WALL : CAT.WALL | CAT.PLUSH | CAT.CLAW;
    plush.body.frictionAir = up ? 0.16 : 0.08;
  }

  function setFloor(plush) {
    plush.body.collisionFilter.mask = CAT.WALL | CAT.PLUSH | CAT.CLAW;
    plush.body.frictionAir = 0.08;
    plush.slipX = 0;
    plush.slipY = 0;
    plush.slipDrop = 0;
    plush.slipSpin = 0;
  }

  function clawBusy() {
    return !["title", "aiming", "gameover"].includes(state.mode);
  }

  function syncClawBodies() {
    Body.setPosition(claw.hub, { x: claw.x, y: claw.y });
    Body.setVelocity(claw.hub, { x: 0, y: 0 });
    Body.setAngle(claw.hub, 0);

    const hit = claw.z < 0.14 && (state.mode === "closing" || state.mode === "ascending" || state.mode === "returning");
    const mask = hit ? CAT.PLUSH : 0;

    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * ((Math.PI * 2) / 3);
      const dist = 11 + claw.open * 18;
      const finger = claw.fingers[i];
      Body.setPosition(finger, {
        x: claw.x + Math.cos(a) * dist,
        y: claw.y + Math.sin(a) * dist,
      });
      Body.setAngle(finger, a);
      Body.setVelocity(finger, { x: 0, y: 0 });
      Body.setAngularVelocity(finger, 0);
      finger.collisionFilter.mask = mask;
    }
  }

  function keepClawInBox() {
    const pad = 42;
    claw.x = clamp(claw.x, WORLD.wall + pad, WORLD.w - WORLD.wall - pad);
    claw.y = clamp(claw.y, WORLD.wall + pad, WORLD.h - WORLD.wall - pad);
  }

  function evaluateGrips() {
    const live = state.plushes.filter((p) => !p.collected);
    const scored = live
      .map((p) => {
        const d = Vector.magnitude(Vector.sub(p.body.position, { x: claw.x, y: claw.y }));
        const coverage = Grip.coverage(d, p.radius);
        return { p, d, coverage };
      })
      .filter((s) => s.coverage > 0.18)
      .sort((a, b) => b.coverage - a.coverage);

    if (!scored.length) return [];

    const best = scored[0];
    const rival = scored[1];
    const crowded = !!(rival && rival.coverage > 0.28);
    let bonus = Fun.clawBonus(state.streak) + Fun.pendingBoost(state.consolation);
    if (state.fever > 0) bonus += FEVER.bonus;
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
    if (!rolled.pity) state.consolation = Fun.consumeBoost(state.consolation);
    if (rolled.kind === "miss") return [];

    return [
      {
        plush: best.p,
        coverage: best.coverage,
        crowded,
        ...rolled,
        progress: 0,
        escapeAngle: rand(0, Math.PI * 2),
      },
    ];
  }

  function attachGrips() {
    detachGrips(false);
    const found = evaluateGrips();
    for (const g of found) {
      const constraint = Constraint.create({
        bodyA: claw.hub,
        bodyB: g.plush.body,
        stiffness: g.stiffness,
        damping: 0.06,
        length: Math.max(10, g.plush.radius * 0.42),
      });
      Composite.add(engine.world, constraint);
      state.grips.push({ ...g, constraint });
      claw.open = g.fingerGap;
      g.plush.react = "grabbed";
      g.plush.reactT = 0.5;
    }
    state.lastGrip = found[0]
      ? {
          kind: found[0].kind,
          coverage: found[0].coverage,
          slipAt: found[0].slipAt,
          location: found[0].location,
          pity: !!found[0].pity,
        }
      : { kind: "miss" };
    if (state.grips.length) {
      const kind = state.grips[0].kind;
      if (state.grips[0].pity) toast("집게가 힘을 냈어!", "win");
      else if (kind === "hold") toast("잡았다…?", "");
      else if (kind === "late") toast("흔들려…", "");
      else toast("힘이 약해…", "fail");
    } else {
      toast("허공이야", "fail");
    }
    if (state.fever > 0) state.fever -= 1;
  }

  function detachGrips(dropped) {
    for (const g of state.grips) {
      Composite.remove(engine.world, g.constraint);
      if (dropped) {
        setFloor(g.plush);
        Body.applyForce(g.plush.body, g.plush.body.position, {
          x: rand(-0.006, 0.006),
          y: rand(-0.002, 0.008),
        });
        Body.setAngularVelocity(g.plush.body, rand(-0.28, 0.28));
      }
    }
    state.grips = [];
  }

  function constraintLen(c) {
    const pa = Vector.add(c.bodyA.position, Vector.rotate(c.pointA, c.bodyA.angle));
    const pb = Vector.add(c.bodyB.position, Vector.rotate(c.pointB, c.bodyB.angle));
    return Vector.magnitude(Vector.sub(pa, pb));
  }

  function slipMessage(kind) {
    if (kind === "dead") return "힘이 없어…";
    if (kind === "late") return "거의 다 왔는데!";
    return "미끄러졌어…";
  }

  function dropGrip(g, reason) {
    Composite.remove(engine.world, g.constraint);
    setFloor(g.plush);
    const dir = g.escapeAngle || rand(0, Math.PI * 2);
    Body.applyForce(g.plush.body, g.plush.body.position, {
      x: Math.cos(dir) * 0.008,
      y: Math.sin(dir) * 0.008,
    });
    Body.setAngularVelocity(g.plush.body, rand(-0.35, 0.35));
    AudioFx.slip();
    Particles.emit(g.plush.body.position.x, g.plush.body.position.y, "slip", 18);
    g.plush.react = "dropped";
    g.plush.reactT = 0.9;
    const extra = applySlipRewards();
    toast(extra || slipMessage(reason || g.kind), extra ? "win" : "fail");
    claw.open = Math.max(claw.open, 0.62);
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function applySlipRewards() {
    state.streak = Fun.noteSlip(state.streak);
    state.consolation = Fun.awardSlip(state.consolation);
    let extra = null;
    if (state.consolation.reward === "coin") {
      state.coins += 1;
      coinEl.textContent = String(state.coins);
      extra = "별사탕 3개! 코인 +1";
    } else if (state.consolation.reward === "boost") {
      extra = "다음 집게가 조금 세져요";
    }
    syncKidHud();
    return extra;
  }

  function syncKidHud() {
    if (!missionBar || !scrapBar || !dexBar) return;
    const mission = state.mission;
    const have = Math.min(state.save.daily.missionCount || 0, mission.need);
    missionBar.textContent = state.missionDone
      ? `부탁 완료! ${mission.label}`
      : `부탁 ${mission.label} ${have}/${mission.need}`;
    missionBar.classList.toggle("done", state.missionDone);
    scrapBar.textContent = `♥ ${state.consolation.scraps}`;
    dexBar.innerHTML = "";
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
  }

  function carryProgress() {
    if (state.mode === "ascending") return claw.z * 0.34;
    if (state.mode === "returning") {
      const remain = Math.hypot(HOME.x - claw.x, HOME.y - claw.y);
      const traveled = 1 - remain / Math.max(48, state.returnDist);
      return 0.34 + clamp(traveled, 0, 1) * 0.66;
    }
    return 0;
  }

  function updateCarry(dt) {
    const keep = [];
    const progress = carryProgress();
    for (const g of state.grips) {
      g.progress = progress;
      const danger = clamp(progress / Math.max(0.05, g.slipAt), 0, 1);
      g.plush.slipX = Math.cos(g.escapeAngle) * danger * danger * 12;
      g.plush.slipY = Math.sin(g.escapeAngle) * danger * danger * 12;
      g.plush.slipDrop = danger * 0.42;
      g.plush.slipSpin = Math.sin(performance.now() / 80) * danger * 0.55;

      if (claw.z > 0.2) g.plush.react = "airborne";
      if (claw.z > 0.42) {
        setAirborne(g.plush, true);
        if (g.kind === "hold" || g.kind === "late") {
          const follow = g.kind === "hold" ? 1 : 0.62;
          const pos = g.plush.body.position;
          Body.setPosition(g.plush.body, {
            x: pos.x + (claw.x - pos.x) * follow,
            y: pos.y + (claw.y - pos.y) * follow,
          });
          Body.setVelocity(g.plush.body, { x: 0, y: 0 });
        }
      }

      const len = constraintLen(g.constraint);
      const stretched = g.kind !== "hold" && len - g.constraint.length > g.stretch;
      const bumped = g.kind !== "hold" && claw.z < 0.5 && Vector.magnitude(g.plush.body.velocity) > 3.6;
      const due = g.kind !== "hold" && progress >= g.slipAt;

      if (due || stretched || bumped) {
        dropGrip(g, due ? g.kind : "mid");
      } else {
        keep.push(g);
      }
    }
    state.grips = keep;
    if (state.grips[0] && state.grips[0].kind !== "hold") {
      statusEl.textContent = "약함";
    }
    if (state.grips.length && state.grips[0].kind !== "hold") {
      state.strainTimer -= dt;
      if (state.strainTimer <= 0) {
        AudioFx.strain();
        state.strainTimer = 0.28;
      }
    }
  }

  function collectIfInChute(plush) {
    const d = Math.hypot(plush.body.position.x - CHUTE.x, (plush.body.position.y - CHUTE.y) / 0.72);
    return d < CHUTE.r + 4;
  }

  function ensureToday() {
    const today = Fun.dayKey();
    if (state.save.daily.date === today) return;
    state.save = Save.touchDaily(state.save, today).data;
    state.mission = Fun.dailyMission(BASE_TYPE_KEYS, today);
    state.missionDone = !!state.save.daily.missionDone;
    syncKidHud();
  }

  function collect(plush) {
    if (plush.collected) return;
    ensureToday();
    plush.collected = true;
    plush.react = "success";
    Composite.remove(engine.world, plush.body);
    state.score += plush.points;
    state.prizes += 1;
    state.collection = Fun.recordCatch(state.collection, plush.type);
    state.save = Save.recordCatch(state.save, plush.type);
    if (plush.golden) state.goldenCaught[plush.type] = (state.goldenCaught[plush.type] || 0) + 1;
    state.streak = Fun.noteCatch(state.streak);
    scoreEl.textContent = String(state.score);
    prizeCount.textContent = String(state.prizes);
    AudioFx.win();
    const juice = Math.round(42 * Fun.juiceScale(state.streak));
    Particles.emit(CHUTE.x, CHUTE.y, plush.golden ? "gold" : "win", juice);
    let msg = plush.golden ? `황금 ${plush.name} +${plush.points}` : `${plush.name} +${plush.points}`;
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
    if (!state.save.moonUnlocked && Save.dexComplete(state.save, BASE_TYPE_KEYS)) {
      state.save = Save.unlockMoon(state.save);
      msg = "도감 완성! 달토끼가 찾아와요";
      Particles.emit(CHUTE.x, CHUTE.y, "gold", 60);
    }
    Save.store(storage, state.save);
    toast(msg, "win");
    addPrizeChip(plush);
    syncKidHud();
    if (navigator.vibrate) navigator.vibrate(28);

    const remain = state.plushes.filter((p) => !p.collected);
    if (!remain.length) {
      setTimeout(() => {
        if (state.mode === "gameover" || state.mode === "title") return;
        state.fever = FEVER.grabs;
        toast("박스 클리어! 피버 타임 + 코인 2개", "win");
        state.coins += 2;
        coinEl.textContent = String(state.coins);
        fillBox(SPAWN_BAG);
      }, 700);
    }
  }

  function addPrizeChip(plush) {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const cctx = c.getContext("2d");
    cctx.scale(2, 2);
    Draw.plush(cctx, { type: plush.type, golden: plush.golden, x: 24, y: 28, radius: 14, angle: -0.12, liftZ: 0, blink: 1, react: "success" });
    prizeRail.appendChild(c);
  }

  function toast(msg, kind) {
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.className = `toast ${kind || ""}`;
    state.toastTimer = 1.25;
  }

  function setMode(mode) {
    state.mode = mode;
    const labels = {
      title: "준비",
      aiming: "조준",
      descending: "하강",
      closing: "닫는 중",
      ascending: "상승",
      returning: "복귀",
      releasing: "투하",
      gameover: "종료",
    };
    statusEl.textContent = labels[mode] || mode;
    statusEl.classList.toggle("busy", clawBusy() && mode !== "title");
    grabLabel.textContent = mode === "descending" ? "닫기" : "집기";
  }

  function spendAndDrop() {
    if (state.coins <= 0) {
      endGame();
      return;
    }
    state.coins -= 1;
    coinEl.textContent = String(state.coins);
    AudioFx.grab();
    setMode("descending");
  }

  function endGame() {
    detachGrips(true);
    setMode("gameover");
    AudioFx.over();
    const res = Save.recordGameOver(state.save, state.score);
    state.lastBest = res.isBest;
    state.save = res.data;
    Save.store(storage, state.save);
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

  function resetMatch(freshCoins) {
    detachGrips(false);
    clearPlushes();
    prizeRail.innerHTML = "";
    state.score = freshCoins ? 0 : state.score;
    state.prizes = freshCoins ? 0 : state.prizes;
    if (freshCoins) {
      state.coins = START_COINS;
      state.score = 0;
      state.prizes = 0;
      state.collection = Fun.emptyCollection(TYPE_KEYS);
      state.consolation = Fun.emptyConsolation();
      state.streak = Fun.emptyStreak();
      state.fever = 0;
      state.goldenCaught = Object.create(null);
      state.mission = Fun.dailyMission(BASE_TYPE_KEYS, Fun.dayKey());
      state.missionDone = !!state.save.daily.missionDone;
    }
    coinEl.textContent = String(state.coins);
    scoreEl.textContent = String(state.score);
    prizeCount.textContent = String(state.prizes);
    claw.x = HOME.x;
    claw.y = HOME.y;
    claw.z = 1;
    claw.open = 1;
    fillBox(SPAWN_BAG);
  }

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
    Save.store(storage, state.save);
    state.ignoreGrab = 0.35;
    syncKidHud();
    setMode("aiming");
    if (bonusToast) toast(bonusToast, "win");
  }

  function updateBlinks(dt) {
    for (const p of state.plushes) {
      if (p.collected) continue;
      p.blinkIn -= dt;
      if (p.blinkIn < 0.12 && p.blinkIn > 0) p.blink = Math.max(0.05, p.blinkIn / 0.06);
      else if (p.blinkIn <= 0) {
        p.blink = 1;
        p.blinkIn = rand(1.6, 4.5);
      } else p.blink = 1;
      const v = p.body.velocity;
      const spd = Math.hypot(v.x, v.y);
      const s = clamp(spd * 0.012, 0, 0.14);
      p.squashX = v.x === 0 && v.y === 0 ? 0 : (Math.abs(v.x) > Math.abs(v.y) ? s : -s * 0.6);
      p.squashY = -p.squashX * 0.8;
      if (p.reactT > 0) {
        p.reactT -= dt;
        if (p.reactT <= 0 && p.react !== "airborne" && p.react !== "grabbed") p.react = "idle";
      }
    }
  }

  function update(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) toastEl.hidden = true;
    }
    if (state.ignoreGrab > 0) state.ignoreGrab -= dt;

    const rawGrab = Input.consumeGrab();
    const grab = rawGrab && state.ignoreGrab <= 0;
    const vec = Input.vector();

    if (state.mode === "title" && grab) {
      startGame();
    } else if (state.mode === "gameover" && grab) {
      startGame();
    } else if (state.mode === "aiming") {
      claw.x += vec.x * CLAW_SPEED * dt;
      claw.y += vec.y * CLAW_SPEED * dt;
      keepClawInBox();
      state.lastAim.x = claw.x;
      state.lastAim.y = claw.y;
      if (vec.mag > 0.08) AudioFx.startMotor();
      else AudioFx.stopMotor();
      if (grab) spendAndDrop();
    } else {
      AudioFx.stopMotor();
    }

    if (state.mode === "descending") {
      claw.z = Math.max(0, claw.z - dt * 0.95);
      const canClose = claw.z <= 0.38;
      if ((grab && canClose) || claw.z <= 0) {
        claw.z = Math.max(0, claw.z);
        setMode("closing");
        AudioFx.close();
      }
    } else if (state.mode === "closing") {
      claw.open = Math.max(0, claw.open - dt * 3.4);
      if (claw.open <= 0) {
        claw.open = 0;
        attachGrips();
        state.strainTimer = 0.15;
        setMode("ascending");
      }
    } else if (state.mode === "ascending") {
      const load = state.grips.length ? (state.grips[0].kind === "hold" ? 0.62 : 0.5) : 0.9;
      claw.z = Math.min(1, claw.z + dt * load);
      updateCarry(dt);
      if (claw.z >= 1) {
        state.returnDist = Math.hypot(HOME.x - claw.x, HOME.y - claw.y);
        setMode("returning");
      }
    } else if (state.mode === "returning") {
      const dx = HOME.x - claw.x;
      const dy = HOME.y - claw.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 165 * dt;
      claw.x += (dx / d) * Math.min(sp, d);
      claw.y += (dy / d) * Math.min(sp, d);
      if (state.grips.length) {
        const wob = state.grips[0].wobble;
        claw.x += Math.sin(performance.now() / 55) * wob * 0.55;
        claw.y += Math.cos(performance.now() / 70) * wob * 0.4;
      }
      updateCarry(dt);
      if (d < 4) {
        claw.x = HOME.x;
        claw.y = HOME.y;
        setMode("releasing");
      }
    } else if (state.mode === "releasing") {
      claw.open = Math.min(1, claw.open + dt * 2.8);
      if (claw.open > 0.55 && state.grips.length) {
        const held = state.grips.map((g) => g.plush);
        detachGrips(false);
        for (const p of held) {
          setFloor(p);
          if (collectIfInChute(p)) collect(p);
          else {
            p.react = "dropped";
            p.reactT = 0.9;
            const extra = applySlipRewards();
            toast(extra || "입구까지 못 왔어…", extra ? "win" : "fail");
            Body.applyForce(p.body, p.body.position, { x: 0, y: 0.002 });
          }
        }
      }
      if (claw.open >= 1) {
        claw.x = HOME.x;
        claw.y = HOME.y;
        if (state.coins <= 0) endGame();
        else setMode("aiming");
      }
    }

    for (const g of state.grips) g.plush.liftZ = claw.z;
    for (const p of state.plushes) {
      if (p.collected) continue;
      if (!state.grips.some((g) => g.plush === p)) {
        p.liftZ = Math.max(0, p.liftZ - dt * 2.4);
      }
    }

    syncClawBodies();
    Engine.update(engine, dt * 1000);
    updateBlinks(dt);
    Particles.update(dt);
    AudioFx.tickBgm(performance.now());

    if (Math.random() < dt * 3) {
      Particles.sparkle(rand(40, WORLD.w - 40), rand(40, WORLD.h - 40));
    }
  }

  function resize() {
    const host = document.getElementById("viewport") || canvas.parentElement;
    const box = host.getBoundingClientRect();
    let cssW = box.width;
    let cssH = box.height;
    if (cssW < 2 || cssH < 2) return;
    const target = WORLD.w / WORLD.h;
    if (cssW / cssH > target + 0.01) cssW = cssH * target;
    else if (cssH / cssW > 1 / target + 0.01) cssH = cssW / target;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
  }

  function worldTransform() {
    const dprScale = Math.min(canvas.width / WORLD.w, canvas.height / WORLD.h);
    const ox = (canvas.width - WORLD.w * dprScale) / 2;
    const oy = (canvas.height - WORLD.h * dprScale) / 2;
    return { dprScale, ox, oy };
  }

  function render() {
    const { dprScale, ox, oy } = worldTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dprScale, 0, 0, dprScale, ox, oy);

    Draw.field(ctx);

    const floor = [];
    const air = [];
    for (const p of state.plushes) {
      if (p.collected) continue;
      (p.liftZ > 0.08 ? air : floor).push(p);
    }
    floor.sort((a, b) => a.body.position.y - b.body.position.y);
    air.sort((a, b) => a.body.position.y - b.body.position.y);

    for (const p of floor) {
      Draw.plush(ctx, {
        type: p.type,
        golden: p.golden,
        x: p.body.position.x + (p.slipX || 0),
        y: p.body.position.y + (p.slipY || 0),
        radius: p.radius,
        angle: p.body.angle + (p.slipSpin || 0),
        liftZ: p.liftZ * (1 - 0.45 * (p.slipDrop || 0)),
        blink: p.blink,
        squashX: p.squashX,
        squashY: p.squashY,
        react: p.react || "idle",
      });
    }

    Draw.gantry(ctx, claw);

    for (const p of air) {
      Draw.plush(ctx, {
        type: p.type,
        golden: p.golden,
        x: p.body.position.x + (p.slipX || 0),
        y: p.body.position.y + (p.slipY || 0),
        radius: p.radius,
        angle: p.body.angle + (p.slipSpin || 0),
        liftZ: p.liftZ * (1 - 0.45 * (p.slipDrop || 0)),
        blink: p.blink,
        squashX: p.squashX,
        squashY: p.squashY,
        react: p.react || "idle",
      });
    }

    Draw.claw(ctx, claw);
    Particles.draw(ctx);

    if (state.mode === "aiming" || state.mode === "title") {
      ctx.save();
      ctx.strokeStyle = state.fever > 0 ? "rgba(255, 196, 77, 0.85)" : "rgba(255, 227, 106, 0.35)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(claw.x, claw.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (state.debug) {
      ctx.save();
      ctx.strokeStyle = "rgba(99,240,200,0.7)";
      ctx.lineWidth = 1;
      for (const b of Composite.allBodies(engine.world)) {
        ctx.beginPath();
        const vs = b.vertices;
        ctx.moveTo(vs[0].x, vs[0].y);
        for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = Math.min(0.033, (now - frame.last) / 1000);
    frame.last = now;
    if (!state.paused) update(state.mode === "title" || state.mode === "gameover" ? Math.min(dt, 0.016) : dt);
    else Engine.update(engine, 0);
    render();
    requestAnimationFrame(frame);
  }

  function setupBulbs() {
    for (const id of ["bulbsTop", "bulbsBot"]) {
      const row = document.getElementById(id);
      for (let i = 0; i < 14; i++) row.appendChild(document.createElement("i"));
    }
  }

  Composite.add(engine.world, makeWalls());
  makeClawBodies();
  fillBox(SPAWN_BAG);
  setupBulbs();
  syncKidHud();
  Input.init();
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  if (typeof ResizeObserver !== "undefined") {
    const host = document.getElementById("viewport");
    if (host) new ResizeObserver(resize).observe(host);
  }

  document.getElementById("startBtn").addEventListener("click", startGame);
  document.getElementById("retryBtn").addEventListener("click", startGame);
  let sharing = false;
  document.getElementById("shareBtn").addEventListener("click", async () => {
    if (sharing) return;
    sharing = true;
    try {
      const result = await Share.share({
        score: state.score,
        best: state.save.bestScore,
        prizes: state.prizes,
        dayKey: Fun.dayKey(),
        caught: state.collection.counts,
        isBest: state.lastBest,
        golden: state.goldenCaught,
      });
      if (result === "cancelled") return;
      const msgs = {
        shared: "공유 완료!",
        copied: "이미지가 복사됐어요",
        downloaded: "이미지를 저장했어요",
        fail: "공유에 실패했어요…",
      };
      toast(msgs[result] || msgs.fail, result === "fail" ? "fail" : "win");
    } finally {
      sharing = false;
    }
  });
  muteBtn.addEventListener("click", () => {
    AudioFx.unlock();
    AudioFx.setMuted(!AudioFx.muted);
    muteBtn.setAttribute("aria-pressed", AudioFx.muted ? "true" : "false");
    muteBtn.setAttribute("aria-label", AudioFx.muted ? "소리 켜기" : "소리 끄기");
    document.getElementById("muteIcon").textContent = AudioFx.muted ? "×" : "♪";
    AudioFx.bgmOn = !AudioFx.muted;
  });

  document.addEventListener("visibilitychange", () => {
    state.paused = document.hidden;
    if (state.paused) AudioFx.stopMotor();
  });

  document.body.addEventListener(
    "pointerdown",
    () => {
      AudioFx.unlock();
    },
    { once: true },
  );

  window.__crane = {
    snapshot() {
      return {
        mode: state.mode,
        coins: state.coins,
        score: state.score,
        prizes: state.prizes,
        plushes: state.plushes.filter((p) => !p.collected).map((p) => ({
          type: p.type,
          golden: !!p.golden,
          x: p.body.position.x,
          y: p.body.position.y,
          r: p.radius,
        })),
        claw: { x: claw.x, y: claw.y, z: claw.z, open: claw.open },
        grips: state.grips.length,
        lastGrip: state.lastGrip,
        collection: {
          unique: Fun.uniqueCount(state.collection),
          total: TYPE_KEYS.length,
        },
        consolation: { scraps: state.consolation.scraps, boost: Fun.pendingBoost(state.consolation) },
        streak: state.streak,
        fever: state.fever,
        pityAt: Grip.PITY_AT,
        mission: {
          type: state.mission.type,
          need: state.mission.need,
          label: state.mission.label,
          done: state.missionDone,
        },
        save: {
          bestScore: state.save.bestScore,
          totalPrizes: state.save.totalPrizes,
          totalPlays: state.save.totalPlays,
          dexUnique: Save.dexUnique(state.save),
          moonUnlocked: state.save.moonUnlocked,
        },
      };
    },
    start: startGame,
    aim(x, y) {
      claw.x = x;
      claw.y = y;
      state.lastAim.x = x;
      state.lastAim.y = y;
    },
    grab() {
      Input.grabQueued = true;
    },
    end: endGame,
    wipeSave() {
      Save.wipe(storage);
      state.save = Save.touchDaily(Save.defaults(TYPE_KEYS), Fun.dayKey()).data;
      state.missionDone = false;
      state.mission = Fun.dailyMission(BASE_TYPE_KEYS, Fun.dayKey());
      Save.store(storage, state.save);
      syncKidHud();
    },
    shareCard() {
      return Share.card({
        score: state.score,
        best: state.save.bestScore,
        prizes: state.prizes,
        dayKey: Fun.dayKey(),
        caught: state.collection.counts,
        isBest: state.lastBest,
        golden: state.goldenCaught,
      }).toDataURL("image/png");
    },
  };

  setMode("title");
  requestAnimationFrame(frame);
})();
