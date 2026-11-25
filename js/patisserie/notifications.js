/**
 * js/patisserie/notifications.js — Alertes de service (TraqHACCP Pâtisserie)
 *
 * Rend exécutables les réglages de l'onglet « Alertes » : jusqu'ici ils étaient
 * enregistrés mais aucun code ne les lisait, donc rien n'était jamais signalé.
 *
 * Portée honnête du dispositif :
 *   - les alertes partent tant que l'application tourne (onglet ouvert, y compris
 *     en arrière-plan ou écran verrouillé) : c'est l'usage réel en boutique, où
 *     l'app reste ouverte sur la tablette ou le téléphone du service ;
 *   - application totalement fermée : ce n'est PAS couvert ici. Cela réclame un
 *     service de push côté serveur (abonnement pushManager + clés VAPID + un
 *     émetteur qui connaît le registre), donc un chantier serveur distinct.
 *
 * Ce que le module respecte :
 *   - l'interrupteur maître « Alertes de service » (alertsEnabled) ;
 *   - l'horizon d'alerte DLC (alertHorizonDays, 1 à 7 jours) ;
 *   - les heures calmes (quietEnabled, quietFrom → quietTo, plage qui peut
 *     chevaucher minuit) : rien ne part la nuit ;
 *   - une seule notification par alerte et par jour (anti-spam), avec un
 *     regroupement au-delà de trois alertes ;
 *   - l'autorisation du navigateur : sans elle, le module se tait.
 *
 * Les alertes découlent de l'état réel du registre (lots, DLC secondaires,
 * échantillons témoins) : aucune donnée inventée, aucun seuil réglementaire
 * en dur ici — les seuils vivent dans src/domain/haccp_norms.js.
 */

import { state } from './state.js';
import { showToast } from './audio-toast.js';
import { STORAGE_KEYS } from '../../src/domain/constants.js';

/** Clé des alertes déjà signalées, pour ne pas répéter la même alerte le même jour. */
const CLE_ALERTES_VUES = 'traq_alertes_vues';

/** Valeurs de repli, identiques à celles de l'onglet Alertes (settings-data.js). */
const DEFAUTS = {
  alertsEnabled: true,
  alertsOnOpen: true,
  alertHorizonDays: 2,
  quietEnabled: false,
  quietFrom: 21,
  quietTo: 7,
};

/** Cadence de vérification pendant que l'application tourne. */
const CADENCE_MS = 5 * 60 * 1000;

/** Au-delà de ce nombre d'alertes simultanées, une seule notification les regroupe. */
const MAX_NOTIFS = 3;

/* ═══════════════════════════════════════════════════════════════════
   Lecture des réglages et du calendrier
   ═══════════════════════════════════════════════════════════════════ */

function lireReglages() {
  let enregistres = null;
  try {
    const brut = localStorage.getItem(STORAGE_KEYS.settings);
    enregistres = brut ? JSON.parse(brut) : null;
  } catch (error) {
    console.warn('[Alertes] réglages illisibles :', error && error.message);
  }
  const source = enregistres && typeof enregistres === 'object' ? enregistres : {};
  return {
    alertsEnabled: source.alertsEnabled !== false,
    alertsOnOpen: source.alertsOnOpen !== false,
    alertHorizonDays: Number(source.alertHorizonDays) || DEFAUTS.alertHorizonDays,
    quietEnabled: source.quietEnabled === true,
    quietFrom: heureValide(source.quietFrom, DEFAUTS.quietFrom),
    quietTo: heureValide(source.quietTo, DEFAUTS.quietTo),
  };
}

function heureValide(valeur, repli) {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : repli;
}

function deuxChiffres(n) {
  return String(n).padStart(2, '0');
}

/** Clé de jour locale au format AAAA-MM-JJ. */
function jourCle(maintenant) {
  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

/** Jours calendaires restants avant une date AAAA-MM-JJ. Négatif si dépassée. */
function joursRestants(iso, maintenant) {
  if (!iso) return null;
  const morceaux = String(iso).slice(0, 10).match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!morceaux) return null;
  const cible = Date.UTC(Number(morceaux[1]), Number(morceaux[2]) - 1, Number(morceaux[3]));
  const aujourdHui = Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return Math.round((cible - aujourdHui) / 86400000);
}

