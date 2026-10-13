// Recovery touches only downloaded application files, never account or workout data.
(function () {
  var base = new URL('./', document.currentScript.src).pathname;
  window.elanRepair = async function () {
    var status = document.getElementById('elan-repair-status');
    if (status) status.textContent = 'Rechargement de l’application…';
    try {
      if (!navigator.onLine) throw new Error('offline');
      // Verify deployment availability before removing downloaded application files.
      var response = await fetch(base + 'version.json?repair=' + Date.now(), {cache: 'no-store'});
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) throw new Error('network');
      if ('serviceWorker' in navigator) {
        var registrations = await navigator.serviceWorker.getRegistrations();
        for (var registration of registrations) {
          if (registration.scope === location.origin + base) await registration.unregister();
        }
      }
      if ('caches' in window) {
        var keys = await caches.keys();
        for (var key of keys) if (key.startsWith('elan-static-' + base + '-')) await caches.delete(key);
      }
      location.reload();
    } catch (_) {
      if (status) status.textContent = 'Rechargement impossible. Vérifie ta connexion puis réessaie. Tes données sont conservées.';
    }
  };
  window.elanShowBootError = function () {
    var root = document.getElementById('root');
    var fallback = document.getElementById('elan-boot-fallback');
    if (fallback && root && !root.childElementCount) fallback.hidden = false;
  };
  window.addEventListener('error', window.elanShowBootError);
  setTimeout(window.elanShowBootError, 10000);
})();
