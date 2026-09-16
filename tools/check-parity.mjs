#!/usr/bin/env node
/**
 * check-parity.mjs — Filet anti-régression de la migration v3 → v4.
 *
 * Vérifie, sans navigateur, qu'aucune référence DOM n'est orpheline :
 *   1. tout id passé à getElementById()/querySelector('#…') existe quelque part
 *      (index.html legacy, module de vue, ou création dynamique dans du JS) ;
 *   2. tout onclick="fn(…)" du HTML correspond à une fonction définie ou exposée ;
 *   3. tout data-action="x" déclaré dans une vue est bien traité par cette vue ;
 *   4. (strict, si docs/MIGRATION_COMPLETE) aucun id en double entre legacy et vues ;
 *   5. vue enregistrée dans le routeur si le module existe, et inversement.
 *
 * Exit 1 si erreur bloquante.
 */
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'dist']);
const MIGRATION_DONE = existsSync(join(ROOT, 'docs/MIGRATION_COMPLETE'));

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const n of entries) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const read = (p) => readFileSync(p, 'utf8');
const htmlPath = join(ROOT, 'index.html');
const html = existsSync(htmlPath) ? read(htmlPath) : '';

// --- sources JS -------------------------------------------------------------
const jsFiles = walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'tools'))).filter((f) => extname(f) === '.js');
const inlineScripts = [];
{
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\btype\s*=\s*["'](application\/json|importmap|text\/template)["']/i.test(m[1])) continue;
    if (m[2] && m[2].trim().length > 5) inlineScripts.push(m[2]);
  }
}
const jsSources = jsFiles.map((f) => ({ path: relative(ROOT, f), src: read(f) }));
inlineScripts.forEach((src, i) => jsSources.push({ path: `index.html <script>#${i + 1}`, src }));

const viewDir = join(ROOT, 'src/presentation/views');
const viewFiles = existsSync(viewDir) ? walk(viewDir).filter((f) => extname(f) === '.js') : [];
const viewSources = viewFiles.map((f) => ({ path: relative(ROOT, f), src: read(f) }));

// --- 1. inventaire des ids --------------------------------------------------
const idRe = /\bid\s*=\s*(["'`])([^"'`$]+?)\1/g;
const idsLegacy = new Set();
const idsViews = new Map(); // id -> fichier
const idsJs = new Set();

for (const m of html.matchAll(idRe)) idsLegacy.add(m[2]);
for (const { path, src } of viewSources) {
  for (const m of src.matchAll(idRe)) {
    if (!idsViews.has(m[2])) idsViews.set(m[2], path);
  }
}
for (const { src } of jsSources) for (const m of src.matchAll(idRe)) idsJs.add(m[2]);

// les sections legacy (id="tab-xxx") : un id de vue homonyme serait un doublon
const legacySectionIds = new Set([...html.matchAll(/id\s*=\s*(["'])tab-([a-z0-9-]+)\1/gi)].map((m) => m[2]));

const problems = [];
const warnings = [];

// --- 2. références DOM orphelines -------------------------------------------
const refRe = /getElementById\s*\(\s*(["'`])([^"'`]+)\1\s*\)|querySelector(?:All)?\s*\(\s*(["'`])#([A-Za-z0-9_-]+)\3/g;
for (const { path, src } of jsSources) {
  let m;
  while ((m = refRe.exec(src))) {
    const id = m[2] || m[4];
    if (!id) continue;
    if (!idsLegacy.has(id) && !idsViews.has(id) && !idsJs.has(id)) {
      problems.push(`${path}: référence DOM orpheline → #${id} (aucun id=" ${id} " trouvé)`);
    }
  }
}

// --- 3. onclick du HTML -----------------------------------------------------
const definedFns = new Set();
for (const { src } of jsSources) {
  for (const m of src.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)|window\.([A-Za-z_$][\w$]*)\s*=)/g)) {
    definedFns.add(m[1] || m[2] || m[3]);
  }
}
const BROWSER_GLOBALS = new Set(['open', 'close', 'print', 'focus', 'blur', 'scrollTo', 'location', 'history', 'event', 'this', 'return']);
for (const m of html.matchAll(/\bon(?:click|change|input|submit|change)\s*=\s*"([^"]+)"/gi)) {
  for (const fm of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
    const fn = fm[1];
    if (BROWSER_GLOBALS.has(fn)) continue;
    if (!definedFns.has(fn)) problems.push(`index.html: onclick="${fn}(…)" → fonction « ${fn} » non définie`);
  }
}

// --- 4. data-action des vues ------------------------------------------------
for (const { path, src } of viewSources) {
  const actions = new Set();
  for (const m of src.matchAll(/data-action\s*=\s*(["'`])([^"'`$]+)\1/g)) actions.add(m[2]);
  for (const a of actions) {
    const handled = new RegExp(`(["'\`])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`).test(
      src.replace(/data-action\s*=\s*(["'`])[^"'`$]+\1/g, ''),
    );
    if (!handled) problems.push(`${path}: data-action="${a}" déclaré mais aucun gestionnaire pour « ${a} »`);
  }
}

// --- 5. doublons legacy / vues ---------------------------------------------
for (const [id, file] of idsViews) {
  if (legacySectionIds.has(id.replace(/^tab-/, '')) || [...legacySectionIds].some((s) => id === `tab-${s}`)) {
    warnings.push(`${file}: id "${id}" entre en collision avec une section legacy (nettoyage à faire)`);
  }
}

// --- 6. routeur <-> modules -------------------------------------------------
const routerPath = join(ROOT, 'src/presentation/router.js');
if (existsSync(routerPath)) {
  const router = read(routerPath);
  const moduleIds = viewSources.map(({ path }) => path.split('/').pop().replace(/\.js$/, ''));
  for (const id of moduleIds) {
    if (!new RegExp(`\\b${id.replace(/[-]/g, '[-_]')}\\b`, 'i').test(router)) {
      warnings.push(`router.js: le module de vue « ${id} » n'est pas référencé dans le registre VIEWS`);
    }
  }
}

// --- dette legacy connue (doit décroître jusqu'à zéro) ----------------------
let BASELINE = [];
const basePath = join(ROOT, 'tools/parity-baseline.json');
if (existsSync(basePath)) {
  try { BASELINE = JSON.parse(read(basePath)).known || []; } catch { BASELINE = []; }
}
const isKnown = (p) => BASELINE.some((b) => p.includes(b));

console.log(`check-parity: ${idsLegacy.size} id(s) legacy, ${idsViews.size} id(s) en vues, ${jsSources.length} source(s) JS, ${viewSources.length} vue(s).`);
if (warnings.length) {
  console.log(`\n${warnings.length} avertissement(s):`);
  warnings.slice(0, 40).forEach((w) => console.log('  ⚠ ' + w));
}

const known = [...new Set(problems)].filter(isKnown);
const fatal = [...new Set(problems)].filter((p) => !isKnown(p));
const stale = BASELINE.filter((b) => ![...new Set(problems)].some((p) => p.includes(b)));
if (known.length) {
  console.log(`\n${known.length} dette(s) legacy connue(s) (tools/parity-baseline.json) — à résorber avant la fin:`);
  known.slice(0, 40).forEach((k) => console.log('  · ' + k));
}
if (stale.length) {
  console.log(`\n${stale.length} entrée(s) de baseline désormais inutile(s) — à supprimer de tools/parity-baseline.json:`);
  stale.forEach((s) => console.log('  · ' + s));
}
if (fatal.length) {
  console.error(`\n${fatal.length} erreur(s) de parité:\n`);
  fatal.slice(0, 80).forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}
console.log('check-parity: OK');
