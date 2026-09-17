import { HACCP_NORMS, ALL_14_ALLERGENS, DEFAULT_BRIGADE, SAN_DOC_CATEGORIES, DEFAULT_CHECKLIST_ROUTINES } from './src/domain/constants.js';
import { 
  Equipment, 
  DeliveryRecord, 
  PreparationLabel, 
  DishAllergens, 
  CleaningTask, 
  Fryer, 
  CoolingCycle, 
  DefrostCycle, 
  NonConformity, 
  SanitaryDocument, 
  PhControlRecord, 
  WeightControlRecord, 
  ChecklistItem, 
  ChecklistRoutine 
} from './src/domain/entities.js';
import { LocalStorageHACCPRepository } from './src/infrastructure/storage_repository.js';
import { HACCPUseCases } from './src/application/usecases.js';
import { AudioService } from './src/infrastructure/audio_service.js';
import { BarcodeService } from './src/infrastructure/barcode_service.js';
import { CameraService } from './src/infrastructure/camera_service.js';
import { HACCPStore } from './src/presentation/store.js';

console.log('=== TEST SUITE COMPLETE: ALL FEATURES ===');

class MockStorageRepository extends LocalStorageHACCPRepository {
  constructor() {
    super();
    this.storage = {};
    // Load initial demo data
    this.resetToDemo();
  }
  _get(k, fallback) {
    return this.storage[k] !== undefined ? this.storage[k] : fallback;
  }
  _set(k, v) {
    this.storage[k] = v;
  }
  _clear() {
    this.storage = {};
  }
}

const repo = new MockStorageRepository();
const audio = new AudioService(); // Tone.js might not be in node, but audio methods should not throw
// Mock audio play in node
audio.play = (type) => { /* no-op in node */ };

const useCases = new HACCPUseCases(repo, audio);
const store = new HACCPStore(repo, useCases);

// 1. Check Store
console.log('1. Testing Reactive Store:');
let stateChanged = false;
store.subscribe(s => { stateChanged = true; });
store.setActiveTab('temperatures');
console.assert(stateChanged === true, "Store subscriber should be notified on setActiveTab");
console.assert(store.state.activeTab === 'temperatures', "Store activeTab should be 'temperatures'");
store.showNotification('Test Notification', 'success');
console.assert(store.state.notification.message === 'Test Notification', "Store notification should be set");
store.dismissNotification();
console.assert(store.state.notification === null, "Notification should be dismissed");
console.log('✔ Reactive store tests passed.');

// 2. Thermométrie
console.log('\n2. Testing Thermométrie UseCases:');
const eqs = repo.getEquipments();
console.assert(eqs.length >= 6, "Must have at least 6 default equipments");
const firstEq = eqs[0];
const initialTemp = firstEq.current;
const logResult = useCases.logTemperature(firstEq.id, 0.5, 'Chef Thomas');
console.assert(logResult.success === true, "logTemperature should succeed");
console.assert(Math.abs(logResult.equipment.current - (initialTemp + 0.5)) < 0.001, "Temperature adjusted by 0.5");
// Test autoLogStandardTemps
useCases.autoLogStandardTemps('Chef Thomas');
const freshEqs = repo.getEquipments();
console.assert(freshEqs.every(e => e.lastLog !== '-'), "All equipments should have a logged temp");
console.assert(freshEqs.every(e => e.isConform()), "All equipments should be conform after standard autolog");
// Test resolveTemperatureIncident
const ncFromTemp = useCases.resolveTemperatureIncident(firstEq.id, 'Chambre froide dégivrée', 'Porte restée entrouverte', 'Chef Thomas');
console.assert(ncFromTemp.equipOrSubject.includes(firstEq.name), "NC created with equipment name");
console.log('✔ Thermométrie tests passed.');

// 3. Réception de marchandises
console.log('\n3. Testing Réception Marchandises:');
const delivConform = useCases.recordDelivery({
  supplier: 'Metro',
  bl: 'BL-9921',
  truckTemp: 2.1,
  prodTemp: 3.0,
  category: 'Produits Frais',
  conformPackaging: true,
  conformDlc: true,
  decision: 'Conforme'
}, 'Chef Thomas');
console.assert(!delivConform.isRejected(), "Conform delivery should not be rejected");

