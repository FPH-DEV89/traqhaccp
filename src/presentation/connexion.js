/**
 * TraqHACCP — Couche présentation — Porte de connexion (mode serveur).
 *
 * Ce module n'est chargé que lorsque `estModeServeur()` est vrai (voir config.js et boot).
 * En mode local, il n'est jamais importé : le comportement historique est inchangé.
 *
 * Contrat :
 *   afficherConnexion({ client, repository, onErreur }) → Promise
 *     · résout { ok: true }                       : session valide ET établissement disponible ;
 *     · résout { ok: false, raison: 'local' }     : l'utilisateur préfère les données locales ;
 *     · ne résout jamais tant que l'utilisateur n'a pas abouti.
 *   masquerConnexion() → retire l'écran du DOM (idempotent).
 *
 * Sécurité : le mot de passe n'est jamais journalisé, jamais persisté, jamais réaffiché ; il ne
 * quitte le champ que pour `client.signIn()`, et le champ est vidé dans tous les cas. Les
 * messages d'erreur restent génériques (« Identifiants incorrects ») afin de ne pas permettre
 * d'énumérer les comptes existants.
 */

import { definirModePersistance, retirerModeUrl } from '../infrastructure/config.js';
import { icon } from './icons.js';
import { toast } from './ui.js';

const PORTAL_ID = 'portail-connexion';
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIBELLE_CONNEXION = 'Se connecter';
const LIBELLE_CREATION = 'Créer mon établissement';

let racine = null;
let resoudreAttente = null;
let contexte = { client: null, repository: null, onErreur: null };

/** Conteneur d'accueil : la coquille `.app` si elle existe, sinon le corps du document. */
function hote() {
  if (typeof document === 'undefined') return null;
  const coquille = document.querySelector('.app');
  if (coquille) return coquille;
  return document.body || null;
}

/** Message lisible et sûr : jamais `[object Object]`, jamais un détail énumérable. */
function messageErreur(erreur) {
  const statut = Number(erreur && erreur.statut) || 0;
  if (statut === 400 || statut === 401) return 'Identifiants incorrects.';
  if (statut === 403) return "Ce compte n'est rattaché à aucun établissement.";
  if (statut === 422) return 'Adresse e-mail ou mot de passe refusé par le serveur.';
  if (statut === 429) return 'Trop de tentatives : patientez une minute avant de réessayer.';
  if (statut === 0 || statut >= 500) return 'Serveur injoignable : vérifiez le réseau, ou continuez en mode local.';
  const brut = erreur && typeof erreur.message === 'string' ? erreur.message.trim() : '';
  return brut || 'Connexion impossible pour le moment.';
}

/** Gabarit autonome du portail (aucune donnée utilisateur injectée ici). */
function gabarit() {
  return `
  <div class="portail" id="${PORTAL_ID}" data-etape="connexion" role="dialog" aria-modal="true" aria-labelledby="portail-titre">
    <div class="portail__carte">
      <header class="portail__entete">
        <span class="portail__pastille" aria-hidden="true">${icon('shield', 22)}</span>
        <span class="portail__entete-texte">
          <h1 class="portail__titre" id="portail-titre">TraqHACCP</h1>
          <p class="portail__sous-titre">Registre sanitaire partagé</p>
        </span>
      </header>
      <p class="portail__intro" id="portail-intro"></p>
      <form class="portail__forme" id="portail-forme-connexion" novalidate>
        <div class="field">
          <label class="field__label" for="portail-email">Adresse e-mail</label>
          <input class="input" id="portail-email" name="email" type="email" inputmode="email"
                 autocomplete="email" spellcheck="false" required>
        </div>
        <div class="field">
          <label class="field__label" for="portail-mdp">Mot de passe</label>
          <input class="input" id="portail-mdp" name="motdepasse" type="password"
                 autocomplete="current-password" required>
        </div>
        <button class="btn btn--primary btn--block" id="portail-connexion-valider" type="submit">${LIBELLE_CONNEXION}</button>
      </form>
      <form class="portail__forme" id="portail-forme-creation" hidden novalidate>
        <div class="field">
          <label class="field__label" for="portail-etab">Nom de l'établissement</label>
          <input class="input" id="portail-etab" name="etablissement" type="text"
                 autocomplete="organization" maxlength="80" required>
          <p class="field__hint">Apparaît sur les enregistrements, les étiquettes et les exports.</p>
        </div>
        <button class="btn btn--primary btn--block" id="portail-creation-valider" type="submit">${LIBELLE_CREATION}</button>
      </form>
      <p class="portail__erreur" id="portail-erreur" role="status" aria-live="polite"></p>
      <footer class="portail__pied">
        <button class="portail__lien" id="portail-local" type="button">Continuer sans compte (données locales)</button>
        <p class="portail__note">Aucune donnée n'est envoyée tant que vous n'êtes pas connecté.</p>
      </footer>
    </div>
  </div>`;
}

