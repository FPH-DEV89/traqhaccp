/**
 * TraqHACCP Pro — Infrastructure — Configuration de persistance (docs/DATA.md).
 *
 * Ce module n'expose que des constantes et des fonctions pures : aucun effet de bord à
 * l'import, aucune requête réseau, aucune écriture de stockage. Il peut donc être importé
 * sans risque par un module de présentation, un test Node ou un script d'outillage.
 *
 * ── Deux modes de persistance, un seul comportement par défaut ───────────────
 *   'local'   → LocalStorageHACCPRepository : mode historique (hors-ligne, sans compte,
 *               données de démonstration si le stockage est vide). C'est la valeur livrée
 *               ici : rien ne change pour l'application existante.
 *   'serveur' → SupabaseHACCPRepository : PostgREST + GoTrue, plusieurs appareils,
 *               cloisonnement par établissement assuré par les politiques RLS.
 *
 * Le mode peut être forcé sans modifier ce fichier : `localStorage['traqhaccp_v2_mode']`
 * vaut 'serveur' ou 'local' (voir modePersistance()).
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

/** Clé publique « publishable » — destinée au navigateur, protégée par RLS côté serveur. */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NftW2hr_BNKyP6qDtbBGhA_oudnoNTG';

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
   Mode de persistance
   ═══════════════════════════════════════════════════════════════════ */

/** @type {'local' | 'serveur'} Mode livré par défaut (comportement historique). */
export const MODE_PERSISTANCE = 'local';

/** Alias anglais de MODE_PERSISTANCE, pour les appelants qui testent un drapeau. */
export const PERSISTENCE_MODE = MODE_PERSISTANCE;

/** Modes acceptés. */
export const MODES_PERSISTANCE = Object.freeze(['local', 'serveur']);

/**
 * Normalise une valeur quelconque en mode valide.
 * Tout ce qui n'est pas explicitement 'serveur' retombe sur 'local' : le défaut sûr.
 * @param {unknown} valeur
 * @returns {'local' | 'serveur'}
 */
export function normaliserMode(valeur) {
  return String(valeur ?? '').trim().toLowerCase() === 'serveur' ? 'serveur' : 'local';
}

/**
 * Mode de persistance effectif : surcharge locale (facultative) sinon valeur de ce fichier.
 * Ne lève jamais : un stockage indisponible laisse le mode par défaut.
 * @returns {'local' | 'serveur'}
 */
export function modePersistance() {
  const force = lireStockage(SUPABASE_CLE_MODE, null);
  return force === null ? normaliserMode(MODE_PERSISTANCE) : normaliserMode(force);
}

/** @returns {boolean} Vrai si le mode serveur (Supabase) est actif. */
export function estModeServeur() {
  return modePersistance() === 'serveur';
}

/**
 * Force le mode de persistance (pour un poste donné).
 * @param {'local' | 'serveur'} mode
 * @returns {'local' | 'serveur'} le mode retenu
 */
export function definirModePersistance(mode) {
  const retenu = normaliserMode(mode);
  ecrireStockage(SUPABASE_CLE_MODE, retenu);
  return retenu;
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
