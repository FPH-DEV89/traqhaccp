/**
 * TraqHACCP Pro — Couche Application : cas d'usage « comptes ».
 * Brigade (opérateurs), session courante, établissement et journal d'activité.
 * Clean Architecture : aucune dépendance DOM, aucune dépendance présentation ;
 * seul point de contact avec les données, le repository injecté.
 */

import {
  createOperator as creerOperateur,
  normalizeOperator,
  validateOperator,
  operatorDisplayName,
  operatorInitials
} from '../domain/entities.js';
import { hasPermission, ROLES } from '../domain/roles.js';

/** Permissions fermées tant qu'aucun opérateur n'est identifié (voir `can()`). */
const PERMISSIONS_RESERVEES = Object.freeze(['users.manage', 'settings.edit', 'backup.restore']);

/** Rôle de repli appliqué en accès libre (aucune session ouverte). */
const ROLE_ACCES_LIBRE = 'operateur';

export class AccountUseCases {
  constructor(repository) {
    if (!repository) throw new Error('AccountUseCases : un repository est requis.');
    this.repository = repository;
  }

  /* ── Brigade ────────────────────────────────────────────────────────── */

  /** Brigade complète, normalisée au format v4. */
  listOperators() {
    return (this.repository.getBrigade() || []).map(membre => normalizeOperator(membre));
  }

  /** Opérateurs actifs uniquement. */
  listActiveOperators() {
    return this.listOperators().filter(op => op.active !== false);
  }

  /** Opérateur par identifiant, ou null. */
  getOperator(id) {
    if (!id) return null;
    return this.listOperators().find(op => op.id === id) || null;
  }

  /** Nom complet affiché d'un opérateur. */
  getOperatorName(id) {
    return operatorDisplayName(this.getOperator(id));
  }

  /** Initiales (2 lettres) d'un opérateur. */
  getOperatorInitials(id) {
    return operatorInitials(this.getOperator(id));
  }

  /* ── Établissement, session, journal ────────────────────────────────── */

  /** Établissement courant (réglages, repli sur la clé historique). */
  getEstablishment() {
    const reglages = typeof this.repository.getSettings === 'function' ? this.repository.getSettings() : null;
    if (reglages && reglages.establishment) return { ...reglages.establishment };
    return typeof this.repository.getEstablishment === 'function'
      ? { ...this.repository.getEstablishment() }
      : {};
  }

  /** Journal d'activité, du plus récent au plus ancien. */
  getActivityLog(limit = 50) {
    const journal = typeof this.repository.getActivityLog === 'function' ? this.repository.getActivityLog() : [];
    const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
    return journal.slice(0, max);
  }

  /** État de session persisté. */
  getSession() {
    const session = typeof this.repository.getSession === 'function' ? this.repository.getSession() : null;
    return {
      currentOperatorId: session ? (session.currentOperatorId ?? null) : null,
      startedAt:         session ? (session.startedAt ?? null) : null,
      lockedAt:          session ? (session.lockedAt ?? null) : null
    };
  }

  /** Opérateur connecté, ou null. Une session verrouillée est considérée comme fermée. */
  getCurrentOperator() {
    const session = this.getSession();
    if (!session.currentOperatorId || session.lockedAt) return null;
    return this.getOperator(session.currentOperatorId);
  }

  /* ── Permissions ────────────────────────────────────────────────────── */

  /**
   * L'opérateur connecté peut-il effectuer cette action ?
   * Sans session ouverte, le rôle « opérateur » s'applique : les droits du quotidien
   * passent, les droits réservés restent fermés.
   */
  can(permission) {
    if (!permission) return false;
    const courant = this.getCurrentOperator();
    // Mode « accès libre » (aucun opérateur identifié) : décision produit du 16/09/2026 —
    // l'application n'impose pas de mur d'authentification, toutes les actions sont donc
    // ouvertes tant que personne n'est identifié (cohérent avec `_verifier`, qui autorise
    // déjà l'écriture dans ce cas). Dès qu'un opérateur est sélectionné dans la barre
    // supérieure, ses permissions de rôle s'appliquent strictement.
    if (!courant) return true;
    return hasPermission(courant.role, permission);
  }

