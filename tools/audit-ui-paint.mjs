#!/usr/bin/env node
/**
 * audit-ui-paint.mjs — Vérifie qu'un écran est PEINT et ATTEIGNABLE, pas seulement présent
 * dans le DOM. C'est la réponse au bug TraqHACCP du 16-17/09/2026 : « les titres s'affichent
 * mais rien d'autre », alors que tous les checks DOM (innerHTML, 17 modules rendus,
 * getBoundingClientRect) passaient au vert — le contenu était clippé par un ancêtre.
 *
 * Ce que le script prouve, pour chaque module × chaque largeur :
 *   1. la vue n'est pas blanche (texte + nœuds) ;
 *   2. aucun ancêtre ne clippe le contenu (scrollHeight > clientHeight + overflow hidden/clip)
 *      → c'est exactement le bug : `.main` à 68 px pour 2916 px de contenu ;
 *   3. le dernier bloc de la vue est réellement atteignable (scrollIntoView) ET painted
 *      (document.elementFromPoint au centre doit renvoyer un descendant de la vue) ;
 *   4. pas de débordement horizontal ;
 *   5. zéro erreur console / exception JS.
 *
 * Usage :
 *   APP_URL=https://traqhaccp.vercel.app/ node tools/audit-ui-paint.mjs
 *   node tools/audit-ui-paint.mjs --url http://127.0.0.1:8899 --modules dashboard,reglages
 *   node tools/audit-ui-paint.mjs --view "#view" --switch switchTab --allow-sw
 *
 * Exit 0 = tout est peint et atteignable. Exit 1 = au moins un échec (rapport chiffré).
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/* Binaires Chromium : dans ce conteneur, PLAYWRIGHT_BROWSERS_PATH pointe sur /opt/hermes/.playwright,
   un cache vide qui appartient à root — le lancement échoue, et le méta-gate lit cet échec comme
   un « gate muet » : il bloque alors que le code est sain. Or un gate qui crie au loup finit
   désactivé. npm run setup:playwright installe donc les navigateurs dans /opt/data/.playwright ;
   on bascule dessus dès que le chemin configuré ne contient AUCUN binaire utilisable — jamais
   l'inverse (une machine correctement installée garde son chemin). */
const CHEMIN_SECOURS = '/opt/data/.playwright';

/* Le chemin des binaires est figé par Playwright AU MOMENT du require : le lire après coup ne
   sert à rien. On demande donc d'abord à Playwright l'exécutable qu'il attend réellement, et
   s'il n'est pas là on recharge le module avec le chemin de secours — sans toucher au chemin
   d'une machine correctement installée. */
function loadPlaywright(cheminBinaires = null) {
  if (cheminBinaires) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = cheminBinaires;
    for (const cle of Object.keys(require.cache)) {
      if (cle.includes('playwright')) delete require.cache[cle];
    }
  }
  const candidats = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core',
    '/opt/data/node_modules/playwright'];
  for (const c of candidats) { if (!c) continue; try { return require(c); } catch {} }
  throw new Error('playwright introuvable — npm i -D playwright (ou PLAYWRIGHT_MODULE=/chemin)');
}

/** Lance Chromium : le chemin attendu d'abord, puis le chemin de secours si le binaire manque.
    On décide sur le LANCEMENT réel et non sur executablePath() : Playwright exécute le headless
    shell (chromium_headless_shell-<rev>) alors qu'executablePath() désigne le chrome complet —
    une sonde sur le fichier conclut donc à tort que le chemin est inutilisable. */
async function lancerNavigateur() {
  const chromium = loadPlaywright().chromium;
  try {
    return await chromium.launch();
  } catch (erreur) {
    if (!/Executable doesn't exist/i.test(erreur.message) || !existsSync(CHEMIN_SECOURS)) throw erreur;
    try {
      return await loadPlaywright(CHEMIN_SECOURS).chromium.launch();
    } catch (erreurSecours) {
      throw new Error(
        `binaire Chromium introuvable sur les deux chemins.\n` +
        `  ${erreur.message.split('\n')[0]}\n` +
        `  ${erreurSecours.message.split('\n')[0]}\n` +
        `  installer : npm run setup:playwright`);
    }
  }
}

// --- arguments --------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = { url: process.env.APP_URL || 'http://127.0.0.1:8899/', view: '#view', main: null,
  switch: 'switchTab', allowSw: false, allowX: false, modules: null, quiet: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--url') opt.url = argv[++i];
  else if (a === '--view') opt.view = argv[++i];
  else if (a === '--switch') opt.switch = argv[++i];
  else if (a === '--modules') opt.modules = argv[++i].split(',').map((s) => s.trim());
  else if (a === '--allow-sw') opt.allowSw = true;
  else if (a === '--quiet') opt.quiet = true;
  else { console.error(`option inconnue: ${a}`); process.exit(2); }
}

