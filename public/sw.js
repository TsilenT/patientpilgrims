// Web Push service worker. Kept intentionally minimal.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || "Your turn";
  const body = data.body || "It's your turn in Patient Pilgrims.";
  const url = data.url || "./";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: url, // coalesce repeated pings for the same game
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
