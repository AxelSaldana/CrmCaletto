/* Service worker: cachea el "shell" de la app (HTML/CSS/JS) para que abra
   rápido y funcione sin internet. Los datos siempre se piden en vivo a
   /api/ (nunca se cachean).

   Estrategia "network-first": en cada apertura, si hay internet, siempre
   trae la versión más reciente del shell y actualiza la caché — así un
   nuevo deploy se ve de inmediato la próxima vez que se abre la app, en
   vez de quedarse pegado en una versión vieja. Solo usa la caché cuando
   no hay conexión. */

var CACHE = "panorama-ejecutivo-v2";
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
    fetch(e.request)
      .then(function (res) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
        return res;
      })
      .catch(function () {
        return caches.match(e.request);
      })
  );
});
