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
