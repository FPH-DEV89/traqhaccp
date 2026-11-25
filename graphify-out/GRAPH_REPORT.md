# Graph Report - traqhaccp  (2026-11-25)

## Corpus Check
- 86 files · ~103,279 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .css 10, (none) 4)

## Summary
- 1123 nodes · 2124 edges · 77 communities (54 shown, 23 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae9b3d9f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- config.js
- BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles
- settings.js
- DATA.md — Socle de données TraqHACCP
- Icon and Overlay UI
- settings-norms.js
- Manuel Utilisateur — TraqHACCP Pro
- Design Debt Validation
- scripts
- check-css-coverage.mjs
- connexion.js
- check-parity.mjs
- Automated Gate Testing
- PWA Web Manifest
- TraqHACCP — Contrat de design « REGISTRE »
- Service Worker Asset Audit
- Artifact Freshness Check
- UI Paint Performance Audit
- Syntax Validation Utility
- Service Worker Caching Strategy
- vercel.json
- SupabaseClient
- marked.min.cjs
- recette-client.mjs
- settings-data.js
- Déploiement Cloudflare Pages (option 0 €)
- steps
- recette-sync.mjs
- Guide de conformité HACCP pour TraqHACCP
- God File 500-line non-negotiable
- HACCP regulatory thresholds (CE 852/2004, Arrêté 21/12/2009)
- Measured import closure as single source of truth
- Read-only DDPP inspection mode
- Offline-first PWA
- Multi-tenant Row Level Security
- Five roles and permission matrix
- Frozen Tailwind CDN debt (2880 classes / 667 violations)
- ddpp_report.js
- w
- se
- TraqHACCP — Guide utilisateur
- 14. Les réglages de l'établissement (8 onglets)
- 16. Sauvegarde, restauration et usage hors connexion
- 3. Compte, connexion et mode de démonstration
- 7. Réception d'une marchandise dans le registre
- 9. Ventes et déstockage FIFO
- 10. Fiches coût, recettes et marges
- 13. Équipe, rôles et codes PIN
- 2. Installer l'application sur le poste de travail
- 5. Se repérer : l'anatomie de l'écran principal
- 6. La routine quotidienne en trois passes
- 11. Saisie assistée : scan d'étiquette et ajustement d'inventaire
- 12. Contrôle sanitaire DDPP et enquête de traçabilité
- 15. Couleurs, statuts et alertes
- 8. DLC secondaires et témoins sanitaires
- oe
- push-guide-drive.py
- .parseInline
- build-guide-doc.mjs
- build-guide-pdf.mjs
- ne
- sync.js
- extract-label.js
- ref_node_fs
- le
- check-sw-bump.mjs
- recuperation.js
- build-dist.sh
- /js/patisserie/etat-sauvegarde.js
- /js/patisserie/state.js
- /src/infrastructure/supabase_client.js
- /js/patisserie/sync.js
- supabase_client.js
- .requete

## God Nodes (most connected - your core abstractions)
1. `playBeep()` - 39 edges
2. `showToast()` - 33 edges
3. `w` - 28 edges
4. `saveState()` - 27 edges
5. `SupabaseClient` - 25 edges
6. `se` - 24 edges
7. `TraqHACCP — Guide utilisateur` - 23 edges
8. `scripts` - 22 edges
9. `icon()` - 18 edges
10. `construireRegistreDdpp()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Pièges (propres au compte réel)` --references--> `saveState()`  [INFERRED]
  tools/recette-sync/README.md → js/patisserie/state.js
- `Recette de la synchronisation` --references--> `saveState()`  [INFERRED]
  tools/recette-sync/README.md → js/patisserie/state.js
- `Pièges (payés une fois)` --references--> `viderFile()`  [INFERRED]
  tools/recette-sync/README.md → js/patisserie/sync.js
- `Publication (déploiement)` --references--> `main()`  [INFERRED]
  GEMINI.md → tools/push-guide-drive.py
- `2. Interdits (signatures « AI slop » à éliminer)` --references--> `confirm()`  [INFERRED]
  docs/DESIGN.md → src/presentation/ui.js

## Import Cycles
- 3-file cycle: `js/patisserie/archive.js -> js/patisserie/settings.js -> js/patisserie/settings-data.js -> js/patisserie/archive.js`

## Communities (77 total, 23 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.07
Nodes (104): callOpenRouterDirect(), compressImage(), DEMO_LABEL_DATA_URL, demoLabelData(), extractLabelData(), rafraichirToutesLesVues(), syncThemeAttribute(), toggleDarkMode() (+96 more)

### Community 1 - "config.js"
Cohesion: 0.13
Nodes (14): appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), lireStockage(), MODE_PERSISTANCE, modeParametreUrl(), modePersistance(), MODES_PERSISTANCE (+6 more)

