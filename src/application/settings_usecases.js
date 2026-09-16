/**
 * TraqHACCP Pro — Couche Application : cas d'usage « réglages ».
 * Paramètres, seuils réglementaires ajustables, parc d'équipements, plan de nettoyage,
 * carte allergènes, sauvegarde / restauration et purge annuelle.
 * Clean Architecture : aucune dépendance DOM, aucune dépendance présentation.
 */

import {
  Equipment, CleaningTask, DishAllergens, normalizeOperator, normalizeSettings, validateOperator
} from '../domain/entities.js';
import { NORMS, ALLERGENS_14 } from '../domain/haccp_norms.js';
import { DEFAULT_BRIGADE, DEFAULT_ESTABLISHMENT, DEFAULT_SETTINGS } from '../domain/constants.js';
import { buildFullBackup, parseBackup } from '../infrastructure/export_service.js';
/** Thèmes, densités et unités acceptés par l'interface. */
const THEMES = ['papier', 'nuit'];
const DENSITES = ['compact', 'confortable', 'aere'];
const UNITES_TEMPERATURE = ['C', 'F'];
/** Zones connues du plan de nettoyage et types d'équipements de conservation. */
const ZONES = ['cuisine', 'froid', 'plonge', 'salle', 'reception', 'réserves'];
const TYPES_EQUIPEMENT = ['froid_pos', 'froid_neg', 'chaud'];
/** Plages admissibles des seuils ajustables, qui encadrent les valeurs de NORMS. */
const PLAGES_SEUILS = {
  'cold.positiveMin':    { min: -5,  max: 8,   unite: '°C', libelle: 'température minimale des enceintes froides positives' },
  'cold.positiveMax':    { min: -2,  max: 10,  unite: '°C', libelle: 'température maximale des enceintes froides positives' },
  'cold.frozenMax':      { min: -30, max: -12, unite: '°C', libelle: 'température maximale de conservation des surgelés' },
  'cold.vegetableMax':   { min: 0,   max: 10,  unite: '°C', libelle: 'température maximale des légumes et fruits' },
  'hot.serviceMin':      { min: 55,  max: 95,  unite: '°C', libelle: 'température minimale de maintien au chaud' },
  'cooling.fromTemp':    { min: 50,  max: 100, unite: '°C', libelle: 'température de départ du refroidissement' },
  'cooling.toTemp':      { min: 0,   max: 15,  unite: '°C', libelle: 'température cible de fin de refroidissement' },
  'cooling.maxHours':    { min: 1,   max: 4,   unite: 'h',  libelle: 'durée maximale de refroidissement rapide' },
  'defrost.maxTemp':     { min: 0,   max: 6,   unite: '°C', libelle: 'température maximale de décongélation' },
  'defrost.maxHours':    { min: 1,   max: 72,  unite: 'h',  libelle: 'délai maximal de consommation après décongélation' },
  'oil.tpmMax':          { min: 18,  max: 25,  unite: '%',  libelle: 'taux maximal de composés polaires (TPM)' },
  'oil.tpmAlert':        { min: 10,  max: 24,  unite: '%',  libelle: 'seuil d’alerte des composés polaires (TPM)' },
  'oil.restHours':       { min: 1,   max: 48,  unite: 'h',  libelle: 'durée de repos des huiles avant analyse' },
  'ph.min':              { min: 0,   max: 6,   unite: '',   libelle: 'valeur minimale de pH mesurable' },
  'ph.max':              { min: 2,   max: 14,  unite: '',   libelle: 'valeur maximale de pH mesurable' },
  'weight.lossAlertPct': { min: 1,   max: 30,  unite: '%',  libelle: 'seuil d’alerte de perte au portionnement' }
};
/** Seuils dont la valeur basse doit rester strictement inférieure à la haute. */
const COUPLES_ORDONNES = [
  ['cold.positiveMin', 'cold.positiveMax', 'La température basse des enceintes froides doit être inférieure à la température haute.'],
  ['cooling.toTemp', 'cooling.fromTemp', 'La température cible de refroidissement doit être inférieure à la température de départ.'],
  ['ph.min', 'ph.max', 'La valeur basse de pH doit être inférieure à la valeur haute.']
];
/** Contrôles des réglages simples : [valeur retenue, message d'erreur ou ''] par champ. */
const CONTROLES_REGLAGES = {
  theme: v => [String(v), THEMES.includes(v) ? '' : `Thème inconnu « ${v} ». Valeurs acceptées : ${THEMES.join(', ')}.`],
  density: v => {
    const densite = v === 'aéré' ? 'aere' : v;
    return [densite, DENSITES.includes(densite) ? '' : `Densité inconnue « ${v} ». Valeurs acceptées : ${DENSITES.join(', ')}.`];
  },
  tempUnit: v => [String(v), UNITES_TEMPERATURE.includes(v) ? '' : `Unité de température inconnue « ${v} ». Valeurs acceptées : C, F.`],
  sounds: v => [v, typeof v === 'boolean' ? '' : 'Le réglage des sons doit être vrai ou faux.'],
  autoLockMinutes: v => [Number(v), Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 120
    ? '' : 'Le verrouillage automatique doit être compris entre 0 et 120 minutes (0 pour jamais).'],
  backupReminderDays: v => [Number(v), Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 90
    ? '' : 'Le rappel de sauvegarde doit être compris entre 1 et 90 jours.'],
  lastBackupAt: v => [v, '']
};
/** Collections administrables : libellé, préfixe d'identifiant, accès repository. */
const COLLECTIONS = {
  equipments: { nom: 'Équipement',         prefixe: 'eq',  lire: 'getEquipments',     ecrire: 'saveEquipments' },
  cleaning:   { nom: 'Tâche de nettoyage', prefixe: 'CL',  lire: 'getCleaningTasks',  ecrire: 'saveCleaningTasks' },
  allergens:  { nom: 'Plat',               prefixe: 'ALD', lire: 'getAllergenDishes', ecrire: 'saveAllergenDishes' }
};
/** Sections de relevés reconnues dans une sauvegarde. */
const SECTIONS_SAUVEGARDE = [
  ['equipments', 'saveEquipments'], ['deliveries', 'saveDeliveries'], ['preparations', 'savePreparations'],
  ['allergenDishes', 'saveAllergenDishes'], ['cleaning', 'saveCleaningTasks'], ['cooling', 'saveCoolingCycles'],
  ['defrost', 'saveDefrostCycles'], ['nonConformities', 'saveNonConformities'], ['documents', 'saveSanitaryDocuments'],
  ['ph', 'savePhRecords'], ['weights', 'saveWeightRecords'], ['oils', 'saveFryers']
];
/** Sections purgées par année : lecture, écriture, champ de date. */
const SECTIONS_PURGEABLES = [
  ['preparations', 'getPreparations', 'savePreparations', 'fabDate'],
  ['defrosts', 'getDefrostCycles', 'saveDefrostCycles', 'startDate'],
  ['nonConformities', 'getNonConformities', 'saveNonConformities', 'date']
];
export class SettingsUseCases {
  constructor(repository) {
    if (!repository) throw new Error('SettingsUseCases : un repository est requis.');
    this.repository = repository;
  }
  /* ── Réglages généraux ──────────────────────────────────────────────── */
  /** Réglages complets et normalisés. */
  getSettings() {
    return normalizeSettings(this.repository.getSettings());
  }
  /** Applique un correctif partiel après contrôle de chaque champ. */
  updateSettings(patch = {}) {
    const actuel = this.getSettings();
    const corriger = patch && typeof patch === 'object' ? patch : {};
    const erreurs = {};
    const modifie = { ...actuel };
    for (const [champ, controler] of Object.entries(CONTROLES_REGLAGES)) {
      if (corriger[champ] === undefined) continue;
      const [valeur, message] = controler(corriger[champ]);
      if (message) erreurs[champ] = message;
      else modifie[champ] = valeur;
    }
    if (corriger.establishment !== undefined) {
      if (corriger.establishment && typeof corriger.establishment === 'object') {
        modifie.establishment = { ...actuel.establishment, ...corriger.establishment };
        if (!String(modifie.establishment.name ?? '').trim()) {
          erreurs['establishment.name'] = 'Le nom de l’établissement est obligatoire.';
        }
      } else {
        erreurs.establishment = 'L’établissement attendu est un objet (nom, adresse, SIRET).';
      }
    }
    if (Object.keys(erreurs).length) return { ok: false, errors: erreurs, data: null };
    return { ok: true, errors: {}, data: this.repository.saveSettings(normalizeSettings(modifie)) };
  }
  /** Réinitialise les réglages aux valeurs par défaut. */
  resetSettings() {
    return { ok: true, errors: {}, data: this.repository.saveSettings(normalizeSettings({ ...DEFAULT_SETTINGS })) };
  }
  /** Date de la dernière sauvegarde exportée, ou null. */
  lastBackupAt() {
    return this.getSettings().lastBackupAt ?? null;
  }
  /** Marque une sauvegarde comme réalisée (date du jour). */
  markBackupDone() {
    const reglages = this.getSettings();
    return {
      ok: true,
      errors: {},
      data: this.repository.saveSettings(normalizeSettings({ ...reglages, lastBackupAt: new Date().toISOString() }))
    };
  }
  /* ── Seuils réglementaires ajustables ───────────────────────────────── */
  /** Seuils actifs : normes réglementaires fusionnées avec les réglages. */
  getThresholds() {
    return { ...NORMS, ...this.getSettings().norms };
  }
  /** Valeur active d'un seuil identifié par son chemin « cold.positiveMax ». */
  getThreshold(key, fallback = null) {
    let valeur = this.getThresholds();
    for (const part of String(key || '').split('.')) {
      if (!valeur || typeof valeur !== 'object') return fallback;
      valeur = valeur[part];
    }
    return valeur === undefined ? fallback : valeur;
  }
  /**
   * Met à jour un sous-ensemble de seuils : { cold: { positiveMax: 5 } }.
   * Refuse toute valeur hors plage réglementaire avec un message explicite,
   * sans rien enregistrer.
   */
  updateThresholds(patch = {}) {
    const actuel = this.getSettings();
    const corriger = patch && typeof patch === 'object' && patch.norms ? patch.norms : patch;
    if (!corriger || typeof corriger !== 'object') {
      return { ok: false, errors: { norms: 'Les seuils attendus forment un objet par famille.' }, data: null };
    }
    const erreurs = {};
    const norms = { ...actuel.norms };
    for (const [famille, valeurs] of Object.entries(corriger)) {
      if (valeurs === null || typeof valeurs !== 'object' || Array.isArray(valeurs)) {
        erreurs[`norms.${famille}`] = `La famille de seuils « ${famille} » doit être un objet.`;
        continue;
      }
      norms[famille] = { ...(norms[famille] || {}), ...valeurs };
    }
    // Chaque seuil numérique est contrôlé indépendamment dans sa plage.
    for (const [chemin, plage] of Object.entries(PLAGES_SEUILS)) {
      const [famille, cle] = chemin.split('.');
      if (!norms[famille] || norms[famille][cle] === undefined) continue;
      const valeur = Number(norms[famille][cle]);
      if (!Number.isFinite(valeur) || valeur < plage.min || valeur > plage.max) {
        const unite = plage.unite ? ` ${plage.unite}` : '';
        erreurs[`norms.${chemin}`] =
          `La valeur du seuil « ${plage.libelle} » doit être comprise entre ${plage.min} et ${plage.max}${unite}.`;
      }
    }
    // Invariants d'ordre entre deux seuils d'une même famille.
    for (const [bas, haut, message] of COUPLES_ORDONNES) {
      const [familleBas, cleBas] = bas.split('.');
      const [familleHaut, cleHaut] = haut.split('.');
      const v1 = norms[familleBas] ? Number(norms[familleBas][cleBas]) : NaN;
      const v2 = norms[familleHaut] ? Number(norms[familleHaut][cleHaut]) : NaN;
      if (Number.isFinite(v1) && Number.isFinite(v2) && v1 >= v2) erreurs[`norms.${bas}`] = message;
    }
    if (Number(norms.oil?.tpmAlert) > Number(norms.oil?.tpmMax)) {
      erreurs['norms.oil.tpmAlert'] = 'Le seuil d’alerte TPM doit rester inférieur ou égal au seuil maximal de rejet.';
    }
    if (Object.keys(erreurs).length) return { ok: false, errors: erreurs, data: null };
    return { ok: true, errors: {}, data: this.repository.saveSettings(normalizeSettings({ ...actuel, norms })) };
  }
  /* ── Collections administrables ─────────────────────────────────────── */
  listEquipments() { return this.repository.getEquipments(); }
  createEquipment(data = {}) { return this._creer('equipments', data); }
  updateEquipment(id, patch = {}) { return this._modifier('equipments', id, patch); }
  deleteEquipment(id) { return this._supprimer('equipments', id); }
  listCleaningTasks() { return this.repository.getCleaningTasks(); }
  createCleaningTask(data = {}) { return this._creer('cleaning', data); }
  updateCleaningTask(id, patch = {}) { return this._modifier('cleaning', id, patch); }
  deleteCleaningTask(id) { return this._supprimer('cleaning', id); }
  listAllergenDishes() { return this.repository.getAllergenDishes(); }
  createAllergenDish(data = {}) { return this._creer('allergens', data); }
  updateAllergenDish(id, patch = {}) { return this._modifier('allergens', id, patch); }
  deleteAllergenDish(id) { return this._supprimer('allergens', id); }
  _cfg(cle) {
    const collection = COLLECTIONS[cle];
    const fabriques = { equipments: Equipment, cleaning: CleaningTask, allergens: DishAllergens };
    return {
      nom: collection.nom,
      prefixe: collection.prefixe,
      lire: () => this.repository[collection.lire](),
      ecrire: liste => this.repository[collection.ecrire](liste),
      fabriquer: donnees => new fabriques[cle](donnees),
      valider: (donnees, existants) => (cle === 'equipments' ? this._validerEquipement(donnees, existants)
        : cle === 'cleaning' ? this._validerNettoyage(donnees) : this._validerPlat(donnees))
    };
  }
  _creer(cle, donnees) {
    const cfg = this._cfg(cle);
    const existants = cfg.lire();
    const erreurs = cfg.valider(donnees, existants);
    if (Object.keys(erreurs).length) return { ok: false, errors: erreurs, data: null };
    const entite = cfg.fabriquer({ ...donnees, id: donnees.id || `${cfg.prefixe}-${Date.now().toString(36)}` });
    cfg.ecrire([...existants, entite]);
    return { ok: true, errors: {}, data: entite };
  }
  _modifier(cle, id, patch) {
    const cfg = this._cfg(cle);
    const existants = cfg.lire();
    const ancien = existants.find(entree => entree.id === id);
    if (!ancien) return { ok: false, errors: { id: `${cfg.nom} introuvable.` }, data: null };
    const fusion = { ...ancien, ...(patch && typeof patch === 'object' ? patch : {}), id: ancien.id };
    const erreurs = cfg.valider(fusion, existants.filter(entree => entree.id !== id));
    if (Object.keys(erreurs).length) return { ok: false, errors: erreurs, data: null };
    const modifie = cfg.fabriquer(fusion);
    cfg.ecrire(existants.map(entree => (entree.id === id ? modifie : entree)));
    return { ok: true, errors: {}, data: modifie };
  }
  _supprimer(cle, id) {
    const cfg = this._cfg(cle);
    const existants = cfg.lire();
    if (!existants.some(entree => entree.id === id)) {
      return { ok: false, errors: { id: `${cfg.nom} introuvable.` }, data: null };
    }
    cfg.ecrire(existants.filter(entree => entree.id !== id));
    return { ok: true, errors: {}, data: { id } };
  }
  /* ── Sauvegarde, restauration, purge ────────────────────────────────── */
  /** Sauvegarde complète (format 4.0-registre) sous forme de chaîne JSON. */
  exportFullBackup() {
    return buildFullBackup({ repository: this.repository });
  }
  /**
   * Restaure une sauvegarde v3 ou v4 après validation complète en mémoire :
   * une sauvegarde refusée ne modifie jamais les données existantes, et toute
   * section absente du fichier reste intacte.
   */
  importBackup(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, errors: ['Aucun contenu à restaurer.'], counts: {} };
    }
    const analyse = parseBackup(text);
    if (!analyse.ok) return { ok: false, errors: analyse.errors, counts: {} };
    const donnees = analyse.data;
    const rec = donnees.records && typeof donnees.records === 'object' ? donnees.records : null;
    const erreurs = [];
    // Brigade : normalisation et contrôle, sans écriture.
    let brigade = null;
    if (Array.isArray(donnees.brigade) && donnees.brigade.length) {
      brigade = donnees.brigade.map(membre => normalizeOperator(membre));
      if (!brigade.some(membre => membre.role === 'gerant' && membre.active !== false)) {
        const premier = brigade.find(membre => membre.active !== false);
        if (premier) premier.role = 'gerant';
      }
      brigade.forEach(membre => {
        const validation = validateOperator(membre, brigade.filter(autre => autre.id !== membre.id));
        if (!validation.ok) Object.values(validation.errors).forEach(m => erreurs.push(`Brigade : ${m}`));
      });
    }
    const reglages = donnees.settings && typeof donnees.settings === 'object'
      ? normalizeSettings(donnees.settings) : null;
    if (!rec) erreurs.push('Sauvegarde illisible : aucune section de relevés retrouvée.');
    if (erreurs.length) return { ok: false, errors: erreurs, counts: {} };
    const counts = {};
    if (brigade) { this.repository.saveBrigade(brigade); counts.brigade = brigade.length; }
    if (reglages) { this.repository.saveSettings(reglages); counts.settings = 1; }
    if (donnees.establishment) { this.repository.saveEstablishment(donnees.establishment); counts.establishment = 1; }
    if (donnees.session && typeof donnees.session === 'object') {
      this.repository.saveSession(donnees.session); counts.session = 1;
    }
    SECTIONS_SAUVEGARDE.forEach(([nom, methode]) => {
      const liste = rec[nom] || (nom === 'cleaning' ? rec.cleanings : null);
      if (Array.isArray(liste) && liste.length) {
        this.repository[methode](liste);
        counts[nom] = liste.length;
      }
    });
    if (rec.checklists && (rec.checklists.ouverture || rec.checklists.fermeture)) {
      this.repository.saveChecklists(rec.checklists); counts.checklists = 1;
    }
    if (Array.isArray(rec.activityLog) && rec.activityLog.length) {
      rec.activityLog.slice().reverse().forEach(entree => this.repository.appendActivity(entree));
      counts.activityLog = rec.activityLog.length;
    }
    return { ok: true, errors: [], counts };
  }
  /** Réinjecte le jeu de démonstration et retourne les volumes restaurés. */
  restoreDemoData() {
    if (typeof this.repository.resetToDemo === 'function') this.repository.resetToDemo();
    this.repository.saveSettings(normalizeSettings({ ...DEFAULT_SETTINGS, establishment: { ...DEFAULT_ESTABLISHMENT } }));
    this.repository.saveBrigade(DEFAULT_BRIGADE.map(membre => normalizeOperator(membre)));
    this.repository.saveEstablishment({ ...DEFAULT_ESTABLISHMENT });
    this.repository.saveSession({ currentOperatorId: null, startedAt: null, lockedAt: null });
    const counts = {};
    [['equipments', 'getEquipments'], ['deliveries', 'getDeliveries'], ['preparations', 'getPreparations'],
     ['allergenDishes', 'getAllergenDishes'], ['cleaning', 'getCleaningTasks'], ['oils', 'getFryers'],
     ['cooling', 'getCoolingCycles'], ['defrost', 'getDefrostCycles'], ['nonConformities', 'getNonConformities'],
     ['documents', 'getSanitaryDocuments'], ['ph', 'getPhRecords'], ['weights', 'getWeightRecords'],
     ['brigade', 'getBrigade']
    ].forEach(([nom, methode]) => {
      const liste = this.repository[methode]();
      if (Array.isArray(liste) && liste.length) counts[nom] = liste.length;
    });
    return { ok: true, errors: [], counts };
  }
  /** Purge les relevés d'une année civile. */
  purgeYear(year) {
    const annee = Number.parseInt(year, 10);
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
      return { ok: false, errors: { year: 'Année invalide : indiquez une année entre 2000 et 2100.' }, purged: {} };
    }
    const purged = {};
    SECTIONS_PURGEABLES.forEach(([nom, lire, ecrire, champDate]) => {
      const avant = this.repository[lire]();
      if (!Array.isArray(avant)) return;
      const apres = avant.filter(entree => this._anneeDe(entree ? entree[champDate] : null) !== annee);
      if (apres.length !== avant.length) {
        this.repository[ecrire](apres);
        purged[nom] = avant.length - apres.length;
      }
    });
    purged.total = Object.values(purged).reduce((somme, nombre) => somme + nombre, 0);
    return { ok: true, errors: {}, purged };
  }
  /* ── Validation interne ─────────────────────────────────────────────── */
  _validerEquipement(donnees, existants) {
    const erreurs = {};
    const nom = String(donnees.name ?? '').trim();
    if (nom.length < 3) erreurs.name = 'Le nom de l’équipement est requis (3 caractères minimum).';
    else if (existants.some(eq => String(eq.name).toLowerCase() === nom.toLowerCase())) {
      erreurs.name = 'Un équipement porte déjà ce nom.';
    }
    if (!TYPES_EQUIPEMENT.includes(donnees.type)) {
      erreurs.type = `Type d’équipement inconnu. Valeurs acceptées : ${TYPES_EQUIPEMENT.join(', ')}.`;
    }
    const min = Number(donnees.min);
    const max = Number(donnees.max);
    if (!Number.isFinite(min)) erreurs.min = 'La température minimale doit être un nombre.';
    if (!Number.isFinite(max)) erreurs.max = 'La température maximale doit être un nombre.';
    else if (Number.isFinite(min) && min >= max) {
      erreurs.max = 'La température maximale doit être supérieure à la température minimale.';
    }
    return erreurs;
  }
  _validerNettoyage(donnees) {
    const erreurs = {};
    if (String(donnees.title ?? '').trim().length < 3) {
      erreurs.title = 'L’intitulé de la tâche est requis (3 caractères minimum).';
    }
    const zone = String(donnees.zone ?? '').trim().toLowerCase();
    if (!zone) erreurs.zone = 'La zone de nettoyage est obligatoire.';
    else if (!ZONES.includes(zone)) erreurs.zone = `Zone inconnue « ${zone} ». Valeurs acceptées : ${ZONES.join(', ')}.`;
    if (!String(donnees.freq ?? '').trim()) erreurs.freq = 'La fréquence de nettoyage est obligatoire.';
    return erreurs;
  }
  _validerPlat(donnees) {
    const erreurs = {};
    if (String(donnees.name ?? '').trim().length < 3) {
      erreurs.name = 'Le nom du plat est requis (3 caractères minimum).';
    }
    const connus = new Set();
    ALLERGENS_14.forEach(allergene => { connus.add(allergene.label); connus.add(allergene.short); });
    const allergenes = Array.isArray(donnees.allergens) ? donnees.allergens : [];
    const inconnus = allergenes.filter(allergene => typeof allergene !== 'string' || !connus.has(allergene));
    if (inconnus.length) {
      erreurs.allergens = `Allergène hors liste : ${inconnus.join(', ')}. Utilisez les libellés des 14 allergènes réglementaires.`;
    }
    return erreurs;
  }
  /** Extrait l'année d'une date « JJ/MM/AAAA » ou ISO 8601. */
  _anneeDe(valeur) {
    if (!valeur) return null;
    const texte = String(valeur);
    const fr = texte.match(/^\d{2}\/\d{2}\/(\d{4})/);
    if (fr) return Number.parseInt(fr[1], 10);
    const iso = texte.match(/^(\d{4})-\d{2}-\d{2}/);
    if (iso) return Number.parseInt(iso[1], 10);
    const date = new Date(texte);
    return Number.isNaN(date.getTime()) ? null : date.getFullYear();
  }
}
