#!/usr/bin/env node
/**
 * check-syntax.mjs — Vérifie la syntaxe de tout le JavaScript de l'app LIVRÉE.
 *
 * Périmètre (app livrée = patisserie.html + js/patisserie/*.js) :
 *   - js/patisserie/*.js          (8 modules applicatifs)
 *   - src/domain/*.js             (domaine vivant)
 *   - src/infrastructure/*.js     (config + supabase_client)
 *   - src/presentation/*.js       (connexion, icons, ui)
 *   - tools/*.mjs                 (outillage)
 *   - sw.js                       (service worker)
 *   - le <script> inline de patisserie.html (extrait dans un fichier temporaire)
 *
 * Ne lit PLUS index.html (supprimé).
 * Sortie : liste des erreurs. Exit 1 si au moins une erreur.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'dist']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => ['.js', '.mjs'].includes(extname(f)));
const tmp = mkdtempSync(join(tmpdir(), 'traq-syntax-'));
const errors = [];
let checked = 0;

function checkFile(path, label) {
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    checked++;
  } catch (e) {
    const msg = (e.stderr || e.stdout || '').toString().split('\n').slice(0, 12).join('\n').trim();
    errors.push(`✗ ${label}\n${msg}`);
  }
}

files.forEach((f) => checkFile(f, relative(ROOT, f)));

// --- scripts inline de patisserie.html ---
const htmlPath = join(ROOT, 'patisserie.html');
let html = '';
try { html = readFileSync(htmlPath, 'utf8'); } catch { /* pas de patisserie.html */ }
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
let n = 0;
while ((m = re.exec(html))) {
  const body = m[2];
  if (!body || body.trim().length < 5) continue;
  if (/\btype\s*=\s*["'](application\/json|importmap|text\/template)["']/i.test(m[1])) continue;
  n++;
  const p = join(tmp, `inline-${n}.mjs`);
  writeFileSync(p, body);
  checkFile(p, `patisserie.html <script> inline #${n}`);
}

console.log(`check-syntax: ${checked} fichier(s) JS valides, ${files.length} source(s), ${n} script(s) inline.`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) de syntaxe:\n`);
  errors.forEach((e) => console.error(e + '\n'));
  process.exit(1);
}
console.log('check-syntax: OK');
