/**
 * TraqHACCP Pro — Constantes du Domaine
 * Réglementation Sanitaire Européenne & Française (CE 852/2004, CE 178/2002, Décret 2008-184, INCO 1169/2011)
 *
 * Ce fichier est la source unique pour :
 *   - HACCP_NORMS (seuils hérités v3, maintenus pour compatibilité)
 *   - SAN_DOC_CATEGORIES, DEFAULT_CHECKLIST_ROUTINES, ALL_14_ALLERGENS, SHELF_LIFE_PRESETS, NC_CATEGORIES
 *   - NAV — navigation (source de vérité unique pour rail, tabbar, palette)
 *   - DEFAULT_ESTABLISHMENT, DEFAULT_EQUIPMENTS, DEFAULT_BRIGADE, DEFAULT_SETTINGS
 *   - STORAGE_KEYS, APP_VERSION
 */

import { NORMS, ALLERGENS_14 } from './haccp_norms.js';

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS HÉRITÉS v3 — conservés intégralement (ne rien supprimer)
   ═══════════════════════════════════════════════════════════════════ */

export const HACCP_NORMS = {
  TEMPERATURES: {
    FROID_POSITIF_VIANDES: { min: 0.0, max: 4.0, label: 'Froid Positif Viandes / Crémerie (0 °C à +4 °C)' },
    FROID_POSITIF_LEGUMES: { min: 2.0, max: 6.0, label: 'Froid Positif Légumes / Fruits (2 °C à +6 °C)' },
    FROID_NEGATIF: { min: -24.0, max: -18.0, label: 'Surgelés / Grand Froid (≤ -18 °C)' },
    LIAISON_CHAUDE: { min: 63.0, max: 95.0, label: 'Liaison Chaude Maintien (≥ +63 °C)' },
    POISSON_FRAIS: { min: 0.0, max: 2.0, label: 'Poissons et Produits de la Mer (0 °C à +2 °C sous glace fondante)' }
  },
  OILS: {
    OPTIMAL_TPM: 18.0,   // < 18 % TPM : huile saine
    WARNING_TPM: 24.0,   // 18 % à 24 % TPM : huile à surveiller
    CRITICAL_TPM: 24.0   // > 24 % TPM : seuil légal max — rejet obligatoire
  },
  COOLING: {
    START_MIN_TEMP: 63.0,        // T° minimale au début du refroidissement
    END_MAX_TEMP: 10.0,          // T° maximale en fin de cellule
    MAX_DURATION_MINUTES: 120    // règle des 2 heures
  },
  DEFROSTING: {
    MAX_DAYS: 2,    // consommation sous J+2 maximum après sortie du congélateur
    MAX_TEMP: 4.0   // décongélation obligatoire en enceinte réfrigérée (≤ +4 °C)
  },
  PH: {
    SUSHI_RICE:   { max: 4.3, label: 'Riz Vinaigré / Sushi (pH ≤ 4,3 recommandé GBPH)' },
    CANNED_ACID:  { max: 4.5, label: 'Conserves & Bocaux acides (pH < 4,5 barrière botulique)' },
    MARINADES:    { max: 4.2, label: 'Marinades et Sauces stabilisées (pH ≤ 4,2)' },
    NEUTRAL_WATER:{ min: 6.5, max: 8.5, label: 'Eau de réseau / Lavage (pH 6,5 à 8,5)' }
  },
  WEIGHT: {
    DEFAULT_TOLERANCE_PERCENT: 5.0  // tolérance de portionnement standard ±5 %
  }
};

/** @type {Array<{ id: string, label: string, icon: string }>} */
export const SAN_DOC_CATEGORIES = [
  { id: 'formation', label: 'Formation Hygiène HACCP (14 h / Réglementaire)',              icon: 'fa-graduation-cap' },
  { id: 'nuisibles', label: "Bons d'intervention 3D (Dératisation / Désinsectisation)",    icon: 'fa-shield-virus' },
  { id: 'analyses',  label: "Rapports d'analyses microbiologiques (Labo accrédité)",        icon: 'fa-flask-vial' },
  { id: 'eau',       label: "Certificats de potabilité de l'eau",                           icon: 'fa-droplet' },
  { id: 'fds',       label: "Fiches de Données de Sécurité (FDS produits d'entretien)",    icon: 'fa-pump-soap' },
  { id: 'audit',     label: "Rapports d'audits internes / externes",                        icon: 'fa-clipboard-check' },
];

