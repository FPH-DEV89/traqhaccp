/**
 * js/patisserie/settings-data.js — onglets « Alertes » et « Données & sauvegardes »
 * de l'écran Réglages. Greffon du socle js/patisserie/settings.js : contrat
 * { id, label, icon, render(ctx) -> html }, `ctx` remis à chaque rendu (settings,
 * helpers de gabarit, writeSettings, showToast, rerender, switchTab, registerSubmit,
 * registerAction). Ce module n'importe JAMAIS settings.js (cycle d'import interdit).
 *
 *   - « Alertes » : autorisation du navigateur, envoi de test, seuils et heures
 *     calmes des notifications de service.
 *   - « Données & sauvegardes » : archive JSON du registre (export, restauration
 *     vérifiée en deux temps), emprise du stockage local, état du cache hors-ligne.
 *     Promesse du manuel : « exporter régulièrement une sauvegarde JSON depuis Réglages ».
 *
 * Aucune couleur en dur, aucun emoji, aucun dialogue natif : uniquement les composants
 * du design system (.section, .sheet, .kpi, .mark, .callout, .settings__*, .btn, .switch, .select).
 */

import { state, saveState } from './state.js';
import { STORAGE_KEYS, APP_VERSION } from '../../src/domain/constants.js';
import { renderArchivePdf, brancherArchivePdf } from './archive.js';

/* ── Valeurs livrées — jamais persistées telles quelles ─────────────── */

const HORIZONS_DLC = [1, 2, 3, 7];

const ALERT_FALLBACK = {
  alertsEnabled: true, alertsOnOpen: true, alertHorizonDays: 2,
  quietEnabled: false, quietFrom: 21, quietTo: 7,
};

const REMINDER_LABELS = { 1: 'chaque jour', 7: 'chaque semaine', 30: 'chaque mois' };

/** Taille maximale acceptée pour une archive restaurée (au-delà : refus). */
const ARCHIVE_LIMIT_BYTES = 8 * 1024 * 1024;

/** Archive contrôlée, en attente de la seconde confirmation. */
let pendingImport = null;
let pendingImportName = '';

/* ── Lecture tolérante des réglages ───────────────────────────────────
   ═══════════════════════════════════════════════════════════════════ */

function pick(settings, key, fallback) {
  const valeur = settings ? settings[key] : undefined;
  if (valeur === undefined || valeur === null || valeur === '') return fallback;
  return valeur;
}

function flag(settings, key, fallback) {
  return pick(settings, key, fallback) !== false;
}

function hourValue(raw, fallback) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 23) return fallback;
  return n;
}

function hourOptions(selected) {
  let html = '';
  for (let h = 0; h < 24; h += 1) {
    const on = Number(selected) === h ? ' selected' : '';
    html += `<option value="${h}"${on}>${String(h).padStart(2, '0')} h</option>`;
  }
  return html;
}

