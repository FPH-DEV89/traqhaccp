#!/usr/bin/env node
/**
 * check-sw-assets.mjs — Gate « le hors-ligne est réellement possible ».
 *
 * Panne du 23/09/2026 : sw.js précachait './patisserie', chemin ABSENT du dépôt (il n'existe
 * que par une réécriture côté hébergeur). Or cache.addAll() est TOUT-OU-RIEN : ce seul 404
 * rejetait install(), le worker était jeté, et l'app — vendue comme « registre sanitaire
 * hors-ligne » — ne s'ouvrait plus réseau coupé. Panne invisible : l'échec était avalé par
 * un .catch(() => {}) dans app.js. Symptôme trompeur : « 0 service worker » sans erreur.
 *
 * Ce gate ne demande aucun navigateur et vérifie deux choses :
 *   1. chaque entrée de ASSETS_TO_CACHE existe sur le disque  → aucun 404 possible ;
 *   2. chaque fichier same-origin RÉELLEMENT chargé par l'app livrée (fermeture d'imports
 *      depuis patisserie.html) est précaché → sinon l'hors-ligne est partiel en silence.
 *
 * Usage :
 *   node tools/check-sw-assets.mjs                     # sw.js du dépôt
 *   node tools/check-sw-assets.mjs --sw /tmp/ancien.js # rejouer la panne (témoin)
 *   node tools/check-sw-assets.mjs --html patisserie.html
 *
 * Exit 0 = OK · exit 1 = panne détectée · exit 2 = le gate n'a pas pu tourner.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize, posix } from 'node:path';

const argv = process.argv.slice(2);
const opt = { sw: 'sw.js', html: 'patisserie.html', root: null };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--sw') opt.sw = argv[++i];
  else if (argv[i] === '--html') opt.html = argv[++i];
  else if (argv[i] === '--root') opt.root = argv[++i];
  else { console.error(`option inconnue: ${argv[i]}`); process.exit(2); }
}

if (!existsSync(opt.sw)) {
  console.error(`ERREUR D'INFRASTRUCTURE — ${opt.sw} introuvable (exit 2 : le gate n'a pas pu tourner).`);
  process.exit(2);
}
/* La racine est TOUJOURS le dépôt (cwd), jamais le dossier du sw.js analysé : c'est ce qui permet
   de rejouer la panne sur une copie témoin dans /tmp en gardant des chemins de test réalistes. */
const racine = opt.root || process.cwd();

// --- 1. lecture du précache ---------------------------------------------------
// Les commentaires sont retirés AVANT extraction : en français, une apostrophe de commentaire
// (« d'imports ») ouvre une pseudo-chaîne et avale les entrées suivantes — faux positifs garantis.
// Le « // » des URL (https://) est protégé par le [^:] qui l'exclut.
const src = readFileSync(opt.sw, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const bloc = src.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\n\s*\];/);
if (!bloc) {
  console.error("ERREUR D'INFRASTRUCTURE — ASSETS_TO_CACHE introuvable dans " + opt.sw + ' (exit 2).');
  process.exit(2);
}
const precache = [...bloc[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]);
if (!precache.length) {
  console.error("ERREUR D'INFRASTRUCTURE — ASSETS_TO_CACHE est vide : plus rien n'est précaché (exit 2).");
  process.exit(2);
}

/** './css/a.css' → 'css/a.css' */
const versChemin = (p) => p.replace(/^\.\//, '').replace(/^\//, '');

// --- 2. vérification de l'existence sur disque -------------------------------
const manquants = precache.filter((p) => {
  if (p.endsWith('/')) return false;                 // une racine n'est pas un fichier
  if (/^https?:\/\//.test(p)) return false;          // tierce : hors périmètre disque
  return !existsSync(join(racine, versChemin(p)));
});

// --- 3. fermeture d'imports de l'app livrée ----------------------------------
/** Fichiers same-origin chargés par la page servie, imports transitifs inclus. */
function fermeture(html) {
  const cheminHtml = join(racine, html);
  if (!existsSync(cheminHtml)) return null;
  const contenu = readFileSync(cheminHtml, 'utf8');
  const debuts = [
    ...contenu.matchAll(/<script[^>]+src=["']([^"']+)["']/g),
    ...contenu.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g),
  ].map((m) => m[1]).filter((u) => !/^https?:\/\//.test(u)).map((u) => versChemin(u.split('?')[0]));

  const vus = new Set();
  const file = [...debuts];
  while (file.length) {
    const rel = file.pop();
    if (vus.has(rel) || !existsSync(join(racine, rel))) continue;
    vus.add(rel);
    for (const m of readFileSync(join(racine, rel), 'utf8').matchAll(/from\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (/^https?:\/\//.test(spec) || !spec.startsWith('.')) continue;
      file.push(versChemin(posix.normalize(posix.join(posix.dirname(rel), spec))));
    }
  }
  return [...vus];
}

const vivants = fermeture(opt.html);
if (vivants === null) {
  console.error(`ERREUR D'INFRASTRUCTURE — page livrée ${opt.html} introuvable (exit 2).`);
  process.exit(2);
}
const precacheSet = new Set(precache.map(versChemin));
const oublies = vivants.filter((f) => !precacheSet.has(f));

// --- 4. verdict --------------------------------------------------------------
const KO = manquants.length || oublies.length;
if (!KO) {
  console.log(`check-sw-assets: OK — ${precache.length} entrée(s) précachée(s), toutes présentes ; ${vivants.length} fichier(s) vivant(s) couvert(s).`);
  process.exit(0);
}
console.log(`check-sw-assets: ${precache.length} entrée(s) précachée(s), ${vivants.length} fichier(s) vivant(s) dans ${opt.html}.\n`);
if (manquants.length) {
  console.log('❌ ENTRÉE PRÉCACHÉE INTROUVABLE — cache.addAll() est tout-ou-rien : ce seul 404 rejette');
  console.log('   install(), le service worker est jeté et l\'hors-ligne disparaît SANS erreur visible.');
  for (const m of manquants) console.log(`     · ${m}`);
  console.log("   → retirer l'entrée, ou corriger le chemin vers un fichier réellement versionné.\n");
}
if (oublies.length) {
  console.log('❌ FICHIER VIVANT NON PRÉCACHÉ — chargé par l\'app livrée mais absent du précache :');
  console.log('   au premier démarrage hors-ligne, ce module manquera.');
  for (const o of oublies) console.log(`     · ${o}`);
  console.log('');
}
console.log('FAIL — hors-ligne non fiable.');
process.exit(1);
