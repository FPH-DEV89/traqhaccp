/**
 * TraqHACCP Pâtisserie — Synchronisation du registre vers Supabase.
 *
 * Principe : le local reste la source de vérité HORS-LIGNE — le registre doit
 * rester consultable au froid, sans réseau, c'est la promesse de l'app. Supabase
 * est le miroir partagé : sauvegarde de l'établissement et même registre sur
 * plusieurs appareils.
 *
 * Rien ici n'est indispensable au rendu. Toute erreur réseau est absorbée, la
 * file d'attente est conservée sur l'appareil et rejouée au retour du réseau.
 *
 * Modèle : une ligne serveur par enregistrement, clé
 * (establishment_id, collection, record_id), colonne payload jsonb.
 *   - envoi : on ne pousse que ce qui a changé depuis le dernier état connu
 *     (le « miroir »), et un enregistrement disparu du local devient un jeton
 *     `deleted` — sans jeton, l'appareil voisin le ressusciterait ;
 *   - réception : fusion « dernier écrit gagne » sur l'horodatage SERVEUR
 *     (jamais celui du client, qui pourrait antidater).
 *
 * Limite connue : `traq_settings` n'est pas cloisonné par établissement côté
 * local (antérieur à cette couche). Un marqueur de propriétaire empêche de
 * pousser les réglages d'un établissement vers un autre.
 */
import { supabase } from '../../src/infrastructure/supabase_client.js';
import { state, saveState, brancherSauvegarde } from './state.js';
import { STORAGE_KEYS } from '../../src/domain/constants.js';

/** Collections du registre : clé de colonne serveur → champ de `state`. */
const COLLECTIONS = [
  { collection: 'lots', champ: 'lots' },
  { collection: 'recipes', champ: 'recipes' },
  { collection: 'secondaryDlcs', champ: 'secondaryDlcs' },
  { collection: 'witnessSamples', champ: 'witnessSamples' },
  { collection: 'salesHistory', champ: 'salesHistory' },
  { collection: 'teamMembers', champ: 'teamMembers' },
  // Réglages : un seul enregistrement, hors `state`, lu dans localStorage.
  { collection: 'reglages', champ: null },
];

const CHAMP_PAR_COLLECTION = Object.fromEntries(
  COLLECTIONS.filter((c) => c.champ).map((c) => [c.collection, c.champ]),
);

const TABLE = 'registry_records';
const ID_REGLAGES = 'etablissement';
const DELAI_ENVOI = 1200;
const TAILLE_PAGE = 500;
const PAGES_MAX = 40; // plafond de sécurité : 20 000 enregistrements

let minuteur = null;
let enCours = false;
let demarre = false;
let dernierBilan = null;

/* ─────────────────────────── Outils locaux ─────────────────────────── */

/** Les clés locales sont cloisonnées par établissement, comme `state.js`. */
function cleLocale(suffixe) {
  const portee = state.establishmentId || 'serveur';
  return `traqhaccp_patisserie_${portee}_${suffixe}_v1`;
}

const CLE_PROPRIETAIRE_REGLAGES = 'traqhaccp_patisserie_reglages_proprietaire_v1';

function lireJson(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch (erreur) {
    console.warn('[Sync] lecture locale impossible :', erreur && erreur.message);
    return defaut;
  }
}

function ecrireJson(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (erreur) {
    console.warn('[Sync] écriture locale impossible :', erreur && erreur.message);
    return false;
  }
}

const lireMiroir = () => lireJson(cleLocale('sync_miroir'), {});
const ecrireMiroir = (miroir) => ecrireJson(cleLocale('sync_miroir'), miroir);
const lireFile = () => lireJson(cleLocale('sync_file'), []);
const ecrireFile = (file) => ecrireJson(cleLocale('sync_file'), file);

/** Les réglages vivent sous une clé globale (`src/domain/constants.js`). */
function lireReglages() {
  try {
    const brut = localStorage.getItem(STORAGE_KEYS.settings);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

function ecrireReglages(reglages) {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(reglages));
    return true;
  } catch (erreur) {
    console.warn('[Sync] réglages non écrits :', erreur && erreur.message);
    return false;
  }
}

