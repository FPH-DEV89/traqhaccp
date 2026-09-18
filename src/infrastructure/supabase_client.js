/**
 * TraqHACCP Pro — Infrastructure — Client Supabase sans dépendance (docs/DATA.md).
 *
 * Parle directement à **PostgREST** (`/rest/v1`) et **GoTrue** (`/auth/v1`) avec le
 * `fetch` natif du navigateur. Aucun paquet npm, aucune étape de build : le module est
 * un module ES natif importable tel quel par la PWA statique.
 *
 * Ce client ne contient AUCUNE règle métier HACCP et ne connaît aucune table : il sait
 * seulement émettre des requêtes REST, porter le jeton et traduire les erreurs en français.
 * Le mapping des entités est dans supabase_repository.js.
 *
 * ── Sécurité ─────────────────────────────────────────────────────────────────
 * L'en-tête `apikey` porte la clé publique publishable ; l'en-tête `Authorization`
 * porte le jeton de l'utilisateur connecté. La clé publique seule ne donne accès à rien :
 * les politiques RLS du serveur bornent chaque requête à l'établissement du porteur du
 * jeton. Ce module n'envoie jamais de filtre d'établissement obligatoire — c'est voulu.
 */
import {
  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_CLE_SESSION,
  lireStockage, ecrireStockage, supprimerStockage,
} from './config.js';

/** Marge (en secondes) avant expiration : on rafraîchit un peu en avance. */
const MARGE_EXPIRATION_S = 60;

/** Messages français par statut HTTP (complétés par le message brut du serveur). */
const MESSAGES_HTTP = {
  400: 'Requête refusée par le serveur (données ou filtre invalide).',
  401: 'Identifiants invalides ou session expirée : reconnectez-vous.',
  403: 'Droits insuffisants pour cette opération (rôle ou établissement).',
  404: 'Ressource introuvable sur le serveur.',
  406: 'Format de réponse refusé par le serveur.',
  409: 'Conflit : un enregistrement équivalent existe déjà.',
  413: 'Charge trop volumineuse pour le serveur.',
  422: 'Données non conformes au schéma (colonne ou type inattendu).',
  429: 'Trop de requêtes : patientez quelques secondes puis réessayez.',
  500: 'Erreur interne du serveur TraqHACCP.',
  502: 'Passerelle Supabase indisponible.',
  503: 'Service TraqHACCP momentanément indisponible.',
  504: "Le serveur TraqHACCP n'a pas répondu à temps.",
};

/** Messages français propres à GoTrue (connexion et session), plus explicites côté utilisateur. */
const MESSAGES_AUTH = {
  400: 'Identifiants invalides ou requête de connexion refusée.',
  401: 'Session expirée ou identifiants refusés : reconnectez-vous.',
  403: "Accès refusé : ce compte n'est pas autorisé à se connecter.",
  422: 'Adresse e-mail invalide ou mot de passe refusé par le serveur.',
  429: 'Trop de tentatives de connexion : patientez quelques minutes.',
};

/** Erreur applicative enrichie (statut HTTP, code PostgREST, détail). */
export class ErreurSupabase extends Error {
  /**
   * @param {string} message — message déjà rédigé en français, affichable tel quel
   * @param {{ statut?: number, code?: string|null, details?: string|null,
   *           hint?: string|null, table?: string|null }} [infos]
   */
  constructor(message, infos = {}) {
    super(message);
    this.name = 'ErreurSupabase';
    this.statut = infos.statut ?? 0;
    this.code = infos.code ?? null;
    this.details = infos.details ?? null;
    this.hint = infos.hint ?? null;
    this.table = infos.table ?? null;
  }
}

/**
 * Cite une valeur littérale PostgREST : sans guillemets si le jeu de caractères est sûr,
 * entre guillemets doubles sinon (les guillemets internes sont doublés).
 * @param {unknown} valeur
 * @returns {string}
 */
export function citerValeur(valeur) {
  if (valeur === null) return 'null';
  if (typeof valeur === 'boolean' || typeof valeur === 'number') return String(valeur);
  const texte = String(valeur);
  return /^[A-Za-z0-9._~-]+$/.test(texte) ? texte : `"${texte.replace(/"/g, '""')}"`;
}

