/**
 * TraqHACCP — Couche présentation — Vue « Allergènes » (module 06, matrice INCO).
 *
 * Lignes de la matrice = plats ; colonnes = les 14 allergènes réglementaires.
 * Filtre client « que puis-je servir à un client allergique à X ? », fiche d'ajout
 * et d'édition (ctx.ui.panel), suppression confirmée, impression d'une matrice INCO
 * autonome. API : ctx.repository · ctx.useCases · ctx.ui · ctx.account · ctx.exports.
 * design-ignore-file:couleurs — le document imprimé est autonome (feuille interne).
 */
import { ALL_14_ALLERGENS } from '../../domain/constants.js';

/** Familles proposées à la saisie (donnée de présentation, non réglementaire). */
const FAMILLES = ['Entrée', 'Plat Chaud', 'Plat Froid', 'Dessert', 'Accompagnement', 'Sauce', 'Boisson', 'Autre'];

/** Mention légale portée sur la matrice. */
const MENTION_INCO = "Règlement (UE) n° 1169/2011 (INCO), annexe II — les 14 allergènes majeurs doivent être portés à la connaissance du consommateur.";

/* ---- État de vue --------------------------------------------------------- */
let hote = null;          // racine rendue par le routeur
let contexte = null;      // dernier contexte fourni
let abonnement = null;    // désabonnement du store
let generation = 0;       // invalide les rappels d'un montage précédent
let panneau = null;       // formulaire ouvert dans ctx.ui.panel
let filtreFamille = 'toutes';
let filtreClient = null;  // id de l'allergène sélectionné
let recherche = '';

/* ---- Utilitaires --------------------------------------------------------- */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v ?? '').trim().toLowerCase();

