/**
 * TraqHACCP — Couche présentation — Racine de composition (docs/ARCHITECTURE.md §8.1).
 *
 * Spec P5a §3. Construit `app` dans l'ordre imposé :
 *   LocalStorageHACCPRepository → AudioService → HACCPUseCases → AccountUseCases
 *   → SettingsUseCases → HACCPStore → app.
 *
 * Aucun effet de bord DOM à l'import : la construction est purement objet. Le câblage
 * de l'interface appartient à `boot()` (shell puis routeur, dans cet ordre).
 *
 * Mode serveur (opt-in) : quand `estModeServeur()` est vrai (`?mode=serveur`, ou surcharge
 * persistée), `boot()` vérifie la session GoTrue, affiche la porte `afficherConnexion()` si
 * elle manque ou a expiré, hydrate le dépôt Supabase, PUIS reconstruit `app` via
 * `Object.assign(app, createApp(depot))` — l'identité de `app` est conservée car des modules
 * l'importent. `app.ready` reste faux tant que l'hydratation n'est pas terminée : les vues ne
 * lisent jamais un cache vide. Une panne réseau ou un refus de l'utilisateur ramène au mode
 * local sans jamais laisser l'écran vide.
 *
 * Plusieurs modules de cette vague sont produits par des specs parallèles
 * (`account_usecases`, `settings_usecases`, `shell`, `router`, `export_service`) :
 * ils sont chargés par `import()` dynamique tolérant, comme le prescrit la spec P4 §3
 * pour `export_service.js`. Un module encore absent dégrade l'application sans casser
 * le graphe de modules ni empêcher la construction de `app`.
 */
import { NAV } from '../domain/constants.js';
import { HACCPUseCases } from '../application/usecases.js';
import { LocalStorageHACCPRepository } from '../infrastructure/storage_repository.js';
import { AudioService } from '../infrastructure/audio_service.js';
import { appliquerSurchargeModeUrl, estModeServeur } from '../infrastructure/config.js';
import { ui } from './ui.js';
import { icon } from './icons.js';
import { HACCPStore } from './store.js';

const FIN = '\u202f'; // espace fine insécable : « 63 °C », « 12 % »
const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const JOUR = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const VIDE = '—';

const enDate = (iso) => {
  if (iso === null || iso === undefined || iso === '') return null;
  if (iso instanceof Date) return iso;
  const court = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return court ? new Date(Number(court[1]), Number(court[2]) - 1, Number(court[3])) : new Date(iso);
};

/** Formats français (virgule décimale, espace insécable avant °C et %, en dash pour les plages). */
export const fmt = {
  temp: (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? VIDE : `${NOMBRE.format(Number(v))}${FIN}°C`),
  pct: (v) => (Number.isFinite(Number(v)) ? `${NOMBRE.format(Number(v))}${FIN}%` : VIDE),
  quantity: (v, unite) => (Number.isFinite(Number(v)) ? `${NOMBRE.format(Number(v))}${unite ? `${FIN}${unite}` : ''}` : VIDE),
  signed: (v) => (Number.isFinite(Number(v)) ? `${Number(v) > 0 ? '+' : ''}${NOMBRE.format(Number(v))}` : VIDE),
  date: (iso) => { const d = enDate(iso); return d && !Number.isNaN(d.getTime()) ? JOUR.format(d) : VIDE; },
  time: (iso) => { const d = enDate(iso); return d && !Number.isNaN(d.getTime()) ? HEURE.format(d) : VIDE; },
  dt: (iso) => `${fmt.date(iso)} ${fmt.time(iso)}`,
  relative: (iso) => {
    const d = enDate(iso);
    if (!d || Number.isNaN(d.getTime())) return VIDE;
    const minutes = Math.round((Date.now() - d.getTime()) / 60000);
    if (Math.abs(minutes) < 1) return "à l'instant";
    if (Math.abs(minutes) < 60) return minutes > 0 ? `il y a ${minutes} min` : `dans ${-minutes} min`;
    const heures = Math.round(minutes / 60);
    if (Math.abs(heures) < 24) return heures > 0 ? `il y a ${heures} h` : `dans ${-heures} h`;
    const jours = Math.round(heures / 24);
    if (jours === 1) return 'hier';
    return jours > 0 ? `il y a ${jours} jours` : `dans ${-jours} jours`;
  },
};

/** Import tolérant d'un module produit par une spec parallèle. */
async function charger(chemin) {
  try {
    return await import(chemin);
  } catch (erreur) {
    console.warn(`[context] module indisponible (spec parallèle en cours) : ${chemin} — ${erreur.message}`);
    return null;
  }
}

const modAccount = await charger('../application/account_usecases.js');
const modSettings = await charger('../application/settings_usecases.js');

