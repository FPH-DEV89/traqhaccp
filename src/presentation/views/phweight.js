/**
 * src/presentation/views/phweight.js — Module 11 « pH et poids » (contrat de vue v4).
 *
 * Deux volets séparés par un `.seg` :
 *   • pH     — acidification barrière anti-botulique (HACCP_NORMS.PH : riz vinaigré,
 *              conserves acides, marinades, eau de réseau) ;
 *   • poids  — précision du portionnement vs HACCP_NORMS.WEIGHT.DEFAULT_TOLERANCE_PERCENT.
 *
 * Les deux boutons historiquement morts (onclick="openModal('addPhModal')" /
 * 'addWeightModal') sont remplacés par des `data-action` qui ouvrent réellement le
 * panneau de saisie : l'enregistrement persiste et apparaît dans l'historique.
 * Aperçu (écart % / statut) recalculé à CHAQUE FRAPPE, jamais après validation seule.
 *
 * Contrat : meta / render(ctx) / mount(root, ctx) / unmount(root).
 */
import { HACCP_NORMS } from '../../domain/constants.js';

const PH = HACCP_NORMS.PH;
const TOLERANCE_POIDS = HACCP_NORMS.WEIGHT.DEFAULT_TOLERANCE_PERCENT;
const TYPES_PH = [ { id: 'SUSHI_RICE', label: 'Riz vinaigré' }, { id: 'CANNED_ACID', label: 'Conserves acides' }, { id: 'MARINADES', label: 'Marinades' }, { id: 'NEUTRAL_WATER', label: 'Eau de réseau' }, ];
const PERIODES = [ { id: '7', label: '7 derniers jours' }, { id: '30', label: '30 derniers jours' }, { id: '90', label: '90 derniers jours' }, { id: 'tout', label: 'Tout l\'historique' }, ];
const DESTINATIONS = { ok: 'mark--ok', danger: 'mark--danger', warn: 'mark--warn' };
const JOUR_MS = 24 * 3600 * 1000;

let generation = 0;
let abonnement = null;
let volet = 'ph';
let panneau = null;
const filtres = { periode: '30', type: 'tous' };

/* ── Helpers locaux ───────────────────────────────────────────────────────── */