### Community 2 - "BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles"
Cohesion: 0.20
Nodes (9): 1. 16/09/2026 — « les titres s'affichent mais rien d'autre », 2. 17/09/2026 — artefact généré périmé + raccourci cassé, 3. 16/09/2026 — écrasement silencieux en cascade, 4. 17/09/2026 — les pièges des gates eux-mêmes (appris en les posant), 5. 18/09/2026 — le gate ne pouvait plus mordre (binaire Playwright absent), 6. 23/09/2026 — le « hors-ligne » qui n'existait pas (service worker jeté en silence), 7. 24/09/2026 — la chaîne de vérification validait du code mort, BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles (+1 more)

### Community 3 - "settings.js"
Cohesion: 0.13
Nodes (36): actionHandlers, armConfirm(), armed, bindSettingsEvents(), clone(), esc(), isDarkTheme(), onSettingsClick() (+28 more)

### Community 4 - "DATA.md — Socle de données TraqHACCP"
Cohesion: 0.18
Nodes (10): 1. Le tenant, c'est l'établissement, 2. Schéma (20 tables), 3. Rôles et permissions, 4. Cloisonnement (RLS), 5. Modes de persistance, 6. Bootstrap d'un établissement, 7. Appliquer les migrations, 8. Ce qui n'est pas fait (+2 more)

### Community 5 - "Icon and Overlay UI"
Cohesion: 0.14
Nodes (28): 2. Interdits (signatures « AI slop » à éliminer), banner(), camera(), closeAllOverlays(), closeOverlay(), closeTopOverlay, compresserImage(), confirm() (+20 more)

### Community 6 - "settings-norms.js"
Cohesion: 0.06
Nodes (63): alerteDate(), alertesDuJour(), dansHeuresCalmes(), dateLisible(), DEFAUTS, demarrerAlertes(), deuxChiffres(), ecrireVues() (+55 more)

### Community 7 - "Manuel Utilisateur — TraqHACCP Pro"
Cohesion: 0.07
Nodes (27): 1. Premiers pas : Accéder à l'application & Mode d'utilisation, 2. Créer un compte et son établissement, 3.1 Compléter la fiche établissement, 3.2 Déclarer vos équipements de froid et chaud, 3.3 Configurer votre brigade et attribuer les rôles, 3. Configuration initiale essentielle, 4. Rôles et permissions, 5.1 Températures des enceintes (Module 02) (+19 more)

### Community 8 - "Design Debt Validation"
Cohesion: 0.08
Nodes (26): addDebtViolation(), ALLOWED_SYMBOLS, BANS, cssFiles, dvBaselinePath, dvErrors, dvWarnings, EMOJI_RANGES (+18 more)

### Community 9 - "scripts"
Cohesion: 0.06
Nodes (34): description, gates, artifact-fresh, _comment, css-cascade, sw-assets, sw-bump, ui-paint (+26 more)

### Community 10 - "check-css-coverage.mjs"
Cohesion: 0.09
Nodes (23): baselinePath, cssFiles, cssText, defined, htmlPath, isKnown(), jsDir, knownStructural (+15 more)

### Community 11 - "connexion.js"
Cohesion: 0.16
Nodes (32): afficherConnexion(), afficherErreur(), afficherEtape(), analyserHashAuth(), champ(), contexte, effacerErreur(), etatOccupe() (+24 more)