/** Opérateurs PostgREST acceptés en chaîne brute (ex. `{ id: 'not.in.(a,b)' }`). */
const OPERATEUR_BRUT = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not|cs|cd|ov|fts|plfts|phfts|wfts)\./;

/**
 * Traduit un objet de filtres en paramètres de requête PostgREST.
 * Valeurs acceptées : scalaire → `eq.`, `'gte.3'` → chaîne brute, tableau → `in.(…)`,
 * objet `{ gte: 3 }` → `gte.3`.
 * @param {Record<string, unknown>} filtres
 * @returns {URLSearchParams}
 */
export function encoderFiltres(filtres = {}) {
  const params = new URLSearchParams();
  for (const [colonne, valeur] of Object.entries(filtres)) {
    if (valeur === undefined || valeur === null) continue;
    if (Array.isArray(valeur)) {
      params.append(colonne, `in.(${valeur.map(citerValeur).join(',')})`);
    } else if (typeof valeur === 'object') {
      for (const [operateur, v] of Object.entries(valeur)) params.append(colonne, `${operateur}.${citerValeur(v)}`);
    } else if (typeof valeur === 'string' && OPERATEUR_BRUT.test(valeur)) {
      params.append(colonne, valeur); // syntaxe brute voulue par l'appelant
    } else {
      params.append(colonne, `eq.${citerValeur(valeur)}`);
    }
  }
  return params;
}

/**
 * Compose le message français d'une erreur serveur.
 * @param {number} statut
 * @param {any} corps — corps JSON d'erreur PostgREST/GoTrue (ou texte)
 * @param {boolean} [auth] — vrai pour une réponse de GoTrue (`/auth/v1`)
 * @returns {string}
 */
function messageFr(statut, corps, auth = false) {
  const base = (auth && MESSAGES_AUTH[statut])
    || MESSAGES_HTTP[statut]
    || `Erreur serveur TraqHACCP (HTTP ${statut}).`;
  const brut = corps && typeof corps === 'object'
    ? (corps.message || corps.error_description || corps.error || corps.msg || corps.details)
    : (typeof corps === 'string' ? corps.slice(0, 200) : null);
  const code = corps && typeof corps === 'object' && corps.code ? ` [code ${corps.code}]` : '';
  return brut ? `${base} — ${String(brut).slice(0, 200)}${code}` : base + code;
}

/**
 * Client minimal Supabase (PostgREST + GoTrue) au-dessus de `fetch`.
 */
