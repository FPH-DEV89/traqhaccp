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
 *   Fixture C — précache de service worker non servable : une entrée de ASSETS_TO_CACHE sans
 *               fichier sur disque. addAll() étant tout-ou-rien, ce 404 tuait install() et
 *               l'hors-ligne disparaissait sans erreur visible.
 *   Fixture D — parité : un id référencé par js/patisserie absent de patisserie.html.
 *   Fixture E — gel incomplet (trou mesuré le 24/09) : check-design excusait TOUTE violation
 *               de l'app livrée par un filtre de chemin, y compris une règle jamais violée
 *               auparavant (alert()), qui passait donc sans bruit.
 *   Fixture F — rayon littéral en px dans css/ : `border-radius: 20px` doit échouer là où
 *               `var(--r-2)` passe.
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
console.log('── Gate 1/7 · check-css-cascade.mjs');
attendu('contradiction @media détectée', node('check-css-cascade.mjs', [join(BAC, 'bug.css')]).status, 1);
attendu('CSS légitime laissé passer', node('check-css-cascade.mjs', [join(BAC, 'sain.css')]).status, 0);

// 2) gate artefact périmé
console.log('── Gate 2/7 · check-artifact-fresh.mjs');
attendu('artefact absent = silence', node('check-artifact-fresh.mjs', ['--dir', join(BAC, 'inexistant')]).status, 0);

// 3) gate peinture (fixtures chargées en file://)
console.log('── Gate 3/7 · audit-ui-paint.mjs');
const ENV = { PAINT_WIDTHS: '1024x768' };
writeFileSync(join(BAC, 'clippee.html'), page(true));
writeFileSync(join(BAC, 'saine.html'), page(false));
const urlFichier = (n) => pathToFileURL(join(BAC, n)).href;

const rClippee = node('audit-ui-paint.mjs', ['--url', urlFichier('clippee.html'), '--view', '#view'], ENV);
attendu('page clippée détectée (le bug du 16/09)', rClippee.status, 1);
mentionne('le message nomme le clipping', rClippee.stdout, 'CLIPPÉ|NON PEINT');

const rSaine = node('audit-ui-paint.mjs', ['--url', urlFichier('saine.html'), '--view', '#view', '--quiet'], ENV);
attendu('page saine laissée passer', rSaine.status, 0);

// 4) gate hors-ligne : le précache du service worker doit être servable
console.log('── Gate 4/7 · check-sw-assets.mjs');
/* Fixture C — panne du 23/09/2026 : ASSETS_TO_CACHE contenait une entrée qui n'existe pas sur
   disque (résolue par une réécriture de l'hébergeur). cache.addAll() étant tout-ou-rien, ce 404
   rejetait install() : plus aucun service worker, donc plus d'hors-ligne, sans message d'erreur.
   La version cassée oublie AUSSI un module vivant : les deux moitiés de la panne sont testées. */
const arbre = (sain) => {
  const d = join(BAC, sain ? 'sw-sain' : 'sw-casse');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'index.html'),
    '<!doctype html><link rel="stylesheet" href="./s.css"><script type="module" src="./app.js"></script>');
  writeFileSync(join(d, 'app.js'), "import { a } from './mod.js';\nexport const b = a;\n");
  writeFileSync(join(d, 'mod.js'), 'export const a = 1;\n');
  writeFileSync(join(d, 's.css'), '.a{color:red}\n');
  writeFileSync(join(d, 'sw.js'), sain
    ? "const ASSETS_TO_CACHE = [\n  './index.html',\n  './app.js',\n  './mod.js',\n  './s.css',\n];\n"
    : "const ASSETS_TO_CACHE = [\n  './index.html',\n  './app.js',\n  './absent.js',\n  './s.css',\n];\n");
  return d;
};
const dCasse = arbre(false);
const dSain = arbre(true);

const rSwCasse = node('check-sw-assets.mjs', ['--sw', join(dCasse, 'sw.js'), '--html', 'index.html', '--root', dCasse]);
attendu('entrée de précache introuvable détectée (panne du 23/09)', rSwCasse.status, 1);
mentionne("le message nomme l'entrée sans fichier", rSwCasse.stdout, 'INTROUVABLE');
mentionne('le message nomme aussi le module vivant oublié', rSwCasse.stdout, 'mod\\.js');

const rSwSain = node('check-sw-assets.mjs', ['--sw', join(dSain, 'sw.js'), '--html', 'index.html', '--root', dSain]);
attendu('précache sain laissé passer', rSwSain.status, 0);

