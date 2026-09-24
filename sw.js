/**
 * sw.js — Service worker TraqHACCP (registre sanitaire hors-ligne).
 *
 * Stratégie :
 *   - navigations (patisserie.html, index.html) → réseau d'abord (le registre doit être à jour),
 *     repli sur le cache puis sur la page livrée si le réseau est absent ;
 *   - assets applicatifs same-origin (CSS, modules ES, favicon) → réseau d'abord pour le code
 *     (.js/.css, pour ne jamais servir un module périmé à un client en ligne), cache d'abord pour
 *     le reste ;
 *   - Tailwind (cdn.tailwindcss.com) → mis en cache explicitement : c'est LUI qui peint l'app.
 *     Sans lui, le registre s'affiche hors-ligne mais totalement dé-stylé ;
 *   - polices Google Fonts → cache d'abord, en secours seulement (repli système acceptable).
 *
 * Deux pièges corrigés ici, tous deux mortels pour l'hors-ligne :
 *   1. `cache.addAll()` est TOUT-OU-RIEN : un seul 404 (c'était le cas de './patisserie', qui
 *      n'existe que via la réécriture Vercel) rejette install(), le worker est jeté et l'app
 *      n'a plus aucun hors-ligne. On télécharge donc chaque entrée isolément et on ignore les
 *      échecs, qui sont journalisés.
 *   2. Une réponse opaque (tierce) ne peut PAS entrer dans `addAll` (statut 0 ≠ 2xx), mais
 *      `cache.put()` l'accepte. Tailwind est donc récupéré en `no-cors` puis rangé à la main.
 *
 * Les chemins ci-dessous correspondent aux fichiers RÉELLEMENT référencés par l'app livrée
 * (patisserie.html → js/patisserie/app.js → fermeture d'imports).
 */
const CACHE_NAME = 'traqhaccp-patisserie-20260924-v9';

/** Assets same-origin réellement chargés par patisserie.html. */
const ASSETS_TO_CACHE = [
  './patisserie.html',
  './manifest.json',
  './assets/favicon.svg',
  // Design system (chargé par patisserie.html)
  './css/tokens.css',
  './css/components.css',
  './css/views.css',

  // Entrée applicative + ses 11 modules
  './js/patisserie/app.js',
  './js/patisserie/audio-toast.js',
  './js/patisserie/auth.js',
  './js/patisserie/calculations.js',
  './js/patisserie/modals.js',
  './js/patisserie/recall.js',
  './js/patisserie/state.js',
  './js/patisserie/views.js',
  './js/patisserie/settings.js',
  './js/patisserie/settings-data.js',
  './js/patisserie/settings-norms.js',
  './js/patisserie/notifications.js',
  // Socle importé par js/patisserie (fermeture d'imports réelle)
  './src/domain/constants.js',
  './src/domain/haccp_norms.js',
  './src/infrastructure/config.js',
  './src/infrastructure/supabase_client.js',
  './src/presentation/connexion.js',
  './src/presentation/icons.js',
  './src/presentation/ui.js',
];

/** Tiers indispensable au rendu : sans lui l'app est peinte mais nue. */
const CDN_CRITIQUE = ['cdn.tailwindcss.com'];
/** Tiers d'agrément : repli police système si absent. */
const TIERS_SECONDAIRES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Same-origin : entrée par entrée, pour qu'un 404 n'emporte pas tout le cache.
    await Promise.all(ASSETS_TO_CACHE.map(async (chemin) => {
      try {
        const reponse = await fetch(new Request(chemin, { cache: 'reload' }));
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        await cache.put(chemin, reponse);
      } catch (erreur) {
        console.warn(`[SW] non mis en cache : ${chemin} (${erreur.message})`);
      }
    }));

    // Tiers critique : réponse opaque acceptée par cache.put(), refusée par addAll().
    // La clé est normalisée par l'API Cache (ajout d'un « / » final) exactement comme l'est
    // l'URL réellement demandée par la balise <script>, donc cache.match() retrouvera l'entrée.
    await Promise.all(CDN_CRITIQUE.map(async (hote) => {
      const url = `https://${hote}`;
      try {
        const reponse = await fetch(url, { mode: 'no-cors', cache: 'reload' });
        await cache.put(url, reponse);
      } catch (erreur) {
        console.warn(`[SW] CDN non mis en cache : ${url} (${erreur.message})`);
      }
    }));

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

/**
 * Clic sur une alerte de service : ramener le registre au premier plan plutôt que
 * d'ouvrir un second onglet. Si l'application n'est plus ouverte, on la relance.
 */
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  evenement.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const fenetre of fenetres) {
      if ('focus' in fenetre) {
        await fenetre.focus();
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow('./patisserie.html');
    }
  })());
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  const memeOrigine = url.origin === self.location.origin;

  // Tiers : Tailwind est vital (cache d'abord), les polices sont un confort.
  if (!memeOrigine) {
    if (CDN_CRITIQUE.includes(url.hostname)) {
      evenement.respondWith(cacheDAbord(requete));
      return;
    }
    if (TIERS_SECONDAIRES.includes(url.hostname)) {
      evenement.respondWith(cacheDAbord(requete));
      return;
    }
    return; // autre tiers : réseau direct
  }

  const navigation = requete.mode === 'navigate' || requete.destination === 'document'
    || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/patisserie.html');
  const codeApp = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  evenement.respondWith(navigation || codeApp ? reseauDAbord(requete) : cacheDAbord(requete));
});

/** Réseau d'abord (document et modules JS) : repli cache, puis page livrée hors-ligne. */
async function reseauDAbord(requete) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const reponse = await fetch(requete);
    if (reponse && reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch (erreur) {
    return (await cache.match(requete, { ignoreSearch: true }))
      || (await cache.match('./patisserie.html'))
      || (await cache.match('./index.html'))
      || Response.error();
  }
}

/** Cache d'abord (images, polices, CDN) : réseau en secours, puis page livrée hors-ligne. */
async function cacheDAbord(requete) {
  const cache = await caches.open(CACHE_NAME);
  const enCache = await cache.match(requete, { ignoreSearch: true });
  if (enCache) return enCache;
  try {
    const reponse = await fetch(requete);
    if (reponse && (reponse.ok || reponse.type === 'opaque')) cache.put(requete, reponse.clone());
    return reponse;
  } catch (erreur) {
    return (await cache.match('./patisserie.html')) || (await cache.match('./index.html')) || Response.error();
  }
}
