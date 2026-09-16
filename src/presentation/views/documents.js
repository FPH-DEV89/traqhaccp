/**
 * TraqHACCP — Couche présentation — Vue « Documents sanitaires » (module 12, GED).
 *
 * Classeur sanitaire dématérialisé : attestations 14 h, bons 3D, analyses de laboratoire,
 * certificats de potabilité, FDS, rapports d'audit. Statut d'expiration au jour près
 * (renouvellement à 30 j), filtres catégorie / statut / recherche, compteur d'expirations
 * imminentes (.badge-count), pièce jointe, inventaire imprimable, ajout · édition · suppression.
 * Le bouton « Ajouter un document » de la v3 appelait openModal('addDocModal'), fonction absente
 * du socle : il est ici rendu fonctionnel (ctx.ui.panel).
 * Référence, responsable et lien ne sont pas portés par l'entité `SanitaryDocument` : ils sont
 * encodés en clé/valeur dans le journal d'activité (seule écriture hors entité) et recomposés
 * à la lecture — persistance réelle, y compris après rechargement.
 * API : ctx.repository · ctx.useCases · ctx.ui · ctx.account · ctx.exports.
 * design-ignore-file:couleurs — le document imprimé est autonome (feuille interne).
 */
import { SAN_DOC_CATEGORIES } from '../../domain/constants.js';

const SEUIL_JOURS = 30;
const MS_JOUR = 86400000;
const VIDE = '—';
let hote = null, contexte = null, abonnement = null, generation = 0, panneau = null, fichier = null, idEdite = null;
let filtreCategorie = 'toutes', filtreStatut = 'tous', recherche = '';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v ?? '').trim().toLowerCase();
const enDate = (v) => {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v));
  if (fr) return new Date(+fr[3], +fr[2] - 1, +fr[1]);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const isoDe = (v) => { const d = enDate(v); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''; };
const aujour = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const joursRestants = (v) => { const d = enDate(v); return d ? Math.round((d.getTime() - aujour().getTime()) / MS_JOUR) : null; };
const categorieDe = (v) => SAN_DOC_CATEGORIES.find((c) => norm(c.id) === norm(v))
  || SAN_DOC_CATEGORIES.find((c) => norm(c.label) === norm(v))
  || SAN_DOC_CATEGORIES.find((c) => norm(v).length > 4 && norm(c.label).startsWith(norm(v).slice(0, 12))) || null;
const libelleCategorie = (v) => ((categorieDe(v) || {}).label) || (v ? String(v) : 'Non classé');
const statutDe = (doc) => {
  const j = joursRestants(doc.expireDate);
  if (j === null) return { id: 'permanent', label: 'Sans échéance', mark: 'mark--neutral', rang: 3 };
  if (j < 0) return { id: 'expire', label: `Expiré depuis ${-j} j`, mark: 'mark--danger', rang: 0 };
  if (j === 0) return { id: 'imminent', label: "Expire aujourd'hui", mark: 'mark--warn', rang: 1 };
  if (j <= SEUIL_JOURS) return { id: 'imminent', label: `À renouveler — ${j} j`, mark: 'mark--warn', rang: 1 };
  return { id: 'valide', label: 'Valide', mark: 'mark--ok', rang: 2 };
};

/* Journal d'activité : métadonnées GED écrites en clé/valeur puis recomposées */
function journaliser(ctx, action, cible, details) {
  if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action, target: cible, details });
}
const encoder = (paires) => paires.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
  .map(([k, v]) => `${k} : ${String(v).replace(/[·\n\r]/g, ' ').replace(/\s+/g, ' ').trim()}`).join(' · ');
