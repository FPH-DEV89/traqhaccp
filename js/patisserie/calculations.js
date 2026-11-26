/**
 * TraqHACCP Pâtisserie — Business Rules & Food Cost Calculations
 */
import { state, resolveFifoLot } from './state.js';

export function calculateRecipeMetrics(recipe) {
  let costMatiereHT = 0;
  let maxPossible = Infinity;

  (recipe.ingredients || []).forEach(ing => {
    const lotItem = resolveFifoLot(ing);
    const unitPrice = lotItem ? lotItem.unitPriceHT : 10.0;
    costMatiereHT += (ing.qtyPerUnit * unitPrice);

    if (lotItem && ing.qtyPerUnit > 0) {
      const canMake = Math.floor(lotItem.stockQty / ing.qtyPerUnit);
      if (canMake < maxPossible) {
        maxPossible = canMake;
      }
    } else {
      maxPossible = 0;
    }
  });

  const tvaRate = Number.isFinite(Number(recipe?.tvaRate)) ? Number(recipe.tvaRate) : 0.055;
  const sellingTTC = Number(recipe?.sellingPriceTTC) || 0;
  const prixVenteHT = sellingTTC / (1 + tvaRate);
  const marginBrute = Math.max(0, prixVenteHT - costMatiereHT);
  const foodCostRatio = prixVenteHT > 0 ? (costMatiereHT / prixVenteHT) * 100 : 0;
  const margeRatio = prixVenteHT > 0 ? (marginBrute / prixVenteHT) * 100 : 0;
  const coefMarge = costMatiereHT > 0 ? (sellingTTC / costMatiereHT) : 0;

  return {
    costMatiereHT,
    prixVenteHT,
    marginBrute,
    foodCostRatio,
    margeRatio,
    coefMarge,
    fabricables: maxPossible === Infinity ? 0 : Math.max(0, maxPossible)
  };
}

export function formatDateFr(isoDate) {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
}
