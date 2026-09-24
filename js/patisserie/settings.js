/**
 * js/patisserie/settings.js — Écran Réglages (socle V5)
 * TraqHACCP Pâtisserie · onglets Établissement, Préférences, Compte.
 *
 * Principes :
 *   - Aucune couleur en dur : les composants peints par le design system
 *     (.field, .input, .switch, .section, .sheet, .btn, .callout, .mark)
 *     tirent tout de css/tokens.css. Ce module ne fait que la structure.
 *   - Le design system bascule par `[data-theme]`, l'application par la classe
 *     `dark` de Tailwind : `syncSettingsTheme()` réconcilie les deux sur la
 *     racine de la vue, sans toucher au reste de l'application.
 *   - Persistance dans STORAGE_KEYS.settings (source unique constants.js).
 *
 * Contrat public (stable pour les modules d'onglets) :
 *   readSettings(), writeSettings(patch), resetSettings(), setTheme(night),
 *   syncSettingsTheme(), renderSettings(), switchSettingsTab(id), SETTINGS_TABS
 */

import { showToast } from './audio-toast.js';
import { icon } from '../../src/presentation/icons.js';
import { state, saveState, getCurrentOperator } from './state.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS, APP_VERSION } from '../../src/domain/constants.js';
import { TABS_NORMS } from './settings-norms.js';
import { TABS_DATA } from './settings-data.js';

const THEME_KEY = 'theme';

/* ═══════════════════════════════════════════════════════════════════
   Utilitaires
   ═══════════════════════════════════════════════════════════════════ */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Échappe une valeur destinée à du texte ou à un attribut HTML. */
export function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Champ texte du design system. */
export function textField(name, label, value, hint, options = {}) {
  const type = options.type || 'text';
  const extra = options.readonly ? ' readonly' : '';
  const affix = options.suffix ? `<span class="field__hint">${esc(options.suffix)}</span>` : '';
  return `<label class="field">
      <span class="field__label">${esc(label)}</span>
      <input class="input" type="${type}" name="${esc(name)}" value="${esc(value)}"${extra} autocomplete="off">
      ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}${affix}
    </label>`;
}

/** Ligne « libellé + explication + contrôle » pour les bascules et choix. */
export function settingRow(label, hint, control) {
  return `<div class="settings__row">
      <span class="settings__row-text">
        <span class="settings__row-label">${esc(label)}</span>
        ${hint ? `<span class="settings__row-hint">${esc(hint)}</span>` : ''}
      </span>
      <span class="settings__row-control">${control}</span>
    </div>`;
}

