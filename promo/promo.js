// 몰랑크레인 홍보 영상 (세로 1080x1920 · 가로 1920x1080, 30fps, 22초). 가로형은 ?format=landscape 또는 PROMO.setFormat("landscape").
// 편집본: ?cut=short(15초) · kids(아이용 20초) · parents(부모용 24.4초) 또는 PROMO.setCut(). 컷 없이 열면 기본 22초.
// 게임의 실제 그림 함수(Draw, MyPlush, Room, Village)로 장면을 그린다.
// renderFrame(t)는 t(초)만으로 그림이 정해지는 순수 함수다 (Math.random·Date.now 없음).
(function () {
  "use strict";

  const W = 1080;
  const H = 1920;
  const FPS = 30;
  const DUR = 22;
  const HOLD_T = DUR - 0.5; // 끝 0.5초는 완전히 멈춘 화면 (썸네일·반복 재생용)
  const TAU = Math.PI * 2;

  const canvas = document.getElementById("promo");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  // 화면 형식: "vertical"(1080x1920, 기본) 또는 "landscape"(1920x1080, 유튜브·플레이 스토어)
  let FORMAT = "vertical";
  let capSink = null; // 가로형에서 자막을 모아 두는 곳
  let BUBBLE_K = 1; // 말풍선 크기 배율 (가로형은 무대가 줄어드니 키운다)
  // 편집본(컷): "full"(기본 22초) · "short"(15초) · "kids"(아이용 20초) · "parents"(부모용 24.4초). ?cut= 또는 PROMO.setCut()
  let CUT = "full";
  let capHook = null; // 컷마다 장면 속 자막을 바꾸거나 끈다 (기본 컷에서는 null이라 그림이 그대로)
  let BEAR_HOME = false; // 짧은 컷: 사진 속 곰돌이를 옮기기 전 자리에 둔다
  let END_PILL_K = 1; // 엔드 카드 안심 문구 크기 배율
  let CL = null; // 부모님 체크 목록 표 (null이면 기본 22초 컷의 표)

  const C = {
    night: "#1a0b2c",
    plum: "#351450",
    grape: "#5a2d86",
    pink: "#ff79c7",
    lemon: "#ffe36a",
    mint: "#63f0c8",
    cream: "#fff0f8",
    ink: "#3a1450",
  };

  // ---------- 수학 도우미 ----------
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SEED = 20261105;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outQuad: (k) => 1 - (1 - k) * (1 - k),
    inQuad: (k) => k * k,
    inCubic: (k) => k * k * k,
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    outBack: (k) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    },
    inBack: (k) => 2.70158 * k * k * k - 1.70158 * k * k,
  };
  // 몰랑 스프링: 착지·부품 교체마다 같은 탄성
  const spring = (dt) => (dt < 0 ? 0 : Math.exp(-8 * dt) * Math.cos(28 * dt));
  const squash = (dt, amp = 1) => {
    const d = spring(dt) * amp;
    return { squashX: 0.2 * d, squashY: -0.25 * d };
  };
  const pt = (x, y) => ({ x, y });

  // ---------- 배경 ----------
  const bgRng = mulberry32(SEED);
  const STARS = Array.from({ length: 64 }, () => ({
    x: bgRng() * W,
    y: bgRng() * H,
    r: 4 + bgRng() * 9,
    c: bgRng() < 0.6 ? C.lemon : C.pink,
    d: 0.3 + bgRng() * 0.7,
  }));

  function backdrop(t, parallax = 0, flash = false) {
    if (flash) {
      ctx.fillStyle = C.grape;
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createRadialGradient(540, 860, 60, 540, 960, 1250);
      g.addColorStop(0, C.plum);
      g.addColorStop(1, C.night);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    STARS.forEach((s, i) => {
      const a = clamp(0.4 + 0.6 * Math.sin(3 * t + i));
      let x = s.x + parallax * s.d;
      x = ((x % (W + 40)) + W + 40) % (W + 40) - 20;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = s.c;
      Draw.star(ctx, x, s.y, s.r, 4, 0.42);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // ---------- 글자 ----------
  // 띄어쓰기 단위로 줄 나눔 (현재 ctx.font 기준)
  function wrapLines(text, maxW) {
    const words = text.split(" ");
    const out = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(next).width > maxW) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  }

  function fitFont(text, size, maxW, family = "Jua") {
    let s = size;
    ctx.font = `${s}px '${family}'`;
    while (ctx.measureText(text).width > maxW && s > 20) {
      s -= 2;
      ctx.font = `${s}px '${family}'`;
    }
    return s;
  }

  // 큰 제목 자막: 크림색 + 보라 테두리 + 분홍 빛
  function caption(text, y, opts = {}) {
    const size = opts.size || 110;
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    if (alpha <= 0) return;
    if (capHook && !opts.own) {
      const r = capHook(text, y, opts);
      if (r === false) return;
      if (typeof r === "string") text = r;
    }
    // 가로형: 자막은 왼쪽 칸에 따로 모아 그린다 (세로형은 capSink가 없어 그대로)
    if (capSink) {
      capSink.push({ text, y, opts, alpha: ctx.globalAlpha * alpha });
      return;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    const s = fitFont(text, size, opts.maxW || 880);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(540 + (opts.dx || 0), y + (opts.dy || 0));
    const sc = opts.scale == null ? 1 : opts.scale;
    ctx.scale(sc * (opts.sx || 1), sc * (opts.sy || 1));
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = opts.sub ? 14 : 20;
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = opts.sub ? 18 : 30;
    ctx.strokeText(text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = opts.color || (opts.sub ? C.lemon : C.cream);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    void s;
  }

  // 자막이 톡 튀어나오는 크기
  const popIn = (t, t0, d = 0.28) => E.outBack(seg(t, t0, t0 + d));

  function pill(x, y, text, opts = {}) {
    const size = opts.size || 48;
    ctx.save();
    ctx.font = `${size}px 'Jua'`;
    const tw = ctx.measureText(text).width;
    const pad = opts.pad || 36;
    const icon = opts.icon ? size * 1.1 : 0;
    const w = tw + pad * 2 + icon;
    const h = size * 1.8;
    ctx.translate(x, y);
    const sc = opts.scale == null ? 1 : opts.scale;
    ctx.scale(sc, sc);
    ctx.shadowColor = opts.glow || "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = opts.bg || C.pink;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.fillStyle = opts.color || "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, icon / 2, 2);
    if (opts.icon) opts.icon(-w / 2 + pad + icon * 0.4, 0, size);
    ctx.restore();
  }

  // ---------- 손가락 (캔버스 도형만) ----------
  function finger(x, y, press = 0, alpha = 1, rot = -0.42) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    const s = 1 - press * 0.1;
    ctx.scale(s, s);
    ctx.shadowColor = "rgba(20, 6, 30, 0.45)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.cream;
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-58, 150, 150, 170, 64);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-32, -4, 64, 210, 32);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.pink;
    ctx.beginPath();
    ctx.ellipse(0, 30, 18, 23, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(-6, 22, 5, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 45, 134, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-14, 112);
    ctx.lineTo(14, 112);
    ctx.stroke();
    ctx.restore();
  }

  function ripple(x, y, dt, color, maxR = 120, rings = 2) {
    if (dt < 0 || dt > 0.8) return;
    ctx.save();
    for (let i = 0; i < rings; i++) {
      const k = seg(dt, i * 0.12, 0.5 + i * 0.12);
      if (k <= 0 || k >= 1) continue;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = color;
      ctx.lineWidth = 12 * (1 - k) + 3;
      ctx.beginPath();
      ctx.arc(x, y, 20 + maxR * E.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 별·하트 폭죽: 위치는 i와 dt만으로 정해진다
  function burst(x, y, dt, o = {}) {
    if (dt < 0 || dt > 1.3) return;
    const n = o.stars == null ? 14 : o.stars;
    const h = o.hearts == null ? 6 : o.hearts;
    const dist = o.dist || 320;
    const sc = o.scale || 1;
    const r = mulberry32(o.seed || SEED);
    ctx.save();
    if (o.core !== false) {
      const ca = 1 - seg(dt, 0, o.coreDur || 0.3);
      if (ca > 0) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 160 * sc);
        g.addColorStop(0, `rgba(255,255,255,${ca})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 160 * sc, 0, TAU);
        ctx.fill();
      }
    }
    for (let i = 0; i < n + h; i++) {
      const a = r() * TAU;
      const d = dist * (0.55 + 0.45 * r());
      const size = (16 + r() * 18) * sc;
      const spin = (r() - 0.5) * 6;
      const col = [C.lemon, C.pink, C.mint, C.cream][i % 4];
      const k = E.outCubic(clamp(dt / 0.7));
      const px = x + Math.cos(a) * d * k;
      const py = y + Math.sin(a) * d * k + 90 * dt * dt;
      ctx.globalAlpha = 1 - seg(dt, 0.5, 1.2);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(spin * dt);
      if (i < n) {
        ctx.fillStyle = i % 3 === 1 ? C.pink : C.lemon;
        Draw.star(ctx, 0, 0, size, 5, 0.45);
      } else {
        ctx.fillStyle = i % 2 ? "#ff5c9a" : C.pink;
        Draw.heart(ctx, 0, 0, size * 0.9);
      }
      ctx.fill();
      void col;
      ctx.restore();
    }
    ctx.restore();
  }

  // 작은 별 6개 고리 (부품이 바뀔 때)
  function sparkRing(x, y, dt, R = 260, size = 18) {
    if (dt < 0 || dt > 0.6) return;
    const k = E.outCubic(dt / 0.6);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      ctx.fillStyle = i % 2 ? C.pink : C.lemon;
      Draw.star(ctx, x + Math.cos(a) * R * (0.75 + 0.35 * k), y + Math.sin(a) * R * (0.75 + 0.35 * k), size * (1 - 0.4 * k), 4, 0.42);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 화면 카드 ----------
  const CARD = { x: 57, y: 510, w: 966, h: 1150, r: 46 };
  function cardRect(w, h) {
    return { x: 540 - w / 2, y: 1085 - h / 2, w, h, r: 46 };
  }
  function cardFrame(R, inside, opts = {}) {
    ctx.save();
    ctx.shadowColor = "rgba(255, 121, 199, 0.55)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = opts.bg || "#2a1148";
    ctx.beginPath();
    ctx.roundRect(R.x, R.y, R.w, R.h, R.r);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(R.x, R.y, R.w, R.h, R.r);
    ctx.clip();
    inside();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = opts.border || C.pink;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(R.x, R.y, R.w, R.h, R.r);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 뽑기 기계 ----------
  const lay = mulberry32(SEED ^ 0x5bd1e995);
  const j = (v) => v + (lay() - 0.5) * 10;
  const BASE = [
    ["bunny", 88, 165],
    ["cat", 220, 128],
    ["chick", 330, 100],
    ["frog", 345, 212],
    ["star", 60, 262],
    ["puppy", 292, 202],
    ["berry", 192, 196],
    ["bear", 145, 258],
    ["pig", 268, 330],
    ["penguin", 80, 352],
    ["panda", 150, 398],
    ["unicorn", 345, 352],
  ].map(([type, x, y]) => ({
    type,
    x: j(x),
    y: j(y),
    angle: (lay() - 0.5) * 0.5,
    radius: PLUSH_TYPES[type].radius,
    blinkPh: lay() * 10,
  }));
  const basePlush = (type) => BASE.find((p) => p.type === type);
  const blinkAt = (t, ph) => (((t + ph) % 3.1) < 0.12 ? 0.1 : 1);

  function plushAt(p, t, extra) {
    return Object.assign(
      {
        type: p.type,
        x: p.x,
        y: p.y,
        radius: p.radius,
        angle: p.angle,
        blink: blinkAt(t, p.blinkPh),
        react: "idle",
        liftZ: 0,
      },
      extra || {},
    );
  }

  function drawMachine(list, claw, opts = {}) {
    Draw.field(ctx);
    const floor = [];
    const air = [];
    for (const p of list) ((p.liftZ || 0) > 0.08 ? air : floor).push(p);
    floor.sort((a, b) => a.y - b.y);
    air.sort((a, b) => a.y - b.y);
    for (const p of floor) drawPlushScaled(p);
    if (claw) Draw.gantry(ctx, claw);
    for (const p of air) drawPlushScaled(p);
    if (claw) Draw.claw(ctx, claw);
    if (opts.after) opts.after();
  }

  function drawPlushScaled(p) {
    if (p.scale != null && p.scale !== 1) {
      if (p.scale <= 0.01) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);
      ctx.translate(-p.x, -p.y);
      Draw.plush(ctx, p);
      ctx.restore();
    } else Draw.plush(ctx, p);
  }

  function camTransform(cx, cy, z) {
    ctx.translate(540, 1085);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);
  }
  const w2s = (cx, cy, z, wx, wy) => pt(540 + (wx - cx) * z, 1085 + (wy - cy) * z);

  // ================= 장면 1: 아깝다… 쏙! (0–1.8) =================
  function hookState(t) {
    const bear = basePlush("bear");
    let claw;
    let bearP;
    if (t < 1.0) {
      const z =
        t < 0.5 ? lerp(0.2, 1, E.inOutCubic(seg(t, 0, 0.35))) : lerp(1, 0.3, E.outCubic(seg(t, 0.5, 0.85)));
      let open = t < 0.5 ? lerp(1, 0.2, seg(t, 0.35, 0.5)) : 0.2;
      if (t > 0.72) open = lerp(0.2, 0.6, seg(t, 0.72, 0.82));
      claw = { x: bear.x, y: bear.y, z, open };
      let lift = 0;
      let react = "idle";
      let sq = { squashX: 0, squashY: 0 };
      let dx = 0;
      let ang = bear.angle;
      if (t >= 0.47 && t < 0.72) {
        lift = lerp(0, 0.6, E.outCubic(seg(t, 0.5, 0.72)));
        react = "grabbed";
        const s = spring(t - 0.47);
        sq = { squashX: -0.18 * s, squashY: 0.22 * s };
      } else if (t >= 0.72) {
        lift = lerp(0.6, 0, E.inQuad(seg(t, 0.72, 0.9)));
        react = "dropped";
        dx = 14 * E.outCubic(seg(t, 0.72, 0.9));
        ang = bear.angle + 0.5 * seg(t, 0.72, 0.9);
        if (t >= 0.9) sq = squash(t - 0.9, 1.2);
      }
      bearP = plushAt(bear, t, { x: bear.x + dx, liftZ: lift, react, angle: ang, ...sq });
    } else {
      bearP = plushAt(bear, t, { x: bear.x + 14, angle: bear.angle + 0.5, react: "dropped" });
      const k = E.inOutCubic(seg(t, 1.0, 1.38));
      claw = { x: lerp(330, CHUTE.x, k), y: lerp(372, CHUTE.y, k), z: 0.22, open: t < 1.4 ? 0.22 : lerp(0.22, 1, seg(t, 1.4, 1.5)) };
    }
    const list = [];
    for (const p of BASE) {
      if (["unicorn", "berry", "star"].includes(p.type)) continue;
      if (p.type === "bear") list.push(bearP);
      else {
        const near = Math.hypot(p.x - claw.x, p.y - claw.y);
        const wob = near < 70 && t > 0.45 && t < 1.0 ? Math.sin(t * 30 + p.x) * 0.12 * (1 - near / 70) : 0;
        list.push(plushAt(p, t, { angle: p.angle + wob }));
      }
    }
    if (t >= 1.0 && t < 1.65) {
      let sc = 1;
      if (t >= 1.4) sc = t < 1.47 ? lerp(1, 1.2, seg(t, 1.4, 1.47)) : lerp(1.2, 0, E.inBack(seg(t, 1.47, 1.62)));
      list.push({
        type: "unicorn",
        golden: true,
        x: claw.x,
        y: claw.y + 2,
        radius: PLUSH_TYPES.unicorn.radius,
        liftZ: t < 1.4 ? 0.7 : lerp(0.7, 0, seg(t, 1.4, 1.6)),
        angle: 0.15 * Math.sin(9 * t),
        react: t < 1.4 ? "airborne" : "success",
        scale: sc,
      });
    }
    return { list, claw };
  }

  function hookCam(t) {
    const k = E.inOutCubic(seg(t, 1.0, 1.2));
    return { x: lerp(165, 255, k), y: lerp(262, 318, k), z: 3.2 };
  }

  function scene1(t) {
    const st = hookState(t);
    const cam = hookCam(t);
    const flash = t >= 1.4 && t < 1.4 + 2 / FPS;
    cardFrame(CARD, () => {
      ctx.fillStyle = "#2a1148";
      ctx.fillRect(0, 0, W, H);
      const ghosts = t >= 1.0 && t < 1.2;
      if (ghosts) {
        for (let g = 3; g >= 1; g--) {
          const gc = hookCam(t - g * 0.035);
          ctx.save();
          ctx.globalAlpha = 0.3;
          camTransform(gc.x, gc.y, gc.z);
          drawMachine(st.list, st.claw);
          ctx.restore();
        }
      }
      ctx.save();
      ctx.globalAlpha = ghosts ? 0.7 : 1;
      camTransform(cam.x, cam.y, cam.z);
      drawMachine(st.list, st.claw);
      ctx.restore();
      if (flash) {
        ctx.fillStyle = "rgba(90, 45, 134, 0.45)";
        ctx.fillRect(0, 0, W, H);
      }
      const ch = w2s(cam.x, cam.y, cam.z, CHUTE.x, CHUTE.y);
      burst(ch.x, ch.y - 40, t - 1.4, { stars: 14, hearts: 6, dist: 420, seed: SEED + 1, scale: 1.3 });
      // 장면 전환: 별 폭죽의 흰 중심이 카드를 채운다
      const wk = E.inQuad(seg(t, 1.8 - 4 / FPS, 1.8));
      if (wk > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ch.x, ch.y - 40, 1700 * wk, 0, TAU);
        ctx.fill();
      }
    });
    // 자막
    if (t < 0.95) {
      const shake = t > 0.72 ? Math.sin(t * 75) * 6 : 0;
      caption("아깝다…!", 360, { size: 120, scale: popIn(t, 0.02), dx: shake, alpha: 1 - seg(t, 0.88, 0.95) });
    } else {
      caption("쏙! 잡았다!", 360, { size: 120, scale: popIn(t, 1.0) });
    }
    return flash;
  }

  // ================= 장면 2: 한 번 톡! + 도감 (1.8–5.0) =================
  const Z2 = { x: 210, y: 250, z: 2.3 };
  function grabState(t) {
    const pup = basePlush("puppy");
    const home = HOME;
    let claw;
    const mk = E.inOutCubic(seg(t, 1.95, 2.55));
    if (t < 2.65) {
      claw = { x: lerp(home.x, pup.x, mk), y: lerp(home.y, pup.y, mk), z: 0, open: 1 };
    } else if (t < 3.05) {
      claw = {
        x: pup.x,
        y: pup.y,
        z: E.inOutCubic(seg(t, 2.65, 2.9)),
        open: lerp(1, 0.15, seg(t, 2.9, 3.03)),
      };
    } else if (t < 3.25) {
      claw = { x: pup.x, y: pup.y, z: 1 - E.inOutCubic(seg(t, 3.05, 3.25)), open: 0.15 };
    } else {
      const k = E.inOutCubic(seg(t, 3.25, 3.5));
      claw = { x: lerp(pup.x, CHUTE.x, k), y: lerp(pup.y, CHUTE.y, k), z: 0, open: t < 3.5 ? 0.15 : lerp(0.15, 1, seg(t, 3.5, 3.6)) };
    }
    const list = [];
    for (const p of BASE) {
      if (p.type === "puppy") continue;
      const near = Math.hypot(p.x - claw.x, p.y - claw.y);
      const moving = t > 1.95 && t < 3.55;
      const wob = moving && near < 75 ? Math.sin(t * 24 + p.x * 0.3) * 0.16 * (1 - near / 75) : 0;
      list.push(plushAt(p, t, { angle: p.angle + wob }));
    }
    if (t < 3.75) {
      let extra = {};
      if (t < 2.98) extra = {};
      else if (t < 3.5) {
        const s = spring(t - 2.98);
        extra = {
          react: "grabbed",
          liftZ: t < 3.05 ? 0 : E.outCubic(seg(t, 3.05, 3.25)),
          squashX: -0.18 * s,
          squashY: 0.22 * s,
          x: claw.x,
          y: claw.y + 2,
          angle: 0.1 * Math.sin(t * 12),
        };
      } else {
        extra = {
          react: "success",
          x: CHUTE.x,
          y: CHUTE.y,
          liftZ: lerp(1, 0, seg(t, 3.5, 3.68)),
          scale: lerp(1, 0, E.inBack(seg(t, 3.5, 3.72))),
        };
      }
      list.push(plushAt(pup, t, extra));
    }
    return { list, claw };
  }

  const DEX = ["bear", "bunny", "cat", "chick", "frog", "penguin", "pig", "puppy", "panda", "berry", "unicorn", "star"];
  let silhouette = null;
  function makeSilhouette() {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 160;
    const x = c.getContext("2d");
    x.translate(80, 86);
    x.scale(2.2, 2.2);
    const prev = Draw._react;
    Draw.plush(x, { type: "moonbunny", x: 0, y: 0, radius: 25 });
    Draw._react = prev;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#2a1148";
    x.fillRect(0, 0, 160, 160);
    return c;
  }

  function dexStrip(t) {
    if (t <= 3.6) return;
    const k = E.outBack(seg(t, 3.6, 3.9));
    const y0 = 1172 + (1 - k) * 560; // 아래 1450px 안쪽 (쇼츠 UI 자리 피함)
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "rgba(26, 11, 44, 0.94)";
    ctx.beginPath();
    ctx.roundRect(90, y0, 900, 272, 38);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 5;
    ctx.stroke();
    for (let i = 0; i < 13; i++) {
      const row = i < 7 ? 0 : 1;
      const col = i < 7 ? i : i - 7;
      const n = row ? 6 : 7;
      const x = 540 + (col - (n - 1) / 2) * 122;
      const y = y0 + 72 + row * 128;
      const t0 = 3.78 + 0.08 * i;
      const pk = E.outBack(seg(t, t0, t0 + 0.22));
      ctx.fillStyle = "rgba(255, 240, 248, 0.12)";
      ctx.beginPath();
      ctx.arc(x, y, 54, 0, TAU);
      ctx.fill();
      if (pk <= 0) continue;
      ctx.save();
      ctx.translate(x, y + 4);
      ctx.scale(pk, pk);
      if (i < 12) {
        ctx.scale(1.9, 1.9);
        const sq = squash(t - t0 - 0.2, 0.8);
        Draw.plush(ctx, { type: DEX[i], x: 0, y: 0, radius: 18, react: "success", ...sq });
      } else {
        ctx.drawImage(silhouette, -66, -72, 132, 132);
        ctx.fillStyle = C.cream;
        ctx.font = "56px 'Jua'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", 0, 4);
      }
      ctx.restore();
      // 하트 뿅
      const hd = t - t0;
      if (i < 12 && hd > 0 && hd < 0.6) {
        ctx.save();
        ctx.globalAlpha = 1 - hd / 0.6;
        ctx.fillStyle = "#ff5c9a";
        Draw.heart(ctx, x + 38, y - 40 - hd * 60, 14);
        ctx.fill();
        ctx.restore();
      }
    }
    // 비밀 친구 반짝
    const tw = t - 4.8;
    if (tw > 0) {
      const x = 540 + (5 - 2.5) * 122;
      const y = y0 + 72 + 128;
      const a = Math.sin(clamp(tw / 0.5) * Math.PI);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = C.lemon;
      ctx.translate(x + 40, y - 42);
      ctx.rotate(tw * 3);
      Draw.star(ctx, 0, 0, 10 + 18 * a, 4, 0.35);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function scene2(t, o = {}) {
    const st = grabState(t);
    cardFrame(CARD, () => {
      ctx.save();
      camTransform(Z2.x, Z2.y, Z2.z);
      drawMachine(st.list, st.claw);
      ctx.restore();
      const ch = w2s(Z2.x, Z2.y, Z2.z, CHUTE.x, CHUTE.y);
      burst(ch.x, ch.y - 30, t - 3.5, { stars: 8, hearts: 4, dist: 230, seed: SEED + 2, scale: 0.9 });
      // 흰 빛이 줄어들며 기계 전체가 보인다
      const wk = 1 - E.outCubic(seg(t, 1.8, 1.95));
      if (wk > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ch.x, ch.y - 30, 1700 * wk, 0, TAU);
        ctx.fill();
      }
    });
    // 손가락: 왼쪽 아래에서 끌어 오고, 한 번 톡
    const c = w2s(Z2.x, Z2.y, Z2.z, st.claw.x, st.claw.y);
    const fa = seg(t, 1.85, 1.95) * (1 - seg(t, 2.75, 2.95));
    if (fa > 0) {
      const lead = E.inOutCubic(seg(t, 1.9, 2.5));
      const start = pt(200, 1560);
      const pup = basePlush("puppy");
      const tgt = w2s(Z2.x, Z2.y, Z2.z, pup.x, pup.y);
      let fx = lerp(start.x, tgt.x + 70, lead);
      let fy = lerp(start.y, tgt.y + 120, lead);
      const tapK = E.inOutCubic(seg(t, 2.48, 2.6));
      fx = lerp(fx, tgt.x + 4, tapK);
      fy = lerp(fy, tgt.y + 6, tapK);
      const press = t > 2.58 && t < 2.68 ? 1 : 0;
      const away = E.inCubic(seg(t, 2.68, 2.95));
      finger(fx + away * 160, fy + away * 260, press, fa);
    }
    ripple(c.x, c.y, t - 2.6, C.mint, 150, 2);
    if (o.dex !== false) dexStrip(t);
    caption("한 번 톡! 쉬운 뽑기", 340, { size: 110, scale: popIn(t, 1.85) });
    if (t >= 3.6 && o.dex !== false) caption("인형 12종 + 비밀 친구", 462, { size: 62, sub: true, scale: popIn(t, 3.6) });
  }

  // ================= 장면 3: 내 인형 만들기 (5.0–9.6) =================
  const IDS = MyPlush.animalIds();
  const slotK = (t) => Math.min(24, Math.floor(E.outQuad(seg(t, 5.0, 6.3)) * 24 + 1e-9));
  const stepTime = (k) => 5.0 + 1.3 * (1 - Math.sqrt(1 - k / 24));
  const PART_EVENTS = [6.4, 6.9, 7.3, 7.7, 7.9, 8.1, 8.3];
  const ACC_STEPS = [
    [7.7, "ribbon"],
    [7.9, "hat"],
    [8.1, "flower"],
    [8.3, "crown"],
  ];
  const KONGI = Object.assign(MyPlush.defaults(), {
    animal: "fox",
    color: "#7ec8ff",
    eyes: "sparkle",
    cheeks: true,
    accessory: "crown",
    persona: "hyper",
    name: "콩이",
  });
  MyPlush.spec = KONGI;

  function makerSpec(t) {
    const s = Object.assign(MyPlush.defaults(), { persona: "hyper", name: "콩이", cheeks: false, accessory: "none" });
    s.animal = IDS[slotK(t) % 20];
    s.color = MyPlush.animalColor(s.animal);
    if (t >= 6.4) s.color = "#7ec8ff";
    if (t >= 6.9) s.eyes = "sparkle";
    if (t >= 7.3) s.cheeks = true;
    for (const [at, acc] of ACC_STEPS) if (t >= at) s.accessory = acc;
    return s;
  }

  function lastEvent(t) {
    let last = -1;
    let amp = 0.55;
    const k = slotK(t);
    if (k > 0) {
      last = stepTime(k);
      amp = k === 24 ? 1.3 : 0.45;
    }
    for (const e of PART_EVENTS) if (t >= e && e > last) {
      last = e;
      amp = e === 8.3 ? 1.6 : 1;
    }
    if (t >= 8.4 && 8.4 > last) {
      last = 8.4;
      amp = 0.7;
    }
    return { at: last, amp };
  }

  const CHIP_EVENTS = [
    Array.from({ length: 24 }, (_, i) => stepTime(i + 1)),
    [6.4],
    [6.9, 7.3],
    [7.7, 7.9, 8.1, 8.3],
  ];
  const CHIP_ACTIVE = [
    [5.0, 6.35],
    [6.35, 6.85],
    [6.85, 7.65],
    [7.65, 8.9],
  ];

  function chips(t, spec, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 4; i++) {
      const x = 540 + (i - 1.5) * 150;
      let last = -9;
      for (const e of CHIP_EVENTS[i]) if (t >= e) last = e;
      const b = spring(t - last);
      const [a0, a1] = CHIP_ACTIVE[i];
      const on = t >= a0 && t < a1;
      const y = 612 - Math.max(0, b) * 22;
      const s = 1 + 0.16 * b;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s * (on ? 1.08 : 1), s * (on ? 1.08 : 1));
      ctx.fillStyle = on ? "#ffffff" : "#f6e2f0";
      ctx.strokeStyle = on ? C.pink : "rgba(90,45,134,0.35)";
      ctx.lineWidth = on ? 8 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, 54, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (i === 0) {
        ctx.scale(1.45, 1.45);
        Draw.plush(ctx, { type: "mine", x: 0, y: 3, radius: 22, spec: Object.assign({}, spec, { accessory: "none" }) });
      } else if (i === 1) {
        ctx.fillStyle = spec.color;
        ctx.strokeStyle = Draw.dark(spec.color, 0.3);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (i === 2) {
        ctx.fillStyle = C.lemon;
        ctx.strokeStyle = "#c48a00";
        ctx.lineWidth = 3;
        Draw.star(ctx, 0, 2, 32, 5, 0.48);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ff5c9a";
        Draw.heart(ctx, 0, 6, 32);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function eyeIcon(kind, x, y) {
    ctx.fillStyle = "#2a2233";
    ctx.strokeStyle = "#2a2233";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      const ex = x + s * 16;
      if (kind === "dot") {
        ctx.beginPath();
        ctx.arc(ex, y, 7, 0, TAU);
        ctx.fill();
      } else if (kind === "smile") {
        ctx.beginPath();
        ctx.arc(ex, y + 4, 8, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else if (kind === "sparkle") {
        ctx.beginPath();
        ctx.arc(ex, y, 9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ex - 3, y - 3, 3.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#2a2233";
      } else {
        ctx.beginPath();
        ctx.moveTo(ex - 8, y);
        ctx.lineTo(ex + 8, y);
        ctx.stroke();
      }
    }
  }

  // 아래쪽 선택 줄 (동물 릴 → 색 → 눈·볼 → 소품)
  function optionRow(t, spec, alpha) {
    if (alpha <= 0) return;
    const y = 1462;
    ctx.save();
    ctx.globalAlpha = alpha;
    const rowA = (a, b) => seg(t, a, a + 0.12) * (1 - seg(t, b - 0.1, b));
    // 동물 릴
    let a = rowA(4.9, 6.35);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * a;
      ctx.beginPath();
      ctx.roundRect(130, y - 80, 820, 160, 80);
      ctx.fillStyle = "rgba(90, 45, 134, 0.1)";
      ctx.fill();
      ctx.clip();
      const f = E.outQuad(seg(t, 5.0, 6.3)) * 24;
      const base = Math.floor(f);
      for (let jx = base - 4; jx <= base + 4; jx++) {
        const x = 540 + (jx - f) * 160;
        const id = IDS[((jx % 20) + 20) % 20];
        const centered = Math.abs(jx - f) < 0.5;
        ctx.save();
        ctx.translate(x, y + 6);
        const sc = centered ? 2.5 : 1.9;
        ctx.scale(sc, sc);
        Draw.plush(ctx, {
          type: "mine",
          x: 0,
          y: 0,
          radius: 22,
          spec: Object.assign(MyPlush.defaults(), { animal: id, color: MyPlush.animalColor(id), accessory: "none" }),
        });
        ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(540 - 72, y - 76, 144, 152, 30);
      ctx.stroke();
    }
    // 색
    a = rowA(6.3, 6.85);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * a;
      const cols = ["#ffb3c7", "#ffe36a", "#7de3b0", "#7ec8ff", "#d7c2ff"];
      const sel = t >= 6.4 ? 3 : -1;
      cols.forEach((c, i) => {
        const x = 540 + (i - 2) * 150;
        const b = i === sel ? spring(t - 6.4) : 0;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + 0.2 * b, 1 - 0.2 * b);
        ctx.fillStyle = c;
        ctx.strokeStyle = Draw.dark(c, 0.3);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (i === sel) {
          ctx.strokeStyle = C.pink;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.arc(0, 0, 64, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      });
      ctx.restore();
    }
    // 눈 + 볼
    a = rowA(6.8, 7.7);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * a;
      ["dot", "smile", "sparkle", "sleepy"].forEach((k, i) => {
        const x = 540 + (i - 2) * 150 - 20;
        const sel = (k === "sparkle" && t >= 6.9) || (k === "dot" && t < 6.9);
        const b = sel && k === "sparkle" ? spring(t - 6.9) : 0;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + 0.2 * b, 1 - 0.2 * b);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = sel ? C.pink : "rgba(90,45,134,0.3)";
        ctx.lineWidth = sel ? 8 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, TAU);
        ctx.fill();
        ctx.stroke();
        eyeIcon(k, 0, 0);
        ctx.restore();
      });
      // 볼터치 스위치
      const x = 540 + 2 * 150 - 10;
      const on = t >= 7.3;
      const b = on ? spring(t - 7.3) : 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 + 0.2 * b, 1 - 0.2 * b);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = on ? C.pink : "rgba(90,45,134,0.3)";
      ctx.lineWidth = on ? 8 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = on ? "rgba(255, 110, 150, 0.85)" : "rgba(200,180,200,0.6)";
      ctx.beginPath();
      ctx.ellipse(-17, 6, 13, 9, 0, 0, TAU);
      ctx.ellipse(17, 6, 13, 9, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }
    // 소품
    a = rowA(7.6, 8.95);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * a;
      const kinds = ["ribbon", "hat", "flower", "crown"];
      let selI = -1;
      ACC_STEPS.forEach(([at], i) => {
        if (t >= at) selI = i;
      });
      kinds.forEach((k, i) => {
        const x = 540 + (i - 1.5) * 170;
        const b = i === selI ? spring(t - ACC_STEPS[i][0]) : 0;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + 0.2 * b, 1 - 0.2 * b);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = i === selI ? C.pink : "rgba(90,45,134,0.3)";
        ctx.lineWidth = i === selI ? 8 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, 54, 0, TAU);
        ctx.fill();
        ctx.stroke();
        const r = 64;
        ctx.translate(k === "ribbon" ? -r * 0.5 : k === "flower" ? r * 0.6 : 0, r * (k === "hat" ? 1.05 : 0.88) - (k === "flower" ? r * 0.28 : 0));
        MyPlush.accessory(ctx, r, k);
        ctx.restore();
      });
      ctx.restore();
    }
    ctx.restore();
  }

  function makerPanel() {
    ctx.fillStyle = C.cream;
    ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
    const cols = ["#ffb3c7", "#ffe36a", "#7de3b0", "#d7c2ff"];
    ctx.save();
    ctx.globalAlpha = 0.22;
    let n = 0;
    for (let y = CARD.y + 40; y < CARD.y + CARD.h; y += 92) {
      for (let x = CARD.x + 40 + ((y / 92) % 2 ? 46 : 0); x < CARD.x + CARD.w; x += 92) {
        Draw.felt(ctx, x, y, 11, 10, cols[n++ % 4]);
      }
    }
    ctx.restore();
  }

  // 미니 기계 속 콩이 자리 (월드 좌표)
  const MINE_SPOT = { x: 216, y: 292 };
  const MINI = { cx: 540, cy: 1110, z: 1.6 };
  const MINI_LIST = BASE.filter((p) => !["unicorn"].includes(p.type));

  function miniMachine(t, k) {
    ctx.save();
    ctx.translate(MINI.cx, MINI.cy);
    ctx.scale(MINI.z * k, MINI.z * k);
    ctx.translate(-210, -250);
    ctx.shadowColor = "rgba(90,45,134,0.5)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#2a1148";
    ctx.beginPath();
    ctx.roundRect(-12, -12, 444, 524, 30);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(0, 0, 420, 500, 22);
    ctx.clip();
    drawMachine(
      MINI_LIST.map((p) => plushAt(p, t)),
      { x: 330, y: 430, z: 0, open: 0.6 },
    );
    ctx.restore();
  }

  function scene3(t) {
    const spec = makerSpec(t);
    const ev = lastEvent(t);
    const handoff = seg(t, 8.95, 9.15);
    cardFrame(
      CARD,
      () => {
        makerPanel();
        const uiA = 1 - handoff;
        chips(t, spec, uiA);
        // 큰 인형
        const flyK = E.inOutCubic(seg(t, 9.05, 9.35));
        const mk = E.outBack(seg(t, 8.95, 9.2));
        if (mk > 0) miniMachine(t, mk);
        const target = pt(MINI.cx + (MINE_SPOT.x - 210) * MINI.z, MINI.cy + (MINE_SPOT.y - 250) * MINI.z);
        const startR = 220;
        const endR = 25 * MINI.z;
        const R = lerp(startR, endR, flyK);
        const x = lerp(540, target.x, flyK);
        const y = lerp(1000, target.y, flyK) - Math.sin(flyK * Math.PI) * 260;
        let sq = squash(t - ev.at, ev.amp);
        if (t >= 8.88 && t < 9.05) {
          const a = Math.sin(seg(t, 8.88, 9.05) * Math.PI);
          sq = { squashX: 0.2 * a, squashY: -0.24 * a };
        } else if (t >= 9.05 && t < 9.35) sq = { squashX: -0.08, squashY: 0.12 };
        else if (t >= 9.35) sq = squash(t - 9.35, 1.1);
        const hop = t >= 8.3 && t < 8.6 ? -Math.sin(seg(t, 8.3, 8.6) * Math.PI) * 30 * (1 - seg(t, 8.3, 8.6)) : 0;
        const s = R / 44;
        ctx.save();
        ctx.translate(x, y + hop);
        ctx.scale(s, s);
        Draw.plush(ctx, {
          type: "mine",
          spec,
          x: 0,
          y: 0,
          radius: 44,
          blink: blinkAt(t, 0.7),
          react: t >= 9.35 ? "idle" : "idle",
          mineMark: t >= 9.35,
          ...sq,
        });
        ctx.restore();
        if (t < 8.9) sparkRing(540, 1000, t - ev.at, 270, ev.amp > 0.5 ? 24 : 0);
        sparkRing(target.x, target.y, t - 9.35, 70, 12);
        // 이름: 동물 이름표 → 콩이 이름 알약
        if (t < 8.4) {
          ctx.save();
          ctx.globalAlpha = uiA;
          ctx.font = "64px 'Jua'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = C.grape;
          ctx.fillText(I18N.t(`animal.${spec.animal}`), 540, 1300);
          ctx.restore();
        } else if (uiA > 0) {
          ctx.save();
          ctx.globalAlpha = uiA;
          pill(540, 1300, "콩이", { size: 64, bg: C.pink, color: "#ffffff", scale: popIn(t, 8.4, 0.3), pad: 56 });
          ctx.restore();
        }
        optionRow(t, spec, uiA);
        // 하트 3개 화살표
        if (t >= 9.3) {
          const a = seg(t, 9.3, 9.45);
          for (let i = 0; i < 3; i++) {
            const d = 95 + i * 78;
            const bob = Math.abs(Math.sin(t * 9 - i * 0.8)) * 14;
            const hx = target.x + d * 0.78;
            const hy = target.y - 40 - d * 0.62 - bob;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = i === 0 ? "#ff5c9a" : C.pink;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            Draw.heart(ctx, hx, hy, 34 - i * 4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
      },
      { bg: C.cream },
    );
    if (t < 9.0) {
      caption("내 인형 만들기", 340, { size: 112, scale: popIn(t, 5.02) });
      if (t < 7.45) caption("동물 20가지", 462, { size: 62, sub: true, scale: popIn(t, 5.15), alpha: 1 - seg(t, 7.3, 7.45) });
      else if (t >= 7.65) caption("리본·모자·꽃·왕관", 462, { size: 62, sub: true, scale: popIn(t, 7.65), alpha: 1 - seg(t, 8.8, 8.95) });
    } else {
      caption("기계 속에 내 인형이!", 360, { size: 104, scale: popIn(t, 9.0) });
    }
  }
  const KONGI_MINI = () => pt(MINI.cx + (MINE_SPOT.x - 210) * MINI.z, MINI.cy + (MINE_SPOT.y - 250) * MINI.z);

  // ================= 장면 4: 내 인형 방 (9.6–11.8) =================
  const ROOM_Z = 2.6;
  const ROOM_R = cardRect(Room.W * ROOM_Z, Room.H * ROOM_Z);
  const ROOM_BASE = [
    { type: "bear", x: 62, y: 196, name: "곰돌이", pets: 6 },
    { type: "bunny", x: 150, y: 186, name: "토끼", pets: 11 },
    { type: "cat", x: 240, y: 192, name: "고양이", pets: 5 },
    { type: "chick", x: 316, y: 214, name: "병아리", pets: 3 },
    { type: "puppy", x: 82, y: 306, name: "강아지", pets: 7 },
    { type: "unicorn", x: 296, y: 312, name: "유니콘", pets: 2 },
    { type: "mine", x: 192, y: 290, name: "콩이", pets: 9 },
  ];
  const STROKES = [
    [9.8, 10.05],
    [10.05, 10.3],
    [10.3, 10.55],
  ];
  const rw2s = (x, y) => pt(ROOM_R.x + x * ROOM_Z, ROOM_R.y + y * ROOM_Z);

  function scene4(t) {
    let done = 0;
    for (const [, e] of STROKES) if (t >= e) done++;
    const lastEnd = done ? STROKES[done - 1][1] : -9;
    const dragK = E.inOutCubic(seg(t, 10.85, 11.2));
    const dragging = t >= 10.8 && t < 11.22;
    const list = ROOM_BASE.map((p) => {
      const q = Object.assign({}, p);
      if (p.type === "mine") q.pets = p.pets + done;
      if (p.type === "bear") {
        q.x = lerp(p.x, 132, dragK);
        q.y = lerp(p.y, 256, dragK);
      }
      return q;
    });
    const anim = {
      mine: { bounce: done ? Math.max(0, 1 - (t - lastEnd) / 0.45) : 0, blink: t > 9.8 && t < 10.6 ? 0.2 : 1 },
      bear: { bounce: t >= 11.22 ? Math.max(0, 1 - (t - 11.22) / 0.4) : 0 },
    };
    const shutter = t - 11.4;
    cardFrame(ROOM_R, () => {
      ctx.save();
      ctx.translate(ROOM_R.x, ROOM_R.y);
      ctx.scale(ROOM_Z, ROOM_Z);
      Room.paint(ctx, list, { time: t, anim, dragging: dragging ? "bear" : null });
      ctx.restore();
      // 하트 입자
      STROKES.forEach(([s0, s1], si) => {
        const r = mulberry32(SEED + 40 + si);
        for (let i = 0; i < 4; i++) {
          const born = s1 - 0.05 + i * 0.05;
          const dt = t - born;
          if (dt < 0 || dt > 0.9) continue;
          const k = dt / 0.9;
          const base = rw2s(192, 268);
          const ox = (r() - 0.5) * 150;
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = i % 2 ? "#ff5c9a" : C.pink;
          Draw.heart(ctx, base.x + ox + Math.sin(dt * 8 + i) * 12, base.y - 20 - 120 * E.outCubic(k), 22 + r() * 10);
          ctx.fill();
          ctx.restore();
        }
        void s0;
      });
      // 하트가 하나 늘었다! (펫 10 → 하트 2개)
      const hp = t - 10.05;
      if (hp > 0 && hp < 0.9) {
        const k = spring(hp);
        const p = rw2s(192, 290 - Room.RADIUS - 8);
        ctx.save();
        ctx.globalAlpha = 1 - seg(hp, 0.6, 0.9);
        ctx.fillStyle = "#ff5c9a";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 5;
        Draw.heart(ctx, p.x, p.y - 60 - hp * 40, 40 * (1 + 0.3 * k));
        ctx.fill();
        ctx.stroke();
        ctx.font = "44px 'Jua'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 8;
        ctx.strokeStyle = C.grape;
        ctx.strokeText("+1", p.x, p.y - 150 - hp * 40);
        ctx.fillStyle = C.cream;
        ctx.fillText("+1", p.x, p.y - 150 - hp * 40);
        ctx.restore();
      }
      if (shutter >= 0 && shutter < 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - shutter / 0.3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    });
    // 사진 틀
    if (shutter >= 0) {
      const s = 1 + 0.06 * spring(shutter);
      photoBorder(ROOM_R, s, 1);
    }
    // 손가락: 3번 쓰담, 곰돌이 옮기기
    let fx;
    let fy;
    let fa = 0;
    const kp = rw2s(192, 278);
    if (t < 10.65) {
      fa = seg(t, 9.62, 9.75);
      const enter = E.outCubic(seg(t, 9.6, 9.8));
      let stroke = 0;
      for (const [s0, s1] of STROKES) if (t >= s0 && t < s1) stroke = Math.sin(((t - s0) / (s1 - s0)) * Math.PI);
      fx = lerp(980, kp.x - 50 + 110 * stroke, enter);
      fy = lerp(1700, kp.y - 10 - 18 * stroke, enter);
    } else {
      const b = list.find((p) => p.type === "bear");
      const bp = rw2s(b.x, b.y);
      const k = E.inOutCubic(seg(t, 10.6, 10.82));
      fx = lerp(kp.x + 60, bp.x + 8, k);
      fy = lerp(kp.y - 10, bp.y + 4, k);
      fa = 1 - seg(t, 11.22, 11.36);
      const away = E.inCubic(seg(t, 11.22, 11.36));
      fx += away * 120;
      fy += away * 200;
    }
    finger(fx, fy, (t > 10.8 && t < 11.22) || (t > 9.8 && t < 10.55) ? 0.6 : 0, fa);
    caption("쓰담쓰담 하트 뿅!", 360, { size: 112, scale: popIn(t, 9.66) });
  }

  function photoBorder(R, s, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(540, 1085);
    ctx.scale(s, s);
    ctx.translate(-540, -1085);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 22;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(R.x - 6, R.y - 6, R.w + 12, R.h + 12, R.r + 6);
    ctx.stroke();
    ctx.restore();
  }

  // ================= 장면 5: 몰랑 마을 (11.8–16.0) =================
  const VZ = 2.35;
  const VR = cardRect(Village.W * VZ, Village.H * VZ);
  const vcan = document.createElement("canvas");
  vcan.width = Math.round(VR.w);
  vcan.height = Math.round(VR.h);
  const vctx = vcan.getContext("2d");
  let KCAM = null; // 아이용 컷 마을 카메라 { x, y, z } (null이면 기본 컷과 같은 전체 화면)
  const vw2s = (x, y) =>
    KCAM ? pt(VR.x + VR.w / 2 + (x - KCAM.x) * VZ * KCAM.z, VR.y + VR.h / 2 + (y - KCAM.y) * VZ * KCAM.z) : pt(VR.x + x * VZ, VR.y + y * VZ);
  const SEATS = Village.seats(4);
  const KONGI_FROM = { x: 168, y: 424 };
  const KONGI_TO = { x: 246, y: 306 }; // 화면 오른쪽·아래 UI 자리를 피한다
  const KONGI_PATH = [KONGI_FROM].concat(Village.findPath(KONGI_FROM, KONGI_TO) || [KONGI_TO]);
  const PATH_LEN = [];
  {
    let acc = 0;
    PATH_LEN.push(0);
    for (let i = 1; i < KONGI_PATH.length; i++) {
      acc += Math.hypot(KONGI_PATH[i].x - KONGI_PATH[i - 1].x, KONGI_PATH[i].y - KONGI_PATH[i - 1].y);
      PATH_LEN.push(acc);
    }
  }
  function alongPath(k) {
    const total = PATH_LEN[PATH_LEN.length - 1];
    const d = k * total;
    for (let i = 1; i < KONGI_PATH.length; i++) {
      if (d <= PATH_LEN[i] || i === KONGI_PATH.length - 1) {
        const a = KONGI_PATH[i - 1];
        const b = KONGI_PATH[i];
        const span = PATH_LEN[i] - PATH_LEN[i - 1] || 1;
        const u = clamp((d - PATH_LEN[i - 1]) / span);
        return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), dir: b.x < a.x ? -1 : 1 };
      }
    }
    return { x: KONGI_TO.x, y: KONGI_TO.y, dir: 1 };
  }
  const talkRng = mulberry32(SEED + 7);
  const CAT_LINE = I18N.pick("talk.proud.greet.friend", { name: "고양이" }, talkRng);

  function loopWalker(type, name, pets, bx, by, ax, ay, w, ph, t) {
    const x = bx + ax * Math.sin(w * t + ph);
    const y = by + ay * Math.sin(2 * w * t + ph);
    return { type, name, pets, x, y, dir: Math.cos(w * t + ph) * ax >= 0 ? 1 : -1, walkT: t, wait: 0, talking: false };
  }

  function seatEase(wk, idx, t) {
    const k = E.inOutCubic(seg(t, 14.4, 14.95));
    if (k <= 0) return wk;
    const s = SEATS[idx];
    wk.x = lerp(wk.x, s.x, k);
    wk.y = lerp(wk.y, s.y, k);
    if (k >= 1) {
      wk.talking = true;
      wk.wait = 1;
    }
    return wk;
  }

  function villageWalkers(t) {
    // 소풍 시작 시점에 자리 잡기 전 위치를 고정해 둔다
    const tw = Math.min(t, 14.4);
    const ws = [];
    // 고양이: 톡 → 대화 중
    let cat = loopWalker("cat", "고양이", 10, 206, 236, 16, 6, 1.6, 0.2, Math.min(tw, 11.9));
    if (t >= 11.9) {
      cat.talking = true;
      cat.wait = 1;
    }
    ws.push(seatEase(cat, 0, t));
    // 곰돌이
    ws.push(seatEase(loopWalker("bear", "곰돌이", 6, 112, 300, 26, 8, 1.3, 1.1, tw), 2, t));
    // 토끼: 나무 뒤에 숨었다가 뿅
    let bunny;
    if (t < 12.6) bunny = loopWalker("bunny", "토끼", 11, 252, 296, 14, 6, 1.5, 2.0, t);
    else {
      const from = loopWalker("bunny", "토끼", 11, 252, 296, 14, 6, 1.5, 2.0, 12.6);
      const k = E.inOutCubic(seg(t, 12.6, 12.95));
      bunny = Object.assign(from, { x: lerp(from.x, 300, k), y: lerp(from.y, 228, k), walkT: t });
      if (t >= 12.95 && t < 13.75) bunny.hidden = true;
      if (t >= 13.75) {
        const p = E.outCubic(seg(t, 13.75, 13.98));
        bunny.x = lerp(306, 292, p);
        bunny.y = lerp(206, 248, p) - Math.sin(p * Math.PI) * 50;
        bunny.walkT = t;
        bunny.wait = 1;
        bunny.talking = true;
      }
    }
    if (!bunny.hidden) ws.push(t >= 14.4 ? seatEase(bunny, 1, t) : bunny);
    // 병아리
    ws.push(seatEase(loopWalker("chick", "병아리", 3, 100, 236, 12, 5, 1.8, 0.6, tw), 3, t));
    // 펭귄
    ws.push(loopWalker("penguin", "펭귄", 4, 322, 318, 8, 5, 1.4, 0.9, t));
    // 콩이 (내 인형): 땅을 톡 누르면 길을 따라 콩콩
    let kongi;
    if (t < 15.05) {
      kongi = { type: "mine", name: "콩이", pets: 12, x: KONGI_FROM.x + Math.sin(t * 1.2) * 4, y: KONGI_FROM.y, dir: 1, walkT: t, wait: 1, talking: false };
    } else {
      const p = alongPath(E.inOutCubic(seg(t, 15.05, 15.65)));
      kongi = { type: "mine", name: "콩이", pets: 12, x: p.x, y: p.y, dir: p.dir, walkT: t, wait: t < 15.65 ? 0 : 1, talking: false };
    }
    ws.push(kongi);
    return ws;
  }

  function paintVillage(t, tod, walkers, opts) {
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.clearRect(0, 0, vcan.width, vcan.height);
    if (KCAM) {
      const z = VZ * KCAM.z;
      vctx.setTransform(z, 0, 0, z, vcan.width / 2 - KCAM.x * z, vcan.height / 2 - KCAM.y * z);
    } else vctx.setTransform(VZ, 0, 0, VZ, 0, 0);
    Village.paint(vctx, walkers, Object.assign({ tod, time: t }, opts));
    if (opts.picnic) basket(vctx, Village.PICNIC.x, Village.PICNIC.y);
  }

  // 돗자리 위 바구니 (그림 문자 대신 직접 그린다)
  function basket(c, x, y) {
    c.save();
    c.translate(x, y + 2);
    c.fillStyle = "#c98a55";
    c.beginPath();
    c.ellipse(0, 4, 20, 12, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "#8a5a3c";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, -2, 12, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
    c.fillStyle = C.cream;
    c.strokeStyle = "#c86a8a";
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(-16, -4, 32, 16, 5);
    c.fill();
    c.stroke();
    c.fillStyle = "#ff8fb5";
    for (let i = -1; i <= 1; i++) c.fillRect(i * 9 - 2.5, -4, 5, 16);
    c.fillStyle = "#ff5c7a";
    c.beginPath();
    c.arc(-6, -6, 4, 0, TAU);
    c.arc(5, -7, 4, 0, TAU);
    c.fill();
    c.restore();
  }

  function honeyPot(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#ffb000";
    ctx.strokeStyle = "#a86a00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 4, 22, 20, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.roundRect(-16, -22, 32, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe36a";
    ctx.beginPath();
    ctx.ellipse(-7, 0, 6, 8, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function magnifier(x, y, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.strokeStyle = C.grape;
    ctx.lineCap = "round";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(44, 44);
    ctx.lineTo(96, 96);
    ctx.stroke();
    ctx.strokeStyle = C.lemon;
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.fillStyle = "rgba(220, 245, 255, 0.35)";
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 38, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  function bubble(x, y, text, k, tailX, tailY, who = "고양이") {
    if (k <= 0) return;
    ctx.save();
    // 휴대폰에서도 읽히게 Jua 46px, 최대 두 줄 (화면 좌표)
    const FS = 46;
    ctx.font = `${FS}px 'Jua'`;
    const lines = wrapLines(text, 760);
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const w = Math.min(860, tw + 90);
    const h = 84 + lines.length * 58;
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.shadowColor = "rgba(30, 8, 40, 0.4)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 44);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo((tailX - x) / k - 26, h / 2 - 4);
    ctx.lineTo((tailX - x) / k, (tailY - y) / k);
    ctx.lineTo((tailX - x) / k + 26, h / 2 - 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 44);
    ctx.stroke();
    ctx.fillStyle = C.pink;
    ctx.font = "34px 'Jua'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(who, 0, -h / 2 + 36);
    ctx.fillStyle = C.ink;
    ctx.font = `${FS}px 'Jua'`;
    lines.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 92 + i * 58));
    ctx.restore();
  }

  function scene5(t, sink = 0) {
    const walkers = villageWalkers(t);
    const opts = {
      picnic: t >= 14.4,
      rustle: t >= 13.5 && t < 13.8 ? "tree" : null,
      checked: t >= 13.9 ? [] : t >= 13.36 ? ["bushC", "bushB"] : t >= 13.17 ? ["bushC"] : [],
      selected: t >= 11.9 && t < 13.0 ? "cat" : null,
      fx: [],
    };
    // +1 친밀도 하트 (opts.fx)
    const hf = t - 12.35;
    if (hf > 0 && hf < 0.7) {
      const c = walkers.find((w) => w.type === "cat");
      opts.fx.push({ x: c.x + 16, y: c.y - 30 - hf * 40, life: 1 - hf / 0.7 });
    }
    const evening = seg(t, 14.3, 14.55);
    cardFrame(VR, () => {
      paintVillage(t, "day", walkers, opts);
      ctx.drawImage(vcan, VR.x, VR.y, VR.w, VR.h);
      if (evening > 0) {
        paintVillage(t, "evening", walkers, opts);
        ctx.globalAlpha = evening;
        ctx.drawImage(vcan, VR.x, VR.y, VR.w, VR.h);
        ctx.globalAlpha = 1;
      }
      if (sink > 0) {
        ctx.fillStyle = `rgba(20, 8, 50, ${0.6 * sink})`;
        ctx.fillRect(0, 0, W, H);
      }
      // 고양이 톡
      const cat = walkers.find((w) => w.type === "cat");
      const cs = vw2s(cat.x, cat.y);
      ripple(cs.x, cs.y, t - 11.9, C.lemon, 110, 2);
      // 돋보기: 덤불 → 나무
      if (t >= 13.0 && t < 13.95) {
        // 틀린 곳 두 번(덤불C, 덤불B) 뒤에 나무가 바스락
        const b = vw2s(Village.BUSHES[2].x, Village.BUSHES[2].y);
        const b2 = vw2s(Village.BUSHES[1].x, Village.BUSHES[1].y);
        const tr = vw2s(Village.TREE.x, Village.TREE.y - 10);
        const k1 = E.inOutCubic(seg(t, 13.0, 13.14));
        const k2 = E.inOutCubic(seg(t, 13.19, 13.33));
        const k3 = E.inOutCubic(seg(t, 13.38, 13.5));
        const start = pt(VR.x + 120, VR.y + 640);
        let mx = lerp(start.x, b.x, k1);
        let my = lerp(start.y, b.y, k1);
        mx = lerp(mx, b2.x, k2);
        my = lerp(my, b2.y, k2);
        mx = lerp(mx, tr.x - 10, k3);
        my = lerp(my, tr.y, k3);
        magnifier(mx, my, seg(t, 13.0, 13.08) * (1 - seg(t, 13.8, 13.95)));
      }
      // 토끼 뿅
      const bun = walkers.find((w) => w.type === "bunny");
      if (bun && t >= 13.75) {
        const bp = vw2s(bun.x, bun.y);
        sparkRing(bp.x, bp.y, t - 13.98, 90, 14);
      }
      // 소풍: 꿀단지 → 곰돌이 +2
      const bear = walkers.find((w) => w.type === "bear");
      const bb = vw2s(bear.x, bear.y);
      const pc = vw2s(Village.PICNIC.x, Village.PICNIC.y);
      const hk = seg(t, 14.95, 15.15);
      if (hk > 0 && hk < 1) honeyPot(lerp(pc.x, bb.x, E.inOutCubic(hk)), lerp(pc.y, bb.y - 40, E.inOutCubic(hk)) - Math.sin(hk * Math.PI) * 80, 1.4);
      const lk = t - 15.15;
      if (lk > 0 && lk < 0.9) {
        ctx.save();
        ctx.globalAlpha = 1 - seg(lk, 0.6, 0.9);
        const y = bb.y - 90 - lk * 60;
        const s = 1 + 0.25 * spring(lk);
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = "#ff5c9a";
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 4;
          Draw.heart(ctx, bb.x - 30 + i * 52, y, 24 * s);
          ctx.fill();
          ctx.stroke();
        }
        ctx.font = "48px 'Jua'";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 9;
        ctx.strokeStyle = C.grape;
        ctx.strokeText("+2", bb.x + 50, y - 10);
        ctx.fillStyle = C.cream;
        ctx.fillText("+2", bb.x + 50, y - 10);
        ctx.restore();
      }
      // 땅 톡 → 콩이가 콩콩
      const tgt = vw2s(KONGI_TO.x, KONGI_TO.y);
      ripple(tgt.x, tgt.y, t - 15.0, C.lemon, 90, 2);
      if (t >= 15.0 && t < 15.65) {
        ctx.save();
        ctx.globalAlpha = 0.6 * (1 - seg(t, 15.5, 15.65));
        ctx.fillStyle = C.lemon;
        Draw.star(ctx, tgt.x, tgt.y, 18, 4, 0.45);
        ctx.fill();
        ctx.restore();
      }
    });
    // 말풍선
    const bk = E.outBack(seg(t, 11.98, 12.22)) * (1 - seg(t, 12.85, 12.98));
    if (bk > 0) {
      const cat = walkers.find((w) => w.type === "cat");
      const cs = vw2s(cat.x, cat.y);
      bubble(540, cs.y - 250, CAT_LINE, bk * BUBBLE_K, cs.x, cs.y - 60);
    }
  }

  function scene5Caption(t) {
    caption("몰랑 마을", 330, { size: 116, scale: popIn(t, 11.85) });
    let sub = null;
    let at = 0;
    if (t >= 14.4) {
      sub = "소풍 가자!";
      at = 14.4;
    } else if (t >= 13.0) {
      sub = "숨바꼭질";
      at = 13.0;
    } else if (t >= 11.9) {
      sub = "톡! 말 걸기";
      at = 11.9;
    }
    if (sub) caption(sub, 455, { size: 64, sub: true, scale: popIn(t, at, 0.25) });
  }

  // ================= 장면 6: 부모님 체크 (16.0–18.6) =================
  const CLIP = { x: 60, y: 500, w: 960, h: 820 };
  const ROW_T = [16.22, 16.54, 16.86, 17.18];
  const ROW_Y = [726, 880, 1034, 1188];
  const PILL_T = 17.5;
  const COLLAPSE_T = 18.4; // 다 찍힌 목록을 1초 넘게 멈춰 보여 준 뒤 접는다
  const CLIP_TOP = { x: 540, y: 470 };
  const ROW_TXT = ["광고·결제 없음", "개인정보 수집 없음", "공유는 어른 확인 후", "하루 놀이 시간 설정"];
  const ROW_PLUSH = ["bear", "bunny", "chick", "penguin"];
  const STAMP_X = 920;

  function crossLine(x0, y0, x1, y1, k) {
    if (k <= 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(lerp(x0, x1, k), lerp(y0, y1, k));
    ctx.stroke();
    ctx.strokeStyle = "#ff4f7b";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }

  function iconAd(x, y, k) {
    ctx.save();
    ctx.fillStyle = "#ffd6ec";
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 68, y - 44, 96, 60, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.grape;
    ctx.beginPath();
    ctx.moveTo(x - 48, y - 30);
    ctx.lineTo(x - 48, y + 2);
    ctx.lineTo(x - 22, y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 14, y - 26, 30, 6);
    ctx.fillRect(x - 14, y - 12, 22, 6);
    ctx.fillStyle = C.lemon;
    ctx.strokeStyle = "#c48a00";
    ctx.beginPath();
    ctx.arc(x + 34, y + 20, 28, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 34, y + 20, 18, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#c48a00";
    Draw.star(ctx, x + 34, y + 20, 10, 5, 0.45);
    ctx.fill();
    ctx.restore();
    crossLine(x - 70, y - 50, x + 66, y + 52, k);
  }

  function iconLock(x, y) {
    ctx.save();
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(x, y - 8, 26, Math.PI, TAU);
    ctx.lineTo(x + 26, y + 4);
    ctx.moveTo(x - 26, y - 8);
    ctx.lineTo(x - 26, y + 4);
    ctx.stroke();
    ctx.fillStyle = C.lemon;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 44, y - 4, 88, 66, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.grape;
    ctx.beginPath();
    ctx.arc(x, y + 22, 9, 0, TAU);
    ctx.fill();
    ctx.fillRect(x - 4, y + 24, 8, 20);
    ctx.fillStyle = "#ff5c9a";
    Draw.heart(ctx, x + 30, y - 40, 12);
    ctx.fill();
    ctx.restore();
  }

  function iconMath(x, y, k, t0, t) {
    ctx.save();
    ctx.fillStyle = "#d9fff3";
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 98, y - 40, 196, 80, 18);
    ctx.fill();
    ctx.stroke();
    ctx.font = "36px 'Jua'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.ink;
    // 실제 부모 확인 문제처럼 6~9 곱셈
    ctx.fillText("7 × 8 =", x - 26, y + 2);
    if (k <= 0) ctx.fillText("?", x + 60, y + 2);
    else {
      const s = 1 + 0.4 * spring(t - t0);
      ctx.save();
      ctx.translate(x + 60, y + 2);
      ctx.scale(s, s);
      ctx.fillStyle = "#e0307a";
      ctx.fillText("56", 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function iconClock(x, y, k) {
    ctx.save();
    const moon = seg(k, 0.75, 1);
    ctx.globalAlpha = 1 - moon;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.lemon;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k / 0.75));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 30);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20, y + 8);
    ctx.stroke();
    ctx.globalAlpha = moon;
    ctx.fillStyle = C.lemon;
    ctx.strokeStyle = "#c48a00";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x - 4, y + 2, 44, 0.9, TAU - 0.9 + 0.0001, false);
    ctx.arc(x + 18, y - 10, 36, TAU - 1.1, 1.1, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.lemon;
    Draw.star(ctx, x + 38, y - 36, 14, 5, 0.45);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function wifiIcon(x, y, s) {
    ctx.save();
    ctx.translate(x, y + s * 0.25);
    ctx.strokeStyle = C.ink;
    ctx.lineCap = "round";
    ctx.lineWidth = s * 0.12;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.18 * i, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
    }
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.07, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#e0307a";
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 0.6);
    ctx.lineTo(s * 0.45, s * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  function checklist(t) {
    const rowT = CL ? CL.rowT : ROW_T;
    const rowTxt = CL ? CL.txt : ROW_TXT;
    const rowPlush = CL ? CL.plush : ROW_PLUSH;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.roundRect(CLIP.x, CLIP.y, CLIP.w, CLIP.h, 40);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 7;
    ctx.stroke();
    // 집게
    ctx.fillStyle = C.grape;
    ctx.beginPath();
    ctx.roundRect(400, CLIP.y - 38, 280, 84, 26);
    ctx.fill();
    ctx.fillStyle = "#7b4aa8";
    ctx.beginPath();
    ctx.roundRect(470, CLIP.y - 20, 140, 30, 15);
    ctx.fill();
    ctx.font = "66px 'Jua'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.grape;
    ctx.fillText("부모님 체크", 540, CLIP.y + 104);
    ctx.restore();

    for (let i = 0; i < 4; i++) {
      const ts = rowT[i];
      const y = ROW_Y[i];
      const appear = E.outCubic(seg(t, ts - 0.32, ts - 0.12));
      if (appear <= 0) continue;
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.translate((1 - appear) * -60, 0);
      ctx.fillStyle = "rgba(255, 121, 199, 0.12)";
      ctx.beginPath();
      ctx.roundRect(88, y - 66, 904, 132, 34);
      ctx.fill();
      const ix = 194;
      const k = seg(t, ts, ts + 0.2);
      if (CL) CL.icon(i, ix, y, t, ts);
      else if (i === 0) iconAd(ix, y, k);
      else if (i === 1) iconLock(ix, y);
      else if (i === 2) iconMath(ix, y, t >= ts ? 1 : 0, ts, t);
      else iconClock(ix, y, seg(t, ts - 0.3, ts + 0.15));
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = C.ink;
      fitFont(rowTxt[i], 56, 846 - 330);
      ctx.fillText(rowTxt[i], 330, y + 3);
      // 도장 자리
      ctx.strokeStyle = "rgba(90,45,134,0.25)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(STAMP_X, y, 46, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 별 도장 + 민트 체크
      if (t >= ts) {
        const sq = squash(t - ts, 1.4);
        ctx.save();
        ctx.translate(STAMP_X, y);
        ctx.scale(1 + sq.squashX, 1 + sq.squashY);
        ctx.fillStyle = C.lemon;
        ctx.strokeStyle = "#c48a00";
        ctx.lineWidth = 5;
        Draw.star(ctx, 0, 0, 54, 5, 0.5);
        ctx.fill();
        ctx.stroke();
        const ck = E.outCubic(seg(t, ts + 0.06, ts + 0.24));
        if (ck > 0) {
          const P = [pt(-24, 0), pt(-6, 20), pt(28, -22)];
          const total = 1;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (const [lw, col] of [
            [20, C.grape],
            [11, C.mint],
          ]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(P[0].x, P[0].y);
            const k1 = clamp(ck / 0.4);
            ctx.lineTo(lerp(P[0].x, P[1].x, k1), lerp(P[0].y, P[1].y, k1));
            if (ck > 0.4) {
              const k2 = clamp((ck - 0.4) / 0.6);
              ctx.lineTo(lerp(P[1].x, P[2].x, k2), lerp(P[1].y, P[2].y, k2));
            }
            ctx.stroke();
          }
          void total;
        }
        ctx.restore();
      }
      // 인형이 깡총 와서 도장 쾅
      const pk = seg(t, ts - 0.34, ts);
      const out = seg(t, ts, ts + 0.3);
      if (pk > 0 && out < 1) {
        let px;
        let py;
        let sq = { squashX: 0, squashY: 0 };
        // 오른쪽 바깥에서 들어와 도장 칸 위에만 머문다 (글자를 가리지 않게)
        if (t < ts) {
          px = lerp(1180, STAMP_X, E.outQuad(pk));
          py = y - 70 - Math.abs(Math.sin(pk * Math.PI * 2)) * 70;
        } else {
          px = STAMP_X + out * 260;
          py = y - 70 - Math.sin(out * Math.PI) * 90 - out * 60;
          sq = squash(t - ts, 1);
        }
        ctx.save();
        ctx.globalAlpha = 1 - seg(out, 0.6, 1);
        ctx.translate(px, py);
        ctx.scale(2.3, 2.3);
        Draw.plush(ctx, { type: rowPlush[i], x: 0, y: 0, radius: 22, react: "success", ...sq });
        ctx.restore();
      }
    }
  }

  function scene6(t) {
    checklist(t);
    const pk = E.outBack(seg(t, PILL_T, PILL_T + 0.25));
    if (pk > 0)
      pill(540, 1392, "인터넷 없이도 OK", {
        size: 48,
        bg: C.mint,
        color: C.ink,
        scale: pk,
        icon: (x, y, s) => wifiIcon(x, y, s),
      });
    caption("부모님도 안심", 330, { size: 116, scale: popIn(t, 16.05) });
  }

  // ================= 장면 7: 엔드 카드 (18.6–22) =================
  const TITLE = "몰랑크레인";
  // 아래 쇼츠/릴스 UI(약 420px)를 피해 위로 올린 배치
  const TITLE_Y = 680;
  const END_ROW = [
    { type: "bear", x: 196, y: 885 },
    { type: "bunny", x: 368, y: 872 },
    { type: "star", x: 540, y: 858, golden: true },
    { type: "chick", x: 712, y: 872 },
    { type: "panda", x: 884, y: 885 },
  ];

  function endTitle(t, cx = 540, cy = TITLE_Y, size = 170) {
    ctx.save();
    ctx.font = `${size}px 'Jua'`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const chars = Array.from(TITLE);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = cx - total / 2;
    chars.forEach((ch, i) => {
      const cx = x + widths[i] / 2;
      x += widths[i];
      // 글자마다 제자리 바로 위 200px에서 곧게 떨어진다 (3프레임 간격)
      const t0 = 18.6 + i * (3 / FPS);
      const fall = seg(t, t0, t0 + 0.16);
      if (fall <= 0) return;
      const yy = cy - (1 - E.inQuad(fall)) * 200;
      let sx = 1;
      let sy = 1;
      if (fall < 1) {
        sx = 0.9;
        sy = 1.15;
      } else {
        const s = spring(t - t0 - 0.18);
        sx = 1 + 0.2 * s;
        sy = 1 - 0.25 * s;
      }
      ctx.save();
      ctx.globalAlpha = seg(fall, 0, 0.45);
      ctx.translate(cx, yy + 70);
      ctx.scale(sx, sy);
      ctx.translate(0, -70);
      ctx.lineJoin = "round";
      ctx.strokeStyle = C.grape;
      ctx.lineWidth = 30;
      ctx.shadowColor = C.pink;
      ctx.shadowBlur = 40;
      ctx.strokeText(ch, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = C.cream;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  function endPlush(p, i, t, R, spec) {
    const ph = 6 * t - 0.5 * i;
    const hop = -Math.abs(Math.sin(ph)) * 40;
    const sinceLand = ((ph % Math.PI) + Math.PI) % Math.PI / 6;
    const sq = squash(sinceLand, 0.8);
    const z = R / 24;
    ctx.save();
    ctx.translate(p.x, p.y + hop);
    ctx.scale(z, z);
    Draw.plush(ctx, {
      type: p.type,
      x: 0,
      y: 0,
      radius: 24,
      golden: p.golden,
      mineMark: !!spec,
      spec,
      react: "success",
      blink: 1,
      ...sq,
    });
    ctx.restore();
  }

  function scene7(t) {
    const u = Math.min(t, DUR - 0.5);
    // 네온 액자
    const pulse = 0.75 + 0.25 * Math.sin(u * 2.4);
    ctx.save();
    ctx.globalAlpha = seg(t, 18.6, 18.8);
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 8;
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 30 * pulse;
    ctx.beginPath();
    ctx.roundRect(100, 240, 880, 1240, 60);
    ctx.stroke();
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(122, 262, 836, 1196, 46);
    ctx.stroke();
    ctx.restore();

    // 위에서 천천히 움직이는 집게
    const ga = seg(t, 18.6, 18.9);
    if (ga > 0) {
      ctx.save();
      ctx.globalAlpha = ga;
      ctx.beginPath();
      ctx.rect(124, 266, 832, 300);
      ctx.clip();
      ctx.translate(162, 196);
      ctx.scale(1.8, 1.8);
      const claw = { x: 210 + 150 * Math.sin(0.9 * (u - 18.6)), y: 150, z: 0.4, open: 0.5 + 0.2 * Math.sin(3 * u) };
      Draw.gantry(ctx, claw);
      Draw.claw(ctx, claw);
      ctx.restore();
    }

    endTitle(u);
    // 별 하나가 날아와 터진다
    burst(540, TITLE_Y, t - 18.6, { stars: 10, hearts: 4, dist: 420, seed: SEED + 9, scale: 1.1, coreDur: 0.1 });

    // 인형 줄 (뒷줄 5 + 가운데 앞 콩이)
    const ra = E.outBack(seg(t, 18.85, 19.15));
    if (ra > 0) {
      ctx.save();
      ctx.translate(540, 950);
      ctx.scale(ra, ra);
      ctx.translate(-540, -950);
      END_ROW.forEach((p, i) => endPlush(p, i, u, p.type === "star" ? 52 : 56, null));
      endPlush({ type: "mine", x: 540, y: 1068 }, 2.5, u, 84, KONGI);
      ctx.restore();
    }

    // 태그라인 타자
    const line = "뽑고, 모으고, 함께 놀아요";
    const chars = Array.from(line);
    const n = Math.floor(seg(u, 19.4, 20.0) * chars.length + 1e-6);
    if (n > 0) {
      ctx.save();
      const size = fitFont(line, 72, 820);
      ctx.font = `${size}px 'Jua'`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const full = ctx.measureText(line).width;
      const shown = chars.slice(0, n).join("");
      const x0 = 540 - full / 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = C.grape;
      ctx.lineWidth = 14;
      ctx.strokeText(shown, x0, 1254);
      ctx.fillStyle = C.lemon;
      ctx.fillText(shown, x0, 1254);
      ctx.restore();
    }
    const pk = E.outBack(seg(u, 20.2, 20.45));
    if (pk > 0) pill(540, 1380, "광고 없음 · 개인정보 수집 없음", { size: 48 * END_PILL_K, bg: C.mint, color: C.ink, scale: pk, pad: 44 * END_PILL_K });
  }

  // ---------- 장면 묶기 ----------
  function renderFrame(t) {
    const cut = CUTS[CUT];
    t = clamp(t, 0, cut.dur);
    // Draw.plush의 하트 고리 맥박을 t로 고정 (마지막 0.5초 정지 구간에서는 시계도 멈춘다)
    const tc = Math.min(t, cut.hold);
    try {
      Object.defineProperty(performance, "now", { value: () => tc * 1000, configurable: true, writable: true });
    } catch (e) {
      /* ignore */
    }
    if (CUT !== "full") renderCut(t);
    else if (FORMAT === "landscape") renderLandscape(t);
    else {
      BUBBLE_K = 1;
      renderVertical(t);
    }
  }

  function renderVertical(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";

    if (t < 1.8) {
      const flash = t >= 1.4 && t < 1.4 + 2 / FPS;
      backdrop(t, 0, flash);
      scene1(t);
    } else if (t < 4.85) {
      backdrop(t);
      scene2(t);
    } else if (t < 5.12) {
      const k = E.inOutCubic(seg(t, 4.85, 5.12));
      backdrop(t, -320 * k);
      ctx.save();
      ctx.translate(-1100 * k, 0);
      scene2(t);
      ctx.restore();
      ctx.save();
      ctx.translate(1100 * (1 - k), 0);
      scene3(Math.max(t, 5.0));
      ctx.restore();
    } else if (t < 9.45) {
      backdrop(t, -320);
      scene3(t);
    } else if (t < 9.8) {
      backdrop(t, -320);
      scene3(t);
      const k = E.inCubic(seg(t, 9.45, 9.8));
      const c = KONGI_MINI();
      ctx.save();
      Draw.heart(ctx, c.x, c.y, 2800 * k);
      ctx.clip();
      backdrop(t);
      scene4(Math.max(t, 9.6));
      ctx.restore();
      if (k < 1) {
        ctx.save();
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 14;
        ctx.shadowColor = C.pink;
        ctx.shadowBlur = 24;
        Draw.heart(ctx, c.x, c.y, 2800 * k);
        ctx.stroke();
        ctx.restore();
      }
    } else if (t < 11.6) {
      backdrop(t);
      scene4(t);
    } else if (t < 12.05) {
      backdrop(t);
      polaroid(t);
    } else if (t < 15.75) {
      backdrop(t);
      scene5(t);
      scene5Caption(t);
    } else if (t < 16.2) {
      backdrop(t);
      const sink = E.inCubic(seg(t, 15.8, 16.15));
      const dark = seg(t, 15.75, 16.0);
      ctx.save();
      ctx.translate(0, 1400 * sink);
      scene5(t, dark);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - seg(t, 15.75, 15.9);
      scene5Caption(t);
      ctx.restore();
      const rise = E.outBack(seg(t, 15.85, 16.2));
      if (rise > 0) {
        ctx.save();
        ctx.translate(0, 1400 * (1 - rise));
        scene6(Math.max(t, 16.0));
        ctx.restore();
      }
    } else if (t < COLLAPSE_T) {
      backdrop(t);
      scene6(t);
    } else if (t < 18.6) {
      backdrop(t);
      // 카드가 위쪽 집게 쪽으로 쏙 접힌다 (글자 위로 별이 지나가지 않게)
      const k = seg(t, COLLAPSE_T, 18.54);
      const s = 1 - E.inBack(k);
      if (s > 0.01) {
        ctx.save();
        ctx.globalAlpha = 1 - seg(k, 0.6, 1);
        ctx.translate(CLIP_TOP.x, CLIP_TOP.y);
        ctx.scale(s, s);
        ctx.translate(-CLIP_TOP.x, -CLIP_TOP.y);
        scene6(COLLAPSE_T);
        ctx.restore();
      }
      // 노란 별이 집게 자리에서 나와 제목 자리로 내려간다
      const f = E.inOutCubic(seg(t, 18.46, 18.6));
      const sx = 540;
      const sy = lerp(CLIP_TOP.y, TITLE_Y, f);
      ctx.save();
      ctx.globalAlpha = seg(t, COLLAPSE_T + 0.02, COLLAPSE_T + 0.08);
      ctx.translate(sx, sy);
      ctx.rotate(t * 8);
      const r = 30 + 40 * Math.sin(seg(t, COLLAPSE_T, 18.6) * Math.PI) + 10;
      ctx.shadowColor = C.lemon;
      ctx.shadowBlur = 40;
      ctx.fillStyle = C.lemon;
      ctx.strokeStyle = "#c48a00";
      ctx.lineWidth = 5;
      Draw.star(ctx, 0, 0, r, 5, 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      const u = Math.min(t, HOLD_T);
      backdrop(u);
      scene7(u);
    }
  }

  // 사진 틀이 폴라로이드로 줄어들고 뒤집혀 마을이 보인다
  function polaroid(t) {
    let s;
    let sx;
    let showVillage;
    if (t < 11.8) {
      s = lerp(1, 0.62, E.inOutCubic(seg(t, 11.6, 11.72)));
      sx = 1 - E.inQuad(seg(t, 11.72, 11.8));
      showVillage = false;
    } else {
      s = lerp(0.62, 1, E.inOutCubic(seg(t, 11.88, 12.05)));
      sx = E.outQuad(seg(t, 11.8, 11.88));
      showVillage = true;
    }
    const R = showVillage ? VR : ROOM_R;
    const borderA = showVillage ? 1 - seg(t, 11.92, 12.05) : 1;
    ctx.save();
    ctx.translate(540, 1085);
    ctx.scale(s * Math.max(sx, 0.001), s);
    ctx.translate(-540, -1085);
    // 폴라로이드 흰 틀 (아래가 더 두껍다)
    if (borderA > 0) {
      ctx.save();
      ctx.globalAlpha = borderA;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 40;
      ctx.fillStyle = "#fffaf2";
      ctx.beginPath();
      ctx.roundRect(R.x - 40, R.y - 40, R.w + 80, R.h + 190, 30);
      ctx.fill();
      ctx.restore();
    }
    if (showVillage) {
      ctx.save();
      scene5(Math.max(t, 11.8));
      ctx.restore();
    } else {
      scene4Body(t);
    }
    ctx.restore();
    if (showVillage) scene5Caption(Math.max(t, 11.85));
    else {
      ctx.save();
      ctx.globalAlpha = 1 - seg(t, 11.6, 11.72);
      caption("쓰담쓰담 하트 뿅!", 360, { size: 112 });
      ctx.restore();
    }
  }

  // 방 장면에서 자막·손가락을 뺀 그림 (폴라로이드 안)
  function scene4Body(t) {
    const list = ROOM_BASE.map((p) => {
      const q = Object.assign({}, p);
      if (p.type === "mine") q.pets = p.pets + 3;
      if (p.type === "bear" && !BEAR_HOME) {
        q.x = 132;
        q.y = 256;
      }
      return q;
    });
    cardFrame(ROOM_R, () => {
      ctx.save();
      ctx.translate(ROOM_R.x, ROOM_R.y);
      ctx.scale(ROOM_Z, ROOM_Z);
      Room.paint(ctx, list, { time: t, anim: {} });
      ctx.restore();
    });
    photoBorder(ROOM_R, 1, 1);
  }

  // ================= 가로형 1920x1080 =================
  // 세로형 장면 함수를 그대로 쓰되, 카드(무대)는 오른쪽에 줄여 놓고 자막은 왼쪽 칸에 다시 짠다.
  // 세로형 그림에는 손대지 않는다 (capSink가 없으면 caption()은 예전과 똑같이 그린다).
  const LW = 1920;
  const LH = 1080;
  const SAFE_X = 96; // 유튜브 제목 안전 영역 (좌우 5%)
  const lRng = mulberry32(SEED ^ 0x2545f491);
  const LSTARS = Array.from({ length: 96 }, () => ({
    x: lRng() * LW,
    y: lRng() * LH,
    r: 4 + lRng() * 9,
    c: lRng() < 0.6 ? C.lemon : C.pink,
    d: 0.3 + lRng() * 0.7,
  }));

  function backdropL(t, parallax = 0, flash = false) {
    if (flash) {
      ctx.fillStyle = C.grape;
      ctx.fillRect(0, 0, LW, LH);
    } else {
      const g = ctx.createRadialGradient(LW / 2, LH * 0.45, 60, LW / 2, LH / 2, 1150);
      g.addColorStop(0, C.plum);
      g.addColorStop(1, C.night);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LW, LH);
    }
    LSTARS.forEach((s, i) => {
      const a = clamp(0.4 + 0.6 * Math.sin(3 * t + i));
      let x = s.x + parallax * s.d;
      x = ((x % (LW + 40)) + LW + 40) % (LW + 40) - 20;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = s.c;
      Draw.star(ctx, x, s.y, s.r, 4, 0.42);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // 무대: 세로형 좌표 (fx, fy)를 화면 (x, y)에 s배로 놓는다. 카드 반쪽 너비 hw로 왼쪽 칸 끝을 정한다.
  const ST = { s: 0.84, fx: 540, fy: 1085, x: 1418, y: 540, hw: 483 };
  const ST6 = { s: 0.98, fx: 540, fy: 950, x: 1354, y: 540, hw: 480 };
  const toScreen = (st, p) => pt(st.x + (p.x - st.fx) * st.s, st.y + (p.y - st.fy) * st.s);
  function column(st) {
    const right = st.x - st.hw * st.s - 56;
    // 테두리·빛 번짐까지 칸 안에 들게 글자 폭은 조금 더 좁게
    return { cx: (SAFE_X + right) / 2, maxW: right - SAFE_X - 48 };
  }

  function staged(st, fn) {
    const prev = capSink;
    capSink = [];
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.scale(st.s, st.s);
    ctx.translate(-st.fx, -st.fy);
    fn();
    ctx.restore();
    const caps = capSink;
    capSink = prev;
    leftCaptions(caps, st);
  }

  // 왼쪽 칸 자막: 큰 제목은 두 줄까지 나누고, 작은 줄은 그 아래
  const HEAD_CY = 500;
  // 두 줄로 나눌 때는 두 줄 길이가 비슷한 자리에서 자른다
  function balancedLines(text, maxW) {
    const words = text.split(" ");
    if (words.length < 2) return [text];
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (!best || w < best.w) best = { w, lines: [a, b] };
    }
    return best.w <= maxW ? best.lines : wrapLines(text, maxW);
  }

  function layoutLines(text, size, maxW, min) {
    let s = size;
    ctx.font = `${s}px 'Jua'`;
    const lines = ctx.measureText(text).width > maxW ? balancedLines(text, maxW) : [text];
    const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
    while (widest() > maxW && s > min) {
      s -= 2;
      ctx.font = `${s}px 'Jua'`;
    }
    return { lines, size: s };
  }

  function leftCaptions(caps, st) {
    if (!caps.length) return;
    const col = column(st);
    let headBottom = HEAD_CY + 60;
    const heads = caps.filter((c) => !c.opts.sub);
    const subs = caps.filter((c) => c.opts.sub);
    for (const c of heads) {
      const L = layoutLines(c.text, Math.round((c.opts.size || 110) * 1.12), col.maxW, 88);
      const lh = L.size * 1.14;
      headBottom = Math.max(headBottom, HEAD_CY + (L.lines.length * lh) / 2);
      drawCapLines(c, L, col.cx, HEAD_CY, lh);
    }
    for (const c of subs) {
      const size = Math.max(56, (c.opts.size || 62) * 1.08);
      const L = layoutLines(c.text, size, col.maxW, 48);
      drawCapLines(c, L, col.cx, headBottom + 40 + L.size * 0.6, L.size * 1.14);
    }
  }

  function drawCapLines(c, L, cx, cy, lh) {
    const o = c.opts;
    if (c.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= c.alpha;
    ctx.font = `${L.size}px 'Jua'`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(cx + (o.dx || 0), cy + (o.dy || 0));
    const sc = o.scale == null ? 1 : o.scale;
    ctx.scale(sc * (o.sx || 1), sc * (o.sy || 1));
    ctx.lineJoin = "round";
    L.lines.forEach((line, i) => {
      const y = (i - (L.lines.length - 1) / 2) * lh;
      ctx.strokeStyle = C.grape;
      ctx.lineWidth = o.sub ? 14 : 20;
      ctx.shadowColor = C.pink;
      ctx.shadowBlur = o.sub ? 18 : 30;
      ctx.strokeText(line, 0, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = o.color || (o.sub ? C.lemon : C.cream);
      ctx.fillText(line, 0, y);
    });
    ctx.restore();
  }

  // ---- 가로형 엔드 카드 ----
  const TITLE_Y_L = 340;
  // 넓은 화면: 한 줄로 늘어서고 가운데에 콩이, 양옆에 황금 별·황금 유니콘
  const END_ROW_L = [
    { type: "bear", x: 960 - 650, y: 642 },
    { type: "bunny", x: 960 - 440, y: 632 },
    { type: "star", x: 960 - 230, y: 620, golden: true },
    { type: "unicorn", x: 960 + 230, y: 620, golden: true },
    { type: "chick", x: 960 + 440, y: 632 },
    { type: "panda", x: 960 + 650, y: 642 },
  ];

  function scene7L(t) {
    const u = Math.min(t, DUR - 0.5);
    const pulse = 0.75 + 0.25 * Math.sin(u * 2.4);
    ctx.save();
    ctx.globalAlpha = seg(t, 18.6, 18.8);
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 8;
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 30 * pulse;
    ctx.beginPath();
    ctx.roundRect(110, 60, 1700, 960, 60);
    ctx.stroke();
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(132, 82, 1656, 916, 46);
    ctx.stroke();
    ctx.restore();

    // 위에서 좌우로 오가는 집게 (레일은 액자 폭만큼 길게)
    const ga = seg(t, 18.6, 18.9);
    if (ga > 0) {
      ctx.save();
      ctx.globalAlpha = ga;
      ctx.beginPath();
      ctx.rect(134, 84, 1652, 172);
      ctx.clip();
      const Z = 1.8;
      const clawY = 150;
      ctx.translate(LW / 2 - 210 * Z, 172 - clawY * Z);
      ctx.scale(Z, Z);
      const claw = { x: 210 + 300 * Math.sin(0.9 * (u - 18.6)), y: clawY, z: 0.4, open: 0.5 + 0.2 * Math.sin(3 * u) };
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = "#e8d6ff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-(LW / 2 - 210 * Z - 170) / Z, clawY);
      ctx.lineTo(420 + (LW / 2 - 210 * Z - 170) / Z, clawY);
      ctx.stroke();
      ctx.restore();
      Draw.gantry(ctx, claw);
      Draw.claw(ctx, claw);
      ctx.restore();
    }

    endTitle(u, LW / 2, TITLE_Y_L, 190);
    burst(LW / 2, TITLE_Y_L, t - 18.6, { stars: 10, hearts: 4, dist: 460, seed: SEED + 9, scale: 1.1, coreDur: 0.1 });

    const ra = E.outBack(seg(t, 18.85, 19.15));
    if (ra > 0) {
      ctx.save();
      ctx.translate(LW / 2, 660);
      ctx.scale(ra, ra);
      ctx.translate(-LW / 2, -660);
      END_ROW_L.forEach((p, i) => endPlush(p, i < 3 ? i : i + 1, u, p.type === "star" ? 56 : 62, null));
      endPlush({ type: "mine", x: LW / 2, y: 635 }, 3, u, 96, KONGI);
      ctx.restore();
    }

    const line = "뽑고, 모으고, 함께 놀아요";
    const chars = Array.from(line);
    const n = Math.floor(seg(u, 19.4, 20.0) * chars.length + 1e-6);
    if (n > 0) {
      ctx.save();
      const size = fitFont(line, 84, 1400);
      ctx.font = `${size}px 'Jua'`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const full = ctx.measureText(line).width;
      const shown = chars.slice(0, n).join("");
      const x0 = LW / 2 - full / 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = C.grape;
      ctx.lineWidth = 16;
      ctx.strokeText(shown, x0, 834);
      ctx.fillStyle = C.lemon;
      ctx.fillText(shown, x0, 834);
      ctx.restore();
    }
    const pk = E.outBack(seg(u, 20.2, 20.45));
    if (pk > 0) pill(LW / 2, 942, "광고 없음 · 개인정보 수집 없음", { size: 50 * END_PILL_K, bg: C.mint, color: C.ink, scale: pk, pad: 48 * END_PILL_K });
  }

  function renderLandscape(t) {
    BUBBLE_K = 1.4; // 대사 글자가 1080 높이에서 약 54px (카드 0.84배를 되돌린다), 오른쪽 안전 영역 안
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";

    if (t < 1.8) {
      const flash = t >= 1.4 && t < 1.4 + 2 / FPS;
      backdropL(t, 0, flash);
      staged(ST, () => scene1(t));
    } else if (t < 4.85) {
      backdropL(t);
      staged(ST, () => scene2(t));
    } else if (t < 5.12) {
      // 화면 전체가 왼쪽으로 밀리며 다음 장면이 들어온다
      const k = E.inOutCubic(seg(t, 4.85, 5.12));
      backdropL(t, -320 * k);
      ctx.save();
      ctx.translate(-1960 * k, 0);
      staged(ST, () => scene2(t));
      ctx.restore();
      ctx.save();
      ctx.translate(1960 * (1 - k), 0);
      staged(ST, () => scene3(Math.max(t, 5.0)));
      ctx.restore();
    } else if (t < 9.45) {
      backdropL(t, -320);
      staged(ST, () => scene3(t));
    } else if (t < 9.8) {
      backdropL(t, -320);
      staged(ST, () => scene3(t));
      const k = E.inCubic(seg(t, 9.45, 9.8));
      const c = toScreen(ST, KONGI_MINI());
      ctx.save();
      Draw.heart(ctx, c.x, c.y, 3200 * k);
      ctx.clip();
      backdropL(t);
      staged(ST, () => scene4(Math.max(t, 9.6)));
      ctx.restore();
      if (k < 1) {
        ctx.save();
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 14;
        ctx.shadowColor = C.pink;
        ctx.shadowBlur = 24;
        Draw.heart(ctx, c.x, c.y, 3200 * k);
        ctx.stroke();
        ctx.restore();
      }
    } else if (t < 11.6) {
      backdropL(t);
      staged(ST, () => scene4(t));
    } else if (t < 12.05) {
      backdropL(t);
      staged(ST, () => polaroid(t));
    } else if (t < 15.75) {
      backdropL(t);
      staged(ST, () => {
        scene5(t);
        scene5Caption(t);
      });
    } else if (t < 16.2) {
      backdropL(t);
      const sink = E.inCubic(seg(t, 15.8, 16.15));
      const dark = seg(t, 15.75, 16.0);
      ctx.save();
      ctx.translate(0, 1200 * sink);
      staged(ST, () => scene5(t, dark));
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - seg(t, 15.75, 15.9);
      staged(ST, () => scene5Caption(t));
      ctx.restore();
      const rise = E.outBack(seg(t, 15.85, 16.2));
      if (rise > 0) {
        ctx.save();
        ctx.translate(0, 1200 * (1 - rise));
        staged(ST6, () => scene6(Math.max(t, 16.0)));
        ctx.restore();
      }
    } else if (t < COLLAPSE_T) {
      backdropL(t);
      staged(ST6, () => scene6(t));
    } else if (t < 18.6) {
      backdropL(t);
      const top = toScreen(ST6, CLIP_TOP);
      const k = seg(t, COLLAPSE_T, 18.54);
      // 카드만 위쪽 끝을 축으로 줄인다 (부풀지 않게 1에서 멈춘다). 왼쪽 자막은 제자리에서 흐려진다.
      const s = Math.min(1, 1 - E.inBack(k));
      const prevSink = capSink;
      capSink = [];
      if (s > 0.01) {
        ctx.save();
        ctx.globalAlpha = 1 - seg(k, 0.6, 1);
        ctx.translate(top.x, top.y);
        ctx.scale(s, s);
        ctx.translate(-top.x, -top.y);
        ctx.translate(ST6.x, ST6.y);
        ctx.scale(ST6.s, ST6.s);
        ctx.translate(-ST6.fx, -ST6.fy);
        scene6(COLLAPSE_T);
        ctx.restore();
      }
      const caps = capSink;
      capSink = prevSink;
      ctx.save();
      ctx.globalAlpha = 1 - seg(k, 0, 0.6);
      leftCaptions(caps, ST6);
      ctx.restore();
      const f = E.inOutCubic(seg(t, 18.46, 18.6));
      ctx.save();
      ctx.globalAlpha = seg(t, COLLAPSE_T + 0.02, COLLAPSE_T + 0.08);
      ctx.translate(lerp(top.x, LW / 2, f), lerp(top.y, TITLE_Y_L, f));
      ctx.rotate(t * 8);
      const r = 30 + 40 * Math.sin(seg(t, COLLAPSE_T, 18.6) * Math.PI) + 10;
      ctx.shadowColor = C.lemon;
      ctx.shadowBlur = 40;
      ctx.fillStyle = C.lemon;
      ctx.strokeStyle = "#c48a00";
      ctx.lineWidth = 5;
      Draw.star(ctx, 0, 0, r, 5, 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      const u = Math.min(t, HOLD_T);
      backdropL(u);
      scene7L(u);
    }
  }

  // ================= 편집본(컷): 짧은 15초 · 아이용 20초 · 부모용 24.4초 =================
  // 기본 22초 컷의 장면 함수를 시간만 바꿔 다시 쓰고, 세로·가로 모두 같은 표로 그린다.
  // 기본 컷(CUT === "full")은 이 아래 코드를 전혀 거치지 않는다.
  const CUTS = {
    full: { dur: DUR, hold: HOLD_T },
    short: { dur: 15, hold: 14.5 },
    kids: { dur: 20, hold: 19.5 },
    parents: { dur: 24.4, hold: 23.9 },
  };
  const isL = () => FORMAT === "landscape";
  // outBack(0)은 0이 아니라 2.2e-16이라, 위치만 움직이는 곳에서는 시작 전에 그려지지 않게 0으로 자른다
  const OB = (s) => (s <= 0 ? 0 : E.outBack(s));
  function BG(t, par = 0, flash = false) {
    if (isL()) backdropL(t, par, flash);
    else backdrop(t, par, flash);
  }
  // 세로형은 그대로, 가로형은 오른쪽 무대에 놓고 자막은 왼쪽 칸으로
  function STG(st, fn) {
    if (isL()) staged(st, fn);
    else fn();
  }
  const SLIDE_D = () => (isL() ? 1960 : 1100);
  const SINK_D = () => (isL() ? 1200 : 1400);
  const scr = (st, p) => (isL() ? toScreen(st, p) : p);
  const titleAt = () => (isL() ? pt(LW / 2, TITLE_Y_L) : pt(540, TITLE_Y));
  function endCard(u) {
    if (isL()) scene7L(u);
    else scene7(u);
  }

  // 구간별 시간 재매핑 표: [t0, t1, u0, u1] (컷 시간 t → 원래 장면 시간 u)
  function remap(t, table) {
    for (const [t0, t1, u0, u1] of table) if (t <= t1) return lerp(u0, u1, seg(t, t0, t1));
    const l = table[table.length - 1];
    return l[3];
  }
  // 소리용 역매핑: 원래 시간 u가 들어 있는 첫 구간의 컷 시간 (없으면 null → 그 소리는 뺀다)
  function unmap(u, table) {
    for (const [t0, t1, u0, u1] of table) if (u >= u0 - 1e-9 && u <= u1 + 1e-9) return lerp(t0, t1, (u - u0) / (u1 - u0));
    return null;
  }

  // 화면 전체가 왼쪽으로 밀리며 다음 카드가 들어온다 (기본 컷 4.85–5.12와 같은 움직임)
  // win: 가로형에서 왼쪽 자막이 그대로 있을 때, 카드를 오른쪽 무대 안에서만 밀어 자막 위를 지나가지 않게 한다
  const WIN_X = 930;
  function slideSwap(t, t0, t1, outFn, inFn, par0 = 0, par1 = -320, stOut = ST, stIn = ST, win = false) {
    const k = E.inOutCubic(seg(t, t0, t1));
    const w = win && isL();
    const D = w ? 1000 : SLIDE_D();
    BG(t, lerp(par0, par1, k));
    ctx.save();
    if (w) {
      ctx.beginPath();
      ctx.rect(WIN_X, 0, LW - WIN_X, H);
      ctx.clip();
    }
    ctx.save();
    ctx.translate(-D * k, 0);
    STG(stOut, outFn);
    ctx.restore();
    ctx.save();
    ctx.translate(D * (1 - k), 0);
    STG(stIn, inFn);
    ctx.restore();
    ctx.restore();
  }

  // 미니 기계 속 콩이에서 하트가 커지며 방이 열린다 (기본 컷 9.45–9.8)
  function heartIris(t, k, outFn, inFn, par = -320, parIn = 0) {
    BG(t, par);
    STG(ST, outFn);
    const c = scr(ST, KONGI_MINI());
    const R = (isL() ? 3200 : 2800) * k;
    ctx.save();
    Draw.heart(ctx, c.x, c.y, R);
    ctx.clip();
    BG(t, parIn);
    STG(ST, inFn);
    ctx.restore();
    if (k < 1) {
      ctx.save();
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 14;
      ctx.shadowColor = C.pink;
      ctx.shadowBlur = 24;
      Draw.heart(ctx, c.x, c.y, R);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 엔드 카드로 날아가는 노란 별 (기본 컷 18.4–18.6과 같은 그림)
  function spinStar(x, y, t, r, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(t * 8);
    ctx.shadowColor = C.lemon;
    ctx.shadowBlur = 40;
    ctx.fillStyle = C.lemon;
    ctx.strokeStyle = "#c48a00";
    ctx.lineWidth = 5;
    Draw.star(ctx, 0, 0, r, 5, 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 자막 없이 무대만 그린다 (접히는 카드 안의 자막은 따로 그린다)
  function stageMuted(st, fn) {
    const prev = capSink;
    capSink = [];
    ctx.save();
    if (isL()) {
      ctx.translate(st.x, st.y);
      ctx.scale(st.s, st.s);
      ctx.translate(-st.fx, -st.fy);
    }
    fn();
    ctx.restore();
    capSink = prev;
  }

  // 카드가 한 점(originV, 세로형 좌표)으로 쏙 접히고 노란 별이 제목 자리로 간다
  function foldInto(t, t0, t1, st, originV, cardFn, capFn) {
    const o = scr(st, originV);
    const k = seg(t, t0, t1 - 0.06);
    const s = Math.min(1, 1 - E.inBack(k));
    if (s > 0.01) {
      ctx.save();
      ctx.globalAlpha = 1 - seg(k, 0.6, 1);
      ctx.translate(o.x, o.y);
      ctx.scale(s, s);
      ctx.translate(-o.x, -o.y);
      stageMuted(st, cardFn);
      ctx.restore();
    }
    if (capFn) STG(st, () => capFn(1 - seg(k, 0, 0.6)));
    const f = E.inOutCubic(seg(t, t1 - 0.14, t1));
    const T = titleAt();
    spinStar(lerp(o.x, T.x, f), lerp(o.y, T.y, f), t, 30 + 40 * Math.sin(seg(t, t0, t1) * Math.PI) + 10, seg(t, t0 + 0.02, t0 + 0.08));
  }

  // 자막 표: { at, end, text, sub, y, size } — at에 톡 튀어나오고 end 직전에 흐려진다
  function capsFrom(t, list, a = 1, ys = { head: 340, sub: 462 }) {
    for (const c of list) {
      if (t < c.at || t >= c.end) continue;
      const fade = c.end > 90 ? 1 : 1 - seg(t, c.end - 0.12, c.end);
      const y = c.y || (c.sub ? ys.sub : ys.head);
      caption(c.text, y, {
        own: true,
        sub: !!c.sub,
        size: c.size || (c.sub ? 62 : 112),
        scale: c.noPop ? 1 : popIn(t, c.at, c.sub ? 0.25 : 0.28),
        alpha: a * fade * (c.fadeIn ? seg(t, c.at, c.at + c.fadeIn) : 1),
      });
    }
  }

  // 손가락 길: [[t, x, y], ...] 사이를 부드럽게 잇는다
  function kf(t, keys) {
    if (t <= keys[0][0]) return pt(keys[0][1], keys[0][2]);
    for (let i = 1; i < keys.length; i++) {
      const [ta, xa, ya] = keys[i - 1];
      const [tb, xb, yb] = keys[i];
      if (t <= tb) {
        const k = E.inOutCubic(seg(t, ta, tb));
        return pt(lerp(xa, xb, k), lerp(ya, yb, k));
      }
    }
    const l = keys[keys.length - 1];
    return pt(l[1], l[2]);
  }
  const pressAt = (t, times, d = 0.1) => (times.some((a) => t >= a - 0.02 && t < a + d) ? 1 : 0);

  // ---------- 짧은 컷 (15초) ----------
  const SHORT_M3 = [
    [3.87, 4.8, 5.0, 6.3],
    [4.8, 5.85, 6.3, 8.4],
    [5.85, 6.85, 8.4, 9.45],
    [6.85, 7.2, 9.45, 9.8],
  ];
  const SHORT_M4 = [
    [7.2, 8.0, 9.8, 10.6],
    [8.0, 8.3, 11.6, 12.05],
  ];
  const SHORT_M5 = [
    [8.3, 9.0, 12.05, 12.75],
    [9.0, 9.95, 12.75, 13.98],
    [9.95, 10.1, 13.98, 14.4],
    [10.1, 11.5, 14.4, 15.75],
    [11.5, 12.0, 15.75, 16.2],
  ];
  const SHORT_END = 6.6; // 엔드 카드: u = t + 6.6

  // 짧은 컷 마을 자막: 제목은 장면 5 그대로, 작은 줄은 컷 시간표로 (숨바꼭질을 1.2초 남짓 보여 준다)
  const SHORT_V_SUBS = [
    { at: 8.3, end: 8.95, text: "톡! 말 걸기", sub: true, y: 455, size: 64 },
    { at: 8.95, end: 10.12, text: "숨바꼭질", sub: true, y: 455, size: 64 },
    { at: 10.12, end: 99, text: "소풍 가자!", sub: true, y: 455, size: 64 },
  ];
  function shortVillageCaption(t, u) {
    const h = capHook;
    capHook = (text, y, o) => !o.sub;
    try {
      scene5Caption(u);
    } finally {
      capHook = h;
    }
    capsFrom(t, SHORT_V_SUBS);
  }

  function renderShort(t) {
    BEAR_HOME = true;
    if (t < 1.8) {
      BG(t, 0, t >= 1.4 && t < 1.4 + 2 / FPS);
      STG(ST, () => scene1(t));
    } else if (t < 3.6) {
      BG(t);
      STG(ST, () => scene2(t, { dex: false }));
    } else if (t < 3.87) {
      slideSwap(t, 3.6, 3.87, () => scene2(t, { dex: false }), () => scene3(5.0));
    } else if (t < 6.85) {
      BG(t, -320);
      const u = remap(t, SHORT_M3);
      STG(ST, () => scene3(u));
    } else if (t < 7.2) {
      const u = remap(t, SHORT_M3);
      heartIris(t, E.inCubic(seg(u, 9.45, 9.8)), () => scene3(u), () => scene4(Math.max(u, 9.6)));
    } else if (t < 8.0) {
      BG(t);
      const u = remap(t, SHORT_M4);
      STG(ST, () => scene4(u));
    } else if (t < 8.3) {
      BG(t);
      const u = remap(t, SHORT_M4);
      STG(ST, () => polaroid(u));
    } else if (t < 11.5) {
      BG(t);
      const u = remap(t, SHORT_M5);
      STG(ST, () => {
        scene5(u);
        shortVillageCaption(t, u);
      });
    } else if (t < 12.0) {
      BG(t);
      const u = remap(t, SHORT_M5);
      const sink = E.inCubic(seg(u, 15.8, 16.15));
      const dark = seg(u, 15.75, 16.0);
      ctx.save();
      ctx.translate(0, SINK_D() * sink);
      STG(ST, () => scene5(u, dark));
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - seg(t, 11.5, 11.65);
      STG(ST, () => shortVillageCaption(t, u));
      ctx.restore();
      // 콩이 자리에서 노란 별이 나와 제목 자리로 (12.0에 닿는다)
      const o = scr(ST, vw2s(KONGI_TO.x, KONGI_TO.y));
      const T = titleAt();
      const f = E.inOutCubic(seg(t, 11.6, 12.0));
      spinStar(lerp(o.x, T.x, f), lerp(o.y, T.y, f), t, 30 + 40 * Math.sin(seg(t, 11.5, 12.0) * Math.PI) + 10, seg(t, 11.52, 11.6));
    } else {
      const tc = Math.min(t, CUTS.short.hold);
      BG(tc);
      endCard(tc + SHORT_END);
    }
  }

  // ---------- 아이용 컷 (20초) ----------
  const KIDS_COPY = {
    "한 번 톡! 쉬운 뽑기": "톡! 눌러서 뽑기",
    "인형 12종 + 비밀 친구": "친구 12명 + 비밀 친구",
    "기계 속에 내 인형이!": "기계 속에 콩이가!",
  };
  const K_SPOT = {};
  Village.spots().forEach((s) => (K_SPOT[s.id] = s));
  const K_BUSH = Village.BUSHES.find((b) => b.id === "bushD");
  const K_HIDE_FROM = { x: 120, y: 250 };
  const K_POP_TO = { x: 70, y: 258 };
  const BEAR_FAV = Village.favorite(Village.persona("bear")); // calm → honey (게임의 실제 표)
  const LOVE_LINE = I18N.pick("picnic.love", {}, () => 0);
  const TRAY = { y: 1580, xs: [640, 760, 880], snacks: [BEAR_FAV, "berry", "cookie"] };
  const OUT_V = [1000, 1760];
  // 마을 카메라: 숨바꼭질은 덤불D·미끄럼틀·덤불A 쪽으로 가까이, 소풍과 걷기는 돗자리 둘레로
  const K_WIDE = { x: Village.W / 2, y: Village.H / 2, z: 1 };
  const K_HIDE_CAM = { x: 104, y: 318, z: 1.75 };
  const K_PICNIC_CAM = { x: 170, y: 292, z: 1.3 };
  function kidsCam(t) {
    const a = E.inOutCubic(seg(t, 11.3, 11.85));
    const b = E.inOutCubic(seg(t, 13.85, 14.45));
    const from = b > 0 ? K_HIDE_CAM : K_WIDE;
    const to = b > 0 ? K_PICNIC_CAM : K_HIDE_CAM;
    const k = b > 0 ? b : a;
    // 줌은 로그로 보간하고, 중심은 화면 속 점이 곧게 움직이도록 1/z에 맞춰 옮긴다
    const z = Math.exp(lerp(Math.log(from.z), Math.log(to.z), k));
    const w = (1 / z - 1 / from.z) / (1 / to.z - 1 / from.z);
    return { x: lerp(from.x, to.x, w), y: lerp(from.y, to.y, w), z };
  }
  function withKCam(t, fn) {
    const prev = KCAM;
    KCAM = kidsCam(t);
    try {
      return fn();
    } finally {
      KCAM = prev;
    }
  }
  const K_WRONG = ["slide", "bushA"]; // 틀린 곳 두 군데 (숨은 덤불D 가까이라 한 화면에 들어온다)

  function kSeat(wk, idx, t) {
    const k = E.inOutCubic(seg(t, 14.2, 14.75));
    if (k <= 0) return wk;
    const s = SEATS[idx];
    wk.x = lerp(wk.x, s.x, k);
    wk.y = lerp(wk.y, s.y, k);
    wk.walkT = t;
    if (k >= 1) {
      wk.talking = true;
      wk.wait = 1;
    }
    return wk;
  }

  function kidsBunny(t) {
    const b = { type: "bunny", name: "토끼", pets: 11, x: K_HIDE_FROM.x, y: K_HIDE_FROM.y, dir: -1, walkT: t, wait: 1, talking: false };
    if (t < 11.35) {
      b.x += Math.sin(t * 1.5) * 4;
    } else if (t < 11.72) {
      const k = E.inOutCubic(seg(t, 11.35, 11.72));
      b.x = lerp(K_HIDE_FROM.x, K_BUSH.x + 8, k);
      b.y = lerp(K_HIDE_FROM.y, K_BUSH.y + 6, k);
      b.wait = 0;
    } else if (t < 13.5) {
      b.hidden = true;
      b.x = K_BUSH.x;
      b.y = K_BUSH.y;
    } else {
      const p = E.outCubic(seg(t, 13.5, 13.75));
      b.x = lerp(K_BUSH.x, K_POP_TO.x, p);
      b.y = lerp(K_BUSH.y, K_POP_TO.y, p) - Math.sin(p * Math.PI) * 50;
      b.dir = 1;
      b.talking = true;
      return kSeat(b, 1, t);
    }
    return b;
  }

  function kidsKongi(t) {
    if (t < 16.6) return { type: "mine", name: "콩이", pets: 12, x: KONGI_FROM.x + Math.sin(t * 1.2) * 4, y: KONGI_FROM.y, dir: 1, walkT: t, wait: 1, talking: false };
    const p = alongPath(E.inOutCubic(seg(t, 16.6, 17.15)));
    return { type: "mine", name: "콩이", pets: 12, x: p.x, y: p.y, dir: p.dir, walkT: t, wait: t < 17.15 ? 0 : 1, talking: false };
  }

  function kidsWalkers(t) {
    const tw = Math.min(t, 14.2);
    const ws = [];
    ws.push(kSeat(loopWalker("cat", "고양이", 10, 206, 236, 16, 6, 1.6, 0.2, tw), 0, t));
    const bear = kSeat(loopWalker("bear", "곰돌이", t >= 15.7 ? 8 : 6, 112, 300, 26, 8, 1.3, 1.1, tw), 2, t);
    ws.push(bear);
    const bunny = kidsBunny(t);
    if (!bunny.hidden) ws.push(bunny);
    ws.push(kSeat(loopWalker("chick", "병아리", 3, 214, 316, 12, 5, 1.8, 0.6, tw), 3, t));
    ws.push(loopWalker("penguin", "펭귄", 4, 322, 318, 8, 5, 1.4, 0.9, t));
    ws.push(kidsKongi(t));
    return ws;
  }

  // 덤불 속으로 쏙 (게임 그림 함수로 직접 줄여 그린다)
  function kidsVillageExtra(t) {
    const k = seg(t, 11.72, 11.86);
    if (k > 0 && k < 1) {
      const s = 1 - E.inBack(k);
      if (s > 0.01) {
        vctx.save();
        vctx.translate(K_BUSH.x + 8, K_BUSH.y + 6);
        vctx.scale(s, s);
        Draw.plush(vctx, { type: "bunny", x: 0, y: 0, radius: Village.RADIUS, react: "idle" });
        vctx.restore();
      }
    }
  }

  function leafBurst(x, y, dt) {
    if (dt < 0 || dt > 0.6) return;
    const r = mulberry32(SEED + 61);
    const k = E.outCubic(dt / 0.6);
    ctx.save();
    ctx.globalAlpha = 1 - seg(dt, 0.3, 0.6);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU;
      const d = 60 + r() * 70;
      ctx.save();
      ctx.translate(x + Math.cos(a) * d * k, y + Math.sin(a) * d * k - 30 * k);
      ctx.rotate(a + dt * 6);
      ctx.fillStyle = i % 3 ? "#5fcf7e" : "#9be27a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 8, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 간식 그림 (그림 문자 없이 캔버스 도형만)
  function snackBerry(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#ff4f6d";
    ctx.strokeStyle = "#b8213d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.bezierCurveTo(-26, 8, -24, -16, -10, -16);
    ctx.quadraticCurveTo(0, -18, 10, -16);
    ctx.bezierCurveTo(24, -16, 26, 8, 0, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe36a";
    for (const [sx, sy] of [[-8, -4], [6, -6], [-2, 6], [10, 6], [-10, 8], [2, 15]]) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, 2, 3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#4fbf6a";
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(0, -17);
      ctx.rotate(-1.2 + i * 0.8);
      ctx.beginPath();
      ctx.ellipse(0, -6, 4, 9, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function snackCookie(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#e9b46a";
    ctx.strokeStyle = "#a8743a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6b3f22";
    for (const [cx, cy] of [[-9, -8], [8, -10], [-2, 4], [11, 7], [-12, 9]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawSnack(id, x, y, s) {
    if (id === "honey") honeyPot(x, y + 2, s * 1.05);
    else if (id === "berry") snackBerry(x, y, s);
    else snackCookie(x, y, s);
  }

  function snackTray(t) {
    const up = OB(seg(t, 14.8, 15.0));
    const down = E.inCubic(seg(t, 16.2, 16.4));
    if (up <= 0 || down >= 1) return;
    const dy = (1 - up) * 200 + down * 220;
    ctx.save();
    ctx.translate(0, dy);
    ctx.shadowColor = "rgba(30,8,40,0.35)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.roundRect(566, TRAY.y - 68, 388, 136, 44);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 6;
    ctx.stroke();
    TRAY.xs.forEach((x, i) => {
      const id = TRAY.snacks[i];
      const picked = i === 0 && t >= 15.3;
      const b = i === 0 ? spring(t - 15.3) : 0;
      ctx.save();
      ctx.translate(x, TRAY.y);
      ctx.scale(1 + 0.18 * b, 1 - 0.18 * b);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = i === 0 && t >= 15.25 ? C.lemon : "rgba(90,45,134,0.3)";
      ctx.lineWidth = i === 0 && t >= 15.25 ? 9 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, 54, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = picked ? 0.3 : 1;
      drawSnack(id, 0, 0, 1.5);
      ctx.restore();
    });
    ctx.restore();
  }

  function kidsVillage(t, sink = 0) {
    return withKCam(t, () => kidsVillageCam(t, sink));
  }
  function kidsVillageCam(t, sink = 0) {
    const walkers = kidsWalkers(t);
    const opts = {
      picnic: t >= 14.2,
      rustle: t >= 12.85 && t < 13.5 ? "bushD" : null,
      checked: t >= 13.5 ? [] : t >= 12.78 ? K_WRONG : t >= 12.38 ? K_WRONG.slice(0, 1) : [],
      fx: [],
    };
    const af = t - 17.15;
    if (af > 0 && af < 0.7) opts.fx.push({ x: KONGI_TO.x + 14, y: KONGI_TO.y - 30 - af * 40, life: 1 - af / 0.7 });
    const evening = seg(t, 14.2, 14.45);
    const bear = walkers.find((w) => w.type === "bear");
    const bb = vw2s(bear.x, bear.y);
    cardFrame(VR, () => {
      paintVillage(t, "day", walkers, opts);
      kidsVillageExtra(t);
      ctx.drawImage(vcan, VR.x, VR.y, VR.w, VR.h);
      if (evening > 0) {
        paintVillage(t, "evening", walkers, opts);
        kidsVillageExtra(t);
        ctx.globalAlpha = evening;
        ctx.drawImage(vcan, VR.x, VR.y, VR.w, VR.h);
        ctx.globalAlpha = 1;
      }
      if (sink > 0) {
        ctx.fillStyle = `rgba(20, 8, 50, ${0.6 * sink})`;
        ctx.fillRect(0, 0, W, H);
      }
      const bush = vw2s(K_BUSH.x, K_BUSH.y);
      leafBurst(bush.x, bush.y - 10, t - 11.8);
      // 틀린 곳 두 번 → 부스럭 → 찾았다
      const sl = vw2s(K_SPOT[K_WRONG[0]].x, K_SPOT[K_WRONG[0]].y);
      const tr = vw2s(K_SPOT[K_WRONG[1]].x, K_SPOT[K_WRONG[1]].y);
      ripple(sl.x, sl.y, t - 12.35, C.lemon, 100, 2);
      ripple(tr.x, tr.y, t - 12.75, C.lemon, 100, 2);
      ripple(bush.x, bush.y, t - 13.45, C.lemon, 100, 2);
      // 부스럭 힌트: 노란 고리가 두근두근, 잎이 튀고, 덤불 위에 "부스럭!"
      if (t >= 12.85 && t < 13.5) {
        const hk = seg(t, 12.85, 12.95) * (1 - seg(t, 13.4, 13.5));
        const beat = 0.5 + 0.5 * Math.sin((t - 12.85) * TAU * 3);
        ctx.save();
        ctx.globalAlpha = hk * (0.55 + 0.45 * beat);
        ctx.strokeStyle = C.lemon;
        ctx.shadowColor = C.lemon;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(bush.x, bush.y - 6, 92 + 10 * beat, 0, TAU);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = hk;
        pill(bush.x + 70, bush.y - 150, "부스럭!", { size: 50, bg: C.lemon, color: C.ink, stroke: "#c47a12", scale: popIn(t, 12.85, 0.2) * (1 + 0.05 * beat), pad: 30 });
        ctx.restore();
      }
      leafBurst(bush.x, bush.y - 10, t - 12.85);
      leafBurst(bush.x, bush.y - 10, t - 13.15);
      for (const [at, p] of [
        [12.38, sl],
        [12.78, tr],
      ]) {
        const a = seg(t, at, at + 0.06) * (1 - seg(t, at + 0.36, at + 0.44));
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          pill(p.x, p.y - 118, "없네~", { size: 46, bg: C.cream, color: C.ink, stroke: C.pink, scale: popIn(t, at, 0.2), pad: 30 });
          ctx.restore();
        }
      }
      if (t >= 13.5) {
        const bun = walkers.find((w) => w.type === "bunny");
        const bp = vw2s(bun.x, bun.y);
        sparkRing(bp.x, bp.y, t - 13.65, 90, 14);
        burst(bp.x, bp.y - 30, t - 13.55, { stars: 6, hearts: 4, dist: 170, seed: SEED + 62, scale: 0.65, core: false });
      }
      // 소풍: 간식 쟁반 → 꿀단지 → 곰돌이 +2
      snackTray(t);
      const chip = pt(TRAY.xs[0], TRAY.y);
      const top = pt(bb.x, bb.y - 46);
      const hk = seg(t, 15.36, 15.6);
      if (t >= 15.3 && t < 15.7) {
        let x;
        let y;
        let s = 1.5;
        if (t < 15.36) {
          x = chip.x;
          y = chip.y;
        } else if (t < 15.6) {
          const e = E.inOutCubic(hk);
          x = lerp(chip.x, top.x, e);
          y = lerp(chip.y, top.y, e) - Math.sin(hk * Math.PI) * 140;
          s = 1.5 + 0.2 * Math.sin(hk * Math.PI);
        } else {
          x = top.x;
          y = top.y;
          s = 1.5 * (1 - E.inBack(seg(t, 15.6, 15.7)));
        }
        if (s > 0.01) honeyPot(x, y, s);
      }
      const lk = t - 15.7;
      if (lk > 0 && lk < 0.9) {
        ctx.save();
        ctx.globalAlpha = 1 - seg(lk, 0.6, 0.9);
        const y = bb.y - 90 - lk * 60;
        const s = 1 + 0.25 * spring(lk);
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = "#ff5c9a";
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 4;
          Draw.heart(ctx, bb.x - 34 + i * 60, y, 30 * s);
          ctx.fill();
          ctx.stroke();
        }
        ctx.font = "72px 'Jua'";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 12;
        ctx.strokeStyle = C.grape;
        ctx.strokeText("+2", bb.x + 56, y - 12);
        ctx.fillStyle = C.lemon;
        ctx.fillText("+2", bb.x + 56, y - 12);
        ctx.restore();
        sparkRing(bb.x, bb.y, lk, 80, 12);
      }
      // 땅 톡 → 콩이가 콩콩
      const tg = vw2s(KONGI_TO.x, KONGI_TO.y);
      ripple(tg.x, tg.y, t - 16.55, C.lemon, 90, 2);
      if (t >= 16.55 && t < 17.2) {
        ctx.save();
        ctx.globalAlpha = 0.65 * (1 - seg(t, 17.05, 17.2));
        ctx.fillStyle = C.lemon;
        Draw.star(ctx, tg.x, tg.y, 20, 4, 0.45);
        ctx.fill();
        ctx.restore();
      }
    });
    // 손가락 (카드 밖에서 들어온다)
    const tr = vw2s(K_SPOT[K_WRONG[1]].x, K_SPOT[K_WRONG[1]].y);
    const sl = vw2s(K_SPOT[K_WRONG[0]].x, K_SPOT[K_WRONG[0]].y);
    const bu = vw2s(K_BUSH.x, K_BUSH.y);
    const tg = vw2s(KONGI_TO.x, KONGI_TO.y);
    const chip = pt(TRAY.xs[0], TRAY.y);
    let fa = 0;
    let fp = null;
    let press = 0;
    if (t < 14.0) {
      fa = seg(t, 11.95, 12.05) * (1 - seg(t, 13.6, 13.8));
      fp = kf(t, [
        [11.95, ...OUT_V],
        [12.3, sl.x, sl.y],
        [12.45, sl.x, sl.y],
        [12.7, tr.x, tr.y],
        [12.95, tr.x, tr.y],
        [13.4, bu.x, bu.y],
        [13.55, bu.x, bu.y],
        [13.8, ...OUT_V],
      ]);
      press = pressAt(t, [12.35, 12.75, 13.45]);
    } else if (t < 16.0) {
      const top = pt(bb.x, bb.y - 46);
      fa = seg(t, 15.0, 15.08) * (1 - seg(t, 15.66, 15.85));
      if (t < 15.36) fp = kf(t, [[15.0, ...OUT_V], [15.26, chip.x, chip.y]]);
      else if (t < 15.6) {
        const hk = seg(t, 15.36, 15.6);
        const e = E.inOutCubic(hk);
        fp = pt(lerp(chip.x, top.x, e), lerp(chip.y, top.y, e) - Math.sin(hk * Math.PI) * 140);
      } else fp = kf(t, [[15.62, top.x, top.y], [15.85, ...OUT_V]]);
      press = t >= 15.28 && t < 15.6 ? 1 : 0;
      if (fp && t >= 15.36 && t < 15.6) fp = pt(fp.x + 26, fp.y + 34);
    } else {
      fa = seg(t, 16.3, 16.38) * (1 - seg(t, 16.7, 16.9));
      fp = kf(t, [[16.3, ...OUT_V], [16.5, tg.x, tg.y], [16.65, tg.x, tg.y], [16.9, ...OUT_V]]);
      press = pressAt(t, [16.55]);
    }
    if (fa > 0 && fp) finger(fp.x, fp.y, press, fa);
    // 곰돌이 말풍선 (미리 쓴 대사)
    const bk = OB(seg(t, 15.75, 15.95)) * (1 - seg(t, 16.25, 16.38));
    if (bk > 0) bubble(540, bb.y - 350, LOVE_LINE, bk * (isL() ? 1.2 : 1), bb.x, bb.y - 60, bear.name);
  }

  const KIDS_CAPS = [
    { at: 11.32, end: 13.5, text: "숨바꼭질!" },
    { at: 13.5, end: 14.7, text: "찾았다!" },
    { at: 14.7, end: 16.5, text: "소풍 가자!" },
    { at: 16.5, end: 99, text: "톡! 이리 와!" },
    { at: 11.8, end: 13.5, text: "어디 숨었지?", sub: true },
    { at: 14.95, end: 16.5, text: "좋아하는 간식은 하트 2개!", sub: true },
    { at: 16.6, end: 99, text: "콩이가 콩콩 따라와요", sub: true },
  ];
  const kidsCaps = (t, a = 1) => capsFrom(t, KIDS_CAPS, a);

  function renderKids(t) {
    capHook = (text) => KIDS_COPY[text] || true;
    END_PILL_K = 40 / 48;
    if (t < 1.8) {
      BG(t, 0, t >= 1.4 && t < 1.4 + 2 / FPS);
      STG(ST, () => scene1(t));
    } else if (t < 4.6) {
      BG(t);
      STG(ST, () => scene2(t));
    } else if (t < 4.87) {
      slideSwap(t, 4.6, 4.87, () => scene2(t + 0.25), () => scene3(Math.max(t + 0.25, 5.0)));
    } else if (t < 9.2) {
      BG(t, -320);
      STG(ST, () => scene3(t + 0.25));
    } else if (t < 9.55) {
      const u = t + 0.25;
      const k = E.inCubic(seg(u, 9.45, 9.8));
      // 하트가 열리는 동안 두 제목이 반반 섞여 읽히지 않게: 나가는 장면은 자막을 끄고, 들어오는 자막은 거의 다 열렸을 때만
      const mute = (fn) => () => {
        const h = capHook;
        capHook = () => false;
        try {
          fn();
        } finally {
          capHook = h;
        }
      };
      const inFn = () => scene4(Math.max(u, 9.6));
      heartIris(t, k, mute(() => scene3(u)), k >= 0.9 ? inFn : mute(inFn));
    } else if (t < 11.0) {
      BG(t);
      STG(ST, () => scene4(t + 0.25));
    } else if (t < 11.3) {
      slideSwap(t, 11.0, 11.3, () => scene4(11.25), () => {
        kidsVillage(11.3);
        kidsCaps(11.3);
      });
    } else if (t < 17.3) {
      BG(t, -320);
      STG(ST, () => {
        kidsVillage(t);
        kidsCaps(t);
      });
    } else if (t < 17.6) {
      BG(t, -320);
      foldInto(t, 17.3, 17.6, ST, withKCam(17.3, () => vw2s(KONGI_TO.x, KONGI_TO.y)), () => kidsVillage(17.3), (a) => kidsCaps(17.3, a));
    } else {
      const tc = Math.min(t, CUTS.kids.hold);
      BG(tc, -320);
      endCard(tc + 1.0);
    }
  }

  // ---------- 부모용 컷 (24.4초) ----------
  // 게임 대화상자(.dialog.candy) 모양을 캔버스로 다시 그린다: 보라 그라데이션 + 분홍 테두리
  const LILAC = "#cbb6ff";
  const COTTON = "#ffeaf4";
  function dialogBox(cx, cy, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 121, 199, 0.35)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 - 14, cy - h / 2 - 14, w + 28, h + 28, 60);
    ctx.stroke();
    ctx.shadowColor = "rgba(255, 121, 199, 0.6)";
    ctx.shadowBlur = 50;
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, C.grape);
    g.addColorStop(1, C.plum);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 48);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
  }
  function dlgText(text, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = `${size}px 'Jua'`;
    if (o.maxW) fitFont(text, size, o.maxW);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(text, x, y + 6);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function lemonButton(x, y, w, h, label, o = {}) {
    ctx.save();
    ctx.translate(x, y + (o.press ? 6 : 0));
    const s = o.scale == null ? 1 : o.scale;
    ctx.scale(s, s);
    if (o.picked) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 30;
    }
    ctx.fillStyle = "#c47a12";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2 + (o.press ? 2 : 8), w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, "#ffe36a");
    g.addColorStop(1, "#ffc44d");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    if (o.picked) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14, h / 2 + 7);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.roundRect(-w / 2 + h * 0.35, -h / 2 + 10, w - h * 0.7, h * 0.18, h * 0.09);
    ctx.fill();
    ctx.translate(0, 3);
    const ls = o.labelScale || 1;
    ctx.scale(ls, ls);
    ctx.font = `${o.size || 60}px 'Jua'`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3a1230";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  function ghostButton(x, y, w, h, label, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (o.glow > 0) {
      ctx.save();
      ctx.globalAlpha *= o.glow;
      ctx.shadowColor = C.pink;
      ctx.shadowBlur = 40;
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, h / 2 + 6);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = o.bg || "rgba(255, 234, 244, 0.1)";
    ctx.strokeStyle = LILAC;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    const icon = o.icon ? o.iconW || 56 : 0;
    ctx.font = `${o.size || 44}px 'Jua'`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COTTON;
    ctx.fillText(label, icon / 2, 3);
    if (o.icon) {
      const tw = ctx.measureText(label).width;
      o.icon(-tw / 2 - icon / 2 + 6, 0);
    }
    ctx.restore();
  }
  function checkMark(x, y, s, ck) {
    if (ck <= 0) return;
    const P = [pt(-24, 0), pt(-6, 20), pt(28, -22)];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [lw, col] of [
      [20, C.grape],
      [11, C.mint],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      const k1 = clamp(ck / 0.4);
      ctx.lineTo(lerp(P[0].x, P[1].x, k1), lerp(P[0].y, P[1].y, k1));
      if (ck > 0.4) {
        const k2 = clamp((ck - 0.4) / 0.6);
        ctx.lineTo(lerp(P[1].x, P[2].x, k2), lerp(P[1].y, P[2].y, k2));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function starStamp(x, y, t0, t, s = 1) {
    if (t < t0) return;
    const sq = squash(t - t0, 1.4);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (1 + sq.squashX), s * (1 + sq.squashY));
    ctx.fillStyle = C.lemon;
    ctx.strokeStyle = "#c48a00";
    ctx.lineWidth = 5;
    Draw.star(ctx, 0, 0, 54, 5, 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    checkMark(x, y, s, E.outCubic(seg(t, t0 + 0.06, t0 + 0.24)));
  }
  function cameraGlyph(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COTTON;
    ctx.beginPath();
    ctx.roundRect(-24, -14, 48, 32, 8);
    ctx.roundRect(-10, -21, 20, 10, 4);
    ctx.fill();
    ctx.fillStyle = C.grape;
    ctx.beginPath();
    ctx.arc(0, 2, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COTTON;
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function iconChat(x, y, k) {
    ctx.save();
    ctx.fillStyle = C.cream;
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 62, y - 42, 124, 74, 30);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 30, y + 30);
    ctx.lineTo(x - 44, y + 52);
    ctx.lineTo(x - 8, y + 31);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.fillRect(x - 32, y + 24, 26, 9);
    ctx.fillStyle = C.ink;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(x + i * 26, y - 5, 8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    crossLine(x - 70, y - 50, x + 66, y + 52, k);
  }
  function wifiTile(x, y) {
    ctx.save();
    ctx.fillStyle = "#d9fff3";
    ctx.strokeStyle = C.grape;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 62, y - 48, 124, 96, 22);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    wifiIcon(x, y - 6, 92);
  }

  // 방 그림 (콩이 쓰담 뒤, 곰돌이를 옮긴 자리)
  const ROOM_AFTER = ROOM_BASE.map((p) => {
    const q = Object.assign({}, p);
    if (p.type === "mine") q.pets = p.pets + 3;
    if (p.type === "bear") {
      q.x = 132;
      q.y = 256;
    }
    return q;
  });
  const PH = { x: 540, y: 975, w: 420, h: 500 }; // 콩이 사진 (폴라로이드)
  function kongiPhoto(t) {
    ctx.save();
    ctx.translate(PH.x, PH.y);
    ctx.rotate(-0.04);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#fffaf2";
    ctx.beginPath();
    ctx.roundRect(-PH.w / 2, -PH.h / 2, PH.w, PH.h, 22);
    ctx.fill();
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, -PH.h / 2 + 30, 0, 120);
    g.addColorStop(0, "#ffd6ec");
    g.addColorStop(1, "#ffeecf");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-PH.w / 2 + 28, -PH.h / 2 + 28, PH.w - 56, PH.w - 56, 12);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 6; i++) Draw.felt(ctx, -150 + (i % 3) * 150, -180 + Math.floor(i / 3) * 250, 11, 10, ["#ffb3c7", "#ffe36a", "#7de3b0"][i % 3]);
    ctx.restore();
    ctx.translate(0, -PH.h / 2 + 28 + (PH.w - 56) / 2 + 14);
    ctx.scale(3.4, 3.4);
    Draw.plush(ctx, { type: "mine", spec: KONGI, x: 0, y: 0, radius: 44 / 1.7, blink: blinkAt(t, 0.7), react: "success" });
    ctx.restore();
    ctx.save();
    ctx.translate(PH.x, PH.y);
    ctx.rotate(-0.04);
    ctx.font = "52px 'Jua'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.grape;
    ctx.fillText("콩이", 0, PH.h / 2 - 58);
    ctx.restore();
  }

  // 공유 전 보호자 확인 (7 × 8 = ?, 보기 4개: 게임의 Fun.parentQuestion이 7×8에 만드는 보기)
  const GATE = { cx: 540, cy: 1085, w: 780, h: 770 };
  const GATE_CHOICES = [
    ["63", 380, 1150],
    ["56", 700, 1150],
    ["48", 380, 1272],
    ["57", 700, 1272],
  ];
  const GATE_TAP = 10.45;
  const SHARE_Y = 1340;

  function sceneGate(t) {
    cardFrame(CARD, () => {
      ctx.save();
      ctx.translate(ROOM_R.x, ROOM_R.y);
      ctx.scale(ROOM_Z, ROOM_Z);
      Room.paint(ctx, ROOM_AFTER, { time: t, anim: {} });
      ctx.restore();
      ctx.fillStyle = "rgba(20, 8, 50, 0.45)";
      ctx.fillRect(0, 0, W, H);
      kongiPhoto(t);
      // 방의 사진 찍기 버튼 (게임의 roomPhotoBtn) → 확인 뒤에는 민트 알약
      const ba = 1 - seg(t, 11.05, 11.25);
      if (ba > 0) {
        ctx.save();
        ctx.globalAlpha = ba;
        ghostButton(540, SHARE_Y, 360, 96, "사진 찍기", {
          size: 48,
          bg: "rgba(53, 20, 80, 0.85)",
          press: pressAt(t, [8.85]),
          icon: (x, y) => cameraGlyph(x, y),
          iconW: 64,
        });
        ctx.restore();
      }
      ripple(540, SHARE_Y, t - 8.85, C.mint, 160, 2);
      const pk = OB(seg(t, 11.3, 11.55));
      if (pk > 0) pill(540, SHARE_Y, "어른 확인 후에만 밖으로", { size: 50, bg: C.mint, color: C.ink, scale: pk, pad: 44 });
      // 사진에 확인 도장
      starStamp(PH.x + 170, PH.y - 215, 11.1, t, 0.9);
      // 어두운 막 + 대화상자
      const sa = seg(t, 9.0, 9.3) * (1 - seg(t, 10.95, 11.3));
      if (sa > 0) {
        ctx.fillStyle = `rgba(20, 8, 50, ${0.55 * sa})`;
        ctx.fillRect(0, 0, W, H);
      }
      const dk = OB(seg(t, 9.0, 9.3));
      const out = seg(t, 10.9, 11.3);
      const ds = dk * (1 - E.inBack(out));
      if (ds > 0.01 && t < 11.3) {
        ctx.save();
        const ox = lerp(GATE.cx, PH.x, E.inCubic(out));
        const oy = lerp(GATE.cy, PH.y, E.inCubic(out));
        ctx.translate(ox, oy);
        ctx.scale(ds, ds);
        ctx.translate(-GATE.cx, -GATE.cy);
        ctx.globalAlpha = 1 - seg(out, 0.7, 1);
        gateDialog(t);
        ctx.restore();
      }
    });
    // 아이 손가락: 사진 찍기 톡
    const fk = seg(t, 8.38, 8.45) * (1 - seg(t, 9.0, 9.2));
    if (fk > 0) {
      const p = kf(t, [
        [8.38, 200, 1800],
        [8.78, 552, SHARE_Y + 8],
        [8.95, 552, SHARE_Y + 8],
        [9.2, 260, 1820],
      ]);
      finger(p.x, p.y, pressAt(t, [8.85]), fk);
    }
    // 어른 손가락 (더 크고 오른쪽 아래에서)
    const ak = seg(t, 9.6, 9.7) * (1 - seg(t, 10.65, 10.9));
    if (ak > 0) {
      const p = kf(t, [
        [9.6, 1120, 1900],
        [10.36, 772, 1182],
        [10.6, 772, 1182],
        [10.9, 1140, 1900],
      ]);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1.22, 1.22);
      finger(0, 0, pressAt(t, [GATE_TAP]), ak, -0.2);
      ctx.restore();
    }
  }

  function gateDialog(t) {
    const G = GATE;
    dialogBox(G.cx, G.cy, G.w, G.h);
    const top = G.cy - G.h / 2;
    dlgText("보호자 확인", G.cx, top + 66, 46, LILAC, { spacing: 6 });
    dlgText("7 × 8 = ?", G.cx, top + 170, 124, COTTON, { shadow: "#7a2d6a" });
    dlgText("밖으로 보내기 전에", G.cx, top + 272, 46, COTTON);
    dlgText("어른이 풀어 주세요.", G.cx, top + 326, 46, COTTON);
    for (const [label, x, y] of GATE_CHOICES) {
      const picked = label === "56" && t >= GATE_TAP;
      lemonButton(x, y, 290, 100, label, {
        size: 66,
        picked,
        press: label === "56" && pressAt(t, [GATE_TAP]),
        labelScale: picked ? 1 + 0.4 * spring(t - GATE_TAP) : 1,
      });
      if (picked) {
        checkMark(x + 104, y - 4, 1, E.outCubic(seg(t, GATE_TAP + 0.05, GATE_TAP + 0.25)));
        sparkRing(x, y, t - GATE_TAP - 0.05, 150, 16);
      }
    }
    ghostButton(G.cx, top + G.h - 72, 240, 80, "취소", { size: 44 });
  }

  // 하루 놀이 시간 (Save.LIMITS: 끔·15·20·30·45·60분, 기본 30분)
  const TIME = { cx: 540, cy: 1085, w: 820, h: 860 };
  const TIME_OPTS = ["끔", "15분", "20분", "30분", "45분", "60분"];
  const CLOCK_AT = pt(540, TIME.cy - TIME.h / 2 + 92);
  function settingsCard(t, dialogScale = 1, dialogAlpha = 1) {
    cardFrame(CARD, () => {
      ctx.fillStyle = "#2a1148";
      ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
      ctx.save();
      ctx.globalAlpha = 0.12;
      const cols = ["#ffb3c7", "#ffe36a", "#7de3b0", "#d7c2ff"];
      let n = 0;
      for (let y = CARD.y + 40; y < CARD.y + CARD.h; y += 92) {
        for (let x = CARD.x + 40 + ((y / 92) % 2 ? 46 : 0); x < CARD.x + CARD.w; x += 92) Draw.felt(ctx, x, y, 11, 10, cols[n++ % 4]);
      }
      ctx.restore();
      if (dialogScale > 0.01 && dialogAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = dialogAlpha;
        ctx.translate(CLOCK_AT.x, CLOCK_AT.y);
        ctx.scale(dialogScale, dialogScale);
        ctx.translate(-CLOCK_AT.x, -CLOCK_AT.y);
        timeDialog(t);
        ctx.restore();
      }
    });
  }
  // 버튼 모양 그대로 퍼지는 빛 (둥근 원이 옆 버튼을 가로지르지 않게)
  function pillGlow(x, y, w, h, dt, color) {
    if (dt < 0 || dt > 0.8) return;
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const k = seg(dt, i * 0.12, 0.5 + i * 0.12);
      if (k <= 0 || k >= 1) continue;
      const g = 12 + 10 * E.outCubic(k);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 9 * (1 - k) + 3;
      ctx.beginPath();
      ctx.roundRect(x - w / 2 - g, y - h / 2 - g, w + 2 * g, h + 2 * g, h / 2 + g);
      ctx.stroke();
    }
    ctx.restore();
  }
  function timeDialog(t) {
    const D = TIME;
    const top = D.cy - D.h / 2;
    dialogBox(D.cx, D.cy, D.w, D.h);
    iconClock(CLOCK_AT.x, CLOCK_AT.y, 0.7 * E.inOutCubic(seg(t, 12.6, 13.6)));
    dlgText("보호자 설정", D.cx, top + 186, 44, LILAC, { spacing: 6 });
    dlgText("하루 놀이 시간", D.cx, top + 268, 96, COTTON, { shadow: "#7a2d6a" });
    dlgText("아이 모드에서 정한 시간이 지나면", D.cx, top + 360, 42, COTTON, { maxW: 720 });
    dlgText("쉬는 시간을 알려 줘요.", D.cx, top + 410, 42, COTTON);
    TIME_OPTS.forEach((label, i) => {
      const x = D.cx + (i % 2 ? 160 : -160);
      const y = top + 520 + Math.floor(i / 2) * 112;
      lemonButton(x, y, 290, 90, label, { size: 56, picked: label === "30분" });
      if (label === "30분") pillGlow(x, y, 290, 90, t - 13.0, C.mint);
    });
  }

  // 뽑기 기계 (조용한 순간) — 장면 2와 같은 화면
  const CALM_LIST = BASE.filter((p) => p.type !== "puppy");
  function calmMachine(t, dim) {
    cardFrame(CARD, () => {
      ctx.save();
      camTransform(Z2.x, Z2.y, Z2.z);
      drawMachine(
        CALM_LIST.map((p) => plushAt(p, t)),
        { x: HOME.x + 40 * Math.sin(t * 0.8), y: HOME.y, z: 0, open: 1 },
      );
      ctx.restore();
      if (dim > 0) {
        ctx.fillStyle = `rgba(20, 8, 50, ${dim})`;
        ctx.fillRect(0, 0, W, H);
      }
    });
  }

  function warnToast(t) {
    const s = seg(t, 14.35, 14.6);
    if (s <= 0) return;
    const k = E.outBack(s);
    // 카드 안에서 살짝 내려오며 나타난다 (자막 줄과 카드 윗변을 넘지 않는다)
    const y = lerp(590, 640, k) + Math.sin((t - 14.6) * 3) * 6 * seg(t, 14.6, 14.8);
    ctx.save();
    ctx.globalAlpha *= seg(t, 14.35, 14.47);
    pill(540, y, "2분 뒤에 쉬는 시간이에요", {
      scale: 0.85 + 0.15 * Math.min(k, 1.05),
      size: 50,
      bg: C.lemon,
      color: "#3a1230",
      pad: 40,
      stroke: "#c47a12",
      icon: (x, yy) => {
        ctx.save();
        ctx.translate(x, yy);
        ctx.scale(0.55, 0.55);
        iconClock(0, 0, 0.7);
        ctx.restore();
      },
    });
    ctx.restore();
  }

  const BREAK = { cx: 540, cy: 1060, w: 800, h: 830 };
  function breakDialog(t) {
    const D = BREAK;
    const top = D.cy - D.h / 2;
    dialogBox(D.cx, D.cy, D.w, D.h);
    dlgText("쉬는 시간", D.cx, top + 64, 44, LILAC, { spacing: 6 });
    iconClock(D.cx, top + 152, 1);
    dlgText("오늘은 여기까지!", D.cx, top + 260, 100, COTTON, { shadow: "#7a2d6a", maxW: 700 });
    dlgText("오늘 30분 동안 놀았어요.", D.cx, top + 352, 42, COTTON);
    dlgText("인형들도 코— 잘 시간이에요.", D.cx, top + 402, 42, COTTON);
    dlgText("내일 또 만나요", D.cx, top + 452, 42, COTTON);
    lemonButton(D.cx, top + 565, 600, 100, "알겠어요", { size: 58 });
    const glow = t >= 16.4 ? Math.sin(seg(t, 16.4, 17.2) * Math.PI) : 0;
    const lb = 1 + 0.3 * spring(t - 16.4);
    ghostButton(D.cx, top + 690, 600, 92, "어른과 10분 더", {
      size: 50,
      glow,
      iconW: 70,
      icon: (x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(0.5 * (t >= 16.4 ? lb : 1), 0.5 * (t >= 16.4 ? lb : 1));
        iconLock(0, -12);
        ctx.restore();
      },
    });
  }
  function breakScene(t) {
    calmMachine(t, 0.12 + 0.5 * seg(t, 15.35, 15.6));
    cardFrame(
      CARD,
      () => {
        const k = OB(seg(t, 15.35, 15.6));
        if (k <= 0) return;
        ctx.save();
        ctx.translate(BREAK.cx, BREAK.cy);
        ctx.scale(k, k);
        ctx.translate(-BREAK.cx, -BREAK.cy);
        breakDialog(t);
        ctx.restore();
        // 졸린 인형들이 대화상자 아래에서 빼꼼
        const pa = seg(t, 15.6, 15.9);
        [
          ["bear", 300, 0.2],
          ["bunny", 780, 1.4],
        ].forEach(([type, x, ph]) => {
          const bob = Math.sin(t * 2 + ph) * 6;
          ctx.save();
          ctx.translate(x, BREAK.cy + BREAK.h / 2 + 60 + (1 - pa) * 120 + bob);
          ctx.scale(2.6, 2.6);
          Draw.plush(ctx, { type, x: 0, y: 0, radius: 24, blink: 0.1, react: "idle", angle: Math.sin(t * 1.3 + ph) * 0.06 });
          ctx.restore();
        });
      },
      { bg: "rgba(0,0,0,0)", border: "rgba(0,0,0,0)" },
    );
  }

  // 부모님 체크 (부모용 표: 광고·결제 / 개인정보 / 인터넷 없이 / 채팅 없음)
  const PARENT_CL = {
    rowT: [17.85, 18.4, 18.95, 19.5],
    txt: ["광고·결제 없음", "개인정보 수집 없음", "인터넷 없이도 OK", "낯선 사람과 채팅 없음"],
    plush: ["bear", "bunny", "chick", "penguin"],
    icon(i, x, y, t, ts) {
      const k = seg(t, ts, ts + 0.2);
      if (i === 0) iconAd(x, y, k);
      else if (i === 1) iconLock(x, y);
      else if (i === 2) wifiTile(x, y);
      else iconChat(x, y, k);
    },
  };
  const P_PILL_T = 20.0;
  const P_FOLD = [20.8, 21.0];
  function parentsChecklist(t) {
    CL = PARENT_CL;
    checklist(t);
    CL = null;
    const pk = OB(seg(t, P_PILL_T, P_PILL_T + 0.25));
    if (pk > 0) pill(540, 1392, "기록은 이 기기에만 저장돼요", { size: 48, bg: C.mint, color: C.ink, scale: pk, pad: 44 });
  }

  function kidModePill(t) {
    const k = popIn(t, 0.25, 0.3);
    if (k > 0) pill(CARD.x + CARD.w - 150, CARD.y + 62, "아이 모드", { size: 40, bg: C.mint, color: C.ink, scale: k, pad: 30 });
  }

  const P_KID_CAPS = [
    { at: 0, end: 3.0, text: "아이 모드 기본 켜짐", noPop: true },
    { at: 0.3, end: 1.65, text: "한 번 톡! 쉬운 뽑기", sub: true },
    { at: 1.7, end: 3.0, text: "두 번 놓치면 집게가 도와줘요", sub: true },
    { at: 3.1, end: 7.9, text: "아이는 이렇게 놀아요" },
    { at: 3.3, end: 4.6, text: "내 인형 만들기 · 동물 20가지", sub: true },
    { at: 4.75, end: 6.17, text: "쓰담쓰담 · 하트 뿅!", sub: true },
    { at: 6.5, end: 7.9, text: "몰랑 마을 친구와 인사", sub: true },
  ];
  const P_GATE_CAPS = [
    { at: 8.3, end: 12.35, text: "공유는 어른 확인 후" },
    { at: 8.6, end: 10.3, text: "한 자리 곱셈 문제 · 보기 4개", sub: true },
    { at: 10.3, end: 12.35, text: "틀리면 15초 동안 잠겨요", sub: true },
    { at: 12.4, end: 15.4, text: "하루 놀이 시간 설정" },
    { at: 12.6, end: 14.1, text: "기본 30분 · 끔부터 60분까지", sub: true },
    { at: 14.15, end: 15.35, text: "끝나기 2분 전에 미리 알려요", sub: true },
    { at: 15.4, end: 17.35, text: "시간이 되면 쉬는 시간" },
    { at: 16.1, end: 17.35, text: "더 놀려면 어른 확인", sub: true },
  ];
  const P_CHECK_CAPS = [
    { at: 17.4, end: 99, text: "부모님도 안심", size: 116 },
    { at: 19.0, end: 99, text: "대화는 미리 쓴 문장만 · AI 없음", sub: true },
  ];
  function parentsCaps(t, a = 1) {
    if (t < 8.0) STG(ST, () => capsFrom(t, P_KID_CAPS, a));
    else if (t < 17.4) STG(ST, () => capsFrom(t, P_GATE_CAPS, a));
    else STG(ST6, () => capsFrom(t, P_CHECK_CAPS, a, { head: 300, sub: 414 }));
  }

  const P_VIL = (t) => lerp(12.05, 12.98, seg(t, 6.62, 7.9)); // 마을: 고양이 인사가 끝날 때까지만
  const PP = -320; // 몽타주 뒤 배경 별 위치

  function renderParents(t) {
    capHook = () => false; // 장면 속 자막은 모두 끄고, 부모용 자막 표만 쓴다
    if (t < 3.0) {
      BG(t);
      STG(ST, () => {
        scene2(Math.max(t + 1.8, 1.97)); // 흰 빛이 걷힌 뒤부터 (첫 화면이 비지 않게)
        kidModePill(t);
      });
    } else if (t < 3.27) {
      slideSwap(t, 3.0, 3.27, () => {
        scene2(4.8 + (t - 3.0));
        kidModePill(t);
      }, () => scene3(6.3), 0, -320, ST, ST, true);
    } else if (t < 4.6) {
      BG(t, -320);
      STG(ST, () => scene3(6.3 + (t - 3.27)));
    } else if (t < 4.87) {
      slideSwap(t, 4.6, 4.87, () => scene3(7.63 + (t - 4.6)), () => scene4(t + 5.43), -320, PP - 320, ST, ST, true);
    } else if (t < 6.17) {
      BG(t, PP - 320);
      STG(ST, () => scene4(t + 5.43));
    } else if (t < 6.62) {
      BG(t, PP - 320);
      STG(ST, () => polaroid(t + 5.43));
    } else if (t < 7.9) {
      BG(t, PP - 320);
      STG(ST, () => scene5(P_VIL(t)));
    } else if (t < 8.35) {
      BG(t, PP - 320);
      const sink = E.inCubic(seg(t, 7.9, 8.25));
      const dark = seg(t, 7.9, 8.1);
      ctx.save();
      ctx.translate(0, SINK_D() * sink);
      STG(ST, () => scene5(12.98, dark));
      ctx.restore();
      const rise = OB(seg(t, 8.0, 8.35));
      if (rise > 0) {
        ctx.save();
        ctx.translate(0, SINK_D() * (1 - rise));
        STG(ST, () => sceneGate(8.35));
        ctx.restore();
      }
    } else if (t < 12.35) {
      BG(t, PP - 320);
      STG(ST, () => sceneGate(t));
    } else if (t < 12.6) {
      BG(t, PP - 320);
      const k = E.inCubic(seg(t, 12.35, 12.6));
      ctx.save();
      ctx.translate(0, -SINK_D() * k);
      STG(ST, () => sceneGate(12.35));
      ctx.restore();
      const rise = OB(seg(t, 12.35, 12.6));
      ctx.save();
      ctx.translate(0, SINK_D() * (1 - rise));
      STG(ST, () => settingsCard(t));
      ctx.restore();
    } else if (t < 14.1) {
      BG(t, PP - 320);
      STG(ST, () => settingsCard(t));
    } else if (t < 15.35) {
      BG(t, PP - 320);
      STG(ST, () => {
        calmMachine(t, 0.15);
        const k = seg(t, 14.1, 14.35);
        if (k < 1) {
          ctx.save();
          ctx.globalAlpha = 1 - E.inQuad(k);
          settingsCard(14.1, 1 - E.inBack(k), 1);
          ctx.restore();
        }
        warnToast(t);
      });
    } else if (t < 17.35) {
      BG(t, PP - 320);
      STG(ST, () => breakScene(t));
    } else if (t < 17.75) {
      BG(t, PP - 320);
      // 쉬는 시간 카드는 목록이 올라오기 전에 어두워지며 먼저 빠진다
      const sink = E.inQuad(seg(t, 17.35, 17.5));
      const gone = seg(t, 17.36, 17.47);
      if (gone < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - gone;
        ctx.translate(0, SINK_D() * sink);
        STG(ST, () => breakScene(17.35));
        ctx.restore();
      }
      const rise = OB(seg(t, 17.4, 17.75));
      if (rise > 0) {
        ctx.save();
        ctx.translate(0, SINK_D() * (1 - rise));
        STG(ST6, () => parentsChecklist(Math.max(t, 17.4)));
        ctx.restore();
      }
    } else if (t < P_FOLD[0]) {
      BG(t, PP - 320);
      STG(ST6, () => parentsChecklist(t));
    } else if (t < P_FOLD[1]) {
      BG(t, PP - 320);
      foldInto(t, P_FOLD[0], P_FOLD[1], ST6, CLIP_TOP, () => parentsChecklist(P_FOLD[0]), (a) => capsFrom(P_FOLD[0], P_CHECK_CAPS, a, { head: 300, sub: 414 }));
      return;
    } else {
      const tc = Math.min(t, CUTS.parents.hold);
      BG(tc, PP - 320);
      endCard(tc - 2.4);
      return;
    }
    // 자막은 카드와 따로 (밀리거나 가라앉지 않고 제자리에서 바뀐다)
    const ka = t >= 7.75 && t < 8.0 ? 1 - seg(t, 7.75, 7.9) : 1;
    parentsCaps(t, ka);
  }

  function renderCut(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    BUBBLE_K = isL() ? 1.4 : 1;
    try {
      if (CUT === "short") renderShort(t);
      else if (CUT === "kids") renderKids(t);
      else renderParents(t);
    } finally {
      capHook = null;
      BEAR_HOME = false;
      END_PILL_K = 1;
      CL = null;
      capSink = null;
    }
  }

  const CUT_TEXT = [
    "톡! 눌러서 뽑기", "친구 12명 + 비밀 친구", "기계 속에 콩이가!", "숨바꼭질! 찾았다! 소풍 가자! 톡! 이리 와!", "어디 숨었지? 부스럭부스럭?",
    "좋아하는 간식을 줘요 좋아하는 간식은 하트 2개! 콩이가 콩콩 따라와요 없네~", LOVE_LINE, "곰돌이",
    "보호자 확인 7 × 8 = ? 밖으로 보내기 전에 어른이 풀어 주세요. 63 56 48 57 취소 사진 찍기 어른 확인 후에만 밖으로",
    "보호자 설정 하루 놀이 시간 아이 모드에서 정한 시간이 지나면 쉬는 시간을 알려 줘요. 끔 15분 20분 30분 45분 60분",
    "2분 뒤에 쉬는 시간이에요 쉬는 시간 오늘은 여기까지! 오늘 30분 동안 놀았어요. 인형들도 코— 잘 시간이에요. 내일 또 만나요 알겠어요 어른과 10분 더",
    "광고·결제 없음 개인정보 수집 없음 인터넷 없이도 OK 낯선 사람과 채팅 없음 기록은 이 기기에만 저장돼요 아이 모드",
  ]
    .concat(P_KID_CAPS, P_GATE_CAPS, P_CHECK_CAPS, KIDS_CAPS).map((c) => (typeof c === "string" ? c : c.text))
    .join(" ");

  // ---------- 소리 (OfflineAudioContext로 합성) ----------
  const SR = 44100;
  let audioBuffer = null;

  async function renderAudio(cut) {
    cut = cut || CUT;
    if (cut !== "full") return renderCutAudio(cut);
    const len = Math.ceil(DUR * SR);
    const oc = new OfflineAudioContext(2, len, SR);
    const master = oc.createGain();
    master.gain.value = 1;
    master.connect(oc.destination);
    const music = oc.createGain();
    music.gain.setValueAtTime(0.0001, 0);
    music.gain.linearRampToValueAtTime(0.55, 0.05);
    music.gain.setValueAtTime(0.55, 20.9);
    music.gain.linearRampToValueAtTime(0.0001, 21.95);
    music.connect(master);
    const sfx = oc.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);

    const nr = mulberry32(SEED + 99);
    const noiseBuf = oc.createBuffer(1, SR, SR);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = nr() * 2 - 1;

    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function tone(bus, at, freq, dur, o = {}) {
      const osc = oc.createOscillator();
      osc.type = o.type || "triangle";
      osc.frequency.setValueAtTime(freq, at);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + (o.glide || dur));
      const g = oc.createGain();
      const v = o.vol || 0.2;
      const atk = o.atk || 0.005;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v, at + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      let node = osc;
      if (o.lp) {
        const f = oc.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = o.lp;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      if (o.pan) {
        const p = oc.createStereoPanner();
        p.pan.value = o.pan;
        g.connect(p);
        p.connect(bus);
      } else g.connect(bus);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    }

    function noise(bus, at, dur, o = {}) {
      const src = oc.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = oc.createBiquadFilter();
      f.type = o.type || "bandpass";
      f.frequency.setValueAtTime(o.freq || 3000, at);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + dur);
      f.Q.value = o.q || 1;
      const g = oc.createGain();
      const v = o.vol || 0.1;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v, at + (o.atk || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f);
      f.connect(g);
      g.connect(bus);
      src.start(at, (at * 7.31) % 0.9);
      src.stop(at + dur + 0.05);
    }

    // --- 음악: 120 BPM 장난감 상자 칩튠 (C–Am–F–G) ---
    const beat = 0.5;
    const prog = [
      [48, [60, 64, 67]],
      [45, [57, 60, 64]],
      [41, [57, 60, 65]],
      [43, [55, 59, 62]],
    ];
    const melody = [
      [72, 76, 79, 76, 77, 76, 74, 72],
      [69, 72, 76, 72, 74, 72, 71, 69],
      [72, 74, 77, 81, 79, 77, 76, 74],
      [71, 74, 79, 74, 76, 74, 72, 71],
    ];
    for (let bar = 0; bar < 11; bar++) {
      const t0 = bar * 4 * beat;
      const [root, ch] = prog[bar % 4];
      for (let b = 0; b < 4; b++) {
        const at = t0 + b * beat;
        tone(music, at, midi(b % 2 ? root + 12 : root), 0.3, { type: "triangle", vol: 0.32 });
        if (b % 2 === 0) tone(music, at, 140, 0.14, { type: "sine", to: 48, glide: 0.12, vol: 0.38 });
        noise(music, at + beat / 2, 0.04, { type: "highpass", freq: 7000, vol: 0.07 });
        if (b % 2 === 1) noise(music, at, 0.1, { type: "bandpass", freq: 1800, q: 0.8, vol: 0.12 });
      }
      for (let e = 0; e < 8; e++) {
        const at = t0 + e * beat * 0.5;
        tone(music, at, midi(ch[e % 3] + 12), 0.16, { type: "square", vol: 0.035, lp: 2600, pan: e % 2 ? 0.25 : -0.25 });
        const mel = melody[bar % 4][e];
        if (bar >= 1 && (e % 2 === 0 || bar % 2 === 1)) tone(music, at, midi(mel), 0.22, { type: "triangle", vol: 0.11 });
      }
    }

    // --- 효과음 ---
    const whirr = (a, d) => tone(sfx, a, 110, d, { type: "sawtooth", to: 90, vol: 0.05, lp: 700, atk: 0.04 });
    const squish = (a) => tone(sfx, a, 520, 0.12, { type: "triangle", to: 980, glide: 0.1, vol: 0.18 });
    const pop = (a, f = 600, v = 0.14) => tone(sfx, a, f, 0.08, { type: "sine", to: f * 2, glide: 0.06, vol: v });
    const tok = (a) => {
      tone(sfx, a, 1250, 0.06, { type: "sine", vol: 0.22 });
      noise(sfx, a, 0.03, { freq: 4000, vol: 0.08 });
    };
    const whoosh = (a, d = 0.25, v = 0.12) => noise(sfx, a, d, { freq: 600, to: 4000, q: 0.7, vol: v, atk: d * 0.6 });
    const bell = (a, m, v = 0.12) => {
      tone(sfx, a, midi(m), 0.6, { type: "sine", vol: v });
      tone(sfx, a, midi(m) * 2.01, 0.3, { type: "sine", vol: v * 0.35 });
    };
    const xylo = (a, m) => {
      tone(sfx, a, midi(m), 0.35, { type: "sine", vol: 0.2 });
      tone(sfx, a, midi(m) * 4, 0.05, { type: "sine", vol: 0.05 });
    };
    const bloop = (a) => tone(sfx, a, 380, 0.18, { type: "sine", to: 820, glide: 0.12, vol: 0.2 });

    whirr(0, 0.36);
    squish(0.47);
    tone(sfx, 0.72, 760, 0.36, { type: "triangle", to: 170, glide: 0.32, vol: 0.2 });
    tone(sfx, 0.9, 150, 0.14, { type: "sine", to: 60, glide: 0.12, vol: 0.25 });
    whoosh(1.0, 0.2, 0.16);
    [88, 91, 96, 100].forEach((m, i) => tone(sfx, 1.4 + i * 0.04, midi(m), 0.35, { type: "triangle", vol: 0.09 }));
    [72, 76, 79, 84].forEach((m) => tone(sfx, 1.47, midi(m), 0.6, { type: "square", vol: 0.04, lp: 3200 }));
    whoosh(1.66, 0.16, 0.1);
    whirr(1.95, 0.6);
    tok(2.6);
    whirr(2.65, 0.25);
    squish(3.0);
    whirr(3.25, 0.25);
    [76, 79, 84].forEach((m, i) => bell(3.5 + i * 0.07, m, 0.09));
    for (let i = 0; i < 13; i++) pop(3.78 + 0.08 * i, 520 + i * 35, 0.1);
    [96, 100, 103].forEach((m, i) => tone(sfx, 4.8 + i * 0.05, midi(m), 0.3, { type: "sine", vol: 0.06 }));
    whoosh(4.86, 0.26, 0.12);
    for (let k = 1; k <= 24; k++) tone(sfx, stepTime(k), 1700, 0.025, { type: "square", vol: 0.03, lp: 4000 });
    bell(6.3, 84, 0.1);
    [
      [6.4, 72],
      [6.9, 76],
      [7.3, 79],
      [7.7, 84],
      [8.3, 88],
    ].forEach(([a, m]) => xylo(a, m));
    pop(7.9, 700, 0.08);
    pop(8.1, 760, 0.08);
    [72, 76, 79].forEach((m) => tone(sfx, 8.4, midi(m), 0.4, { type: "triangle", vol: 0.07 }));
    tone(sfx, 8.88, 300, 0.18, { type: "sine", to: 180, glide: 0.15, vol: 0.15 });
    tone(sfx, 9.05, 300, 0.3, { type: "triangle", to: 900, glide: 0.28, vol: 0.12 });
    pop(9.35, 640, 0.16);
    whoosh(9.48, 0.3, 0.08);
    bloop(10.05);
    bloop(10.3);
    bloop(10.55);
    pop(10.82, 420, 0.1);
    pop(11.22, 300, 0.12);
    noise(sfx, 11.4, 0.05, { type: "highpass", freq: 2500, vol: 0.25 });
    tone(sfx, 11.4, 2200, 0.03, { type: "square", vol: 0.06 });
    noise(sfx, 11.47, 0.04, { type: "highpass", freq: 3500, vol: 0.15 });
    whoosh(11.72, 0.18, 0.1);
    tok(11.9);
    tone(sfx, 12.0, 1500, 0.08, { type: "sine", to: 2600, glide: 0.07, vol: 0.1 });
    tone(sfx, 12.1, 1700, 0.08, { type: "sine", to: 2900, glide: 0.07, vol: 0.1 });
    bloop(12.35);
    tone(sfx, 13.17, 330, 0.1, { type: "sine", to: 250, glide: 0.08, vol: 0.1 });
    tone(sfx, 13.36, 300, 0.1, { type: "sine", to: 220, glide: 0.08, vol: 0.1 });
    noise(sfx, 13.5, 0.3, { freq: 2800, q: 0.6, vol: 0.12, atk: 0.05 });
    tone(sfx, 13.75, 320, 0.22, { type: "triangle", to: 900, glide: 0.18, vol: 0.15 });
    [72, 76, 79, 84].forEach((m, i) => xylo(14.4 + i * 0.08, m));
    tone(sfx, 14.95, 500, 0.3, { type: "triangle", to: 900, glide: 0.2, vol: 0.08 });
    bloop(15.15);
    bloop(15.27);
    tok(15.0);
    for (let i = 0; i < 6; i++) tone(sfx, 15.08 + i * 0.1, 900 + (i % 2) * 120, 0.05, { type: "square", vol: 0.04, lp: 3000 });
    whoosh(15.8, 0.35, 0.12);
    [72, 74, 76, 79].forEach((m, i) => {
      const a = ROW_T[i];
      tone(sfx, a, 220, 0.12, { type: "sine", to: 110, glide: 0.1, vol: 0.28 });
      bell(a + 0.03, m + 12, 0.12);
    });
    bell(PILL_T, 93, 0.1);
    tone(sfx, 18.4, 400, 0.25, { type: "triangle", to: 1600, glide: 0.22, vol: 0.08 });
    [91, 96, 100].forEach((m, i) => tone(sfx, 18.6 + i * 0.04, midi(m), 0.4, { type: "triangle", vol: 0.07 }));
    for (let i = 0; i < 5; i++) tone(sfx, 18.76 + i * 0.1, 200, 0.1, { type: "sine", to: 90, glide: 0.08, vol: 0.15 });
    [72, 76, 79].forEach((m, i) => bell(18.9 + i * 0.15, m + 12, 0.1));
    for (let i = 0; i < 14; i++) tone(sfx, 19.4 + i * (0.6 / 14), 2400, 0.02, { type: "square", vol: 0.02, lp: 5000 });
    [60, 64, 67, 72, 76, 79, 84].forEach((m) => tone(sfx, 20.2, midi(m), 1.6, { type: "triangle", vol: 0.06 }));
    bell(20.2, 96, 0.08);

    const buf = await oc.startRendering();
    // 최고 음량을 잰다
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    // 부드러운 리미터(tanh)로 큰 소리를 눌러 전체 크기를 키운다 (샘플 최고 -6 dBFS).
    // 최종 음량(-16 LUFS 목표, true peak -3.5)은 tools/render-promo.mjs의 loudnorm이 맞춘다.
    const gain = peak > 0 ? 1 / peak : 1;
    const DRIVE = 3.0;
    const norm = 0.5 / Math.tanh(DRIVE);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = Math.tanh(DRIVE * gain * d[i]) * norm;
    }
    audioBuffer = buf;
    return { base64: wavBase64(buf), peak, gain };
  }

  // ---------- 컷별 소리: 기본 컷과 같은 악기·같은 120 BPM 곡을 컷의 시간표로 다시 합성 ----------
  async function renderCutAudio(cut) {
    const D = CUTS[cut].dur;
    const oc = new OfflineAudioContext(2, Math.ceil(D * SR), SR);
    const master = oc.createGain();
    master.gain.value = 1;
    master.connect(oc.destination);
    const musicLP = oc.createBiquadFilter();
    musicLP.type = "lowpass";
    musicLP.frequency.value = 18000;
    musicLP.Q.value = 0.5;
    musicLP.connect(master);
    const music = oc.createGain();
    music.connect(musicLP);
    const sfx = oc.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);

    const nr = mulberry32(SEED + 99);
    const noiseBuf = oc.createBuffer(1, SR, SR);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = nr() * 2 - 1;
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function tone(bus, at, freq, dur, o = {}) {
      if (at == null || at < 0 || at >= D) return;
      const osc = oc.createOscillator();
      osc.type = o.type || "triangle";
      osc.frequency.setValueAtTime(freq, at);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + (o.glide || dur));
      const g = oc.createGain();
      const v = o.vol || 0.2;
      const atk = o.atk || 0.005;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v, at + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      let node = osc;
      if (o.lp) {
        const f = oc.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = o.lp;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      if (o.pan) {
        const p = oc.createStereoPanner();
        p.pan.value = o.pan;
        g.connect(p);
        p.connect(bus);
      } else g.connect(bus);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    }
    function noise(bus, at, dur, o = {}) {
      if (at == null || at < 0 || at >= D) return;
      const src = oc.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = oc.createBiquadFilter();
      f.type = o.type || "bandpass";
      f.frequency.setValueAtTime(o.freq || 3000, at);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + dur);
      f.Q.value = o.q || 1;
      const g = oc.createGain();
      const v = o.vol || 0.1;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v, at + (o.atk || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f);
      f.connect(g);
      g.connect(bus);
      src.start(at, (at * 7.31) % 0.9);
      src.stop(at + dur + 0.05);
    }

    // --- 음악 ---
    const beat = 0.5;
    const prog = [
      [48, [60, 64, 67]],
      [45, [57, 60, 64]],
      [41, [57, 60, 65]],
      [43, [55, 59, 62]],
    ];
    const melody = [
      [72, 76, 79, 76, 77, 76, 74, 72],
      [69, 72, 76, 72, 74, 72, 71, 69],
      [72, 74, 77, 81, 79, 77, 76, 74],
      [71, 74, 79, 74, 76, 74, 72, 71],
    ];
    const M = {
      short: { bars: 7, arpK: 1, arpLP: 2600, stop: 14.0 },
      kids: { bars: 10, arpK: 1, arpLP: 2600, stop: 19.5 },
      parents: { bars: 12, arpK: 0.7, arpLP: 1800, stop: 23.5 },
    }[cut];
    // 어느 마디·박에서 선율을 낼지 (컷마다 다르다)
    function melodyOn(bar, e, at) {
      if (bar < 1 || !(e % 2 === 0 || bar % 2 === 1)) return 0;
      if (cut === "kids" && bar === 6 && e < 6) return 0; // 숨바꼭질: 살금살금 (찾았다!에서 다시)
      if (cut === "parents" && at >= 8.3 && at < 21.0) return bar % 2 === 0 ? 0.6 : 0; // 대화상자 동안은 차분하게
      return 1;
    }
    for (let bar = 0; bar < M.bars; bar++) {
      const t0 = bar * 4 * beat;
      const pi = cut === "parents" && bar >= 11 ? 0 : bar % 4; // 부모용은 마지막에 C로 끝맺는다
      const [root, ch] = prog[pi];
      for (let b = 0; b < 4; b++) {
        const at = t0 + b * beat;
        if (at >= M.stop) continue;
        tone(music, at, midi(b % 2 ? root + 12 : root), 0.3, { type: "triangle", vol: 0.32 });
        if (b % 2 === 0) tone(music, at, 140, 0.14, { type: "sine", to: 48, glide: 0.12, vol: 0.38 });
        noise(music, at + beat / 2, 0.04, { type: "highpass", freq: 7000, vol: 0.07 });
        if (b % 2 === 1) noise(music, at, 0.1, { type: "bandpass", freq: 1800, q: 0.8, vol: 0.12 });
      }
      for (let e = 0; e < 8; e++) {
        const at = t0 + e * beat * 0.5;
        if (at >= M.stop) continue;
        tone(music, at, midi(ch[e % 3] + 12), 0.16, { type: "square", vol: 0.035 * M.arpK, lp: M.arpLP, pan: e % 2 ? 0.25 : -0.25 });
        const mk = melodyOn(bar, e, at);
        if (mk > 0) tone(music, at, midi(melody[pi][e]), 0.22, { type: "triangle", vol: 0.11 * mk });
      }
    }
    const mg = music.gain;
    mg.setValueAtTime(0.0001, 0);
    if (cut === "short") {
      mg.linearRampToValueAtTime(0.55, 0.05);
      mg.setValueAtTime(0.55, 14.0);
      mg.linearRampToValueAtTime(0.0001, 14.6);
    } else if (cut === "kids") {
      mg.linearRampToValueAtTime(0.55, 0.05);
      mg.setValueAtTime(0.55, 19.3);
      mg.linearRampToValueAtTime(0.0001, 19.95);
    } else {
      const base = 0.55 * 0.7;
      mg.linearRampToValueAtTime(base, 0.05);
      mg.setValueAtTime(base, 8.3);
      mg.linearRampToValueAtTime(base * 0.55, 8.6);
      mg.setValueAtTime(base * 0.55, 20.9);
      mg.linearRampToValueAtTime(base * 1.1, 21.0);
      mg.setValueAtTime(base * 1.1, 23.6);
      mg.linearRampToValueAtTime(0.0001, 24.35);
      // 쉬는 시간: 음악이 잠들 듯 먹먹해졌다가 체크 목록에서 다시 열린다
      const f = musicLP.frequency;
      f.setValueAtTime(18000, 15.4);
      f.exponentialRampToValueAtTime(700, 16.0);
      f.setValueAtTime(700, 17.35);
      f.exponentialRampToValueAtTime(18000, 17.7);
    }

    // --- 효과음 (기본 컷과 같은 소리) ---
    const whirr = (a, d) => tone(sfx, a, 110, d, { type: "sawtooth", to: 90, vol: 0.05, lp: 700, atk: 0.04 });
    const squish = (a) => tone(sfx, a, 520, 0.12, { type: "triangle", to: 980, glide: 0.1, vol: 0.18 });
    const pop = (a, f = 600, v = 0.14) => tone(sfx, a, f, 0.08, { type: "sine", to: f * 2, glide: 0.06, vol: v });
    const tok = (a) => {
      tone(sfx, a, 1250, 0.06, { type: "sine", vol: 0.22 });
      noise(sfx, a, 0.03, { freq: 4000, vol: 0.08 });
    };
    const whoosh = (a, d = 0.25, v = 0.12) => noise(sfx, a, d, { freq: 600, to: 4000, q: 0.7, vol: v, atk: d * 0.6 });
    const bell = (a, m, v = 0.12) => {
      tone(sfx, a, midi(m), 0.6, { type: "sine", vol: v });
      tone(sfx, a, midi(m) * 2.01, 0.3, { type: "sine", vol: v * 0.35 });
    };
    const xylo = (a, m) => {
      tone(sfx, a, midi(m), 0.35, { type: "sine", vol: 0.2 });
      tone(sfx, a, midi(m) * 4, 0.05, { type: "sine", vol: 0.05 });
    };
    const bloop = (a) => tone(sfx, a, 380, 0.18, { type: "sine", to: 820, glide: 0.12, vol: 0.2 });
    const stamp = (a, m) => {
      tone(sfx, a, 220, 0.12, { type: "sine", to: 110, glide: 0.1, vol: 0.28 });
      bell(a + 0.03, m, 0.12);
    };
    const riser = (a, d = 0.25) => tone(sfx, a, 400, d, { type: "triangle", to: 1600, glide: d * 0.88, vol: 0.08 });
    const hook = () => {
      whirr(0, 0.36);
      squish(0.47);
      tone(sfx, 0.72, 760, 0.36, { type: "triangle", to: 170, glide: 0.32, vol: 0.2 });
      tone(sfx, 0.9, 150, 0.14, { type: "sine", to: 60, glide: 0.12, vol: 0.25 });
      whoosh(1.0, 0.2, 0.16);
      [88, 91, 96, 100].forEach((m, i) => tone(sfx, 1.4 + i * 0.04, midi(m), 0.35, { type: "triangle", vol: 0.09 }));
      [72, 76, 79, 84].forEach((m) => tone(sfx, 1.47, midi(m), 0.6, { type: "square", vol: 0.04, lp: 3200 }));
      whoosh(1.66, 0.16, 0.1);
    };
    // 한 번 톡 뽑기: 원래 시간 + off
    const grab = (off) => {
      whirr(1.95 + off, 0.6);
      tok(2.6 + off);
      whirr(2.65 + off, 0.25);
      squish(3.0 + off);
      whirr(3.25 + off, 0.25);
      [76, 79, 84].forEach((m, i) => bell(3.5 + off + i * 0.07, m, 0.09));
    };
    // 내 인형 만들기: 원래 시간 u → 컷 시간 map(u)
    const maker = (map) => {
      for (let k = 1; k <= 24; k++) tone(sfx, map(stepTime(k)), 1700, 0.025, { type: "square", vol: 0.03, lp: 4000 });
      bell(map(6.3), 84, 0.1);
      [
        [6.4, 72],
        [6.9, 76],
        [7.3, 79],
        [7.7, 84],
        [8.3, 88],
      ].forEach(([a, m]) => xylo(map(a), m));
      pop(map(7.9), 700, 0.08);
      pop(map(8.1), 760, 0.08);
      [72, 76, 79].forEach((m) => tone(sfx, map(8.4), midi(m), 0.4, { type: "triangle", vol: 0.07 }));
      tone(sfx, map(8.88), 300, 0.18, { type: "sine", to: 180, glide: 0.15, vol: 0.15 });
      tone(sfx, map(9.05), 300, 0.3, { type: "triangle", to: 900, glide: 0.28, vol: 0.12 });
      pop(map(9.35), 640, 0.16);
      whoosh(map(9.48), 0.3, 0.08);
    };
    // 엔드 카드: 원래 18.6에 시작하는 소리를 컷 시간 at0에, 마지막 화음 길이 chordD
    const ending = (at0, chordD) => {
      const o = at0 - 18.6;
      [91, 96, 100].forEach((m, i) => tone(sfx, 18.6 + o + i * 0.04, midi(m), 0.4, { type: "triangle", vol: 0.07 }));
      for (let i = 0; i < 5; i++) tone(sfx, 18.76 + o + i * 0.1, 200, 0.1, { type: "sine", to: 90, glide: 0.08, vol: 0.15 });
      [72, 76, 79].forEach((m, i) => bell(18.9 + o + i * 0.15, m + 12, 0.1));
      for (let i = 0; i < 14; i++) tone(sfx, 19.4 + o + i * (0.6 / 14), 2400, 0.02, { type: "square", vol: 0.02, lp: 5000 });
      [60, 64, 67, 72, 76, 79, 84].forEach((m) => tone(sfx, 20.2 + o, midi(m), chordD, { type: "triangle", vol: 0.06 }));
      bell(20.2 + o, 96, 0.08);
    };

    if (cut === "short") {
      hook();
      grab(0);
      whoosh(3.61, 0.26, 0.12);
      maker((u) => unmap(u, SHORT_M3));
      bloop(7.45);
      bloop(7.7);
      bloop(7.95);
      whoosh(8.08, 0.18, 0.1);
      const m5 = (u) => unmap(u, SHORT_M5);
      tone(sfx, 8.3, 1500, 0.08, { type: "sine", to: 2600, glide: 0.07, vol: 0.1 });
      tone(sfx, 8.35, 1700, 0.08, { type: "sine", to: 2900, glide: 0.07, vol: 0.1 });
      bloop(m5(12.35));
      tone(sfx, m5(13.17), 330, 0.1, { type: "sine", to: 250, glide: 0.08, vol: 0.1 });
      tone(sfx, m5(13.36), 300, 0.1, { type: "sine", to: 220, glide: 0.08, vol: 0.1 });
      noise(sfx, m5(13.5), 0.3, { freq: 2800, q: 0.6, vol: 0.12, atk: 0.05 });
      tone(sfx, m5(13.75), 320, 0.22, { type: "triangle", to: 900, glide: 0.18, vol: 0.15 });
      [72, 76, 79, 84].forEach((m, i) => xylo(m5(14.4 + i * 0.08), m));
      tone(sfx, m5(14.95), 500, 0.3, { type: "triangle", to: 900, glide: 0.2, vol: 0.08 });
      bloop(m5(15.15));
      bloop(m5(15.27));
      tok(m5(15.0));
      for (let i = 0; i < 6; i++) tone(sfx, m5(15.08 + i * 0.1), 900 + (i % 2) * 120, 0.05, { type: "square", vol: 0.04, lp: 3000 });
      whoosh(11.5, 0.35, 0.12);
      riser(11.8, 0.2);
      ending(12.0, 1.0);
    } else if (cut === "kids") {
      hook();
      grab(0);
      for (let i = 0; i < 13; i++) if (3.78 + 0.08 * i < 4.6) pop(3.78 + 0.08 * i, 520 + i * 35, 0.1);
      [96, 100, 103].forEach((m, i) => tone(sfx, 4.55 + i * 0.05, midi(m), 0.3, { type: "sine", vol: 0.06 }));
      whoosh(4.61, 0.26, 0.12);
      maker((u) => u - 0.25);
      bloop(9.8);
      bloop(10.05);
      bloop(10.3);
      pop(10.57, 420, 0.1);
      pop(10.97, 300, 0.12);
      whoosh(11.02, 0.25, 0.12);
      // 숨바꼭질
      noise(sfx, 11.7, 0.3, { freq: 2800, q: 0.6, vol: 0.1, atk: 0.05 });
      pop(11.8, 500, 0.1);
      tok(12.35);
      tone(sfx, 12.38, 330, 0.1, { type: "sine", to: 250, glide: 0.08, vol: 0.1 });
      tok(12.75);
      tone(sfx, 12.78, 300, 0.1, { type: "sine", to: 220, glide: 0.08, vol: 0.1 });
      noise(sfx, 12.85, 0.28, { freq: 2800, q: 0.6, vol: 0.12, atk: 0.05 });
      noise(sfx, 13.15, 0.28, { freq: 3100, q: 0.6, vol: 0.12, atk: 0.05 });
      tok(13.45);
      tone(sfx, 13.5, 320, 0.22, { type: "triangle", to: 900, glide: 0.18, vol: 0.15 });
      [72, 76, 79, 84].forEach((m, i) => xylo(13.55 + i * 0.08, m));
      // 소풍
      [72, 76, 79, 84].forEach((m, i) => xylo(14.2 + i * 0.08, m));
      whoosh(14.8, 0.2, 0.08);
      tok(15.3);
      tone(sfx, 15.36, 500, 0.3, { type: "triangle", to: 900, glide: 0.2, vol: 0.08 });
      bloop(15.7);
      bloop(15.82);
      bell(15.72, 84, 0.1);
      // 톡! 이리 와
      tok(16.55);
      for (let i = 0; i < 6; i++) tone(sfx, 16.62 + i * 0.09, 900 + (i % 2) * 120, 0.05, { type: "square", vol: 0.04, lp: 3000 });
      pop(17.15, 640, 0.12);
      riser(17.3);
      ending(17.6, 0.75); // 정지 구간 안에서 잦아들어 반복 재생이 매끄럽게
    } else {
      // 아이 모드: 장면 2 소리를 -1.8초 당겨서
      grab(-1.8);
      for (let i = 0; i < 13; i++) pop(1.98 + 0.08 * i, 520 + i * 35, 0.1);
      [96, 100, 103].forEach((m, i) => tone(sfx, 3.0 + i * 0.05, midi(m), 0.3, { type: "sine", vol: 0.06 }));
      pop(0.25, 700, 0.07);
      whoosh(3.0, 0.26, 0.12);
      xylo(3.37, 72);
      xylo(3.87, 76);
      xylo(4.27, 79);
      whoosh(4.6, 0.26, 0.12);
      bloop(4.87);
      bloop(5.12);
      pop(10.82 - 5.43, 420, 0.1);
      pop(11.22 - 5.43, 300, 0.12);
      whoosh(11.72 - 5.43, 0.18, 0.1);
      tok(11.9 - 5.43);
      tone(sfx, 12.0 - 5.43, 1500, 0.08, { type: "sine", to: 2600, glide: 0.07, vol: 0.1 });
      tone(sfx, 12.1 - 5.43, 1700, 0.08, { type: "sine", to: 2900, glide: 0.07, vol: 0.1 });
      bloop(6.62 + (12.35 - 12.05) * ((7.9 - 6.62) / (12.98 - 12.05)));
      // 부모 구간
      noise(sfx, 7.9, 0.4, { freq: 3000, to: 500, q: 0.7, vol: 0.09, atk: 0.12 });
      bell(8.3, 79, 0.1);
      bell(8.55, 72, 0.1);
      tok(8.85);
      tone(sfx, 9.0, 500, 0.12, { type: "square", to: 1000, glide: 0.1, vol: 0.035, lp: 3000 });
      tok(GATE_TAP);
      bell(GATE_TAP + 0.02, 84, 0.12);
      bell(GATE_TAP + 0.15, 88, 0.12);
      [96, 100, 103].forEach((m, i) => tone(sfx, GATE_TAP + 0.08 + i * 0.04, midi(m), 0.3, { type: "sine", vol: 0.05 }));
      stamp(11.1, 84);
      pop(11.3, 700, 0.08);
      whoosh(12.35, 0.25, 0.1);
      for (let i = 0; i < 4; i++) tone(sfx, 12.6 + i * 0.25, i % 2 ? 1600 : 2000, 0.02, { type: "square", vol: 0.02, lp: 5000 });
      bell(13.0, 88, 0.08);
      whoosh(14.1, 0.2, 0.07);
      tone(sfx, 14.35, 660, 0.15, { type: "sine", vol: 0.14 });
      tone(sfx, 14.47, 880, 0.22, { type: "sine", vol: 0.14 });
      [79, 76, 72].forEach((m, i) => tone(sfx, 15.4 + i * 0.22, midi(m), 0.55, { type: "triangle", vol: 0.12 }));
      noise(sfx, 16.4, 0.03, { type: "highpass", freq: 3000, vol: 0.15 });
      tone(sfx, 16.4, 1800, 0.03, { type: "square", vol: 0.04 });
      whoosh(17.35, 0.35, 0.12);
      [72, 74, 76, 79].forEach((m, i) => stamp(PARENT_CL.rowT[i], m + 12));
      bell(P_PILL_T, 93, 0.1);
      riser(P_FOLD[0]);
      ending(21.0, 1.6);
    }

    const buf = await oc.startRendering();
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    const gain = peak > 0 ? 1 / peak : 1;
    const DRIVE = 3.0;
    const norm = 0.5 / Math.tanh(DRIVE);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = Math.tanh(DRIVE * gain * d[i]) * norm;
    }
    audioBuffer = buf;
    return { base64: wavBase64(buf), peak, gain };
  }

  function wavBase64(buf) {
    const ch = buf.numberOfChannels;
    const n = buf.length;
    const bytes = new Uint8Array(44 + n * ch * 2);
    const dv = new DataView(bytes.buffer);
    const str = (o, s) => {
      for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i);
    };
    str(0, "RIFF");
    dv.setUint32(4, 36 + n * ch * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);
    dv.setUint16(22, ch, true);
    dv.setUint32(24, SR, true);
    dv.setUint32(28, SR * ch * 2, true);
    dv.setUint16(32, ch * 2, true);
    dv.setUint16(34, 16, true);
    str(36, "data");
    dv.setUint32(40, n * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < ch; c++) {
        const v = Math.max(-1, Math.min(1, data[c][i]));
        dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        o += 2;
      }
    }
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  // ---------- 글꼴 준비 ----------
  const ALL_TEXT = [
    "아깝다…!", "쏙! 잡았다!", "한 번 톡! 쉬운 뽑기", "인형 12종 + 비밀 친구", "내 인형 만들기", "동물 20가지",
    "리본·모자·꽃·왕관", "기계 속에 내 인형이!", "콩이", "쓰담쓰담 하트 뿅!", "+1", "+2", "몰랑 마을", "톡! 말 걸기",
    "숨바꼭질", "소풍 가자!", "부스럭!", "사진 찍기", "부모님도 안심", "부모님 체크", "인터넷 없이도 OK", "7 × 8 = ?56", TITLE,
    "뽑고, 모으고, 함께 놀아요", "광고 없음 · 개인정보 수집 없음", CAT_LINE, "✕",
  ]
    .concat(ROW_TXT)
    .concat(Object.values(PLUSH_TYPES).map((p) => p.name))
    .concat(IDS.map((id) => I18N.t(`animal.${id}`)))
    .concat(ROOM_BASE.map((p) => p.name))
    .join(" ");

  async function ready() {
    const loads = [];
    for (const fam of ["Jua", "Gowun Dodum"]) loads.push(document.fonts.load(`40px '${fam}'`, ALL_TEXT));
    for (const fam of ["Jua"]) loads.push(document.fonts.load(`40px '${fam}'`, CUT_TEXT));
    await Promise.all(loads);
    await document.fonts.ready;
    silhouette = makeSilhouette();
    return true;
  }

  const FORMATS = { vertical: { width: W, height: H }, landscape: { width: LW, height: LH } };
  function setFormat(f) {
    if (!FORMATS[f]) throw new Error(`unknown format: ${f}`);
    FORMAT = f;
    canvas.width = FORMATS[f].width;
    canvas.height = FORMATS[f].height;
    if (canvas.style.width) fit(); // 반복 재생 화면에서만 크기를 다시 맞춘다
    return FORMATS[f];
  }

  function setCut(c) {
    if (!CUTS[c]) throw new Error(`unknown cut: ${c}`);
    if (c !== CUT) audioBuffer = null;
    CUT = c;
    return CUTS[c];
  }

  const readyP = ready();
  window.PROMO = {
    get width() {
      return FORMATS[FORMAT].width;
    },
    get height() {
      return FORMATS[FORMAT].height;
    },
    get format() {
      return FORMAT;
    },
    formats: Object.keys(FORMATS),
    setFormat,
    get cut() {
      return CUT;
    },
    cuts: Object.keys(CUTS),
    setCut,
    fps: FPS,
    get duration() {
      return CUTS[CUT].dur;
    },
    get holdT() {
      return CUTS[CUT].hold;
    },
    get frames() {
      return Math.round(CUTS[CUT].dur * FPS);
    },
    ready: () => readyP,
    renderFrame,
    renderAudio,
  };

  // ---------- 보통으로 열면 반복 재생 ----------
  const params = new URLSearchParams(location.search);
  if (params.get("format")) setFormat(params.get("format"));
  const qCut = params.get("cut");
  if (qCut) {
    if (CUTS[qCut]) setCut(qCut);
    else console.warn(`unknown cut "${qCut}" — playing the full cut (short | kids | parents)`);
  }
  if (params.has("render")) {
    document.body.classList.add("render");
    return;
  }
  const realNow = Performance.prototype.now.bind(performance);
  function fit() {
    const { width: fw, height: fh } = FORMATS[FORMAT];
    const s = Math.min(window.innerWidth / fw, window.innerHeight / fh);
    canvas.style.width = `${fw * s}px`;
    canvas.style.height = `${fh * s}px`;
  }
  window.addEventListener("resize", fit);
  fit();
  let start = realNow();
  let actx = null;
  let src = null;
  canvas.addEventListener("pointerdown", async () => {
    try {
      if (!audioBuffer) await renderAudio();
      if (!actx) actx = new AudioContext();
      if (src) src.stop();
      src = actx.createBufferSource();
      src.buffer = audioBuffer;
      src.loop = true;
      src.connect(actx.destination);
      src.start();
      start = realNow();
    } catch (e) {
      console.warn(e);
    }
  });
  readyP.then(() => {
    const loop = () => {
      const D = CUTS[CUT].dur;
      const t = (((realNow() - start) / 1000) % D + D) % D;
      renderFrame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})();
