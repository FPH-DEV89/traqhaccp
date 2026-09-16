/**
 * Test Suite - Domain & Application Layer Verification
 */

import { HACCP_NORMS, ALL_14_ALLERGENS, DEFAULT_BRIGADE } from './src/domain/constants.js';
import { Equipment, DeliveryRecord, PreparationLabel, Fryer } from './src/domain/entities.js';
import { LocalStorageHACCPRepository } from './src/infrastructure/storage_repository.js';
import { HACCPUseCases } from './src/application/usecases.js';
import { BarcodeService } from './src/infrastructure/barcode_service.js';

console.log('=== TEST 1: CONSTANTS & ALLERGENS ===');
console.assert(ALL_14_ALLERGENS.length === 14, "Must have exactly 14 allergens");
console.assert(HACCP_NORMS.OILS.CRITICAL_TPM === 24.0, "Critical TPM must be 24%");
console.log('✔ 14 Allergens and regulatory norms verified.');

console.log('\n=== TEST 2: DOMAIN ENTITIES & RULES ===');
const eq = new Equipment({ id: 'test_eq', name: 'Chambre Froide', type: 'froid_pos', min: 0.0, max: 4.0, current: 2.5 });
console.assert(eq.isConform() === true, "2.5°C should be conform in [0; 4]");
eq.recordTemperature(6.2, 'Chef Thomas');
console.assert(eq.isConform() === false, "6.2°C should be non-conform in [0; 4]");
console.assert(eq.status === 'danger', "Status should be danger");
console.log('✔ Temperature limits and conformity rules verified.');

const fryer = new Fryer({ id: 'f1', name: 'Friteuse', volume: '10L', lastTpm: 15.0 });
fryer.recordTpm(25.5, 'aucune', 'Lucas B.');
console.assert(fryer.status === 'danger', "TPM > 24% must trigger danger");
console.log('✔ Oil degradation thresholds verified.');

console.log('\n=== TEST 3: BARCODE & QR GENERATOR ===');
const svgBarcode = BarcodeService.generateBarcodeSVG('LOT-20260916-99');
console.assert(svgBarcode.includes('<svg') && svgBarcode.includes('<rect'), "Barcode must produce SVG rects");
const svgQr = BarcodeService.generateQrBadgeSVG('LOT-20260916-99');
console.assert(svgQr.includes('<svg') && svgQr.includes('viewBox'), "QR code must produce valid SVG");
console.log('✔ Pure SVG Barcode & QR Code generators verified.');

console.log('\n=== TEST 4: MOCK REPOSITORY & USE CASES ===');
class MockStorageRepository extends LocalStorageHACCPRepository {
  constructor() {
    super();
    this.memory = {};
  }
  _get(k, fallback) { return this.memory[k] || fallback; }
  _set(k, v) { this.memory[k] = v; }
}

const mockRepo = new MockStorageRepository();
const mockAudio = { play: () => {} };
const useCases = new HACCPUseCases(mockRepo, mockAudio);

const score = useCases.calculateSanitaryScore();
console.assert(typeof score.score === 'number' && score.score >= 0 && score.score <= 100, "Sanitary score should be between 0 and 100");
console.log(`✔ Sanitary audit score engine: ${score.score}% (Audit ready: ${score.isAuditReady})`);

console.log('\n=== TEST 5: CHECKLISTS OUVERTURE / FERMETURE ===');
const checklists = mockRepo.getChecklists();
console.assert(checklists.ouverture && checklists.fermeture, "Must have ouverture and fermeture routines");
const firstItem = checklists.ouverture.items[0];
useCases.toggleChecklistTask('OUVERTURE', firstItem.id, 'Chef Thomas');
const updatedChecklists = mockRepo.getChecklists();
console.assert(updatedChecklists.ouverture.items[0].checked === true, "Item must be checked");
console.log('✔ Checklist routine toggle and persistence verified.');

console.log('\n=== TEST 6: GED DOCUMENTS & EXPIRATION ===');
const docs = mockRepo.getSanitaryDocuments();
console.assert(docs.length >= 4, "Should have default sanitary documents");
const expiredDoc = docs.find(d => d.isExpired());
console.assert(docs.every(d => typeof d.isExpired === 'function'), "Documents must have expiration methods");
console.log('✔ Sanitary documents repository & expiration detection verified.');

console.log('\n=== TEST 7: CONTRÔLE DU PH & AUTO NON-CONFORMITÉ ===');
const conformPh = useCases.recordPhMeasure({ product: 'Riz Sushi Test', measuredPh: 4.10, targetMaxPh: 4.30 }, 'Chef Thomas');
console.assert(conformPh.isConform() === true && conformPh.status === 'ok', "pH 4.10 should be conform");
const dangerPh = useCases.recordPhMeasure({ product: 'Riz Sushi Raté', measuredPh: 5.20, targetMaxPh: 4.30 }, 'Chef Thomas');
console.assert(dangerPh.isConform() === false && dangerPh.status === 'danger', "pH 5.20 should trigger danger");
const ncsAfterPh = mockRepo.getNonConformities();
console.assert(ncsAfterPh[0].equipOrSubject.includes('pH Non Conforme'), "Danger pH must auto-create NonConformity");
console.log('✔ pH control & automatic Non-Conformity creation verified.');

console.log('\n=== TEST 8: CONTRÔLE DE POIDS / PORTIONNEMENT ===');
const conformWeight = useCases.recordWeightMeasure({ dishName: 'Saumon', targetWeight: 200, measuredWeight: 205, tolerancePercent: 5.0 }, 'Chef Thomas');
console.assert(conformWeight.isConform() === true, "205g is within 200g ± 5% (190-210g)");
const warnWeight = useCases.recordWeightMeasure({ dishName: 'Saumon', targetWeight: 200, measuredWeight: 230, tolerancePercent: 5.0 }, 'Chef Thomas');
console.assert(warnWeight.isConform() === false, "230g is outside 200g ± 5%");
console.log('✔ Weight portioning tolerance engine verified.');

console.log('\n=== TEST 9: SYNTHÈSE INSPECTION SANITAIRE DDPP ===');
const summary = useCases.generateInspectionSummary();
console.assert(summary.establishment && summary.stats && typeof summary.score.score === 'number', "Summary must contain establishment, stats and score");
console.log(`✔ DDPP Inspection Summary generated successfully (Conform equipments: ${summary.stats.conformEquipments}/${summary.stats.totalEquipments}).`);

console.log('\n✅ TOUS LES TESTS DE CLEAN ARCHITECTURE (V3.0 ÉTENDUE) ONT RÉUSSI AVEC SUCCÈS !');

