/**
 * TraqHACCP Pro - Infrastructure Layer: Storage Repository
 * Clean Architecture - Repository Pattern with LocalStorage & Serialization
 *
 * Seule couche autorisée à toucher localStorage (100 % try/catch).
 * Clés et méthodes v3 conservées telles quelles ; ajouts v4 : brigade, réglages,
 * session, journal d'activité + migration silencieuse et idempotente v3 → v4.
 */

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
  ChecklistItem,
  ChecklistRoutine,
  SanitaryDocument,
  PhControlRecord,
  WeightControlRecord,
  normalizeOperator,
  normalizeSettings
} from '../domain/entities.js';

import {
  DEFAULT_BRIGADE,
  DEFAULT_CHECKLIST_ROUTINES,
  DEFAULT_ESTABLISHMENT,
  DEFAULT_SETTINGS
} from '../domain/constants.js';

const DEFAULT_SANITARY_DOCUMENTS = [
  { id: 'DOC-01', title: 'Attestation Formation Hygiène Alimentaire (14h)', category: 'formation', issuer: 'Organisme Agréé Qualiopi Agro-Conseil', fileDate: '10/01/2025', expireDate: '2028-01-10', notes: 'Attestation réglementaire pour Chef Thomas - Certificat n°HYG-8812', fileData: null, status: 'valid' },
  { id: 'DOC-02', title: 'Bon de passage Dératisation / 3D Trimestriel', category: 'nuisibles', issuer: 'Anti-Nuisibles Pro France', fileDate: '15/08/2026', expireDate: '2026-11-15', notes: 'Visite T3 : 8 appâts vérifiés, aucune trace d\'activité rongeurs/insectes', fileData: null, status: 'valid' },
  { id: 'DOC-03', title: 'Rapport Analyse Microbiologique Surfaces & Plats', category: 'analyses', issuer: 'Laboratoire Mérieux NutriSciences accrédité COFRAC', fileDate: '20/07/2026', expireDate: '2026-10-20', notes: 'Recherche Listeria & Salmonelle négative. Conforme critères FCD.', fileData: null, status: 'valid' },
  { id: 'DOC-04', title: 'Attestation de conformité potabilité Eau réseau', category: 'eau', issuer: 'Service des Eaux de Paris / ARS', fileDate: '15/03/2026', expireDate: '2027-03-15', notes: 'Conforme critères bactériologiques et physico-chimiques ARS', fileData: null, status: 'valid' }
];

const DEFAULT_PH_RECORDS = [
  { id: 'PH-01', product: 'Riz Vinaigré Sushi (Préparation)', measuredPh: 4.15, targetMaxPh: 4.30, comment: 'Acidification au vinaigre de riz conforme GBPH', operator: 'Chef Thomas', time: '10:30', status: 'ok' },
  { id: 'PH-02', product: 'Sauce Tomate Maison en bocal', measuredPh: 4.25, targetMaxPh: 4.50, comment: 'Bocaux pasteurisés stables', operator: 'Marie D.', time: '11:15', status: 'ok' }
];

const DEFAULT_WEIGHT_RECORDS = [
  { id: 'WGT-01', dishName: 'Pavé de Saumon Frais portionné (180g)', targetWeight: 180, measuredWeight: 184, tolerancePercent: 5.0, operator: 'Chef Thomas', time: '09:45', status: 'ok' },
  { id: 'WGT-02', dishName: 'Entrecôte Maturée portionnée (250g)', targetWeight: 250, measuredWeight: 252, tolerancePercent: 5.0, operator: 'Marie D.', time: '10:00', status: 'ok' },
  { id: 'WGT-03', dishName: 'Magret de Canard Rôti (300g)', targetWeight: 300, measuredWeight: 295, tolerancePercent: 5.0, operator: 'Lucas B.', time: '10:15', status: 'ok' }
];

const DEFAULT_CHECKLISTS_DATA = {
  ouverture: new ChecklistRoutine({
    type: 'OUVERTURE',
    items: DEFAULT_CHECKLIST_ROUTINES.OUVERTURE.map(it => new ChecklistItem(it))
  }),
  fermeture: new ChecklistRoutine({
    type: 'FERMETURE',
    items: DEFAULT_CHECKLIST_ROUTINES.FERMETURE.map(it => new ChecklistItem(it))
  })
};

