// La Previa: recibe avisos push (invitaciones a planes) y abre la app al tocarlos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "La Previa", {
      body: d.body || "",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin) && "navigate" in v) return v.navigate(url).then((w) => (w || v).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