function extras(ctx, id) {
  const journal = (typeof ctx.repository.getActivityLog === 'function' ? ctx.repository.getActivityLog() : []) || [];
  const lu = {};
  for (const e of journal.filter((x) => x && x.target === id).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))) {
    for (const bloc of String(e.details || '').split(' · ')) { const c = bloc.indexOf(' : '); if (c > 0) lu[bloc.slice(0, c).trim()] = bloc.slice(c + 3).trim(); }
  }
  return { reference: lu['Référence'] || '', responsable: lu['Responsable'] || '', lien: lu['Lien'] || '' };
}
function documents(ctx) {
  const brut = (typeof ctx.repository.getSanitaryDocuments === 'function' ? ctx.repository.getSanitaryDocuments() : []) || [];
  return brut.map((d) => ({ ...d, ...extras(ctx, d.id) }))
    .sort((a, b) => (statutDe(a).rang - statutDe(b).rang) || String(b.fileDate || '').localeCompare(String(a.fileDate || '')));
}
const operateur = (ctx) => (ctx.account && typeof ctx.account.getCurrentOperator === 'function' ? ctx.account.getCurrentOperator() : null) || {};
const nomOperateur = (ctx) => operateur(ctx).name || operateur(ctx).displayName || 'Opérateur du service';
function filtrer(liste) {
  const q = norm(recherche);
  return liste.filter((d) => {
    if (filtreCategorie !== 'toutes') { const c = categorieDe(d.category); if (!c || c.id !== filtreCategorie) return false; }
    if (filtreStatut !== 'tous' && statutDe(d).id !== filtreStatut) return false;
    return !q || norm([d.title, d.category, d.issuer, d.reference, d.responsable, d.notes, d.fileData].join(' ')).includes(q);
  });
}

/* Rendu */
function itemGed(ctx, doc) {
  const statut = statutDe(doc), cat = categorieDe(doc.category), source = doc.fileData || doc.lien;
  const piece = source
    ? (String(source).startsWith('data:') ? `<a class="btn btn--sm" href="${esc(source)}" download="${esc(doc.title || 'document')}">${ctx.icon('download', 16)} Pièce jointe</a>` : `<a class="btn btn--sm" href="${esc(source)}" target="_blank" rel="noopener">${ctx.icon('external', 16)} Consulter</a>`)
    : '<span class="unit">Document papier classé</span>';
  return `<article class="ged__item"><span class="ged__icon">${ctx.icon(cat ? cat.icon : 'folder')}</span>
    <div class="ged__name">${esc(doc.title || 'Document sans intitulé')}<span class="unit">${esc(libelleCategorie(doc.category))}${doc.reference ? ` · réf. ${esc(doc.reference)}` : ''}${doc.issuer ? ` · ${esc(doc.issuer)}` : ''}</span></div>
    <div class="ged__meta"><span>${doc.fileDate ? `Émis le ${ctx.fmt.date(doc.fileDate)}` : 'Émission non renseignée'} · ${doc.expireDate ? `expire le ${ctx.fmt.date(doc.expireDate)}` : 'validité permanente'}</span>
      <span class="mark ${statut.mark}"><span class="mark__label">${esc(statut.label)}</span></span>
      ${doc.responsable ? `<span class="unit">Responsable : ${esc(doc.responsable)}</span>` : ''}${doc.notes ? `<span class="unit">${esc(doc.notes)}</span>` : ''}${piece}</div>
    <div class="ged__actions">
      <button class="icon-btn" type="button" data-action="editer-document" data-id="${esc(doc.id)}" title="Modifier la fiche">${ctx.icon('edit', 16)}</button>
      <button class="icon-btn" type="button" data-action="imprimer-document" data-id="${esc(doc.id)}" title="Imprimer la fiche">${ctx.icon('printer', 16)}</button>
      <button class="icon-btn" type="button" data-action="supprimer-document" data-id="${esc(doc.id)}" title="Supprimer la pièce">${ctx.icon('trash', 16)}</button>
    </div></article>`;
}

function zoneGed(ctx, liste) {
  if (!liste.length) return `<div data-zone="ged">${ctx.ui.empty({ icon: 'folder', title: 'Aucun document sur ce filtre',
    body: 'Versez au classeur les attestations de formation 14 h, les bons d’intervention 3D, les analyses de laboratoire et le certificat de potabilité de l’eau.',
    actionLabel: 'Ajouter un document', onAction: () => ouvrirFiche(ctx, null) })}</div>`;
  return `<div class="ged" data-zone="ged">${liste.map((d) => itemGed(ctx, d)).join('')}</div>`;
}

