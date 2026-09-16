/**
 * src/presentation/views/defrost.js — Module 10 « Décongélation » (contrat de vue v4).
 *
 * Règle rappelée à l'écran : décongélation en enceinte réfrigérée ≤ +4 °C et
 * consommation sous J+2 (HACCP_NORMS.DEFROSTING — aucune valeur recopiée en dur).
 * Toute température d'enceinte relevée au-delà du maximum déclenche un écart
 * (statut « Écart ») ET une non-conformité automatique.
 *
 * Contrat : meta / render(ctx) / mount(root, ctx) / unmount(root).
 * Aucun onclick, aucun getElementById, aucune écriture hors de `root`.
 */
import { HACCP_NORMS } from '../../domain/constants.js';

const NORME = HACCP_NORMS.DEFROSTING;
const STATUTS = { en_cours: 'En cours', ecart: 'Écart', consomme: 'Terminé', jete: 'Écart' };
const MARQUES = { en_cours: 'mark--neutral', ecart: 'mark--danger', consomme: 'mark--ok', jete: 'mark--danger' };
const STATUTS_ACTIFS = ['en_cours', 'ecart']; // un cycle en écart reste suivi et clôturable
const DESTINATIONS = ['Usage du jour', 'J+1', 'J+2'];
const JOUR_MS = 24 * 3600 * 1000;
const RAFRAICHISSEMENT_MS = 60000; // le chrono se recalcule chaque minute

let generation = 0;
let abonnement = null;
let minuteur = null;
let panneau = null;

/* ── Helpers locaux ───────────────────────────────────────────────────────── */

function echapper(valeur) { return String(valeur === null || valeur === undefined ? '' : valeur) .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function nomOperateur(ctx) { const operateur = (ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null; if (!operateur) return 'Opérateur non identifié';
  return operateur.name || `${operateur.firstName || ''} ${operateur.lastName || ''}`.trim() || 'Opérateur non identifié';
}

/** Accepte un ISO, un datetime-local, ou une date/heure française « 16/09/2026 08:30 ». */
function ms(valeur) { if (!valeur) return null; if (valeur instanceof Date) return valeur.getTime(); if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null;
  const texte = String(valeur).trim();
  const fr = texte.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
  if (fr) { const heures = fr[4] ? Number(fr[4]) : 12; const minutes = fr[5] ? Number(fr[5]) : 0; return new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]), heures, minutes, 0, 0).getTime(); }
  const direct = Date.parse(texte);
  return Number.isNaN(direct) ? null : direct;
}

/** « 16/09/2026 » (format du dépôt) à partir d'un ISO / datetime-local. */
function jourFr(valeur) { const horodatage = ms(valeur); return horodatage === null ? '' : new Date(horodatage).toLocaleDateString('fr-FR'); }

function isoLocal(valeur) { const horodatage = ms(valeur); return horodatage === null ? '' : new Date(horodatage).toISOString(); }

function dureeTexte(depart, arrivee) { if (depart === null || arrivee === null) return '—'; const total = Math.max(0, arrivee - depart); const heures = Math.floor(total / 3600000);
  const minutes = Math.round((total % 3600000) / 60000);
  if (heures >= 24) return `${Math.floor(heures / 24)} j ${heures % 24} h`;
  if (heures === 0) return `${minutes} min`;
  return `${heures} h ${String(minutes).padStart(2, '0')} min`;
}

function heuresTexte(ecartMs) { const heures = Math.round(Math.abs(ecartMs) / 3600000); if (heures >= 48) return `${Math.floor(heures / 24)} j ${heures % 24} h`; return `${heures} h`; }

/* ── Lecture des données (aucune écriture) ────────────────────────────────── */

