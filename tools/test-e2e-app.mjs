#!/usr/bin/env node
/**
 * test-e2e-app.mjs — Test end-to-end Playwright dans un vrai navigateur Chromium.
 *
 * Vérifie sans mock de logique métier :
 *   1. Scan démo → pré-remplissage complet (#form-name, #form-supplier, #form-lot, #form-dlc-date)
 *   2. Scan photo réel (Edge Function Supabase extract-label) → pré-remplissage DLC + Lot
 *   3. Re-scan du même fichier → fonctionne (reset de input.value)
 *   4. Parcours complet : réception lot → DLC secondaire → fiche recette → vente FIFO →
 *      suppression vente (restitution stock) → enquête RappelConso DDPP → 0 erreur console.
 */
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function loadPlaywright() {
  const candidats = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    'playwright-core',
    '/opt/data/node_modules/playwright',
  ];
  for (const c of candidats) {
    if (!c) continue;
    try { return require(c); } catch {}
  }
  throw new Error('playwright introuvable');
}

function trouverChromeLocal() {
  const base = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : null;
  if (!base || !existsSync(base)) return null;
  for (const dir of readdirSync(base)) {
    const p1 = join(base, dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (dir.startsWith('chromium_headless_shell-') && existsSync(p1)) return p1;
    const p2 = join(base, dir, 'chrome-win64', 'chrome.exe');
    if (dir.startsWith('chromium-') && existsSync(p2)) return p2;
  }
  return null;
}

async function lancerNavigateur() {
  const { chromium } = loadPlaywright();
  try {
    return await chromium.launch();
  } catch (err) {
    const exeLocal = trouverChromeLocal();
    if (exeLocal) return await chromium.launch({ executablePath: exeLocal });
    throw err;
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = join(ROOT, rel);
    if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let checks = 0;
let failures = 0;
function assert(cond, msg) {
  checks++;
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ ÉCHEC: ${msg}`);
  }
}

const server = await startServer();
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const browser = await lancerNavigateur();

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.openScanModal === 'function', null, { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('portail-connexion')?.remove());

  console.log('\n=== E2E 1 · Scan étiquette de démonstration ===');
  await page.evaluate(() => window.openScanModal());
  await page.click('.scan-demo-box button');
  await page.waitForSelector('#modal-entry:not(.hidden)', { timeout: 5000 });
  const demoVals = await page.evaluate(() => ({
    name: document.getElementById('form-name')?.value,
    supplier: document.getElementById('form-supplier')?.value,
    lot: document.getElementById('form-lot')?.value,
    dlc: document.getElementById('form-dlc-date')?.value,
    category: document.getElementById('form-category')?.value,
  }));
  assert(Boolean(demoVals.name && demoVals.supplier && demoVals.lot), `Démo : produit/fournisseur/lot pré-remplis (${demoVals.lot})`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(demoVals.dlc || ''), `Démo : DLC ISO valide (${demoVals.dlc})`);

  console.log('\n=== E2E 2 · Scan photo (Edge Function simulée) ===');
  await page.route('**/functions/v1/extract-label', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        name: 'Beurre de Tourage AOP',
        supplier: 'Laiterie Montaigu',
        lot: 'ABC-1234',
        dlcDate: '2026-09-28',
        category: 'cremerie',
        confidence: 'high',
      },
    }),
  }));
  await page.evaluate(() => { window.closeModals(); window.openScanModal(); });
  const resetOk = await page.evaluate(() => {
    const img = document.getElementById('scan-preview-img');
    return img && img.style.display === 'none';
  });
  assert(resetOk, 'openScanModal() réinitialise bien l\'aperçu');

  const sampleImg = join(ROOT, 'docs/captures/modale-scanner-etiquette.png');
  await page.setInputFiles('#scan-file-input', sampleImg);
  await page.waitForSelector('#modal-entry:not(.hidden)', { timeout: 25000 });
  const scanVals = await page.evaluate(() => ({
    name: document.getElementById('form-name')?.value,
    supplier: document.getElementById('form-supplier')?.value,
    lot: document.getElementById('form-lot')?.value,
    dlc: document.getElementById('form-dlc-date')?.value,
    category: document.getElementById('form-category')?.value,
  }));
  assert(scanVals.lot === 'ABC-1234', `Scan réel : N° lot extrait (${scanVals.lot})`);
  assert(scanVals.dlc === '2026-09-28', `Scan réel : DLC extraite en ISO (${scanVals.dlc})`);
  assert(scanVals.category === 'cremerie', `Scan réel : catégorie (${scanVals.category})`);
  assert(Boolean(scanVals.name && scanVals.supplier), `Scan réel : produit & fournisseur (${scanVals.name} / ${scanVals.supplier})`);

  console.log('\n=== E2E 3 · Re-scan avec le même fichier ===');
  await page.evaluate(() => { window.closeModals(); window.openScanModal(); });
  await page.setInputFiles('#scan-file-input', sampleImg);
  await page.waitForSelector('#modal-entry:not(.hidden)', { timeout: 25000 });
  const rescanLot = await page.evaluate(() => document.getElementById('form-lot')?.value);
  assert(rescanLot === 'ABC-1234', `Re-scan même fichier : formulaire pré-rempli (${rescanLot})`);

  console.log('\n=== E2E 4 · Réception, DLC 2nd, Recette, Vente FIFO, Suppression & Rappel ===');
  await page.fill('#form-stock-qty', '10');
  await page.click('#entry-submit-btn');
  await page.waitForSelector('#modal-entry', { state: 'hidden', timeout: 5000 });

  await page.evaluate(() => window.openNewSecondaryDlcModal());
  await page.fill('#sec-name', 'Beurre pommade entamé');
  await page.click('#sec-dlc-form button[type="submit"]');

  await page.evaluate(() => window.openNewRecipeModal());
  await page.fill('#recipe-form-name', 'Croissant Beurre AOP');
  await page.fill('#recipe-form-price', '2.50');
  await page.selectOption('.ing-lot-select', 'ABC-1234');
  await page.fill('.ing-qty-input', '0.5');
  await page.click('#recipe-submit-btn');

  await page.evaluate(() => window.startSaleWorkflow());
  await page.click('#modal-destock-confirm button[onclick*="confirmStockDepletion"]');

  const stockApresVente = await page.evaluate(async () => {
    const { state } = await import('/js/patisserie/state.js');
    return state.lots.find((l) => l.lot === 'ABC-1234')?.stockQty;
  });
  assert(stockApresVente === 9.5, `Déstockage FIFO : 10 - 0.5 = 9.5 (obtenu ${stockApresVente})`);

  await page.evaluate(() => window.openSaleDeleteModal(null, 0));
  await page.click('#modal-sale-delete button[type="submit"]');
  const stockApresAnnulation = await page.evaluate(async () => {
    const { state } = await import('/js/patisserie/state.js');
    return state.lots.find((l) => l.lot === 'ABC-1234')?.stockQty;
  });
  assert(stockApresAnnulation === 10, `Suppression vente : stock restitué à 10 (obtenu ${stockApresAnnulation})`);

  await page.evaluate(() => {
    window.openInspectionModal();
    document.getElementById('recall-input').value = 'ABC-1234';
    window.testRecallSearch();
  });
  const recallTxt = await page.evaluate(() => document.getElementById('recall-result')?.innerText || '');
  assert(recallTxt.includes('ABC-1234'), 'Enquête DDPP RappelConso affiche le lot ABC-1234');
  assert(consoleErrors.length === 0, `0 erreur console navigateur (${consoleErrors.length} : ${consoleErrors.join('; ')})`);
} finally {
  await browser.close();
  server.close();
}

console.log(`\ntest-e2e-app: ${checks} assertion(s) · ${failures} échec(s)`);
if (failures > 0) process.exit(1);
console.log('test-e2e-app: OK');
