/**
 * src/presentation/shell.js — Coquille de l'application (spec P5b §2).
 *
 * Injecte une seule fois : le rail de navigation (`#rail`, absent ≤ 900 px), la barre
 * supérieure (`#topbar` : fil d'Ariane, horloge, chip opérateur, recherche, réglages,
 * verrou d'inspection) et la barre mobile (`#tabbar`, visible ≤ 900 px). Le bandeau
 * d'alerte passe par `ui.banner` (aucun conteneur maison).
 *
 * Aucun import du routeur (pas de cycle) : les navigations passent par `switchTab`,
 * exposé sur `globalThis` par router.js. Les actions de la coquille sont déléguées
 * (`data-action`) sur ses trois hôtes ; celles des vues restent aux vues.
 */
import { ui } from './ui.js';
import { icon } from './icons.js';
import { NAV, APP_VERSION, DEFAULT_ESTABLISHMENT } from '../domain/constants.js';

const BARRE_MOBILE = ['dashboard', 'temperatures', 'cleaning', 'traceability', 'compte'];
const LIBELLES_COURTS = { dashboard: 'Accueil', temperatures: 'Relevés', cleaning: 'Nettoyage', traceability: 'DLC', checklists: 'Routine', nonconformities: 'Alertes', compte: 'Compte' };
const ROLE_LABELS = { gerant: 'Gérante', patron: 'Direction', second: 'Second de cuisine', chef: 'Chef de cuisine', cuisine: 'Cuisine', patisserie: 'Pâtisserie', plonge: 'Plonge', salle: 'Salle', serveur: 'Service', polyvalent: 'Polyvalent' };
const NC_FERMEES = ['Résolu', 'Résolue', 'Clôturée', 'Traité', 'Traitée', 'Annulée'];
const DELAI_PIN = 400;

let app = null;
let abonnement = null;
let cadence = null;
let hoteRail = null;
let hoteTopbar = null;
let hoteTabbar = null;
let cleBandeau = null;

/* ── Helpers locaux ──────────────────────────────────────────────────────── */

