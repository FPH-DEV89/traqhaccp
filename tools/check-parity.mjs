#!/usr/bin/env node
/**
 * check-parity.mjs — Parité patisserie.html ↔ js/patisserie/*.js.
 *
 * Vérifie, sans navigateur, que les liaisons DOM ne sont pas orphelines entre
 * la page livrée et ses modules JS :
 *   1. ids passés à getElementById()/querySelector('#…') existent dans patisserie.html
 *      ou sont créés dynamiquement dans js/patisserie/*.js ;
 *   2. onclick="fn(…)" du HTML correspondent à une fonction définie dans js/patisserie ;
 *   3. data-* et attributs data-action déclarés ont un gestionnaire identifiable.
 *
 * Baseline (tools/patisserie-parity-baseline.json) :
 *   Les écarts pré-existants y sont listés ; ils NE PEUVENT QU'DÉCROÎTRE.
 *   Toute NOUVELLE divergence échoue (exit 1).
 *   Pour mettre à jour la baseline après correction : supprimer l'entrée correspondante.
 *
 * Exit 1 si erreur bloquante (nouvelle divergence hors baseline).
 * Ne dépend plus de src/presentation/views, ni de src/presentation/router.js.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'dist']);

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

// --- sources ----------------------------------------------------------------
const htmlPath = join(ROOT, 'patisserie.html');
const html = existsSync(htmlPath) ? read(htmlPath) : '';

// js/patisserie/*.js — modules de l'app livrée
const jsDir = join(ROOT, 'js/patisserie');
const jsFiles = existsSync(jsDir) ? walk(jsDir).filter((f) => extname(f) === '.js') : [];

// src/ vivant (constants.js, haccp_norms.js, config.js, supabase_client.js, connexion.js, icons.js, ui.js)
const srcFiles = walk(join(ROOT, 'src')).filter((f) => extname(f) === '.js');

// scripts inline de patisserie.html
const inlineScripts = [];
{
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\btype\s*=\s*["'](application\/json|importmap|text\/template)["']/i.test(m[1])) continue;
    if (m[2] && m[2].trim().length > 5) inlineScripts.push(m[2]);
  }
}

const allJsSources = [
  ...jsFiles.map((f) => ({ path: relative(ROOT, f), src: read(f) })),
  ...srcFiles.map((f) => ({ path: relative(ROOT, f), src: read(f) })),
  ...inlineScripts.map((src, i) => ({ path: `patisserie.html <script>#${i + 1}`, src })),
];

// --- 1. inventaire des ids --------------------------------------------------
const idRe = /\bid\s*=\s*(["'`])([^"'`$]+?)\1/g;
const idsHtml = new Set();
const idsJs = new Set();

for (const m of html.matchAll(idRe)) idsHtml.add(m[2]);
for (const { src } of allJsSources) for (const m of src.matchAll(idRe)) idsJs.add(m[2]);

const problems = [];
const warnings = [];

// --- 2. références DOM orphelines -------------------------------------------
const refRe = /getElementById\s*\(\s*(["'`])([^"'`]+)\1\s*\)|querySelector(?:All)?\s*\(\s*(["'`])#([A-Za-z0-9_-]+)\3/g;
for (const { path, src } of allJsSources) {
  let m;
  while ((m = refRe.exec(src))) {
    const id = m[2] || m[4];
    if (!id) continue;
    if (id.includes('${') || id.includes('+')) continue; // dynamique, non vérifiable
    if (!idsHtml.has(id) && !idsJs.has(id)) {
      problems.push(`${path}: référence DOM orpheline → #${id} (aucun id="${id}" trouvé)`);
    }
  }
}

// --- 3. onclick du HTML -----------------------------------------------------
const definedFns = new Set();
for (const { src } of allJsSources) {
  for (const m of src.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)|window\.([A-Za-z_$][\w$]*)\s*=)/g)) {
    definedFns.add(m[1] || m[2] || m[3]);
  }
}
const BROWSER_GLOBALS = new Set(['open', 'close', 'print', 'focus', 'blur', 'scrollTo',
  'location', 'history', 'event', 'this', 'return', 'true', 'false',
  'getElementById', 'querySelector', 'setTimeout', 'clearTimeout', 'console']);
for (const m of html.matchAll(/\bon(?:click|change|input|submit|change)\s*=\s*"([^"]+)"/gi)) {
  for (const fm of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
    const fn = fm[1];
    if (BROWSER_GLOBALS.has(fn)) continue;
    if (!definedFns.has(fn)) {
      problems.push(`patisserie.html: onclick="${fn}(…)" → fonction « ${fn} » non définie dans js/patisserie`);
    }
  }
}

// --- 4. data-action des js (vérification légère) ----------------------------
for (const { path, src } of allJsSources) {
  const actions = new Set();
  for (const m of src.matchAll(/data-action\s*=\s*(["'`])([^"'`$]+)\1/g)) actions.add(m[2]);
  for (const a of actions) {
    const handled = new RegExp(`(["'\`])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`).test(
      src.replace(/data-action\s*=\s*(["'`])[^"'`$]+\1/g, ''),
    );
    if (!handled) {
      warnings.push(`${path}: data-action="${a}" déclaré mais aucun gestionnaire évident pour « ${a} »`);
    }
  }
}

// --- baseline : les écarts pré-existants ne bloquent pas --------------------
const basePath = join(ROOT, 'tools/patisserie-parity-baseline.json');
let BASELINE = [];
if (existsSync(basePath)) {
  try { BASELINE = JSON.parse(read(basePath)).known || []; } catch { BASELINE = []; }
}
const isKnown = (p) => BASELINE.some((b) => p.includes(b));

console.log(`check-parity: ${idsHtml.size} id(s) HTML · ${idsJs.size} id(s) JS · ${allJsSources.length} source(s) · ${jsFiles.length} modules js/patisserie.`);
if (warnings.length) {
  console.log(`\n${warnings.length} avertissement(s):`);
  warnings.slice(0, 40).forEach((w) => console.log('  ⚠ ' + w));
}

const known = [...new Set(problems)].filter(isKnown);
const fatal = [...new Set(problems)].filter((p) => !isKnown(p));
const stale = BASELINE.filter((b) => ![...new Set(problems)].some((p) => p.includes(b)));

if (known.length) {
  console.log(`\n${known.length} dette(s) legacy connue(s) (tools/patisserie-parity-baseline.json) — à résorber :`);
  known.slice(0, 40).forEach((k) => console.log('  · ' + k));
}
if (stale.length) {
  console.log(`\n${stale.length} entrée(s) de baseline désormais inutile(s) — à supprimer de tools/patisserie-parity-baseline.json:`);
  stale.forEach((s) => console.log('  · ' + s));
}
if (fatal.length) {
  console.error(`\n${fatal.length} erreur(s) de parité (nouvelles divergences) :\n`);
  fatal.slice(0, 80).forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}
console.log('check-parity: OK');
