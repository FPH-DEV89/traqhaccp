/**
 * src/presentation/views/cooling.js — Refroidissement rapide (module 09).
 * Contrat de vue v4 (specs/V2-vues-hygiene.md §Refroidissement, specs/_API-CHEATSHEET.md §3) :
 * render(ctx) → chaîne HTML pure ; mount(root, ctx) → délégation des `data-action`, abonnement au
 * store et démarrage du chronomètre ; unmount() → nettoyage obligatoire des setInterval.
 * La règle de sécurité est lue dans HACCP_NORMS.COOLING (63 °C → 10 °C en moins de 120 min) : aucune
 * valeur n'est recopiée. Les points de mesure et les clôtures sont horodatés dans le journal
 * d'activité, seule source date/heure de l'application (l'entité CoolingCycle n'a que des « HH:MM »).
 */
import { HACCP_NORMS } from '../../domain/constants.js';

const FROID = HACCP_NORMS.COOLING;
const LIMITE_MS = FROID.MAX_DURATION_MINUTES * 60000;
const JOURNAL_MAX = 500, POINTS_TABLE = 6, JOURS_KPI = 7, MS_JOUR = 86400000;
const DEPART = 'cooling.start', MESURE = 'cooling.point', CLOTURE = 'cooling.close', SEP = ' · ';
let generation = 0, abonnement = null, minuteur = null, racine = null;

