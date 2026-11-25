import { chromium } from 'playwright';
const URL = 'https://fph-dev89.github.io/traqhaccp/';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [], failed = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
pg.on('requestfailed', r => failed.push(r.url()));

const resp = await pg.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
await pg.waitForTimeout(3500);
const st = await pg.evaluate(() => ({
  title: document.title,
  views: document.querySelectorAll('[id^="view-"]').length,
  nav: document.querySelectorAll('button[id^="nav-"]').length,
  portal: (() => { const p = document.getElementById('portail-connexion'); return p ? !!(p.offsetWidth || p.offsetHeight) : 'absent'; })(),
  hasEmail: !!document.getElementById('portail-email'),
  hasMdp: !!document.getElementById('portail-mdp'),
  sw: navigator.serviceWorker ? 'supporté' : 'non',
  textLen: document.body.innerText.length
}));
console.log('HTTP:', resp.status());
console.log('RENDU:', JSON.stringify(st));
await pg.screenshot({ path: '/opt/data/cache/scratch/traqhaccp-ghpages.png' });
console.log('ERREURS CONSOLE:', errs.length, errs.slice(0, 6));
console.log('REQ ECHOUEES:', failed.length, failed.slice(0, 6));
await b.close();
