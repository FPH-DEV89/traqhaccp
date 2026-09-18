/**
 * TraqHACCP Pro — Infrastructure — Sauvegarde / restauration intégrale en mode serveur.
 *
 * Extraite de supabase_repository.js pour rester sous la limite de 500 lignes (règle
 * « God File » du projet). Les deux fonctions reçoivent le dépôt Supabase et n'utilisent
 * que son interface publique : le JSON produit est **rigoureusement le même** que celui de
 * LocalStorageHACCPRepository.exportFullBackupJSON() — mêmes clés, même version de schéma —
 * ce qui permet de restaurer une sauvegarde locale dans un établissement serveur, et
 * inversement.
 *
 * Voir docs/DATA.md §Sauvegarde / restauration.
 */

/** Version du schéma des sauvegardes produites (identique au dépôt local). */
const SCHEMA_VERSION = '4.0-registre';

/**
 * Produit la sauvegarde complète d'un établissement (chaîne JSON indentée).
 * @param {import('./supabase_repository.js').SupabaseHACCPRepository} depot
 * @returns {string}
 */
export function exporterSauvegarde(depot) {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    establishment: depot.getEstablishment(),
    equipments: depot.getEquipments(),
    deliveries: depot.getDeliveries(),
    preparations: depot.getPreparations(),
    allergenDishes: depot.getAllergenDishes(),
    cleanings: depot.getCleaningTasks(),
    fryers: depot.getFryers(),
    coolings: depot.getCoolingCycles(),
    defrosts: depot.getDefrostCycles(),
    nonConformities: depot.getNonConformities(),
    checklists: depot.getChecklists(),
    sanitaryDocuments: depot.getSanitaryDocuments(),
    phRecords: depot.getPhRecords(),
    weightRecords: depot.getWeightRecords(),
    brigade: depot.getBrigade(),
    settings: depot.getSettings(),
    session: depot.getSession(),
    activityLog: depot.getActivityLog(),
  }, null, 2);
}

/**
 * Importe une sauvegarde JSON v3 (clés à la racine) ou v4 (objet `records`).
 * Tolérant : n'écrase jamais une section absente ou vide du fichier ; ne lève jamais.
 * Les écritures serveur partent en tâche de fond — `await depot.flush()` pour les attendre.
 * @param {import('./supabase_repository.js').SupabaseHACCPRepository} depot
 * @param {string} jsonString
 * @returns {boolean} vrai si la sauvegarde a été appliquée (au moins lue) sans erreur
 */
export function importerSauvegarde(depot, jsonString) {
  try {
    const racine = JSON.parse(jsonString);
    const data = racine && typeof racine === 'object' ? racine : {};
    const rec = data.records && typeof data.records === 'object' ? data.records : null;
    const lire = (...cles) => {
      for (const cle of cles) {
        const depuisRecords = rec && Array.isArray(rec[cle]) ? rec[cle] : null;
        if (depuisRecords) return depuisRecords;
        if (Array.isArray(data[cle])) return data[cle];
      }
      return null;
    };
    const ecrire = (liste, sauvegarde) => { if (liste && liste.length) sauvegarde.call(depot, liste); };

    if (data.establishment) depot.saveEstablishment(data.establishment);
    if (Array.isArray(data.brigade) && data.brigade.length) depot.saveBrigade(data.brigade);
    if (data.settings && typeof data.settings === 'object') depot.saveSettings(data.settings);
    if (data.session && typeof data.session === 'object') depot.saveSession(data.session);

    ecrire(lire('equipments'), depot.saveEquipments);
    ecrire(lire('deliveries'), depot.saveDeliveries);
    ecrire(lire('preparations'), depot.savePreparations);
    ecrire(lire('allergenDishes'), depot.saveAllergenDishes);
    ecrire(lire('cleanings', 'cleaning'), depot.saveCleaningTasks);
    ecrire(lire('fryers', 'oils'), depot.saveFryers);
    ecrire(lire('coolings', 'cooling'), depot.saveCoolingCycles);
    ecrire(lire('defrosts', 'defrost'), depot.saveDefrostCycles);
    ecrire(lire('nonConformities'), depot.saveNonConformities);
    ecrire(lire('sanitaryDocuments', 'documents'), depot.saveSanitaryDocuments);
    ecrire(lire('phRecords', 'ph'), depot.savePhRecords);
    ecrire(lire('weightRecords', 'weights'), depot.saveWeightRecords);

    const checklists = (rec && rec.checklists) || data.checklists;
    if (checklists && (checklists.ouverture || checklists.fermeture)) depot.saveChecklists(checklists);
    return true;
  } catch (e) {
    console.error('Import de sauvegarde impossible :', e);
    return false;
  }
}
