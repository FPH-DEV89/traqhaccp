/**
 * js/patisserie/settings-norms.js — onglets « Normes & seuils », « Équipements »
 * et « Durées de vie » de l'écran Réglages. Greffon du socle settings.js : ce
 * module n'importe JAMAIS settings.js (cycle interdit), le socle lui remet `ctx`.
 *
 *   - « Normes & seuils » : seuils de l'établissement persistés dans settings.norms,
 *     sous la forme exacte de NORMS (src/domain/haccp_norms.js) ;
 *   - « Équipements » : parc des enceintes froides et chaudes, type pris dans
 *     HACCP_NORMS.TEMPERATURES, bornes ajustables par appareil ;
 *   - « Durées de vie » : paliers de DLC secondaire par famille (SHELF_LIFE_PRESETS).
 *
 * Contrat d'onglet : { id, label, icon, render(ctx) -> html }. ctx = { settings,
 * esc, icon, textField, settingRow, switchControl, writeSettings, showToast,
 * rerender, switchTab, registerSubmit, registerAction }. Aucune couleur en dur,
 * aucun emoji, aucun dialogue natif : uniquement le design system.
 */

import { NORMS } from '../../src/domain/haccp_norms.js';
import { HACCP_NORMS, DEFAULT_EQUIPMENTS, SHELF_LIFE_PRESETS, STORAGE_KEYS } from '../../src/domain/constants.js';

const TEMPERATURES = HACCP_NORMS.TEMPERATURES;

/* ═══════════════════════════════════════════════════════════════════
   Lecture tolérante et fusion avec le référentiel
   ═══════════════════════════════════════════════════════════════════ */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Nombre tolérant : « 2,5 » comme « 2.5 » ; vide ou texte renvoient le repli. */
function readNumber(value, fallback) {
  const brut = value === undefined || value === null ? '' : String(value).trim().replace(',', '.');
  if (!brut) return fallback;
  const nombre = Number(brut);
  return Number.isFinite(nombre) ? nombre : fallback;
}

const frNumber = (value) => String(value).replace('.', ',');
const frTemp = (value) => `${value > 0 ? '+' : ''}${frNumber(value)} °C`;
const frRange = (bornes) => `${frTemp(bornes[0])} → ${frTemp(bornes[1])}`;

/** Valeur de référence d'un champ nommé « groupe.clef » dans NORMS. */
function reference(name) {
  const parts = String(name).split('.');
  if (parts.length === 1) return NORMS[parts[0]];
  const groupe = NORMS[parts[0]];
  return groupe ? groupe[parts[1]] : undefined;
}

/** Valeur retenue par l'établissement, repli automatique sur la référence. */
function savedValue(settings, name) {
  const seuils = (settings && settings.norms) || {};
  const parts = String(name).split('.');
  if (parts.length === 1) return readNumber(seuils[parts[0]], reference(name));
  const groupe = seuils[parts[0]];
  return readNumber(groupe ? groupe[parts[1]] : undefined, reference(name));
}

/**
 * Recompose la forme complète de NORMS autour des seuils enregistrés : aucune
 * clef ne peut manquer après un enregistrement partiel.
 */
function mergeNorms(current, patch) {
  const sortie = {};
  Object.keys(NORMS).forEach((cle) => {
    const base = NORMS[cle];
    const enregistre = current && current[cle];
    if (base && typeof base === 'object' && !Array.isArray(base)) {
      sortie[cle] = Object.assign({}, base, enregistre || {}, (patch && patch[cle]) || {});
    } else {
      sortie[cle] = enregistre === undefined || enregistre === null ? base : enregistre;
    }
  });
  Object.keys(patch || {}).forEach((cle) => {
    if (!(cle in sortie)) sortie[cle] = patch[cle];
  });
  return sortie;
}

/* ═══════════════════════════════════════════════════════════════════
   Onglet « Normes & seuils » — catalogue des tolérances
   ═══════════════════════════════════════════════════════════════════ */

