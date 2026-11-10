const V = "lr-1.0.0", FILES = ["./", "index.html", "app.js", "skip.js", "config.js", "style.css", "manifest.json", "icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => {
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