function donnees(ctx) { const brut = ctx.repository.getDefrostCycles() || []; const maintenant = Date.now(); const depuis7 = maintenant - 7 * JOUR_MS;

  const cycles = brut.map((c) => { const sortie = ms(c.startAt) || ms(c.startDate); const echeance = ms(c.maxDlcDate) || (sortie === null ? null : sortie + NORME.MAX_DAYS * JOUR_MS);
    const mesures = (Array.isArray(c.mesures) ? c.mesures : [])
      .map((m) => ({ at: ms(m.at), temp: Number(m.temp) }))
      .filter((m) => Number.isFinite(m.temp))
      .sort((a, b) => (a.at || 0) - (b.at || 0));
    const initiale = Number.isFinite(Number(c.tempEnceinte)) ? Number(c.tempEnceinte) : null;
    const temperatures = mesures.map((m) => m.temp);
    if (initiale !== null) temperatures.push(initiale);
    const temperatureMax = temperatures.length ? Math.max(...temperatures) : null;
    const enCours = STATUTS_ACTIFS.includes(c.status);
    return { ...c, sortie, echeance, mesures, initiale, temperatureMax, enCours, fin: ms(c.endAt), retard: enCours && echeance !== null && echeance < maintenant,
    conforme: temperatureMax === null ? c.status !== 'jete' : temperatureMax <= NORME.MAX_TEMP, };
  }).sort((a, b) => (b.sortie || 0) - (a.sortie || 0));

  const sept = cycles.filter((c) => (c.sortie || 0) >= depuis7);
  return { cycles, enCours: cycles.filter((c) => c.enCours), sept, conformes7: sept.filter((c) => c.conforme).length, total: cycles.length, };
}

/* ── Fragments de rendu ───────────────────────────────────────────────────── */

function kpi(etiquette, valeur, unite, delta, marque) { return `<div class="sheet"><div class="kpi"> <p class="kpi__label">${echapper(etiquette)}</p> <p class="kpi__value num">${valeur}${
unite ? `<span class="kpi__unit">${echapper(unite)}</span>` : ''}</p> ${delta ? `<p class="kpi__delta${marque === 'danger' || marque === 'warn' ? ' is-down' : ' is-up'}">${
marque ? `<span class="mark ${'mark--' + marque}"> </span>` : ''}${echapper(delta)}</p>` : ''} </div></div>`;
}

function blocKpis(d, ctx) { const taux = d.sept.length ? Math.round((d.conformes7 / d.sept.length) * 100) : null;
  return `<div class="grid grid--4"> ${kpi('Cycles en cours', String(d.enCours.length), '', d.enCours.length ? 'surveillance en cours' : 'aucun produit en décongélation',
  d.enCours.length ? 'warn' : 'ok')} ${kpi('Conformité 7 jours', taux === null ? '—' : String(taux), '%', `${d.conformes7} / ${d.sept.length} cycle(s) conforme(s)`,
  taux === null || taux === 100 ? 'ok' : 'danger')} ${kpi('Cycles suivis', String(d.total), '', 'historique conservé pour la DDPP', 'neutral')} ${kpi('Température max', ctx.fmt.temp(NORME.MAX_TEMP), '',
  `enceinte réfrigérée · consommation sous J+${NORME.MAX_DAYS}`, 'ok')} </div>`;
}

function blocRegle(ctx) { return `<div class="callout callout--info" role="note">${ctx.icon('snowflake',
16)} <span><strong>Règle sanitaire</strong> — sortie du congélateur à destination d'une enceinte réfrigérée à ${ctx.fmt.temp(NORME.MAX_TEMP)} maximum, recongélation strictement interdite,
consommation sous J+${NORME.MAX_DAYS} maximum (${echapper('HACCP_NORMS.DEFROSTING')}). Toute température d'enceinte supérieure crée un écart et une non-conformité.</span> </div>`;
}

function blocMesures(cycle, ctx) { if (!cycle.mesures.length && cycle.initiale === null) return ''; const points = [ ...(cycle.initiale === null ? [] : [{ at: cycle.sortie, temp: cycle.initiale,
initiale: true }]), ...cycle.mesures, ].map((m) => { const conforme = m.temp <= NORME.MAX_TEMP;
    return `<span class="temp ${conforme ? 'temp--ok' : 'temp--warm'}" title="${echapper(m.initiale ? 'Température de mise en enceinte' : 'Point de mesure')}">${ctx.fmt.temp(m.temp)}${
    m.at ? ` <span class="unit">${echapper(new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))}</span>` : ''}</span>`;
  }).join('');
  return `<div class="row">${points}</div>`;
}