/** Tâches de la checklist d'ouverture et de fermeture (données v3 conservées). */
export const DEFAULT_CHECKLIST_ROUTINES = {
  OUVERTURE: [
    { id: 'ouv-1', label: 'Vérification visuelle et démarrage des chambres froides et meubles froids',             zone: 'Cuisine / Stockage',    mandatory: true },
    { id: 'ouv-2', label: "Contrôle de l'alimentation en eau chaude des postes de plonge et lave-mains",           zone: 'Plonge & Sanitaires',   mandatory: true },
    { id: 'ouv-3', label: 'Vérification du réassort des lave-mains (savon bactéricide + essuie-mains jetables)',    zone: 'Hygiène Personnel',     mandatory: true },
    { id: 'ouv-4', label: 'Contrôle des tenues de travail de la brigade (charlotte/toque, tablier, chaussures)',   zone: 'Hygiène Personnel',     mandatory: true },
    { id: 'ouv-5', label: 'Désinfection préalable des plans de travail et planches avant premier dressage',         zone: 'Préparation',           mandatory: true },
  ],
  FERMETURE: [
    { id: 'fer-1', label: 'Fermeture et coupure sécurisée des vannes de gaz et pianos de cuisson',                 zone: 'Cuisson',               mandatory: true },
    { id: 'fer-2', label: 'Évacuation des poubelles en local déchets et désinfection des bacs',                    zone: 'Plonge & Déchets',      mandatory: true },
    { id: 'fer-3', label: 'Filtrage ou vidange des bacs de friteuses et arrêt des alimentations',                  zone: 'Cuisson',               mandatory: true },
    { id: 'fer-4', label: 'Rangement et filmage étiqueté (DLC) de toutes les préparations en froid positif',       zone: 'Stockage Froid',        mandatory: true },
    { id: 'fer-5', label: 'Verrouillage et vérification de fermeture hermétique des portes des chambres froides',  zone: 'Stockage Froid',        mandatory: true },
  ],
};

/**
 * Les 14 allergènes réglementaires (format v3 — conservé pour compatibilité).
 * Pour les nouvelles vues, utiliser ALLERGENS_14 de haccp_norms.js.
 */
export const ALL_14_ALLERGENS = [
  { id: 'gluten',     name: 'Gluten (blé, seigle, orge, avoine)',            short: 'Gluten',   icon: 'fa-wheat-awn' },
  { id: 'crustaceans',name: 'Crustacés',                                      short: 'Crust.',   icon: 'fa-shrimp' },
  { id: 'eggs',       name: 'Œufs',                                           short: 'Œufs',     icon: 'fa-egg' },
  { id: 'fish',       name: 'Poissons',                                        short: 'Poiss.',   icon: 'fa-fish' },
  { id: 'peanuts',    name: 'Arachides',                                       short: 'Arach.',   icon: 'fa-seedling' },
  { id: 'soy',        name: 'Soja',                                            short: 'Soja',     icon: 'fa-leaf' },
  { id: 'milk',       name: 'Lait (lactose compris)',                          short: 'Lait',     icon: 'fa-cheese' },
  { id: 'nuts',       name: 'Fruits à coque (amandes, noisettes, noix…)',     short: 'F. Coq',   icon: 'fa-bowl-rice' },
  { id: 'celery',     name: 'Céleri',                                          short: 'Céleri',   icon: 'fa-carrot' },
  { id: 'mustard',    name: 'Moutarde',                                        short: 'Mout.',    icon: 'fa-jar' },
  { id: 'sesame',     name: 'Graines de sésame',                               short: 'Sésame',   icon: 'fa-spa' },
  { id: 'sulfites',   name: 'Anhydride sulfureux et sulfites (> 10 mg/kg)',   short: 'Sulfit.',  icon: 'fa-wine-glass' },
  { id: 'lupin',      name: 'Lupin',                                           short: 'Lupin',    icon: 'fa-cannabis' },
  { id: 'molluscs',   name: 'Mollusques',                                      short: 'Moll.',    icon: 'fa-droplet' },
];

/** @type {Array<{ value: number, label: string }>} */
export const SHELF_LIFE_PRESETS = [
  { value: 1, label: 'J+1 (Préparations ultra-sensibles, crèmes crues, steak haché)' },
  { value: 2, label: 'J+2 (Poissons crus, marinades, viandes décongelées)' },
  { value: 3, label: 'J+3 (Standard cuisiné traiteur, sauces cuites, fonds)' },
  { value: 5, label: 'J+5 (Semi-conserve pasteurisée sous-vide validée)' },
];