/* ─────────────────────── Conditions d'activation ───────────────────── */

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La synchronisation n'a de sens que sur un établissement réel (uuid servi par
 * `memberships`) et avec une session. Hors de ces cas le local reste seul maître
 * et rien n'est poussé — sans quoi RLS rejetterait l'écriture de toute façon.
 */
export function syncActive() {
  return MOTIF_UUID.test(String(state.establishmentId || '')) && !!supabase.hasSession();
}

/* ────────────────────────── Détection des écarts ───────────────────── */

/**
 * Compare l'état local au dernier état connu et met en file ce qui a bougé.
 * C'est le seul endroit qui décide « il y a quelque chose à envoyer ».
 * @returns {number} nombre d'opérations mises en file
 */
export function detecterChangements() {
  if (!syncActive()) return 0;

  const miroir = lireMiroir();
  const file = lireFile();
  const index = new Map(file.map((operation) => [`${operation.collection}::${operation.record_id}`, operation]));
  const maintenant = new Date().toISOString();
  const ajouter = (operation) => {
    index.set(`${operation.collection}::${operation.record_id}`, operation);
  };

  for (const { collection, champ } of COLLECTIONS) {
    const table = miroir[collection] || (miroir[collection] = {});

    if (collection === 'reglages') {
      // Les réglages ne partent que si le blob local est attribué à CET
      // établissement : sinon on écraserait les réglages du voisin.
      if (localStorage.getItem(CLE_PROPRIETAIRE_REGLAGES) !== String(state.establishmentId)) continue;
      const reglages = lireReglages();
      if (!reglages) continue;
      const json = JSON.stringify(reglages);
      const entree = table[ID_REGLAGES];
      if (!entree || entree.json !== json) {
        table[ID_REGLAGES] = { maj: maintenant, json, supprime: false };
        ajouter({ collection, record_id: ID_REGLAGES, payload: reglages, deleted: false });
      }
      continue;
    }

    const vus = new Set();
    for (const enregistrement of state[champ] || []) {
      if (!enregistrement || enregistrement.id === undefined || enregistrement.id === null) continue;
      const id = String(enregistrement.id);
      vus.add(id);
      const json = JSON.stringify(enregistrement);
      const entree = table[id];
      if (!entree || entree.json !== json) {
        table[id] = { maj: maintenant, json, supprime: false };
        ajouter({ collection, record_id: id, payload: enregistrement, deleted: false });
      }
    }
    // Disparu du local : jeton de suppression, pas d'oubli silencieux.
    for (const id of Object.keys(table)) {
      if (vus.has(id) || table[id].supprime) continue;
      table[id] = { maj: maintenant, json: table[id].json, supprime: true };
      ajouter({ collection, record_id: id, payload: null, deleted: true });
    }
  }

  ecrireMiroir(miroir);
  const operations = [...index.values()];
  ecrireFile(operations);
  return operations.length;
}

/* ─────────────────────────────── Envoi ─────────────────────────────── */

/**
 * Vide réellement la file : un envoi encore en attente de son minuteur est
 * déclenché d'abord — sinon « vider » rendrait la main sur une file vide et la
 * modification resterait sur l'appareil.
 * Pousse la file d'attente par lots (un appel par collection). Ce qui échoue
 * reste en file : aucun enregistrement ne peut être perdu par une coupure.
 * @returns {Promise<{envoyes: number, restants: number}>}
 */