function blocEnCours(d, ctx) { const cartes = d.enCours.map((c) => { const reste = c.echeance === null ? null : c.echeance - Date.now(); const chrono = c.retard ? `Échéance J+${
NORME.MAX_DAYS} dépassée de ${heuresTexte(reste)}` : `Échéance J+${NORME.MAX_DAYS} dans ${heuresTexte(reste)}`;
    return `<div class="sheet"> <div class="sheet__head"> <span class="strong">${echapper(c.product)}</span> <span class="unit">${echapper(
    c.chamberName || '—')}</span> </div> <div class="sheet__body stack"> <p class="chrono${c.retard ? ' chrono--late' : ''}">${echapper(dureeTexte(c.sortie, Date.now()))} · ${echapper(
    chrono)}</p> <p class="muted">Provenance : ${echapper(c.batchOrigin || '—')} · destination : ${echapper(c.destination || '—')}${c.quantite ? ` · ${echapper(c.quantite)}` : ''}</p> ${blocMesures(c,
    ctx)} <div class="row"> <button class="btn btn--ghost btn--sm" type="button" data-action="add-measure" data-cycle="${echapper(c.id)}">${ctx.icon('thermometer',
    16)} Point de mesure</button> <button class="btn btn--primary btn--sm" type="button" data-action="end-cycle" data-cycle="${echapper(c.id)}">${ctx.icon('check',
    16)} Terminer</button> <button class="btn btn--danger btn--sm" type="button" data-action="scrap-cycle" data-cycle="${echapper(c.id)}">${ctx.icon('trash', 16)} Jeter le lot</button> </div> </div> </div>`;
  }).join('');
  return `<section class="section"> <div class="section__head"> <h2 class="section__title">Cycles en cours</h2> <span class="unit">${d.enCours.length} produit(
  s) en décongélation</span> </div> <div class="grid grid--2">${cartes}</div> </section>`;
}

function blocHistorique(d, ctx) { const lignes = d.cycles.map((c) => { const marque = MARQUES[c.status] || 'mark--neutral';
    return `<tr> <td>${echapper(c.product)}</td> <td class="num">${echapper(c.sortie === null ? '—' : ctx.fmt.date(isoLocal(c.sortie)))} <span class="unit">${echapper(
    c.sortie === null ? '' : ctx.fmt.time(isoLocal(c.sortie)))}</span> </td> <td class="num">${echapper(c.fin === null ? '—' : ctx.fmt.time(isoLocal(c.fin)))}</td> <td class="num">${echapper(dureeTexte(
    c.sortie, c.fin))}</td> <td class="num">${c.temperatureMax === null ? '—' : ctx.fmt.temp(c.temperatureMax)}</td> <td>
      <span class="mark ${marque}"></span><span class="mark__label">${echapper(STATUTS[c.status] || c.status)}</span></td> <td>${echapper(c.destination || '—')}</td> <td class="muted">${echapper(
      c.operateur_ || c.operator || '—')}</td> </tr>`;
  }).join('');
  return `<section class="section"> <div class="section__head"> <h2 class="section__title">Historique des décongélations</h2> <span class="unit">${d.cycles.length} enregistrement(
  s)</span> <button class="btn btn--ghost btn--sm section__action" type="button" data-action="export-csv">${ctx.icon('download',
  16)} Export CSV</button> </div> <div class="sheet"> <div class="sheet__body"> <table class="table table--zebra table--scroll"> <thead><tr> <th>Produit</th><th>Sortie</th><th>Fin</th><th>Durée</th><th>Temp. max</th> <th>Statut</th>
    <th>Destination</th><th>Opérateur</th> </tr></thead> <tbody>${lignes}</tbody> </table> </div></div> </section>`;
}

/* ── Contrat de vue ───────────────────────────────────────────────────────── */

export const meta = { id: 'defrost', idx: '10', icon: 'flame', title: 'Décongélation', desc: 'Cycles et températures de décongélation', permissions: null, };

export function render(ctx) { const d = donnees(ctx);
  const entete = `<header class="page-head"> <span class="page-head__idx">10</span> <h1 class="page-head__title">Décongélation</h1> <p class="page-head__desc">Sortie de congélateur,
  mise en enceinte réfrigérée à ${ctx.fmt.temp(NORME.MAX_TEMP)} maximum et consommation sous J+${NORME.MAX_DAYS}.</p> </header>`;
  const outils = `<div class="toolbar"> <button class="btn btn--primary" type="button" data-action="new-cycle">${ctx.icon('plus',
  16)} Nouvelle décongélation</button> <button class="btn btn--ghost" type="button" data-action="export-csv">${ctx.icon('download', 16)} Export CSV</button> </div>`;
  const corps = d.cycles.length
    ? `${blocEnCours(d, ctx)}${blocHistorique(d, ctx)}`
    : ctx.ui.empty({ icon: 'snowflake', title: 'Aucune décongélation enregistrée', body: `Aucun cycle suivi pour le moment. Déclarez la sortie du congélateur pour ouvrir le suivi J+${NORME.MAX_DAYS}.`,
    actionLabel: 'Nouvelle décongélation', onAction: () => formulaireCycle(ctx), });
  return `${entete}${outils} <section class="section"> <div class="section__head"><h2 class="section__title">Indicateurs</h2></div> ${blocKpis(d, ctx)} </section> ${blocRegle(ctx)} ${corps}`;
}

