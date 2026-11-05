// 몰랑크레인 홍보 영상 (1080x1920, 30fps, 22초).
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

  function scene2(t) {
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
    dexStrip(t);
    caption("한 번 톡! 쉬운 뽑기", 340, { size: 110, scale: popIn(t, 1.85) });
    if (t >= 3.6) caption("인형 12종 + 비밀 친구", 462, { size: 62, sub: true, scale: popIn(t, 3.6) });
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
  const vw2s = (x, y) => pt(VR.x + x * VZ, VR.y + y * VZ);
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
    vctx.setTransform(VZ, 0, 0, VZ, 0, 0);
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

  function bubble(x, y, text, k, tailX, tailY) {
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
    ctx.fillText("고양이", 0, -h / 2 + 36);
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
      bubble(540, cs.y - 250, CAT_LINE, bk, cs.x, cs.y - 60);
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
      const ts = ROW_T[i];
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
      if (i === 0) iconAd(ix, y, k);
      else if (i === 1) iconLock(ix, y);
      else if (i === 2) iconMath(ix, y, t >= ts ? 1 : 0, ts, t);
      else iconClock(ix, y, seg(t, ts - 0.3, ts + 0.15));
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = C.ink;
      fitFont(ROW_TXT[i], 56, 846 - 330);
      ctx.fillText(ROW_TXT[i], 330, y + 3);
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
        Draw.plush(ctx, { type: ROW_PLUSH[i], x: 0, y: 0, radius: 22, react: "success", ...sq });
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

  function endTitle(t) {
    ctx.save();
    ctx.font = "170px 'Jua'";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const chars = Array.from(TITLE);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 540 - total / 2;
    chars.forEach((ch, i) => {
      const cx = x + widths[i] / 2;
      x += widths[i];
      // 글자마다 제자리 바로 위 200px에서 곧게 떨어진다 (3프레임 간격)
      const t0 = 18.6 + i * (3 / FPS);
      const fall = seg(t, t0, t0 + 0.16);
      if (fall <= 0) return;
      const yy = TITLE_Y - (1 - E.inQuad(fall)) * 200;
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
    if (pk > 0) pill(540, 1380, "광고 없음 · 개인정보 수집 없음", { size: 48, bg: C.mint, color: C.ink, scale: pk, pad: 44 });
  }

  // ---------- 장면 묶기 ----------
  function renderFrame(t) {
    t = clamp(t, 0, DUR);
    // Draw.plush의 하트 고리 맥박을 t로 고정 (마지막 0.5초 정지 구간에서는 시계도 멈춘다)
    const tc = Math.min(t, HOLD_T);
    try {
      Object.defineProperty(performance, "now", { value: () => tc * 1000, configurable: true, writable: true });
    } catch (e) {
      /* ignore */
    }
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
      if (p.type === "bear") {
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

  // ---------- 소리 (OfflineAudioContext로 합성) ----------
  const SR = 44100;
  let audioBuffer = null;

  async function renderAudio() {
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
    "숨바꼭질", "소풍 가자!", "부모님도 안심", "부모님 체크", "인터넷 없이도 OK", "7 × 8 = ?56", TITLE,
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
    await Promise.all(loads);
    await document.fonts.ready;
    silhouette = makeSilhouette();
    return true;
  }

  const readyP = ready();
  window.PROMO = {
    width: W,
    height: H,
    fps: FPS,
    duration: DUR,
    holdT: HOLD_T,
    frames: Math.round(DUR * FPS),
    ready: () => readyP,
    renderFrame,
    renderAudio,
  };

  // ---------- 보통으로 열면 반복 재생 ----------
  const params = new URLSearchParams(location.search);
  if (params.has("render")) {
    document.body.classList.add("render");
    return;
  }
  const realNow = Performance.prototype.now.bind(performance);
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
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
      const t = (((realNow() - start) / 1000) % DUR + DUR) % DUR;
      renderFrame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})();
