# 5단계: 결과 공유 카드 + OG 메타 태그 구현 플랜

**Goal:** 게임오버 화면에서 "자랑하기" 버튼을 누르면 오늘의 성과(점수, 최고 기록, 뽑은 인형들)가 담긴 이미지 카드가 만들어지고, Web Share API → 클립보드 → 다운로드 순으로 폴백하며 공유된다. 링크 미리보기를 위한 OG 메타 태그를 추가한다.

**Architecture:** 새 전역 `Share`(`js/share.js`)가 오프스크린 캔버스에 카드를 그린다. 인형 그림은 기존 `Draw.plush`를 재사용한다(게임오버 시 판 단위 `state.collection`의 잡은 타입들). 최상위에서 DOM을 만지지 않아 `tests/load-scripts.js`를 통과한다.

**Tech Stack:** Canvas 2D, Web Share API Level 2 (files), Async Clipboard API, `<a download>` 폴백.

**Spec:** `docs/plans/README.md`, 선행: 1·2단계 완료(최고 기록, `Fun.dayKey` 사용).

## Global Constraints

- 카드 크기 720×900px, PNG.
- `js/share.js`는 함수 호출 시점에만 DOM API 사용(최상위 부작용 금지). `module.exports` 가드 필수.
- 외부 리소스(폰트 CDN 등)를 카드 생성 중 새로 로드하지 않는다 — 페이지에 이미 로드된 폰트를 사용.

---

### Task 1: `js/share.js` 카드 렌더러 + 공유 함수

**Files:**
- Create: `js/share.js`
- Modify: `index.html` (스크립트 태그)
- Modify: `tests/load-scripts.js` (files 배열)

**Interfaces:**
- Produces: `Share.card(info) → HTMLCanvasElement`, `Share.share(info) → Promise<"shared"|"copied"|"downloaded"|"fail">`.
- `info` 형태: `{ score: number, best: number, prizes: number, dayKey: string, caught: { [type]: number } }`.
- Consumes: 전역 `Draw`, `PLUSH_TYPES`.

- [ ] **Step 1: 파일 생성** — `js/share.js`를 아래 내용 그대로 생성:

