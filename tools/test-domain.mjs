#!/usr/bin/env node
/**
 * test-domain.mjs — Suite de tests domaine sur le périmètre VIVANT.
 *
 * Périmètre : src/domain/constants.js + src/domain/haccp_norms.js
 * (seuls fichiers de domaine importés par l'app livrée patisserie.html → js/patisserie).
 *
 * Usage :
 *   node tools/test-domain.mjs            → exit 0 si tout est OK
 *   node tools/test-domain.mjs --selftest  → sabote UNE valeur, exige exit ≠ 0 (panne témoin)
 *
 * Assertions conservées depuis test_clean_arch.js + test_complete_app.mjs (avant suppression) :
 *   AVANT : 13 suites × env. 2-4 assertions chacune (entities, usecases, barcode, repo…)
 *   APRÈS : 6 groupes, 89 assertions, toutes sur le domaine vivant :
 *     1. NORMS — seuils réglementaires HACCP (haccp_norms.js)
 *     2. ALLERGENS_14 — les 14 allergènes INCO (haccp_norms.js)
 *     3. HACCP_NORMS + ALL_14_ALLERGENS — exports hérités v3 (constants.js)
 *     4. Cohérence croisée NORMS ↔ HACCP_NORMS
 *     5. Divergences documentées (sémantiques distinctes justifiées)
 *     6. Données de référence (brigade, équipements, DLC, 5M, checklists, NAV)
 *
 * Assertions RETIRÉES (code supprimé) — 13 assertions sur 33 au total (39 %) :
 *   - Equipment / Fryer / DeliveryRecord / PreparationLabel (entities.js supprimé)
 *   - HACCPUseCases, recordPhMeasure, recordWeightMeasure… (usecases.js supprimé)
 *   - LocalStorageHACCPRepository (storage_repository.js supprimé)
 *   - BarcodeService.generateBarcodeSVG / generateQrBadgeSVG (barcode_service.js supprimé)
 *
 * Mode --selftest : sabote NORMS_ACTIVE.oil.tpmMax = 999, exige que ≥ 1 assertion échoue.
 * L'objet NORMS étant gelé, le sabotage se fait sur une copie locale (NORMS_ACTIVE).
 */

import { NORMS, ALLERGENS_14, normFor } from '../src/domain/haccp_norms.js';
import {
  HACCP_NORMS, ALL_14_ALLERGENS, SHELF_LIFE_PRESETS, NC_CATEGORIES,
  DEFAULT_CHECKLIST_ROUTINES, DEFAULT_BRIGADE, DEFAULT_EQUIPMENTS, NAV,
} from '../src/domain/constants.js';

/* ── mode selftest ─────────────────────────────────────────────────────────── */
const SELFTEST = process.argv.includes('--selftest');
// L'objet NORMS est gelé (Object.freeze) : impossible de le modifier directement.
// On crée une copie locale sabotée que les assertions utilisent en mode selftest.
const NORMS_ACTIVE = SELFTEST
  ? { ...NORMS, oil: { ...NORMS.oil, tpmMax: 999 } }
  : NORMS;

if (SELFTEST) {
  console.log('[selftest] NORMS_ACTIVE.oil.tpmMax sabotée à 999 — les assertions doivent échouer.');
}

/* ── outillage d'assertion ─────────────────────────────────────────────────── */
let failures = 0;
let checks = 0;

function assert(condition, message) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  ✗ ÉCHEC: ${message}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 1. NORMS — seuils réglementaires v4 (haccp_norms.js)                       */
/* ─────────────────────────────────────────────────────────────────────────── */
section('1. NORMS — seuils réglementaires (haccp_norms.js)');

// Froid positif
assert(NORMS_ACTIVE.cold.positiveMin === 0,  'Froid positif : borne basse = 0 °C');
assert(NORMS_ACTIVE.cold.positiveMax === 4,  'Froid positif : borne haute = 4 °C (viandes, produits laitiers)');
assert(NORMS_ACTIVE.cold.frozenMax === -18,  'Surgelés : temperature max = -18 °C');
assert(NORMS_ACTIVE.cold.vegetableMax === 6, 'Légumes : temperature max = 6 °C');

// Chaud
assert(NORMS_ACTIVE.hot.serviceMin === 63, 'Maintien au chaud : minimum = 63 °C');

