const CACHE = "molang-crane-v7"; // 게임 파일을 수정하는 커밋마다 버전을 올릴 것
const SHELL = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "css/game.css",
  "assets/fonts/fonts.css",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "assets/og.png",
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

function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches
    .open(CACHE)
    .then((c) => c.put(request, copy))
    .catch(() => {});
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c
          .addAll(SHELL)
          .then(() =>
            fetch("assets/fonts/fonts.css")
              .then((res) => res.text())
              .then((css) => {
                const names = css.match(/url\(["']?([^"')]+\.woff2)["']?\)/g) || [];
                const files = names
                  .map((m) => m.replace(/url\(["']?/, "").replace(/["']?\)/, ""))
                  .map((name) => "assets/fonts/" + name.split("/").pop());
                // addAll은 배치 내 중복 요청이 있으면 전체를 거부하므로 반드시 중복 제거
                return c.addAll(Array.from(new Set(files)));
              })
              .catch(() => {}),
          ),
      )
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

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          putInCache(e.request, res);
          return res;
        })
        .catch(() =>
          caches
            .match(e.request, { ignoreSearch: true })
            .then((hit) => hit || caches.match("index.html")),
        ),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) => {
      const refresh = fetch(e.request)
        .then((res) => {
          putInCache(e.request, res);
          return res;
        })
        .catch(() => hit);
      if (hit) e.waitUntil(refresh.then(() => {}, () => {}));
      return hit || refresh;
    }),
  );
});
