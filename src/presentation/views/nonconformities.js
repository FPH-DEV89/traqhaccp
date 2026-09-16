/**
 * TraqHACCP — Couche présentation — Vue « Non-conformités » (module 13).
 *
 * Registre des écarts avec cycle de vie complet : ouverte → en cours → clôturée (date de
 * clôture, efficacité vérifiée, commentaire). Chaque transition est journalisée via
 * ctx.account.logActivity (traçabilité audit) et rejouée dans la timeline de la fiche.
 * KPI (ouvertes, en retard, clôturées ≤ 30 j, taux), filtres statut / gravité / catégorie /
 * période / en retard + recherche, fiche complète imprimable en recto.
 *
 * Responsable, échéance, coût, pièces jointes, origine et clôture ne sont pas portés par
 * l'entité `NonConformity` : ils sont encodés en clé/valeur dans le détail des entrées du
 * journal (seule écriture hors entité) puis recomposés à la lecture — persistance réelle,
 * y compris après rechargement de l'application.
 * API : ctx.repository · ctx.useCases · ctx.ui · ctx.account · ctx.exports.
 * design-ignore-file:couleurs — la fiche imprimée est autonome (feuille interne).
 */
import { NC_CATEGORIES } from '../../domain/constants.js';

const GRAVITES = [{ id: 'Mineure', label: 'Mineure', mark: 'mark--neutral' }, { id: 'Majeure', label: 'Majeure', mark: 'mark--warn' }, { id: 'Critique', label: 'Critique', mark: 'mark--danger' }];
const STATUTS = [{ id: 'ouverte', label: 'Ouverte', mark: 'mark--danger', valeur: 'Ouverte' }, { id: 'en-cours', label: 'En cours', mark: 'mark--warn', valeur: 'En cours' }, { id: 'cloturee', label: 'Clôturée', mark: 'mark--ok', valeur: 'Clôturée' }];
const DELAI_CLOTURE_J = 30;
const MS_JOUR = 86400000;
const VIDE = '—';
let hote = null, contexte = null, abonnement = null, generation = 0, panneau = null;
let filtreStatut = 'tous', filtreGravite = 'toutes', filtreCategorie = 'toutes', filtrePeriode = '365', filtreRetard = false, recherche = '';

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
const joursEcoules = (v) => { const d = enDate(v); return d ? Math.round((aujour().getTime() - d.getTime()) / MS_JOUR) : null; };
const graviteDe = (v) => GRAVITES.find((g) => norm(g.id) === norm(v)) || { id: String(v || 'Mineure'), label: String(v || 'Mineure'), mark: 'mark--neutral' };
const categorieDe = (v) => NC_CATEGORIES.find((c) => norm(c.id) === norm(v)) || NC_CATEGORIES.find((c) => norm(c.label) === norm(v))
  || NC_CATEGORIES.find((c) => norm(v).length > 4 && norm(c.label).startsWith(norm(v).slice(0, 12))) || null;
const libelleCategorie = (v) => ((categorieDe(v) || {}).label) || (v ? String(v) : 'Non classée');
const statutDe = (nc) => {
  const v = norm(nc && nc.status);
  if (v.startsWith('clot') || v.startsWith('clôt') || v === 'resolu' || v === 'résolu' || v === 'traitee' || v === 'traitée') return STATUTS[2];
  return v.startsWith('en') ? STATUTS[1] : STATUTS[0];
};

/* Journal : transitions + métadonnées en clé/valeur, recomposées à la lecture */
function journaliser(ctx, action, cible, details) {
  if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action, target: cible, details });
}
const encoder = (paires) => paires.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
  .map(([k, v]) => `${k} : ${String(v).replace(/[·\n\r]/g, ' ').replace(/\s+/g, ' ').trim()}`).join(' · ');
function entrees(ctx, id) {
  const journal = (typeof ctx.repository.getActivityLog === 'function' ? ctx.repository.getActivityLog() : []) || [];
  return journal.filter((e) => e && e.target === id).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}
