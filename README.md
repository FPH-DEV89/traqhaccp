# TraqHACCP — Registre sanitaire

Application web **française** de registre sanitaire HACCP pour la restauration : relevés de
températures, plan de nettoyage, suivi des huiles de friture, réception et traçabilité des
denrées, allergènes (INCO), non-conformités, registre DDPP et mode inspection.

- **PWA statique** : HTML + modules ES natifs, **aucun build**, **aucune dépendance npm**.
- **Hors-ligne d'abord** : toutes les données restent dans le navigateur (`localStorage`),
  un service worker met les fichiers en cache.
- **Clean Architecture** : le domaine ne connaît ni le DOM ni `localStorage`.
- Interface, libellés, commentaires et formats de saisie en français (virgule décimale,
  espace fine insécable avant `°C` et `%`).

Architecture détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
Design system : [`docs/DESIGN.md`](docs/DESIGN.md) ·
Migration v3 → v4 : [`docs/MIGRATION_COMPLETE`](docs/MIGRATION_COMPLETE).

## Les 17 modules

Tableau de bord · Checklists · Températures · Réception · DLC et traçabilité · Allergènes ·
Plan de nettoyage · Huiles de friture · Refroidissement · Décongélation · pH et poids ·
Documents sanitaires · Non-conformités · Registre DDPP · Mode inspection ·
Compte et établissement · Réglages.

Chaque module est un module de vue autonome (`src/presentation/views/<id>.js`) exposant
`render(ctx)` et, au besoin, `mount(noeud, ctx)` / `unmount(noeud)`.

## Démarrage (sans build)

Aucune installation n'est nécessaire : les modules ES natifs exigent simplement d'être servis
en HTTP (ouvrir `index.html` en `file://` casse les imports).

```bash
cd traqhaccp
python3 -m http.server 8899      # ou : npm run serve
# → http://localhost:8899/
```

Node.js 22 et python3 suffisent. **Ne jamais lancer `npm install`** : le projet n'a pas de
dépendances npm.

## Architecture

```
index.html                     coquille : rail + barre supérieure + #view + onglets mobiles
manifest.json / sw.js          PWA : installation, cache hors-ligne
css/                           design system : tokens, base, layout, components, views
src/domain/                    entités, normes HACCP, rôles — zéro DOM, zéro stockage
src/application/               cas d'usage (relevés, réglages, compte, tableau de bord)
src/infrastructure/            localStorage, audio, code-barres/QR, exports CSV/JSON/PDF
src/presentation/context.js    racine de composition : boot() → shell puis routeur
src/presentation/shell.js      rail, barre supérieure, onglets, palette (Ctrl/⌘ + K)
src/presentation/router.js     montage des 17 vues dans #view, titre, hash #/<module>
src/presentation/store.js      état observable (abonnement des vues)
src/presentation/ui.js         composants (boutons, modales, cartes, états vides, toasts)
src/presentation/views/        les 17 modules de vue v4
tools/                         contrôles statiques + tests du domaine (npm test)
```

Flux de démarrage : `index.html` importe `boot()` ; `boot()` construit l'infrastructure et le
store, puis appelle `initShell(app)` (injecte la navigation) **avant** `initRouter(app)`
(monte la vue du module demandé). Aucun module ne touche au DOM à l'import.

## Design system

- `css/tokens.css` — variables (`--paper`, `--ink`, `--accent`, échelles `--s-*`, `--t-*`, polices).
- `css/base.css` — remise à zéro, typographie, accessibilité (skip-link, focus-visible).
- `css/layout.css` — grille `.app`, colonne `.workspace`, rail, barre supérieure, onglets, responsive.
- `css/components.css` — boutons, champs, cartes, KPI, callouts, tableaux, états vides.
- `css/views.css` — éléments propres aux modules (imprimés, planning, étiquettes).

Règle : **aucune valeur littérale** (`#hex`, `rgba()`, pixels de rythme) dans les composants —
toujours une variable de `tokens.css`.

## Données locales

Tout est stocké dans le navigateur, sous des clés préfixées `traq_` :
`traq_equipments`, `traq_deliveries`, `traq_preparations`, `traq_allergens`, `traq_cleaning`,
`traq_fryers`, `traq_cooling`, `traq_defrost`, `traq_ph`, `traq_weight`, `traq_documents`,
`traq_nonconformities`, `traq_checklists` (données métier héritées v3) puis `traq_brigade`,
`traq_settings`, `traq_session`, `traq_activity_log` (v4).

Aucune donnée ne quitte l'appareil : pas de serveur, pas de télémétrie. Les exports
(CSV, JSON, PDF, étiquettes) sont générés localement par `src/infrastructure/`.
Les polices Google Fonts et Tone.js (signalétique sonore) sont optionnelles : hors-ligne,
l'application fonctionne avec les polices système et sans son.

## Rôles et permissions

| Rôle | Libellé | Permissions |
| --- | --- | --- |
| `gerant` | Gérant | Toutes : création/modification/suppression/signature, non-conformités, réglages, équipements, utilisateurs, export, mode inspection, sauvegarde/restauration |
| `responsable` | Responsable | Tout sauf gestion des utilisateurs et restauration de sauvegarde |
| `operateur` | Opérateur | Créer, modifier et signer un relevé, exporter les données |
| `lecture` | Lecture seule | Consulter et exporter |
| `inspecteur` | Inspecteur DDPP | Mode inspection lecture seule et export pour contrôle officiel |

Source de vérité : `src/domain/roles.js` (`ROLES`, `PERMISSIONS`, `hasPermission()`).
Un rôle inconnu n'a aucune permission ; le gérant dispose de tout.

## Vérifications

```bash
npm test                      # suite complète (obligatoirement verte)
npm run check                 # syntaxe + design + parité
node tools/check-css-coverage.mjs        # toute classe utilisée existe en CSS
node tools/check-norms-consistency.mjs   # cohérence des seuils HACCP (v4 ↔ hérités v3)
node tools/test-domain.mjs               # tests du domaine / cas d'usage
node test_clean_arch.js                  # suite Clean Architecture étendue
node tools/test-export-service.mjs       # service d'export
impeccable detect css src/presentation/views   # anti-patterns de design
```

Ce que `npm test` enchaîne : `check-syntax` (syntaxe de tous les modules ES), `check-design`
(design system et surface des vues), `check-parity` (aucune référence orpheline, dette vide via
`tools/parity-baseline.json`), `check-css-coverage`, `check-norms-consistency` et `test-domain`.

## Déploiement — GitHub Pages

Site 100 % statique, servi depuis la **branche `main`** :

1. pousser le dépôt sur GitHub (`git push origin main`) ;
2. dépôt → **Settings → Pages → Build and deployment → Source : Deploy from a branch** ;
3. choisir la branche **`main`**, dossier **`/ (root)`**, puis **Save** ;
4. l'application est publiée sur `https://<compte>.github.io/<dépôt>/` (le fichier
   `.nojekyll` présent à la racine empêche Jekyll de filtrer les fichiers).

Chemins relatifs uniquement (`./src/…`, `./assets/…`) : le site fonctionne aussi bien à la
racine d'un domaine que dans un sous-dossier de projet. Le service worker (`sw.js`) et le
manifeste sont servis depuis la même origine ; le cache est versionné par `CACHE_NAME`, toute
nouvelle version invalide l'ancienne au premier chargement.