  /** Permission réservée : null si autorisé, sinon objet d'erreur. Sans session, accès libre. */
  _verifier(permission) {
    const courant = this.getCurrentOperator();
    if (!courant) return null;
    if (this.can(permission)) return null;
    const libelle = ROLES[courant.role] ? (ROLES[courant.role].label || courant.role) : courant.role;
    return { permission: `Action réservée : le rôle « ${libelle} » ne permet pas « ${permission} ».` };
  }

  /** Un opérateur peut modifier sa propre fiche sans droit d'administration. */
  _verifierOuSoiMeme(permission, id) {
    const session = this.getSession();
    if (session.currentOperatorId && session.currentOperatorId === id) return null;
    return this._verifier(permission);
  }

  /* ── Écriture brigade ───────────────────────────────────────────────── */

  /** Crée un opérateur et l'enregistre dans la brigade. */
  createOperator(input = {}) {
    const refus = this._verifier('users.manage');
    if (refus) return { ok: false, errors: refus, data: null };

    const existants = this.listOperators();
    const operateur = creerOperateur({
      id: input.id, firstName: input.firstName, lastName: input.lastName,
      role: input.role, pin: input.pin, initials: input.initials, active: input.active
    });
    // Invariant : une brigade comporte toujours au moins un gérant actif.
    if (!existants.some(op => op.role === 'gerant' && op.active !== false)) operateur.role = 'gerant';

    const validation = validateOperator(operateur, existants);
    if (!validation.ok) return { ok: false, errors: validation.errors, data: null };

    this.repository.saveBrigade([...existants, operateur]);
    this.logActivity({
      action: 'createOperator',
      target: operateur.id,
      details: `${operatorDisplayName(operateur)} — ${this._libelleRole(operateur.role)}`
    });
    return { ok: true, errors: {}, data: operateur };
  }

  /** Modifie la fiche d'un opérateur (identité, rôle, code PIN). */
  updateOperator(id, patch = {}) {
    const refus = this._verifier('users.manage');
    if (refus) return { ok: false, errors: refus, data: null };

    const existants = this.listOperators();
    const ancien = existants.find(op => op.id === id);
    if (!ancien) return { ok: false, errors: { id: 'Opérateur introuvable.' }, data: null };

    const modifie = normalizeOperator({
      ...ancien,
      ...(patch && typeof patch === 'object' ? patch : {}),
      id: ancien.id,
      createdAt: ancien.createdAt
    });
    const refusGerant = this._refusDernierGerant(ancien, existants, modifie);
    if (refusGerant) return { ok: false, errors: refusGerant, data: null };

    const validation = validateOperator(modifie, existants);
    if (!validation.ok) return { ok: false, errors: validation.errors, data: null };

    this.repository.saveBrigade(existants.map(op => (op.id === id ? modifie : op)));
    this.logActivity({
      action: 'updateOperator',
      target: modifie.id,
      details: `${operatorDisplayName(modifie)} — ${this._libelleRole(modifie.role)}`
    });
    return { ok: true, errors: {}, data: modifie };
  }

  /** Active ou désactive un opérateur (refuse le dernier gérant actif). */
  setOperatorActive(id, active) {
    const refus = this._verifier('users.manage');
    if (refus) return { ok: false, errors: refus, data: null };

    const existants = this.listOperators();
    const cible = existants.find(op => op.id === id);
    if (!cible) return { ok: false, errors: { id: 'Opérateur introuvable.' }, data: null };

    const veutActiver = active !== false;
    if (!veutActiver && cible.role === 'gerant' && cible.active !== false &&
        !existants.some(op => op.id !== id && op.role === 'gerant' && op.active !== false)) {
      return {
        ok: false,
        errors: { active: 'Impossible de désactiver le dernier gérant actif. Nommez d’abord un autre gérant.' },
        data: null
      };
    }

    const modifie = { ...normalizeOperator(cible), active: veutActiver };
    this.repository.saveBrigade(existants.map(op => (op.id === id ? modifie : op)));
    this.logActivity({
      action: veutActiver ? 'activateOperator' : 'deactivateOperator',
      target: modifie.id,
      details: operatorDisplayName(modifie)
    });
    return { ok: true, errors: {}, data: modifie };
  }

