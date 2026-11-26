#!/usr/bin/env node
/**
 * test-features.mjs — Tests unitaires des fonctionnalités métier TraqHACCP.
 *
 * Couvre :
 *   1. Scan IA étiquettes (ai-scanner.js) : normalisation DLC / DDM / DLUO et N° de lot
 *   2. Calculs & marges (calculations.js) : calculateRecipeMetrics, TVA absente, fabricables, formatDateFr
 *   3. État & FIFO (state.js) : computeLotStatus, resolveFifoLot, genererId, normaliserIds
 *   4. Alertes de service (notifications.js) : dansHeuresCalmes (chevauchement minuit), alertesDuJour
 *   5. Récupération locale (recuperation.js) : registresOrphelins, restaurerRegistreOrphelin (idempotence)
 */

// Environnement minimal navigateur pour importer les modules ES sans DOM complet
const store = Object.create(null);
const lsProto = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  key: (i) => Object.keys(store)[i] ?? null,
};
globalThis.localStorage = new Proxy(store, {
  get: (target, prop) => {
    if (prop === 'length') return Object.keys(target).length;
    if (prop in lsProto) return lsProto[prop];
    return target[prop];
  },
});
globalThis.window = globalThis;

const { normaliserDateIso, normaliserExtraction } = await import('../js/patisserie/ai-scanner.js');
const { state, computeLotStatus, resolveFifoLot, genererId, normaliserIds, loadState } = await import('../js/patisserie/state.js');
const { calculateRecipeMetrics, formatDateFr } = await import('../js/patisserie/calculations.js');
const { dansHeuresCalmes, alertesDuJour } = await import('../js/patisserie/notifications.js');
const { registresOrphelins, restaurerRegistreOrphelin } = await import('../js/patisserie/recuperation.js');

let checks = 0;
let failures = 0;