```js
const Share = {
  W: 720,
  H: 900,

  rounded(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
    }
  },

  card(info) {
    const c = document.createElement("canvas");
    c.width = this.W;
    c.height = this.H;
    const ctx = c.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, "#4a226e");
    bg.addColorStop(1, "#1a0b2c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.fillStyle = "rgba(255, 234, 244, 0.06)";
    for (let y = 30; y < this.H; y += 34) {
      for (let x = 26; x < this.W; x += 34) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffeaf4";
    ctx.font = "64px 'Bagel Fat One', 'Jua', sans-serif";
    ctx.fillText("몰랑크레인", this.W / 2, 112);
    ctx.fillStyle = "#63f0c8";
    ctx.font = "600 20px 'Nunito', sans-serif";
    ctx.fillText("MIDNIGHT CANDY CATCHER", this.W / 2, 150);
    ctx.fillStyle = "#cbb6ff";
    ctx.font = "22px 'Gowun Dodum', sans-serif";
    ctx.fillText(info.dayKey || "", this.W / 2, 190);

    ctx.fillStyle = "rgba(20, 8, 20, 0.72)";
    this.rounded(ctx, 60, 224, 600, 168, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 121, 199, 0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#cbb6ff";
    ctx.font = "22px 'Gowun Dodum', sans-serif";
    ctx.fillText("점수", 210, 272);
    ctx.fillText("인형", 510, 272);
    ctx.fillStyle = "#ffe36a";
    ctx.font = "68px 'Bagel Fat One', 'Jua', sans-serif";
    ctx.fillText(String(info.score), 210, 356);
    ctx.fillText(String(info.prizes), 510, 356);

    ctx.fillStyle = "#63f0c8";
    ctx.font = "24px 'Gowun Dodum', sans-serif";
    const bestLine = info.score >= info.best && info.score > 0 ? "오늘 최고 기록 갱신!" : `최고 기록 ${info.best}점`;
    ctx.fillText(bestLine, this.W / 2, 440);

    const types = Object.keys(info.caught || {}).filter((t) => info.caught[t] > 0 && PLUSH_TYPES[t]);
    if (types.length === 0) {
      ctx.fillStyle = "#cbb6ff";
      ctx.font = "26px 'Gowun Dodum', sans-serif";
      ctx.fillText("오늘은 인형들이 잘 버텼어요", this.W / 2, 620);
    } else {
      const shown = types.slice(0, 8);
      const cols = Math.min(4, shown.length);
      const cellW = 140;
      const startX = this.W / 2 - ((cols - 1) * cellW) / 2;
      for (let i = 0; i < shown.length; i++) {
        const type = shown[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const px = startX + col * cellW;
        const py = 560 + row * 160;
        Draw.plush(ctx, { type, x: px, y: py, radius: 44, angle: 0, liftZ: 0, blink: 1, react: "success" });
        ctx.fillStyle = "#ffeaf4";
        ctx.font = "22px 'Gowun Dodum', sans-serif";
        ctx.fillText(`×${info.caught[type]}`, px, py + 84);
      }
    }

    ctx.fillStyle = "#ff9ad8";
    ctx.font = "26px 'Gowun Dodum', sans-serif";
    ctx.fillText("나도 뽑으러 가기 🧸", this.W / 2, this.H - 48);

    return c;
  },

  async share(info) {
    const canvas = this.card(info);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return "fail";
    const text = `몰랑크레인에서 ${info.score}점! 인형 ${info.prizes}개를 데려왔어요`;
    if (typeof File !== "undefined" && navigator.canShare) {
      const file = new File([blob], "molang-crane.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "몰랑크레인", text });
          return "shared";
        } catch (_) {
          /* 사용자가 취소했거나 미지원 — 다음 폴백으로 */
        }
      }
    }
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return "copied";
      } catch (_) {
        /* 권한 거부 — 다음 폴백으로 */
      }
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "molang-crane.png";
    a.click();
    return "downloaded";
  },
};

if (typeof module !== "undefined") module.exports = Share;
```

- [ ] **Step 2: 로드 순서 등록** — `index.html`에서 `<script src="js/grip.js"></script>` 바로 다음 줄에 추가:

```html
    <script src="js/share.js"></script>
```

`tests/load-scripts.js`의 `files` 배열에서 `"js/grip.js",` 다음 줄에 `"js/share.js",` 추가.

- [ ] **Step 3: 스모크 확인 + 커밋**

Run: `node tests/load-scripts.js`
Expected: `loaded js/share.js` 포함, 마지막 줄 `load-scripts ok`.

```bash
git add js/share.js index.html tests/load-scripts.js
git commit -m "feat: add Share module that renders a result card canvas"
```

---

### Task 2: 게임오버 버튼 + OG 태그

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`
- Modify: `js/game.js`
- Modify: `tests/chrome-play.mjs`

**Interfaces:**
- Consumes: Task 1의 `Share.share`/`Share.card`, 1단계의 `state.save.bestScore`, 2단계의 `Fun.dayKey`.
- Produces: `#shareBtn`, `window.__crane.shareCard() → dataURL 문자열`.

- [ ] **Step 1: 버튼 추가** — `index.html`의 게임오버 다이얼로그에서

```html
        <button type="button" class="primary" id="retryBtn">한 판 더</button>
```
바로 다음 줄에 추가:
```html
        <button type="button" class="ghost" id="shareBtn">자랑하기 📸</button>
```

- [ ] **Step 2: 버튼 스타일** — `css/game.css`의 `.primary:active { ... }` 규칙 다음에 추가:

```css
.ghost {
  width: 100%;
  margin-top: 10px;
  border-radius: 999px;
  padding: 10px 18px;
  font-family: var(--display);
  font-size: 18px;
  color: var(--cotton);
  background: rgba(255, 234, 244, 0.08);
  border: 2px solid rgba(255, 234, 244, 0.35);
}

.ghost:active {
  transform: translateY(2px);
}
```

- [ ] **Step 3: OG 메타 태그** — `index.html`의 `<meta name="description" ... />` 태그 바로 다음에 추가:

