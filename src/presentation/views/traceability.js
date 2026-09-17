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
    if (texte && !`${p.name || ''} ${p.batch || ''} ${p.destinationClient || ''} ${p.destinationRecipe || ''}`.toLowerCase().includes(texte)) return false;
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
  return `<div class="stack stack--sm">
    <div class="trace-action-card" data-action="nouvelle-preparation" role="button" tabindex="0" aria-label="Prendre en photo une étiquette produit">
      <div class="trace-action-card__icon">${ctx.icon('camera', 28)}</div>
      <div class="trace-action-card__title">Prendre une étiquette en photo</div>
      <p class="trace-action-card__sub">Photographiez l'étiquette de votre produit acheté et indiquez le client ou la recette pour la traçabilité.</p>
      <button class="btn btn--primary" type="button" data-action="nouvelle-preparation">${ctx.icon('plus', 16)} Nouvelle étiquette</button>
    </div>

    <div class="toolbar">
      <div class="row row--sm" style="flex: 1; min-width: 220px;">
        <label class="field" style="width: 100%;"><span class="field__label">Rechercher</span><input class="input" type="search" data-saisie="recherche" value="${echapper(filtreTexte)}" placeholder="Client, recette, produit, lot..."></label>
      </div>
      <div class="seg">${seg(!filtre48, 'filtre-48h', 'toutes', 'Toutes')}${seg(filtre48, 'filtre-48h', '48h', 'DLC &lt; 48 h')}</div>
      <div class="seg">${seg(!triParDlc, 'tri-dlc', 'recentes', 'Récentes')}${seg(triParDlc, 'tri-dlc', 'dlc', 'DLC')}</div>
      <button class="btn btn--ghost btn--sm" type="button" data-action="export-csv">${ctx.icon('download', 16)} Export CSV</button>
    </div>

    <div class="grid grid--3">
      ${kpi('Étiquettes enregistrées', d.liste.length, 'produits tracés')}
      ${kpi('DLC sous 48 h', d.dans48h, 'à surveiller')}
      ${kpi('Urgentes (≤ 1 j)', d.alertes, 'priorité')}
    </div>
  </div>`;
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
  if (!liste.length) return '<span class="muted">aucun allergène</span>';
  const marques = liste.slice(0, 4).map((reference) => `<span class="mark mark--neutral"><span class="mark__label">${echapper(libelleAllergene(reference))}</span></span>`).join(' ');
  return marques + (liste.length > 4 ? ` <span class="unit">+${liste.length - 4}</span>` : '');
}
function blocListe(ctx, d) {
  if (!d.liste.length) {
    return ctx.ui.empty({
      icon: 'tag',
      title: 'Aucune étiquette trouvée',
      actionLabel: 'Prendre en photo une étiquette',
      onAction: () => ouvrirPanneau(ctx),
      body: 'Photographiez votre première étiquette produit pour assurer la traçabilité client et recette en cas de contrôle.',
    });
  }

  const cartes = d.liste.map((p) => {
    const photoHtml = p.photo
      ? `<img class="trace-card__photo-thumb" src="${echapper(p.photo)}" alt="Photo étiquette ${echapper(p.name)}" data-action="voir-photo" data-id="${echapper(p.id)}">`
      : `<button class="btn btn--ghost btn--sm" type="button" data-action="ajouter-photo-directe" data-id="${echapper(p.id)}">${ctx.icon('camera', 14)} Photo</button>`;

    const destClient = p.destinationClient
      ? `<div class="trace-dest-item"><span class="trace-dest-item__label">Client :</span><span class="trace-dest-item__value">${echapper(p.destinationClient)}</span></div>`
      : '<div class="trace-dest-item"><span class="trace-dest-item__label">Client :</span><span class="muted">Non spécifié</span></div>';

    const destRecette = p.destinationRecipe
      ? `<div class="trace-dest-item"><span class="trace-dest-item__label">Recette :</span><span class="trace-dest-item__value">${echapper(p.destinationRecipe)}</span></div>`
      : '<div class="trace-dest-item"><span class="trace-dest-item__label">Recette :</span><span class="muted">Non spécifiée</span></div>';

    return `<article class="trace-card" data-id="${echapper(p.id)}">
      <div class="trace-card__header">
        <div style="flex: 1; min-width: 0;">
          <h3 class="trace-card__title">${echapper(p.name || 'Produit sans nom')}</h3>
          <div class="trace-card__date">Lot ${echapper(p.batch || '—')} · Enregistré le ${dateLisible(ctx, p.fabDate)}</div>
        </div>
        ${photoHtml}
      </div>

      <div class="trace-card__destinations">
        ${destClient}
        ${destRecette}
      </div>

      <div class="row row--wrap row--tight" style="gap: var(--s-3); align-items: center;">
        <span class="field__label" style="margin: 0;">DLC :</span>
        <span class="num">${dateLisible(ctx, p.dlcDate)}</span>
        <span style="margin-left: auto;">${celluleJours(ctx, p)}</span>
      </div>

      <div class="trace-card__meta">
        <div>${celluleAllergenes(ctx, p)}</div>
        <div class="trace-card__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="apercu-etiquette" data-id="${echapper(p.id)}">${ctx.icon('printer', 14)} Fiche</button>
          <button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="supprimer-preparation" data-id="${echapper(p.id)}" aria-label="Supprimer">${ctx.icon('trash', 14)}</button>
        </div>
      </div>
    </article>`;
  }).join('');

  return `<div class="trace-cards-list">${cartes}</div>`;
}
// ── Contrat de vue ────────────────────────────────────────────────────────────
export const meta = { id: 'traceability', idx: '04', icon: 'tag', title: 'Traçabilité & Étiquettes', desc: 'Photos des étiquettes et traçabilité client / recette', permissions: null };
export function render(ctx) {
  const d = donnees(ctx);
  return `<header class="page-head">
      <span class="page-head__idx">01</span><h1 class="page-head__title">Traçabilité &amp; Étiquettes</h1>
      <p class="page-head__desc">Photographiez les étiquettes de vos produits et associez-les à vos clients ou recettes pour assurer le suivi sanitaire en cas d'alerte.</p></header>
    <div data-zone="filtres">${blocFiltres(ctx, d)}</div>
    <section class="section" style="margin-top: var(--s-6);"><div class="section__head"><h2 class="section__title">Historique des étiquettes</h2>
      <span class="unit">${d.liste.length} produit(s) tracé(s)</span></div>
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
  const bareme = SHELF_LIFE_PRESETS.map((p) => `<option value="${p.value}">${echapper(p.label)}</option>`).join('');
  const photoApercu = photoEnAttente ? `<div style="text-align: center; margin-top: var(--s-3);"><img src="${echapper(photoEnAttente)}" alt="Aperçu étiquette" style="max-height: 180px; max-width: 100%; border-radius: var(--r-2); border: 1px solid var(--rule);"></div>` : '';
  return `<div class="stack">
    <div style="background: var(--paper-2); padding: var(--s-5); border-radius: var(--r-2); border: 1px solid var(--rule); text-align: center;">
      <button class="btn btn--primary btn--lg" type="button" data-action="photo-preparation" style="width: 100%; justify-content: center; height: 48px;">
        ${ctx.icon('camera', 20)} Prendre en photo l'étiquette
      </button>
      <div data-zone="apercu-photo">${photoApercu}</div>
    </div>

    ${blocChamp('prep-nom', 'Nom du produit / Ingrédient acheté', '<input class="input" id="prep-nom" name="nom" placeholder="Ex: Crème fraîche 35%, Viande hachée, Farine T55..." autofocus>', 'nom')}
    
    <div style="border-left: 3px solid var(--accent); padding-left: var(--s-4); display: flex; flex-direction: column; gap: var(--s-4);">
      ${blocChamp('prep-client', 'Pour quel Client ou Événement ?', '<input class="input" id="prep-client" name="destinationClient" placeholder="Ex: M. Dupont / Table 4 / Buffet Mariage Martin">', 'destinationClient')}
      ${blocChamp('prep-recette', 'Pour quelle Recette ou Plat servi ?', '<input class="input" id="prep-recette" name="destinationRecipe" placeholder="Ex: Sauce béarnaise du jour, Pâtisserie X...">', 'destinationRecipe')}
    </div>

    <details style="border: 1px solid var(--rule); border-radius: var(--r-2); padding: var(--s-4);">
      <summary style="font-weight: 500; cursor: pointer; color: var(--ink-2); font-size: var(--t-sm);">Détails optionnels (Lot, DLC, Durée de conservation)</summary>
      <div class="stack stack--sm" style="margin-top: var(--s-4);">
        <div class="grid grid--2">
          ${blocChamp('prep-categorie', 'Durée indicative DLC', `<select class="select" id="prep-categorie" name="categorie">${bareme}</select>`, 'categorie')}
          ${blocChamp('prep-lot', 'N° de lot (si visible)', `<input class="input" id="prep-lot" name="lot" value="${echapper(identifiantLot(ctx, aujourdhui))}">`, 'lot')}
          ${blocChamp('prep-fabrication', 'Date d\'achat / utilisation', `<input class="input" type="date" id="prep-fabrication" name="fabrication" value="${aujourdhui}">`, 'fabrication')}
          ${blocChamp('prep-heure', 'Heure', `<input class="input" type="time" id="prep-heure" name="heureFabrication" value="${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}">`, 'heureFabrication')}
        </div>
        <div data-zone="dlc">${blocDlc(aujourdhui, SHELF_LIFE_PRESETS[0].value)}</div>
      </div>
    </details>
  </div>`;
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
    onMount: (racine) => {
      panneau = racine || null;
      brancherDlc(ctx, panneau);
      if (racine) {
        racine.addEventListener('click', (evenement) => {
          const el = evenement.target.closest && evenement.target.closest('[data-action]');
          if (!el || !racine.contains(el)) return;
          const action = ACTIONS[el.dataset.action];
          if (action) action(el, racine, ctx);
        });
      }
    },
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
let elementRacineVue = null;

function enregistrer(ctx, candidat, imprimer) {
  const racine = racineDe(candidat);
  if (!racine) { ctx.ui.toast({ status: 'warn', message: 'Formulaire indisponible' }); return false; }
  const nom = valeurChamp(racine, 'nom');
  if (!nom) {
    signalerErreur(racine, 'nom', 'Indiquez le nom du produit acheté.');
    return false;
  }
  const destinationClient = valeurChamp(racine, 'destinationClient');
  const destinationRecipe = valeurChamp(racine, 'destinationRecipe');
  const iso = frVersIso(valeurChamp(racine, 'fabrication'));
  const duree = Number(valeurChamp(racine, 'categorie')) || SHELF_LIFE_PRESETS[0].value;
  const quantite = nombreChamp(racine, 'quantite');
  const unite = valeurChamp(racine, 'unite') || UNITES[0];
  const lot = valeurChamp(racine, 'lot') || identifiantLot(ctx, iso);
  const operateur = nomOperateur(ctx);
  const data = {
    name: nom,
    destinationClient: destinationClient,
    destinationRecipe: destinationRecipe,
    batch: lot,
    fabDate: isoVersFr(iso),
    dlcDate: ajouterJours(iso, duree),
    durationDays: duree,
    quantity: quantite === null ? '—' : `${quantite.toLocaleString('fr-FR')} ${unite}`,
    allergens: [],
    operator: operateur,
    fabTime: valeurChamp(racine, 'heureFabrication'),
    unit: unite,
    category: String(duree),
    conservation: consigneParDefaut(),
    photo: photoEnAttente,
  };

  try {
    const resultat = ctx.useCases.createPreparationLabel(data, operateur);
    conserverComplements(ctx, (resultat && resultat.preparation) || resultat, data, lot);
    ctx.ui.closeOverlay();
    photoEnAttente = '';
    ctx.ui.toast({ status: 'ok', message: `Étiquette « ${nom} » enregistrée pour la traçabilité` });
    if (elementRacineVue && elementRacineVue.isConnected) {
      rafraichir(elementRacineVue, elementRacineVue.__contexte || ctx);
    }
    if (imprimer) ouvrirEtiquette(ctx, (resultat && resultat.preparation) || resultat, lot);
    return true;
  } catch (err) {
    console.error('Erreur enregistrement étiquette:', err);
    ctx.ui.toast({ status: 'danger', message: "Erreur lors de l'enregistrement de l'étiquette. Vérifiez l'espace disponible." });
    return false;
  }
}
/** Conserve les compléments descriptifs saisis (hors contrat PreparationRecord). */
function conserverComplements(ctx, preparation, data, lot) {
  const depot = ctx.repository;
  if (!depot || typeof depot.getPreparations !== 'function' || typeof depot.savePreparations !== 'function') return;
  const liste = depot.getPreparations() || [];
  const cible = liste.find((p) => p.id === (preparation && preparation.id)) || liste.slice().reverse().find((p) => p.batch === lot);
  if (!cible) return;
  ['destinationClient', 'destinationRecipe', 'fabTime', 'unit', 'category', 'conservation', 'photo'].forEach((cle) => { cible[cle] = data[cle]; });
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
  if (!cible) { ctx.ui.toast({ status: 'warn', message: 'Fiche introuvable' }); return; }
  const photoSection = cible.photo ? `<div style="text-align:center;"><img src="${echapper(cible.photo)}" alt="Photo étiquette" style="max-height: 200px; max-width: 100%; border-radius: var(--r-2); border: 1px solid var(--rule); cursor: pointer;" data-action="voir-photo" data-id="${echapper(cible.id)}"></div>` : '';
  const corps = `<div class="stack">
      ${photoSection}
      <div class="callout callout--info">
        <div style="font-weight: 600; font-size: var(--t-body);">${echapper(cible.name || 'Produit')}</div>
        <div style="font-size: var(--t-sm); margin-top: var(--s-1);">Lot : <span class="num">${echapper(cible.batch || '—')}</span> · DLC : <span class="num">${dateLisible(ctx, cible.dlcDate)}</span></div>
      </div>
      <div class="trace-card__destinations" style="font-size: var(--t-sm);">
        <div class="trace-dest-item"><span class="trace-dest-item__label">Client :</span><span class="trace-dest-item__value">${echapper(cible.destinationClient || 'Non spécifié')}</span></div>
        <div class="trace-dest-item"><span class="trace-dest-item__label">Recette :</span><span class="trace-dest-item__value">${echapper(cible.destinationRecipe || 'Non spécifiée')}</span></div>
        <div class="trace-dest-item"><span class="trace-dest-item__label">Date :</span><span class="trace-dest-item__value">${dateLisible(ctx, cible.fabDate)}</span></div>
        <div class="trace-dest-item"><span class="trace-dest-item__label">Opérateur :</span><span class="trace-dest-item__value">${echapper(cible.operator || '—')}</span></div>
      </div>
      <div class="field"><span class="field__label">Consigne sanitaire</span><p class="field__hint">${echapper(cible.conservation || consigneParDefaut())}</p></div></div>`;
  ctx.ui.panel({
    id: 'traceability-etiquette', title: "Fiche de traçabilité", subtitle: cible.name || '', body: corps,
    onMount: (racine) => {
      if (racine) {
        racine.addEventListener('click', (evenement) => {
          const el = evenement.target.closest && evenement.target.closest('[data-action]');
          if (!el || !racine.contains(el)) return;
          const action = ACTIONS[el.dataset.action];
          if (action) action(el, racine, ctx);
        });
      }
    },
    actions: [{ label: 'Fermer', kind: 'ghost', onClick: () => ctx.ui.closeOverlay() }],
  });
}
function ouvrirPhoto(ctx, id) {
  const preparation = chercherPreparation(ctx, id);
  if (!preparation || !preparation.photo) { ctx.ui.toast({ status: 'warn', message: 'Aucune photo pour cette préparation' }); return; }
  ctx.ui.photo(preparation.photo, `${preparation.name || 'Étiquette'} — Lot ${preparation.batch || '—'}`);
}
function ouvrirCamera(ctx) {
  if (!ctx.ui || typeof ctx.ui.camera !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Appareil photo indisponible' }); return; }
  ctx.ui.camera({
    onCapture: (source) => {
      photoEnAttente = typeof source === 'string' ? source : (source && source.dataUrl) || '';
      const zone = panneau && panneau.querySelector('[data-zone="apercu-photo"]');
      if (zone) {
        zone.innerHTML = photoEnAttente
          ? `<div style="text-align: center; margin-top: var(--s-3);"><img src="${echapper(photoEnAttente)}" alt="Aperçu étiquette" style="max-height: 180px; max-width: 100%; border-radius: var(--r-2); border: 1px solid var(--rule);"></div>`
          : '';
      }
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
  'ajouter-photo-directe': (el, root, ctx) => {
    const id = el.dataset.id;
    if (!ctx.ui || typeof ctx.ui.camera !== 'function') return;
    ctx.ui.camera({
      onCapture: (source) => {
        const photoData = typeof source === 'string' ? source : (source && source.dataUrl) || '';
        if (!photoData) return;
        const depot = ctx.repository;
        const preps = depot.getPreparations() || [];
        const p = preps.find((item) => item.id === id);
        if (p) {
          p.photo = photoData;
          depot.savePreparations(preps);
          ctx.ui.toast({ status: 'ok', message: 'Photo ajoutée au produit' });
          rafraichirListe(root, root.__contexte || ctx);
        }
      }
    });
  },
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
  elementRacineVue = root;
  attacher(root, ctx);
  abonnement = ctx.store.subscribe(() => { if (maGeneration === generation && root.isConnected && !root.hidden) rafraichir(root, root.__contexte || ctx); });
}
export function unmount(root) {
  generation += 1;
  if (abonnement) { abonnement(); abonnement = null; }
  panneau = null;
  if (elementRacineVue === root) elementRacineVue = null;
  if (root && typeof root.removeEventListener === 'function') { delete root.dataset.liens; delete root.__contexte; }
}
