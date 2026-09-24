# TraqHACCP — Architecture de l'app livrée

> Document **normatif**, daté du 24/09/2026. Il remplace la spec « Architecture cible v4 » :
> cette tentative de clean architecture a été abandonnée le 23/09/2026 (commits `3c400bf` →
> `6499947` → `7983395`) puis retirée du dépôt le 24/09/2026. Toute spec de travail s'y réfère.

## 1. Ce qui est livré, en production

| Élément | Fichier | Taille (lignes non vides) |
| --- | --- | --- |
| Page unique de l'app | `patisserie.html` | 997 |
| Modules applicatifs | `js/patisserie/*.js` (8) | 1 847 au total |
| Design system | `css/tokens.css`, `css/components.css`, `css/views.css` | 171 / 673 / 666 |
| Socle partagé | `src/domain/`, `src/infrastructure/`, `src/presentation/` (7 fichiers) | 2 400 |
| PWA | `manifest.json`, `sw.js` | — |
| Déploiement | `vercel.json` (Vercel, `https://traqhaccp.vercel.app/`) | — |

L'entrée est **`patisserie.html`**. L'URL racine `/` sert la même page (réécriture `vercel.json`) ;
`/index.html` redirige en 301 vers `/` (le fichier `index.html` n'existe plus).
L'application est connectée à Supabase en permanence (avec cache PWA de résilience hors-ligne).

## 2. Contraintes non négociables

1. **Aucun build, aucun bundler, aucun framework.** ES modules natifs servis tels quels.
   Pas de dépendance npm au runtime, pas de TypeScript, pas de JSX.
2. **Hors-ligne d'abord.** Tout nouvel asset *same-origin* doit entrer dans `ASSETS_TO_CACHE`
   de `sw.js`, et `CACHE_NAME` doit être incrémenté. `npm run gate:sw` vérifie que chaque entrée
   précachée **existe sur disque** et que chaque module vivant est couvert (leçon du 23/09 :
   `cache.addAll()` est tout-ou-rien, une seule entrée morte tuait tout l'hors-ligne en silence).
3. **God File : 500 lignes non vides maximum** (`.js`, `.css`). Dépassements actuels mesurés
   et assumés comme dette : `patisserie.html` 997, `css/components.css` 673, `css/views.css` 666,
   `src/presentation/connexion.js` 575. Tout nouveau fichier doit rester sous le seuil.
4. **Aucun secret, aucune donnée client réelle** dans le code ou les données de démo.
5. **Français** : libellés, commentaires, formats (virgule décimale, espace fine avant `°C` et `%`).
6. **Aucune nouvelle dépendance CDN.** Les CDN retirés (Font Awesome) le restent. Deux exceptions
   tolérées et documentées : Google Fonts, Tone.js. **Tailwind par CDN est une dette gelée**
   (cf. §6) : interdiction d'en ajouter, obligation de la réduire à chaque passage.
7. **Accessibilité** : navigation clavier, `:focus-visible`, `aria-*` sur les composants
   interactifs, contrastes définis dans `docs/DESIGN.md`.

## 3. Arborescence réelle

```
patisserie.html          entrée : shell, vues, navigation, écouteurs onclick
manifest.json            PWA
sw.js                    précache (liste = fermeture d'imports RÉELLE de la page livrée)
vercel.json              cleanUrls, redirect /index.html → /, rewrite / → /patisserie.html

css/
  tokens.css             variables, thèmes, échelles, z-index, motion
  components.css         .btn .field .input .table .mark .sheet .kpi .callout .toast …
  views.css              styles spécifiques aux vues (matrice allergènes, jauges huile, GED…)

js/patisserie/
  app.js                 boot, navigation entre vues, enregistrement du service worker
  auth.js                authentification et session Supabase
  state.js               état partagé (session Supabase + cache local)
  views.js               rendu des vues (traçabilité, recettes, ventes, DLC, équipe)
  modals.js              modales et formulaires
  calculations.js        calculs métier (DLC, coûts, marges)
  recall.js              rappel produit, alertes DLC
  audio-toast.js         retour sonore + toasts

src/domain/
  constants.js           données de référence (brigade, équipements, DLC, checklists, navigation)
  haccp_norms.js         seuils réglementaires HACCP (source de vérité)
src/infrastructure/
  config.js              configuration d'environnement
  supabase_client.js     client Supabase (optionnel)
src/presentation/
  connexion.js           page de connexion
  icons.js               sprite SVG maison
  ui.js                  composants UI (toasts, modales, cartes)

tools/                   gates + tests (cf. §5)
docs/                    cette doc, DESIGN.md, BUGS.md, DATA.md, MANUEL_UTILISATEUR.md
```

## 4. Graphe d'exécution — la seule vérité

`patisserie.html` → `js/patisserie/app.js` → les 7 autres modules → le socle `src/`
(7 fichiers vivants). **La fermeture d'imports mesurée depuis la page SERVIE est la seule
vérité** : un fichier non atteint par ce graphe est du code mort, à supprimer — pas à conserver
« au cas où ». Cette règle a coûté cher : 50 fichiers de l'ancienne clean architecture sont
restés 24 h dans le dépôt alors qu'aucun gate ne les visait.

## 5. Chaîne de vérification — ce que chaque gate prouve (et ne prouve pas)

```bash
npm test            # check-syntax → check-design → check-parity → check-css-coverage
                    # → check-norms → test-domain (89 assertions)
npm run gate        # gate:css (cascade) → gate:sw (précache servable)
                    # → gate:artifact:warn (fraîcheur de graphify-out) → gate:selftest
npm run gate:selftest   # rejoue les 7 pannes témoins des gates eux-mêmes
```

- `check-syntax` — la page livrée, son `<script>` inline, les 8 modules et le socle compilent.
- `check-design` — design system : tolérance **zéro** sur `css/**` et `src/presentation/**` ;
  app livrée gelée **par comptage de règle** (une seule violation nouvelle fait échouer).
- `check-parity` — chaque `getElementById`/`querySelector('#…')` des modules correspond à un id
  présent dans `patisserie.html` (baseline des 7 écarts pré-existants de `modals.js`).
- `check-css-coverage` — chaque classe structurelle utilisée existe dans le CSS ou est une
  classe Tailwind couverte par le CDN.
- `check-norms` — cohérence des seuils HACCP entre sources (11 égalités, 4 divergences documentées).
- `test-domain` — 89 assertions sur le domaine vivant + `--selftest` qui sabote une valeur et
  exige l'échec (un test qui ne peut pas échouer ne teste rien).

**Ce qu'aucun de ces gates ne prouve : que la page s'affiche.** Le rendu se vérifie hors dépôt,
avec les harnais Hermes : `traqhaccp-e2e.mjs` (navigation réelle dans les 5 vues, 3 gabarits,
erreurs console, débordement horizontal) et `verify-offline.mjs` (service worker actif, réseau
coupé, page effectivement peinte). Les deux sondent la page avant de mesurer : s'ils ne
reconnaissent pas la génération livrée, ils sortent en erreur au lieu de rendre un verdict faux.

## 6. Dette mesurée au 24/09/2026

- **Tailwind par CDN** : 2 880 classes utilitaires dans `patisserie.html` + `js/patisserie/*.js`,
  et **667 violations du design system** gelées sur 14 règles
  (`tools/tailwind-baseline.json`, `tools/design-violations-baseline.json`).
  Cohérence hors-ligne : dépend du cache du CDN par le service worker (hors-ligne prouvé réseau
  coupé). **Priorité de résorption** : commencer par les couleurs (453) et les rayons (112).
- **God File** : 4 dépassements (§2.3). `patisserie.html` est le premier candidat à un découpage.
- **Deux points d'entrée historiques** : `test_clean_arch.js` était servi publiquement (HTTP 200)
  jusqu'au 24/09/2026 — supprimé.

## 7. Traçabilité des décisions

- **23/09/2026** — abandon de la clean architecture v4 ; l'app livrée devient `patisserie.html`
  + modules `js/patisserie/`.
- **24/09/2026** — retrait des 50 fichiers de l'architecture abandonnée, réalignement de
  `npm test` sur l'app livrée, création des baselines de dette, ajout des pannes témoins.
  Détail chiffré : `docs/BUGS.md` §7.