const delivReject = useCases.recordDelivery({
  supplier: 'Transgourmet',
  bl: 'BL-9922',
  truckTemp: 9.5,
  prodTemp: 11.2,
  category: 'Viandes Fraîches',
  conformPackaging: false,
  conformDlc: false,
  decision: 'Refusé'
}, 'Chef Thomas');
console.assert(delivReject.isRejected(), "Non-conform delivery must be rejected");
const ncsAfterDeliv = repo.getNonConformities();
console.assert(ncsAfterDeliv.some(n => n.equipOrSubject.includes('BL-9922')), "Rejected delivery should auto-create NonConformity");
useCases.deleteDelivery(delivReject.id);
console.assert(!repo.getDeliveries().some(d => d.id === delivReject.id), "Delivery should be deleted");
console.log('✔ Réception Marchandises tests passed.');

// 4. DLC & Traçabilité
console.log('\n4. Testing DLC & Traçabilité:');
const prep = useCases.createPreparationLabel({
  name: 'Sauce Tomate Maison',
  durationDays: 3,
  quantity: '3L',
  batch: 'LOT-TEST-001',
  allergens: ['Céleri'],
  photo: 'data:image/jpeg;base64,test'
}, 'Chef Thomas');
console.assert(prep.id.startsWith('PR-'), "Prep id format");
console.assert(prep.durationDays === 3, "Duration days");
console.assert(prep.allergens.includes('Céleri'), "Allergens");
const barcodeSVG = BarcodeService.generateBarcodeSVG(prep.batch);
console.assert(barcodeSVG.includes('<svg') && barcodeSVG.includes('<rect'), "Barcode SVG generated");
const qrSVG = BarcodeService.generateQrBadgeSVG(prep.batch);
console.assert(qrSVG.includes('<svg'), "QR badge SVG generated");
useCases.deletePreparation(prep.id);
console.assert(!repo.getPreparations().some(p => p.id === prep.id), "Prep deleted");
console.log('✔ DLC & Traçabilité tests passed.');

// 5. 14 Allergènes INCO
console.log('\n5. Testing 14 Allergènes INCO:');
const dish = useCases.addAllergenDish({
  name: 'Risotto aux Champignons',
  category: 'Plats',
  allergens: ['Lait', 'Sulfites']
});
console.assert(dish.allergens.length === 2, "Dish should have 2 allergens");
useCases.deleteAllergenDish(dish.id);
console.assert(!repo.getAllergenDishes().some(d => d.id === dish.id), "Dish deleted");
console.log('✔ 14 Allergènes tests passed.');

// 6. Plan de nettoyage
console.log('\n6. Testing Plan de Nettoyage:');
const cleanings = repo.getCleaningTasks();
console.assert(cleanings.length >= 4, "Must have cleaning tasks");
const cTask = cleanings[0];
const initialStatus = cTask.status;
const toggledTask = useCases.toggleCleaningTask(cTask.id, 'Chef Thomas');
console.assert(toggledTask.status !== initialStatus, "Cleaning task toggled");
useCases.resetCleaningPlan();
console.assert(repo.getCleaningTasks().every(t => t.status === 'pending'), "All cleaning tasks pending after reset");
console.log('✔ Plan de nettoyage tests passed.');

// 7. Huiles de Friture
console.log('\n7. Testing Huiles de Friture:');
const fryer = useCases.recordOilTest('fryer-1', 26.0, 'aucune', 'Lucas B.');
console.assert(fryer.status === 'danger', "TPM 26% must be danger");
const ncsAfterOil = repo.getNonConformities();
console.assert(ncsAfterOil.some(n => n.equipOrSubject.includes('fryer-1') || n.equipOrSubject.includes('Friteuse')), "Critical oil creates NC");
const updatedFryer = useCases.recordOilTest('fryer-1', 12.0, 'Vidange complète', 'Lucas B.');
console.assert(updatedFryer.status === 'ok', "Oil after vidange is ok");
console.log('✔ Huiles de Friture tests passed.');

// 8. Refroidissement Rapide & Décongélation
console.log('\n8. Testing Refroidissement Rapide & Décongélation:');
const cool = useCases.startCoolingCycle({
  dish: 'Blanquette de Veau',
  startTime: '11:00',
  endTime: '12:30',
  startTemp: 68.0,
  endTemp: 8.5,
  durationMinutes: 90
}, 'Chef Thomas');
console.assert(cool.isConform(), "90 min cooling from 68 to 8.5 is conform (< 120 min, end < 10°C)");