function esc(valeur) {
  return String(valeur === null || valeur === undefined ? '' : valeur)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initiales(operateur) {
  if (!operateur) return '—';
  if (operateur.initials) return String(operateur.initials).toUpperCase();
  const mots = String(operateur.name || `${operateur.firstName || ''} ${operateur.lastName || ''}`).split(/\s+/).filter(Boolean);
  return (mots.slice(0, 2).map((mot) => mot[0]).join('') || '—').toUpperCase();
}

function nomComplet(operateur) {
  if (!operateur) return 'Aucun opérateur';
  return operateur.name || `${operateur.firstName || ''} ${operateur.lastName || ''}`.trim() || 'Opérateur';
}

function libelleRole(operateur) {
  if (!operateur || !operateur.role) return '';
  const brute = String(operateur.role);
  return ROLE_LABELS[brute] || brute.charAt(0).toUpperCase() + brute.slice(1);
}

function etablissement() {
  const etat = app.store.getState();
  const etab = (etat.establishment && etat.establishment.name) ? etat.establishment : DEFAULT_ESTABLISHMENT;
  return { nom: etab.name || DEFAULT_ESTABLISHMENT.name, ville: etab.city || DEFAULT_ESTABLISHMENT.city };
}

function horodatage(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur.getTime();
  const texte = String(valeur).trim();
  const heure = texte.match(/^(\d{1,2}):(\d{2})/);
  if (heure) {
    const d = new Date();
    d.setHours(Number(heure[1]), Number(heure[2]), 0, 0);
    return d.getTime();
  }
  const ms = Date.parse(texte);
  return Number.isNaN(ms) ? null : ms;
}

function dateFr(valeur) {
  if (!valeur) return null;
  const parties = String(valeur).split('/');
  if (parties.length === 3) return new Date(Number(parties[2]), Number(parties[1]) - 1, Number(parties[0]), 12, 0, 0).getTime();
  return horodatage(valeur);
}

function debutDeJour() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function itemNav(id) {
  for (const groupe of NAV) {
    const trouve = groupe.items.find((item) => item.id === id);
    if (trouve) return { ...trouve, groupe: groupe.group };
  }
  return null;
}

/** Navigation : le routeur est la seule autorité sur le module affiché. */
function naviguer(id) {
  if (typeof globalThis.switchTab === 'function') globalThis.switchTab(id);
  else ui.toast({ status: 'warn', message: 'Le routeur n\'est pas encore amorcé.' });
}

/* ── Compteurs du rail ───────────────────────────────────────────────────── */

function ouvert(nc) {
  return !NC_FERMEES.includes(String((nc && nc.status) || ''));
}

/** Nombre d'éléments à traiter, par module ; absent du rail quand il vaut 0. */
function compteurs() {
  const total = {};
  const depot = app.repository;
  try {
    const equipements = app.store.getEquipments() || [];
    total.temperatures = equipements.filter((equipement) => {
      const entree = (equipement.history || [])[0];
      const ms = entree ? horodatage(entree.timestamp || entree.heure || entree.time) : null;
      return ms === null || ms < debutDeJour();
    }).length;
  } catch (erreur) { total.temperatures = 0; }
  try {
    total.cleaning = (depot.getCleaningTasks() || []).filter((tache) => tache.status !== 'done').length;
  } catch (erreur) { total.cleaning = 0; }
  try {
    total.nonconformities = (depot.getNonConformities() || []).filter(ouvert).length;
  } catch (erreur) { total.nonconformities = 0; }
  try {
    const lundi = Date.now() + 48 * 3600000;
    total.traceability = (depot.getPreparations() || []).filter((preparation) => {
      const ms = dateFr(preparation.dlcDate);
      return ms !== null && ms < lundi;
    }).length;
  } catch (erreur) { total.traceability = 0; }
  try {
    const checklists = depot.getChecklists() || {};
    total.checklists = [checklists.ouverture, checklists.fermeture]
      .filter(Boolean)
      .filter((routine) => (typeof routine.isComplete === 'function' ? !routine.isComplete() : false)).length;
  } catch (erreur) { total.checklists = 0; }
  return total;
}

function nbNonConformitesCritiques() {
  try {
    return (app.repository.getNonConformities() || [])
      .filter(ouvert)
      .filter((nc) => String(nc.severity) === 'Critique').length;
  } catch (erreur) { return 0; }
}

/* ── Marquage du rail et de la barre mobile ──────────────────────────────── */

function ligneNav(item, compte) {
  const actif = app.store.getState().activeTab === item.id;
  return `<button class="nav-item${actif ? ' is-active' : ''}" type="button" data-action="module" data-module="${esc(item.id)}"
      title="${esc(item.desc || item.title)}"${actif ? ' aria-current="page"' : ''}>
    <span class="nav-item__idx num">${esc(item.idx)}</span>
    <span class="nav-item__icon">${icon(item.icon, 18)}</span>
    <span class="nav-item__label">${esc(item.title)}</span>
    ${compte > 0 ? `<span class="nav-item__count num">${compte}</span>` : ''}
  </button>`;
}

function rendreRail() {
  const etab = etablissement();
  const total = compteurs();
  hoteRail.innerHTML = `
    <div class="rail__brand">
      <img src="assets/favicon.svg" alt="" width="28" height="28">
      <span class="rail__title">TraqHACCP</span>
    </div>
    <p class="rail__meta">${esc(etab.nom)}${etab.ville ? ` · ${esc(etab.ville)}` : ''}</p>
    ${NAV.map((groupe) => `<div class="rail__group">
      <p class="rail__group-label">${esc(groupe.group)}</p>
      ${groupe.items.map((item) => ligneNav(item, total[item.id])).join('')}
    </div>`).join('')}
    <div class="rail__group">
      <p class="rail__meta">Version ${esc(APP_VERSION)}<br><span data-role="dernier">dernier enregistrement —</span></p>
      <div class="row row--sm row--tight">
        <button class="icon-btn" type="button" data-action="palette" aria-label="Rechercher un module (Ctrl+K)">${icon('search', 18)}</button>
        <button class="icon-btn" type="button" data-action="reglages" aria-label="Réglages et compte">${icon('settings', 18)}</button>
      </div>
    </div>`;
}

function rendreTopbar() {
  hoteTopbar.innerHTML = `
    <div class="topbar__left">
      <span class="topbar__id" data-role="fil">Registre / Tableau de bord</span>
    </div>
    <div class="topbar__right">
      <span class="topbar__clock" data-role="horloge">--:--</span>
      <button class="op-chip" type="button" data-action="operateurs" aria-haspopup="dialog" aria-expanded="false" aria-label="Changer d'utilisateur">
        <div class="op-chip__initials" data-role="initiales">—</div>
        <div>
          <div class="op-chip__name" data-role="nom">—</div>
          <div class="op-chip__role" data-role="role">—</div>
        </div>
      </button>
      <button class="icon-btn" type="button" data-action="palette" aria-label="Rechercher un module (Ctrl+K)">${icon('search', 18)}</button>
      <button class="icon-btn" type="button" data-action="reglages" aria-label="Réglages et compte">${icon('settings', 18)}</button>
      <button class="icon-btn" type="button" data-action="verrou" aria-label="Mode inspection" aria-pressed="false">${icon('lock', 18)}</button>
    </div>`;
}

function ligneTabbar(id, actif) {
  const item = itemNav(id);
  if (!item) return '';
  return `<button class="tabbar__item${actif ? ' is-active' : ''}" type="button" data-action="module" data-module="${esc(id)}"
      aria-label="${esc(item.title)}"${actif ? ' aria-current="page"' : ''}>${icon(item.icon, 22)}<span class="tabbar__label">${esc(LIBELLES_COURTS[id] || item.title)}</span></button>`;
}

function rendreTabbar() {
  const actif = app.store.getState().activeTab;
  hoteTabbar.innerHTML = `${BARRE_MOBILE.map((id) => ligneTabbar(id, id === actif)).join('')}
    <button class="tabbar__more" type="button" data-action="plus" aria-label="Tous les modules">${icon('chevron-down', 22)}<span class="tabbar__label">Plus</span></button>`;
}

/* ── Horloge ─────────────────────────────────────────────────────────────── */

function majHorloge() {
  const noeud = hoteTopbar && hoteTopbar.querySelector('[data-role="horloge"]');
  if (!noeud) return;
  noeud.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ── Bandeau d'alerte ────────────────────────────────────────────────────── */

function bandeau(etat) {
  const critiques = nbNonConformitesCritiques();
  let message = null;
  let action = null;
  if (etat.locked) {
    message = 'Mode inspection — consultation en lecture seule.';
  } else if (critiques > 0) {
    message = `${critiques} non-conformité(s) critique(s) ouverte(s) — action corrective attendue.`;
    action = { actionLabel: 'Voir', onAction: () => naviguer('nonconformities') };
  }
  const cle = message || '';
  if (cle === cleBandeau) return;
  cleBandeau = cle;
  ui.banner(message ? { status: 'warn', message, ...(action || {}) } : null);
}

/* ── État appliqué à la coquille ─────────────────────────────────────────── */

function tacher(hote, actif) {
  for (const bouton of hote.querySelectorAll('[data-module]')) {
    const est = bouton.getAttribute('data-module') === actif;
    bouton.classList.toggle('is-active', est);
    if (est) bouton.setAttribute('aria-current', 'page');
    else bouton.removeAttribute('aria-current');
  }
}

function appliquer(etat) {
  const actif = etat.activeTab;
  tacher(hoteRail, actif);
  tacher(hoteTabbar, actif);
  const item = itemNav(actif);
  const fil = hoteTopbar.querySelector('[data-role="fil"]');
  if (fil && item) fil.textContent = `${item.groupe} / ${item.title}`;

  const operateur = app.store.getCurrentOperator();
  const initialesNoeud = hoteTopbar.querySelector('[data-role="initiales"]');
  const nomNoeud = hoteTopbar.querySelector('[data-role="nom"]');
  const roleNoeud = hoteTopbar.querySelector('[data-role="role"]');
  if (initialesNoeud) initialesNoeud.textContent = initiales(operateur);
  if (nomNoeud) nomNoeud.textContent = nomComplet(operateur);
  if (roleNoeud) roleNoeud.textContent = libelleRole(operateur) || 'Non identifié';

  const verrou = hoteTopbar.querySelector('[data-action="verrou"]');
  if (verrou) {
    verrou.setAttribute('aria-pressed', String(Boolean(etat.locked)));
    verrou.replaceChildren();
    verrou.insertAdjacentHTML('beforeend', icon(etat.locked ? 'unlock' : 'lock', 18));
    verrou.setAttribute('aria-label', etat.locked ? 'Quitter le mode inspection' : 'Passer en mode inspection');
  }

  const dernier = hoteRail.querySelector('[data-role="dernier"]');
  if (dernier) {
    const journal = app.store.getActivityLog() || [];
    const entree = journal[0];
    dernier.textContent = entree && entree.at
      ? `dernier enregistrement ${new Date(entree.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : 'dernier enregistrement —';
  }
  bandeau(etat);
}

/* ── Menu opérateur (feuille latérale : aucune pastille ronde) ───────────── */

function signalerPinInvalide(el, message) {
  const zone = el.querySelector('[data-role="pin"]') || el;
  let erreur = zone.querySelector('.field__error');
  if (!erreur) {
    erreur = document.createElement('p');
    erreur.className = 'field__error';
    zone.appendChild(erreur);
  }
  erreur.textContent = message;
  for (const cellule of el.querySelectorAll('.pin__cell')) cellule.setAttribute('aria-invalid', 'true');
  el.classList.add('is-danger');
  setTimeout(() => el.classList.remove('is-danger'), DELAI_PIN);
}

function cablerPin(el, operateur) {
  const zone = el.querySelector('[data-role="pin"]');
  if (!zone || zone.dataset.cable === '1') return;
  zone.dataset.cable = '1';
  zone.innerHTML = `<p class="field__label">Code à 4 chiffres de ${esc(nomComplet(operateur))}</p>
    <div class="pin">${[0, 1, 2, 3].map((rang) => `<input class="pin__cell" type="password" inputmode="numeric" autocomplete="off" maxlength="1" aria-label="Chiffre ${rang + 1}">`).join('')}</div>`;
  const cellules = [...zone.querySelectorAll('.pin__cell')];
  const verifier = () => {
    if (cellules.some((cellule) => !cellule.value)) return;
    const resultat = app.account.setCurrentOperator(operateur.id, { pin: cellules.map((c) => c.value).join('') });
    if (resultat && resultat.ok) {
      cleBandeau = null;
      ui.closeOverlay('shell-operateurs');
      ui.toast({ status: 'ok', message: `${nomComplet(operateur)} est identifié.` });
      return;
    }
    cellules.forEach((cellule) => { cellule.value = ''; });
    cellules[0].focus();
    signalerPinInvalide(el, (resultat && resultat.errors && resultat.errors.pin) || 'Code PIN incorrect.');
  };
  cellules.forEach((cellule, rang) => {
    cellule.addEventListener('input', () => {
      if (cellule.value && cellules[rang + 1]) cellules[rang + 1].focus();
      verifier();
    });
  });
  if (cellules[0]) cellules[0].focus();
}

function choisirOperateur(el, operateur) {
  if (operateur.pin) {
    cablerPin(el, operateur);
    return;
  }
  const resultat = app.account.setCurrentOperator(operateur.id);
  if (resultat && resultat.ok) {
    cleBandeau = null;
    ui.closeOverlay('shell-operateurs');
    ui.toast({ status: 'ok', message: `${nomComplet(operateur)} est identifié.` });
    return;
  }
  const message = (resultat && resultat.errors && resultat.errors.id) || 'Identification refusée.';
  ui.toast({ status: 'danger', message });
}

function menuOperateurs() {
  const actifs = app.store.getActiveOperators() || [];
  const courant = app.store.getCurrentOperator();
  if (!actifs.length) {
    ui.panel({
      id: 'shell-operateurs',
      title: 'Utilisateur',
      body: ui.empty({ icon: 'users', title: 'Aucun opérateur actif', body: 'Ajoutez un membre de la brigade dans le module Compte.' }),
      actions: [{ label: 'Ouvrir le compte', onClick: () => naviguer('compte') }],
    });
    return;
  }
  const lignes = actifs.map((operateur) => `<button class="nav-item${courant && courant.id === operateur.id ? ' is-active' : ''}" type="button" data-op="${esc(operateur.id)}">
      <span class="nav-item__idx num">${esc(initiales(operateur))}</span>
      <span class="nav-item__icon">${icon('users', 18)}</span>
      <span class="nav-item__label">${esc(nomComplet(operateur))}</span>
      <span class="nav-item__count num">${esc(libelleRole(operateur))}</span>
    </button>`).join('');
  const actions = [{ label: 'Gérer les utilisateurs', kind: 'ghost', onClick: () => naviguer('users') }];
  if (app.store.can('inspection.mode') || app.store.getState().locked) {
    actions.push({
      label: app.store.getState().locked ? 'Quitter le mode inspection' : 'Mode inspection',
      kind: 'ghost',
      onClick: () => basculerVerrou(),
    });
  }
  ui.panel({
    id: 'shell-operateurs',
    title: 'Utilisateur',
    subtitle: courant ? `courant : ${nomComplet(courant)}` : 'aucun identifié',
    body: `<div class="stack stack--sm">${lignes}<div data-role="pin"></div></div>`,
    actions,
    onMount: (el) => {
      el.addEventListener('click', (evenement) => {
        const bouton = evenement.target.closest && evenement.target.closest('[data-op]');
        if (!bouton) return;
        const operateur = actifs.find((candidat) => candidat.id === bouton.getAttribute('data-op'));
        if (operateur) choisirOperateur(el, operateur);
      });
    },
  });
}

/* ── Mode inspection ─────────────────────────────────────────────────────── */

function basculerVerrou() {
  const etat = app.store.getState();
  if (!etat.locked && !app.store.can('inspection.mode')) {
    ui.toast({ status: 'warn', message: 'Le mode inspection est réservé aux comptes habilités.' });
    return;
  }
  app.store.setLocked(!etat.locked);
  cleBandeau = null;
  ui.toast({ status: etat.locked ? 'ok' : 'warn', message: etat.locked ? 'Mode inspection quitté.' : 'Mode inspection activé — écritures verrouillées.' });
}

/* ── Feuille « Plus » (navigation complète, mobile) ──────────────────────── */

function feuillePlus() {
  const actif = app.store.getState().activeTab;
  const total = compteurs();
  const corps = NAV.map((groupe) => `<p class="rail__group-label">${esc(groupe.group)}</p>
    <div class="stack stack--sm">${groupe.items.map((item) => ligneNav(item, total[item.id])).join('')}</div>`).join('');
  ui.panel({
    id: 'shell-plus',
    title: 'Tous les modules',
    subtitle: `${NAV.reduce((somme, groupe) => somme + groupe.items.length, 0)} modules`,
    body: `<div class="stack">${corps}</div>`,
    onMount: (el) => {
      el.addEventListener('click', () => { if (actif) ui.closeOverlay('shell-plus'); });
    },
  });
}

/* ── Délégation des actions de la coquille ───────────────────────────────── */

function deleguer(hote) {
  hote.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest && evenement.target.closest('[data-action]');
    if (!bouton) return;
    const action = bouton.getAttribute('data-action');
    if (action === 'module') naviguer(bouton.getAttribute('data-module'));
    else if (action === 'operateurs') menuOperateurs();
    else if (action === 'verrou') basculerVerrou();
    else if (action === 'palette') ui.palette();
    else if (action === 'reglages') naviguer('compte');
    else if (action === 'plus') feuillePlus();
  });
}

/* ── Amorçage ────────────────────────────────────────────────────────────── */

export function initShell(application) {
  if (app) return; // idempotent
  app = application;
  hoteRail = document.getElementById('rail');
  hoteTopbar = document.getElementById('topbar');
  hoteTabbar = document.getElementById('tabbar');
  if (!hoteRail || !hoteTopbar || !hoteTabbar) {
    console.error('[coquille] hôtes #rail, #topbar et #tabbar introuvables dans index.html');
    return;
  }
  rendreRail();
  rendreTopbar();
  rendreTabbar();
  deleguer(hoteRail);
  deleguer(hoteTopbar);
  deleguer(hoteTabbar);
  appliquer(app.store.getState());
  majHorloge();
  cadence = setInterval(majHorloge, 60000);
  abonnement = app.store.subscribe((etat) => {
    if (!hoteRail || !hoteTabbar) return;
    rendreRail();
    rendreTabbar();
    appliquer(etat);
  });
}

/** Arrête les minuteries et les abonnements (tests, rechargement à chaud). */
export function destroy() {
  if (cadence) clearInterval(cadence);
  cadence = null;
  if (abonnement) abonnement();
  abonnement = null;
  app = null;
  cleBandeau = null;
}
