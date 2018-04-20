self.swag();
declare var self: ServiceWorkerGlobalScope;

self.addEventListener('activate', () => {
  return self.clients.claim();
});