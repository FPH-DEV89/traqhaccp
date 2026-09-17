/**
 * Module « Températures » — relevés quotidiens des enceintes froides et chaudes (module 03).
 * Liste dense par équipement : plage cible, dernier relevé, 3 créneaux du jour,
 * tendance 7 jours (SVG écrit à la main) et action corrective sur écart.
 */
import { HACCP_NORMS } from '../../domain/constants.js';

const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomOperateur = (ctx) => ctx.account.getOperatorName(ctx.store.getState().currentOperator?.id) || 'Non identifié';
const VIDE = '—';
const JOUR_MS = 86400000;
let generation = 0;
let abonnement = null;
let panneauCorrectif = null;

/** Les trois créneaux de relevé de la journée (matin / midi / soir). */
const CRENEAUX = [
  { id: 'matin', label: 'Matin', jusqua: 12 },
  { id: 'midi', label: 'Midi', jusqua: 17 },
  { id: 'soir', label: 'Soir', jusqua: 24 },
];

/* ── lecture des données ─────────────────────────────────────────────── */
const nombre = (v, defaut = 0) => (Number.isFinite(Number(v)) ? Number(v) : defaut);
const borne = (v) => parseFloat(nombre(v).toFixed(1));
const equipements = (ctx) => ctx.store.getEquipments() || [];
const trouver = (ctx, id) => equipements(ctx).find((e) => e.id === id) || null;
const historique = (eq) => (Array.isArray(eq.history) ? eq.history : []);
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const jourDe = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); };
const duJour = (iso) => jourDe(iso) === aujourdhui();

/** Plage cible : réglages de l'équipement, sinon référentiel HACCP_NORMS. */
function plage(eq) {
  const mini = Number(eq.min);
  const maxi = Number(eq.max);
  if (Number.isFinite(mini) && Number.isFinite(maxi)) return { min: mini, max: maxi, ref: 'Réglage établissement' };
  const n = HACCP_NORMS.TEMPERATURES;
  if (eq.type === 'froid_neg') return { ...n.FROID_NEGATIF, ref: n.FROID_NEGATIF.label };
  if (eq.type === 'chaud') return { ...n.LIAISON_CHAUDE, ref: n.LIAISON_CHAUDE.label };
  return { ...n.FROID_POSITIF_VIANDES, ref: n.FROID_POSITIF_VIANDES.label };
}

const conformeEq = (eq) => {
  const p = plage(eq);
  const t = nombre(eq.current, NaN);
  return Number.isFinite(t) && t >= p.min && t <= p.max;
};

/** Écart signé par rapport à la borne la plus proche (0 si conforme). */
function ecartEq(eq) {
  const p = plage(eq);
  const t = nombre(eq.current);
  if (t > p.max) return borne(t - p.max);
  if (t < p.min) return borne(t - p.min);
  return 0;
}

function creneauDe(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (CRENEAUX.find((c) => d.getHours() < c.jusqua) || CRENEAUX[2]).id;
}

function creneauxFaits(eq) {
  const set = new Set();
  historique(eq).filter((r) => duJour(r.timestamp)).forEach((r) => { const c = creneauDe(r.timestamp); if (c) set.add(c); });
  return set;
}

/** Les 7 derniers jours (du plus ancien au plus récent). */
function jours7() {
  const base = Date.now();
  const sortie = [];
  for (let i = 6; i >= 0; i -= 1) sortie.push(new Date(base - i * JOUR_MS).toISOString().slice(0, 10));
  return sortie;
}

/** Moyenne journalière des relevés sur 7 jours (null si aucun relevé ce jour-là). */
function serie(eq) {
  const h = historique(eq);
  return jours7().map((jour) => {
    const temps = h.filter((r) => jourDe(r.timestamp) === jour).map((r) => nombre(r.temp));
    if (!temps.length) return null;
    return borne(temps.reduce((a, b) => a + b, 0) / temps.length);
  });
}

