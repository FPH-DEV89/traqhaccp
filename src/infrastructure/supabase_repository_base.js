/**
 * TraqHACCP — socle serveur : plomberie interne du depot Supabase.
 * Garde-fous de session, lecture/ecriture differee, resolution de l'etablissement.
 * Separe pour respecter la limite de 500 lignes (regle God File du projet).
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

export class SupabaseRepositoryBase {
  /* ═══════════════════════════════════════════════════════════════════
     Garde-fous & plomberie interne
     ═══════════════════════════════════════════════════════════════════ */

  _exigerSession() {
    if (!this.client.hasSession()) {
      throw new ErreurSupabase(
        "Aucune session TraqHACCP : appelez d'abord await repo.client.signIn(email, motDePasse) avant d'utiliser le dépôt serveur.",
        { statut: 401 }
      );
    }
  }

  _exigerLecture() {
    this._exigerSession();
    if (!this._hydrate) {
      throw new ErreurSupabase(
        "Données serveur non chargées : appelez await repo.hydrate() après la connexion (docs/DATA.md §Mode serveur).",
        { statut: 428 }
      );
    }
  }

  _exigerEcriture() {
    this._exigerSession();
    if (!this.establishmentId) {
      throw new ErreurSupabase(
        "Établissement inconnu : hydrate() n'a pas encore déterminé l'établissement de ce compte (docs/DATA.md §Bootstrap).",
        { statut: 428 }
      );
    }
  }

  async _resoudreMembre() {
    if (this.establishmentId) return this.establishmentId;
    const membres = await this.client.select('memberships', { colonnes: 'establishment_id,role', limite: 1 });
    const membre = Array.isArray(membres) ? membres[0] : null;
    if (!membre || !membre.establishment_id) {
      throw new ErreurSupabase(
        "Ce compte n'est rattaché à aucun établissement : exécutez d'abord create_establishment('Nom') (docs/DATA.md §Bootstrap).",
        { statut: 403, table: 'memberships' }
      );
    }
    this.establishmentId = membre.establishment_id;
    this.role = membre.role || null;
    return this.establishmentId;
  }

  _lignes(cle) {
    const lignes = this._collections[cle];
    return Array.isArray(lignes) ? lignes : [];
  }

  /** Lecture d'une collection : lignes serveur → entités du domaine. */
  _liste(cle) {
    this._exigerLecture();
    return versObjets(SPECS[cle], this._lignes(cle));
  }

  /** Remplacement d'une collection : cache immédiat + écriture différée. */
  _remplacer(cle, liste) {
    this._exigerEcriture();
    const spec = SPECS[cle];
    const avant = identifiants(this._lignes(cle));
    const lignes = versLignes(spec, liste, this.establishmentId);
    const apres = new Set(identifiants(lignes));
    const supprimes = avant.filter((id) => !apres.has(id));
    this._collections[cle] = lignes;
    return this._tacher(this._ecrireRemplacement(cle, lignes, supprimes), spec.table);
  }

  /** Upsert des lignes puis purge ciblée des identifiants qui ont disparu de la liste. */
  async _ecrireRemplacement(cle, lignes, supprimes) {
    const table = SPECS[cle].table;
    if (lignes.length) {
      await this.client.insert(table, lignes, { upsert: true, onConflict: cibleConflit(cle) });
    }
    if (supprimes.length) {
      await this.client.delete(table, {
        establishment_id: `eq.${this.establishmentId}`,
        id: `in.(${supprimes.map(citerValeur).join(',')})`,
      });
    }
    return true;
  }

  /** Met en file une écriture différée : ne lève jamais, mémorise et signale l'échec. */
  _tacher(promesse, table) {
    const tache = Promise.resolve(promesse)
      .then(() => true)
      .catch((erreur) => {
        this._derniereErreur = erreur;
        if (typeof this.onErreur === 'function') this.onErreur(erreur, table);
        else console.warn(`[TraqHACCP][serveur] écriture différée refusée (${table}) : ${erreur && erreur.message}`);
        return false;
      });
    this._enAttente.push(tache);
    return tache;
  }

  /** Applique le format v4 à une brigade et garantit « au moins un gérant actif ». */
  _normaliserBrigade(liste) {
    const brigade = (Array.isArray(liste) ? liste : []).map((membre) => normalizeOperator(membre));
    const gerantActif = brigade.some((membre) => membre.role === 'gerant' && membre.active !== false);
    if (!gerantActif) {
      const premier = brigade.find((membre) => membre.active !== false);
      if (premier) premier.role = 'gerant';
    }
    return brigade;
  }

}
