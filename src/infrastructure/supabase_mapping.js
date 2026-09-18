/**
 * TraqHACCP Pro — Infrastructure — Correspondance camelCase ⇄ snake_case (docs/DATA.md).
 *
 * Le domaine parle camelCase (`truckTemp`, `ppeRequired`, `category5M`), PostgreSQL parle
 * snake_case (`truck_temp`, `ppe_required`, `category_5m`). Ce module est le SEUL endroit
 * du projet où les deux vocabulaires se rencontrent : il décrit les 14 tables métier
 * (schéma figé par supabase/migrations/0001_init.sql) et sait convertir une ligne de base
 * en entité du domaine, et réciproquement.
 *
 * Aucune règle métier n'est réimplémentée ici : les constructeurs de src/domain/entities.js
 * restent seuls juges des valeurs par défaut, des statuts calculés et des validations.
 * C'est exactement ce que fait LocalStorageHACCPRepository en relisant le stockage.
 *
 * Types de champ (2e/3e colonne de chaque paire) :
 *   'nombre'     → numeric / integer PostgreSQL            (null si absent)
 *   'booleen'    → boolean PostgreSQL                      (false si absent)
 *   'json'       → jsonb / text[] de tableaux              ([] si absent)
 *   'texte_nul'  → text *nullable* dont `null` a un sens    (null si absent)
 *   'horodatage' → timestamptz (laisser le défaut serveur)  (null si absent)
 *   défaut (rien)→ text PostgreSQL                          ('' si absent)
 */
import {
  Equipment,
  DeliveryRecord,
  PreparationLabel,
  DishAllergens,
  CleaningTask,
  Fryer,
  CoolingCycle,
  DefrostCycle,
  NonConformity,
  ChecklistRoutine,
  SanitaryDocument,
  PhControlRecord,
  WeightControlRecord,
  normalizeOperator,
} from '../domain/entities.js';

const NOMBRE = 'nombre';
const BOOLEEN = 'booleen';
const JSONB = 'json';
const TEXTE_NUL = 'texte_nul';
const HORODATAGE = 'horodatage';

/**
 * Descripteurs de table : `champs` liste les paires [camelCase, snake_case, type?].
 * `entite` est la classe du domaine instanciée en lecture (null → objet brut normalisé).
 * `cle` nomme la colonne qui sert de clé d'identité dans la liste (toujours `id`).
 * @type {Record<string, { table: string, entite: Function|null, normaliser?: Function,
 *          champs: Array<[string, string, (string|undefined)]> }>}
 */
