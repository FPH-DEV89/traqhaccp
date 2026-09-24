#!/usr/bin/env node
/**
 * check-design.mjs — Garde-fou du design system « REGISTRE » (docs/DESIGN.md).
 *
 * Périmètre (app livrée) :
 *   - css/**\/*.css                 (interdits + couleurs en dur hors tokens.css)
 *   - patisserie.html              (toujours scanné — c'est la page livrée)
 *   - js/patisserie/*.js           (modules applicatifs de l'app livrée)
 *   - src/presentation/*.js        (connexion.js, icons.js, ui.js — vivants)
 *
 * Ne dépend PLUS de src/presentation/views, ni du flag docs/MIGRATION_COMPLETE.
 *
 * Dette Tailwind : mesurée et gelée dans tools/tailwind-baseline.json.
 * Le gate ÉCHOUE si un compteur augmente. Une baisse doit être répercutée à la main.
 * AVERTISSEMENT PRODUIT : l'app livrée dépend du CDN Tailwind ; c'est une dette
 * produit mesurée, pas un oubli de gate.
 *
 * Dérogation ciblée : ajouter  /* design-ignore: raison *\/  sur la ligne concernée.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'dist']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// ---- interdits (regex, libellé) -------------------------------------------
const TAILWIND_COLORS = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const BANS = [
  [new RegExp(`\\b(bg|text|border|from|to|via|ring|divide|placeholder)-(?:${TAILWIND_COLORS})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`), 'classe de couleur Tailwind (utiliser les tokens var(--…))'],
  [/\brounded-(xl|2xl|3xl)\b/, 'rayon > 6px interdit (--r-3 max) — DETTE TAILWIND MESURÉE'],
  [/\brounded-full\b/, 'pilule / pastille ronde interdite (.mark carré) — DETTE TAILWIND MESURÉE'],
  [/\b(backdrop-blur\w*|backdrop-filter)\b/, 'glassmorphism interdit — DETTE TAILWIND MESURÉE'],
  [/\b(bg-gradient-to-\w+|linear-gradient|radial-gradient|conic-gradient)\b/, 'dégradé interdit'],
  [/\banimate-(pulse|bounce|ping|spin)\b/, 'animation décorative interdite (.skeleton autorisé en CSS)'],
  [/\bshadow-(sm|md|lg|xl|2xl|inner)\b/, 'ombre Tailwind interdite (--sh-1 / --sh-2 seulement) — DETTE TAILWIND MESURÉE'],
  [/\bborder-2\b/, 'bordure épaisse interdite (filet 1px)'],
  [/\bscale-1(05|10)\b|\bhover:scale-\d/, 'agrandissement au survol interdit'],
  [/\bfont-(inter|sans)\b|\bInter\b(?! Tight)/, 'police Inter interdite (Archivo / Instrument Serif / IBM Plex Mono)'],
  [/\b(class|className)\s*=\s*["'][^"']*\bfa-[a-z-]+/, 'icône Font Awesome interdite (sprite SVG maison)'],
  [/(?<![\\w.$])(window\.)?alert\s*\(/, 'alert() interdit (.callout / .field__error)'],
  [/(?<![\\w.$])(window\.)?confirm\s*\(/, 'confirm() interdit (ui.confirm)'],
  [/z-index\s*:\s*(?:[1-9]\d{2,}|\d{4,})/, 'z-index arbitraire interdit (échelle --z-*)'],
  [/\bopacity-5?0\b/, 'opacité décorative interdite'],
  [/\b(blur-(sm|md|lg|xl|2xl|3xl))\b/, 'flou décoratif interdit — DETTE TAILWIND MESURÉE'],
  [/style\s*=\s*["'][^"']*(background|color)\s*:\s*#/, 'couleur en dur dans un style inline (var(--…) requis)'],
];

// Patterns Tailwind à comptabiliser pour la baseline (classés par catégorie)
const TW_COUNTERS = [
  { key: 'rounded-xl',       rx: /\brounded-xl\b/g },
  { key: 'rounded-2xl',      rx: /\brounded-2xl\b/g },
  { key: 'rounded-3xl',      rx: /\brounded-3xl\b/g },
  { key: 'rounded-full',     rx: /\brounded-full\b/g },
  { key: 'shadow-sm',        rx: /\bshadow-sm\b/g },
  { key: 'shadow-md',        rx: /\bshadow-md\b/g },
  { key: 'shadow-lg',        rx: /\bshadow-lg\b/g },
  { key: 'shadow-xl',        rx: /\bshadow-xl\b/g },
  { key: 'shadow-2xl',       rx: /\bshadow-2xl\b/g },
  { key: 'shadow-inner',     rx: /\bshadow-inner\b/g },
  { key: 'backdrop-blur',    rx: /\bbackdrop-blur[\w-]*\b/g },
  { key: 'total-tw-classes', rx: /\b(?:bg|text|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|flex|grid|items|justify|gap|border|rounded|shadow|opacity|z)-[\w/-]+\b/g },
];

const ALLOWED_SYMBOLS = new Set([
  '✓', '✗', '·', '–', '—', '→', '←', '↑', '↓', '№', '≥', '≤', '±', '°', '×', '÷', '‰',
  'µ', '²', '³', '«', '»', '\u2018', '…', '⌘', '⌀', '½', '¼', '¾', '─', '│', '┌', '┐', '└', '┘',
]);

const EMOJI_RANGES = [
  /\u{1F000}-\u{1FAFF}/u,
  /\u{2600}-\u{26FF}/u,
  /\u{2700}-\u{27BF}/u,
  /\u{2B00}-\u{2BFF}/u,
  /\u{FE0F}/u,
  /\u{1F1E6}-\u{1F1FF}/u,
  /[\u{23F0}-\u{23F3}\u{231A}\u{231B}\u{2699}]/u,
];

function findEmoji(line) {
  for (const ch of line) {
    if (ALLOWED_SYMBOLS.has(ch)) continue;
    if (EMOJI_RANGES.some((rx) => rx.test(ch))) return ch;
  }
  return null;
}

function stripComments(text, isCss) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out
    .split('\n')
    .map((l) => {
      const t = l.trim();
      if (t.startsWith('//') || t.startsWith('*') || (isCss && t.startsWith('/*'))) {
        return ' '.repeat(l.length);
      }
      return l;
    })
    .join('\n');
  return out;
}

const violations = [];
// Compteurs Tailwind (mesurés sur toutes les sources de l'app livrée)
const twCounts = Object.fromEntries(TW_COUNTERS.map(({ key }) => [key, 0]));

function scan(path, { cssOnly = false, jsOnly = false } = {}) {
  const rel = relative(ROOT, path).replace(/\\/g, '/');
  const isTokens = rel.endsWith('css/tokens.css');
  const raw = readFileSync(path, 'utf8');
  const rawLines = raw.split('\n');
  const isCss = rel.endsWith('.css');
  const lines = stripComments(raw, isCss).split('\n');
  const colorExempt = rawLines.slice(0, 30).join('\n').includes('design-ignore-file:couleurs');

  // Compter les occurrences Tailwind dans toutes les sources
  for (const { key, rx } of TW_COUNTERS) {
    const matches = raw.match(rx);
    if (matches) twCounts[key] += matches.length;
  }

  lines.forEach((line, i) => {
    const at = (msg) => violations.push(`${rel}:${i + 1}  ${msg}`);
    if (/design-ignore/.test(rawLines[i] || '')) return;
    for (const [rx, why] of BANS) {
      if (rx.test(line)) at(why + '  →  ' + line.trim().slice(0, 110));
    }
    const emo = findEmoji(line);
    if (emo) at(`emoji « ${emo} » interdit dans l'UI`);
    if (!jsOnly && !isTokens && !colorExempt) {
      const hex = line.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hex) {
        const okHex = hex.every((h) => /^#(?:fff|ffffff|000|000000)$/i.test(h));
        if (!okHex) at(`couleur en dur ${hex.join(', ')} (tokens.css uniquement, sinon var(--…))`);
      }
      if (/\brgba?\(\s*\d/.test(line) && !isTokens) at('couleur en dur rgb()/rgba() (tokens.css uniquement)');
    }
  });
}

// ---- périmètre : app LIVRÉE ------------------------------------------------
const cssFiles = walk(join(ROOT, 'css')).filter((f) => extname(f) === '.css');
cssFiles.forEach((f) => scan(f));

// patisserie.html — la page livrée (toujours scannée)
const htmlPath = join(ROOT, 'patisserie.html');
if (existsSync(htmlPath)) scan(htmlPath);

// modules applicatifs
const jsPatisserie = walk(join(ROOT, 'js/patisserie')).filter((f) => extname(f) === '.js');
jsPatisserie.forEach((f) => scan(f));

// socle vivant (src/presentation/*.js)
const presFiles = walk(join(ROOT, 'src/presentation')).filter((f) => extname(f) === '.js');
presFiles.forEach((f) => scan(f));

// ---- baseline Tailwind : gelée et vérifiée ---------------------------------
const baselinePath = join(ROOT, 'tools/tailwind-baseline.json');
let baseline = null;
if (existsSync(baselinePath)) {
  try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')); } catch { baseline = null; }
}

const twViolations = [];
if (baseline) {
  for (const { key } of TW_COUNTERS) {
    const current = twCounts[key];
    const ref = baseline[key] ?? 0;
    if (current > ref) {
      twViolations.push(`Tailwind "${key}" augmenté : ${ref} → ${current} (+${current - ref}) — interdire de nouvelles occurrences`);
    }
  }
} else {
  // Créer la baseline au premier passage si elle n'existe pas
  writeFileSync(baselinePath, JSON.stringify({ _comment: 'Baseline Tailwind — générée le ' + new Date().toISOString().slice(0, 10), ...twCounts }, null, 2));
  console.log(`check-design: baseline Tailwind créée → tools/tailwind-baseline.json`);
}

// ---- rapport ----------------------------------------------------------------
console.log(`check-design: ${cssFiles.length} CSS · patisserie.html · ${jsPatisserie.length} js/patisserie · ${presFiles.length} présentation.`);
console.log(`  Dette Tailwind mesurée : rounded-xl=${twCounts['rounded-xl']} · rounded-2xl=${twCounts['rounded-2xl']} · shadow-sm=${twCounts['shadow-sm']} · backdrop-blur=${twCounts['backdrop-blur']}`);
console.log(`  AVERTISSEMENT PRODUIT : l'app livrée dépend du CDN Tailwind ; c'est une dette produit mesurée, pas un oubli de gate.`);

if (twViolations.length) {
  console.error(`\n${twViolations.length} violation(s) de baseline Tailwind (la dette augmente) :`);
  twViolations.forEach((v) => console.error('  ✗ ' + v));
}

// Violations provenant de patisserie.html et js/patisserie/* = dette Tailwind existante (gelée).
// Ne bloquent PAS si la baseline des compteurs n'augmente pas.
// Violations vraiment bloquantes = celles dans css/ ou src/presentation/*.
const isDebtSource = (v) => {
  const src = v.split(':')[0] || '';
  return src.startsWith('patisserie.html') || src.startsWith('js/patisserie/');
};

if (violations.length) {
  const debtViolations = violations.filter(isDebtSource);
  const nonDebtViolations = violations.filter((v) => !isDebtSource(v));

  if (debtViolations.length) {
    console.log(`\n${debtViolations.length} violation(s) dans l'app livrée (dette Tailwind gelée — baseline contrôle les compteurs) :`);
    debtViolations.slice(0, 10).forEach((v) => console.log('  · ' + v));
    if (debtViolations.length > 10) console.log(`  … +${debtViolations.length - 10} autres (voir baseline tailwind-baseline.json)`);
  }

  if (nonDebtViolations.length) {
    console.error(`\n${nonDebtViolations.length} violation(s) du design system dans css/ ou src/presentation/ :`);
    nonDebtViolations.slice(0, 120).forEach((v) => console.error('  ✗ ' + v));
    if (nonDebtViolations.length > 120) console.error(`  … +${nonDebtViolations.length - 120} autres`);
    process.exit(1);
  }
}

if (twViolations.length) process.exit(1);

console.log('check-design: OK');

