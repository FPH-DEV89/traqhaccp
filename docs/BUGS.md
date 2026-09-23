# BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles

> Règle de la maison : **une panne ne se documente pas, elle se gate.** Chaque entrée ci-dessous
> nomme un script exécutable qui échoue (exit ≠ 0) si la panne revient. Un paragraphe de prose
> n'a jamais empêché une régression ; un code de sortie, si.

Lancement : `npm run gate` (rapide, sans navigateur) — `npm run gate:paint` (exige `npm run serve`).
Automatique : hook `pre-push` versionné dans `.githooks/` (`git config core.hooksPath .githooks`).
Bloquant au push : cascade CSS + précache hors-ligne + méta-test. **Consultatif** : fraîcheur de
l'artefact (`--advisory`), car un artefact de documentation périmé ne doit pas empêcher la livraison
de code (cf. §4a).

---

## 1. 16/09/2026 — « les titres s'affichent mais rien d'autre »

**Symptôme** : toutes les vues de l'app paraissaient cassées. Les titres apparaissaient, le reste
était vide. Aucune erreur console, aucun 404.

**Cause** : le contenu était **bien dans le DOM**, mais clippé par un ancêtre. `.main` mesurait
68 px de haut pour 2916 px de contenu, avec `overflow-y: hidden`. `innerHTML`, le nombre de modules
rendus et `getBoundingClientRect` (qui renvoie la géométrie *avant* découpe) étaient tous verts.

**Pourquoi c'est passé** : les vérifications mesuraient la *présence*, pas la *peinture*. Un nœud
présent dans un conteneur clippé est un nœud que l'utilisateur ne voit pas.

**Gate** : `tools/audit-ui-paint.mjs`
- charge chaque vue à plusieurs largeurs (390/414/768/1024/1280/1440/1920),
- vérifie `scrollHeight > clientHeight` sur chaque ancêtre à `overflow-y: hidden|clip` → `CLIPPÉ`,
- échantillonne 5 points du dernier bloc avec `elementFromPoint` → `NON PEINT`,
- refuse une vue quasi blanche (< 150 caractères rendus).

Ne pas régresser : la sonde **mono-point** produisait 19 faux positifs (barres collantes recouvrant
légitimement le centre du dernier bloc). L'échantillonnage 5 points distingue « caché » de « couvert ».
Corollaire : un gate qui crie au loup est pire que pas de gate — toujours le tester contre du code sain.

## 2. 17/09/2026 — artefact généré périmé + raccourci cassé

**Symptôme** : analyse conduite sur un graphe qui ne correspondait pas au code.

**Cause** : `graphify-out/` avait été bâti sur le commit `b0442ab5` alors que `HEAD` était `7c358c7` —
tout le refactor clean architecture était postérieur au graphe. L'artefact étant dans `.gitignore`,
il était invisible en revue, et rien ne comparait « commit du graphe » et « HEAD ».
Panne annexe : le raccourci `graphify` du `PATH` pointait sur un venv cassé (10 min perdues).

**Gate** : `tools/check-artifact-fresh.mjs --tool graphify`
- lit le commit de provenance dans l'artefact, le compare à `HEAD`,
- si du **code** a bougé depuis → exit 1 « PÉRIMÉ, régénérer ». Si seuls `docs/` ou `specs/` ont bougé,
  le graphe reste fonctionnellement à jour → exit 0 (pas de bruit),
- `--tool` sonde le binaire et affiche la commande de réparation plutôt que de laisser chercher.

## 3. 16/09/2026 — écrasement silencieux en cascade

**Symptôme** : une règle CSS mobile simple ne produisait pas l'effet attendu ; le correctif semblait
sans effet.

**Cause** : le **même sélecteur**, la **même propriété structurelle**, sous le **même `@media`**,
déclaré deux fois à 360 lignes d'écart. La dernière gagne sans avertissement. Le bug de la panne n°1
a été *causé* par ce mécanisme, et un résidu contradictoire est resté dans la feuille après le premier
correctif — une bombe à retardement.

