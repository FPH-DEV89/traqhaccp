/**
 * TraqHACCP Pâtisserie — State & Persistence Layer
 */

const DEFAULT_LOTS = [
  {
    id: 'L-101',
    category: 'chocolat',
    name: 'Chocolat Noir Caraïbe 66%',
    supplier: 'Valrhona',
    lot: 'CH-6601-A',
    receiptDate: '2026-09-12',
    dlcDate: '2026-11-20',
    temp: 16.5,
    stockQty: 8.5,
    stockUnit: 'kg',
    unitPriceHT: 18.40,
    status: 'conforme'
  },
  {
    id: 'L-102',
    category: 'cremerie',
    name: 'Beurre AOP Charentes-Poitou 84%',
    supplier: 'Laiterie Montaigu',
    lot: 'BT-9812',
    receiptDate: '2026-09-16',
    dlcDate: '2026-09-20',
    temp: 2.8,
    stockQty: 12.0,
    stockUnit: 'kg',
    unitPriceHT: 9.80,
    status: 'urgent'
  },
  {
    id: 'L-103',
    category: 'cremerie',
    name: 'Crème Liquide 35% Excellence',
    supplier: 'Elle & Vire Professionnel',
    lot: 'CR-4410',
    receiptDate: '2026-09-17',
    dlcDate: '2026-09-21',
    temp: 3.1,
    stockQty: 18.0,
    stockUnit: 'L',
    unitPriceHT: 4.60,
    status: 'warning'
  },
  {
    id: 'L-104',
    category: 'fruits',
    name: 'Fraises Mara des Bois Fraîches',
    supplier: 'Rungis Primeurs',
    lot: 'FR-8821',
    receiptDate: '2026-09-18',
    dlcDate: '2026-09-22',
    temp: 3.6,
    stockQty: 6.0,
    stockUnit: 'kg',
    unitPriceHT: 8.50,
    status: 'conforme'
  },
  {
    id: 'L-105',
    category: 'farine',
    name: 'Farine T55 Gruau Label Rouge',
    supplier: 'Moulins Viron',
    lot: 'M-5510',
    receiptDate: '2026-09-10',
    dlcDate: '2026-12-15',
    temp: 18.0,
    stockQty: 45.0,
    stockUnit: 'kg',
    unitPriceHT: 1.25,
    status: 'conforme'
  },
  {
    id: 'L-106',
    category: 'oeufs',
    name: 'Œufs Plein Air Bio (Alvéoles)',
    supplier: 'Ferme des Vallées',
    lot: 'BIO-OEUF-9',
    receiptDate: '2026-09-15',
    dlcDate: '2026-10-06',
    temp: 12.0,
    stockQty: 180,
    stockUnit: 'u',
    unitPriceHT: 0.28,
    status: 'conforme'
  }
];

const DEFAULT_RECIPES = [
  {
    id: 'REC-01',
    name: 'Gâteau Moelleux Chocolat (6-8 pers)',
    icon: '🍫',
    sellingPriceTTC: 24.00,
    tvaRate: 0.055,
    ingredients: [
      { lotMatch: 'CH-6601-A', name: 'Chocolat Noir 66%', qtyPerUnit: 0.35, unit: 'kg' },
      { lotMatch: 'BT-9812', name: 'Beurre AOP', qtyPerUnit: 0.22, unit: 'kg' },
      { lotMatch: 'BIO-OEUF-9', name: 'Œufs Bio', qtyPerUnit: 4, unit: 'u' },
      { lotMatch: 'M-5510', name: 'Farine T55', qtyPerUnit: 0.12, unit: 'kg' }
    ]
  },
  {
    id: 'REC-02',
    name: 'Tartelette Fraises & Crème (Individuelle)',
    icon: '🍓',
    sellingPriceTTC: 4.80,
    tvaRate: 0.055,
    ingredients: [
      { lotMatch: 'FR-8821', name: 'Fraises Mara des Bois', qtyPerUnit: 0.12, unit: 'kg' },
      { lotMatch: 'CR-4410', name: 'Crème Liquide 35%', qtyPerUnit: 0.06, unit: 'L' },
      { lotMatch: 'BT-9812', name: 'Beurre AOP (Pâte)', qtyPerUnit: 0.035, unit: 'kg' },
      { lotMatch: 'M-5510', name: 'Farine T55', qtyPerUnit: 0.045, unit: 'kg' }
    ]
  },
  {
    id: 'REC-03',
    name: 'Éclair Gourmand Chocolat Caraïbe',
    icon: '🧁',
    sellingPriceTTC: 4.20,
    tvaRate: 0.055,
    ingredients: [
      { lotMatch: 'CH-6601-A', name: 'Chocolat Noir 66%', qtyPerUnit: 0.05, unit: 'kg' },
      { lotMatch: 'CR-4410', name: 'Crème Liquide 35%', qtyPerUnit: 0.05, unit: 'L' },
      { lotMatch: 'BT-9812', name: 'Beurre Choux', qtyPerUnit: 0.02, unit: 'kg' },
      { lotMatch: 'BIO-OEUF-9', name: 'Œufs Bio', qtyPerUnit: 1, unit: 'u' }
    ]
  }
];

