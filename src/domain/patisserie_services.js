/**
 * TraqHACCP Pro — Services de Domaine Pâtisserie (Clean Architecture)
 */

export class FifoStockService {
  /**
   * Effectue le déstockage en FIFO ou selon les quantités ajustées saisies.
   */
  static processDepletion(recipe, multiplier, customQuantities = {}, lots = []) {
    const usedLots = [];
    const updatedLots = lots.map(l => ({ ...l }));

    recipe.ingredients.forEach((ing, idx) => {
      const customQty = customQuantities[idx] !== undefined 
        ? Number(customQuantities[idx]) 
        : Number(ing.qtyPerUnit * multiplier);

      const lotItem = updatedLots.find(l => l.lot === ing.lotMatch);
      if (lotItem) {
        lotItem.stockQty = Math.max(0, Number((lotItem.stockQty - customQty).toFixed(3)));
        if (!usedLots.includes(lotItem.lot)) {
          usedLots.push(lotItem.lot);
        }
      }
    });

    return { updatedLots, usedLots };
  }
}

export class RecallConsoService {
  /**
   * Analyse descendante sanitaire CE 178/2002 :
   * Retrouve la matière première, les DLC secondaires et les clients livrés/retirés.
   */
  static investigateLot(lotNumber, { lots = [], secondaryDlcs = [], salesHistory = [] }) {
    const q = String(lotNumber || '').trim().toUpperCase();
    if (!q) return null;

    const rawMaterial = lots.find(l => l.lot.toUpperCase().includes(q) || l.name.toUpperCase().includes(q));
    const secondaryMatches = secondaryDlcs.filter(s => s.parentLot.toUpperCase().includes(q));
    const affectedSales = salesHistory.filter(s => s.lotsUsed && s.lotsUsed.toUpperCase().includes(q));

    return {
      lotNumber: q,
      rawMaterial,
      secondaryMatches,
      affectedSales,
      customerPhones: affectedSales.map(s => s.customerPhone).filter(p => p && p !== '-')
    };
  }
}