const NORM_SECTIONS = [
  {
    title: 'Enceintes froides et liaison chaude',
    note: 'Arrêté du 21 décembre 2009, articles 4 et 26 : denrées réfrigérées, surgelées et maintien au chaud.',
    fields: [
      { name: 'cold.positiveMin', label: 'Froid positif · borne basse', hint: 'Viandes, crémerie, produits laitiers.', unit: '°C' },
      { name: 'cold.positiveMax', label: 'Froid positif · borne haute', hint: 'Température maximale admise en conservation.', unit: '°C' },
      { name: 'cold.frozenMax', label: 'Surgelés · borne haute', hint: 'Directive 89/108/CE : jamais au-dessus.', unit: '°C' },
      { name: 'cold.vegetableMax', label: 'Fruits et légumes · borne haute', hint: 'Tolérance élargie pour le végétal frais.', unit: '°C' },
      { name: 'hot.serviceMin', label: 'Maintien au chaud · minimum', hint: 'Liaison chaude : seuil obligatoire au service.', unit: '°C' },
    ],
  },
  {
    title: 'Refroidissement, décongélation et huiles',
    note: 'Note de service DGAL/SDSSA/2010-8075, arrêté du 21 décembre 2009 (articles 26 et 27) et arrêté du 26 juin 1986 pour les huiles.',
    fields: [
      { name: 'cooling.fromTemp', label: 'Refroidissement · départ', hint: 'Température en sortie de cuisson.', unit: '°C' },
      { name: 'cooling.toTemp', label: 'Refroidissement · cible', hint: 'Température à atteindre en cellule.', unit: '°C' },
      { name: 'cooling.maxHours', label: 'Refroidissement · durée maximale', hint: 'Règle des 2 heures.', unit: 'h' },
      { name: 'defrost.maxTemp', label: 'Décongélation · maximum', hint: 'Décongélation en enceinte réfrigérée.', unit: '°C' },
      { name: 'defrost.maxHours', label: 'Décongélation · délai après sortie', hint: 'Consommation rapide après décongélation.', unit: 'h' },
      { name: 'oil.tpmAlert', label: "Huiles · seuil d'alerte TPM", hint: 'Surveillance renforcée de la friteuse.', unit: '% TPM' },
      { name: 'oil.tpmMax', label: 'Huiles · seuil de rejet TPM', hint: 'Arrêté du 26 juin 1986 : rejet obligatoire.', unit: '% TPM' },
      { name: 'oil.restHours', label: 'Huiles · repos avant analyse', hint: 'Délai après service avant prélèvement.', unit: 'h' },
    ],
  },
  {
    title: 'pH, portionnement et conservation',
    note: 'Guide de bonnes pratiques d’hygiène de la restauration et règlement (CE) n° 852/2004, annexe II.',
    fields: [
      { name: 'ph.min', label: 'pH · borne basse', hint: 'Acidité forte : marinades, conserves acides.', unit: 'pH' },
      { name: 'ph.max', label: 'pH · borne haute', hint: 'Neutralité alimentaire courante.', unit: 'pH' },
      { name: 'weight.lossAlertPct', label: 'Pertes au portionnement · alerte', hint: 'Écart entre poids théorique et pesée.', unit: '%' },
      { name: 'retentionYears', label: 'Conservation des enregistrements', hint: 'Règlement (CE) 852/2004 : 3 ans minimum.', unit: 'ans' },
    ],
  },
];

