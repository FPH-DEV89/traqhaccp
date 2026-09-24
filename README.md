# TraqHACCP — Registre sanitaire pâtisserie

Application web **française** de registre sanitaire HACCP pour la pâtisserie artisanale :
relevés de températures, plan de nettoyage, suivi des huiles de friture, réception et
traçabilité des denrées, allergènes (INCO), non-conformités, registre DDPP et mode inspection.

- **PWA statique** : `patisserie.html` + modules ES natifs, **aucun build**, **aucune dépendance npm**.
- **Hors-ligne d'abord** : toutes les données restent dans le navigateur (`localStorage` + Supabase
  optionnel), un service worker met les fichiers en cache.
- **Modules ES plats** : `js/patisserie/` (8 modules), socle `src/domain/` et `src/infrastructure/` vivants.
- Interface, libellés, commentaires et formats en français (virgule décimale, espace fine avant `°C` et `%`).

Architecture détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
Design system : [`docs/DESIGN.md`](docs/DESIGN.md) ·
App livrée : [`docs/PATISSERIE_COMPLETE`](docs/PATISSERIE_COMPLETE).

## Architecture de l'app livrée

```
patisserie.html                entrée unique : shell, vues, navigation
manifest.json / sw.js          PWA : installation, cache hors-ligne
css/                           design system : tokens, components, views (+ dette Tailwind CDN)
js/patisserie/                 8 modules applicatifs (app, auth, views, state, modals…)
src/domain/constants.js        données de référence : normes HACCP, brigade, navigation, DLC
src/domain/haccp_norms.js      seuils réglementaires HACCP (source de vérité documentée)
src/infrastructure/config.js   variables d'environnement
src/infrastructure/supabase_client.js  client Supabase (optionnel)
src/presentation/connexion.js  page de connexion
src/presentation/icons.js      sprite SVG
src/presentation/ui.js         composants UI (toasts, modales, cartes)
tools/                         gates statiques + tests du domaine (npm test)
```

> **Note architecture** : la tentative « clean architecture v4 » (`index.html` + `src/application`
> + `src/presentation/views/`) a été **abandonnée** le 23/09/2026 (commits `3c400bf` → `6499947`
> → `7983395`) et retirée définitivement le 24/09/2026. L'app livrée est `patisserie.html`.

## Démarrage (sans build)

```bash
cd traqhaccp
python3 -m http.server 8899      # ou : npm run serve
# → http://localhost:8899/patisserie.html
```

Node.js 22 et python3 suffisent. **Ne jamais lancer `npm install`** : le projet n'a pas de
dépendances npm (Playwright est optionnel pour le gate de peinture).

## Dette Tailwind

L'app livrée charge **Tailwind depuis le CDN** (`cdn.tailwindcss.com`). C'est une dette produit
mesurée (24/09/2026) et gelée dans `tools/tailwind-baseline.json` :
- `rounded-xl` : 81 occurrences · `shadow-sm` : 33 · `backdrop-blur` : 13
- Total classes utilitaires Tailwind : 3 134 uniques dans `patisserie.html` + `js/patisserie/`

Le gate `check-design.mjs` **échoue si un compteur augmente**. Une baisse se répercute à la
main dans `tailwind-baseline.json` et se note dans `docs/BUGS.md`.

## Modules applicatifs

Chargés par `patisserie.html` depuis `js/patisserie/` :
- `app.js` — point d'entrée, boot, navigation entre vues
- `auth.js` — authentification Supabase + mode local
- `views.js` — rendu de chaque vue HACCP (températures, réceptions, etc.)
- `state.js` — état partagé (localStorage + Supabase)
- `modals.js` — composants modaux (formulaires, confirmations)
- `calculations.js` — calculs métier (DLC, coûts, scores)
- `recall.js` — rappel produit et alertes
- `audio-toast.js` — retour sonore et notifications toast

## Données locales

Stockées dans le navigateur sous des clés `traq_` :
`traq_equipments`, `traq_deliveries`, `traq_preparations`, `traq_allergens`, `traq_cleaning`,
`traq_fryers`, `traq_cooling`, `traq_defrost`, `traq_ph`, `traq_weight`, `traq_documents`,
`traq_nonconformities`, `traq_checklists`, `traq_brigade`, `traq_settings`, `traq_session`.

Synchronisation Supabase optionnelle (désactivée en mode local avec `?mode=local`).

## Vérifications

```bash
npm test                      # suite complète (check-syntax + check-design + check-parity
                              # + check-css-coverage + check-norms + test-domain)
node tools/test-domain.mjs               # tests du domaine vivant (89 assertions)
node tools/test-domain.mjs --selftest    # panne témoin (doit échouer, rc=1)
node tools/check-norms-consistency.mjs  # cohérence des seuils HACCP
node tools/check-parity.mjs             # parité patisserie.html ↔ js/patisserie
node tools/check-css-coverage.mjs       # classes CSS design system manquantes
npm run gate                  # gates rapides (CSS cascade + SW précache + fraîcheur graphe + selftest)
npm run gate:selftest         # toutes les pannes témoins
```

## Déploiement — Vercel (unique cible)

Site 100 % statique. **URL de référence :** `https://traqhaccp.vercel.app/`

Chaque `git push origin main` redéploie automatiquement. `vercel.json` active :
- les URLs propres (`cleanUrls: true`)
- la réécriture `/` → `patisserie.html`
- le redirect permanent `/index.html` → `/` (ancienne URL après suppression du fichier)
- le `no-store` du service worker.