function echapper(valeur) { return String(valeur === null || valeur === undefined ? '' : valeur) .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function nombre(valeur) { const brut = String(valeur === null || valeur === undefined ? '' : valeur).replace(',', '.').trim(); if (!brut) return null; const valeur2 = Number(brut);
  return Number.isFinite(valeur2) ? valeur2 : null;
}

function decimal(valeur, chiffres = 2) { return valeur === null || valeur === undefined ? '—' : Number(valeur).toFixed(chiffres).replace('.', ','); }

function nomOperateur(ctx) { const operateur = (ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null; if (!operateur) return 'Opérateur non identifié';
  return operateur.name || `${operateur.firstName || ''} ${operateur.lastName || ''}`.trim() || 'Opérateur non identifié';
}

function normePh(typeId) { return PH[typeId] || null; }

function seuilTexte(typeId) { const norme = normePh(typeId); if (!norme) return '—'; if (norme.min !== undefined && norme.max !== undefined) return `pH ${decimal(norme.min)} à ${decimal(norme.max)}`;
  return `pH ≤ ${decimal(norme.max)}`;
}

function conformePh(typeId, valeur) { const norme = normePh(typeId); if (!norme || valeur === null) return false; if (norme.max !== undefined && valeur > norme.max) return false;
  if (norme.min !== undefined && valeur < norme.min) return false;
  return true;
}

function atMs(valeur) { if (!valeur) return null; if (valeur instanceof Date) return valeur.getTime(); if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null;
  const texte = String(valeur).trim();
  const heure = texte.match(/^(\d{1,2}):(\d{2})/);
  if (heure) { const d = new Date(); d.setHours(Number(heure[1]), Number(heure[2]), 0, 0); return d.getTime(); }
  const horodatage = Date.parse(texte);
  return Number.isNaN(horodatage) ? null : horodatage;
}

function periodeMs() { return filtres.periode === 'tout' ? null : Date.now() - Number(filtres.periode) * JOUR_MS; }

/* ── Lecture des données (aucune écriture) ────────────────────────────────── */

function donnees(ctx) { const depuis = periodeMs(); const types = new Set(TYPES_PH.map((t) => t.id));

  const ph = (ctx.repository.getPhRecords() || []).map((r) => { const typeId = types.has(r.typeId) ? r.typeId : 'SUSHI_RICE'; const valeur = Number(r.measuredPh);
    const horodatage = atMs(r.at) || atMs(r.date) || null;
    return { ...r, typeId, valeur, horodatage, seuil: seuilTexte(typeId), conforme: conformePh(typeId, valeur), libelleType: (TYPES_PH.find((t) => t.id === typeId) || {}).label || '—', };
  }).sort((a, b) => (b.horodatage || 0) - (a.horodatage || 0));

  const poids = (ctx.repository.getWeightRecords() || []).map((r) => { const cible = Number(r.targetWeight); const reel = Number(r.measuredWeight);
    const tolerance = Number.isFinite(Number(r.tolerancePercent)) ? Number(r.tolerancePercent) : TOLERANCE_POIDS;
    const ecart = cible > 0 ? ((reel - cible) / cible) * 100 : null;
    const horodatage = atMs(r.at) || null;
    return { ...r, cible, reel, tolerance, ecart, horodatage, conforme: ecart !== null && Math.abs(ecart) <= tolerance, };
  }).sort((a, b) => (b.horodatage || 0) - (a.horodatage || 0));

  const phPeriode = ph.filter((r) => depuis === null || (r.horodatage || 0) >= depuis);
  const poidsPeriode = poids.filter((r) => depuis === null || (r.horodatage || 0) >= depuis);
  const phAffiches = filtres.type === 'tous' ? phPeriode : phPeriode.filter((r) => r.typeId === filtres.type);

  return { ph, poids, phPeriode, poidsPeriode, phAffiches, phTaux: phPeriode.length ? Math.round((phPeriode.filter((r) => r.conforme).length / phPeriode.length) * 100) : null,
  poidsTaux: poidsPeriode.length ? Math.round((poidsPeriode.filter((r) => r.conforme).length / poidsPeriode.length) * 100) : null, horsTolerance: poidsPeriode.filter((r) => !r.conforme).length,
  horsSeuil: phPeriode.filter((r) => !r.conforme).length, };
}

/* ── Fragments de rendu ───────────────────────────────────────────────────── */

function kpi(etiquette, valeur, unite, delta, marque) { return `<div class="sheet"><div class="kpi"> <p class="kpi__label">${echapper(etiquette)}</p> <p class="kpi__value num">${valeur}${
unite ? `<span class="kpi__unit">${echapper(unite)}</span>` : ''}</p> ${delta ? `<p class="kpi__delta${marque === 'danger' || marque === 'warn' ? ' is-down' : ' is-up'}">${
marque ? `<span class="mark ${'mark--' + marque}"> </span>` : ''}${echapper(delta)}</p>` : ''} </div></div>`;
}

function blocSeg() { return `<div class="seg" role="tablist" aria-label="Volet de contrôle"> <button class="seg__item${volet === 'ph' ? ' is-active' : ''}" type="button" role="tab" aria-selected="${
volet === 'ph'}" data-action="volet-ph">Relevés de pH</button> <button class="seg__item${volet === 'poids' ? ' is-active' : ''}" type="button" role="tab" aria-selected="${
volet === 'poids'}" data-action="volet-poids">Contrôles de poids</button> </div>`;
}

function filtresBarre(d) { const options = PERIODES.map((p) => `<option value="${echapper(p.id)}"${filtres.periode === p.id ? ' selected' : ''}>${echapper(p.label)}</option>`).join('');
  const types = `<option value="tous"${filtres.type === 'tous' ? ' selected' : ''}>Tous les types</option> ${TYPES_PH.map((t) => `<option value="${echapper(t.id)}"${
  filtres.type === t.id ? ' selected' : ''}>${echapper(t.label)}</option>`).join('')}`;
  return `<div class="toolbar"> <span class="unit">Période</span> <select class="select" data-filtre="periode" aria-label="Période">${options}</select> ${
  volet === 'ph' ? `<span class="unit">Type</span> <select class="select" data-filtre="type" aria-label="Type de produit">${types}</select>` : ''} <span class="unit">${volet === 'ph' ? `${
  d.phAffiches.length} relevé(s)` : `${d.poidsPeriode.length} contrôle(s)`}</span> </div>`;
}

function lignesPh(d, ctx) { return d.phAffiches.map((r) => `<tr> <td>${echapper(r.libelleType)}<span class="unit"> ${echapper(r.product || '')}</span></td> <td class="num">${decimal(
r.valeur)}</td> <td class="num muted">${echapper(r.seuil)}</td> <td> <span class="mark ${r.conforme ? 'mark--ok' : 'mark--danger'}"></span><span class="mark__label">${
r.conforme ? 'Conforme' : 'Hors seuil'}</span></td> <td>${echapper(r.operator || '—')}</td> <td class="num">${r.horodatage === null ? echapper(r.time || '—') : `${echapper(ctx.fmt.date(new Date(
r.horodatage).toISOString()))} <span class="unit">${echapper(ctx.fmt.time(new Date(r.horodatage).toISOString(
)))}</span>`}</td> <td class="right"> <button class="icon-btn" type="button" data-action="del-ph" data-ref="${echapper(r.id)}" aria-label="Supprimer ce relevé">${ctx.icon('trash', 16)}</button></td> </tr>`).join('');
}

function lignesPoids(d, ctx) { return d.poidsPeriode.map((r) => `<tr> <td>${echapper(r.dishName)}</td> <td class="num">${echapper(ctx.fmt.quantity(r.cible, 'g'))}</td> <td class="num">${echapper(
ctx.fmt.quantity(r.reel, 'g'))}</td> <td class="num">${r.ecart === null ? '—' : `${ctx.fmt.signed(Number(r.ecart.toFixed(1)))} %`}</td> <td class="num muted">± ${decimal(r.tolerance,
1)} %</td> <td> <span class="mark ${r.conforme ? 'mark--ok' : 'mark--danger'}"></span><span class="mark__label">${r.conforme ? 'Dans la tolérance' : 'Hors tolérance'}</span></td> <td>${echapper(
r.operator || '—')}</td> <td class="right"> <button class="icon-btn" type="button" data-action="del-poids" data-ref="${echapper(r.id)}" aria-label="Supprimer ce contrôle">${ctx.icon('trash', 16)}</button></td> </tr>`).join('');
}

function voletPh(d, ctx) { const kpis = `<div class="grid grid--4"> ${kpi('Relevés de pH', String(d.phPeriode.length), '', 'sur la période sélectionnée', 'neutral')} ${kpi('Conformité pH',
d.phTaux === null ? '—' : String(d.phTaux), '%', d.horsSeuil ? `${d.horsSeuil} relevé(s) hors seuil` : 'acidification maîtrisée', d.horsSeuil ? 'danger' : 'ok')} ${kpi('Seuil riz vinaigré', seuilTexte(
'SUSHI_RICE'), '', echapper(PH.SUSHI_RICE.label), 'ok')} ${kpi('Eau de réseau', seuilTexte('NEUTRAL_WATER'), '', 'contrôle de potabilité interne', 'ok')} </div>`;
  const corps = d.phAffiches.length
    ? `<div class="sheet"><div class="sheet__body"><table class="table table--zebra table--scroll"> <thead><tr><th>Type · produit</th><th>pH mesuré</th><th>Seuil appliqué</th> <th>Statut</th><th>Opérateur</th><th>Horodatage</th><th></th></tr></thead> <tbody>${lignesPh(d, ctx)}</tbody></table></div></div>`
    : ctx.ui.empty({ icon: 'droplet', title: 'Aucun relevé de pH sur la période', body: 'Enregistrez un relevé (riz vinaigré, conserves acides, marinades ou eau de réseau) — le seuil applicable est calculé automatiquement.', actionLabel: 'Nouveau relevé pH', onAction: () => formulairePh(ctx), });
  return `${kpis} <section class="section"> <div class="section__head"> <h2 class="section__title">Registre des mesures de pH</h2> <button class="btn btn--ghost btn--sm section__action" type="button" data-action="export-ph">${ctx.icon('download', 16)} Export CSV</button> </div> ${filtresBarre(d)}${corps} </section>`;
}

function voletPoids(d, ctx) { const kpis = `<div class="grid grid--4"> ${kpi('Contrôles de poids', String(d.poidsPeriode.length), '', 'sur la période sélectionnée', 'neutral')} ${kpi(
'Dans la tolérance', d.poidsTaux === null ? '—' : String(d.poidsTaux), '%', d.horsTolerance ? `${d.horsTolerance} écart(s) de grammage` : 'portionnement précis', d.horsTolerance ? 'danger' : 'ok')} ${
kpi('Tolérance appliquée', `± ${decimal(TOLERANCE_POIDS, 1)}`, '%', echapper('HACCP_NORMS.WEIGHT'), 'ok')} ${kpi('Hors tolérance', String(d.horsTolerance), '',
d.horsTolerance ? 'non-conformités créées automatiquement' : 'aucune dérive constatée', d.horsTolerance ? 'danger' : 'ok')} </div>`;
  const corps = d.poidsPeriode.length
    ? `<div class="sheet"><div class="sheet__body"><table class="table table--zebra table--scroll"> <thead><tr><th>Produit</th><th>Poids cible</th><th>Poids réel</th> <th>Écart</th><th>Tolérance</th><th>Statut</th><th>Opérateur</th><th></th></tr></thead> <tbody>${lignesPoids(d, ctx)}</tbody></table></div></div>`
    : ctx.ui.empty({ icon: 'scale', title: 'Aucun contrôle de poids sur la période',
    body: `Pesez une portion et comparez-la au grammage cible : l'écart est calculé en direct contre la tolérance de ± ${decimal(TOLERANCE_POIDS, 1)} %.`, actionLabel: 'Nouveau contrôle de poids', onAction: () => formulairePoids(ctx), });
  return `${kpis} <section class="section"> <div class="section__head"> <h2 class="section__title">Registre des grammages</h2> <button class="btn btn--ghost btn--sm section__action" type="button" data-action="export-poids">${ctx.icon('download', 16)} Export CSV</button> </div> ${filtresBarre(d)}${corps} </section>`;
}

/* ── Contrat de vue ───────────────────────────────────────────────────────── */

export const meta = { id: 'ph-weight', idx: '11', icon: 'scale', title: 'pH et poids', desc: 'Contrôles spécialisés', permissions: null, };

export function render(ctx) { const d = donnees(ctx);
  const entete = `<header class="page-head"> <span class="page-head__idx">11</span> <h1 class="page-head__title">pH et poids</h1> <p class="page-head__desc">Acidification barrière anti-botulique et précision du portionnement — relevés opposables en contrôle DDPP.</p> </header>`;
  const outils = `<div class="toolbar"> <button class="btn btn--primary" type="button" data-action="new-ph">${ctx.icon('droplet',
  16)} Nouveau relevé pH</button> <button class="btn" type="button" data-action="new-poids">${ctx.icon('scale', 16)} Nouveau contrôle de poids</button> </div>`;
  const callout = `<div class="callout callout--info" role="note">${ctx.icon('shield', 16)} <span>pH : seuils ${echapper('HACCP_NORMS.PH')} selon le produit (
  barrière anti-botulique). Poids : tolérance de portionnement ± ${decimal(TOLERANCE_POIDS, 1)} %. Tout dépassement crée un écart et une non-conformité automatique.</span> </div>`;
  return `${entete}${outils}${blocSeg()}${callout}${volet === 'ph' ? voletPh(d, ctx) : voletPoids(d, ctx)}`;
}

/* ── Saisie du pH (bouton naguère mort) ───────────────────────────────────── */

function apercuPh(ctx) { if (!panneau) return ''; const typeId = champ(panneau, 'type') || 'SUSHI_RICE'; const valeur = nombre(champ(panneau, 'valeur')); const norme = normePh(typeId);
  const conforme = conformePh(typeId, valeur);
  const ecart = valeur === null || !norme || norme.max === undefined ? null : valeur - norme.max;
  const statut = valeur === null ? 'Saisie en cours' : conforme ? 'Conforme' : 'Hors seuil';
  return `<div class="row"> <span class="strong">Seuil applicable : ${echapper(seuilTexte(typeId))}</span> <span class="num">pH saisi : ${decimal(valeur)}</span> ${
  ecart === null ? '' : `<span class="unit">Écart au seuil : ${decimal(ecart)}</span>`} <span class="mark ${
  valeur === null ? 'mark--neutral' : conforme ? 'mark--ok' : 'mark--danger'}"> </span> <span class="mark__label">${echapper(statut)}</span> </div> <p class="field__hint">${echapper(norme ? norme.label : '')}</p>`;
}

function formulairePh(ctx) { panneau = null; ctx.ui.panel({ id: 'phweight-ph', title: 'Nouveau relevé de pH', subtitle: 'seuil automatique',
body: `<div class="stack"> <div class="field"><label class="field__label" for="pw-type">Type de produit</label> <select class="select" id="pw-type" data-champ="type"> ${TYPES_PH.map((
t) => `<option value="${echapper(t.id)}">${echapper(t.label)} — ${echapper(seuilTexte(t.id))}</option>`).join(
'')} </select> </div> <div class="field"><label class="field__label" for="pw-produit">Préparation / lot</label> <input class="input" id="pw-produit" data-champ="produit" type="text" placeholder="Ex. : rice vinaigré service du soir"> </div> <div class="field"><label class="field__label" for="pw-valeur">pH mesuré (2 décimales)</label> <input class="input" id="pw-valeur" data-champ="valeur" type="number" step="0.01" min="0" max="14" placeholder="Ex. : 4.10"> </div> <div class="callout" data-role="apercu">${apercuPh(ctx)}</div> <p class="field__hint">L'écart et le seuil sont recalculés à chaque frappe. Un dépassement enregistre le relevé et crée une non-conformité automatique.</p> </div>`, actions: [ { label: 'Enregistrer le relevé', kind: 'primary', onClick: () => enregistrerPh(ctx) }, { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay('phweight-ph') }, ], onMount: (el) => { panneau = el;
      const maj = () => { const zone = el.querySelector('[data-role="apercu"]'); if (zone) zone.innerHTML = apercuPh(ctx); };
      el.addEventListener('input', maj);
      el.addEventListener('change', maj);
      maj();
    }, });
}

function enregistrerPh(ctx) { if (!panneau) return; const typeId = champ(panneau, 'type') || 'SUSHI_RICE'; const produit = champ(panneau, 'produit'); const valeur = nombre(champ(panneau, 'valeur'));
  const norme = normePh(typeId);
  if (valeur === null) { ctx.ui.toast({ status: 'warn', message: 'Saisissez la valeur de pH mesurée.' }); return; }
  if (!norme) { ctx.ui.toast({ status: 'warn', message: 'Type de produit inconnu.' }); return; }

  const operateur = nomOperateur(ctx);
  const libelle = (TYPES_PH.find((t) => t.id === typeId) || {}).label || typeId;
  const enregistrement = ctx.useCases.recordPhMeasure({ product: produit || libelle, measuredPh: valeur, targetMaxPh: norme.max !== undefined ? norme.max : valeur, }, operateur);

  const releves = ctx.repository.getPhRecords() || [];
  const cible = releves.find((r) => r.id === enregistrement.id) || enregistrement;
  Object.assign(cible, { typeId, phMin: norme.min !== undefined ? norme.min : null, at: new Date().toISOString() });
  ctx.repository.savePhRecords(releves);

  const conforme = conformePh(typeId, valeur);
  if (!conforme) { const horsMin = norme.min !== undefined && valeur < norme.min; cible.status = 'danger'; ctx.repository.savePhRecords(releves); if (horsMin) {
      // Dépassement par le bas : le use-case ne teste que le maximum, la
      // déclaration reste donc à la charge de la vue.
      ctx.useCases.declareNonConformity({ category5M: 'Matière Première', severity: 'Critique', equipOrSubject: `pH sous le minimum : ${produit || libelle} — pH ${decimal(valeur)} (${seuilTexte(
      typeId)})`, cause: 'pH inférieur au minimum requis : eau ou préparation non conforme au regard de la potabilité et de l\'hygiène du process.', action: 'Contre-analyse réalisée, réseau d\'eau signalé et usage suspendu jusqu\'au rétablissement du seuil.', operator: operateur, status: 'Ouverte', }, operateur); ctx.ui.toast({ status: 'danger', message: `pH ${decimal(valeur)} sous le seuil (${seuilTexte(typeId)}) — écart et non-conformité créés.` });
    } else {
      // pH > maximum : le use-case recordPhMeasure a déjà déclaré la non-conformité.
      ctx.ui.toast({ status: 'danger', message: `pH ${decimal(valeur)} hors seuil (${seuilTexte(typeId)}) — non-conformité créée automatiquement.` });
    }
  } else { ctx.ui.toast({ status: 'ok', message: `Relevé pH conforme enregistré (${decimal(valeur)}).` });
  }
  if (ctx.account && typeof ctx.account.logActivity === 'function') { ctx.account.logActivity({ action: 'Relevé pH', target: produit || libelle, details: `pH ${decimal(valeur)} — ${seuilTexte(typeId)}` });
  }
  ctx.ui.closeOverlay('phweight-ph');
  panneau = null;
}

/* ── Saisie du poids (bouton naguère mort) ────────────────────────────────── */

function apercuPoids(ctx) { if (!panneau) return ''; const cible = nombre(champ(panneau, 'cible')); const reel = nombre(champ(panneau, 'reel'));
  const ecart = cible !== null && reel !== null && cible > 0 ? ((reel - cible) / cible) * 100 : null;
  const conforme = ecart !== null && Math.abs(ecart) <= TOLERANCE_POIDS;
  const statut = ecart === null ? 'Saisie en cours' : conforme ? 'Dans la tolérance' : 'Hors tolérance';
  return `<div class="row"> <span class="strong">Tolérance : ± ${decimal(TOLERANCE_POIDS, 1)} %</span> <span class="num">Écart : ${ecart === null ? '—' : `${ctx.fmt.signed(Number(ecart.toFixed(
  1)))} %`}</span> ${ecart === null ? '' : `<span class="unit">Soit ${echapper(ctx.fmt.quantity(reel - cible, 'g'))} sur la portion</span>`} <span class="mark ${
  ecart === null ? 'mark--neutral' : conforme ? 'mark--ok' : 'mark--danger'}"> </span> <span class="mark__label">${echapper(statut)}</span> </div> <p class="field__hint">Recalculé à chaque frappe (
  cible × tolérance → poids mini/maxi admis).</p>`;
}

function formulairePoids(ctx) { panneau = null; ctx.ui.panel({ id: 'phweight-poids', title: 'Nouveau contrôle de poids', subtitle: `± ${decimal(TOLERANCE_POIDS, 1)} %`,
body: `<div class="stack"> <div class="field"><label class="field__label" for="pw-produit-poids">Produit portionné</label> <input class="input" id="pw-produit-poids" data-champ="produit" type="text" placeholder="Ex. : pavé de saumon 140 g"> </div> <div class="grid grid--2"> <div class="field"><label class="field__label" for="pw-cible">Poids cible (g)</label> <input class="input" id="pw-cible" data-champ="cible" type="number" step="1" min="1" placeholder="Ex. : 140"> </div> <div class="field"><label class="field__label" for="pw-reel">Poids réel (g)</label> <input class="input" id="pw-reel" data-champ="reel" type="number" step="1" min="1" placeholder="Ex. : 148"> </div> </div> <div class="callout" data-role="apercu">${apercuPoids(ctx)}</div> <p class="field__hint">Un écart supérieur à ± ${decimal(TOLERANCE_POIDS, 1)} % enregistre le contrôle et crée une non-conformité automatique.</p> </div>`, actions: [ { label: 'Enregistrer le contrôle', kind: 'primary', onClick: () => enregistrerPoids(ctx) }, { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay('phweight-poids') }, ], onMount: (el) => { panneau = el;
      const maj = () => { const zone = el.querySelector('[data-role="apercu"]'); if (zone) zone.innerHTML = apercuPoids(ctx); };
      el.addEventListener('input', maj);
      maj();
    }, });
}

function enregistrerPoids(ctx) { if (!panneau) return; const produit = champ(panneau, 'produit'); const cible = nombre(champ(panneau, 'cible')); const reel = nombre(champ(panneau, 'reel'));
  if (!produit) { ctx.ui.toast({ status: 'warn', message: 'Indiquez le produit portionné.' }); return; }
  if (cible === null || reel === null || cible <= 0) { ctx.ui.toast({ status: 'warn', message: 'Renseignez le poids cible et le poids réel (en grammes).' }); return; }

  const operateur = nomOperateur(ctx);
  const ecart = ((reel - cible) / cible) * 100;
  const enregistrement = ctx.useCases.recordWeightMeasure({ dishName: produit, targetWeight: cible, measuredWeight: reel, tolerancePercent: TOLERANCE_POIDS, }, operateur);

  const controles = ctx.repository.getWeightRecords() || [];
  const cibleRec = controles.find((r) => r.id === enregistrement.id) || enregistrement;
  cibleRec.at = new Date().toISOString();
  ctx.repository.saveWeightRecords(controles);

  if (Math.abs(ecart) > TOLERANCE_POIDS) { ctx.useCases.declareNonConformity({ category5M: 'Méthode', severity: Math.abs(ecart) > TOLERANCE_POIDS * 2 ? 'Critique' : 'Majeure',
  equipOrSubject: `Grammage hors tolérance : ${produit} — ${ctx.fmt.quantity(reel, 'g')} pour une cible de ${ctx.fmt.quantity(cible, 'g')}`, cause: `Écart de ${ctx.fmt.signed(Number(ecart.toFixed(
  1)))} % supérieur à la tolérance de portionnement de ± ${decimal(TOLERANCE_POIDS, 1)} %.`, action: 'Portions du service repesées, réglage du matériel de portionnement corrigé et fiche technique réexpliquée à la brigade.', operator: operateur, status: 'Ouverte', }, operateur); ctx.ui.toast({ status: 'danger', message: `Écart de ${ctx.fmt.signed(Number(ecart.toFixed(1)))} % hors tolérance — non-conformité créée.` });
  } else { ctx.ui.toast({ status: 'ok', message: `Contrôle de poids conforme (${ctx.fmt.signed(Number(ecart.toFixed(1)))} %).` });
  }
  if (ctx.account && typeof ctx.account.logActivity === 'function') { ctx.account.logActivity({ action: 'Contrôle de poids', target: produit, details: `${ctx.fmt.quantity(reel, 'g')} pour cible ${ctx.fmt.quantity(cible, 'g')}` });
  }
  ctx.ui.closeOverlay('phweight-poids');
  panneau = null;
}

/* ── Actions ──────────────────────────────────────────────────────────────── */

function champ(el, nom) { const noeud = el.querySelector(`[data-champ="${nom}"]`); return noeud ? String(noeud.value || '').trim() : ''; }

async function supprimer(ctx, type, ref) { const confirme = await ctx.ui.confirm({ title: 'Supprimer cet enregistrement', body: `L'enregistrement ${
ref} sera définitivement retiré du registre. Cette suppression est tracée dans le journal d'activité.`, confirmLabel: 'Supprimer', danger: true, });
  if (!confirme) return;
  if (type === 'ph') ctx.useCases.deletePhRecord(ref);
  else ctx.useCases.deleteWeightRecord(ref);
  if (ctx.account && typeof ctx.account.logActivity === 'function') { ctx.account.logActivity({ action: 'Suppression', target: ref, details: 'Suppression d\'un contrôle pH/poids' }); }
  ctx.ui.toast({ status: 'ok', message: 'Enregistrement supprimé.' });
}

function exporter(ctx, type) { if (!ctx.exports || typeof ctx.exports.exportRecordsCsv !== 'function') return; const fichier = ctx.exports.exportRecordsCsv(ctx, { type });
  ctx.exports.downloadFile(fichier.filename, fichier.content, fichier.mime);
  ctx.ui.toast({ status: 'ok', message: 'Export CSV généré.' });
}

const ACTIONS = { 'volet-ph': (el, root, ctx) => { volet = 'ph'; rafraichir(root, ctx); }, 'volet-poids': (el, root, ctx) => { volet = 'poids'; rafraichir(root, ctx); }, 'new-ph': (el, root,
ctx) => formulairePh(ctx), 'new-poids': (el, root, ctx) => formulairePoids(ctx), 'del-ph': (el, root, ctx) => { supprimer(ctx, 'ph', el.getAttribute('data-ref')); }, 'del-poids': (el, root, ctx) => {
supprimer(ctx, 'poids', el.getAttribute('data-ref')); }, 'export-ph': (el, root, ctx) => exporter(ctx, 'ph'), 'export-poids': (el, root, ctx) => exporter(ctx, 'weights'), };

function attacher(root, ctx) { if (root.__traqhaccpPhweightEcoute) return; root.__traqhaccpPhweightEcoute = true; root.addEventListener('click', (e) => { const el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (el && root.contains(el)) { const action = ACTIONS[el.getAttribute('data-action')]; if (action) action(el, root, ctx); return; }
    const filtre = e.target.closest ? e.target.closest('[data-filtre]') : null;
    if (filtre && root.contains(filtre)) { filtres[filtre.getAttribute('data-filtre')] = filtre.value; rafraichir(root, ctx); }
  });
  root.addEventListener('change', (e) => { const filtre = e.target.closest ? e.target.closest('[data-filtre]') : null; if (!filtre || !root.contains(filtre)) return;
    filtres[filtre.getAttribute('data-filtre')] = filtre.value;
    rafraichir(root, ctx);
  });
}

function rafraichir(root, ctx) { if (!root.isConnected || root.hidden) return; root.innerHTML = render(ctx); attacher(root, ctx); }

export function mount(root, ctx) { generation += 1; const gen = generation; attacher(root, ctx); abonnement = ctx.store.subscribe(() => { if (gen === generation) rafraichir(root, ctx); }); }

export function unmount(root) { generation += 1; if (abonnement) { abonnement(); abonnement = null; } panneau = null; if (root) delete root.__traqhaccpPhweightEcoute; }

/* marqueur utilitaire : aucune couleur ni classe hors design system */