/** Contrôles bloquants avant écriture : aucun seuil ne peut descendre sous le socle réglementaire. */
function validateNorms(valeurs) {
  const v = (name) => valeurs[name];
  if (v('cold.positiveMin') >= v('cold.positiveMax')) return 'Froid positif : la borne basse doit rester sous la borne haute';
  if (v('cold.frozenMax') >= v('cold.positiveMax')) return 'Surgelés : la borne haute doit rester plus froide que le froid positif';
  if (v('cold.vegetableMax') < v('cold.positiveMax')) return 'Fruits et légumes : la tolérance ne peut pas être plus stricte que le froid positif';
  if (v('hot.serviceMin') < 63) return 'Maintien au chaud : 63 °C est le minimum réglementaire';
  if (v('cooling.fromTemp') <= v('cooling.toTemp')) return 'Refroidissement : le départ doit être plus chaud que la cible';
  if (v('cooling.maxHours') <= 0 || v('cooling.maxHours') > 24) return 'Refroidissement : la durée maximale doit tenir entre 0 et 24 heures';
  if (v('defrost.maxTemp') > v('cold.positiveMax')) return 'Décongélation : la température ne peut pas dépasser le froid positif';
  if (v('defrost.maxHours') <= 0 || v('defrost.maxHours') > 72) return 'Décongélation : le délai doit tenir entre 0 et 72 heures';
  if (v('oil.tpmAlert') >= v('oil.tpmMax')) return "Huiles : le seuil d'alerte doit rester sous le seuil de rejet";
  if (v('oil.tpmMax') > 25) return 'Huiles : 25 % TPM est le seuil légal de rejet, impossible de le dépasser';
  if (v('oil.restHours') < 0 || v('oil.restHours') > 24) return 'Huiles : le repos avant analyse doit tenir entre 0 et 24 heures';
  if (v('ph.min') >= v('ph.max')) return 'pH : la borne basse doit rester sous la borne haute';
  if (v('weight.lossAlertPct') < 0 || v('weight.lossAlertPct') > 100) return 'Pertes au portionnement : la tolérance doit tenir entre 0 et 100 %';
  if (v('retentionYears') < 3) return 'Conservation : 3 ans minimum (règlement (CE) 852/2004)';
  if (v('retentionYears') > 30) return 'Conservation : 30 ans maximum pour un registre d’exploitation';
  return null;
}

