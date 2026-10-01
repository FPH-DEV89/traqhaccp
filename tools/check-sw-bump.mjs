#!/usr/bin/env node
/**
 * check-sw-bump.mjs — GATE DE LIVRAISON SERVICE WORKER
 *
 * Panne évitée : un fichier PRÉCACHÉ (index.html, css/, js/patisserie/*) change, mais
 * `CACHE_NAME` reste identique. Le service worker ne re-télécharge alors JAMAIS ces fichiers :
 * un client qui a déjà installé l'app garde l'ancien index.html en cache, parfois avec du JS
 * neuf — l'écran se dessine, les boutons existent, et l'action échoue en silence
 * (c'est la forme exacte de la panne du 23/09/2026, et le piège tendu le 01/10/2026 :
 * `#modal-sale-delete` présent dans `modals.js` livré, absent de l'`index.html` en cache).
 *
 * Le gate répond à UNE question : « depuis le dernier bump COMMITÉ de CACHE_NAME, un fichier
 * précaché a-t-il changé — et si oui, le CACHE_NAME de travail a-t-il été bumpé pour le couvrir ? »
 *
 * Sortie : code 1 si un fichier précaché a changé sans bump. Le message nomme les fichiers.
 *
 * Usage : node tools/check-sw-bump.mjs [--quiet]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SW = resolve(RACINE, 'sw.js');
const quiet = process.argv.includes('--quiet');

const lireCacheName = (contenu) => {
  const m = contenu.match(/const\s+CACHE_NAME\s*=\s*'([^']+)'/);
  return m ? m[1] : null;
};

const git = (args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' }).trim();

let contenu;
try {
  contenu = readFileSync(SW, 'utf8');
} catch {
  console.log('check-sw-bump: pas de sw.js — rien à vérifier.');
  process.exit(0);
}

const cible = lireCacheName(contenu);
if (!cible) {
  console.error('check-sw-bump: ÉCHEC — `const CACHE_NAME` introuvable dans sw.js.');
  process.exit(1);
}

// Fichiers réellement précachés : le tableau ASSETS_TO_CACHE ('./x' → 'x').
const bloc = contenu.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\]/);
const precaches = new Set(
  (bloc ? bloc[1].match(/'([^']+)'/g) || [] : [])
    .map((s) => s.slice(1, -1).replace(/^\.\//, ''))
);

let commits = [];
try {
  commits = git(['log', '--format=%H', '--', 'sw.js']).split('\n').filter(Boolean);
} catch {
  console.log('check-sw-bump: historique git indisponible — vérification ignorée.');
  process.exit(0);
}
if (commits.length === 0) {
  console.log('check-sw-bump: sw.js non versionné — rien à vérifier.');
  process.exit(0);
}

const versionAuCommit = (hash) => {
  try {
    return lireCacheName(git(['show', `${hash}:sw.js`]));
  } catch {
    return null;
  }
};

// Dernier bump COMMITÉ = commit le plus récent dont la version diffère de la précédente.
let base = null;
let versionBase = null;
const vTete = versionAuCommit(commits[0]);
for (let i = 0; i < commits.length; i += 1) {
  const vIci = versionAuCommit(commits[i]);
  const vSuivante = versionAuCommit(commits[i + 1] ?? `${commits[i]}^`);
  if (vIci && vSuivante && vIci !== vSuivante) {
    base = commits[i];
    versionBase = vIci;
    break;
  }
}

if (!base) {
  console.log(`check-sw-bump: OK — aucun bump antérieur détecté (cache ${cible}), rien à comparer.`);
  process.exit(0);
}

// Fichiers modifiés depuis ce bump (le commit → l'arbre de travail, non commité inclus).
const modifies = git(['diff', '--name-only', base]).split('\n').filter(Boolean);
const touche = modifies.filter((f) => precaches.has(f.replace(/^\.\//, '')));

if (touche.length === 0) {
  console.log(`check-sw-bump: OK — aucun fichier précaché modifié depuis le bump ${base.slice(0, 8)} (cache ${cible}).`);
  process.exit(0);
}

if (cible === versionBase) {
  console.error('check-sw-bump: ÉCHEC — fichier(s) précaché(s) modifié(s) SANS bump de CACHE_NAME.');
  console.error(`  CACHE_NAME reste « ${cible} » alors que ces fichiers ont changé depuis ${base.slice(0, 8)} :`);
  touche.slice(0, 12).forEach((f) => console.error(`    - ${f}`));
  console.error('  → Les clients ayant déjà installé l\'app garderaient l\'ancienne version en cache.');
  console.error('  → Incrémenter CACHE_NAME dans sw.js (ex. …-vN → …-vN+1), puis relancer ce gate.');
  process.exit(1);
}

if (!quiet) {
  console.log(`check-sw-bump: OK — cache bumpé (${versionBase} → ${cible}) et ${touche.length} fichier(s) précaché(s) couvert(s).`);
}
process.exit(0);
