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

function kpi(etiquette, valeur, unite, delta, marque) {
  return `<div class="sheet"><div class="kpi">
      <p class="kpi__label">${echapper(etiquette)}</p>
      <p class="kpi__value num">${valeur}${unite ? `<span class="kpi__unit">${echapper(unite)}</span>` : ''}</p>
      ${delta ? `<p class="kpi__delta${marque === 'danger' || marque === 'warn' ? ' is-down' : ' is-up'}">${marque ? `<span class="mark mark--${marque}"></span>` : ''}${echapper(delta)}</p>` : ''}
    </div></div>`;
}

function blocKpis(d, ctx) {
  const taux = d.taux === null ? (d.tauxEnceintes === null ? '—' : String(d.tauxEnceintes)) : String(d.taux);
  const deltaConformite = d.taux === null
    ? (d.equipements.length ? 'aucun relevé aujourd\'hui — conformité des enceintes' : 'aucune enceinte déclarée')
    : `${d.duJour.filter((r) => !r.conforme).length} relevé(s) hors plage`;
  return `<div class="grid grid--4">
    ${kpi('Conformité du jour', taux, '%', deltaConformite, d.taux === null || d.taux >= 95 ? 'ok' : 'warn')}
    ${kpi('Relevés du jour', `${d.relevesJour}`, `/ ${d.equipements.length} enceintes`, d.relevesJour >= d.equipements.length ? 'tournée complète' : `${d.equipements.length - d.relevesJour} enceinte(s) à relever`, d.relevesJour >= d.equipements.length ? 'ok' : 'warn')}
    ${kpi('Non-conformités ouvertes', `${d.ncOuvertes.length}`, '', d.ncCritiques.length ? `${d.ncCritiques.length} critique(s) à traiter` : 'aucune critique', d.ncOuvertes.length ? 'danger' : 'ok')}
    ${kpi('Tâches de nettoyage dues', `${d.tachesDues.length}`, '', d.tachesDues.length ? 'à valider avant la fermeture' : 'plan à jour', d.tachesDues.length ? 'warn' : 'ok')}
  </div>`;
}

function blocRoutine(d, ctx) {
  if (!d.taches.length) {
    return `<section class="section">
      <div class="section__head">
        <h2 class="section__title">Routine du service</h2>
        <button class="btn btn--ghost btn--sm section__action" type="button" data-action="go-checklists">${ctx.icon('clipboard', 16)} Checklists</button>
      </div>
      ${ctx.ui.empty({ icon: 'clipboard', title: 'Aucune routine chargée', body: 'Les checklists d\'ouverture et de fermeture n\'ont pas encore été initialisées.', actionLabel: 'Ouvrir les checklists', onAction: () => naviguer(ctx, 'checklists') })}
    </section>`;
  }
  const faites = d.taches.filter((t) => t.checked).length;
  const lignes = d.taches.map((t) => `<li class="checklist__item${t.checked ? ' is-done' : ''}">
        <button class="checklist__check" type="button" role="checkbox" aria-checked="${Boolean(t.checked)}"
          data-action="toggle-routine" data-item="${echapper(t.id)}" data-routine="${echapper(d.routine.type)}"
          aria-label="${t.checked ? 'Décocher' : 'Cocher'} ${echapper(t.label)}">${t.checked ? ctx.icon('check', 14) : ''}</button>
        <span class="checklist__label">${echapper(t.label)}</span>
        <span class="checklist__due num">${echapper(t.zone || '')}${t.mandatory ? ' · obligatoire' : ''}</span>
      </li>`).join('');
  return `<section class="section">
    <div class="section__head">
      <h2 class="section__title">Routine ${d.routine.type === 'FERMETURE' ? 'de fermeture' : 'd\'ouverture'}</h2>
      <span class="unit">${faites} / ${d.taches.length} tâches</span>
      <button class="btn btn--ghost btn--sm section__action" type="button" data-action="go-checklists">${ctx.icon('clipboard', 16)} Checklists</button>
    </div>
    <div class="sheet">
      <div class="sheet__head">
        <span class="nav-item__idx">${echapper(d.routine.type === 'FERMETURE' ? 'FERMETURE' : 'OUVERTURE')}</span>
        <span class="topbar__id">${echapper(d.routine.date || '')}</span>
      </div>
      <div class="sheet__body"><ul class="checklist">${lignes}</ul></div>
    </div>
  </section>`;
}