/** @type {Array<{ id: string, label: string }>} */
export const NC_CATEGORIES = [
  { id: 'matiere',     label: 'Matière Première / Denrée' },
  { id: 'materiel',    label: 'Matériel / Équipement' },
  { id: 'methode',     label: 'Méthode / Procédure' },
  { id: 'main_oeuvre', label: "Main-d'œuvre / Pratique Hygiène" },
  { id: 'milieu',      label: 'Milieu / Environnement / Locaux' },
];

/* ═══════════════════════════════════════════════════════════════════
   NAVIGATION — source de vérité unique (ARCHITECTURE.md §3)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Structure de navigation complète.
 * 3 groupes, 17 modules, index 01 à 17.
 * Utilisée par le rail, la tabbar mobile, la palette ⌘K et les fils d'Ariane.
 * @type {Array<{ group: string, items: Array<{ id: string, idx: string, icon: string, title: string, desc: string }> }>}
 */
export const NAV = [
  { group: 'Registre', items: [
    { id: 'dashboard',       idx: '01', icon: 'dashboard',   title: 'Tableau de bord',      desc: "Vue d'ensemble du jour" },
    { id: 'checklists',      idx: '02', icon: 'clipboard',   title: 'Checklists',           desc: 'Ouverture et fermeture de service' },
    { id: 'temperatures',    idx: '03', icon: 'thermometer', title: 'Températures',         desc: 'Relevés des enceintes froides et chaudes' },
    { id: 'reception',       idx: '04', icon: 'truck',       title: 'Réception',            desc: 'Contrôle marchandises et agréments' },
    { id: 'traceability',    idx: '05', icon: 'tag',         title: 'DLC et traçabilité',   desc: 'Étiquetage, décongélation, préparations' },
    { id: 'allergens',       idx: '06', icon: 'wheat',       title: 'Allergènes',           desc: 'Matrice INCO des 14 allergènes' },
    { id: 'cleaning',        idx: '07', icon: 'spray',       title: 'Plan de nettoyage',    desc: 'Tâches, fréquences et validation' },
    { id: 'oil',             idx: '08', icon: 'droplet',     title: 'Huiles de friture',    desc: 'TPM, filtration et mise au repos' },
    { id: 'cooling',         idx: '09', icon: 'snowflake',   title: 'Refroidissement',      desc: 'Cycle 63 °C → 10 °C en 2 h' },
    { id: 'defrost',         idx: '10', icon: 'flame',       title: 'Décongélation',        desc: 'Cycles et températures de décongélation' },
    { id: 'ph-weight',       idx: '11', icon: 'scale',       title: 'pH et poids',          desc: 'Contrôles spécialisés' },
    { id: 'documents',       idx: '12', icon: 'folder',      title: 'Documents sanitaires', desc: 'GED : agréments, HACCP, contrats' },
    { id: 'nonconformities', idx: '13', icon: 'alert',       title: 'Non-conformités',      desc: 'Écarts, actions correctives et clôture' },
  ]},
  { group: 'Contrôle officiel', items: [
    { id: 'audit',           idx: '14', icon: 'seal',        title: 'Registre DDPP',        desc: 'Registre officiel consolidé' },
    { id: 'ddpp-inspection', idx: '15', icon: 'shield',      title: 'Mode inspection',      desc: 'Consultation lecture seule' },
  ]},
  { group: 'Administration', items: [
    { id: 'compte',          idx: '16', icon: 'users',       title: 'Compte',          desc: 'Fiche établissement, utilisateurs, rôles' },
    { id: 'reglages',        idx: '17', icon: 'settings',    title: 'Réglages',             desc: 'Normes, équipements, préférences, sauvegardes' },
  ]},
];

/* ═══════════════════════════════════════════════════════════════════
   DONNÉES DE DÉMONSTRATION CRÉDIBLES (DESIGN.md §9)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Établissement de démonstration — données fictives mais vraisemblables.
 * Source : DESIGN.md §9. Aucune donnée client réelle.
 */
export const DEFAULT_ESTABLISHMENT = {
  name:      'Le Comptoir des Halles',
  activity:  'Restaurant traditionnel — cuisine sur place',
  siret:     '812 447 093 00041',
  address:   '14 rue des Halles',
  postal:    '26000',
  city:      'Valence',
  phone:     '04 75 42 18 06',
  email:     'contact@comptoir-des-halles.fr',
  manager:   'Amélie Ferrand',
  agreement: 'FR 26 118 0042',
  seats:     48,
  openedYear:2019,
};

/**
 * Équipements de démonstration — 8 appareils d'un restaurant traditionnel.
 * @type {Array<{ id: string, name: string, type: string, min: number, max: number, location: string, active: boolean }>}
 */