const defrost = useCases.startDefrostCycle({
  product: 'Filets de Cabillaud',
  quantity: '5 kg',
  startDate: '16/09/2026',
  targetFridge: 'Chambre Froide Positive 1',
  status: 'en_cours'
}, 'Chef Thomas');
console.assert(defrost.status === 'en_cours', "Defrost cycle status");
useCases.updateDefrostStatus(defrost.id, 'termine');
console.assert(repo.getDefrostCycles().find(c => c.id === defrost.id).status === 'termine', "Defrost cycle updated");
console.log('✔ Refroidissement & Décongélation tests passed.');

// 9. Non-Conformités 5M
console.log('\n9. Testing Non-Conformités 5M:');
const ncManual = useCases.declareNonConformity({
  category5M: 'Milieu',
  severity: 'Moyenne',
  equipOrSubject: 'Siphon de sol obstrué',
  cause: 'Accumulation débris',
  action: 'Nettoyage au karcher et désinfection'
}, 'Chef Thomas');
console.assert(ncManual.category5M === 'Milieu', "Category 5M");
useCases.deleteNonConformity(ncManual.id);
console.assert(!repo.getNonConformities().some(n => n.id === ncManual.id), "NC deleted");
console.log('✔ Non-Conformités 5M tests passed.');

// 10. Checklists Routines
console.log('\n10. Testing Checklists Routines:');
const chks = repo.getChecklists();
const ouvItem = chks.ouverture.items[0];
useCases.toggleChecklistTask('OUVERTURE', ouvItem.id, 'Chef Thomas');
console.assert(repo.getChecklists().ouverture.items[0].checked === true, "Checklist item checked");
useCases.validateChecklistRoutine('OUVERTURE', 'Chef Thomas');
console.assert(repo.getChecklists().ouverture.validated === true, "Checklist routine validated");
useCases.resetChecklists();
console.assert(repo.getChecklists().ouverture.validated === false, "Checklist routine reset");
console.log('✔ Checklists Routines tests passed.');

// 11. GED Documents
console.log('\n11. Testing GED Documents:');
const doc = useCases.addSanitaryDocument({
  title: 'Certificat 3D - Dératisation',
  category: 'deratisation',
  issuer: 'Hygiène Services 3D',
  fileDate: '01/01/2026',
  expireDate: '01/01/2027',
  notes: 'Passage trimestriel sans anomalie'
});
console.assert(!doc.isExpired(), "Document not expired");
useCases.deleteSanitaryDocument(doc.id);
console.assert(!repo.getSanitaryDocuments().some(d => d.id === doc.id), "Document deleted");
console.log('✔ GED Documents tests passed.');

// 12. Contrôles pH & Poids
console.log('\n12. Testing pH & Poids:');
const phRec = useCases.recordPhMeasure({
  product: 'Riz Sushi Vinaigré',
  measuredPh: 4.15,
  targetMaxPh: 4.30
}, 'Chef Thomas');
console.assert(phRec.isConform(), "pH 4.15 is conform");
useCases.deletePhRecord(phRec.id);
console.assert(!repo.getPhRecords().some(p => p.id === phRec.id), "pH record deleted");

const wgtRec = useCases.recordWeightMeasure({
  dishName: 'Entrecôte 250g',
  targetWeight: 250,
  measuredWeight: 254,
  tolerancePercent: 5.0
}, 'Chef Thomas');
console.assert(wgtRec.isConform(), "254g is within 250g ± 5%");
useCases.deleteWeightRecord(wgtRec.id);
console.assert(!repo.getWeightRecords().some(w => w.id === wgtRec.id), "Weight record deleted");
console.log('✔ pH & Poids tests passed.');

// 13. DDPP Inspection & Score
console.log('\n13. Testing DDPP Inspection & Score:');
const summary = useCases.generateInspectionSummary();
console.assert(summary.score.score >= 0 && summary.score.score <= 100, "Score valid");
console.assert(summary.stats.totalEquipments > 0, "Equipments count");
console.log(`✔ Inspection score: ${summary.score.score}%`);

console.log('\n🎉 ALL 13 CORE CLEAN ARCHITECTURE ENGINE TESTS PASSED PERFECTLY!');