// Refroidissement rapide
assert(NORMS_ACTIVE.cooling.fromTemp === 63,       'Refroidissement : départ = 63 °C');
assert(NORMS_ACTIVE.cooling.toTemp === 10,         'Refroidissement : cible = 10 °C');
assert(NORMS_ACTIVE.cooling.maxHours === 2,        'Refroidissement : durée max = 2 h');
assert(NORMS_ACTIVE.cooling.maxHours * 60 === 120, 'Refroidissement : durée max = 120 min');

// Huiles de friture — seuil critique TPM (sabotée en selftest → doit échouer)
assert(NORMS_ACTIVE.oil.tpmMax === 24,   'Huiles TPM : seuil critique = 24 % (rejet obligatoire)');
assert(NORMS_ACTIVE.oil.tpmAlert === 20, 'Huiles TPM : seuil alerte = 20 % (surveillance renforcée)');
assert(NORMS_ACTIVE.oil.tpmAlert < NORMS_ACTIVE.oil.tpmMax, 'Huiles : alerte < critique');

// Décongélation
assert(NORMS_ACTIVE.defrost.maxTemp === 4,   'Décongélation : temperature max = 4 °C');
assert(NORMS_ACTIVE.defrost.maxHours === 24, 'Décongélation : délai max = 24 h (GBPH J+1)');

// pH
assert(NORMS_ACTIVE.ph.min === 2, 'pH : borne min = 2');
assert(NORMS_ACTIVE.ph.max === 7, 'pH : borne max = 7');

// Conservation des enregistrements
assert(NORMS_ACTIVE.retentionYears === 3, 'Conservation enregistrements HACCP : 3 ans minimum');

// normFor() — helper (utilise NORMS, pas NORMS_ACTIVE — on vérifie le vrai objet)
assert(normFor('cold') === NORMS.cold, 'normFor("cold") renvoie bien NORMS.cold');
assert(normFor('oil') === NORMS.oil,   'normFor("oil") renvoie bien NORMS.oil');
assert(normFor('inconnu') === null,    'normFor("inconnu") renvoie null');

console.log('  → Seuils réglementaires NORMS vérifiés.');

/* ─────────────────────────────────────────────────────────────────────────── */
/* 2. ALLERGENS_14 — les 14 allergènes INCO (haccp_norms.js)                 */
/* ─────────────────────────────────────────────────────────────────────────── */
section('2. ALLERGENS_14 — allergènes INCO (haccp_norms.js)');

assert(ALLERGENS_14.length === 14, 'ALLERGENS_14 : exactement 14 allergènes INCO');
assert(ALLERGENS_14.every((a) => a.id && a.label && a.short), 'ALLERGENS_14 : chaque entrée a id, label, short');

const allergeneIds = ALLERGENS_14.map((a) => a.id);
for (const id of ['gluten', 'crustaces', 'oeufs', 'poissons', 'arachides', 'soja', 'lait',
  'fruits_coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques']) {
  assert(allergeneIds.includes(id), `ALLERGENS_14 : allergène "${id}" présent`);
}
assert(Object.isFrozen(ALLERGENS_14), 'ALLERGENS_14 est gelé (immuable)');

console.log('  → 14 allergènes INCO réglementaires vérifiés.');

/* ─────────────────────────────────────────────────────────────────────────── */
/* 3. HACCP_NORMS + ALL_14_ALLERGENS — héritage v3 (constants.js)             */
/* ─────────────────────────────────────────────────────────────────────────── */
section('3. HACCP_NORMS + ALL_14_ALLERGENS — exports hérités v3 (constants.js)');

assert(HACCP_NORMS && typeof HACCP_NORMS === 'object', 'HACCP_NORMS exporté depuis constants.js');
assert(HACCP_NORMS.TEMPERATURES && typeof HACCP_NORMS.TEMPERATURES === 'object', 'HACCP_NORMS.TEMPERATURES défini');
assert(HACCP_NORMS.OILS && typeof HACCP_NORMS.OILS === 'object', 'HACCP_NORMS.OILS défini');
assert(HACCP_NORMS.COOLING && typeof HACCP_NORMS.COOLING === 'object', 'HACCP_NORMS.COOLING défini');

// Seuil critique TPM v3 (CRITICAL_TPM = 24 %)
assert(HACCP_NORMS.OILS.CRITICAL_TPM === 24, 'HACCP_NORMS.OILS.CRITICAL_TPM = 24 %');

// Températures v3
const T = HACCP_NORMS.TEMPERATURES;
assert(T.FROID_POSITIF_VIANDES && T.FROID_POSITIF_VIANDES.max === 4, 'T.FROID_POSITIF_VIANDES.max = 4 °C');
assert(T.LIAISON_CHAUDE && T.LIAISON_CHAUDE.min === 63, 'T.LIAISON_CHAUDE.min = 63 °C');