const DEFAULT_EQUIPMENTS = [
  { id: 'cf_pos1', name: 'Chambre Froide Positive 1 (Viandes)', type: 'froid_pos', min: 0.0, max: 4.0, current: 2.8, status: 'ok', lastLog: '08:30', operator: 'Chef Thomas' },
  { id: 'cf_pos2', name: 'Chambre Froide Positive 2 (Légumes)', type: 'froid_pos', min: 2.0, max: 6.0, current: 3.5, status: 'ok', lastLog: '08:32', operator: 'Chef Thomas' },
  { id: 'cf_neg', name: 'Chambre Froide Négative (Surgelés)', type: 'froid_neg', min: -24.0, max: -18.0, current: -20.2, status: 'ok', lastLog: '08:35', operator: 'Chef Thomas' },
  { id: 'frigo_patis', name: 'Tour Réfrigéré Pâtisserie', type: 'froid_pos', min: 0.0, max: 4.0, current: 3.1, status: 'ok', lastLog: '08:36', operator: 'Sarah M.' },
  { id: 'frigo_bar', name: 'Frigo Bar & Boissons', type: 'froid_pos', min: 2.0, max: 8.0, current: 5.4, status: 'ok', lastLog: '08:40', operator: 'Lucas B.' },
  { id: 'bain_marie', name: 'Bain-Marie Chaud Service', type: 'chaud', min: 63.0, max: 95.0, current: 71.0, status: 'ok', lastLog: '11:45', operator: 'Chef Thomas' }
];

const DEFAULT_DELIVERIES = [
  { id: 'REC-01', supplier: 'Transgourmet', bl: 'BL-99382', truckTemp: 3.1, prodTemp: 2.8, category: 'Produits Frais / Crémerie', conformPackaging: true, conformDlc: true, decision: 'Conforme', time: '07:45', operator: 'Chef Thomas', photo: null },
  { id: 'REC-02', supplier: 'Marée Fraîche Bretagne', bl: 'BL-44210', truckTemp: 1.5, prodTemp: 1.2, category: 'Poissons & Fruits de Mer', conformPackaging: true, conformDlc: true, decision: 'Conforme', time: '08:15', operator: 'Marie D.', photo: null },
  { id: 'REC-03', supplier: 'Boucheries du Centre', bl: 'BL-11093', truckTemp: 2.9, prodTemp: 3.4, category: 'Viandes & Volailles', conformPackaging: true, conformDlc: true, decision: 'Conforme', time: '09:00', operator: 'Chef Thomas', photo: null }
];

const DEFAULT_PREPARATIONS = [
  { id: 'PR-101', name: 'Crème Entière 35% (Étiquette Isigny)', batch: 'LOT-20260916-01', fabDate: '16/09/2026', dlcDate: '24/09/2026', durationDays: 8, quantity: '5 L', allergens: ['Lait (lactose compris)'], operator: 'Marie D.', destinationClient: 'Table 4 / Buffet Mariage Martin', destinationRecipe: 'Sauce Émulsionnée Béarnaise', photo: null },
  { id: 'PR-102', name: 'Filets de Poulet Fermier Label Rouge', batch: 'LOT-20260915-44', fabDate: '15/09/2026', dlcDate: '20/09/2026', durationDays: 5, quantity: '10 kg', allergens: [], operator: 'Chef Thomas', destinationClient: 'Buffet Entreprise Sotech', destinationRecipe: 'Fond Blanc & Suprêmes Rôtis', photo: null },
  { id: 'PR-103', name: 'Thon Rouge de Ligne (Marée Fraîche)', batch: 'LOT-20260916-89', fabDate: '16/09/2026', dlcDate: '18/09/2026', durationDays: 2, quantity: '4 kg', allergens: ['Poissons'], operator: 'Chef Thomas', destinationClient: 'Client Dupont - Commande #12', destinationRecipe: 'Tartare de Thon Mariné', photo: null },
  { id: 'PR-104', name: 'Chocolat Noir Valrhona 70%', batch: 'LOT-20260915-12', fabDate: '15/09/2026', dlcDate: '15/12/2026', durationDays: 90, quantity: '3 kg', allergens: ['Lait (lactose compris)'], operator: 'Sarah M.', destinationClient: 'Tous clients', destinationRecipe: 'Mousse Chocolat Grand Cru', photo: null }
];