function assert(cond, msg) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  ✗ ÉCHEC: ${msg}`);
  }
}

function approx(a, b, eps = 1e-4) {
  return Number.isFinite(a) && Math.abs(a - b) <= eps;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

/* ── 1. Scan IA étiquettes : normalisation DLC / DDM / DLUO & Lot ─────────── */
section('1. Scan IA étiquettes (ai-scanner.js)');

assert(normaliserDateIso('2028-02-29') === '2028-02-29', 'Année bissextile 2028-02-29 acceptée');
assert(normaliserDateIso('29/02/2028') === '2028-02-29', 'Année bissextile FR 29/02/2028 acceptée');
assert(normaliserDateIso('31/02/2026') === '', 'Date invalide 31/02/2026 rejetée');
assert(normaliserDateIso('2026-10-18T14:30:00Z') === '2026-10-18', 'Horodatage ISO complet tronqué proprement');
assert(normaliserDateIso('05-11-27') === '2027-11-05', 'Format DD-MM-YY converti en 2027-11-05');
assert(normaliserDateIso('02/2027') === '2027-02-28', 'DDM/DLUO MM/YYYY non bissextile → 28 février');
assert(normaliserDateIso('02/2028') === '2028-02-29', 'DDM/DLUO MM/YYYY bissextile → 29 février');
assert(normaliserDateIso('15 décembre 2027') === '2027-12-15', 'Mois français accentué "décembre"');
assert(normaliserDateIso('août 2028') === '2028-08-31', 'Mois seul "août 2028" → dernier jour du mois');
assert(normaliserDateIso('28 févr. 2027') === '2027-02-28', 'Abréviation "févr." reconnue');

const lotClean = normaliserExtraction({
  name: '  Crème Fleurette 35% ',
  supplier: ' Elle & Vire ',
  lot: 'N° de lot: ab-123 ',
  dlc: '18/11/26',
  category: 'INCONNUE',
  confidence: 'HIGH',
});
assert(lotClean.name === 'Crème Fleurette 35%', 'Nom nettoyé');
assert(lotClean.supplier === 'Elle & Vire', 'Fournisseur nettoyé');
assert(lotClean.lot === 'AB-123', 'Préfixe "N° de lot:" retiré et mis en majuscules');
assert(lotClean.dlcDate === '2026-11-18', 'Alias dlc DD/MM/YY converti');
assert(lotClean.category === 'cremerie', 'Catégorie invalide repliée sur cremerie');
assert(lotClean.confidence === 'high', 'Confiance normalisée en minuscules');

const lotBatch = normaliserExtraction({
  name: 'Sucre',
  supplier: 'Daddy',
  batch: 'BATCH #9901',
  bestBefore: '2029-05',
});
assert(lotBatch.lot === '#9901' || lotBatch.lot === '9901', 'Alias batch nettoyé');
assert(lotBatch.dlcDate === '2029-05-31', 'Alias bestBefore YYYY-MM normalisé');

console.log('  → Normalisation DLC / DDM / DLUO et N° de lot OK.');

/* ── 2. Calculs recettes & marges (calculations.js) ───────────────────────── */
section('2. Calculs recettes & marges (calculations.js)');

state.lots = [
  { id: 'L-1', name: 'Beurre AOP', lot: 'B1', stockQty: 10, unitPriceHT: 8.0, dlcDate: '2027-06-01' },
  { id: 'L-2', name: 'Chocolat Noir', lot: 'C1', stockQty: 2, unitPriceHT: 15.0, dlcDate: '2027-07-01' },
];

const rec = {
  sellingPriceTTC: 5.5,
  tvaRate: 0.1,
  ingredients: [
    { lotMatch: 'B1', name: 'Beurre AOP', qtyPerUnit: 0.25 },
    { lotMatch: 'C1', name: 'Chocolat Noir', qtyPerUnit: 0.1 },
  ],
};
const m = calculateRecipeMetrics(rec);
assert(approx(m.costMatiereHT, 3.5), `Coût matière HT = 3.50 € (obtenu ${m.costMatiereHT})`);
assert(approx(m.prixVenteHT, 5.0), `Prix vente HT = 5.00 € (obtenu ${m.prixVenteHT})`);
assert(approx(m.marginBrute, 1.5), `Marge brute = 1.50 € (obtenu ${m.marginBrute})`);
assert(m.fabricables === 20, `Fabricables = min(40, 20) = 20 (obtenu ${m.fabricables})`);

const recSansTva = { sellingPriceTTC: 4.22, ingredients: [{ lotMatch: 'INCONNU', name: 'Vanille', qtyPerUnit: 0.1 }] };
const mSansTva = calculateRecipeMetrics(recSansTva);
assert(Number.isFinite(mSansTva.prixVenteHT) && Number.isFinite(mSansTva.marginBrute), 'Recette sans tvaRate ne produit pas NaN');
assert(mSansTva.fabricables === 0, 'Ingrédient sans lot → 0 fabricable');
assert(formatDateFr('2026-09-28') === '28/09/2026', 'formatDateFr ISO → FR');
assert(formatDateFr('') === '-', 'formatDateFr vide → "-"');

console.log('  → Calculs de coûts, marges et fabricables OK.');

/* ── 3. État, statuts DLC & FIFO (state.js) ───────────────────────────────── */
section('3. État, statuts DLC & FIFO (state.js)');

const today = new Date();
const addDaysIso = (d) => {
  const dt = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + d));
  return dt.toISOString().slice(0, 10);
};

assert(computeLotStatus(addDaysIso(-1)) === 'urgent', 'DLC dépassée → urgent');
assert(computeLotStatus(addDaysIso(0)) === 'urgent', 'DLC aujourd\'hui → urgent');
assert(computeLotStatus(addDaysIso(1)) === 'urgent', 'DLC J+1 → urgent');
assert(computeLotStatus(addDaysIso(2), 3) === 'warning', 'DLC J+2 (horizon 3j) → warning');
assert(computeLotStatus(addDaysIso(10), 3) === 'conforme', 'DLC J+10 → conforme');
assert(computeLotStatus('invalide') === 'conforme', 'DLC invalide → conforme sans crash');

state.lots = [
  { id: 'L-A', name: 'Beurre AOP', lot: 'B-VIDE', stockQty: 0, dlcDate: '2026-10-01' },
  { id: 'L-B', name: 'Beurre AOP', lot: 'B-LONG', stockQty: 5, dlcDate: '2026-12-20' },
  { id: 'L-C', name: 'Beurre AOP', lot: 'B-COURT', stockQty: 3, dlcDate: '2026-12-05' },
];
const fifo = resolveFifoLot({ lotMatch: 'B-VIDE', name: 'Beurre AOP' });
assert(fifo && fifo.lot === 'B-COURT', `FIFO choisit le lot actif à DLC la plus courte (obtenu ${fifo?.lot})`);

state.lots = [{ name: 'Sans ID' }, { id: 'DUP', name: 'Un' }, { id: 'DUP', name: 'Deux' }];
state.recipes = [];
state.secondaryDlcs = [];
state.witnessSamples = [];
state.salesHistory = [];
state.teamMembers = [];
const rep = normaliserIds();
assert(rep.repares === 2, `normaliserIds répare 1 absent + 1 doublon (obtenu ${rep.repares})`);
assert(new Set(state.lots.map((l) => l.id)).size === 3, 'Tous les IDs de lots sont désormais uniques');
const idGen = genererId('L', state.lots);
assert(idGen.startsWith('L-') && !state.lots.some((l) => l.id === idGen), 'genererId produit un ID non collisionnel');

console.log('  → Statuts DLC, résolution FIFO et intégrité des IDs OK.');

/* ── 4. Alertes de service (notifications.js) ─────────────────────────────── */
section('4. Alertes de service (notifications.js)');

assert(dansHeuresCalmes({ quietEnabled: true, quietFrom: 21, quietTo: 7 }, new Date(2026, 10, 26, 23, 0)) === true, '23h dans plage calme 21h→7h');
assert(dansHeuresCalmes({ quietEnabled: true, quietFrom: 21, quietTo: 7 }, new Date(2026, 10, 26, 5, 30)) === true, '5h30 dans plage calme 21h→7h');
assert(dansHeuresCalmes({ quietEnabled: true, quietFrom: 21, quietTo: 7 }, new Date(2026, 10, 26, 10, 0)) === false, '10h hors plage calme 21h→7h');
assert(dansHeuresCalmes({ quietEnabled: false, quietFrom: 21, quietTo: 7 }, new Date(2026, 10, 26, 23, 0)) === false, 'Heures calmes désactivées');

localStorage.setItem('traq_settings', JSON.stringify({ alertHorizonDays: 2 }));
const refDate = new Date(2026, 10, 26, 10, 0);
state.lots = [
  { id: 'L-1', name: 'Lait', lot: 'L1', dlcDate: '2026-11-25' },
  { id: 'L-2', name: 'Crème', lot: 'L2', dlcDate: '2026-11-28' },
  { id: 'L-3', name: 'Sucre', lot: 'L3', dlcDate: '2027-05-01' },
];
state.secondaryDlcs = [];
state.witnessSamples = [];
const alertes = alertesDuJour(refDate);
assert(alertes.length === 2, `2 alertes attendues dans l'horizon 2j (obtenu ${alertes.length})`);
assert(alertes[0].gravite === 'danger' && alertes[1].gravite === 'warn', 'Alertes triées danger puis warn');

