/**
 * TraqHACCP Pro — Entités Pâtisserie, Fiches Techniques & Traçabilité Descendante
 * Clean Architecture — Couche Domaine pure.
 */

export class IngredientLot {
  constructor({ id, category, name, supplier, lot, receiptDate, dlcDate, temp, stockQty, stockUnit = 'kg', unitPriceHT = 0, status = 'conforme' }) {
    this.id = id || 'L-' + Date.now().toString().slice(-4);
    this.category = category;
    this.name = name;
    this.supplier = supplier;
    this.lot = String(lot).toUpperCase().trim();
    this.receiptDate = receiptDate || new Date().toISOString().split('T')[0];
    this.dlcDate = dlcDate;
    this.temp = Number(temp);
    this.stockQty = Math.max(0, Number(stockQty));
    this.stockUnit = stockUnit;
    this.unitPriceHT = Number(unitPriceHT);
    this.status = status;
  }

  isExpiringSoon(thresholdDays = 2) {
    if (!this.dlcDate) return false;
    const diffMs = new Date(this.dlcDate).getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= thresholdDays;
  }
}

export class RecipeTechnicalSheet {
  constructor({ id, name, icon = '🍰', sellingPriceTTC, tvaRate = 0.055, ingredients = [] }) {
    this.id = id || 'REC-' + Date.now().toString().slice(-3);
    this.name = name;
    this.icon = icon;
    this.sellingPriceTTC = Number(sellingPriceTTC);
    this.tvaRate = Number(tvaRate);
    this.ingredients = (ingredients || []).map(ing => ({
      lotMatch: String(ing.lotMatch || '').toUpperCase().trim(),
      name: ing.name,
      qtyPerUnit: Number(ing.qtyPerUnit),
      unit: ing.unit || 'kg'
    }));
  }

  calculateMetrics(lotsAvailable = []) {
    let costMatiereHT = 0;
    let minServings = 9999;

    this.ingredients.forEach(ing => {
      const lot = (lotsAvailable || []).find(l => l.lot === ing.lotMatch);
      const unitPrice = lot ? lot.unitPriceHT : 5.0;
      costMatiereHT += (ing.qtyPerUnit * unitPrice);

      if (lot && ing.qtyPerUnit > 0) {
        const possible = Math.floor(lot.stockQty / ing.qtyPerUnit);
        if (possible < minServings) minServings = possible;
      }
    });

    const sellingPriceHT = this.sellingPriceTTC / (1 + this.tvaRate);
    const marginBrute = Math.max(0, sellingPriceHT - costMatiereHT);
    const marginPercent = sellingPriceHT > 0 ? ((marginBrute / sellingPriceHT) * 100) : 0;
    const coef = costMatiereHT > 0 ? (this.sellingPriceTTC / costMatiereHT) : 0;

    return {
      costMatiereHT: Number(costMatiereHT.toFixed(2)),
      sellingPriceHT: Number(sellingPriceHT.toFixed(2)),
      marginBrute: Number(marginBrute.toFixed(2)),
      marginPercent: Number(marginPercent.toFixed(1)),
      coef: Number(coef.toFixed(1)),
      fabricables: minServings === 9999 ? 0 : minServings
    };
  }
}

export class SecondaryDlcRecord {
  constructor({ id, name, parentLot, type, creationDate, expiryDate, operator = 'Chef Pâtissier' }) {
    this.id = id || 'SEC-' + Date.now().toString().slice(-4);
    this.name = name;
    this.parentLot = String(parentLot || '').toUpperCase().trim();
    this.type = type;
    this.creationDate = creationDate || new Date().toISOString().split('T')[0];
    this.expiryDate = expiryDate;
    this.operator = operator;
  }
}

export class WitnessSampleRecord {
  constructor({ id, dishName, service, serviceDate, expiryDate, temp = '+2.4°C' }) {
    this.id = id || 'WIT-' + Date.now().toString().slice(-3);
    this.dishName = dishName;
    this.service = service;
    this.serviceDate = serviceDate || new Date().toISOString().split('T')[0];
    this.expiryDate = expiryDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    this.temp = temp;
  }
}

export class SaleRecord {
  constructor({ id, time, recipeName, channel, orderType, customerName, customerPhone, orderRef, address = '-', qty, totalTTC, marginTotal, lotsUsed = [] }) {
    this.id = id || 'V-' + Date.now().toString().slice(-3);
    this.time = time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.recipeName = recipeName;
    this.channel = channel;
    this.orderType = orderType;
    this.customerName = customerName;
    this.customerPhone = customerPhone;
    this.orderRef = orderRef;
    this.address = address;
    this.qty = Number(qty);
    this.totalTTC = Number(totalTTC);
    this.marginTotal = Number(marginTotal);
    this.lotsUsed = Array.isArray(lotsUsed) ? lotsUsed.join(', ') : lotsUsed;
  }
}
