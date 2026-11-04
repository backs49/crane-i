# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

몰랑크레인 (Midnight Candy Catcher) — a top-down 2D claw machine game. Vanilla JS + Canvas 2D + Matter.js (vendored at `vendor/matter.min.js`). UI text is Korean.

## Running

No build step, no package.json, no lint. Serve the directory statically and open it:

```
python3 -m http.server 8000   # then open http://localhost:8000
```

- Append `?debug` to the URL to overlay Matter.js body wireframes.
- `window.__crane` is a console/automation hook: `snapshot()` (mode, coins, score, plush positions, claw, last grip result), `start()`, `aim(x, y)`, `grab()`, `end()`. Use it to drive the game programmatically when verifying changes in a browser.
- `js/grip.js`, `js/fun.js`, `js/save.js`, `js/room.js`, `js/village.js`, `js/myplush.js`, and `js/i18n.js` are Node-loadable (`module.exports` guard), so their logic can be tested/tuned without a browser — see `tests/fun.test.js`, `tests/save.test.js`, `tests/room.test.js`, `tests/village.test.js`, `tests/myplush.test.js`, and `tests/load-scripts.js` (run with plain `node`).

## Architecture

Plain `<script>` tags sharing globals — no modules, no bundler. Load order in `index.html` matters: `vendor/matter.min.js` → `config.js` (constants) → `i18n.js` → `lang/ko.js` → `myplush.js` → `save.js` → `fun.js` → `grip.js` → `share.js` → `room.js` → `village.js` → `audio.js` → `particles.js` → `draw.js` → `input.js` → `game.js`. Each file defines one global (`I18N`, `MyPlush`, `Save`, `Fun`, `Grip`, `Share`, `Room`, `Village`, `AudioFx`, `Particles`, `Draw`, `Input`); `game.js` is an IIFE that owns all state and the loop.

- **`config.js`** — all tuning constants: world size (420×500 logical units), collision categories (`CAT`), chute/home positions, `CLAW_SPEED`/`CLAW_POWER`, `PLUSH_TYPES` (points/radius/mass/color/rarity), and `SPAWN_BAG` (the exact multiset of plushes each box fill spawns).
- **`game.js`** — state machine in `state.mode`: `title → aiming → descending → closing → ascending → returning → releasing → (aiming | gameover)`. `update()` branches on mode; `setMode()` updates the HUD labels.
- **Physics model**: the Matter.js world is top-down with zero gravity; the claw's height (`claw.z`, 0–1) is *not* physical — it's animated manually and drawn as scale/shadow by `draw.js`. Claw bodies are repositioned every frame in `syncClawBodies()` (kinematic, not force-driven), and their collision mask only turns on near the floor during closing/ascending/returning. Airborne plushes swap collision masks via `setAirborne()`/`setFloor()`.
- **Grab outcomes are RNG, not emergent physics** — this is a deliberate design choice: the claw is intentionally weak and slippery. `Grip.coverage()` scores how centered the claw is over a plush; `Grip.locationFactor(x, y)` only weakens the claw near the prize chute (the real-machine "kill zone"). The rest of the box stays near the baseline rate so typical pile grabs stay kid-friendly. Near the chute, `Grip.roll()` also biases toward late slips. `updateCarry()` plays the rolled outcome out. Win probability is capped at 0.36 — except after four consecutive slips, when the pity floor (`Grip.PITY_AT`) guarantees a hold.
- **Rendering** is entirely custom Canvas 2D in `draw.js` (plushes, gantry, claw, field). World coordinates (420×500) are scaled to the canvas in `worldTransform()`; devicePixelRatio is capped at 2. Plushes are drawn in two y-sorted passes (floor, then airborne above the gantry).
- **`audio.js`** synthesizes all SFX/BGM with the Web Audio API (no audio assets); the context unlocks on first pointerdown.
- **Kid mode** (`KID` in `config.js`, on by default, saved as `kidMode`): pity after two slips, no chute weakening or late-slip bias, stronger reward for centered aims, one-tap grab (auto-close), gentler game-over copy. Anything that leaves the app (share card, challenge link, room photo) goes through `parentGate()` in kid mode.
- **Tutorial & play time** (kid mode helpers): a finger animation (`#tutorial`) shows the joystick drag and grab tap until the first grab (`save.tutorialDone`). Daily play time is tracked in `save.daily.playSec`; in kid mode, once `save.playLimit` minutes (default 30, 0 = off, set behind the parent gate) plus any parent-granted extra time run out, a break popup blocks new grabs for the rest of the day.
- **My plush room** (`js/room.js`): every caught type lives in a room overlay where kids pet (hearts every 5 pets), drag, rename, and photograph plushes; state is saved under `save.room`.
- **Strings** (`js/i18n.js` + `js/lang/<lang>.js`): new UI text and all village dialogue live in per-language tables read with `I18N.t(key, vars)` / `I18N.pick(...)`; `{name|이야/야}` picks the Korean particle by final consonant. Older UI strings are still inline and should move into the table before adding English/Japanese.
- **Molang village** (`js/village.js`, opened from the room): caught plushes wander a small town (flowers, pond, slide; sky follows the device clock). Tapping one shows a greeting chosen by personality, friendship hearts, time of day, and today's mission; the three icon choices (hello/snack/play) give a reply and +1 friendship (shared with room `pets`). Dialogue is prewritten — no server, AI, or chat between players. Play modes: hide-and-seek (a friend hides behind the tree, a bush, or the slide; the spot rustles after two wrong guesses) and picnic (friends sit around a mat; each personality has a favorite snack worth +2 friendship, max 3 snacks per friend). Tapping the ground walks the kid's own plush there along a grid path (`Village.findPath`).
- **My plush** (`js/myplush.js`, `save.myPlush`): kids build their own attachment plush from parts (one of 20 animals in `MyPlush.ANIMALS`, each drawn by `MyPlush.PARTS`, plus color, eyes, cheeks, accessory, personality, name; old saves with `ears` migrate to an animal) — no camera or photos. It is plush type `mine` (rarity `mine`, excluded from dex completion and missions): it lives in the room/village from creation, joins each box fill with `MINE.chance`, and is marked with a heart ring in the machine (`mineMark`). `MyPlush.spec` holds the current design for `Draw.plush`.
- **Persistence**: `js/save.js` stores best score, dex counts, daily state (including play time), kid mode, play limit, tutorial flag, and room state in `localStorage`.
- **Android app** (`app/`): a Capacitor 8 wrapper that bundles the game files (`npm run sync` copies them into `app/www`, then into the Android project). Inside the app (`window.Capacitor`), the service worker is skipped, sharing goes through the Share/Filesystem plugins (`Share.native()`), and challenge links use `SITE_URL`. Build the AAB on a PC with Android Studio — see `docs/release/android.md`. Store listing text and graphics live in `store/` (`tools/store-assets.mjs` regenerates them; `tools/make-icons.mjs` draws the icons from the game's own bear art, never emoji).
- **Service worker**: `sw.js` precaches the shell for offline play — bump its `CACHE` version whenever game files change.