function barreOutils(ctx, liste) {
  const opt = (v, l, courant) => `<option value="${esc(v)}"${courant === v ? ' selected' : ''}>${esc(l)}</option>`;
  const aRenouveler = liste.filter((d) => statutDe(d).id === 'imminent').length;
  const expire = liste.filter((d) => statutDe(d).id === 'expire').length;
  return `<div class="toolbar">
    <label class="input-group"><span class="input-group__prefix">${ctx.icon('search', 16)}</span><input class="input" type="search" data-role="recherche" value="${esc(recherche)}" placeholder="Rechercher un document, un organisme, une référence…" aria-label="Rechercher un document sanitaire"></label>
    <select class="select" data-filtre="categorie" aria-label="Filtrer par catégorie">${opt('toutes', 'Toutes les catégories', filtreCategorie)}${SAN_DOC_CATEGORIES.map((c) => opt(c.id, c.label, filtreCategorie)).join('')}</select>
    <select class="select" data-filtre="statut" aria-label="Filtrer par statut d'expiration">${opt('tous', 'Tous les statuts', filtreStatut)}${opt('valide', 'Valides', filtreStatut)}${opt('imminent', `À renouveler (≤ ${SEUIL_JOURS} j)`, filtreStatut)}${opt('expire', 'Expirés', filtreStatut)}${opt('permanent', 'Sans échéance', filtreStatut)}</select>
    <span class="badge-count" title="${expire} document(s) expiré(s)">${aRenouveler + expire}</span>
    <button class="btn btn--ghost" type="button" data-action="inventaire">${ctx.icon('printer', 16)} Inventaire imprimable</button>
    <button class="btn btn--primary" type="button" data-action="ajouter-document">${ctx.icon('plus', 16)} Ajouter un document</button>
  </div>`;
}

function gabarit(ctx) {
  const liste = documents(ctx), visibles = filtrer(liste);
  const aRenouveler = liste.filter((d) => statutDe(d).id === 'imminent').length;
  const parStatut = (id) => liste.filter((d) => statutDe(d).id === id).length;
  const etab = (ctx.establishment && ctx.establishment.name) || 'votre établissement';
  return `<header class="page-head"><span class="page-head__idx">12</span><h1 class="page-head__title">Documents sanitaires</h1>
    <p class="page-head__desc">Classeur sanitaire de ${esc(etab)} — ${liste.length} pièce(s)${aRenouveler ? `, dont <span class="badge-count">${aRenouveler}</span> à renouveler sous ${SEUIL_JOURS} jours` : ', aucune échéance imminente'}.</p></header>
  <section class="grid grid--4">
    <div class="kpi"><span class="kpi__label">Pièces au classeur</span><span class="kpi__value">${liste.length}</span></div>
    <div class="kpi"><span class="kpi__label">Valides</span><span class="kpi__value">${parStatut('valide')}</span></div>
    <div class="kpi"><span class="kpi__label">À renouveler (≤ ${SEUIL_JOURS} j)</span><span class="kpi__value">${aRenouveler}</span><span class="kpi__delta ${aRenouveler ? 'is-down' : 'is-up'}">${aRenouveler ? 'à relancer' : 'à jour'}</span></div>
    <div class="kpi"><span class="kpi__label">Expirés</span><span class="kpi__value">${parStatut('expire')}</span></div></section>
  ${barreOutils(ctx, liste)}
  <div class="callout callout--info">${ctx.icon('clock', 16)}<span>Un document expiré n'est plus opposable en contrôle DDPP : la validité est suivie au jour près et l'inventaire imprimé vaut preuve de suivi.</span></div>
  <section class="section"><div class="section__head"><h2 class="section__title">Classeur sanitaire <span class="badge-count">${visibles.length}</span></h2>
    <span class="section__action unit">Tri : expirés → à renouveler (≤ ${SEUIL_JOURS} j) → valides → sans échéance</span></div>
    <div class="sheet"><div class="sheet__body">${zoneGed(ctx, visibles)}</div></div></section>`;
}

