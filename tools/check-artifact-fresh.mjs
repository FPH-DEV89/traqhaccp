#!/usr/bin/env node
/**
 * check-artifact-fresh.mjs — Empêche d'utiliser/livrer un artefact généré PÉRIMÉ.
 *
 * Cas vécu (17/09/2026, traqhaccp) : `graphify-out/` existait, daté du commit b0442ab5, alors
 * que HEAD était 7c358c7 — tout le refactor clean architecture était postérieur au graphe.
 * Personne ne l'a vu parce que l'artefact était dans .gitignore (donc invisible en ligne) et
 * que rien ne comparait « commit du graphe » et « HEAD ». Deuxième panne : le raccourci
 * `graphify` du PATH pointait sur un venv cassé → 10 min perdues à chercher la bonne commande.
 *
 * Le graphe (et tout artefact généré) porte sa provenance. Ce script la LIT, la COMPARE à HEAD,
 * et refuse le silence : si du code a bougé depuis, il faut régénérer.
 *
 * Usage :
 *   node tools/check-artifact-fresh.mjs                      # graphify-out/ par défaut
 *   node tools/check-artifact-fresh.mjs --dir graphify-out --ignore '^(docs/|specs/)'
 *   node tools/check-artifact-fresh.mjs --tool graphify      # sonde aussi le binaire
 * Exit 0 = artefact à jour (ou aucun artefact, donc rien à vérifier). Exit 1 = périmé.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const argv = process.argv.slice(2);
// Par défaut on ignore tout ce qui ne change PAS l'architecture décrite par le graphe :
// docs, specs, outillage, hooks, config de déploiement, styles. Le graphe est un graphe de
// MODULES (1281 nœuds / 44 communautés) : ce qui l'invalide, c'est un déplacement de code dans
// src/, pas un commentaire CSS. (Sinon un commit qui ne touche que tools/ ou un commentaire
// faisait « périmer » le graphe : faux positif, donc gate ignoré, donc gate mort.)
const opt = {
  dir: 'graphify-out',
  ignore: '^(docs/|specs/|tools/|\\.githooks/|\\.github/|graphify-out/|css/|\\.gitignore|README|package(-lock)?\\.json|vercel\\.json|app\\.json)',
};
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dir') opt.dir = argv[++i];
  else if (argv[i] === '--ignore') opt.ignore = argv[++i];
  else if (argv[i] === '--tool') opt.tool = argv[++i];
  // --advisory : même diagnostic, mais exit 0. Pour les contextes où un artefact de
  // documentation périmé ne doit PAS empêcher une livraison (ex. hook pre-push) — un gate
  // qui bloque sans raison valable est un gate qu'on désactive, donc un gate mort.
  else if (argv[i] === '--advisory') opt.advisory = true;
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
// En mode consultatif le diagnostic s'affiche mais ne bloque pas. Le préfixe rend l'état
// identifiable dans les logs (sinon « tout est vert » serait un mensonge).
const fin = (code) => process.exit(opt.advisory && code !== 0 ? 0 : code);
const marque = opt.advisory ? '⚠️  CONSULTATIF — ' : '';

// --- sonde du binaire (panne récurrente n°2) --------------------------------
if (opt.tool) {
  try {
    const v = execFileSync(opt.tool, ['--version'], { encoding: 'utf8', timeout: 20000 }).trim().split('\n')[0];
    console.log(`✅ binaire « ${opt.tool} » opérationnel : ${v}`);
  } catch (e) {
    console.log(`❌ ${marque}binaire « ${opt.tool} » INUTILISABLE (${String(e.message).split('\n')[0]})`);
    console.log(`   → ne pas chercher 10 min : utiliser l'interpréteur du venv, ex.`);
    console.log(`     /opt/data/home/.local/share/uv/tools/graphifyy/bin/python3 -m graphify --version`);
    console.log(`   → ou réparer : uv tool install graphifyy --force`);
    fin(1);
  }
}

// --- fraîcheur de l'artefact ------------------------------------------------
const cible = join(process.cwd(), opt.dir);
const rapport = join(cible, 'GRAPH_REPORT.md');
if (!existsSync(cible) || !existsSync(rapport)) {
  console.log(`PASS — aucun artefact dans ${opt.dir}/ : rien à vérifier (penser à le générer si un graphe est attendu).`);
  process.exit(0);
}

let head;
try { head = git('rev-parse', 'HEAD'); } catch { console.log('PASS — pas de dépôt git ici, vérification impossible.'); process.exit(0); }

const marqueur = readFileSync(rapport, 'utf8').match(/Built from commit:?\s*`?([0-9a-f]{7,40})`?/i);
if (!marqueur) {
  console.log(`⚠️  ${opt.dir}/GRAPH_REPORT.md ne déclare pas son commit d'origine — impossible de juger la fraîcheur.`);
  process.exit(0);
}
const commitGraphe = marqueur[1];

if (head.startsWith(commitGraphe) || commitGraphe.startsWith(head)) {
  console.log(`PASS — artefact ${opt.dir}/ bâti sur HEAD (${commitGraphe.slice(0, 8)}).`);
  process.exit(0);
}

let changes = [];
try { changes = git('diff', '--name-only', `${commitGraphe}..HEAD`).split('\n').filter(Boolean); } catch {
  console.log(`PASS — commit ${commitGraphe.slice(0, 8)} inconnu de ce dépôt (clone superficiel ?).`);
  process.exit(0);
}
const re = new RegExp(opt.ignore);
const code = changes.filter((f) => !re.test(f));

if (!code.length) {
  console.log(`PASS — artefact bâti sur ${commitGraphe.slice(0, 8)}, HEAD = ${head.slice(0, 8)}, mais ${changes.length} fichier(s) modifié(s) uniquement hors code (docs/specs) → graphe fonctionnellement à jour.`);
  process.exit(0);
}
console.log(`❌ ${marque}ARTEFACT PÉRIMÉ — ${opt.dir}/ a été bâti sur ${commitGraphe.slice(0, 8)}, HEAD est ${head.slice(0, 8)}.`);
console.log(`   ${code.length} fichier(s) de code ont changé depuis (sur ${changes.length} au total) :`);
for (const f of code.slice(0, 12)) console.log(`     - ${f}`);
if (code.length > 12) console.log(`     … +${code.length - 12}`);
console.log(`   → régénérer l'artefact AVANT de s'en servir comme carte du projet (sinon on raisonne sur une architecture qui n'existe plus).`);
fin(1);
