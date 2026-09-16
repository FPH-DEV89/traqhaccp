/**
 * Module « Checklists » — routines d'ouverture et de fermeture de service (module 02).
 * Sélection de routine persistante, complétion automatique justifiée, validation signée.
 */
import { DEFAULT_CHECKLIST_ROUTINES } from '../../domain/constants.js';

const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nomOperateur = (ctx) => {
  const etat = ctx.store.getState();
  return ctx.account.getOperatorName(etat.currentOperator?.id) || 'Non identifié';
};

const VIDE = '—';
const JOUR_MS = 86400000;

/** Routines issues de DEFAULT_CHECKLIST_ROUTINES (aucune liste recopiée en dur). */
const ROUTINES = Object.keys(DEFAULT_CHECKLIST_ROUTINES).map((type) => ({
  type,
  cle: type.toLowerCase(),
  label: /FERMETURE/.test(type) ? 'Fermeture' : /OUVERTURE/.test(type) ? 'Ouverture' : (type.charAt(0) + type.slice(1).toLowerCase()),
}));

/** Sources métier déclenchant la complétion automatique d'une tâche (règle v3). */
const SOURCES_AUTO = {
  'ouv-1': (ctx) => {
    const froids = ctx.store.getEquipments().filter((e) => String(e.type || '').indexOf('froid') === 0);
    const faits = froids.filter((e) => (e.history || []).some((h) => jourDe(h.timestamp) === aujourdhui()));
    return faits.length ? `${faits.length} relevé(s) de température du jour` : null;
  },
  'ouv-5': (ctx) => {
    const taches = ctx.repository.getCleaningTasks() || [];
    const faits = taches.filter((t) => t.status === 'done');
    return faits.length ? `${faits.length} tâche(s) de nettoyage validée(s)` : null;
  },
  'fer-3': (ctx) => {
    const friteuses = ctx.repository.getFryers() || [];
    const testes = friteuses.filter((f) => Number.isFinite(Number(f.lastTpm)) && Number(f.lastTpm) > 0);
    return testes.length ? `${testes.length} test(s) TPM enregistré(s)` : null;
  },
  'fer-4': (ctx) => {
    const preps = ctx.repository.getPreparations() || [];
    return preps.length ? `${preps.length} préparation(s) étiquetée(s) au registre` : null;
  },
};

let generation = 0;
let abonnement = null;
let routineActive = ROUTINES.length ? ROUTINES[0].type : null;
let panneauValidation = null;
let autoFait = {};

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const jourDe = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Routine courante lue depuis le dépôt (source de vérité persistée). */
function routineDe(ctx, type) {
  const checklists = ctx.repository.getChecklists() || {};
  const cle = String(type || '').toLowerCase();
  const routine = checklists[cle];
  if (!routine) return null;
  if (!Array.isArray(routine.items)) routine.items = [];
  return routine;
}

function progression(routine) {
  const total = routine.items.length;
  const faits = routine.items.filter((i) => i.checked).length;
  return { total, faits, taux: total ? Math.round((faits / total) * 100) : 0 };
}

/* ═══════════════ complétion automatique ═══════════════ */

function autoCompleter(ctx, routine) {
  if (routine.validated) return false;
  let modifie = false;
  routine.items.forEach((item) => {
    if (item.checked) return;
    const source = SOURCES_AUTO[item.id];
    if (!source) return;
    let motif = null;
    try { motif = source(ctx); } catch (e) { motif = null; }
    if (!motif) return;
    item.checked = true;
    item.operator = 'Automatique';
    item.time = ctx.fmt.time(new Date().toISOString());
    item.source = motif;
    modifie = true;
  });
  if (modifie) ctx.repository.saveChecklists(ctx.repository.getChecklists());
  return modifie;
}

function estAutomatique(item) {
  return item.operator === 'Automatique';
}

/* ═══════════════ rendu ═══════════════ */

/** Barre de progression 4 px dessinée en SVG (aucune classe hors design system). */
function barreProgression(taux) {
  const largeur = Math.round((Math.max(0, Math.min(100, taux)) / 100) * 144);
  return `<span class="kpi__spark"><svg width="144" height="4" viewBox="0 0 144 4" role="img" aria-label="Progression ${taux} pour cent">
    <rect x="0" y="0" width="144" height="4" fill="currentColor" fill-opacity="0.15"></rect>
    <rect x="0" y="0" width="${largeur}" height="4" fill="currentColor"></rect>
  </svg></span>`;
}

function segment(routineType) {
  return `<div class="seg">${ROUTINES.map((r) => `<button class="seg__item ${r.type === routineType ? 'is-active' : ''}" type="button" data-action="select-routine" data-routine="${echapper(r.type)}">${echapper(r.label)}</button>`).join('')}</div>`;
}