const LARGEURS = (process.env.PAINT_WIDTHS || '1440x900,1024x768,900x800,820x900,768x1024,414x896,390x844')
  .split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h }; });

function modulesDepuisSource() {
  const r = join(process.cwd(), 'src/presentation/router.js');
  if (existsSync(r)) {
    const src = readFileSync(r, 'utf8');
    const m = src.match(/export const MIGRATED\s*=\s*\[([\s\S]*?)\]/);
    if (m) return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2]);
  }
  return [];
}
const MODULES = opt.modules || modulesDepuisSource();

// --- sonde exécutée DANS la page -------------------------------------------
const SONDE = (selView) => {
  const v = document.querySelector(selView);
  if (!v) return { erreur: `vue ${selView} introuvable` };
  const texte = (v.innerText || '').replace(/\s+/g, ' ').trim();
  const noeuds = v.querySelectorAll('*').length;
  const vw = window.innerWidth;

  // 2. clipping : tout ancêtre (vue incluse → body) qui cache du contenu plus haut que lui
  const clippes = [];
  const chaine = [];
  for (let e = v; e && e !== document.documentElement; e = e.parentElement) chaine.push(e);
  for (const e of chaine) {
    const cs = getComputedStyle(e);
    const cache = e.scrollHeight > e.clientHeight + 4 && /hidden|clip/.test(cs.overflowY);
    if (cache) clippes.push({
      el: e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (e.className && typeof e.className === 'string' ? `.${e.className.split(/\s+/)[0]}` : ''),
      visible: e.clientHeight, contenu: e.scrollHeight, overflowY: cs.overflowY,
    });
  }

  // 3. dernier bloc : atteignable + peint
  // Échantillonnage sur 5 points verticaux (et non le seul centre) : une barre collante
  // (topbar / tabbar mobile) recouvre légitimement le centre d'un bloc sans que le contenu
  // soit perdu. Le bug d'origine, lui, clippe TOUT le bloc → 0 point peint.
  const desc = (e) => !e ? 'rien (aucun élément peint)'
    : e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '')
      + (e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/)[0]}` : '');
  const blocs = [...v.querySelectorAll(':scope > *')].filter((e) => e.getBoundingClientRect().height > 10);
  const dernier = blocs[blocs.length - 1];
  let dernierRes = null;
  if (dernier) {
    dernier.scrollIntoView({ block: 'end' });
    const r = dernier.getBoundingClientRect();
    const dansView = r.bottom > 0 && r.top < window.innerHeight && r.height > 0;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
    const points = dansView ? [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => {
      const y = Math.min(Math.max(r.top + r.height * f, 1), window.innerHeight - 1);
      const el = document.elementFromPoint(x, y);
      const ok = !!el && (el === dernier || dernier.contains(el) || el.contains(dernier));
      return { ok, y: Math.round(y), couvreur: ok ? null : desc(el) };
    }) : [];
    const peints = points.filter((p) => p.ok).length;
    const peint = dansView && peints > 0;                       // au moins 1 point peint
    const totalementCache = dansView && peints === 0;
    const couvreurs = [...new Set(points.filter((p) => !p.ok).map((p) => p.couvreur))];
    dernierRes = { tag: dernier.tagName.toLowerCase(), h: Math.round(r.height), dansView, peint,
      points: `${peints}/${points.length || 5}`, totalementCache, couvreurs,
      hit: points.find((p) => p.ok)?.couvreur || couvreurs[0] || 'rien' };
    window.scrollTo(0, 0);
    const scroller = [...chaine].find((e) => e.scrollHeight > e.clientHeight + 4);
    if (scroller) scroller.scrollTop = 0;
  }

  return { texte: texte.length, noeuds, clippes, dernier: dernierRes,
    overflowX: document.documentElement.scrollWidth - vw, blocs: blocs.length };
};

// --- exécution --------------------------------------------------------------
const navigateur = await lancerNavigateur();
const echecs = [];
let mesures = 0;
let flakes = 0;

for (const { w, h } of LARGEURS) {
  const ctx = await navigateur.newContext({
    viewport: { width: w, height: h },
    serviceWorkers: opt.allowSw ? 'allow' : 'block', // sinon on teste du code en cache
  });
  const page = await ctx.newPage();
  const erreurs = [], exceptions = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => exceptions.push(String(e.message).slice(0, 160)));

  await page.goto(opt.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => {
    // Exit 2 et non 1 : « le gate n'a pas pu tourner » (URL morte, serveur éteint) ne doit pas
    // être confondu avec « le gate a détecté un bug ». Sinon un timeout passerait pour une alerte.
    console.error(`ERREUR D'INFRASTRUCTURE — ${opt.url} injoignable : ${e.message.split('\n')[0]}`);
    process.exit(2);
  });
  await page.waitForTimeout(1200);
  // Le délai fixe seul ne suffit pas sur une prod à froid (CSS/fonts/modules encore en vol).
  await page.waitForLoadState('load').catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});

  const navigables = opt.switch ? await page.evaluate((f) => typeof window[f] === 'function', opt.switch) : false;
  const cibles = navigables && MODULES.length ? MODULES : [null];

  for (const mod of cibles) {
    if (mod) {
      await page.evaluate(([f, m]) => window[f](m), [opt.switch, mod]);
      await page.waitForTimeout(320);
    }
    mesures++;
    // Une seule passe mesurait des vues en pleine hydratation (chargement à froid de la prod,
    // waitUntil domcontentloaded + délai fixe) → 1 faux échec observé à 1440px sur la prod,
    // alors que trois runs complets derrière étaient à 119/119. Donc : un échec n'est retenu
    // que s'il SE REPRODUIT. Un gate qui crie au loup finit ignoré — donc mort.
    const mesurer = async () => {
      let res;
      try { res = await page.evaluate(SONDE, opt.view); }
      catch (e) { res = { erreur: String(e.message) }; }
      const msgs = [];
      if (res.erreur) msgs.push(res.erreur);
      else {
        if (res.texte < 150) msgs.push(`vue quasi blanche (${res.texte} car., ${res.noeuds} nœuds)`);
        for (const c of res.clippes) msgs.push(`CLIPPÉ : ${c.el} fait ${c.visible}px pour ${c.contenu}px de contenu (overflow-y:${c.overflowY})`);
        if (res.dernier) {
          if (!res.dernier.dansView) msgs.push(`dernier bloc injoignable (hors viewport, h=${res.dernier.h}px)`);
          else if (!res.dernier.peint) msgs.push(`dernier bloc NON PEINT — 0 point atteint sur 5, entièrement recouvert par ${res.dernier.couvreurs.join(', ') || 'un inconnu'} (h=${res.dernier.h}px)`);
        }
        if (res.overflowX > 2) msgs.push(`débordement horizontal +${res.overflowX}px`);
      }
      return { res, msgs };
    };

    let { res, msgs } = await mesurer();
    let flake = false;
    if (msgs.length) {
      await page.waitForTimeout(700);           // laisser finir la peinture/transition en cours
      const seconde = await mesurer();
      if (!seconde.msgs.length) { flake = true; res = seconde.res; msgs = []; }
      else { res = seconde.res; msgs = seconde.msgs; }  // reproduit = vrai bug, on garde le 2e diagnostic
    }
    // Les erreurs console/JS ne sont pas re-testées : ce ne sont pas des aléas de mesure.
    if (erreurs.length) msgs.push(`${erreurs.length} erreur(s) console : ${erreurs[0]}`);
    if (exceptions.length) msgs.push(`${exceptions.length} exception(s) : ${exceptions[0]}`);

    if (msgs.length) {
      echecs.push({ w, mod, msgs });
      if (!opt.quiet) console.log(`❌ ${w}x${h}  ${(mod || 'vue').padEnd(18)} ${msgs.join(' · ')}`);
    } else if (!opt.quiet) {
      const pv = res.dernier ? res.dernier.points : '?';
      if (flake) { flakes++; console.log(`🔁 ${w}x${h}  ${(mod || 'vue').padEnd(18)} flake neutralisé (échec non reproduit à la 2e passe)`); }
      else console.log(`✅ ${w}x${h}  ${(mod || 'vue').padEnd(18)} ${res.noeuds} nœuds · ${res.texte} car. · ${res.blocs} blocs · dernier peint (${pv} points)`);
    }
    erreurs.length = 0; exceptions.length = 0;
  }
  await ctx.close();
}

await navigateur.close();

// --- rapport ----------------------------------------------------------------
const conclu = echecs.length === 0 ? 'PASS' : 'FAIL';
console.log(`\n${conclu} — ${mesures - echecs.length}/${mesures} vérifications peinture OK · ${opt.url}${flakes ? ` · ${flakes} flake(s) neutralisé(s) à la 2e passe` : ''}`);
if (echecs.length) {
  const parLargeur = new Map();
  for (const e of echecs) parLargeur.set(e.w, (parLargeur.get(e.w) || 0) + 1);
  console.log(`plages cassées : ${[...parLargeur.entries()].map(([w, n]) => `${w}px (${n})`).join(', ')}`);
  console.log('Rappel : un « DOM présent » vert ne prouve rien. Viser la peinture (elementFromPoint) et l\'atteignabilité.');
  process.exit(1);
}
