/**
 * Test réel de export_service.js (Node.js, localStorage simulé).
 * Vérifie les 6 critères d'acceptation de la spec P4b.
 */

// Simuler localStorage (Node n'en a pas)
const _store = {};
global.localStorage = {
  getItem: k => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: k => delete _store[k],
  clear: () => Object.keys(_store).forEach(k => delete _store[k]),
};

// Simuler document / window pour downloadFile et printDocument (non testés ici)
global.window = global;
global.document = {
  createElement: () => ({ style: {}, href: '', download: '', click() {} }),
  body: { appendChild() {}, removeChild() {} },
};
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };

// Chargement des modules
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');
const ROOT = path.default.join(path.default.dirname(fileURLToPath(import.meta.url)), '..');

const { LocalStorageHACCPRepository } = await import(`${ROOT}/src/infrastructure/storage_repository.js`);
const {
  buildFullBackup,
  parseBackup,
  exportRecordsCsv,
  registerHtml,
  labelHtml,
  exportableYears,
} = await import(`${ROOT}/src/infrastructure/export_service.js`);

// Construire un mock app
const repository = new LocalStorageHACCPRepository('test_p4b_');
const app = { repository };

console.log('\n=== TEST P4b — export_service.js ===\n');

// ─── Critère 1 : buildFullBackup ──────────────────────────────────────────────
const backupStr = buildFullBackup(app);
let parsed;
try { parsed = JSON.parse(backupStr); } catch (e) { console.error('FAIL buildFullBackup: JSON.parse échoue:', e.message); process.exit(1); }
if (!parsed.version) { console.error('FAIL buildFullBackup: version absente'); process.exit(1); }
if (parsed.version !== '4.0-registre') { console.error(`FAIL buildFullBackup: version inattendue: ${parsed.version}`); process.exit(1); }
if (!parsed.records) { console.error('FAIL buildFullBackup: records absent'); process.exit(1); }
console.log('✓ buildFullBackup — JSON re-parseable, version=', parsed.version);

// ─── Critère 2 : parseBackup v3 ──────────────────────────────────────────────
const r2 = parseBackup('{"version":"3.0-clean-arch-pro"}');
if (!r2.ok) { console.error('FAIL parseBackup v3: ok=false, errors=', r2.errors); process.exit(1); }
console.log('✓ parseBackup v3 — ok:true');

// ─── Critère 3 : parseBackup invalide ────────────────────────────────────────
const r3 = parseBackup('nope');
if (r3.ok) { console.error('FAIL parseBackup invalide: ok=true (devrait être false)'); process.exit(1); }
if (!r3.errors || !r3.errors.length) { console.error('FAIL parseBackup invalide: errors vide'); process.exit(1); }
console.log('✓ parseBackup invalide — ok:false, errors:', r3.errors[0]);

// ─── Critère 4 : exportRecordsCsv ────────────────────────────────────────────
const csv = exportRecordsCsv(app);
const BOM = '\uFEFF';
if (!csv.content.startsWith(BOM)) { console.error('FAIL exportRecordsCsv: pas de BOM UTF-8'); process.exit(1); }
if (!csv.content.includes(';')) { console.error('FAIL exportRecordsCsv: pas de séparateur ;'); process.exit(1); }
if (!csv.content.includes('Équipement')) { console.error('FAIL exportRecordsCsv: en-tête français absent'); process.exit(1); }
console.log('✓ exportRecordsCsv — BOM UTF-8 présent, séparateur ; présent, en-tête français OK');
console.log('  filename:', csv.filename);

// ─── Critère 5 : registerHtml ────────────────────────────────────────────────
const regHtml = registerHtml(app);
if (!regHtml.includes('<style>')) { console.error('FAIL registerHtml: pas de <style>'); process.exit(1); }
const estName = repository.getEstablishment().name || '';
if (estName && !regHtml.includes(estName)) { console.error('FAIL registerHtml: nom établissement absent'); process.exit(1); }
if (!regHtml.includes('Registre sanitaire')) { console.error('FAIL registerHtml: titre absent'); process.exit(1); }
console.log('✓ registerHtml — <style> présent, en-tête établissement OK');

// ─── Critère 6 : labelHtml ───────────────────────────────────────────────────
const preps = repository.getPreparations();
if (!preps.length) { console.error('FAIL labelHtml: aucune préparation en démo'); process.exit(1); }
const lbl = labelHtml(preps[0], app);
if (!lbl.includes('À consommer jusqu')) { console.error('FAIL labelHtml: mention DLC absente'); process.exit(1); }
if (!lbl.includes('<svg')) { console.error('FAIL labelHtml: pas de SVG code-barres'); process.exit(1); }
console.log('✓ labelHtml — mention DLC "À consommer jusqu\'au" présente, SVG code-barres présent');

// ─── Bonus : exportableYears ──────────────────────────────────────────────────
const years = exportableYears(app);
console.log('✓ exportableYears —', years.length ? years.join(', ') : '(vide)');

console.log('\n\u2705 TOUS LES CRITERES D\'ACCEPTATION P4b VERIFIES AVEC SUCCES\n');