export class SupabaseClient {
  /**
   * @param {{ url?: string, cle?: string, cleSession?: string, fetchImpl?: Function }} [config]
   */
  constructor(config = {}) {
    this.url = String(config.url ?? SUPABASE_URL).replace(/\/+$/, '');
    this.cle = config.cle ?? SUPABASE_PUBLISHABLE_KEY;
    this.cleSession = config.cleSession ?? SUPABASE_CLE_SESSION;
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  /** @returns {string} Racine GoTrue. */
  get urlAuth() { return `${this.url}/auth/v1`; }

  /** @returns {string} Racine PostgREST. */
  get urlRest() { return `${this.url}/rest/v1`; }

  /* ───────────────────────────── Session ───────────────────────────── */

  /**
   * Session stockée (lecture synchrone, sans requête réseau).
   * @returns {{ access_token: string, refresh_token?: string, expires_at?: number,
   *             user?: object, token_type?: string } | null}
   */
  currentSession() {
    const session = lireStockage(this.cleSession, null);
    return session && typeof session === 'object' && typeof session.access_token === 'string'
      ? session
      : null;
  }

  /** @returns {object | null} Utilisateur de la session courante (ou null). */
  currentUser() {
    const session = this.currentSession();
    return session && session.user && typeof session.user === 'object' ? session.user : null;
  }

  /** @returns {boolean} Vrai si un jeton est disponible localement. */
  hasSession() {
    return this.currentSession() !== null;
  }

  /**
   * Indique si le jeton de la session est expiré (ou expire dans la marge).
   * @returns {boolean}
   */
  sessionExpiree() {
    const session = this.currentSession();
    if (!session) return true;
    if (!session.expires_at) return false; // pas d'échéance connue : on laisse le serveur trancher
    return Number(session.expires_at) - MARGE_EXPIRATION_S <= Math.floor(Date.now() / 1000);
  }

  /**
   * Efface la session locale.
   * @returns {boolean}
   */
  effacerSession() {
    return supprimerStockage(this.cleSession);
  }

  /**
   * Enregistre une réponse de GoTrue en session locale.
   * @param {object} donnees
   * @returns {object} session normalisée
   */
  _enregistrerSession(donnees) {
    const expires = donnees.expires_at
      ?? (donnees.expires_in ? Math.floor(Date.now() / 1000) + Number(donnees.expires_in) : null);
    const session = { ...donnees, expires_at: expires };
    ecrireStockage(this.cleSession, session);
    return session;
  }

  /**
   * Connexion par mot de passe (`grant_type=password`).
   * @param {string} email
   * @param {string} motDePasse
   * @returns {Promise<object>} session
   */
  async signIn(email, motDePasse) {
    if (!email || !motDePasse) {
      throw new ErreurSupabase('Adresse e-mail et mot de passe sont obligatoires pour se connecter.', { statut: 400 });
    }
    const reponse = await this.requete(`/auth/v1/token?grant_type=password`, {
      methode: 'POST',
      corps: { email: String(email).trim(), password: String(motDePasse) },
      auth: false,
    });
    if (!reponse || typeof reponse.access_token !== 'string') {
      throw new ErreurSupabase("Réponse d'authentification inattendue : jeton absent.", { statut: 500 });
    }
    return this._enregistrerSession(reponse);
  }

  /**
   * Déconnexion : révoque le jeton côté GoTrue puis efface la session locale.
   * N'échoue jamais (une session locale doit pouvoir être effacée même hors-ligne).
   * @returns {Promise<boolean>} Vrai si le serveur a bien révoqué le jeton.
   */
  async signOut() {
    let revoque = false;
    try {
      await this.requete('/auth/v1/logout', { methode: 'POST' });
      revoque = true;
    } catch {
      revoque = false;
    } finally {
      this.effacerSession();
    }
    return revoque;
  }

  /**
   * Rafraîchit le jeton via le `refresh_token`.
   * @returns {Promise<object | null>} nouvelle session, ou null si le rafraîchissement échoue
   */
  async rafraichirSession() {
    const session = this.currentSession();
    if (!session || !session.refresh_token) return null;
    try {
      const reponse = await this.requete('/auth/v1/token?grant_type=refresh_token', {
        methode: 'POST',
        corps: { refresh_token: session.refresh_token },
        auth: false,
      });
      return this._enregistrerSession(reponse);
    } catch {
      this.effacerSession(); // refresh_token révoqué : la session n'est plus récupérable
      return null;
    }
  }

  /**
   * Retourne une session utilisable en rafraîchissant le jeton si nécessaire.
   * @returns {Promise<object | null>}
   */
  async verifierSession() {
    const session = this.currentSession();
    if (!session) return null;
    return this.sessionExpiree() ? this.rafraichirSession() : session;
  }

  /**
   * Lit l'utilisateur auprès de GoTrue (vérifie le jeton auprès du serveur).
   * @returns {Promise<object | null>}
   */
  async fetchUser() {
    return this.requete('/auth/v1/user');
  }

  /* ─────────────────────────── Requête générique ─────────────────────── */

  /**
   * En-têtes communs (clé publique + jeton).
   * @returns {Promise<Record<string, string>>}
   */
  async _entetesAuth() {
    const session = await this.verifierSession();
    return {
      apikey: this.cle,
      Authorization: `Bearer ${session?.access_token ?? this.cle}`,
    };
  }

  /**
   * Envoie une requête et retourne le JSON décodé (ou null sur 204).
   * @param {string} chemin — chemin absolu relatif à l'URL du projet (`/rest/v1/…`)
   * @param {{ methode?: string, corps?: any, entetes?: Record<string,string>,
   *           auth?: boolean }} [options]
   * @returns {Promise<any>}
   */
  async requete(chemin, options = {}) {
    const methode = (options.methode ?? 'GET').toUpperCase();
    const entetes = { ...(await (options.auth === false
      ? Promise.resolve({ apikey: this.cle, Authorization: `Bearer ${this.cle}` })
      : this._entetesAuth())), ...(options.entetes ?? {}) };
    const init = { method: methode, headers: entetes };
    if (options.corps !== undefined) {
      entetes['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.corps);
    }

    let reponse;
    try {
      reponse = await this.fetchImpl(`${this.url}${chemin}`, init);
    } catch (cause) {
      throw new ErreurSupabase(
        'Réseau indisponible : impossible de joindre le serveur TraqHACCP. '
        + 'Le mode local reste utilisable hors-ligne.',
        { statut: 0, details: String(cause && cause.message ? cause.message : cause) },
      );
    }

    if (reponse.status === 204) return null;
    const texte = await reponse.text();
    let corps = null;
    if (texte) { try { corps = JSON.parse(texte); } catch { corps = texte; } }
    if (!reponse.ok) {
      throw new ErreurSupabase(messageFr(reponse.status, corps, chemin.startsWith('/auth/')), {
        statut: reponse.status,
        code: corps && typeof corps === 'object' ? corps.code ?? null : null,
        details: corps && typeof corps === 'object' ? corps.details ?? null : null,
        hint: corps && typeof corps === 'object' ? corps.hint ?? null : null,
      });
    }
    return corps;
  }

  /**
   * Sélectionne des lignes d'une table.
   * @param {string} table
   * @param {{ colonnes?: string, filtres?: object, ordre?: string|null,
   *           limite?: number|null, plafond?: number|null }} [options]
   * @returns {Promise<object[]>}
   */
  async select(table, options = {}) {
    const params = encoderFiltres(options.filtres);
    params.set('select', options.colonnes ?? '*');
    if (options.ordre) params.set('order', options.ordre);
    if (options.limite) params.set('limit', String(options.limite));
    return this.requete(`/rest/v1/${table}?${params.toString()}`);
  }

  /**
   * Insère des lignes. `upsert: true` fusionne sur la clé primaire
   * (`onConflict` par défaut : la PK de la table).
   * @param {string} table
   * @param {object|object[]} lignes
   * @param {{ upsert?: boolean, onConflict?: string|null, retourner?: boolean }} [options]
   * @returns {Promise<object[]|null>}
   */
  async insert(table, lignes, options = {}) {
    const params = new URLSearchParams();
    if (options.onConflict) params.set('on_conflict', options.onConflict);
    const preferences = [];
    if (options.upsert) preferences.push('resolution=merge-duplicates');
    if (options.retourner !== false) preferences.push('return=representation');
    const suffixe = params.toString() ? `?${params.toString()}` : '';
    return this.requete(`/rest/v1/${table}${suffixe}`, {
      methode: 'POST',
      corps: lignes,
      entetes: preferences.length ? { Prefer: preferences.join(',') } : {},
    });
  }

  /**
   * Met à jour les lignes correspondant aux filtres.
   * @param {string} table
   * @param {object} valeurs
   * @param {object} filtres
   * @param {{ retourner?: boolean }} [options]
   * @returns {Promise<object[]|null>}
   */
  async update(table, valeurs, filtres = {}, options = {}) {
    const params = encoderFiltres(filtres);
    const entetes = options.retourner === false ? {} : { Prefer: 'return=representation' };
    const suffixe = params.toString() ? `?${params.toString()}` : '';
    return this.requete(`/rest/v1/${table}${suffixe}`, {
      methode: 'PATCH', corps: valeurs, entetes,
    });
  }

  /**
   * Supprime les lignes correspondant aux filtres.
   * ATTENTION : sans filtre, la suppression porte sur tout ce que RLS autorise à voir.
   * @param {string} table
   * @param {object} [filtres]
   * @returns {Promise<object[]|null>}
   */
  async delete(table, filtres = {}) {
    const params = encoderFiltres(filtres);
    const suffixe = params.toString() ? `?${params.toString()}` : '';
    return this.requete(`/rest/v1/${table}${suffixe}`, { methode: 'DELETE' });
  }

  /**
   * Appelle une fonction PostgreSQL exposée par PostgREST.
   * @param {string} nom — ex. `create_establishment`
   * @param {Record<string, unknown>} [args] — ex. `{ p_name: 'Cuisine centrale' }`
   * @returns {Promise<any>}
   */
  async rpc(nom, args = {}) {
    return this.requete(`/rest/v1/rpc/${nom}`, { methode: 'POST', corps: args });
  }
}

/** Client partagé par défaut (une seule session pour toute l'application). */
export const supabase = new SupabaseClient();
