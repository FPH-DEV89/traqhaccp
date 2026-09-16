#!/usr/bin/env node
/**
 * check-norms-consistency.mjs — Cohérence des seuils sanitaires (spec FIN §6).
 *
 * Deux jeux de constantes coexistent volontairement :
 *   - `NORMS` (src/domain/haccp_norms.js) : source unique documentée, utilisée par les vues v4 ;
 *   - `HACCP_NORMS` (src/domain/constants.js) : exports hérités v3, conservés pour compatibilité
 *     (`test_clean_arch.js` s'y réfère).
 *
 * Ce contrôle vérifie que :
 *   1. toutes les valeurs que les deux jeux DOIVENT partager sont identiques (EGALITES) ;
 *   2. les écarts connus et justifiés restent exactement ceux documentés ici (DIVERGENCES) —
 *      toute harmonisation silencieuse doit donc être assumée dans ce fichier et dans les
 *      commentaires de src/domain/haccp_norms.js.
 * Sortie : rapport. Exit 1 au moindre écart.
 */
import { NORMS, ALLERGENS_14 } from '../src/domain/haccp_norms.js';
import { HACCP_NORMS, ALL_14_ALLERGENS } from '../src/domain/constants.js';

const T = HACCP_NORMS.TEMPERATURES;
const O = HACCP_NORMS.OILS;
const C = HACCP_NORMS.COOLING;
const D = HACCP_NORMS.DEFROSTING;
const W = HACCP_NORMS.WEIGHT;

/** Valeurs devant être strictement identiques dans les deux jeux. */
const EGALITES = [
  ['Froid positif — borne basse',      NORMS.cold.positiveMin,      T.FROID_POSITIF_VIANDES.min],
  ['Froid positif — borne haute',      NORMS.cold.positiveMax,      T.FROID_POSITIF_VIANDES.max],
  ['Froid positif légumes — borne haute', NORMS.cold.vegetableMax,  T.FROID_POSITIF_LEGUMES.max],
  ['Surgelés — borne haute',           NORMS.cold.frozenMax,        T.FROID_NEGATIF.max],
  ['Maintien au chaud — minimum',      NORMS.hot.serviceMin,        T.LIAISON_CHAUDE.min],
  ['Refroidissement — départ',         NORMS.cooling.fromTemp,      C.START_MIN_TEMP],
  ['Refroidissement — cible',          NORMS.cooling.toTemp,        C.END_MAX_TEMP],
  ['Refroidissement — durée (min)',    NORMS.cooling.maxHours * 60, C.MAX_DURATION_MINUTES],
  ['Décongélation — température max',  NORMS.defrost.maxTemp,       D.MAX_TEMP],
  ['Huiles — seuil critique TPM',      NORMS.oil.tpmMax,            O.CRITICAL_TPM],
  ['Allergènes INCO — nombre',         ALLERGENS_14.length,         ALL_14_ALLERGENS.length],
];

/**
 * Écarts assumés entre le référentiel v4 et les exports hérités v3.
 * `relation(valorV4, valeurV3)` doit rester vraie tant que le commentaire qui justifie l'écart
 * est en place ; sinon, aligner les valeurs et mettre à jour cette table.
 */
const DIVERGENCES = [
  {
    quoi: 'Huiles — seuil d\'alerte TPM',
    valorV4: NORMS.oil.tpmAlert, valeurV3: O.WARNING_TPM,
    relation: (v4, v3) => v4 < v3,
    pourquoi: 'v4 alerte dès 20 % TPM (surveillance renforcée précoce) ; v3 n\'alertait qu\'à 24 %, '
      + 'soit le seuil de rejet légal — confondre alerte et rejet supprimait toute marge d\'action.',
  },
  {
    quoi: 'Poids — perte au portionnement',
    valorV4: NORMS.weight.lossAlertPct, valeurV3: W.DEFAULT_TOLERANCE_PERCENT,
    relation: (v4, v3) => v4 > v3,
    pourquoi: 'sémantiques distinctes : v4 mesure la perte constatée au portionnement (alerte à 10 %), '
      + 'v3 la tolérance de pesée d\'un équipement (± 5 %).',
  },
  {
    quoi: 'Décongélation — délai après sortie',
    valorV4: NORMS.defrost.maxHours, valeurV3: D.MAX_DAYS * 24,
    relation: (v4, v3) => v4 < v3,
    pourquoi: 'unités et finalités distinctes : v4 recommande la consommation sous 24 h (GBPH J+1), '
      + 'v3 conservait un plafond de conservation de 2 jours (J+2).',
  },
  {
    quoi: 'pH — plage de saisie des aliments',
    valorV4: NORMS.ph.max, valeurV3: HACCP_NORMS.PH.CANNED_ACID.max,
    relation: (v4, v3) => v4 > v3,
    pourquoi: 'v4 borne la saisie des aliments (pH 2 à 7) ; HACCP_NORMS.PH porte des valeurs cibles '
      + 'par famille (sushi ≤ 4,3 ; conserves < 4,5 ; marinades ≤ 4,2). PH.NEUTRAL_WATER (6,5 à 8,5) '
      + 'concerne l\'eau de réseau et sort donc volontairement de la plage alimentaire.',
  },
];

const echecs = [];
for (const [quoi, v4, v3] of EGALITES) {
  if (typeof v4 !== 'number' || typeof v3 !== 'number' || Number.isNaN(v4) || Number.isNaN(v3)) {
    echecs.push(`${quoi} : valeur manquante ou non numérique (v4=${v4}, v3=${v3})`);
  } else if (v4 !== v3) {
    echecs.push(`${quoi} : v4=${v4} ≠ v3=${v3} — aligner src/domain/haccp_norms.js et constants.js`);
  }
}
for (const { quoi, valorV4, valeurV3, relation, pourquoi } of DIVERGENCES) {
  if (!relation(valorV4, valeurV3)) {
    echecs.push(`${quoi} : écart documenté non respecté (v4=${valorV4}, v3=${valeurV3}) — ${pourquoi}`);
  }
}
if (ALLERGENS_14.length !== 14 || ALL_14_ALLERGENS.length !== 14) {
  echecs.push(`Allergènes INCO : ${ALLERGENS_14.length} en v4 / ${ALL_14_ALLERGENS.length} en v3 — 14 attendus`);
}

console.log(`check-norms: ${EGALITES.length} égalité(s) vérifiée(s) · ${DIVERGENCES.length} divergence(s) documentée(s) · exit 1 au moindre écart.`);
if (echecs.length) {
  console.error(`\n${echecs.length} incohérence(s) de seuils :`);
  echecs.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}
console.log('check-norms: OK');