### Community 12 - "check-parity.mjs"
Cohesion: 0.09
Nodes (21): allJsSources, BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlName, htmlPath (+13 more)

### Community 13 - "Automated Gate Testing"
Cohesion: 0.11
Nodes (11): BAC, dCasse, dSain, ENV, ICI, rClippee, rDomainNormal, rDomainSelftest (+3 more)

### Community 14 - "PWA Web Manifest"
Cohesion: 0.13
Nodes (14): background_color, categories, description, dir, display, icons, id, lang (+6 more)

### Community 15 - "TraqHACCP — Contrat de design « REGISTRE »"
Cohesion: 0.06
Nodes (28): Favicon monogramme T, Design system styleguide, 1. Ce qui est livré, en production, 2. Contraintes non négociables, 3. Arborescence réelle, 4. Graphe d'exécution — la seule vérité, 5. Chaîne de vérification — ce que chaque gate prouve (et ne prouve pas), 6. Dette mesurée au 24/09/2026 (+20 more)

### Community 16 - "Service Worker Asset Audit"
Cohesion: 0.20
Nodes (11): argv, bloc, fermeture(), manquants, opt, oublies, precache, precacheSet (+3 more)

### Community 17 - "Artifact Freshness Check"
Cohesion: 0.18
Nodes (8): argv, changes, cible, code, marqueur, opt, rapport, re

### Community 18 - "UI Paint Performance Audit"
Cohesion: 0.22
Nodes (7): argv, echecs, lancerNavigateur(), LARGEURS, loadPlaywright(), opt, require

### Community 19 - "Syntax Validation Utility"
Cohesion: 0.18
Nodes (7): errors, files, htmlPath, ROOT, SKIP, tmp, walk()

### Community 20 - "Service Worker Caching Strategy"
Cohesion: 0.33
Nodes (3): ASSETS_TO_CACHE, CDN_CRITIQUE, TIERS_SECONDAIRES

### Community 21 - "vercel.json"
Cohesion: 0.40
Nodes (4): cleanUrls, headers, redirects, version

### Community 23 - "marked.min.cjs"
Cohesion: 0.22
Nodes (3): d(), ie, p()

### Community 24 - "recette-client.mjs"
Cohesion: 0.15
Nodes (8): SUPABASE_CLE_SESSION, CLE_PUBLIQUE, CLE_SERVICE, COLLECTIONS_REGISTRE, contenuEnv, { email: EMAIL_CLIENT, url: URL_APP }, journal, URL_SUPA

### Community 25 - "settings-data.js"
Cohesion: 0.14
Nodes (26): ALERT_FALLBACK, applyArchive(), archiveField(), archiveFileName(), backupState(), buildArchive(), chooseArchiveFile(), demanderAutorisation() (+18 more)

### Community 26 - "Déploiement Cloudflare Pages (option 0 €)"
Cohesion: 0.33
Nodes (5): Après déploiement — non négociable, Construire le paquet, Déploiement Cloudflare Pages (option 0 €), Déployer, Piège connu

### Community 27 - "steps"
Cohesion: 0.09
Nodes (26): if, name, needs, permissions, runs-on, steps, jobs, deploy (+18 more)

### Community 28 - "recette-sync.mjs"
Cohesion: 0.06
Nodes (26): errs, failed, errs, failed, ids, errs, failed, brokenImports (+18 more)

### Community 29 - "Guide de conformité HACCP pour TraqHACCP"
Cohesion: 0.33
Nodes (5): 1. Barèmes de Températures Réglementaires (Arrêté du 21/12/2009), 2. Refroidissement Rapide et Cuisson, 3. Huiles de Friture, 4. Inviolabilité et Traçabilité, Guide de conformité HACCP pour TraqHACCP

### Community 38 - "ddpp_report.js"
Cohesion: 0.12
Nodes (45): brancherArchivePdf(), dateAujourdhui(), dateDebutDefaut(), exporterArchivePdf(), renderArchivePdf(), chargeCanonique(), normaliser(), construireArchiveRegistre() (+37 more)

### Community 39 - "w"
Cohesion: 0.09
Nodes (4): b(), c(), w, x()

