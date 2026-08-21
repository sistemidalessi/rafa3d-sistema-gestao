// Service worker só pra notificação push de pedido novo — não faz cache
// nem funciona offline, é só a ponte que o navegador exige pra mostrar
// uma notificação mesmo com a aba fechada.
self.addEventListener('push', (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) { dados = { title: 'Rafa 3D', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(dados.title || 'Rafa 3D — Sistema de Gestão', {
      body: dados.body || '',
      icon: 'catalogo/assets/logo_clean.png',
      badge: 'catalogo/assets/logo_clean.png',
      data: { url: dados.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data && event.notification.data.url ? event.notification.data.url : './'));
});