console.log('  → Heures calmes et alertesDuJour OK.');

/* ── 5. Récupération registre orphelin (recuperation.js) ──────────────────── */
section('5. Récupération registre orphelin (recuperation.js)');

localStorage.clear();
localStorage.setItem('traqhaccp_patisserie_serveur_lots_v1', JSON.stringify([{ id: 'L-OLD', name: 'Farine T45', lot: 'F1', dlcDate: '2027-01-10' }]));
localStorage.setItem('traqhaccp_patisserie_serveur_recipes_v1', JSON.stringify([{ id: 'R-OLD', name: 'Brioche' }]));
loadState('etab-uuid-test', 'Boulangerie Test');
const orp = registresOrphelins();
assert(orp.length === 1 && orp[0].scope === 'serveur', 'Registre orphelin "serveur" détecté');
const rest1 = restaurerRegistreOrphelin();
assert(rest1 && rest1.lots === 1 && rest1.recipes === 1, 'Restauration récupère 1 lot et 1 recette');
const rest2 = restaurerRegistreOrphelin();
assert(rest2 === null, 'Second appel idempotent (ne duplique jamais)');

console.log('  → Détection et fusion idempotente de registre orphelin OK.');

/* ── Bilan ────────────────────────────────────────────────────────────────── */
console.log(`\ntest-features: ${checks} assertion(s) · ${failures} échec(s)`);
if (failures > 0) {
  process.exit(1);
}
console.log('test-features: OK');
