const Grip = {
  coverage(dist, radius) {
    return Math.max(0, Math.min(1, (16 + radius * 0.55 - dist) / (radius * 0.95)));
  },

  winChance({ coverage, crowded, radius, points }) {
    const power = typeof CLAW_POWER === "number" ? CLAW_POWER : 0.42;
    let p = 0.05 + coverage * (0.18 + power * 0.2);
    if (crowded) p *= 0.48;
    if (radius >= 26) p *= 0.82;
    if (points >= 250) p *= 0.75;
    return Math.max(0.03, Math.min(0.34, p));
  },

  roll(opts, rng = Math.random) {
    const coverage = opts.coverage;
    const pWin = this.winChance(opts);
    const r = rng();

    if (coverage < 0.22) {
      return {
        kind: "miss",
        slipAt: 0,
        wobble: 0,
        fingerGap: 0,
        stiffness: 0,
        stretch: 0,
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
      };
    }
    if (r < pWin + 0.17) {
      return {
        kind: "late",
        slipAt: 0.56 + rng() * 0.3,
        wobble: 1.7,
        fingerGap: 0.16,
        stiffness: 0.012,
        stretch: 16,
      };
    }
    if (r < pWin + 0.6) {
      return {
        kind: "mid",
        slipAt: 0.16 + rng() * 0.32,
        wobble: 2.5,
        fingerGap: 0.26,
        stiffness: 0.006,
        stretch: 12,
      };
    }
    return {
      kind: "dead",
      slipAt: 0.04 + rng() * 0.1,
      wobble: 3,
      fingerGap: 0.34,
      stiffness: 0.003,
      stretch: 8,
    };
  },
};

if (typeof module !== "undefined") module.exports = Grip;