/* Formulaire d'ajout / d'édition */
function corpsFiche(ctx, doc) {
  const opt = (v, l, courant) => `<option value="${esc(v)}"${norm(courant) === norm(v) ? ' selected' : ''}>${esc(l)}</option>`;
  const pieceJointe = Boolean(doc && String(doc.fileData || '').startsWith('data:'));
  const champ = (label, corpsHtml) => `<label class="field"><span class="field__label">${esc(label)}</span>${corpsHtml}</label>`;
  return `<div class="stack">
    ${champ('Nom du document', `<input class="input" type="text" data-champ="nom" maxlength="120" value="${esc(doc ? doc.title : '')}" placeholder="Ex. Attestation formation hygiène alimentaire 2026"><span class="field__hint">Intitulé repris dans le classeur et l'inventaire imprimé.</span>`)}
    <div class="grid grid--2">
      ${champ('Catégorie', `<select class="select" data-champ="categorie">${SAN_DOC_CATEGORIES.map((c) => opt(c.label, c.label, doc ? doc.category : SAN_DOC_CATEGORIES[0].label)).join('')}</select>`)}
      ${champ('Organisme émetteur', `<input class="input" type="text" data-champ="organisme" maxlength="80" value="${esc(doc ? doc.issuer : '')}" placeholder="Ex. Laboratoire Bio Contrôle / 3D Sologne">`)}
    </div>
    <div class="grid grid--2">
      ${champ('Référence interne', `<input class="input" type="text" data-champ="reference" maxlength="60" value="${esc(doc ? doc.reference : '')}" placeholder="Ex. GED-2026-014">`)}
      ${champ('Responsable du suivi', `<input class="input" type="text" data-champ="responsable" maxlength="80" value="${esc(doc ? doc.responsable : '')}" placeholder="Ex. A. Martin, second de cuisine">`)}
    </div>
    <div class="grid grid--2">
      ${champ("Date d'émission", `<input class="input" type="date" data-champ="emission" value="${esc(doc ? isoDe(doc.fileDate) : isoDe(new Date()))}">`)}
      ${champ("Date d'expiration", `<input class="input" type="date" data-champ="expiration" value="${esc(doc ? isoDe(doc.expireDate) : '')}"><span class="field__hint">Laisser vide pour une validité permanente (FDS, rapport d'audit).</span>`)}
    </div>
    ${champ('Observations', `<textarea class="textarea" data-champ="notes" rows="2" maxlength="300" placeholder="Conditions de validité, périodicité de renouvellement…">${esc(doc ? doc.notes : '')}</textarea>`)}
    <div class="grid grid--2">
      ${champ('Lien vers le document', `<input class="input" type="text" data-champ="lien" maxlength="200" value="${esc(doc && !pieceJointe ? (doc.fileData || doc.lien) : '')}" placeholder="https://… (GED fournisseur, extranet labo)">`)}
      <div class="field"><span class="field__label">Pièce jointe</span>
        <label class="zone-upload" for="champ-fichier">${ctx.icon('upload', 16)} <span data-fichier-nom>${pieceJointe ? 'Pièce jointe enregistrée — la remplacer' : 'Déposer ou sélectionner un fichier'}</span></label>
        <input class="input" id="champ-fichier" type="file" data-champ="fichier" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" hidden>
        <span class="field__hint">PDF, image ou tableur — stocké dans le classeur, téléchargeable depuis la fiche.</span></div>
    </div></div>`;
}

function brancherFichier(el) {
  const champ = el.querySelector('[data-champ="fichier"]');
  if (!champ) return;
  champ.addEventListener('change', () => {
    const choix = champ.files && champ.files[0];
    if (!choix) return;
    const lecteur = new FileReader();
    lecteur.addEventListener('load', () => {
      fichier = { nom: choix.name, donnees: String(lecteur.result || '') };
      const etiquette = el.querySelector('[data-fichier-nom]');
      if (etiquette) etiquette.textContent = `${choix.name} (${Math.round(choix.size / 1024)} Ko)`;
    });
    lecteur.readAsDataURL(choix);
  });
}

function ouvrirFiche(ctx, doc) {
  idEdite = doc ? doc.id : null;
  fichier = null;
  panneau = null;
  ctx.ui.panel({
    id: 'document-fiche',
    title: doc ? 'Modifier le document' : 'Ajouter un document',
    subtitle: 'Classeur sanitaire — GED des pièces opposables en contrôle',
    body: corpsFiche(ctx, doc),
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: doc ? 'Enregistrer' : 'Ajouter au classeur', kind: 'primary', onClick: () => enregistrer(ctx) }],
    onMount: (el) => { panneau = el; brancherFichier(el); const n = el.querySelector('[data-champ="nom"]'); if (n) n.focus(); },
    onClose: () => { panneau = null; fichier = null; },
  });
}

function enregistrer(ctx) {
  if (!panneau) return false;
  const lire = (sel) => { const el = panneau.querySelector(sel); return el ? el.value.trim() : ''; };
  const titre = lire('[data-champ="nom"]');
  if (!titre) { ctx.ui.toast({ status: 'warn', message: "L'intitulé du document est obligatoire." }); return false; }
  const donnees = {
    title: titre, category: lire('[data-champ="categorie"]'), issuer: lire('[data-champ="organisme"]'),
    fileDate: isoDe(lire('[data-champ="emission"]')), expireDate: isoDe(lire('[data-champ="expiration"]')),
    notes: lire('[data-champ="notes"]'), fileData: fichier ? fichier.donnees : lire('[data-champ="lien"]'),
  };
  const meta = [['Référence', lire('[data-champ="reference"]')], ['Responsable', lire('[data-champ="responsable"]')],
    ['Lien', lire('[data-champ="lien"]')], ['Pièce jointe', fichier ? fichier.nom : '']];
  const nom = nomOperateur(ctx);
  let id = idEdite;
  if (id) {
    const liste = ctx.repository.getSanitaryDocuments();
    const cible = liste.find((d) => d.id === id);
    if (!cible) { ctx.ui.toast({ status: 'danger', message: 'Document introuvable dans le classeur.' }); return false; }
    Object.assign(cible, donnees);
    ctx.repository.saveSanitaryDocuments(liste);
    journaliser(ctx, 'updateSanitaryDocument', id, encoder([...meta, ['Opérateur', nom]]));
    ctx.ui.toast({ status: 'ok', message: `Document mis à jour : ${titre}` });
  } else {
    const cree = ctx.useCases.addSanitaryDocument(donnees);
    id = cree && cree.id;
    if (!id) { ctx.ui.toast({ status: 'danger', message: 'Ajout refusé par le classeur.' }); return false; }
    journaliser(ctx, 'addSanitaryDocument', id, encoder([...meta, ['Opérateur', nom]]));
    ctx.ui.toast({ status: 'ok', message: `Document versé au classeur : ${titre}` });
  }
  rerendre();
  return true;
}

async function supprimer(ctx, id) {
  const doc = documents(ctx).find((d) => d.id === id);
  if (!doc) return;
  const confirme = await ctx.ui.confirm({
    title: 'Supprimer ce document ?',
    message: `La pièce « ${doc.title || id} » sera retirée du classeur sanitaire. La suppression est journalisée et reste consultable dans le journal d'activité.`,
    confirmLabel: 'Supprimer la pièce', danger: true,
  });
  if (!confirme) return;
  ctx.useCases.deleteSanitaryDocument(id);
  journaliser(ctx, 'deleteSanitaryDocument', id, `${doc.title || id} — ${statutDe(doc).label} — ${nomOperateur(ctx)}`);
  ctx.ui.toast({ status: 'ok', message: 'Document supprimé du classeur.' });
  rerendre();
}

