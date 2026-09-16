/**
 * TraqHACCP — Couche présentation — Store réactif (état applicatif + observateurs).
 *
 * Spec P5a §4 : ce module **conserve** l'API historique utilisée par le legacy
 * (`notify`, `subscribe`, `setState`, `setActiveTab`, `setOperator`, `showNotification`,
 * `dismissNotification`, `setInspectionMode`) et l'enrichit de l'état et des sélecteurs
 * attendus par les vues v4 : réglages, opérateurs, journal d'activité, verrou
 * d'inspection (`locked`) et indicateur d'amorçage (`ready`).
 *
 * Les lectures déléguent aux use cases quand ils sont disponibles (spec P4) et
 * retombent sinon sur le repository, afin que le store reste utilisable pendant
 * la migration.
 */
import { DEFAULT_SETTINGS } from '../domain/constants.js';

export class HACCPStore {
  constructor(repository, useCases, account = null, settings = null) {
    this.repository = repository;
    this.useCases = useCases;
    this.account = account;
    this.settings = settings;
    this.subscribers = [];

    this.state = {
      // --- état historique (compatibilité legacy) ---
      activeTab: 'dashboard',
      currentOperator: null,
      establishment: repository.getEstablishment(),
      notification: null,
      allergenFilter: '',
      allergenExcludeList: [],
      cleaningZoneFilter: 'all',
      inspectionMode: false,
      docCategoryFilter: 'all',
      checklistTab: 'OUVERTURE',
      // --- état v4 ---
      settings: null,
      operators: [],
      activeOperators: [],
      activityLog: [],
      ready: false,
      locked: false,
    };

    this.state.settings = this.getSettings();
    this.state.operators = this.getOperators();
    this.state.activeOperators = this.getActiveOperators();
    this.state.currentOperator = this.getCurrentOperator() || this.state.operators[0] || null;
  }

  /* ══ Observateurs ═══════════════════════════════════════════════════ */

  /** Abonne un observateur ; renvoie la fonction de désabonnement. */
  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  /** Notifie tous les observateurs, de façon synchrone ; un observateur fautif est isolé. */
  notify() {
    for (const cb of [...this.subscribers]) {
      try {
        cb(this.state);
      } catch (erreur) {
        console.error('[store] observateur en échec :', erreur);
      }
    }
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  /** État courant pour les vues (l'état + les services injectés). */
  getState() {
    const etat = this.state;
    return {
      ...etat,
      // Contrat des vues (docs/ARCHITECTURE.md §5) : `settings` est l'INSTANCE
      // SettingsUseCases (getSettings/updateThresholds/listEquipments…), jamais l'objet de
      // données. Les vues reconstruisent fréquemment leur contexte par
      // `{ ...ctx, ...store.getState() }` : exposer l'instance ici empêche les données
      // de réglages d'écraser le service métier (bug corrigé le 16/09/2026).
      settings: this.settings,
      settingsUseCases: this.settings,
      settingsData: etat.settings,
      repository: this.repository,
      useCases: this.useCases,
      account: this.account,
    };
  }

  /* ══ Sélecteurs ═════════════════════════════════════════════════════ */

  getSettings() {
    if (this.settings && typeof this.settings.getSettings === 'function') return this.settings.getSettings();
    if (typeof this.repository.getSettings === 'function') return this.repository.getSettings();
    return { ...DEFAULT_SETTINGS };
  }

  getOperators() {
    if (this.account && typeof this.account.listOperators === 'function') return this.account.listOperators();
    if (typeof this.repository.getBrigade === 'function') return this.repository.getBrigade();
    return [];
  }

  getActiveOperators() {
    if (this.account && typeof this.account.listActiveOperators === 'function') return this.account.listActiveOperators();
    return this.getOperators().filter((operateur) => operateur && operateur.active !== false);
  }

  getOperator(id) {
    if (this.account && typeof this.account.getOperator === 'function') return this.account.getOperator(id);
    return this.getOperators().find((operateur) => operateur && operateur.id === id) || null;
  }

  getCurrentOperator() {
    if (this.account && typeof this.account.getCurrentOperator === 'function') {
      const courant = this.account.getCurrentOperator();
      if (courant) return courant;
    }
    return this.state.currentOperator || null;
  }

  /** Permission de l'opérateur courant ; toujours refusée en mode inspection. */
  can(permission) {
    if (this.state.locked) return false;
    if (this.account && typeof this.account.can === 'function') return Boolean(this.account.can(permission));
    if (typeof this.repository.can === 'function') return Boolean(this.repository.can(permission));
    return false;
  }

  getEquipments() {
    if (typeof this.repository.getEquipments === 'function') return this.repository.getEquipments();
    return [];
  }

  getActivityLog() {
    if (this.account && typeof this.account.getActivityLog === 'function') return this.account.getActivityLog(50);
    if (typeof this.repository.getActivityLog === 'function') return this.repository.getActivityLog();
    return [];
  }

  /* ══ Mutations ══════════════════════════════════════════════════════ */

  /** Applique le thème sur `<html>` **et** le persiste dans les réglages. */
  setTheme(theme) {
    const propre = theme === 'nuit' ? 'nuit' : 'papier';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', propre);
    }
    if (this.settings && typeof this.settings.updateSettings === 'function') this.settings.updateSettings({ theme: propre });
    this.setState({ settings: { ...this.getSettings(), theme: propre } });
    return propre;
  }

  /** Mode inspection : verrouille les écritures (les vues lisent `state.locked`). */
  setLocked(verrouille) {
    this.setState({ locked: Boolean(verrouille) });
  }

  setReady(pret) {
    this.setState({ ready: Boolean(pret) });
  }

  /** Relit le repository et rafraîchit l'état, puis notifie. */
  reload() {
    this.setState({
      settings: this.getSettings(),
      operators: this.getOperators(),
      activeOperators: this.getActiveOperators(),
      currentOperator: this.getCurrentOperator(),
      activityLog: this.getActivityLog(),
      establishment: this.repository.getEstablishment(),
    });
  }

  setInspectionMode(active) {
    this.setState({ inspectionMode: Boolean(active) });
  }

  setOperator(operatorObj) {
    this.setState({ currentOperator: operatorObj });
  }

  setActiveTab(tabName) {
    this.setState({ activeTab: tabName });
  }

  showNotification(message, type = 'info') {
    this.setState({ notification: { message, type, id: Date.now() } });
    setTimeout(() => {
      if (this.state.notification && this.state.notification.message === message) {
        this.setState({ notification: null });
      }
    }, 5000);
  }

  dismissNotification() {
    this.setState({ notification: null });
  }
}
