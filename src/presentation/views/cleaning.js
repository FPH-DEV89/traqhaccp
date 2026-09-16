/**
 * TraqHACCP — Couche présentation — Vue « Plan de nettoyage » (module 07).
 *
 * Plan groupé par fréquence (NORMS.cleaning.frequencies), validation unitaire
 * journalisée, réinitialisation confirmée, historique des 20 dernières
 * validations (.timeline) et export CSV du registre via ctx.exports.
 *
 * API : ctx.repository · ctx.useCases · ctx.ui · ctx.account · ctx.exports · ctx.fmt.
 */
import { NORMS } from '../../domain/haccp_norms.js';

/** Fréquences réglementaires de regroupement (source unique : les normes). */
const FREQUENCES = [...NORMS.cleaning.frequencies];
const AUTRES = 'Autres';

/** Libellés rencontrés dans le registre → clé de regroupement normalisée. */
const ALIAS = [
  { motif: 'chaque service', cle: 'Chaque service' },
  { motif: 'quotidien', cle: 'Quotidien' },
  { motif: 'hebdomadaire', cle: 'Hebdomadaire' },
  { motif: 'mensuel', cle: 'Mensuel' },
  { motif: 'trimestriel', cle: 'Trimestriel' },
];

const ZONES = {
  cuisine: 'Cuisine', plonge: 'Plonge', froid: 'Chambres froides', reserve: 'Réserve',
  salle: 'Salle', vestiaire: 'Vestiaire', sanitaire: 'Sanitaires', local: 'Local technique',
};

/** États visuels d'une tâche (chaînes complètes pour ne pas fragmenter les classes). */
const MARQUES = { ok: 'mark mark--ok', warn: 'mark mark--warn', danger: 'mark mark--danger' };

/* ---- État de vue --------------------------------------------------------- */
let hote = null;
let contexte = null;
let abonnement = null;
let generation = 0;
let filtreEtat = 'tout';
let filtreFrequence = 'toutes';

/* ---- Utilitaires --------------------------------------------------------- */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v ?? '').trim().toLowerCase();

const taches = (ctx) => (typeof ctx.repository.getCleaningTasks === 'function' ? ctx.repository.getCleaningTasks() : []) || [];
const faite = (t) => norm(t.status) === 'done';
const zone = (t) => ZONES[norm(t.zone)] || (t.zone ? String(t.zone) : 'Zone non précisée');
const derniere = (t) => { const v = t.lastDone || t.doneAt || t.time; return v && v !== '-' ? String(v) : '—'; };

/** Clé de regroupement : libellé du registre ramené sur les fréquences des normes. */
function frequenceDe(t) {
  const valeur = norm(t && t.freq);
  const alias = ALIAS.find((a) => valeur.includes(a.motif));
  if (alias) return alias.cle;
  return FREQUENCES.includes(valeur) ? String(t.freq) : AUTRES;
}

/** Tâche due depuis plus longtemps que la tolérance de sa fréquence (règle de vue). */
function enRetard(t, maintenant) {
  if (faite(t)) return false;
  const cle = frequenceDe(t);
  const heure = maintenant.getHours();
  if (cle === 'Chaque service') return heure >= 15;
  if (cle === 'Quotidien') return heure >= 22;
  return false;
}

const jourIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Prochaine échéance : fin de période pour la fréquence de la tâche. */
function echeance(t, maintenant) {
  const cle = frequenceDe(t);
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (cle === 'Chaque service') return jourIso(d);
  if (cle === 'Quotidien') { if (faite(t)) d.setDate(d.getDate() + 1); return jourIso(d); }
  if (cle === 'Hebdomadaire') { d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return jourIso(d); }
  if (cle === 'Mensuel') return jourIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  if (cle === 'Trimestriel') return jourIso(new Date(d.getFullYear(), d.getMonth() + 3 - (d.getMonth() % 3), 0));
  return jourIso(d);
}

function compteurs(liste, maintenant) {
  return {
    total: liste.length,
    faites: liste.filter(faite).length,
    dues: liste.filter((t) => !faite(t)).length,
    retard: liste.filter((t) => enRetard(t, maintenant)).length,
  };
}