/* ── Formulaire : nouvelle décongélation ──────────────────────────────────── */

function champValeur(el, nom) { const champ = el.querySelector(`[data-champ="${nom}"]`); return champ ? String(champ.value || '').trim() : ''; }

function formulaireCycle(ctx) { panneau = null; const maintenant = new Date();
  const corps = `<div class="stack"> <div class="field"><label class="field__label" for="dec-produit">Produit décongelé</label> <input class="input" id="dec-produit" data-champ="produit" type="text" placeholder="Ex. : filets de cabillaud"> </div> <div class="field"><label class="field__label" for="dec-quantite">Quantité</label> <input class="input" id="dec-quantite" data-champ="quantite" type="text" placeholder="Ex. : 4 kg · 12 barquettes">
    </div> <div class="field"><label class="field__label" for="dec-provenance">Provenance (
    congélateur)</label> <input class="input" id="dec-provenance" data-champ="provenance" type="text" placeholder="Ex. : congélateur arrière n°2"> </div> <div class="grid grid--2"> <div class="field"><label class="field__label" for="dec-sortie">Date de sortie</label> <input class="input" id="dec-sortie" data-champ="sortie" type="date" value="${echapper(maintenant.toISOString().slice(0, 10))}">
    </div> <div class="field"><label class="field__label" for="dec-heure">Heure de sortie</label> <input class="input" id="dec-heure" data-champ="heure" type="time" value="${echapper(
    maintenant.toTimeString().slice(0, 5))}"> </div> </div> <div class="field"><label class="field__label" for="dec-duree">Durée prévue</label> <input class="input" id="dec-duree" data-champ="duree" type="number" min="1" step="1" value="24"> <p class="field__hint">Heures prévues en enceinte réfrigérée — la consommation reste bornée à J+${NORME.MAX_DAYS}.</p>
    </div> <div class="field"><label class="field__label" for="dec-destination">Destination</label> <select class="select" id="dec-destination" data-champ="destination"> ${DESTINATIONS.map((
    dest) => `<option value="${echapper(dest)}">${echapper(dest)}</option>`).join(
    '')} </select> </div> <div class="field"><label class="field__label" for="dec-enceinte">Enceinte utilisée</label> <input class="input" id="dec-enceinte" data-champ="enceinte" type="text" value="${echapper('Chambre froide positive')}">
    </div> <div class="field"><label class="field__label" for="dec-temperature">Température de l'enceinte</label> <input class="input" id="dec-temperature" data-champ="temperature" type="number" step="0.1" value="${echapper('2.0')}"> <p class="field__hint">Maximum réglementaire : ${ctx.fmt.temp(NORME.MAX_TEMP)}.</p> </div> <div class="callout callout--info">${ctx.icon('snowflake', 16)}<span>Une température supérieure à ${ctx.fmt.temp(NORME.MAX_TEMP)} déclenche un écart et une non-conformité automatique dès l'enregistrement.</span>
    </div> </div>`;
  ctx.ui.panel({ id: 'defrost-cycle', title: 'Nouvelle décongélation', subtitle: `J+${NORME.MAX_DAYS} max`, body: corps, actions: [ { label: 'Enregistrer', kind: 'primary', onClick: (
  ) => enregistrerCycle(ctx) }, { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay('defrost-cycle') }, ], onMount: (el) => { panneau = el; }, });
}

