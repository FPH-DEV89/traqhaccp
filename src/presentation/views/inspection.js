/**
 * src/presentation/views/inspection.js — Module 15 « Mode inspection » : écran sobre destiné à un
 * contrôleur (bandeau d'état, identité de l'établissement, période couverte, tableau de bord de
 * conformité produit par `generateInspectionSummary`, enceintes, non-conformités, documents,
 * responsable, accès aux domaines). `store.setInspectionMode` + `store.setLocked` (+
 * `ui.lockOverlay` en filet de sécurité) : dès que `state.locked` est vrai, `render` ne produit
 * AUCUN élément de saisie — le test est fait dans le rendu, pas seulement au clic.
 */
let generation = 0;
let abonnement = null;

const DOMAINES = [
  ['temperatures', 'Températures'], ['reception', 'Réception'], ['traceability', 'DLC et traçabilité'], ['allergens', 'Allergènes'], ['cleaning', 'Plan de nettoyage'],
  ['oil', 'Huiles de friture'], ['cooling', 'Refroidissement'], ['defrost', 'Décongélation'], ['ph-weight', 'pH et poids'], ['documents', 'Documents sanitaires'],
  ['nonconformities', 'Non-conformités'], ['checklists', 'Checklists'],
];

const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Horodatage ms — accepte Date, ISO, « HH:MM » et « JJ/MM/AAAA [HH:MM] ». */
function moment(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : valeur.getTime();
  const texte = String(valeur).trim();
  const horodate = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT]+(\d{1,2}):(\d{2}))?/);
  if (horodate) return new Date(+horodate[3], +horodate[2] - 1, +horodate[1], +(horodate[4] || 12), +(horodate[5] || 0)).getTime();
  const heure = texte.match(/^(\d{1,2}):(\d{2})/);
  if (heure) { const d = new Date(); d.setHours(+heure[1], +heure[2], 0, 0); return d.getTime(); }
  const ms = Date.parse(texte);
  return Number.isNaN(ms) ? null : ms;
}

function formateur(ctx) {
  const f = (ctx && ctx.fmt) || {};
  const prendre = (nom, unite) => (typeof f[nom] === 'function' ? f[nom] : (v) => `${v}${unite}`);
  return { temp: prendre('temp', ' °C'), pct: prendre('pct', ' %'), dt: prendre('dt', ''), date: prendre('date', ''), time: prendre('time', '') };
}

// Services : accès défensif, une vue ne doit jamais casser le rendu de l'application.
const depot = (ctx) => (ctx && (ctx.repository || (ctx.store && ctx.store.repository))) || null;
function lire(ctx, methode, defaut = []) {
  const d = depot(ctx);
  try { if (d && typeof d[methode] === 'function') return d[methode]() ?? defaut; } catch (erreur) { /* lecture optionnelle */ }
  return defaut;
}
const appExport = (ctx) => ({ ...(ctx || {}), repository: depot(ctx) || {}, account: (ctx && ctx.account) || {}, settings: (ctx && ctx.settings) || {} });
const etatStore = (ctx) => { try { return (ctx && ctx.store && typeof ctx.store.getState === 'function' ? ctx.store.getState() : null) || {}; } catch (erreur) { return {}; } };
const verrouille = (ctx) => Boolean(etatStore(ctx).locked);
const icon = (ctx, nom, taille = 16) => (ctx && typeof ctx.icon === 'function' ? ctx.icon(nom, taille) : '');
function etablissement(ctx) {
  const d = depot(ctx);
  try { if (ctx && ctx.account && typeof ctx.account.getEstablishment === 'function') return ctx.account.getEstablishment() || {}; } catch (erreur) { /* repli dépôt */ }
  try { return d && typeof d.getEstablishment === 'function' ? (d.getEstablishment() || {}) : {}; } catch (erreur) { return {}; }
}
const marque = (ok, libelleOk, libelleKo) => {
  const t = ok ? libelleOk : libelleKo;
  return `${ok ? '<span class="mark mark--ok"></span>' : '<span class="mark mark--danger"></span>'}<span class="mark__label">${echapper(t)}</span>`;
};
const FERMEE = ['Résolu', 'Résolue', 'Traité', 'Traitée', 'Clôturée', 'Annulée'];
const estFermee = (nc) => FERMEE.includes(String((nc || {}).status || ''));
const estExpire = (doc) => Boolean(typeof doc.isExpired === 'function' && doc.isExpired());
const conformeEnceinte = (e) => (typeof e.isConform === 'function' ? Boolean(e.isConform()) : true);