function ligneTache(item, routine) {
  const etat = item.checked ? 'is-done' : '';
  const detail = item.checked
    ? `${echapper(item.time || VIDE)} · ${echapper(item.operator || VIDE)}`
    : echapper(item.zone || VIDE);
  const mention = estAutomatique(item)
    ? ` <span class="muted">relevé automatique${item.source ? ` — ${echapper(item.source)}` : ''}</span>`
    : '';
  return `<button class="checklist__item ${etat}" type="button" data-action="toggle-task" data-item="${echapper(item.id)}" data-routine="${echapper(routine.type)}">
    <span class="checklist__check">${item.checked ? '✓' : ''}</span>
    <span class="checklist__label">${echapper(item.label)}${mention}</span>
    <span class="checklist__due">${detail}</span>
  </button>`;
}

function historique(ctx) {
  const checklists = ctx.repository.getChecklists() || {};
  const lignes = Object.keys(checklists).map((cle) => {
    const routine = checklists[cle];
    if (!routine || !Array.isArray(routine.items)) return null;
    const p = progression(routine);
    const type = String(routine.type || cle).toUpperCase();
    return { routine, type, p };
  }).filter(Boolean);
  if (!lignes.length) return `<p class="muted">Aucune routine enregistrée.</p>`;
  return `<table class="table table--compact table--zebra">
    <thead><tr><th>Date</th><th>Routine</th><th>Opérateur</th><th class="num">Taux</th><th>Validation</th></tr></thead>
    <tbody>${lignes.map(({ routine, type, p }) => `<tr>
      <td class="num">${echapper(routine.date || VIDE)}</td>
      <td>${echapper(labelDe(type))}</td>
      <td>${echapper(routine.operator || VIDE)}</td>
      <td class="num">${p.taux}<span class="unit">%</span></td>
      <td><span class="stamp">${routine.validated ? `Validée ${echapper(routine.time || '')}` : 'En cours'}</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function labelDe(type) {
  const r = ROUTINES.find((x) => x.type === type);
  return r ? r.label : String(type || VIDE);
}

export function render(ctx) {
  const routine = routineActive ? routineDe(ctx, routineActive) : null;
  const tete = `<header class="page-head">
    <span class="page-head__idx">02</span>
    <h1 class="page-head__title">Checklists</h1>
    <p class="page-head__desc">Vérifications obligatoires de prise de poste et de fin de service (PMS quotidien).</p>
  </header>`;

  if (!ROUTINES.length) {
    return `${tete}<section class="section">${ctx.ui.empty({ icon: 'clipboard', title: 'Aucune routine définie', body: 'Les routines d’ouverture et de fermeture proviennent du référentiel DEFAULT_CHECKLIST_ROUTINES.' })}</section>`;
  }

  if (!routine) {
    return `${tete}<section class="section">${segment(routineActive)}</section>
      <section class="section">${ctx.ui.empty({ icon: 'clipboard', title: 'Routine indisponible', body: 'La routine sélectionnée est introuvable dans le registre enregistré.' })}</section>`;
  }

  const p = progression(routine);
  const op = nomOperateur(ctx);
  const bandeau = `<section class="section">
    <div class="sheet">
      <div class="sheet__head">
        <span class="section__title">Routine ${echapper(labelDe(routine.type))} — ${echapper(routine.date || VIDE)}</span>
        <span class="section__action row">
          <span class="mark ${routine.validated ? 'mark--ok' : 'mark--warn'}"><span class="mark__label">${routine.validated ? 'Validée' : 'En cours'}</span></span>
          <span class="muted">${p.faits} / ${p.total} tâches validées</span>
          ${barreProgression(p.taux)}
        </span>
      </div>
      <div class="sheet__body">
        <div class="checklist">${routine.items.map((item) => ligneTache(item, routine)).join('')}</div>
      </div>
      <div class="sheet__foot row">
        <button class="btn btn--primary" type="button" data-action="validate-routine">Valider et signer la routine</button>
        <button class="btn btn--ghost" type="button" data-action="reset-checklists">Réinitialiser pour un nouveau service</button>
        <span class="muted">Opérateur : ${echapper(op)}</span>
      </div>
    </div>
  </section>`;

  const ecarts = routine.items.filter((i) => !i.checked && i.mandatory).length;
  const alerte = ecarts
    ? `<section class="section"><div class="callout callout--warn"><p><span class="strong">${ecarts} tâche(s) obligatoire(s) restent à valider</span> avant la signature de la routine ${echapper(labelDe(routine.type))}.</p></div></section>`
    : '';

  return `${tete}
    <div class="toolbar">${segment(routineActive)}</div>
    ${alerte}
    ${bandeau}
    <section class="section">
      <div class="section__head"><h2 class="section__title">Historique des routines</h2><span class="section__action muted">Date · opérateur · taux de complétion</span></div>
      <div class="sheet"><div class="sheet__body">${historique(ctx)}</div></div>
    </section>`;
}

/* ═══════════════ validation signée ═══════════════ */

function ouvrirValidation(ctx, root) {
  const routine = routineDe(ctx, routineActive);
  if (!routine) return;
  const p = progression(routine);
  const op = nomOperateur(ctx);
  const horodatage = ctx.fmt.dt(new Date().toISOString());
  const recap = routine.items.map((i) => `<li class="checklist__item ${i.checked ? 'is-done' : ''}"><span class="checklist__check">${i.checked ? '✓' : '·'}</span><span class="checklist__label">${echapper(i.label)}</span><span class="checklist__due">${echapper(i.zone || VIDE)}</span></li>`).join('');
  panneauValidation = null;
  const corps = `<div class="stack">
    <div class="callout callout--info">
      <p>Routine <span class="strong">${echapper(labelDe(routine.type))}</span> du ${echapper(routine.date || VIDE)} — ${p.faits} sur ${p.total} tâches validées (${p.taux}<span class="unit">%</span>).</p>
    </div>
    <ul class="checklist">${recap}</ul>
    <div class="field">
      <label class="field__label" for="routine-signataire">Opérateur signataire</label>
      <input class="input" id="routine-signataire" name="operateur" value="${echapper(op)}">
      <span class="field__hint">Signature électronique tracée au journal du registre sanitaire.</span>
    </div>
    <div class="sign">
      <span class="sign__line"></span>
      <span class="sign__name">${echapper(op)}</span>
      <span class="sign__meta">Signature électronique — routine ${echapper(labelDe(routine.type))}</span>
      <span class="sign__timestamp">${echapper(horodatage)}</span>
    </div>
  </div>`;
  ctx.ui.panel({
    id: 'checklist-validation',
    title: 'Validation de routine',
    subtitle: `Routine ${labelDe(routine.type)} — ${routine.date || ''}`,
    body: corps,
    actions: [
      { label: 'Valider et signer', kind: 'primary', onClick: (el) => validerRoutine(ctx, root, el) },
      { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay('checklist-validation') },
    ],
    onMount: (el) => { panneauValidation = el; },
  });
}

function validerRoutine(ctx, root, el) {
  const racine = (el && el.querySelector) ? el : panneauValidation;
  const champ = racine && racine.querySelector ? racine.querySelector('[name="operateur"]') : null;
  const signataire = (champ && String(champ.value || '').trim()) || nomOperateur(ctx);
  const routine = routineDe(ctx, routineActive);
  if (!routine) return;
  const p = progression(routine);
  ctx.useCases.validateChecklistRoutine(routine.type, signataire);
  ctx.ui.closeOverlay('checklist-validation');
  ctx.ui.toast({
    status: p.total && p.faits === p.total ? 'ok' : 'warn',
    message: `Routine ${labelDe(routine.type)} validée par ${signataire} (${p.faits}/${p.total}).`,
  });
  rafraichir(root, ctx);
}

/* ═══════════════ actions ═══════════════ */

const ACTIONS = {
  'select-routine': (el, root, ctx) => {
    routineActive = el.dataset.routine;
    autoFait = {};
    rafraichir(root, ctx);
  },
  'toggle-task': (el, root, ctx) => {
    const routine = routineDe(ctx, el.dataset.routine);
    if (!routine) return;
    if (routine.validated) {
      ctx.ui.toast({ status: 'warn', message: 'Routine déjà validée : réinitialisez-la pour la modifier.' });
      return;
    }
    ctx.useCases.toggleChecklistTask(routine.type, el.dataset.item, nomOperateur(ctx));
    rafraichir(root, ctx);
  },
  'validate-routine': (el, root, ctx) => ouvrirValidation(ctx, root),
  'reset-checklists': async (el, root, ctx) => {
    const ok = await ctx.ui.confirm({
      title: 'Réinitialiser les routines',
      body: 'Toutes les cases cochées et les validations des routines d’ouverture et de fermeture seront perdues pour un nouveau service.',
      confirmLabel: 'Réinitialiser',
      danger: true,
    });
    if (!ok) return;
    ctx.useCases.resetChecklists();
    autoFait = {};
    ctx.ui.toast({ status: 'warn', message: 'Routines réinitialisées pour un nouveau service.' });
    rafraichir(root, ctx);
  },
};

function attacher(root, ctx) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, root, ctx);
  });
}

function rafraichir(root, ctx) {
  root.innerHTML = render(ctx);
  if (typeof ctx.store.notify === 'function') ctx.store.notify();
}

export const meta = { id: 'checklists', idx: '02', icon: 'clipboard', title: 'Checklists', desc: 'Ouverture et fermeture de service', permissions: null };

export function mount(root, ctx) {
  const maGeneration = ++generation;
  attacher(root, ctx);
  const routine = routineActive ? routineDe(ctx, routineActive) : null;
  if (routine && !autoFait[routine.type]) {
    autoFait[routine.type] = true;
    autoCompleter(ctx, routine);
  }
  abonnement = ctx.store.subscribe(() => { if (maGeneration === generation) root.innerHTML = render(ctx); });
  root.innerHTML = render(ctx);
}

export function unmount() {
  generation += 1;
  if (abonnement) { abonnement(); abonnement = null; }
  panneauValidation = null;
}