/** Date lisible en français, sans dépendance externe. */
function dateLisible(iso) {
  const morceaux = String(iso || '').slice(0, 10).match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!morceaux) return String(iso || '');
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${Number(morceaux[3])} ${mois[Number(morceaux[2]) - 1]}`;
}

/** Vrai si l'instant courant tombe dans la plage d'heures calmes. */
export function dansHeuresCalmes(reglages, maintenant = new Date()) {
  if (!reglages || reglages.quietEnabled !== true) return false;
  const debut = heureValide(reglages.quietFrom, DEFAUTS.quietFrom);
  const fin = heureValide(reglages.quietTo, DEFAUTS.quietTo);
  if (debut === fin) return false;
  const heureCourante = maintenant.getHours();
  return debut < fin
    ? heureCourante >= debut && heureCourante < fin
    : heureCourante >= debut || heureCourante < fin;
}

/* ═══════════════════════════════════════════════════════════════════
   Calcul des alertes du jour (état réel du registre)
   ═══════════════════════════════════════════════════════════════════ */

function alerteDate({ id, jours, reference, date, quoi }) {
  if (jours < 0) {
    return {
      id,
      gravite: 'danger',
      titre: `${quoi} dépassée`,
      message: `${reference} : date limite dépassée de ${Math.abs(jours)} jour(s) — à retirer du service.`,
    };
  }
  return {
    id,
    gravite: 'warn',
    titre: jours === 0 ? `${quoi} aujourd'hui` : `${quoi} à J-${jours}`,
    message: `${reference} : à écouler avant le ${dateLisible(date)}.`,
  };
}

/**
 * Alertes déduites de l'état du registre, triées du plus urgent au moins urgent.
 * @param {Date} [maintenant]
 * @returns {Array<{id: string, gravite: 'danger'|'warn', titre: string, message: string}>}
 */
export function alertesDuJour(maintenant = new Date()) {
  const reglages = lireReglages();
  const horizon = reglages.alertHorizonDays;
  const alertes = [];

  (state.lots || []).forEach((lot) => {
    const jours = joursRestants(lot.dlcDate, maintenant);
    if (jours === null || jours > horizon) return;
    alertes.push(alerteDate({
      id: `lot-${lot.lot || lot.id || lot.name}`,
      jours,
      reference: `${lot.name} · lot ${lot.lot || lot.id || 'sans référence'}`,
      date: lot.dlcDate,
      quoi: 'DLC',
    }));
  });

  (state.secondaryDlcs || []).forEach((dlc) => {
    const jours = joursRestants(dlc.expiryDate, maintenant);
    if (jours === null || jours > horizon) return;
    alertes.push(alerteDate({
      id: `dlc-${dlc.id || dlc.name}`,
      jours,
      reference: `${dlc.name} (${dlc.type || 'DLC secondaire'})`,
      date: dlc.expiryDate,
      quoi: 'DLC secondaire',
    }));
  });

  (state.witnessSamples || []).forEach((temoin) => {
    const jours = joursRestants(temoin.expiryDate, maintenant);
    if (jours === null || jours > horizon) return;
    alertes.push(alerteDate({
      id: `temoin-${temoin.id || temoin.dishName}`,
      jours,
      reference: `Échantillon témoin ${temoin.dishName}`,
      date: temoin.expiryDate,
      quoi: 'Conservation témoin',
    }));
  });

  return alertes.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === 'danger' ? -1 : 1));
}

/* ═══════════════════════════════════════════════════════════════════
   Mémoire des alertes déjà signalées
   ═══════════════════════════════════════════════════════════════════ */

function lireVues() {
  try {
    const brut = localStorage.getItem(CLE_ALERTES_VUES);
    const vues = brut ? JSON.parse(brut) : null;
    return vues && typeof vues === 'object' ? vues : {};
  } catch (error) {
    return {};
  }
}

