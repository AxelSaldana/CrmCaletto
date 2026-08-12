/* Service worker mínimo: cachea el "shell" de la app (HTML/CSS/JS) para que abra
   al instante desde la pantalla de inicio. Los datos siempre se piden en vivo a
   la API — este service worker nunca cachea /api/. */

var CACHE = "panorama-ejecutivo-v1";
var ARCHIVOS = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.indexOf("/api/") !== -1) return; // nunca cachear la API

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
