/**
 * src/presentation/router.js — Routeur de modules (spec P5b §1).
 * Monte, module par module, la vue v4 (`views/<id>.js`) dans `#view`. Les sections
 * `.tab-content` et le script inline v3 ayant été retirés d'`index.html` (migration
 * v3 → v4 terminée), il n'existe plus aucun repli legacy. Seul module à manipuler
 * `#view`, le défilement de `#main`, le titre du document et le hash (`#/temperatures`).
 * Re-rendu : le routeur remonte le module quand le module actif change ; le
 * rafraîchissement sur changement de données appartient à la vue, et les `data-action`
 * des vues restent traités par les vues (le routeur ne re-dispatch pas).
 * `MIGRATED` est la source de vérité du mode strict (tools/check-parity.mjs §6).
 */
import { ui } from './ui.js';
import { NAV } from '../domain/constants.js';
import * as DashboardView from './views/dashboard.js'; // 01
import * as ChecklistsView from './views/checklists.js'; // 02
import * as TemperaturesView from './views/temperatures.js'; // 03
import * as ReceptionView from './views/reception.js'; // 04
import * as TraceabilityView from './views/traceability.js'; // 05
import * as AllergensView from './views/allergens.js'; // 06
import * as CleaningView from './views/cleaning.js'; // 07
import * as OilView from './views/oil.js'; // 08
import * as CoolingView from './views/cooling.js'; // 09
import * as DefrostView from './views/defrost.js'; // 10
import * as PhWeightView from './views/phweight.js'; // 11
import * as DocumentsView from './views/documents.js'; // 12
import * as NonConformitiesView from './views/nonconformities.js'; // 13
import * as AuditView from './views/audit.js'; // 14
import * as InspectionView from './views/inspection.js'; // 15
import * as CompteView from './views/compte.js'; // 16
import * as ReglagesView from './views/reglages.js'; // 17

/** Les 17 modules de la navigation sont migrés en v4. */
export const MIGRATED = ['dashboard', 'checklists', 'temperatures', 'reception', 'traceability',
  'allergens', 'cleaning', 'oil', 'cooling', 'defrost', 'ph-weight', 'documents',
  'nonconformities', 'audit', 'ddpp-inspection', 'compte', 'reglages'];
export const VIEWS = {
  dashboard: DashboardView,
  checklists: ChecklistsView,
  temperatures: TemperaturesView,
  reception: ReceptionView,
  traceability: TraceabilityView,
  allergens: AllergensView,
  cleaning: CleaningView,
  oil: OilView,
  cooling: CoolingView,
  defrost: DefrostView,
  'ph-weight': PhWeightView,
  documents: DocumentsView,
  nonconformities: NonConformitiesView,
  audit: AuditView,
  'ddpp-inspection': InspectionView,
  compte: CompteView,
  reglages: ReglagesView,
};

const SUFFIXE = 'TraqHACCP — Registre sanitaire';
let app = null;
let abonnement = null;
let toucheG = false;
let moduleCourant = null;
let dernierId = null;
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
  return {
    ...etat,
    state: etat,
    store: app.store,
    // Instances métier attendues par les vues (docs/ARCHITECTURE.md §4-§5 et specs/_API-CHEATSHEET.md).
    // `settings` est l'instance SettingsUseCases, pas l'objet de données : les vues appellent
    // getSettings()/updateThresholds()… ; les données restent lisibles via `etat.settings`.
    repository: app.repository,
    useCases: app.useCases,
    account: app.account,
    settings: app.settings,
    settingsUseCases: app.settings,
    settingsData: etat.settings,
    exports: app.exports,
    ui,
    icon: app.icon,
    fmt: app.fmt,
    nav: NAV,
    router: { switchTab },
  };
}
const racine = () => document.getElementById('view');
/** État vide : le module demandé n'a pas de vue branchée (id inconnu, module futur). */
function moduleIndisponible(id) {
  const noeud = racine();
  if (!noeud) return;
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
/** Monte `id` : vue v4 si le module est branché, état vide sinon. */
function monter(id) {
  const noeud = racine();
  if (!noeud) return;
  const module = VIEWS[id];
  demonter();
  if (!module) {
    moduleIndisponible(id);
    dernierId = id;
    return;
  }
  const ctx = contexte();
  noeud.innerHTML = module.render(ctx);
  if (typeof module.mount === 'function') module.mount(noeud, ctx);
  moduleCourant = module;
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
export function initRouter(application) {
  if (app) return; // idempotent : boot() peut être rappelé par les tests
  app = application;
  window.switchTab = switchTab;
  window.addEventListener('keydown', raccourcis);
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
