import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const outDir = process.env.SCRATCH || process.cwd();
const url = process.env.GAME_URL || "http://127.0.0.1:8765/";
const shot = path.join(outDir, "chrome-play.png");
const logPath = path.join(outDir, "chrome-console.log");

let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  ({ chromium } = require("playwright"));
}

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const errors = [];
const logs = [];
const browser = await chromium.launch({
  executablePath: fs.existsSync(chrome) ? chrome : undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1100, height: 920 } });
page.on("pageerror", (e) => {
  errors.push(String(e));
  logs.push("PAGEERROR " + String(e));
});
page.on("console", (m) => {
  if (m.type() === "error") logs.push("CONSOLE " + m.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(400);

const startBtn = page.getByRole("button", { name: "코인 넣기" });
await startBtn.click();
await page.waitForTimeout(350);

const fill = await page.evaluate(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let lit = 0;
  for (let i = 0; i < data.length; i += 16) {
    if (data[i] + data[i + 1] + data[i + 2] > 40) lit += 1;
  }
  const samples = data.length / 16;
  return {
    width,
    height,
    lit,
    samples,
    ratio: lit / samples,
    title: document.title,
    mission: (document.getElementById("missionBar") || {}).textContent,
    scraps: (document.getElementById("scrapBar") || {}).textContent,
    dexDots: document.querySelectorAll(".dex-dot").length,
    shareCardHead: window.__crane && window.__crane.shareCard ? window.__crane.shareCard().slice(0, 22) : null,
    snap: window.__crane ? window.__crane.snapshot() : null,
  };
});

await page.evaluate(() => {
  const s = window.__crane.snapshot();
  const p = s.plushes[0];
  window.__crane.aim(p.x, p.y);
  window.__crane.grab();
});
await page.waitForTimeout(800);
const after = await page.evaluate(() => window.__crane.snapshot());

await page.screenshot({ path: shot, fullPage: true });
await browser.close();

const report = { errors, fill, afterMode: after.mode, afterCoins: after.coins, shot };
fs.writeFileSync(logPath, JSON.stringify(report, null, 2) + "\n" + logs.join("\n") + "\n");
console.log(JSON.stringify({ errors, fill, afterMode: after.mode, afterCoins: after.coins, shot }, null, 2));

if (errors.length) process.exit(2);
if (fill.width < 400 || fill.height < 400) process.exit(3);
if (fill.ratio < 0.12) process.exit(4);
if (fill.dexDots < 8) process.exit(5);
if (!fill.mission || !fill.mission.includes("부탁")) process.exit(6);
if (!fill.shareCardHead || !fill.shareCardHead.startsWith("data:image/png")) process.exit(7);
console.log("chrome-play ok");
