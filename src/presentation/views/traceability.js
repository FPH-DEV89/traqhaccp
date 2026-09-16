/**
 * src/presentation/views/traceability.js — Module « DLC et traçabilité » (05).
 * Préparations maison : DLC calculée depuis SHELF_LIFE_PRESETS et la date de fabrication, jours
 * restants, allergènes INCO présents et étiquette imprimable 70 × 50 mm.
 * Contrat : meta / render(ctx) / mount(root, ctx) / unmount(root) — modèle dashboard.js.
 */
import { ALL_14_ALLERGENS, SHELF_LIFE_PRESETS, HACCP_NORMS } from '../../domain/constants.js';
// ── Helpers ───────────────────────────────────────────────────────────────────
const echapper = (v) => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function horodatage(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur.getTime();
  const texte = String(valeur).trim();
  const heure = texte.match(/^(\d{1,2}):(\d{2})/);
  if (heure) { const d = new Date(); d.setHours(Number(heure[1]), Number(heure[2]), 0, 0); return d.getTime(); }
  const ms = Date.parse(texte);
  return Number.isNaN(ms) ? null : ms;
}
function dateFr(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur.getTime();
  const texte = String(valeur).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texte)) return horodatage(texte);
  const parties = texte.split('/');
  if (parties.length === 3) return new Date(Number(parties[2]), Number(parties[1]) - 1, Number(parties[0]), 12, 0, 0).getTime();
  return horodatage(texte);
}
const isoVersFr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? String(iso).split('-').reverse().join('/') : String(iso || ''));
function frVersIso(valeur) {
  const texte = String(valeur || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(texte)) return texte.slice(0, 10);
  const parties = texte.split('/');
  return parties.length === 3 ? `${parties[2]}-${parties[1]}-${parties[0]}` : new Date().toISOString().slice(0, 10);
}
function ajouterJours(iso, jours) {
  const base = new Date(`${frVersIso(iso)}T12:00:00`);
  base.setDate(base.getDate() + (Number(jours) || 0));
  return base.toLocaleDateString('fr-FR');
}
const dateLisible = (ctx, valeur) => { if (!valeur) return '—'; const texte = String(valeur); return echapper(/^\d{4}-\d{2}-\d{2}/.test(texte) ? ctx.fmt.date(texte) : texte); };
function nomOperateur(ctx) {
  const courant = (ctx.store && ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null;
  if (courant && courant.name) return courant.name;
  const etat = (ctx.store && ctx.store.getState && ctx.store.getState()) || {};
  if (ctx.account && typeof ctx.account.getOperatorName === 'function') return ctx.account.getOperatorName((etat.currentOperator || {}).id) || 'Opérateur';
  return 'Opérateur';
}
/** DLC en ms : date étiquetée, sinon fabrication + durée du barème (SHELF_LIFE_PRESETS). */
function dlcDe(preparation) {
  const stockee = dateFr(preparation.dlcDate);
  if (stockee !== null) return stockee;
  const fabrication = dateFr(preparation.fabDate);
  const jours = Number(preparation.durationDays);
  return fabrication === null || !Number.isFinite(jours) ? null : fabrication + jours * 86400000;
}
/** Heures restantes avant la fin de la journée de DLC (valeur négative = DLC dépassée). */
function heuresRestantes(preparation) {
  const dlc = dlcDe(preparation);
  return dlc === null ? null : (dlc + 43200000 - Date.now()) / 3600000;
}
const joursRestants = (preparation) => { const heures = heuresRestantes(preparation); return heures === null ? null : Math.floor(heures / 24); };
/** Résolution d'un allergène enregistré (identifiant, libellé court ou complet). */
function allergeneDe(reference) {
  const texte = String(reference || '').toLowerCase();
  return ALL_14_ALLERGENS.find((a) => a.id.toLowerCase() === texte || a.short.toLowerCase() === texte || a.name.toLowerCase() === texte) || null;
}
const libelleAllergene = (reference) => { const allergene = allergeneDe(reference); return allergene ? allergene.short : String(reference || ''); };
const normeFroid = HACCP_NORMS.TEMPERATURES.FROID_POSITIF_VIANDES;
const consigneParDefaut = () => `À conserver entre ${normeFroid.min.toLocaleString('fr-FR')} °C et +${normeFroid.max.toLocaleString('fr-FR')} °C, à consommer avant la DLC portée sur l'étiquette.`;
// ── État de vue (conservé d'une visite à l'autre) + lecture des données ───────
const UNITES = ['kg', 'g', 'L', 'cl', 'pièce(s)', 'barquette(s)'];
let filtreTexte = ''; let filtre48 = false; let triParDlc = false;
let panneau = null; let photoEnAttente = ''; let generation = 0; let abonnement = null;
function toutesLesPreparations(ctx) {
  const depot = ctx.repository;
  return ((depot && depot.getPreparations && depot.getPreparations()) || []).slice();
}
function preparationsFiltrees(ctx) {
  const texte = filtreTexte.trim().toLowerCase();
  const liste = toutesLesPreparations(ctx).filter((p) => {
    if (texte && !`${p.name || ''} ${p.batch || ''}`.toLowerCase().includes(texte)) return false;
    if (filtre48) { const heures = heuresRestantes(p); if (heures === null || heures >= 48) return false; }
    return true;
  });
  return triParDlc ? liste.sort((a, b) => (dlcDe(a) ?? Infinity) - (dlcDe(b) ?? Infinity)) : liste;
}
function donnees(ctx) {
  const liste = preparationsFiltrees(ctx);
  const restantes = liste.map(heuresRestantes);
  const alertes = liste.filter((p) => { const jours = joursRestants(p); return jours !== null && jours <= 1; }).length;
  return { liste, dans48h: restantes.filter((h) => h !== null && h < 48).length, alertes };
}
// ── Fragments d'interface ─────────────────────────────────────────────────────
function blocFiltres(ctx, d) {
  const seg = (actif, action, valeur, label) => `<button class="seg__item${actif ? ' is-active' : ''}" type="button" data-action="${action}" data-valeur="${valeur}">${label}</button>`;
  const kpi = (label, valeur, unite) => `<div class="kpi"><span class="kpi__label">${label}</span><span class="kpi__value">${valeur}</span><span class="kpi__unit">${unite}</span></div>`;
  return `<div class="toolbar">
    <button class="btn btn--primary" type="button" data-action="nouvelle-preparation">${ctx.icon('plus', 16)} Nouvelle préparation</button>
    <button class="btn btn--ghost" type="button" data-action="export-csv">${ctx.icon('download', 16)} Export CSV</button>
    <label class="field"><span class="field__label">Recherche</span><input class="input" type="search" data-saisie="recherche" value="${echapper(filtreTexte)}" placeholder="Nom ou n° de lot"></label>
    <div class="seg">${seg(!filtre48, 'filtre-48h', 'toutes', 'Toutes')}${seg(filtre48, 'filtre-48h', '48h', 'DLC < 48 h')}</div>
    <div class="seg">${seg(!triParDlc, 'tri-dlc', 'recentes', 'Plus récentes')}${seg(triParDlc, 'tri-dlc', 'dlc', 'Tri par DLC')}</div></div>
    <div class="grid grid--3">
      ${kpi('Préparations suivies', d.liste.length, 'étiquettes actives')}${kpi('DLC à 48 h ou moins', d.dans48h, 'à écouler')}
      ${kpi('DLC à 1 jour ou moins', d.alertes, 'priorité service')}</div>`;
}
/** Jours restants en chiffres monospacés : .is-danger ≤ 1 j, .is-warn ≤ 3 j. */
function celluleJours(ctx, preparation) {
  const jours = joursRestants(preparation);
  if (jours === null) return '<span class="muted">—</span>';
  const classe = jours <= 1 ? 'is-danger' : (jours <= 3 ? 'is-warn' : '');
  const texte = jours < 0 ? `DLC dépassée (${Math.abs(jours)} j)` : (jours === 0 ? "aujourd'hui" : `${jours} j`);
  return `<span class="num ${classe}">${echapper(texte)}</span>`;
}
/** Allergènes présents : une .mark par allergène, limitée à 4 + compteur. */
function celluleAllergenes(ctx, preparation) {
  const liste = Array.isArray(preparation.allergens) ? preparation.allergens : [];
  if (!liste.length) return '<span class="muted">aucun</span>';
  const marques = liste.slice(0, 4).map((reference) => `<span class="mark mark--neutral"><span class="mark__label">${echapper(libelleAllergene(reference))}</span></span>`).join(' ');
  return marques + (liste.length > 4 ? ` <span class="unit">+${liste.length - 4}</span>` : '');
}
function blocListe(ctx, d) {
  if (!d.liste.length) return ctx.ui.empty({ icon: 'tag', title: 'Aucune préparation sur ce filtre', actionLabel: 'Nouvelle préparation', onAction: () => ouvrirPanneau(ctx), body: 'Modifie la recherche ou enregistre une première préparation étiquetée.' });
  const lignes = d.liste.map((p) => {
    const photo = p.photo ? `<button class="btn btn--ghost btn--sm" type="button" data-action="voir-photo" data-id="${echapper(p.id)}">Voir</button>` : '<span class="muted">—</span>';
    return `<tr data-id="${echapper(p.id)}">
      <td>${echapper(p.name || '—')}</td><td><span class="num">${echapper(p.batch || '—')}</span></td><td>${dateLisible(ctx, p.fabDate)}</td><td>${dateLisible(ctx, p.dlcDate)}</td>
      <td>${celluleJours(ctx, p)}</td><td>${celluleAllergenes(ctx, p)}</td><td>${photo}</td><td>${echapper(p.operator || '—')}</td>
      <td><button class="btn btn--ghost btn--sm" type="button" data-action="apercu-etiquette" data-id="${echapper(p.id)}">Étiquette</button>
        <button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="supprimer-preparation" data-id="${echapper(p.id)}">Supprimer</button></td></tr>`;
  }).join('');
  return `<div class="table--scroll"><table class="table table--compact table--zebra">
      <thead><tr><th>Préparation</th><th>Lot</th><th>Fabrication</th><th>DLC</th><th>Jours restants</th><th>Allergènes présents</th><th>Photo</th><th>Opérateur</th><th>Actions</th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`;
}
// ── Contrat de vue ────────────────────────────────────────────────────────────
export const meta = { id: 'traceability', idx: '05', icon: 'tag', title: 'DLC et traçabilité', desc: 'Étiquetage, décongélation, préparations', permissions: null };
export function render(ctx) {
  const d = donnees(ctx);
  const bareme = SHELF_LIFE_PRESETS.map((p) => `J+${p.value}`).join(' / ');
  return `<header class="page-head">
      <span class="page-head__idx">05</span><h1 class="page-head__title">DLC et traçabilité</h1>
      <p class="page-head__desc">Préparations maison : DLC calculées depuis le barème sanitaire, allergènes INCO et étiquettes 70 × 50 mm.</p></header>
    <div data-zone="filtres">${blocFiltres(ctx, d)}</div>
    <section class="section"><div class="section__head"><h2 class="section__title">Préparations étiquetées</h2>
      <span class="unit">Barème ${bareme} — ${d.liste.length} préparation(s)</span></div>
      <div data-zone="liste">${blocListe(ctx, d)}</div></section>`;
}
// ── Panneau « Nouvelle préparation » ─────────────────────────────────────────
const blocChamp = (nom, label, contenu, cle) => `<div class="field"><label class="field__label" for="${nom}">${label}</label>${contenu}<span class="field__error" data-erreur="${cle}"></span></div>`;
/** Identifiant lisible du type P-20260916-01 (date de fabrication + rang du jour). */
function identifiantLot(ctx, iso) {
  const fr = isoVersFr(iso);
  const rang = toutesLesPreparations(ctx).filter((p) => String(p.fabDate || '') === fr).length + 1;
  return `P-${frVersIso(iso).replace(/-/g, '')}-${String(rang).padStart(2, '0')}`;
}
function blocFormulaire(ctx) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const maintenant = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const bareme = SHELF_LIFE_PRESETS.map((p) => `<option value="${p.value}">${echapper(p.label)}</option>`).join('');
  const unites = UNITES.map((u) => `<option value="${u}">${u}</option>`).join('');
  const cases = ALL_14_ALLERGENS.map((a) => `<label class="checkbox"><input type="checkbox" name="allergene" value="${a.id}"><span>${echapper(a.short)}</span></label>`).join('');
  return `<div class="stack">
    ${blocChamp('prep-nom', 'Dénomination de la préparation', '<input class="input" id="prep-nom" name="nom" placeholder="Ex. bœuf bourguignon">', 'nom')}
    <div class="grid grid--2">
      ${blocChamp('prep-categorie', 'Catégorie DLC (pilote la durée de vie)', `<select class="select" id="prep-categorie" name="categorie">${bareme}</select>`, 'categorie')}
      ${blocChamp('prep-lot', 'N° de lot', `<input class="input" id="prep-lot" name="lot" value="${echapper(identifiantLot(ctx, aujourdhui))}">`, 'lot')}
      ${blocChamp('prep-fabrication', 'Date de fabrication', `<input class="input" type="date" id="prep-fabrication" name="fabrication" value="${aujourdhui}">`, 'fabrication')}
      ${blocChamp('prep-heure', 'Heure de fabrication', `<input class="input" type="time" id="prep-heure" name="heureFabrication" value="${maintenant}">`, 'heureFabrication')}
      ${blocChamp('prep-quantite', 'Quantité produite', '<input class="input" type="number" step="0.1" inputmode="decimal" id="prep-quantite" name="quantite" value="1">', 'quantite')}
      ${blocChamp('prep-unite', 'Unité de conditionnement', `<select class="select" id="prep-unite" name="unite">${unites}</select>`, 'unite')}</div>
    <div data-zone="dlc">${blocDlc(aujourdhui, SHELF_LIFE_PRESETS[0].value)}</div>
    <div class="field"><span class="field__label">Allergènes présents (14 allergènes INCO)</span><div class="grid grid--3">${cases}</div></div>
    ${blocChamp('prep-conservation', 'Consigne de conservation', `<textarea class="textarea" id="prep-conservation" name="conservation">${echapper(consigneParDefaut())}</textarea>`, 'conservation')}
    <div><button class="btn btn--ghost" type="button" data-action="photo-preparation">${ctx.icon('camera', 16)} Joindre une photo</button><div data-zone="apercu-photo"></div></div></div>`;
}
/** DLC calculée affichée dans le formulaire : fabrication + durée du barème sélectionné. */
const blocDlc = (fabrication, duree) => `<div class="callout callout--info">DLC calculée : ${echapper(ajouterJours(fabrication, duree))} (fabrication + ${echapper(String(duree))} jour(s) — barème SHELF_LIFE_PRESETS).</div>`;
function brancherDlc(ctx, racine) {
  if (!racine || typeof racine.querySelector !== 'function') return;
  const champDate = racine.querySelector('[name="fabrication"]');
  const champDuree = racine.querySelector('[name="categorie"]');
  const zone = racine.querySelector('[data-zone="dlc"]');
  if (!champDate || !champDuree || !zone) return;
  const maj = () => { zone.innerHTML = blocDlc(champDate.value, champDuree.value); };
  champDate.addEventListener('change', maj);
  champDuree.addEventListener('change', maj);
}
function ouvrirPanneau(ctx) {
  panneau = null; photoEnAttente = '';
  ctx.ui.panel({
    id: 'preparation-nouvelle', title: 'Nouvelle préparation', subtitle: 'Étiquetage, DLC et allergènes', body: blocFormulaire(ctx),
    onMount: (racine) => { panneau = racine || null; brancherDlc(ctx, panneau); },
    onClose: () => { panneau = null; photoEnAttente = ''; },
    actions: [
      { label: 'Enregistrer', kind: 'primary', onClick: (cible) => enregistrer(ctx, cible, false) },
      { label: 'Enregistrer et imprimer', kind: 'primary', onClick: (cible) => enregistrer(ctx, cible, true) },
      { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay() }],
  });
}
// ── Saisie du formulaire ──────────────────────────────────────────────────────
function racineDe(candidat) {
  if (candidat && typeof candidat.querySelector === 'function' && candidat.querySelector('input, textarea, select')) return candidat;
  return panneau && typeof panneau.querySelector === 'function' ? panneau : null;
}
function valeurChamp(racine, nom) { const cible = racine.querySelector(`[name="${nom}"]`); return cible ? String(cible.value || '').trim() : ''; }
function nombreChamp(racine, nom) {
  const brut = valeurChamp(racine, nom).replace(',', '.');
  if (brut === '') return null;
  const valeur = Number(brut);
  return Number.isFinite(valeur) ? valeur : null;
}
function signalerErreur(racine, cle, message) {
  const zone = racine.querySelector(`[data-erreur="${cle}"]`); if (zone) zone.textContent = message;
  const cible = racine.querySelector(`[name="${cle}"]`); if (cible && typeof cible.focus === 'function') cible.focus();
}
function enregistrer(ctx, candidat, imprimer) {
  const racine = racineDe(candidat);
  if (!racine) { ctx.ui.toast({ status: 'warn', message: 'Formulaire indisponible' }); return; }
  const nom = valeurChamp(racine, 'nom');
  if (!nom) return signalerErreur(racine, 'nom', 'Indique la dénomination de la préparation.');
  const iso = frVersIso(valeurChamp(racine, 'fabrication'));
  const duree = Number(valeurChamp(racine, 'categorie')) || SHELF_LIFE_PRESETS[0].value;
  const quantite = nombreChamp(racine, 'quantite');
  const unite = valeurChamp(racine, 'unite') || UNITES[0];
  const lot = valeurChamp(racine, 'lot') || identifiantLot(ctx, iso);
  const allergenes = [...racine.querySelectorAll('[name="allergene"]:checked')].map((el) => el.value);
  const operateur = nomOperateur(ctx);
  const data = {
    name: nom, batch: lot, fabDate: isoVersFr(iso), dlcDate: ajouterJours(iso, duree), durationDays: duree,
    quantity: quantite === null ? '—' : `${quantite.toLocaleString('fr-FR')} ${unite}`, allergens: allergenes, operator: operateur,
    fabTime: valeurChamp(racine, 'heureFabrication'), unit: unite, category: String(duree),
    conservation: valeurChamp(racine, 'conservation') || consigneParDefaut(), photo: photoEnAttente,
  };
  const resultat = ctx.useCases.createPreparationLabel(data, operateur);
  conserverComplements(ctx, (resultat && resultat.preparation) || resultat, data, lot);
  ctx.ui.closeOverlay();
  photoEnAttente = '';
  ctx.ui.toast({ status: 'ok', message: `Préparation ${lot} enregistrée — DLC ${data.dlcDate}` });
  if (imprimer) ouvrirEtiquette(ctx, (resultat && resultat.preparation) || resultat, lot);
}
/** Conserve les compléments descriptifs saisis (hors contrat PreparationRecord). */
function conserverComplements(ctx, preparation, data, lot) {
  const depot = ctx.repository;
  if (!depot || typeof depot.getPreparations !== 'function' || typeof depot.savePreparations !== 'function') return;
  const liste = depot.getPreparations() || [];
  const cible = liste.find((p) => p.id === (preparation && preparation.id)) || liste.slice().reverse().find((p) => p.batch === lot);
  if (!cible) return;
  ['fabTime', 'unit', 'category', 'conservation', 'photo'].forEach((cle) => { cible[cle] = data[cle]; });
  depot.savePreparations(liste);
}
const chercherPreparation = (ctx, id) => toutesLesPreparations(ctx).find((p) => p.id === id) || null;
/** Étiquette officielle (infrastructure/export_service) avec repli lisible local. */
function etiquetteHtml(ctx, preparation) {
  const app = ctx.app || ctx;
  if (ctx.exports && typeof ctx.exports.labelHtml === 'function') {
    try { return ctx.exports.labelHtml(preparation, app); } catch (erreur) { /* repli lisible ci-dessous */ }
  }
  const allergenes = (Array.isArray(preparation.allergens) ? preparation.allergens : []).map(libelleAllergene).join(', ') || 'aucun';
  return `<article><h1>${echapper(preparation.name || 'Préparation')}</h1><p>Lot ${echapper(preparation.batch || '—')}</p><p>DLC ${dateLisible(ctx, preparation.dlcDate)}</p><p>Allergènes : ${echapper(allergenes)}</p><p>${echapper(consigneParDefaut())}</p></article>`;
}
function imprimer(ctx, preparation) {
  if (!ctx.exports || typeof ctx.exports.printDocument !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Impression indisponible' }); return; }
  try {
    ctx.exports.printDocument(etiquetteHtml(ctx, preparation), { title: `Étiquette ${preparation.name || ''}`, autoPrint: true });
    ctx.ui.toast({ status: 'ok', message: "Étiquette envoyée à l'impression" });
  } catch (erreur) { ctx.ui.toast({ status: 'danger', message: 'Impression impossible' }); }
}
function ouvrirEtiquette(ctx, preparation, lot) {
  const cible = preparation && preparation.id ? preparation : toutesLesPreparations(ctx).slice().reverse().find((p) => p.batch === lot);
  if (!cible) { ctx.ui.toast({ status: 'warn', message: 'Préparation introuvable' }); return; }
  const marque = (reference) => `<span class="mark mark--neutral"><span class="mark__label">${echapper(libelleAllergene(reference))}</span></span>`;
  const allergenes = (Array.isArray(cible.allergens) ? cible.allergens : []).map(marque).join(' ');
  const corps = `<div class="stack">
      <div class="receipt"><iframe title="Aperçu de l'étiquette 70 × 50 mm" width="265" height="189" srcdoc="${echapper(etiquetteHtml(ctx, cible))}"></iframe></div>
      <p class="field__hint">Étiquette 70 × 50 mm à l'échelle 1:1 — lot ${echapper(cible.batch || '—')}, DLC ${dateLisible(ctx, cible.dlcDate)}, fabricée le ${dateLisible(ctx, cible.fabDate)}.</p>
      <div class="field"><span class="field__label">Allergènes figurant sur l'étiquette</span><div>${allergenes || '<span class="muted">aucun allergène déclaré</span>'}</div></div>
      <div class="field"><span class="field__label">Consigne de conservation</span><p class="field__hint">${echapper(cible.conservation || consigneParDefaut())}</p></div></div>`;
  ctx.ui.panel({
    id: 'traceability-etiquette', title: "Aperçu de l'étiquette", subtitle: cible.name || '', body: corps,
    actions: [{ label: "Imprimer l'étiquette", kind: 'primary', onClick: () => imprimer(ctx, cible) }, { label: 'Fermer', kind: 'ghost', onClick: () => ctx.ui.closeOverlay() }],
  });
}
function ouvrirPhoto(ctx, id) {
  const preparation = chercherPreparation(ctx, id);
  if (!preparation || !preparation.photo) { ctx.ui.toast({ status: 'warn', message: 'Aucune photo pour cette préparation' }); return; }
  ctx.ui.panel({
    id: 'preparation-photo', title: 'Photo de la préparation', subtitle: preparation.name || '', body: ctx.ui.photo(preparation.photo, `Lot ${preparation.batch || '—'}`),
    actions: [{ label: 'Fermer', kind: 'ghost', onClick: () => ctx.ui.closeOverlay() }],
  });
}
function ouvrirCamera(ctx) {
  if (!ctx.ui || typeof ctx.ui.camera !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Appareil photo indisponible' }); return; }
  ctx.ui.camera({
    onCapture: (source) => {
      photoEnAttente = typeof source === 'string' ? source : (source && source.dataUrl) || '';
      const zone = panneau && panneau.querySelector('[data-zone="apercu-photo"]');
      if (zone) zone.innerHTML = photoEnAttente ? ctx.ui.photo(photoEnAttente, 'Photo de la préparation') : '';
      ctx.ui.toast({ status: 'ok', message: 'Photo jointe à la préparation' });
    },
  });
}
async function supprimer(ctx, id, root) {
  const preparation = chercherPreparation(ctx, id);
  const nom = preparation ? `${preparation.name || 'la préparation'} (lot ${preparation.batch || '—'})` : 'cette préparation';
  const confirme = await ctx.ui.confirm({ title: 'Supprimer la préparation', confirmLabel: 'Supprimer', danger: true, body: `La suppression de ${nom} retire l'étiquette et sa traçabilité du registre.` });
  if (!confirme) return;
  ctx.useCases.deletePreparation(id);
  ctx.ui.toast({ status: 'ok', message: 'Préparation supprimée' });
  rafraichirListe(root, root.__contexte || ctx);
}
function exporter(ctx) {
  if (!ctx.exports || typeof ctx.exports.exportRecordsCsv !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Export indisponible' }); return; }
  try {
    ctx.exports.exportRecordsCsv(ctx.app || ctx, { type: 'preparations' });
    ctx.ui.toast({ status: 'ok', message: 'Export CSV des préparations généré' });
  } catch (erreur) { ctx.ui.toast({ status: 'danger', message: 'Export CSV impossible' }); }
}
// ── Câblage ───────────────────────────────────────────────────────────────────
const ACTIONS = {
  'nouvelle-preparation': (el, root, ctx) => ouvrirPanneau(ctx),
  'export-csv': (el, root, ctx) => exporter(ctx),
  'filtre-48h': (el, root, ctx) => { filtre48 = el.dataset.valeur === '48h'; rafraichir(root, ctx); },
  'tri-dlc': (el, root, ctx) => { triParDlc = el.dataset.valeur === 'dlc'; rafraichir(root, ctx); },
  'apercu-etiquette': (el, root, ctx) => ouvrirEtiquette(ctx, chercherPreparation(ctx, el.dataset.id)),
  'voir-photo': (el, root, ctx) => ouvrirPhoto(ctx, el.dataset.id),
  'photo-preparation': (el, root, ctx) => ouvrirCamera(ctx),
  'supprimer-preparation': (el, root, ctx) => { supprimer(ctx, el.dataset.id, root); },
};
function rafraichirListe(root, ctx) {
  const zone = root.querySelector('[data-zone="liste"]');
  if (zone) zone.innerHTML = blocListe(ctx, donnees(ctx));
}
function rafraichir(root, ctx) {
  const frais = { ...ctx, ...ctx.store.getState() };
  root.__contexte = frais;
  const zone = root.querySelector('[data-zone="filtres"]');
  if (zone) zone.innerHTML = blocFiltres(frais, donnees(frais));
  rafraichirListe(root, frais);
}
function attacher(root, ctx) {
  root.__contexte = ctx;
  if (root.dataset.liens === 'v1') return;
  root.dataset.liens = 'v1';
  root.addEventListener('click', (evenement) => {
    const el = evenement.target.closest && evenement.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const action = ACTIONS[el.dataset.action];
    if (action) action(el, root, root.__contexte || ctx);
  });
  root.addEventListener('input', (evenement) => {
    const el = evenement.target.closest && evenement.target.closest('[data-saisie="recherche"]');
    if (!el || !root.contains(el)) return;
    filtreTexte = el.value;
    rafraichirListe(root, root.__contexte || ctx);
  });
}
export function mount(root, ctx) {
  const maGeneration = ++generation;
  attacher(root, ctx);
  abonnement = ctx.store.subscribe(() => { if (maGeneration === generation && root.isConnected && !root.hidden) rafraichir(root, root.__contexte || ctx); });
}
export function unmount(root) {
  generation += 1;
  if (abonnement) { abonnement(); abonnement = null; }
  panneau = null;
  if (root && typeof root.removeEventListener === 'function') { delete root.dataset.liens; delete root.__contexte; }
}
