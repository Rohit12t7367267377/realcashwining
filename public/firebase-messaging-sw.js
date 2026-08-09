/* Firebase Cloud Messaging service worker.
   Config is fetched from the app so no keys are hardcoded here.
   Until Firebase keys are configured this worker stays idle. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && (event.notification.data.link || event.notification.data.FCM_MSG?.data?.link)) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});

async function start() {
  try {
    const res = await fetch("/api/public/hooks/push-config");
    if (!res.ok) return;
    const cfg = await res.json();
    if (!cfg.apiKey || !cfg.appId || !cfg.messagingSenderId) return;
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {};
      self.registration.showNotification(n.title || "Cash Winning League", {
        body: n.body || "",
        icon: "/favicon.ico",
        image: n.image,
        data: payload.data || {},
      });
    });
  } catch (e) {
    // Push not configured yet — worker stays idle.
  }
}

start();