export async function viderFile() {
  if (minuteur) {
    clearTimeout(minuteur);
    minuteur = null;
  }
  detecterChangements();

  const file = lireFile();
  if (!file.length || !syncActive() || enCours) return { envoyes: 0, restants: file.length };

  enCours = true;
  const parCollection = new Map();
  for (const operation of file) {
    if (!parCollection.has(operation.collection)) parCollection.set(operation.collection, []);
    parCollection.get(operation.collection).push(operation);
  }

  const clesEnvoyees = new Set();
  const clesEchouees = new Set();
  const cle = (o) => `${o.collection}::${o.record_id}`;

  try {
    for (const [collection, operations] of parCollection) {
      const lignes = operations.map((operation) => ({
        establishment_id: state.establishmentId,
        collection,
        record_id: operation.record_id,
        payload: operation.payload ?? {},
        deleted: !!operation.deleted,
      }));
      try {
        const renvoyees = await supabase.insert(TABLE, lignes, {
          upsert: true,
          onConflict: 'establishment_id,collection,record_id',
        });
        operations.forEach((operation) => clesEnvoyees.add(cle(operation)));
        // L'horodatage serveur fait foi : on le recopie dans le miroir pour que
        // la comparaison « qui est le plus récent » reste juste.
        const miroir = lireMiroir();
        for (const ligne of renvoyees || []) {
          const table = miroir[ligne.collection] || (miroir[ligne.collection] = {});
          const entree = table[ligne.record_id];
          if (entree) entree.maj = ligne.updated_at;
        }
        ecrireMiroir(miroir);
      } catch (erreur) {
        operations.forEach((operation) => clesEchouees.add(cle(operation)));
        console.warn(`[Sync] envoi différé (${collection}) :`, erreur && erreur.message);
      }
    }
  } finally {
    enCours = false;
  }

  // On ne retire de la file que ce qui est parti : les opérations arrivées
  // pendant l'envoi, ou en échec, restent pour le prochain passage.
  const restants = lireFile().filter((operation) => !clesEnvoyees.has(cle(operation)) || clesEchouees.has(cle(operation)));
  ecrireFile(restants);
  return { envoyes: clesEnvoyees.size - clesEchouees.size, restants: restants.length };
}

/** Envoi différé : une rafale de modifications ne produit qu'un seul appel. */
export function planifierEnvoi() {
  if (!syncActive()) return;
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    minuteur = null;
    detecterChangements();
    viderFile().catch(() => {});
  }, DELAI_ENVOI);
}

/* ───────────────────────────── Réception ───────────────────────────── */

/**
 * Rattache le blob local de réglages à l'établissement courant, s'il n'appartient
 * à personne et que le serveur n'en a pas. Empêche la contamination entre
 * établissements d'un même compte.
 */
function attribuerReglages(lignes) {
  const etablissement = String(state.establishmentId);
  if (localStorage.getItem(CLE_PROPRIETAIRE_REGLAGES) === etablissement) return;
  const serveur = lignes.find((ligne) => ligne.collection === 'reglages' && !ligne.deleted);
  if (serveur) return; // le serveur fait foi : la fusion appliquera sa version
  if (lireReglages()) localStorage.setItem(CLE_PROPRIETAIRE_REGLAGES, etablissement);
}

/**
 * Lit tout le registre serveur (paginé) et fusionne dans l'état local.
 * Le serveur ne gagne que s'il est plus récent que le miroir — une
 * modification locale non encore envoyée n'est jamais écrasée.
 * @returns {Promise<{ok: boolean, adoptes: number, lus: number, raison?: string}>}
 */