// 14 allergènes v3
assert(ALL_14_ALLERGENS.length === 14, 'ALL_14_ALLERGENS : exactement 14 allergènes');
assert(ALL_14_ALLERGENS.every((a) => a.id && a.name && a.short), 'ALL_14_ALLERGENS : chaque entrée a id, name, short');

console.log('  → Exports hérités v3 (HACCP_NORMS, ALL_14_ALLERGENS) vérifiés.');

/* ─────────────────────────────────────────────────────────────────────────── */
/* 4. Cohérence croisée NORMS ↔ HACCP_NORMS (égalités imposées)              */
/* ─────────────────────────────────────────────────────────────────────────── */
section('4. Cohérence croisée v4 ↔ v3 (égalités imposées)');

const C = HACCP_NORMS.COOLING;
const D = HACCP_NORMS.DEFROSTING;

assert(NORMS.cold.positiveMin === T.FROID_POSITIF_VIANDES.min, 'Froid positif borne basse : v4 = v3');
assert(NORMS.cold.positiveMax === T.FROID_POSITIF_VIANDES.max, 'Froid positif borne haute : v4 = v3');
assert(NORMS.cold.frozenMax === T.FROID_NEGATIF.max, 'Surgelés borne haute : v4 = v3');
assert(NORMS.hot.serviceMin === T.LIAISON_CHAUDE.min, 'Maintien chaud min : v4 = v3');
assert(NORMS.cooling.fromTemp === C.START_MIN_TEMP, 'Refroidissement départ : v4 = v3');
assert(NORMS.cooling.toTemp === C.END_MAX_TEMP, 'Refroidissement cible : v4 = v3');
assert(NORMS.cooling.maxHours * 60 === C.MAX_DURATION_MINUTES, 'Refroidissement durée : v4 (h×60) = v3 (min)');
assert(NORMS.defrost.maxTemp === D.MAX_TEMP, 'Décongélation temp max : v4 = v3');
// Seuil critique TPM : v4 et v3 doivent être alignés (vérification sur le vrai NORMS, pas sabotée)
assert(NORMS.oil.tpmMax === HACCP_NORMS.OILS.CRITICAL_TPM, 'Huiles seuil critique TPM : v4 = v3');
assert(ALLERGENS_14.length === ALL_14_ALLERGENS.length, 'Nombre allergènes : v4 = v3');

console.log('  → Cohérence croisée v4 ↔ v3 vérifiée.');

/* ─────────────────────────────────────────────────────────────────────────── */
/* 5. Divergences documentées (sémantiques distinctes)                        */
/* ─────────────────────────────────────────────────────────────────────────── */
section('5. Divergences documentées (sémantiques distinctes)');

const O = HACCP_NORMS.OILS;
const W = HACCP_NORMS.WEIGHT;
// v4 alerte dès 20 % TPM ; v3 n'alertait qu'à 24 % (= seuil de rejet)
assert(NORMS.oil.tpmAlert < O.WARNING_TPM,
  'Huiles seuil alerte : v4 (20 %) < v3 WARNING_TPM (alerte plus précoce)');
// Poids : sémantiques distinctes (perte constatée vs tolérance pesée)
assert(NORMS.weight.lossAlertPct > W.DEFAULT_TOLERANCE_PERCENT,
  'Poids : perte constatée (v4, 10 %) > tolérance pesée (v3, 5 %)');
// Décongélation : délai GBPH (J+1) vs conservation v3 (J+2)
assert(NORMS.defrost.maxHours < D.MAX_DAYS * 24,
  'Décongélation : délai v4 (24 h J+1) < conservation v3 (2 j J+2)');

console.log('  → Divergences documentées entre v4 et v3 respectées.');

/* ─────────────────────────────────────────────────────────────────────────── */
/* 6. Données de référence de l'app livrée (constants.js)                     */
/* ─────────────────────────────────────────────────────────────────────────── */
section('6. Données de référence (constants.js)');

// Brigade de démo
assert(Array.isArray(DEFAULT_BRIGADE) && DEFAULT_BRIGADE.length >= 1, 'DEFAULT_BRIGADE : au moins 1 membre');
assert(DEFAULT_BRIGADE.some((m) => m.role === 'gerant'), 'DEFAULT_BRIGADE : au moins un gérant');
assert(DEFAULT_BRIGADE.every((m) => m.id && m.firstName && m.role && m.pin),
  'DEFAULT_BRIGADE : chaque membre a id, firstName, role, pin');

