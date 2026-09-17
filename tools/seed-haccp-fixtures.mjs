/**
 * Script de génération de jeu de données de test HACCP (Fixtures).
 * Permet de simuler une journée de restaurant avec des températures,
 * réceptions, nettoyages et non-conformités.
 */
import fs from 'fs';
import path from 'path';

export function generateHACCPFixtures() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const fixtures = {
    generatedAt: now.toISOString(),
    equipments: [
      { id: 'frigo-positif-1', name: 'Chambre Froide Positive 1', targetTemp: 3.0, minTemp: 0, maxTemp: 4.0 },
      { id: 'frigo-viandes', name: 'Frigo Viandes', targetTemp: 2.0, minTemp: 0, maxTemp: 3.0 },
      { id: 'congelateur-1', name: 'Congélateur Négatif', targetTemp: -20.0, minTemp: -25.0, maxTemp: -18.0 }
    ],
    temperatureLogs: [
      { equipmentId: 'frigo-positif-1', temp: 2.8, timestamp: `${todayStr}T07:30:00Z`, status: 'CONFORME', operator: 'Chef Jean' },
      { equipmentId: 'frigo-viandes', temp: 2.1, timestamp: `${todayStr}T07:32:00Z`, status: 'CONFORME', operator: 'Chef Jean' },
      { equipmentId: 'congelateur-1', temp: -19.4, timestamp: `${todayStr}T07:35:00Z`, status: 'CONFORME', operator: 'Chef Jean' },
      // Cas de non-conformité détecté
      { equipmentId: 'frigo-viandes', temp: 5.5, timestamp: `${todayStr}T11:45:00Z`, status: 'NON_CONFORME', operator: 'Commis Alex', alert: 'Température critique > 3°C' }
    ],
    traceability: [
      {
        id: 'LOT-SAUMON-2026',
        product: 'Filet de Saumon Label Rouge',
        supplier: 'Marée Fraîche SAS',
        lot: 'MF-2026-9921',
        receptionDate: todayStr,
        dlcOriginale: '2026-09-22',
        dlcSecondaire: '2026-09-19', // J+2 après ouverture
        temperatureReception: 1.8,
        conforme: true
      }
    ],
    cleanings: [
      { zone: 'Plan de travail boucherie', scheduled: 'Quotidien', doneAt: `${todayStr}T06:45:00Z`, doneBy: 'Alex', validated: true },
      { zone: 'Friteuses', scheduled: 'Hebdomadaire', doneAt: null, doneBy: null, validated: false }
    ],
    nonConformities: [
      {
        id: 'NC-2026-01',
        date: todayStr,
        source: 'frigo-viandes',
        defect: 'Température relevée à 5.5°C au lieu de <= 3°C',
        actionCorrective: 'Transfert d’urgence des denrées en CF1 et appel technicien froid',
        resolved: true
      }
    ]
  };

  return fixtures;
}

// Sauvegarde sous tools/haccp-fixtures.json si exécuté directement
const data = generateHACCPFixtures();
const dest = path.resolve('tools', 'haccp-fixtures.json');
fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf-8');
console.log(`✔ Fixtures HACCP générées avec succès dans ${dest} (${data.temperatureLogs.length} relevés, ${data.traceability.length} lots).`);
