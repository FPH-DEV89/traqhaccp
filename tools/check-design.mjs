#!/usr/bin/env node
/**
 * check-design.mjs — Garde-fou du design system « REGISTRE » (docs/DESIGN.md).
 *
 * Périmètre (app livrée) :
 *   - css/**\/*.css                 (toujours sans tolérance)
 *   - patisserie.html              (la page livrée)
 *   - js/patisserie/*.js           (modules applicatifs de l'app livrée)
 *   - src/presentation/*.js        (connexion.js, icons.js, ui.js — vivants)
 *
 * Gel des violations par règle (patisserie.html + js/patisserie/*) :
 *   Les violations dans l'app livrée sont comptées PAR RÈGLE et comparées à
 *   tools/design-violations-baseline.json. Un compte qui AUGMENTE = exit 1.
 *   Un compte qui BAISSE = avertissement (relancer avec --write-baseline).
 *   Une règle absente du baseline mais > 0 = exit 1 (nouvelle violation).
 *
 *   Interdits absolus : css/*.css et src/presentation/*.js restent scannés
 *   SANS tolérance. Toute violation y est un échec immédiat.
 *
 * Dette Tailwind : mesurée et gelée dans tools/tailwind-baseline.json.
 * Le gate ÉCHOUE si un compteur augmente. Une baisse doit être répercutée à la main.
 * AVERTISSEMENT PRODUIT : l'app livrée dépend du CDN Tailwind ; c'est une dette
 * produit mesurée, pas un oubli de gate.
 *
 * Options :
 *   --write-baseline   Réécrit design-violations-baseline.json avec les comptes mesurés
 *                      (usage manuel après correction de violations).
 *
 * Dérogation ciblée : ajouter  /* design-ignore: raison *\/  sur la ligne concernée.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'graphify-out', '.hermes', 'dist']);
const WRITE_BASELINE = process.argv.includes('--write-baseline');

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

// ---- état global du scan ---------------------------------------------------
// violations strictes (css/ + src/presentation/) → bloquantes sans baseline
const strictViolations = [];
// violations par règle dans l'app livrée (patisserie.html + js/patisserie/)
const ruleCountsDebt = {};
const ruleExamplesDebt = {};
// compteurs Tailwind (mesurés sur toutes les sources)
const twCounts = Object.fromEntries(TW_COUNTERS.map(({ key }) => [key, 0]));

function addDebtViolation(label, example) {
  ruleCountsDebt[label] = (ruleCountsDebt[label] || 0) + 1;
  if (!ruleExamplesDebt[label]) ruleExamplesDebt[label] = [];
  if (ruleExamplesDebt[label].length < 3) ruleExamplesDebt[label].push(example);
}

// ---- scan d'un fichier -----------------------------------------------------
function scan(path, { strict = false } = {}) {
  const rel = relative(ROOT, path).replace(/\\/g, '/');
  const isTokens = rel.endsWith('css/tokens.css');
  const raw = readFileSync(path, 'utf8');
  const rawLines = raw.split('\n');
  const isCss = rel.endsWith('.css');
  const lines = stripComments(raw, isCss).split('\n');
  const colorExempt = rawLines.slice(0, 30).join('\n').includes('design-ignore-file:couleurs');

  // Compteurs Tailwind : uniquement les sources qui CONSOMMENT Tailwind (markup + JS applicatif).
  // Mesuré le 24/09/2026 : en scannant aussi le CSS, une déclaration légitime comme
  // `border-radius: 20px` ou `text-align: center` était comptée comme une classe utilitaire
  // (+1 « total-tw-classes ») et faisait rougir le gate sur du travail CSS correct.
  const twEligible = rel === 'patisserie.html' || rel.startsWith('js/patisserie/');
  if (twEligible) {
    const scrut = lines.join('\n');
    for (const { key, rx } of TW_COUNTERS) {
      const matches = scrut.match(rx);
      if (matches) twCounts[key] += matches.length;
    }
  }

  lines.forEach((line, i) => {
    const loc = `${rel}:${i + 1}`;
    if (/design-ignore/.test(rawLines[i] || '')) return;

    for (const [rx, why] of BANS) {
      if (rx.test(line)) {
        const detail = `${loc}  ${why}  →  ${line.trim().slice(0, 110)}`;
        if (strict) {
          strictViolations.push(detail);
        } else {
          addDebtViolation(why, loc);
        }
      }
    }

    const emo = findEmoji(line);
    if (emo) {
      const label = `emoji « ${emo} » interdit dans l'UI`;
      if (strict) {
        strictViolations.push(`${loc}  ${label}`);
      } else {
        addDebtViolation(label, loc);
      }
    }

    if (!isTokens && !colorExempt) {
      const hex = line.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hex) {
        const okHex = hex.every((h) => /^#(?:fff|ffffff|000|000000)$/i.test(h));
        if (!okHex) {
          const label = 'couleur hexadécimale en dur (tokens.css uniquement, sinon var(--…))';
          if (strict) {
            strictViolations.push(`${loc}  ${label}  →  ${hex.join(', ')}`);
          } else {
            addDebtViolation(label, loc);
          }
        }
      }
      if (/\brgba?\(\s*\d/.test(line) && !isTokens) {
        const label = 'couleur rgb()/rgba() en dur (tokens.css uniquement)';
        if (strict) {
          strictViolations.push(`${loc}  ${label}`);
        } else {
          addDebtViolation(label, loc);
        }
      }
    }

    // Rayon littéral en px dans une feuille du design system : --r-3 (6 px) est le maximum.
    // Mesuré le 24/09/2026 : les feuilles css/ n'ont AUCUNE valeur littérale en px
    // (tout passe par var(--r-*), 50% ou 0) — d'où une tolérance ZÉRO ici.
    // Panne témoin à rejouer : injecter `border-radius: 20px` dans css/views.css doit échouer.
    if (isCss && !isTokens) {
      const rayon = line.match(/border-radius:\s*([^;]+)/);
      if (rayon) {
        const px = [...rayon[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => parseFloat(m[1]));
        if (px.some((v) => v > 6)) {
          strictViolations.push(`${loc}  rayon littéral > 6px interdit (--r-3 max, var(--r-*) attendu)  →  ${line.trim().slice(0, 110)}`);
        }
      }
    }
  });
}

// ---- périmètre : app LIVRÉE ------------------------------------------------
const cssFiles = walk(join(ROOT, 'css')).filter((f) => extname(f) === '.css');
cssFiles.forEach((f) => scan(f, { strict: true }));           // css/ = strict

const htmlPath = join(ROOT, 'patisserie.html');
if (existsSync(htmlPath)) scan(htmlPath, { strict: false });   // app livrée = baseline

const jsPatisserie = walk(join(ROOT, 'js/patisserie')).filter((f) => extname(f) === '.js');
jsPatisserie.forEach((f) => scan(f, { strict: false }));       // app livrée = baseline

const presFiles = walk(join(ROOT, 'src/presentation')).filter((f) => extname(f) === '.js');
presFiles.forEach((f) => scan(f, { strict: true }));           // socle vivant = strict

// ---- baseline Tailwind : gelée et vérifiée ---------------------------------
const twBaselinePath = join(ROOT, 'tools/tailwind-baseline.json');
let twBaseline = null;
if (existsSync(twBaselinePath)) {
  try { twBaseline = JSON.parse(readFileSync(twBaselinePath, 'utf8')); } catch { twBaseline = null; }
}

const twViolations = [];
if (twBaseline) {
  for (const { key } of TW_COUNTERS) {
    const current = twCounts[key];
    const ref = twBaseline[key] ?? 0;
    if (current > ref) {
      twViolations.push(`Tailwind "${key}" augmenté : ${ref} → ${current} (+${current - ref}) — interdire de nouvelles occurrences`);
    }
  }
} else {
  writeFileSync(twBaselinePath, JSON.stringify({ _comment: 'Baseline Tailwind — générée le ' + new Date().toISOString().slice(0, 10), ...twCounts }, null, 2));
  console.log(`check-design: baseline Tailwind créée → tools/tailwind-baseline.json`);
}

// ---- baseline des violations par règle (app livrée) -----------------------
const dvBaselinePath = join(ROOT, 'tools/design-violations-baseline.json');

if (WRITE_BASELINE) {
  // Mode --write-baseline : réécrire avec les comptes mesurés
  // (1) compteurs Tailwind — mesurés sur les seules sources qui consomment Tailwind
  writeFileSync(twBaselinePath, JSON.stringify({
    _comment: `Baseline Tailwind — mesurée le ${new Date().toISOString().slice(0, 10)} par check-design.mjs sur patisserie.html + js/patisserie/*.js (sources qui consomment Tailwind ; le CSS n'est plus compté).`,
    _note: 'L\'app livrée dépend du CDN Tailwind ; c\'est une dette produit mesurée, pas un oubli de gate. Les compteurs NE PEUVENT QUE DÉCROÎTRE. Une baisse se répercute à la main et se note dans docs/BUGS.md.',
    ...twCounts,
  }, null, 2));
  const totalMeasured = Object.values(ruleCountsDebt).reduce((s, v) => s + v, 0);
  const payload = {
    _comment: `Violations du design system dans l'app livrée, comptées PAR RÈGLE le ${new Date().toISOString().slice(0, 10)}. Ne peut que décroître. Relancer avec --write-baseline pour mettre à jour après correction.`,
    _note: "Ces violations viennent exclusivement de patisserie.html et js/patisserie/*.js (app livrée). Les fichiers css/*.css et src/presentation/*.js restent scannés sans tolérance : toute violation y est un échec immédiat.",
    rules: Object.fromEntries(Object.entries(ruleCountsDebt).sort((a, b) => b[1] - a[1])),
    total: totalMeasured,
  };
  writeFileSync(dvBaselinePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`check-design: baseline des violations réécrite → tools/design-violations-baseline.json (${totalMeasured} violations, ${Object.keys(ruleCountsDebt).length} règles)`);
}

// ---- comparaison avec la baseline ------------------------------------------
let dvBaseline = null;
if (existsSync(dvBaselinePath)) {
  try { dvBaseline = JSON.parse(readFileSync(dvBaselinePath, 'utf8')); } catch { dvBaseline = null; }
}

const dvErrors = [];   // règles qui augmentent → exit 1
const dvWarnings = []; // règles qui baissent → avertissement

if (dvBaseline) {
  const baseRules = dvBaseline.rules || {};

  // Vérifier chaque règle mesurée
  for (const [label, current] of Object.entries(ruleCountsDebt)) {
    const ref = baseRules[label] ?? null;
    if (ref === null) {
      // Nouvelle règle non vue dans la baseline → erreur
      dvErrors.push({
        label,
        current,
        ref: 0,
        delta: current,
        examples: ruleExamplesDebt[label] || [],
      });
    } else if (current > ref) {
      dvErrors.push({
        label,
        current,
        ref,
        delta: current - ref,
        examples: ruleExamplesDebt[label] || [],
      });
    } else if (current < ref) {
      dvWarnings.push({ label, current, ref });
    }
  }

  // Règles dans la baseline mais absentes de la mesure = complètement résolues
  for (const [label, ref] of Object.entries(baseRules)) {
    if (!(label in ruleCountsDebt) && ref > 0) {
      dvWarnings.push({ label, current: 0, ref });
    }
  }
}

// ---- rapport ----------------------------------------------------------------
const totalDebt = Object.values(ruleCountsDebt).reduce((s, v) => s + v, 0);
const totalRules = Object.keys(ruleCountsDebt).length;
const newRulesCount = dvErrors.filter((e) => e.ref === 0).length;

console.log(`check-design: ${cssFiles.length} CSS · patisserie.html · ${jsPatisserie.length} js/patisserie · ${presFiles.length} présentation.`);
console.log(`  Dette Tailwind mesurée : rounded-xl=${twCounts['rounded-xl']} · rounded-2xl=${twCounts['rounded-2xl']} · shadow-sm=${twCounts['shadow-sm']} · backdrop-blur=${twCounts['backdrop-blur']}`);
console.log(`  AVERTISSEMENT PRODUIT : l'app livrée dépend du CDN Tailwind ; c'est une dette produit mesurée, pas un oubli de gate.`);
console.log(`check-design: ${totalDebt} violation(s) gelée(s) sur ${totalRules} règle(s) · ${newRulesCount} nouvelle`);

// Violations en baisse (bonne nouvelle)
for (const { label, current, ref } of dvWarnings) {
  console.log(`  ↘ dette en baisse : ${label} ${ref}→${current}, relancer avec --write-baseline pour figer`);
}

// Erreurs : violations strictes (css/ + src/presentation/)
let exitCode = 0;

if (strictViolations.length) {
  console.error(`\n${strictViolations.length} violation(s) du design system dans css/ ou src/presentation/ (AUCUNE TOLÉRANCE) :`);
  strictViolations.slice(0, 120).forEach((v) => console.error('  ✗ ' + v));
  if (strictViolations.length > 120) console.error(`  … +${strictViolations.length - 120} autres`);
  exitCode = 1;
}

// Erreurs : violations Tailwind qui augmentent
if (twViolations.length) {
  console.error(`\n${twViolations.length} violation(s) de baseline Tailwind (la dette augmente) :`);
  twViolations.forEach((v) => console.error('  ✗ ' + v));
  exitCode = 1;
}

// Erreurs : violations par règle qui augmentent
if (dvErrors.length) {
  console.error(`\n${dvErrors.length} règle(s) dont les violations ont augmenté dans l'app livrée :`);
  for (const { label, current, ref, delta, examples } of dvErrors) {
    const tag = ref === 0 ? '[NOUVELLE RÈGLE]' : `[+${delta}]`;
    console.error(`  ✗ ${tag} « ${label} » : ${ref} → ${current}`);
    for (const ex of examples.slice(0, 3)) console.error(`      ${ex}`);
  }
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('check-design: OK');
}

process.exit(exitCode);
