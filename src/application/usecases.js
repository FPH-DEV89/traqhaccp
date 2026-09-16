/**
 * TraqHACCP Pro - Application Layer: Use Cases
 * Clean Architecture - Use Cases & Interactors
 */

import { 
  DeliveryRecord, 
  PreparationLabel, 
  DishAllergens, 
  NonConformity, 
  CoolingCycle, 
  DefrostCycle,
  SanitaryDocument,
  PhControlRecord,
  WeightControlRecord,
  ChecklistItem,
  ChecklistRoutine
} from '../domain/entities.js';
import { HACCP_NORMS, DEFAULT_CHECKLIST_ROUTINES } from '../domain/constants.js';

export class HACCPUseCases {
  constructor(repository, audioService) {
    this.repository = repository;
    this.audio = audioService;
  }

  // 1. Thermométrie
  logTemperature(equipId, delta, operatorName) {
    const equipments = this.repository.getEquipments();
    const eq = equipments.find(e => e.id === equipId);
    if (!eq) throw new Error("Équipement introuvable");

    const newTemp = parseFloat((eq.current + delta).toFixed(1));
    eq.recordTemperature(newTemp, operatorName);
    this.repository.saveEquipments(equipments);

    const isConform = eq.isConform();
    if (!isConform) {
      this.audio.play('warning');
      return { success: true, isConform: false, equipment: eq };
    } else {
      this.audio.play('success');
      return { success: true, isConform: true, equipment: eq };
    }
  }

  resolveTemperatureIncident(equipId, actionTaken, comment, operatorName) {
    const equipments = this.repository.getEquipments();
    const eq = equipments.find(e => e.id === equipId);
    
    const nc = new NonConformity({
      category5M: 'Matériel',
      severity: 'Critique',
      equipOrSubject: eq ? `${eq.name} (${eq.current}°C)` : 'Enceinte Frigorifique',
      cause: `Écart de température hors seuil sanitaire [${eq ? eq.min : 0}°C ; ${eq ? eq.max : 4}°C]`,
      action: actionTaken + (comment ? ` - Obs: ${comment}` : ''),
      operator: operatorName,
      status: 'Résolu'
    });

    const ncs = this.repository.getNonConformities();
    ncs.unshift(nc);
    this.repository.saveNonConformities(ncs);
    this.audio.play('success');
    return nc;
  }

  autoLogStandardTemps(operatorName) {
    const equipments = this.repository.getEquipments();
    equipments.forEach(eq => {
      if (eq.type === 'froid_pos') eq.recordTemperature(2.4, operatorName);
      else if (eq.type === 'froid_neg') eq.recordTemperature(-20.2, operatorName);
      else if (eq.type === 'chaud') eq.recordTemperature(72.5, operatorName);
    });
    this.repository.saveEquipments(equipments);
    this.audio.play('success');
    return equipments;
  }

  // 2. Contrôle Réception
  recordDelivery(data, operatorName) {
    const record = new DeliveryRecord({ ...data, operator: operatorName });
    const deliveries = this.repository.getDeliveries();
    deliveries.unshift(record);
    this.repository.saveDeliveries(deliveries);

    // Si rejet de marchandise, consigner automatiquement en Non-Conformité
    if (record.isRejected()) {
      const nc = new NonConformity({
        category5M: 'Matière Première',
        severity: 'Critique',
        equipOrSubject: `Livraison Rejetée : ${record.supplier} (${record.bl})`,
        cause: `Rupture chaîne du froid (Camion: ${record.truckTemp}°C, Produit: ${record.prodTemp}°C) ou emballage détérioré`,
        action: 'Marchandise refusée au déchargement, notification immédiate au transporteur',
        operator: operatorName,
        status: 'Traité'
      });
      const ncs = this.repository.getNonConformities();
      ncs.unshift(nc);
      this.repository.saveNonConformities(ncs);
      this.audio.play('warning');
    } else {
      this.audio.play('success');
    }

    return record;
  }