/** Synthèse métier : fournie par `ctx.useCases.generateInspectionSummary()` (jamais recalculée ici). */
function synthese(ctx) {
  try { if (ctx.useCases && typeof ctx.useCases.generateInspectionSummary === 'function') return ctx.useCases.generateInspectionSummary(); } catch (erreur) { /* indisponible */ }
  return null;
}

/** Période réellement couverte par les enregistrements (du plus ancien au jour de l'inspection). */
function couverture(ctx, fmt) {
  const sources = [['getEquipments', 'lastLog'], ['getDeliveries', 'time'], ['getPreparations', 'fabDate'], ['getCoolingCycles', 'startTime'],
    ['getDefrostCycles', 'startDate'], ['getNonConformities', 'date'], ['getFryers', 'lastChange'], ['getSanitaryDocuments', 'expireDate']];
  let plusAncien = null, plusRecent = null;
  for (const [methode, champ] of sources) {
    for (const item of lire(ctx, methode)) {
      const ms = moment(item && item[champ]);
      if (ms === null) continue;
      if (plusAncien === null || ms < plusAncien) plusAncien = ms;
      if (plusRecent === null || ms > plusRecent) plusRecent = ms;
    }
  }
  if (plusAncien === null) return 'Aucun enregistrement daté';
  return `Du ${fmt.date(new Date(plusAncien).toISOString())} au ${fmt.date(new Date(Math.max(plusRecent, Date.now())).toISOString())}`;
}

function kpi(libelle, valeur, unite, detail) {
  return `<div class="sheet"><div class="kpi"><p class="kpi__label">${echapper(libelle)}</p>
      <p class="kpi__value num">${echapper(valeur)}${unite ? `<span class="kpi__unit">${echapper(unite)}</span>` : ''}</p>
      ${detail ? `<p class="kpi__delta">${echapper(detail)}</p>` : ''}</div></div>`;
}

/** Section titrée contenant un tableau à filets (ou un message si aucune ligne à présenter). */
function bloc(titre, unite, colonnes, lignes) {
  const entetes = colonnes.map((c) => (typeof c === 'string' ? `<th>${echapper(c)}</th>` : `<th${c.num ? ' class="num"' : ''}>${echapper(c.t)}</th>`)).join('');
  return `<section class="section">
    <div class="section__head"><h2 class="section__title">${echapper(titre)}</h2><span class="unit">${echapper(unite)}</span></div>
    <div class="sheet"><div class="sheet__body"><table class="table table--compact"><thead><tr>${entetes}</tr></thead>
      <tbody>${lignes || `<tr><td colspan="${colonnes.length}">Aucun enregistrement</td></tr>`}</tbody></table></div></div></section>`;
}

function blocIdentite(ctx, ets, periodeTexte) {
  const ligne = (label, valeur, numerique) => `<p><span class="kpi__label">${echapper(label)}</span><br>${numerique ? '<span class="num">' : ''}${echapper(valeur)}${numerique ? '</span>' : ''}</p>`;
  return `<section class="section">
    <div class="section__head"><h2 class="section__title">Identité de l'établissement</h2>
      <span class="unit">Édité le ${echapper(formateur(ctx).dt(new Date().toISOString()))}</span></div>
    <div class="sheet"><div class="sheet__body"><div class="grid grid--2">
      <div class="stack">
        ${ligne('Raison sociale', ets.name || 'Non renseigné')}${ligne('Activité', ets.activity || 'Non renseignée')}
        ${ligne('SIRET', ets.siret || '—', true)}${ligne("N° d'agrément sanitaire", ets.sanitaryApproval || '—', true)}
      </div>
      <div class="stack">
        ${ligne('Adresse', [ets.address, ets.postalCode, ets.city].filter(Boolean).join(' ') || 'Non renseignée')}
        ${ligne('Responsable', ets.manager || 'Non renseigné')}${ligne('Contact', [ets.phone, ets.email].filter(Boolean).join(' — ') || 'Non renseigné')}
        ${ligne('Période couverte par le registre', periodeTexte)}
      </div></div></div></div></section>`;
}

