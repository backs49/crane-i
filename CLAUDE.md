# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

몰랑크레인 (Midnight Candy Catcher) — a top-down 2D claw machine game. Vanilla JS + Canvas 2D + Matter.js (vendored at `vendor/matter.min.js`). UI text is Korean.

## Running

No build step, no package.json, no lint, no tests. Serve the directory statically and open it:

```
python3 -m http.server 8000   # then open http://localhost:8000
```

- Append `?debug` to the URL to overlay Matter.js body wireframes.
- `window.__crane` is a console/automation hook: `snapshot()` (mode, coins, score, plush positions, claw, last grip result), `start()`, `aim(x, y)`, `grab()`, `end()`. Use it to drive the game programmatically when verifying changes in a browser.
- `js/grip.js` is the only Node-loadable module (`module.exports` guard), so grip probability logic can be tested/tuned with plain `node -e "..."` without a browser.

## Architecture

Plain `<script>` tags sharing globals — no modules, no bundler. Load order in `index.html` matters: `vendor/matter.min.js` → `config.js` (constants) → `grip.js` → `audio.js` → `particles.js` → `draw.js` → `input.js` → `game.js`. Each file defines one global (`Grip`, `AudioFx`, `Particles`, `Draw`, `Input`); `game.js` is an IIFE that owns all state and the loop.

- **`config.js`** — all tuning constants: world size (420×500 logical units), collision categories (`CAT`), chute/home positions, `CLAW_SPEED`/`CLAW_POWER`, `PLUSH_TYPES` (points/radius/mass/color/rarity), and `SPAWN_BAG` (the exact multiset of plushes each box fill spawns).
- **`game.js`** — state machine in `state.mode`: `title → aiming → descending → closing → ascending → returning → releasing → (aiming | gameover)`. `update()` branches on mode; `setMode()` updates the HUD labels.
- **Physics model**: the Matter.js world is top-down with zero gravity; the claw's height (`claw.z`, 0–1) is *not* physical — it's animated manually and drawn as scale/shadow by `draw.js`. Claw bodies are repositioned every frame in `syncClawBodies()` (kinematic, not force-driven), and their collision mask only turns on near the floor during closing/ascending/returning. Airborne plushes swap collision masks via `setAirborne()`/`setFloor()`.
- **Grab outcomes are RNG, not emergent physics** — this is a deliberate design choice: the claw is intentionally weak and slippery. `Grip.coverage()` scores how centered the claw is over a plush; `Grip.roll()` decides the outcome kind at grab time (`hold`/`late`/`mid`/`dead`/`miss`), each with a predetermined `slipAt` progress point, constraint stiffness, and wobble. `updateCarry()` in `game.js` then plays that outcome out (drops the plush when carry progress passes `slipAt`, or if the constraint stretches/bumps). Win probability is capped at 0.34 in `Grip.winChance()` — preserve the "rigged crane" feel when tuning.
- **Rendering** is entirely custom Canvas 2D in `draw.js` (plushes, gantry, claw, field). World coordinates (420×500) are scaled to the canvas in `worldTransform()`; devicePixelRatio is capped at 2. Plushes are drawn in two y-sorted passes (floor, then airborne above the gantry).
- **`audio.js`** synthesizes all SFX/BGM with the Web Audio API (no audio assets); the context unlocks on first pointerdown.
