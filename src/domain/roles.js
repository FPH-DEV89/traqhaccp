/**
 * TraqHACCP Pro — Rôles et permissions
 * Couche Domaine — aucune dépendance externe, aucun accès DOM / localStorage.
 */

/**
 * Ensemble des permissions disponibles dans l'application.
 * Clé technique → libellé français lisible.
 * @type {Record<string, string>}
 */
export const PERMISSIONS = {
  'records.create':    'Créer des fiches de relevé',
  'records.edit':      'Modifier des fiches existantes',
  'records.delete':    'Supprimer des fiches',
  'records.sign':      'Valider et signer un relevé',
  'nc.manage':         'Gérer les non-conformités',
  'settings.edit':     'Modifier les réglages et seuils',
  'equipment.manage':  'Gérer les équipements',
  'users.manage':      'Gérer les utilisateurs et rôles',
  'export.data':       'Exporter les données (CSV / JSON / PDF)',
  'inspection.mode':   'Activer le mode inspection lecture seule',
  'backup.restore':    'Importer une sauvegarde et restaurer les données',
};

/**
 * Matrice des rôles : chaque rôle porte ses permissions explicites.
 * @type {Record<string, { id: string, label: string, description: string, permissions: string[] }>}
 */
export const ROLES = {
  gerant: {
    id: 'gerant',
    label: 'Gérant',
    description: 'Accès complet à toutes les fonctionnalités, y compris la gestion des utilisateurs et les sauvegardes.',
    permissions: Object.keys(PERMISSIONS),
  },
  responsable: {
    id: 'responsable',
    label: 'Responsable',
    description: 'Accès complet sauf la gestion des utilisateurs et la restauration de sauvegarde.',
    permissions: [
      'records.create', 'records.edit', 'records.delete', 'records.sign',
      'nc.manage', 'settings.edit', 'equipment.manage',
      'export.data', 'inspection.mode',
    ],
  },
  operateur: {
    id: 'operateur',
    label: 'Opérateur',
    description: 'Saisie et signature des relevés du quotidien, export des données.',
    permissions: [
      'records.create', 'records.edit', 'records.sign', 'export.data',
    ],
  },
  lecture: {
    id: 'lecture',
    label: 'Lecture seule',
    description: 'Consultation et export uniquement. Aucune modification.',
    permissions: ['export.data'],
  },
  inspecteur: {
    id: 'inspecteur',
    label: 'Inspecteur DDPP',
    description: 'Mode inspection en lecture seule et export pour contrôle officiel.',
    permissions: ['inspection.mode', 'export.data'],
  },
};

/**
 * Ordre d'affichage des rôles dans les interfaces de sélection.
 * @type {string[]}
 */
export const ROLE_ORDER = ['gerant', 'responsable', 'operateur', 'lecture', 'inspecteur'];

/**
 * Vérifie si un rôle possède une permission donnée.
 * Tolérant : rôle inconnu → false, sauf 'gerant' qui dispose de tout.
 * @param {string} roleId
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(roleId, permission) {
  if (roleId === 'gerant') return true;
  const role = ROLES[roleId];
  if (!role) return false;
  return role.permissions.includes(permission);
}

/**
 * Retourne la liste des permissions d'un rôle.
 * @param {string} roleId
 * @returns {string[]}
 */
export function permissionsOf(roleId) {
  if (roleId === 'gerant') return Object.keys(PERMISSIONS);
  const role = ROLES[roleId];
  return role ? [...role.permissions] : [];
}

/**
 * Retourne le libellé français d'un rôle.
 * Fallback sur la valeur brute si le rôle est inconnu.
 * @param {string} roleId
 * @returns {string}
 */
export function roleLabel(roleId) {
  return ROLES[roleId]?.label ?? roleId;
}

/**
 * Indique si un rôle peut gérer les utilisateurs.
 * @param {string} roleId
 * @returns {boolean}
 */
export function canManageUsers(roleId) {
  return hasPermission(roleId, 'users.manage');
}
