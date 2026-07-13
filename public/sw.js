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
  const rawTarget = (event.notification.data && event.notification.data.url) || "./";
  // Resolve against the registration scope (the app directory), not sw.js.
  // A hash-only URL resolved by openWindow itself may otherwise become
  // /sw.js#/g/..., displaying the service-worker JavaScript instead of the app.
  let target;
  try {
    target = new URL(rawTarget, self.registration.scope).href;
  } catch (_) {
    target = self.registration.scope;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (!client.url.startsWith(self.registration.scope)) continue;
        // Focusing alone can leave an old game—or even a directly opened asset—
        // on screen. Navigate to the notified game first, then focus the window.
        if ("navigate" in client) {
          return client.navigate(target).then((navigated) => (navigated || client).focus());
        }
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