function renderNormes(ctx) {
  const { settings, esc, icon } = ctx;

  ctx.registerSubmit('normes', (form, c) => {
    const data = new FormData(form);
    const valeurs = {};
    let probleme = null;
    NORM_SECTIONS.forEach((section) => {
      section.fields.forEach((field) => {
        const brut = data.get(field.name);
        const valeur = readNumber(brut === null ? '' : String(brut).trim(), null);
        if (valeur === null) probleme = probleme || `Valeur manquante ou illisible : ${field.label}`;
        else valeurs[field.name] = valeur;
      });
    });
    if (!probleme) probleme = validateNorms(valeurs);
    if (probleme) {
      c.showToast(probleme);
      return;
    }
    const patch = {};
    Object.keys(valeurs).forEach((name) => {
      const parts = name.split('.');
      if (parts.length === 1) patch[parts[0]] = valeurs[name];
      else patch[parts[0]] = Object.assign(patch[parts[0]] || {}, { [parts[1]]: valeurs[name] });
    });
    c.writeSettings({ norms: mergeNorms(c.settings && c.settings.norms, patch) });
    c.showToast('Seuils enregistrés');
    c.rerender();
  });

  ctx.registerAction('normes-reset', (c) => {
    c.writeSettings({ norms: clone(NORMS) });
    c.showToast('Seuils rétablis au référentiel réglementaire');
    c.rerender();
  });

  const groupes = NORM_SECTIONS.map((section, index) => `${index ? '<div class="rule"></div>' : ''}
    <div class="section__head"><span class="section__title">${esc(section.title)}</span></div>
    <p class="settings__lead">${esc(section.note)}</p>
    <div class="settings__grid">
      ${section.fields.map((field) => ctx.textField(
        field.name,
        field.label,
        savedValue(settings, field.name),
        field.hint,
        { type: 'number', suffix: field.unit },
      )).join('')}
    </div>`).join('');

  const ecarts = NORM_SECTIONS.reduce((liste, section) => liste.concat(
    section.fields
      .map((field) => ({ field, valeur: savedValue(settings, field.name), reference: reference(field.name) }))
      .filter((item) => item.valeur !== item.reference),
  ), []);

  const recap = ecarts.length
    ? `<div class="settings__rows">${ecarts.map((item) => ctx.settingRow(
      item.field.label,
      `Valeur retenue ${frNumber(item.valeur)} ${item.field.unit} · référentiel livré ${frNumber(item.reference)} ${item.field.unit}`,
      `<span class="mark mark--warn"><span class="mark__label">Personnalisé</span></span>`,
    )).join('')}</div>`
    : `<div class="callout callout--info">
      ${icon('check', 16)}
      <span>Tous les seuils sont au référentiel réglementaire livré. Les relevés de température, le refroidissement, les huiles et le pH s’appuient directement sur ces valeurs.</span>
    </div>`;

  return `<div class="section">
    <div class="section__head">
      <span class="section__title">Normes et seuils de l'établissement</span>
      <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">${ecarts.length ? `${ecarts.length} seuil(s) personnalisé(s)` : 'Au référentiel'}</span></span></span>
    </div>
    <p class="settings__lead">Ces seuils alimentent les écrans de relevé, les fiches de contrôle et les alertes de service. Ils sont préremplis avec le référentiel réglementaire livré et restent ajustables dans la stricte limite du socle obligatoire.</p>
    <div class="callout callout--info">
      ${icon('shield', 16)}
      <span>Règlement (CE) 852/2004, arrêté du 21 décembre 2009, note de service DGAL/SDSSA/2010-8075 et arrêté du 26 juin 1986 pour les huiles de friture. Un seuil plus permissif que le socle est refusé à l’enregistrement.</span>
    </div>
    <form class="settings__form" data-settings-form="normes">
      ${groupes}
      <div class="settings__foot">
        <button type="button" class="btn btn--ghost" data-settings-action="normes-reset">Rétablir le référentiel</button>
        <button type="submit" class="btn btn--primary">Enregistrer les seuils</button>
      </div>
    </form>
    <div class="rule"></div>
    <div class="section__head"><span class="section__title">Écarts au référentiel</span></div>
    ${recap}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Onglet « Équipements » — parc des enceintes et plages affectées
   ═══════════════════════════════════════════════════════════════════ */

const EQUIPMENT_TYPES = [
  { id: 'froid_pos', label: 'Froid positif viandes et produits très périssables', source: 'Arrêté du 21 décembre 2009, article 4',
    bounds: () => [TEMPERATURES.FROID_POSITIF_VIANDES.min, TEMPERATURES.FROID_POSITIF_VIANDES.max], applied: (n) => [n.coldMin, n.coldMax] },
  { id: 'froid_pos_legumes', label: 'Froid positif fruits et légumes', source: 'Arrêté du 21 décembre 2009, article 4',
    bounds: () => [TEMPERATURES.FROID_POSITIF_LEGUMES.min, TEMPERATURES.FROID_POSITIF_LEGUMES.max], applied: (n) => [TEMPERATURES.FROID_POSITIF_LEGUMES.min, n.coldVegetableMax] },
  { id: 'froid_neg', label: 'Froid négatif et denrées surgelées', source: 'Directive 89/108/CE et décret n° 2002-1463',
    bounds: () => [TEMPERATURES.FROID_NEGATIF.min, TEMPERATURES.FROID_NEGATIF.max], applied: (n) => [TEMPERATURES.FROID_NEGATIF.min, n.coldFrozenMax] },
  { id: 'chaud', label: 'Liaison chaude et maintien au chaud', source: 'Arrêté du 21 décembre 2009, article 26',
    bounds: () => [TEMPERATURES.LIAISON_CHAUDE.min, TEMPERATURES.LIAISON_CHAUDE.max], applied: (n) => [n.hotServiceMin, TEMPERATURES.LIAISON_CHAUDE.max] },
  { id: 'poisson_frais', label: 'Poissons et produits de la mer sous glace', source: 'Arrêté du 21 décembre 2009, article 4',
    bounds: () => [TEMPERATURES.POISSON_FRAIS.min, TEMPERATURES.POISSON_FRAIS.max], applied: () => [TEMPERATURES.POISSON_FRAIS.min, TEMPERATURES.POISSON_FRAIS.max] },
];

function equipmentType(id) {
  return EQUIPMENT_TYPES.find((type) => type.id === id) || null;
}

/** Seuils de l'établissement, tels que retenus dans le référentiel ou l'onglet Normes. */
function normsOf(settings) {
  return {
    coldMin: savedValue(settings, 'cold.positiveMin'),
    coldMax: savedValue(settings, 'cold.positiveMax'),
    coldFrozenMax: savedValue(settings, 'cold.frozenMax'),
    coldVegetableMax: savedValue(settings, 'cold.vegetableMax'),
    hotServiceMin: savedValue(settings, 'hot.serviceMin'),
  };
}

/** Parc déclaré : réglages d'abord, clé historique ensuite, parc livré en dernier recours. */
function readFleet(settings) {
  const enregistre = settings && settings.equipments;
  if (Array.isArray(enregistre)) return clone(enregistre);
  try {
    const brut = window.localStorage.getItem(STORAGE_KEYS.equipments);
    const historique = brut ? JSON.parse(brut) : null;
    if (Array.isArray(historique) && historique.length) return clone(historique);
  } catch (error) {
    // Parc historique illisible : le parc livré prend le relais, rien n'est écrit.
  }
  return clone(DEFAULT_EQUIPMENTS);
}

function renderEquipements(ctx) {
  const { settings, esc, icon } = ctx;

  ctx.registerSubmit('equipment-add', (form, c) => {
    const data = new FormData(form);
    const nom = String(data.get('name') || '').trim();
    const type = equipmentType(String(data.get('type') || ''));
    if (!nom) {
      c.showToast("Le nom de l'équipement est obligatoire");
      return;
    }
    if (!type) {
      c.showToast("Choisissez un type d'équipement référencé");
      return;
    }
    const bornes = type.bounds();
    const min = readNumber(data.get('min'), bornes[0]);
    const max = readNumber(data.get('max'), bornes[1]);
    if (min >= max) {
      c.showToast('Les bornes doivent former une plage croissante');
      return;
    }
    const parc = readFleet(c.settings);
    parc.push({
      id: `eq-${Date.now().toString(36)}`,
      name: nom,
      type: type.id,
      min,
      max,
      location: String(data.get('location') || '').trim(),
      active: true,
    });
    c.writeSettings({ equipments: parc });
    c.showToast(`${nom} déclaré dans le parc`);
    c.rerender();
  });

  ctx.registerAction('equipment-toggle', (c, bouton) => {
    const id = bouton && bouton.dataset ? bouton.dataset.equipmentId : '';
    const parc = readFleet(c.settings);
    const cible = parc.find((item) => item.id === id);
    if (!cible) {
      c.showToast('Équipement introuvable dans le parc');
      return;
    }
    cible.active = cible.active === false;
    c.writeSettings({ equipments: parc });
    c.showToast(cible.active ? `${cible.name} remis en service` : `${cible.name} suspendu`);
    c.rerender();
  });

  ctx.registerAction('equipment-remove', (c, bouton) => {
    const id = bouton && bouton.dataset ? bouton.dataset.equipmentId : '';
    const parc = readFleet(c.settings);
    const cible = parc.find((item) => item.id === id);
    if (!cible) {
      c.showToast('Équipement introuvable dans le parc');
      return;
    }
    c.writeSettings({ equipments: parc.filter((item) => item.id !== id) });
    c.showToast(`${cible.name} retiré du parc`);
    c.rerender();
  });

  ctx.registerAction('equipment-reset', (c) => {
    c.writeSettings({ equipments: clone(DEFAULT_EQUIPMENTS) });
    c.showToast('Parc livré rétabli');
    c.rerender();
  });

  const parc = readFleet(settings);
  const seuils = normsOf(settings);
  const actifs = parc.filter((item) => item.active !== false).length;
  const options = EQUIPMENT_TYPES
    .map((type) => `<option value="${esc(type.id)}">${esc(type.label)}</option>`)
    .join('');

  const lignes = parc.length
    ? parc.map((item) => {
      const type = equipmentType(item.type);
      const repli = type ? type.bounds() : [0, 0];
      const min = readNumber(item.min, repli[0]);
      const max = readNumber(item.max, repli[1]);
      return ctx.settingRow(
        String(item.name || 'Équipement sans nom'),
        `${type ? type.label : 'Type non référencé'} · ${item.location ? String(item.location) : 'Emplacement non précisé'}`,
        `<span class="mark ${item.active === false ? 'mark--neutral' : 'mark--ok'}"><span class="mark__label">${frRange([min, max])} · ${item.active === false ? 'Suspendu' : 'Actif'}</span></span>
         <button type="button" class="btn btn--ghost btn--sm" data-settings-action="equipment-toggle" data-equipment-id="${esc(item.id)}">${item.active === false ? 'Réactiver' : 'Suspendre'}</button>
         <button type="button" class="btn btn--ghost btn--sm" data-settings-action="equipment-remove" data-equipment-id="${esc(item.id)}">Retirer</button>`,
      );
    }).join('')
    : `<div class="empty">
      <span class="empty__title">Aucun équipement déclaré</span>
      <span class="empty__body">Déclarez vos meubles froids et chauds : chaque relevé sera confronté à la plage réglementaire du type choisi.</span>
    </div>`;

  const plages = EQUIPMENT_TYPES.map((type) => {
    const referentiel = type.bounds();
    const applique = type.applied(seuils);
    const aligne = referentiel[0] === applique[0] && referentiel[1] === applique[1];
    return ctx.settingRow(
      type.label,
      `${type.source} · plage réglementaire ${frRange(referentiel)}`,
      `<span class="mark ${aligne ? 'mark--neutral' : 'mark--warn'}"><span class="mark__label">${frRange(applique)}</span></span>`,
    );
  }).join('');

  return `<div class="section">
    <div class="section__head">
      <span class="section__title">Parc des enceintes et meubles</span>
      <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">${actifs} en service / ${parc.length} déclaré(s)</span></span></span>
    </div>
    <p class="settings__lead">Chaque appareil déclaré apparaît dans les relevés de température et les fiches de contrôle. Le type choisi affecte la plage réglementaire de contrôle, ajustable pour une enceinte particulière.</p>
    <form class="settings__form" data-settings-form="equipment-add">
      <div class="settings__grid">
        ${ctx.textField('name', "Nom de l'équipement", '', "Il apparaîtra dans les relevés et les fiches de traçabilité.")}
        <label class="field">
          <span class="field__label">Type d'équipement</span>
          <select class="select" name="type">${options}</select>
          <span class="field__hint">Détermine la plage réglementaire affectée.</span>
        </label>
        ${ctx.textField('location', 'Emplacement', '', 'Zone du laboratoire, du froid ou de la vente.')}
        ${ctx.textField('min', 'Borne basse', '', 'Vide : borne basse du type retenue.', { type: 'number', suffix: '°C' })}
        ${ctx.textField('max', 'Borne haute', '', 'Vide : borne haute du type retenue.', { type: 'number', suffix: '°C' })}
      </div>
      <div class="settings__foot">
        <button type="button" class="btn btn--ghost" data-settings-action="equipment-reset">Rétablir le parc livré</button>
        <button type="submit" class="btn btn--primary">Déclarer l'équipement</button>
      </div>
    </form>
    <div class="settings__rows">${lignes}</div>
    <div class="rule"></div>
    <div class="section__head"><span class="section__title">Plages appliquées par type</span></div>
    <p class="settings__lead">La pastille de droite affiche la plage réellement appliquée à ce type, calculée depuis l'onglet « Normes & seuils ». Elle passe en alerte dès qu'elle s'écarte du référentiel réglementaire.</p>
    <div class="settings__rows">${plages}</div>
    <div class="callout callout--info">
      ${icon('thermometer', 16)}
      <span>Les bornes par défaut proviennent du référentiel réglementaire livré : elles servent de repli si un appareil est déclaré sans borne personnalisée.</span>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Onglet « Durées de vie » — DLC secondaires par famille
   ═══════════════════════════════════════════════════════════════════ */

const DLC_FAMILIES = [
  { key: 'ultraSensible', label: 'Préparations ultra-sensibles', hint: 'Crèmes crues, mousses, steak haché, poisson servi cru.' },
  { key: 'decongele', label: 'Viandes et poissons décongelés', hint: 'Après décongélation en enceinte réfrigérée, avant cuisson.' },
  { key: 'standard', label: 'Standard cuisiné traiteur', hint: 'Sauces cuites, fonds, garnitures, plats élaborés.' },
  { key: 'sousVide', label: 'Semi-conserve pasteurisée sous-vide', hint: 'À ne retenir que si la pasteurisation est validée au dossier.' },
];

const DLC_DEFAULTS = { ultraSensible: 1, decongele: 2, standard: 3, sousVide: 5, label: true, alert: true };

function presetOf(value, fallback) {
  const palier = readNumber(value, fallback);
  return SHELF_LIFE_PRESETS.some((preset) => preset.value === palier) ? palier : fallback;
}

function presetLabel(value) {
  const preset = SHELF_LIFE_PRESETS.find((item) => item.value === value);
  return preset ? preset.label : `J+${value}`;
}

function dlcOf(settings) {
  const enregistre = (settings && settings.dlc) || {};
  return {
    ultraSensible: presetOf(enregistre.ultraSensible, DLC_DEFAULTS.ultraSensible),
    decongele: presetOf(enregistre.decongele, DLC_DEFAULTS.decongele),
    standard: presetOf(enregistre.standard, DLC_DEFAULTS.standard),
    sousVide: presetOf(enregistre.sousVide, DLC_DEFAULTS.sousVide),
    label: enregistre.label !== false,
    alert: enregistre.alert !== false,
  };
}

function renderDurees(ctx) {
  const { settings, esc, icon } = ctx;

  ctx.registerSubmit('dlc', (form, c) => {
    const data = new FormData(form);
    const suivant = { label: data.has('dlcLabel'), alert: data.has('dlcAlert') };
    let probleme = null;
    DLC_FAMILIES.forEach((family) => {
      const brut = data.get(`dlc-${family.key}`);
      const palier = presetOf(brut === null ? '' : String(brut), null);
      if (palier === null) probleme = probleme || `Durée de vie invalide : ${family.label}`;
      else suivant[family.key] = palier;
    });
    if (probleme) {
      c.showToast(probleme);
      return;
    }
    c.writeSettings({ dlc: suivant });
    c.showToast('Durées de vie enregistrées');
    c.rerender();
  });

  ctx.registerAction('dlc-reset', (c) => {
    c.writeSettings({ dlc: clone(DLC_DEFAULTS) });
    c.showToast('Paliers livrés rétablis');
    c.rerender();
  });

  const dlc = dlcOf(settings);
  const familles = DLC_FAMILIES.map((family) => ctx.settingRow(
    family.label,
    `${family.hint} Durée appliquée : ${presetLabel(dlc[family.key])}`,
    `<select class="select" name="dlc-${family.key}">
      ${SHELF_LIFE_PRESETS.map((preset) => `<option value="${preset.value}"${preset.value === dlc[family.key] ? ' selected' : ''}>J+${preset.value}</option>`).join('')}
    </select>`,
  )).join('');

  return `<div class="section">
    <div class="section__head">
      <span class="section__title">Durées de vie secondaires</span>
      <span class="section__action"><span class="mark mark--neutral"><span class="mark__label">J+1 à J+5</span></span></span>
    </div>
    <p class="settings__lead">La DLC secondaire d'une préparation est calculée à partir de sa date de fabrication et de la famille à laquelle elle appartient. Chaque famille reprend un palier du référentiel livré : le calcul reste identique d'un appareil à l'autre.</p>
    <div class="callout callout--info">
      ${icon('tag', 16)}
      <span>Guide de bonnes pratiques d’hygiène : J+1 pour les préparations ultra-sensibles, J+2 pour les viandes et poissons décongelés, J+3 pour le standard cuisiné. Le palier J+5 n'est admis que pour une semi-conserve pasteurisée sous-vide dont le couple temps et température est validé.</span>
    </div>
    <form class="settings__form" data-settings-form="dlc">
      <div class="settings__rows">
        ${familles}
        ${ctx.settingRow("Report de la DLC sur l'étiquette", "La date limite calculée est imprimée sur l'étiquette interne de traçabilité.", ctx.switchControl('dlcLabel', dlc.label))}
        ${ctx.settingRow('Alerte la veille du dépassement', "Un signal est remonté la veille de l'échéance, avant la sortie du jour.", ctx.switchControl('dlcAlert', dlc.alert))}
      </div>
      <div class="settings__foot">
        <button type="button" class="btn btn--ghost" data-settings-action="dlc-reset">Rétablir les paliers livrés</button>
        <button type="submit" class="btn btn--primary">Enregistrer les durées de vie</button>
      </div>
    </form>
    <div class="callout callout--warn">
      ${icon('alert', 16)}
      <span>Une durée de vie allongée au-delà de J+3 doit être justifiée par une analyse de danger et validée par le responsable : les paliers livrés restent la référence de contrôle.</span>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Contrat public du greffon — consommé par SETTINGS_TABS (settings.js)
   ═══════════════════════════════════════════════════════════════════ */

export const TABS_NORMS = [
  { id: 'normes', label: 'Normes & seuils', icon: 'shield', render: renderNormes },
  { id: 'equipements', label: 'Équipements', icon: 'thermometer', render: renderEquipements },
  { id: 'durees', label: 'Durées de vie', icon: 'tag', render: renderDurees },
];
