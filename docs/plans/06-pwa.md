# 6단계: PWA + 폰트 로컬 번들 구현 플랜

**Goal:** 홈 화면에 설치되고 오프라인에서도 도는 앱으로 만든다. Google Fonts CDN 의존을 제거해(로컬 번들) 오프라인에서 폰트가 깨지지 않게 한다.

**Architecture:** `manifest.webmanifest` + 아이콘 PNG(이모지 🧸를 캔버스로 렌더링해 생성) + 캐시 우선 서비스 워커 `sw.js`. 폰트는 도구 스크립트가 Google Fonts CSS와 woff2를 내려받아 `assets/fonts/`에 저장하고 CSS의 URL을 로컬 경로로 재작성한다. 폰트가 same-origin이 되므로 서비스 워커의 런타임 캐시가 woff2까지 커버한다.

**Tech Stack:** Web App Manifest, Service Worker (Cache Storage), Node 18+ `fetch`, playwright(아이콘 생성용).

**Spec:** `docs/plans/README.md`, 선행: 1~5단계 완료(프리캐시 목록이 최종 파일 구성을 가정).

## Global Constraints

- 서비스 워커 등록은 `http(s)`에서만 (`file:` 가드).
- **이후 게임 파일을 수정하는 모든 커밋은 `sw.js`의 `CACHE` 버전을 올려야 한다** — 이 규칙을 7단계에서도 적용할 것.
- 외부 origin 요청은 서비스 워커가 건드리지 않는다(pass-through).

---

### Task 1: 폰트 로컬 번들

**Files:**
- Create: `tools/vendor-fonts.mjs`
- Create: `assets/fonts/fonts.css` + woff2 파일들 (스크립트 산출물)
- Modify: `index.html`

- [ ] **Step 1: 스크립트 생성** — `tools/vendor-fonts.mjs`를 아래 내용 그대로 생성:

```js
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
```

- [ ] **Step 2: 실행**

Run: `node tools/vendor-fonts.mjs`
Expected: `fonts.css + N woff2 files written ...` (한글 폰트는 유니코드 범위 서브셋이 많아 N이 수백 개일 수 있음 — 정상).

Run: `grep -c "url(https" assets/fonts/fonts.css || true`
Expected: `0` (원격 폰트 URL이 전부 로컬 경로로 치환됨).

- [ ] **Step 3: index.html 교체** — 아래 세 줄을

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Gowun+Dodum&family=Jua&family=Nunito:wght@600;800&display=swap"
      rel="stylesheet"
    />
```
다음 한 줄로 교체:
```html
    <link rel="stylesheet" href="assets/fonts/fonts.css" />
```

- [ ] **Step 4: 검증 + 커밋**

서버 켜고 브라우저에서 열어 제목 폰트(Bagel Fat One)가 여전히 적용되는지 확인. 개발자도구 Network 탭에서 `fonts.googleapis.com` 요청이 없어야 함.

```bash
git add tools/vendor-fonts.mjs assets/fonts index.html
git commit -m "feat: bundle Google Fonts locally for offline play"
```

---

### Task 2: 아이콘 + manifest

**Files:**
- Create: `tools/make-icons.mjs`
- Create: `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable-512.png` (산출물)
- Create: `manifest.webmanifest`
- Modify: `index.html`

- [ ] **Step 1: 아이콘 생성 스크립트** — `tools/make-icons.mjs`를 아래 내용 그대로 생성:

```js
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
```

- [ ] **Step 2: 실행**

Run: `node tools/make-icons.mjs`
Expected: `icons written to assets/`, 세 PNG 파일 생성 확인(`ls -la assets/*.png`).

- [ ] **Step 3: manifest 생성** — `manifest.webmanifest`를 아래 내용 그대로 생성:

```json
{
  "name": "몰랑크레인",
  "short_name": "몰랑크레인",
  "description": "자정 캔디 오락실의 인형뽑기 — Midnight Candy Catcher",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#120818",
  "theme_color": "#1a0b2c",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: head 연결** — `index.html`의 `<meta name="theme-color" content="#1a0b2c" />` 다음에 추가:

```html
    <link rel="manifest" href="manifest.webmanifest" />
    <link rel="apple-touch-icon" href="assets/icon-192.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- [ ] **Step 5: 커밋**

```bash
git add tools/make-icons.mjs assets/icon-192.png assets/icon-512.png assets/icon-maskable-512.png manifest.webmanifest index.html
git commit -m "feat: add web app manifest and generated icons"
```

---

### Task 3: 서비스 워커

**Files:**
- Create: `sw.js` (프로젝트 루트 — 스코프 때문에 반드시 루트)
- Modify: `index.html`

- [ ] **Step 1: `sw.js` 생성** — 아래 내용 그대로 (js 파일 목록은 이 시점의 index.html과 일치해야 한다 — 다르면 맞춰서 수정):

```js
const CACHE = "molang-crane-v1"; // 게임 파일을 수정하는 커밋마다 버전을 올릴 것
const SHELL = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "css/game.css",
  "assets/fonts/fonts.css",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "vendor/matter.min.js",
  "js/config.js",
  "js/save.js",
  "js/fun.js",
  "js/grip.js",
  "js/share.js",
  "js/audio.js",
  "js/particles.js",
  "js/draw.js",
  "js/input.js",
  "js/game.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        }),
    ),
  );
});
```

- [ ] **Step 2: 등록** — `index.html`의 `<script src="js/game.js"></script>` 다음, `</body>` 앞에 추가:

```html
    <script>
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
      }
    </script>
```

- [ ] **Step 3: 검증**

Run: `node tests/load-scripts.js`
Expected: `load-scripts ok` (sw.js는 페이지 스크립트가 아니므로 목록에 추가하지 않는다).

브라우저 검증 (http://localhost:8765):
1. 페이지 로드 → 개발자도구 Application 탭 → Service Workers에 `sw.js` activated.
2. Application → Cache Storage에 `molang-crane-v1` 존재, SHELL 파일들 보임.
3. Network 탭에서 Offline 체크 → 새로고침 → 게임이 그대로 뜨고 폰트도 정상.
4. Manifest 섹션에 이름/아이콘 표시, 설치 가능 표시 확인.

playwright 자동 검증(선택):
```bash
node -e "
const { createRequire } = require('node:module');
const fs = require('node:fs');
let chromium; try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('playwright')); }
(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined, headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.active && reg.active.state : null;
  });
  console.log('sw state:', sw);
  await browser.close();
  process.exit(sw === 'activated' ? 0 : 1);
})();
"
```
Expected: `sw state: activated`

- [ ] **Step 4: 커밋**

```bash
git add sw.js index.html
git commit -m "feat: add cache-first service worker for offline play"
```

주의(개발 편의): 서비스 워커 캐시 때문에 로컬 수정이 안 보이면 개발자도구에서 "Update on reload" 체크 또는 Application → Clear storage 사용. 이후 커밋에서 게임 파일이 바뀌면 반드시 `CACHE`를 `molang-crane-v2`처럼 올린다.
