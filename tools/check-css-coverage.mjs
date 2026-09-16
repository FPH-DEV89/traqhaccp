#!/usr/bin/env node
/**
 * check-css-coverage.mjs — Toute classe utilisée dans les vues (et dans index.html après
 * migration) doit exister dans une feuille du design system.
 *
 * Détecte les classes littérales dans les attributs class="…" des modules de vue et de
 * index.html, puis vérifie qu'au moins un fichier de css/ contient un sélecteur `.classe`.
 * Les classes d'état (.is-*, .has-*) et les crochets JS (.js-*) sont signalés à part.
 * Sortie : rapport. Exit 1 si une classe « structurelle » (utilisée ≥ 2 fois) est absente.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'specs', 'design']);
const MIGRATION_DONE = existsSync(join(ROOT, 'docs/MIGRATION_COMPLETE'));

function walk(dir, out = []) {
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const n of entries) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// --- CSS disponible ---------------------------------------------------------
const cssFiles = walk(join(ROOT, 'css')).filter((f) => extname(f) === '.css');
const cssText = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const defined = new Set();
for (const m of cssText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);

// --- sources à balayer ------------------------------------------------------
const targets = [];
const viewDir = join(ROOT, 'src/presentation/views');
if (existsSync(viewDir)) targets.push(...walk(viewDir).filter((f) => extname(f) === '.js'));
for (const f of ['src/presentation/shell.js', 'src/presentation/ui.js', 'src/presentation/icons.js']) {
  const p = join(ROOT, f); if (existsSync(p)) targets.push(p);
}
if (MIGRATION_DONE && existsSync(join(ROOT, 'index.html'))) targets.push(join(ROOT, 'index.html'));

// --- extraction -------------------------------------------------------------
const usage = new Map(); // classe -> Set(fichiers)
const classRe = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
for (const f of targets) {
  const rel = relative(ROOT, f);
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(classRe)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    // retire les interpolations ${...} : elles produisent des classes dynamiques
    for (const tok of raw.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      const cls = tok.trim();
      if (!cls || cls.includes('/') || cls.startsWith('${')) continue;
      if (!usage.has(cls)) usage.set(cls, new Set());
      usage.get(cls).add(rel);
    }
  }
}

// --- analyse ----------------------------------------------------------------
const missing = [];
const statey = [];
const utilityish = [];
for (const [cls, files] of usage) {
  if (defined.has(cls)) continue;
  if (/^(is|has)-/.test(cls) || /^js-/.test(cls)) { statey.push([cls, files]); continue; }
  if (cls.startsWith('data-') || cls === 'group' || cls.includes(':')) { utilityish.push([cls, files]); continue; }
  missing.push([cls, files]);
}

const structural = missing.filter(([, f]) => f.size >= 2);
const single = missing.filter(([, f]) => f.size < 2);

console.log(`check-css-coverage: ${usage.size} classe(s) utilisée(s) · ${defined.size} classe(s) définie(s) en CSS · ${targets.length} fichier(s) balayé(s).`);
if (statey.length) console.log(`  états/crochets JS non stylés (normal si pilotés par le JS) : ${statey.length}`);
if (single.length) {
  console.log(`\n${single.length} classe(s) utilisée(s) une seule fois et absente du CSS (à vérifier) :`);
  single.slice(0, 30).forEach(([c, f]) => console.log(`  · .${c}  (${[...f][0]})`));
}
if (structural.length) {
  console.error(`\n${structural.length} classe(s) STRUCTURELLE(S) absente(s) du CSS (utilisée(s) dans ≥ 2 fichiers) :`);
  structural.slice(0, 60).forEach(([c, f]) => console.error(`  ✗ .${c}  →  ${[...f].join(', ')}`));
  process.exit(1);
}
console.log('check-css-coverage: OK');
