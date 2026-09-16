/**
 * src/presentation/views/audit.js — Module 14 « Registre DDPP » : registre officiel consolidé et
 * imprimable (identité de l'établissement, période, une section par domaine avec tableaux à filets,
 * score sanitaire décomposé, recherche plein texte, impression, export CSV, sauvegarde / restauration).
 * Aucune formule n'est recalculée ici : `calculateSanitaryScore()` fait foi et les seuils affichés
 * viennent de `HACCP_NORMS` ou des enregistrements.
 */
import { HACCP_NORMS } from '../../domain/constants.js';

let generation = 0, abonnement = null, periode = '30j', recherche = '';

const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nombre = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

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

/** Préfère les formateurs de l'application (ctx.fmt) et retombe sur un rendu neutre. */
function formateur(ctx) {
  const f = (ctx && ctx.fmt) || {};
  const prendre = (nom, unite) => (typeof f[nom] === 'function' ? f[nom] : (v) => `${v}${unite}`);
  return { temp: prendre('temp', ' °C'), pct: prendre('pct', ' %'), dt: prendre('dt', ''), date: prendre('date', ''), time: prendre('time', '') };
}
const seuilTpm = () => nombre(HACCP_NORMS && HACCP_NORMS.OILS ? HACCP_NORMS.OILS.CRITICAL_TPM : null);

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
const permet = (ctx, permission) => { try { return Boolean(ctx.store && typeof ctx.store.can === 'function' && ctx.store.can(permission)); } catch (erreur) { return false; } };
const icon = (ctx, nom, taille = 16) => (ctx && typeof ctx.icon === 'function' ? ctx.icon(nom, taille) : '');
function etablissement(ctx) {
  const d = depot(ctx);
  try { if (ctx && ctx.account && typeof ctx.account.getEstablishment === 'function') return ctx.account.getEstablishment() || {}; } catch (erreur) { /* repli dépôt */ }
  try { return (d && typeof d.getEstablishment === 'function' ? d.getEstablishment() : null) || {}; } catch (erreur) { return {}; }
}
const nomOperateur = (ctx) => {
  const etat = etatStore(ctx);
  try { if (ctx.account && typeof ctx.account.getOperatorName === 'function') return ctx.account.getOperatorName((etat.currentOperator || {}).id) || 'Non identifié'; } catch (erreur) { /* repli */ }
  return (etat.currentOperator || {}).name || 'Non identifié';
};

// Période couverte, cellules de tableau et statuts normalisés.
const PERIODES = [{ id: 'jour', label: "Aujourd'hui" }, { id: '7j', label: '7 jours' }, { id: '30j', label: '30 jours' }, { id: 'annee', label: 'Année' }];
function debutPeriode() {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  if (periode === '7j') debut.setDate(debut.getDate() - 6);
  else if (periode === '30j') debut.setDate(debut.getDate() - 29);
  else if (periode === 'annee') debut.setMonth(0, 1);
  return debut.getTime();
}
const libellePeriode = (ctx) => (periode === 'annee' ? `Année ${new Date().getFullYear()}`
  : `${(PERIODES.find((p) => p.id === periode) || { label: periode }).label} — depuis le ${formateur(ctx).date(new Date(debutPeriode()).toISOString())}`);
function marque(ok, libelleOk = 'Conforme', libelleKo = 'Écart') {
  const t = ok ? libelleOk : libelleKo;
  return { t, html: `${ok ? '<span class="mark mark--ok"></span>' : '<span class="mark mark--danger"></span>'}<span class="mark__label">${echapper(t)}</span>` };
}
const cellule = (v) => ({ t: v === null || v === undefined || v === '' ? '—' : String(v) });
const ligner = (ms, cellules) => ({ ms, cellules });
const FERMEE = ['Résolu', 'Résolue', 'Traité', 'Traitée', 'Clôturée', 'Annulée'];
const estFermee = (nc) => FERMEE.includes(String((nc || {}).status || ''));
const dansPeriode = (v) => { const ms = moment(v); return ms === null || ms >= debutPeriode(); };