function blocReleves(d, ctx) {
  if (!d.releves.length) {
    return `<section class="section">
      <div class="section__head"><h2 class="section__title">Derniers relevés</h2>
        <button class="btn btn--ghost btn--sm section__action" type="button" data-action="go-temperature">${ctx.icon('thermometer', 16)} Températures</button>
      </div>
      ${ctx.ui.empty({ icon: 'thermometer', title: 'Aucun relevé enregistré', body: 'La tournée de températures n\'a pas encore été saisie.', actionLabel: 'Noter une température', onAction: () => naviguer(ctx, 'temperatures') })}
    </section>`;
  }
  const lignes = d.releves.slice(0, 6).map((r) => `<tr>
      <td>${echapper(r.nom)}</td>
      <td class="num">${ctx.fmt.temp(r.valeur)}</td>
      <td><span class="mark mark--${r.conforme ? 'ok' : 'danger'}"></span><span class="mark__label">${r.conforme ? 'Conforme' : 'Écart'}</span></td>
      <td>${echapper(r.operateur)}</td>
      <td class="num">${ctx.fmt.time(new Date(r.ms).toISOString())}</td>
    </tr>`).join('');
  return `<section class="section">
    <div class="section__head"><h2 class="section__title">Derniers relevés</h2>
      <button class="btn btn--ghost btn--sm section__action" type="button" data-action="go-temperature">${ctx.icon('thermometer', 16)} Températures</button>
    </div>
    <div class="sheet"><div class="sheet__body">
      <table class="table">
        <thead><tr><th>Enceinte</th><th>Valeur</th><th>Statut</th><th>Opérateur</th><th>Heure</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div></div>
  </section>`;
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
  const corps = alertes.length
    ? alertes.join('')
    : ctx.ui.empty({ icon: 'shield', title: 'Aucune alerte en cours', body: 'Aucune non-conformité critique ouverte ni DLC à moins de 48 h.' });
  return `<section class="section">
    <div class="section__head">
      <h2 class="section__title">Alertes</h2>
      ${d.score ? `<span class="unit">Score sanitaire ${ctx.fmt.pct(d.score.score)} — ${d.score.isAuditReady ? 'prêt pour un contrôle' : 'à consolider'}</span>` : ''}
      <button class="btn btn--ghost btn--sm section__action" type="button" data-action="go-audit">${ctx.icon('seal', 16)} Rapport DDPP</button>
    </div>${corps}
  </section>`;
}

/* ── Contrat de vue ───────────────────────────────────────────────────────── */

/**
 * Métadonnées du module — reprises de NAV (source unique de la navigation,
 * src/domain/constants.js). Aucune valeur inventée ici.
 */
export const meta = {
  id: 'dashboard',
  idx: '01',
  icon: 'dashboard',
  title: 'Tableau de bord',
  desc: "Vue d'ensemble du jour",
  permissions: null,
};

export function render(ctx) {
  const d = donnees(ctx);
  const entete = `<header class="page-head">
      <span class="page-head__idx">01</span>
      <h1 class="page-head__title">Tableau de bord</h1>
      <p class="page-head__desc">Vue d\'ensemble du ${echapper(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} — ${echapper((ctx.establishment && ctx.establishment.name) || 'établissement')}.</p>
    </header>`;
  const outils = `<div class="toolbar">
      <button class="btn" type="button" data-action="go-temperature">${ctx.icon('thermometer', 16)} Noter une température</button>
      <button class="btn" type="button" data-action="go-nonconformite">${ctx.icon('alert', 16)} Nouvelle non-conformité</button>
      <button class="btn btn--ghost" type="button" data-action="go-audit">${ctx.icon('seal', 16)} Rapport DDPP</button>
    </div>`;
  const pied = `<div class="stamp">REGISTRE À JOUR<br><span class="num">${echapper(ctx.fmt.dt(new Date().toISOString()))}</span><br>${echapper(nomOperateur(d.operateur))}</div>`;

  if (d.vide) {
    return `${entete}${ctx.ui.empty({
      icon: 'seal',
      title: 'Registre vide',
      body: 'Aucun équipement, aucune routine ni aucun relevé enregistré pour le moment.',
      actionLabel: 'Ouvrir les températures',
      onAction: () => naviguer(ctx, 'temperatures'),
    })}`;
  }

  return `${entete}${outils}
    <section class="section">
      <div class="section__head"><h2 class="section__title">Indicateurs du jour</h2></div>
      ${blocKpis(d, ctx)}
    </section>
    ${blocRoutine(d, ctx)}
    ${blocReleves(d, ctx)}
    ${blocAlertes(d, ctx)}
    ${pied}`;
}

/** Actions déclarées par cette vue (chaque `data-action` ci-dessus est traité ici). */
const ACTIONS = {
  'go-temperature': (ctx) => naviguer(ctx, 'temperatures'),
  'go-nonconformite': (ctx) => naviguer(ctx, 'nonconformities'),
  'go-nonconformites': (ctx) => naviguer(ctx, 'nonconformities'),
  'go-checklists': (ctx) => naviguer(ctx, 'checklists'),
  'go-tracabilite': (ctx) => naviguer(ctx, 'traceability'),
  'go-audit': (ctx) => naviguer(ctx, 'audit'),
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
