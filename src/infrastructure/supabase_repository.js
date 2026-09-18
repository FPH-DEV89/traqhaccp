/**
 * TraqHACCP Pro — Infrastructure — Dépôt serveur Supabase (docs/DATA.md).
 *
 * `SupabaseHACCPRepository` expose **exactement la même interface** que
 * `LocalStorageHACCPRepository` (src/infrastructure/storage_repository.js) : mêmes noms de
 * méthodes, mêmes signatures, mêmes formes d'objets retournés. Les vues et les cas d'usage
 * n'ont donc rien à changer s'ils basculent d'un mode à l'autre.
 *
 * ── Comment rester synchrone sur un serveur asynchrone ───────────────────────
 * L'interface historique est synchrone (`getEquipments()` renvoie un tableau). Pour la
 * respecter, ce dépôt travaille sur un **cache mémoire hydraté** :
 *
 *   1. `await repo.hydrate()` charge une fois les 14 tables, les réglages, l'établissement
 *      et le journal (une seule salve de requêtes parallèles) ;
 *   2. les `getX()` lisent le cache et rendent des entités du domaine — exactement le rôle
 *      que jouait le stockage local ;
 *   3. les `saveX(liste)` remplacent la collection **dans le cache immédiatement**, puis
 *      renvoient la version serveur en tâche de fond (upsert PostgREST + purge ciblée des
 *      identifiants absents). `await repo.flush()` attend la fin des écritures différées.
 *
 * Les échecs d'écriture différée ne peuvent pas être levés dans une méthode synchrone :
 * ils sont signalés (`onErreur`, à défaut `console.warn`) et mémorisés dans
 * `repo.derniereErreur`. C'est le prix de la compatibilité d'interface — voir docs/DATA.md.
 *
 * Aucune vue, aucun cas d'usage et aucun comportement par défaut de l'application ne dépend
 * de ce fichier : il n'est chargé que si le mode 'serveur' est activé (config.js).
 */

import { SupabaseClient, citerValeur, ErreurSupabase } from './supabase_client.js';
import {
  SPECS,
  COLLECTIONS,
  cibleConflit,
  identifiants,
  versLigne,
  versLignes,
  versObjet,
  versObjets,
} from './supabase_mapping.js';
import { ecrireStockage, lireStockage, SUPABASE_CLE_ETAT, SUPABASE_URL } from './config.js';
import { ChecklistRoutine, normalizeOperator, normalizeSettings } from '../domain/entities.js';
import { DEFAULT_ESTABLISHMENT } from '../domain/constants.js';
import { exporterSauvegarde, importerSauvegarde } from './supabase_backup.js';

/** Plafond du journal d'activité : les entrées les plus récentes sont conservées. */
const JOURNAL_MAX_ENTREES = 500;

/** Session vide : aucun opérateur connecté. */
const SESSION_VIDE = { currentOperatorId: null, startedAt: null, lockedAt: null };

/** Clés locales des deux routines de contrôle continu. */
const CLES_CHECKLISTS = ['ouverture', 'fermeture'];

/** Routine vide : le mode serveur ne réinjecte pas les jeux de démonstration. */
function routineVide(type) {
  return new ChecklistRoutine({ type, items: [] });
}

