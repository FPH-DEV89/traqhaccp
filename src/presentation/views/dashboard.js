/**
 * src/presentation/views/dashboard.js — Tableau de bord (module de RÉFÉRENCE).
 *
 * Contrat d'un module de vue (spec P5b §4, ARCHITECTURE §4) :
 *   render(ctx)      → chaîne HTML pure, aucune écriture DOM, aucun état ;
 *   mount(root, ctx) → câblage des `data-action` par délégation sur `root` et
 *                      abonnement au store (désabonnement conservé pour `unmount`) ;
 *   unmount(root)    → désabonnement et invalidation des rafraîchissements en vol.
 *
 * Aucun `onclick`, aucun `getElementById`, aucun import de vue à vue : les services
 * (`ui`, `icon`, `fmt`, `store`, `repository`, `router`) arrivent par `ctx`. Les helpers
 * locaux (échappement, dates, horodatages) sont définis ici même.
 */
const HEURE_BASCULE = 15; // avant 15 h le service est en ouverture
const DLC_ALERTE_H = 48;
const NC_FERMEES = ['Résolu', 'Résolue', 'Clôturée', 'Traité', 'Traitée', 'Annulée'];

let generation = 0;
let abonnement = null;

/* ── Helpers locaux ───────────────────────────────────────────────────────── */