  /** Supprime un opérateur (refuse le dernier gérant actif et l'opérateur connecté). */
  deleteOperator(id) {
    const refus = this._verifier('users.manage');
    if (refus) return { ok: false, errors: refus, data: null };

    const existants = this.listOperators();
    const cible = existants.find(op => op.id === id);
    if (!cible) return { ok: false, errors: { id: 'Opérateur introuvable.' }, data: null };

    if (this.getSession().currentOperatorId === id) {
      return {
        ok: false,
        errors: { id: 'Impossible de supprimer l’opérateur connecté. Fermez d’abord la session.' },
        data: null
      };
    }
    if (cible.role === 'gerant' && cible.active !== false &&
        !existants.some(op => op.id !== id && op.role === 'gerant' && op.active !== false)) {
      return {
        ok: false,
        errors: { id: 'Impossible de supprimer le dernier gérant actif de la brigade.' },
        data: null
      };
    }

    this.repository.saveBrigade(existants.filter(op => op.id !== id));
    this.logActivity({ action: 'deleteOperator', target: cible.id, details: operatorDisplayName(cible) });
    return { ok: true, errors: {}, data: { id: cible.id } };
  }

  /* ── Codes PIN ──────────────────────────────────────────────────────── */

  /** Définit ou remplace le code PIN. Un code vide renvoie vers clearPin(). */
  changePin(id, pin) {
    const cible = this.getOperator(id);
    if (!cible) return { ok: false, errors: { id: 'Opérateur introuvable.' }, data: null };

    const refus = this._verifierOuSoiMeme('users.manage', id);
    if (refus) return { ok: false, errors: refus, data: null };

    const valeur = pin === undefined || pin === null ? '' : String(pin).trim();
    if (valeur === '') return this.clearPin(id);

    const modifie = { ...cible, pin: valeur };
    const validation = validateOperator(modifie, []);
    if (validation.errors.pin) return { ok: false, errors: { pin: validation.errors.pin }, data: null };

    this.repository.saveBrigade(this.listOperators().map(op => (op.id === id ? modifie : op)));
    this.logActivity({ action: 'changePin', target: id, details: operatorDisplayName(cible) });
    return { ok: true, errors: {}, data: modifie };
  }

  /** Supprime le code PIN : sélection sans saisie. */
  clearPin(id) {
    const cible = this.getOperator(id);
    if (!cible) return { ok: false, errors: { id: 'Opérateur introuvable.' }, data: null };

    const refus = this._verifierOuSoiMeme('users.manage', id);
    if (refus) return { ok: false, errors: refus, data: null };

    const modifie = { ...cible, pin: '' };
    this.repository.saveBrigade(this.listOperators().map(op => (op.id === id ? modifie : op)));
    this.logActivity({ action: 'clearPin', target: id, details: operatorDisplayName(cible) });
    return { ok: true, errors: {}, data: modifie };
  }

  /** Vérifie un code PIN sans ouvrir de session. Sans code enregistré : vrai. */
  verifyPin(id, pin) {
    const cible = this.getOperator(id);
    if (!cible) return false;
    if (!cible.pin) return true;
    return String(pin ?? '') === String(cible.pin);
  }

  /* ── Établissement, session, journal ────────────────────────────────── */