function enregistrerCycle(ctx) { if (!panneau) return; const produit = champValeur(panneau, 'produit'); const enceinte = champValeur(panneau, 'enceinte') || 'Chambre froide positive';
  const sortie = champValeur(panneau, 'sortie');
  const heure = champValeur(panneau, 'heure') || '00:00';
  const temperature = Number(champValeur(panneau, 'temperature').replace(',', '.'));
  if (!produit) { ctx.ui.toast({ status: 'warn', message: 'Indiquez le produit décongelé.' }); return; }
  if (!Number.isFinite(temperature)) { ctx.ui.toast({ status: 'warn', message: 'Saisissez la température de l\'enceinte.' }); return; }

  const operateur = nomOperateur(ctx);
  const depart = ms(`${sortie.split('-').reverse().join('/')} ${heure}`) || Date.now();
  const echeance = new Date(depart + NORME.MAX_DAYS * JOUR_MS);
  const cycle = ctx.useCases.startDefrostCycle({ product: produit, batchOrigin: champValeur(panneau, 'provenance') || '—', startDate: new Date(depart).toLocaleDateString('fr-FR'),
  maxDlcDate: echeance.toLocaleDateString('fr-FR'), chamberName: enceinte, status: 'en_cours', }, operateur);

  const cycles = ctx.repository.getDefrostCycles() || [];
  const cible = cycles.find((c) => c.id === cycle.id) || cycle;
  Object.assign(cible, { startAt: new Date(depart).toISOString(), quantite: champValeur(panneau, 'quantite'), destination: champValeur(panneau, 'destination'), dureePrevueH: Number(champValeur(panneau,
  'duree')) || null, tempEnceinte: temperature, mesures: [], });
  ctx.repository.saveDefrostCycles(cycles);

  if (temperature > NORME.MAX_TEMP) { declarerEcart(ctx, cible, temperature, `Mise en enceinte à ${temperature} °C : rupture de la chaîne du froid en cours de décongélation (maximum ${
  NORME.MAX_TEMP} °C).`, 'Enceinte corrective vérifiée, produit consigné et lot réorienté vers consommation immédiate ou destruction.');
    ctx.useCases.updateDefrostStatus(cycle.id, 'ecart');
    ctx.ui.toast({ status: 'danger', message: `Température ${temperature} °C supérieure au maximum : écart et non-conformité créés.` });
  } else { ctx.ui.toast({ status: 'ok', message: 'Cycle de décongélation ouvert.' });
  }
  if (ctx.account && typeof ctx.account.logActivity === 'function') { ctx.account.logActivity({ action: 'Décongélation', target: produit, details: `${enceinte} à ${temperature} °C` }); }
  ctx.ui.closeOverlay('defrost-cycle');
  panneau = null;
}

/* ── Point de mesure / statuts ────────────────────────────────────────────── */

function declarerEcart(ctx, cycle, temperature, cause, action) { const operateur = nomOperateur(ctx); ctx.useCases.declareNonConformity({ category5M: 'Matière Première',
severity: temperature > NORME.MAX_TEMP ? 'Critique' : 'Majeure', equipOrSubject: `Décongélation ${cycle.product} — ${cycle.chamberName || 'enceinte'} à ${temperature} °C`, cause, action,
operator: operateur, status: 'Ouverte', }, operateur);
}

function formulaireMesure(ctx, id) { const cycle = (ctx.repository.getDefrostCycles() || []).find((c) => c.id === id); if (!cycle) return; panneau = null; ctx.ui.panel({ id: 'defrost-mesure',
title: 'Point de mesure', subtitle: cycle.product,
body: `<div class="stack"> <div class="field"><label class="field__label" for="mes-temperature">Température de l'enceinte</label> <input class="input" id="mes-temperature" data-champ="temperature" type="number" step="0.1" placeholder="Ex. : 3.2"> <p class="field__hint">Maximum : ${ctx.fmt.temp(NORME.MAX_TEMP)} — au-delà, écart et non-conformité automatiques.</p> </div> <div class="callout callout--info">${ctx.icon('thermometer', 16)}<span>Relevé consigné dans le cycle ${echapper(cycle.id)} au nom de l'opérateur connecté.</span> </div> </div>`, actions: [ { label: 'Enregistrer le relevé', kind: 'primary', onClick: () => enregistrerMesure(ctx, id) }, { label: 'Annuler', kind: 'ghost', onClick: () => ctx.ui.closeOverlay('defrost-mesure') }, ], onMount: (el) => { panneau = el; }, });
}

