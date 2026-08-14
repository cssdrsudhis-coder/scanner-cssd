const CACHE_NAME = "cssd-digital-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://unpkg.com/html5-qrcode"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if(
    url.origin === self.location.origin ||
    url.hostname === "unpkg.com"
  ){
    event.respondWith(
      caches.match(event.request).then(cached => {
        if(cached) return cached;

        return fetch(event.request).then(response => {
          if(response && response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request,copy)
            );
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener("sync", event => {
  if(event.tag === "cssd-sync"){
    event.waitUntil(
      self.clients.matchAll({
        type:"window",
        includeUncontrolled:true
      }).then(clients => {
        clients.forEach(client =>
          client.postMessage({type:"CSSD_SYNC_REQUEST"})
        );
      })
    );
  }
});
