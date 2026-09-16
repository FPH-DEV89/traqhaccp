/**
 * TraqHACCP Pro - Domain Constants
 * Réglementation Sanitaire Européenne & Française (CE 852/2004, CE 178/2002, Décret 2008-184, INCO 1169/2011)
 */

export const HACCP_NORMS = {
  TEMPERATURES: {
    FROID_POSITIF_VIANDES: { min: 0.0, max: 4.0, label: 'Froid Positif Viandes / Crémerie (0°C à +4°C)' },
    FROID_POSITIF_LEGUMES: { min: 2.0, max: 6.0, label: 'Froid Positif Légumes / Fruits (2°C à +6°C)' },
    FROID_NEGATIF: { min: -24.0, max: -18.0, label: 'Surgelés / Grand Froid (≤ -18°C)' },
    LIAISON_CHAUDE: { min: 63.0, max: 95.0, label: 'Liaison Chaude Maintien (≥ +63°C)' },
    POISSON_FRAIS: { min: 0.0, max: 2.0, label: 'Poissons et Produits de la Mer (0°C à +2°C sous glace fondante)' }
  },
  OILS: {
    OPTIMAL_TPM: 18.0, // < 18% TPM : Huile saine
    WARNING_TPM: 24.0, // 18% à 24% TPM : Huile à surveiller
    CRITICAL_TPM: 24.0 // > 24% TPM : Seuil légal max de composés polaires (rejet obligatoire)
  },
  COOLING: {
    START_MIN_TEMP: 63.0, // T° minimale au début du refroidissement
    END_MAX_TEMP: 10.0,   // T° maximale en fin de cellule
    MAX_DURATION_MINUTES: 120 // Règle des 2 heures
  },
    DEFROSTING: {
    MAX_DAYS: 2, // Consommation sous J+2 maximum après sortie du congélateur
    MAX_TEMP: 4.0 // Décongélation obligatoire en enceinte réfrigérée (≤ +4°C)
  },
  PH: {
    SUSHI_RICE: { max: 4.3, label: 'Riz Vinaigré / Sushi (pH ≤ 4.3 recommandé GBPH)' },
    CANNED_ACID: { max: 4.5, label: 'Conserves & Bocaux acides (pH < 4.5 barrière botulique Cl. botulinum)' },
    MARINADES: { max: 4.2, label: 'Marinades et Sauces stabilisées (pH ≤ 4.2)' },
    NEUTRAL_WATER: { min: 6.5, max: 8.5, label: 'Eau de réseau / Lavage (pH 6.5 à 8.5)' }
  },
  WEIGHT: {
    DEFAULT_TOLERANCE_PERCENT: 5.0 // Tolérance de portionnement standard ±5%
  }
};

export const SAN_DOC_CATEGORIES = [
  { id: 'formation', label: 'Formation Hygiène HACCP (14h / Réglementaire)', icon: 'fa-graduation-cap' },
  { id: 'nuisibles', label: 'Bons d\'intervention 3D (Dératisation / Désinsectisation)', icon: 'fa-shield-virus' },
  { id: 'analyses', label: 'Rapports d\'analyses microbiologiques (Labo accrédité)', icon: 'fa-flask-vial' },
  { id: 'eau', label: 'Certificats de potabilité de l\'eau', icon: 'fa-droplet' },
  { id: 'fds', label: 'Fiches de Données de Sécurité (FDS produits d\'entretien)', icon: 'fa-pump-soap' },
  { id: 'audit', label: 'Rapports d\'audits internes / externes', icon: 'fa-clipboard-check' }
];

