// Play 스토어용 이미지를 만든다: 휴대폰 스크린샷(1080×1920)과 대표 이미지(1024×500).
// 실행: python3 -m http.server 8765 를 띄운 뒤 GAME_URL=http://127.0.0.1:8765/ node tools/store-assets.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  ({ chromium } = require("playwright"));
}

const url = process.env.GAME_URL || "http://127.0.0.1:8765/";
const outDir = path.join("store");
fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });

const browser = await chromium.launch();
// 360×640 화면을 3배로 찍으면 1080×1920 (9:16)
const ctx = await browser.newContext({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  timezoneId: "Asia/Seoul",
});
const page = await ctx.newPage();
await page.goto(url);

// 보기 좋은 상태로 저장 데이터를 채운다 (도감 일부, 내 인형, 친밀도)
await page.evaluate(() => {
  window.__crane.wipeSave();
  const s = JSON.parse(localStorage.getItem("molang-crane:v1"));
  for (const k of ["bear", "bunny", "cat", "chick", "frog", "penguin", "pig", "puppy", "berry", "unicorn"]) s.dexCounts[k] = 2;
  s.tutorialDone = true;
  s.myPlush = { ears: "long", color: "#7de3b0", eyes: "sparkle", cheeks: true, accessory: "crown", persona: "brave", name: "콩이" };
  s.room = { bunny: { pets: 16 }, cat: { pets: 7 }, bear: { pets: 11 }, mine: { pets: 20 } };
  localStorage.setItem("molang-crane:v1", JSON.stringify(s));
});
await page.reload();
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "screenshots", name) });
  console.log("saved", name);
};

// 1. 게임 화면: 인형 한가운데에 집게를 두고 잡는 순간
await page.evaluate(() => window.__crane.start());
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const s = window.__crane.snapshot();
  const p = s.plushes.find((q) => q.type === "unicorn") || s.plushes[0];
  window.__crane.aim(p.x, p.y);
});
await shot("1-play.png");
await page.evaluate(() => window.__crane.end());
await page.waitForTimeout(300);

// 2. 내 인형 방
await page.evaluate(() => window.__crane.openRoom());
await shot("2-room.png");

// 3. 내 인형 만들기
await page.evaluate(() => window.__crane.openMaker());
await page.waitForTimeout(600);
await shot("3-maker.png");
await page.evaluate(() => document.getElementById("makerClose").click());

// 4. 몰랑 마을 대화
await page.evaluate(() => window.__crane.openVillage());
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const v = window.__crane.village();
  const w = v.walkers.find((q) => q.type === "mine");
  const c = document.getElementById("villageCanvas").getBoundingClientRect();
  const ev = new PointerEvent("pointerdown", {
    clientX: c.left + (w.x / 360) * c.width,
    clientY: c.top + (w.y / 480) * c.height,
    bubbles: true,
  });
  document.getElementById("villageCanvas").dispatchEvent(ev);
});
await page.evaluate(() => document.getElementById("villageCanvas").scrollIntoView({ block: "start" }));
await shot("4-village.png");

// 5. 피크닉
await page.evaluate(() => {
  [...document.querySelectorAll("#villageModes button")].find((b) => b.textContent.includes("피크닉")).click();
});
await page.waitForTimeout(3500);
await page.evaluate(() => document.getElementById("villageCanvas").scrollIntoView({ block: "start" }));
await shot("5-picnic.png");

// 대표 이미지 1024×500 (알파 없는 PNG)
const feature = await page.evaluate(async () => {
  await document.fonts.load("80px Jua", "몰랑크레인");
  const W = 1024;
  const H = 500;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#6a34a0");
  bg.addColorStop(1, "#1a0b2c");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255, 227, 106, 0.8)";
  for (let i = 0; i < 26; i++) {
    Draw.star(g, (i * 157) % W, 30 + ((i * 89) % (H - 60)), 3 + (i % 3) * 2, 4, 0.45);
    g.fill();
  }
  const friends = [
    ["bunny", 610, 300, 70, -0.08],
    ["bear", 760, 250, 84, 0.04],
    ["cat", 905, 320, 64, 0.1],
    ["chick", 700, 410, 50, -0.05],
    ["unicorn", 860, 430, 54, 0.06],
  ];
  for (const [type, x, y, r, a] of friends) {
    Draw.plush(g, { type, x, y, radius: r, angle: a, liftZ: 0, blink: 1, react: "success" });
  }
  g.textAlign = "left";
  g.fillStyle = "#ffeaf4";
  g.font = "96px Jua";
  g.shadowColor = "rgba(122, 45, 106, 0.9)";
  g.shadowOffsetY = 6;
  g.fillText("몰랑크레인", 60, 220);
  g.shadowColor = "transparent";
  g.font = "36px Jua";
  g.fillStyle = "#ffe36a";
  g.fillText("뽑고, 모으고, 함께 놀아요", 64, 290);
  g.font = "26px 'Gowun Dodum'";
  g.fillStyle = "#e6cff5";
  g.fillText("아이 모드 · 광고 없음 · 오프라인", 66, 345);
  return c.toDataURL("image/png");
});
fs.writeFileSync(path.join(outDir, "feature-graphic.png"), Buffer.from(feature.split(",")[1], "base64"));
console.log("saved feature-graphic.png");
fs.copyFileSync(path.join("assets", "icon-store-512.png"), path.join(outDir, "icon-512.png"));
await browser.close();
