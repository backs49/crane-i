// 앱 아이콘을 게임 안의 곰 인형 그림(js/draw.js)으로 그린다.
// 이모지 그림은 제작사 저작물이라 스토어 아이콘에 쓰지 않는다.
// 실행: python3 -m http.server 8765 를 띄운 뒤 GAME_URL=http://127.0.0.1:8765/ node tools/make-icons.mjs
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
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
await page.waitForFunction(() => typeof Draw !== "undefined");

const draw = (size, kind) =>
  page.evaluate(
    ([s, k]) => {
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "#6a34a0");
      g.addColorStop(1, "#1a0b2c");
      ctx.fillStyle = g;
      if (k === "rounded" && ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(0, 0, s, s, s * 0.22);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, s, s);
      }
      // 반짝이는 별 몇 개
      ctx.fillStyle = "rgba(255, 227, 106, 0.85)";
      for (const [x, y, r] of [[0.2, 0.2, 0.035], [0.82, 0.26, 0.028], [0.78, 0.8, 0.022]]) {
        Draw.star(ctx, s * x, s * y, s * r, 4, 0.45);
        ctx.fill();
      }
      // 마스커블 아이콘은 가운데 80% 안에 그림이 들어가야 잘리지 않는다
      const r = s * (k === "maskable" ? 0.26 : 0.31);
      Draw.plush(ctx, { type: "bear", x: s / 2, y: s * 0.55, radius: r, angle: -0.06, liftZ: 0, blink: 1, react: "success" });
      return c.toDataURL("image/png");
    },
    [size, kind],
  );

fs.mkdirSync("assets", { recursive: true });
const save = (name, dataUrl) =>
  fs.writeFileSync(path.join("assets", name), Buffer.from(dataUrl.split(",")[1], "base64"));

save("icon-192.png", await draw(192, "rounded"));
save("icon-512.png", await draw(512, "rounded"));
save("icon-maskable-512.png", await draw(512, "maskable"));
save("icon-store-512.png", await draw(512, "square"));
await browser.close();
console.log("icons written to assets/");
