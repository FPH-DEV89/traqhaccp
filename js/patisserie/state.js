/**
 * TraqHACCP Pâtisserie — State & Persistence Layer
 */

export const state = {
  establishmentId: 'serveur',
  establishmentName: '',
  establishmentSub: '',
  lots: [],
  recipes: [],
  secondaryDlcs: [],
  witnessSamples: [],
  salesHistory: [],
  teamMembers: [],
  currentOperatorId: null,
  currentCategory: 'all',
  alertsOnly: false,
  pendingSaleRecipe: null,
  pendingSaleMultiplier: 1,
  lotToAdjust: null
};

const CLE_ETAB_COURANT = 'traqhaccp_patisserie_etab_courant_v1';

/** Enregistre l'établissement courant pour synchroniser la PWA hors-ligne. */
export function enregistrerEtablissementCourant() {
  try {
    localStorage.setItem(CLE_ETAB_COURANT, JSON.stringify({ id: state.establishmentId, nom: state.establishmentName }));
  } catch (e) {
    console.warn('Erreur de sauvegarde de l\'établissement courant :', e);
  }
}

/** Lit le dernier établissement courant connu, renvoie null si invalide. */
export function lireEtablissementCourant() {
  try {
    const raw = localStorage.getItem(CLE_ETAB_COURANT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && parsed.id) ? parsed : null;
  } catch (e) {
    console.warn('Erreur de lecture de l\'établissement courant :', e);
    return null;
  }
}

function storageKey(suffix) {
  const scope = state.establishmentId || 'serveur';
  return `traqhaccp_patisserie_${scope}_${suffix}_v1`;
}

/**
 * Notifié après chaque sauvegarde locale. Branché par `sync.js` plutôt
 * qu'importé : `sync.js` dépend déjà de ce module, un import en retour
 * fermerait un cycle.
 * @type {Function|null}
 */
let notifierSauvegarde = null;

/**
 * Branche la synchronisation distante.
 * @param {Function|null} fn
 */
export function brancherSauvegarde(fn) {
  notifierSauvegarde = typeof fn === 'function' ? fn : null;
}

export function saveState() {
  try {
    localStorage.setItem(storageKey('lots'), JSON.stringify(state.lots));
    localStorage.setItem(storageKey('recipes'), JSON.stringify(state.recipes));
    localStorage.setItem(storageKey('secondaryDlcs'), JSON.stringify(state.secondaryDlcs));
    localStorage.setItem(storageKey('witnessSamples'), JSON.stringify(state.witnessSamples));
    localStorage.setItem(storageKey('salesHistory'), JSON.stringify(state.salesHistory));
    localStorage.setItem(storageKey('teamMembers'), JSON.stringify(state.teamMembers));
    localStorage.setItem(storageKey('currentOperatorId'), JSON.stringify(state.currentOperatorId));
    localStorage.setItem(storageKey('establishmentName'), state.establishmentName);
  } catch (e) {
    console.warn('Erreur de sauvegarde locale :', e);
  }
  // Jamais bloquant : le local est déjà écrit, la synchronisation n'est qu'un
  // rattrapage. Un échec ici ne doit pas remonter à l'appelant.
  if (notifierSauvegarde) {
    try {
      notifierSauvegarde();
    } catch (e) {
      console.warn('Erreur de notification de synchronisation :', e);
    }
  }
}

export function loadState(etabId = 'serveur', etabName = null) {
  state.establishmentId = etabId || 'serveur';
  if (etabName) {
    state.establishmentName = etabName;
    state.establishmentSub = `${etabName} · Labo, Vente & Livraison`;
  }

  try {
    const rawLots = localStorage.getItem(storageKey('lots'));
    state.lots = rawLots ? JSON.parse(rawLots) : [];

    const rawRecipes = localStorage.getItem(storageKey('recipes'));
    state.recipes = rawRecipes ? JSON.parse(rawRecipes) : [];

    const rawSec = localStorage.getItem(storageKey('secondaryDlcs'));
    state.secondaryDlcs = rawSec ? JSON.parse(rawSec) : [];

    const rawWitness = localStorage.getItem(storageKey('witnessSamples'));
    state.witnessSamples = rawWitness ? JSON.parse(rawWitness) : [];

    const rawSales = localStorage.getItem(storageKey('salesHistory'));
    state.salesHistory = rawSales ? JSON.parse(rawSales) : [];

    const rawTeam = localStorage.getItem(storageKey('teamMembers'));
    state.teamMembers = rawTeam ? JSON.parse(rawTeam) : [];

    const rawOp = localStorage.getItem(storageKey('currentOperatorId'));
    state.currentOperatorId = rawOp ? JSON.parse(rawOp) : null;

    const savedName = localStorage.getItem(storageKey('establishmentName'));
    if (savedName && !etabName) {
      state.establishmentName = savedName;
      state.establishmentSub = `${savedName} · Labo, Vente & Livraison`;
    }
  } catch (e) {
    console.warn('Erreur de chargement local :', e);
  }

  enregistrerEtablissementCourant();
  normaliserIds();
  (state.lots || []).forEach(l => {
    if (l && l.dlcDate) l.status = computeLotStatus(l.dlcDate);
  });
}

