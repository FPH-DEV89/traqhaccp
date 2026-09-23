/**
 * TraqHACCP Pro — ViewModel Pâtisserie (MVVM)
 * Fait le pont entre les cas d'usage métier et l'interface utilisateur.
 */
import { playKitchenBeep } from '../../infrastructure/kitchen_audio.js';

export class PatisserieAppViewModel {
  constructor(useCases) {
    this.useCases = useCases;
    this.state = {
      lots: [],
      recipes: [],
      secondaryDlcs: [],
      witnessSamples: [],
      salesHistory: [],
      currentTab: 'traceability',
      currentCategory: 'all',
      alertsOnly: false,
      searchQuery: '',
      pendingSaleRecipe: null,
      pendingSaleMultiplier: 1,
      lotToAdjust: null
    };
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  async init() {
    const data = await this.useCases.getAllData();
    this.state.lots = data.lots || [];
    this.state.recipes = data.recipes || [];
    this.state.secondaryDlcs = data.secondaryDlcs || [];
    this.state.witnessSamples = data.witnessSamples || [];
    this.state.salesHistory = data.salesHistory || [];
    this.notify();
  }

  getFilteredLots() {
    const { lots, currentCategory, alertsOnly, searchQuery } = this.state;
    const q = (searchQuery || '').toLowerCase().trim();

    return lots.filter(l => {
      if (currentCategory !== 'all' && l.category !== currentCategory) return false;
      if (alertsOnly && l.status !== 'urgent' && l.status !== 'warning') return false;
      if (q) {
        return (l.name || '').toLowerCase().includes(q) ||
               (l.lot || '').toLowerCase().includes(q) ||
               (l.supplier || '').toLowerCase().includes(q);
      }
      return true;
    });
  }

  getTopMetrics() {
    const { lots, secondaryDlcs } = this.state;
    const urgentCount = lots.filter(l => l.status === 'urgent' || l.status === 'warning').length;
    return {
      totalLots: lots.length,
      warningDlcCount: urgentCount,
      secDlcCount: secondaryDlcs.length
    };
  }

  setTab(tab) {
    playKitchenBeep(520, 0.03);
    this.state.currentTab = tab;
    this.notify();
  }

  setCategoryFilter(cat) {
    playKitchenBeep(450, 0.04);
    this.state.currentCategory = cat;
    this.notify();
  }

  toggleAlertsOnly() {
    this.state.alertsOnly = !this.state.alertsOnly;
    playKitchenBeep(this.state.alertsOnly ? 700 : 350, 0.05);
    this.notify();
  }

  setSearchQuery(q) {
    this.state.searchQuery = q;
    this.notify();
  }

  async addLot(lotData) {
    playKitchenBeep(750, 0.1);
    await this.useCases.registerIngredientLot(lotData);
    await this.init();
  }

  async updateStock(lotId, qty) {
    await this.useCases.adjustLotStock(lotId, qty);
    await this.init();
  }

  async addRecipe(recipeData) {
    playKitchenBeep(750, 0.08);
    await this.useCases.createRecipe(recipeData);
    await this.init();
  }

  async addSecondaryDlc(secData) {
    playKitchenBeep(800, 0.08);
    await this.useCases.createSecondaryDlc(secData);
    await this.init();
  }

  async addWitnessSample(witnessData) {
    playKitchenBeep(780, 0.06);
    await this.useCases.registerWitnessSample(witnessData);
    await this.init();
  }

  async executeSale(saleParams) {
    playKitchenBeep(780, 0.08);
    const result = await this.useCases.executeFifoSale(saleParams);
    await this.init();
    return result;
  }

  async investigateRecall(lotNumber) {
    playKitchenBeep(650, 0.05);
    return await this.useCases.runRecallInvestigation(lotNumber);
  }
}
