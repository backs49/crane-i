const CACHE = "molang-crane-v2"; // 게임 파일을 수정하는 커밋마다 버전을 올릴 것
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
