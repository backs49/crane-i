// 나만의 애착 인형: 아이가 동물·색·눈·볼·소품·성격·이름을 골라 만든다.
// 사진이나 카메라 없이 기기 안에서만 그리고 저장한다.
// 뽑기 기계, 도감, 인형 방, 몰랑 마을에서 인형 종류 "mine"으로 함께 쓰인다.
const MyPlush = {
  TYPE: "mine",
  NAME_MAX: 8,
  // 동물마다 처음 고르면 바뀌는 대표 색(color)이 있다. 색은 나중에 바꿀 수 있다.
  ANIMALS: [
    { id: "bear", color: "#c98a55" },
    { id: "bunny", color: "#fff0e0" },
    { id: "cat", color: "#ffb37a" },
    { id: "puppy", color: "#e8b07a" },
    { id: "fox", color: "#ff9a4a" },
    { id: "panda", color: "#fff0e0" },
    { id: "koala", color: "#c9c9d6" },
    { id: "pig", color: "#ffb3c7" },
    { id: "mouse", color: "#c9c9d6" },
    { id: "lion", color: "#f7c26b" },
    { id: "tiger", color: "#ff9a4a" },
    { id: "monkey", color: "#c98a55" },
    { id: "elephant", color: "#c9c9d6" },
    { id: "sheep", color: "#fff0e0" },
    { id: "cow", color: "#fff0e0" },
    { id: "deer", color: "#e8b07a" },
    { id: "chick", color: "#ffe36a" },
    { id: "dino", color: "#7de3b0" },
    { id: "unicorn", color: "#d7c2ff" },
    { id: "blob", color: "#ffb3c7" },
  ],
  COLORS: [
    "#ffb3c7",
    "#fff0e0",
    "#ffb37a",
    "#ffe36a",
    "#7de3b0",
    "#7ec8ff",
    "#d7c2ff",
    "#e8b07a",
    "#c9c9d6",
    "#c98a55",
    "#ff9a4a",
    "#f7c26b",
  ],
  EYES: ["dot", "smile", "sparkle", "sleepy"],
  CHEEKS: [true, false],
  ACCESSORIES: ["none", "ribbon", "hat", "flower", "crown"],
  PERSONAS: ["calm", "shy", "proud", "curious", "prank", "brave", "foodie", "hyper", "sleepy", "fresh", "dreamy", "sparkle"],
  // 예전 저장 데이터의 "귀" 선택을 같은 동물로 옮긴다
  LEGACY_EARS: { round: "bear", long: "bunny", pointy: "cat", none: "blob" },

  // 실제로 쓰이는 인형 모양. 저장된 값이 없으면 null
  spec: null,

  animalIds() {
    return this.ANIMALS.map((a) => a.id);
  },

  animalColor(id) {
    const a = this.ANIMALS.find((x) => x.id === id);
    return a ? a.color : this.COLORS[0];
  },

  defaults() {
    return {
      animal: "bear",
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
    const legacy = this.LEGACY_EARS[raw.ears];
    return {
      animal: one(this.animalIds(), raw.animal, legacy || d.animal),
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
    const animal = any(this.animalIds());
    return {
      animal,
      // 절반은 동물의 대표 색, 절반은 아무 색
      color: rng() < 0.5 ? this.animalColor(animal) : any(this.COLORS),
      eyes: any(this.EYES),
      cheeks: rng() < 0.7,
      accessory: any(this.ACCESSORIES),
      persona: any(this.PERSONAS),
      name: this.cleanName(name) || this.defaults().name,
    };
  },

  // 다음/이전 보기로 넘기기
  cycle(spec, field, step = 1) {
    const lists = {
      animal: this.animalIds(),
      color: this.COLORS,
      eyes: this.EYES,
      cheeks: this.CHEEKS,
      accessory: this.ACCESSORIES,
      persona: this.PERSONAS,
    };
    const list = lists[field];
    if (!list) return spec;
    const i = list.indexOf(spec[field]);
    const next = list[(((i < 0 ? 0 : i) + step) % list.length + list.length) % list.length];
    return Object.assign({}, spec, { [field]: next });
  },

  // ---- 그리기 (원점 기준, Draw.plush가 위치·크기·기울기를 맞춘 뒤 부른다) ----
  INK: "#2a2233",

  draw(ctx, r, spec, blink) {
    const s = spec || this.defaults();
    const c = s.color;
    const parts = this.PARTS[s.animal] || this.PARTS.blob;
    if (parts.back) parts.back.call(this, ctx, r, c);
    Draw.felt(ctx, 0, r * 0.2, r * 0.76, r * 0.66, c);
    Draw.felt(ctx, 0, -r * 0.08, r * 0.84, r * 0.76, c);
    if (parts.front) parts.front.call(this, ctx, r, c);
    this.face(ctx, 0, -r * 0.06, r * 0.7, blink, s, parts);
    if (parts.over) parts.over.call(this, ctx, r, c);
    this.accessory(ctx, r, s.accessory);
  },

  // 자주 쓰는 부품
  muzzle(ctx, r, c) {
    Draw.felt(ctx, 0, r * 0.14, r * 0.3, r * 0.22, Draw.light(c, 0.45));
  },

  roundEars(ctx, r, c, x, y, size, inner) {
    for (const sg of [-1, 1]) {
      Draw.felt(ctx, sg * x, y, size, size * 0.94, c);
      if (inner) Draw.felt(ctx, sg * x, y, size * 0.5, size * 0.47, inner);
    }
  },

  pointyEars(ctx, r, c, h, tip) {
    ctx.strokeStyle = Draw.dark(c, 0.32);
    ctx.lineWidth = 2;
    for (const sg of [-1, 1]) {
      ctx.fillStyle = Draw.dark(c, 0.05);
      ctx.beginPath();
      ctx.moveTo(sg * r * 0.74, -r * 0.12);
      ctx.lineTo(sg * r * 0.6, -r * h);
      ctx.lineTo(sg * r * 0.12, -r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (tip) {
        ctx.fillStyle = tip;
        ctx.beginPath();
        ctx.moveTo(sg * r * 0.66, -r * (h - 0.32));
        ctx.lineTo(sg * r * 0.6, -r * h);
        ctx.lineTo(sg * r * 0.44, -r * (h - 0.3));
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  whiskers(ctx, r, c) {
    ctx.strokeStyle = Draw.dark(c, 0.35);
    ctx.lineWidth = 1.3;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sg * r * 0.24, r * 0.06);
      ctx.lineTo(sg * r * 0.72, -r * 0.02);
      ctx.moveTo(sg * r * 0.24, r * 0.14);
      ctx.lineTo(sg * r * 0.7, r * 0.18);
      ctx.stroke();
    }
  },

  nose(ctx, r, y, w, color) {
    ctx.fillStyle = color || this.INK;
    ctx.beginPath();
    ctx.ellipse(0, r * y, r * w, r * w * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  sideEars(ctx, r, c, x, y, rx, ry, inner) {
    for (const sg of [-1, 1]) {
      Draw.felt(ctx, sg * x, y, rx, ry, c);
      if (inner) Draw.felt(ctx, sg * x, y, rx * 0.55, ry * 0.6, inner);
    }
  },

  PARTS: {
    bear: {
      back(ctx, r, c) {
        this.roundEars(ctx, r, c, r * 0.62, -r * 0.55, r * 0.32, "#ffd0dc");
      },
      front(ctx, r, c) {
        this.muzzle(ctx, r, c);
      },
    },
    bunny: {
      back(ctx, r, c) {
        for (const x of [-r * 0.38, r * 0.38]) {
          Draw.felt(ctx, x, -r * 0.95, r * 0.22, r * 0.52, c);
          Draw.felt(ctx, x, -r * 0.92, r * 0.1, r * 0.34, "#ffc3d4");
        }
      },
    },
    cat: {
      back(ctx, r, c) {
        this.pointyEars(ctx, r, c, 0.98);
      },
      over(ctx, r, c) {
        this.whiskers(ctx, r, c);
      },
    },
    puppy: {
      front(ctx, r, c) {
        // 축 늘어진 귀
        for (const sg of [-1, 1]) {
          ctx.save();
          ctx.translate(sg * r * 0.74, -r * 0.18);
          ctx.rotate(sg * 0.32);
          Draw.felt(ctx, 0, r * 0.18, r * 0.2, r * 0.42, Draw.dark(c, 0.22));
          ctx.restore();
        }
        this.muzzle(ctx, r, c);
      },
      over(ctx, r) {
        this.nose(ctx, r, 0.03, 0.08);
      },
    },
    fox: {
      back(ctx, r, c) {
        this.pointyEars(ctx, r, c, 1.08, "#3a2a2a");
      },
      front(ctx, r) {
        // 하얀 볼과 턱
        Draw.felt(ctx, -r * 0.24, r * 0.26, r * 0.28, r * 0.2, "#fff6ee");
        Draw.felt(ctx, r * 0.24, r * 0.26, r * 0.28, r * 0.2, "#fff6ee");
        Draw.felt(ctx, 0, r * 0.3, r * 0.2, r * 0.14, "#fff6ee");
      },
      over(ctx, r) {
        this.nose(ctx, r, 0.03, 0.07);
      },
    },
    panda: {
      lightEyes: true,
      back(ctx, r) {
        this.roundEars(ctx, r, "#3a3340", r * 0.62, -r * 0.55, r * 0.3);
      },
      front(ctx, r, c) {
        ctx.fillStyle = "#3a3340";
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sg * r * 0.16, -r * 0.08, r * 0.15, r * 0.19, sg * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        this.muzzle(ctx, r, c);
      },
    },
    koala: {
      back(ctx, r, c) {
        this.roundEars(ctx, r, c, r * 0.72, -r * 0.42, r * 0.4, Draw.light(c, 0.55));
      },
      over(ctx, r) {
        ctx.fillStyle = "#4a3f4f";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.04, r * 0.15, r * 0.19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(-r * 0.05, -r * 0.04, r * 0.04, r * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    pig: {
      back(ctx, r, c) {
        ctx.fillStyle = Draw.dark(c, 0.08);
        ctx.strokeStyle = Draw.dark(c, 0.3);
        ctx.lineWidth = 2;
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sg * r * 0.66, -r * 0.4);
          ctx.lineTo(sg * r * 0.62, -r * 0.86);
          ctx.lineTo(sg * r * 0.26, -r * 0.62);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      },
      over(ctx, r, c) {
        Draw.felt(ctx, 0, r * 0.1, r * 0.22, r * 0.15, Draw.dark(c, 0.08));
        ctx.fillStyle = Draw.dark(c, 0.45);
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sg * r * 0.07, r * 0.1, r * 0.035, r * 0.055, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
    mouse: {
      back(ctx, r, c) {
        this.roundEars(ctx, r, c, r * 0.6, -r * 0.62, r * 0.38, "#ffc3d4");
      },
      over(ctx, r, c) {
        this.whiskers(ctx, r, c);
        this.nose(ctx, r, 0.03, 0.06, "#ff8fb5");
      },
    },
    lion: {
      back(ctx, r, c) {
        const mane = Draw.dark(c, 0.3);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          Draw.felt(ctx, Math.cos(a) * r * 0.82, -r * 0.08 + Math.sin(a) * r * 0.74, r * 0.26, r * 0.26, mane);
        }
        this.roundEars(ctx, r, c, r * 0.58, -r * 0.6, r * 0.2);
      },
      front(ctx, r, c) {
        this.muzzle(ctx, r, c);
      },
      over(ctx, r) {
        this.nose(ctx, r, 0.04, 0.07, "#8a4a3a");
      },
    },
    tiger: {
      back(ctx, r, c) {
        this.roundEars(ctx, r, c, r * 0.6, -r * 0.58, r * 0.24, "#fff6ee");
      },
      front(ctx, r) {
        ctx.strokeStyle = "#3a2a2a";
        ctx.lineWidth = r * 0.07;
        ctx.lineCap = "round";
        // 이마 줄무늬
        for (const [x, len] of [[-r * 0.18, 0.16], [0, 0.22], [r * 0.18, 0.16]]) {
          ctx.beginPath();
          ctx.moveTo(x, -r * 0.8);
          ctx.lineTo(x, -r * (0.8 - len));
          ctx.stroke();
        }
        // 볼 줄무늬
        for (const sg of [-1, 1]) {
          for (const y of [-0.12, 0.06]) {
            ctx.beginPath();
            ctx.moveTo(sg * r * 0.8, r * y);
            ctx.lineTo(sg * r * 0.56, r * (y + 0.03));
            ctx.stroke();
          }
        }
        Draw.felt(ctx, 0, r * 0.14, r * 0.32, r * 0.22, "#fff6ee");
      },
      over(ctx, r) {
        this.nose(ctx, r, 0.04, 0.07, "#ff8fb5");
      },
    },
    monkey: {
      back(ctx, r, c) {
        this.sideEars(ctx, r, c, r * 0.86, -r * 0.08, r * 0.2, r * 0.2, Draw.light(c, 0.5));
      },
      front(ctx, r, c) {
        const skin = Draw.light(c, 0.55);
        Draw.felt(ctx, -r * 0.18, -r * 0.12, r * 0.26, r * 0.26, skin);
        Draw.felt(ctx, r * 0.18, -r * 0.12, r * 0.26, r * 0.26, skin);
        Draw.felt(ctx, 0, r * 0.12, r * 0.4, r * 0.26, skin);
      },
    },
    elephant: {
      back(ctx, r, c) {
        this.sideEars(ctx, r, c, r * 0.84, -r * 0.08, r * 0.4, r * 0.5, "#ffc3d4");
      },
      over(ctx, r, c) {
        // 코: 아래로 내려와 살짝 말린다
        ctx.lineCap = "round";
        ctx.strokeStyle = Draw.dark(c, 0.32);
        ctx.lineWidth = r * 0.22;
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.02);
          ctx.quadraticCurveTo(-r * 0.02, r * 0.34, r * 0.16, r * 0.42);
        };
        path();
        ctx.stroke();
        ctx.strokeStyle = c;
        ctx.lineWidth = r * 0.17;
        path();
        ctx.stroke();
      },
    },
    sheep: {
      back(ctx, r) {
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          Draw.felt(ctx, Math.cos(a) * r * 0.72, -r * 0.14 + Math.sin(a) * r * 0.66, r * 0.26, r * 0.24, "#fffaf2");
        }
      },
      front(ctx, r, c) {
        this.sideEars(ctx, r, Draw.dark(c, 0.12), r * 0.86, -r * 0.12, r * 0.22, r * 0.11);
        for (const [x, y] of [[-r * 0.24, -r * 0.7], [0, -r * 0.78], [r * 0.24, -r * 0.7]]) {
          Draw.felt(ctx, x, y, r * 0.2, r * 0.17, "#fffaf2");
        }
      },
    },
    cow: {
      back(ctx, r, c) {
        ctx.fillStyle = "#fff3c4";
        ctx.strokeStyle = "#c9a86b";
        ctx.lineWidth = 1.6;
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sg * r * 0.3, -r * 0.7);
          ctx.quadraticCurveTo(sg * r * 0.52, -r * 1.12, sg * r * 0.64, -r * 0.94);
          ctx.quadraticCurveTo(sg * r * 0.5, -r * 0.84, sg * r * 0.46, -r * 0.66);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        this.sideEars(ctx, r, c, r * 0.86, -r * 0.3, r * 0.24, r * 0.12, "#ffc3d4");
      },
      front(ctx, r) {
        ctx.fillStyle = "#3a3340";
        ctx.beginPath();
        ctx.ellipse(-r * 0.5, -r * 0.4, r * 0.2, r * 0.15, 0.4, 0, Math.PI * 2);
        ctx.ellipse(r * 0.56, -r * 0.1, r * 0.13, r * 0.11, -0.3, 0, Math.PI * 2);
        ctx.fill();
      },
      over(ctx, r) {
        Draw.felt(ctx, 0, r * 0.18, r * 0.36, r * 0.2, "#ffc3d4");
        ctx.fillStyle = "#c86a8a";
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sg * r * 0.12, r * 0.18, r * 0.04, r * 0.06, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
    deer: {
      back(ctx, r, c) {
        ctx.strokeStyle = "#8a5a3c";
        ctx.lineWidth = r * 0.09;
        ctx.lineCap = "round";
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sg * r * 0.26, -r * 0.7);
          ctx.lineTo(sg * r * 0.4, -r * 1.2);
          ctx.moveTo(sg * r * 0.33, -r * 0.95);
          ctx.lineTo(sg * r * 0.6, -r * 1.08);
          ctx.moveTo(sg * r * 0.38, -r * 1.12);
          ctx.lineTo(sg * r * 0.22, -r * 1.3);
          ctx.stroke();
        }
        for (const sg of [-1, 1]) {
          ctx.save();
          ctx.translate(sg * r * 0.8, -r * 0.42);
          ctx.rotate(sg * -0.6);
          Draw.felt(ctx, 0, 0, r * 0.26, r * 0.13, c);
          ctx.restore();
        }
      },
      front(ctx, r, c) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        for (const [x, y] of [[-r * 0.42, -r * 0.48], [-r * 0.28, -r * 0.6], [r * 0.4, -r * 0.5]]) {
          ctx.beginPath();
          ctx.arc(x, y, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        this.muzzle(ctx, r, c);
      },
      over(ctx, r) {
        this.nose(ctx, r, 0.03, 0.07);
      },
    },
    chick: {
      back(ctx, r, c) {
        for (const [x, a] of [[-r * 0.1, -0.4], [0, 0], [r * 0.1, 0.4]]) {
          ctx.save();
          ctx.translate(x, -r * 0.82);
          ctx.rotate(a);
          Draw.felt(ctx, 0, -r * 0.12, r * 0.07, r * 0.16, Draw.dark(c, 0.06));
          ctx.restore();
        }
      },
      over(ctx, r) {
        ctx.fillStyle = "#ff9a3c";
        ctx.strokeStyle = "#d4691e";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, r * 0.06);
        ctx.lineTo(0, -r * 0.02);
        ctx.lineTo(r * 0.12, r * 0.06);
        ctx.lineTo(0, r * 0.16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
    },
    dino: {
      back(ctx, r, c) {
        ctx.fillStyle = Draw.dark(c, 0.25);
        for (let i = 0; i < 5; i++) {
          const a = Math.PI * (1.18 + i * 0.16);
          const bx = Math.cos(a) * r * 0.78;
          const by = -r * 0.08 + Math.sin(a) * r * 0.7;
          ctx.beginPath();
          ctx.moveTo(bx - Math.sin(a) * r * 0.12, by + Math.cos(a) * r * 0.12);
          ctx.lineTo(bx + Math.cos(a) * r * 0.26, by + Math.sin(a) * r * 0.26);
          ctx.lineTo(bx + Math.sin(a) * r * 0.12, by - Math.cos(a) * r * 0.12);
          ctx.closePath();
          ctx.fill();
        }
      },
      front(ctx, r, c) {
        this.muzzle(ctx, r, c);
      },
      over(ctx, r, c) {
        ctx.fillStyle = Draw.dark(c, 0.45);
        for (const sg of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(sg * r * 0.08, r * 0.06, r * 0.03, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
    unicorn: {
      back(ctx, r, c) {
        const mane = ["#ff8fb5", "#7ec8ff", "#ffe36a"];
        for (let i = 0; i < 5; i++) {
          Draw.felt(ctx, -r * 0.7 + i * r * 0.08, -r * 0.62 + i * r * 0.2, r * 0.2, r * 0.18, mane[i % 3]);
        }
        this.pointyEars(ctx, r, c, 0.92);
      },
      over(ctx, r) {
        ctx.fillStyle = "#ffd23f";
        ctx.strokeStyle = "#c48a00";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, -r * 0.7);
        ctx.lineTo(0, -r * 1.25);
        ctx.lineTo(r * 0.12, -r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.08, -r * 0.86);
        ctx.lineTo(r * 0.07, -r * 0.92);
        ctx.moveTo(-r * 0.05, -r * 1.02);
        ctx.lineTo(r * 0.05, -r * 1.07);
        ctx.stroke();
      },
    },
    blob: {
      front(ctx, r, c) {
        this.muzzle(ctx, r, c);
      },
    },
  },

  face(ctx, x, y, s, blink, spec, parts) {
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
    // 판다처럼 눈 주위가 어두우면 눈을 밝게 그린다
    const ink = parts && parts.lightEyes ? "#ffffff" : "#2a123d";
    const shine = parts && parts.lightEyes ? "#2a123d" : "#fff";
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
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
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.ellipse(x + sg * s * 0.2, y - s * 0.03, s * 0.13, s * 0.15 * open, 0, 0, Math.PI * 2);
        ctx.fill();
        if (open > 0.45) {
          ctx.fillStyle = shine;
          ctx.beginPath();
          ctx.arc(x + sg * s * 0.2 - s * 0.04, y - s * 0.08, s * 0.05, 0, Math.PI * 2);
          ctx.arc(x + sg * s * 0.2 + s * 0.04, y + s * 0.02, s * 0.025, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      for (const sg of [-1, 1]) {
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.ellipse(x + sg * s * 0.2, y - s * 0.02, s * 0.09, s * 0.12 * open, 0, 0, Math.PI * 2);
        ctx.fill();
        if (open > 0.45) {
          ctx.fillStyle = shine;
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
