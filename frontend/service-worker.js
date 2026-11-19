
// Smart Medicine Reminder Service Worker

self.addEventListener("push", event => {
    let data = {};

    if (event.data) {
        try {
            data = event.data.json();
        } catch {
            data = {
                title: "Medicine Reminder 💊",
                body: event.data.text()
            };
        }
    }

    const title = data.title || "Medicine Reminder 💊";

    const options = {
        body: data.body || "It's time to take your medicine.",
        icon: "images/medicine-icon.png",
        badge: "images/medicine-icon.png",
        data: {
            url: data.url || "dashboard.html"
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();

    const targetUrl = new URL(
        event.notification.data.url || "dashboard.html",
        self.registration.scope
    ).href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url === targetUrl && "focus" in client) {
                    return client.focus();
                }
            }

            return clients.openWindow(targetUrl);
        })
    );
});