**Gate** : `tools/check-css-cascade.mjs css`
- suivi par pile (sélecteur, `@media`, `@keyframes`), pas par découpage naïf : `::before`/`::after`,
  `:first-child` et les étapes de `@keyframes` ne sont pas des sélecteurs distincts,
- ne signale que si la **valeur diffère** (une redéclaration identique est légitime),
- nomme fichier, sélecteur, condition et les **deux numéros de ligne**.

---

## 4. 17/09/2026 — les pièges des gates eux-mêmes (appris en les posant)

Ces quatre leçons viennent de la pose des gates ci-dessus, dont deux auto-infligées. Elles valent
plus que les gates : c'est ce qui les empêche de pourrir.

**a. Bloquant ≠ consultatif.** Le hook a bloqué le premier push parce que `graphify-out/` était
périmé — un artefact de *documentation* empêchait la livraison de *code*. C'est exactement ainsi
qu'un gate meurt : trois contournements par `GATE_SKIP=1` et plus personne ne le lit. D'où
`--advisory` (diagnostic affiché, exit 0) pour le hook, et le mode strict réservé à l'instant où
l'artefact sert vraiment (avant de lire le graphe comme carte du projet).

**b. Flake = gate mort.** L'audit peinture a échoué **une fois** à 1440 px sur la prod, puis
`119/119` sur les trois runs suivants. Cause réelle : `waitUntil: 'domcontentloaded'` + délai fixe
→ une vue était mesurée en pleine hydratation. Deux correctifs, dans cet ordre :
attendre `load` **et** `document.fonts.ready` (la cause) ; puis re-mesurer à la 2ᵉ passe et ne
retenir un échec que s'il **se reproduit** (la ceinture). Vérifié : la fixture clippée échoue
toujours (le vrai bug est reproduit à la 2ᵉ passe), donc la ceinture ne masque rien.

**c. Un gate trop large fabrique ses propres faux positifs.** L'artefact « périmé » après un commit
qui ne touchait que `tools/`, `.githooks/` et `package.json` : un graphe de *modules* n'est pas
invalidé par de l'outillage ou un commentaire CSS. Le périmètre par défaut ignore désormais
`docs/`, `specs/`, `tools/`, `css/`, hooks et config ; il ne reste que ce qui déplace vraiment
l'architecture (`src/`, `index.html`). Testé dans les deux sens : changement de `src/` → exit 1 en
nommant le fichier ; commit d'outillage → exit 0.

**d. Mesurer avant d'annoncer un correctif.** La déclaration CSS retirée a été testée **avec et
sans** : `119/119` dans les deux cas — c'était du code mort, pas un bug de prod. Sans cette mesure,
le commit aurait été présenté comme un correctif en production. Corollaire pour la livraison :
un `200` sur l'URL ne prouve pas qu'un déploiement a eu lieu (une PWA peut réécrire tous les
chemins vers `index.html`). Preuve = le **corps** de la réponse et le **md5 du fichier servi**
comparé à `git show HEAD:<fichier>`.

---

## Méta-gate : `tools/test-gates.mjs`

Un gate jamais confronté à la panne qu'il prétend interdire ne vaut rien. Ce script reconstruit les
deux pannes historiques en fixtures (`file://`, pas de serveur) et **exige** que les gates réagissent :
CSS contradictoire → exit 1 ; page clippée → exit 1 avec le mot `CLIPPÉ` ; équivalents sains → exit 0.
Il tourne dans le hook : si un gate cesse de mordre, le push est bloqué.

**Piège vécu** : la première version lançait un serveur HTTP dans le même processus que son
`spawnSync` → boucle d'événements bloquée, timeout, `exit 1` confondu avec une détection. D'où la
règle : **distinguer « n'a pas pu tourner » (exit 2) de « a détecté un bug » (exit 1)**, et asserter
sur le *message* de sortie, pas seulement sur le code.

## 5. 18/09/2026 — le gate ne pouvait plus mordre (binaire Playwright absent)

