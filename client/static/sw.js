self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (e) => {
  console.log('activate');
  e.waitUntil(self.clients.claim());
});