const DEFAULT_SEC_DLC = [
  {
    id: 'SEC-01',
    name: 'Crème Pâtissière Vanille Bourbon',
    parentLot: 'CR-4410',
    type: 'Cuisson / Élaboration (J+3)',
    creationDate: '2026-09-18',
    expiryDate: '2026-09-21',
    operator: 'Lucas (Chef Tourrier)'
  },
  {
    id: 'SEC-02',
    name: 'Purée Fraise Mara Décongelée',
    parentLot: 'FR-8821',
    type: 'Décongélation (J+1)',
    creationDate: '2026-09-18',
    expiryDate: '2026-09-19',
    operator: 'Camille (Entremets)'
  }
];

const DEFAULT_WITNESS = [
  {
    id: 'WIT-01',
    dishName: 'Crème Pâtissière Tartelettes du jour',
    service: 'Batch Matin 06h',
    serviceDate: '2026-09-18',
    expiryDate: '2026-09-23',
    temp: '+2.4°C'
  }
];

const DEFAULT_SALES = [
  {
    id: 'V-991',
    time: '10:42',
    recipeName: 'Tartelette Fraises & Crème',
    channel: 'emporter',
    orderType: '🛍️ À emporter (Click & Collect)',
    customerName: 'M. Jean Rochefort',
    customerPhone: '06 88 44 21 00',
    orderRef: 'Retrait 11h00 · #CMD-902',
    address: '-',
    qty: 2,
    totalTTC: 9.60,
    marginTotal: 5.84,
    lotsUsed: 'FR-8821, CR-4410, BT-9812'
  },
  {
    id: 'V-990',
    time: '09:15',
    recipeName: 'Gâteau Moelleux Chocolat',
    channel: 'livraison',
    orderType: '🛵 Livraison à domicile',
    customerName: 'Mme Sophie Legrand',
    customerPhone: '06 42 18 90 33',
    orderRef: 'Créneau 12h-13h · #LIV-441',
    address: '28 bd Raspail, 75007 Paris (Code 2841, 3e ét.)',
    qty: 1,
    totalTTC: 24.00,
    marginTotal: 17.02,
    lotsUsed: 'CH-6601-A, BT-9812, BIO-OEUF-9'
  },
  {
    id: 'V-989',
    time: '08:30',
    recipeName: 'Éclair Gourmand Chocolat Caraïbe',
    channel: 'emporter',
    orderType: '🛍️ À emporter (Retrait Boutique)',
    customerName: 'M. Pierre Valette',
    customerPhone: '06 19 82 30 11',
    orderRef: 'Retrait 09h00 · #CMD-889',
    address: '-',
    qty: 3,
    totalTTC: 12.60,
    marginTotal: 8.40,
    lotsUsed: 'CH-6601-A, CR-4410, BT-9812'
  }
];

const DEFAULT_TEAM = [
  {
    id: 'u-1',
    firstName: 'Lucas',
    lastName: 'Perez',
    initials: 'LP',
    role: 'Chef Tourrier',
    pin: '1234',
    active: true,
    joinedDate: '2025-01-10'
  },
  {
    id: 'u-2',
    firstName: 'Camille',
    lastName: 'Laurent',
    initials: 'CL',
    role: 'Pâtissier Entremets',
    pin: '',
    active: true,
    joinedDate: '2025-03-15'
  },
  {
    id: 'u-3',
    firstName: 'Antoine',
    lastName: 'Dubois',
    initials: 'AD',
    role: 'Chef Pâtissier',
    pin: '7890',
    active: true,
    joinedDate: '2024-09-01'
  }
];

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