/* ── Helpers : accès au journal, formats et lecture des champs de panneau ────── */
const echapper = (v) => String(v === null || v === undefined ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const deux = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const lireChamp = (panneau, sel) => { const el = panneau ? panneau.querySelector(sel) : null; return el ? String(el.value || '').trim() : ''; };
const lireTemp = (panneau, sel) => Number.parseFloat(lireChamp(panneau, sel).replace(',', '.'));
/** Phrase de référence : toujours construite à partir des constantes de HACCP_NORMS.COOLING. */
const exigence = (ctx) => `${ctx.fmt.temp(FROID.START_MIN_TEMP)} → ${ctx.fmt.temp(FROID.END_MAX_TEMP)} en moins de ${ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES / 60, 'h')}`;
function heureActuelle() { const d = new Date(); return `${deux(d.getHours())}:${deux(d.getMinutes())}`; }
function dureeTexte(ms) { const t = Math.max(0, Math.floor(ms / 1000)); return `${deux(t / 3600)}:${deux((t % 3600) / 60)}:${deux(t % 60)}`; }
function horodatageHeure(hhmm) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); if (!m) return 0; const d = new Date(); d.setHours(Number(m[1]), Number(m[2]), 0, 0); return d.getTime(); }
function operateurCourant(ctx) {
  const o = (ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null;
  const nom = o ? (o.name || `${o.firstName || ''} ${o.lastName || ''}`.trim()) : '';
  return nom || 'Opérateur non identifié';
}
function journal(ctx) {
  const brut = ctx.account && typeof ctx.account.getActivityLog === 'function' ? ctx.account.getActivityLog(JOURNAL_MAX) : [];
  return (Array.isArray(brut) ? brut : []).map((e) => ({ action: String(e.action || ''), target: String(e.target || ''), at: e.at, ms: Date.parse(e.at) || 0, operateur: e.operatorName || '—', details: String(e.details || '') }));
}
function tracer(ctx, action, target, details) { if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action, target, details }); }
/** Cycles enrichis : traçabilité journal, état « en cours », conformité réglementaire. */
function etats(ctx) {
  const cycles = ctx.repository.getCoolingCycles() || [], fiches = new Map();
  for (const e of journal(ctx)) {
    if (!e.target) continue;
    if (!fiches.has(e.target)) fiches.set(e.target, { depart: null, points: [], cloture: null });
    const fiche = fiches.get(e.target), temp = e.action === MESURE ? Number.parseFloat(e.details) : NaN;
    if (e.action === DEPART) fiche.depart = e; else if (e.action === CLOTURE) fiche.cloture = e; else if (Number.isFinite(temp)) fiche.points.push({ ms: e.ms, at: e.at, temp });
  }
  const maintenant = Date.now();
  return cycles.map((cycle) => {
    const fiche = fiches.get(String(cycle.id)) || { depart: null, points: [], cloture: null };
    const points = fiche.points.slice().sort((a, b) => a.ms - b.ms);
    const departMs = fiche.depart ? fiche.depart.ms : (horodatageHeure(cycle.startTime) || maintenant);
    const finMs = fiche.cloture ? fiche.cloture.ms : departMs + Number(cycle.durationMinutes || 0) * 60000;
    const enCours = !fiche.cloture && (Boolean(fiche.depart) || Number(cycle.endTemp) > FROID.END_MAX_TEMP);
    const conforme = Number(cycle.durationMinutes) <= FROID.MAX_DURATION_MINUTES && Number(cycle.endTemp) <= FROID.END_MAX_TEMP;
    return { cycle, fiche, points, departMs, finMs, enCours, conforme, ecouleMs: Math.max(0, (enCours ? maintenant : finMs) - departMs), metadonnees: fiche.depart ? fiche.depart.details : '' };
  });
}
/** Indicateurs 7 jours : seuls les cycles horodatés au journal sont datables. */
function indicateurs(liste) {
  const limite = Date.now() - JOURS_KPI * MS_JOUR, dates = liste.filter((e) => e.fiche.depart && e.fiche.depart.ms >= limite);
  const durees = dates.map((e) => Number(e.cycle.durationMinutes)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return { total: dates.length, conformes: dates.filter((e) => e.conforme).length, sansDate: liste.length - dates.length, enCours: liste.filter((e) => e.enCours).length, mediane: durees.length ? durees[Math.floor(durees.length / 2)] : null };
}

/* ── Fragments de rendu ─────────────────────────────────────────────────────── */
/** Pastille d'état : classes littérales uniquement (aucune classe composée par interpolation). */
function pastille(marque) {
  if (marque === 'danger') return '<span class="mark mark--danger"></span>';
  if (marque === 'warn') return '<span class="mark mark--warn"></span>';
  if (marque === 'neutral') return '<span class="mark mark--neutral"></span>';
  return '<span class="mark mark--ok"></span>';
}
function kpi(etiquette, valeur, unite, delta, marque) {
  return `<div class="sheet"><div class="kpi"><p class="kpi__label">${echapper(etiquette)}</p><p class="kpi__value num">${valeur}${unite ? `<span class="kpi__unit">${echapper(unite)}</span>` : ''}</p><p class="kpi__delta">${marque ? pastille(marque) : ''}${echapper(delta)}</p></div></div>`;
}
/** Courbe de descente SVG tracée à la main : axes, cible 63 → 10 °C, seuil 2 h, points mesurés. */
function courbe(etat, ctx) {
  const c = etat.cycle, serie = [{ ms: etat.departMs, temp: Number(c.startTemp) }];
  for (const p of etat.points) serie.push({ ms: p.ms, temp: p.temp });
  serie.push({ ms: etat.finMs, temp: Number(c.endTemp) });
  const utiles = serie.filter((p) => Number.isFinite(p.temp) && Number.isFinite(p.ms)).sort((a, b) => a.ms - b.ms).filter((p, i, tab) => i === 0 || p.ms !== tab[i - 1].ms);
  const L = 360, H = 170, m = { h: 14, b: 24, g: 44, d: 14 }, temps = utiles.map((p) => p.temp);
  const haut = Math.max(FROID.START_MIN_TEMP, ...temps), bas = Math.min(FROID.END_MAX_TEMP, ...temps);
  const minutes = Math.max(1, (utiles[utiles.length - 1].ms - etat.departMs) / 60000);
  const xMax = Math.max(FROID.MAX_DURATION_MINUTES, minutes);
  const px = (min) => m.g + (Math.max(0, Math.min(min, xMax)) / xMax) * (L - m.g - m.d);
  const py = (t) => H - m.b - ((Math.max(bas, Math.min(t, haut)) - bas) / Math.max(1, haut - bas)) * (H - m.h - m.b);
  const trace = utiles.map((p) => `${px((p.ms - etat.departMs) / 60000).toFixed(1)},${py(p.temp).toFixed(1)}`).join(' ');
  const pastilles = etat.points.map((p) => `<circle cx="${px((p.ms - etat.departMs) / 60000).toFixed(1)}" cy="${py(p.temp).toFixed(1)}" r="3" fill="currentColor"></circle>`).join('');
  const seuilTemp = (t) => `<line x1="${m.g}" y1="${py(t).toFixed(1)}" x2="${L - m.d}" y2="${py(t).toFixed(1)}" stroke="currentColor" stroke-width="1" stroke-dasharray="5 4" opacity="0.45"></line><text x="${m.g - 6}" y="${(py(t) + 3).toFixed(1)}" fill="currentColor" font-size="9" text-anchor="end" opacity="0.8">${echapper(ctx.fmt.temp(t))}</text>`;
  const xSeuil = px(FROID.MAX_DURATION_MINUTES).toFixed(1), libelle = echapper(ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES / 60, 'h'));
  const barre = `<rect x="${xSeuil}" y="${m.h}" width="${(L - m.d - px(FROID.MAX_DURATION_MINUTES)).toFixed(1)}" height="${H - m.h - m.b}" fill="currentColor" opacity="0.06"></rect><line x1="${xSeuil}" y1="${m.h}" x2="${xSeuil}" y2="${H - m.b}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.8"></line><text x="${(px(FROID.MAX_DURATION_MINUTES) + 4).toFixed(1)}" y="${m.h + 10}" fill="currentColor" font-size="9" opacity="0.8">${libelle}</text>`;
  const axes = `<line x1="${m.g}" y1="${m.h}" x2="${m.g}" y2="${H - m.b}" stroke="currentColor" stroke-width="1" opacity="0.3"></line><line x1="${m.g}" y1="${H - m.b}" x2="${L - m.d}" y2="${H - m.b}" stroke="currentColor" stroke-width="1" opacity="0.3"></line>`;
  return `<span class="kpi__spark"><svg width="${L}" height="${H}" viewBox="0 0 ${L} ${H}" role="img" aria-label="Courbe de descente de ${echapper(c.dish)} : ${echapper(ctx.fmt.temp(c.startTemp))} → ${echapper(ctx.fmt.temp(c.endTemp))} en ${echapper(ctx.fmt.quantity(c.durationMinutes, 'min'))}">${barre}${axes}${seuilTemp(FROID.START_MIN_TEMP)}${seuilTemp(FROID.END_MAX_TEMP)}
    <polyline points="${trace}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></polyline>${pastilles}<text x="${m.g}" y="${H - 8}" fill="currentColor" font-size="9" opacity="0.7">0 min</text><text x="${xSeuil}" y="${H - 8}" fill="currentColor" font-size="9" text-anchor="middle" opacity="0.7">${echapper(String(FROID.MAX_DURATION_MINUTES))} min</text></svg></span>`;
}
function tableauPoints(points, ctx) {
  if (!points.length) return `<p class="unit">Aucun point de mesure consigné.</p>`;
  const lignes = points.slice(-POINTS_TABLE).reverse().map((p, i, tab) => {
    const avant = tab[i + 1] || null, vitesse = avant && p.ms > avant.ms ? (avant.temp - p.temp) / ((p.ms - avant.ms) / 60000) : null;
    return `<tr><td class="num">${echapper(ctx.fmt.dt(p.at))}</td><td class="num">${echapper(ctx.fmt.temp(p.temp))}</td><td class="num">${vitesse === null ? '—' : echapper(ctx.fmt.quantity(vitesse, '°C/min'))}</td></tr>`;
  }).join('');
  return `<table class="table table--compact"><thead><tr><th>Relevé</th><th>Température</th><th>Vitesse</th></tr></thead><tbody>${lignes}</tbody></table>`;
}
const resteTexte = (delta) => (delta >= 0 ? `Reste ${Math.round(delta / 60000)} min` : `Dépassement de ${Math.round(-delta / 60000)} min`);
/** Température courante : classes littérales (zone chaude, intermédiaire, cible atteinte). */
function temperature(valeur, ctx) {
  if (valeur <= FROID.END_MAX_TEMP) return `<span class="temp temp--ok">${echapper(ctx.fmt.temp(valeur))}</span>`;
  if (valeur >= FROID.START_MIN_TEMP) return `<span class="temp temp--hot">${echapper(ctx.fmt.temp(valeur))}</span>`;
  return `<span class="temp temp--warm">${echapper(ctx.fmt.temp(valeur))}</span>`;
}
function chrono(etat, ctx) {
  const pourcent = Math.max(0, Math.min(100, (etat.ecouleMs / LIMITE_MS) * 100)), reste = LIMITE_MS - etat.ecouleMs;
  const contenu = `<span class="chrono__label">Temps écoulé (départ ${echapper(ctx.fmt.temp(etat.cycle.startTemp))} à ${echapper(etat.cycle.startTime)})</span><span class="chrono__value">${dureeTexte(etat.ecouleMs)}</span><div class="chrono__bar"><div class="chrono__progress" data-fill="${pourcent.toFixed(1)}"></div></div><span class="chrono__label" data-chrono-reste>${echapper(resteTexte(reste))}</span>`;
  const attributs = `data-chrono data-start="${etat.departMs}"`;
  return reste < 0 ? `<div class="chrono chrono--late" ${attributs}>${contenu}</div>` : `<div class="chrono" ${attributs}>${contenu}</div>`;
}
function carteEnCours(etat, ctx) {
  const c = etat.cycle, id = echapper(c.id), derniere = etat.points.length ? etat.points[etat.points.length - 1] : null;
  const mesure = derniere ? `Dernière mesure · ${echapper(ctx.fmt.dt(derniere.at))}` : 'Aucune mesure depuis le départ';
  return `<section class="section"><div class="sheet"><div class="sheet__head"><span class="strong">${echapper(c.dish)}</span><span class="unit">${echapper(etat.metadonnees || `Cycle ouvert par ${c.operator || '—'}`)}</span>
      <button class="btn btn--sm section__action" type="button" data-action="relever" data-cycle="${id}">${ctx.icon('thermometer', 16)} Relever la température</button>
      <button class="btn btn--ghost btn--sm" type="button" data-action="cloturer" data-cycle="${id}">${ctx.icon('check', 16)} Clôturer le cycle</button></div>
    <div class="sheet__body"><div class="grid grid--2">
      <div class="stack">${chrono(etat, ctx)}${temperature(derniere ? derniere.temp : Number(c.startTemp), ctx)}<p class="unit">${mesure}</p></div>
      <div class="stack"><p class="unit">Cible : ${echapper(exigence(ctx))}</p>${tableauPoints(etat.points, ctx)}</div></div></div></div></section>`;
}
const corrective = (c) => (Number(c.durationMinutes) > FROID.MAX_DURATION_MINUTES ? 'Fractionner les volumes, bacs peu profonds, vérifier la cellule froide.' : 'Prolonger la descente jusqu’à la cible avant mise en froid négatif.');
function tableauTermines(liste, ctx) {
  const lignes = liste.slice(0, 8).map((etat) => {
    const c = etat.cycle, ecart = !etat.conforme;
    return `<tr><td>${echapper(c.dish)}</td><td class="num">${echapper(ctx.fmt.temp(c.startTemp))} → ${echapper(ctx.fmt.temp(c.endTemp))}</td><td class="num">${echapper(ctx.fmt.quantity(c.durationMinutes, 'min'))}</td>
      <td>${pastille(ecart ? 'danger' : 'ok')}<span class="mark__label">${ecart ? 'Écart' : 'Conforme'}</span></td><td>${echapper(ecart ? corrective(c) : 'Descente conforme, aucun écart à traiter.')}</td>
      <td class="num"><button class="btn btn--ghost btn--sm" type="button" data-action="courbe" data-cycle="${echapper(c.id)}">${ctx.icon('eye', 16)} Courbe</button></td></tr>`;
  }).join('');
  return `<table class="table table--scroll"><thead><tr><th>Produit</th><th>Départ → arrivée</th><th>Durée</th><th>Statut</th><th>Action corrective</th><th>Détail</th></tr></thead><tbody>${lignes}</tbody></table>`;
}