// 5) gate parité patisserie.html ↔ js/patisserie — nouvelle divergence détectée
console.log('── Gate 5/7 · check-parity.mjs (rebranché patisserie.html ↔ js/patisserie)');
/* Fixture D — référence DOM orpheline : js référence un id absent de patisserie.html.
   La baseline est vide dans ce bac à sable → toute divergence est fatale. */
{
  const dParity = join(BAC, 'parity');
  mkdirSync(dParity, { recursive: true });
  // patisserie.html avec un seul id
  writeFileSync(join(dParity, 'patisserie.html'), `<!doctype html><html><body>
    <div id="existant">OK</div>
  </body></html>`);
  // js qui référence un id absent
  mkdirSync(join(dParity, 'js', 'patisserie'), { recursive: true });
  writeFileSync(join(dParity, 'js', 'patisserie', 'app.js'),
    "document.getElementById('id-qui-nexiste-pas');\n");
  // baseline vide
  mkdirSync(join(dParity, 'tools'), { recursive: true });
  writeFileSync(join(dParity, 'tools', 'patisserie-parity-baseline.json'),
    '{"known":[]}\n');
  // src/ vivant minimal (requis par check-parity.mjs)
  mkdirSync(join(dParity, 'src', 'domain'), { recursive: true });
  mkdirSync(join(dParity, 'src', 'infrastructure'), { recursive: true });
  mkdirSync(join(dParity, 'src', 'presentation'), { recursive: true });

  // check-parity lit process.cwd() ; on utilise spawnSync avec cwd pour pointer sur la fixture
  const rParityCasseReal = spawnSync(
    process.execPath, [join(ICI, 'check-parity.mjs')],
    { encoding: 'utf8', cwd: dParity, timeout: 30000 },
  );
  attendu('référence DOM orpheline détectée (gate rebranché patisserie)', rParityCasseReal.status, 1);
  mentionne('le message nomme l\'id orphelin', (rParityCasseReal.stdout || '') + (rParityCasseReal.stderr || ''), 'id-qui-nexiste-pas');

  // Version saine : le même id existe dans patisserie.html
  writeFileSync(join(dParity, 'js', 'patisserie', 'app.js'),
    "document.getElementById('existant');\n");
  const rParitySainReal = spawnSync(
    process.execPath, [join(ICI, 'check-parity.mjs')],
    { encoding: 'utf8', cwd: dParity, timeout: 30000 },
  );
  attendu('parité saine laissée passer', rParitySainReal.status, 0);
}

// 6) gate test-domain --selftest : la panne témoin doit échouer
console.log('── Gate 6/7 · test-domain.mjs --selftest');
const rDomainSelftest = node('test-domain.mjs', ['--selftest']);
attendu('test-domain --selftest : panne témoin détectée (rc=1)', rDomainSelftest.status, 1);
mentionne('le message nomme le sabotage', rDomainSelftest.stdout, 'sabotée|ÉCHEC');

const rDomainNormal = node('test-domain.mjs', []);
attendu('test-domain normal : toutes les assertions OK (rc=0)', rDomainNormal.status, 0);
mentionne('le message indique OK', rDomainNormal.stdout, 'test-domain: OK');

// 7) gate design — le gel des violations doit être COMPLET, pas seulement Tailwind
console.log('── Gate 7/7 · check-design.mjs (gel des violations de l\'app livrée)');
/* Fixture E — le trou corrigé le 24/09/2026 : check-design gelait TOUTE violation trouvée dans
   patisserie.html / js/patisserie par simple filtre de chemin, sans la compter. Une nouvelle
   violation d'une règle non-Tailwind (ici alert()) passait donc inaperçue. La mesure par règle
   doit la nommer et échouer. Fixture F : le rayon littéral en px dans une feuille css/. */
{
  const dDesign = join(BAC, 'design');
  mkdirSync(join(dDesign, 'tools'), { recursive: true });
  mkdirSync(join(dDesign, 'css'), { recursive: true });
  mkdirSync(join(dDesign, 'js', 'patisserie'), { recursive: true });
  mkdirSync(join(dDesign, 'src', 'presentation'), { recursive: true });
  writeFileSync(join(dDesign, 'tools', 'tailwind-baseline.json'),
    JSON.stringify({ 'total-tw-classes': 0, 'rounded-xl': 0 }));
  writeFileSync(join(dDesign, 'tools', 'design-violations-baseline.json'),
    JSON.stringify({ rules: {}, total: 0 }));
  const pageDesign = (fautive) => `<!doctype html><html lang=fr><body>
<div id="x">Relevé de température</div>
<script>${fautive ? "alert('x');" : "console.log('ok');"}</script>
</body></html>`;
  const design = () => spawnSync(process.execPath, [join(ICI, 'check-design.mjs')],
    { encoding: 'utf8', cwd: dDesign, timeout: 30000 });
  writeFileSync(join(dDesign, 'js', 'patisserie', 'app.js'), 'export const a = 1;\n');

  writeFileSync(join(dDesign, 'patisserie.html'), pageDesign(true));
  const rDesignCasse = design();
  attendu('violation d\'une règle non-Tailwind dans l\'app livrée détectée', rDesignCasse.status, 1);
  mentionne('le message nomme la règle violée', (rDesignCasse.stdout || '') + (rDesignCasse.stderr || ''), 'alert\\(\\) interdit');

  writeFileSync(join(dDesign, 'patisserie.html'), pageDesign(false));
  const rDesignSain = design();
  attendu('app livrée saine laissée passer', rDesignSain.status, 0);

  writeFileSync(join(dDesign, 'css', 'vues.css'), '.carte { padding: 8px; border-radius: 20px; }\n');
  const rRayon = design();
  attendu('rayon littéral > 6px dans css/ détecté', rRayon.status, 1);
  mentionne('le message nomme le rayon', (rRayon.stdout || '') + (rRayon.stderr || ''), 'rayon littéral');

  writeFileSync(join(dDesign, 'css', 'vues.css'), '.carte { padding: 8px; border-radius: var(--r-2); }\n');
  const rRayonSain = design();
  attendu('rayon tokenisé (var(--r-2)) laissé passer', rRayonSain.status, 0);
}

// Détail utile en cas d'échec
if (ko) {
  console.log('\n── Détail des sorties qui n\'ont pas réagi comme prévu ──');
  for (const r of [rClippee, rSaine, rSwCasse, rSwSain]) {
    console.log((r.stdout || '').trim() || (r.stderr || '').trim());
    console.log('·'.repeat(40));
  }
}

console.log(ko
  ? `\nFAIL — ${ko} assertion(s) : un gate ne joue plus son rôle.`
  : '\nPASS — les 7 gates détectent bien les pannes historiques (16-17/09, 23/09/2026) et les nouvelles (parité patisserie.html, domaine), et ne crient pas au loup sur du code sain.');
process.exit(ko ? 1 : 0);

