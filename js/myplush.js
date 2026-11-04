// 나만의 애착 인형: 아이가 귀·색·눈·볼·소품·성격·이름을 골라 만든다.
// 사진이나 카메라 없이 기기 안에서만 그리고 저장한다.
// 뽑기 기계, 도감, 인형 방, 몰랑 마을에서 인형 종류 "mine"으로 함께 쓰인다.
const MyPlush = {
  TYPE: "mine",
  NAME_MAX: 8,
  EARS: ["round", "long", "pointy", "none"],
  COLORS: ["#ffb3c7", "#fff0e0", "#ffb37a", "#ffe36a", "#7de3b0", "#7ec8ff", "#d7c2ff", "#e8b07a", "#c9c9d6"],
  EYES: ["dot", "smile", "sparkle", "sleepy"],
  CHEEKS: [true, false],
  ACCESSORIES: ["none", "ribbon", "hat", "flower", "crown"],
  PERSONAS: ["calm", "shy", "proud", "curious", "prank", "brave", "foodie", "hyper", "sleepy", "fresh", "dreamy", "sparkle"],

  // 실제로 쓰이는 인형 모양. 저장된 값이 없으면 null
  spec: null,

  defaults() {
    return {
      ears: "round",
      color: this.COLORS[0],
      eyes: "dot",
      cheeks: true,
      accessory: "ribbon",
      persona: "calm",
      name: "몰랑이",
    };
  },

  cleanName(name) {
    const clean = String(name == null ? "" : name).replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
    return Array.from(clean).slice(0, this.NAME_MAX).join("").trim();
  },

  // 저장된 값을 검사해서, 목록에 없는 값은 기본값으로 바꾼다. 아예 없으면 null
  normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const d = this.defaults();
    const one = (list, v, fallback) => (list.includes(v) ? v : fallback);
    return {
      ears: one(this.EARS, raw.ears, d.ears),
      color: one(this.COLORS, raw.color, d.color),
      eyes: one(this.EYES, raw.eyes, d.eyes),
      cheeks: typeof raw.cheeks === "boolean" ? raw.cheeks : d.cheeks,
      accessory: one(this.ACCESSORIES, raw.accessory, d.accessory),
      persona: one(this.PERSONAS, raw.persona, d.persona),
      name: this.cleanName(raw.name) || d.name,
    };
  },

  random(rng = Math.random, name) {
    const any = (list) => list[Math.floor(rng() * list.length) % list.length];
    return {
      ears: any(this.EARS),
      color: any(this.COLORS),
      eyes: any(this.EYES),
      cheeks: rng() < 0.7,
      accessory: any(this.ACCESSORIES),
      persona: any(this.PERSONAS),
      name: this.cleanName(name) || this.defaults().name,
    };
  },

  // 다음/이전 보기로 넘기기 (만들기 화면의 버튼용)
  cycle(spec, field, step = 1) {
    const lists = { ears: this.EARS, color: this.COLORS, eyes: this.EYES, cheeks: this.CHEEKS, accessory: this.ACCESSORIES, persona: this.PERSONAS };
    const list = lists[field];
    if (!list) return spec;
    const i = list.indexOf(spec[field]);
    const next = list[(((i < 0 ? 0 : i) + step) % list.length + list.length) % list.length];
    return Object.assign({}, spec, { [field]: next });
  },

  // ---- 그리기 (원점 기준, Draw.plush가 위치·크기·기울기를 맞춰 준 뒤 부른다) ----
  draw(ctx, r, spec, blink) {
    const s = spec || this.defaults();
    const c = s.color;
    this.ears(ctx, r, c, s.ears);
    Draw.felt(ctx, 0, r * 0.2, r * 0.76, r * 0.66, c);
    Draw.felt(ctx, 0, -r * 0.08, r * 0.84, r * 0.76, c);
    Draw.felt(ctx, 0, r * 0.14, r * 0.3, r * 0.22, Draw.light(c, 0.45));
    this.face(ctx, 0, -r * 0.06, r * 0.7, blink, s);
    this.accessory(ctx, r, s.accessory);
  },

  ears(ctx, r, c, kind) {
    if (kind === "round") {
      for (const x of [-r * 0.62, r * 0.62]) {
        Draw.felt(ctx, x, -r * 0.55, r * 0.32, r * 0.3, c);
        Draw.felt(ctx, x, -r * 0.55, r * 0.16, r * 0.15, "#ffd0dc");
      }
    } else if (kind === "long") {
      for (const x of [-r * 0.38, r * 0.38]) {
        Draw.felt(ctx, x, -r * 0.95, r * 0.22, r * 0.52, c);
        Draw.felt(ctx, x, -r * 0.92, r * 0.1, r * 0.34, "#ffc3d4");
      }
    } else if (kind === "pointy") {
      ctx.fillStyle = Draw.dark(c, 0.05);
      ctx.strokeStyle = Draw.dark(c, 0.32);
      ctx.lineWidth = 2;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sg * r * 0.72, -r * 0.12);
        ctx.lineTo(sg * r * 0.58, -r * 0.98);
        ctx.lineTo(sg * r * 0.14, -r * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  },

  face(ctx, x, y, s, blink, spec) {
    // 잡히거나 떨어질 때의 표정은 다른 인형들과 똑같이 맞춘다
    if (Draw._react && Draw._react !== "idle") {
      Draw.face(ctx, x, y, s, blink);
      return;
    }
    if (spec.cheeks) {
      ctx.fillStyle = "rgba(255, 120, 150, 0.42)";
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sg * s * 0.34, y + s * 0.12, s * 0.16, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#2a123d";
    ctx.strokeStyle = "#2a123d";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    const open = 0.12 + (blink == null ? 1 : blink) * 0.88;
    if (spec.eyes === "smile") {
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + sg * s * 0.2, y + s * 0.02, s * 0.1, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (spec.eyes === "sleepy") {
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sg * s * 0.2 - s * 0.1, y - s * 0.02);
        ctx.lineTo(x + sg * s * 0.2 + s * 0.1, y - s * 0.02);
        ctx.stroke();
      }
    } else if (spec.eyes === "sparkle") {
      for (const sg of [-1, 1]) {
        ctx.fillStyle = "#2a123d";
        ctx.beginPath();
        ctx.ellipse(x + sg * s * 0.2, y - s * 0.03, s * 0.13, s * 0.15 * open, 0, 0, Math.PI * 2);
        ctx.fill();
        if (open > 0.45) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x + sg * s * 0.2 - s * 0.04, y - s * 0.08, s * 0.05, 0, Math.PI * 2);
          ctx.arc(x + sg * s * 0.2 + s * 0.04, y + s * 0.02, s * 0.025, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      for (const sg of [-1, 1]) {
        ctx.fillStyle = "#2a123d";
        ctx.beginPath();
        ctx.ellipse(x + sg * s * 0.2, y - s * 0.02, s * 0.09, s * 0.12 * open, 0, 0, Math.PI * 2);
        ctx.fill();
        if (open > 0.45) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x + sg * s * 0.2 - s * 0.03, y - s * 0.06, s * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.strokeStyle = "#2a123d";
    ctx.beginPath();
    ctx.arc(x, y + s * 0.16, s * 0.1, 0.15, Math.PI - 0.15);
    ctx.stroke();
  },

  accessory(ctx, r, kind) {
    if (kind === "ribbon") {
      ctx.fillStyle = "#ff5c9a";
      ctx.strokeStyle = "#c21870";
      ctx.lineWidth = 1.2;
      const bx = r * 0.5;
      const by = -r * 0.7;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + sg * r * 0.34, by - r * 0.2);
        ctx.lineTo(bx + sg * r * 0.34, by + r * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(bx, by, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "hat") {
      ctx.fillStyle = "#7ec8ff";
      ctx.strokeStyle = "#3a7ab8";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, -r * 0.72);
      ctx.lineTo(r * 0.06, -r * 1.42);
      ctx.lineTo(r * 0.36, -r * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe36a";
      for (const [px, py] of [[-r * 0.08, -r * 0.84], [r * 0.12, -r * 1.06]]) {
        ctx.beginPath();
        ctx.arc(px, py, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ff8fb5";
      ctx.beginPath();
      ctx.arc(r * 0.06, -r * 1.44, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "flower") {
      const fx = -r * 0.6;
      const fy = -r * 0.6;
      ctx.fillStyle = "#fff6c8";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * r * 0.15, fy + Math.sin(a) * r * 0.15, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffb000";
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "crown") {
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#c48a00";
      ctx.lineWidth = 1.4;
      const w = r * 0.62;
      const y0 = -r * 0.74;
      ctx.beginPath();
      ctx.moveTo(-w / 2, y0);
      ctx.lineTo(-w / 2, y0 - r * 0.3);
      ctx.lineTo(-w / 4, y0 - r * 0.14);
      ctx.lineTo(0, y0 - r * 0.38);
      ctx.lineTo(w / 4, y0 - r * 0.14);
      ctx.lineTo(w / 2, y0 - r * 0.3);
      ctx.lineTo(w / 2, y0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff5c9a";
      ctx.beginPath();
      ctx.arc(0, y0 - r * 0.1, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

if (typeof module !== "undefined") module.exports = MyPlush;
