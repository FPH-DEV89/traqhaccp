/**
 * src/presentation/router.js — Routeur de modules + repli legacy (spec P5b §1).
 * Arbitre, module par module, entre la vue v4 (`views/<id>.js`) et le repli legacy : les
 * 16 sections `.tab-content` et le script inline v3 restés dans `index.html`
 * (ARCHITECTURE §6 et §8.2). Seul module à manipuler `#view`, le défilement de `#main`,
 * le titre du document et le hash (`#/temperatures`).
 * Enregistrement : un import statique de fichier absent casserait le graphe de modules ;
 * `VIEWS` ne liste que les modules migrés (chemins des 16 autres en commentaire).
 * `MIGRATED` est la source de vérité du mode strict (tools/check-parity.mjs §6).
 * Re-rendu : le routeur remonte le module quand le module actif change ; le
 * rafraîchissement sur changement de données appartient à la vue, et les `data-action`
 * des vues restent traités par les vues (le routeur ne re-dispatch pas).
 */
import { ui } from './ui.js';
import { NAV } from '../domain/constants.js';
import * as DashboardView from './views/dashboard.js'; // module migré (une ligne par module)

/* Modules attendus : './views/checklists.js', './views/temperatures.js', './views/reception.js',
   './views/traceability.js', './views/allergens.js', './views/cleaning.js', './views/oils.js',
   './views/ph.js', './views/cooling.js', './views/documents.js', './views/nonconformities.js',
   './views/audit.js', './views/users.js', './views/account.js', './views/history.js'. */

export const MIGRATED = ['dashboard'];
export const VIEWS = { dashboard: DashboardView };

/**
 * Rendus legacy par module (ARCHITECTURE §8.2), appelés **sans argument** comme en v3
 * (`'sauvegarde'` est la variante export de `'compte'` ; `'settings'` a disparu avec la
 * section `#tab-settings` retirée par la spec P5b).
 */
export const LEGACY_RENDER = {
  dashboard: ['renderDashboard'],
  checklists: ['setChecklistRoutineTab', 'renderChecklists'],
  temperatures: ['renderEquipmentCards'],
  reception: ['renderReceptionsTable'],
  traceability: ['renderPreparationCards'],
  allergens: ['renderAllergenFilterButtons', 'renderAllergensMatrix'],
  cleaning: ['renderCleaningTasks'],
  oil: ['renderFryersList'], cooling: ['renderCoolingCycles'], defrost: ['renderDefrostCycles'],
  'ph-weight': ['renderPhRecords', 'renderWeightRecords'],
  documents: ['renderSanitaryDocs'],
  nonconformities: ['renderNonConformitiesTable'],
  audit: ['renderAuditView'], 'ddpp-inspection': ['renderDdppInspectionView'],
  'settings': [],
};
const SUFFIXE = 'TraqHACCP — Registre sanitaire';
let app = null;
let abonnement = null;
let toucheG = false;
let moduleCourant = null;
let dernierId = null;
let basculeLegacy = null;
function element(id) {
  for (const groupe of NAV) {
    const trouve = groupe.items.find((item) => item.id === id);
    if (trouve) return trouve;
  }
  return null;
}
function idEtat() {
  try { return app && app.store ? app.store.getState().activeTab : null; } catch (erreur) { return null; }
}
/** Contexte des vues : état du store + services de présentation. */
function contexte() {
  const etat = app.store.getState();
  return { ...etat, store: app.store, ui, icon: app.icon, fmt: app.fmt, nav: NAV, router: { switchTab } };
}
const racine = () => document.getElementById('view');
/** Masque le legacy (les sections gardent la classe `hidden` du v3). */
function masquerLegacy() {
  for (const section of document.querySelectorAll('.tab-content')) {
    section.classList.add('hidden');
    section.hidden = true;
  }
}
/**
 * Rendu d'un module non migré : les fonctions de render v3 exposées sont appelées, puis
 * le dispatcher v3 (`window.switchTab`, capturé avant remplacement) rejoue exactement ce
 * que faisait l'onglet legacy — les renderers internes n'étant pas exportés, c'est lui qui
 * garantit un repli fonctionnel. Une fonction absente est ignorée silencieusement (§8.2).
 */