function correspond(t, maintenant) {
  if (filtreFrequence !== 'toutes' && frequenceDe(t) !== filtreFrequence) return false;
  if (filtreEtat === 'aujourdhui') return !faite(t);
  if (filtreEtat === 'retard') return enRetard(t, maintenant);
  return true;
}

function operateur(ctx) {
  const op = ctx.account && typeof ctx.account.getCurrentOperator === 'function' ? ctx.account.getCurrentOperator() : null;
  return (op && (op.name || op.displayName)) || 'Opérateur du service';
}

function journaliser(ctx, action, cible, details) {
  if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action, target: cible, details });
}

function historique(ctx) {
  if (!ctx.account || typeof ctx.account.getActivityLog !== 'function') return [];
  return ctx.account.getActivityLog(200).filter((e) => /cleaning/i.test(e && e.action ? e.action : '')).slice(0, 20);
}

/* ---- Rendu -------------------------------------------------------------- */
function entete(ctx, liste) {
  const etab = (ctx.establishment && ctx.establishment.name) || 'établissement';
  return `<header class="page-head">
      <span class="page-head__idx">07</span>
      <h1 class="page-head__title">Plan de nettoyage</h1>
      <p class="page-head__desc">Plan de maîtrise sanitaire — ${liste.length} tâche(s) planifiée(s) pour ${esc(etab)}. Fréquences conformes aux bonnes pratiques d'hygiène.</p>
    </header>`;
}

function indicateurs(ctx, liste, maintenant) {
  const c = compteurs(liste, maintenant);
  const carte = (libelle, valeur, unite) => `<div class="kpi"><span class="kpi__label">${esc(libelle)}</span><span class="kpi__value">${valeur}</span><span class="kpi__unit">${esc(unite)}</span></div>`;
  return `<div class="grid grid--4">
      ${carte('Tâches planifiées', c.total, 'plan de nettoyage')}
      ${carte('Validées', c.faites, 'conformes')}
      ${carte('Restant à faire', c.dues, 'sur la période')}
      ${carte('En retard', c.retard, 'à rattraper')}
    </div>`;
}