export async function recevoirRegistre() {
  if (!syncActive()) return { ok: false, adoptes: 0, lus: 0, raison: 'hors-ligne-ou-etablissement-local' };

  let lus = 0;
  let adoptes = 0;
  let curseur = '';
  const lignes = [];
  const vues = new Set();

  for (let page = 0; page < PAGES_MAX; page += 1) {
    const filtres = curseur ? { updated_at: `gte.${curseur}` } : {};
    const lot = await supabase.select(TABLE, {
      colonnes: 'collection,record_id,payload,deleted,updated_at',
      filtres,
      ordre: 'updated_at.asc',
      limite: TAILLE_PAGE,
    });
    const rang = Array.isArray(lot) ? lot : [];
    for (const ligne of rang) {
      const signature = `${ligne.collection}::${ligne.record_id}`;
      lus += 1;
      if (vues.has(signature)) continue; // recouvrement de page : on déduplique
      vues.add(signature);
      lignes.push(ligne);
    }
    const dernier = rang[rang.length - 1];
    if (!dernier || rang.length < TAILLE_PAGE || dernier.updated_at === curseur) break;
    curseur = dernier.updated_at;
  }

  attribuerReglages(lignes);

  const miroir = lireMiroir();
  for (const ligne of lignes) {
    const table = miroir[ligne.collection] || (miroir[ligne.collection] = {});
    const entree = table[ligne.record_id];
    const fraicheurServeur = Date.parse(ligne.updated_at) || 0;
    const fraicheurLocale = entree && entree.maj ? Date.parse(entree.maj) || 0 : 0;
    if (entree && fraicheurLocale >= fraicheurServeur) continue; // le local est plus récent

    if (ligne.deleted) {
      const champ = CHAMP_PAR_COLLECTION[ligne.collection];
      if (champ) {
        state[champ] = (state[champ] || []).filter((x) => String(x.id) !== String(ligne.record_id));
      }
      table[ligne.record_id] = { maj: ligne.updated_at, json: '', supprime: true };
      adoptes += 1;
      continue;
    }

    const champ = CHAMP_PAR_COLLECTION[ligne.collection];
    if (champ) {
      state[champ] = state[champ] || [];
      const position = state[champ].findIndex((x) => String(x.id) === String(ligne.record_id));
      if (position >= 0) state[champ][position] = ligne.payload;
      else state[champ].push(ligne.payload);
    } else if (ligne.collection === 'reglages') {
      ecrireReglages(ligne.payload);
      localStorage.setItem(CLE_PROPRIETAIRE_REGLAGES, String(state.establishmentId));
    }
    table[ligne.record_id] = { maj: ligne.updated_at, json: JSON.stringify(ligne.payload), supprime: false };
    adoptes += 1;
  }

  ecrireMiroir(miroir);
  if (adoptes) saveState();
  return { ok: true, adoptes, lus };
}

/* ───────────────────────────── Orchestration ───────────────────────── */

/**
 * Cycle complet : pousser ce qui attend, puis adopter ce que le serveur a de
 * plus récent. Ne rejette jamais : l'app fonctionne hors-ligne, la sync est un
 * bonus qui se rattrape tout seul.
 */
export async function synchroniser() {
  if (!syncActive()) {
    dernierBilan = { ok: false, raison: 'hors-ligne-ou-etablissement-local', quand: new Date().toISOString() };
    return dernierBilan;
  }
  try {
    detecterChangements();
    const envoi = await viderFile();
    const reception = await recevoirRegistre();
    // Second passage : la réception vient peut-être d'attribuer les réglages
    // locaux à cet établissement, ou de révéler un écart. Sans lui, une
    // modification resterait en attente jusqu'à la prochaine sauvegarde.
    const rattrapage = detecterChangements() ? await viderFile() : { envoyes: 0, restants: 0 };
    dernierBilan = {
      ok: true,
      envoyes: envoi.envoyes + rattrapage.envoyes,
      restants: rattrapage.restants,
      adoptes: reception.adoptes,
      lus: reception.lus,
      quand: new Date().toISOString(),
    };
  } catch (erreur) {
    dernierBilan = {
      ok: false,
      raison: String((erreur && erreur.message) || erreur),
      quand: new Date().toISOString(),
    };
    console.warn('[Sync] cycle interrompu :', dernierBilan.raison);
  }
  return dernierBilan;
}

/** État courant, pour le diagnostic et les preuves de recette. */
export function etatSync() {
  return {
    actif: syncActive(),
    etablissement: String(state.establishmentId || ''),
    enAttente: lireFile().length,
    connecte: !!supabase.hasSession(),
    dernierBilan,
  };
}

/**
 * Branche la synchronisation : envoi après chaque sauvegarde locale, envoi des
 * reliquats au retour du réseau, et cycle complet quand l'app repasse au premier
 * plan. Idempotent.
 */
export function demarrerSync() {
  if (demarre) return;
  demarre = true;

  window.addEventListener('online', () => {
    synchroniser().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchroniser().catch(() => {});
    else viderFile().catch(() => {});
  });

  viderFile().catch(() => {});
}

// `state.js` ignore tout de la synchronisation : on lui branche ici le
// déclencheur, dès l'import du module, pour qu'aucune écriture locale ne
// puisse passer entre les mailles.
brancherSauvegarde(planifierEnvoi);
