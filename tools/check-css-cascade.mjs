#!/usr/bin/env node
/**
 * check-css-cascade.mjs — Détecte les CONTRADICTIONS DE CASCADE : la même propriété
 * structurelle, sur le MÊME sélecteur, sous la MÊME condition @media, déclarée deux fois avec
 * des valeurs différentes dans une feuille. La dernière gagne en silence.
 *
 * Bug d'origine (TraqHACCP, 16/09/2026) : deux `@media (max-width: 900px)` dans
 * css/layout.css, chacun fixant `.app { grid-template-rows: … }` avec une valeur différente
 * (`auto 1fr` puis `var(--topbar) 1fr`). Résultat : `.workspace` coincé dans une rangée de
 * 56 px, contenu clippé à 68 px alors que la page en fait 2916 — « rien ne s'affiche hormis
 * les titres ». Aucun linter classique ne signale ça : les deux règles sont valides.
 *
 * Choix de conception : parseur à PILE (pas de regex sur les accolades) — un parseur qui
 * invente des faux positifs est pire que pas de gate du tout. Silencieux quand tout va bien.
 *
 * Usage : node tools/check-css-cascade.mjs [dossier=./css]
 * Exit 0 = silence pile. Exit 1 = contradiction(s) trouvée(s).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const RACINE = process.argv[2] || 'css';
const STRUCTURELLES = /^(grid|flex|display|position|overflow|width|height|min-|max-|inset|top|right|bottom|left|padding|margin|z-index|visibility|opacity|order|gap)/;

/** Accepte un dossier (récursif) ou un ou plusieurs fichiers .css explicites. */
function fichiers(dir, out = []) {
  let e; try { e = readdirSync(dir); } catch {
    if (extname(dir) === '.css') out.push(dir);   // argument = fichier
    return out;
  }
  for (const n of e) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (extname(p) === '.css') out.push(p);
  }
  return out;
}

/** Les feuilles passées en arguments explicites (après le 1er arg). */
const CIBLES = process.argv.slice(2);

/** Tokeniseur minimal mais honnête : renvoie []{ media, selecteur, prop, valeur, ligne }. */
function declarations(src, fichier) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')); // garde les numéros de ligne
  const pile = [];              // { type: 'media'|'rule', prelude }
  const sorties = [];
  let tampon = '', ligne = 1, ligneTampon = 1, mediaCourant = null, selecteurCourant = null;

  const purger = () => { tampon = ''; ligneTampon = ligne; };
  const dansKeyframes = () => pile.some((x) => x.type === 'keyframes');
  const traiter = (symbole) => {
    const t = tampon.trim();
    if (symbole === '{') {
      if (/^@(-webkit-)?keyframes/i.test(t)) { pile.push({ type: 'keyframes', prelude: t }); }
      else if (/^@media/i.test(t)) { pile.push({ type: 'media', prelude: t.replace(/\s+/g, ' ') }); mediaCourant = pile.filter((x) => x.type === 'media').map((x) => x.prelude).join(' && '); }
      else if (/^@/.test(t)) { pile.push({ type: 'at', prelude: t }); }
      // `from`/`to`/`50%` ne sont PAS des sélecteurs : on ne les traite jamais comme tels.
      else if (dansKeyframes()) { pile.push({ type: 'at', prelude: t }); }
      else { pile.push({ type: 'rule', prelude: t.replace(/\s+/g, ' ') }); selecteurCourant = t.replace(/\s+/g, ' '); }
      purger(); return;
    }
    if (symbole === '}') {
      const dernier = pile.pop();
      if (dernier?.type === 'media' || dernier?.type === 'at') mediaCourant = pile.filter((x) => x.type === 'media').map((x) => x.prelude).join(' && ') || null;
      if (dernier?.type === 'rule') selecteurCourant = [...pile].reverse().find((x) => x.type === 'rule')?.prelude || null;
      purger(); return;
    }
    // symbole === ';' → déclaration
    if (t && selecteurCourant && pile[pile.length - 1]?.type === 'rule') {
      const m = t.match(/^([-a-zA-Z]+)\s*:\s*([\s\S]+)$/);
      if (m && STRUCTURELLES.test(m[1])) {
        sorties.push({ fichier, media: mediaCourant, selecteur: selecteurCourant,
          prop: m[1].toLowerCase(), valeur: m[2].replace(/\s+/g, ' ').trim(), ligne: ligneTampon });
      }
    }
    purger();
  };

  for (const car of src) {
    if (car === '\n') ligne++;
    if (car === '{' || car === '}' || car === ';') { traiter(car); continue; }
    tampon += car;
  }
  return sorties;
}

let total = 0, contradictions = 0;
const cibles = CIBLES.length ? [...new Set(CIBLES.flatMap((a) => fichiers(a)))] : fichiers(RACINE);
for (const f of cibles) {
  const decls = declarations(readFileSync(f, 'utf8'), f);
  total += decls.length;
  const vues = new Map();
  for (const d of decls) {
    // même sélecteur ET même condition : la clé inclut la condition pour ne pas comparer
    // une déclaration hors-media avec une déclaration dans un @media (ce serait normal).
    const cle = `${d.media || '(hors @media)'} :: ${d.selecteur} :: ${d.prop}`;
    if (!vues.has(cle)) vues.set(cle, []);
    vues.get(cle).push(d);
  }
  for (const [cle, liste] of vues) {
    if (liste.length < 2) continue;
    if (new Set(liste.map((d) => d.valeur)).size < 2) continue; // valeurs identiques = redondance, pas contradiction
    contradictions++;
    console.log(`❌ ${f} — ${cle}`);
    for (const d of liste) console.log(`     L${d.ligne} : ${d.prop}: ${d.valeur}`);
    console.log(`   → la dernière gagne silencieusement. Fusionner en UN bloc, ou assumer l'écrasement explicitement.`);
  }
}

if (contradictions) {
  console.log(`\nFAIL — ${contradictions} contradiction(s) de cascade (${total} déclarations structurelles analysées).`);
  process.exit(1);
}
console.log(`PASS — 0 contradiction de cascade (${total} déclarations structurelles analysées dans ${cibles.length} feuille(s)).`);