function enregistrerMesure(ctx, id) { if (!panneau) return; const temperature = Number(champValeur(panneau, 'temperature').replace(',', '.'));
  if (!Number.isFinite(temperature)) { ctx.ui.toast({ status: 'warn', message: 'Saisissez une température valide.' }); return; }
  const cycles = ctx.repository.getDefrostCycles() || [];
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) return;
  if (!Array.isArray(cycle.mesures)) cycle.mesures = [];
  cycle.mesures.push({ at: new Date().toISOString(), temp: temperature, operator: nomOperateur(ctx) });
  if (!Number.isFinite(Number(cycle.tempEnceinte))) cycle.tempEnceinte = temperature;
  if (temperature > NORME.MAX_TEMP) { cycle.status = 'ecart';
    declarerEcart(ctx, cycle, temperature, `Point de mesure à ${temperature} °C pendant la décongélation : dépassement du maximum d'enceinte réfrigérée (${NORME.MAX_TEMP} °C).`,
    'Produit réorienté vers cuisson immédiate ou destruction, enceinte recontrôlée et plan de surveillance ajusté.');
    ctx.ui.toast({ status: 'danger', message: `Écart relevé (${temperature} °C) — non-conformité créée et cycle basculé en « Écart ».` });
  } else { ctx.ui.toast({ status: 'ok', message: `Relevé consigné : ${temperature} °C.` });
  }
  ctx.repository.saveDefrostCycles(cycles);
  ctx.ui.closeOverlay('defrost-mesure');
  panneau = null;
}

async function terminerCycle(ctx, id, statut) { const cycle = (ctx.repository.getDefrostCycles() || []).find((c) => c.id === id); if (!cycle) return; let nouveau = statut; if (statut === 'consomme') {
const temperatures = (Array.isArray(cycle.mesures) ? cycle.mesures : []).map((m) => Number(m.temp))
      .concat(Number.isFinite(Number(cycle.tempEnceinte)) ? [Number(cycle.tempEnceinte)] : []);
    const maximum = temperatures.length ? Math.max(...temperatures) : null;
    if (maximum !== null && maximum > NORME.MAX_TEMP) nouveau = 'jete';
  }
  if (nouveau === 'jete') { const confirme = await ctx.ui.confirm({ title: 'Clore en écart', body: `Le lot « ${cycle.product} » est déclaré non conforme : il sera tracé comme écart (
  jeté / réorienté) et restera consultable dans le registre.`, confirmLabel: 'Clore en écart', danger: true, });
    if (!confirme) return;
  }
  const cycles = ctx.repository.getDefrostCycles() || [];
  const cible = cycles.find((c) => c.id === id);
  if (cible) { cible.endAt = new Date().toISOString(); ctx.repository.saveDefrostCycles(cycles); }
  ctx.useCases.updateDefrostStatus(id, nouveau);
  ctx.ui.toast({ status: nouveau === 'jete' ? 'danger' : 'ok', message: nouveau === 'jete' ? 'Cycle clos en écart.' : 'Cycle terminé et conforme.', });
}

/* ── Actions ──────────────────────────────────────────────────────────────── */

const ACTIONS = { 'new-cycle': (el, root, ctx) => formulaireCycle(ctx), 'add-measure': (el, root, ctx) => formulaireMesure(ctx, el.getAttribute('data-cycle')), 'end-cycle': (el, root, ctx) => {
terminerCycle(ctx, el.getAttribute('data-cycle'), 'consomme'); }, 'scrap-cycle': (el, root, ctx) => { terminerCycle(ctx, el.getAttribute('data-cycle'), 'jete'); }, 'export-csv': (el, root, ctx) => {
if (!ctx.exports || typeof ctx.exports.exportRecordsCsv !== 'function') return;
    const fichier = ctx.exports.exportRecordsCsv(ctx, { type: 'defrost' });
    ctx.exports.downloadFile(fichier.filename, fichier.content, fichier.mime);
    ctx.ui.toast({ status: 'ok', message: 'Export CSV de la décongélation généré.' });
  }, };

function attacher(root, ctx) { if (root.__traqhaccpDefrostEcoute) return; root.__traqhaccpDefrostEcoute = true; root.addEventListener('click', (e) => { const el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el || !root.contains(el)) return;
    const action = ACTIONS[el.getAttribute('data-action')];
    if (action) action(el, root, ctx);
  });
}

function rafraichir(root, ctx) { if (!root.isConnected || root.hidden) return; root.innerHTML = render(ctx); attacher(root, ctx); }

export function mount(root, ctx) { generation += 1; const gen = generation; attacher(root, ctx); abonnement = ctx.store.subscribe(() => { if (gen === generation) rafraichir(root, ctx); });
  if (minuteur) clearInterval(minuteur);
  minuteur = setInterval(() => { if (gen === generation) rafraichir(root, ctx); }, RAFRAICHISSEMENT_MS);
}

export function unmount(root) { generation += 1; if (abonnement) { abonnement(); abonnement = null; } if (minuteur) { clearInterval(minuteur); minuteur = null; } panneau = null;
  if (root) delete root.__traqhaccpDefrostEcoute;
}