### Community 41 - "TraqHACCP — Guide utilisateur"
Cohesion: 0.20
Nodes (9): 17. Dépannage : les 10 questions les plus fréquentes, 18. Ce que cette version ne fait pas encore, 1. À quoi sert TraqHACCP, 4. Premier paramétrage de l'établissement (10 minutes), Annexe A — Référentiel réglementaire et seuils livrés, Annexe B — Glossaire métier, Annexe C — Mémo d'une page à afficher en laboratoire, Sommaire (+1 more)

### Community 42 - "14. Les réglages de l'établissement (8 onglets)"
Cohesion: 0.22
Nodes (9): 14.1 Établissement — la fiche officielle, 14.2 Préférences — confort d'usage, 14.3 Compte — session, brigade, établissement, 14.4 Normes & seuils — le référentiel de contrôle, 14.5 Équipements — le parc des enceintes, 14.6 Durées de vie — le barème des DLC secondaires, 14.7 Alertes — ce que l'appareil signale, 14.8 Données & sauvegardes (+1 more)

### Community 43 - "16. Sauvegarde, restauration et usage hors connexion"
Cohesion: 0.33
Nodes (6): 16.1 Où vivent les données (à comprendre absolument), 16.2 Exporter le registre (sauvegarde), 16.3 Restaurer une archive, 16.4 Utilisation hors connexion, 16.5 Durée de conservation, 16. Sauvegarde, restauration et usage hors connexion

### Community 44 - "3. Compte, connexion et mode de démonstration"
Cohesion: 0.33
Nodes (6): 3.1 Créer le compte de l'établissement (recommandé), 3.2 Se connecter, 3.3 Mot de passe oublié, 3.4 Un compte est obligatoire (l'application est en mode connecté), 3.5 Changer d'établissement / se déconnecter, 3. Compte, connexion et mode de démonstration

### Community 45 - "7. Réception d'une marchandise dans le registre"
Cohesion: 0.29
Nodes (7): 7.1 Ouvrir le formulaire, 7.2 Les champs du formulaire, 7.3 Valider, 7.4 Exemple complet (cas réel), 7.5 Filtres et lecture de la liste des lots, 7.6 Modifier un lot déjà enregistré, 7. Réception d'une marchandise dans le registre

### Community 46 - "9. Ventes et déstockage FIFO"
Cohesion: 0.29
Nodes (7): 9.1 Vendre une pâtisserie de la carte, 9.2 Enregistrer une vente hors carte (plusieurs produits, commande), 9.3 Les champs du déstockage, 9.4 Historique des ventes et déstockages, 9.5 Corriger une vente (nom de client erroné), 9.6 Supprimer une vente saisie en double (ou une fausse manipulation), 9. Ventes et déstockage FIFO

### Community 47 - "10. Fiches coût, recettes et marges"
Cohesion: 0.33
Nodes (6): 10.1 Comment lire une fiche, 10.2 Utiliser une fiche pour décider, 10.3 Vendre depuis une fiche, 10.4 Créer une nouvelle fiche recette, 10.5 Modifier une recette (ingrédient oublié, quantité erronée), 10. Fiches coût, recettes et marges

### Community 48 - "13. Équipe, rôles et codes PIN"
Cohesion: 0.50
Nodes (4): 13.1 Ajouter un membre de la brigade, 13.2 Codes PIN, 13.3 Changer d'opérateur en cours de service, 13. Équipe, rôles et codes PIN

### Community 49 - "2. Installer l'application sur le poste de travail"
Cohesion: 0.50
Nodes (4): 2.1 Sur ordinateur (laboratoire ou bureau), 2.2 Sur tablette ou téléphone (poste de production, salle de vente), 2.3 Mode sombre et sons, 2. Installer l'application sur le poste de travail

