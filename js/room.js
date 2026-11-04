// 내 인형 방: 뽑은 인형을 배치하고, 쓰다듬고, 이름을 붙이는 공간.
// 상태 갱신 함수는 순수 함수(불변 갱신)라 Node에서 테스트할 수 있다.
const Room = {
  W: 360,
  H: 400,
  FLOOR_TOP: 150,
  RADIUS: 22,
  NAME_MAX: 8,
  PETS_PER_HEART: 5,
  HEARTS_MAX: 5,
  PETS_MAX: 9999,

  slot(i) {
    const cols = 4;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { x: 55 + col * 83, y: this.FLOOR_TOP + 22 + row * 64 };
  },

  clampPos(x, y) {
    const r = this.RADIUS;
    const cx = Math.max(r + 8, Math.min(this.W - r - 8, Number(x) || 0));
    const cy = Math.max(this.FLOOR_TOP, Math.min(this.H - r - 18, Number(y) || 0));
    return { x: Math.round(cx), y: Math.round(cy) };
  },

  cleanName(name) {
    const clean = String(name == null ? "" : name).replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
    return Array.from(clean)
      .slice(0, this.NAME_MAX)
      .join("")
      .trim();
  },

  entry(room, type) {
    return (room && room[type]) || {};
  },

  _with(room, type, patch) {
    const next = Object.assign({}, room);
    next[type] = Object.assign({}, this.entry(room, type), patch);
    return next;
  },

  move(room, type, x, y) {
    return this._with(room, type, this.clampPos(x, y));
  },

  rename(room, type, name) {
    const clean = this.cleanName(name);
    const next = this._with(room, type, {});
    if (clean) next[type].name = clean;
    else delete next[type].name;
    return next;
  },

  pet(room, type) {
    const pets = Math.min(this.PETS_MAX, (this.entry(room, type).pets || 0) + 1);
    return this._with(room, type, { pets });
  },

  hearts(pets) {
    return Math.min(this.HEARTS_MAX, Math.floor((pets || 0) / this.PETS_PER_HEART));
  },

  // 도감에 한 번이라도 잡힌 종류만 방에 산다
  residents(dexCounts, room, typeKeys, names) {
    const caught = typeKeys.filter((t) => ((dexCounts && dexCounts[t]) || 0) > 0);
    return caught.map((type, i) => {
      const e = this.entry(room, type);
      const home = Number.isFinite(e.x) && Number.isFinite(e.y) ? this.clampPos(e.x, e.y) : this.slot(i);
      return {
        type,
        x: home.x,
        y: home.y,
        name: e.name || (names && names[type]) || type,
        pets: e.pets || 0,
        count: dexCounts[type],
      };
    });
  },

  // 위에 그려진(나중 순서) 인형이 먼저 잡히도록 역순으로 찾는다
  hit(list, x, y) {
    const r = this.RADIUS + 6;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (Math.hypot(p.x - x, p.y - y) <= r) return p;
    }
    return null;
  },

  paint(ctx, list, opts = {}) {
    const W = this.W;
    const H = this.H;
    const t = opts.time || 0;
    const anim = opts.anim || {};

    // 벽지
    const wall = ctx.createLinearGradient(0, 0, 0, this.FLOOR_TOP);
    wall.addColorStop(0, "#5b2f86");
    wall.addColorStop(1, "#7b4aa8");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, this.FLOOR_TOP - 20);
    ctx.fillStyle = "rgba(255, 234, 244, 0.12)";
    for (let y = 14; y < this.FLOOR_TOP - 20; y += 28) {
      for (let x = (y / 28) % 2 ? 14 : 28; x < W; x += 28) {
        Draw.star(ctx, x, y, 3.2, 4, 0.45);
        ctx.fill();
      }
    }
    // 창문과 달
    ctx.fillStyle = "#1a0b2c";
    ctx.fillRect(W - 112, 22, 82, 70);
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(W - 58, 50, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0b2c";
    ctx.beginPath();
    ctx.arc(W - 52, 46, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd6ec";
    ctx.lineWidth = 4;
    ctx.strokeRect(W - 112, 22, 82, 70);
    ctx.beginPath();
    ctx.moveTo(W - 71, 22);
    ctx.lineTo(W - 71, 92);
    ctx.stroke();
    // 액자
    ctx.fillStyle = "#ffb3c7";
    ctx.fillRect(30, 34, 58, 46);
    ctx.fillStyle = "#fff0e0";
    ctx.fillRect(36, 40, 46, 34);
    ctx.fillStyle = "#ff6b8a";
    Draw.heart(ctx, 59, 58, 11);
    ctx.fill();

    // 바닥과 러그
    ctx.fillStyle = "#e8b07a";
    ctx.fillRect(0, this.FLOOR_TOP - 20, W, H - this.FLOOR_TOP + 20);
    ctx.fillStyle = "rgba(120, 60, 20, 0.16)";
    for (let y = this.FLOOR_TOP - 20; y < H; y += 22) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = "#ffb6c8";
    ctx.beginPath();
    ctx.ellipse(W / 2, (this.FLOOR_TOP + H) / 2 + 10, W * 0.44, (H - this.FLOOR_TOP) * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff0e0";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, (this.FLOOR_TOP + H) / 2 + 10, W * 0.4, (H - this.FLOOR_TOP) * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!list.length) {
      ctx.fillStyle = "#3a1230";
      ctx.font = "17px 'Jua', 'Gowun Dodum', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("아직 친구가 없어요", W / 2, 268);
      ctx.font = "14px 'Gowun Dodum', sans-serif";
      ctx.fillText("인형을 뽑아서 데려와요!", W / 2, 292);
      return;
    }

    const sorted = list.slice().sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const a = anim[p.type] || {};
      const bounce = a.bounce > 0 ? Math.sin(a.bounce * Math.PI * 3) * a.bounce : 0;
      const sway = Math.sin(t * 1.6 + p.x * 0.05) * 0.05;
      Draw.plush(ctx, {
        type: p.type,
        x: p.x,
        y: p.y - Math.abs(bounce) * 12,
        radius: this.RADIUS,
        angle: sway,
        liftZ: opts.dragging === p.type ? 0.25 : 0,
        blink: a.blink == null ? 1 : a.blink,
        react: a.bounce > 0 ? "success" : "idle",
        squashY: -bounce * 0.12,
        squashX: bounce * 0.1,
      });
      if (opts.selected === p.type) {
        ctx.strokeStyle = "#ffe36a";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.RADIUS + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // 이름표
      ctx.font = "12px 'Jua', 'Gowun Dodum', sans-serif";
      ctx.textAlign = "center";
      const w = ctx.measureText(p.name).width + 12;
      ctx.fillStyle = "rgba(42, 14, 46, 0.78)";
      ctx.fillRect(p.x - w / 2, p.y + this.RADIUS + 4, w, 17);
      ctx.fillStyle = "#ffeaf4";
      ctx.fillText(p.name, p.x, p.y + this.RADIUS + 17);
      // 친밀도 하트
      const h = this.hearts(p.pets);
      ctx.fillStyle = "#ff6b8a";
      for (let i = 0; i < h; i++) {
        Draw.heart(ctx, p.x - (h - 1) * 5 + i * 10, p.y - this.RADIUS - 8, 4.5);
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
  },
};

if (typeof module !== "undefined") module.exports = Room;
