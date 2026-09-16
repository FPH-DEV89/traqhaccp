#!/usr/bin/env node
/**
 * check-design.mjs — Garde-fou du design system « REGISTRE » (docs/DESIGN.md).
 *
 * Périmètre :
 *   - css/**\/*.css                       (interdits + couleurs en dur hors tokens.css)
 *   - src/presentation/**\/*.js           (interdits dans le markup généré)
 *   - index.html                          (seulement si docs/MIGRATION_COMPLETE existe)
 *
 * Sortie : violations fichier:ligne. Exit 1 si au moins une violation.
 * Dérogation ciblée : ajouter  /* design-ignore: raison *\/  sur la ligne concernée.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'dist']);
const MIGRATION_DONE = existsSync(join(ROOT, 'docs/MIGRATION_COMPLETE'));

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
  [/\brounded-(xl|2xl|3xl)\b/, 'rayon > 6px interdit (--r-3 max)'],
  [/\brounded-full\b/, 'pilule / pastille ronde interdite (.mark carré)'],
  [/\b(backdrop-blur\w*|backdrop-filter)\b/, 'glassmorphism interdit'],
  [/\b(bg-gradient-to-\w+|linear-gradient|radial-gradient|conic-gradient)\b/, 'dégradé interdit'],
  [/\banimate-(pulse|bounce|ping|spin)\b/, 'animation décorative interdite (.skeleton autorisé en CSS)'],
  [/\bshadow-(sm|md|lg|xl|2xl|inner)\b/, 'ombre Tailwind interdite (--sh-1 / --sh-2 seulement)'],
  [/\bborder-2\b/, 'bordure épaisse interdite (filet 1px)'],
  [/\bscale-1(05|10)\b|\bhover:scale-\d/, 'agrandissement au survol interdit'],
  [/\bfont-(inter|sans)\b|\bInter\b(?! Tight)/, 'police Inter interdite (Archivo / Instrument Serif / IBM Plex Mono)'],
  [/\b(class|className)\s*=\s*["'][^"']*\bfa-[a-z-]+/, 'icône Font Awesome interdite (sprite SVG maison)'],
  [/(?<![\w.$])(window\.)?alert\s*\(/, 'alert() interdit (.callout / .field__error)'],
  [/(?<![\w.$])(window\.)?confirm\s*\(/, 'confirm() interdit (ui.confirm)'],
  [/z-index\s*:\s*(?:[1-9]\d{2,}|\d{4,})/, 'z-index arbitraire interdit (échelle --z-*)'],
  [/\bopacity-5?0\b/, 'opacité décorative interdite'],
  [/\b(blur-(sm|md|lg|xl|2xl|3xl))\b/, 'flou décoratif interdit'],
  [/style\s*=\s*["'][^"']*(background|color)\s*:\s*#/, 'couleur en dur dans un style inline (var(--…) requis)'],
];

const ALLOWED_SYMBOLS = new Set([
  '✓', '✗', '·', '–', '—', '→', '←', '↑', '↓', '№', '≥', '≤', '±', '°', '×', '÷', '‰',
  'µ', '²', '³', '«', '»', '’', '…', '⌘', '⌀', '½', '¼', '¾', '─', '│', '┌', '┐', '└', '┘',
]);

/** Emojis réellement pictographiques (on ne bannit pas les symboles typographiques). */
const EMOJI_RANGES = [
  /\u{1F000}-\u{1FAFF}/u, // pictogrammes & symboles supplémentaires
  /\u{2600}-\u{26FF}/u,   // symboles divers (☀ ♻ ⚠ …)
  /\u{2700}-\u{27BF}/u,   // dingbats (✂ ✅ …)
  /\u{2B00}-\u{2BFF}/u,   // flèches/symboles divers
  /\u{FE0F}/u,            // sélecteur de variation (force le rendu emoji)
  /\u{1F1E6}-\u{1F1FF}/u, // indicatifs régionaux (drapeaux)
  /[\u{23F0}-\u{23F3}\u{231A}\u{231B}\u{2699}]/u, // horloges / engrenage
];