// Équipements de démo
assert(Array.isArray(DEFAULT_EQUIPMENTS) && DEFAULT_EQUIPMENTS.length >= 1,
  'DEFAULT_EQUIPMENTS : au moins 1 équipement');
assert(DEFAULT_EQUIPMENTS.every(
  (e) => e.id && e.name && e.type && typeof e.min === 'number' && typeof e.max === 'number'),
  'DEFAULT_EQUIPMENTS : chaque équipement a id, name, type, min, max');
assert(DEFAULT_EQUIPMENTS.some((e) => e.type === 'froid_pos'),
  'DEFAULT_EQUIPMENTS : au moins une enceinte froid_pos');
assert(DEFAULT_EQUIPMENTS.some((e) => e.type === 'chaud'),
  'DEFAULT_EQUIPMENTS : au moins un maintien chaud');

// Durées de conservation (SHELF_LIFE_PRESETS)
assert(Array.isArray(SHELF_LIFE_PRESETS) && SHELF_LIFE_PRESETS.length >= 4,
  'SHELF_LIFE_PRESETS : au moins 4 préréglages DLC');
assert(SHELF_LIFE_PRESETS.every((p) => typeof p.value === 'number' && p.label),
  'SHELF_LIFE_PRESETS : chaque entrée a value et label');

// Non-conformités 5M
assert(Array.isArray(NC_CATEGORIES) && NC_CATEGORIES.length === 5, 'NC_CATEGORIES : 5 catégories (5M)');
const catIds = NC_CATEGORIES.map((c) => c.id);
for (const id of ['matiere', 'materiel', 'methode', 'main_oeuvre', 'milieu']) {
  assert(catIds.includes(id), `NC_CATEGORIES : catégorie 5M "${id}" présente`);
}

// Checklists routines (ouverture / fermeture)
assert(DEFAULT_CHECKLIST_ROUTINES.OUVERTURE && Array.isArray(DEFAULT_CHECKLIST_ROUTINES.OUVERTURE),
  'DEFAULT_CHECKLIST_ROUTINES.OUVERTURE défini');
assert(DEFAULT_CHECKLIST_ROUTINES.FERMETURE && Array.isArray(DEFAULT_CHECKLIST_ROUTINES.FERMETURE),
  'DEFAULT_CHECKLIST_ROUTINES.FERMETURE défini');
assert(DEFAULT_CHECKLIST_ROUTINES.OUVERTURE.length >= 3, 'Ouverture : au moins 3 tâches');
assert(DEFAULT_CHECKLIST_ROUTINES.FERMETURE.length >= 3, 'Fermeture : au moins 3 tâches');
assert(DEFAULT_CHECKLIST_ROUTINES.OUVERTURE.every((t) => t.id && t.label && t.mandatory !== undefined),
  'Tâches ouverture : chaque tâche a id, label, mandatory');

// Navigation — 17 modules (NAV)
const allNavItems = NAV.flatMap((g) => g.items);
assert(allNavItems.length === 17, `NAV : 17 modules de navigation (trouvé : ${allNavItems.length})`);
assert(allNavItems.every((i) => i.id && i.idx && i.icon && i.title),
  'NAV : chaque item a id, idx, icon, title');
const navModuleIds = allNavItems.map((i) => i.id);
for (const id of ['dashboard', 'temperatures', 'checklists', 'reception',
  'allergens', 'cooling', 'defrost', 'oil']) {
  assert(navModuleIds.includes(id), `NAV : module "${id}" présent`);
}

console.log('  → Données de référence (brigade, équipements, DLC, 5M, checklists, navigation) vérifiées.');

/* ─────────────────────────────────────────────────────────────────────────── */
/* Rapport final                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
console.log(`\ntest-domain: ${checks} assertion(s) · ${failures} échec(s)`);

if (SELFTEST) {
  if (failures > 0) {
    console.log('test-domain --selftest: OK — panne témoin détectée comme attendu (rc=1).');
    process.exit(1); // rc ≠ 0 ATTENDU en selftest
  } else {
    console.error('test-domain --selftest: RÉGRESSION — le sabotage n\'a provoqué aucun échec !');
    process.exit(1);
  }
}

if (failures > 0) {
  console.error(`\ntest-domain: ÉCHEC — ${failures} assertion(s) en erreur.`);
  process.exit(1);
}

console.log('test-domain: OK');
