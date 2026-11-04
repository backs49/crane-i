// 몰랑 마을: 뽑은 인형들이 돌아다니고, 톡 누르면 미리 쓴 대사로 대화한다.
// 서버·AI 없이 기기 안에서만 동작한다. 대사는 문구 표(I18N)에서 꺼낸다.
const Village = {
  W: 360,
  H: 480,
  RADIUS: 20,
  SPEED: 26,
  HORIZON: 118,
  POND: { x: 272, y: 372, rx: 62, ry: 38 },
  SLIDE: { x: 34, y: 362, w: 76, h: 70 },
  FLOWERS: { x: 70, y: 186, rx: 52, ry: 30 },

  PERSONA: {
    bear: "calm",
    bunny: "shy",
    cat: "proud",
    chick: "curious",
    frog: "prank",
    penguin: "brave",
    pig: "foodie",
    puppy: "hyper",
    panda: "sleepy",
    berry: "fresh",
    unicorn: "dreamy",
    star: "sparkle",
    moonbunny: "mystic",
  },

  CHOICES: [
    { id: "hello", icon: "👋" },
    { id: "snack", icon: "🍓" },
    { id: "play", icon: "🎵" },
  ],

  persona(type) {
    if (type === "mine" && typeof MyPlush !== "undefined" && MyPlush.spec) return MyPlush.spec.persona;
    return this.PERSONA[type] || "calm";
  },

  timeOfDay(hour) {
    if (hour >= 5 && hour < 11) return "morning";
    if (hour >= 11 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "evening";
    return "night";
  },

  // 친밀도 하트(0~5)로 관계 단계를 정한다
  mood(hearts) {
    if (hearts >= 3) return "best";
    if (hearts >= 1) return "friend";
    return "new";
  },

  // 첫마디: 오늘의 부탁 대상이면 부탁 대사, 가끔 시간대 인사, 아니면 성격·관계별 인사
  greet(p, ctx, rng = Math.random) {
    const vars = { name: p.name };
    if (ctx.missionType && ctx.missionType === p.type && rng() < 0.6) return I18N.t("talk.mission", vars);
    // 직접 만든 인형은 가끔 "네가 만들어 줘서 기뻐" 같은 특별한 말을 한다
    if (p.type === "mine" && rng() < 0.35) {
      const acc = (typeof MyPlush !== "undefined" && MyPlush.spec && MyPlush.spec.accessory) || "none";
      return I18N.pick("talk.mine.extra", { name: p.name, thing: I18N.t(`talk.mine.thing.${acc}`) }, rng);
    }
    if (rng() < 0.3) return I18N.pick(`talk.time.${this.timeOfDay(ctx.hour)}`, vars, rng);
    return I18N.pick(`talk.${this.persona(p.type)}.greet.${this.mood(ctx.hearts)}`, vars, rng);
  },

  reply(p, choiceId, rng = Math.random) {
    const ok = this.CHOICES.some((c) => c.id === choiceId);
    return I18N.pick(`talk.${this.persona(p.type)}.${ok ? choiceId : "hello"}`, { name: p.name }, rng);
  },

  inPond(x, y, pad = 0) {
    const P = this.POND;
    const dx = (x - P.x) / (P.rx + pad);
    const dy = (y - P.y) / (P.ry + pad);
    return dx * dx + dy * dy < 1;
  },

  inSlide(x, y, pad = 0) {
    const S = this.SLIDE;
    return x > S.x - pad && x < S.x + S.w + pad && y > S.y - pad && y < S.y + S.h + pad;
  },

  walkable(x, y) {
    const r = this.RADIUS;
    return (
      x >= r + 6 &&
      x <= this.W - r - 6 &&
      y >= this.HORIZON + 40 &&
      y <= this.H - r - 8 &&
      !this.inPond(x, y, r) &&
      !this.inSlide(x, y, r)
    );
  },

  randomSpot(rng = Math.random) {
    for (let i = 0; i < 40; i++) {
      const x = this.RADIUS + 6 + rng() * (this.W - 2 * this.RADIUS - 12);
      const y = this.HORIZON + 40 + rng() * (this.H - this.HORIZON - 48 - this.RADIUS);
      if (this.walkable(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
    return { x: this.W / 2, y: this.HORIZON + 80 };
  },

  // 방에 사는 친구들(Room.residents 결과)로 마을 산책꾼을 만든다
  spawn(residents, rng = Math.random) {
    return residents.map((r) => {
      const at = this.randomSpot(rng);
      return {
        type: r.type,
        name: r.name,
        pets: r.pets || 0,
        x: at.x,
        y: at.y,
        tx: at.x,
        ty: at.y,
        wait: rng() * 2,
        dir: 1,
        walkT: rng() * 10,
        talking: false,
      };
    });
  },

  step(walkers, dt, rng = Math.random) {
    for (const w of walkers) {
      if (w.talking) continue;
      if (w.wait > 0) {
        w.wait -= dt;
        if (w.wait <= 0) {
          const next = this.randomSpot(rng);
          w.tx = next.x;
          w.ty = next.y;
        }
        continue;
      }
      const dx = w.tx - w.x;
      const dy = w.ty - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        w.wait = 1.2 + rng() * 3;
        continue;
      }
      const sp = Math.min(d, this.SPEED * dt);
      const nx = w.x + (dx / d) * sp;
      const ny = w.y + (dy / d) * sp;
      if (!this.walkable(nx, ny)) {
        // 막히면 그 자리에서 쉬었다가 다른 곳으로 간다
        w.wait = 0.4 + rng();
        continue;
      }
      w.x = nx;
      w.y = ny;
      w.dir = dx < 0 ? -1 : 1;
      w.walkT += dt;
    }
    this.separate(walkers);
  },

  // 너무 붙은 친구끼리 살짝 밀어내 이름표가 겹치지 않게 한다 (대화 중인 친구는 그대로)
  separate(walkers) {
    const min = this.RADIUS * 2.2;
    for (let i = 0; i < walkers.length; i++) {
      for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i];
        const b = walkers[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        for (const [w, sgn] of [[a, -1], [b, 1]]) {
          if (w.talking) continue;
          const nx = w.x + ux * push * sgn;
          const ny = w.y + uy * push * sgn;
          if (this.walkable(nx, ny)) {
            w.x = nx;
            w.y = ny;
          }
        }
      }
    }
  },

  hit(walkers, x, y) {
    const r = this.RADIUS + 8;
    const sorted = walkers.slice().sort((a, b) => b.y - a.y);
    return sorted.find((w) => Math.hypot(w.x - x, w.y - y) <= r) || null;
  },

  // ---- 그리기 ----
  SKY: {
    morning: ["#ffd9e8", "#ffeecf"],
    day: ["#8fd3ff", "#d8f1ff"],
    evening: ["#ff9a7a", "#ffc7a8"],
    night: ["#14092a", "#3a1f66"],
  },

  paint(ctx, walkers, opts = {}) {
    const W = this.W;
    const H = this.H;
    const tod = opts.tod || "day";
    const t = opts.time || 0;
    const night = tod === "night";

    const sky = ctx.createLinearGradient(0, 0, 0, this.HORIZON);
    sky.addColorStop(0, this.SKY[tod][0]);
    sky.addColorStop(1, this.SKY[tod][1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, this.HORIZON + 10);

    if (night) {
      ctx.fillStyle = "#fff6c8";
      for (let i = 0; i < 18; i++) {
        const sx = (i * 73) % W;
        const sy = 10 + ((i * 37) % 80);
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
        ctx.globalAlpha = 0.4 + tw * 0.6;
        Draw.star(ctx, sx, sy, 2.2, 4, 0.45);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(W - 54, 34, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = tod === "evening" ? "#ffdf8a" : "#fff1a6";
      ctx.beginPath();
      ctx.arc(W - 54, tod === "evening" ? 92 : 36, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 2; i++) {
        const cx = ((t * 6 + i * 190) % (W + 120)) - 60;
        const cy = 34 + i * 26;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 26, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 18, cy - 6, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 언덕과 집
    ctx.fillStyle = night ? "#2b5a3e" : "#8fdc9a";
    ctx.beginPath();
    ctx.ellipse(80, this.HORIZON + 6, 140, 34, 0, Math.PI, 0);
    ctx.ellipse(300, this.HORIZON + 8, 150, 30, 0, Math.PI, 0);
    ctx.fill();
    this.house(ctx, 58, this.HORIZON - 8, "#ffb3c7", night);
    this.house(ctx, 196, this.HORIZON - 2, "#fff0e0", night);
    this.house(ctx, 300, this.HORIZON - 6, "#cdb6ff", night);

    // 잔디와 길
    ctx.fillStyle = night ? "#2f6b48" : "#a5e8a8";
    ctx.fillRect(0, this.HORIZON + 6, W, H - this.HORIZON);
    ctx.strokeStyle = night ? "#8a7a5c" : "#f6dfb0";
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(196, this.HORIZON + 10);
    ctx.bezierCurveTo(196, 220, 120, 260, 170, 330);
    ctx.bezierCurveTo(210, 390, 170, 440, 180, H);
    ctx.stroke();

    // 꽃밭
    const F = this.FLOWERS;
    ctx.fillStyle = night ? "#3f7a55" : "#c4f0b8";
    ctx.beginPath();
    ctx.ellipse(F.x, F.y, F.rx, F.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    const petals = ["#ff8fb5", "#ffe36a", "#b9a2ff", "#ff9a7a"];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39;
      const rr = 0.35 + ((i * 0.37) % 0.6);
      const fx = F.x + Math.cos(a) * F.rx * rr;
      const fy = F.y + Math.sin(a) * F.ry * rr;
      ctx.fillStyle = petals[i % petals.length];
      ctx.beginPath();
      ctx.arc(fx, fy + Math.sin(t * 2 + i) * 0.8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 연못
    const P = this.POND;
    ctx.fillStyle = night ? "#2a4f8a" : "#8ad0ff";
    ctx.beginPath();
    ctx.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.6 + i * 0.5) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(P.x - 14 + i * 26, P.y + 4, 6 + k * 16, 2 + k * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#5cbf7a";
    ctx.beginPath();
    ctx.ellipse(P.x + 30, P.y - 16, 11, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 미끄럼틀
    const S = this.SLIDE;
    ctx.fillStyle = "#ff8fb5";
    ctx.fillRect(S.x + 6, S.y + 8, 10, S.h - 8);
    ctx.fillRect(S.x + 32, S.y + 8, 10, S.h - 8);
    ctx.fillStyle = "#ffe36a";
    ctx.fillRect(S.x + 2, S.y + 4, 44, 10);
    ctx.fillStyle = "#7ec8ff";
    ctx.beginPath();
    ctx.moveTo(S.x + 44, S.y + 6);
    ctx.quadraticCurveTo(S.x + 64, S.y + 30, S.x + S.w, S.y + S.h);
    ctx.lineTo(S.x + S.w - 14, S.y + S.h);
    ctx.quadraticCurveTo(S.x + 54, S.y + 36, S.x + 40, S.y + 16);
    ctx.closePath();
    ctx.fill();

    // 장소 이름표
    if (opts.labels) {
      ctx.font = "12px 'Jua', sans-serif";
      ctx.textAlign = "center";
      this.tag(ctx, opts.labels.flowers, F.x, F.y + F.ry + 14);
      this.tag(ctx, opts.labels.pond, P.x, P.y + P.ry + 14);
      this.tag(ctx, opts.labels.slide, S.x + S.w / 2, S.y - 6);
    }

    if (!walkers.length) {
      ctx.fillStyle = night ? "#fff0f8" : "#3a1230";
      ctx.font = "16px 'Jua', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(opts.emptyText || "", W / 2, 290);
      return;
    }

    const sorted = walkers.slice().sort((a, b) => a.y - b.y);
    for (const w of sorted) {
      const moving = !w.talking && w.wait <= 0;
      const hop = moving ? Math.abs(Math.sin(w.walkT * 9)) * 4 : 0;
      const sel = opts.selected === w.type;
      Draw.plush(ctx, {
        type: w.type,
        x: w.x,
        y: w.y - hop,
        radius: this.RADIUS,
        angle: moving ? Math.sin(w.walkT * 9) * 0.08 * w.dir : 0,
        liftZ: 0,
        blink: (opts.blink && opts.blink[w.type]) || 1,
        react: sel ? "success" : "idle",
        squashY: moving ? -Math.abs(Math.sin(w.walkT * 9)) * 0.06 : 0,
      });
      if (sel) {
        ctx.strokeStyle = "#ffe36a";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, this.RADIUS + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.font = "11px 'Jua', sans-serif";
      ctx.textAlign = "center";
      this.tag(ctx, w.name, w.x, w.y + this.RADIUS + 14);
      const h = typeof Room !== "undefined" ? Room.hearts(w.pets) : 0;
      ctx.fillStyle = "#ff6b8a";
      for (let i = 0; i < h; i++) {
        Draw.heart(ctx, w.x - (h - 1) * 5 + i * 10, w.y - this.RADIUS - 8 - hop, 4.5);
        ctx.fill();
      }
    }

    for (const f of opts.fx || []) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = "#ff6b8a";
      Draw.heart(ctx, f.x, f.y, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (night) {
      ctx.fillStyle = "rgba(20, 8, 50, 0.18)";
      ctx.fillRect(0, this.HORIZON, W, H - this.HORIZON);
    }
  },

  tag(ctx, text, x, y) {
    if (!text) return;
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = "rgba(42, 14, 46, 0.72)";
    ctx.fillRect(x - w / 2, y - 12, w, 16);
    ctx.fillStyle = "#ffeaf4";
    ctx.fillText(text, x, y);
  },

  house(ctx, x, y, color, night) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 18, y - 22, 36, 26);
    ctx.fillStyle = "#c86a8a";
    ctx.beginPath();
    ctx.moveTo(x - 24, y - 20);
    ctx.lineTo(x, y - 40);
    ctx.lineTo(x + 24, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = night ? "#ffe36a" : "#8ad0ff";
    ctx.fillRect(x - 10, y - 14, 8, 8);
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(x + 4, y - 12, 9, 16);
  },
};

if (typeof module !== "undefined") module.exports = Village;