/** Passerelle paresseuse vers `src/infrastructure/export_service.js` (spec P4b). */
function creerPasserelle() {
  const module = { valeur: null };
  const chargerExport = async () => {
    if (!module.valeur) {
      const charge = await charger('../infrastructure/export_service.js');
      if (!charge) throw new Error("Service d'exportation indisponible.");
      module.valeur = charge;
    }
    return module.valeur;
  };
  const passerelle = { load: chargerExport };
  for (const nom of ['buildFullBackup', 'parseBackup', 'exportRecordsCsv', 'printDocument', 'registerHtml', 'labelHtml']) {
    passerelle[nom] = async (...args) => (await chargerExport())[nom](...args);
  }
  return passerelle;
}

/**
 * Construit l'objet unique `app` (contrat figé ARCHITECTURE §8.1).
 * @param {object|null} depot Dépôt injecté (mode serveur déjà hydraté) ; par défaut, le
 *   dépôt historique en localStorage — le mode local ne change donc d'aucune manière.
 */
export function createApp(depot = null) {
  const repository = depot || new LocalStorageHACCPRepository();
  const audio = new AudioService();
  const useCases = new HACCPUseCases(repository);
  const account = modAccount && modAccount.AccountUseCases ? new modAccount.AccountUseCases(repository) : null;
  const settings = modSettings && modSettings.SettingsUseCases ? new modSettings.SettingsUseCases(repository) : null;
  const store = new HACCPStore(repository, useCases, account, settings);
  return { repository, audio, useCases, account, settings, store, ui, icon, fmt, exports: creerPasserelle(), nav: NAV, ready: false };
}

export const app = createApp();

/** Signale une erreur serveur à l'utilisateur, sans jamais interrompre le démarrage. */
function signaler(erreur, statut = 'danger') {
  const message = erreur && typeof erreur.message === 'string' && erreur.message.trim()
    ? erreur.message.trim()
    : 'Erreur de communication avec le serveur.';
  if (ui && typeof ui.toast === 'function') ui.toast({ status: statut, message });
}

/**
 * Instancie le dépôt Supabase (import dynamique tolérant). Renvoie null si le module est
 * indisponible ou mal configuré : l'application retombe alors sur le mode local.
 */
async function preparerDepotServeur() {
  const mod = await charger('../infrastructure/supabase_repository.js');
  if (!mod || typeof mod.SupabaseHACCPRepository !== 'function') {
    signaler("Module serveur indisponible : démarrage avec les données locales.", 'warn');
    return null;
  }
  try {
    return new mod.SupabaseHACCPRepository({ onErreur: (erreur) => signaler(erreur) });
  } catch (erreur) {
    signaler(erreur);
    return null;
  }
}

/**
 * Obtient une session serveur utilisable et un dépôt hydraté.
 * Renvoie true si `depot` est prêt (hydraté), false si l'utilisateur ou le réseau nous
 * ramènent au mode local. Ne rend jamais la main en laissant un écran vide.
 */
async function ouvrirSessionServeur(depot, modConnexion) {
  for (let tentative = 0; tentative < 2; tentative += 1) {
    if (depot.client && depot.client.hasSession()) {
      const session = await depot.client.verifierSession().catch(() => null);
      if (session) {
        try {
          await depot.hydrate();
          return true;
        } catch (erreur) {
          signaler(erreur); // session valide mais données inaccessibles : la porte reprend la main
        }
      }
    }
    const reponse = await modConnexion.afficherConnexion({
      client: depot.client,
      repository: depot,
      onErreur: (erreur) => signaler(erreur),
    });
    if (!reponse || !reponse.ok) return false;
  }
  signaler('Serveur toujours injoignable : démarrage avec les données locales.', 'warn');
  return false;
}

/**
 * Séquence de démarrage : dépôt (serveur si demandé et possible) → shell → routeur → `app.ready`.
 * Idempotent. En mode local, aucune requête réseau n'est émise et rien n'est attendu.
 */
export async function boot() {
  if (app.ready) return app;
  appliquerSurchargeModeUrl(); // ?mode=serveur / ?mode=local devient persistant, avant toute lecture
  let depot = null;
  if (estModeServeur()) {
    depot = await preparerDepotServeur();
    if (depot) {
      const modConnexion = await charger('./connexion.js');
      const pret = modConnexion && typeof modConnexion.afficherConnexion === 'function'
        ? await ouvrirSessionServeur(depot, modConnexion)
        : false;
      if (!pret) depot = null; // retour au mode local : le dépôt serveur n'est jamais injecté à moitié
    }
  }
  if (depot) Object.assign(app, createApp(depot)); // identité de `app` conservée
  const modShell = await charger('./shell.js');
  const modRouter = await charger('./router.js');
  if (modShell && typeof modShell.initShell === 'function') modShell.initShell(app);
  if (modRouter && typeof modRouter.initRouter === 'function') modRouter.initRouter(app);
  app.ready = true;
  if (app.store && typeof app.store.setReady === 'function') app.store.setReady(true);
  return app;
}

export default app;
