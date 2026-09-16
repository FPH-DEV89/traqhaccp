/**
 * src/presentation/views/oil.js — Huiles de friture (module 08).
 * Contrat de vue v4 (specs/V2-vues-hygiene.md §Huiles, specs/_API-CHEATSHEET.md §3) :
 * render(ctx) → chaîne HTML pure ; mount(root, ctx) → délégation des `data-action` sur `root` et
 * abonnement au store ; unmount() → invalidation des rafraîchissements.
 * TOUS les seuils proviennent de HACCP_NORMS.OILS (composés polaires, Décret 2008-184) : aucune
 * valeur réglementaire n'est recopiée. L'historique horodaté des relevés est lu et écrit dans le
 * journal d'activité (ctx.account) : l'entité `Fryer` ne garde que la dernière mesure.
 * Note : les « heures d'utilisation » ne sont pas affichées — le domaine n'expose aucun compteur
 * horaire ; on publie les compteurs réels (bains relevés / filtrations) plutôt qu'un chiffre inventé.
 * Les styles de géométrie (jauge, curseur) sont posés par `peindre()` en JavaScript, pas en markup.
 */
import { HACCP_NORMS } from '../../domain/constants.js';

const OILS = HACCP_NORMS.OILS;
const ECHELLE = Math.ceil(OILS.CRITICAL_TPM * 1.25); // jauge 0 → 30 % (marge de 25 % sur le seuil critique)
const POINTS_SPARKLINE = 10, LIGNES_TABLE = 6, JOURNAL_MAX = 500;
const ENTREE_JOURNAL = 'oil.test', MARQUEUR_OBSERVATION = ' — obs. : ';
const TYPES_ACTION = [
  'Contrôle TPM standard', 'Filtration réalisée', 'Filtration + complément d’huile',
  'Mise au repos (remplacement à prévoir)', 'Vidange complète (huile neuve)',
];
let generation = 0, abonnement = null;

/* ── Helpers ────────────────────────────────────────────────────────────────── */