const DEFAULT_ALLERGEN_DISHES = [
  { id: 'ALD-01', name: 'Saumon mariné gravlax à l\'aneth', category: 'Entrée', allergens: ['Poissons', 'Moutarde'] },
  { id: 'ALD-02', name: 'Bœuf Bourguignon & Pommes Vapeur', category: 'Plat Chaud', allergens: ['Anhydride sulfureux et sulfites (>10mg/kg)', 'Céleri'] },
  { id: 'ALD-03', name: 'Risotto crémeux aux Gambas sauvages', category: 'Plat Chaud', allergens: ['Crustacés', 'Lait (lactose compris)', 'Anhydride sulfureux et sulfites (>10mg/kg)'] },
  { id: 'ALD-04', name: 'Tarte fine aux Pommes & Pâte feuilletée', category: 'Dessert', allergens: ['Gluten (blé, seigle, orge, avoine)', 'Lait (lactose compris)', 'Œufs'] }
];

const DEFAULT_CLEANINGS = [
  { id: 'CL-01', title: 'Désinfection Plans de Travail Inox & Planches', zone: 'cuisine', freq: 'Après chaque service', status: 'done', operator: 'Lucas B.', time: '14:30', ppeRequired: 'Gants, Tablier' },
  { id: 'CL-02', title: 'Lavage et Assainissement des Sols Cuisine', zone: 'cuisine', freq: 'Quotidien Soir', status: 'pending', operator: '-', time: '-', ppeRequired: 'Bottes, Gants de ménage' },
  { id: 'CL-03', title: 'Nettoyage des Bacs à Graisse & Siphons de Plonge', zone: 'plonge', freq: 'Hebdomadaire', status: 'done', operator: 'Lucas B.', time: '09:00', ppeRequired: 'Gants étanches, Lunettes' },
  { id: 'CL-04', title: 'Dégivrage & Nettoyage Chambre Froide 1', zone: 'froid', freq: 'Mensuel', status: 'pending', operator: '-', time: '-', ppeRequired: 'Gants froids, Veste' },
  { id: 'CL-05', title: 'Dépoussiérage et Dégraissage Filtres Hottes', zone: 'cuisine', freq: 'Hebdomadaire', status: 'done', operator: 'Chef Thomas', time: '07:30', ppeRequired: 'Gants, Lunettes' },
  { id: 'CL-06', title: 'Désinfection Poignées de Frigos & Portes', zone: 'froid', freq: 'Quotidien', status: 'done', operator: 'Marie D.', time: '11:00', ppeRequired: 'Gants' }
];

const DEFAULT_FRYERS = [
  { id: 'fryer-1', name: 'Friteuse Principale (Frites fraîches)', volume: '15L', lastTpm: 14.5, status: 'ok', lastChange: '12/09/2026', operator: 'Lucas B.' },
  { id: 'fryer-2', name: 'Friteuse Poissons / Beignets', volume: '10L', lastTpm: 21.0, status: 'warning', lastChange: '09/09/2026', operator: 'Marie D.' }
];

const DEFAULT_COOLINGS = [
  { id: 'cool-01', dish: 'Joue de Bœuf Braisée', startTemp: 78.5, endTemp: 7.2, startTime: '10:00', endTime: '11:25', durationMinutes: 85, status: 'success', operator: 'Chef Thomas' }
];

const DEFAULT_DEFROSTS = [
  { id: 'def-01', product: 'Filets de Dorade Royale IQF', batchOrigin: 'LOT-MAREE-771', startDate: '16/09/2026', maxDlcDate: '18/09/2026', chamberName: 'Chambre Froide Positive 1', status: 'en_cours', operator: 'Marie D.' }
];

const DEFAULT_NON_CONFORMITIES = [
  { id: 'NC-2026-01', date: '16/09/2026 08:35', category5M: 'Matériel', severity: 'Majeure', equipOrSubject: 'Chambre Froide Négative (-15.2°C)', cause: 'Porte restée mal enclenchée suite approvisionnement', action: 'Porte refermée, vérification 30 min après à -19.5°C. Pas de décongélation.', operator: 'Chef Thomas', status: 'Résolu' }
];

/* ═══════════════════════════════════════════════════════════════════
   V4 — structures persistées (brigade, réglages, session, journal)
   ═══════════════════════════════════════════════════════════════════ */