/* ── Contrat de vue ─────────────────────────────────────────────────────────── */
export const meta = { id: 'cooling', idx: '09', icon: 'snowflake', title: 'Refroidissement', desc: 'Cycle 63 °C → 10 °C en 2 h', permissions: null };

export function render(ctx) {
  const liste = etats(ctx), enCours = liste.filter((e) => e.enCours), termines = liste.filter((e) => !e.enCours), ind = indicateurs(liste);
  const entete = `<header class="page-head"><span class="page-head__idx">09</span><h1 class="page-head__title">Refroidissement</h1>
    <p class="page-head__desc">Règle des 2 h — ${echapper(exigence(ctx))} (refroidissement rapide des préparations chaudes).</p></header>`;
  const kpis = `<div class="grid grid--3">
    ${kpi('Cycles conformes (7 j)', ind.total ? `${ind.conformes} / ${ind.total}` : '—', 'cycles', ind.total ? `${ind.total - ind.conformes} écart(s) sur la période` : 'aucun cycle horodaté au journal sur 7 jours', ind.total && ind.total === ind.conformes ? 'ok' : ind.total ? 'danger' : 'neutral')}
    ${kpi('Durée médiane (7 j)', ind.mediane === null ? '—' : echapper(ctx.fmt.quantity(ind.mediane, 'min')), '', `limite réglementaire ${echapper(ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES, 'min'))}`, ind.mediane === null ? 'neutral' : ind.mediane <= FROID.MAX_DURATION_MINUTES ? 'ok' : 'danger')}
    ${kpi('Cycles en cours', String(ind.enCours), 'cycle(s)', ind.sansDate ? `${ind.sansDate} cycle(s) de démonstration non horodaté(s)` : 'chronomètre actif', ind.enCours ? 'warn' : 'ok')}</div>`;
  const blocEnCours = enCours.length ? enCours.map((e) => carteEnCours(e, ctx)).join('') : ctx.ui.empty({
    icon: 'snowflake', title: 'Aucun cycle en cours', body: `Démarrez un cycle dès la fin de cuisson : la descente doit être lancée pendant que le produit est encore à ${ctx.fmt.temp(FROID.START_MIN_TEMP)} ou plus.` });
  return `${entete}
    <div class="toolbar"><button class="btn btn--primary" type="button" data-action="demarrer">${ctx.icon('plus', 16)} Démarrer un cycle</button></div>
    <section class="section"><div class="section__head"><h2 class="section__title">Règle de sécurité</h2><span class="unit">${liste.length} cycle(s) suivi(s)</span></div>
      <div class="callout callout--info">${ctx.icon('seal', 16)}<span>Refroidissement rapide obligatoire : passer de ${echapper(ctx.fmt.temp(FROID.START_MIN_TEMP))} à ${echapper(ctx.fmt.temp(FROID.END_MAX_TEMP))} en moins de ${echapper(ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES, 'min'))} (${echapper(ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES / 60, 'h'))}). Au-delà, le produit est déclaré en écart et une non-conformité est ouverte.</span></div>
      ${kpis}</section>
    <section class="section"><div class="section__head"><h2 class="section__title">Cycles en cours</h2><span class="unit">chronomètre rafraîchi chaque seconde</span></div>${blocEnCours}</section>
    <section class="section"><div class="section__head"><h2 class="section__title">Historique des cycles clôturés</h2><span class="unit">${termines.length} cycle(s)</span></div>
      ${termines.length ? tableauTermines(termines, ctx) : ctx.ui.empty({ icon: 'clock', title: 'Aucun cycle clôturé', body: 'Les cycles clôturés apparaîtront ici avec leur conformité et leur action corrective.' })}</section>`;
}

