#!/usr/bin/env node
/**
 * test-gates.mjs — Test de régression des GATES eux-mêmes.
 *
 * Un gate qui n'a jamais vu le bug qu'il prétend interdire ne vaut rien. Ce script reconstitue
 * les deux bugs du 16-17/09/2026 dans des fixtures jetables et vérifie que chaque gate les
 * DÉTECTE (exit 1). Puis il vérifie que les mêmes fixtures corrigées passent (exit 0) — c'est
 * le garde-fou anti-faux-positif : un gate qui crie au loup sur du CSS légitime finit ignoré.
 *
 *   Fixture A — bug d'affichage : `.main` en overflow-y:hidden qui clippe 1800px de contenu
 *               dans 300px. Tous les checks DOM passaient au vert, l'écran était vide.
 *   Fixture B — contradiction de cascade : deux `@media (max-width: 900px)`, même sélecteur
 *               `.app`, même propriété `grid-template-rows`, valeurs différentes.
 *
 * Usage : node tools/test-gates.mjs        (exit 0 = les gates fonctionnent, exit 1 = régression)
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ICI = dirname(fileURLToPath(import.meta.url));
const BAC = join(process.env.TMPDIR || '/tmp', 'gates-fixtures');

// ── Fixture A : la page clippée (et sa version saine) ───────────────────────
const page = (clippee) => `<!doctype html><html lang=fr><head><meta charset=utf-8><title>fixture</title>
<style>
  .app { display: grid; grid-template-rows: 56px 1fr; height: 100dvh; overflow: hidden; }
  .workspace { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  /* ⚠ C'est ICI qu'est le bug du 16/09 : overflow-y:hidden sur un conteneur plus court que son
     contenu → tout est clippé, seuls les titres restent visibles. */
  .main { flex: 1; min-height: 0; overflow-y: ${clippee ? 'hidden' : 'auto'}; }
  #view { display: block; }
  .bloc { height: 600px; margin: 8px; background: #eef; border: 1px solid #99a; }
</style></head><body>
<div class="app"><header id="topbar">Barre</header>
  <div class="workspace"><main class="main"><div id="view">
    <div class="bloc">Titre 1 — relevé de température du jour : chambre froide positive 3,4 °C, chambre
      froide négative −18,2 °C, cellule de refroidissement rapide conforme. Opérateur : F. Philibert.</div>
    <div class="bloc">Titre 2 — plan de nettoyage : sols et surfaces en contact alimentaire traités
      après chaque service, produits agréés contact alimentaire, traçabilité des dilutions archivée.</div>
    <div class="bloc">Titre 3 — non-conformités : deux écarts mineurs relevés sur l'étiquetage DLC
      secondaire, actions correctives planifiées et vérifiées le lendemain matin par le responsable.</div>
  </div></main></div>
</div></body></html>`;

// ── Fixture B : la contradiction de cascade (et sa version fusionnée) ───────
const css = (contradictoire) => contradictoire
  ? `@media (max-width: 900px) {\n  .app { grid-template-rows: auto 1fr; }\n}\n@media (max-width: 900px) {\n  .app { grid-template-rows: var(--topbar) 1fr; }\n}\n`
  : `@media (max-width: 900px) {\n  .app { grid-template-rows: var(--topbar) 1fr; }\n}\n`;

// ── Outillage ───────────────────────────────────────────────────────────────
// NB : pas de serveur HTTP dans ce processus — spawnSync bloque la boucle d'événements et le
// serveur ne répondrait jamais (piège vécu : « exit 1 » venait du timeout, pas de la détection).
// Les fixtures sont chargées en file:// (CSS inline, aucun module ES à charger).
const node = (script, args, env = {}) => spawnSync(process.execPath, [join(ICI, script), ...args],
  { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 180000 });

let ko = 0;
const attendu = (nom, obtenu, voulu) => {
  const ok = obtenu === voulu;
  if (!ok) ko++;
  console.log(`${ok ? '✅' : '❌'} ${nom} — exit ${obtenu} (attendu ${voulu})`);
  return ok;
};
/** Vérifie que la sortie NOMME bien le problème (sinon un crash passerait pour une détection). */
const mentionne = (nom, sortie, motif) => {
  const ok = new RegExp(motif, 'i').test(sortie || '');
  if (!ok) ko++;
  console.log(`${ok ? '✅' : '❌'} ${nom} — message attendu /${motif}/`);
  return ok;
};

rmSync(BAC, { recursive: true, force: true });
mkdirSync(BAC, { recursive: true });

// 1) gate cascade
writeFileSync(join(BAC, 'bug.css'), css(true));
writeFileSync(join(BAC, 'sain.css'), css(false));
console.log('── Gate 1/3 · check-css-cascade.mjs');
attendu('contradiction @media détectée', node('check-css-cascade.mjs', [join(BAC, 'bug.css')]).status, 1);
attendu('CSS légitime laissé passer', node('check-css-cascade.mjs', [join(BAC, 'sain.css')]).status, 0);

// 2) gate artefact périmé
console.log('── Gate 2/3 · check-artifact-fresh.mjs');
attendu('artefact absent = silence', node('check-artifact-fresh.mjs', ['--dir', join(BAC, 'inexistant')]).status, 0);

// 3) gate peinture (fixtures chargées en file://)
console.log('── Gate 3/3 · audit-ui-paint.mjs');
const ENV = { PAINT_WIDTHS: '1024x768' };
writeFileSync(join(BAC, 'clippee.html'), page(true));
writeFileSync(join(BAC, 'saine.html'), page(false));
const urlFichier = (n) => pathToFileURL(join(BAC, n)).href;

const rClippee = node('audit-ui-paint.mjs', ['--url', urlFichier('clippee.html'), '--view', '#view'], ENV);
attendu('page clippée détectée (le bug du 16/09)', rClippee.status, 1);
mentionne('le message nomme le clipping', rClippee.stdout, 'CLIPPÉ|NON PEINT');

const rSaine = node('audit-ui-paint.mjs', ['--url', urlFichier('saine.html'), '--view', '#view', '--quiet'], ENV);
attendu('page saine laissée passer', rSaine.status, 0);

// Détail utile en cas d'échec
if (ko) {
  console.log('\n── Détail des sorties qui n\'ont pas réagi comme prévu ──');
  console.log(rClippee.stdout?.trim() || rClippee.stderr?.trim());
  console.log(rSaine.stdout?.trim() || rSaine.stderr?.trim());
}

console.log(ko
  ? `\nFAIL — ${ko} assertion(s) : un gate ne joue plus son rôle.`
  : '\nPASS — les 3 gates détectent bien les bugs du 16-17/09/2026 et ne crient pas au loup sur du code sain.');
process.exit(ko ? 1 : 0);