const plats = (ctx) => (typeof ctx.repository.getAllergenDishes === 'function' ? ctx.repository.getAllergenDishes() : []) || [];
const categories = (liste) => [...new Set(liste.map((p) => p.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
const trouver = (ctx, id) => plats(ctx).find((p) => p.id === id) || null;

/** Vrai si le plat porte l'allergène (lecture tolérante : libellé, id ou abréviation). */
function porte(plat, allergene) {
  const cles = [allergene.name, allergene.id, allergene.short].map(norm);
  return (plat.allergens || []).some((a) => cles.includes(norm(a)));
}
const servables = (liste, allergene) => liste.filter((p) => !porte(p, allergene));

function operateur(ctx) {
  const op = ctx.account && typeof ctx.account.getCurrentOperator === 'function' ? ctx.account.getCurrentOperator() : null;
  return (op && (op.name || op.displayName)) || 'Opérateur du service';
}

function journaliser(ctx, action, cible, details) {
  if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action, target: cible, details });
}

/* ---- Rendu -------------------------------------------------------------- */
function entete(ctx, liste) {
  const etab = (ctx.establishment && ctx.establishment.name) || 'établissement';
  return `<header class="page-head">
      <span class="page-head__idx">06</span>
      <h1 class="page-head__title">Allergènes</h1>
      <p class="page-head__desc">Matrice INCO — ${liste.length} plat(s) référencé(s) pour ${esc(etab)}. ${esc(MENTION_INCO)}</p>
    </header>`;
}

function barreOutils(ctx, liste) {
  const familles = categories(liste);
  const seg = `<div class="seg"><button class="seg__item${filtreFamille === 'toutes' ? ' is-active' : ''}" type="button" data-action="filtre-famille" data-famille="toutes">Toutes</button>${familles.map((f) => `<button class="seg__item${filtreFamille === f ? ' is-active' : ''}" type="button" data-action="filtre-famille" data-famille="${esc(f)}">${esc(f)}</button>`).join('')}</div>`;
  return `<div class="toolbar">
      <label class="input-group">
        <span class="input-group__prefix">${ctx.icon('search', 16)}</span>
        <input class="input" type="search" data-role="recherche" value="${esc(recherche)}" placeholder="Rechercher un plat…" aria-label="Rechercher un plat">
      </label>
      ${seg}
      <button class="btn btn--primary" type="button" data-action="ajouter-plat">${ctx.icon('plus', 16)} Ajouter un plat</button>
      <button class="btn btn--ghost" type="button" data-action="imprimer-matrice">${ctx.icon('printer', 16)} Imprimer la matrice</button>
    </div>`;
}

function blocClient(ctx, liste, allergene) {
  const compteur = allergene ? servables(liste, allergene).length : liste.length;
  const puces = ALL_14_ALLERGENS.map((a) => `<button class="seg__item${filtreClient === a.id ? ' is-active' : ''}" type="button" data-action="filtre-client" data-allergene="${esc(a.id)}" title="${esc(a.name)}">${esc(a.short)}</button>`).join('');
  return `<div class="section">
      <div class="section__head">
        <h2 class="section__title">Que puis-je servir à un client allergique ?</h2>
        <span class="badge-count">${compteur}</span>
      </div>
      <div class="sheet"><div class="sheet__body">
        <div class="seg"><button class="seg__item${filtreClient ? '' : ' is-active'}" type="button" data-action="filtre-client" data-allergene="">Tous</button>${puces}</div>
        ${allergene
          ? `<div class="callout callout--info"><span>${ctx.icon('alert', 16)}</span><span>Allergène exclu : ${esc(allergene.name)}. <strong>${compteur}</strong> plat(s) sur ${liste.length} restent servables (les lignes concernées sont mises en évidence).</span></div>`
          : `<p class="page-head__desc">Sélectionnez l'allergène à exclure pour connaître les plats servables.</p>`}
      </div></div>
    </div>`;
}

function tableau(ctx, liste, allergene) {
  if (!liste.length) {
    return `<div class="section"><div class="sheet"><div class="sheet__body">${ctx.ui.empty({
      icon: 'wheat',
      title: 'Aucun plat référencé',
      body: 'Ajoutez un premier plat pour construire la matrice des 14 allergènes.',
      actionLabel: 'Ajouter un plat',
      onAction: () => ACTIONS['ajouter-plat'](null, hote, contexte),
    })}</div></div></div>`;
  }
  const entetes = ALL_14_ALLERGENS.map((a) => `<th title="${esc(a.name)}">${esc(a.short)}</th>`).join('');
  const lignes = liste.map((p) => {
    const servable = allergene ? !porte(p, allergene) : false;
    const cases = ALL_14_ALLERGENS.map((a) => (porte(p, a) ? `<td title="${esc(a.name)}"><span class="matrix__on"></span></td>` : `<td title="${esc(a.name)}"><span class="matrix__off"></span></td>`)).join('');
    return `<tr data-nom="${esc(`${p.name} ${p.category || ''}`)}"${servable ? ' class="is-selected"' : ''}>
        <td>${esc(p.name)} <span class="unit">${esc(p.category || '')}</span></td>
        ${cases}
        <td><span class="row row--tight">
          <button class="btn btn--ghost btn--sm" type="button" data-action="editer-plat" data-id="${esc(p.id)}" aria-label="Modifier ${esc(p.name)}">${ctx.icon('edit', 14)}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="supprimer-plat" data-id="${esc(p.id)}" aria-label="Retirer ${esc(p.name)}">${ctx.icon('trash', 14)}</button>
        </span></td>
      </tr>`;
  }).join('');
  return `<div class="section">
      <div class="section__head">
        <h2 class="section__title">Matrice des allergènes</h2>
        <span class="badge-count"><span data-role="compteur-plats">${liste.length}</span></span>
      </div>
      <div class="matrix"><table>
        <thead><tr><th>Plat / Recette</th>${entetes}<th>Actions</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table></div>
    </div>`;
}

export function render(ctx) {
  const liste = plats(ctx);
  const filtree = filtreFamille === 'toutes' ? liste : liste.filter((p) => p.category === filtreFamille);
  const allergene = filtreClient ? ALL_14_ALLERGENS.find((a) => a.id === filtreClient) : null;
  return `${entete(ctx, liste)}${barreOutils(ctx, liste)}${blocClient(ctx, liste, allergene)}${tableau(ctx, filtree, allergene)}`;
}

/* ---- Actions ------------------------------------------------------------ */
function rerendre() {
  if (!hote) return;
  hote.innerHTML = render(contexte);
  appliquerRecherche();
}

function appliquerRecherche() {
  if (!hote) return;
  const texte = norm(recherche);
  let vues = 0;
  for (const ligne of hote.querySelectorAll('[data-nom]')) {
    const ok = !texte || norm(ligne.getAttribute('data-nom')).includes(texte);
    ligne.hidden = !ok;
    if (ok) vues += 1;
  }
  const compteur = hote.querySelector('[data-role="compteur-plats"]');
  if (compteur) compteur.textContent = String(vues);
}

function corpsFiche(ctx, plat) {
  const choisis = { allergens: (plat && plat.allergens) || [] };
  const familles = [...new Set([...FAMILLES, ...categories(plats(ctx))])];
  const cases = ALL_14_ALLERGENS.map((a) => `<label class="checkbox"><input type="checkbox" data-allergene="${esc(a.id)}"${porte(choisis, a) ? ' checked' : ''}><span>${esc(a.name)}</span></label>`).join('');
  const options = familles.map((f) => `<option value="${esc(f)}"${plat && plat.category === f ? ' selected' : ''}>${esc(f)}</option>`).join('');
  return `<div class="stack">
      <label class="field"><span class="field__label">Nom du plat</span>
        <input class="input" type="text" data-champ="nom" maxlength="120" value="${esc(plat ? plat.name : '')}" placeholder="Ex. Risotto crémeux aux Gambas"></label>
      <label class="field"><span class="field__label">Famille</span>
        <select class="select" data-champ="famille">${options}</select></label>
      <div class="field"><span class="field__label">Allergènes présents (14 allergènes INCO)</span>
        <div class="grid grid--2">${cases}</div>
        <span class="field__hint">Cochez chaque allergène présent dans la recette, y compris les traces d'ingrédients composés.</span></div>
      <label class="field"><span class="field__label">Note de fabrication</span>
        <textarea class="textarea" data-champ="note" rows="3" maxlength="240">${esc((plat && plat.note) || '')}</textarea>
        <span class="field__hint">Optionnel — précision pour la brigade (marinade, garniture, substitution).</span></label>
    </div>`;
}

function ouvrirFiche(ctx, plat) {
  const edition = Boolean(plat);
  panneau = null;
  ctx.ui.panel({
    id: 'allergenes-fiche',
    title: edition ? 'Modifier le plat' : 'Ajouter un plat',
    subtitle: 'Matrice INCO',
    body: corpsFiche(ctx, plat),
    actions: [
      { label: 'Annuler', kind: 'ghost' },
      { label: edition ? 'Enregistrer' : 'Ajouter le plat', kind: 'primary', onClick: () => enregistrer(ctx, plat) },
    ],
    onMount: (el) => { panneau = el; const champ = el.querySelector('[data-champ="nom"]'); if (champ) champ.focus(); },
    onClose: () => { panneau = null; },
  });
}

/** Enregistre la fiche ; renvoie `false` pour laisser le panneau ouvert si invalide. */
function enregistrer(ctx, plat) {
  if (!panneau) return false;
  const lire = (sel) => { const el = panneau.querySelector(sel); return el ? el.value : ''; };
  const nom = lire('[data-champ="nom"]').trim();
  if (!nom) { ctx.ui.toast({ status: 'warn', message: 'Le nom du plat est obligatoire.' }); return false; }
  const coches = [...panneau.querySelectorAll('[data-allergene]')].filter((c) => c.checked).map((c) => c.getAttribute('data-allergene'));
  const libelles = ALL_14_ALLERGENS.filter((a) => coches.includes(a.id)).map((a) => a.name);
  const data = { name: nom, category: lire('[data-champ="famille"]') || FAMILLES[0], allergens: libelles, note: lire('[data-champ="note"]').trim() };
  if (plat) ctx.useCases.deleteAllergenDish(plat.id);
  ctx.useCases.addAllergenDish(data);
  conserverNote(ctx, data);
  journaliser(ctx, plat ? 'updateAllergenDish' : 'createAllergenDish', plat ? plat.id : nom, `${libelles.length} allergène(s) déclaré(s) — ${data.category}`);
  ctx.ui.toast({ status: 'ok', message: plat ? `Fiche mise à jour : ${nom}` : `Plat ajouté : ${nom}` });
  rerendre();
  return true;
}

/** L'entité DishAllergens ne porte pas de note : elle est réattachée au plat persisté. */
function conserverNote(ctx, data) {
  if (!data.note || typeof ctx.repository.saveAllergenDishes !== 'function') return;
  const liste = plats(ctx);
  const cible = liste.find((p) => p.name === data.name);
  if (!cible) return;
  cible.note = data.note;
  ctx.repository.saveAllergenDishes(liste);
}

async function supprimer(el, ctx) {
  const plat = trouver(ctx, el.getAttribute('data-id'));
  if (!plat) return;
  const confirme = await ctx.ui.confirm({
    id: 'allergenes-suppression',
    title: 'Retirer ce plat de la matrice ?',
    body: `« ${plat.name} » sera retiré du registre des allergènes. La suppression est journalisée.`,
    confirmLabel: 'Retirer',
    danger: true,
  });
  if (!confirme) return;
  const resultat = await ctx.useCases.deleteAllergenDish(plat.id);
  if (resultat && resultat.ok === false) { ctx.ui.toast({ status: 'danger', message: 'Suppression refusée par le registre.' }); return; }
  journaliser(ctx, 'deleteAllergenDish', plat.id, `${plat.name} (${(plat.allergens || []).length} allergène(s))`);
  ctx.ui.toast({ status: 'ok', message: `Plat retiré : ${plat.name}` });
  rerendre();
}

/** Document imprimé autonome (aucune dépendance à la feuille de l'application). */
function documentMatrice(liste, etablissement, date) {
  const entetes = ALL_14_ALLERGENS.map((a) => `<th>${esc(a.short)}</th>`).join('');
  const lignes = liste.map((p) => `<tr><td>${esc(p.name)}<em>${esc(p.category || '')}</em></td>${ALL_14_ALLERGENS.map((a) => (porte(p, a) ? '<td data-on>X</td>' : '<td data-off>–</td>')).join('')}</tr>`).join('');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Matrice des allergènes</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; color: #111; margin: 0; padding: 18px; font-size: 11px; }
  h1 { font-size: 19px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 11px; margin: 0 0 14px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
  div[data-meta] { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 5px 7px; text-align: center; }
  th:first-child, td:first-child { text-align: left; }
  thead th { background: #ececec; font-size: 10px; }
  thead th:first-child { width: 32%; }
  td em { display: block; font-style: normal; font-size: 9px; color: #666; }
  td[data-on] { font-weight: 700; color: #111; }
  td[data-off] { color: #aaa; }
  footer { margin-top: 14px; border-top: 1px solid #999; padding-top: 8px; font-size: 9.5px; color: #444; }
  footer p { margin: 0 0 3px; }
</style>
</head>
<body>
  <h1>Matrice des allergènes — ${esc((etablissement && etablissement.name) || 'Établissement')}</h1>
  <h2>Déclaration INCO — 14 allergènes majeurs</h2>
  <div data-meta>
    <span>${esc((etablissement && etablissement.address) || 'Adresse non renseignée')}</span>
    <span>Document établi le ${esc(date)} — ${liste.length} plat(s)</span>
  </div>
  <table>
    <thead><tr><th>Plat / Recette</th>${entetes}</tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  <footer>
    <p>${esc(MENTION_INCO)}</p>
    <p>X = allergène présent dans la recette ou dans un ingrédient composé — « – » = non déclaré. À vérifier à chaque évolution de fiche technique.</p>
    <p>Document à tenir à disposition du consommateur et des services de contrôle.</p>
  </footer>
</body>
</html>`;
}

function imprimer(ctx) {
  const liste = plats(ctx);
  const etablissement = ctx.account && typeof ctx.account.getEstablishment === 'function' ? ctx.account.getEstablishment() : (ctx.establishment || {});
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  journaliser(ctx, 'printAllergenMatrix', 'matrice-inco', `${liste.length} plat(s) — ${operateur(ctx)}`);
  ctx.ui.toast({ status: 'ok', message: 'Matrice préparée pour impression.' });
  return ctx.exports.printDocument(documentMatrice(liste, etablissement, date), { title: 'Matrice des allergènes' });
}

const ACTIONS = {
  'ajouter-plat': (el, root, ctx) => ouvrirFiche(ctx, null),
  'editer-plat': (el, root, ctx) => { const plat = trouver(ctx, el.getAttribute('data-id')); if (plat) ouvrirFiche(ctx, plat); },
  'supprimer-plat': (el, root, ctx) => supprimer(el, ctx),
  'filtre-famille': (el, root, ctx) => { filtreFamille = el.getAttribute('data-famille') || 'toutes'; rerendre(); },
  'filtre-client': (el, root, ctx) => { const id = el.getAttribute('data-allergene') || null; filtreClient = filtreClient === id ? null : id; rerendre(); },
  'imprimer-matrice': (el, root, ctx) => imprimer(ctx),
};

/* ---- Contrat de vue ----------------------------------------------------- */
export function mount(root, ctx) {
  generation += 1;
  const jeton = generation;
  hote = root;
  contexte = ctx;
  filtreFamille = 'toutes';
  filtreClient = null;
  recherche = '';
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
  root.addEventListener('input', (ev) => {
    const champ = ev.target.closest && ev.target.closest('[data-role="recherche"]');
    if (!champ) return;
    recherche = champ.value;
    appliquerRecherche();
  });
  root.innerHTML = render(frais);
  appliquerRecherche();
}

export function unmount() {
  generation += 1;
  if (typeof abonnement === 'function') abonnement();
  abonnement = null;
  panneau = null;
  hote = null;
  contexte = null;
}

export const meta = Object.freeze({
  id: 'allergens',
  idx: '06',
  title: 'Allergènes',
  icon: 'wheat',
  description: 'Matrice INCO des 14 allergènes par plat (règlement UE 1169/2011).',
});