function rendreLegacy(id) {
  for (const nom of LEGACY_RENDER[id] || []) {
    const fn = typeof window !== 'undefined' ? window[nom] : null;
    if (typeof fn !== 'function') continue;
    try { fn(); } catch (erreur) { console.error(`[routeur] rendu legacy « ${nom} » en échec :`, erreur); }
  }
  if (typeof basculeLegacy === 'function') {
    try { basculeLegacy(id); } catch (erreur) { console.error(`[routeur] dispatch legacy « ${id} » en échec :`, erreur); }
  }
}
function moduleIndisponible(id) {
  const noeud = racine();
  if (!noeud) return;
  noeud.hidden = false;
  noeud.innerHTML = ui.empty({
    icon: 'alert', title: 'Module indisponible',
    body: `Aucun écran n'est branché sur « ${id} » pour le moment.`,
    actionLabel: 'Revenir au tableau de bord', onAction: () => switchTab('dashboard'),
  });
}
function demonter() {
  const noeud = racine();
  if (moduleCourant && typeof moduleCourant.unmount === 'function') {
    try { moduleCourant.unmount(noeud); } catch (erreur) { console.error('[routeur] unmount en échec :', erreur); }
  }
  moduleCourant = null;
  if (noeud) noeud.innerHTML = '';
}
/** Monte `id` : vue v4 si migrée, sinon section legacy, sinon état vide. */
function monter(id) {
  const noeud = racine();
  if (!noeud) return;
  const module = VIEWS[id];
  demonter();
  if (module) {
    const ctx = contexte();
    masquerLegacy();
    noeud.hidden = false;
    noeud.innerHTML = module.render(ctx);
    if (typeof module.mount === 'function') module.mount(noeud, ctx);
    moduleCourant = module;
    dernierId = id;
    return;
  }
  const section = document.getElementById(`tab-${id}`);
  if (!section) {
    masquerLegacy();
    moduleIndisponible(id);
    dernierId = id;
    return;
  }
  noeud.hidden = true;
  masquerLegacy();
  section.classList.remove('hidden');
  section.hidden = false;
  rendreLegacy(id);
  dernierId = id;
}
function majHash(id) {
  const cible = `#/${id}`;
  if (typeof location === 'undefined' || location.hash === cible) return;
  try { history.replaceState(null, '', cible); } catch (erreur) { location.hash = cible; }
}
const majTitre = (cible) => { if (cible) document.title = `${cible.title} · ${SUFFIXE}`; };
function idDuHash() {
  if (typeof location === 'undefined') return null;
  const brut = String(location.hash || '').replace(/^#\/?/, '');
  return brut && element(brut) ? brut : null;
}
/** Bascule vers un module ; met à jour le titre, le hash et le défilement. */
export function switchTab(id) {
  const cible = element(id);
  if (!cible) return false;
  const dejaAffiche = id === dernierId;
  app.store.setActiveTab(id);
  if (dejaAffiche) monter(id); // même module : ré-affichage explicite (idempotent)
  majTitre(cible);
  majHash(id);
  const principal = document.getElementById('main');
  if (principal) principal.scrollTop = 0;
  return true;
}
/** Observateur du store : ne remonte que si le module actif change. */
function surChangement() {
  const id = idEtat();
  if (!id || !element(id) || id === dernierId) return;
  monter(id);
  majTitre(element(id));
  majHash(id);
}
/** Raccourcis : Ctrl/⌘ + K (palette) et « g » puis 1-9 (rail). */
function raccourcis(evenement) {
  const cible = evenement.target;
  const saisie = cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable);
  const modificateur = evenement.ctrlKey || evenement.metaKey;
  if (modificateur && String(evenement.key).toLowerCase() === 'k') { evenement.preventDefault(); ui.palette(); return; }
  if (saisie || modificateur || evenement.altKey) return;
  if (String(evenement.key).toLowerCase() === 'g') { toucheG = true; setTimeout(() => { toucheG = false; }, 1200); return; }
  if (!toucheG || !/^[1-9]$/.test(evenement.key)) return;
  toucheG = false;
  const rang = Number(evenement.key);
  const tous = NAV.flatMap((groupe) => groupe.items);
  const vise = tous.find((item) => item.idx === `0${rang}`) || tous[rang - 1];
  if (vise) switchTab(vise.id);
}
/**
 * Re-affirmation après le démarrage : le script inline v3 se termine par `initApp()` sur
 * `DOMContentLoaded` et rouvre sa section ; le routeur reprend la main juste après.
 */
function reprendre() { if (dernierId) monter(dernierId); }
export function initRouter(application) {
  if (app) return; // idempotent : boot() peut être rappelé par les tests
  app = application;
  basculeLegacy = typeof window.switchTab === 'function' ? window.switchTab : null;
  window.switchTab = switchTab;
  window.addEventListener('keydown', raccourcis);
  window.addEventListener('load', reprendre, { once: true });
  abonnement = app.store.subscribe(surChangement);
  const depart = idDuHash() || (element(idEtat()) ? idEtat() : 'dashboard');
  if (idEtat() !== depart) app.store.setActiveTab(depart);
  monter(depart);
  majTitre(element(depart));
}

/** Désabonnements (tests, rechargement à chaud) ; id courant pour les outils de parité. */
export function destroy() {
  if (abonnement) abonnement();
  abonnement = null;
  window.removeEventListener('keydown', raccourcis);
  app = null;
  dernierId = null;
}

export function getCurrentId() { return dernierId; }