export const SPECS = Object.freeze({
  equipments: {
    table: 'equipments',
    entite: Equipment,
    champs: [
      ['id', 'id'], ['name', 'name'], ['type', 'type'],
      ['min', 'min', NOMBRE], ['max', 'max', NOMBRE], ['current', 'current', NOMBRE],
      ['status', 'status'], ['lastLog', 'last_log'], ['operator', 'operator'],
      ['history', 'history', JSONB],
    ],
  },
  deliveries: {
    table: 'deliveries',
    entite: DeliveryRecord,
    champs: [
      ['id', 'id'], ['supplier', 'supplier'], ['bl', 'bl'],
      ['truckTemp', 'truck_temp', NOMBRE], ['prodTemp', 'prod_temp', NOMBRE],
      ['category', 'category'], ['conformPackaging', 'conform_packaging', BOOLEEN],
      ['conformDlc', 'conform_dlc', BOOLEEN], ['decision', 'decision'],
      ['time', 'time'], ['operator', 'operator'], ['photo', 'photo', TEXTE_NUL],
    ],
  },
  preparations: {
    table: 'preparations',
    entite: PreparationLabel,
    champs: [
      ['id', 'id'], ['name', 'name'], ['batch', 'batch'],
      ['fabDate', 'fab_date'], ['dlcDate', 'dlc_date'], ['durationDays', 'duration_days', NOMBRE],
      ['quantity', 'quantity'], ['allergens', 'allergens', JSONB],
      ['operator', 'operator'], ['photo', 'photo', TEXTE_NUL],
    ],
  },
  allergen_dishes: {
    table: 'allergen_dishes',
    entite: DishAllergens,
    champs: [
      ['id', 'id'], ['name', 'name'], ['category', 'category'],
      ['allergens', 'allergens', JSONB],
    ],
  },
  cleaning_tasks: {
    table: 'cleaning_tasks',
    entite: CleaningTask,
    champs: [
      ['id', 'id'], ['title', 'title'], ['zone', 'zone'], ['freq', 'freq'],
      ['status', 'status'], ['operator', 'operator'], ['time', 'time'],
      ['ppeRequired', 'ppe_required'],
    ],
  },
  fryers: {
    table: 'fryers',
    entite: Fryer,
    champs: [
      ['id', 'id'], ['name', 'name'], ['volume', 'volume'],
      ['lastTpm', 'last_tpm', NOMBRE], ['status', 'status'],
      ['lastChange', 'last_change'], ['operator', 'operator'],
    ],
  },
  cooling_cycles: {
    table: 'cooling_cycles',
    entite: CoolingCycle,
    champs: [
      ['id', 'id'], ['dish', 'dish'],
      ['startTemp', 'start_temp', NOMBRE], ['endTemp', 'end_temp', NOMBRE],
      ['startTime', 'start_time'], ['endTime', 'end_time'],
      ['durationMinutes', 'duration_minutes', NOMBRE], ['status', 'status'],
      ['operator', 'operator'],
    ],
  },
  defrost_cycles: {
    table: 'defrost_cycles',
    entite: DefrostCycle,
    champs: [
      ['id', 'id'], ['product', 'product'], ['batchOrigin', 'batch_origin'],
      ['startDate', 'start_date'], ['maxDlcDate', 'max_dlc_date'],
      ['chamberName', 'chamber_name'], ['status', 'status'], ['operator', 'operator'],
    ],
  },
  non_conformities: {
    table: 'non_conformities',
    entite: NonConformity,
    champs: [
      ['id', 'id'], ['date', 'date'], ['category5M', 'category_5m'],
      ['severity', 'severity'], ['equipOrSubject', 'equip_or_subject'],
      ['cause', 'cause'], ['action', 'action'], ['operator', 'operator'],
      ['status', 'status'],
    ],
  },
  checklists: {
    table: 'checklists',
    entite: ChecklistRoutine,
    champs: [
      ['id', 'id'], ['type', 'type'], ['date', 'date'], ['items', 'items', JSONB],
      ['validated', 'validated', BOOLEEN], ['operator', 'operator'], ['time', 'time'],
    ],
  },
  sanitary_documents: {
    table: 'sanitary_documents',
    entite: SanitaryDocument,
    champs: [
      ['id', 'id'], ['title', 'title'], ['category', 'category'], ['issuer', 'issuer'],
      ['fileDate', 'file_date'], ['expireDate', 'expire_date'], ['notes', 'notes'],
      ['fileData', 'file_data', TEXTE_NUL], ['status', 'status'],
    ],
  },
  ph_records: {
    table: 'ph_records',
    entite: PhControlRecord,
    champs: [
      ['id', 'id'], ['product', 'product'],
      ['measuredPh', 'measured_ph', NOMBRE], ['targetMaxPh', 'target_max_ph', NOMBRE],
      ['comment', 'comment'], ['operator', 'operator'], ['time', 'time'],
      ['status', 'status'],
    ],
  },
  weight_records: {
    table: 'weight_records',
    entite: WeightControlRecord,
    champs: [
      ['id', 'id'], ['dishName', 'dish_name'],
      ['targetWeight', 'target_weight', NOMBRE],
      ['measuredWeight', 'measured_weight', NOMBRE],
      ['tolerancePercent', 'tolerance_percent', NOMBRE],
      ['delta', 'delta', NOMBRE], ['status', 'status'],
      ['operator', 'operator'], ['time', 'time'],
    ],
  },
  brigade: {
    table: 'operators',
    entite: null,
    normaliser: normalizeOperator,
    champs: [
      ['id', 'id'], ['firstName', 'first_name'], ['lastName', 'last_name'],
      ['short', 'short'], ['initials', 'initials'], ['role', 'role'], ['pin', 'pin'],
      ['active', 'active', BOOLEEN], ['createdAt', 'created_at', HORODATAGE],
    ],
  },
});

/** Tables collection exposées par l'interface du dépôt (clé locale → table serveur). */
export const COLLECTIONS = Object.freeze(Object.keys(SPECS));

/** Tables du schéma 0001 que l'interface du dépôt ne manipule pas (cf. docs/DATA.md). */
export const TABLES_HORS_INTERFACE = Object.freeze(['temperature_logs', 'memberships', 'settings', 'establishments', 'activity_log']);

