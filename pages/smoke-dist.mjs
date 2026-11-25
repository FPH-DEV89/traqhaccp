import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [], failed = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
pg.on('requestfailed', r => failed.push(r.url()));

await pg.goto('http://127.0.0.1:8898/index.html', { waitUntil: 'networkidle', timeout: 60000 });
await pg.waitForTimeout(3000);
const st = await pg.evaluate(() => ({
  title: document.title,
  views: [...document.querySelectorAll('[id^="view-"]')].length,
  navButtons: document.querySelectorAll('button[id^="nav-"]').length,
  portalVisible: (() => { const p = document.getElementById('portail-connexion'); return p ? !!(p.offsetWidth || p.offsetHeight) : false; })(),
  textLen: document.body.innerText.length
}));
console.log('DIST-PAGES RENDER:', JSON.stringify(st));
await pg.screenshot({ path: '/opt/data/cache/scratch/traqhaccp-dist-pages.png' });
console.log('CONSOLE ERRORS:', errs.length, errs.slice(0, 5));
console.log('REQ FAILED:', failed.length, failed.slice(0, 5));
await b.close();