Symptôme : push bloqué par `FAIL — 2 assertion(s) : un gate ne joue plus son rôle`, alors que le code
livré était sain (socle de données, aucune vue modifiée).

Cause : Playwright est passé en 1.62.1 et exige `chromium_headless_shell-1234` ; le chemin global
`/opt/hermes/.playwright` n'en contient que la **-1228**, et il appartient à root — donc
`npx playwright install` échoue en `EACCES` depuis le conteneur. Sans navigateur,
`audit-ui-paint.mjs` ne peut pas lever sa page de test : le méta-gate voit un gate muet et bloque.

**Le méta-gate a eu raison** : un gate qui ne peut pas tourner ne prouve rien, et le contourner
(`GATE_SKIP=1`) aurait tué la seule protection contre les bugs du 16-17/09. Réparation :

```bash
npm run setup:playwright    # installe le binaire dans un chemin inscriptible
```

Le hook `pre-push` bascule alors automatiquement sur `/opt/data/.playwright`. Leçon : quand un
méta-gate hurle, vérifier d'abord si le gate **a pu tourner** — avant de soupçonner le code.

---

## 6. 23/09/2026 — le « hors-ligne » qui n'existait pas (service worker jeté en silence)

**Symptôme** : l'app est vendue comme *registre sanitaire hors-ligne*. Réseau coupé, elle n'affichait
**rien** : `ERR_INTERNET_DISCONNECTED`, page blanche. Aucune erreur nulle part, aucun 404 visible.

**Cause** : `ASSETS_TO_CACHE` listait `./patisserie`, chemin qui **n'existe pas** dans le dépôt — il
n'est servi que par une réécriture côté hébergeur. Sur tout autre hôte (GitHub Pages, serveur local,
`file://`) c'est un 404. Or `cache.addAll()` est **tout-ou-rien** : un seul 404 rejette la promesse de
`install()`, le worker devient *redundant* et est jeté → `getRegistrations()` renvoie **0**, et il n'y
a jamais eu de hors-ligne.

Panne invisible par construction : `register('./sw.js').catch(() => {})` avalait l'échec. Le seul
symptôme observable était une **absence** — indiscernable de « pas encore de cache ».

**Aggravant** : la liste précachait ~30 fichiers de l'ancienne architecture (17 vues, routeur,
usecases, services) que **la page livrée ne charge plus**, tout en oubliant les 8 modules
`js/patisserie/*` réellement exécutés. Et Tailwind, chargé depuis un CDN tiers, n'était jamais
intercepté : même avec un worker sain, l'hors-ligne aurait rendu une page **dé-stylée** (une réponse
opaque ne peut pas entrer dans `addAll()`, mais `cache.put()` l'accepte — d'où un cache explicite).

**Gate** : `tools/check-sw-assets.mjs`
- chaque entrée de `ASSETS_TO_CACHE` doit exister sur disque → aucun 404 possible ;
- la **fermeture d'imports** de la page livrée doit être intégralement précachée (sinon l'hors-ligne
  est partiel en silence) ;
- sans navigateur, donc exécutable dans le hook ; `--sw <copie>` + `--root <dépôt>` rejouent la panne ;
- `exit 2` = le gate n'a pas pu tourner (distinct de `exit 1` = panne détectée, cf. §Méta-gate).

**Vérifié dans les deux sens** : sur l'ancien `sw.js` → exit 1 en nommant `./patisserie` **et** les 9
modules vivants manquants ; sur le corrigé → exit 0. Réparation mesurée à l'exécution : **0 → 1**
service worker `active`, **32** entrées en cache, et réseau coupé la page reste **peinte** (1 772
caractères, `position: sticky` et styles Tailwind appliqués).

**Corollaire (la leçon transférable)** : un gate doit mesurer ce que l'app **livre**, pas ce qu'un
routeur mort déclare. `gate:paint` sortait `0/7` pour cette raison exacte — il mesurait `#view`, le
conteneur de l'app non déployée. Rebranché sur la page servie : **5 vues × 7 largeurs = 35/35**.