  deleteDelivery(id) {
    let deliveries = this.repository.getDeliveries();
    deliveries = deliveries.filter(d => d.id !== id);
    this.repository.saveDeliveries(deliveries);
    return true;
  }

  // 3. Traçabilité DLC
  createPreparationLabel(data, operatorName) {
    const prep = new PreparationLabel({ ...data, operator: operatorName });
    const preps = this.repository.getPreparations();
    preps.unshift(prep);
    this.repository.savePreparations(preps);
    this.audio.play('success');
    return prep;
  }

  deletePreparation(id) {
    let preps = this.repository.getPreparations();
    preps = preps.filter(p => p.id !== id);
    this.repository.savePreparations(preps);
    return true;
  }

  // 4. Matrice 14 Allergènes INCO
  addAllergenDish(data) {
    const dish = new DishAllergens(data);
    const dishes = this.repository.getAllergenDishes();
    dishes.push(dish);
    this.repository.saveAllergenDishes(dishes);
    this.audio.play('success');
    return dish;
  }

  deleteAllergenDish(id) {
    let dishes = this.repository.getAllergenDishes();
    dishes = dishes.filter(d => d.id !== id);
    this.repository.saveAllergenDishes(dishes);
    return true;
  }

  // 5. Plan de Nettoyage
  toggleCleaningTask(taskId, operatorName) {
    const tasks = this.repository.getCleaningTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;

    task.toggle(operatorName);
    this.repository.saveCleaningTasks(tasks);
    this.audio.play('success');
    return task;
  }

  resetCleaningPlan() {
    const tasks = this.repository.getCleaningTasks();
    tasks.forEach(t => { t.status = 'pending'; t.operator = '-'; t.time = '-'; });
    this.repository.saveCleaningTasks(tasks);
    return tasks;
  }

  // 6. Huiles de Friture
  recordOilTest(fryerId, tpm, actionType, operatorName) {
    const fryers = this.repository.getFryers();
    const fryer = fryers.find(f => f.id === fryerId);
    if (!fryer) throw new Error("Friteuse introuvable");

    const status = fryer.recordTpm(tpm, actionType, operatorName);
    this.repository.saveFryers(fryers);

    if (tpm > HACCP_NORMS.OILS.CRITICAL_TPM) {
      const nc = new NonConformity({
        category5M: 'Matière Première',
        severity: 'Critique',
        equipOrSubject: `Friteuse dégradée : ${fryer.name} (${tpm}% TPM)`,
        cause: `Dépassement du seuil légal maximal de 24% de composés polaires (Décret 2008-184)`,
        action: actionType.toLowerCase().includes('vidange') ? 'Vidange complète et nettoyage effectués' : 'Vidange totale immédiate obligatoire',
        operator: operatorName,
        status: 'Traité'
      });
      const ncs = this.repository.getNonConformities();
      ncs.unshift(nc);
      this.repository.saveNonConformities(ncs);
      this.audio.play('warning');
    } else {
      this.audio.play('success');
    }

    return fryer;
  }

  // 7. Refroidissement Rapide
  startCoolingCycle(data, operatorName) {
    const cycle = new CoolingCycle({ ...data, operator: operatorName });
    const cycles = this.repository.getCoolingCycles();
    cycles.unshift(cycle);
    this.repository.saveCoolingCycles(cycles);
    this.audio.play('success');
    return cycle;
  }

  // 8. Décongélation Sanitaire Sécurisée
  startDefrostCycle(data, operatorName) {
    const cycle = new DefrostCycle({ ...data, operator: operatorName });
    const cycles = this.repository.getDefrostCycles();
    cycles.unshift(cycle);
    this.repository.saveDefrostCycles(cycles);
    this.audio.play('success');
    return cycle;
  }