/** N'écrit que les traces du jour : les jours précédents sont oubliés. */
function ecrireVues(jour, vues) {
  const propre = {};
  Object.keys(vues).forEach((cle) => {
    if (cle.indexOf(`${jour}|`) === 0) propre[cle] = true;
  });
  try {
    localStorage.setItem(CLE_ALERTES_VUES, JSON.stringify(propre));
  } catch (error) {
    console.warn('[Alertes] mémoire des alertes non enregistrée :', error && error.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Envoi
   ═══════════════════════════════════════════════════════════════════ */

async function notifier(titre, corps, tag) {
  const options = {
    body: corps,
    tag,
    lang: 'fr',
    icon: './assets/favicon.svg',
    badge: './assets/favicon.svg',
  };
  try {
    if ('serviceWorker' in navigator) {
      const enregistrement = await navigator.serviceWorker.ready;
      if (enregistrement && typeof enregistrement.showNotification === 'function') {
        await enregistrement.showNotification(titre, options);
        return true;
      }
    }
  } catch (error) {
    console.warn('[Alertes] service worker indisponible :', error && error.message);
  }
  try {
    new Notification(titre, options);
    return true;
  } catch (error) {
    console.warn('[Alertes] notification refusée :', error && error.message);
    return false;
  }
}

/**
 * Vérifie les alertes et notifie celles qui ne l'ont pas encore été aujourd'hui.
 * @param {Date} [maintenant] instant de référence (injectable pour les tests)
 * @returns {Promise<{motif: string, envoyees: number, total?: number}>}
 */
export async function verifierAlertes(maintenant = new Date()) {
  const reglages = lireReglages();
  if (reglages.alertsEnabled !== true) return { motif: 'desactivees', envoyees: 0 };
  if (typeof Notification === 'undefined') return { motif: 'api-absente', envoyees: 0 };
  if (Notification.permission !== 'granted') return { motif: 'non-autorisees', envoyees: 0 };
  if (dansHeuresCalmes(reglages, maintenant)) return { motif: 'heures-calmes', envoyees: 0 };

  const alertes = alertesDuJour(maintenant);
  if (!alertes.length) return { motif: 'aucune', envoyees: 0, total: 0 };

  const jour = jourCle(maintenant);
  const vues = lireVues();
  const nouvelles = alertes.filter((alerte) => vues[`${jour}|${alerte.id}`] !== true);
  if (!nouvelles.length) return { motif: 'deja-signalees', envoyees: 0, total: alertes.length };

  if (nouvelles.length > MAX_NOTIFS) {
    const urgentes = nouvelles.filter((alerte) => alerte.gravite === 'danger').length;
    const corps = urgentes
      ? `${nouvelles.length} alertes de service, dont ${urgentes} urgente(s). Ouvrez l'application pour les traiter.`
      : `${nouvelles.length} alertes de service. Ouvrez l'application pour les traiter.`;
    await notifier(`${nouvelles.length} alertes de service`, corps, 'traq-alertes');
  } else {
    for (const alerte of nouvelles) {
      await notifier(alerte.titre, alerte.message, `traq-${alerte.id}`);
    }
  }

  nouvelles.forEach((alerte) => { vues[`${jour}|${alerte.id}`] = true; });
  ecrireVues(jour, vues);
  return { motif: 'envoyees', envoyees: nouvelles.length, total: alertes.length };
}

/** Résumé à l'ouverture du service : une fois par jour, sans notification système. */
function resumeOuverture() {
  const alertes = alertesDuJour();
  if (!alertes.length) return;
  const jour = jourCle(new Date());
  const vues = lireVues();
  if (vues[`${jour}|resume`] === true) return;
  vues[`${jour}|resume`] = true;
  ecrireVues(jour, vues);

  const urgentes = alertes.filter((alerte) => alerte.gravite === 'danger').length;
  const libelle = `${alertes.length} alerte${alertes.length > 1 ? 's' : ''} de service`;
  showToast(urgentes ? `${libelle} dont ${urgentes} urgente${urgentes > 1 ? 's' : ''}` : libelle);
}

/**
 * Branche les alertes : résumé à l'ouverture, vérification immédiate, puis
 * toutes les cinq minutes et à chaque retour au premier plan.
 * Sans effet si le registre n'est pas chargé (portail de connexion affiché).
 */
export function demarrerAlertes() {
  if (!state || !Array.isArray(state.lots) || !state.lots.length) return false;
  const reglages = lireReglages();
  if (reglages.alertsOnOpen !== false) resumeOuverture();
  verifierAlertes();
  window.setInterval(() => { verifierAlertes(); }, CADENCE_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verifierAlertes();
  });
  return true;
}

// Point d'entrée pour la vérification navigateur et les diagnostics.
window.verifierAlertes = verifierAlertes;