/**
 * Cible `on_conflict` PostgREST. L'unicité n'est pas la même partout dans le schéma 0001 :
 * les 13 tables de registre ont une clé primaire (establishment_id, id), mais `operators`
 * n'a que `id` — un identifiant d'opérateur est donc global (cf. docs/DATA.md §Écarts).
 * @param {string} cle — clé de SPECS
 * @returns {string}
 */
export function cibleConflit(cle) {
  return cle === 'brigade' ? 'id' : 'establishment_id,id';
}

/**
 * Convertit une valeur du domaine en valeur PostgreSQL.
 * @param {string|undefined} type
 * @param {unknown} valeur
 * @returns {unknown}
 */
function versSql(type, valeur) {
  if (type === NOMBRE) {
    if (valeur === undefined || valeur === null || valeur === '') return null;
    const n = Number(valeur);
    return Number.isFinite(n) ? n : null;
  }
  if (type === BOOLEEN) return Boolean(valeur);
  if (type === JSONB) return Array.isArray(valeur) ? valeur : (valeur ?? []);
  if (type === TEXTE_NUL || type === HORODATAGE) {
    return valeur === undefined || valeur === null || valeur === '' ? null : String(valeur);
  }
  return valeur === undefined || valeur === null ? '' : String(valeur);
}

/**
 * Reconstruit une valeur du domaine depuis PostgreSQL en laissant les absents à `undefined`
 * (les constructeurs de src/domain/entities.js appliquent alors leurs propres défauts).
 * @param {string|undefined} type
 * @param {unknown} valeur
 * @returns {unknown}
 */
function versDomaine(type, valeur) {
  if (valeur === null || valeur === undefined) return undefined;
  if (type === NOMBRE) return Number(valeur);
  if (type === BOOLEEN) return Boolean(valeur);
  if (type === JSONB) return valeur;
  return valeur;
}

/**
 * Transforme un objet du domaine (camelCase) en ligne PostgREST (snake_case).
 * `establishment_id` est TOUJOURS renseigné : RLS l'exige à l'écriture.
 * @param {object} spec — entrée de SPECS
 * @param {object} objet — entité ou objet du domaine
 * @param {{ establishmentId: string, id?: string }} infos
 * @returns {object} ligne prête pour l'insertion
 */
export function versLigne(spec, objet, { establishmentId, id } = {}) {
  const source = objet ?? {};
  const ligne = {};
  for (const [camel, snake, type] of spec.champs) ligne[snake] = versSql(type, source[camel]);
  ligne.id = id ?? source.id ?? ligne.id ?? null;
  if (establishmentId) ligne.establishment_id = establishmentId;
  return ligne;
}

/**
 * Transforme une ligne PostgREST (snake_case) en objet du domaine (camelCase).
 * @param {object} spec — entrée de SPECS
 * @param {object} ligne — ligne renvoyée par PostgREST
 * @returns {object} instance d'entité (ou objet normalisé si `spec.entite` est null)
 */
export function versObjet(spec, ligne) {
  const source = ligne ?? {};
  const brut = {};
  for (const [camel, snake, type] of spec.champs) {
    const valeur = versDomaine(type, source[snake]);
    if (valeur !== undefined) brut[camel] = valeur;
  }
  const normalise = spec.normaliser ? spec.normaliser(brut) : brut;
  return spec.entite ? new spec.entite(normalise) : normalise;
}

/**
 * Transforme une liste d'entités en lignes PostgREST.
 * @param {object} spec
 * @param {object[]} liste
 * @param {string} establishmentId
 * @returns {object[]}
 */
export function versLignes(spec, liste, establishmentId) {
  if (!Array.isArray(liste)) return [];
  return liste.map((objet) => versLigne(spec, objet, { establishmentId }));
}

/**
 * Transforme une liste de lignes PostgREST en entités du domaine.
 * @param {object} spec
 * @param {object[]} lignes
 * @returns {object[]}
 */
export function versObjets(spec, lignes) {
  if (!Array.isArray(lignes)) return [];
  return lignes.map((ligne) => versObjet(spec, ligne));
}

/**
 * Extrait les identifiants d'une liste de lignes (pour les purges ciblées).
 * @param {object[]} lignes
 * @returns {string[]}
 */
export function identifiants(lignes) {
  if (!Array.isArray(lignes)) return [];
  return lignes.map((ligne) => ligne && ligne.id).filter((id) => id !== null && id !== undefined).map(String);
}