/** Une section par domaine du registre : { id, titre, type (export CSV), colonnes, lignes }. */
function domaines(ctx, fmt) {
  const trier = (lignes) => lignes.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0));
  const S = (id, titre, type, colonnes, lignes) => ({ id, titre, type, colonnes, lignes: trier(lignes) });
  const out = [];
  const temperatures = [];
  for (const e of lire(ctx, 'getEquipments')) {
    const min = nombre(e.min), max = nombre(e.max);
    const plage = min !== null && max !== null ? `${fmt.temp(e.min)} à ${fmt.temp(e.max)}` : '—';
    const conforme = (v) => v !== null && min !== null && max !== null && v >= e.min && v <= e.max;
    const historique = (Array.isArray(e.history) ? e.history : []).filter((h) => dansPeriode(h.timestamp || h.time || h.heure));
    for (const h of historique) {
      const valeur = nombre(h.temp !== undefined ? h.temp : h.valeur);
      temperatures.push(ligner(moment(h.timestamp || h.time || h.heure), [cellule(e.name), { t: valeur === null ? '—' : fmt.temp(valeur) },
        cellule(plage), marque(conforme(valeur)), cellule(h.operator || e.operator || '—'), cellule(fmt.time(h.timestamp || h.time || h.heure))]));
    }
    if (!historique.length && nombre(e.current) !== null) {
      temperatures.push(ligner(moment(e.lastLog), [cellule(e.name), { t: fmt.temp(e.current) }, cellule(plage), marque(conforme(nombre(e.current))),
        cellule(e.operator || '—'), cellule(e.lastLog ? fmt.time(e.lastLog) : 'état courant')]));
    }
  }
  out.push(S('temperatures', '1. Températures des enceintes', 'temperatures', ['Enceinte', { t: 'Mesure', num: true }, 'Plage cible', 'Statut', 'Opérateur', 'Heure'], temperatures));
  out.push(S('nettoyage', '2. Plan de nettoyage et désinfection', 'cleaning', ['Tâche', 'Zone', 'Fréquence', 'Dernière validation', 'Statut', 'Opérateur'],
    lire(ctx, 'getCleaningTasks').filter((t) => dansPeriode(t.time) || t.status !== 'done').map((t) => ligner(moment(t.time), [cellule(t.title || t.name),
      cellule(t.zone), cellule(t.freq), cellule(t.time && t.time !== '-' ? t.time : 'non validée'), marque(t.status === 'done', 'Validée', 'À faire'), cellule(t.operator || '—')]))));
  out.push(S('huiles', '3. Huiles de friture (composés polaires)', 'oils', ['Friteuse', { t: 'TPM', num: true }, { t: 'Seuil critique', num: true }, 'Statut', 'Dernier changement', 'Opérateur'],
    lire(ctx, 'getFryers').filter((f) => dansPeriode(f.lastChange)).map((f) => {
      const tpm = nombre(f.lastTpm), max = seuilTpm();
      return ligner(moment(f.lastChange), [cellule(f.name), { t: tpm === null ? '—' : fmt.pct(tpm) }, { t: max === null ? '—' : fmt.pct(max) },
        marque(tpm !== null && max !== null && tpm <= max, 'Conforme', 'À remplacer'), cellule(f.lastChange), cellule(f.operator || '—')]);
    })));
  out.push(S('refroidissement', '4. Refroidissement rapide (63 °C → 10 °C en 2 h)', 'cooling', ['Préparation', { t: 'Départ', num: true }, { t: 'Arrivée', num: true }, 'Durée', 'Statut', 'Opérateur'],
    lire(ctx, 'getCoolingCycles').filter((c) => dansPeriode(c.startTime)).map((c) => ligner(moment(c.startTime), [cellule(c.dish),
      { t: nombre(c.startTemp) === null ? '—' : fmt.temp(c.startTemp) }, { t: nombre(c.endTemp) === null ? '—' : fmt.temp(c.endTemp) },
      cellule(`${c.durationMinutes || '—'} min`), marque(c.status === 'success', 'Cycle respecté', 'Hors délai'), cellule(c.operator || '—')]))));
  out.push(S('decongelation', '5. Décongélation sanitaire', 'defrost', ['Produit', "Lot d'origine", 'Début', 'DLC maximale', 'Enceinte', 'Statut'],
    lire(ctx, 'getDefrostCycles').filter((c) => dansPeriode(c.startDate)).map((c) => ligner(moment(c.startDate), [cellule(c.product), cellule(c.batchOrigin),
      cellule(c.startDate), cellule(c.maxDlcDate), cellule(c.chamberName),
      marque(c.status === 'consomme', 'Cycle clôturé', c.status === 'jete' ? 'Produit jeté' : 'En cours')]))));
  out.push(S('receptions', '6. Réceptions marchandises', 'deliveries', ['Fournisseur', 'N° BL', 'Catégorie', { t: 'T° camion', num: true }, { t: 'T° produit', num: true }, 'Décision', 'Opérateur', 'Heure'],
    lire(ctx, 'getDeliveries').filter((r) => dansPeriode(r.time)).map((r) => ligner(moment(r.time), [cellule(r.supplier), cellule(r.bl), cellule(r.category),
      { t: nombre(r.truckTemp) === null ? '—' : fmt.temp(r.truckTemp) }, { t: nombre(r.prodTemp) === null ? '—' : fmt.temp(r.prodTemp) },
      marque(!(/refus/i.test(String(r.decision || '')) || (typeof r.isRejected === 'function' && Boolean(r.isRejected()))), 'Acceptée', 'Refusée'),
      cellule(r.operator || '—'), cellule(fmt.time(r.time))]))));
  out.push(S('preparations', '7. Préparations et étiquetage', 'preparations', ['Préparation', 'N° lot', 'Fabriquée le', 'DLC', 'Quantité', 'Allergènes', 'Opérateur'],
    lire(ctx, 'getPreparations').filter((p) => dansPeriode(p.fabDate)).map((p) => ligner(moment(p.fabDate), [cellule(p.name), cellule(p.batch), cellule(p.fabDate),
      cellule(p.dlcDate), cellule(p.quantity), cellule((p.allergens || []).join(', ') || 'aucun'), cellule(p.operator || '—')]))));
  out.push(S('non-conformites', '8. Non-conformités et actions correctives', 'nonconformities', ['Date', 'Incident', 'Sévérité', 'Cause', 'Action corrective', 'Statut'],
    lire(ctx, 'getNonConformities').filter((nc) => dansPeriode(nc.date)).map((nc) => ligner(moment(nc.date), [cellule(nc.date), cellule(nc.equipOrSubject),
      cellule(nc.severity || nc.category5M), cellule(nc.cause), cellule(nc.action || 'à définir'), marque(estFermee(nc), 'Clôturée', 'Ouverte')]))));
  out.push(S('documents', '9. Documents sanitaires (GED)', 'documents', ['Document', 'Catégorie', 'Émetteur', 'Échéance', 'Statut'],
    lire(ctx, 'getSanitaryDocuments').map((doc) => ligner(moment(doc.expireDate || doc.fileDate), [cellule(doc.title), cellule(doc.category), cellule(doc.issuer),
      cellule(doc.expireDate || 'sans échéance'), marque(!(typeof doc.isExpired === 'function' && doc.isExpired()), 'À jour', 'Expiré')]))));
  return out;
}

