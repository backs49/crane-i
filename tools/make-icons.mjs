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

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  executablePath: fs.existsSync(chrome) ? chrome : undefined,
  headless: true,
});
const page = await browser.newPage();

const draw = (size, maskable) =>
  page.evaluate(
    ([s, m]) => {
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "#5b2d8a");
      g.addColorStop(1, "#1a0b2c");
      ctx.fillStyle = g;
      if (m || !ctx.roundRect) {
        ctx.fillRect(0, 0, s, s);
      } else {
        ctx.beginPath();
        ctx.roundRect(0, 0, s, s, s * 0.22);
        ctx.fill();
      }
      const em = m ? 0.5 : 0.62;
      ctx.font = `${Math.round(s * em)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🧸", s / 2, s / 2 + s * 0.04);
      return c.toDataURL("image/png");
    },
    [size, maskable],
  );

fs.mkdirSync("assets", { recursive: true });
const save = (name, dataUrl) =>
  fs.writeFileSync(path.join("assets", name), Buffer.from(dataUrl.split(",")[1], "base64"));

save("icon-192.png", await draw(192, false));
save("icon-512.png", await draw(512, false));
save("icon-maskable-512.png", await draw(512, true));
await browser.close();
console.log("icons written to assets/");
