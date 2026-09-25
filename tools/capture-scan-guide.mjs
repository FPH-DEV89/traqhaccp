/** Captures pour le guide — module Scanner d'étiquette (reconnaissance IA).
 *  Fig 1 : écran du scanner (nouvelle UI photo/import/démo)
 *  Fig 2 : formulaire de réception pré-rempli par l'IA après analyse
 */
import { createRequire } from 'node:module';
const require = createRequire('/opt/data/');
const { chromium } = require('/opt/data/node_modules/playwright');

const R = { erreurs: [] };
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
p.on('console', m => { if (m.type() === 'error') R.erreurs.push(m.text()); });
p.on('pageerror', e => R.erreurs.push('pageerror: ' + e.message));

await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'load' });
await p.waitForTimeout(2500);
await p.evaluate(() => document.getElementById('portail-connexion')?.remove());

// ── Fig 1 : modale du scanner ───────────────────────────────────────────────
await p.evaluate(() => {
  if (typeof window.openScanModal === 'function') window.openScanModal();
  else document.querySelector('[onclick*="openScanModal"]')?.click();
});
await p.waitForTimeout(600);
R.fig1_visible = await p.evaluate(() => {
  const m = document.getElementById('modal-scan');
  return !!m && !m.classList.contains('hidden');
});
await p.screenshot({ path: 'docs/captures/modale-scanner-etiquette.png' });

// ── Fig 2 : analyse (étiquette de démonstration) → formulaire pré-rempli ────
await p.click('.scan-demo-box button');
await p.waitForTimeout(3500);
R.fig2 = await p.evaluate(() => {
  const m = document.getElementById('modal-entry');
  const val = id => document.getElementById(id)?.value ?? null;
  return {
    formulaireOuvert: !!m && !m.classList.contains('hidden'),
    valeurs: {
      produit: val('form-name'),
      fournisseur: val('form-supplier'),
      lot: val('form-lot'),
      dlc: val('form-dlc-date'),
      categorie: val('form-category')
    }
  };
});
await p.screenshot({ path: 'docs/captures/scan-etiquette-prefill.png' });

console.log(JSON.stringify(R, null, 2));
await b.close();
