const Grip = {
  PITY_AT: 4,

  coverage(dist, radius) {
    return Math.max(0, Math.min(1, (16 + radius * 0.55 - dist) / (radius * 0.95)));
  },

  _world() {
    return {
      w: typeof WORLD !== "undefined" ? WORLD.w : 420,
      chute: typeof CHUTE !== "undefined" ? CHUTE : { x: 210, y: 452 },
    };
  },

  chuteProximity(x, y) {
    const { chute } = this._world();
    const toChute = Math.hypot(x - chute.x, (y - chute.y) * 0.9);
    return Math.max(0, Math.min(1, 1 - (toChute - 40) / 180));
  },

  locationFactor(x, y) {
    const { chute } = this._world();
    const toChute = Math.hypot(x - chute.x, (y - chute.y) * 0.9);
    const away = Math.max(0, Math.min(1, (toChute - 50) / 130));
    return 0.55 + away * 0.5;
  },

  winChance({ coverage, crowded, radius, points, x, y, bonus } = {}) {
    const power = typeof CLAW_POWER === "number" ? CLAW_POWER : 0.42;
    let p = 0.05 + coverage * (0.18 + power * 0.2);
    if (crowded) p *= 0.48;
    if (radius >= 26) p *= 0.82;
    if (points >= 250) p *= 0.75;
    if (x != null && y != null) p *= this.locationFactor(x, y);
    if (bonus) p += bonus;
    return Math.max(0.03, Math.min(0.36, p));
  },

  roll(opts, rng = Math.random) {
    const coverage = opts.coverage;
    const pWin = this.winChance(opts);
    const r = rng();
    const loc = opts.x != null ? this.locationFactor(opts.x, opts.y) : 1;
    const prox = opts.x != null ? this.chuteProximity(opts.x, opts.y) : 0;

    let lateBand = 0.17;
    let midBand = 0.43;
    if (prox > 0.55) {
      lateBand = 0.28;
      midBand = 0.34;
    }

    if (coverage < 0.22) {
      return {
        kind: "miss",
        slipAt: 0,
        wobble: 0,
        fingerGap: 0,
        stiffness: 0,
        stretch: 0,
        location: loc,
      };
    }

    if ((opts.pity || 0) >= this.PITY_AT && coverage >= 0.3) {
      return {
        kind: "hold",
        pity: true,
        slipAt: 1.2,
        wobble: 0.55,
        fingerGap: 0.05,
        stiffness: 0.028,
        stretch: 26,
        location: loc,
      };
    }

    if (r < pWin) {
      return {
        kind: "hold",
        slipAt: 1.2,
        wobble: 0.55,
        fingerGap: 0.05,
        stiffness: 0.028,
        stretch: 26,
        location: loc,
      };
    }
    if (r < pWin + lateBand) {
      return {
        kind: "late",
        slipAt: 0.56 + rng() * 0.3,
        wobble: 1.7,
        fingerGap: 0.16,
        stiffness: 0.012,
        stretch: 16,
        location: loc,
      };
    }
    if (r < pWin + lateBand + midBand) {
      return {
        kind: "mid",
        slipAt: 0.16 + rng() * 0.32,
        wobble: 2.5,
        fingerGap: 0.26,
        stiffness: 0.006,
        stretch: 12,
        location: loc,
      };
    }
    return {
      kind: "dead",
      slipAt: 0.04 + rng() * 0.1,
      wobble: 3,
      fingerGap: 0.34,
      stiffness: 0.003,
      stretch: 8,
      location: loc,
    };
  },
};

if (typeof module !== "undefined") module.exports = Grip;
