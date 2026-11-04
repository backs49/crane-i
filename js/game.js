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
  const dexOverlay = document.getElementById("dexOverlay");
  const dexGrid = document.getElementById("dexGrid");
  const dexTitle = document.getElementById("dexTitle");
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
    aimTime: 0,
    quickGrab: false,
    mission: Fun.dailyMission(BASE_TYPE_KEYS, Fun.dayKey()),
    missionDone: false,
    lastBest: false,
    goldenCaught: Object.create(null),
    challenge: Fun.decodeChallenge(new URLSearchParams(location.search).get("vs")),
    debug: new URLSearchParams(location.search).has("debug"),
  };

  state.missionDone = !!state.save.daily.missionDone;

  if (state.challenge) {
    const vsBanner = document.getElementById("vsBanner");
    vsBanner.hidden = false;
    vsBanner.textContent = `⚔️ 도전장 도착! 친구 기록 ${state.challenge.score}점`;
  }

  const claw = {
    x: HOME.x,
    y: HOME.y,
    z: 1,
    open: 1,
    hub: null,
    fingers: [],
  };

  function kidOn() {
    return state.save.kidMode !== false;
  }

  function syncKidMode() {
    const on = kidOn();
    syncTimeBtn();
    const btn = document.getElementById("kidBtn");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "아이 모드 켜짐 🧸" : "아이 모드 꺼짐";
    document.getElementById("howGrab").textContent = on
      ? "집기를 한 번 누르면 집게가 알아서 내려가 잡아요"
      : "집기 — 바닥에 닿기 전 한 번 더 누르면 닫힘";
    document.getElementById("howSlip").textContent = on
      ? "두 번 연속 놓치면 다음엔 집게가 힘을 내요"
      : "약하게 잡히면 공중에서 미끄러져요. 거의 다 와서 떨어지기도 해요";
    document.getElementById("titleLead").textContent = on
      ? "위에서 내려다보는 박스 안에서 인형들이 구릅니다. 집게를 인형 한가운데에 맞출수록 잘 잡혀요. 놓쳐도 괜찮아요, 집게가 금방 힘을 내요!"
      : "위에서 내려다보는 박스 안에서 인형들이 서로 밀리고 구릅니다. 집게는 일부러 힘이 약해요. 정중앙이어도 들어 올리다 미끄러질 수 있어요.";
    document.getElementById("hint").textContent = on
      ? "왼쪽 동그라미로 집게를 옮기고, 집기를 한 번 눌러요"
      : "방향키 / WASD 로 집게 이동 · 스페이스로 내리고, 한 번 더 누르면 닫아요";
  }

  function setKidMode(on) {
    state.save = Save.setKidMode(state.save, on);
    Save.store(storage, state.save);
    syncKidMode();
  }

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
      kid: kidOn(),
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

  function dexCard(type) {
    const spec = PLUSH_TYPES[type];
    const n = state.save.dexCounts[type] || 0;
    const secretHidden = spec.rarity === "secret" && !n;
    const card = document.createElement("div");
    card.className = "dex-card" + (n ? "" : " off");
    const c = document.createElement("canvas");
    c.width = 132;
    c.height = 132;
    const cctx = c.getContext("2d");
    cctx.scale(2, 2);
    if (secretHidden) {
      cctx.fillStyle = "#cbb6ff";
      cctx.font = "34px 'Bagel Fat One', 'Jua', sans-serif";
      cctx.textAlign = "center";
      cctx.textBaseline = "middle";
      cctx.fillText("?", 33, 36);
    } else {
      Draw.plush(cctx, { type, x: 33, y: 36, radius: 24, angle: 0, liftZ: 0, blink: 1, react: n ? "success" : "idle" });
      if (!n) {
        cctx.globalCompositeOperation = "source-atop";
        cctx.fillStyle = "rgba(20, 8, 26, 0.82)";
        cctx.fillRect(0, 0, 66, 66);
        cctx.globalCompositeOperation = "source-over";
      }
    }
    const name = document.createElement("span");
    name.className = "dex-name";
    name.textContent = secretHidden ? "???" : spec.name;
    const count = document.createElement("span");
    count.className = "dex-count";
    count.textContent = n ? `×${n}` : "미발견";
    card.appendChild(c);
    card.appendChild(name);
    card.appendChild(count);
    return card;
  }

  function openDex() {
    dexGrid.innerHTML = "";
    for (const type of TYPE_KEYS) dexGrid.appendChild(dexCard(type));
    const baseCaught = BASE_TYPE_KEYS.filter((k) => (state.save.dexCounts[k] || 0) > 0).length;
    const moonCaught = TYPE_KEYS.some(
      (k) => PLUSH_TYPES[k].rarity === "secret" && (state.save.dexCounts[k] || 0) > 0,
    );
    dexTitle.textContent = `도감 ${baseCaught}/${BASE_TYPE_KEYS.length}` + (moonCaught ? " + 달토끼" : "");
    dexOverlay.classList.remove("hidden");
    state.paused = true;
    AudioFx.stopMotor();
  }

  function closeDex() {
    dexOverlay.classList.add("hidden");
    Input.grabQueued = false;
    state.paused = document.hidden || overlayOpen();
  }

  function overlayOpen() {
    return [dexOverlay, roomOverlay, gateOverlay, breakOverlay, timeOverlay].some(
      (el) => !el.classList.contains("hidden"),
    );
  }

  // ---- 보호자 확인: 아이 모드에서 밖으로 나가는 동작(공유·도전장·사진) 앞에 둔다 ----
  const gateOverlay = document.getElementById("gateOverlay");
  const gateQ = document.getElementById("gateQ");
  const gateChoices = document.getElementById("gateChoices");
  const GATE_LOCK = 15;
  let gateLockUntil = 0;
  let gateResolve = null;

  function finishGate(ok) {
    gateOverlay.classList.add("hidden");
    Input.grabQueued = false;
    state.paused = document.hidden || overlayOpen();
    const done = gateResolve;
    gateResolve = null;
    if (done) done(ok);
  }

  function parentGate() {
    if (!kidOn()) return Promise.resolve(true);
    const wait = Math.ceil((gateLockUntil - performance.now()) / 1000);
    if (wait > 0) {
      toast(`${wait}초 뒤에 어른과 함께 다시 해요`, "fail");
      return Promise.resolve(false);
    }
    if (gateResolve) finishGate(false);
    const q = Fun.parentQuestion();
    gateQ.textContent = q.label;
    gateChoices.innerHTML = "";
    for (const v of q.choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "primary";
      b.textContent = String(v);
      b.addEventListener("click", () => {
        const ok = Fun.checkParent(q, v);
        if (!ok) {
          gateLockUntil = performance.now() + GATE_LOCK * 1000;
          toast("어른에게 부탁해요!", "fail");
        }
        finishGate(ok);
      });
      gateChoices.appendChild(b);
    }
    gateOverlay.classList.remove("hidden");
    state.paused = true;
    AudioFx.stopMotor();
    return new Promise((res) => {
      gateResolve = res;
    });
  }

  document.getElementById("gateCancel").addEventListener("click", () => finishGate(false));

  // ---- 내 인형 방 ----
  const roomOverlay = document.getElementById("roomOverlay");
  const roomCanvas = document.getElementById("roomCanvas");
  const roomCtx = roomCanvas.getContext("2d");
  const roomNameBtn = document.getElementById("roomNameBtn");
  const roomNameRow = document.getElementById("roomNameRow");
  const roomNameInput = document.getElementById("roomNameInput");
  const NAMES = Object.fromEntries(TYPE_KEYS.map((k) => [k, PLUSH_TYPES[k].name]));
  const roomUi = { open: false, list: [], anim: {}, fx: [], selected: null, drag: null, last: 0, time: 0 };

  function roomResidents() {
    return Room.residents(state.save.dexCounts, state.save.room, TYPE_KEYS, NAMES);
  }

  function saveRoom(room) {
    state.save = Save.setRoom(state.save, room);
    Save.store(storage, state.save);
    roomUi.list = roomResidents();
  }

  function selectResident(type) {
    roomUi.selected = type;
    roomNameBtn.disabled = !type;
    if (!type) roomNameRow.hidden = true;
  }

  function openRoom() {
    roomUi.list = roomResidents();
    roomUi.anim = {};
    roomUi.fx = [];
    selectResident(null);
    document.getElementById("roomTitle").textContent = roomUi.list.length
      ? `내 인형 방 · 친구 ${roomUi.list.length}`
      : "내 인형 방";
    roomOverlay.classList.remove("hidden");
    state.paused = true;
    AudioFx.stopMotor();
    if (!roomUi.open) {
      roomUi.open = true;
      roomUi.last = performance.now();
      requestAnimationFrame(roomFrame);
    }
  }

  function closeRoom() {
    roomOverlay.classList.add("hidden");
    roomUi.open = false;
    roomUi.drag = null;
    roomNameRow.hidden = true;
    Input.grabQueued = false;
    state.paused = document.hidden || overlayOpen();
  }

  function roomFrame(now) {
    if (!roomUi.open) return;
    const dt = Math.min(0.05, (now - roomUi.last) / 1000);
    roomUi.last = now;
    roomUi.time += dt;
    for (const k of Object.keys(roomUi.anim)) {
      const a = roomUi.anim[k];
      a.bounce = Math.max(0, (a.bounce || 0) - dt * 1.4);
    }
    for (const p of roomUi.list) {
      const a = roomUi.anim[p.type] || (roomUi.anim[p.type] = {});
      a.blinkT = (a.blinkT == null ? 1 + Math.random() * 3 : a.blinkT) - dt;
      a.blink = a.blinkT < 0.12 && a.blinkT > 0 ? 0.1 : 1;
      if (a.blinkT <= 0) a.blinkT = 2 + Math.random() * 3;
    }
    roomUi.fx = roomUi.fx.filter((f) => (f.life -= dt * 1.1) > 0);
    for (const f of roomUi.fx) {
      f.y -= dt * 40;
      f.x += f.vx * dt;
    }
    roomCtx.setTransform(roomCanvas.width / Room.W, 0, 0, roomCanvas.height / Room.H, 0, 0);
    Room.paint(roomCtx, roomUi.list, {
      time: roomUi.time,
      anim: roomUi.anim,
      fx: roomUi.fx,
      selected: roomUi.selected,
      dragging: roomUi.drag && roomUi.drag.moved ? roomUi.drag.type : null,
    });
    requestAnimationFrame(roomFrame);
  }

  function roomPoint(e) {
    const r = roomCanvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * Room.W, y: ((e.clientY - r.top) / r.height) * Room.H };
  }

  function petResident(type) {
    const p = roomUi.list.find((q) => q.type === type);
    if (!p) return;
    const before = Room.hearts(p.pets);
    saveRoom(Room.pet(state.save.room, type));
    const a = roomUi.anim[type] || (roomUi.anim[type] = {});
    a.bounce = 1;
    for (let i = 0; i < 3; i++) roomUi.fx.push({ x: p.x + (i - 1) * 10, y: p.y - 26, vx: (i - 1) * 18, life: 1 });
    AudioFx.tone(660 + Math.random() * 180, 0.12, "sine", 0.12, 1.4);
    const after = Room.hearts(p.pets + 1);
    if (after > before) toast(`${p.name}와(과) 더 친해졌어요! ♥${after}`, "win");
    if (navigator.vibrate) navigator.vibrate(12);
  }

  roomCanvas.addEventListener("pointerdown", (e) => {
    const pt = roomPoint(e);
    const p = Room.hit(roomUi.list, pt.x, pt.y);
    if (!p) {
      selectResident(null);
      return;
    }
    roomCanvas.setPointerCapture(e.pointerId);
    roomUi.drag = { type: p.type, id: e.pointerId, sx: pt.x, sy: pt.y, ox: p.x - pt.x, oy: p.y - pt.y, moved: false };
    selectResident(p.type);
  });
  roomCanvas.addEventListener("pointermove", (e) => {
    const d = roomUi.drag;
    if (!d || d.id !== e.pointerId) return;
    const pt = roomPoint(e);
    if (!d.moved && Math.hypot(pt.x - d.sx, pt.y - d.sy) < 8) return;
    d.moved = true;
    const p = roomUi.list.find((q) => q.type === d.type);
    const pos = Room.clampPos(pt.x + d.ox, pt.y + d.oy);
    p.x = pos.x;
    p.y = pos.y;
  });
  const endRoomDrag = (e) => {
    const d = roomUi.drag;
    if (!d || d.id !== e.pointerId) return;
    roomUi.drag = null;
    if (d.moved) {
      const p = roomUi.list.find((q) => q.type === d.type);
      saveRoom(Room.move(state.save.room, d.type, p.x, p.y));
    } else if (e.type === "pointerup") {
      petResident(d.type);
    }
  };
  roomCanvas.addEventListener("pointerup", endRoomDrag);
  roomCanvas.addEventListener("pointercancel", endRoomDrag);

  roomNameBtn.addEventListener("click", () => {
    if (!roomUi.selected) return;
    const p = roomUi.list.find((q) => q.type === roomUi.selected);
    roomNameRow.hidden = false;
    roomNameInput.value = p ? p.name : "";
    roomNameInput.focus();
  });
  const commitName = () => {
    if (!roomUi.selected) return;
    saveRoom(Room.rename(state.save.room, roomUi.selected, roomNameInput.value));
    roomNameRow.hidden = true;
    roomNameInput.blur();
    toast("이름을 지었어요!", "win");
  };
  document.getElementById("roomNameSave").addEventListener("click", commitName);
  roomNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commitName();
  });

  function roomPhoto() {
    const c = document.createElement("canvas");
    c.width = Room.W * 2;
    c.height = Room.H * 2 + 120;
    const g = c.getContext("2d");
    g.fillStyle = "#1a0b2c";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#ffeaf4";
    g.font = "44px 'Bagel Fat One', 'Jua', sans-serif";
    g.textAlign = "center";
    g.fillText("내 인형 방", c.width / 2, 72);
    g.save();
    g.translate(0, 100);
    g.scale(2, 2);
    Room.paint(g, roomUi.list, { time: roomUi.time, anim: {} });
    g.restore();
    return c;
  }

  let photographing = false;
  document.getElementById("roomPhotoBtn").addEventListener("click", async () => {
    if (photographing) return;
    if (!roomUi.list.length) {
      toast("먼저 인형을 데려와요!", "fail");
      return;
    }
    photographing = true;
    try {
      if (!(await parentGate())) return;
      const result = await Share.shareCanvas(roomPhoto(), "몰랑크레인 내 인형 방 🧸", "molang-room.png");
      if (result === "cancelled") return;
      const msgs = { shared: "공유 완료!", copied: "사진이 복사됐어요", downloaded: "사진을 저장했어요", fail: "사진 저장에 실패했어요…" };
      toast(msgs[result] || msgs.fail, result === "fail" ? "fail" : "win");
    } finally {
      photographing = false;
    }
  });
  document.getElementById("roomCloseBtn").addEventListener("click", closeRoom);
  document.getElementById("roomBtn").addEventListener("click", openRoom);
  document.getElementById("overRoomBtn").addEventListener("click", openRoom);
  roomOverlay.addEventListener("click", (e) => {
    if (e.target === roomOverlay) closeRoom();
  });

  // ---- 첫 플레이 손가락 튜토리얼 ----
  const tutorialEl = document.getElementById("tutorial");

  function tutorialVisible() {
    return !tutorialEl.hidden;
  }

  function placeTutorial() {
    const host = document.getElementById("viewport").getBoundingClientRect();
    const joy = document.getElementById("joyBase");
    const grabBtn = document.querySelector("#grabBtn .gumball");
    const touch = joy.offsetParent !== null;
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - host.left, y: r.top + r.height / 2 - host.top };
    };
    const j = touch ? center(joy) : { x: host.width / 2, y: host.height * 0.62 };
    const g = grabBtn.offsetParent !== null ? center(grabBtn) : j;
    // 손가락 이모지의 끝이 목표 지점을 가리키도록 살짝 당긴다
    const hand = (pt, axis) => `${Math.round(pt[axis] - (axis === "x" ? 16 : 4))}px`;
    tutorialEl.style.setProperty("--jx", hand(j, "x"));
    tutorialEl.style.setProperty("--jy", hand(j, "y"));
    tutorialEl.style.setProperty("--gx", hand(g, "x"));
    tutorialEl.style.setProperty("--gy", hand(g, "y"));
    document.getElementById("tutMove").textContent = touch
      ? "① 동그라미를 밀어 집게를 옮겨요"
      : "① 방향키로 집게를 옮겨요";
    document.getElementById("tutTap").textContent = touch ? "② 인형 위에서 집기를 톡!" : "② 인형 위에서 스페이스!";
  }

  function showTutorial() {
    if (state.save.tutorialDone) return;
    placeTutorial();
    tutorialEl.hidden = false;
  }

  function finishTutorial() {
    if (!tutorialVisible()) return;
    tutorialEl.hidden = true;
    state.save = Save.finishTutorial(state.save);
    Save.store(storage, state.save);
  }

  window.addEventListener("resize", () => {
    if (tutorialVisible()) placeTutorial();
  });

  // ---- 하루 놀이 시간 알림 (아이 모드) ----
  const breakOverlay = document.getElementById("breakOverlay");
  const timeOverlay = document.getElementById("timeOverlay");
  const timeBtn = document.getElementById("timeBtn");
  const EXTRA_MIN = 10;
  const playClock = { pending: 0, warned: false };

  function playStatus() {
    return Fun.playStatus(
      (state.save.daily.playSec || 0) + playClock.pending,
      kidOn() ? state.save.playLimit : 0,
      state.save.daily.extraMin || 0,
    );
  }

  function flushPlayTime() {
    if (playClock.pending <= 0) return;
    state.save = Save.addPlayTime(state.save, playClock.pending);
    playClock.pending = 0;
    Save.store(storage, state.save);
  }

  function syncTimeBtn() {
    timeBtn.hidden = !kidOn();
    const limit = state.save.playLimit;
    if (!limit) {
      timeBtn.textContent = "놀이 시간 알림 끔 ⏰";
      return;
    }
    const st = playStatus();
    const left = Math.ceil(st.remain / 60);
    timeBtn.textContent = st.over ? `놀이 시간 ${limit}분 · 오늘은 끝 ⏰` : `놀이 시간 ${limit}분 · ${left}분 남음 ⏰`;
  }

  function tickPlayTime(dt) {
    if (state.mode === "title" || state.mode === "gameover") return;
    playClock.pending += dt;
    if (playClock.pending >= 5) flushPlayTime();
    const st = playStatus();
    if (st.warn && !playClock.warned) {
      playClock.warned = true;
      toast(`${Math.ceil(st.remain / 60)}분 뒤에 쉬는 시간이에요`, "win");
    }
    if (!st.warn) playClock.warned = false;
  }

  function breakDue() {
    return playStatus().over;
  }

  function showBreak() {
    flushPlayTime();
    finishTutorial();
    const played = Math.round((state.save.daily.playSec || 0) / 60);
    document.getElementById("breakLead").textContent =
      `오늘 ${played}분 동안 놀았어요. 인형들도 코— 잘 시간이에요. 내일 또 만나요 🌙`;
    breakOverlay.classList.remove("hidden");
    state.paused = true;
    AudioFx.stopMotor();
  }

  function hideBreak() {
    breakOverlay.classList.add("hidden");
    Input.grabQueued = false;
    state.paused = document.hidden || overlayOpen();
  }

  document.getElementById("breakOkBtn").addEventListener("click", () => {
    hideBreak();
    endGame();
    document.getElementById("overEyebrow").textContent = "오늘 놀이 시간 끝!";
    syncTimeBtn();
  });
  document.getElementById("breakMoreBtn").addEventListener("click", async () => {
    if (!(await parentGate())) return;
    state.save = Save.addExtraTime(state.save, EXTRA_MIN);
    Save.store(storage, state.save);
    hideBreak();
    syncTimeBtn();
    toast(`${EXTRA_MIN}분 더 놀아요!`, "win");
  });

  function openTimeSettings() {
    const box = document.getElementById("timeChoices");
    box.innerHTML = "";
    for (const min of Save.LIMITS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "primary" + (state.save.playLimit === min ? " picked" : "");
      b.textContent = min ? `${min}분` : "끔";
      b.addEventListener("click", () => {
        state.save = Save.setPlayLimit(state.save, min);
        Save.store(storage, state.save);
        closeTimeSettings();
        syncTimeBtn();
        toast(min ? `하루 ${min}분으로 정했어요` : "놀이 시간 알림을 껐어요", "win");
      });
      box.appendChild(b);
    }
    timeOverlay.classList.remove("hidden");
    state.paused = true;
  }

  function closeTimeSettings() {
    timeOverlay.classList.add("hidden");
    Input.grabQueued = false;
    state.paused = document.hidden || overlayOpen();
  }

  timeBtn.addEventListener("click", async () => {
    if (!(await parentGate())) return;
    openTimeSettings();
  });
  document.getElementById("timeCloseBtn").addEventListener("click", closeTimeSettings);

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
    flushPlayTime();
    state.save = Save.touchDaily(state.save, today).data;
    state.mission = Fun.dailyMission(BASE_TYPE_KEYS, today);
    state.missionDone = !!state.save.daily.missionDone;
    syncKidHud();
    syncTimeBtn();
  }

  function collect(plush) {
    if (plush.collected) return;
    ensureToday();
    plush.collected = true;
    plush.react = "success";
    Composite.remove(engine.world, plush.body);
    const quick = state.quickGrab;
    state.quickGrab = false;
    state.score += plush.points + (quick ? QUICK.points : 0);
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
    if (quick) msg += ` · 빠른 손 +${QUICK.points}`;
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

  // 팝업이 열려 있으면 게임 화면 안 토스트가 가려지므로 화면 맨 위에 띄운다.
  // 팝업 중에는 게임 루프가 멈춰 있어 타이머도 따로 돈다.
  const floatToastEl = document.getElementById("floatToast");
  let floatToastTimer = 0;

  function anyOverlayVisible() {
    return [titleOverlay, overOverlay, dexOverlay, roomOverlay, gateOverlay, breakOverlay, timeOverlay].some(
      (el) => el && !el.classList.contains("hidden"),
    );
  }

  function toast(msg, kind) {
    if (anyOverlayVisible()) {
      floatToastEl.hidden = false;
      floatToastEl.textContent = msg;
      floatToastEl.className = `toast float ${kind || ""}`;
      clearTimeout(floatToastTimer);
      floatToastTimer = setTimeout(() => {
        floatToastEl.hidden = true;
      }, 1600);
      return;
    }
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
    grabLabel.textContent = mode === "descending" && !kidOn() ? "닫기" : "집기";
    if (mode === "aiming") state.aimTime = 0;
  }

  function spendAndDrop() {
    if (state.coins <= 0) {
      endGame();
      return;
    }
    state.coins -= 1;
    state.quickGrab = state.aimTime <= QUICK.window;
    coinEl.textContent = String(state.coins);
    AudioFx.grab();
    setMode("descending");
  }

  function endGame() {
    flushPlayTime();
    syncTimeBtn();
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
    document.getElementById("overEyebrow").textContent = state.challenge
      ? state.score > state.challenge.score
        ? "도전 성공! 친구 기록을 이겼어요"
        : `아깝다! 친구 기록 ${state.challenge.score}점`
      : res.isBest
        ? "최고 기록 갱신!"
        : state.missionDone
          ? "부탁도 해냈어요"
          : state.prizes === 0
            ? kidOn()
              ? "다음엔 꼭 데려오자!"
              : "집게가 오늘따라 더 약해요"
            : "오늘 밤의 수확";
    document.getElementById("overTitle").textContent = kidOn() ? "오늘 데려온 친구들!" : "게임 오버";
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
    showTutorial();
    syncTimeBtn();
    if (state.challenge) toast(`친구 기록 ${state.challenge.score}점에 도전!`, "win");
    else if (bonusToast) toast(bonusToast, "win");
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

    tickPlayTime(dt);
    const rawGrab = Input.consumeGrab();
    const grab = rawGrab && state.ignoreGrab <= 0;
    const vec = Input.vector();

    if (state.mode === "title" && grab) {
      startGame();
    } else if (state.mode === "gameover" && grab) {
      startGame();
    } else if (state.mode === "aiming") {
      state.aimTime += dt;
      claw.x += vec.x * CLAW_SPEED * dt;
      claw.y += vec.y * CLAW_SPEED * dt;
      keepClawInBox();
      state.lastAim.x = claw.x;
      state.lastAim.y = claw.y;
      if (vec.mag > 0.08) AudioFx.startMotor();
      else AudioFx.stopMotor();
      if (breakDue()) showBreak();
      else if (grab) {
        finishTutorial();
        spendAndDrop();
      }
    } else {
      AudioFx.stopMotor();
    }

    if (state.mode === "descending") {
      claw.z = Math.max(0, claw.z - dt * 0.95);
      // 아이 모드는 한 번만 누르면 되도록 바닥에 닿을 때 자동으로 닫는다
      const canClose = claw.z <= 0.38 && !kidOn();
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
  document.getElementById("kidBtn").addEventListener("click", () => setKidMode(!kidOn()));
  syncKidMode();
  document.getElementById("retryBtn").addEventListener("click", startGame);
  let sharing = false;
  document.getElementById("shareBtn").addEventListener("click", async () => {
    if (sharing) return;
    sharing = true;
    try {
      if (!(await parentGate())) return;
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
  let challenging = false;
  document.getElementById("challengeBtn").addEventListener("click", async () => {
    if (challenging) return;
    challenging = true;
    try {
      if (!(await parentGate())) return;
      const code = Fun.encodeChallenge({ score: state.score, prizes: state.prizes, dayKey: Fun.dayKey() });
      const url = `${location.origin}${location.pathname}?vs=${code}`;
      const text = `몰랑크레인에서 ${state.score}점! 나를 이겨봐 ⚔️`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "몰랑크레인 도전장", text, url });
          toast("도전장을 보냈어요!", "win");
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(`${text} ${url}`);
          toast("도전장 링크 복사 완료!", "win");
          return;
        } catch (_) {
          /* 권한 거부 시 아래 실패 토스트 */
        }
      }
      toast("링크 복사에 실패했어요…", "fail");
    } finally {
      challenging = false;
    }
  });
  dexBar.addEventListener("click", () => {
    AudioFx.bump();
    openDex();
  });
  dexBar.addEventListener("keydown", (e) => {
    if (e.key === "Enter") openDex();
  });
  document.getElementById("dexCloseBtn").addEventListener("click", closeDex);
  dexOverlay.addEventListener("click", (e) => {
    if (e.target === dexOverlay) closeDex();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!gateOverlay.classList.contains("hidden")) finishGate(false);
    else if (!roomOverlay.classList.contains("hidden")) closeRoom();
    else if (!dexOverlay.classList.contains("hidden")) closeDex();
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
    state.paused = document.hidden || overlayOpen();
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
        challenge: state.challenge ? { score: state.challenge.score, dayKey: state.challenge.dayKey } : null,
        aimTime: Math.round(state.aimTime * 10) / 10,
        quickWindow: QUICK.window,
        pityAt: Grip.PITY_AT,
        kidMode: kidOn(),
        pityAtNow: Grip.pityAt(kidOn()),
        tutorial: tutorialVisible(),
        play: {
          sec: Math.round((state.save.daily.playSec || 0) + playClock.pending),
          limit: state.save.playLimit,
          extra: state.save.daily.extraMin || 0,
          breakOpen: !breakOverlay.classList.contains("hidden"),
        },
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
    setKidMode,
    openRoom,
    closeRoom,
    room() {
      return roomResidents().map((p) => ({ type: p.type, x: p.x, y: p.y, name: p.name, pets: p.pets }));
    },
    addPlayTime(sec) {
      state.save = Save.addPlayTime(state.save, sec);
      Save.store(storage, state.save);
      syncTimeBtn();
    },
    gateOpen() {
      return !gateOverlay.classList.contains("hidden");
    },
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