const champ = (selecteur) => (racine ? racine.querySelector(selecteur) : null);

function afficherErreur(message, selecteurChamp = null) {
  const zone = champ('#portail-erreur');
  if (zone) zone.textContent = message || '';
  racine.querySelectorAll('.input').forEach((el) => el.removeAttribute('aria-invalid'));
  if (selecteurChamp) {
    const cible = champ(selecteurChamp);
    if (cible) { cible.setAttribute('aria-invalid', 'true'); cible.focus(); }
  }
}

const effacerErreur = () => afficherErreur('');

/** Verrouille ou libère le formulaire en cours : champs désactivés, libellé « Connexion… ». */
function etatOccupe(occupe) {
  if (!racine) return;
  const creation = racine.dataset.etape === 'creation';
  racine.querySelectorAll('.portail__forme .input').forEach((el) => { el.disabled = occupe; });
  const bouton = champ(creation ? '#portail-creation-valider' : '#portail-connexion-valider');
  if (!bouton) return;
  bouton.disabled = occupe;
  const repos = creation ? LIBELLE_CREATION : LIBELLE_CONNEXION;
  bouton.textContent = occupe ? (creation ? 'Création…' : 'Connexion…') : repos;
}

/** Bascule entre les deux étapes (« connexion » / « création ») et remet le focus utile. */
function afficherEtape(etape, message = '') {
  if (!racine) return;
  racine.dataset.etape = etape;
  const creation = etape === 'creation';
  champ('#portail-forme-connexion').hidden = creation;
  champ('#portail-forme-creation').hidden = !creation;
  const intro = champ('#portail-intro');
  if (intro) {
    intro.textContent = creation
      ? "Ce compte n'est rattaché à aucun établissement : nommez-le pour créer le registre partagé."
      : 'Connectez-vous pour retrouver le registre partagé de votre établissement.';
  }
  etatOccupe(false);
  if (message) afficherErreur(message); else effacerErreur();
  const premier = champ(creation ? '#portail-etab' : '#portail-email');
  if (premier) premier.focus();
}

/** Adhésion de l'utilisateur connecté : renvoie l'identifiant d'établissement, ou null. */
async function resoudreEtablissement() {
  const { client, repository } = contexte;
  const lignes = await client.select('memberships', { colonnes: 'establishment_id', limite: 1 });
  const membre = Array.isArray(lignes) ? lignes[0] : null;
  const identifiant = membre && membre.establishment_id ? String(membre.establishment_id) : '';
  if (!identifiant) return null;
  if (repository && typeof repository.definirEtablissement === 'function') repository.definirEtablissement(identifiant);
  return identifiant;
}

/** Fin de parcours : retire l'écran et résout la promesse d'attente. */
function terminer(reponse) {
  const aboutir = resoudreAttente;
  resoudreAttente = null;
  masquerConnexion();
  if (aboutir) aboutir(reponse);
}

function continuerEnLocal() {
  definirModePersistance('local');
  // L'URL peut porter `?mode=serveur` : sans ce nettoyage, la surcharge d'URL reprendrait la
  // main au rechargement et ramènerait l'utilisateur sur le portail, en boucle.
  retirerModeUrl();
  terminer({ ok: false, raison: 'local' });
  try {
    if (typeof location !== 'undefined' && typeof location.reload === 'function') location.reload();
  } catch {
    /* environnement sans navigation : le démarrage local prend le relais */
  }
}

/** Validation locale : renvoie { message, champ } ou null. */
function validerIdentifiants(email, motDePasse) {
  if (!email && !motDePasse) {
    return { message: 'Renseignez votre adresse e-mail et votre mot de passe.', champ: '#portail-email' };
  }
  if (!EMAIL_VALIDE.test(email)) return { message: 'Adresse e-mail invalide.', champ: '#portail-email' };
  if (!motDePasse) return { message: 'Renseignez votre mot de passe.', champ: '#portail-mdp' };
  return null;
}