/** Version du schéma des sauvegardes produites. */
const SCHEMA_VERSION = '4.0-registre';

/** Plafond du journal d'activité : les entrées les plus récentes sont conservées. */
const JOURNAL_MAX_ENTREES = 500;

/** Session vide : aucun opérateur connecté. */
const SESSION_VIDE = { currentOperatorId: null, startedAt: null, lockedAt: null };

export class LocalStorageHACCPRepository {
  constructor(storagePrefix = 'traqhaccp_v2_') {
    this.prefix = storagePrefix;
    /** Migration v3 → v4 : exécutée une seule fois, paresseusement au premier accès v4. */
    this._migrationEffectuee = false;
  }

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("Storage read error", e);
      return fallback;
    }
  }

  _set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (e) {
      const quota = /quota|exceed/i.test(`${e && e.name} ${e && e.message}`);
      console.error(
        quota
          ? `Stockage saturé : enregistrement impossible pour « ${key} ». Exportez la sauvegarde puis libérez de l'espace.`
          : `Écriture impossible dans le stockage pour « ${key} ».`,
        e
      );
      return false;
    }
  }

  getEquipments() {
    const raw = this._get('equipments', DEFAULT_EQUIPMENTS);
    return raw.map(item => new Equipment(item));
  }

  saveEquipments(equipments) {
    this._set('equipments', equipments);
  }

  getDeliveries() {
    const raw = this._get('deliveries', DEFAULT_DELIVERIES);
    return raw.map(item => new DeliveryRecord(item));
  }

  saveDeliveries(deliveries) {
    this._set('deliveries', deliveries);
  }

  getPreparations() {
    const raw = this._get('preparations', DEFAULT_PREPARATIONS);
    return raw.map(item => new PreparationLabel(item));
  }

  savePreparations(preps) {
    this._set('preparations', preps);
  }

  getAllergenDishes() {
    const raw = this._get('allergenDishes', DEFAULT_ALLERGEN_DISHES);
    return raw.map(item => new DishAllergens(item));
  }

  saveAllergenDishes(dishes) {
    this._set('allergenDishes', dishes);
  }

  getCleaningTasks() {
    const raw = this._get('cleanings', DEFAULT_CLEANINGS);
    return raw.map(item => new CleaningTask(item));
  }

  saveCleaningTasks(tasks) {
    this._set('cleanings', tasks);
  }

  getFryers() {
    const raw = this._get('fryers', DEFAULT_FRYERS);
    return raw.map(item => new Fryer(item));
  }

  saveFryers(fryers) {
    this._set('fryers', fryers);
  }

  getCoolingCycles() {
    const raw = this._get('coolings', DEFAULT_COOLINGS);
    return raw.map(item => new CoolingCycle(item));
  }

  saveCoolingCycles(cycles) {
    this._set('coolings', cycles);
  }

  getDefrostCycles() {
    const raw = this._get('defrosts', DEFAULT_DEFROSTS);
    return raw.map(item => new DefrostCycle(item));
  }

  saveDefrostCycles(cycles) {
    this._set('defrosts', cycles);
  }

  getNonConformities() {
    const raw = this._get('nonConformities', DEFAULT_NON_CONFORMITIES);
    return raw.map(item => new NonConformity(item));
  }

  saveNonConformities(ncs) {
    this._set('nonConformities', ncs);
  }

  getChecklists() {
    const raw = this._get('checklists', DEFAULT_CHECKLISTS_DATA);
    return {
      ouverture: new ChecklistRoutine(raw.ouverture || DEFAULT_CHECKLISTS_DATA.ouverture),
      fermeture: new ChecklistRoutine(raw.fermeture || DEFAULT_CHECKLISTS_DATA.fermeture)
    };
  }

  saveChecklists(checklists) {
    this._set('checklists', checklists);
  }

  getSanitaryDocuments() {
    const raw = this._get('sanitaryDocuments', DEFAULT_SANITARY_DOCUMENTS);
    return raw.map(item => new SanitaryDocument(item));
  }

  saveSanitaryDocuments(docs) {
    this._set('sanitaryDocuments', docs);
  }

  getPhRecords() {
    const raw = this._get('phRecords', DEFAULT_PH_RECORDS);
    return raw.map(item => new PhControlRecord(item));
  }

  savePhRecords(records) {
    this._set('phRecords', records);
  }

  getWeightRecords() {
    const raw = this._get('weightRecords', DEFAULT_WEIGHT_RECORDS);
    return raw.map(item => new WeightControlRecord(item));
  }

  saveWeightRecords(records) {
    this._set('weightRecords', records);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Migration v3 → v4 — silencieuse, idempotente
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Normalise les données héritées v3 au premier accès v4.
   * Ne lève jamais d'exception : une migration ratée laisse les données intactes.
   */
  _migrerV3VersV4() {
    if (this._migrationEffectuee) return;
    this._migrationEffectuee = true;
    try {
      // 1. Brigade : membres sans role / active → normalizeOperator()
      const brigadeBrute = this._get('brigade', null);
      const brigadeMigree = this._normaliserBrigade(
        Array.isArray(brigadeBrute) && brigadeBrute.length ? brigadeBrute : DEFAULT_BRIGADE
      );
      if (JSON.stringify(brigadeBrute) !== JSON.stringify(brigadeMigree)) {
        this._set('brigade', brigadeMigree);
      }

      // 2. Réglages : absents → DEFAULT_SETTINGS ; partiels → normalizeSettings()
      const reglages = this._get('settings', null);
      if (!reglages || typeof reglages !== 'object' || Array.isArray(reglages)) {
        this._set('settings', normalizeSettings({ ...DEFAULT_SETTINGS }));
      } else {
        this._set('settings', normalizeSettings(reglages));
      }

      // 3. Session et journal : structures vides si absentes (jamais de perte)
      const session = this._get('session', null);
      if (!session || typeof session !== 'object') this._set('session', { ...SESSION_VIDE });
      if (!Array.isArray(this._get('activityLog', null))) this._set('activityLog', []);
    } catch (e) {
      console.warn('Migration v3 → v4 ignorée : les données existantes restent intactes.', e);
    }
  }

  /** Applique le format v4 à une brigade et garantit « au moins un gérant actif ». */
  _normaliserBrigade(liste) {
    const brigade = (Array.isArray(liste) ? liste : []).map(membre => normalizeOperator(membre));
    const gerantActif = brigade.some(m => m.role === 'gerant' && m.active !== false);
    if (!gerantActif) {
      const premier = brigade.find(m => m.active !== false);
      if (premier) premier.role = 'gerant';
    }
    return brigade;
  }

  /* ═══════════════════════════════════════════════════════════════════
     V4 — brigade, établissement, réglages, session, journal
     ═══════════════════════════════════════════════════════════════════ */

  getBrigade() {
    this._migrerV3VersV4();
    const brute = this._get('brigade', DEFAULT_BRIGADE);
    return this._normaliserBrigade(Array.isArray(brute) && brute.length ? brute : DEFAULT_BRIGADE);
  }

  saveBrigade(brigade) {
    const normalisee = this._normaliserBrigade(brigade);
    this._set('brigade', normalisee);
    return normalisee;
  }

  getSettings() {
    this._migrerV3VersV4();
    return normalizeSettings(this._get('settings', null));
  }

  saveSettings(settings) {
    const complet = normalizeSettings(settings);
    this._set('settings', complet);
    return complet;
  }

  getSession() {
    this._migrerV3VersV4();
    const brute = this._get('session', null);
    if (!brute || typeof brute !== 'object') return { ...SESSION_VIDE };
    return {
      currentOperatorId: brute.currentOperatorId ?? null,
      startedAt:         brute.startedAt ?? null,
      lockedAt:          brute.lockedAt ?? null
    };
  }

  saveSession(session) {
    const propre = session && typeof session === 'object' ? session : SESSION_VIDE;
    const enregistree = {
      currentOperatorId: propre.currentOperatorId ?? null,
      startedAt:         propre.startedAt ?? null,
      lockedAt:          propre.lockedAt ?? null
    };
    this._set('session', enregistree);
    return enregistree;
  }

  getActivityLog() {
    this._migrerV3VersV4();
    const journal = this._get('activityLog', []);
    return Array.isArray(journal) ? journal : [];
  }

  /** Ajoute une entrée au journal (plus récentes d'abord, cap 500). */
  appendActivity(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const entree = {
      at:           entry.at || new Date().toISOString(),
      operatorId:   entry.operatorId ?? null,
      operatorName: entry.operatorName ?? '',
      action:       entry.action ?? 'action',
      target:       entry.target ?? '',
      details:      entry.details ?? ''
    };
    const journal = [entree, ...this.getActivityLog()].slice(0, JOURNAL_MAX_ENTREES);
    this._set('activityLog', journal);
    return entree;
  }

  getEstablishment() {
    const brut = this._get('establishment', null);
    return brut && typeof brut === 'object' ? brut : { ...DEFAULT_ESTABLISHMENT };
  }

  /** Fusionne un correctif partiel dans l'établissement enregistré. */
  saveEstablishment(patch) {
    const enregistre = { ...this.getEstablishment(), ...(patch && typeof patch === 'object' ? patch : {}) };
    this._set('establishment', enregistre);
    return enregistre;
  }

  exportFullBackupJSON() {
    return JSON.stringify({
      version: SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      establishment: this.getEstablishment(),
      equipments: this.getEquipments(),
      deliveries: this.getDeliveries(),
      preparations: this.getPreparations(),
      allergenDishes: this.getAllergenDishes(),
      cleanings: this.getCleaningTasks(),
      fryers: this.getFryers(),
      coolings: this.getCoolingCycles(),
      defrosts: this.getDefrostCycles(),
      nonConformities: this.getNonConformities(),
      checklists: this.getChecklists(),
      sanitaryDocuments: this.getSanitaryDocuments(),
      phRecords: this.getPhRecords(),
      weightRecords: this.getWeightRecords(),
      brigade: this.getBrigade(),
      settings: this.getSettings(),
      session: this.getSession(),
      activityLog: this.getActivityLog()
    }, null, 2);
  }

  /**
   * Importe une sauvegarde JSON v3 (clés à la racine) ou v4 (objet `records`).
   * Tolérant : n'écrase jamais une section absente ou vide du fichier.
   */
  importFullBackupJSON(jsonString) {
    try {
      const racine = JSON.parse(jsonString);
      const data = racine && typeof racine === 'object' ? racine : {};
      const rec = data.records && typeof data.records === 'object' ? data.records : null;
      const lire = (...cles) => {
        for (const cle of cles) {
          const depuisRecords = rec && Array.isArray(rec[cle]) ? rec[cle] : null;
          if (depuisRecords) return depuisRecords;
          if (Array.isArray(data[cle])) return data[cle];
        }
        return null;
      };
      const ecrire = (liste, sauvegarde) => { if (liste && liste.length) sauvegarde.call(this, liste); };

      if (data.establishment) this.saveEstablishment(data.establishment);
      if (Array.isArray(data.brigade) && data.brigade.length) this.saveBrigade(data.brigade);
      if (data.settings && typeof data.settings === 'object') this.saveSettings(data.settings);
      if (data.session && typeof data.session === 'object') this.saveSession(data.session);
      if (Array.isArray(rec && rec.activityLog) && rec.activityLog.length) this._set('activityLog', rec.activityLog);
      else if (Array.isArray(data.activityLog) && data.activityLog.length) this._set('activityLog', data.activityLog);

      ecrire(lire('equipments'), this.saveEquipments);
      ecrire(lire('deliveries'), this.saveDeliveries);
      ecrire(lire('preparations'), this.savePreparations);
      ecrire(lire('allergenDishes'), this.saveAllergenDishes);
      ecrire(lire('cleanings', 'cleaning'), this.saveCleaningTasks);
      ecrire(lire('fryers', 'oils'), this.saveFryers);
      ecrire(lire('coolings', 'cooling'), this.saveCoolingCycles);
      ecrire(lire('defrosts', 'defrost'), this.saveDefrostCycles);
      ecrire(lire('nonConformities'), this.saveNonConformities);
      ecrire(lire('sanitaryDocuments', 'documents'), this.saveSanitaryDocuments);
      ecrire(lire('phRecords', 'ph'), this.savePhRecords);
      ecrire(lire('weightRecords', 'weights'), this.saveWeightRecords);

      const checklists = (rec && rec.checklists) || data.checklists;
      if (checklists && (checklists.ouverture || checklists.fermeture)) this.saveChecklists(checklists);
      return true;
    } catch (e) {
      console.error("Backup import failed", e);
      return false;
    }
  }

  resetToDemo() {
    localStorage.clear();
    this._migrationEffectuee = false;
  }
}