/* ── Panneaux : saisie par ctx.ui.panel, aperçus recalculés à chaque frappe ──── */
function ouvrirDemarrage(ctx, root) {
  const etat = { panneau: null };
  const corps = `<div class="stack">
    <div class="field"><label class="field__label" for="cool-dish">Produit / préparation</label><input class="input" id="cool-dish" type="text" maxlength="120" placeholder="Ex. : bœuf bourguignon (bac gastro 1/1)"></div>
    <div class="field"><label class="field__label" for="cool-qte">Quantité</label><input class="input" id="cool-qte" type="text" maxlength="60" placeholder="Ex. : 4,2 kg ou 2 bacs"></div>
    <div class="field"><label class="field__label" for="cool-contenant">Contenant</label><select class="select" id="cool-contenant"><option>Bac gastro inox peu profond</option><option>Barquette inox</option><option>Bac gastro plastique alimentaire</option><option>Cellule de refroidissement rapide</option></select><p class="field__hint">Faible épaisseur (moins de 5 cm), sans couvercle, produit divisé.</p></div>
    <div class="field"><label class="field__label" for="cool-temp">Température de départ</label><div class="input-group"><input class="input num" id="cool-temp" type="number" inputmode="decimal" step="0.1" min="-20" max="150" value="${echapper(FROID.START_MIN_TEMP)}"><span class="input-group__suffix">°C</span></div><p class="field__hint" id="cool-avertissement" aria-live="polite"></p></div>
    <div class="field"><label class="field__label" for="cool-cellule">Enceinte de destination</label><input class="input" id="cool-cellule" type="text" maxlength="80" value="Cellule de refroidissement rapide"></div></div>`;
  // Avertissement recalculé à chaque frappe si le départ est inférieur à la zone chaude.
  const brancher = (panneau) => {
    const champ = panneau.querySelector('#cool-temp'), alerte = panneau.querySelector('#cool-avertissement');
    if (!champ || !alerte) return;
    champ.addEventListener('input', () => {
      const v = Number.parseFloat(String(champ.value).replace(',', '.'));
      alerte.textContent = !Number.isFinite(v) ? 'Température invalide.'
        : v >= FROID.START_MIN_TEMP ? `Produit en zone chaude : ${exigence(ctx)} s’applique.`
          : `Avertissement : départ sous ${ctx.fmt.temp(FROID.START_MIN_TEMP)} — le produit n’est plus en zone chaude, la descente n’est plus conforme au protocole.`;
    });
    champ.dispatchEvent(new Event('input'));
  };
  ctx.ui.panel({ id: 'cool-demarrage', title: 'Démarrer un cycle de refroidissement', subtitle: `Cible ${exigence(ctx)}`, body: corps, onMount: (panneau) => { etat.panneau = panneau; brancher(panneau); }, actions: [{ label: 'Démarrer le cycle', kind: 'primary', onClick: () => demarrer(ctx, root, etat.panneau) }, { label: 'Annuler', kind: 'ghost' }] });
}
async function demarrer(ctx, root, panneau) {
  if (!panneau) return false;
  const produit = lireChamp(panneau, '#cool-dish'), quantite = lireChamp(panneau, '#cool-qte');
  const contenant = lireChamp(panneau, '#cool-contenant'), cellule = lireChamp(panneau, '#cool-cellule'), depart = lireTemp(panneau, '#cool-temp');
  if (!produit) { ctx.ui.toast({ status: 'danger', message: 'Indiquez le produit refroidi.' }); return false; }
  if (!Number.isFinite(depart)) { ctx.ui.toast({ status: 'danger', message: 'Température de départ invalide.' }); return false; }
  if (depart < FROID.START_MIN_TEMP) {
    const passe = await ctx.ui.confirm({
      title: 'Départ sous la zone chaude', danger: true, confirmLabel: 'Démarrer malgré tout',
      body: `Le produit est à ${ctx.fmt.temp(depart)}, sous le seuil de ${ctx.fmt.temp(FROID.START_MIN_TEMP)} : le protocole de refroidissement rapide ne s’applique pas. Démarrer malgré tout ?`,
    });
    if (!passe) return false;
  }
  const cycle = ctx.useCases.startCoolingCycle({ dish: produit, startTemp: depart, endTemp: depart, startTime: heureActuelle(), durationMinutes: FROID.MAX_DURATION_MINUTES }, operateurCourant(ctx));
  tracer(ctx, DEPART, cycle && cycle.id ? cycle.id : produit, `${produit}${SEP}${quantite || 'quantité non précisée'}${SEP}${contenant}${SEP}${cellule}${SEP}départ ${depart} °C`);
  ctx.ui.toast({ status: 'ok', message: `Cycle démarré pour ${produit} à ${ctx.fmt.temp(depart)} — chronomètre lancé.` });
  rerendre(root, ctx);
  return undefined;
}
function ouvrirPoint(ctx, root, cycleId) {
  const cible = etats(ctx).find((e) => String(e.cycle.id) === String(cycleId));
  if (!cible) { ctx.ui.toast({ status: 'danger', message: 'Cycle introuvable.' }); return; }
  const etat = { panneau: null };
  const corps = `<div class="stack">
    <p class="unit">Cycle « ${echapper(cible.cycle.dish)} » — départ ${echapper(ctx.fmt.temp(cible.cycle.startTemp))} à ${echapper(cible.cycle.startTime)}, cible ${echapper(exigence(ctx))}.</p>
    <div class="field"><label class="field__label" for="cool-point">Température relevée à cœur</label><div class="input-group"><input class="input num" id="cool-point" type="number" inputmode="decimal" step="0.1" min="-20" max="150" value="${echapper(cible.cycle.endTemp)}"><span class="input-group__suffix">°C</span></div><p class="field__hint" id="cool-point-aide" aria-live="polite"></p></div>
    <p class="unit">Relevé horodaté automatiquement (${echapper(heureActuelle())}) ; la vitesse de descente est calculée depuis le relevé précédent.</p>
    ${tableauPoints(cible.points, ctx)}</div>`;
  const brancher = (panneau) => {
    const champ = panneau.querySelector('#cool-point'), aide = panneau.querySelector('#cool-point-aide');
    if (!champ || !aide) return;
    champ.addEventListener('input', () => {
      const t = Number.parseFloat(String(champ.value).replace(',', '.'));
      aide.textContent = !Number.isFinite(t) ? 'Température invalide.'
        : t <= FROID.END_MAX_TEMP ? `Cible atteinte (≤ ${ctx.fmt.temp(FROID.END_MAX_TEMP)}) : le cycle peut être clôturé.`
          : `Encore ${ctx.fmt.temp(t - FROID.END_MAX_TEMP)} à descendre avant la cible.`;
    });
    champ.dispatchEvent(new Event('input'));
  };
  ctx.ui.panel({ id: 'cool-point', title: 'Relever la température', subtitle: 'Point de mesure', body: corps, onMount: (panneau) => { etat.panneau = panneau; brancher(panneau); }, actions: [{ label: 'Consigner le relevé', kind: 'primary', onClick: () => consignerPoint(ctx, root, etat.panneau, cible) }, { label: 'Annuler', kind: 'ghost' }] });
}
function consignerPoint(ctx, root, panneau, etat) {
  if (!panneau) return false;
  const temp = lireTemp(panneau, '#cool-point');
  if (!Number.isFinite(temp)) { ctx.ui.toast({ status: 'danger', message: 'Saisissez une température valide.' }); return false; }
  const avant = etat.points.length ? etat.points[etat.points.length - 1] : { ms: etat.departMs, temp: Number(etat.cycle.startTemp) };
  const minutes = Math.max(0, (Date.now() - avant.ms) / 60000), vitesse = minutes > 0 ? (avant.temp - temp) / minutes : null;
  majCycle(ctx, etat.cycle.id, { endTemp: temp });
  tracer(ctx, MESURE, etat.cycle.id, `${temp} °C`);
  let statut = 'ok';
  let message = `Point consigné : ${ctx.fmt.temp(temp)}${vitesse !== null ? ` — ${ctx.fmt.quantity(vitesse, '°C/min')}` : ''}.`;
  if (vitesse !== null && vitesse <= 0) { statut = 'danger'; message += ' La température ne descend pas : vérifier la cellule froide et diviser le volume.'; }
  else if (temp <= FROID.END_MAX_TEMP) message += ` Cible atteinte (≤ ${ctx.fmt.temp(FROID.END_MAX_TEMP)}) : vous pouvez clôturer le cycle.`;
  else if (vitesse !== null) { const necessaire = (temp - FROID.END_MAX_TEMP) / vitesse, restant = Math.max(0, FROID.MAX_DURATION_MINUTES - (Date.now() - etat.departMs) / 60000); if (necessaire > restant) { statut = 'warn'; message += ` À ce rythme la cible sera atteinte hors délai (${ctx.fmt.quantity(necessaire, 'min')} nécessaires, ${ctx.fmt.quantity(restant, 'min')} restantes).`; } }
  ctx.ui.toast({ status: statut, message });
  rerendre(root, ctx);
  return undefined;
}
function ouvrirCloture(ctx, root, cycleId) {
  const cible = etats(ctx).find((e) => String(e.cycle.id) === String(cycleId));
  if (!cible) { ctx.ui.toast({ status: 'danger', message: 'Cycle introuvable.' }); return; }
  const etat = { panneau: null }, minutes = Math.max(1, Math.round(cible.ecouleMs / 60000));
  const corps = `<div class="stack">
    <p class="unit">« ${echapper(cible.cycle.dish)} » — départ ${echapper(ctx.fmt.temp(cible.cycle.startTemp))} à ${echapper(cible.cycle.startTime)}, durée écoulée ${echapper(ctx.fmt.quantity(minutes, 'min'))} (limite ${echapper(ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES, 'min'))}).</p>
    <div class="field"><label class="field__label" for="cool-fin">Température finale à cœur</label><div class="input-group"><input class="input num" id="cool-fin" type="number" inputmode="decimal" step="0.1" min="-20" max="150" value="${echapper(cible.cycle.endTemp)}"><span class="input-group__suffix">°C</span></div><p class="field__hint">La clôture horodate la fin du cycle. Toute descente hors cible (au-delà de ${echapper(ctx.fmt.quantity(FROID.MAX_DURATION_MINUTES, 'min'))} ou arrivée au-dessus de ${echapper(ctx.fmt.temp(FROID.END_MAX_TEMP))}) ouvre une non-conformité.</p></div>
    ${tableauPoints(cible.points, ctx)}</div>`;
  ctx.ui.panel({ id: 'cool-cloture', title: 'Clôturer le cycle', subtitle: `Cible ${exigence(ctx)}`, body: corps, onMount: (panneau) => { etat.panneau = panneau; }, actions: [{ label: 'Clôturer le cycle', kind: 'primary', onClick: () => cloturer(ctx, root, etat.panneau, cible) }, { label: 'Annuler', kind: 'ghost' }] });
}
function cloturer(ctx, root, panneau, etat) {
  if (!panneau) return false;
  const temp = lireTemp(panneau, '#cool-fin');
  if (!Number.isFinite(temp)) { ctx.ui.toast({ status: 'danger', message: 'Saisissez la température finale.' }); return false; }
  const minutes = Math.max(1, Math.round(etat.ecouleMs / 60000));
  const conforme = minutes <= FROID.MAX_DURATION_MINUTES && temp <= FROID.END_MAX_TEMP;
  majCycle(ctx, etat.cycle.id, { endTemp: temp, durationMinutes: minutes, endTime: heureActuelle() });
  tracer(ctx, CLOTURE, etat.cycle.id, `${temp} °C en ${minutes} min`);
  if (!conforme) {
    ctx.useCases.declareNonConformity({
      category5M: 'Procédé', severity: minutes > FROID.MAX_DURATION_MINUTES ? 'Majeure' : 'Modérée',
      equipOrSubject: `Refroidissement ${etat.cycle.dish}`,
      cause: `Descente hors cible : ${ctx.fmt.temp(etat.cycle.startTemp)} → ${ctx.fmt.temp(temp)} en ${ctx.fmt.quantity(minutes, 'min')} (exigence ${exigence(ctx)}).`,
      action: corrective({ durationMinutes: minutes }), status: 'Ouverte',
    }, operateurCourant(ctx));
  }
  ctx.ui.toast({ status: conforme ? 'ok' : 'danger', message: conforme ? `Cycle clôturé : ${ctx.fmt.temp(temp)} en ${ctx.fmt.quantity(minutes, 'min')} — conforme.` : `Écart enregistré (${ctx.fmt.temp(temp)} en ${ctx.fmt.quantity(minutes, 'min')}) — non-conformité ouverte.` });
  rerendre(root, ctx);
  return undefined;
}
/** Mise à jour d'un cycle existant : le dépôt est la seule voie (aucun cas d'usage de mise à jour). */
function majCycle(ctx, cycleId, patch) {
  const cycles = ctx.repository.getCoolingCycles() || [], cible = cycles.find((c) => String(c.id) === String(cycleId));
  if (!cible) return null;
  Object.assign(cible, patch);
  ctx.repository.saveCoolingCycles(cycles);
  return cible;
}
function ouvrirCourbe(ctx, cycleId) {
  const cible = etats(ctx).find((e) => String(e.cycle.id) === String(cycleId));
  if (!cible) { ctx.ui.toast({ status: 'danger', message: 'Cycle introuvable.' }); return; }
  const c = cible.cycle;
  const detail = `<div class="stack"><div class="grid grid--3">
      ${kpi('Départ', echapper(ctx.fmt.temp(c.startTemp)), '', echapper(c.startTime), 'neutral')}
      ${kpi('Arrivée', echapper(ctx.fmt.temp(c.endTemp)), '', echapper(ctx.fmt.quantity(c.durationMinutes, 'min')), cible.conforme ? 'ok' : 'danger')}
      ${kpi('Points mesurés', String(cible.points.length), '', cible.points.length ? 'traçabilité journal' : 'départ et arrivée seulement', cible.points.length ? 'ok' : 'warn')}</div>
    ${courbe(cible, ctx)}${tableauPoints(cible.points, ctx)}
    <p class="unit">Cycle opéré par ${echapper(c.operator || '—')} · exigence ${echapper(exigence(ctx))} · statut ${cible.conforme ? 'conforme' : 'écart'}.</p></div>`;
  ctx.ui.panel({ id: 'cool-courbe', title: `Courbe de descente — ${c.dish}`, subtitle: 'Refroidissement rapide', body: detail, actions: [{ label: 'Fermer', kind: 'ghost' }] });
}

