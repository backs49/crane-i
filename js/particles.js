const Particles = {
  list: [],

  emit(x, y, kind, count) {
    const palette =
      kind === "win"
        ? ["#ff79c7", "#63f0c8", "#ffe36a", "#cbb6ff", "#fff7fb"]
        : kind === "slip"
          ? ["#c9b6c4", "#8a709c", "#ffeaf4"]
          : ["#ffe36a", "#ff79c7", "#fff7fb"];

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = kind === "win" ? 70 + Math.random() * 160 : 40 + Math.random() * 90;
      const shapes = kind === "win" ? ["star", "heart", "circle", "petal"] : ["circle", "puff"];
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (kind === "win" ? 40 : 10),
        life: 0,
        max: 0.55 + Math.random() * 0.55,
        size: 3 + Math.random() * 6,
        color: palette[i % palette.length],
        shape: shapes[i % shapes.length],
        spin: Math.random() * Math.PI * 2,
        spinV: (Math.random() - 0.5) * 8,
      });
    }
  },

  sparkle(x, y) {
    this.list.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: 0,
      vy: -12,
      life: 0,
      max: 0.7,
      size: 2 + Math.random() * 2,
      color: "#fff7fb",
      shape: "circle",
      spin: 0,
      spinV: 0,
    });
  },

  update(dt) {
    for (const p of this.list) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.spin += p.spinV * dt;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  },

  draw(ctx) {
    for (const p of this.list) {
      const t = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      if (p.shape === "star") {
        Draw.star(ctx, 0, 0, p.size, 5, 0.45);
        ctx.fill();
      } else if (p.shape === "heart") {
        Draw.heart(ctx, 0, 0, p.size);
        ctx.fill();
      } else if (p.shape === "petal") {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.45, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (p.shape === "puff" ? 1.3 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },
};