/* Impression : inventaire du classeur et fiche individuelle (feuilles autonomes) */
const mention = `<footer><p>Règlement (CE) n° 852/2004, annexe II — le classeur sanitaire regroupe attestations de formation, contrats d'entretien et de dératisation, résultats d'analyses et certificats de potabilité.</p><p>Une pièce expirée n'est plus opposable : renouveler avant échéance (suivi à ${SEUIL_JOURS} jours).</p></footer>`;
function feuille(titre, etablissement, corps, date, operateurNom, orientation) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}</title><style>
@page { size: A4 ${orientation}; margin: 10mm; }
body { font-family: 'Archivo','Helvetica Neue',Arial,sans-serif; color: #111; margin: 0; padding: 12px; font-size: 10.5px; }
h1 { font-size: 17px; margin: 0 0 2px; } h2 { font-size: 10px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #555; }
div[data-meta] { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #eee; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; } tbody tr:nth-child(even) { background: #f7f7f7; }
dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 12px; margin: 10px 0 0; } dt { font-size: 9px; text-transform: uppercase; color: #666; } dd { margin: 2px 0 0; font-weight: 600; }
div[data-sign] { margin-top: 16px; display: flex; gap: 40px; font-size: 10px; } footer { margin-top: 12px; border-top: 1px solid #999; padding-top: 6px; font-size: 9px; color: #444; } footer p { margin: 0 0 3px; }
</style></head><body>
<h1>${esc(titre)}</h1><h2>${esc((etablissement && etablissement.name) || 'Établissement')} — plan de maîtrise sanitaire</h2>
<div data-meta><span>${esc((etablissement && etablissement.address) || 'Adresse non renseignée')}</span><span>Édité le ${esc(date)} · ${esc(operateurNom)}</span></div>
${corps}${mention}</body></html>`;
}
const etablissementDe = (ctx) => (ctx.account && typeof ctx.account.getEstablishment === 'function' ? ctx.account.getEstablishment() : null) || ctx.establishment || {};
const dateDuJour = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

function inventaire(ctx, liste) {
  const lignes = liste.map((d) => `<tr><td>${esc(d.title || VIDE)}</td><td>${esc(libelleCategorie(d.category))}</td><td>${esc(d.reference || VIDE)}</td><td>${esc(d.issuer || VIDE)}</td><td>${esc(d.fileDate ? ctx.fmt.date(d.fileDate) : VIDE)}</td><td>${esc(d.expireDate ? ctx.fmt.date(d.expireDate) : 'Permanente')}</td><td>${esc(statutDe(d).label)}</td><td>${esc(d.responsable || VIDE)}</td><td>${esc(d.lien || (String(d.fileData || '').startsWith('data:') ? 'Pièce jointe numérique' : 'Papier classé'))}</td></tr>`).join('');
  const corps = `<table><thead><tr><th>Document</th><th>Catégorie</th><th>Référence</th><th>Organisme</th><th>Émission</th><th>Expiration</th><th>Statut</th><th>Responsable</th><th>Pièce</th></tr></thead><tbody>${lignes}</tbody></table>`;
  journaliser(ctx, 'printSanitaryDocuments', 'classeur', encoder([['Inventaire', dateDuJour()], ['Pièces', liste.length], ['Opérateur', nomOperateur(ctx)]]));
  ctx.ui.toast({ status: 'ok', message: `Inventaire de ${liste.length} pièce(s) préparé pour impression.` });
  return ctx.exports.printDocument(feuille('Inventaire des documents sanitaires', etablissementDe(ctx), corps, dateDuJour(), nomOperateur(ctx), 'portrait'), { title: 'Inventaire des documents sanitaires' });
}

function ficheImprimee(ctx, doc) {
  const bloc = (l, v) => `<div><dt>${esc(l)}</dt><dd>${esc(v || VIDE)}</dd></div>`;
  const corps = `<dl>${bloc('Catégorie', libelleCategorie(doc.category))}${bloc('Référence', doc.reference)}${bloc('Organisme émetteur', doc.issuer)}
    ${bloc("Date d'émission", ctx.fmt.date(doc.fileDate))}${bloc("Date d'expiration", doc.expireDate ? ctx.fmt.date(doc.expireDate) : 'Permanente')}${bloc('Statut', statutDe(doc).label)}
    ${bloc('Responsable du suivi', doc.responsable)}${bloc('Pièce', String(doc.fileData || '').startsWith('data:') ? 'Pièce jointe numérique' : (doc.lien || doc.fileData || 'Papier classé'))}${bloc('Observations', doc.notes)}</dl>
    <div data-sign><span>Visa du responsable : ______________________</span><span>Contrôle : ______________________</span></div>`;
  journaliser(ctx, 'printSanitaryDocument', doc.id, encoder([['Impression', dateDuJour()], ['Opérateur', nomOperateur(ctx)]]));
  return ctx.exports.printDocument(feuille(`Fiche document — ${doc.title || doc.id}`, etablissementDe(ctx), corps, dateDuJour(), nomOperateur(ctx), 'portrait'), { title: `Fiche document — ${doc.title || doc.id}` });
}

/* Contrat de vue */
const chercher = (ctx, el) => documents(ctx).find((d) => d.id === el.getAttribute('data-id')) || null;
const ACTIONS = {
  'ajouter-document': (el, root, ctx) => ouvrirFiche(ctx, null),
  'editer-document': (el, root, ctx) => { const d = chercher(ctx, el); if (d) ouvrirFiche(ctx, d); },
  'imprimer-document': (el, root, ctx) => { const d = chercher(ctx, el); if (d) ficheImprimee(ctx, d); },
  'supprimer-document': (el, root, ctx) => supprimer(ctx, el.getAttribute('data-id')),
  'inventaire': (el, root, ctx) => inventaire(ctx, filtrer(documents(ctx))),
};
function reliste(ctx) {
  const html = zoneGed(ctx, filtrer(documents(ctx)));
  hote.querySelectorAll('[data-zone="ged"]').forEach((zone) => { zone.outerHTML = html; });
}
function rerendre() { if (hote && contexte) hote.innerHTML = gabarit(contexte); }

export function render(ctx) { return gabarit(ctx); }

export function mount(root, ctx) {
  generation += 1;
  const jeton = generation;
  hote = root;
  panneau = null; fichier = null; idEdite = null;
  filtreCategorie = 'toutes'; filtreStatut = 'tous'; recherche = '';
  contexte = { ...ctx, ...(ctx.store && typeof ctx.store.getState === 'function' ? ctx.store.getState() : {}) };
  if (ctx.store && typeof ctx.store.subscribe === 'function') {
    abonnement = ctx.store.subscribe(() => { if (jeton === generation && hote && hote.isConnected && !hote.hidden) rerendre(); });
  }
  if (root.getAttribute('data-vue-montee') !== 'documents') {
    root.setAttribute('data-vue-montee', 'documents');
    root.addEventListener('click', (ev) => {
      const cible = ev.target.closest ? ev.target.closest('[data-action]') : null;
      if (!cible || !hote || !root.contains(cible)) return;
      const action = ACTIONS[cible.getAttribute('data-action')];
      if (action) action(cible, root, contexte);
    });
    root.addEventListener('input', (ev) => {
      const champ = ev.target.closest && ev.target.closest('[data-role="recherche"]');
      if (!champ || !hote) return;
      recherche = champ.value;
      reliste(contexte);
    });
    root.addEventListener('change', (ev) => {
      const champ = ev.target.closest && ev.target.closest('[data-filtre]');
      if (!champ || !hote) return;
      if (champ.getAttribute('data-filtre') === 'categorie') filtreCategorie = champ.value;
      else filtreStatut = champ.value;
      reliste(contexte);
    });
  }
  root.innerHTML = render(contexte);
}

export function unmount() {
  generation += 1;
  if (typeof abonnement === 'function') abonnement();
  abonnement = null;
  if (hote) hote.removeAttribute('data-vue-montee');
  hote = null; contexte = null; panneau = null; fichier = null; idEdite = null;
}

export const meta = Object.freeze({
  id: 'documents',
  idx: '12',
  title: 'Documents sanitaires',
  icon: 'folder',
  description: 'Classeur sanitaire (GED) : validité suivie au jour près, pièces jointes et inventaire imprimable.',
});