function frMoment(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const jour = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${jour} à ${heure}`;
}

/* ═══════════════════════════════════════════════════════════════════
   Onglet « Alertes » — état de l'autorisation
   ═══════════════════════════════════════════════════════════════════ */

function notificationState() {
  if (typeof Notification === 'undefined') {
    return { marque: 'mark--neutral', label: 'Indisponible', hint: "Ce navigateur ne fournit pas l'API de notification : les alertes restent visibles dans l'application." };
  }
  const securise = typeof window.isSecureContext === 'undefined' ? true : window.isSecureContext !== false;
  if (!securise) {
    return { marque: 'mark--neutral', label: 'Connexion non sécurisée', hint: "Le navigateur réserve l'autorisation aux pages servies en HTTPS ou sur localhost." };
  }
  if (Notification.permission === 'granted') {
    return { marque: 'mark--ok', label: 'Autorisées', hint: 'Les alertes de service peuvent être affichées sur cet appareil.' };
  }
  if (Notification.permission === 'denied') {
    return { marque: 'mark--danger', label: 'Refusées', hint: "Autorisation bloquée dans les réglages du navigateur : la débloquer à la main, puis recharger la page." };
  }
  return { marque: 'mark--warn', label: 'À autoriser', hint: "Aucune demande n'a encore été envoyée depuis cet appareil." };
}

function demanderAutorisation(ctx) {
  if (typeof Notification === 'undefined') {
    ctx.showToast("Ce navigateur ne gère pas les notifications");
    return;
  }
  if (window.isSecureContext === false) {
    ctx.showToast('Autorisation impossible sur une connexion non sécurisée');
    return;
  }
  try {
    const demande = Notification.requestPermission();
    if (demande && typeof demande.then === 'function') {
      demande.then((reponse) => {
        ctx.showToast(reponse === 'granted' ? 'Notifications autorisées' : 'Notifications non accordées');
        ctx.rerender();
      });
      return;
    }
  } catch (error) {
    ctx.showToast("La demande d'autorisation a échoué");
    return;
  }
  ctx.showToast('Réponse enregistrée par le navigateur');
  ctx.rerender();
}

function envoyerNotificationTest(ctx) {
  if (typeof Notification === 'undefined') {
    ctx.showToast("Ce navigateur ne gère pas les notifications");
    return;
  }
  if (Notification.permission !== 'granted') {
    ctx.showToast("Autorisez d'abord les notifications pour cet appareil");
    return;
  }
  try {
    new Notification('TraqHACCP Pâtisserie', {
      body: "Ceci est une notification de test : rien n'est enregistré dans le registre.",
    });
    ctx.showToast('Notification de test envoyée');
  } catch (error) {
    ctx.showToast("L'envoi de la notification a échoué");
  }
}

function renderAlertes(ctx) {
  const s = ctx.settings;
  const notif = notificationState();
  const horizon = Number(pick(s, 'alertHorizonDays', ALERT_FALLBACK.alertHorizonDays));
  const quietFrom = hourValue(pick(s, 'quietFrom', ALERT_FALLBACK.quietFrom), 21);
  const quietTo = hourValue(pick(s, 'quietTo', ALERT_FALLBACK.quietTo), 7);

  ctx.registerAction('notifs-demander', (c) => demanderAutorisation(c));
  ctx.registerAction('notifs-tester', (c) => envoyerNotificationTest(c));

  ctx.registerSubmit('alertes', (form, c) => {
    const d = new FormData(form);
    const jours = Number(d.get('alertHorizonDays'));
    c.writeSettings({
      alertsEnabled: d.has('alertsEnabled'),
      alertsOnOpen: d.has('alertsOnOpen'),
      quietEnabled: d.has('quietEnabled'),
      alertHorizonDays: HORIZONS_DLC.indexOf(jours) !== -1 ? jours : ALERT_FALLBACK.alertHorizonDays,
      quietFrom: hourValue(d.get('quietFrom'), ALERT_FALLBACK.quietFrom),
      quietTo: hourValue(d.get('quietTo'), ALERT_FALLBACK.quietTo),
    });
    c.showToast('Alertes enregistrées');
    c.rerender();
  });

  return `<div class="section">
    <div class="section__head">
      <span class="section__title">Notifications de service</span>
      <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">Cet appareil</span></span></span>
    </div>
    <p class="settings__lead">Les ruptures de stock, les lots proches de leur date limite et les contrôles du jour peuvent être signalés sur cet appareil. Les alertes s'affichent quand l'application est ouverte ; le registre reste la source de vérité.</p>
    <div class="settings__rows">
      ${ctx.settingRow('Autorisation du navigateur', notif.hint,
        `<span class="mark ${notif.marque}"><span class="mark__label">${ctx.esc(notif.label)}</span></span>
         <button type="button" class="btn btn--ghost" data-settings-action="notifs-demander">Demander</button>`)}
      ${ctx.settingRow('Envoi de test', "Vérifie que l'alerte arrive bien sur l'écran verrouillé.",
        `<button type="button" class="btn btn--ghost" data-settings-action="notifs-tester">Tester</button>`)}
    </div>
    <div class="rule"></div>
    <form class="settings__form" data-settings-form="alertes">
      <div class="settings__rows">
        ${ctx.settingRow('Alertes de service', "Affiche un signal à l'ouverture quand un seuil est dépassé.",
          ctx.switchControl('alertsEnabled', flag(s, 'alertsEnabled', ALERT_FALLBACK.alertsEnabled)))}
        ${ctx.settingRow('Rappel à l\'ouverture', 'Résumé des lots urgents dès le premier écran du service.',
          ctx.switchControl('alertsOnOpen', flag(s, 'alertsOnOpen', ALERT_FALLBACK.alertsOnOpen)))}
        ${ctx.settingRow('Horizon des dates limites', "Un lot entre dans l'alerte ce nombre de jours avant sa DLC.",
          `<select class="select" name="alertHorizonDays">
            <option value="1"${horizon === 1 ? ' selected' : ''}>24 heures</option>
            <option value="2"${horizon === 2 ? ' selected' : ''}>2 jours</option>
            <option value="3"${horizon === 3 ? ' selected' : ''}>3 jours</option>
            <option value="7"${horizon === 7 ? ' selected' : ''}>1 semaine</option>
          </select>`)}
        ${ctx.settingRow('Heures calmes', 'Aucun signal sonore pendant la fermeture : les alertes restent listées.',
          ctx.switchControl('quietEnabled', flag(s, 'quietEnabled', ALERT_FALLBACK.quietEnabled)))}
        ${ctx.settingRow('Plage silencieuse', 'Bornes de la plage pendant laquelle le signal sonore est coupé.',
          `<select class="select" name="quietFrom">${hourOptions(quietFrom)}</select>
           <span class="settings__row-hint">à</span>
           <select class="select" name="quietTo">${hourOptions(quietTo)}</select>`)}
      </div>
      <div class="settings__foot">
        <button type="submit" class="btn btn--primary">Enregistrer les alertes</button>
      </div>
    </form>
    <div class="callout callout--info">
      ${ctx.icon('bell', 16)}
      <span>Le son des relevés et le rythme du rappel de sauvegarde se règlent dans l'onglet Préférences. Les alertes ne modifient jamais une donnée du registre.</span>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Archive du registre — construction, export, restauration
   ═══════════════════════════════════════════════════════════════════ */

function sansCodesPin(membres) {
  return (membres || []).map((m) => {
    const copie = Object.assign({}, m);
    delete copie.pin;
    return copie;
  });
}

function buildArchive() {
  let reglages = {};
  try {
    const brut = localStorage.getItem(STORAGE_KEYS.settings);
    reglages = brut ? JSON.parse(brut) : {};
  } catch (error) {
    reglages = {};
  }
  return {
    meta: {
      application: 'TraqHACCP',
      module: 'patisserie',
      version: APP_VERSION,
      exporte_le: new Date().toISOString(),
      etablissement: state.establishmentName || '',
      etablissement_id: state.establishmentId || 'local',
      codes_pin: 'exclus',
    },
    registre: {
      lots: state.lots || [],
      recipes: state.recipes || [],
      secondaryDlcs: state.secondaryDlcs || [],
      witnessSamples: state.witnessSamples || [],
      salesHistory: state.salesHistory || [],
      teamMembers: sansCodesPin(state.teamMembers),
      currentOperatorId: state.currentOperatorId,
    },
    reglages,
  };
}

function slug(value) {
  return String(value || 'etablissement')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'etablissement';
}

function archiveFileName() {
  const d = new Date();
  const jour = d.toISOString().slice(0, 10);
  const heure = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  return `traqhaccp-${slug(state.establishmentName)}-${jour}-${heure}.json`;
}

function downloadJson(nom, texte) {
  const blob = new Blob([texte], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseArchive(texte) {
  let donnees = null;
  try {
    donnees = JSON.parse(texte);
  } catch (error) {
    return { error: "Le fichier n'est pas du JSON lisible" };
  }
  if (!donnees || typeof donnees !== 'object') {
    return { error: "Le fichier ne contient pas d'objet exploitable" };
  }
  const reg = donnees.registre;
  if (!reg || typeof reg !== 'object') {
    return { error: "Archive non reconnue : la section « registre » est absente" };
  }
  const listes = ['lots', 'recipes', 'secondaryDlcs', 'witnessSamples', 'salesHistory', 'teamMembers'];
  const utiles = listes.filter((cle) => Array.isArray(reg[cle]));
  if (!utiles.length) {
    return { error: "Archive sans liste de registre exploitable" };
  }
  const invalide = listes.find((cle) => reg[cle] !== undefined && !Array.isArray(reg[cle]));
  if (invalide) {
    return { error: `Format inattendu pour la liste « ${invalide} »` };
  }
  return { data: donnees };
}

function applyArchive(donnees) {
  const reg = donnees.registre;
  ['lots', 'recipes', 'secondaryDlcs', 'witnessSamples', 'salesHistory', 'teamMembers']
    .forEach((cle) => {
      if (Array.isArray(reg[cle])) state[cle] = reg[cle];
    });
  const operateur = reg.currentOperatorId;
  if (operateur && (state.teamMembers || []).some((m) => m.id === operateur)) {
    state.currentOperatorId = operateur;
  }
  saveState();
  return {
    lots: (state.lots || []).length,
    ventes: (state.salesHistory || []).length,
  };
}

let champArchive = null;

/** Champ fichier créé à la demande, masqué : sert au choix d'une archive. */
function archiveField() {
  if (champArchive && champArchive.isConnected) return champArchive;
  champArchive = document.createElement('input');
  champArchive.type = 'file';
  champArchive.accept = '.json,application/json';
  champArchive.setAttribute('hidden', '');
  document.body.appendChild(champArchive);
  return champArchive;
}

function chooseArchiveFile(onTexte, onErreur) {
  const champ = archiveField();
  champ.onchange = () => {
    const fichier = champ.files && champ.files[0];
    if (!fichier) return;
    if (fichier.size > ARCHIVE_LIMIT_BYTES) {
      onErreur('Archive trop volumineuse pour être restaurée');
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => onTexte(String(lecteur.result || ''), fichier.name);
    lecteur.onerror = () => onErreur("Le fichier n'a pas pu être lu");
    lecteur.readAsText(fichier);
  };
  champ.value = '';
  champ.click();
}

/* ═══════════════════════════════════════════════════════════════════
   Emprise du stockage local
   ═══════════════════════════════════════════════════════════════════ */

function localFootprint() {
  let octets = 0;
  let cles = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const cle = localStorage.key(i);
      if (!cle || cle.indexOf('traq') !== 0) continue;
      octets += cle.length + String(localStorage.getItem(cle) || '').length;
      cles += 1;
    }
  } catch (error) {
    return null;
  }
  return { octets, cles };
}

function footprintLabel(emprise) {
  if (!emprise) return 'Mesure indisponible';
  const ko = emprise.octets / 1024;
  const taille = ko < 100 ? `${ko.toFixed(1)} Ko` : `${Math.round(ko)} Ko`;
  return `${taille} · ${emprise.cles} entrée(s)`;
}

function backupState(settings) {
  const iso = pick(settings, 'lastBackupAt', '');
  if (!iso) {
    return { marque: 'mark--neutral', label: 'Jamais exporté', hint: "Aucune archive n'a encore été téléchargée depuis cet appareil." };
  }
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(jours)) {
    return { marque: 'mark--neutral', label: 'Date inconnue', hint: 'La date du dernier export est illisible.' };
  }
  if (jours <= 7) {
    return { marque: 'mark--ok', label: 'À jour', hint: `Dernier export le ${frMoment(iso)}.` };
  }
  return { marque: 'mark--warn', label: 'À renouveler', hint: `Dernier export le ${frMoment(iso)} : plus de 7 jours.` };
}

/* ═══════════════════════════════════════════════════════════════════
   Onglet « Données & sauvegardes »
   ═══════════════════════════════════════════════════════════════════ */

function renderDonnees(ctx) {
  const s = ctx.settings;
  const sauvegarde = backupState(s);
  const emprise = localFootprint();
  const rappel = REMINDER_LABELS[Number(pick(s, 'backupReminderDays', 7))] || 'chaque semaine';
  const compteurs = [
    ['Lots suivis', (state.lots || []).length],
    ['Recettes', (state.recipes || []).length],
    ['DLC dérivées', (state.secondaryDlcs || []).length],
    ['Témoins', (state.witnessSamples || []).length],
    ['Ventes', (state.salesHistory || []).length],
    ['Brigade', (state.teamMembers || []).length],
  ];

  brancherArchivePdf(ctx);

  ctx.registerAction('archive-exporter', (c) => {
    try {
      downloadJson(archiveFileName(), JSON.stringify(buildArchive(), null, 2));
      c.writeSettings({ lastBackupAt: new Date().toISOString() });
      c.showToast('Archive du registre téléchargée');
      c.rerender();
    } catch (error) {
      c.showToast("L'archive n'a pas pu être générée");
    }
  });

  ctx.registerAction('archive-restaurer', (c) => {
    if (pendingImport) {
      const bilan = applyArchive(pendingImport);
      pendingImport = null;
      pendingImportName = '';
      c.showToast(`Registre restauré : ${bilan.lots} lots, ${bilan.ventes} ventes`);
      c.rerender();
      return;
    }
    chooseArchiveFile((texte, nom) => {
      const resultat = parseArchive(texte);
      if (resultat.error) {
        c.showToast(resultat.error);
        return;
      }
      pendingImport = resultat.data;
      pendingImportName = nom;
      c.showToast('Archive vérifiée : confirmez la restauration');
      c.rerender();
    }, (message) => c.showToast(message));
  });

  ctx.registerAction('archive-annuler', (c) => {
    pendingImport = null;
    pendingImportName = '';
    c.showToast('Restauration annulée');
    c.rerender();
  });

  ctx.registerAction('cache-verifier', (c) => {
    const racine = document.getElementById('settings-root');
    const sortie = racine ? racine.querySelector('[data-settings-sortie="cache"]') : null;
    const afficher = (texte) => { if (sortie) sortie.textContent = texte; };
    if (!('caches' in window)) {
      afficher('Non pris en charge');
      c.showToast('Ce navigateur ne gère pas le cache hors-ligne');
      return;
    }
    afficher('Vérification en cours');
    window.caches.keys().then((noms) => {
      const cibles = noms.filter((n) => n.toLowerCase().indexOf('traq') !== -1);
      if (!cibles.length) {
        afficher('Aucun cache applicatif');
        return;
      }
      return window.caches.open(cibles[0]).then((cache) => cache.keys()).then((requetes) => {
        const actif = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
        afficher(`${requetes.length} fichiers en cache · ${actif ? 'hors-ligne prêt' : 'hors-ligne non actif'}`);
      });
    }).catch(() => afficher('Vérification impossible'));
  });

  return `<div class="section">
    <div class="section__head">
      <span class="section__title">Registre sanitaire</span>
      <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">Sur cet appareil</span></span></span>
    </div>
    <p class="settings__lead">Le registre est conservé localement. Exportez régulièrement une archive JSON : elle contient les lots, les recettes, les DLC dérivées, les témoins et l'historique des ventes, et permet de repartir sur un appareil neuf.</p>
    <div class="settings__grid">
      ${compteurs.map(([label, valeur]) => `<div class="sheet"><div class="kpi">
        <span class="kpi__label">${ctx.esc(label)}</span>
        <span class="kpi__value">${Number(valeur)}</span>
      </div></div>`).join('')}
    </div>
    <div class="rule"></div>
    <div class="section__head"><span class="section__title">Sauvegarde et restauration</span></div>
    <div class="settings__rows">
      ${ctx.settingRow('Dernière archive exportée', sauvegarde.hint,
        `<span class="mark ${sauvegarde.marque}"><span class="mark__label">${ctx.esc(sauvegarde.label)}</span></span>`)}
      ${ctx.settingRow('Exporter le registre', 'Télécharge un fichier JSON complet. Les codes PIN de la brigade en sont exclus.',
        `<button type="button" class="btn btn--ghost" data-settings-action="archive-exporter">${ctx.icon('download', 16)} Télécharger</button>`)}
      ${pendingImport
        ? ctx.settingRow('Restaurer une archive', `Fichier vérifié : ${pendingImportName}. La restauration remplace le registre actuel : confirmez ou annulez.`,
          `<button type="button" class="btn btn--danger" data-settings-action="archive-restaurer">Confirmer la restauration</button>
           <button type="button" class="btn btn--ghost" data-settings-action="archive-annuler">Annuler</button>`)
        : ctx.settingRow('Restaurer une archive', "N'accepte que les archives produites par TraqHACCP ; le contenu est contrôlé avant toute écriture.",
          `<button type="button" class="btn btn--ghost" data-settings-action="archive-restaurer">${ctx.icon('upload', 16)} Choisir un fichier</button>`)}
      ${ctx.settingRow('Espace de stockage local', 'Volume des données du registre conservées par le navigateur sur cet appareil.',
        `<span class="mark mark--neutral"><span class="mark__label">${ctx.esc(footprintLabel(emprise))}</span></span>`)}
      ${ctx.settingRow('Rythme du rappel de sauvegarde', `Rappel actuel : ${rappel}. Le rythme se règle avec les préférences de l'appareil.`,
        `<button type="button" class="btn btn--ghost" data-settings-go="preferences">Voir les préférences</button>`)}
    </div>
    <div class="rule"></div>
    ${renderArchivePdf(ctx)}
    <div class="rule"></div>
    <div class="section__head"><span class="section__title">Hors-ligne</span></div>
    <div class="settings__rows">
      ${ctx.settingRow("Cache de l'application", "Fichiers précachés par le service worker : c'est ce qui permet l'usage sans connexion.",
        `<span class="mark mark--neutral"><span class="mark__label" data-settings-sortie="cache">Non vérifié</span></span>
         <button type="button" class="btn btn--ghost" data-settings-action="cache-verifier">${ctx.icon('refresh', 16)} Vérifier</button>`)}
    </div>
    <div class="callout callout--info">
      ${ctx.icon('lock', 16)}
      <span>La remise à zéro des réglages, dans l'onglet Préférences, ne touche jamais au registre sanitaire. Une restauration ne s'applique qu'après vérification du fichier et double confirmation.</span>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Contrat public du greffon — consommé par SETTINGS_TABS (settings.js)
   ═══════════════════════════════════════════════════════════════════ */

export const TABS_DATA = [
  { id: 'alertes', label: 'Alertes', icon: 'bell', render: renderAlertes },
  { id: 'donnees', label: 'Données & sauvegardes', icon: 'folder', render: renderDonnees },
];
