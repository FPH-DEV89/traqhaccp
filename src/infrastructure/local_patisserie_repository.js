/**
 * TraqHACCP Pro — Repository Pâtisserie Local & Hors-ligne (Infrastructure)
 */
import { 
  IngredientLot, 
  RecipeTechnicalSheet, 
  SecondaryDlcRecord, 
  WitnessSampleRecord, 
  SaleRecord 
} from '../domain/patisserie_entities.js';

const KEY_LOTS = 'traqhaccp_patisserie_lots_v1';
const KEY_RECIPES = 'traqhaccp_patisserie_recipes_v1';
const KEY_SALES = 'traqhaccp_patisserie_sales_v1';
const KEY_SEC_DLC = 'traqhaccp_patisserie_secdlc_v1';
const KEY_WITNESS = 'traqhaccp_patisserie_witness_v1';

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
  }
];

export class LocalPatisserieRepository {
  async loadAll() {
    return {
      lots: await this.getLots(),
      recipes: await this.getRecipes(),
      secondaryDlcs: await this.getSecondaryDlcs(),
      witnessSamples: await this.getWitnessSamples(),
      salesHistory: await this.getSalesHistory()
    };
  }

  async getLots() {
    try {
      const raw = localStorage.getItem(KEY_LOTS);
      const items = raw ? JSON.parse(raw) : DEFAULT_LOTS;
      return items.map(l => new IngredientLot(l));
    } catch {
      return DEFAULT_LOTS.map(l => new IngredientLot(l));
    }
  }

  async saveLot(lot) {
    const lots = await this.getLots();
    lots.unshift(lot);
    this.saveAllLots(lots);
  }

  async saveAllLots(lots) {
    localStorage.setItem(KEY_LOTS, JSON.stringify(lots));
  }

  async updateLotStock(lotId, newQty) {
    const lots = await this.getLots();
    const target = lots.find(l => l.id === lotId || l.lot === lotId);
    if (target) {
      target.stockQty = Math.max(0, Number(newQty));
      this.saveAllLots(lots);
      return target;
    }
    return null;
  }

  async getRecipes() {
    try {
      const raw = localStorage.getItem(KEY_RECIPES);
      const items = raw ? JSON.parse(raw) : DEFAULT_RECIPES;
      return items.map(r => new RecipeTechnicalSheet(r));
    } catch {
      return DEFAULT_RECIPES.map(r => new RecipeTechnicalSheet(r));
    }
  }

  async saveRecipe(recipe) {
    const recipes = await this.getRecipes();
    recipes.push(recipe);
    localStorage.setItem(KEY_RECIPES, JSON.stringify(recipes));
  }

  async getSecondaryDlcs() {
    try {
      const raw = localStorage.getItem(KEY_SEC_DLC);
      const items = raw ? JSON.parse(raw) : DEFAULT_SEC_DLC;
      return items.map(s => new SecondaryDlcRecord(s));
    } catch {
      return DEFAULT_SEC_DLC.map(s => new SecondaryDlcRecord(s));
    }
  }

  async saveSecondaryDlc(sec) {
    const list = await this.getSecondaryDlcs();
    list.unshift(sec);
    localStorage.setItem(KEY_SEC_DLC, JSON.stringify(list));
  }

  async getWitnessSamples() {
    try {
      const raw = localStorage.getItem(KEY_WITNESS);
      const items = raw ? JSON.parse(raw) : DEFAULT_WITNESS;
      return items.map(w => new WitnessSampleRecord(w));
    } catch {
      return DEFAULT_WITNESS.map(w => new WitnessSampleRecord(w));
    }
  }

  async saveWitnessSample(sample) {
    const list = await this.getWitnessSamples();
    list.unshift(sample);
    localStorage.setItem(KEY_WITNESS, JSON.stringify(list));
  }

  async getSalesHistory() {
    try {
      const raw = localStorage.getItem(KEY_SALES);
      const items = raw ? JSON.parse(raw) : DEFAULT_SALES;
      return items.map(s => new SaleRecord(s));
    } catch {
      return DEFAULT_SALES.map(s => new SaleRecord(s));
    }
  }

  async saveSale(sale) {
    const history = await this.getSalesHistory();
    history.unshift(sale);
    localStorage.setItem(KEY_SALES, JSON.stringify(history));
  }
}
