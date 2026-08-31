import fs from "node:fs";
import path from "node:path";

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Gowun+Dodum&family=Jua&family=Nunito:wght@600;800&display=swap";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const outDir = path.join(process.cwd(), "assets", "fonts");
fs.mkdirSync(outDir, { recursive: true });

const css = await (await fetch(CSS_URL, { headers: { "User-Agent": UA } })).text();
const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
let out = css;
let i = 0;
for (const u of urls) {
  const name = `f${String(i++).padStart(3, "0")}.woff2`;
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  fs.writeFileSync(path.join(outDir, name), buf);
  out = out.split(u).join(name);
}
fs.writeFileSync(path.join(outDir, "fonts.css"), out);
console.log(`fonts.css + ${i} woff2 files written to ${outDir}`);