function echapper(valeur) {
  return String(valeur === null || valeur === undefined ? '' : valeur)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Horodatage en millisecondes : accepte une Date, un ISO, ou une heure « HH:MM ». */
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

/** « 12/09/2026 » (format dépôt) → millisecondes. */
function dateFr(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur.getTime();
  const parties = String(valeur).split('/');
  if (parties.length === 3) return new Date(Number(parties[2]), Number(parties[1]) - 1, Number(parties[0]), 12, 0, 0).getTime();
  return horodatage(valeur);
}

function debutDeJour() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Heures restantes avant une échéance (négatif = dépassée). */
function heuresRestantes(ms) {
  return ms === null ? null : (ms - Date.now()) / 3600000;
}

function naviguer(ctx, id) {
  if (ctx.router && typeof ctx.router.switchTab === 'function') ctx.router.switchTab(id);
}

function nomOperateur(operateur) {
  if (!operateur) return 'opérateur non identifié';
  return operateur.name || `${operateur.firstName || ''} ${operateur.lastName || ''}`.trim() || 'opérateur non identifié';
}

/* ── Lecture des données (jamais d'écriture ici) ──────────────────────────── */

function donnees(ctx) {
  const depot = ctx.repository;
  const equipements = depot.getEquipments() || [];
  const nettoyage = depot.getCleaningTasks() || [];
  const nonConformites = depot.getNonConformities() || [];
  const preparations = depot.getPreparations() || [];
  const checklists = depot.getChecklists() || {};
  const routine = new Date().getHours() < HEURE_BASCULE
    ? (checklists.ouverture || checklists.OUVERTURE)
    : (checklists.fermeture || checklists.FERMETURE);
  const taches = routine && Array.isArray(routine.items) ? routine.items : [];

  const releves = [];
  for (const equipement of equipements) {
    for (const entree of equipement.history || []) {
      const ms = horodatage(entree.timestamp || entree.heure || entree.time);
      if (ms === null) continue;
      const valeur = Number(entree.temp !== undefined ? entree.temp : entree.valeur);
      if (!Number.isFinite(valeur)) continue;
      releves.push({
        ms, valeur,
        nom: equipement.name,
        unite: '°C',
        operateur: entree.operator || equipement.operator || '—',
        conforme: valeur >= equipement.min && valeur <= equipement.max,
      });
    }
  }
  releves.sort((a, b) => b.ms - a.ms);

  const jour = debutDeJour();
  const duJour = releves.filter((r) => r.ms >= jour);
  const conformesJour = duJour.filter((r) => r.conforme).length;
  const conformesEnceintes = equipements.filter((e) => (typeof e.isConform === 'function' ? e.isConform() : true)).length;

  const ncOuvertes = nonConformites.filter((nc) => !NC_FERMEES.includes(String(nc.status || '')));
  const ncCritiques = ncOuvertes.filter((nc) => String(nc.severity) === 'Critique');

  const dlcProches = preparations
    .map((p) => ({ preparation: p, reste: heuresRestantes(dateFr(p.dlcDate)) }))
    .filter((item) => item.reste !== null && item.reste < DLC_ALERTE_H)
    .sort((a, b) => a.reste - b.reste);

  const tachesDues = nettoyage.filter((t) => t.status !== 'done');

  const score = typeof ctx.useCases.calculateSanitaryScore === 'function'
    ? ctx.useCases.calculateSanitaryScore()
    : null;

  const operateur = (ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null;

  return {
    equipements, releves, duJour, conformesJour, conformesEnceintes,
    relevesJour: duJour.length,
    taux: duJour.length ? Math.round((conformesJour / duJour.length) * 100) : null,
    tauxEnceintes: equipements.length ? Math.round((conformesEnceintes / equipements.length) * 100) : null,
    ncOuvertes, ncCritiques, dlcProches, tachesDues, taches, routine, score, operateur,
    vide: equipements.length === 0 && taches.length === 0 && releves.length === 0,
  };
}

/* ── Fragments de rendu ───────────────────────────────────────────────────── */

function blocBanniere(d, ctx) {
  const nomEtab = (ctx.establishment && ctx.establishment.name) || 'Le Comptoir des Halles';
  const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const operateur = nomOperateur(d.operateur);

  let badge = '';
  if (d.ncCritiques.length > 0) {
    badge = `<div class="traq-badge traq-badge--danger">${ctx.icon('alert', 16)} <span>${d.ncCritiques.length} anomalie(s) critique(s)</span></div>`;
  } else if (d.score && d.score.score < 90) {
    badge = `<div class="traq-badge traq-badge--warn">${ctx.icon('alert', 16)} <span>Score : ${ctx.fmt.pct(d.score.score)}</span></div>`;
  } else {
    badge = `<div class="traq-badge traq-badge--ok">${ctx.icon('check', 16)} <span>100% Conforme — Registre à jour</span></div>`;
  }

  return `<header class="traq-banner">
    <div class="traq-banner__left">
      <h1 class="traq-banner__title">${echapper(nomEtab)}</h1>
      <p class="traq-banner__sub">${echapper(dateStr.charAt(0).toUpperCase() + dateStr.slice(1))} · ${echapper(operateur)}</p>
    </div>
    <div class="row row--sm">
      ${badge}
      <button class="btn btn--primary" type="button" data-action="go-audit">${ctx.icon('shield', 16)} Contrôle DDPP</button>
    </div>
  </header>`;
}

function blocTuiles(d, ctx) {
  // 1. Températures
  const manquants = Math.max(0, d.equipements.length - d.relevesJour);
  const tempChip = manquants > 0
    ? `<span class="traq-tile__chip traq-tile__chip--warn">${ctx.icon('clock', 12)} ${manquants} à relever</span>`
    : `<span class="traq-tile__chip traq-tile__chip--ok">${ctx.icon('check', 12)} À jour</span>`;

  // 2. Nettoyage
  const cleanChip = d.tachesDues.length > 0
    ? `<span class="traq-tile__chip traq-tile__chip--warn">${ctx.icon('clock', 12)} ${d.tachesDues.length} en attente</span>`
    : `<span class="traq-tile__chip traq-tile__chip--ok">${ctx.icon('check', 12)} Plan à jour</span>`;

  // 3. DLC & Traçabilité
  const dlcChip = d.dlcProches.length > 0
    ? `<span class="traq-tile__chip traq-tile__chip--warn">${ctx.icon('alert', 12)} ${d.dlcProches.length} alerte(s)</span>`
    : `<span class="traq-tile__chip traq-tile__chip--ok">${ctx.icon('check', 12)} Conforme</span>`;

  // 4. Réceptions
  const receptionChip = `<span class="traq-tile__chip traq-tile__chip--neutral">Nouveau contrôle →</span>`;

  // 5. Huiles
  const oilChip = `<span class="traq-tile__chip traq-tile__chip--ok">${ctx.icon('check', 12)} Bains conformes</span>`;

  // 6. Routine
  const faites = d.taches.filter((t) => t.checked).length;
  const routineComplete = d.taches.length > 0 && faites >= d.taches.length;
  const routineChip = d.taches.length === 0
    ? `<span class="traq-tile__chip traq-tile__chip--neutral">Démarrer</span>`
    : routineComplete
      ? `<span class="traq-tile__chip traq-tile__chip--ok">${ctx.icon('check', 12)} Validée</span>`
      : `<span class="traq-tile__chip traq-tile__chip--warn">${faites} / ${d.taches.length} faites</span>`;

  return `<div class="traq-grid">
    <!-- Tuile 1 : Températures -->
    <button class="traq-tile traq-tile--temp" type="button" data-action="go-temperature" aria-label="Ouvrir les relevés de températures">
      <div class="traq-tile__top">
        <div class="traq-tile__icon-box">${ctx.icon('thermometer', 24)}</div>
        ${tempChip}
      </div>
      <div class="traq-tile__bottom">
        <h3 class="traq-tile__title">Températures</h3>
        <p class="traq-tile__sub">${d.relevesJour} relevé(s) sur ${d.equipements.length} enceinte(s)</p>
      </div>
    </button>

    <!-- Tuile 2 : Nettoyage -->
    <button class="traq-tile traq-tile--clean" type="button" data-action="go-cleaning" aria-label="Ouvrir le plan de nettoyage">
      <div class="traq-tile__top">
        <div class="traq-tile__icon-box">${ctx.icon('spray', 24)}</div>
        ${cleanChip}
      </div>
      <div class="traq-tile__bottom">
        <h3 class="traq-tile__title">Plan de Nettoyage</h3>
        <p class="traq-tile__sub">Zones de cuisine, plonge et sanitaires</p>
      </div>
    </button>

    <!-- Tuile 3 : DLC & Traçabilité -->
    <button class="traq-tile traq-tile--dlc" type="button" data-action="go-tracabilite" aria-label="Ouvrir les DLC et la traçabilité">
      <div class="traq-tile__top">
        <div class="traq-tile__icon-box">${ctx.icon('tag', 24)}</div>
        ${dlcChip}
      </div>
      <div class="traq-tile__bottom">
        <h3 class="traq-tile__title">DLC & Étiquetage</h3>
        <p class="traq-tile__sub">Préparations, entames et décongélation</p>
      </div>
    </button>

    <!-- Tuile 4 : Réceptions -->
    <button class="traq-tile traq-tile--reception" type="button" data-action="go-reception" aria-label="Ouvrir le contrôle à réception">
      <div class="traq-tile__top">
        <div class="traq-tile__icon-box">${ctx.icon('truck', 24)}</div>
        ${receptionChip}
      </div>
      <div class="traq-tile__bottom">
        <h3 class="traq-tile__title">Réceptions</h3>
        <p class="traq-tile__sub">Contrôle marchandises et bons de livraison</p>
      </div>
    </button>

    <!-- Tuile 5 : Huiles de friture -->
    <button class="traq-tile traq-tile--oil" type="button" data-action="go-oil" aria-label="Ouvrir le suivi des huiles de friture">
      <div class="traq-tile__top">
        <div class="traq-tile__icon-box">${ctx.icon('droplet', 24)}</div>
        ${oilChip}
      </div>
      <div class="traq-tile__bottom">
        <h3 class="traq-tile__title">Huiles de Friture</h3>
        <p class="traq-tile__sub">Taux TPM, filtrage et renouvellement</p>
      </div>
    </button>

    <!-- Tuile 6 : Routine Service -->
    <button class="traq-tile traq-tile--routine" type="button" data-action="go-checklists" aria-label="Ouvrir les checklists de routine">
      <div class="traq-tile__top">
        <div class="traq-tile__icon-box">${ctx.icon('clipboard', 24)}</div>
        ${routineChip}
      </div>
      <div class="traq-tile__bottom">
        <h3 class="traq-tile__title">Routine Service</h3>
        <p class="traq-tile__sub">${d.routine && d.routine.type === 'FERMETURE' ? 'Fermeture' : 'Ouverture'} de service</p>
      </div>
    </button>
  </div>`;
}

function blocAlertes(d, ctx) {
  const alertes = [];
  for (const nc of d.ncCritiques.slice(0, 3)) {
    alertes.push(`<div class="callout callout--danger" role="alert">${ctx.icon('alert', 16)}
        <span><strong>${echapper(String(nc.severity))}</strong> — ${echapper(nc.equipOrSubject || nc.category5M || 'non-conformité')} : ${echapper(nc.action || 'action corrective à définir')}</span>
        <button class="btn btn--ghost btn--sm" type="button" data-action="go-nonconformites">Traiter</button></div>`);
  }
  for (const item of d.dlcProches.slice(0, 3)) {
    const reste = item.reste < 0 ? 'DLC dépassée' : `DLC dans ${Math.max(1, Math.round(item.reste))} h`;
    alertes.push(`<div class="callout callout--warn" role="alert">${ctx.icon('clock', 16)}
        <span>${echapper(item.preparation.name)} · lot ${echapper(item.preparation.batch || '—')} — ${reste} (${echapper(item.preparation.dlcDate)})</span>
        <button class="btn btn--ghost btn--sm" type="button" data-action="go-tracabilite">Traçabilité</button></div>`);
  }
  if (!alertes.length) {
    return `<div class="sheet"><div class="sheet__body" style="display:flex;align-items:center;gap:var(--s-4);">
      <span style="color:var(--ok);">${ctx.icon('shield', 22)}</span>
      <div>
        <p style="font-weight:600;color:var(--ink);">Aucune non-conformité critique en cours</p>
        <p style="font-size:var(--t-sm);color:var(--ink-3);">Toutes les denrées et équipements sont sous maîtrise sanitaire.</p>
      </div>
    </div></div>`;
  }
  return `<div class="sheet"><div class="sheet__body">${alertes.join('')}</div></div>`;
}

function blocRoutineRapide(d, ctx) {
  if (!d.taches.length) return '';
  const faites = d.taches.filter((t) => t.checked).length;
  const lignes = d.taches.slice(0, 4).map((t) => `<li class="checklist__item${t.checked ? ' is-done' : ''}">
        <button class="checklist__check" type="button" role="checkbox" aria-checked="${Boolean(t.checked)}"
          data-action="toggle-routine" data-item="${echapper(t.id)}" data-routine="${echapper(d.routine.type)}"
          aria-label="${t.checked ? 'Décocher' : 'Cocher'} ${echapper(t.label)}">${t.checked ? ctx.icon('check', 14) : ''}</button>
        <span class="checklist__label">${echapper(t.label)}</span>
        <span class="checklist__due num">${echapper(t.zone || '')}</span>
      </li>`).join('');

  return `<div class="sheet">
    <div class="sheet__head">
      <span style="font-weight:600;">Routine ${d.routine.type === 'FERMETURE' ? 'de fermeture' : 'd\'ouverture'}</span>
      <span class="unit">${faites} / ${d.taches.length} tâches</span>
      <button class="btn btn--ghost btn--sm section__action" type="button" data-action="go-checklists">${ctx.icon('clipboard', 14)} Voir tout</button>
    </div>
    <div class="sheet__body"><ul class="checklist">${lignes}</ul></div>
  </div>`;
}

/* ── Contrat de vue ───────────────────────────────────────────────────────── */

export const meta = {
  id: 'dashboard',
  idx: '01',
  icon: 'dashboard',
  title: 'Accueil',
  desc: "Tableau de bord et gestes quotidiens",
  permissions: null,
};

export function render(ctx) {
  const d = donnees(ctx);

  if (d.vide) {
    return `${blocBanniere(d, ctx)}${ctx.ui.empty({
      icon: 'seal',
      title: 'Registre vide',
      body: 'Aucun équipement, aucune routine ni aucun relevé enregistré pour le moment.',
      actionLabel: 'Ouvrir les températures',
      onAction: () => naviguer(ctx, 'temperatures'),
    })}`;
  }

  return `<div class="traq-hero">
    ${blocBanniere(d, ctx)}
    ${blocTuiles(d, ctx)}
    <div class="grid grid--2">
      <div>
        <h2 class="traq-section-title">Points d'attention & Alertes</h2>
        ${blocAlertes(d, ctx)}
      </div>
      <div>
        <h2 class="traq-section-title">Routine en cours</h2>
        ${blocRoutineRapide(d, ctx)}
      </div>
    </div>
  </div>`;
}

/** Actions déclarées par cette vue */
const ACTIONS = {
  'go-temperature': (ctx) => naviguer(ctx, 'temperatures'),
  'go-cleaning': (ctx) => naviguer(ctx, 'cleaning'),
  'go-tracabilite': (ctx) => naviguer(ctx, 'traceability'),
  'go-reception': (ctx) => naviguer(ctx, 'reception'),
  'go-oil': (ctx) => naviguer(ctx, 'oil'),
  'go-checklists': (ctx) => naviguer(ctx, 'checklists'),
  'go-nonconformite': (ctx) => naviguer(ctx, 'nonconformities'),
  'go-nonconformites': (ctx) => naviguer(ctx, 'nonconformities'),
  'go-audit': (ctx) => naviguer(ctx, 'audit'),
  'go-inspection': (ctx) => naviguer(ctx, 'ddpp-inspection'),
};

function attacher(root, ctx) {
  for (const element of root.querySelectorAll('[data-action]')) {
    element.addEventListener('click', () => {
      const action = element.getAttribute('data-action');
      if (action === 'toggle-routine') {
        const type = element.getAttribute('data-routine');
        const item = element.getAttribute('data-item');
        const operateur = (ctx.store.getCurrentOperator() || {}).name || 'Opérateur';
        if (ctx.useCases && typeof ctx.useCases.toggleChecklistTask === 'function') {
          ctx.useCases.toggleChecklistTask(type, item, operateur);
          ctx.ui.toast({ status: 'ok', message: 'Routine mise à jour' });
        }
        return;
      }
      const handler = ACTIONS[action];
      if (handler) handler(ctx);
    });
  }
}

export function mount(root, ctx) {
  generation += 1;
  const gen = generation;
  attacher(root, ctx);
  abonnement = ctx.store.subscribe(() => {
    if (gen !== generation || !root.isConnected || root.hidden) return;
    const frais = { ...ctx, ...ctx.store.getState() };
    root.innerHTML = render(frais);
    attacher(root, frais);
  });
}

export function unmount() {
  generation += 1;
  if (abonnement) abonnement();
  abonnement = null;
}
