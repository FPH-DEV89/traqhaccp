/**
 * TraqHACCP Pro — Infrastructure — Configuration de persistance (docs/DATA.md).
 *
 * Ce module n'expose que des constantes et des fonctions pures : aucun effet de bord à
 * l'import, aucune requête réseau, aucune écriture de stockage. Il peut donc être importé
 * sans risque par un module de présentation, un test Node ou un script d'outillage.
 *
 * ── Persistance connectée à Supabase ──────────────────────────────────────────
 *   L'application est connectée à Supabase (PostgREST + GoTrue) : multi-postes,
 *   synchronisation temps réel, et cloisonnement strict par établissement assuré
 *   par les politiques RLS.
 *
 *   En PWA hors-ligne, les données de l'établissement connecté sont mises en cache
 *   dans le navigateur pour continuer l'activité du laboratoire sans interruption.
 *
 * ── Pourquoi la clé publique est-elle sans danger dans un dépôt public ? ─────
 * SUPABASE_PUBLISHABLE_KEY est une clé « publishable », conçue pour être embarquée dans
 * un navigateur : elle figure de toute façon dans les requêtes du premier visiteur, la
 * masquer n'apporterait aucune sécurité. Elle ne confère AUCUN droit par elle-même.
 * L'autorisation est décidée par les politiques RLS de supabase/migrations/0001_init.sql,
 * évaluées à partir du JWT de l'utilisateur connecté : chaque requête est bornée à
 * l'établissement de cet utilisateur, et une requête anonyme ne lit rien.
 * En revanche, la clé `service_role` contourne RLS : elle ne doit JAMAIS apparaître ici.
 */

/** URL du projet Supabase (PostgREST + GoTrue). */
export const SUPABASE_URL = 'https://hxwwihttelptohorakto.supabase.co';

/** Clé publique « publishable » / anon — destinée au navigateur, protégée par RLS côté serveur. */
export const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4d3dpaHR0ZWxwdG9ob3Jha3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MDczODMsImV4cCI6MjEwNTI4MzM4M30.Px-2i-M0F135a0P1ZWzFIaZAidXGquQSo_a2I85C1xg';

/* ═══════════════════════════════════════════════════════════════════
   Clés localStorage — préfixe commun, suffixes DISTINCTS de la v3
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Préfixe de toutes les clés propres à la couche serveur.
 *
 * storage_repository.js écrit `traqhaccp_v2_<section>` (ex. `traqhaccp_v2_session`,
 * `traqhaccp_v2_equipments`). Aucune clé ci-dessous ne réutilise un suffixe existant :
 * brancher le mode serveur ne peut donc pas écraser les données locales d'un utilisateur.
 */
export const SUPABASE_PREFIXE = 'traqhaccp_v2_';

/** Clé de session GoTrue (JWT + refresh_token + utilisateur). Suffixe propre à l'auth. */
export const SUPABASE_CLE_SESSION = `${SUPABASE_PREFIXE}auth_session`;

/** Clé de l'état d'interface (opérateur au comptoir, verrouillage) en mode serveur. */
export const SUPABASE_CLE_ETAT = `${SUPABASE_PREFIXE}serveur_session`;

/** Clé permettant de forcer le mode de persistance sans redéployer le code. */
export const SUPABASE_CLE_MODE = `${SUPABASE_PREFIXE}mode`;

/** Clé de l'identifiant d'établissement choisi dans un contexte multi-établissement. */
export const SUPABASE_CLE_ETABLISSEMENT = `${SUPABASE_PREFIXE}establishment_id`;

/* ═══════════════════════════════════════════════════════════════════
   Mode de persistance (Supabase exclusivement)
   ═══════════════════════════════════════════════════════════════════ */

/** @type {'serveur'} Mode unique en production (PWA connectée à Supabase). */
export const MODE_PERSISTANCE = 'serveur';

/** Alias anglais de MODE_PERSISTANCE, pour les appelants qui testent un drapeau. */
export const PERSISTENCE_MODE = MODE_PERSISTANCE;

/** Modes acceptés : exclusivement serveur (Supabase). */
export const MODES_PERSISTANCE = Object.freeze(['serveur']);

/**
 * Normalise le mode de persistance : toujours 'serveur' (Supabase).
 * @returns {'serveur'}
 */
export function normaliserMode() {
  return 'serveur';
}

/**
 * Mode demandé par l'URL de la page.
 * @returns {'serveur' | null}
 */
export function modeParametreUrl() {
  return 'serveur';
}

/**
 * Recopie dans `localStorage` le mode demandé par `?mode=…`, pour qu'il survive à un
 * rechargement de PWA (la chaîne de requête n'est pas conservée par le raccourci installé).
 *
 * Fonction à effet de bord, volontairement séparée : `modePersistance()` doit rester pure.
 * Appelée une fois au démarrage (voir `boot()` dans src/presentation/context.js).
 *
 * @returns {'local' | 'serveur' | null} mode appliqué, ou null si aucun paramètre d'URL.
 */
