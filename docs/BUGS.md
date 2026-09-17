# BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles

> Règle de la maison : **une panne ne se documente pas, elle se gate.** Chaque entrée ci-dessous
> nomme un script exécutable qui échoue (exit ≠ 0) si la panne revient. Un paragraphe de prose
> n'a jamais empêché une régression ; un code de sortie, si.

Lancement : `npm run gate` (rapide, sans navigateur) — `npm run gate:paint` (exige `npm run serve`).
Automatique : hook `pre-push` versionné dans `.githooks/` (`git config core.hooksPath .githooks`).

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

## Méta-gate : `tools/test-gates.mjs`

Un gate jamais confronté à la panne qu'il prétend interdire ne vaut rien. Ce script reconstruit les
deux pannes historiques en fixtures (`file://`, pas de serveur) et **exige** que les gates réagissent :
CSS contradictoire → exit 1 ; page clippée → exit 1 avec le mot `CLIPPÉ` ; équivalents sains → exit 0.
Il tourne dans le hook : si un gate cesse de mordre, le push est bloqué.

**Piège vécu** : la première version lançait un serveur HTTP dans le même processus que son
`spawnSync` → boucle d'événements bloquée, timeout, `exit 1` confondu avec une détection. D'où la
règle : **distinguer « n'a pas pu tourner » (exit 2) de « a détecté un bug » (exit 1)**, et asserter
sur le *message* de sortie, pas seulement sur le code.