function findEmoji(line) {
  for (const ch of line) {
    if (ALLOWED_SYMBOLS.has(ch)) continue;
    if (EMOJI_RANGES.some((rx) => rx.test(ch))) return ch;
  }
  return null;
}

/** Retire les commentaires (blocs puis lignes) pour ne pas valider du code commenté. */
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
function scan(path, { cssOnly = false, jsOnly = false } = {}) {
  const rel = relative(ROOT, path);
  const isTokens = rel.endsWith('css/tokens.css');
  const raw = readFileSync(path, 'utf8');
  const rawLines = raw.split('\n');
  const lines = stripComments(raw, rel.endsWith('.css')).split('\n');
  // Dérogation de fichier : documents imprimés autonomes (rapport, étiquettes) ayant leur
  // propre <style> interne — les couleurs littérales y sont légitimes (impression hors ligne).
  const colorExempt = rawLines.slice(0, 30).join('\n').includes('design-ignore-file:couleurs');
  lines.forEach((line, i) => {
    const at = (msg) => violations.push(`${rel}:${i + 1}  ${msg}`);
    if (/design-ignore/.test(rawLines[i] || '')) return;
    for (const [rx, why] of BANS) {
      if (rx.test(line)) at(why + '  →  ' + line.trim().slice(0, 110));
    }
    const emo = findEmoji(line);
    if (emo) at(`emoji « ${emo} » interdit dans l'UI`);
    if (!jsOnly && !isTokens && !colorExempt) {
      // couleurs en dur : autorisées uniquement dans tokens.css
      const hex = line.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hex) {
        const okHex = hex.every((h) => /^#(?:fff|ffffff|000|000000)$/i.test(h));
        if (!okHex) at(`couleur en dur ${hex.join(', ')} (tokens.css uniquement, sinon var(--…))`);
      }
      if (/\brgba?\(\s*\d/.test(line) && !isTokens) at('couleur en dur rgb()/rgba() (tokens.css uniquement)');
    }
  });
}

// ---- périmètre -------------------------------------------------------------
const cssFiles = walk(join(ROOT, 'css')).filter((f) => extname(f) === '.css');
cssFiles.forEach((f) => scan(f));

const presFiles = walk(join(ROOT, 'src/presentation')).filter((f) => extname(f) === '.js');
presFiles.forEach((f) => scan(f));

if (MIGRATION_DONE && existsSync(join(ROOT, 'index.html'))) scan(join(ROOT, 'index.html'));

// ---- contrôles structurels des modules de vue ------------------------------
const viewDir = join(ROOT, 'src/presentation/views');
const views = existsSync(viewDir) ? walk(viewDir).filter((f) => extname(f) === '.js') : [];
for (const v of views) {
  const src = readFileSync(v, 'utf8');
  const rel = relative(ROOT, v);
  for (const need of ['meta', 'render', 'mount', 'unmount']) {
    const ok = new RegExp(`export\\s+(?:const|function|async function)\\s+${need}\\b|export\\s*\\{[^}]*\\b${need}\\b`).test(src);
    if (!ok) violations.push(`${rel}  contrat de vue incomplet : « ${need} » doit être exporté`);
  }
  if (/\bgetElementById\s*\(/.test(src)) {
    violations.push(`${rel}  getElementById interdit dans un module de vue (utiliser root.querySelector)`);
  }
}

console.log(`check-design: ${cssFiles.length} fichier(s) CSS, ${presFiles.length} module(s) présentation, ${views.length} vue(s).`);
if (violations.length) {
  console.error(`\n${violations.length} violation(s) du design system:\n`);
  violations.slice(0, 120).forEach((v) => console.error('  ' + v));
  if (violations.length > 120) console.error(`  … +${violations.length - 120} autres`);
  process.exit(1);
}
console.log('check-design: OK');