async function soumettreConnexion(evenement) {
  evenement.preventDefault();
  const email = (champ('#portail-email') || {}).value || '';
  const motDePasse = (champ('#portail-mdp') || {}).value || '';
  const souci = validerIdentifiants(email.trim(), motDePasse);
  if (souci) { afficherErreur(souci.message, souci.champ); return; }
  effacerErreur();
  etatOccupe(true);
  try {
    await contexte.client.signIn(email.trim(), motDePasse);
    const identifiant = await resoudreEtablissement();
    if (identifiant) { terminer({ ok: true }); return; }
    afficherEtape('creation');
  } catch (erreur) {
    if (contexte.onErreur) contexte.onErreur(erreur);
    afficherErreur(messageErreur(erreur));
  } finally {
    const secret = champ('#portail-mdp');
    if (secret) secret.value = '';
    etatOccupe(false);
  }
}

async function soumettreCreation(evenement) {
  evenement.preventDefault();
  const nom = ((champ('#portail-etab') || {}).value || '').trim();
  if (nom.length < 2) {
    afficherErreur("Indiquez le nom de l'établissement (2 caractères minimum).", '#portail-etab');
    return;
  }
  if (!contexte.repository) { afficherErreur('Création impossible : dépôt serveur indisponible.'); return; }
  effacerErreur();
  etatOccupe(true);
  try {
    await contexte.repository.creerEtablissement(nom);
    terminer({ ok: true });
  } catch (erreur) {
    if (contexte.onErreur) contexte.onErreur(erreur);
    afficherErreur(messageErreur(erreur));
  } finally {
    etatOccupe(false);
  }
}

/** Session déjà présente : on complète le parcours sans redemander les identifiants. */
async function preparer() {
  const { client, repository, onErreur } = contexte;
  let session = null;
  try {
    session = client.hasSession() ? client.currentSession() : null;
  } catch { session = null; }
  if (!session) { afficherEtape('connexion'); return; }
  etatOccupe(true);
  try {
    const identifiant = await resoudreEtablissement();
    if (identifiant) { terminer({ ok: true }); return; }
    afficherEtape('creation');
  } catch (erreur) {
    const statut = Number(erreur && erreur.statut) || 0;
    if (onErreur) onErreur(erreur);
    if (statut === 401 || statut === 403) {
      try { client.effacerSession(); } catch { /* session déjà absente */ }
      toast({ status: 'warn', message: 'Votre session a expiré : reconnectez-vous.' });
      afficherEtape('connexion');
    } else {
      afficherEtape('connexion', messageErreur(erreur));
    }
  } finally {
    etatOccupe(false);
  }
}

/**
 * Affiche la porte de connexion et ne rend la main qu'une fois le parcours abouti.
 * @param {{ client: object, repository?: object|null, onErreur?: Function|null }} options
 * @returns {Promise<{ ok: boolean, raison?: string }>}
 */
export async function afficherConnexion({ client, repository = null, onErreur = null } = {}) {
  if (!client || typeof client.signIn !== 'function') throw new Error('afficherConnexion : client Supabase requis');
  if (racine) return new Promise((resoudre) => { resoudreAttente = resoudre; });
  const conteneur = hote();
  if (!conteneur) return { ok: false, raison: 'local' };
  contexte = { client, repository, onErreur };
  conteneur.insertAdjacentHTML('beforeend', gabarit());
  racine = conteneur.querySelector(`#${PORTAL_ID}`);
  racine.querySelector('#portail-forme-connexion').addEventListener('submit', soumettreConnexion);
  racine.querySelector('#portail-forme-creation').addEventListener('submit', soumettreCreation);
  racine.querySelector('#portail-local').addEventListener('click', continuerEnLocal);
  const attente = new Promise((resoudre) => { resoudreAttente = resoudre; });
  preparer();
  return attente;
}

/** Retire l'écran de connexion s'il est affiché (idempotent). */
export function masquerConnexion() {
  if (racine && racine.parentNode) racine.parentNode.removeChild(racine);
  racine = null;
  contexte = { client: null, repository: null, onErreur: null };
}
