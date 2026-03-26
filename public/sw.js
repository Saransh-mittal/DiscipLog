// DiscipLog Service Worker — Push Notification Handler
// Minimal: handles push events and notification clicks only.
// No caching strategy — Next.js manages its own caching.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "DiscipLog",
      body: event.data.text() || "You have a new notification.",
    };
  }

  const title = payload.title || "DiscipLog";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    data: payload.data || {},
    actions: payload.actions || [],
    vibrate: [100, 50, 100],
    tag: payload.data?.tier || "disciplog-nudge",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";
  const action = event.action;

  // Handle action button clicks
  if (action === "snooze") {
    // Snooze is a no-op on the client — the server handles snooze timing
    return;
  }

  // Default: open or focus the app
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if found
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open new tab
        return self.clients.openWindow(targetUrl);
      })
  );
});

// No-op fetch handler — let Next.js handle everything
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
