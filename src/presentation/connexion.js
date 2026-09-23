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

import { icon } from './icons.js';
import { toast } from './ui.js';

const PORTAL_ID = 'portail-connexion';
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIBELLE_CONNEXION = 'Se connecter';
const LIBELLE_INSCRIPTION = 'Créer mon compte et mon établissement';
const LIBELLE_CREATION = 'Créer mon établissement';
const LIBELLE_RECUPERATION = 'Envoyer le lien de réinitialisation';
const LIBELLE_NOUVEAU_MDP = 'Enregistrer le nouveau mot de passe';

let racine = null;
let resoudreAttente = null;
let contexte = { client: null, repository: null, onErreur: null };
let recoveryToken = null;

/** Décode les fragments d'URL (#access_token=...&type=recovery ou #error_description=...). */
function analyserHashAuth() {
  if (typeof window === 'undefined' || !window.location || !window.location.hash) return {};
  const brut = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(brut);
  return {
    accessToken: params.get('access_token'),
    type: params.get('type'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
}

/** Nettoie le hash d'authentification de l'URL pour ne pas exposer le token d'accès. */
function nettoyerHashAuth() {
  if (typeof window === 'undefined' || !window.history || typeof window.history.replaceState !== 'function') return;
  const sansHash = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', sansHash);
}

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
  if (statut === 400 || statut === 401) return 'Identifiants incorrects ou lien expiré.';
  if (statut === 403) return "Ce compte n'est rattaché à aucun établissement.";
  if (statut === 422) return 'Adresse e-mail ou mot de passe refusé par le serveur.';
  if (statut === 429) return 'Trop de tentatives : patientez un instant avant de réessayer.';
  if (statut === 0 || statut >= 500) return 'Serveur injoignable : vérifiez le réseau, ou continuez en mode local.';
  const brut = erreur && typeof erreur.message === 'string' ? erreur.message.trim() : '';
  return brut || 'Opération impossible pour le moment.';
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

      <!-- Sélecteur d'onglet Connexion / Inscription -->
      <div class="seg" id="portail-onglets" role="tablist" style="margin-bottom: var(--s-6); width: 100%;">
        <button class="seg__item is-active" id="portail-onglet-connexion" type="button" role="tab" style="flex: 1;">Se connecter</button>
        <button class="seg__item" id="portail-onglet-inscription" type="button" role="tab" style="flex: 1;">Créer un compte</button>
      </div>

      <p class="portail__intro" id="portail-intro"></p>

      <!-- Étape 1 : Connexion -->
      <form class="portail__forme" id="portail-forme-connexion" novalidate>
        <div class="field">
          <label class="field__label" for="portail-email">Adresse e-mail</label>
          <input class="input" id="portail-email" name="email" type="email" inputmode="email"
                 autocomplete="email" spellcheck="false" required>
        </div>
        <div class="field">
          <div class="portail__actions-secondaires">
            <label class="field__label" for="portail-mdp">Mot de passe</label>
            <button class="portail__lien" id="portail-vers-recup" type="button">Mot de passe oublié ?</button>
          </div>
          <input class="input" id="portail-mdp" name="motdepasse" type="password"
                 autocomplete="current-password" required>
        </div>
        <button class="btn btn--primary btn--block" id="portail-connexion-valider" type="submit">${LIBELLE_CONNEXION}</button>
      </form>

      <!-- Étape 1-bis : Inscription explicite (Créer un compte) -->
      <form class="portail__forme" id="portail-forme-inscription" hidden novalidate>
        <div class="field">
          <label class="field__label" for="portail-inscr-etab">Nom de l'établissement</label>
          <input class="input" id="portail-inscr-etab" name="etablissement" type="text"
                 autocomplete="organization" maxlength="80" placeholder="ex. Le Bistrot Gourmand" required>
          <p class="field__hint">Apparaît sur les enregistrements, les étiquettes et les exports.</p>
        </div>
        <div class="field">
          <label class="field__label" for="portail-inscr-email">Adresse e-mail</label>
          <input class="input" id="portail-inscr-email" name="email" type="email" inputmode="email"
                 autocomplete="email" spellcheck="false" required>
        </div>
        <div class="field">
          <label class="field__label" for="portail-inscr-mdp">Mot de passe</label>
          <input class="input" id="portail-inscr-mdp" name="motdepasse" type="password"
                 autocomplete="new-password" minlength="8" required>
          <p class="field__hint">Minimum 8 caractères.</p>
        </div>
        <div class="field">
          <label class="field__label" for="portail-inscr-confirm">Confirmer le mot de passe</label>
          <input class="input" id="portail-inscr-confirm" name="confirmmdp" type="password"
                 autocomplete="new-password" minlength="8" required>
        </div>
        <button class="btn btn--primary btn--block" id="portail-inscription-valider" type="submit">${LIBELLE_INSCRIPTION}</button>
      </form>

      <!-- Étape 2 : Demande d'envoi du lien de réinitialisation -->
      <form class="portail__forme" id="portail-forme-recup" hidden novalidate>
        <div class="field">
          <label class="field__label" for="portail-recup-email">Adresse e-mail du compte</label>
          <input class="input" id="portail-recup-email" name="email" type="email" inputmode="email"
                 autocomplete="email" spellcheck="false" required>
          <p class="field__hint">Nous vous enverrons un lien sécurisé pour définir un nouveau mot de passe.</p>
        </div>
        <button class="btn btn--primary btn--block" id="portail-recup-valider" type="submit">${LIBELLE_RECUPERATION}</button>
        <button class="portail__lien" id="portail-retour-connexion" type="button">Retour à la connexion</button>
      </form>

      <!-- Étape 3 : Confirmation d'envoi d'e-mail -->
      <div class="portail__forme" id="portail-forme-recup-succes" hidden>
        <div class="portail__succes" role="status">
          <strong>Lien de réinitialisation envoyé !</strong><br>
          Si cette adresse correspond à un compte, un message contenant les instructions vient d'être expédié.<br>
          <span class="field__hint">Pensez à vérifier votre dossier de courriers indésirables (spams).</span>
        </div>
        <button class="btn btn--secondary btn--block" id="portail-succes-retour" type="button">Retour à l'écran de connexion</button>
      </div>

      <!-- Étape 4 : Définition du nouveau mot de passe (suite lien magique) -->
      <form class="portail__forme" id="portail-forme-nouveau-mdp" hidden novalidate>
        <div class="field">
          <label class="field__label" for="portail-nouveau-mdp">Nouveau mot de passe</label>
          <input class="input" id="portail-nouveau-mdp" name="nouveaumdp" type="password"
                 autocomplete="new-password" minlength="8" required>
          <p class="field__hint">Minimum 8 caractères.</p>
        </div>
        <div class="field">
          <label class="field__label" for="portail-confirm-mdp">Confirmer le nouveau mot de passe</label>
          <input class="input" id="portail-confirm-mdp" name="confirmmdp" type="password"
                 autocomplete="new-password" minlength="8" required>
        </div>
        <button class="btn btn--primary btn--block" id="portail-nouveau-mdp-valider" type="submit">${LIBELLE_NOUVEAU_MDP}</button>
      </form>

      <!-- Étape 5 : Création de l'établissement initial (pour compte existant orphelin) -->
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

/** Verrouille ou libère le formulaire en cours : champs désactivés, libellé dynamique. */
function etatOccupe(occupe) {
  if (!racine) return;
  const etape = racine.dataset.etape;
  racine.querySelectorAll('.portail__forme .input, .portail__forme button, #portail-onglets button').forEach((el) => {
    el.disabled = occupe;
  });

  const boutons = {
    connexion: ['#portail-connexion-valider', LIBELLE_CONNEXION, 'Connexion…'],
    inscription: ['#portail-inscription-valider', LIBELLE_INSCRIPTION, 'Création du compte…'],
    creation: ['#portail-creation-valider', LIBELLE_CREATION, 'Création…'],
    recup: ['#portail-recup-valider', LIBELLE_RECUPERATION, 'Envoi en cours…'],
    'nouveau-mdp': ['#portail-nouveau-mdp-valider', LIBELLE_NOUVEAU_MDP, 'Enregistrement…'],
  };

  const config = boutons[etape];
  if (config) {
    const btn = champ(config[0]);
    if (btn) btn.textContent = occupe ? config[2] : config[1];
  }
}

/** Bascule entre les différentes étapes du portail et remet le bon focus. */
function afficherEtape(etape, message = '') {
  if (!racine) return;
  racine.dataset.etape = etape;

  champ('#portail-forme-connexion').hidden = (etape !== 'connexion');
  champ('#portail-forme-inscription').hidden = (etape !== 'inscription');
  champ('#portail-forme-creation').hidden = (etape !== 'creation');
  champ('#portail-forme-recup').hidden = (etape !== 'recup');
  champ('#portail-forme-recup-succes').hidden = (etape !== 'recup-succes');
  champ('#portail-forme-nouveau-mdp').hidden = (etape !== 'nouveau-mdp');

  // Gestion des onglets principaux (visibles uniquement lors de connexion ou inscription)
  const barreOnglets = champ('#portail-onglets');
  if (barreOnglets) {
    barreOnglets.hidden = (etape !== 'connexion' && etape !== 'inscription');
    const ongletCo = champ('#portail-onglet-connexion');
    const ongletInscr = champ('#portail-onglet-inscription');
    if (ongletCo) ongletCo.classList.toggle('is-active', etape === 'connexion');
    if (ongletInscr) ongletInscr.classList.toggle('is-active', etape === 'inscription');
  }

  const intro = champ('#portail-intro');
  if (intro) {
    switch (etape) {
      case 'inscription':
        intro.textContent = 'Créez votre compte administrateur et initialisez le registre officiel de votre établissement.';
        break;
      case 'creation':
        intro.textContent = "Ce compte n'est rattaché à aucun établissement : nommez-le pour créer le registre partagé.";
        break;
      case 'recup':
        intro.textContent = 'Réinitialisez votre mot de passe pour retrouver l’accès à votre établissement.';
        break;
      case 'recup-succes':
        intro.textContent = 'Consultez votre boîte de réception pour poursuivre.';
        break;
      case 'nouveau-mdp':
        intro.textContent = 'Choisissez un nouveau mot de passe robuste d’au moins 8 caractères.';
        break;
      case 'connexion':
      default:
        intro.textContent = 'Connectez-vous pour retrouver le registre partagé de votre établissement.';
        break;
    }
  }

  etatOccupe(false);
  if (message) afficherErreur(message); else effacerErreur();

  const focusParEtape = {
    connexion: '#portail-email',
    inscription: '#portail-inscr-etab',
    creation: '#portail-etab',
    recup: '#portail-recup-email',
    'nouveau-mdp': '#portail-nouveau-mdp',
    'recup-succes': '#portail-succes-retour',
  };
  const cible = champ(focusParEtape[etape] || '#portail-email');
  if (cible) cible.focus();
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

async function soumettreInscription(evenement) {
  evenement.preventDefault();
  const nomEtab = ((champ('#portail-inscr-etab') || {}).value || '').trim();
  const email = ((champ('#portail-inscr-email') || {}).value || '').trim();
  const motDePasse = (champ('#portail-inscr-mdp') || {}).value || '';
  const confirm = (champ('#portail-inscr-confirm') || {}).value || '';

  if (nomEtab.length < 2) {
    afficherErreur("Indiquez le nom de l'établissement (2 caractères minimum).", '#portail-inscr-etab');
    return;
  }
  if (!email || !EMAIL_VALIDE.test(email)) {
    afficherErreur('Indiquez une adresse e-mail valide.', '#portail-inscr-email');
    return;
  }
  if (!motDePasse || motDePasse.length < 8) {
    afficherErreur('Le mot de passe doit comporter au moins 8 caractères.', '#portail-inscr-mdp');
    return;
  }
  if (motDePasse !== confirm) {
    afficherErreur('Les deux mots de passe ne correspondent pas.', '#portail-inscr-confirm');
    return;
  }

  effacerErreur();
  etatOccupe(true);
  try {
    if (typeof contexte.client.signUp === 'function') {
      await contexte.client.signUp(email, motDePasse);
    } else {
      await contexte.client.signIn(email, motDePasse);
    }

    // Si la session n'est pas directement active (ex: confirmation par email requise)
    if (!contexte.client.hasSession()) {
      try {
        await contexte.client.signIn(email, motDePasse);
      } catch (errCo) {
        // En cas de compte déjà existant ou attente de validation
        if (errCo && (errCo.statut === 400 || errCo.statut === 422)) {
          afficherEtape('connexion', 'Un compte existe déjà avec cette adresse ou un e-mail de confirmation vous a été envoyé. Veuillez vous connecter.');
          return;
        }
        throw errCo;
      }
    }

    // Création de l'établissement rattaché
    if (!contexte.repository) {
      throw new Error('Dépôt serveur indisponible.');
    }
    await contexte.repository.creerEtablissement(nomEtab);
    terminer({ ok: true });
  } catch (erreur) {
    if (contexte.onErreur) contexte.onErreur(erreur);
    const msg = (erreur && erreur.message) ? erreur.message : '';
    if (msg.includes('already registered') || msg.includes('User already registered')) {
      afficherEtape('connexion', 'Un compte existe déjà avec cet e-mail. Connectez-vous.');
    } else {
      afficherErreur(messageErreur(erreur));
    }
  } finally {
    const s1 = champ('#portail-inscr-mdp');
    const s2 = champ('#portail-inscr-confirm');
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    etatOccupe(false);
  }
}

async function soumettreDemandeRecuperation(evenement) {
  evenement.preventDefault();
  const email = ((champ('#portail-recup-email') || {}).value || '').trim();
  if (!email || !EMAIL_VALIDE.test(email)) {
    afficherErreur('Indiquez une adresse e-mail valide pour la réinitialisation.', '#portail-recup-email');
    return;
  }
  effacerErreur();
  etatOccupe(true);
  try {
    const redirection = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : null;
    await contexte.client.demanderReinitialisation(email, redirection);
    afficherEtape('recup-succes');
  } catch (erreur) {
    if (contexte.onErreur) contexte.onErreur(erreur);
    afficherErreur(messageErreur(erreur));
  } finally {
    etatOccupe(false);
  }
}

async function soumettreNouveauMotDePasse(evenement) {
  evenement.preventDefault();
  const mdp = (champ('#portail-nouveau-mdp') || {}).value || '';
  const confirm = (champ('#portail-confirm-mdp') || {}).value || '';

  if (!mdp || mdp.length < 8) {
    afficherErreur('Le nouveau mot de passe doit comporter au moins 8 caractères.', '#portail-nouveau-mdp');
    return;
  }
  if (mdp !== confirm) {
    afficherErreur('Les deux mots de passe ne correspondent pas.', '#portail-confirm-mdp');
    return;
  }

  effacerErreur();
  etatOccupe(true);
  try {
    await contexte.client.mettreAJourMotDePasse(mdp, recoveryToken);
    recoveryToken = null;
    nettoyerHashAuth();
    toast({ status: 'info', message: 'Mot de passe mis à jour avec succès.' });

    // Résolution de l'adhésion
    const identifiant = await resoudreEtablissement();
    if (identifiant) {
      terminer({ ok: true });
      return;
    }
    afficherEtape('creation');
  } catch (erreur) {
    if (contexte.onErreur) contexte.onErreur(erreur);
    afficherErreur(messageErreur(erreur));
  } finally {
    const c1 = champ('#portail-nouveau-mdp');
    const c2 = champ('#portail-confirm-mdp');
    if (c1) c1.value = '';
    if (c2) c2.value = '';
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

/** Session déjà présente ou jeton de récupération dans l'URL. */
async function preparer() {
  const { client, onErreur } = contexte;

  // 1. Détection d'un retour de lien de réinitialisation Supabase
  const hashAuth = analyserHashAuth();
  if (hashAuth.error) {
    afficherEtape('connexion', `Lien invalide ou expiré : ${hashAuth.errorDescription || 'veuillez refaire une demande.'}`);
    nettoyerHashAuth();
    return;
  }
  if (hashAuth.accessToken && hashAuth.type === 'recovery') {
    recoveryToken = hashAuth.accessToken;
    afficherEtape('nouveau-mdp');
    return;
  }

  // 2. Session déjà existante
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
  racine.querySelector('#portail-forme-inscription').addEventListener('submit', soumettreInscription);
  racine.querySelector('#portail-forme-creation').addEventListener('submit', soumettreCreation);
  racine.querySelector('#portail-forme-recup').addEventListener('submit', soumettreDemandeRecuperation);
  racine.querySelector('#portail-forme-nouveau-mdp').addEventListener('submit', soumettreNouveauMotDePasse);

  const ongletCo = racine.querySelector('#portail-onglet-connexion');
  if (ongletCo) ongletCo.addEventListener('click', () => afficherEtape('connexion'));

  const ongletInscr = racine.querySelector('#portail-onglet-inscription');
  if (ongletInscr) ongletInscr.addEventListener('click', () => afficherEtape('inscription'));

  racine.querySelector('#portail-vers-recup').addEventListener('click', () => {
    const saisieEmail = (champ('#portail-email') || {}).value || '';
    afficherEtape('recup');
    const cible = champ('#portail-recup-email');
    if (cible && saisieEmail) cible.value = saisieEmail;
  });

  racine.querySelector('#portail-retour-connexion').addEventListener('click', () => {
    afficherEtape('connexion');
  });

  racine.querySelector('#portail-succes-retour').addEventListener('click', () => {
    afficherEtape('connexion');
  });

  const attente = new Promise((resoudre) => { resoudreAttente = resoudre; });
  preparer();
  return attente;
}

/** Retire l'écran de connexion s'il est affiché (idempotent). */
export function masquerConnexion() {
  if (racine && racine.parentNode) racine.parentNode.removeChild(racine);
  racine = null;
  recoveryToken = null;
  contexte = { client: null, repository: null, onErreur: null };
}