/** Interrupteur du design system (le contrôle précède la piste : CSS `~`). */
export function switchControl(name, checked) {
  return `<label class="switch">
      <input type="checkbox" name="${esc(name)}"${checked ? ' checked' : ''}>
      <span class="switch__track"><span class="switch__thumb"></span></span>
    </label>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Lecture / écriture / réinitialisation
   ═══════════════════════════════════════════════════════════════════ */

export function readSettings() {
  const base = clone(DEFAULT_SETTINGS);
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    saved = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[Réglages] lecture impossible :', error && error.message);
  }
  if (!saved || typeof saved !== 'object') {
    // Première ouverture : la fiche reprend le nom de l'établissement réellement chargé
    // (state.establishmentName), pour que l'écran Réglages et l'en-tête ne divergent jamais.
    const nomCharge = String(state.establishmentName || '').trim();
    if (nomCharge && base.establishment) base.establishment.name = nomCharge;
    return base;
  }
  const merged = Object.assign(base, saved);
  merged.establishment = Object.assign(clone(base.establishment || {}), saved.establishment || {});
  return merged;
}

export function writeSettings(patch) {
  const next = Object.assign(readSettings(), patch || {});
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
  } catch (error) {
    console.warn('[Réglages] écriture impossible :', error && error.message);
  }
  return next;
}

export function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEYS.settings);
  } catch (error) {
    console.warn('[Réglages] remise à zéro impossible :', error && error.message);
  }
  return readSettings();
}

/* ═══════════════════════════════════════════════════════════════════
   Thème
   ═══════════════════════════════════════════════════════════════════ */

export function isDarkTheme() {
  return document.documentElement.classList.contains('dark');
}

export function syncSettingsTheme() {
  const root = document.getElementById('settings-root');
  if (root) root.dataset.theme = isDarkTheme() ? 'nuit' : 'papier';
}

export function setTheme(night) {
  document.documentElement.classList.toggle('dark', !!night);
  try {
    localStorage.setItem(THEME_KEY, night ? 'dark' : 'light');
  } catch (error) {
    console.warn('[Réglages] thème non mémorisé :', error && error.message);
  }
  writeSettings({ theme: night ? 'nuit' : 'papier' });
  syncSettingsTheme();
}

/* ═══════════════════════════════════════════════════════════════════
   Onglets
   ═══════════════════════════════════════════════════════════════════ */

function operatorDisplayName(member) {
  if (!member) return 'Aucun opérateur';
  const full = `${member.firstName || ''} ${member.lastName || ''}`.trim();
  return full || member.initials || 'Opérateur';
}

function renderTabEtablissement(ctx) {
  const e = ctx.settings.establishment || {};
  return `<div class="section">
      <div class="section__head">
        <span class="section__title">Fiche de l'établissement</span>
        <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">Registre DDPP</span></span></span>
      </div>
      <p class="settings__lead">Ces informations en-têtent le registre sanitaire, les rapports d'inspection et les fiches de traçabilité remises au contrôle.</p>
      <form class="settings__form" data-settings-form="etablissement">
        <div class="settings__grid">
          ${textField('name', "Nom de l'établissement", e.name, 'Apparaît sur tous les documents officiels.')}
          ${textField('activity', 'Activité déclarée', e.activity, 'Libellé du registre du commerce.')}
          ${textField('siret', 'SIRET', e.siret, '14 chiffres, identifiant de l\'exploitation.')}
          ${textField('agreement', 'Numéro d\'agrément sanitaire', e.agreement, 'Délivré par la DDPP (FR + 9 chiffres).')}
          ${textField('address', 'Adresse', e.address)}
          ${textField('postal', 'Code postal', e.postal)}
          ${textField('city', 'Ville', e.city)}
          ${textField('phone', 'Téléphone', e.phone, null, { type: 'tel' })}
          ${textField('email', 'Courriel', e.email, null, { type: 'email' })}
          ${textField('manager', 'Responsable légal', e.manager, 'Nom du gérant ou exploitant.')}
          ${textField('seats', 'Couverts', e.seats, 'Capacité de la salle.', { type: 'number' })}
          ${textField('openedYear', 'Année de mise en service', e.openedYear, null, { type: 'number' })}
        </div>
        <div class="settings__foot">
          <button type="submit" class="btn btn--primary">Enregistrer la fiche</button>
        </div>
      </form>
    </div>`;
}

function renderTabPreferences(ctx) {
  const s = ctx.settings;
  const night = isDarkTheme();
  const standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  return `<div class="section">
      <div class="section__head">
        <span class="section__title">Apparence et confort</span>
        <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">Appareil</span></span></span>
      </div>
      <div class="settings__rows">
        ${settingRow('Thème', 'Nuit pour le service du soir, papier pour le contrôle en salle.',
          `<span class="seg">
            <button type="button" class="seg__item${night ? '' : ' is-active'}" data-settings-theme="papier">Papier</button>
            <button type="button" class="seg__item${night ? ' is-active' : ''}" data-settings-theme="nuit">Nuit</button>
          </span>`)}
      </div>
      <form class="settings__form" data-settings-form="preferences">
        <div class="settings__rows">
          ${settingRow('Sons de validation', 'Bip court à chaque relevé enregistré. Coupez-le en salle de vente.',
              switchControl('sounds', s.sounds !== false))}
          ${settingRow('Unité de température', 'Utilisée pour saisir et afficher tous les relevés.',
            `<select class="select" name="tempUnit">
              <option value="C"${s.tempUnit === 'C' ? ' selected' : ''}>Celsius (°C)</option>
              <option value="F"${s.tempUnit === 'F' ? ' selected' : ''}>Fahrenheit (°F)</option>
            </select>`)}
          ${settingRow('Rappel de sauvegarde', 'Délai avant l\'alerte de sauvegarde du registre.',
            `<select class="select" name="backupReminderDays">
              <option value="1"${Number(s.backupReminderDays) === 1 ? ' selected' : ''}>Chaque jour</option>
              <option value="7"${Number(s.backupReminderDays) === 7 ? ' selected' : ''}>Chaque semaine</option>
              <option value="30"${Number(s.backupReminderDays) === 30 ? ' selected' : ''}>Chaque mois</option>
            </select>`)}
        </div>
        <div class="settings__foot">
          <button type="submit" class="btn btn--primary">Enregistrer les préférences</button>
        </div>
      </form>
      <div class="rule"></div>
      <div class="section__head"><span class="section__title">Application</span></div>
      <div class="settings__rows">
        ${settingRow('Installer sur l\'appareil', 'Un raccourci plein écran sur l\'écran d\'accueil, disponible hors connexion.',
          standalone
            ? `<span class="mark mark--ok"><span class="mark__label">Installée</span></span>`
            : `<button type="button" class="btn btn--ghost" data-settings-action="install">${icon('download', 16)} Installer</button>`)}
        ${settingRow('Notifications de service', 'Ruptures, DLC dépassées, contrôles du jour : reçus sur cet appareil.',
          `<button type="button" class="btn btn--ghost" data-settings-go="alertes">Configurer</button>`)}
      </div>
      <div class="rule"></div>
      <div class="settings__rows">
        ${settingRow('Remettre les réglages à zéro', 'Thème, préférences et fiches reviennent aux valeurs livrées. Le registre sanitaire n\'est jamais effacé.',
          `<button type="button" class="btn btn--danger" data-settings-action="reset">Réinitialiser</button>`)}
      </div>
    </div>`;
}

function renderTabCompte(ctx) {
  const member = getCurrentOperator();
  const brigade = (state.teamMembers || []).length;
  return `<div class="section">
      <div class="section__head">
        <span class="section__title">Mon compte</span>
        <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">Session</span></span></span>
      </div>
      <div class="sheet">
        <div class="sheet__body">
          <div class="settings__identity">
            <span class="settings__initials">${esc(member && member.initials ? member.initials : '—')}</span>
            <span class="settings__row-text">
              <span class="settings__row-label">${esc(operatorDisplayName(member))}</span>
              <span class="settings__row-hint">${esc(member && member.role ? member.role : 'Rôle non renseigné')} · brigade de ${brigade}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="settings__rows">
        ${settingRow('Changer d\'opérateur', 'Chaque relevé est signé du nom de l\'opérateur sélectionné.',
          `<button type="button" class="btn btn--ghost" data-settings-action="change-operator">Changer</button>`)}
        ${settingRow('Brigade et codes PIN', 'Ajouter, désactiver un membre, changer un code.',
          `<button type="button" class="btn btn--ghost" data-settings-action="manage-team">Ouvrir</button>`)}
        ${settingRow('Établissement actif', esc(state.establishmentName) + ' — changer d\'établissement recharge ses données.',
          `<button type="button" class="btn btn--ghost" data-settings-action="logout">Fermer la session</button>`)}
      </div>
      <div class="callout callout--info">
        ${icon('lock', 16)}
        <span>Les codes PIN ne sont jamais affichés ni transmis. Les relevés sont conservés localement, sur cet appareil.</span>
      </div>
      <p class="settings__sub">TraqHACCP Pâtisserie · version ${esc(APP_VERSION)}</p>
    </div>`;
}

const TABS_SOCLE = [
  { id: 'etablissement', label: 'Établissement', icon: 'seal', render: renderTabEtablissement },
  { id: 'preferences', label: 'Préférences', icon: 'settings', render: renderTabPreferences },
  { id: 'compte', label: 'Compte', icon: 'users', render: renderTabCompte },
];

export const SETTINGS_TABS = TABS_SOCLE.concat(TABS_NORMS, TABS_DATA);

let activeTabId = 'etablissement';

function tabContext() {
  return {
    settings: readSettings(),
    esc,
    icon,
    textField,
    settingRow,
    switchControl,
    writeSettings,
    showToast,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Rendu
   ═══════════════════════════════════════════════════════════════════ */

export function renderSettings() {
  const root = document.getElementById('settings-root');
  if (!root) return;
  if (!SETTINGS_TABS.some(t => t.id === activeTabId)) activeTabId = SETTINGS_TABS[0].id;
  syncSettingsTheme();

  const ctx = tabContext();
  const settings = ctx.settings;
  const etab = (settings.establishment && settings.establishment.name) || 'Établissement';

  root.innerHTML = `
    <header class="settings__head">
      <span class="settings__head-text">
        <span class="settings__kicker">Administration</span>
        <h2 class="settings__title">Réglages</h2>
        <p class="settings__sub">${esc(etab)} · version ${esc(APP_VERSION)}</p>
      </span>
      <span class="settings__head-mark"><span class="mark mark--ok"><span class="mark__label">Registre actif</span></span></span>
    </header>

    <nav class="settings__tabs" aria-label="Sections des réglages">
      ${SETTINGS_TABS.map(t => `<button type="button" class="settings__tab${t.id === activeTabId ? ' is-active' : ''}"
          data-settings-tab="${esc(t.id)}" aria-selected="${t.id === activeTabId ? 'true' : 'false'}">
          ${icon(t.icon, 16)}<span>${esc(t.label)}</span>
        </button>`).join('')}
    </nav>

    <div class="settings__panels">
      ${SETTINGS_TABS.map(t => `<section class="settings__panel${t.id === activeTabId ? '' : ' hidden'}"
          data-settings-panel="${esc(t.id)}">${t.render(ctx)}</section>`).join('')}
    </div>`;

  bindSettingsEvents(root);
}

export function switchSettingsTab(tabId) {
  if (!SETTINGS_TABS.some(t => t.id === tabId)) return;
  activeTabId = tabId;
  const root = document.getElementById('settings-root');
  if (!root) return;
  root.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    const on = btn.dataset.settingsTab === tabId;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  root.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.settingsPanel !== tabId);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Interactions
   ═══════════════════════════════════════════════════════════════════ */

const armed = new WeakMap();

/** Double clic de confirmation, sans boîte de dialogue native. */
function armConfirm(button, confirmLabel, onConfirm) {
  const previous = armed.get(button);
  if (previous && previous.ready) {
    armed.delete(button);
    button.innerHTML = previous.label;
    onConfirm();
    return;
  }
  armed.set(button, { ready: true, label: button.innerHTML });
  button.textContent = confirmLabel;
  setTimeout(() => {
    const still = armed.get(button);
    if (still && still.ready) {
      button.innerHTML = still.label;
      armed.delete(button);
    }
  }, 4000);
}

function refreshEstablishmentHeader(establishment) {
  if (typeof window.updateHeaderEstablishment === 'function') {
    window.updateHeaderEstablishment();
    return;
  }
  const el = document.getElementById('header-establishment-name');
  if (el) el.textContent = `${establishment.name} · Labo, Vente & Livraison`;
}

function saveForm(formName, form) {
  const data = new FormData(form);
  if (formName === 'etablissement') {
    const current = readSettings().establishment || {};
    const next = Object.assign({}, current);
    ['name', 'activity', 'siret', 'address', 'postal', 'city', 'phone', 'email', 'manager', 'agreement']
      .forEach((key) => { if (data.has(key)) next[key] = String(data.get(key) || '').trim(); });
    ['seats', 'openedYear'].forEach((key) => {
      if (data.has(key)) next[key] = Number(String(data.get(key) || '').replace(/[^0-9]/g, '')) || 0;
    });
    if (!next.name) {
      showToast("Le nom de l'établissement est obligatoire");
      return;
    }
    writeSettings({ establishment: next });
    state.establishmentName = next.name;
    state.establishmentSub = `${next.name} · Labo, Vente & Livraison`;
    saveState();
    refreshEstablishmentHeader(next);
    showToast('Fiche établissement enregistrée');
    renderSettings();
    return;
  }
  if (formName === 'preferences') {
    writeSettings({
      sounds: data.has('sounds'),
      tempUnit: String(data.get('tempUnit') || 'C') === 'F' ? 'F' : 'C',
      backupReminderDays: Number(data.get('backupReminderDays')) || 7,
    });
    showToast('Préférences enregistrées');
    renderSettings();
    return;
  }
  if (typeof window.settingsTabSubmit === 'function') {
    window.settingsTabSubmit(formName, form);
  }
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
});

function onSettingsClick(event) {
  const tabBtn = event.target.closest('[data-settings-tab]');
  if (tabBtn) {
    switchSettingsTab(tabBtn.dataset.settingsTab);
    return;
  }

  const goBtn = event.target.closest('[data-settings-go]');
  if (goBtn) {
    switchSettingsTab(goBtn.dataset.settingsGo);
    return;
  }

  const themeBtn = event.target.closest('[data-settings-theme]');
  if (themeBtn) {
    setTheme(themeBtn.dataset.settingsTheme === 'nuit');
    renderSettings();
    return;
  }

  const actionBtn = event.target.closest('[data-settings-action]');
  if (!actionBtn) return;
  const action = actionBtn.dataset.settingsAction;

  if (action === 'install') {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall = null;
      return;
    }
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      showToast('L\'application est déjà installée sur cet appareil');
      return;
    }
    showToast('Sur iPhone : Partager, puis « Sur l\'écran d\'accueil »');
    return;
  }

  if (action === 'reset') {
    armConfirm(actionBtn, 'Confirmer la remise à zéro ?', () => {
      resetSettings();
      syncSettingsTheme();
      renderSettings();
      showToast('Réglages remis aux valeurs livrées');
    });
    return;
  }

  if (action === 'change-operator') {
    if (window.openOperatorModal) window.openOperatorModal();
    return;
  }

  if (action === 'manage-team') {
    if (window.switchView) window.switchView('team');
    return;
  }

  if (action === 'logout') {
    armConfirm(actionBtn, 'Confirmer la fermeture ?', () => {
      if (window.deconnecterEtablissement) window.deconnecterEtablissement();
    });
  }
}

function onSettingsSubmit(event) {
  const form = event.target.closest('[data-settings-form]');
  if (!form) return;
  event.preventDefault();
  saveForm(form.dataset.settingsForm, form);
}

function bindSettingsEvents(root) {
  if (root.dataset.settingsBound === '1') return;
  root.dataset.settingsBound = '1';
  root.addEventListener('click', onSettingsClick);
  root.addEventListener('submit', onSettingsSubmit);
  if (!window.__settingsThemeObserver) {
    window.__settingsThemeObserver = new MutationObserver(syncSettingsTheme);
    window.__settingsThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
}