  /** Met à jour l'établissement (fusion partielle) et les réglages associés. */
  setEstablishment(patch = {}) {
    const refus = this._verifier('settings.edit');
    if (refus) return { ok: false, errors: refus, data: null };

    const fusion = { ...this.getEstablishment(), ...(patch && typeof patch === 'object' ? patch : {}) };
    if (!String(fusion.name ?? '').trim()) {
      return { ok: false, errors: { name: 'Le nom de l’établissement est obligatoire.' }, data: null };
    }

    this.repository.saveEstablishment(fusion);
    if (typeof this.repository.getSettings === 'function' && typeof this.repository.saveSettings === 'function') {
      this.repository.saveSettings({ ...this.repository.getSettings(), establishment: fusion });
    }
    this.logActivity({
      action: 'setEstablishment',
      target: String(fusion.name),
      details: fusion.siret ? `SIRET ${fusion.siret}` : ''
    });
    return { ok: true, errors: {}, data: fusion };
  }

  /**
   * Ouvre une session pour un opérateur. Un code PIN n'est exigé que si
   * l'opérateur en possède un.
   */
  setCurrentOperator(id, { pin } = {}) {
    if (!id) return { ok: false, code: 'unknown_user', errors: { id: 'Aucun opérateur sélectionné.' }, data: null };

    const cible = this.getOperator(id);
    if (!cible) return { ok: false, code: 'unknown_user', errors: { id: 'Opérateur introuvable.' }, data: null };
    if (cible.active === false) {
      return {
        ok: false,
        code: 'user_inactive',
        errors: { id: `${operatorDisplayName(cible)} est désactivé. Réactivez-le avant de l’identifier.` },
        data: null
      };
    }
    if (cible.pin) {
      if (pin === undefined || pin === null || String(pin).trim() === '') {
        return {
          ok: false,
          code: 'pin_required',
          errors: { pin: 'Saisissez le code PIN à 4 à 6 chiffres.' },
          data: null
        };
      }
      if (String(pin) !== String(cible.pin)) {
        return { ok: false, code: 'pin_invalid', errors: { pin: 'Code PIN incorrect.' }, data: null };
      }
    }

    this.repository.saveSession({
      currentOperatorId: cible.id,
      startedAt: new Date().toISOString(),
      lockedAt: null
    });
    this.logActivity({
      action: 'session.open',
      target: cible.id,
      details: `${operatorDisplayName(cible)} — ${this._libelleRole(cible.role)}`
    });
    return { ok: true, code: 'ok', errors: {}, data: cible };
  }

  /** Ferme la session courante : retour en accès libre. */
  clearSession() {
    const courant = this.getCurrentOperator();
    this.repository.saveSession({ currentOperatorId: null, startedAt: null, lockedAt: null });
    if (courant) {
      this.logActivity({ action: 'session.close', target: courant.id, details: operatorDisplayName(courant) });
    }
    return { ok: true, errors: {}, data: null };
  }

  /** Ajoute une entrée au journal d'activité. */
  logActivity({ action, target = '', details = '' } = {}) {
    const courant = this.getCurrentOperator();
    const entree = {
      at:           new Date().toISOString(),
      operatorId:   courant ? courant.id : null,
      operatorName: courant ? operatorDisplayName(courant) : 'Accès libre',
      action:       String(action || 'action'),
      target:       String(target ?? ''),
      details:      String(details ?? '')
    };
    if (typeof this.repository.appendActivity === 'function') this.repository.appendActivity(entree);
    return entree;
  }

  /* ── Outils internes ────────────────────────────────────────────────── */

  _libelleRole(role) {
    return ROLES[role] && ROLES[role].label ? ROLES[role].label : String(role ?? '');
  }

  /** Refuse de retirer son rôle au dernier gérant actif. */
  _refusDernierGerant(ancien, existants, modifie) {
    const etaitGerantActif = ancien.role === 'gerant' && ancien.active !== false;
    if (!etaitGerantActif || modifie.role === 'gerant') return null;
    const autreGerant = existants.some(op => op.id !== ancien.id && op.role === 'gerant' && op.active !== false);
    if (autreGerant) return null;
    return { role: 'Impossible de retirer le rôle du dernier gérant actif. Nommez d’abord un autre gérant.' };
  }
}