```html
    <meta property="og:title" content="몰랑크레인 — Midnight Candy Catcher" />
    <meta
      property="og:description"
      content="일부러 약한 집게로 인형을 데려오는 자정 캔디 오락실. 오늘의 부탁을 완수하고 도감을 채워보세요."
    />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
```

- [ ] **Step 4: 핸들러 연결** — `js/game.js`에서 `document.getElementById("retryBtn").addEventListener("click", startGame);` 바로 다음 줄에 추가:

```js
  document.getElementById("shareBtn").addEventListener("click", async () => {
    const result = await Share.share({
      score: state.score,
      best: state.save.bestScore,
      prizes: state.prizes,
      dayKey: Fun.dayKey(),
      caught: state.collection.counts,
    });
    const msgs = {
      shared: "공유 완료!",
      copied: "이미지가 복사됐어요",
      downloaded: "이미지를 저장했어요",
      fail: "공유에 실패했어요…",
    };
    toast(msgs[result] || msgs.fail, result === "fail" ? "fail" : "win");
  });
```

주의: 게임오버 오버레이가 떠 있는 동안에도 toast는 `.viewport` 안에 그려져 가려질 수 있다. 그래도 무해하므로 이 단계에서는 그대로 둔다.

- [ ] **Step 5: 자동화 훅** — `window.__crane`의 `wipeSave()` 다음에 추가:

```js
    shareCard() {
      return Share.card({
        score: state.score,
        best: state.save.bestScore,
        prizes: state.prizes,
        dayKey: Fun.dayKey(),
        caught: state.collection.counts,
      }).toDataURL("image/png");
    },
```

- [ ] **Step 6: E2E 검증 확장** — `tests/chrome-play.mjs`의 `page.evaluate` 결과 객체(`fill`)에서 `snap: ...` 줄 바로 위에 추가:

```js
    shareCardHead: window.__crane && window.__crane.shareCard ? window.__crane.shareCard().slice(0, 22) : null,
```

그리고 파일 하단 exit 검사들 중 `if (!fill.mission || ...)` 줄 다음에 추가:
```js
if (!fill.shareCardHead || !fill.shareCardHead.startsWith("data:image/png")) process.exit(7);
```

- [ ] **Step 7: 검증 + 커밋**

Run: `node tests/load-scripts.js`
Expected: `load-scripts ok`

Run: `GAME_URL=http://127.0.0.1:8765/ node tests/chrome-play.mjs`
Expected: `chrome-play ok`, 출력에 `"shareCardHead": "data:image/png;base64,"`.

수동 검증: 게임오버 화면에서 "자랑하기 📸" 클릭 → macOS Chrome에서는 클립보드 복사 또는 다운로드가 일어나고 토스트가 뜬다. 저장된 PNG를 열어 레이아웃(제목/점수/인형) 확인.

```bash
git add index.html css/game.css js/game.js tests/chrome-play.mjs
git commit -m "feat: add share button with card image and OG meta tags"
```

---

### Task 3 (선택): og:image 자산

og:image는 정적 파일이 필요하다. 다음 절차로 만들 수 있으면 수행하고, 어려우면 건너뛴다(텍스트 OG만으로도 동작).

- [ ] **Step 1:** 서버를 켜고 playwright로 카드 저장:

```bash
node -e "
const { createRequire } = require('node:module');
const fs = require('node:fs');
let chromium; try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('playwright')); }
(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined, headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const url = await page.evaluate(() => window.__crane.shareCard());
  fs.mkdirSync('assets', { recursive: true });
  fs.writeFileSync('assets/og.png', Buffer.from(url.split(',')[1], 'base64'));
  await browser.close();
  console.log('assets/og.png written');
})();
"
```

- [ ] **Step 2:** `index.html`의 `twitter:card` 태그 다음에 추가:

```html
    <meta property="og:image" content="assets/og.png" />
```
(주의: 실제 배포 도메인이 정해지면 절대 URL로 바꿔야 미리보기가 동작한다. 주석으로 남기지 말고 이대로 커밋.)

- [ ] **Step 3: 커밋**

```bash
git add assets/og.png index.html
git commit -m "feat: add og:image asset generated from the share card"
```