### Community 50 - "5. Se repérer : l'anatomie de l'écran principal"
Cohesion: 0.50
Nodes (4): 5.1 La barre supérieure, 5.2 Les 4 indicateurs (en haut de l'écran), 5.3 Vocabulaire des statuts (chapitre 15 pour le détail), 5. Se repérer : l'anatomie de l'écran principal

### Community 51 - "6. La routine quotidienne en trois passes"
Cohesion: 0.50
Nodes (4): 6. La routine quotidienne en trois passes, Passe 1 — À la livraison (3 à 5 minutes, à chaque réception), Passe 2 — À la production (1 minute par préparation), Passe 3 — En fin de service (5 minutes)

### Community 52 - "11. Saisie assistée : scan d'étiquette et ajustement d'inventaire"
Cohesion: 0.67
Nodes (3): 11.1 Scanner une étiquette (reconnaissance automatique), 11.2 Ajuster le stock d'un lot (inventaire), 11. Saisie assistée : scan d'étiquette et ajustement d'inventaire

### Community 53 - "12. Contrôle sanitaire DDPP et enquête de traçabilité"
Cohesion: 0.67
Nodes (3): 12.1 Le rapport de contrôle en trois points, 12.2 Enquête sanitaire et traçabilité descendante (le rappel produit), 12. Contrôle sanitaire DDPP et enquête de traçabilité

### Community 54 - "15. Couleurs, statuts et alertes"
Cohesion: 0.67
Nodes (3): 15.1 Les statuts de lot, 15.2 Les alertes de service, 15. Couleurs, statuts et alertes

### Community 55 - "8. DLC secondaires et témoins sanitaires"
Cohesion: 0.67
Nodes (3): 8.1 Créer une DLC secondaire, 8.2 Enregistrer un échantillon témoin, 8. DLC secondaires et témoins sanitaires

### Community 57 - "push-guide-drive.py"
Cohesion: 0.08
Nodes (15): Automatisation Git (Push après correctif et vérifications), Instructions pour l'assistant, Publication (déploiement), clean_id(), export_dot(), export_doc_pdf(), get_meta(), main() (+7 more)

### Community 59 - "build-guide-doc.mjs"
Cohesion: 0.14
Nodes (11): DOCS, html, kb, MD, MIME, missing, OUT, require (+3 more)

### Community 60 - "build-guide-pdf.mjs"
Cohesion: 0.22
Nodes (7): body, MD, OUT_HTML, OUT_PDF, require, ROOT, st

### Community 62 - "sync.js"
Cohesion: 0.12
Nodes (36): afficherEtatSauvegarde(), brancherEtatSauvegarde(), heure(), MODIFIANT, resumerEtat(), surClic(), signalerChangementExterne(), attribuerReglages() (+28 more)

### Community 63 - "extract-label.js"
Cohesion: 0.67
Nodes (3): CATEGORIES, handler(), parseJsonLoose()

### Community 67 - "check-sw-bump.mjs"
Cohesion: 0.16
Nodes (13): bloc, cible, commits, git(), lireCacheName(), modifies, precaches, quiet (+5 more)

### Community 69 - "recuperation.js"
Cohesion: 0.44
Nodes (8): CHAMPS_METIER, CHAMPS_RAPPORTES, cleChamp(), identifiant(), lireListe(), registresOrphelins(), restaurerRegistreOrphelin(), scopeCourant()

### Community 75 - "supabase_client.js"
Cohesion: 0.17
Nodes (9): SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, URL_PRODUCTION, citerValeur(), encoderFiltres(), messageFr(), MESSAGES_AUTH, MESSAGES_HTTP (+1 more)

## Knowledge Gaps
- **14 isolated node(s):** `/js/patisserie/etat-sauvegarde.js`, `/js/patisserie/state.js`, `/src/infrastructure/supabase_client.js`, `/js/patisserie/sync.js`, `Design system styleguide` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 565 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `w` connect `w` to `oe`, `ne`, `marked.min.cjs`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `saveState()` (e.g. with `Pièges (propres au compte réel)` and `Recette de la synchronisation`) actually correct?**
  _`saveState()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `/js/patisserie/etat-sauvegarde.js`, `/js/patisserie/state.js`, `/src/infrastructure/supabase_client.js` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06986492780624126 - nodes in this community are weakly interconnected._
- **Should `config.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1251778093883357 - nodes in this community are weakly interconnected._
- **Should `Icon and Overlay UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1354723707664884 - nodes in this community are weakly interconnected._