const echapper = (v) => String(v === null || v === undefined ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Position d'une valeur TPM sur l'échelle de la jauge, bornée à [0 ; 100]. */
const surEchelle = (valeur) => Math.max(0, Math.min(100, (Number(valeur) / ECHELLE) * 100));
function operateurCourant(ctx) {
  const o = (ctx.store.getCurrentOperator && ctx.store.getCurrentOperator()) || null;
  const nom = o ? (o.name || `${o.firstName || ''} ${o.lastName || ''}`.trim()) : '';
  return nom || 'Opérateur non identifié';
}
const friteuses = (ctx) => ctx.repository.getFryers() || [];
const trouverFriteuse = (ctx, id) => friteuses(ctx).find((f) => String(f.id) === String(id)) || null;
function tracer(ctx, fryerId, details) {
  if (ctx.account && typeof ctx.account.logActivity === 'function') ctx.account.logActivity({ action: ENTREE_JOURNAL, target: fryerId, details });
}

/** Relevés TPM d'une friteuse, du plus récent au plus ancien (journal d'activité). */
function releves(ctx, fryerId) {
  const brut = ctx.account && typeof ctx.account.getActivityLog === 'function' ? ctx.account.getActivityLog(JOURNAL_MAX) : [];
  return (Array.isArray(brut) ? brut : [])
    .filter((e) => e && String(e.action) === ENTREE_JOURNAL && String(e.target) === String(fryerId))
    .map((e) => {
      const texte = String(e.details || '');
      return { at: e.at, ms: Date.parse(e.at) || 0, operateur: e.operatorName || '—', texte, tete: texte.split(MARQUEUR_OBSERVATION)[0], tpm: Number.parseFloat(texte) };
    })
    .filter((e) => Number.isFinite(e.tpm)).sort((a, b) => b.ms - a.ms);
}

/** Décision réglementaire en clair — mêmes comparaisons que Fryer#recordTpm. */
function decision(tpm, ctx) {
  const optimal = ctx.fmt.pct(OILS.OPTIMAL_TPM), critique = ctx.fmt.pct(OILS.CRITICAL_TPM);
  if (!Number.isFinite(tpm)) return { marque: 'neutral', callout: null, icone: 'droplet', label: 'Aucune mesure', conseil: `Aucun relevé consigné pour cette friteuse : contrôle TPM requis (seuil légal ${critique}).` };
  if (tpm > OILS.CRITICAL_TPM) return { marque: 'danger', callout: 'danger', icone: 'alert', label: `À remplacer (seuil légal ${critique})`, conseil: `Non-conforme : dépassement de ${critique} de composés polaires — mise au repos ou vidange obligatoire.` };
  if (tpm >= OILS.OPTIMAL_TPM) return { marque: 'warn', callout: 'warn', icone: 'alert', label: 'À surveiller', conseil: `Vigilance : à partir de ${optimal}, filtration et contrôle renforcés jusqu’à la vidange.` };
  return { marque: 'ok', callout: null, icone: 'check', label: 'Huile conforme', conseil: `Huile saine, inférieure à ${optimal} de composés polaires.` };
}

/** Compteurs de service depuis la dernière vidange (marqueur : entrée dont l'action est une vidange). */
function compteurs(serie) {
  const indexVidange = serie.findIndex((r) => /vidange/i.test(r.tete));
  const depuis = indexVidange >= 0 ? serie.slice(0, indexVidange) : serie;
  return { bains: depuis.length, filtrations: depuis.filter((r) => /filtration/i.test(r.tete)).length };
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
  const tete = `<div class="sheet"><div class="kpi"><p class="kpi__label">${echapper(etiquette)}</p><p class="kpi__value num">${valeur}${unite ? `<span class="kpi__unit">${echapper(unite)}</span>` : ''}</p>`;
  const corps = `${marque ? pastille(marque) : ''}${echapper(delta)}</p></div></div>`;
  return marque === 'danger' || marque === 'warn' ? `${tete}<p class="kpi__delta is-down">${corps}` : `${tete}<p class="kpi__delta is-up">${corps}`;
}

/** Jauge 0 → ECHELLE, seuils optimal et critique marqués (jamais recopiés). */
function jauge(tpm, ctx) {
  const remplissage = surEchelle(Number.isFinite(tpm) ? tpm : 0).toFixed(1);
  const marque = (seuil) => `<span class="gauge__mark" data-left="${surEchelle(seuil).toFixed(1)}" data-label="${echapper(ctx.fmt.pct(seuil))}"></span>`;
  return `<div class="gauge"><span class="gauge__value">${Number.isFinite(tpm) ? echapper(ctx.fmt.pct(tpm)) : '—'}<span class="unit"> TPM</span></span>
    <div class="gauge__track"><div class="gauge__fill" data-fill="${remplissage}"></div>${marque(OILS.OPTIMAL_TPM)}${marque(OILS.CRITICAL_TPM)}<span class="gauge__cursor" data-left="${remplissage}"></span></div>
    <div class="gauge__labels"><span>${echapper(ctx.fmt.pct(0))}</span><span>${echapper(ctx.fmt.pct(ECHELLE))}</span></div></div>`;
}

/** Sparkline SVG tracée à la main (aucune librairie) : seuils TPM en pointillés. */
function sparkline(serie, friteuse, ctx) {
  const points = serie.slice(0, POINTS_SPARKLINE).reverse();
  if (points.length < 2) return `<p class="unit">Tendance indisponible : deux relevés consignés minimum (${points.length} en base).</p>`;
  const largeur = 280, hauteur = 72, marge = 8;
  const haut = Math.max(ECHELLE, ...points.map((p) => p.tpm));
  const x = (i) => marge + (i * (largeur - 2 * marge)) / (points.length - 1);
  const y = (v) => hauteur - marge - (Math.max(0, Math.min(v, haut)) / haut) * (hauteur - 2 * marge);
  const trace = points.map((p, i) => `${x(i).toFixed(1)},${y(p.tpm).toFixed(1)}`).join(' ');
  const dernier = points[points.length - 1];
  const limite = (seuil, tiret) => `<line x1="${marge}" y1="${y(seuil).toFixed(1)}" x2="${largeur - marge}" y2="${y(seuil).toFixed(1)}" stroke="currentColor" stroke-width="1" stroke-dasharray="${tiret}" opacity="0.5"></line><text x="${largeur - marge}" y="${(y(seuil) - 3).toFixed(1)}" fill="currentColor" font-size="9" text-anchor="end" opacity="0.75">${echapper(ctx.fmt.pct(seuil))}</text>`;
  return `<span class="kpi__spark"><svg width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="Tendance TPM de ${echapper(friteuse.name)} sur ${points.length} relevés, dernière valeur ${echapper(ctx.fmt.pct(dernier.tpm))}">
    <rect x="${marge}" y="${marge}" width="${largeur - 2 * marge}" height="${hauteur - 2 * marge}" fill="none" stroke="currentColor" stroke-width="1" opacity="0.15"></rect>
    ${limite(OILS.CRITICAL_TPM, '5 4')}${limite(OILS.OPTIMAL_TPM, '2 4')}
    <polyline points="${trace}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
    <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(dernier.tpm).toFixed(1)}" r="2.5" fill="currentColor"></circle></svg></span>`;
}

function tableauReleves(serie, ctx) {
  if (!serie.length) return `<p class="unit">Aucun relevé consigné pour cette friteuse — commencez par « Nouveau relevé TPM ».</p>`;
  const lignes = serie.slice(0, LIGNES_TABLE).map((r) => {
    const d = decision(r.tpm, ctx);
    return `<tr><td class="num">${echapper(ctx.fmt.dt(r.at))}</td><td class="num">${echapper(ctx.fmt.pct(r.tpm))}</td><td>${pastille(d.marque)}<span class="mark__label">${echapper(d.label)}</span></td><td>${/filtration/i.test(r.tete) ? 'Oui' : 'Non'}</td><td>${echapper(r.operateur)}</td></tr>`;
  }).join('');
  return `<table class="table table--compact table--scroll"><thead><tr><th>Date</th><th>TPM</th><th>Statut</th><th>Filtrée</th><th>Opérateur</th></tr></thead><tbody>${lignes}</tbody></table>`;
}

function ficheFriteuse(friteuse, ctx) {
  const serie = releves(ctx, friteuse.id), d = decision(friteuse.lastTpm, ctx), compte = compteurs(serie), id = echapper(friteuse.id);
  return `<section class="section" data-fryer-card="${id}"><div class="sheet">
    <div class="sheet__head">
      <span class="strong">${echapper(friteuse.name)}</span>
      <span class="unit">${echapper(friteuse.volume)} · dernière vidange ${echapper(friteuse.lastChange)}</span>
      ${pastille(d.marque)}<span class="mark__label">${echapper(d.label)}</span>
      <button class="btn btn--sm section__action" type="button" data-action="nouveau-releve" data-fryer="${id}">${ctx.icon('plus', 16)} Nouveau relevé TPM</button>
      <button class="btn btn--ghost btn--sm" type="button" data-action="nouvelle-huile" data-fryer="${id}">${ctx.icon('refresh', 16)} Nouvelle huile</button>
    </div>
    <div class="sheet__body"><div class="grid grid--2">
      <div class="stack">${jauge(friteuse.lastTpm, ctx)}<div class="grid grid--3">
        ${kpi('Bains relevés', String(compte.bains), '', 'depuis la dernière vidange', 'ok')}
        ${kpi('Filtrations', String(compte.filtrations), '', 'depuis la dernière vidange', 'ok')}
        ${kpi('Dernier contrôleur', echapper(friteuse.operator), '', serie.length ? ctx.fmt.relative(serie[0].at) : 'aucun relevé', serie.length ? 'ok' : 'warn')}</div></div>
      <div class="stack">${sparkline(serie, friteuse, ctx)}<p class="field__hint">${echapper(d.conseil)}</p></div>
    </div>${tableauReleves(serie, ctx)}</div></div></section>`;
}

/* ── Panneaux (saisie : aucune boîte native) ────────────────────────────────── */

function apercuTpm(tpm, ctx) {
  const d = decision(tpm, ctx);
  const contenu = `${ctx.icon(d.icone, 16)}<span><strong>${echapper(d.label)}</strong> — ${echapper(d.conseil)}</span>`;
  if (d.callout === 'danger') return `<div class="callout callout--danger" role="status">${contenu}</div>`;
  if (d.callout === 'warn') return `<div class="callout callout--warn" role="status">${contenu}</div>`;
  return `<div class="callout" role="status">${contenu}</div>`;
}

function ouvrirReleve(ctx, root, fryerId) {
  const liste = friteuses(ctx);
  if (!liste.length) { ctx.ui.toast({ status: 'warn', message: 'Aucune friteuse déclarée : relevé impossible.' }); return; }
  const etat = { panneau: null };
  const options = liste.map((f) => `<option value="${echapper(f.id)}"${String(f.id) === String(fryerId) ? ' selected' : ''}>${echapper(f.name)} · ${echapper(f.volume)}</option>`).join('');
  const cible = trouverFriteuse(ctx, fryerId) || liste[0];
  const corps = `<div class="stack">
    <div class="field"><label class="field__label" for="oil-fryer">Friteuse</label><select class="select" id="oil-fryer">${options}</select></div>
    <div class="field"><label class="field__label" for="oil-tpm">Taux de composés polaires mesuré</label>
      <div class="input-group"><input class="input num" id="oil-tpm" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${echapper(cible.lastTpm)}"><span class="input-group__suffix">% TPM</span></div>
      <p class="field__hint">Jauge Testo 270 · seuil optimal ${echapper(ctx.fmt.pct(OILS.OPTIMAL_TPM))}, seuil légal ${echapper(ctx.fmt.pct(OILS.CRITICAL_TPM))} (Décret 2008-184).</p></div>
    <div class="field"><label class="field__label" for="oil-action">Opération associée</label>
      <select class="select" id="oil-action">${TYPES_ACTION.map((t, i) => `<option value="${echapper(t)}"${i ? '' : ' selected'}>${echapper(t)}</option>`).join('')}</select></div>
    <div class="field"><label class="field__label" for="oil-obsv">Observations</label>
      <textarea class="textarea" id="oil-obsv" rows="2" placeholder="Aspect, odeur, mousse, présence d’aliments brûlés…"></textarea></div>
    <div id="oil-apercu" aria-live="polite">${apercuTpm(Number(cible.lastTpm), ctx)}</div></div>`;
  const brancher = (panneau) => {
    const champ = panneau.querySelector('#oil-tpm'), apercu = panneau.querySelector('#oil-apercu');
    if (!champ || !apercu) return;
    // Aperçu du statut recalculé à chaque frappe (seuils issus de HACCP_NORMS.OILS).
    champ.addEventListener('input', () => {
      const valeur = Number.parseFloat(String(champ.value).replace(',', '.'));
      apercu.innerHTML = apercuTpm(Number.isFinite(valeur) ? valeur : NaN, ctx);
    });
  };
  ctx.ui.panel({
    id: 'oil-releve', title: 'Nouveau relevé TPM', subtitle: 'Composés polaires', body: corps,
    onMount: (panneau) => { etat.panneau = panneau; brancher(panneau); },
    actions: [{ label: 'Consigner le relevé', kind: 'primary', onClick: () => consigner(ctx, root, etat.panneau) }, { label: 'Annuler', kind: 'ghost' }],
  });
}

/** Enregistre le relevé ; renvoie `false` pour laisser le panneau ouvert en cas de refus. */
function consigner(ctx, root, panneau) {
  if (!panneau) return false;
  const lire = (sel) => { const el = panneau.querySelector(sel); return el ? String(el.value || '') : ''; };
  const fryerId = lire('#oil-fryer'), action = lire('#oil-action') || TYPES_ACTION[0], observations = lire('#oil-obsv').trim();
  const tpm = Number.parseFloat(lire('#oil-tpm').replace(',', '.'));
  const friteuse = trouverFriteuse(ctx, fryerId);
  if (!friteuse) { ctx.ui.toast({ status: 'danger', message: 'Friteuse introuvable : relevé refusé.' }); return false; }
  if (!Number.isFinite(tpm) || tpm < 0) { ctx.ui.toast({ status: 'danger', message: 'Saisissez un taux TPM valide (0 à 100).' }); return false; }
  if (tpm > OILS.CRITICAL_TPM && !/vidange|repos/i.test(action)) {
    ctx.ui.toast({ status: 'danger', message: `TPM ${ctx.fmt.pct(tpm)} au-delà du seuil légal ${ctx.fmt.pct(OILS.CRITICAL_TPM)} : choisissez « Vidange complète » ou « Mise au repos » — l’huile ne peut pas être validée conforme.` });
    return false;
  }
  const apres = ctx.useCases.recordOilTest(friteuse.id, tpm, action, operateurCourant(ctx));
  const retenu = apres && Number.isFinite(Number(apres.lastTpm)) ? Number(apres.lastTpm) : tpm;
  tracer(ctx, friteuse.id, `${retenu} % TPM · ${action}${observations ? `${MARQUEUR_OBSERVATION}${observations}` : ''}`);
  const d = decision(tpm, ctx);
  ctx.ui.toast({
    status: d.marque === 'danger' ? 'danger' : d.marque === 'warn' ? 'warn' : 'ok',
    message: d.marque === 'danger' ? `Relevé consigné — non-conformité créée pour ${friteuse.name}.` : `Relevé TPM consigné pour ${friteuse.name} (${ctx.fmt.pct(tpm)}).`,
  });
  rerendre(root, ctx);
  return undefined;
}

async function nouvelleHuile(ctx, root, fryerId) {
  const friteuse = trouverFriteuse(ctx, fryerId);
  if (!friteuse) { ctx.ui.toast({ status: 'danger', message: 'Friteuse introuvable.' }); return; }
  const confirme = await ctx.ui.confirm({
    title: 'Changer l’huile de friture', danger: true, confirmLabel: 'Changer l’huile',
    body: `Confirmer la vidange complète de « ${friteuse.name} » ? Le compteur de bains est remis à zéro, la date de dernière vidange est actualisée et le TPM repart de la valeur d’huile neuve du domaine.`,
  });
  if (!confirme) return;
  const action = TYPES_ACTION[TYPES_ACTION.length - 1];
  const apres = ctx.useCases.recordOilTest(friteuse.id, OILS.OPTIMAL_TPM, action, operateurCourant(ctx));
  const retenu = apres && Number.isFinite(Number(apres.lastTpm)) ? Number(apres.lastTpm) : OILS.OPTIMAL_TPM;
  tracer(ctx, friteuse.id, `${retenu} % TPM · ${action}`);
  ctx.ui.toast({ status: 'ok', message: `Huile neuve enregistrée pour ${friteuse.name} — compteur de bains remis à zéro.` });
  rerendre(root, ctx);
}

/* ── Contrat de vue ─────────────────────────────────────────────────────────── */

/** Métadonnées reprises de NAV (source unique de la navigation). */
export const meta = { id: 'oil', idx: '08', icon: 'droplet', title: 'Huiles de friture', desc: 'TPM, filtration et mise au repos', permissions: null };

export function render(ctx) {
  const liste = friteuses(ctx);
  const entete = `<header class="page-head"><span class="page-head__idx">08</span><h1 class="page-head__title">Huiles de friture</h1>
    <p class="page-head__desc">Mesure des composés polaires par jauge Testo 270 — seuil légal ${echapper(ctx.fmt.pct(OILS.CRITICAL_TPM))} (Décret 2008-184).</p></header>`;
  const outils = `<div class="toolbar"><button class="btn btn--primary" type="button" data-action="nouveau-releve">${ctx.icon('plus', 16)} Nouveau relevé TPM</button></div>`;
  if (!liste.length) {
    return `${entete}${outils}${ctx.ui.empty({ icon: 'droplet', title: 'Aucune friteuse déclarée', body: 'Le parc de friteuses est vide : aucun relevé TPM ne peut être consigné tant qu’une friteuse n’est pas enregistrée.' })}`;
  }
  const conformes = liste.filter((f) => f.status === 'ok').length;
  const vigilance = liste.filter((f) => f.status === 'warning').length;
  const aRemplacer = liste.filter((f) => Number(f.lastTpm) > OILS.CRITICAL_TPM).length;
  const blocKpis = `<div class="grid grid--3">
    ${kpi('Huiles conformes', String(conformes), `/ ${liste.length} friteuses`, `${liste.length - conformes} à traiter`, aRemplacer ? 'danger' : conformes === liste.length ? 'ok' : 'warn')}
    ${kpi('Seuil de vigilance', String(vigilance), 'friteuse(s)', `entre ${ctx.fmt.pct(OILS.OPTIMAL_TPM)} et ${ctx.fmt.pct(OILS.CRITICAL_TPM)}`, vigilance ? 'warn' : 'ok')}
    ${kpi('Vidange obligatoire', String(aRemplacer), 'friteuse(s)', `au-delà de ${ctx.fmt.pct(OILS.CRITICAL_TPM)} de composés polaires`, aRemplacer ? 'danger' : 'ok')}</div>`;
  return `${entete}${outils}
    <section class="section"><div class="section__head"><h2 class="section__title">Parc de friteuses</h2><span class="unit">${liste.length} friteuse(s) suivie(s)</span></div>
      <div class="callout callout--info">${ctx.icon('seal', 16)}<span>Cadre légal : le taux de composés polaires d’un bain de friture ne doit pas dépasser ${echapper(ctx.fmt.pct(OILS.CRITICAL_TPM))}. Au-delà, l’huile est impropre à la friture et la vidange est obligatoire.</span></div>
      ${blocKpis}</section>
    ${liste.map((f) => ficheFriteuse(f, ctx)).join('')}`;
}

/** Actions déclarées par cette vue (chaque `data-action` du markup est traité ici). */
const ACTIONS = {
  'nouveau-releve': (el, root, ctx) => ouvrirReleve(ctx, root, el && el.dataset ? el.dataset.fryer : null),
  'nouvelle-huile': (el, root, ctx) => { nouvelleHuile(ctx, root, el && el.dataset ? el.dataset.fryer : null); },
};

/** Géométrie de la jauge (boucle + curseur) : aucun style en ligne dans le markup. */
function peindre(root) {
  for (const el of root.querySelectorAll('[data-fill]')) el.style.width = `${Math.max(0, Math.min(100, Number(el.getAttribute('data-fill')) || 0))}%`;
  for (const el of root.querySelectorAll('[data-left]')) el.style.left = `${Math.max(0, Math.min(100, Number(el.getAttribute('data-left')) || 0))}%`;
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

export function mount(root, ctx) {
  const maGeneration = ++generation;
  attacher(root, ctx);
  peindre(root);
  abonnement = ctx.store.subscribe(() => {
    if (maGeneration !== generation || !root.isConnected || root.hidden) return;
    rerendre(root, { ...ctx, ...ctx.store.getState() });
  });
}

export function unmount() {
  generation += 1;
  if (abonnement) { abonnement(); abonnement = null; }
}
