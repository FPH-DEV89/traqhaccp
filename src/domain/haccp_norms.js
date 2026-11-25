/**
 * TraqHACCP Pro — Seuils réglementaires HACCP
 * Source unique et documentée des valeurs normatives.
 * Couche Domaine — aucune dépendance externe, aucun accès DOM / localStorage.
 *
 * Références réglementaires :
 *   - Règlement (CE) n° 852/2004 du Parlement européen (hygiène des denrées)
 *   - Arrêté du 21 décembre 2009 relatif aux règles sanitaires des activités de
 *     commerce de détail, de restauration et de remise directe
 *   - Règlement (UE) n° 1169/2011 (INCO) sur l'information des consommateurs (allergènes)
 *   - Note de service DGAL/SDSSA/2010-8075 (refroidissement rapide)
 */

/**
 * Objet gelé des seuils réglementaires.
 * Les valeurs proviennent de index.html v3 lorsqu'elles concordent avec la réglementation.
 * Tout écart est signalé en commentaire.
 */
export const NORMS = Object.freeze({
  /**
   * Températures des enceintes froides positives (denrées réfrigérées).
   * source: Arrêté 21/12/2009, art. 4 — viandes, crémerie, produits laitiers : 0 °C à +4 °C
   */
  cold: Object.freeze({
    positiveMin:  0,   // °C — limite basse de l'enceinte froide positive
    positiveMax:  4,   // °C — limite haute réglementaire (viandes, produits laitiers)
    frozenMax:   -18,  // °C — température maximale pour les surgelés (source: Directive 89/108/CE + Décret 64-949)
    vegetableMax: 6,   // °C — légumes et fruits (tolérance élargie, source: Arrêté 21/12/2009)
    label: 'Enceintes froides',
  }),

  /**
   * Maintien au chaud des plats cuisinés en liaison chaude.
   * source: Arrêté 21/12/2009, art. 26 — maintien ≥ 63 °C obligatoire
   */
  hot: Object.freeze({
    serviceMin: 63,  // °C — température minimale de maintien au chaud
    label: 'Maintien au chaud',
  }),

  /**
   * Refroidissement rapide : de 63 °C à 10 °C maximum en 2 heures.
   * source: Note de service DGAL/SDSSA/2010-8075 (§ 3.2) et arrêté 21/12/2009, art. 26
   * Valeur v3 : 63 → 10 °C en 2 h — conforme à la réglementation, conservée.
   */
  cooling: Object.freeze({
    fromTemp: 63,   // °C — température de départ (sortie cuisson)
    toTemp:   10,   // °C — température cible en fin de cellule de refroidissement
    maxHours:  2,   // heures — durée maximale réglementaire
    label: 'Refroidissement rapide',
  }),

  /**
   * Décongélation en enceinte réfrigérée.
   * source: Arrêté 21/12/2009, art. 27 — décongélation obligatoire ≤ +4 °C
   * Note: v3 utilisait MAX_DAYS = 2 (consommation J+2). La réglementation impose +4 °C max ;
   * la durée J+2 est un guide de bonne pratique (GBPH), conservé pour cohérence.
   */
  defrost: Object.freeze({
    maxTemp:  4,   // °C — température maximale de décongélation
    maxHours: 24,  // heures — délai de consommation recommandé après sortie (GBPH, J+1)
    label: 'Décongélation',
  }),

  /**
   * Huiles de friture — teneur en composés polaires totaux (TPM).
   * source: Arrêté du 26 juin 1986 modifié — seuil légal 25 % TPM (rejet obligatoire)
   * Note: v3 utilisait CRITICAL_TPM = 24 % — plus strict que la loi, conservé comme seuil d'alerte.
   */
  oil: Object.freeze({
    tpmMax:     24,  // % TPM — seuil maximal (rejet de l'huile obligatoire)
    tpmAlert:   20,  // % TPM — seuil d'alerte (surveillance renforcée recommandée)
    restHours:   8,  // heures — durée de repos recommandée avant analyse TPM
    label: 'Huiles de friture',
  }),

  /**
   * Contrôle du pH (riz à sushi, marinades, conserves).
   * source: GBPH Restauration — pH stabilisateur barrière botulique < 4,5
   */
  ph: Object.freeze({
    min: 2,  // pH — valeur minimale mesurable (acidité forte)
    max: 7,  // pH — valeur maximale (neutralité alimentaire courante)
    label: 'pH',
  }),

  /**
   * Contrôle du poids — tolérance de portionnement.
   * source: pratique interne (GBPH Restauration) — pas de seuil réglementaire strict.
   */
  weight: Object.freeze({
    lossAlertPct: 10,  // % — seuil d'alerte de perte au portionnement
    label: 'Pertes au poids',
  }),

  /**
   * Fréquences de nettoyage disponibles dans le plan de nettoyage.
   * source: GBPH Restauration — fréquences minimales selon la zone.
   */
  cleaning: Object.freeze({
    frequencies: Object.freeze([
      'Chaque service',
      'Quotidien',
      'Hebdomadaire',
      'Mensuel',
      'Trimestriel',
    ]),
  }),

  /**
   * Durée de conservation réglementaire des enregistrements HACCP.
   * source: Règlement (CE) n° 852/2004, annexe II, chapitre IX — 3 ans minimum.
   */
  retentionYears: 3,
});

/**
 * Les 14 allergènes réglementaires (INCO).
 * source: Règlement (UE) n° 1169/2011, annexe II — libellés français officiels.
 * @type {Array<{ id: string, label: string, short: string }>}
 */
export const ALLERGENS_14 = Object.freeze([
  { id: 'gluten',      label: 'Céréales contenant du gluten (blé, seigle, orge, avoine…)', short: 'Gluten' },
  { id: 'crustaces',   label: 'Crustacés et produits à base de crustacés',                 short: 'Crustacés' },
  { id: 'oeufs',       label: 'Œufs et produits à base d\'œufs',                           short: 'Œufs' },
  { id: 'poissons',    label: 'Poissons et produits à base de poissons',                   short: 'Poissons' },
  { id: 'arachides',   label: 'Arachides et produits à base d\'arachides',                 short: 'Arachides' },
  { id: 'soja',        label: 'Soja et produits à base de soja',                           short: 'Soja' },
  { id: 'lait',        label: 'Lait et produits laitiers (dont lactose)',                   short: 'Lait' },
  { id: 'fruits_coque',label: 'Fruits à coque (amandes, noisettes, noix, noix de cajou…)', short: 'Fruits à coque' },
  { id: 'celeri',      label: 'Céleri et produits à base de céleri',                       short: 'Céleri' },
  { id: 'moutarde',    label: 'Moutarde et produits à base de moutarde',                   short: 'Moutarde' },
  { id: 'sesame',      label: 'Graines de sésame et produits à base de graines de sésame', short: 'Sésame' },
  { id: 'sulfites',    label: 'Anhydride sulfureux et sulfites (> 10 mg/kg ou 10 mg/L)',   short: 'Sulfites' },
  { id: 'lupin',       label: 'Lupin et produits à base de lupin',                         short: 'Lupin' },
  { id: 'mollusques',  label: 'Mollusques et produits à base de mollusques',               short: 'Mollusques' },
]);

/**
 * Retourne l'objet de norme pour une clé donnée, ou null si la clé est inconnue.
 * @param {string} key
 * @returns {object|null}
 */
export function normFor(key) {
  return Object.prototype.hasOwnProperty.call(NORMS, key) ? NORMS[key] : null;
}
