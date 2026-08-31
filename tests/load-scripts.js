const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");

function el(id) {
  const node = {
    id,
    style: { setProperty() {}, transform: "" },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: "",
    textContent: "",
    hidden: false,
    width: 840,
    height: 1000,
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    setAttribute() {},
    getBoundingClientRect() { return { width: 420, height: 500, left: 0, top: 0 }; },
    getContext() {
      const noop = () => {};
      return new Proxy({
        canvas: { width: 840, height: 1000 },
        setTransform: noop,
        clearRect: noop,
        fillRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        arc: noop,
        ellipse: noop,
        fill: noop,
        stroke: noop,
        save: noop,
        restore: noop,
        translate: noop,
        rotate: noop,
        scale: noop,
        createLinearGradient() { return { addColorStop: noop }; },
        createRadialGradient() { return { addColorStop: noop }; },
        quadraticCurveTo: noop,
        bezierCurveTo: noop,
        setLineDash: noop,
        roundRect: noop,
      }, { get: (t, k) => (k in t ? t[k] : noop) });
    },
  };
  return node;
}

const created = {};
const sandbox = {
  console,
  URLSearchParams,
  location: { search: "" },
  navigator: { vibrate() {} },
  performance: { now: () => 0 },
  requestAnimationFrame(cb) { return 0; },
  AudioContext: function AudioContext() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    this.resume = () => {};
    this.createGain = () => ({ connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
    this.createOscillator = () => ({
      type: "sine",
      connect() {},
      start() {},
      stop() {},
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    });
    this.createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
    this.createBufferSource = () => ({ buffer: null, connect() {}, start() {}, stop() {} });
    this.createBiquadFilter = () => ({ type: "lowpass", connect() {}, frequency: { value: 0 } });
  },
  document: {
    getElementById(id) {
      if (!created[id]) created[id] = el(id);
      return created[id];
    },
    createElement() { return el("el"); },
    body: { addEventListener() {} },
    addEventListener() {},
  },
  window: null,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.dispatchEvent = () => {};
sandbox.devicePixelRatio = 1;

const files = [
  "vendor/matter.min.js",
  "js/config.js",
  "js/save.js",
  "js/fun.js",
  "js/grip.js",
  "js/audio.js",
  "js/particles.js",
  "js/draw.js",
  "js/input.js",
  "js/game.js",
];

for (const rel of files) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  try {
    vm.runInNewContext(code, sandbox, { filename: rel });
    console.log("loaded", rel);
  } catch (err) {
    console.error("THROW", rel, err.message);
    process.exit(1);
  }
}

const kinds = vm.runInNewContext(
  `({
    Grip: typeof Grip,
    Draw: typeof Draw,
    Input: typeof Input,
    AudioFx: typeof AudioFx,
    Particles: typeof Particles,
    Fun: typeof Fun,
    crane: typeof window.__crane
  })`,
  sandbox,
);
const need = ["Grip", "Draw", "Input", "AudioFx", "Particles", "Fun"];
for (const name of need) {
  if (kinds[name] !== "object") {
    console.error("missing", name, kinds[name]);
    process.exit(1);
  }
  console.log("global", name, kinds[name]);
}
if (kinds.crane !== "object") {
  console.error("missing window.__crane");
  process.exit(1);
}
console.log("window.__crane", Object.keys(sandbox.window.__crane).join(","));
console.log("load-scripts ok");
