// 홍보 영상 렌더러: promo/index.html?render 를 Playwright로 열어 프레임마다 PNG를 뽑아
// ffmpeg로 MP4(1080x1920, 720x1280), GIF 미리보기, 포스터 PNG를 만든다.
//   node tools/render-promo.mjs            (먼저 python3 -m http.server 8765 로 저장소를 띄운다)
//   GAME_URL=http://127.0.0.1:8765/ node tools/render-promo.mjs
// 옵션: FRAMES=90 (앞쪽 일부만), START=300 (시작 프레임) — 빠른 확인용
// 가로형(1920x1080, 유튜브·플레이 스토어): FORMAT=landscape node tools/render-promo.mjs
//   또는 node tools/render-promo.mjs landscape (--format=landscape 도 된다)
//   → molang-promo-landscape.mp4, molang-promo-landscape-720.mp4(1280x720), poster-landscape.png
//   소리는 세로형 molang-promo-720.mp4의 AAC를 그대로 복사한다 (없으면 molang-promo.wav, 그것도 없으면 새로 만든다).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, statSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "promo", "out");
const BASE = (process.env.GAME_URL || "http://127.0.0.1:8765/").replace(/\/?$/, "/");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const argFormat = process.argv.slice(2).map((a) => a.replace(/^--format=/, "")).find((a) => /^(vertical|landscape)$/.test(a));
const FORMAT = (argFormat || process.env.FORMAT || "vertical").toLowerCase();
if (!["vertical", "landscape"].includes(FORMAT)) throw new Error(`FORMAT must be vertical or landscape, got ${FORMAT}`);
const LAND = FORMAT === "landscape";
const SUFFIX = LAND ? "-landscape" : "";

function run(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: [input ? "pipe" : "ignore", "inherit", "inherit"] });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${args.join(" ")}`))));
    if (input) input(p.stdin);
  });
}

function writeAsync(stream, buf) {
  return new Promise((resolve) => {
    if (stream.write(buf)) resolve();
    else stream.once("drain", resolve);
  });
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: LAND ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("[page error]", e.message));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.error("[page]", m.text());
});
await page.goto(`${BASE}promo/index.html?render${LAND ? "&format=landscape" : ""}`, { waitUntil: "load" });
await page.waitForFunction(() => window.PROMO && typeof window.PROMO.renderFrame === "function");
await page.evaluate(async () => {
  await window.PROMO.ready();
  await document.fonts.ready;
});
const info = await page.evaluate(() => ({ w: PROMO.width, h: PROMO.height, fps: PROMO.fps, dur: PROMO.duration, frames: PROMO.frames }));
console.log(`promo ${info.w}x${info.h} @${info.fps}fps, ${info.dur}s (${info.frames} frames)`);

const start = Number(process.env.START || 0);
const count = Math.min(info.frames - start, Number(process.env.FRAMES || info.frames));
const partial = start !== 0 || count !== info.frames;

// 소리 (일부만 뽑는 확인용 렌더에서는 건너뛴다 — 전체 렌더 결과물을 덮어쓰지 않게)
const wavPath = join(OUT, "molang-promo.wav");
// 가로형은 세로형 720p MP4에 이미 들어 있는 AAC 소리를 그대로 복사한다 (비트 단위로 같은 소리).
// 그 파일이 없을 때만 molang-promo.wav를 쓰고, wav도 없으면 새로 만든다.
const vertAudio = join(OUT, "molang-promo-720.mp4");
const copyAudio = LAND && !partial && existsSync(vertAudio);
if (!partial && !copyAudio && !(LAND && existsSync(wavPath))) {
  const audio = await page.evaluate(async () => {
    const r = await PROMO.renderAudio();
    return r;
  });
  const rawWav = join(OUT, "molang-promo-raw.wav");
  writeFileSync(rawWav, Buffer.from(audio.base64, "base64"));
  // 숏폼 플랫폼 기준에 가깝게: 약 -16 LUFS, true peak -3.5 dBFS (AAC 인코딩 뒤에도 -2 dBFS 아래)
  await run(["-i", rawWav, "-af", "loudnorm=I=-16:TP=-3.5:LRA=7,aresample=44100", "-c:a", "pcm_s16le", wavPath]);
  unlinkSync(rawWav);
  console.log(`audio: raw peak ${audio.peak.toFixed(3)} → tanh soft limit → loudnorm -16 LUFS / TP -3.5 dBFS`);
}
if (LAND && !partial) console.log(copyAudio ? "audio: copying the AAC track of molang-promo-720.mp4 (same bits as the vertical cut)" : "audio: reusing molang-promo.wav");
const mp4 = join(OUT, `molang-promo${SUFFIX}${partial ? "-partial" : ""}.mp4`);

async function grab(t) {
  const b64 = await page.evaluate((tt) => {
    PROMO.renderFrame(tt);
    return document.getElementById("promo").toDataURL("image/png").slice(22);
  }, t);
  return Buffer.from(b64, "base64");
}

const t0 = Date.now();
const vArgs = ["-f", "image2pipe", "-framerate", String(info.fps), "-c:v", "png", "-i", "-"];
const aArgs = partial ? [] : ["-i", copyAudio ? vertAudio : wavPath];
const enc = [
  "-map", "0:v",
  ...(partial ? [] : copyAudio ? ["-map", "1:a", "-c:a", "copy"] : ["-map", "1:a", "-c:a", "aac", "-b:a", "160k", "-ar", "44100"]),
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(info.fps),
  "-movflags", "+faststart", "-t", String(count / info.fps),
  mp4,
];
await run([...vArgs, ...aArgs, ...enc], {
  input: async (stdin) => {
    for (let i = 0; i < count; i++) {
      const f = start + i;
      const png = await grab(f / info.fps);
      await writeAsync(stdin, png);
      if (i % 60 === 0) console.log(`frame ${f}/${info.frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    stdin.end();
  },
});
console.log(`wrote ${mp4}`);

// 포스터: 엔드 카드 마지막 정지 화면 (정지 구간 시작 = 마지막 프레임과 같은 그림)
if (!partial) {
  const holdT = await page.evaluate(() => PROMO.holdT);
  writeFileSync(join(OUT, `poster${SUFFIX}.png`), await grab(holdT));
}
await browser.close();

if (!partial && LAND) {
  await run(["-i", mp4, "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", join(OUT, "molang-promo-landscape-720.mp4")]);
  for (const f of ["molang-promo-landscape.mp4", "molang-promo-landscape-720.mp4", "poster-landscape.png"]) {
    console.log(`${f}: ${(statSync(join(OUT, f)).size / 1e6).toFixed(2)} MB`);
  }
} else if (!partial) {
  await run(["-i", mp4, "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", join(OUT, "molang-promo-720.mp4")]);
  const gif = join(OUT, "molang-promo.gif");
  const vf =
    "fps=12,scale=360:640:flags=lanczos,fade=t=out:st=21.5:d=0.5:color=0x1a0b2c,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  await run(["-i", mp4, "-filter_complex", vf, "-loop", "0", gif]);
  for (const f of ["molang-promo.mp4", "molang-promo-720.mp4", "molang-promo.gif", "poster.png", "molang-promo.wav"]) {
    console.log(`${f}: ${(statSync(join(OUT, f)).size / 1e6).toFixed(2)} MB`);
  }
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