export function appliquerSurchargeModeUrl() {
  const depuisUrl = modeParametreUrl();
  if (depuisUrl === null) return null;
  ecrireStockage(SUPABASE_CLE_MODE, depuisUrl);
  return depuisUrl;
}

/**
 * Retire le paramètre `?mode=…` de l'URL courante (entrée d'historique remplacée).
 *
 * Nécessaire dès qu'un choix EXPLICITE contredit l'URL : sur `index.html?mode=serveur`,
 * « Continuer sans compte » persiste le mode local puis recharge — sans ce nettoyage,
 * la surcharge d'URL reprendrait la main et l'utilisateur reviendrait sur le portail
 * de connexion en boucle.
 *
 * @returns {boolean} Vrai si un paramètre `mode` a effectivement été retiré.
 */
export function retirerModeUrl() {
  try {
    if (typeof window === 'undefined' || !window.location || !window.history
      || typeof window.history.replaceState !== 'function') return false;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('mode')) return false;
    url.searchParams.delete('mode');
    const reste = url.searchParams.toString();
    window.history.replaceState(null, '', `${url.pathname}${reste ? `?${reste}` : ''}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mode de persistance effectif, par ordre de priorité décroissant :
 *   1. paramètre d'URL `?mode=…` (voir modeParametreUrl) ;
 *   2. surcharge persistante `localStorage['traqhaccp_v2_mode']` ;
 *   3. constante `MODE_PERSISTANCE` de ce fichier.
 *
 * Fonction pure et sans effet de bord : elle lit, elle n'écrit jamais (la persistance du
 * paramètre d'URL est le rôle explicite de `appliquerSurchargeModeUrl()`).
 * Ne lève jamais : un stockage indisponible laisse le mode par défaut.
 * @returns {'local' | 'serveur'}
 */
export function modePersistance() {
  return 'serveur';
}

/** @returns {boolean} Vrai si le mode serveur (Supabase) est actif. */
export function estModeServeur() {
  return true;
}

/**
 * Définit le mode de persistance (fixé sur serveur).
 * @returns {'serveur'}
 */
export function definirModePersistance() {
  return 'serveur';
}

/* ═══════════════════════════════════════════════════════════════════
   Accès au stockage du navigateur — sûr hors navigateur (tests Node)
   ═══════════════════════════════════════════════════════════════════ */

/** @returns {Storage | null} localStorage si disponible, sinon null (Node, mode privé). */
export function stockageLocal() {
  try {
    return typeof localStorage === 'undefined' || localStorage === null ? null : localStorage;
  } catch {
    return null; // accès refusé (cookies bloqués, iframe cloisonnée…)
  }
}

/**
 * Lit une valeur JSON. Ne lève jamais : renvoie le défaut en cas d'absence ou de corruption.
 * @param {string} cle
 * @param {unknown} defaut
 * @returns {unknown}
 */
export function lireStockage(cle, defaut = null) {
  const stockage = stockageLocal();
  if (!stockage) return defaut;
  try {
    const brut = stockage.getItem(cle);
    return brut === null || brut === undefined ? defaut : JSON.parse(brut);
  } catch {
    return defaut;
  }
}

/**
 * Écrit une valeur JSON.
 * @param {string} cle
 * @param {unknown} valeur
 * @returns {boolean} Vrai si l'écriture a abouti.
 */
export function ecrireStockage(cle, valeur) {
  const stockage = stockageLocal();
  if (!stockage) return false;
  try {
    stockage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false; // quota dépassé ou mode privé : l'appelant décide de la suite
  }
}

/**
 * Supprime une clé.
 * @param {string} cle
 * @returns {boolean}
 */
export function supprimerStockage(cle) {
  const stockage = stockageLocal();
  if (!stockage) return false;
  try {
    stockage.removeItem(cle);
    return true;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Assemblage prêt à l'emploi
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Configuration complète de la couche serveur.
 * @type {{ url: string, clePublique: string, cleSession: string, cleEtat: string,
 *          cleMode: string, cleEtablissement: string, mode: 'local' | 'serveur' }}
 */
export const CONFIG_SUPABASE = Object.freeze({
  url: SUPABASE_URL,
  clePublique: SUPABASE_PUBLISHABLE_KEY,
  cleSession: SUPABASE_CLE_SESSION,
  cleEtat: SUPABASE_CLE_ETAT,
  cleMode: SUPABASE_CLE_MODE,
  cleEtablissement: SUPABASE_CLE_ETABLISSEMENT,
  mode: MODE_PERSISTANCE,
});

/**
 * Indique si la couche serveur est configurée (URL + clé présentes).
 * @returns {boolean}
 */
export function serveurConfigure() {
  return /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.length > 20;
}