  updateDefrostStatus(id, newStatus) {
    const cycles = this.repository.getDefrostCycles();
    const item = cycles.find(c => c.id === id);
    if (item) {
      item.status = newStatus;
      this.repository.saveDefrostCycles(cycles);
    }
    return item;
  }

  // 9. Non-Conformités manuelles
  declareNonConformity(data, operatorName) {
    const nc = new NonConformity({ ...data, operator: operatorName });
    const ncs = this.repository.getNonConformities();
    ncs.unshift(nc);
    this.repository.saveNonConformities(ncs);
    this.audio.play('success');
    return nc;
  }

  deleteNonConformity(id) {
    let ncs = this.repository.getNonConformities();
    ncs = ncs.filter(n => n.id !== id);
    this.repository.saveNonConformities(ncs);
    return true;
  }

  // 10. Moteur de Score Sanitaire Pondéré DDPP
  calculateSanitaryScore() {
    const equipments = this.repository.getEquipments();
    const cleanings = this.repository.getCleaningTasks();
    const fryers = this.repository.getFryers();
    const receptions = this.repository.getDeliveries();

    let tempPoints = 0;
    equipments.forEach(e => { if (e.isConform()) tempPoints++; });
    const tempRate = equipments.length ? (tempPoints / equipments.length) : 1;

    let cleanPoints = 0;
    cleanings.forEach(c => { if (c.status === 'done') cleanPoints++; });
    const cleanRate = cleanings.length ? (cleanPoints / cleanings.length) : 1;

    let oilPoints = 0;
    fryers.forEach(f => { if (f.lastTpm <= HACCP_NORMS.OILS.CRITICAL_TPM) oilPoints++; });
    const oilRate = fryers.length ? (oilPoints / fryers.length) : 1;

    let recPoints = 0;
    receptions.forEach(r => { if (!r.isRejected()) recPoints++; });
    const recRate = receptions.length ? (recPoints / receptions.length) : 1;

    // Pondération officielle DDPP : Températures (35%), Nettoyage (25%), Huiles (15%), Réceptions (25%)
    const globalScore = Math.round((tempRate * 35) + (cleanRate * 25) + (oilRate * 15) + (recRate * 25));
    return {
      score: globalScore,
      tempRate: Math.round(tempRate * 100),
      cleanRate: Math.round(cleanRate * 100),
      oilRate: Math.round(oilRate * 100),
      recRate: Math.round(recRate * 100),
      isAuditReady: globalScore >= 85
    };
  }

  // 11. Checklists d'Ouverture & Fermeture
  toggleChecklistTask(routineType, itemId, operatorName) {
    const checklists = this.repository.getChecklists();
    const routineKey = routineType.toLowerCase();
    const routine = checklists[routineKey];
    if (!routine) return null;

    const item = routine.items.find(it => it.id === itemId);
    if (!item) return null;

    item.toggle(operatorName);
    this.repository.saveChecklists(checklists);
    this.audio.play('success');
    return item;
  }

  validateChecklistRoutine(routineType, operatorName) {
    const checklists = this.repository.getChecklists();
    const routineKey = routineType.toLowerCase();
    const routine = checklists[routineKey];
    if (!routine) return null;

    routine.validate(operatorName);
    this.repository.saveChecklists(checklists);
    this.audio.play('success');
    return routine;
  }

  resetChecklists() {
    const freshChecklists = {
      ouverture: new ChecklistRoutine({
        type: 'OUVERTURE',
        items: DEFAULT_CHECKLIST_ROUTINES.OUVERTURE.map(it => new ChecklistItem(it))
      }),
      fermeture: new ChecklistRoutine({
        type: 'FERMETURE',
        items: DEFAULT_CHECKLIST_ROUTINES.FERMETURE.map(it => new ChecklistItem(it))
      })
    };
    this.repository.saveChecklists(freshChecklists);
    this.audio.play('success');
    return freshChecklists;
  }