function blocConformite(ctx, s, fmt) {
  if (!s) {
    return `<section class="section"><div class="section__head"><h2 class="section__title">Tableau de bord de conformité</h2></div>
      <div class="callout callout--warn">${icon(ctx, 'alert')}<span>La synthèse d'inspection n'est pas disponible pour le moment.</span></div></section>`;
  }
  const st = s.stats || {}, score = s.score || {}, checklists = s.checklistsStatus || {};
  return `<section class="section">
    <div class="section__head"><h2 class="section__title">Tableau de bord de conformité</h2><span class="unit">${echapper(s.inspectionDate || '')}</span></div>
    <div class="grid grid--4">
      ${kpi('Score sanitaire global', String(score.score === undefined ? '—' : score.score), '/ 100', score.isAuditReady ? 'prêt pour un contrôle' : 'à consolider')}
      ${kpi('Enceintes conformes', String(st.conformEquipments || 0), `/ ${st.totalEquipments || 0}`, `relevés conformes : ${fmt.pct(score.tempRate || 0)}`)}
      ${kpi('Non-conformités traitées', String(st.resolvedNCs || 0), '', `${st.openNCs || 0} encore ouverte(s)`)}
      ${kpi('Documents valides', String(st.validDocuments || 0), '', `${st.expiredDocuments || 0} expiré(s)`)}
    </div>
    <div class="callout callout--info">${icon(ctx, 'seal')}<span>Réceptions contrôlées : ${st.totalDeliveries || 0} dont ${st.rejectedDeliveries || 0} refusée(s) · préparations tracées : ${st.totalPreparations || 0} · nettoyage : ${fmt.pct(st.cleaningRate || 0)} · checklists ouverture ${checklists.ouvertureDone ? 'validée' : 'non validée'}, fermeture ${checklists.fermetureDone ? 'validée' : 'non validée'}.</span></div></section>`;
}

function blocEquipements(ctx, fmt) {
  const equipements = lire(ctx, 'getEquipments');
  if (!equipements.length) return '';
  const bornes = (e) => `${e.min === undefined || e.min === null ? '—' : fmt.temp(e.min)} à ${e.max === undefined || e.max === null ? '—' : fmt.temp(e.max)}`;
  const lignes = equipements.map((e) => `<tr><td>${echapper(e.name)}</td><td>${echapper(e.type || '—')}</td>
      <td class="num">${e.current === undefined || e.current === null ? '—' : echapper(fmt.temp(e.current))}</td>
      <td class="num">${echapper(bornes(e))}</td><td>${marque(conformeEnceinte(e), 'Conforme', 'Hors norme')}</td>
      <td class="num">${e.lastLog ? echapper(fmt.time(e.lastLog)) : '—'}</td></tr>`).join('');
  const ecarts = equipements.filter((e) => !conformeEnceinte(e)).length;
  return bloc('Enceintes : conformité et écarts', ecarts ? `${ecarts} écart(s) à justifier` : 'aucun écart',
    ['Équipement', 'Type', { t: 'Mesure', num: true }, { t: 'Plage cible', num: true }, 'Statut', { t: 'Dernier relevé', num: true }], lignes);
}

function blocNonConformites(ctx) {
  const ouvertes = lire(ctx, 'getNonConformities').filter((nc) => !estFermee(nc));
  const colonnes = ['Date', 'Incident', 'Sévérité', 'Cause', 'Action corrective', 'Statut'];
  if (!ouvertes.length) return bloc('Non-conformités en cours', 'aucune', colonnes, '');
  const lignes = ouvertes.slice(0, 12).map((nc) => `<tr><td>${echapper(nc.date || '—')}</td><td>${echapper(nc.equipOrSubject || '—')}</td>
      <td>${echapper(nc.severity || nc.category5M || '—')}</td><td>${echapper(nc.cause || '—')}</td>
      <td>${echapper(nc.action || 'action à définir')}</td><td>${marque(false, 'Clôturée', 'Ouverte')}</td></tr>`).join('');
  return bloc('Non-conformités en cours et actions correctives', `${ouvertes.length} ouverte(s)`, colonnes, lignes);
}

