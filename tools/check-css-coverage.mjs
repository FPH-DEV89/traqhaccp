#!/usr/bin/env node
/**
 * check-css-coverage.mjs — Toute classe « design system » utilisée dans l'app livrée
 * doit exister dans une feuille de css/.
 *
 * Périmètre (app livrée) :
 *   - patisserie.html              (la page livrée)
 *   - js/patisserie/*.js           (modules applicatifs)
 *   - src/presentation/ui.js       (composants vivants)
 *   - src/presentation/icons.js    (sprite SVG vivant)
 *
 * Ne dépend PLUS de src/presentation/views, src/presentation/shell.js,
 * ni du flag docs/MIGRATION_COMPLETE.
 *
 * Les classes Tailwind (détectées par leurs préfixes utilitaires ou leur longueur)
 * sont listées séparément et ne font PAS échouer le gate — elles sont couvertes par le
 * CDN Tailwind chargé par patisserie.html (dette produit mesurée et gelée dans
 * tools/tailwind-baseline.json).
 *
 * Baseline (tools/css-coverage-baseline.json) :
 *   Écarts mesurés aujourd'hui. Ne peuvent que décroître. Toute NOUVELLE classe
 *   structurelle absente (utilisée ≥ 2 fichiers) fait échouer le gate.
 *
 * Sortie : rapport. Exit 1 si une classe structurelle inconnue apparaît hors baseline.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'specs', 'design']);

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

// --- sources de l'app livrée ------------------------------------------------
const targets = [];
const htmlPath = join(ROOT, 'patisserie.html');
if (existsSync(htmlPath)) targets.push(htmlPath);

const jsDir = join(ROOT, 'js/patisserie');
if (existsSync(jsDir)) targets.push(...walk(jsDir).filter((f) => extname(f) === '.js'));

for (const f of ['src/presentation/ui.js', 'src/presentation/icons.js', 'src/presentation/connexion.js']) {
  const p = join(ROOT, f); if (existsSync(p)) targets.push(p);
}

// --- extraction des classes -------------------------------------------------
const usage = new Map(); // classe → Set(fichiers)
const classRe = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
for (const f of targets) {
  const rel = relative(ROOT, f);
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(classRe)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    for (const tok of raw.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      const cls = tok.trim();
      if (!cls || cls.includes('/') || cls.startsWith('${')) continue;
      if (!usage.has(cls)) usage.set(cls, new Set());
      usage.get(cls).add(rel);
    }
  }
}

// Heuristique Tailwind : préfixes utilitaires connus ou classes multi-segments
const TW_PREFIXES = ['bg-', 'text-', 'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-',
  'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-', 'w-', 'h-', 'max-w-', 'min-w-',
  'max-h-', 'min-h-', 'flex', 'grid-', 'items-', 'justify-', 'gap-', 'space-',
  'border', 'rounded', 'shadow', 'opacity-', 'z-', 'top-', 'bottom-', 'left-', 'right-',
  'font-', 'leading-', 'tracking-', 'break-', 'overflow-', 'whitespace-', 'truncate',
  'hidden', 'block', 'inline', 'absolute', 'relative', 'fixed', 'sticky', 'sr-only',
  'col-', 'row-', 'order-', 'aspect-', 'object-', 'ring-', 'divide-', 'cursor-',
  'select-', 'resize-', 'appearance-', 'transition', 'duration-', 'ease-', 'delay-',
  'hover:', 'focus:', 'active:', 'disabled:', 'dark:', 'sm:', 'md:', 'lg:', 'xl:',
  'group-', 'peer-', 'not-',
];
// Classes Tailwind exactes sans préfixe (liste de mots-clés fréquents)
const TW_EXACT = new Set([
  'grid', 'flex', 'hidden', 'block', 'inline', 'table', 'contents', 'flow-root',
  'uppercase', 'lowercase', 'capitalize', 'normal-case', 'italic', 'not-italic',
  'truncate', 'text-ellipsis', 'text-clip', 'underline', 'overline', 'line-through',
  'no-underline', 'antialiased', 'subpixel-antialiased',
  'shrink', 'shrink-0', 'grow', 'grow-0', 'wrap', 'nowrap',
  'overflow-auto', 'overflow-hidden', 'overflow-visible', 'overflow-scroll',
  'pointer-events-none', 'pointer-events-auto',
  'absolute', 'relative', 'fixed', 'sticky', 'static',
  'visible', 'invisible', 'collapse',
  'opacity-0', 'opacity-100',
  'group', 'peer', 'container',
  'sr-only', 'not-sr-only',
  'list-none', 'list-disc', 'list-decimal',
  'align-top', 'align-middle', 'align-bottom', 'align-baseline',
  'float-right', 'float-left', 'float-none', 'clear-both', 'clear-left', 'clear-right',
]);
const isTailwindClass = (cls) =>
  TW_PREFIXES.some((p) => cls.startsWith(p)) || TW_EXACT.has(cls);


// --- analyse ----------------------------------------------------------------
const missing = [];
const tailwindClasses = [];
const statey = [];
const utilityish = [];
for (const [cls, files] of usage) {
  if (defined.has(cls)) continue;
  if (isTailwindClass(cls)) { tailwindClasses.push([cls, files]); continue; }
  if (/^(is|has)-/.test(cls) || /^js-/.test(cls)) { statey.push([cls, files]); continue; }
  if (cls.startsWith('data-') || cls === 'group' || cls.includes(':')) { utilityish.push([cls, files]); continue; }
  missing.push([cls, files]);
}

const structural = missing.filter(([, f]) => f.size >= 2);
const single = missing.filter(([, f]) => f.size < 2);

// --- baseline ---------------------------------------------------------------
const baselinePath = join(ROOT, 'tools/css-coverage-baseline.json');
let baseline = null;
if (existsSync(baselinePath)) {
  try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')); } catch { baseline = null; }
}

const baselineKnown = baseline ? (baseline.known || []) : [];
const isKnown = (cls) => baselineKnown.includes(cls);

const newStructural = structural.filter(([cls]) => !isKnown(cls));
const knownStructural = structural.filter(([cls]) => isKnown(cls));
const staleBaseline = baselineKnown.filter((cls) => !structural.some(([c]) => c === cls));

if (!baseline) {
  // Créer la baseline au premier passage
  const baselineData = {
    _comment: 'Baseline CSS coverage — générée le ' + new Date().toISOString().slice(0, 10),
    _note: 'Classes structurelles (≥ 2 fichiers) absentes du design system CSS. Ne peuvent que décroître.',
    known: structural.map(([cls]) => cls),
  };
  writeFileSync(baselinePath, JSON.stringify(baselineData, null, 2));
  console.log(`check-css-coverage: baseline créée → ${structural.length} classe(s) structurelle(s) connues.`);
}

// --- rapport ----------------------------------------------------------------
console.log(`check-css-coverage: ${usage.size} classe(s) · ${defined.size} définie(s) en CSS · ${targets.length} fichier(s).`);
console.log(`  classes Tailwind (couvertes par CDN) : ${tailwindClasses.length} uniques`);
if (statey.length) console.log(`  états/crochets JS non stylés (normal) : ${statey.length}`);

if (single.length) {
  console.log(`\n${single.length} classe(s) utilisée(s) une seule fois et absente du CSS (à vérifier) :`);
  single.slice(0, 30).forEach(([c, f]) => console.log(`  · .${c}  (${[...f][0]})`));
}
if (knownStructural.length) {
  console.log(`\n${knownStructural.length} classe(s) structurelle(s) connues (baseline) — à résorber :`);
  knownStructural.slice(0, 30).forEach(([c]) => console.log(`  · .${c}`));
}
if (staleBaseline.length) {
  console.log(`\n${staleBaseline.length} entrée(s) de baseline résolue(s) — à supprimer de css-coverage-baseline.json:`);
  staleBaseline.forEach((c) => console.log(`  · .${c}`));
}
if (newStructural.length) {
  console.error(`\n${newStructural.length} NOUVELLE(S) classe(s) structurelle(s) absente(s) du CSS :`);
  newStructural.slice(0, 60).forEach(([c, f]) => console.error(`  ✗ .${c}  →  ${[...f].join(', ')}`));
  process.exit(1);
}
console.log('check-css-coverage: OK');
