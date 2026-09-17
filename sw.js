/**
 * sw.js — Service worker TraqHACCP v4 (registre sanitaire hors-ligne).
 *
 * Stratégie :
 *   - index.html / navigations → réseau d'abord (le registre doit toujours être à jour),
 *     repli sur le cache puis sur la page d'entrée si le réseau est absent ;
 *   - assets applicatifs (CSS, modules ES, favicon) → cache d'abord, réseau en secours ;
 *   - requêtes tierces (Google Fonts, Tone.js) → non interceptées : l'app fonctionne
 *     sans elles, et mettre en cache des réponses opaques ferait échouer `addAll`.
 * Aucun build : les chemins ci-dessous correspondent aux fichiers réellement présents.
 */
const CACHE_NAME = 'traqhaccp-v4-mobile-trace-20260917-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.svg',
  // Design system
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/views.css',
  // Domaine
  './src/domain/constants.js',
  './src/domain/entities.js',
  './src/domain/haccp_norms.js',
  './src/domain/roles.js',
  // Application
  './src/application/account_usecases.js',
  './src/application/settings_usecases.js',
  './src/application/usecases.js',
  // Infrastructure
  './src/infrastructure/audio_service.js',
  './src/infrastructure/barcode_service.js',
  './src/infrastructure/camera_service.js',
  './src/infrastructure/export_label.js',
  './src/infrastructure/export_register.js',
  './src/infrastructure/export_service.js',
  './src/infrastructure/storage_repository.js',
  // Présentation — socle
  './src/presentation/context.js',
  './src/presentation/icons.js',
  './src/presentation/router.js',
  './src/presentation/shell.js',
  './src/presentation/store.js',
  './src/presentation/ui.js',
  // Présentation — les 17 modules de vue
  './src/presentation/views/dashboard.js',
  './src/presentation/views/checklists.js',
  './src/presentation/views/temperatures.js',
  './src/presentation/views/reception.js',
  './src/presentation/views/traceability.js',
  './src/presentation/views/allergens.js',
  './src/presentation/views/cleaning.js',
  './src/presentation/views/oil.js',
  './src/presentation/views/cooling.js',
  './src/presentation/views/defrost.js',
  './src/presentation/views/phweight.js',
  './src/presentation/views/documents.js',
  './src/presentation/views/nonconformities.js',
  './src/presentation/views/audit.js',
  './src/presentation/views/inspection.js',
  './src/presentation/views/compte.js',
  './src/presentation/views/reglages.js',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS_TO_CACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((nom) => nom !== CACHE_NAME).map((nom) => caches.delete(nom)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evenement) => {
  if (evenement.data && evenement.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // polices, Tone.js : réseau direct
  const navigation = requete.mode === 'navigate' || requete.destination === 'document'
    || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  evenement.respondWith(navigation ? reseauDAbord(requete) : cacheDAbord(requete));
});

/** Réseau d'abord (document) : repli cache, puis page d'entrée hors-ligne. */
async function reseauDAbord(requete) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const reponse = await fetch(requete);
    if (reponse && reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch (erreur) {
    return (await cache.match(requete, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

/** Cache d'abord (assets) : réseau en secours, puis page d'entrée hors-ligne. */
async function cacheDAbord(requete) {
  const cache = await caches.open(CACHE_NAME);
  const enCache = await cache.match(requete, { ignoreSearch: true });
  if (enCache) return enCache;
  try {
    const reponse = await fetch(requete);
    if (reponse && reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch (erreur) {
    return (await cache.match('./index.html')) || Response.error();
  }
}