/* ── Délégation, peinture de la géométrie, chronomètre et cycle de vie ──────── */
const ACTIONS = {
  'demarrer': (el, root, ctx) => ouvrirDemarrage(ctx, root || racine),
  'relever': (el, root, ctx) => ouvrirPoint(ctx, root || racine, el.dataset.cycle),
  'cloturer': (el, root, ctx) => ouvrirCloture(ctx, root || racine, el.dataset.cycle),
  'courbe': (el, root, ctx) => ouvrirCourbe(ctx, el.dataset.cycle),
};
function peindre(root) {
  for (const el of root.querySelectorAll('[data-fill]')) el.style.width = `${Math.max(0, Math.min(100, Number(el.getAttribute('data-fill')) || 0))}%`;
}
function rerendre(root, ctx) { root.innerHTML = render(ctx); peindre(root); }
function attacher(root, ctx) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const fn = ACTIONS[el.getAttribute('data-action')];
    if (fn) fn(el, root, ctx);
  });
}
/** Chronomètre : rafraîchit la valeur, la barre de progression et la mention de retard. */
function tic() {
  if (!racine || !racine.isConnected) return;
  for (const el of racine.querySelectorAll('[data-chrono]')) {
    const debut = Number(el.getAttribute('data-start'));
    if (!Number.isFinite(debut)) continue;
    const ecoule = Math.max(0, Date.now() - debut), pourcent = Math.max(0, Math.min(100, (ecoule / LIMITE_MS) * 100));
    const valeur = el.querySelector('.chrono__value'), barre = el.querySelector('.chrono__progress'), reste = el.querySelector('[data-chrono-reste]');
    if (valeur) valeur.textContent = dureeTexte(ecoule);
    if (barre) { barre.setAttribute('data-fill', pourcent.toFixed(1)); barre.style.width = `${pourcent.toFixed(1)}%`; }
    if (reste) reste.textContent = resteTexte(LIMITE_MS - ecoule);
    el.classList.toggle('chrono--late', ecoule > LIMITE_MS);
  }
}
export function mount(root, ctx) {
  const maGeneration = ++generation;
  racine = root;
  attacher(root, ctx);
  peindre(root);
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  minuteur = setInterval(tic, 1000);
  abonnement = ctx.store.subscribe(() => {
    if (maGeneration !== generation || !root.isConnected || root.hidden) return;
    rerendre(root, { ...ctx, ...ctx.store.getState() });
  });
}
export function unmount() {
  generation += 1;
  if (abonnement) { abonnement(); abonnement = null; }
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  racine = null;
}
