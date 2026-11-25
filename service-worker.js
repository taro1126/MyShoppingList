const CACHE_NAME = "kagomemo-v1.3.1-r2";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/kagomemo-icon-180-v1.2.0.png",
  "./icons/kagomemo-icon-192-v1.2.0.png",
  "./icons/kagomemo-icon-512-v1.2.0.png",
  "./icons/kagomemo-wordmark-v1.2.0.png",
  "./splash/kagomemo-320x568-2x-v1.2.0.png",
  "./splash/kagomemo-375x667-2x-v1.2.0.png",
  "./splash/kagomemo-390x844-3x-v1.2.0.png",
  "./splash/kagomemo-402x874-3x-v1.2.0.png",
  "./fonts/ZenMaruGothic-Regular.ttf",
  "./fonts/ZenMaruGothic-Medium.ttf",
  "./fonts/ZenMaruGothic-Bold.ttf"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("kagomemo-v") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).catch(() => {
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      });
    })
  );
});