function blocDocuments(ctx) {
  const documents = lire(ctx, 'getSanitaryDocuments');
  if (!documents.length) {
    return `<section class="section"><div class="section__head"><h2 class="section__title">Documents sanitaires</h2><span class="unit">aucun</span></div>
      <div class="callout callout--warn">${icon(ctx, 'folder')}<span>Aucun document sanitaire n'est enregistré dans la GED.</span></div></section>`;
  }
  const lignes = documents.map((doc) => `<tr><td>${echapper(doc.title || '—')}</td><td>${echapper(doc.category || '—')}</td>
      <td>${echapper(doc.issuer || '—')}</td><td>${echapper(doc.expireDate || 'sans échéance')}</td>
      <td>${marque(!estExpire(doc), 'À jour', 'Expiré')}</td></tr>`).join('');
  const expires = documents.filter(estExpire).length;
  return bloc('Documents sanitaires à jour', expires ? `${expires} expiré(s)` : 'tous à jour', ['Document', 'Catégorie', 'Émetteur', 'Échéance', 'Statut'], lignes);
}

function blocResponsable(ctx, ets) {
  const f = formateur(ctx);
  return `<section class="section">
    <div class="section__head"><h2 class="section__title">Responsable du plan de maîtrise sanitaire</h2></div>
    <div class="sheet"><div class="sheet__body"><div class="grid grid--2">
      <p><span class="kpi__label">Nom</span><br><span class="strong">${echapper(ets.manager || 'Non renseigné')}</span></p>
      <p><span class="kpi__label">Téléphone</span><br><span class="num">${echapper(ets.phone || 'Non renseigné')}</span></p>
      <p><span class="kpi__label">Courriel</span><br>${echapper(ets.email || 'Non renseigné')}</p>
      <p><span class="kpi__label">Synthèse éditée le</span><br><span class="num">${echapper(f.dt(new Date().toISOString()))}</span></p></div>
    <p class="field__hint">Document de présentation destiné au contrôle officiel — aucune saisie n'est possible en mode inspection.</p>
    </div></div></section>`;
}

function blocDomaines(ctx) {
  const titres = new Map();
  for (const groupe of (Array.isArray(ctx.nav) ? ctx.nav : [])) for (const item of (groupe.items || [])) titres.set(item.id, item.title);
  const boutons = DOMAINES.map(([id, titre]) => `<button class="btn btn--ghost" type="button" data-action="domaine" data-tab="${id}">${icon(ctx, 'chevron-right')} ${echapper(titres.get(id) || titre)}</button>`).join('');
  return `<section class="section">
    <div class="section__head"><h2 class="section__title">Accès aux domaines du registre</h2><span class="unit">consultation</span></div>
    <div class="sheet"><div class="sheet__body"><div class="grid grid--3">${boutons}</div>
      <p class="field__hint">Les domaines s'ouvrent en lecture seule tant que le mode inspection est actif.</p></div></div></section>`;
}