export const DEFAULT_EQUIPMENTS = [
  { id: 'eq-1', name: 'Chambre froide positive',    type: 'froid_pos', min:  0,   max:  4,  location: 'Réserve',        active: true },
  { id: 'eq-2', name: 'Armoire réfrigérée positive', type: 'froid_pos', min:  0,   max:  4,  location: 'Cuisine chaude', active: true },
  { id: 'eq-3', name: 'Congélateur négatif',         type: 'froid_neg', min: -22,  max: -18, location: 'Réserve',        active: true },
  { id: 'eq-4', name: 'Vitrine pâtissière',           type: 'froid_pos', min:  0,   max:  4,  location: 'Pâtisserie',     active: true },
  { id: 'eq-5', name: 'Cellule de refroidissement',  type: 'froid_pos', min: -2,   max:  4,  location: 'Cuisine chaude', active: true },
  { id: 'eq-6', name: 'Bain-marie de service',        type: 'chaud',     min: 63,   max: 90,  location: 'Cuisine chaude', active: true },
  { id: 'eq-7', name: 'Armoire chauffante',           type: 'chaud',     min: 63,   max: 80,  location: 'Cuisine chaude', active: true },
  { id: 'eq-8', name: 'Chambre froide légumes',       type: 'froid_pos', min:  2,   max:  6,  location: 'Réserve',        active: true },
];

/**
 * Brigade de démonstration — 4 membres avec rôles v4 complets.
 * Nommage : DESIGN.md §9. Un seul gérant actif obligatoire.
 * @type {Array<{ id: string, firstName: string, lastName: string, short: string, initials: string, role: string, pin: string, active: boolean, createdAt: string }>}
 */
export const DEFAULT_BRIGADE = [
  {
    id: 'op-1',
    firstName: 'Amélie',
    lastName:  'Ferrand',
    short:     'Amélie',
    initials:  'AF',
    role:      'gerant',
    pin:       '7391',
    active:    true,
    createdAt: '2019-03-15T08:00:00.000Z',
  },
  {
    id: 'op-2',
    firstName: 'Karim',
    lastName:  'Bouziane',
    short:     'Karim',
    initials:  'KB',
    role:      'responsable',
    pin:       '5284',
    active:    true,
    createdAt: '2020-06-01T08:00:00.000Z',
  },
  {
    id: 'op-3',
    firstName: 'Léa',
    lastName:  'Marcotte',
    short:     'Léa',
    initials:  'LM',
    role:      'operateur',
    pin:       '8163',
    active:    true,
    createdAt: '2021-09-12T08:00:00.000Z',
  },
  {
    id: 'op-4',
    firstName: 'Tom',
    lastName:  'Rivière',
    short:     'Tom',
    initials:  'TR',
    role:      'operateur',
    pin:       '4729',
    active:    true,
    createdAt: '2022-02-07T08:00:00.000Z',
  },
];

/**
 * Réglages par défaut de l'application.
 * Les seuils normatifs proviennent directement de haccp_norms.js (source unique).
 */
export const DEFAULT_SETTINGS = {
  theme:               'papier',
  density:             'confortable',
  sounds:              true,
  autoLockMinutes:     15,
  tempUnit:            'C',
  establishment:       DEFAULT_ESTABLISHMENT,
  norms:               NORMS,
  allergens:           ALLERGENS_14,
  backupReminderDays:  7,
};

/* ═══════════════════════════════════════════════════════════════════
   CLÉS LOCALSTORAGE — source unique (aucune migration nécessaire)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Clés de stockage localStorage utilisées dans toute l'application.
 * Les clés v3 sont conservées telles quelles pour éviter toute migration de données.
 */
export const STORAGE_KEYS = {
  // Données métier (clés v3 — ne pas modifier)
  equipments:        'traq_equipments',
  deliveries:        'traq_deliveries',
  preparations:      'traq_preparations',
  allergens:         'traq_allergens',
  cleaning:          'traq_cleaning',
  fryers:            'traq_fryers',
  cooling:           'traq_cooling',
  defrost:           'traq_defrost',
  ph:                'traq_ph',
  weight:            'traq_weight',
  documents:         'traq_documents',
  nonconformities:   'traq_nonconformities',
  checklists:        'traq_checklists',
  // Nouvelles clés v4
  brigade:           'traq_brigade',
  settings:          'traq_settings',
  session:           'traq_session',
  activityLog:       'traq_activity_log',
};

/* ═══════════════════════════════════════════════════════════════════
   VERSION
   ═══════════════════════════════════════════════════════════════════ */

/** Version de l'application — format incrémental. */
export const APP_VERSION = '4.0-registre';