function extras(ctx, id) {
  const lu = {};
  for (const e of entrees(ctx, id)) for (const bloc of String(e.details || '').split(' · ')) { const c = bloc.indexOf(' : '); if (c > 0) lu[bloc.slice(0, c).trim()] = bloc.slice(c + 3).trim(); }
  return { origine: lu['Origine'] || 'Automatique', responsable: lu['Responsable'] || '', echeance: lu['Échéance'] || '', cout: lu['Coût'] || '', pieces: lu['Pièces jointes'] || '', cloture: lu['Clôture'] || '', efficacite: lu['Efficacité vérifiée'] || '', commentaire: lu['Commentaire de clôture'] || '' };
}
function registre(ctx) {
  const brut = (typeof ctx.repository.getNonConformities === 'function' ? ctx.repository.getNonConformities() : []) || [];
  return brut.map((nc) => ({ ...nc, ...extras(ctx, nc.id) })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
const operateur = (ctx) => (ctx.account && typeof ctx.account.getCurrentOperator === 'function' ? ctx.account.getCurrentOperator() : null) || {};
const nomOperateur = (ctx) => operateur(ctx).name || operateur(ctx).displayName || 'Opérateur du service';
const enRetard = (nc) => statutDe(nc).id !== 'cloturee' && joursRestants(nc.echeance) !== null && joursRestants(nc.echeance) < 0;
const indicateurs = (liste) => {
  const cloturees = liste.filter((nc) => statutDe(nc).id === 'cloturee');
  return { retard: liste.filter(enRetard), cloturees30: cloturees.filter((nc) => joursEcoules(nc.cloture || nc.date) <= DELAI_CLOTURE_J), ouvertes: liste.filter((nc) => statutDe(nc).id !== 'cloturee'), taux: liste.length ? Math.round((cloturees.length / liste.length) * 100) : 0 };
};

function filtrer(liste) {
  const q = norm(recherche);
  const limite = filtrePeriode === 'tous' ? null : Number(filtrePeriode);
  return liste.filter((nc) => {
    if (filtreStatut !== 'tous' && statutDe(nc).id !== filtreStatut) return false;
    if (filtreGravite !== 'toutes' && graviteDe(nc.severity).id !== filtreGravite) return false;
    if (filtreCategorie !== 'toutes') { const c = categorieDe(nc.category5M); if (!c || c.id !== filtreCategorie) return false; }
    if (filtreRetard && !enRetard(nc)) return false;
    if (limite !== null) { const j = joursEcoules(nc.date); if (j === null || j > limite) return false; }
    return !q || norm([nc.equipOrSubject, nc.cause, nc.action, nc.operator, nc.responsable, nc.pieces, libelleCategorie(nc.category5M)].join(' ')).includes(q);
  });
}

/* Rendu */
const opt = (v, l, courant) => `<option value="${esc(v)}"${courant === v ? ' selected' : ''}>${esc(l)}</option>`;
const marque = (g) => `<span class="mark ${g.mark}"><span class="mark__label">${esc(g.label)}</span></span>`;
function entete(ctx, liste) {
  const etab = (ctx.establishment && ctx.establishment.name) || 'votre établissement';
  const retard = indicateurs(liste).retard.length;
  return `<header class="page-head"><span class="page-head__idx">13</span><h1 class="page-head__title">Non-conformités</h1>
    <p class="page-head__desc">Registre des écarts de ${esc(etab)} — ${liste.length} fiche(s), cycle ouverte → en cours → clôturée.${retard ? ` <span class="badge-count">${retard}</span> hors délai.` : ''}</p></header>`;
}
function kpis(liste) {
  const { ouvertes, retard, cloturees30, taux } = indicateurs(liste);
  const carte = (label, valeur, unite, delta, sens) => `<div class="kpi"><span class="kpi__label">${esc(label)}</span><span class="kpi__value">${esc(valeur)}${unite ? `<span class="kpi__unit">${esc(unite)}</span>` : ''}</span>${delta ? `<span class="kpi__delta ${sens}">${esc(delta)}</span>` : ''}</div>`;
  return `<section class="grid grid--4">${carte('Non-conformités ouvertes', ouvertes.length)}${carte('En retard sur échéance', retard.length, '', retard.length ? 'à traiter' : 'à jour', retard.length ? 'is-down' : 'is-up')}
    ${carte(`Clôturées (≤ ${DELAI_CLOTURE_J} j)`, cloturees30.length)}${carte('Taux de clôture', taux, ' %')}</section>`;
}
function barreFiltres(ctx) {
  return `<div class="toolbar">
    <label class="input-group"><span class="input-group__prefix">${ctx.icon('search', 16)}</span><input class="input" type="search" data-role="recherche" value="${esc(recherche)}" placeholder="Rechercher un écart, un produit, un responsable…" aria-label="Rechercher une non-conformité"></label>
    <select class="select" data-filtre="statut" aria-label="Filtrer par statut">${opt('tous', 'Tous les statuts', filtreStatut)}${STATUTS.map((s) => opt(s.id, s.label, filtreStatut)).join('')}</select>
    <select class="select" data-filtre="gravite" aria-label="Filtrer par gravité">${opt('toutes', 'Toutes les gravités', filtreGravite)}${GRAVITES.map((g) => opt(g.id, g.label, filtreGravite)).join('')}</select>
    <select class="select" data-filtre="categorie" aria-label="Filtrer par catégorie">${opt('toutes', 'Toutes les catégories', filtreCategorie)}${NC_CATEGORIES.map((c) => opt(c.id, c.label, filtreCategorie)).join('')}</select>
    <select class="select" data-filtre="periode" aria-label="Filtrer par période">${['30', '90', '365', 'tous'].map((p) => opt(p, p === 'tous' ? "Tout l'historique" : `Écarts sur ${p} j`, filtrePeriode)).join('')}</select>
    <label class="checkbox"><input type="checkbox" data-filtre="retard"${filtreRetard ? ' checked' : ''}> En retard uniquement</label>
    <button class="btn btn--primary" type="button" data-action="declarer-nc">${ctx.icon('plus', 16)} Déclarer une non-conformité</button></div>`;
}
function ligneNc(ctx, nc) {
  const retard = enRetard(nc);
  return `<tr data-id="${esc(nc.id)}"><td>${marque(statutDe(nc))}</td><td class="num">${esc(ctx.fmt.date(nc.date))}</td><td>${esc(nc.origine)}</td>
    <td>${esc(libelleCategorie(nc.category5M))}</td><td>${marque(graviteDe(nc.severity))}</td>
    <td><strong>${esc(nc.equipOrSubject || VIDE)}</strong><span class="unit">${esc(String(nc.cause || '').slice(0, 140))}</span></td>
    <td class="unit">${esc(String(nc.action || '').slice(0, 140) || VIDE)}</td><td>${esc(nc.responsable || nc.operator || VIDE)}</td>
    <td class="num">${nc.echeance ? esc(ctx.fmt.date(nc.echeance)) : VIDE}${retard ? ` ${marque({ label: 'En retard', mark: 'mark--danger' })}` : ''}</td>
    <td class="num">${nc.cout ? esc(ctx.fmt.quantity(nc.cout, '€')) : VIDE}</td><td>${esc(nc.operator || VIDE)}</td><td class="unit">${esc(nc.pieces || VIDE)}</td>
    <td class="right"><button class="icon-btn" type="button" data-action="ouvrir-fiche" data-id="${esc(nc.id)}" title="Ouvrir la fiche complète">${ctx.icon('eye', 16)}</button>
      <button class="icon-btn" type="button" data-action="imprimer-fiche" data-id="${esc(nc.id)}" title="Imprimer la fiche (recto)">${ctx.icon('printer', 16)}</button>
      <button class="icon-btn" type="button" data-action="supprimer-nc" data-id="${esc(nc.id)}" title="Supprimer la fiche">${ctx.icon('trash', 16)}</button></td></tr>`;
}
function zoneListe(ctx, liste) {
  if (!liste.length) return `<div data-zone="nc">${ctx.ui.empty({ icon: 'alert', title: 'Aucune non-conformité sur ce filtre', body: 'Déclarez un écart dès sa détection : produit non conforme, rupture de la chaîne du froid, traçabilité incomplète ou plan de nettoyage non respecté.', actionLabel: 'Déclarer une non-conformité', onAction: () => ouvrirDeclaration(ctx) })}</div>`;
  return `<div class="table--scroll" data-zone="nc"><table class="table table--zebra">
    <thead><tr><th>Statut</th><th>Date</th><th>Origine</th><th>Catégorie</th><th>Gravité</th><th>Description</th><th>Action corrective</th><th>Responsable</th><th>Échéance</th><th>Coût</th><th>Opérateur</th><th>Pièces jointes</th><th class="right">Actions</th></tr></thead>
    <tbody>${liste.map((nc) => ligneNc(ctx, nc)).join('')}</tbody></table></div>`;
}
function gabarit(ctx) {
  const liste = registre(ctx), visibles = filtrer(liste), retard = indicateurs(liste).retard.length;
  return `${entete(ctx, liste)}${kpis(liste)}${barreFiltres(ctx)}
  ${retard ? `<div class="callout callout--danger">${ctx.icon('alert', 16)}<span>${retard} non-conformité(s) hors délai : l'action corrective doit être menée, datée et son efficacité vérifiée pour rester opposable en contrôle.</span></div>` : ''}
  <section class="section"><div class="section__head"><h2 class="section__title">Registre des écarts <span class="badge-count">${visibles.length}</span></h2>
    <span class="section__action unit">Échéance de traitement cible : ${DELAI_CLOTURE_J} j</span></div>
    <div class="sheet"><div class="sheet__body">${zoneListe(ctx, visibles)}</div></div></section>`;
}

/* Fiches : déclaration, prise en charge, clôture */
const champ = (label, corpsHtml, aide) => `<label class="field"><span class="field__label">${esc(label)}</span>${corpsHtml}${aide ? `<span class="field__hint">${esc(aide)}</span>` : ''}</label>`;
const lireChamp = (sel) => { const el = panneau && panneau.querySelector(sel); return el ? el.value.trim() : ''; };

function corpsDeclaration() {
  return `<div class="stack">
    <div class="grid grid--2">
      ${champ("Catégorie de l'écart", `<select class="select" data-champ="categorie">${NC_CATEGORIES.map((c) => `<option value="${esc(c.label)}">${esc(c.label)}</option>`).join('')}</select>`)}
      ${champ('Gravité', `<select class="select" data-champ="gravite">${GRAVITES.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select>`, 'Critique = danger immédiat pour le consommateur (produit bloqué, désinfection).')}</div>
    ${champ('Produit, lot ou équipement concerné', `<input class="input" type="text" data-champ="sujet" maxlength="120" placeholder="Ex. Bar de ligne — lot 26-0912 / chambre froide n° 2">`)}
    ${champ("Description de l'écart", `<textarea class="textarea" data-champ="cause" rows="3" maxlength="400" placeholder="Constat daté, quantité concernée, relevé de température ou d'analyse à l'appui."></textarea>`)}
    ${champ('Action corrective immédiate', `<textarea class="textarea" data-champ="action" rows="3" maxlength="300" placeholder="Ex. Lot retiré de la vente et détruit, trace écrite, protocole de nettoyage revu."></textarea>`)}
    <div class="grid grid--3">
      ${champ('Responsable du traitement', `<input class="input" type="text" data-champ="responsable" maxlength="80" placeholder="Ex. A. Martin">`)}
      ${champ('Échéance', `<input class="input" type="date" data-champ="echeance" value="${esc(isoDe(new Date(Date.now() + 7 * MS_JOUR)))}">`)}
      ${champ('Coût estimé (€)', `<input class="input" type="number" min="0" step="0.01" data-champ="cout" placeholder="0">`)}</div>
    ${champ('Pièces jointes', `<input class="input" type="text" data-champ="pieces" maxlength="160" placeholder="Ex. photo-ecart.jpg, rapport-analyse.pdf">`, 'Preuves versées au dossier : photo, analyse, relevé, bon de destruction.')}</div>`;
}

function ouvrirDeclaration(ctx) {
  panneau = null;
  ctx.ui.panel({ id: 'nc-declaration', title: 'Déclarer une non-conformité', subtitle: 'Registre des écarts — cycle ouverte → en cours → clôturée', body: corpsDeclaration(),
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Déclarer', kind: 'primary', onClick: () => declarer(ctx) }],
    onMount: (el) => { panneau = el; const c = el.querySelector('[data-champ="sujet"]'); if (c) c.focus(); }, onClose: () => { panneau = null; } });
}

function declarer(ctx) {
  if (!panneau) return false;
  const sujet = lireChamp('[data-champ="sujet"]'), cause = lireChamp('[data-champ="cause"]');
  if (!sujet || !cause) { ctx.ui.toast({ status: 'warn', message: 'Produit concerné et description sont obligatoires.' }); return false; }
  const nom = nomOperateur(ctx);
  const donnees = { category5M: lireChamp('[data-champ="categorie"]'), severity: lireChamp('[data-champ="gravite"]'), equipOrSubject: sujet, cause, action: lireChamp('[data-champ="action"]'), operator: nom };
  const resultat = ctx.useCases.declareNonConformity(donnees, nom);
  const nc = resultat && resultat.nc ? resultat.nc : resultat;
  if (!nc || !nc.id) { ctx.ui.toast({ status: 'danger', message: 'Déclaration refusée par le registre.' }); return false; }
  journaliser(ctx, 'declareNonConformity', nc.id, encoder([['Origine', 'Saisie manuelle'], ['Gravité', donnees.severity], ['Catégorie', donnees.category5M],
    ['Responsable', lireChamp('[data-champ="responsable"]')], ['Échéance', isoDe(lireChamp('[data-champ="echeance"]'))], ['Coût', lireChamp('[data-champ="cout"]')],
    ['Pièces jointes', lireChamp('[data-champ="pieces"]')], ['Opérateur', nom]]));
  ctx.ui.toast({ status: 'ok', message: `Non-conformité déclarée : ${sujet}` });
  rerendre();
  return true;
}

/** Écrit le statut sur l'entité puis journalise la transition (traçabilité audit). */
function basculer(ctx, nc, statut, action, details) {
  const liste = ctx.repository.getNonConformities();
  const cible = liste.find((n) => n.id === nc.id);
  if (!cible) { ctx.ui.toast({ status: 'danger', message: 'Non-conformité introuvable dans le registre.' }); return false; }
  cible.status = statut.valeur;
  Object.assign(cible, { echeance: nc.echeance, responsable: nc.responsable, cout: nc.cout, cloture: nc.cloture, efficacite: nc.efficacite, commentaire: nc.commentaire, pieces: nc.pieces, origine: nc.origine });
  ctx.repository.saveNonConformities(liste);
  journaliser(ctx, action, nc.id, details);
  return true;
}

function ouvrirSaisie(ctx, nc, mode) {
  panneau = null;
  const cloture = mode === 'cloture';
  const corps = cloture
    ? `<div class="stack">
      ${champ('Date de clôture', `<input class="input" type="date" data-champ="date" value="${esc(isoDe(new Date()))}">`)}
      ${champ("Efficacité de l'action vérifiée", `<select class="select" data-champ="efficacite"><option value="oui">Oui — l'écart ne s'est pas reproduit</option><option value="non">Non — à surveiller</option></select>`, 'Une clôture sans efficacité vérifiée reste ouverte en audit (ISO 22000 §8.9).')}
      ${champ('Commentaire de clôture', `<textarea class="textarea" data-champ="commentaire" rows="3" maxlength="300" placeholder="Preuve d'efficacité : relevés conformes, formation réalisée, fournisseur remplacé…"></textarea>`)}
      ${champ('Coût final (€)', `<input class="input" type="number" min="0" step="0.01" data-champ="cout" value="${esc(nc.cout || '')}">`)}</div>`
    : `<div class="stack">
      ${champ('Date de prise en charge', `<input class="input" type="date" data-champ="date" value="${esc(isoDe(new Date()))}">`)}
      <div class="grid grid--2">${champ('Responsable du traitement', `<input class="input" type="text" data-champ="responsable" maxlength="80" value="${esc(nc.responsable)}">`)}
        ${champ('Échéance', `<input class="input" type="date" data-champ="echeance" value="${esc(isoDe(nc.echeance) || isoDe(new Date(Date.now() + 7 * MS_JOUR)))}">`)}</div>
      ${champ('Action corrective engagée', `<textarea class="textarea" data-champ="action" rows="3" maxlength="300">${esc(nc.action)}</textarea>`)}</div>`;
  ctx.ui.panel({ id: cloture ? 'nc-cloture' : 'nc-prise-en-charge', title: cloture ? 'Clôturer la non-conformité' : 'Prendre en charge',
    subtitle: `${nc.equipOrSubject || 'Écart'} — ${libelleCategorie(nc.category5M)} · ${graviteDe(nc.severity).label}`, body: corps,
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: cloture ? 'Clôturer' : 'Enregistrer la prise en charge', kind: 'primary', onClick: () => (cloture ? cloturer(ctx, nc) : prendreEnCharge(ctx, nc)) }],
    onMount: (el) => { panneau = el; }, onClose: () => { panneau = null; } });
}

function prendreEnCharge(ctx, nc) {
  if (!panneau) return false;
  const responsable = lireChamp('[data-champ="responsable"]');
  if (!responsable) { ctx.ui.toast({ status: 'warn', message: 'Le responsable du traitement est obligatoire.' }); return false; }
  const action = lireChamp('[data-champ="action"]'), echeance = isoDe(lireChamp('[data-champ="echeance"]')), date = isoDe(lireChamp('[data-champ="date"]') || new Date());
  const maj = { ...nc, responsable, action: action || nc.action, echeance, origine: nc.origine };
  if (!basculer(ctx, maj, STATUTS[1], 'updateNonConformity', encoder([['Prise en charge', date], ['Responsable', responsable], ['Échéance', echeance], ['Action corrective', action], ['Opérateur', nomOperateur(ctx)]]))) return false;
  ctx.ui.toast({ status: 'ok', message: `Non-conformité prise en charge par ${responsable}.` });
  rerendre();
  return true;
}

function cloturer(ctx, nc) {
  if (!panneau) return false;
  const date = isoDe(lireChamp('[data-champ="date"]') || new Date());
  const efficacite = lireChamp('[data-champ="efficacite"]') === 'oui' ? 'oui' : 'non';
  const commentaire = lireChamp('[data-champ="commentaire"]');
  if (efficacite === 'oui' && !commentaire) { ctx.ui.toast({ status: 'warn', message: "Preuve d'efficacité à renseigner dans le commentaire de clôture." }); return false; }
  const cout = lireChamp('[data-champ="cout"]') || nc.cout || '';
  if (!basculer(ctx, { ...nc, cout, cloture: date, efficacite, commentaire }, STATUTS[2], 'closeNonConformity', encoder([['Clôture', date], ['Efficacité vérifiée', efficacite], ['Commentaire de clôture', commentaire], ['Coût', cout], ['Opérateur', nomOperateur(ctx)]]))) return false;
  ctx.ui.toast({ status: 'ok', message: 'Non-conformité clôturée et tracée dans le journal.' });
  rerendre();
  return true;
}

function timeline(ctx, nc) {
  const historique = entrees(ctx, nc.id).filter((e) => e.action);
  if (!historique.length) return '<p class="unit">Aucune transition enregistrée : la fiche est à l\'état déclaré.</p>';
  return `<div class="timeline">${historique.map((e) => `<div class="timeline__item"><strong>${esc(e.action)}</strong>
    <span class="unit">${esc(new Date(e.at).toLocaleString('fr-FR'))}${e.operatorName ? ` · ${esc(e.operatorName)}` : ''}</span><p>${esc(e.details || VIDE)}</p></div>`).join('')}</div>`;
}

function blocTransition(ctx, nc) {
  const id = statutDe(nc).id;
  if (id === 'cloturee') return `<p class="unit">Cycle terminé le ${esc(ctx.fmt.date(nc.cloture) || ctx.fmt.date(nc.date))} — efficacité vérifiée : ${esc(nc.efficacite || 'non renseignée')}.</p>`;
  return `<div class="stack"><button class="btn btn--primary" type="button" data-action="${id === 'ouverte' ? 'prendre-en-charge' : 'cloturer-nc'}" data-id="${esc(nc.id)}">${ctx.icon('check', 16)} ${id === 'ouverte' ? 'Prendre en charge' : 'Clôturer la non-conformité'}</button>
    <span class="field__hint">Chaque transition est journalisée (opérateur, horodatage, détail) et rejouée ci-dessus.</span></div>`;
}

function ouvrirFiche(ctx, nc) {
  panneau = null;
  const lignes = [['Statut', statutDe(nc).label], ['Date de déclaration', ctx.fmt.date(nc.date)], ['Origine', nc.origine], ['Catégorie', libelleCategorie(nc.category5M)],
    ['Gravité', graviteDe(nc.severity).label], ['Responsable', nc.responsable], ['Échéance', nc.echeance ? ctx.fmt.date(nc.echeance) : ''], ['Coût', nc.cout ? ctx.fmt.quantity(nc.cout, '€') : ''],
    ['Opérateur déclarant', nc.operator], ['Pièces jointes', nc.pieces], ['Date de clôture', nc.cloture ? ctx.fmt.date(nc.cloture) : ''], ['Efficacité vérifiée', nc.efficacite]];
  const corps = `<div class="stack"><div class="grid grid--3">${lignes.map(([l, v]) => `<div class="kpi"><span class="kpi__label">${esc(l)}</span><span class="kpi__value">${esc(v || VIDE)}</span></div>`).join('')}</div>
    <div class="callout callout--danger"><span><strong>Écart constaté — ${esc(nc.equipOrSubject || VIDE)}</strong><br>${esc(nc.cause || VIDE)}</span></div>
    <div><h3 class="section__title">Action corrective</h3><p>${esc(nc.action || "Aucune action corrective enregistrée — l'écart doit être traité.")}</p></div>
    ${nc.commentaire ? `<div><h3 class="section__title">Commentaire de clôture</h3><p>${esc(nc.commentaire)}</p></div>` : ''}
    <div><h3 class="section__title">Cycle de vie</h3>${timeline(ctx, nc)}</div>${blocTransition(ctx, nc)}</div>`;
  const actions = [{ label: 'Imprimer la fiche', kind: 'ghost', onClick: () => { imprimerFiche(ctx, nc); return false; } }, { label: 'Fermer', kind: 'ghost' }];
  if (statutDe(nc).id === 'ouverte') actions.unshift({ label: 'Prendre en charge', kind: 'primary', onClick: () => { ouvrirSaisie(ctx, nc, 'prise'); return false; } });
  if (statutDe(nc).id === 'en-cours') actions.unshift({ label: 'Clôturer', kind: 'primary', onClick: () => { ouvrirSaisie(ctx, nc, 'cloture'); return false; } });
  ctx.ui.panel({ id: 'nc-fiche', title: 'Fiche de non-conformité', subtitle: `${nc.id} — ${libelleCategorie(nc.category5M)}`, body: corps, actions, onMount: (el) => { panneau = el; }, onClose: () => { panneau = null; } });
}

async function supprimer(ctx, id) {
  const nc = registre(ctx).find((n) => n.id === id);
  if (!nc) return;
  const confirme = await ctx.ui.confirm({ title: 'Supprimer cette non-conformité ?', message: `La fiche « ${nc.equipOrSubject || id} » et son cycle de vie seront retirés du registre. La suppression est journalisée et reste visible en audit.`, confirmLabel: 'Supprimer définitivement', danger: true });
  if (!confirme) return;
  ctx.useCases.deleteNonConformity(id);
  journaliser(ctx, 'deleteNonConformity', id, `${nc.equipOrSubject || id} — ${statutDe(nc).label} — ${nomOperateur(ctx)}`);
  ctx.ui.toast({ status: 'ok', message: 'Non-conformité supprimée du registre.' });
  rerendre();
}

/* Impression : fiche recto autonome (une seule page A4 portrait) */
function imprimerFiche(ctx, nc) {
  const etablissement = (ctx.account && typeof ctx.account.getEstablishment === 'function' ? ctx.account.getEstablishment() : null) || ctx.establishment || {};
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const bloc = (l, v) => `<div><dt>${esc(l)}</dt><dd>${esc(v || VIDE)}</dd></div>`;
  const transitions = entrees(ctx, nc.id).map((e) => `<li><strong>${esc(e.action)}</strong> — ${esc(new Date(e.at).toLocaleString('fr-FR'))}${e.operatorName ? ` (${esc(e.operatorName)})` : ''}<br>${esc(e.details || '')}</li>`).join('') || '<li>Aucune transition enregistrée.</li>';
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Fiche de non-conformité ${esc(nc.id)}</title><style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: 'Archivo','Helvetica Neue',Arial,sans-serif; color: #111; margin: 0; padding: 14px; font-size: 11px; }
h1 { font-size: 19px; margin: 0 0 4px; } h2 { font-size: 10px; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .08em; color: #555; }
div[data-meta] { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 6px; }
dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; margin: 12px 0 0; } dt { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #666; } dd { margin: 2px 0 0; font-weight: 600; }
p.ecart { border: 1px solid #999; background: #f4f4f4; padding: 8px 10px; } ul { margin: 0; padding-left: 16px; } li { margin-bottom: 5px; }
div[data-sign] { margin-top: 18px; display: flex; gap: 40px; font-size: 10px; } footer { margin-top: 12px; border-top: 1px solid #999; padding-top: 6px; font-size: 9px; color: #444; } footer p { margin: 0 0 3px; }
</style></head><body>
<h1>Fiche de non-conformité ${esc(nc.id)}</h1><h2>${esc((etablissement && etablissement.name) || 'Établissement')} — plan de maîtrise sanitaire</h2>
<div data-meta><span>${esc((etablissement && etablissement.address) || 'Adresse non renseignée')}</span><span>Éditée le ${esc(date)} · ${esc(nomOperateur(ctx))}</span></div>
<dl>${bloc('Statut', statutDe(nc).label)}${bloc('Date de déclaration', ctx.fmt.date(nc.date))}${bloc('Origine', nc.origine)}
${bloc('Catégorie', libelleCategorie(nc.category5M))}${bloc('Gravité', graviteDe(nc.severity).label)}${bloc('Responsable du traitement', nc.responsable)}
${bloc('Échéance', nc.echeance ? ctx.fmt.date(nc.echeance) : '')}${bloc('Coût', nc.cout ? ctx.fmt.quantity(nc.cout, '€') : '')}${bloc('Pièces jointes', nc.pieces)}
${bloc('Date de clôture', nc.cloture ? ctx.fmt.date(nc.cloture) : '')}${bloc('Efficacité vérifiée', nc.efficacite)}${bloc('Opérateur déclarant', nc.operator)}</dl>
<h2>Écart constaté</h2><p class="ecart"><strong>${esc(nc.equipOrSubject || VIDE)}</strong><br>${esc(nc.cause || VIDE)}</p>
<h2>Action corrective</h2><p>${esc(nc.action || "Aucune action corrective enregistrée à ce jour.")}</p>
${nc.commentaire ? `<h2>Commentaire de clôture</h2><p>${esc(nc.commentaire)}</p>` : ''}
<h2>Cycle de vie (transitions journalisées)</h2><ul>${transitions}</ul>
<div data-sign><span>Visa du responsable : ______________________</span><span>Contrôle : ______________________</span></div>
<footer><p>Règlement (CE) n° 852/2004, art. 5 — procédures fondées sur les principes HACCP : tout écart doit être corrigé et sa correction documentée.</p>
<p>Fiche conservée au registre des non-conformités — cycle ouverte → en cours → clôturée, efficacité de l'action vérifiée.</p></footer>
</body></html>`;
  journaliser(ctx, 'printNonConformity', nc.id, encoder([['Impression', date], ['Opérateur', nomOperateur(ctx)]]));
  ctx.ui.toast({ status: 'ok', message: 'Fiche de non-conformité préparée pour impression (recto).' });
  return ctx.exports.printDocument(html, { title: `Fiche de non-conformité ${nc.id}` });
}

/* Contrat de vue */
const chercher = (ctx, el) => registre(ctx).find((n) => n.id === el.getAttribute('data-id')) || null;
const ACTIONS = {
  'declarer-nc': (el, root, ctx) => ouvrirDeclaration(ctx),
  'ouvrir-fiche': (el, root, ctx) => { const nc = chercher(ctx, el); if (nc) ouvrirFiche(ctx, nc); },
  'prendre-en-charge': (el, root, ctx) => { const nc = chercher(ctx, el); if (nc) ouvrirSaisie(ctx, nc, 'prise'); },
  'cloturer-nc': (el, root, ctx) => { const nc = chercher(ctx, el); if (nc) ouvrirSaisie(ctx, nc, 'cloture'); },
  'imprimer-fiche': (el, root, ctx) => { const nc = chercher(ctx, el); if (nc) imprimerFiche(ctx, nc); },
  'supprimer-nc': (el, root, ctx) => supprimer(ctx, el.getAttribute('data-id')),
};
function reliste(ctx) {
  const html = zoneListe(ctx, filtrer(registre(ctx)));
  hote.querySelectorAll('[data-zone="nc"]').forEach((zone) => { zone.outerHTML = html; });
}
function rerendre() { if (hote && contexte) hote.innerHTML = gabarit(contexte); }

export function render(ctx) { return gabarit(ctx); }

export function mount(root, ctx) {
  generation += 1;
  const jeton = generation;
  hote = root;
  panneau = null;
  filtreStatut = 'tous'; filtreGravite = 'toutes'; filtreCategorie = 'toutes'; filtrePeriode = '365'; filtreRetard = false; recherche = '';
  contexte = { ...ctx, ...(ctx.store && typeof ctx.store.getState === 'function' ? ctx.store.getState() : {}) };
  if (ctx.store && typeof ctx.store.subscribe === 'function') {
    abonnement = ctx.store.subscribe(() => { if (jeton === generation && hote && hote.isConnected && !hote.hidden) rerendre(); });
  }
  if (root.getAttribute('data-vue-montee') !== 'nonconformities') {
    root.setAttribute('data-vue-montee', 'nonconformities');
    root.addEventListener('click', (ev) => {
      const cible = ev.target.closest ? ev.target.closest('[data-action]') : null;
      if (!cible || !hote || !root.contains(cible)) return;
      const action = ACTIONS[cible.getAttribute('data-action')];
      if (action) action(cible, root, contexte);
    });
    root.addEventListener('input', (ev) => {
      const el = ev.target.closest && ev.target.closest('[data-role="recherche"]');
      if (!el || !hote) return;
      recherche = el.value;
      reliste(contexte);
    });
    root.addEventListener('change', (ev) => {
      const el = ev.target.closest && ev.target.closest('[data-filtre]');
      if (!el || !hote) return;
      const cle = el.getAttribute('data-filtre');
      if (cle === 'retard') filtreRetard = el.checked;
      else if (cle === 'statut') filtreStatut = el.value;
      else if (cle === 'gravite') filtreGravite = el.value;
      else if (cle === 'categorie') filtreCategorie = el.value;
      else filtrePeriode = el.value;
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
  hote = null; contexte = null; panneau = null;
}

export const meta = Object.freeze({
  id: 'nonconformities',
  idx: '13',
  title: 'Non-conformités',
  icon: 'alert',
  description: 'Registre des écarts avec cycle de vie ouverte → en cours → clôturée, KPI, filtres et fiche imprimable.',
});