/** Fine sparkline SVG (polyline + point courant), échelle sur la plage cible, zones hors plage marquées. */
function sparkline(eq) {
  const p = plage(eq);
  const valeurs = serie(eq);
  const presents = valeurs.filter((v) => v !== null);
  const bas = Math.min(p.min, ...(presents.length ? presents : [p.min])) - 1;
  const haut = Math.max(p.max, ...(presents.length ? presents : [p.max])) + 1;
  const span = haut - bas || 1;
  const X = (i) => 6 + (i * 108) / 6;
  const Y = (t) => Math.max(0, Math.min(30, 3 + ((haut - t) / span) * 24));
  const ligne = valeurs.map((v, i) => (v === null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  const dernier = valeurs.map((v, i) => ({ v, i })).filter((o) => o.v !== null).pop();
  const yHaut = Y(p.max);
  const yBas = Y(p.min);
  return `<svg width="120" height="30" viewBox="0 0 120 30" role="img" aria-label="Tendance sur 7 jours">
    <rect x="0" y="0" width="120" height="${yHaut.toFixed(1)}" fill="currentColor" fill-opacity="0.10"></rect>
    <rect x="0" y="${yBas.toFixed(1)}" width="120" height="${(30 - yBas).toFixed(1)}" fill="currentColor" fill-opacity="0.10"></rect>
    <line x1="0" y1="${yHaut.toFixed(1)}" x2="120" y2="${yHaut.toFixed(1)}" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"></line>
    <line x1="0" y1="${yBas.toFixed(1)}" x2="120" y2="${yBas.toFixed(1)}" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"></line>
    ${ligne ? `<polyline points="${ligne}" fill="none" stroke="currentColor" stroke-width="1.5"></polyline>` : ''}
    ${dernier ? `<circle cx="${X(dernier.i).toFixed(1)}" cy="${Y(dernier.v).toFixed(1)}" r="2" fill="currentColor"></circle>` : ''}
  </svg>`;
}

function indicateurs(ctx) {
  const eqs = equipements(ctx);
  let total = 0;
  let conformes = 0;
  eqs.forEach((eq) => {
    const p = plage(eq);
    historique(eq).filter((r) => duJour(r.timestamp)).forEach((r) => {
      total += 1;
      const t = nombre(r.temp);
      if (t >= p.min && t <= p.max) conformes += 1;
    });
  });
  return {
    total,
    attendus: eqs.length * CRENEAUX.length,
    taux: total ? Math.round((conformes / total) * 100) : null,
    ecarts: eqs.filter((eq) => !conformeEq(eq)).length,
    nb: eqs.length,
  };
}

/* ── rendu ───────────────────────────────────────────────────────────── */
function ligneEquipement(eq, ctx) {
  const p = plage(eq);
  const ok = conformeEq(eq);
  const temp = nombre(eq.current, NaN);
  const faits = creneauxFaits(eq);
  const creneaux = CRENEAUX.map((c) => `<span class="mark ${faits.has(c.id) ? 'mark--ok' : 'mark--neutral'}"><span class="mark__label">${c.label}</span></span>`).join(' ');
  return `<tr>
    <td><span class="strong">${echapper(eq.name)}</span><br><span class="muted">${echapper(eq.location || 'Emplacement non renseigné')}</span></td>
    <td class="num">${ctx.fmt.temp(p.min)} → ${ctx.fmt.temp(p.max)}</td>
    <td><span class="temp ${ok ? 'temp--ok' : 'temp--hot'}">${Number.isFinite(temp) ? ctx.fmt.temp(temp) : VIDE}</span></td>
    <td class="num">${ecartEq(eq) ? ctx.fmt.signed(ecartEq(eq)) : VIDE}</td>
    <td><span class="mark ${ok ? 'mark--ok' : 'mark--danger'}"><span class="mark__label">${ok ? 'Conforme' : 'Écart'}</span></span></td>
    <td>${creneaux}</td>
    <td class="kpi__spark">${sparkline(eq)}</td>
    <td><span class="row">
      <button class="btn btn--sm btn--ghost" type="button" data-action="keypad" data-equip="${echapper(eq.id)}" aria-label="Pavé tactile pour ${echapper(eq.name)}" title="Saisie tactile (Quick Keypad)">${ctx.icon('edit', 14)} Pavé</button>
      <button class="icon-btn" type="button" data-action="step-down" data-equip="${echapper(eq.id)}" aria-label="Diminuer de 0,1 degré">−</button>
      <input class="input num" type="number" inputmode="decimal" step="0.1" value="${Number.isFinite(temp) ? temp.toFixed(1) : ''}" data-role="temp-input" data-equip="${echapper(eq.id)}" aria-label="Température mesurée de ${echapper(eq.name)}">
      <button class="icon-btn" type="button" data-action="step-up" data-equip="${echapper(eq.id)}" aria-label="Augmenter de 0,1 degré">+</button>
    </span></td>
    <td class="muted">${echapper(eq.operator || VIDE)}<br>${echapper(eq.lastLog || VIDE)}</td>
  </tr>`;
}

export function render(ctx) {
  const eqs = equipements(ctx);
  const k = indicateurs(ctx);
  const enEcart = eqs.filter((eq) => !conformeEq(eq));
  const tete = `<header class="page-head">
    <span class="page-head__idx">03</span>
    <h1 class="page-head__title">Températures</h1>
    <p class="page-head__desc">Relevés des enceintes froides et chaudes — trois créneaux par jour, contrôle des plages réglementaires.</p>
  </header>`;
  const kpis = `<section class="section"><div class="grid grid--3">
      <div class="kpi"><span class="kpi__label">Conformité du jour</span><span class="kpi__value">${k.taux === null ? VIDE : k.taux}<span class="kpi__unit">%</span></span><span class="kpi__delta">${k.total} relevé(s) enregistré(s)</span></div>
      <div class="kpi"><span class="kpi__label">Relevés du jour</span><span class="kpi__value">${k.total}<span class="kpi__unit">/ ${k.attendus}</span></span><span class="kpi__delta">${k.nb} enceinte(s) suivie(s) — 3 créneaux</span></div>
      <div class="kpi"><span class="kpi__label">Écarts ouverts</span><span class="kpi__value${k.ecarts ? ' is-danger' : ''}">${k.ecarts}</span><span class="kpi__delta">${k.ecarts ? 'Action corrective requise' : 'Aucun écart constaté'}</span></div>
    </div></section>`;
  const barre = `<div class="toolbar">
    <button class="btn btn--primary" type="button" data-action="auto-standard">Saisie rapide brigade</button>
    <button class="btn btn--ghost" type="button" data-action="reset-temps">Réinitialiser la journée</button>
    <span class="muted">Opérateur : ${echapper(nomOperateur(ctx))}</span>
  </div>`;
  if (!eqs.length) return `${tete}${kpis}${barre}<section class="section">${ctx.ui.empty({ icon: 'thermometer', title: 'Aucune enceinte déclarée', body: 'Déclarez vos enceintes dans les réglages pour enregistrer des relevés de température.', actionLabel: 'Ouvrir les réglages', onAction: () => ctx.router.switchTab('reglages') })}</section>`;
  const alerte = enEcart.length ? `<section class="section"><div class="callout callout--danger">
      <p><span class="strong">${enEcart.length} enceinte(s) hors plage cible.</span> Enregistrez l'action corrective pour générer la non-conformité correspondante.</p>
      <p class="row">${enEcart.map((eq) => `<button class="btn btn--sm btn--danger" type="button" data-action="corrective" data-equip="${echapper(eq.id)}">${echapper(eq.name)} — ${ctx.fmt.temp(eq.current)}</button>`).join(' ')}</p>
    </div></section>` : '';
  return `${tete}${kpis}${barre}${alerte}<section class="section">
    <div class="section__head"><h2 class="section__title">Enceintes suivies</h2><span class="section__action muted">Plage cible · dernier relevé · créneaux · 7 jours</span></div>
    <div class="sheet"><div class="sheet__body">
      <div class="table--scroll">
        <table class="table table--compact table--zebra">
          <thead><tr><th>Équipement</th><th>Plage cible</th><th>Dernière valeur</th><th>Écart</th><th>État</th><th>Créneaux</th><th>Tendance 7 j</th><th>Saisie rapide</th><th>Opérateur</th></tr></thead>
          <tbody>${eqs.map((eq) => ligneEquipement(eq, ctx)).join('')}</tbody>
        </table>
      </div>
    </div></div>
  </section>`;
}

/* ── actions ─────────────────────────────────────────────────────────── */
function rafraichir(root, ctx) { root.innerHTML = render(ctx); }
function rerendre(root, ctx) { if (typeof ctx.store.notify === 'function') ctx.store.notify(); rafraichir(root, ctx); }

function enregistrer(ctx, root, equipId, delta) {
  const eq = trouver(ctx, equipId);
  if (!eq) { ctx.ui.toast({ status: 'danger', message: 'Équipement introuvable.' }); return; }
  let res = null;
  try {
    res = ctx.useCases.logTemperature(equipId, delta, nomOperateur(ctx));
  } catch (e) {
    ctx.ui.toast({ status: 'danger', message: 'Relevé impossible pour cet équipement.' });
    return;
  }
  const cible = (res && res.equipment) || eq;
  if (res && res.isConform === false) {
    ctx.ui.toast({ status: 'danger', message: `Écart enregistré sur ${cible.name}.`, duration: 6000 });
    ouvrirCorrective(ctx, cible);
  } else {
    ctx.ui.toast({ status: 'ok', message: `Relevé enregistré : ${cible.name} — ${ctx.fmt.temp(cible.current)}` });
  }
  rafraichir(root, ctx);
}

function saisirValeur(root, ctx, champ) {
  const eq = trouver(ctx, champ.dataset.equip);
  if (!eq) return;
  const saisi = parseFloat(String(champ.value).replace(',', '.'));
  if (!Number.isFinite(saisi)) {
    ctx.ui.toast({ status: 'warn', message: 'Valeur de température illisible.' });
    rafraichir(root, ctx);
    return;
  }
  const delta = borne(saisi - nombre(eq.current));
  if (Math.abs(delta) < 0.05) { ctx.ui.toast({ status: 'info', message: 'Valeur identique à la dernière mesure.' }); return; }
  enregistrer(ctx, root, eq.id, delta);
}

/** Réinitialisation de la journée : les relevés du jour sont retirés, l'historique est conservé. */
function reinitialiser(ctx) {
  if (typeof ctx.useCases.resetAllTemperatures === 'function') { ctx.useCases.resetAllTemperatures(nomOperateur(ctx)); return; }
  const jour = aujourdhui();
  equipements(ctx).forEach((eq) => {
    if (!Array.isArray(eq.history)) return;
    eq.history = eq.history.filter((r) => jourDe(r.timestamp) !== jour);
    const dernier = eq.history[0];
    if (dernier) {
      eq.current = borne(dernier.temp);
      eq.lastLog = ctx.fmt.time(dernier.timestamp);
      eq.operator = dernier.operator || VIDE;
    } else { eq.lastLog = VIDE; eq.operator = VIDE; }
    eq.status = conformeEq(eq) ? 'ok' : 'danger';
  });
  ctx.repository.saveEquipments(equipements(ctx));
}

function ouvrirKeypad(ctx, root, equipId) {
  const eq = trouver(ctx, equipId);
  if (!eq) return;
  const p = plage(eq);
  let valeurCourante = Number.isFinite(Number(eq.current)) ? String(Number(eq.current).toFixed(1)) : '3.0';

  let presets = ['+2.0', '+3.0', '+4.0'];
  if (eq.type === 'froid_neg') {
    presets = ['-18.0', '-19.0', '-20.0'];
    if (!Number.isFinite(Number(eq.current))) valeurCourante = '-18.0';
  } else if (eq.type === 'chaud') {
    presets = ['+63.0', '+65.0', '+70.0'];
    if (!Number.isFinite(Number(eq.current))) valeurCourante = '65.0';
  }

  const corps = `<div class="keypad">
    <div class="keypad__display" id="keypad-val">${echapper(valeurCourante)} °C</div>
    <div class="quick-adjust">
      ${presets.map((v) => `<button type="button" class="quick-adjust__btn" data-key-val="${v}">${v} °C</button>`).join('')}
    </div>
    <div class="keypad__grid">
      <button type="button" class="keypad__btn" data-key="1">1</button>
      <button type="button" class="keypad__btn" data-key="2">2</button>
      <button type="button" class="keypad__btn" data-key="3">3</button>
      <button type="button" class="keypad__btn" data-key="4">4</button>
      <button type="button" class="keypad__btn" data-key="5">5</button>
      <button type="button" class="keypad__btn" data-key="6">6</button>
      <button type="button" class="keypad__btn" data-key="7">7</button>
      <button type="button" class="keypad__btn" data-key="8">8</button>
      <button type="button" class="keypad__btn" data-key="9">9</button>
      <button type="button" class="keypad__btn" data-key="sign">±</button>
      <button type="button" class="keypad__btn" data-key="0">0</button>
      <button type="button" class="keypad__btn" data-key="dot">.</button>
    </div>
  </div>`;

  let panneauKeypad = null;

  ctx.ui.modal({
    id: 'temp-keypad',
    title: `Relevé : ${eq.name}`,
    body: corps,
    actions: [
      {
        label: 'Effacer',
        kind: 'ghost',
        onClick: () => {
          valeurCourante = '';
          const aff = panneauKeypad ? panneauKeypad.querySelector('#keypad-val') : null;
          if (aff) aff.textContent = '— °C';
          return false;
        },
      },
      {
        label: 'Enregistrer',
        kind: 'primary',
        onClick: () => {
          const num = parseFloat(valeurCourante.replace(',', '.'));
          if (!Number.isFinite(num)) {
            ctx.ui.toast({ status: 'warn', message: 'Valeur de température invalide.' });
            return false;
          }
          let res = null;
          try {
            res = ctx.useCases.setExactTemperature(eq.id, num, nomOperateur(ctx));
          } catch (e) {
            ctx.ui.toast({ status: 'danger', message: 'Relevé impossible pour cet équipement.' });
            return false;
          }
          const cible = (res && res.equipment) || eq;
          if (res && res.isConform === false) {
            ctx.ui.toast({ status: 'danger', message: `Écart enregistré sur ${cible.name} (${ctx.fmt.temp(num)}).`, duration: 6000 });
            ouvrirCorrective(ctx, cible);
          } else {
            ctx.ui.toast({ status: 'ok', message: `Relevé enregistré : ${cible.name} — ${ctx.fmt.temp(num)}` });
          }
          rafraichir(root, ctx);
          return true;
        },
      },
    ],
    onMount: (el) => {
      panneauKeypad = el;
      const aff = el.querySelector('#keypad-val');
      const majAffichage = () => {
        if (aff) aff.textContent = (valeurCourante || '0') + ' °C';
      };
      el.addEventListener('click', (e) => {
        const btnVal = e.target.closest('[data-key-val]');
        if (btnVal) {
          valeurCourante = btnVal.getAttribute('data-key-val').replace('+', '');
          majAffichage();
          return;
        }
        const btnKey = e.target.closest('[data-key]');
        if (!btnKey) return;
        const key = btnKey.getAttribute('data-key');
        if (key === 'dot') {
          if (!valeurCourante.includes('.')) valeurCourante += '.';
        } else if (key === 'sign') {
          if (valeurCourante.startsWith('-')) valeurCourante = valeurCourante.slice(1);
          else if (valeurCourante.length) valeurCourante = '-' + valeurCourante;
          else valeurCourante = '-';
        } else {
          if (valeurCourante === '0') valeurCourante = key;
          else valeurCourante += key;
        }
        majAffichage();
      });
    },
  });
}

function ouvrirCorrective(ctx, eq) {
  const op = nomOperateur(ctx);
  const p = plage(eq);
  const echeance = new Date(Date.now() + 2 * JOUR_MS).toISOString().slice(0, 10);
  panneauCorrectif = null;
  const corps = `<div class="stack">
    <div class="callout callout--danger">
      <p><span class="strong">${echapper(eq.name)}</span> — relevé de ${ctx.fmt.temp(eq.current)} hors plage cible ${ctx.fmt.temp(p.min)} → ${ctx.fmt.temp(p.max)}.</p>
      <p class="muted">Le relevé est conservé : la non-conformité est créée à la validation de l'action corrective.</p>
    </div>
    <div class="field"><label class="field__label" for="corrective-action">Action corrective menée</label><input class="input" id="corrective-action" name="action" value=""><span class="field__hint">Exemple : contrôle du thermostat, transfert des denrées, appel du technicien froid.</span></div>
    <div class="field"><label class="field__label" for="corrective-comment">Observations</label><textarea class="textarea" id="corrective-comment" name="comment" rows="3"></textarea></div>
    <div class="grid grid--2">
      <div class="field"><label class="field__label" for="corrective-responsable">Responsable</label><input class="input" id="corrective-responsable" name="responsable" value="${echapper(op)}"></div>
      <div class="field"><label class="field__label" for="corrective-echeance">Échéance de vérification</label><input class="input" type="date" id="corrective-echeance" name="echeance" value="${echeance}"></div>
    </div>
  </div>`;
  ctx.ui.panel({
    id: 'temp-corrective',
    title: 'Action corrective',
    subtitle: `${eq.name} — écart de température`,
    body: corps,
    actions: [
      { label: 'Valider et créer la non-conformité', kind: 'primary', onClick: (el) => validerCorrective(ctx, eq, el) },
      { label: 'Plus tard', kind: 'ghost', onClick: () => ctx.ui.closeOverlay('temp-corrective') },
    ],
    onMount: (el) => { panneauCorrectif = el; },
  });
}

function validerCorrective(ctx, eq, el) {
  const racine = (el && el.querySelector) ? el : panneauCorrectif;
  const lire = (sel) => {
    const champ = racine && racine.querySelector ? racine.querySelector(sel) : null;
    return champ ? String(champ.value || '').trim() : '';
  };
  const action = lire('[name="action"]');
  if (!action) { ctx.ui.toast({ status: 'warn', message: "Décrivez l'action corrective menée." }); return; }
  const commentaire = [
    lire('[name="comment"]'),
    `Responsable : ${lire('[name="responsable"]') || nomOperateur(ctx)}`,
    `Échéance : ${lire('[name="echeance"]') || 'non précisée'}`,
  ].filter(Boolean).join(' | ');
  ctx.useCases.resolveTemperatureIncident(eq.id, action, commentaire, nomOperateur(ctx));
  ctx.ui.closeOverlay('temp-corrective');
  ctx.ui.toast({ status: 'ok', message: 'Non-conformité créée et action corrective clôturée.' });
  if (typeof ctx.store.notify === 'function') ctx.store.notify();
}

const ACTIONS = {
  'keypad': (el, root, ctx) => ouvrirKeypad(ctx, root, el.dataset.equip),
  'step-down': (el, root, ctx) => enregistrer(ctx, root, el.dataset.equip, -0.1),
  'step-up': (el, root, ctx) => enregistrer(ctx, root, el.dataset.equip, 0.1),
  'auto-standard': (el, root, ctx) => {
    ctx.useCases.autoLogStandardTemps(nomOperateur(ctx));
    ctx.ui.toast({ status: 'ok', message: 'Relevés standards enregistrés pour toute la brigade.' });
    rafraichir(root, ctx);
  },
  'reset-temps': async (el, root, ctx) => {
    const ok = await ctx.ui.confirm({ title: 'Réinitialiser la journée', body: "Les relevés de température du jour seront effacés pour tous les équipements. L'historique des jours précédents est conservé.", confirmLabel: 'Réinitialiser', danger: true });
    if (!ok) return;
    reinitialiser(ctx);
    ctx.ui.toast({ status: 'warn', message: 'Relevés du jour réinitialisés.' });
    rerendre(root, ctx);
  },
  'corrective': (el, root, ctx) => { const eq = trouver(ctx, el.dataset.equip); if (eq) ouvrirCorrective(ctx, eq); },
};

function attacher(root, ctx) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, root, ctx);
  });
  root.addEventListener('change', (e) => {
    const champ = e.target.closest('[data-role="temp-input"]');
    if (!champ || !root.contains(champ)) return;
    saisirValeur(root, ctx, champ);
  });
}

export const meta = { id: 'temperatures', idx: '03', icon: 'thermometer', title: 'Températures', desc: 'Relevés des enceintes froides et chaudes', permissions: null };

export function mount(root, ctx) {
  const maGeneration = ++generation;
  attacher(root, ctx);
  abonnement = ctx.store.subscribe(() => { if (maGeneration === generation) rafraichir(root, ctx); });
}

export function unmount() {
  generation += 1;
  if (abonnement) { abonnement(); abonnement = null; }
  panneauCorrectif = null;
}
