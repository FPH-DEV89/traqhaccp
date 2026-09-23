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
  establishmentId: 'local',
  establishmentName: 'Maison Saint-Honoré',
  establishmentSub: 'Maison Saint-Honoré · Labo, Vente & Livraison',
  lots: [...DEFAULT_LOTS],
  recipes: [...DEFAULT_RECIPES],
  secondaryDlcs: [...DEFAULT_SEC_DLC],
  witnessSamples: [...DEFAULT_WITNESS],
  salesHistory: [...DEFAULT_SALES],
  teamMembers: [...DEFAULT_TEAM],
  currentOperatorId: 'u-1',
  currentCategory: 'all',
  alertsOnly: false,
  pendingSaleRecipe: null,
  pendingSaleMultiplier: 1,
  lotToAdjust: null
};

function storageKey(suffix) {
  const scope = state.establishmentId || 'local';
  return `traqhaccp_patisserie_${scope}_${suffix}_v1`;
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
}

export function loadState(etabId = 'local', etabName = null) {
  state.establishmentId = etabId || 'local';
  if (etabName) {
    state.establishmentName = etabName;
    state.establishmentSub = `${etabName} · Labo, Vente & Livraison`;
  }

  try {
    const rawLots = localStorage.getItem(storageKey('lots'));
    state.lots = rawLots ? JSON.parse(rawLots) : [...DEFAULT_LOTS];

    const rawRecipes = localStorage.getItem(storageKey('recipes'));
    state.recipes = rawRecipes ? JSON.parse(rawRecipes) : [...DEFAULT_RECIPES];

    const rawSec = localStorage.getItem(storageKey('secondaryDlcs'));
    state.secondaryDlcs = rawSec ? JSON.parse(rawSec) : [...DEFAULT_SEC_DLC];

    const rawWitness = localStorage.getItem(storageKey('witnessSamples'));
    state.witnessSamples = rawWitness ? JSON.parse(rawWitness) : [...DEFAULT_WITNESS];

    const rawSales = localStorage.getItem(storageKey('salesHistory'));
    state.salesHistory = rawSales ? JSON.parse(rawSales) : [...DEFAULT_SALES];

    const rawTeam = localStorage.getItem(storageKey('teamMembers'));
    state.teamMembers = rawTeam ? JSON.parse(rawTeam) : [...DEFAULT_TEAM];

    const rawOp = localStorage.getItem(storageKey('currentOperatorId'));
    state.currentOperatorId = rawOp ? JSON.parse(rawOp) : 'u-1';

    const savedName = localStorage.getItem(storageKey('establishmentName'));
    if (savedName && !etabName) {
      state.establishmentName = savedName;
      state.establishmentSub = `${savedName} · Labo, Vente & Livraison`;
    }
  } catch (e) {
    console.warn('Erreur de chargement local :', e);
  }
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
