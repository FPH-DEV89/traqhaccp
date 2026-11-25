import { chromium } from 'playwright';
import fs from 'fs';
const URL = 'https://fph-dev89.github.io/traqhaccp/';
const ids = JSON.parse(fs.readFileSync('/tmp/e2e-sync/identifiants.json', 'utf8'));

const b = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [], failed = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
pg.on('requestfailed', r => failed.push(r.url()));

await pg.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
await pg.waitForTimeout(2500);

await pg.fill('#portail-email', ids.email);
await pg.fill('#portail-mdp', ids.motDePasse);
const submits = await pg.$$('#portail-connexion form button[type="submit"], #portail-connexion form input[type="submit"], #portail-connexion button[type="submit"]');
let clicked = false;
for (const s of submits) { if (await s.isVisible()) { await s.click(); clicked = true; break; } }
if (!clicked) await pg.keyboard.press('Enter');
await pg.waitForTimeout(9000);

const after = await pg.evaluate(() => {
  const p = document.getElementById('portail-connexion');
  const txt = document.body.innerText;
  return {
    portalVisible: p ? !!(p.offsetWidth || p.offsetHeight) : false,
    saved: /SAUVEGARD/i.test(txt),
    registre: /REGISTRE/i.test(txt),
    textLen: txt.length,
    sample: txt.slice(0, 220).replace(/\n+/g, ' | ')
  };
});
console.log('SUBMIT:', clicked, '| APRES LOGIN:', JSON.stringify(after));
await pg.screenshot({ path: '/opt/data/cache/scratch/traqhaccp-live-logged.png' });

if (!after.portalVisible) {
  for (const id of await pg.$$eval('button[id^="nav-"]', e => e.map(x => x.id))) {
    await pg.evaluate(nid => document.getElementById(nid).click(), id).catch(() => {});
    await pg.waitForTimeout(1400);
    const st = await pg.evaluate(() => ({
      vis: [...document.querySelectorAll('[id^="view-"]')].filter(v => v.offsetWidth || v.offsetHeight).map(v => v.id)
    }));
    console.log('NAV', id, JSON.stringify(st));
  }
  await pg.screenshot({ path: '/opt/data/cache/scratch/traqhaccp-live-nav.png' });
}
console.log('ERREURS CONSOLE:', errs.length, errs.slice(0, 6));
console.log('REQ ECHOUEES:', failed.length, failed.slice(0, 6));
await b.close();