export const DEFAULT_CHECKLIST_ROUTINES = {
  OUVERTURE: [
    { id: 'ouv-1', label: 'Vérification visuelle et démarrage des chambres froides et meubles froids', zone: 'Cuisine / Stockage', mandatory: true },
    { id: 'ouv-2', label: 'Contrôle de l\'alimentation en eau chaude des postes de plonge et lave-mains', zone: 'Plonge & Sanitaires', mandatory: true },
    { id: 'ouv-3', label: 'Vérification du réassort des lave-mains (savon bactéricide + essuie-mains jetables)', zone: 'Hygiène Personnel', mandatory: true },
    { id: 'ouv-4', label: 'Contrôle des tenues de travail de la brigade (charlotte/toque, tablier, chaussures sécu)', zone: 'Hygiène Personnel', mandatory: true },
    { id: 'ouv-5', label: 'Désinfection préalable des plans de travail et planches avant premier dressage', zone: 'Préparation', mandatory: true }
  ],
  FERMETURE: [
    { id: 'fer-1', label: 'Fermeture et coupure sécurisée des vannes de gaz et pianos de cuisson', zone: 'Cuisson', mandatory: true },
    { id: 'fer-2', label: 'Évacuation des poubelles en local déchets et désinfection des bacs', zone: 'Plonge & Déchets', mandatory: true },
    { id: 'fer-3', label: 'Filtrage ou vidange des bacs de friteuses et arrêt des alimentations', zone: 'Cuisson', mandatory: true },
    { id: 'fer-4', label: 'Rangement et filmage étiqueté (DLC) de toutes les préparations en froid positif', zone: 'Stockage Froid', mandatory: true },
    { id: 'fer-5', label: 'Verrouillage et vérification de fermeture hermétique des portes des chambres froides', zone: 'Stockage Froid', mandatory: true }
  ]
};

export const ALL_14_ALLERGENS = [
  { id: 'gluten', name: 'Gluten (blé, seigle, orge, avoine)', short: 'Gluten', icon: 'fa-wheat-awn' },
  { id: 'crustaceans', name: 'Crustacés', short: 'Crust.', icon: 'fa-shrimp' },
  { id: 'eggs', name: 'Œufs', short: 'Œufs', icon: 'fa-egg' },
  { id: 'fish', name: 'Poissons', short: 'Poiss.', icon: 'fa-fish' },
  { id: 'peanuts', name: 'Arachides', short: 'Arach.', icon: 'fa-seedling' },
  { id: 'soy', name: 'Soja', short: 'Soja', icon: 'fa-leaf' },
  { id: 'milk', name: 'Lait (lactose compris)', short: 'Lait', icon: 'fa-cheese' },
  { id: 'nuts', name: 'Fruits à coque (amandes, noisettes, noix...)', short: 'F. Coq', icon: 'fa-bowl-rice' },
  { id: 'celery', name: 'Céleri', short: 'Céleri', icon: 'fa-carrot' },
  { id: 'mustard', name: 'Moutarde', short: 'Mout.', icon: 'fa-jar' },
  { id: 'sesame', name: 'Graines de sésame', short: 'Sésame', icon: 'fa-spa' },
  { id: 'sulfites', name: 'Anhydride sulfureux et sulfites (>10mg/kg)', short: 'Sulfit.', icon: 'fa-wine-glass' },
  { id: 'lupin', name: 'Lupin', short: 'Lupin', icon: 'fa-cannabis' },
  { id: 'molluscs', name: 'Mollusques', short: 'Moll.', icon: 'fa-droplet' }
];

export const SHELF_LIFE_PRESETS = [
  { value: 1, label: 'J+1 (Préparations ultra-sensibles, crèmes crues, steak haché)' },
  { value: 2, label: 'J+2 (Poissons crus, marinades, viandes décongelées)' },
  { value: 3, label: 'J+3 (Standard cuisiné traiteur, sauces cuites, fonds)' },
  { value: 5, label: 'J+5 (Semi-conserve pasteurisée sous-vide validée)' }
];

export const NC_CATEGORIES = [
  { id: 'matiere', label: 'Matière Première / Denrée' },
  { id: 'materiel', label: 'Matériel / Équipement' },
  { id: 'methode', label: 'Méthode / Procédure' },
  { id: 'main_oeuvre', label: 'Main-d\'œuvre / Pratique Hygiène' },
  { id: 'milieu', label: 'Milieu / Environnement / Locaux' }
];

export const DEFAULT_BRIGADE = [
  { id: 'op-1', name: "Chef Thomas (Responsable HACCP)", short: "Chef Thomas", pin: "1234", role: "Chef de Cuisine / Resp. Qualité" },
  { id: 'op-2', name: "Marie D. (Second de Cuisine)", short: "Marie D.", pin: "2345", role: "Second de Cuisine" },
  { id: 'op-3', name: "Lucas B. (Commis Cuisine)", short: "Lucas B.", pin: "3456", role: "Commis de Cuisine" },
  { id: 'op-4', name: "Sarah M. (Chef Pâtisserie)", short: "Sarah M.", pin: "4567", role: "Chef Pâtissière" }
];

