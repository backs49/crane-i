const Draw = {
  rgb(hex) {
    const n = hex.replace("#", "");
    return {
      r: parseInt(n.slice(0, 2), 16),
      g: parseInt(n.slice(2, 4), 16),
      b: parseInt(n.slice(4, 6), 16),
    };
  },

  mix(a, b, t) {
    const A = this.rgb(a);
    const B = this.rgb(b);
    const h = (n) => Math.round(n).toString(16).padStart(2, "0");
    return `#${h(A.r + (B.r - A.r) * t)}${h(A.g + (B.g - A.g) * t)}${h(A.b + (B.b - A.b) * t)}`;
  },

  light(hex, t) {
    return this.mix(hex, "#ffffff", t);
  },

  dark(hex, t) {
    return this.mix(hex, "#1a0818", t);
  },

  felt(ctx, x, y, rx, ry, color) {
    const g = ctx.createRadialGradient(x - rx * 0.28, y - ry * 0.32, rx * 0.08, x, y, rx);
    g.addColorStop(0, this.light(color, 0.28));
    g.addColorStop(0.55, color);
    g.addColorStop(1, this.dark(color, 0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.dark(color, 0.32);
    ctx.lineWidth = 2.1;
    ctx.stroke();
  },

  star(ctx, x, y, r, n = 5, inner = 0.45) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const rad = i % 2 === 0 ? r : r * inner;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  },

  heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.35, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.35, y - s, x + s, y - s * 0.2, x, y + s * 0.35);
  },

  face(ctx, x, y, s, blink) {
    ctx.fillStyle = "rgba(255, 120, 150, 0.38)";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.34, y + s * 0.12, s * 0.16, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.34, y + s * 0.12, s * 0.16, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    const open = 0.12 + blink * 0.88;
    ctx.fillStyle = "#2a123d";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.2, y - s * 0.02, s * 0.09, s * 0.12 * open, 0, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.2, y - s * 0.02, s * 0.09, s * 0.12 * open, 0, 0, Math.PI * 2);
    ctx.fill();

    if (open > 0.45) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - s * 0.23, y - s * 0.06, s * 0.035, 0, Math.PI * 2);
      ctx.arc(x + s * 0.17, y - s * 0.06, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "#2a123d";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y + s * 0.16, s * 0.1, 0.15, Math.PI - 0.15);
    ctx.stroke();
  },

  shadow(ctx, x, y, r, lift) {
    ctx.save();
    ctx.translate(x, y + 4 + lift * 10);
    ctx.scale(1.05 - lift * 0.25, 0.42);
    ctx.fillStyle = `rgba(30, 8, 40, ${0.28 - lift * 0.12})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  field(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, "#4a226e");
    g.addColorStop(1, "#2a1148");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    ctx.fillStyle = "rgba(255, 234, 244, 0.05)";
    for (let y = 28; y < WORLD.h; y += 22) {
      for (let x = 22; x < WORLD.w; x += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = "rgba(255, 121, 199, 0.18)";
    ctx.lineWidth = 10;
    ctx.strokeRect(WORLD.wall - 2, WORLD.wall - 2, WORLD.w - WORLD.wall * 2 + 4, WORLD.h - WORLD.wall * 2 + 4);

    this.chute(ctx);
  },

  chute(ctx) {
    const { x, y, r } = CHUTE;
    ctx.save();
    ctx.fillStyle = "#1a0820";
    ctx.beginPath();
    ctx.ellipse(x, y, r + 8, r * 0.72 + 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const hole = ctx.createRadialGradient(x, y, 4, x, y, r);
    hole.addColorStop(0, "#3a1030");
    hole.addColorStop(0.55, "#140814");
    hole.addColorStop(1, "#070308");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ff79c7";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#ff79c7";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ff9ad8";
    this.heart(ctx, x, y + 2, 8);
    ctx.fill();
    ctx.restore();
  },

  gantry(ctx, claw) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#e8d6ff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(WORLD.wall, claw.y);
    ctx.lineTo(WORLD.w - WORLD.wall, claw.y);
    ctx.stroke();
    ctx.strokeStyle = "#63f0c8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(claw.x, WORLD.wall);
    ctx.lineTo(claw.x, WORLD.h - WORLD.wall);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(claw.x, claw.y);
    ctx.fillStyle = "#fff4fb";
    ctx.strokeStyle = "#c44590";
    ctx.lineWidth = 2;
    const s = 18;
    ctx.beginPath();
    ctx.roundRect(-s, -s, s * 2, s * 2, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff79c7";
    for (const [px, py] of [
      [-10, -10],
      [10, -10],
      [-10, 10],
      [10, 10],
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  claw(ctx, claw) {
    const z = claw.z;
    const scale = 0.76 + z * 0.42;
    this.shadow(ctx, claw.x, claw.y, 22, z);

    ctx.save();
    ctx.translate(claw.x, claw.y);
    ctx.scale(scale, scale);

    ctx.strokeStyle = "rgba(255, 227, 106, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8 + claw.open * 20, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * ((Math.PI * 2) / 3);
      ctx.save();
      ctx.rotate(a);
      const reach = 12 + claw.open * 16;
      ctx.translate(0, reach);
      ctx.rotate((0.5 - claw.open) * 0.7);

      const fg = ctx.createLinearGradient(-8, -6, 8, 26);
      fg.addColorStop(0, "#fff7fb");
      fg.addColorStop(0.5, "#f0c4e4");
      fg.addColorStop(1, "#d47aaa");
      ctx.fillStyle = fg;
      ctx.strokeStyle = "#8a2a64";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(7, -4);
      ctx.lineTo(5, 24);
      ctx.quadraticCurveTo(0, 30, -5, 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ff8ab8";
      ctx.beginPath();
      ctx.ellipse(0, 20, 4.2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const hub = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
    hub.addColorStop(0, "#fff");
    hub.addColorStop(1, "#cbb6ff");
    ctx.fillStyle = hub;
    ctx.strokeStyle = "#6a349c";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#63f0c8";
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  plush(ctx, p) {
    const x = p.x;
    const y = p.y;
    const r = p.radius;
    const lift = p.liftZ || 0;
    const blink = p.blink == null ? 1 : p.blink;
    const scale = 1 + lift * 0.34;
    const ang = p.angle || 0;
    const type = p.type;

    this.shadow(ctx, x, y, r, lift);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale * (1 + (p.squashX || 0)), scale * (1 + (p.squashY || 0)));

    const spec = PLUSH_TYPES[type];
    const c = spec.color;

    if (type === "bear") this.bear(ctx, r, c, blink);
    else if (type === "bunny") this.bunny(ctx, r, c, blink);
    else if (type === "cat") this.cat(ctx, r, c, blink);
    else if (type === "chick") this.chick(ctx, r, c, blink);
    else if (type === "frog") this.frog(ctx, r, c, blink);
    else if (type === "penguin") this.penguin(ctx, r, c, blink);
    else if (type === "pig") this.pig(ctx, r, c, blink);
    else if (type === "puppy") this.puppy(ctx, r, c, blink);
    else if (type === "panda") this.panda(ctx, r, blink);
    else if (type === "berry") this.berry(ctx, r, c, blink);
    else if (type === "unicorn") this.unicorn(ctx, r, c, blink);
    else if (type === "star") this.starPlush(ctx, r, c, blink);
    else this.felt(ctx, 0, 2, r * 0.92, r * 0.86, c);

    ctx.restore();
  },

  bear(ctx, r, c, blink) {
    this.felt(ctx, -r * 0.62, -r * 0.55, r * 0.32, r * 0.3, c);
    this.felt(ctx, r * 0.62, -r * 0.55, r * 0.32, r * 0.3, c);
    this.felt(ctx, -r * 0.62, -r * 0.55, r * 0.16, r * 0.15, "#ffd0dc");
    this.felt(ctx, r * 0.62, -r * 0.55, r * 0.16, r * 0.15, "#ffd0dc");
    this.felt(ctx, 0, r * 0.18, r * 0.78, r * 0.7, c);
    this.felt(ctx, 0, -r * 0.08, r * 0.86, r * 0.78, c);
    this.felt(ctx, 0, r * 0.12, r * 0.32, r * 0.24, "#ffe0e8");
    this.face(ctx, 0, -r * 0.06, r * 0.72, blink);
  },

  bunny(ctx, r, c, blink) {
    this.felt(ctx, -r * 0.38, -r * 0.95, r * 0.22, r * 0.52, c);
    this.felt(ctx, r * 0.38, -r * 0.95, r * 0.22, r * 0.52, c);
    this.felt(ctx, -r * 0.38, -r * 0.92, r * 0.1, r * 0.34, "#ffc3d4");
    this.felt(ctx, r * 0.38, -r * 0.92, r * 0.1, r * 0.34, "#ffc3d4");
    this.felt(ctx, 0, r * 0.22, r * 0.72, r * 0.64, c);
    this.felt(ctx, 0, -r * 0.1, r * 0.8, r * 0.72, c);
    this.face(ctx, 0, -r * 0.06, r * 0.68, blink);
  },

  cat(ctx, r, c, blink) {
    ctx.fillStyle = this.dark(c, 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.1);
    ctx.lineTo(-r * 0.55, -r * 0.95);
    ctx.lineTo(-r * 0.15, -r * 0.35);
    ctx.moveTo(r * 0.7, -r * 0.1);
    ctx.lineTo(r * 0.55, -r * 0.95);
    ctx.lineTo(r * 0.15, -r * 0.35);
    ctx.fill();
    this.felt(ctx, 0, r * 0.2, r * 0.74, r * 0.66, c);
    this.felt(ctx, 0, -r * 0.08, r * 0.82, r * 0.72, c);
    ctx.strokeStyle = this.dark(c, 0.25);
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, r * 0.02);
      ctx.lineTo(s * r * 0.72, -r * 0.06);
      ctx.moveTo(s * r * 0.22, r * 0.12);
      ctx.lineTo(s * r * 0.7, r * 0.16);
      ctx.stroke();
    }
    this.face(ctx, 0, -r * 0.04, r * 0.66, blink);
  },

  chick(ctx, r, c, blink) {
    this.felt(ctx, 0, r * 0.18, r * 0.78, r * 0.68, c);
    this.felt(ctx, 0, -r * 0.06, r * 0.8, r * 0.72, c);
    ctx.fillStyle = "#ff9a3c";
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.04);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(r * 0.1, r * 0.04);
    ctx.closePath();
    ctx.fill();
    this.felt(ctx, -r * 0.62, r * 0.1, r * 0.22, r * 0.16, this.light(c, 0.1));
    this.felt(ctx, r * 0.62, r * 0.1, r * 0.22, r * 0.16, this.light(c, 0.1));
    this.face(ctx, 0, -r * 0.12, r * 0.62, blink);
  },

  frog(ctx, r, c, blink) {
    this.felt(ctx, 0, r * 0.12, r * 0.88, r * 0.7, c);
    this.felt(ctx, -r * 0.42, -r * 0.42, r * 0.28, r * 0.26, c);
    this.felt(ctx, r * 0.42, -r * 0.42, r * 0.28, r * 0.26, c);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-r * 0.42, -r * 0.42, r * 0.16, 0, Math.PI * 2);
    ctx.arc(r * 0.42, -r * 0.42, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a123d";
    const o = 0.1 + blink * 0.9;
    ctx.beginPath();
    ctx.ellipse(-r * 0.42, -r * 0.42, r * 0.07, r * 0.09 * o, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.42, -r * 0.42, r * 0.07, r * 0.09 * o, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd56a";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.16, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a123d";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.18, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },

  penguin(ctx, r, c, blink) {
    this.felt(ctx, 0, 0, r * 0.78, r * 0.92, "#3d4d6a");
    this.felt(ctx, 0, r * 0.12, r * 0.48, r * 0.62, "#fff8f0");
    this.felt(ctx, -r * 0.7, r * 0.05, r * 0.2, r * 0.32, c);
    this.felt(ctx, r * 0.7, r * 0.05, r * 0.2, r * 0.32, c);
    ctx.fillStyle = "#ff9a3c";
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.02);
    ctx.lineTo(0, r * 0.16);
    ctx.lineTo(r * 0.12, -r * 0.02);
    ctx.closePath();
    ctx.fill();
    this.face(ctx, 0, -r * 0.22, r * 0.55, blink);
  },

  pig(ctx, r, c, blink) {
    this.felt(ctx, -r * 0.7, -r * 0.35, r * 0.28, r * 0.22, c);
    this.felt(ctx, r * 0.7, -r * 0.35, r * 0.28, r * 0.22, c);
    this.felt(ctx, 0, r * 0.1, r * 0.86, r * 0.76, c);
    this.felt(ctx, 0, r * 0.18, r * 0.32, r * 0.22, "#ff8aa8");
    ctx.fillStyle = "#ff6d90";
    ctx.beginPath();
    ctx.arc(-r * 0.1, r * 0.18, r * 0.06, 0, Math.PI * 2);
    ctx.arc(r * 0.1, r * 0.18, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    this.face(ctx, 0, -r * 0.14, r * 0.62, blink);
  },

  puppy(ctx, r, c, blink) {
    this.felt(ctx, -r * 0.78, -r * 0.1, r * 0.32, r * 0.42, this.dark(c, 0.08));
    this.felt(ctx, r * 0.78, -r * 0.05, r * 0.28, r * 0.38, c);
    this.felt(ctx, 0, r * 0.16, r * 0.8, r * 0.7, c);
    this.felt(ctx, 0, -r * 0.06, r * 0.84, r * 0.74, c);
    this.felt(ctx, r * 0.28, r * 0.08, r * 0.22, r * 0.2, "#c47a3a");
    this.face(ctx, 0, -r * 0.06, r * 0.66, blink);
  },

  panda(ctx, r, blink) {
    this.felt(ctx, -r * 0.62, -r * 0.58, r * 0.3, r * 0.28, "#2a123d");
    this.felt(ctx, r * 0.62, -r * 0.58, r * 0.3, r * 0.28, "#2a123d");
    this.felt(ctx, 0, r * 0.16, r * 0.8, r * 0.7, "#f6f1ea");
    this.felt(ctx, 0, -r * 0.06, r * 0.86, r * 0.76, "#f6f1ea");
    ctx.fillStyle = "#2a123d";
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.08, r * 0.2, r * 0.16, -0.4, 0, Math.PI * 2);
    ctx.ellipse(r * 0.28, -r * 0.08, r * 0.2, r * 0.16, 0.4, 0, Math.PI * 2);
    ctx.fill();
    this.face(ctx, 0, -r * 0.02, r * 0.7, blink);
  },

  berry(ctx, r, c, blink) {
    this.felt(ctx, 0, r * 0.1, r * 0.78, r * 0.82, c);
    ctx.fillStyle = "#ffe36a";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const rr = r * (0.28 + (i % 3) * 0.12);
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr + r * 0.08, 2.1, 3.1, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#63d98a";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.95, -r * 0.55, -r * 0.55);
    ctx.quadraticCurveTo(0, -r * 0.7, 0, -r * 0.4);
    ctx.quadraticCurveTo(0, -r * 0.7, r * 0.55, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.95, 0, -r * 0.85);
    ctx.fill();
    this.face(ctx, 0, r * 0.08, r * 0.58, blink);
  },

  unicorn(ctx, r, c, blink) {
    ctx.fillStyle = "#ffe36a";
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.18);
    ctx.lineTo(-r * 0.12, -r * 0.45);
    ctx.lineTo(r * 0.12, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e0b000";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    this.felt(ctx, r * 0.55, -r * 0.15, r * 0.22, r * 0.42, "#ff9ad8");
    this.felt(ctx, r * 0.72, r * 0.05, r * 0.18, r * 0.34, "#cbb6ff");
    this.felt(ctx, 0, r * 0.18, r * 0.76, r * 0.68, c);
    this.felt(ctx, 0, -r * 0.08, r * 0.82, r * 0.72, c);
    this.face(ctx, 0, -r * 0.04, r * 0.64, blink);
  },

  starPlush(ctx, r, c, blink) {
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 4, 0, 0, r);
    g.addColorStop(0, this.light(c, 0.3));
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.strokeStyle = this.dark(c, 0.28);
    ctx.lineWidth = 2.2;
    this.star(ctx, 0, 0, r * 1.05, 5, 0.5);
    ctx.fill();
    ctx.stroke();
    this.face(ctx, 0, r * 0.06, r * 0.58, blink);
  },
};
