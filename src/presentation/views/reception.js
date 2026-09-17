/**
 * src/presentation/views/reception.js — Module « Réception » (04).
 * Contrôle à réception : température mesurée contre le seuil de la catégorie (HACCP_NORMS), DLC,
 * agrément sanitaire, photo, opérateur. Température hors norme ⇒ validation impossible sans action
 * corrective et non-conformité créée automatiquement. Contrat : meta / render / mount / unmount.
 */
import { HACCP_NORMS } from '../../domain/constants.js';
// ── Helpers ───────────────────────────────────────────────────────────────────
const echapper = (v) => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function horodatage(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return valeur.getTime();
  const texte = String(valeur).trim();
  const heure = texte.match(/^(\d{1,2}):(\d{2})/);
  if (heure) { const d = new Date(); d.setHours(Number(heure[1]), Number(heure[2]), 0, 0); return d.getTime(); }
  const ms = Date.parse(texte); return Number.isNaN(ms) ? null : ms;
}
function dateFr(valeur) {
  if (!valeur) return null;
  const texte = String(valeur).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texte)) return horodatage(texte);
  const parties = texte.split('/');
  if (parties.length === 3) return new Date(Number(parties[2]), Number(parties[1]) - 1, Number(parties[0]), 12, 0, 0).getTime();
  return horodatage(texte);
}
const msReception = (r) => horodatage(r.date) || horodatage(r.time) || 0;
const debutJour = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dateLisible = (ctx, valeur) => { if (!valeur) return '—'; const texte = String(valeur); return echapper(/^\d{4}-\d{2}-\d{2}/.test(texte) ? ctx.fmt.date(texte) : texte); };
const heureLisible = (valeur) => { const texte = String(valeur || ''); return /^\d{1,2}:\d{2}/.test(texte) ? texte.slice(0, 5) : '—'; };
function nomOperateur(ctx) {
  const courant = (ctx.store && ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null;
  if (courant && courant.name) return courant.name;
  const etat = (ctx.store && ctx.store.getState && ctx.store.getState()) || {};
  if (ctx.account && typeof ctx.account.getOperatorName === 'function') return ctx.account.getOperatorName((etat.currentOperator || {}).id) || 'Opérateur';
  return 'Opérateur';
}
function normeDe(categorie) {
  const table = HACCP_NORMS.TEMPERATURES;
  if (categorie && table[categorie]) return table[categorie];
  return Object.values(table).find((n) => n.label === categorie) || null;
}
const plageTexte = (norme) => (norme ? `${norme.min.toLocaleString('fr-FR')} à ${norme.max.toLocaleString('fr-FR')} °C` : 'seuil non défini');
// ── État de vue (conservé d'une visite à l'autre) ────────────────────────────
const PERIODES = [{ id: 'jour', label: "Aujourd'hui" }, { id: '7j', label: '7 jours' }, { id: '30j', label: '30 jours' }, { id: 'tout', label: 'Tout' }];
const CONFORMITES = [{ id: 'toutes', label: 'Toutes' }, { id: 'conformes', label: 'Conformes' }, { id: 'refusees', label: 'Refusées' }];
let periode = '7j'; let fournisseurFiltre = ''; let conformiteFiltre = 'toutes'; let panneau = null;
let photoEnAttente = ''; let generation = 0; let abonnement = null;
// ── Lecture des données (aucune écriture ici) ────────────────────────────────
function toutesLesReceptions(ctx) {
  const depot = ctx.repository;
  const liste = (depot && depot.getDeliveries && depot.getDeliveries()) || [];
  return liste.slice().sort((a, b) => msReception(b) - msReception(a));
}
function fournisseursConnus(ctx) {
  const noms = toutesLesReceptions(ctx).map((r) => String(r.supplier || '').trim()).filter(Boolean);
  return [...new Set(noms)].sort((a, b) => a.localeCompare(b, 'fr'));
}
const estRefusee = (r) => String(r.decision || '').toLowerCase().indexOf('refus') === 0;
function receptionsFiltrees(ctx) {
  const fenetres = { jour: Date.now() - debutJour(), '7j': 604800000, '30j': 2592000000 };
  const depuis = periode === 'tout' ? 0 : Date.now() - (fenetres[periode] || 604800000);
  return toutesLesReceptions(ctx).filter((r) => {
    if (depuis && msReception(r) < depuis) return false;
    if (fournisseurFiltre && String(r.supplier || '').trim() !== fournisseurFiltre) return false;
    if (conformiteFiltre === 'conformes' && estRefusee(r)) return false;
    if (conformiteFiltre === 'refusees' && !estRefusee(r)) return false;
    return true;
  });
}
function donnees(ctx) {
  const liste = receptionsFiltrees(ctx);
  const refuses = liste.filter(estRefusee).length;
  return { liste, refuses, taux: liste.length ? Math.round(((liste.length - refuses) / liste.length) * 100) : 100, fournisseurs: fournisseursConnus(ctx).length };
}
// ── Fragments d'interface ─────────────────────────────────────────────────────
function blocFiltres(ctx, d) {
  const seg = (liste, actif, action) => liste.map((item) => `<button class="seg__item${item.id === actif ? ' is-active' : ''}" type="button" data-action="${action}" data-valeur="${item.id}">${item.label}</button>`).join('');
  const options = fournisseursConnus(ctx).map((nom) => `<option value="${echapper(nom)}"${nom === fournisseurFiltre ? ' selected' : ''}>${echapper(nom)}</option>`).join('');
  const kpi = (label, valeur, unite) => `<div class="kpi"><span class="kpi__label">${label}</span><span class="kpi__value">${valeur}</span><span class="kpi__unit">${unite}</span></div>`;
  return `<div class="toolbar">
      <button class="btn btn--primary" type="button" data-action="nouvelle-reception">${ctx.icon('plus', 16)} Nouvelle réception</button>
      <button class="btn btn--ghost" type="button" data-action="export-csv">${ctx.icon('download', 16)} Export CSV</button>
      <div class="seg">${seg(PERIODES, periode, 'filtre-periode')}</div>
      <label class="field"><span class="field__label">Fournisseur</span><select class="select" data-change="filtre-fournisseur"><option value="">Tous les fournisseurs</option>${options}</select></label>
      <div class="seg">${seg(CONFORMITES, conformiteFiltre, 'filtre-conformite')}</div>
    </div>
    <div class="grid grid--3">
      ${kpi('Réceptions sur la période', d.liste.length, `dont ${d.refuses} refusée(s)`)}
      ${kpi('Taux de conformité', ctx.fmt.pct(d.taux), 'emballage, DLC et décision')}
      ${kpi('Fournisseurs suivis', d.fournisseurs, 'agréments au registre')}
    </div>`;
}
/** Température à réception comparée au seuil de la catégorie (.mark). */
function celluleTemperature(ctx, reception) {
  const temperature = Number(reception.prodTemp);
  if (!Number.isFinite(temperature)) return '<span class="muted">—</span>';
  const affichage = `<span class="num">${echapper(ctx.fmt.temp(temperature))}</span>`;
  const norme = normeDe(reception.category); if (!norme) return affichage;
  const conforme = temperature >= norme.min && temperature <= norme.max;
  return `${affichage} <span class="mark ${conforme ? 'mark--ok' : 'mark--danger'}">${conforme ? 'Conforme' : 'Hors norme'}</span>`;
}
function blocTable(ctx, d) {
  if (!d.liste.length) return ctx.ui.empty({ icon: 'truck', title: 'Aucune réception sur ce filtre', actionLabel: 'Nouvelle réception', onAction: () => ouvrirPanneau(ctx), body: 'Élargis la période ou enregistre la première livraison contrôlée.' });
  const lignes = d.liste.map((r) => {
    const refus = estRefusee(r);
    const agrement = String(r.sanitaryApproval || '').trim();
    const photo = r.photo ? `<button class="btn btn--ghost btn--sm" type="button" data-action="voir-photo" data-id="${echapper(r.id)}">Voir</button>` : '<span class="muted">—</span>';
    return `<tr data-id="${echapper(r.id)}">
      <td><span class="num">${echapper(heureLisible(r.time))}</span></td><td>${dateLisible(ctx, r.date)}</td><td>${echapper(r.supplier || '—')}</td>
      <td>${echapper(r.product || r.category || '—')}</td><td><span class="num">${echapper(r.batch || r.bl || '—')}</span></td><td>${dateLisible(ctx, r.dlcDate)}</td>
      <td>${celluleTemperature(ctx, r)}</td><td>${agrement ? `<span class="num">${echapper(agrement)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${photo}</td><td>${echapper(r.operator || '—')} <span class="mark ${refus ? 'mark--danger' : 'mark--ok'}">${refus ? 'Refusée' : 'Acceptée'}</span></td>
      <td><button class="btn btn--ghost btn--sm" type="button" data-action="detail-reception" data-id="${echapper(r.id)}">Détail</button>
        <button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="supprimer-reception" data-id="${echapper(r.id)}">Supprimer</button></td></tr>`;
  }).join('');
  return `<div class="table--scroll"><table class="table table--compact table--zebra">
      <thead><tr><th>Heure</th><th>Date</th><th>Fournisseur</th><th>Produit</th><th>Lot / BL</th><th>DLC</th><th>T° à réception</th><th>Agrément sanitaire</th><th>Photo</th><th>Opérateur</th><th>Actions</th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`;
}
// ── Contrat de vue ────────────────────────────────────────────────────────────
export const meta = { id: 'reception', idx: '04', icon: 'truck', title: 'Réception', desc: 'Contrôle marchandises et agréments', permissions: null };
export function render(ctx) {
  const d = donnees(ctx);
  return `<header class="page-head">
      <span class="page-head__idx">04</span><h1 class="page-head__title">Réception</h1>
      <p class="page-head__desc">Contrôle des livraisons : température contre le seuil de la catégorie, DLC, agrément sanitaire du fournisseur et photo à réception.</p>
    </header>
    <div data-zone="filtres">${blocFiltres(ctx, d)}</div>
    <section class="section"><div class="section__head"><h2 class="section__title">Livraisons contrôlées</h2>
      <span class="unit">Seuils HACCP par catégorie — ${d.liste.length} réception(s) affichée(s)</span></div>
      <div data-zone="liste">${blocTable(ctx, d)}</div></section>`;
}
// ── Panneau « Nouvelle réception » ────────────────────────────────────────────
const champ = (nom, label, contenu, cle) => `<div class="field"><label class="field__label" for="${nom}">${label}</label>${contenu}<span class="field__error" data-erreur="${cle}"></span></div>`;
function blocFormulaire(ctx) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const fournisseurs = fournisseursConnus(ctx).map((nom) => `<option value="${echapper(nom)}"></option>`).join('');
  const categories = Object.keys(HACCP_NORMS.TEMPERATURES).map((cle) => `<option value="${cle}">${echapper(HACCP_NORMS.TEMPERATURES[cle].label)}</option>`).join('');
  return `<div class="stack">
    ${champ('rec-fournisseur', 'Fournisseur', `<input class="input" id="rec-fournisseur" name="fournisseur" list="rec-fournisseurs" placeholder="Nom du fournisseur"><datalist id="rec-fournisseurs">${fournisseurs}</datalist>`, 'fournisseur')}
    ${champ('rec-agrement', "N° d'agrément sanitaire", '<input class="input" id="rec-agrement" name="agrement" placeholder="Ex. FR 69.123.456 CE">', 'agrement')}
    <div class="grid grid--2">
      ${champ('rec-produit', 'Produit livré', '<input class="input" id="rec-produit" name="produit" placeholder="Ex. rôti de porc">', 'produit')}
      ${champ('rec-lot', 'N° de lot / BL', '<input class="input" id="rec-lot" name="lot" placeholder="Ex. L-20260916-01">', 'lot')}
      ${champ('rec-dlc', 'DLC du fournisseur', `<input class="input" type="date" id="rec-dlc" name="dlc" value="${aujourdhui}">`, 'dlc')}
      ${champ('rec-categorie', 'Catégorie (définit le seuil)', `<select class="select" id="rec-categorie" name="categorie">${categories}</select>`, 'categorie')}
      ${champ('rec-camion', 'T° camion', '<input class="input" type="number" step="0.1" inputmode="decimal" id="rec-camion" name="temperatureCamion" placeholder="Ex. 3,2">', 'temperatureCamion')}
      ${champ('rec-temperature', 'T° produit mesurée', '<input class="input" type="number" step="0.1" inputmode="decimal" id="rec-temperature" name="temperature" placeholder="Ex. 4,1">', 'temperature')}
    </div>
    <div class="grid grid--2">
      <label class="checkbox"><input type="checkbox" name="emballage" checked><span>Emballage conforme</span></label>
      <label class="checkbox"><input type="checkbox" name="dlcConforme" checked><span>DLC conforme</span></label>
    </div>
    <div data-zone="verdict">${blocVerdict(ctx, '', null)}</div>
    ${champ('rec-corrective', 'Action corrective (obligatoire si hors norme)', '<textarea class="textarea" id="rec-corrective" name="actionCorrective" placeholder="Ex. retour fournisseur, produit refusé et isolé en chambre froide"></textarea>', 'actionCorrective')}
    ${champ('rec-observations', 'Observations', '<textarea class="textarea" id="rec-observations" name="observations" placeholder="État du colisage, température de la chambre…"></textarea>', 'observations')}
    <div><button class="btn btn--ghost" type="button" data-action="photo-reception">${ctx.icon('camera', 16)} Joindre la photo à réception</button><div data-zone="apercu-photo"></div></div>
  </div>`;
}
function blocVerdict(ctx, categorie, temperature) {
  const norme = normeDe(categorie);
  const mesuree = Number(temperature);
  if (!norme || !Number.isFinite(mesuree)) return `<div class="callout callout--info">Seuil attendu pour cette catégorie : ${echapper(plageTexte(norme))}. La non-conformité est créée automatiquement en cas d'écart.</div>`;
  if (mesuree >= norme.min && mesuree <= norme.max) return `<div class="callout callout--info">T° mesurée ${echapper(ctx.fmt.temp(mesuree))} — dans la plage ${echapper(plageTexte(norme))}.</div>`;
  return `<div class="callout callout--danger">T° mesurée ${echapper(ctx.fmt.temp(mesuree))} hors norme (plage ${echapper(plageTexte(norme))}) : indique l'action corrective, une non-conformité critique sera créée.</div>`;
}
/** Verdict recalculé à chaque changement de catégorie ou de température mesurée. */
function brancherVerdict(ctx, racine) {
  if (!racine || typeof racine.querySelector !== 'function') return;
  const champCategorie = racine.querySelector('[name="categorie"]');
  const champTemperature = racine.querySelector('[name="temperature"]');
  const zone = racine.querySelector('[data-zone="verdict"]');
  if (!champCategorie || !champTemperature || !zone) return;
  const maj = () => { zone.innerHTML = blocVerdict(ctx, champCategorie.value, champTemperature.value); };
  champCategorie.addEventListener('change', maj);
  champTemperature.addEventListener('input', maj);
}
function ouvrirPanneau(ctx) {
  panneau = null; photoEnAttente = '';
  ctx.ui.panel({
    id: 'reception-nouvelle', title: 'Nouvelle réception', subtitle: 'Contrôle à réception des marchandises', body: blocFormulaire(ctx),
    onMount: (racine) => {
      panneau = racine || null;
      brancherVerdict(ctx, panneau);
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
      { label: 'Enregistrer la réception', kind: 'primary', onClick: (cible) => enregistrer(ctx, cible) },
      { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay() },
    ],
  });
}
// ── Saisie du formulaire ──────────────────────────────────────────────────────
function racineDe(candidat) {
  if (candidat && typeof candidat.querySelector === 'function' && candidat.querySelector('input, textarea, select')) return candidat;
  return panneau && typeof panneau.querySelector === 'function' ? panneau : null;
}
function valeurChamp(racine, nom) { const cible = racine.querySelector(`[name="${nom}"]`); return cible ? String(cible.value || '').trim() : ''; }
function nombreChamp(racine, nom) {
  const brut = valeurChamp(racine, nom);
  if (brut === '') return null;
  const valeur = Number(brut.replace(',', '.')); return Number.isFinite(valeur) ? valeur : null;
}
const cocheChamp = (racine, nom) => { const cible = racine.querySelector(`[name="${nom}"]`); return cible ? cible.checked !== false : true; };
function signalerErreur(racine, cle, message) {
  const zone = racine.querySelector(`[data-erreur="${cle}"]`); if (zone) zone.textContent = message;
  const cible = racine.querySelector(`[name="${cle}"]`); if (cible && typeof cible.focus === 'function') cible.focus();
}
let elementRacineVue = null;

function enregistrer(ctx, candidat) {
  const racine = racineDe(candidat);
  if (!racine) { ctx.ui.toast({ status: 'warn', message: 'Formulaire indisponible' }); return false; }
  const fournisseur = valeurChamp(racine, 'fournisseur');
  if (!fournisseur) {
    signalerErreur(racine, 'fournisseur', 'Le fournisseur est obligatoire pour tracer l\'origine.');
    return false;
  }
  const temperature = nombreChamp(racine, 'temperature');
  if (temperature === null) {
    signalerErreur(racine, 'temperature', 'Relève la température mesurée à réception.');
    return false;
  }
  const categorie = valeurChamp(racine, 'categorie');
  const norme = normeDe(categorie);
  const horsNorme = Boolean(norme) && (temperature < norme.min || temperature > norme.max);
  const corrective = valeurChamp(racine, 'actionCorrective');
  if (horsNorme && !corrective) {
    const zone = racine.querySelector('[data-zone="verdict"]');
    if (zone) zone.innerHTML = blocVerdict(ctx, categorie, temperature);
    signalerErreur(racine, 'actionCorrective', 'Température hors norme : la validation est impossible sans action corrective.');
    return false;
  }
  const emballage = cocheChamp(racine, 'emballage');
  const dlcConforme = cocheChamp(racine, 'dlcConforme');
  const maintenant = new Date();
  const lot = valeurChamp(racine, 'lot');
  const operateur = nomOperateur(ctx);
  const data = {
    supplier: fournisseur, bl: lot, batch: lot, product: valeurChamp(racine, 'produit'), category: categorie,
    truckTemp: nombreChamp(racine, 'temperatureCamion'), prodTemp: temperature, conformPackaging: emballage,
    conformDlc: dlcConforme, decision: emballage && dlcConforme ? 'Conforme' : 'Refusé',
    time: maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), date: maintenant.toISOString(),
    dlcDate: valeurChamp(racine, 'dlc'), sanitaryApproval: valeurChamp(racine, 'agrement'), notes: valeurChamp(racine, 'observations'),
    operator: operateur, photo: photoEnAttente,
  };

  try {
    conserverComplements(ctx, ctx.useCases.recordDelivery(data, operateur), data);
    if (horsNorme) creerNonConformite(ctx, { sujet: `Température hors norme à réception : ${fournisseur} — ${data.product || categorie}`, cause: `T° mesurée ${ctx.fmt.temp(temperature)} (plage ${plageTexte(norme)})`, action: corrective }, operateur);
    ctx.ui.closeOverlay();
    photoEnAttente = '';
    const alerte = horsNorme || data.decision !== 'Conforme';
    ctx.ui.toast({ status: alerte ? 'warn' : 'ok', message: alerte ? 'Réception enregistrée avec réserve (non-conformité au registre)' : 'Réception conforme enregistrée' });
    if (elementRacineVue && elementRacineVue.isConnected) {
      rafraichir(elementRacineVue, elementRacineVue.__contexte || ctx);
    }
    return true;
  } catch (err) {
    console.error('Erreur enregistrement réception:', err);
    ctx.ui.toast({ status: 'danger', message: "Erreur lors de l'enregistrement de la réception. Vérifiez l'espace disponible." });
    return false;
  }
}
/** Conserve les compléments descriptifs saisis (hors contrat DeliveryRecord). */
function conserverComplements(ctx, enregistrement, data) {
  const depot = ctx.repository;
  if (!depot || typeof depot.getDeliveries !== 'function' || typeof depot.saveDeliveries !== 'function') return;
  const liste = depot.getDeliveries() || [];
  const cible = liste.find((r) => r.id === (enregistrement && enregistrement.id)) || liste.slice().reverse().find((r) => r.supplier === data.supplier && r.time === data.time);
  if (!cible) return;
  ['product', 'batch', 'dlcDate', 'sanitaryApproval', 'notes', 'date', 'photo'].forEach((cle) => { cible[cle] = data[cle]; });
  depot.saveDeliveries(liste);
}
/** Non-conformité critique générée par la vue en cas d'écart de température. */
function creerNonConformite(ctx, { sujet, cause, action }, operateur) {
  if (!ctx.useCases || typeof ctx.useCases.declareNonConformity !== 'function') return;
  ctx.useCases.declareNonConformity({
    category: 'matiere', category5M: 'matiere', severity: 'Critique', status: 'Ouverte',
    subject: sujet, equipOrSubject: sujet, cause, action, description: `${cause} — action corrective : ${action}`,
    date: new Date().toISOString(), operator: operateur,
  }, operateur);
}
const chercherReception = (ctx, id) => toutesLesReceptions(ctx).find((r) => r.id === id) || null;
function ouvrirDetail(ctx, id) {
  const r = chercherReception(ctx, id);
  if (!r) { ctx.ui.toast({ status: 'warn', message: 'Réception introuvable' }); return; }
  const ligne = (label, valeur) => `<div class="row"><span class="field__label">${label}</span><span class="num">${valeur}</span></div>`;
  const corps = `<div class="stack">
      ${ligne('Date et heure', `${dateLisible(ctx, r.date)} ${echapper(heureLisible(r.time))}`)}
      ${ligne('Produit / lot', `${echapper(r.product || '—')} — lot ${echapper(r.batch || r.bl || '—')}`)}
      ${ligne('DLC', dateLisible(ctx, r.dlcDate))}${ligne('T° produit', celluleTemperature(ctx, r))}
      ${ligne('T° camion', Number.isFinite(Number(r.truckTemp)) ? echapper(ctx.fmt.temp(Number(r.truckTemp))) : '—')}
      ${ligne("N° d'agrément", echapper(r.sanitaryApproval || '—'))}${ligne('Opérateur', echapper(r.operator || '—'))}
      ${ligne('Observations', echapper(r.notes || '—'))}
      <div>${r.photo ? `<div style="text-align: center;"><img src="${echapper(r.photo)}" alt="Photo à réception" style="max-height: 180px; max-width: 100%; border-radius: var(--r-2); border: 1px solid var(--rule); cursor: pointer;" data-action="voir-photo-detail" data-id="${echapper(r.id)}"></div>` : '<p class="field__hint">Aucune photo jointe à cette réception.</p>'}</div>
      ${r.actionCorrective ? `<div class="callout callout--warn">Action corrective : ${echapper(r.actionCorrective)}</div>` : ''}
    </div>`;
  ctx.ui.panel({
    id: 'reception-detail', title: 'Détail de la réception', subtitle: String(r.supplier || ''), body: corps,
    onMount: (racine) => {
      if (racine) {
        racine.addEventListener('click', (evenement) => {
          const el = evenement.target.closest && evenement.target.closest('[data-action]');
          if (!el || !racine.contains(el)) return;
          if (el.dataset.action === 'voir-photo-detail') {
            const cible = chercherReception(ctx, el.dataset.id);
            if (cible && cible.photo) ctx.ui.photo(cible.photo, `Réception ${cible.supplier || ''}`);
          }
        });
      }
    },
    actions: [{ label: 'Fermer', kind: 'ghost', onClick: () => ctx.ui.closeOverlay() }],
  });
}
async function supprimer(ctx, id, root) {
  const r = chercherReception(ctx, id);
  const confirme = await ctx.ui.confirm({ title: 'Supprimer la réception', confirmLabel: 'Supprimer', danger: true, body: `La réception${r && r.supplier ? ` de ${r.supplier}` : ''} est retirée du registre sanitaire. Cette action est définitive.` });
  if (!confirme) return;
  ctx.useCases.deleteDelivery(id);
  ctx.ui.toast({ status: 'ok', message: 'Réception supprimée' });
  rafraichir(root, root.__contexte || ctx);
}
function exporter(ctx) {
  if (!ctx.exports || typeof ctx.exports.exportRecordsCsv !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Export indisponible' }); return; }
  try {
    ctx.exports.exportRecordsCsv(ctx.app || ctx, { type: 'deliveries' });
    ctx.ui.toast({ status: 'ok', message: 'Export CSV des réceptions généré' });
  } catch (erreur) { ctx.ui.toast({ status: 'danger', message: 'Export CSV impossible' }); }
}
function ouvrirCamera(ctx) {
  if (!ctx.ui || typeof ctx.ui.camera !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Appareil photo indisponible' }); return; }
  ctx.ui.camera({
    onCapture: (source) => {
      photoEnAttente = typeof source === 'string' ? source : (source && source.dataUrl) || '';
      const zone = panneau && panneau.querySelector('[data-zone="apercu-photo"]');
      if (zone) {
        zone.innerHTML = photoEnAttente
          ? `<div style="text-align: center; margin-top: var(--s-3);"><img src="${echapper(photoEnAttente)}" alt="Aperçu photo réception" style="max-height: 180px; max-width: 100%; border-radius: var(--r-2); border: 1px solid var(--rule);"></div>`
          : '';
      }
      ctx.ui.toast({ status: 'ok', message: 'Photo jointe à la réception' });
    },
  });
}
// ── Câblage ───────────────────────────────────────────────────────────────────
const ACTIONS = {
  'nouvelle-reception': (el, root, ctx) => ouvrirPanneau(ctx),
  'export-csv': (el, root, ctx) => exporter(ctx),
  'filtre-periode': (el, root, ctx) => { periode = el.dataset.valeur; rafraichir(root, ctx); },
  'filtre-conformite': (el, root, ctx) => { conformiteFiltre = el.dataset.valeur; rafraichir(root, ctx); },
  'detail-reception': (el, root, ctx) => ouvrirDetail(ctx, el.dataset.id),
  'voir-photo': (el, root, ctx) => ouvrirDetail(ctx, el.dataset.id),
  'photo-reception': (el, root, ctx) => ouvrirCamera(ctx),
  'supprimer-reception': (el, root, ctx) => { supprimer(ctx, el.dataset.id, root); },
};
const CHANGEMENTS = { 'filtre-fournisseur': (el, root, ctx) => { fournisseurFiltre = el.value; rafraichir(root, ctx); } };
function rafraichir(root, ctx) {
  const frais = { ...ctx, ...ctx.store.getState() };
  root.__contexte = frais;
  const d = donnees(frais);
  const zoneFiltres = root.querySelector('[data-zone="filtres"]');
  const zoneListe = root.querySelector('[data-zone="liste"]');
  if (zoneFiltres) zoneFiltres.innerHTML = blocFiltres(frais, d);
  if (zoneListe) zoneListe.innerHTML = blocTable(frais, d);
}
function attacher(root, ctx) {
  root.__contexte = ctx;
  if (root.dataset.liens === 'v1') return;
  root.dataset.liens = 'v1';
  root.addEventListener('click', (evenement) => {
    const el = evenement.target.closest && evenement.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const action = ACTIONS[el.dataset.action]; if (action) action(el, root, root.__contexte || ctx);
  });
  root.addEventListener('change', (evenement) => {
    const el = evenement.target.closest && evenement.target.closest('[data-change]');
    if (!el || !root.contains(el)) return;
    const action = CHANGEMENTS[el.dataset.change]; if (action) action(el, root, root.__contexte || ctx);
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
