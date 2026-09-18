/**
 * TraqHACCP — Présentation — Bloc « session serveur » de la vue Compte.
 *
 * Pourquoi ce module existe : en mode local il n'y a pas de session, donc rien à afficher.
 * En mode serveur, le portail de connexion n'est franchi qu'UNE fois — sans point de sortie
 * visible, impossible de changer de compte ou d'établissement, et l'écran de connexion
 * deviendrait définitivement hors d'atteinte.
 *
 * Contrat public (docs/ARCHITECTURE.md §5) :
 *   blocSession(ctx)      → string          — fragment HTML ; '' hors mode serveur.
 *   seDeconnecter(ctx)    → Promise<void>   — ferme la session GoTrue et revient au portail.
 *
 * Le module est chargé par la vue Compte dans tous les modes : il n'importe donc RIEN de
 * la couche Supabase. L'identité est lue sur le client déjà instancié, exposé par le dépôt
 * (`ctx.repository.client`), et toute lecture est protégée — un bloc décoratif ne doit
 * jamais faire échouer le rendu de la vue Compte.
 */

import { estModeServeur } from '../infrastructure/config.js';

/* ══ Utilitaires locaux (la couche présentation n'a pas d'échappeur partagé) ══ */

function texte(valeur) {
  return valeur === null || valeur === undefined ? '' : String(valeur).trim();
}

function esc(valeur) {
  return texte(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Client HTTP du dépôt courant, ou null si le dépôt est local. */
function clientDe(ctx) {
  const depot = ctx && ctx.repository;
  const client = depot && depot.client;
  return client && typeof client.currentUser === 'function' ? client : null;
}

/**
 * Identité de la session ouverte — lecture SYNCHRONE (le jeton est en stockage local),
 * ce qui évite tout rendu différé dans la vue Compte.
 * @returns {{email: string, expiree: boolean}}
 */
function identite(ctx) {
  try {
    const client = clientDe(ctx);
    if (!client) return { email: '', expiree: false };
    const utilisateur = client.currentUser();
    return {
      email: texte(utilisateur && utilisateur.email),
      expiree: typeof client.sessionExpiree === 'function' ? client.sessionExpiree() === true : false,
    };
  } catch {
    return { email: '', expiree: false };
  }
}

/** Nom de l'établissement affiché par la vue Compte. */
function nomEtablissement(ctx) {
  try {
    const compte = ctx && ctx.account;
    const fiche = compte && typeof compte.getEstablishment === 'function' ? compte.getEstablishment() : null;
    return texte(fiche && fiche.name);
  } catch {
    return '';
  }
}

/* ══ Contrat public ═════════════════════════════════════════════════════════ */

/**
 * Fragment HTML du bloc session. Chaîne vide en mode local : la vue Compte reste
 * strictement identique à ce qu'elle était avant l'arrivée du socle serveur.
 * @param {object} ctx Contexte de vue (store étalé, cf. store.getState()).
 * @returns {string}
 */
export function blocSession(ctx) {
  if (!estModeServeur()) return '';
  const { email, expiree } = identite(ctx);
  const etablissement = nomEtablissement(ctx);
  const marque = expiree
    ? '<span class="mark mark--warn">session expirée</span>'
    : '<span class="mark mark--ok">connecté</span>';
  const avis = expiree
    ? "La session a expiré : reconnectez-vous pour que vos relevés partent sur le registre partagé."
    : "Vos relevés sont enregistrés dans la base de l'établissement et partagés entre les appareils de la brigade.";
  return `<section class="sheet"><div class="section">
    <div class="section__head"><h2 class="section__title">Session serveur</h2><div class="section__action">
      <button class="btn btn--ghost btn--sm" type="button" data-action="session-deconnexion">Se déconnecter</button></div></div>
    <div class="callout callout--info">${esc(avis)}</div>
    <div class="session-serveur">
      <div class="session-serveur__texte">
        <p class="session-serveur__nom">${esc(etablissement || 'Établissement en cours de chargement')}</p>
        <p class="session-serveur__meta">${esc(email || 'compte connecté')}</p>
      </div>
      ${marque}
    </div></div></section>`;
}

/**
 * Ferme la session GoTrue, efface le jeton local et ramène au portail de connexion.
 * Le rechargement est volontaire : la coquille est reconstruite par `boot()`, ce qui
 * garantit qu'aucune donnée de l'établissement précédent ne survit à l'écran.
 * @param {object} ctx Contexte de vue.
 * @returns {Promise<void>}
 */
export async function seDeconnecter(ctx) {
  const client = clientDe(ctx);
  if (!client) return;
  const accord = await ctx.ui.confirm({
    title: 'Se déconnecter ?',
    body: "Vous devrez saisir vos identifiants pour revenir sur le registre de l'établissement. Les données déjà enregistrées ne sont pas supprimées.",
    confirmLabel: 'Se déconnecter',
    danger: true,
  });
  if (!accord) return;
  try {
    // `signOut` révoque le jeton côté serveur et efface la session locale (cf. supabase_client).
    await client.signOut();
  } catch {
    // La session locale est effacée même si la révocation réseau échoue : on continue.
  }
  window.location.reload();
}
