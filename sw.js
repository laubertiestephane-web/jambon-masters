// Service worker minimal : permet l'installation sur Android, réseau d'abord.
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ---- Notifications push (birdies) ----
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Jambon Masters", body: e.data ? e.data.text() : "" }; }
  const opts = { body: d.body || "", tag: d.tag || "jambon", renotify: true, requireInteraction: true, icon: "icon-180.png", badge: "icon-180.png", vibrate: d.kind === "eagle" ? [120, 60, 120, 60, 300] : [80, 40, 160], data: { url: d.url || "./" } };
  e.waitUntil(self.registration.showNotification(d.title || "Jambon Masters", opts));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => { for (const c of list) { if ("focus" in c) return c.focus(); } return self.clients.openWindow(url); }));
});
