/**
 * TraqHACCP Pro — Cas d'utilisation Pâtisserie & Traçabilité (Clean Architecture)
 */
import { FifoStockService, RecallConsoService } from '../domain/patisserie_services.js';
import { 
  IngredientLot, 
  RecipeTechnicalSheet, 
  SecondaryDlcRecord, 
  WitnessSampleRecord, 
  SaleRecord 
} from '../domain/patisserie_entities.js';

export class PatisserieUseCases {
  constructor(repository) {
    this.repository = repository;
  }

  async getAllData() {
    return await this.repository.loadAll();
  }

  async registerIngredientLot(lotData) {
    const lot = new IngredientLot(lotData);
    await this.repository.saveLot(lot);
    return lot;
  }

  async adjustLotStock(lotId, newQty) {
    return await this.repository.updateLotStock(lotId, newQty);
  }

  async createRecipe(recipeData) {
    const recipe = new RecipeTechnicalSheet(recipeData);
    await this.repository.saveRecipe(recipe);
    return recipe;
  }

  async executeFifoSale({ recipe, multiplier, customQuantities, customerInfo }) {
    const allLots = await this.repository.getLots();
    const { updatedLots, usedLots } = FifoStockService.processDepletion(
      recipe, 
      multiplier, 
      customQuantities, 
      allLots
    );

    // Persister les stocks mis à jour
    await this.repository.saveAllLots(updatedLots);

    // Calculer les métriques financières
    const metrics = recipe.calculateMetrics ? recipe.calculateMetrics(allLots) : { marginBrute: 0 };
    const totalTTC = Number((recipe.sellingPriceTTC * multiplier).toFixed(2));
    const marginTotal = Number((metrics.marginBrute * multiplier).toFixed(2));

    const sale = new SaleRecord({
      recipeName: recipe.name,
      channel: customerInfo.channel || 'emporter',
      orderType: customerInfo.channel === 'livraison' ? '🛵 Livraison à domicile' : '🛍️ À emporter (Retrait)',
      customerName: customerInfo.name || 'Client Pâtisserie',
      customerPhone: customerInfo.phone || '06 00 00 00 00',
      orderRef: customerInfo.ref || 'Commande',
      address: customerInfo.address || '-',
      qty: multiplier,
      totalTTC,
      marginTotal,
      lotsUsed
    });

    await this.repository.saveSale(sale);
    return { sale, updatedLots };
  }

  async createSecondaryDlc(secData) {
    const record = new SecondaryDlcRecord(secData);
    await this.repository.saveSecondaryDlc(record);
    return record;
  }

  async registerWitnessSample(sampleData) {
    const record = new WitnessSampleRecord(sampleData);
    await this.repository.saveWitnessSample(record);
    return record;
  }

  async runRecallInvestigation(lotNumber) {
    const data = await this.repository.loadAll();
    return RecallConsoService.investigateLot(lotNumber, data);
  }
}
