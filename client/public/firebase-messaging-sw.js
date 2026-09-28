importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
);

// Replace these values with your Firebase Web App configuration
firebase.initializeApp({
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

/*
 * Handles notifications when the website is in the background
 * or the browser tab is not currently active.
 */
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Background message received:",
    payload,
  );

  const notificationTitle =
    payload.notification?.title ||
    payload.data?.title ||
    "QuickCart Notification";

  const notificationBody =
    payload.notification?.body ||
    payload.data?.body ||
    "You have a new notification.";

  const notificationData = payload.data || {};

  const notificationOptions = {
    body: notificationBody,

    icon: "/favicon.ico",

    badge: "/favicon.ico",

    data: notificationData,

    tag:
      notificationData.notificationId ||
      notificationData.type ||
      "quickcart-notification",

    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/*
 * Handle notification click.
 */
self.addEventListener("notificationclick", (event) => {
  console.log(
    "[firebase-messaging-sw.js] Notification clicked:",
    event.notification,
  );

  event.notification.close();

  const data = event.notification.data || {};

  let targetUrl = "/";

  if (data.type === "NEW_ORDER") {
    targetUrl = "/vendor/orders";
  } else if (data.type === "NEW_VENDOR") {
    targetUrl = "/admin/vendors";
  } else if (data.url) {
    targetUrl = data.url;
  }

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
