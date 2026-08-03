// Firebase requires this exact filename/path — it's registered separately
// from the app's own bundle (service workers can't use ES module imports,
// hence the compat/importScripts build here instead of the regular SDK).
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

// Same public config as src/config/firebase.js — duplicated because this
// file runs in a separate worker context that can't import from the app.
firebase.initializeApp({
    apiKey: 'AIzaSyBt-1BK_o2yOMu-sA5kYdL0bb7QkyofQuI',
    authDomain: 'mitrata-app.firebaseapp.com',
    projectId: 'mitrata-app',
    storageBucket: 'mitrata-app.firebasestorage.app',
    messagingSenderId: '571194128097',
    appId: '1:571194128097:web:765e7633f57765288569a0',
});

const messaging = firebase.messaging();

// Fires when a push arrives while no tab is focused/visible — this is the
// whole point of FCM over the in-tab Notification API added earlier this
// session, which only works while a tab is at least open in the background.
messaging.onBackgroundMessage((payload) => {
    const isMessage = payload.data?.type === 'message';
    self.registration.showNotification(payload.notification?.title || 'Mitrata', {
        body: payload.notification?.body,
        icon: '/favicon-192.png',
        data: payload.data,
        // Chrome doesn't support inline text-reply actions the way Android
        // does, so this is "Mark as read" + implicit "Open" (default click)
        // only — matches the plan's scoped-down web version.
        actions: isMessage ? [{ action: 'mark_read', title: 'Mark as read' }] : [],
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};

    if (event.action === 'mark_read' && data.senderId) {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then((clients) => {
                // Piggyback on an already-open tab's auth if there is one —
                // a bare service worker has no access to localStorage's
                // token/cookie the way the app's own fetch calls do.
                const client = clients[0];
                if (client) {
                    client.postMessage({ type: 'mark_read', senderId: data.senderId });
                }
            })
        );
        return;
    }

    // Default click (or "Open"): focus an existing tab, or open a new one
    // straight to that conversation.
    const url = data.username ? `/messaging/${data.username}` : '/dashboard';
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) return client.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});
