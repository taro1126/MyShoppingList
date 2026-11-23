
const CACHE_NAME = "shopping-list-v28";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon.svg",
  "./icons/apple-touch-icon-v1.0.5.png",
  "./icons/icon-192-v1.0.5.png",
  "./icons/icon-512-v1.0.5.png",
  "./splash/launch-320x568-2x-v1.1.1.png",
  "./splash/launch-360x780-3x-v1.1.1.png",
  "./splash/launch-375x667-2x-v1.1.1.png",
  "./splash/launch-375x812-3x-v1.1.1.png",
  "./splash/launch-390x844-3x-v1.1.1.png",
  "./splash/launch-393x852-3x-v1.1.1.png",
  "./splash/launch-402x874-3x-v1.1.1.png",
  "./splash/launch-414x896-2x-v1.1.1.png",
  "./splash/launch-414x896-3x-v1.1.1.png",
  "./splash/launch-420x912-3x-v1.1.1.png",
  "./splash/launch-428x926-3x-v1.1.1.png",
  "./splash/launch-430x932-3x-v1.1.1.png",
  "./splash/launch-440x956-3x-v1.1.1.png",
];

// インストール時にアプリのファイルを保存
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 保存済みファイルを優先して表示
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