/** Synthèse imprimable : document autonome, sans style applicatif, destiné à être remis au contrôleur. */
function syntheseHtml(ctx, s, ets, periodeTexte) {
  const f = formateur(ctx), st = (s && s.stats) || {}, score = (s && s.score) || {};
  const ligne = (cellules) => `<tr>${cellules.map((c) => `<td>${echapper(c)}</td>`).join('')}</tr>`;
  const vide = (colonnes) => `<tr><td colspan="${colonnes}">Aucun enregistrement</td></tr>`;
  const temp = (v) => (v === undefined || v === null ? '—' : f.temp(v));
  const enceintes = lire(ctx, 'getEquipments').map((e) => ligne([e.name, temp(e.current), `${temp(e.min)} à ${temp(e.max)}`, conformeEnceinte(e) ? 'Conforme' : 'Hors norme'])).join('');
  const nonConformites = lire(ctx, 'getNonConformities').slice(0, 20).map((nc) => ligne([nc.date, nc.equipOrSubject, nc.severity, nc.action || 'à définir', nc.status])).join('');
  const documents = lire(ctx, 'getSanitaryDocuments').map((doc) => ligne([doc.title, doc.category, doc.expireDate || 'sans échéance', estExpire(doc) ? 'Expiré' : 'À jour'])).join('');
  const taux = (v) => (v === undefined || v === null ? '—' : f.pct(v));
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Synthèse d'inspection sanitaire</title></head><body>
  <h1>Synthèse d'inspection sanitaire</h1>
  <p>Établissement : ${echapper(ets.name || 'Non renseigné')} — SIRET ${echapper(ets.siret || '—')} — ${echapper([ets.address, ets.postalCode, ets.city].filter(Boolean).join(' ') || 'adresse non renseignée')}</p>
  <p>N° d'agrément sanitaire : ${echapper(ets.sanitaryApproval || '—')} — Responsable : ${echapper(ets.manager || 'Non renseigné')} (${echapper([ets.phone, ets.email].filter(Boolean).join(' / ') || 'contact non renseigné')})</p>
  <p>Édité le ${echapper(f.dt(new Date().toISOString()))} — période couverte : ${echapper(periodeTexte)}</p>
  <h2>Score sanitaire global</h2>
  <p>${score.score === undefined ? '—' : echapper(score.score)} / 100 — températures ${echapper(taux(score.tempRate))}, nettoyage ${echapper(taux(score.cleanRate))}, huiles ${echapper(taux(score.oilRate))}, réceptions ${echapper(taux(score.recRate))}</p>
  <h2>Enceintes</h2>
  <table border="1"><tr><th>Équipement</th><th>Mesure</th><th>Plage cible</th><th>Statut</th></tr>${enceintes || vide(4)}</table>
  <h2>Non-conformités</h2>
  <table border="1"><tr><th>Date</th><th>Incident</th><th>Sévérité</th><th>Action corrective</th><th>Statut</th></tr>${nonConformites || vide(5)}</table>
  <h2>Documents sanitaires</h2>
  <table border="1"><tr><th>Document</th><th>Catégorie</th><th>Échéance</th><th>Statut</th></tr>${documents || vide(4)}</table>
  <h2>Récapitulatif</h2>
  <p>Réceptions : ${st.totalDeliveries || 0} contrôlée(s), ${st.rejectedDeliveries || 0} refusée(s) — préparations tracées : ${st.totalPreparations || 0} — non-conformités : ${st.openNCs || 0} ouverte(s), ${st.resolvedNCs || 0} traitée(s) — documents valides : ${st.validDocuments || 0}.</p>
  <p>Document généré par TraqHACCP — registre sanitaire.</p>
</body></html>`;
}

export const meta = { id: 'ddpp-inspection', idx: '15', icon: 'shield', title: 'Mode inspection', desc: 'Consultation lecture seule', permissions: null };

export function render(ctx) {
  // Le verrou est lu depuis le store : verrouillé => aucun champ de saisie, aucune action d'écriture.
  const fige = verrouille(ctx);
  const fmt = formateur(ctx);
  const ets = etablissement(ctx);
  const periodeTexte = couverture(ctx, fmt);
  const bandeau = `<div class="inspection-banner" role="status">${icon(ctx, fige ? 'lock' : 'shield')}
      <span>Mode inspection — lecture seule</span><span class="unit">${fige ? 'écriture verrouillée' : 'écriture encore ouverte'}</span></div>`;
  const entete = `<header class="page-head">
      <span class="page-head__idx">15</span><h1 class="page-head__title">Mode inspection officiel</h1>
      <p class="page-head__desc">Présentation du plan de maîtrise sanitaire à un contrôleur — lecture seule, sans aucune saisie possible.</p></header>`;
  const actions = `<div class="toolbar">
      <button class="btn btn--primary" type="button" data-action="imprimer">${icon(ctx, 'printer')} Imprimer la synthèse</button>
      <button class="btn btn--ghost" type="button" data-action="export-csv">${icon(ctx, 'download')} Exporter en CSV</button>
      ${fige ? `<button class="btn btn--danger" type="button" data-action="sortir">${icon(ctx, 'logout')} Terminer le mode inspection</button>`
    : `<button class="btn" type="button" data-action="entrer">${icon(ctx, 'lock')} Entrer en mode inspection</button>`}</div>`;
  const etat = fige
    ? `<div class="callout callout--warn">${icon(ctx, 'lock')}<span>Écriture verrouillée : cet écran ne rend aucun champ de saisie et la saisie des autres modules est bloquée.</span></div>`
    : `<div class="callout callout--info">${icon(ctx, 'eye')}<span>Le mode inspection verrouille la saisie ; le registre reste entièrement consultable.</span></div>`;
  return `${bandeau}${entete}${actions}${etat}
    ${blocIdentite(ctx, ets, periodeTexte)}${blocConformite(ctx, synthese(ctx), fmt)}${blocEquipements(ctx, fmt)}${blocNonConformites(ctx)}
    ${blocDocuments(ctx)}${blocResponsable(ctx, ets)}${blocDomaines(ctx)}`;
}

function rafraichir(root, ctx) { root.innerHTML = render(ctx); attacher(root, ctx); }
function journaliser(ctx, details) {
  try { if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action: 'mode inspection', target: 'inspection', details }); } catch (erreur) { /* journal optionnel */ }
}
function basculerVerrou(ctx, locked) {
  if (ctx.store && typeof ctx.store.setInspectionMode === 'function') ctx.store.setInspectionMode(locked);
  if (ctx.store && typeof ctx.store.setLocked === 'function') ctx.store.setLocked(locked);
  if (ctx.ui && typeof ctx.ui.lockOverlay === 'function') ctx.ui.lockOverlay(locked);
}
function imprimer(ctx) {
  const html = syntheseHtml(ctx, synthese(ctx), etablissement(ctx), couverture(ctx, formateur(ctx)));
  return Promise.resolve(ctx.exports.printDocument(html, { title: "Synthèse d'inspection sanitaire" }))
    .then((resultat) => { if (resultat && resultat.ok === false) ctx.ui.toast({ status: 'warn', message: (resultat.errors || ['Impression impossible'])[0] }); })
    .catch(() => ctx.ui.toast({ status: 'danger', message: "L'impression de la synthèse a échoué." }));
}
const ACTIONS = {
  'entrer': (el, root, ctx) => {
    basculerVerrou(ctx, true);
    journaliser(ctx, 'entrée en mode inspection — écriture verrouillée');
    ctx.ui.toast({ status: 'info', message: 'Mode inspection actif : écriture verrouillée.' });
    rafraichir(root, ctx);
  },
  'sortir': async (el, root, ctx) => {
    const confirme = await ctx.ui.confirm({ title: 'Terminer le mode inspection ?', body: "L'accès complet à la saisie sera rétabli.", confirmLabel: 'Terminer' });
    if (!confirme) return;
    basculerVerrou(ctx, false);
    journaliser(ctx, 'sortie du mode inspection — écriture rétablie');
    ctx.ui.toast({ status: 'ok', message: 'Mode inspection désactivé : accès complet rétabli.' });
    if (ctx.router && typeof ctx.router.switchTab === 'function') ctx.router.switchTab('dashboard');
  },
  'imprimer': (el, root, ctx) => { imprimer(ctx); },
  'export-csv': (el, root, ctx) => {
    try {
      const csv = ctx.exports.exportRecordsCsv(appExport(ctx), { type: 'all' });
      ctx.exports.downloadFile(csv.filename, csv.content, csv.mime);
      ctx.ui.toast({ status: 'ok', message: 'Registre exporté au format CSV.' });
    } catch (erreur) { ctx.ui.toast({ status: 'danger', message: "L'export CSV a échoué." }); }
  },
  'domaine': (el, root, ctx) => { if (ctx.router && typeof ctx.router.switchTab === 'function') ctx.router.switchTab(el.dataset.tab); },
};
function attacher(root, ctx) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const action = ACTIONS[el.dataset.action];
    if (action) action(el, root, ctx);
  });
}
export function mount(root, ctx) {
  generation += 1;
  const gen = generation;
  attacher(root, ctx);
  // Filet de sécurité : l'état du store fait foi (aucune saisie tant que `locked` est vrai).
  if (ctx.ui && typeof ctx.ui.lockOverlay === 'function') ctx.ui.lockOverlay(verrouille(ctx));
  if (ctx.store && typeof ctx.store.subscribe === 'function') {
    abonnement = ctx.store.subscribe(() => {
      if (gen !== generation || !root.isConnected || root.hidden) return;
      rafraichir(root, ctx);
    });
  }
}
export function unmount() {
  generation += 1;
  if (abonnement) abonnement();
  abonnement = null;
}
