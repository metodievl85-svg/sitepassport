self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request))
})

self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()

  const title = data.title || 'NekaID'
  const options = {
    body: data.body || 'Don\'t forget to sign in on site today.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'morning-reminder',
    renotify: false,
    data: {
      url: data.url || '/worker'
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const url = event.notification.data?.url || '/worker'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