/** Statut DLC recalculé depuis la date limite et l'horizon configuré (≤ 1j urgent, ≤ horizon warning). */
export function computeLotStatus(dlcDate, horizonDays = null) {
  if (!dlcDate) return 'conforme';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(`${String(dlcDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(limit.getTime())) return 'conforme';
  let horizon = Number(horizonDays);
  if (!Number.isFinite(horizon) || horizon <= 0) {
    try {
      const raw = localStorage.getItem('traq_settings');
      horizon = raw ? Number(JSON.parse(raw).alertHorizonDays) : 2;
    } catch { horizon = 2; }
  }
  const seuilWarn = Math.max(2, Number.isFinite(horizon) && horizon > 0 ? horizon : 2);
  const jours = Math.round((limit - today) / 86400000);
  if (jours <= 1) return 'urgent';
  if (jours <= seuilWarn) return 'warning';
  return 'conforme';
}

/**
 * Résout le lot FIFO à utiliser pour un ingrédient de recette :
 * utilise le lot lié s'il reste du stock, sinon bascule vers le lot actif
 * portant un nom correspondant à la DLC la plus courte.
 */
export function resolveFifoLot(ing) {
  if (!ing) return null;
  const lots = state.lots || [];
  const exact = lots.find(l => l.lot === ing.lotMatch);
  if (exact && Number(exact.stockQty) > 0) return exact;
  const cible = String(ing.name || '').trim().toLowerCase();
  if (cible) {
    const candidats = lots
      .filter(l => Number(l.stockQty) > 0 && l.name && (
        l.name.toLowerCase().includes(cible) || cible.includes(l.name.toLowerCase())
      ))
      .sort((a, b) => String(a.dlcDate || '9999-12-31').localeCompare(String(b.dlcDate || '9999-12-31')));
    if (candidats.length) return candidats[0];
  }
  return exact || null;
}

/* ───────────── Identifiants : uniques, stables, jamais absents ───────────────
 *
 * Un enregistrement sans identifiant, ou avec un identifiant partagé par deux
 * enregistrements, casse tout : l'édition ouvre la mauvaise ligne, la suppression
 * en emporte plusieurs, la synchronisation ne pousse rien. Les générateurs
 * d'origine (`Date.now().toString().slice(-3)`) recyclaient leur identifiant
 * toutes les 1 000 ms — deux ventes séparées d'une seconde exactement portaient
 * donc le MÊME identifiant. Cause racine du signalement cliente du 01/10/2026
 * (« je peux modifier la seconde vente mais pas la première »).
 */

/** Suffixe lisible et unique à l'échelle d'un appareil : base36 de l'horodatage. */
function suffixeUnique() {
  return Date.now().toString(36);
}

/**
 * Génère un identifiant unique dans une collection : `PREFIXE-horodatage`, et si
 * l'horodatage est déjà pris (deux créations dans la même milliseconde), on
 * suffixe jusqu'à trouver un créneau libre.
 */
export function genererId(prefixe, collection) {
  const pris = new Set((collection || []).map((x) => String(x && x.id)));
  let candidat = `${prefixe}-${suffixeUnique()}`;
  let n = 1;
  while (pris.has(candidat)) {
    n += 1;
    candidat = `${prefixe}-${suffixeUnique()}-${n}`;
  }
  return candidat;
}

/**
 * Répare le registre chargé : tout enregistrement sans identifiant en reçoit un,
 * et deux enregistrements qui partagent le même identifiant sont séparés.
 * Idempotente — sans doublon ni identifiant manquant, elle ne touche à rien.
 * @returns {{repares: number}} nombre d'identifiants attribués ou corrigés
 */
export function normaliserIds() {
  const collections = [
    ['lots', 'L'],
    ['recipes', 'REC'],
    ['secondaryDlcs', 'SEC'],
    ['witnessSamples', 'WIT'],
    ['salesHistory', 'V'],
    ['teamMembers', 'u']
  ];
  let repares = 0;
  collections.forEach(([champ, prefixe]) => {
    const liste = state[champ];
    if (!Array.isArray(liste)) return;
    const vus = new Set();
    liste.forEach((enregistrement) => {
      if (!enregistrement || typeof enregistrement !== 'object') return;
      const id = enregistrement.id;
      const manquant = id === undefined || id === null || id === '';
      if (manquant || vus.has(String(id))) {
        enregistrement.id = genererId(prefixe, liste);
        repares += 1;
      }
      vus.add(String(enregistrement.id));
    });
  });
  if (repares > 0) {
    console.warn(`Identifiants de registre réparés : ${repares} (doublon ou absence).`);
    saveState();
  }
  return { repares };
}

/* ─────────── Rafraîchissement de l'interface après un apport externe ─────────
 *
 * La synchronisation peut adopter des enregistrements venus du serveur en dehors
 * de toute action de l'utilisateur (retour de réseau, application remise au
 * premier plan). Sans réaffichage, le DOM garde les lignes d'avant la fusion :
 * leurs boutons portent des identifiants qui n'existent plus, et le clic ne fait
 * plus rien — en silence. On notifie donc les vues après adoption.
 */
const abonnesChangementExterne = [];

export function surChangementExterne(fn) {
  if (typeof fn === 'function') abonnesChangementExterne.push(fn);
}

export function signalerChangementExterne() {
  abonnesChangementExterne.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Réaffichage après synchronisation impossible :', e);
    }
  });
}

export function getCurrentOperator() {
  return state.teamMembers.find(m => m.id === state.currentOperatorId) || state.teamMembers[0];
}

export function setCurrentOperator(userId) {
  const user = state.teamMembers.find(m => m.id === userId);
  if (!user) return;
  state.currentOperatorId = userId;
  saveState();
}