function barreOutils(ctx, liste) {
  const etats = [['tout', 'Toutes les tâches'], ['aujourdhui', "À faire aujourd'hui"], ['retard', 'En retard']];
  const segEtat = `<div class="seg">${etats.map(([cle, libelle]) => `<button class="seg__item${filtreEtat === cle ? ' is-active' : ''}" type="button" data-action="filtre-etat" data-etat="${cle}">${libelle}</button>`).join('')}</div>`;
  const groupes = [...new Set(liste.map(frequenceDe))].sort((a, b) => {
    const ia = FREQUENCES.indexOf(a), ib = FREQUENCES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const segFreq = `<div class="seg"><button class="seg__item${filtreFrequence === 'toutes' ? ' is-active' : ''}" type="button" data-action="filtre-frequence" data-frequence="toutes">Toutes fréquences</button>${groupes.map((f) => `<button class="seg__item${filtreFrequence === f ? ' is-active' : ''}" type="button" data-action="filtre-frequence" data-frequence="${esc(f)}">${esc(f)}</button>`).join('')}</div>`;
  return `<div class="toolbar">
      ${segEtat}
      ${segFreq}
      <button class="btn btn--ghost" type="button" data-action="export-csv">${ctx.icon('download', 16)} Export CSV</button>
      <button class="btn btn--danger" type="button" data-action="reinit-plan">${ctx.icon('refresh', 16)} Réinitialiser le plan</button>
    </div>`;
}

function ligneTache(ctx, t, maintenant) {
  const fait = faite(t);
  const retard = enRetard(t, maintenant);
  const marque = fait ? ['ok', 'Fait'] : retard ? ['danger', 'En retard'] : ['warn', 'Dû'];
  const echeanceIso = echeance(t, maintenant);
  return `<div class="checklist__item${fait ? ' is-done' : ''}" data-action="valider-tache" data-id="${esc(t.id)}" role="button" tabindex="0" aria-label="${fait ? 'Annuler la validation de' : 'Valider'} ${esc(t.title)}">
      <span class="checklist__check">${fait ? ctx.icon('check', 14) : ''}</span>
      <span class="checklist__label">${esc(t.title)}<span class="unit"> — ${esc(zone(t))} · EPI : ${esc(t.ppeRequired || 'à définir')}</span></span>
      <span class="checklist__due">${esc(derniere(t))}</span>
      <span class="unit">échéance ${esc(ctx.fmt && ctx.fmt.date ? ctx.fmt.date(echeanceIso) : echeanceIso)}</span>
      <span class="${MARQUES[marque[0]]}"><span class="mark__label">${marque[1]}</span></span>
    </div>`;
}

function groupes(ctx, liste, maintenant) {
  const visibles = liste.filter((t) => correspond(t, maintenant));
  if (!visibles.length) {
    return `<div class="section"><div class="sheet"><div class="sheet__body">${ctx.ui.empty({
      icon: 'spray',
      title: 'Aucune tâche pour ce filtre',
      body: "Aucune tâche du plan de nettoyage ne correspond au filtre courant. Revenez à « Toutes les tâches » pour voir le plan complet.",
      actionLabel: 'Toutes les tâches',
      onAction: () => ACTIONS['filtre-etat']({ getAttribute: () => 'tout' }, hote, contexte),
    })}</div></div></div>`;
  }
  const ordre = [...new Set(visibles.map(frequenceDe))].sort((a, b) => {
    const ia = FREQUENCES.indexOf(a), ib = FREQUENCES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return ordre.map((f) => {
    const lot = visibles.filter((t) => frequenceDe(t) === f);
    const restant = lot.filter((t) => !faite(t)).length;
    return `<div class="section">
      <div class="section__head">
        <h2 class="section__title">${esc(f)}</h2>
        <span class="badge-count">${restant}/${lot.length}</span>
      </div>
      <div class="sheet"><div class="sheet__body">${lot.map((t) => ligneTache(ctx, t, maintenant)).join('')}</div></div>
    </div>`;
  }).join('');
}

function sectionHistorique(ctx) {
  const journal = historique(ctx);
  if (!journal.length) {
    return `<div class="section">
      <div class="section__head"><h2 class="section__title">Dernières validations</h2></div>
      <div class="sheet"><div class="sheet__body">${ctx.ui.empty({ icon: 'clock', title: 'Aucune validation enregistrée', body: 'Les validations de tâches de nettoyage apparaîtront ici, du plus récent au plus ancien.' })}</div></div>
    </div>`;
  }
  const items = journal.map((e) => `<li class="timeline__item">
      <span class="num">${esc(ctx.fmt && ctx.fmt.time ? ctx.fmt.time(e.at) : (e.at || ''))}</span>
      <span class="checklist__label">${esc(e.details || e.action)}</span>
      <span class="unit">${esc(e.operatorName || 'opérateur inconnu')}</span>
    </li>`).join('');
  return `<div class="section">
      <div class="section__head">
        <h2 class="section__title">Dernières validations</h2>
        <span class="badge-count">${journal.length}</span>
      </div>
      <div class="sheet"><div class="sheet__body"><ol class="timeline">${items}</ol></div></div>
    </div>`;
}

export function render(ctx) {
  const liste = taches(ctx);
  const maintenant = new Date();
  return `${entete(ctx, liste)}${indicateurs(ctx, liste, maintenant)}${barreOutils(ctx, liste)}${groupes(ctx, liste, maintenant)}${sectionHistorique(ctx)}`;
}

/* ---- Actions ------------------------------------------------------------ */
function rerendre() {
  if (!hote) return;
  hote.innerHTML = render(contexte);
}

async function basculer(el, ctx) {
  const id = el.getAttribute('data-id');
  const tache = taches(ctx).find((t) => t.id === id);
  if (!tache) return;
  const resultat = await ctx.useCases.toggleCleaningTask(id, operateur(ctx));
  if (resultat && resultat.ok === false) { ctx.ui.toast({ status: 'danger', message: 'Validation refusée par le registre.' }); return; }
  const fait = norm((resultat && resultat.data && resultat.data.status) || (faite(tache) ? 'pending' : 'done')) === 'done';
  journaliser(ctx, fait ? 'cleaningTaskDone' : 'cleaningTaskUndone', id, `${tache.title} — ${zone(tache)}`);
  ctx.ui.toast({ status: fait ? 'ok' : 'warn', message: fait ? `Tâche validée : ${tache.title}` : `Validation annulée : ${tache.title}` });
  rerendre();
}

async function reinitialiser(ctx) {
  const avant = taches(ctx).length;
  const confirme = await ctx.ui.confirm({
    id: 'cleaning-reset',
    title: 'Réinitialiser le plan de nettoyage ?',
    body: 'Toutes les tâches repasseront à « dû » et les dernières réalisations seront effacées. L\'opération est journalisée et reste traçable.',
    confirmLabel: 'Réinitialiser',
    danger: true,
  });
  if (!confirme) return;
  const resultat = ctx.useCases.resetCleaningPlan();
  journaliser(ctx, 'cleaningPlanReset', 'plan-nettoyage', `${avant} tâche(s) remises à zéro`);
  ctx.ui.toast({ status: resultat && resultat.ok === false ? 'warn' : 'ok', message: `Plan réinitialisé : ${avant} tâche(s) à refaire.` });
  rerendre();
}

/** Télécharge un export produit par la passerelle (repli local si absent). */
function telecharger(ctx, nom, contenu, mime) {
  if (typeof ctx.exports.downloadFile === 'function') return ctx.exports.downloadFile(nom, contenu, mime);
  const url = URL.createObjectURL(new Blob([contenu], { type: mime }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return null;
}

async function exporter(ctx) {
  try {
    const fiche = await ctx.exports.exportRecordsCsv({ repository: ctx.repository }, { type: 'all' });
    const nom = (fiche && fiche.filename) || 'registre-haccp.csv';
    const contenu = (fiche && fiche.content) || '';
    if (!contenu) throw new Error('export-vide');
    telecharger(ctx, nom, contenu, (fiche && fiche.mime) || 'text/csv;charset=utf-8');
    journaliser(ctx, 'cleaningPlanExport', nom, `${taches(ctx).length} tâche(s) du plan de nettoyage`);
    ctx.ui.toast({ status: 'ok', message: `Export CSV généré : ${nom}` });
  } catch (erreur) {
    ctx.ui.toast({ status: 'danger', message: "Export CSV indisponible sur ce poste." });
  }
}

const ACTIONS = {
  'valider-tache': (el, root, ctx) => basculer(el, ctx),
  'reinit-plan': (el, root, ctx) => reinitialiser(ctx),
  'export-csv': (el, root, ctx) => exporter(ctx),
  'filtre-etat': (el, root, ctx) => { filtreEtat = el.getAttribute('data-etat') || 'tout'; rerendre(); },
  'filtre-frequence': (el, root, ctx) => { filtreFrequence = el.getAttribute('data-frequence') || 'toutes'; rerendre(); },
};

/* ---- Contrat de vue ----------------------------------------------------- */
export function mount(root, ctx) {
  generation += 1;
  const jeton = generation;
  filtreEtat = 'tout';
  filtreFrequence = 'toutes';
  hote = root;
  const frais = { ...ctx, ...(ctx.store && typeof ctx.store.getState === 'function' ? ctx.store.getState() : {}) };
  contexte = frais;
  if (ctx.store && typeof ctx.store.subscribe === 'function') {
    abonnement = ctx.store.subscribe(() => { if (jeton === generation && hote) rerendre(); });
  }
  root.addEventListener('click', (ev) => {
    if (!hote) return;
    const cible = ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!cible || !root.contains(cible)) return;
    const action = ACTIONS[cible.getAttribute('data-action')];
    if (action) action(cible, root, contexte);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const cible = ev.target.closest ? ev.target.closest('[data-action="valider-tache"]') : null;
    if (!cible) return;
    ev.preventDefault();
    ACTIONS['valider-tache'](cible, root, contexte);
  });
  root.innerHTML = render(frais);
}

export function unmount() {
  generation += 1;
  if (typeof abonnement === 'function') abonnement();
  abonnement = null;
  hote = null;
  contexte = null;
}

export const meta = Object.freeze({
  id: 'cleaning',
  idx: '07',
  title: 'Plan de nettoyage',
  icon: 'spray',
  description: 'Plan de nettoyage et de désinfection, fréquences et validations journalisées.',
});
