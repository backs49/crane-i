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
  // 숨바꼭질 때 숨을 수 있는 곳 (나무·덤불은 지나갈 수 없는 장애물이기도 하다)
  TREE: { x: 306, y: 196, r: 26 },
  BUSHES: [
    { id: "bushA", x: 138, y: 380, r: 17 },
    { id: "bushB", x: 334, y: 262, r: 17 },
    { id: "bushC", x: 232, y: 172, r: 17 },
    { id: "bushD", x: 34, y: 238, r: 17 },
  ],
  PICNIC: { x: 170, y: 262, rx: 58, ry: 34, seatRx: 104, seatRy: 66 },
  SNACKS: [
    { id: "berry", icon: "🍓" },
    { id: "carrot", icon: "🥕" },
    { id: "honey", icon: "🍯" },
    { id: "fish", icon: "🐟" },
    { id: "cookie", icon: "🍪" },
  ],
  // 성격마다 제일 좋아하는 간식 ("*"는 뭐든 다 좋아함)
  FAVORITE: {
    calm: "honey",
    shy: "carrot",
    proud: "fish",
    curious: "cookie",
    prank: "berry",
    brave: "fish",
    foodie: "*",
    hyper: "cookie",
    sleepy: "honey",
    fresh: "berry",
    dreamy: "cookie",
    sparkle: "berry",
    mystic: "carrot",
  },
  FULL_AT: 3,

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

  obstacles() {
    return [this.TREE].concat(this.BUSHES);
  },

  walkable(x, y) {
    const r = this.RADIUS;
    return (
      x >= r + 6 &&
      x <= this.W - r - 6 &&
      y >= this.HORIZON + 40 &&
      y <= this.H - r - 8 &&
      !this.inPond(x, y, r) &&
      !this.inSlide(x, y, r) &&
      !this.obstacles().some((o) => Math.hypot(x - o.x, y - o.y) < o.r + r)
    );
  },

  // 땅을 누른 곳에서 가장 가까운 걸을 수 있는 자리
  nearestWalkable(x, y) {
    if (this.walkable(Math.round(x), Math.round(y))) return { x: Math.round(x), y: Math.round(y) };
    for (let rad = 6; rad < 200; rad += 6) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const nx = x + Math.cos(a) * rad;
        const ny = y + Math.sin(a) * rad;
        if (this.walkable(Math.round(nx), Math.round(ny))) return { x: Math.round(nx), y: Math.round(ny) };
      }
    }
    return null;
  },

  randomSpot(rng = Math.random) {
    for (let i = 0; i < 40; i++) {
      const x = this.RADIUS + 6 + rng() * (this.W - 2 * this.RADIUS - 12);
      const y = this.HORIZON + 40 + rng() * (this.H - this.HORIZON - 48 - this.RADIUS);
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (this.walkable(rx, ry)) return { x: rx, y: ry };
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

  // 격자 길 찾기 (12px 칸, 8방향). 연못·미끄럼틀·나무를 돌아가는 경로를 만든다
  CELL: 12,

  findPath(from, to) {
    const C = this.CELL;
    const cols = Math.ceil(this.W / C);
    const rows = Math.ceil(this.H / C);
    const key = (cx, cy) => cy * cols + cx;
    const center = (cx, cy) => ({ x: cx * C + C / 2, y: cy * C + C / 2 });
    const ok = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && this.walkable(center(cx, cy).x, center(cx, cy).y);
    const cellOf = (p) => {
      const cx = Math.floor(p.x / C);
      const cy = Math.floor(p.y / C);
      if (ok(cx, cy)) return [cx, cy];
      // 시작·도착점이 칸 가장자리라 막혀 보이면 가장 가까운 빈 칸을 쓴다
      let best = null;
      let bestD = Infinity;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          if (!ok(gx, gy)) continue;
          const c = center(gx, gy);
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < bestD) {
            best = [gx, gy];
            bestD = d;
          }
        }
      }
      return best;
    };
    const a = cellOf(from);
    const b = cellOf(to);
    if (!a || !b) return null;
    // 도착점이 칸 안에 바로 있지 않으면(아주 좁은 틈) 가장 가까운 칸에서 멈춘다
    const exact = Math.floor(to.x / C) === b[0] && Math.floor(to.y / C) === b[1];
    const prev = new Map([[key(a[0], a[1]), -1]]);
    const queue = [a];
    let head = 0;
    let found = false;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      if (cx === b[0] && cy === b[1]) {
        found = true;
        break;
      }
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (prev.has(key(nx, ny)) || !ok(nx, ny)) continue;
        // 대각선은 양옆이 모두 비어 있을 때만 (모서리를 깎지 않게)
        if (ox && oy && (!ok(cx + ox, cy) || !ok(cx, cy + oy))) continue;
        prev.set(key(nx, ny), key(cx, cy));
        queue.push([nx, ny]);
      }
    }
    // 못 가는 곳이면 갈 수 있는 칸 중 목표에 가장 가까운 곳까지 간다
    let end = key(b[0], b[1]);
    if (!found) {
      let bestD = Infinity;
      for (const k of prev.keys()) {
        const c = center(k % cols, Math.floor(k / cols));
        const d = Math.hypot(c.x - to.x, c.y - to.y);
        if (d < bestD) {
          bestD = d;
          end = k;
        }
      }
    }
    const cells = [];
    for (let k = end; k !== -1; k = prev.get(k)) cells.push(center(k % cols, Math.floor(k / cols)));
    cells.reverse();
    cells.shift();
    if (found && exact) cells.push({ x: to.x, y: to.y });
    if (!cells.length) cells.push({ x: from.x, y: from.y });
    return cells;
  },

  // 아이가 땅을 누르면 내 인형이 그곳으로 걸어간다
  goTo(w, x, y) {
    const at = this.nearestWalkable(x, y);
    if (!at || !w) return false;
    const path = this.findPath({ x: w.x, y: w.y }, at);
    if (!path) return false;
    w.path = path;
    w.tx = path[0].x;
    w.ty = path[0].y;
    w.wait = 0;
    w.manual = true;
    w.talking = false;
    return true;
  },

  step(walkers, dt, rng = Math.random) {
    for (const w of walkers) {
      if (w.talking) continue;
      if (w.seat) {
        // 피크닉 자리로 가는 중: 장애물은 무시하고 곧장 간다
        const dx = w.seat.x - w.x;
        const dy = w.seat.y - w.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) {
          w.x = w.seat.x;
          w.y = w.seat.y;
          w.talking = true;
          continue;
        }
        const sp = Math.min(d, this.SPEED * 2 * dt);
        w.x += (dx / d) * sp;
        w.y += (dy / d) * sp;
        w.dir = dx < 0 ? -1 : 1;
        w.walkT += dt;
        continue;
      }
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
        // 길을 따라가는 중이면 다음 지점으로
        if (w.manual && w.path && w.path.length > 1) {
          w.path.shift();
          w.tx = w.path[0].x;
          w.ty = w.path[0].y;
          continue;
        }
        w.wait = w.manual ? 4 + rng() * 2 : 1.2 + rng() * 3;
        w.manual = false;
        w.path = null;
        continue;
      }
      // 아이가 조종하는 내 인형은 더 빨리 걷는다
      const sp = Math.min(d, this.SPEED * (w.manual ? 1.8 : 1) * dt);
      // 앞이 막히면 조금씩 옆으로 꺾어 돌아간다
      let moved = false;
      for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
        const c = Math.cos(turn);
        const sn = Math.sin(turn);
        const ux = (dx / d) * c - (dy / d) * sn;
        const uy = (dx / d) * sn + (dy / d) * c;
        const nx = w.x + ux * sp;
        const ny = w.y + uy * sp;
        if (this.walkable(nx, ny)) {
          w.x = nx;
          w.y = ny;
          w.dir = ux < 0 ? -1 : 1;
          moved = true;
          break;
        }
      }
      if (!moved) {
        // 완전히 막히면 쉬었다가 다른 곳으로 간다
        w.wait = 0.4 + rng();
        w.manual = false;
        w.path = null;
        continue;
      }
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
          if (w.talking || w.seat || w.hidden) continue;
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
    const sorted = walkers.filter((w) => !w.hidden).sort((a, b) => b.y - a.y);
    return sorted.find((w) => Math.hypot(w.x - x, w.y - y) <= r) || null;
  },

  // ---- 숨바꼭질 ----
  spots() {
    const S = this.SLIDE;
    return [
      { id: "tree", x: this.TREE.x, y: this.TREE.y - 6, r: 36 },
      { id: "slide", x: S.x + S.w / 2, y: S.y + S.h / 2, r: 40 },
    ].concat(this.BUSHES.map((b) => ({ id: b.id, x: b.x, y: b.y, r: b.r + 12 })));
  },

  spotAt(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const sp of this.spots()) {
      const d = Math.hypot(x - sp.x, y - sp.y);
      if (d <= sp.r && d < bestD) {
        best = sp;
        bestD = d;
      }
    }
    return best;
  },

  hideStart(walkers, rng = Math.random) {
    if (!walkers.length) return null;
    const hider = walkers[Math.floor(rng() * walkers.length) % walkers.length];
    const list = this.spots();
    const spot = list[Math.floor(rng() * list.length) % list.length];
    return { hider: hider.type, spot: spot.id, tries: 0, found: false };
  },

  // 한 번 고르기: 찾았는지, 가까운지, 아닌지
  hideGuess(game, spotId) {
    if (!game || game.found) return { result: "done", game };
    if (spotId === game.spot) return { result: "found", game: Object.assign({}, game, { found: true, tries: game.tries + 1 }) };
    const list = this.spots();
    const a = list.find((sp) => sp.id === spotId);
    const b = list.find((sp) => sp.id === game.spot);
    const near = a && b && Math.hypot(a.x - b.x, a.y - b.y) < 130;
    return { result: near ? "near" : "miss", game: Object.assign({}, game, { tries: game.tries + 1 }) };
  },

  // 두 번 틀리면 숨은 곳이 부스럭거려 어린아이도 찾을 수 있게 한다
  hideHint(game) {
    return !!game && !game.found && game.tries >= 2;
  },

  // ---- 피크닉 ----
  seats(n) {
    const P = this.PICNIC;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
      out.push({ x: Math.round(P.x + Math.cos(a) * P.seatRx), y: Math.round(P.y + Math.sin(a) * P.seatRy) });
    }
    return out;
  },

  favorite(persona) {
    return this.FAVORITE[persona] || "cookie";
  },

  // 간식 주기: 좋아하는 것이면 love, 아니면 like, 이번 피크닉에서 FULL_AT번 먹었으면 full
  feed(eaten, type, snackId) {
    const n = (eaten && eaten[type]) || 0;
    const next = Object.assign({}, eaten, { [type]: n + 1 });
    if (n >= this.FULL_AT) return { result: "full", eaten: Object.assign({}, eaten), hearts: 0 };
    const fav = this.favorite(this.persona(type));
    const love = fav === "*" || fav === snackId;
    return { result: love ? "love" : "like", eaten: next, hearts: love ? 2 : 1 };
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

    // 피크닉 돗자리
    if (opts.picnic) {
      const M = this.PICNIC;
      ctx.save();
      ctx.translate(M.x, M.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, M.rx, M.ry, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let i = -6; i <= 6; i++) {
        ctx.fillStyle = i % 2 ? "#ff8fb5" : "#fff0f6";
        ctx.fillRect(i * 12 - 6, -M.ry, 12, M.ry * 2);
      }
      ctx.restore();
      ctx.font = "22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🧺", M.x, M.y + 8);
    }

    // 나무와 덤불 (숨바꼭질 장소). 힌트가 켜지면 숨은 곳이 부스럭거린다
    const shake = (id) => (opts.rustle === id ? Math.sin(t * 28) * 2.5 * (Math.sin(t * 3) > 0 ? 1 : 0.2) : 0);
    const T = this.TREE;
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(T.x - 6, T.y - 4, 12, 30);
    const leaf = night ? "#2e7d4f" : "#5cc27a";
    const tx = T.x + shake("tree");
    for (const [ox, oy, rr] of [[0, -28, 26], [-18, -14, 20], [18, -14, 20], [0, -6, 18]]) {
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.arc(tx + ox, T.y + oy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ff6b8a";
    for (const [ox, oy] of [[-10, -34], [12, -22], [-20, -10]]) {
      ctx.beginPath();
      ctx.arc(tx + ox, T.y + oy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of this.BUSHES) {
      const bx = b.x + shake(b.id);
      ctx.fillStyle = night ? "#2f7a4c" : "#4fb56c";
      for (const [ox, oy, rr] of [[-9, 2, 12], [9, 2, 12], [0, -6, 13]]) {
        ctx.beginPath();
        ctx.arc(bx + ox, b.y + oy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(bx - 4, b.y - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 고른 곳 표시 (숨바꼭질 중 틀린 곳에 물음표)
    for (const id of opts.checked || []) {
      const sp = this.spots().find((q) => q.id === id);
      if (!sp) continue;
      ctx.font = "15px 'Jua', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(42, 14, 46, 0.7)";
      ctx.fillText("✕", sp.x, sp.y - sp.r + 6);
    }

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

    const sorted = walkers.filter((w) => !w.hidden).sort((a, b) => a.y - b.y);
    for (const w of sorted) {
      const moving = !w.talking && (w.wait <= 0 || w.seat);
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