  // 12. GED Sanitaire (Documents et Certificats)
  addSanitaryDocument(data) {
    const doc = new SanitaryDocument(data);
    const docs = this.repository.getSanitaryDocuments();
    docs.unshift(doc);
    this.repository.saveSanitaryDocuments(docs);
    this.audio.play('success');
    return doc;
  }

  deleteSanitaryDocument(id) {
    let docs = this.repository.getSanitaryDocuments();
    docs = docs.filter(d => d.id !== id);
    this.repository.saveSanitaryDocuments(docs);
    return true;
  }

  // 13. Contrôle du pH
  recordPhMeasure(data, operatorName) {
    const record = new PhControlRecord({ ...data, operator: operatorName });
    const records = this.repository.getPhRecords();
    records.unshift(record);
    this.repository.savePhRecords(records);

    // Alerte et création automatique de Non-Conformité si dépassement
    if (!record.isConform()) {
      const nc = new NonConformity({
        category5M: 'Matière Première',
        severity: 'Critique',
        equipOrSubject: `pH Non Conforme : ${record.product} (pH ${record.measuredPh} > max ${record.targetMaxPh})`,
        cause: `Échec d'acidification du produit (risque de développement Clostridium botulinum / germes pathogènes)`,
        action: 'Acidification rectifiée immédiatement ou lot consigné pour destruction',
        operator: operatorName,
        status: 'Traité'
      });
      const ncs = this.repository.getNonConformities();
      ncs.unshift(nc);
      this.repository.saveNonConformities(ncs);
      this.audio.play('warning');
    } else {
      this.audio.play('success');
    }

    return record;
  }

  deletePhRecord(id) {
    let records = this.repository.getPhRecords();
    records = records.filter(r => r.id !== id);
    this.repository.savePhRecords(records);
    return true;
  }

  // 14. Contrôle de Poids / Portionnement
  recordWeightMeasure(data, operatorName) {
    const record = new WeightControlRecord({ ...data, operator: operatorName });
    const records = this.repository.getWeightRecords();
    records.unshift(record);
    this.repository.saveWeightRecords(records);

    if (!record.isConform()) {
      this.audio.play('warning');
    } else {
      this.audio.play('success');
    }

    return record;
  }

  deleteWeightRecord(id) {
    let records = this.repository.getWeightRecords();
    records = records.filter(r => r.id !== id);
    this.repository.saveWeightRecords(records);
    return true;
  }

  // 15. Synthèse Spéciale Inspection Sanitaire DDPP (6 derniers mois)
  generateInspectionSummary() {
    const establishment = this.repository.getEstablishment();
    const score = this.calculateSanitaryScore();
    const equipments = this.repository.getEquipments();
    const deliveries = this.repository.getDeliveries();
    const preparations = this.repository.getPreparations();
    const ncs = this.repository.getNonConformities();
    const cleanings = this.repository.getCleaningTasks();
    const docs = this.repository.getSanitaryDocuments();
    const checklists = this.repository.getChecklists();
    const phRecords = this.repository.getPhRecords();

    return {
      establishment,
      inspectionDate: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      score,
      stats: {
        totalEquipments: equipments.length,
        conformEquipments: equipments.filter(e => e.isConform()).length,
        totalDeliveries: deliveries.length,
        rejectedDeliveries: deliveries.filter(d => d.isRejected()).length,
        totalPreparations: preparations.length,
        openNCs: ncs.filter(n => n.status !== 'Résolu' && n.status !== 'Traité').length,
        resolvedNCs: ncs.filter(n => n.status === 'Résolu' || n.status === 'Traité').length,
        cleaningRate: score.cleanRate,
        validDocuments: docs.filter(d => !d.isExpired()).length,
        expiredDocuments: docs.filter(d => d.isExpired()).length
      },
      checklistsStatus: {
        ouvertureDone: checklists.ouverture ? checklists.ouverture.isComplete() : false,
        fermetureDone: checklists.fermeture ? checklists.fermeture.isComplete() : false
      }
    };
  }
}