/** Surligne la première occurrence du terme recherché avec `.is-selected`. */
function surligner(texte, terme) {
  const sain = echapper(texte);
  if (!terme) return sain;
  const i = sain.toLowerCase().indexOf(terme.toLowerCase());
  return i < 0 ? sain : `${sain.slice(0, i)}<span class="is-selected">${sain.slice(i, i + terme.length)}</span>${sain.slice(i + terme.length)}`;
}
const texteDe = (ligne) => ligne.cellules.map((c) => c.t).join(' · ');

/** Tableau à filets d'une section, limité à 60 lignes (le reste part à l'impression / au CSV). */
function tableau(section, terme) {
  if (!section.lignes.length) return '<p class="muted">Aucun enregistrement sur la période pour ce domaine.</p>';
  const entetes = section.colonnes.map((c) => (typeof c === 'string' ? `<th>${echapper(c)}</th>` : `<th${c.num ? ' class="num"' : ''}>${echapper(c.t)}</th>`)).join('');
  const lignes = section.lignes.slice(0, 60).map((ligne) => `<tr>${ligne.cellules.map((c, i) => {
    const col = section.colonnes[i];
    const classes = col && typeof col === 'object' && col.num ? ' class="num"' : '';
    return `<td${classes}>${terme && !c.html ? surligner(c.t, terme) : (c.html || echapper(c.t))}</td>`;
  }).join('')}</tr>`).join('');
  const table = `<table class="table table--compact table--zebra"><thead><tr>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
  return section.lignes.length <= 60 ? table
    : `${table}<p class="field__hint">${section.lignes.length - 60} enregistrement(s) supplémentaire(s) : voir l'impression ou l'export CSV du domaine.</p>`;
}

/** Score affiché tel que fourni par le moteur métier, avec sa décomposition et sa méthode. */
function blocScore(ctx, d) {
  const s = d.score;
  const composantes = s ? [['Conformité des températures', s.tempRate, '35 %'], ['Plan de nettoyage validé', s.cleanRate, '25 %'],
    ['Huiles sous le seuil critique', s.oilRate, '15 %'], ['Réceptions acceptées', s.recRate, '25 %']] : [];
  const lignes = composantes.map(([label, taux, poids]) => `<tr><td>${echapper(label)}</td><td class="num">${taux === undefined ? '—' : echapper(d.fmt.pct(taux))}</td><td class="num">${poids}</td></tr>`).join('');
  const vigilance = [['Non-conformités ouvertes', d.ncOuvertes.length], ['Actions correctives en retard', d.ncEnRetard.length], ['Documents expirés', d.documentsExpires.length]]
    .map(([label, n]) => `<p class="row"><span class="strong">${echapper(label)}</span><span class="right num">${n}</span></p>`).join('');
  return `<div class="grid grid--split">
    <div class="sheet"><div class="sheet__head"><span class="kpi__label">Score sanitaire consolidé</span></div>
      <div class="sheet__body"><p class="kpi__value num">${s ? echapper(s.score) : '—'}<span class="kpi__unit">/ 100</span></p>
        <p class="field__hint">${s && s.isAuditReady ? 'Registre conforme — prêt pour un contrôle DDPP.' : 'Registre à consolider : des écarts subsistent sur la période.'}</p></div>
      <div class="sheet__foot"><span class="unit">Méthode de calcul</span>
        <p class="field__hint">Score = températures (35 %) + nettoyage (25 %) + huiles (15 %) + réceptions (25 %), pondéré par le moteur métier
          (<span class="num">calculateSanitaryScore</span>) puis proposé ici tel quel : cet écran ne recalcule aucune formule.</p></div></div>
    <div class="sheet"><div class="sheet__head"><span class="kpi__label">Décomposition et points de vigilance</span></div>
      <div class="sheet__body">
        <table class="table table--compact"><thead><tr><th>Composante</th><th class="num">Taux</th><th class="num">Poids</th></tr></thead><tbody>${lignes}</tbody></table>
        <div class="stack">${vigilance}</div>
        <p class="field__hint">Une action corrective est « en retard » lorsqu'une non-conformité reste ouverte plus de 7 jours après sa déclaration.</p>
      </div></div></div>`;
}

/** Recherche plein texte : une seule barre, résultats groupés par domaine, terme surligné. */
function blocRecherche(d, terme) {
  if (!terme) return '';
  const bas = terme.toLowerCase();
  const groupes = d.sections.map((section) => ({ section, trouvees: section.lignes.filter((l) => texteDe(l).toLowerCase().includes(bas)) })).filter((g) => g.trouvees.length);
  const entete = (unite) => `<div class="section__head"><h2 class="section__title">Recherche « ${echapper(terme)} »</h2>${unite}
      <button class="btn btn--ghost btn--sm section__action" type="button" data-action="vider-recherche">Effacer</button></div>`;
  if (!groupes.length) return `<section class="section">${entete('')}<p class="muted">Aucun enregistrement de la période ne contient ce terme.</p></section>`;
  const total = groupes.reduce((somme, g) => somme + g.trouvees.length, 0);
  const corps = groupes.map((g) => `<div class="stack"><p class="row strong">${echapper(g.section.titre)}<span class="right num">${g.trouvees.length}</span></p>
    <ul class="timeline">${g.trouvees.slice(0, 8).map((l) => `<li class="timeline__item"><span>${surligner(texteDe(l), terme)}</span></li>`).join('')}</ul></div>`).join('');
  return `<section class="section">${entete(`<span class="unit">${total} résultat(s) dans ${groupes.length} domaine(s)</span>`)}
    <div class="sheet"><div class="sheet__body">${corps}</div></div></section>`;
}

function donnees(ctx) {
  const fmt = formateur(ctx);
  const sections = domaines(ctx, fmt);
  const ouvertes = lire(ctx, 'getNonConformities').filter((nc) => !estFermee(nc));
  const seuilRetard = Date.now() - 7 * 86400000;
  let score = null;
  try { if (ctx.useCases && typeof ctx.useCases.calculateSanitaryScore === 'function') score = ctx.useCases.calculateSanitaryScore(); } catch (erreur) { score = null; }
  return { fmt, sections, score, ncOuvertes: ouvertes, ncEnRetard: ouvertes.filter((nc) => { const ms = moment(nc.date); return ms !== null && ms < seuilRetard; }),
    documentsExpires: lire(ctx, 'getSanitaryDocuments').filter((doc) => typeof doc.isExpired === 'function' && doc.isExpired()),
    total: sections.reduce((somme, s) => somme + s.lignes.length, 0) };
}

export const meta = { id: 'audit', idx: '14', icon: 'seal', title: 'Registre DDPP', desc: 'Registre officiel consolidé', permissions: null };

export function render(ctx) {
  const d = donnees(ctx);
  const ets = etablissement(ctx);
  const fige = verrouille(ctx);
  const terme = recherche.trim();
  const segments = PERIODES.map((p) => `<button class="seg__item${periode === p.id ? ' is-active' : ''}" type="button" data-action="periode" data-periode="${p.id}" aria-pressed="${periode === p.id}">${echapper(p.label)}</button>`).join('');
  const entete = `<header class="page-head"><span class="page-head__idx">14</span><h1 class="page-head__title">Registre sanitaire officiel DDPP</h1>
      <p class="page-head__desc">Document consolidé et imprimable — ${echapper(ets.name || 'établissement non renseigné')}, période : ${echapper(libellePeriode(ctx))}.</p></header>`;
  const identite = `<div class="sheet"><div class="sheet__body"><div class="grid grid--3">
      <div><p class="kpi__label">Établissement</p><p class="strong">${echapper(ets.name || 'Non renseigné')}</p>
        <p class="muted">${echapper([ets.address, ets.postalCode, ets.city].filter(Boolean).join(' ') || 'adresse non renseignée')}</p></div>
      <div><p class="kpi__label">SIRET / agrément sanitaire</p><p class="num">${echapper(ets.siret || '—')}</p>
        <p class="muted">${echapper(ets.sanitaryApproval || 'agrément non renseigné')}</p></div>
      <div><p class="kpi__label">Responsable de l'établissement</p><p class="strong">${echapper(ets.manager || 'Non renseigné')}</p>
        <p class="muted">${echapper(ets.phone || ets.email || 'contact non renseigné')}</p></div></div></div></div>`;
  // État verrouillé (mode inspection) : aucun champ de saisie n'est rendu — ni recherche, ni restauration.
  const outils = `<div class="toolbar"><div class="seg" role="group" aria-label="Période couverte">${segments}</div>
      ${fige ? '' : `<input class="input" type="search" data-role="recherche" value="${echapper(recherche)}" placeholder="Rechercher dans les enregistrements de la période…" aria-label="Recherche plein texte dans les enregistrements">`}
      <button class="btn btn--primary" type="button" data-action="imprimer">${icon(ctx, 'printer')} Imprimer le registre</button>
      <button class="btn btn--ghost" type="button" data-action="sauvegarde">${icon(ctx, 'download')} Sauvegarde JSON</button>
      ${permet(ctx, 'backup.restore') && !fige
        ? `<button class="btn btn--ghost" type="button" data-action="restaurer">${icon(ctx, 'upload')} Restaurer</button>
           <input class="visually-hidden" type="file" accept=".json,application/json" data-role="fichier-restauration" aria-label="Fichier de sauvegarde JSON à restaurer">`
        : `<button class="btn btn--ghost" type="button" data-action="go-reglages">${icon(ctx, 'settings')} Sauvegardes et restauration</button>`}</div>`;
  const mention = fige ? `<div class="callout callout--info">${icon(ctx, 'lock')}<span>Mode inspection : les champs de saisie (recherche, restauration) ne sont pas rendus. Impression et export CSV restent disponibles pour consulter le détail.</span></div>` : '';
  const sections = d.sections.map((section) => `<section class="section">
      <div class="section__head"><h2 class="section__title">${echapper(section.titre)}</h2><span class="unit">${section.lignes.length} ligne(s)</span>
        ${section.type ? `<button class="btn btn--ghost btn--sm section__action" type="button" data-action="export-csv" data-type="${section.type}">${icon(ctx, 'download')} Export CSV</button>` : ''}</div>
      <div class="sheet"><div class="sheet__body">${tableau(section, terme || null)}</div></div></section>`).join('');
  const pied = `<div class="stamp">REGISTRE DDPP<br><span class="num">${echapper(d.fmt.dt(new Date().toISOString()))}</span><br>${echapper(nomOperateur(ctx))}</div>`;
  return `${entete}${identite}${outils}${mention}
    <section class="section"><div class="section__head"><h2 class="section__title">Synthèse sanitaire de la période</h2><span class="unit">${d.total} enregistrement(s)</span></div>
      ${blocScore(ctx, d)}</section>
    ${blocRecherche(d, terme)}${sections}${pied}`;
}

function rafraichir(root, ctx) {
  const champ = root.querySelector('[data-role="recherche"]');
  const avaitFocus = Boolean(champ && document.activeElement === champ);
  root.innerHTML = render(ctx);
  attacher(root, ctx);
  if (!avaitFocus) return;
  const suivant = root.querySelector('[data-role="recherche"]');
  if (suivant) { suivant.focus(); suivant.setSelectionRange(suivant.value.length, suivant.value.length); }
}
const nomFichier = (extension) => {
  const d = new Date(), deux = (n) => String(n).padStart(2, '0');
  return `traqhaccp-${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}.${extension}`;
};
function imprimer(ctx) {
  const echec = () => ctx.ui.toast({ status: 'danger', message: "L'impression du registre a échoué." });
  try {
    const html = ctx.exports.registerHtml(appExport(ctx), { year: periode === 'annee' ? new Date().getFullYear() : null });
    return Promise.resolve(ctx.exports.printDocument(html, { title: `Registre DDPP — ${etablissement(ctx).name || 'établissement'}` }))
      .then((resultat) => { if (resultat && resultat.ok === false) ctx.ui.toast({ status: 'warn', message: (resultat.errors || ['Impression impossible'])[0] }); })
      .catch(echec);
  } catch (erreur) { echec(); return Promise.resolve(); }
}
/** Restauration : lecture du fichier, aperçu des données, puis confirmation explicite. */
async function restaurerDepuis(root, ctx, fichier) {
  let texte = '';
  try { texte = await fichier.text(); } catch (erreur) { ctx.ui.toast({ status: 'danger', message: 'Lecture du fichier impossible.' }); return; }
  let apercu = null;
  try { apercu = ctx.exports.parseBackup(texte); } catch (erreur) { apercu = null; }
  if (!apercu || apercu.ok === false) { ctx.ui.toast({ status: 'danger', message: `Sauvegarde invalide : ${((apercu && apercu.errors) || ['format non reconnu'])[0]}` }); return; }
  const contenu = apercu.data || {}, ets = contenu.establishment || {}, compter = (v) => (Array.isArray(v) ? v.length : 0);
  const corps = `<p>Version : <span class="num">${echapper(contenu.version || 'inconnue')}</span></p>
    <p>Établissement : <span class="strong">${echapper(ets.name || 'non renseigné')}</span></p>
    <p>Enregistrements : <span class="num">${compter(contenu.deliveries) + compter(contenu.preparations) + compter(contenu.nonConformities) + compter(contenu.equipments)}</span></p>
    <p class="field__hint">Cette action remplace l'ensemble des données actuelles de l'application.</p>`;
  if (!(await ctx.ui.confirm({ title: 'Restaurer cette sauvegarde ?', body: corps, confirmLabel: 'Restaurer', danger: true }))) return;
  const resultat = ctx.settings && typeof ctx.settings.importBackup === 'function' ? ctx.settings.importBackup(texte) : { ok: false, errors: ['Restauration indisponible — passez par le module Réglages.'] };
  if (resultat && resultat.ok) {
    ctx.ui.toast({ status: 'ok', message: 'Sauvegarde restaurée.' });
    if (ctx.store && typeof ctx.store.reload === 'function') ctx.store.reload();
  } else ctx.ui.toast({ status: 'danger', message: ((resultat && resultat.errors) || ['Restauration refusée'])[0] });
  rafraichir(root, ctx);
}
const ACTIONS = {
  'periode': (el) => { periode = el.dataset.periode || '30j'; },
  'vider-recherche': () => { recherche = ''; },
  'imprimer': (el, root, ctx) => imprimer(ctx),
  'export-csv': (el, root, ctx) => {
    try {
      const csv = ctx.exports.exportRecordsCsv(appExport(ctx), { type: el.dataset.type });
      ctx.exports.downloadFile(csv.filename, csv.content, csv.mime);
      ctx.ui.toast({ status: 'ok', message: `Export CSV du domaine « ${el.dataset.type} » téléchargé.` });
    } catch (erreur) { ctx.ui.toast({ status: 'danger', message: "L'export CSV a échoué." }); }
  },
  'sauvegarde': (el, root, ctx) => {
    try {
      ctx.exports.downloadFile(nomFichier('json'), ctx.exports.buildFullBackup(appExport(ctx)), 'application/json;charset=utf-8');
      ctx.ui.toast({ status: 'ok', message: 'Sauvegarde complète téléchargée.' });
    } catch (erreur) { ctx.ui.toast({ status: 'danger', message: 'La sauvegarde a échoué.' }); }
  },
  'restaurer': (el, root, ctx) => { const champ = root.querySelector('[data-role="fichier-restauration"]'); if (champ) champ.click(); },
  'go-reglages': (el, root, ctx) => { if (ctx.router && typeof ctx.router.switchTab === 'function') ctx.router.switchTab('reglages'); },
};
function attacher(root, ctx) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const action = ACTIONS[el.dataset.action];
    if (!action) return;
    action(el, root, ctx);
    if (el.dataset.action === 'periode' || el.dataset.action === 'vider-recherche') rafraichir(root, ctx);
  });
  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-role="recherche"]');
    if (!el || !root.contains(el)) return;
    recherche = el.value;
    rafraichir(root, ctx);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-role="fichier-restauration"]');
    if (!el || !root.contains(el)) return;
    const fichier = el.files && el.files[0];
    if (fichier) restaurerDepuis(root, ctx, fichier);
  });
}
export function mount(root, ctx) {
  generation += 1;
  const gen = generation;
  attacher(root, ctx);
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