import { SupabaseRepositoryBase } from './supabase_repository_base.js';
export class SupabaseHACCPRepository extends SupabaseRepositoryBase {
  /**
   * @param {{ client?: SupabaseClient, establishmentId?: string|null,
   *           onErreur?: ((erreur: Error, contexte: string) => void)|null }} [options]
   */
  constructor({ client = null, establishmentId = null, onErreur = null } = {}) {
    super();
    this.client = client || new SupabaseClient({ url: SUPABASE_URL });
    this.establishmentId = establishmentId;
    this.onErreur = onErreur;
    /** Lignes serveur (snake_case) par table : le « stockage » de ce dépôt. */
    this._collections = {};
    for (const cle of COLLECTIONS) this._collections[cle] = [];
    this._reglages = null;
    this._etablissement = null;
    this._journal = [];
    this._hydrate = false;
    this._enAttente = [];
    this._derniereErreur = null;
    /** Rôle de l'appelant dans son établissement (lecture seule, informatif). */
    this.role = null;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Cycle de vie serveur (hors interface commune)
     ═══════════════════════════════════════════════════════════════════ */

  /** Vrai lorsque le cache a été chargé depuis le serveur. */
  get estHydrate() {
    return this._hydrate;
  }

  /** Vrai lorsqu'une session GoTrue est présente (utilisateur connecté). */
  get estConnecte() {
    return this.client.hasSession();
  }

  /** Dernière erreur d'écriture différée (les getters ne peuvent pas lever). */
  get derniereErreur() {
    return this._derniereErreur;
  }

  /**
   * Charge le cache depuis PostgREST. À appeler une fois après `signIn`.
   * @returns {Promise<SupabaseHACCPRepository>}
   */
  async hydrate() {
    this._exigerSession();
    await this._resoudreMembre();

    const resultats = await Promise.all(COLLECTIONS.map((cle) => this.client.select(SPECS[cle].table)));
    COLLECTIONS.forEach((cle, index) => {
      const lignes = resultats[index];
      this._collections[cle] = Array.isArray(lignes) ? lignes : [];
    });

    const [reglages, etablissements, journal] = await Promise.all([
      this.client.select('settings', { limite: 1 }),
      this.client.select('establishments', { limite: 1 }),
      this.client.select('activity_log', { ordre: 'created_at.desc', limite: JOURNAL_MAX_ENTREES }),
    ]);

    this._reglages = Array.isArray(reglages) && reglages[0] ? reglages[0].payload : null;
    this._etablissement = Array.isArray(etablissements) && etablissements[0] ? etablissements[0] : null;
    this._journal = (Array.isArray(journal) ? journal : [])
      .map((ligne) => ligne.payload)
      .filter((entree) => entree && typeof entree === 'object');
    this._hydrate = true;
    return this;
  }

  /** Attend la fin de toutes les écritures différées. Vrai si elles ont toutes réussi. */
  async flush() {
    const taches = this._enAttente.splice(0);
    if (!taches.length) return true;
    const resultats = await Promise.all(taches);
    return resultats.every(Boolean);
  }

  /**
   * Bootstrap : délègue à la fonction SQL `create_establishment(p_name)` (migration 0002),
   * qui crée l'établissement ET rattache l'appelant comme 'gerant'.
   * @param {string} nom
   * @returns {Promise<string>} identifiant de l'établissement créé
   */
  async creerEtablissement(nom) {
    const identifiant = await this.client.rpc('create_establishment', { p_name: nom });
    this.establishmentId = identifiant;
    this._hydrate = false;
    return identifiant;
  }

  /** Force l'établissement courant (utile hors ligne de commande / tests). */
  definirEtablissement(establishmentId) {
    this.establishmentId = establishmentId;
    return this.establishmentId;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Interface commune — 13 collections de registre
     ═══════════════════════════════════════════════════════════════════ */

  getEquipments() { return this._liste('equipments'); }
  saveEquipments(equipments) { return this._remplacer('equipments', equipments); }

  getDeliveries() { return this._liste('deliveries'); }
  saveDeliveries(deliveries) { return this._remplacer('deliveries', deliveries); }

  getPreparations() { return this._liste('preparations'); }
  savePreparations(preparations) { return this._remplacer('preparations', preparations); }

  getAllergenDishes() { return this._liste('allergen_dishes'); }
  saveAllergenDishes(dishes) { return this._remplacer('allergen_dishes', dishes); }

  getCleaningTasks() { return this._liste('cleaning_tasks'); }
  saveCleaningTasks(tasks) { return this._remplacer('cleaning_tasks', tasks); }

  getFryers() { return this._liste('fryers'); }
  saveFryers(fryers) { return this._remplacer('fryers', fryers); }

  getCoolingCycles() { return this._liste('cooling_cycles'); }
  saveCoolingCycles(cycles) { return this._remplacer('cooling_cycles', cycles); }

  getDefrostCycles() { return this._liste('defrost_cycles'); }
  saveDefrostCycles(cycles) { return this._remplacer('defrost_cycles', cycles); }

  getNonConformities() { return this._liste('non_conformities'); }
  saveNonConformities(nonConformities) { return this._remplacer('non_conformities', nonConformities); }

  getSanitaryDocuments() { return this._liste('sanitary_documents'); }
  saveSanitaryDocuments(documents) { return this._remplacer('sanitary_documents', documents); }

  getPhRecords() { return this._liste('ph_records'); }
  savePhRecords(records) { return this._remplacer('ph_records', records); }

  getWeightRecords() { return this._liste('weight_records'); }
  saveWeightRecords(records) { return this._remplacer('weight_records', records); }

  /**
   * Les deux routines de contrôle continu, toujours présentes (même forme qu'en local).
   * Une routine absente du serveur revient vide : le mode serveur ne réinjecte pas les
   * jeux de démonstration (docs/DATA.md §Local vs serveur).
   */
  getChecklists() {
    this._exigerLecture();
    const parCle = {};
    for (const ligne of this._lignes('checklists')) {
      parCle[String(ligne.id || ligne.type || '').toLowerCase()] = versObjet(SPECS.checklists, ligne);
    }
    const sortie = {};
    for (const cle of CLES_CHECKLISTS) {
      sortie[cle] = parCle[cle] || routineVide(cle.toUpperCase());
    }
    return sortie;
  }

  saveChecklists(checklists) {
    this._exigerEcriture();
    const source = checklists && typeof checklists === 'object' ? checklists : {};
    const lignes = CLES_CHECKLISTS.map((cle) => {
      const routine = source[cle] ? new ChecklistRoutine(source[cle]) : routineVide(cle.toUpperCase());
      return versLigne(SPECS.checklists, routine, { establishmentId: this.establishmentId, id: cle });
    });
    const supprimes = identifiants(this._lignes('checklists')).filter((id) => !CLES_CHECKLISTS.includes(id));
    this._collections.checklists = lignes;
    return this._tacher(this._ecrireRemplacement('checklists', lignes, supprimes), SPECS.checklists.table);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Interface commune — brigade, réglages, session, journal, établissement
     ═══════════════════════════════════════════════════════════════════ */

  getBrigade() {
    return this._normaliserBrigade(this._liste('brigade'));
  }

  saveBrigade(brigade) {
    const normalisee = this._normaliserBrigade(brigade);
    this._remplacer('brigade', normalisee);
    return normalisee;
  }

  getSettings() {
    this._exigerLecture();
    return normalizeSettings(this._reglages);
  }

  saveSettings(settings) {
    this._exigerEcriture();
    const complet = normalizeSettings(settings);
    this._reglages = complet;
    const ligne = { establishment_id: this.establishmentId, payload: complet, updated_at: new Date().toISOString() };
    this._tacher(this.client.insert('settings', [ligne], { upsert: true, onConflict: 'establishment_id' }), 'settings');
    return complet;
  }

  /**
   * Session applicative (opérateur courant, verrouillage) : état propre à l'appareil.
   * Le schéma 0001 ne contient AUCUNE table de session ; on la conserve donc sous une clé
   * locale distincte de celle du dépôt local (docs/DATA.md §Session).
   */
  getSession() {
    this._exigerSession();
    const brute = lireStockage(SUPABASE_CLE_ETAT, null);
    if (!brute || typeof brute !== 'object') return { ...SESSION_VIDE };
    return {
      currentOperatorId: brute.currentOperatorId ?? null,
      startedAt: brute.startedAt ?? null,
      lockedAt: brute.lockedAt ?? null,
    };
  }

  saveSession(session) {
    this._exigerSession();
    const propre = session && typeof session === 'object' ? session : SESSION_VIDE;
    const enregistree = {
      currentOperatorId: propre.currentOperatorId ?? null,
      startedAt: propre.startedAt ?? null,
      lockedAt: propre.lockedAt ?? null,
    };
    ecrireStockage(SUPABASE_CLE_ETAT, enregistree);
    return enregistree;
  }

  getActivityLog() {
    this._exigerLecture();
    return this._journal.map((entree) => ({ ...entree }));
  }

  /** Ajoute une entrée au journal (plus récentes d'abord, cap 500). */
  appendActivity(entry) {
    this._exigerEcriture();
    if (!entry || typeof entry !== 'object') return null;
    const entree = {
      at: entry.at || new Date().toISOString(),
      operatorId: entry.operatorId ?? null,
      operatorName: entry.operatorName ?? '',
      action: entry.action ?? 'action',
      target: entry.target ?? '',
      details: entry.details ?? '',
    };
    const precedent = Array.isArray(this._journal) ? this._journal : [];
    this._journal = [entree, ...precedent].slice(0, JOURNAL_MAX_ENTREES);
    this._tacher(
      this.client.insert('activity_log', [{ establishment_id: this.establishmentId, payload: entree }]),
      'activity_log'
    );
    return entree;
  }


  /**
   * Établissement : recollé depuis la table `establishments` (name/siret/address, seules
   * colonnes du schéma 0001) et depuis `settings.payload.establishment` pour les champs
   * hors schéma (activité, ville, téléphone, agrément…).
   */
  getEstablishment() {
    this._exigerLecture();
    const fusion = { ...DEFAULT_ESTABLISHMENT };
    const depuisReglages = this._reglages && this._reglages.establishment;
    if (depuisReglages && typeof depuisReglages === 'object') Object.assign(fusion, depuisReglages);
    if (this._etablissement) {
      if (this._etablissement.name) fusion.name = this._etablissement.name;
      if (this._etablissement.siret) fusion.siret = this._etablissement.siret;
      if (this._etablissement.address) fusion.address = this._etablissement.address;
    }
    return fusion;
  }

  /** Fusionne un correctif partiel dans l'établissement (réglages + table establishments). */
  saveEstablishment(patch) {
    this._exigerLecture();
    const enregistre = { ...this.getEstablishment(), ...(patch && typeof patch === 'object' ? patch : {}) };
    this._reglages = normalizeSettings({ ...(this._reglages || {}), establishment: enregistre });
    this._etablissement = {
      ...(this._etablissement || {}),
      name: enregistre.name,
      siret: enregistre.siret ?? null,
      address: enregistre.address ?? null,
    };
    this._tacher(
      this.client.insert(
        'settings',
        [{ establishment_id: this.establishmentId, payload: this._reglages, updated_at: new Date().toISOString() }],
        { upsert: true, onConflict: 'establishment_id' }
      ),
      'settings'
    );
    this._tacher(
      this.client.update(
        'establishments',
        { name: enregistre.name, siret: enregistre.siret ?? null, address: enregistre.address ?? null },
        { id: `eq.${this.establishmentId}` },
        { retourner: true }
      ),
      'establishments'
    );
    return enregistre;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Sauvegarde / restauration intégrale (implémentation : supabase_backup.js)
     ═══════════════════════════════════════════════════════════════════ */

  /** Sauvegarde complète : MÊME JSON que le dépôt local (restaurable dans les deux sens). */
  exportFullBackupJSON() {
    this._exigerLecture();
    return exporterSauvegarde(this);
  }

  /** Importe une sauvegarde JSON v3/v4. Ne lève jamais, renvoie false en cas d'échec. */
  importFullBackupJSON(jsonString) {
    try {
      this._exigerEcriture();
    } catch (e) {
      console.error('Import de sauvegarde impossible :', e);
      return false;
    }
    return importerSauvegarde(this, jsonString);
  }

  /**
   * Méthode présente pour l'égalité d'interface, mais volontairement non destructive :
   * en local, `resetToDemo()` effaçait le stockage pour laisser revenir les jeux de
   * démonstration. Ici, cela effacerait le registre d'un établissement RÉEL et partagé.
   * L'appel lève donc une erreur explicite (docs/DATA.md §Écarts local / serveur).
   * @throws {ErreurSupabase} systématiquement
   */
  resetToDemo() {
    throw new ErreurSupabase(
      "resetToDemo() n'existe pas en mode serveur : effacer le registre d'un établissement "
      + "partagé doit rester un acte explicite. Utilisez importFullBackupJSON() pour restaurer "
      + 'un jeu de démonstration (docs/DATA.md §Écarts local / serveur).',
      { statut: 400 }
    );
  }
}
