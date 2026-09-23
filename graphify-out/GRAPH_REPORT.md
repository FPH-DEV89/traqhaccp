# Graph Report - traqhaccp  (2026-09-23)

## Corpus Check
- 95 files · ~129,519 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1822 nodes · 3998 edges · 81 communities (59 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3e36db5b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shell.js
- supabase_repository.js
- compte.js
- UI Navigation and Actions
- Non-Conformity Management
- Traceability and Allergens
- allergens.js
- Reception Management
- Local Storage Repository
- context.js
- SupabaseHACCPRepository
- Audit and Scoring
- Cooling Cycle Tracking
- Document Management
- Inspection and Compliance
- pH and Weight Records
- Cleaning Management
- Temperature Monitoring
- AccountUseCases
- storage_repository.js
- HACCP Use Cases
- Defrosting Management
- Export and Labeling
- router.js
- Oil and Fryer Monitoring
- App Integration Tests
- test_clean_arch.js
- Parity and Integrity Checks
- Checklist Management
- scripts
- SettingsUseCases
- app.js
- dashboard.js
- settings_usecases.js
- manifest.json
- CSS Coverage Analysis
- test-export-service.mjs
- Design and Emoji Linting
- UI Audit Tooling
- ChecklistRoutine
- test-gates.mjs
- LocalPatisserieRepository
- UI Paint Performance Audit
- Camera and Scanning Service
- Syntax Validation
- Deployment Rules
- Mock Storage Repository
- entities.js
- CSS Cascade Analysis
- HACCP Fixture Seeding
- vercel.json
- constants.js
- SanitaryDocument
- Domain Logic Tests
- SupabaseClient
- Compliance Checker Tool
- View Module Interface
- PatisserieAppViewModel
- check-artifact-fresh.mjs
- TraqHACCP — Architecture cible v4 (contrat d'exécution)
- DATA.md — Socle de données TraqHACCP
- TraqHACCP — Contrat de design « REGISTRE »
- Manuel Utilisateur — TraqHACCP Pro
- SupabaseRepositoryBase
- TraqHACCP — Registre sanitaire
- BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles
- 5. Utilisation quotidienne : Les modules indispensables
- Guide de conformité HACCP pour TraqHACCP
- DESIGN.md
- 6. Contrôles spécifiques & Gestion des écarts
- 3. Configuration initiale essentielle
- pre-push
- sw.js
- Instructions pour l'assistant
- Git Automation Flow
- Assistant Instructions
- TraqHACCP CI Workflow
- config.js
- Vercel Production Deployment

## God Nodes (most connected - your core abstractions)
1. `LocalStorageHACCPRepository` - 48 edges
2. `SupabaseHACCPRepository` - 48 edges
3. `SettingsUseCases` - 34 edges
4. `HACCPUseCases` - 34 edges
5. `playBeep()` - 33 edges
6. `AccountUseCases` - 27 edges
7. `SupabaseClient` - 27 edges
8. `HACCPStore` - 25 edges
9. `icon()` - 23 edges
10. `normalizeSettings()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `initAuth()` --calls--> `modePersistance()`  [EXTRACTED]
  js/patisserie/auth.js → src/infrastructure/config.js
- `fermeture()` --indirect_call--> `racine()`  [INFERRED]
  tools/check-sw-assets.mjs → src/presentation/router.js
- `manquants` --indirect_call--> `racine()`  [INFERRED]
  tools/check-sw-assets.mjs → src/presentation/router.js
- `afficherPortailConnexion()` --calls--> `definirModePersistance()`  [EXTRACTED]
  js/patisserie/auth.js → src/infrastructure/config.js
- `deconnecterEtablissement()` --calls--> `definirModePersistance()`  [EXTRACTED]
  js/patisserie/auth.js → src/infrastructure/config.js

## Import Cycles
- None detected.

## Communities (81 total, 22 thin omitted)

### Community 0 - "shell.js"
Cohesion: 0.06
Nodes (88): afficherConnexion(), afficherErreur(), afficherEtape(), analyserHashAuth(), champ(), contexte, effacerErreur(), etatOccupe() (+80 more)

### Community 1 - "supabase_repository.js"
Cohesion: 0.14
Nodes (20): DEFAULT_ESTABLISHMENT, SUPABASE_CLE_ETAT, exporterSauvegarde(), importerSauvegarde(), citerValeur(), ErreurSupabase, cibleConflit(), COLLECTIONS (+12 more)

### Community 2 - "compte.js"
Cohesion: 0.07
Nodes (75): canManageUsers(), hasPermission(), PERMISSIONS, ROLE_ORDER, estModeServeur(), blocSession(), clientDe(), esc() (+67 more)

### Community 3 - "UI Navigation and Actions"
Cohesion: 0.07
Nodes (70): ACTIONS, afficherErreurs(), afficherErreursPanneau(), aller(), annees(), apercu(), appliquerPreference(), appliquerSauvegarde() (+62 more)

### Community 4 - "Non-Conformity Management"
Cohesion: 0.12
Nodes (52): ACTIONS, aujour(), barreFiltres(), basculer(), blocTransition(), categorieDe(), champ(), chercher() (+44 more)

### Community 5 - "Traceability and Allergens"
Cohesion: 0.10
Nodes (48): ACTIONS, ajouterJours(), allergeneDe(), attacher(), blocChamp(), blocDlc(), blocFiltres(), blocFormulaire() (+40 more)

### Community 6 - "allergens.js"
Cohesion: 0.17
Nodes (27): ACTIONS, appliquerRecherche(), barreOutils(), blocClient(), categories(), conserverNote(), corpsFiche(), documentMatrice() (+19 more)

### Community 7 - "Reception Management"
Cohesion: 0.10
Nodes (44): ACTIONS, attacher(), blocFiltres(), blocFormulaire(), blocTable(), blocVerdict(), brancherVerdict(), celluleTemperature() (+36 more)

### Community 9 - "context.js"
Cohesion: 0.08
Nodes (16): NAV, AudioService, app, boot(), charger(), createApp(), creerPasserelle(), fmt (+8 more)

### Community 11 - "Audit and Scoring"
Cohesion: 0.11
Nodes (38): ACTIONS, appExport(), attacher(), blocRecherche(), blocScore(), cellule(), dansPeriode(), debutPeriode() (+30 more)

### Community 12 - "Cooling Cycle Tracking"
Cohesion: 0.14
Nodes (39): ACTIONS, attacher(), carteEnCours(), chrono(), cloturer(), consignerPoint(), corrective(), courbe() (+31 more)

### Community 13 - "Document Management"
Cohesion: 0.15
Nodes (37): ACTIONS, aujour(), barreOutils(), brancherFichier(), categorieDe(), chercher(), corpsFiche(), dateDuJour() (+29 more)

### Community 14 - "Inspection and Compliance"
Cohesion: 0.13
Nodes (35): ACTIONS, appExport(), attacher(), bloc(), blocConformite(), blocDocuments(), blocDomaines(), blocEquipements() (+27 more)

### Community 15 - "pH and Weight Records"
Cohesion: 0.14
Nodes (34): ACTIONS, apercuPh(), apercuPoids(), atMs(), attacher(), blocSeg(), champ(), conformePh() (+26 more)

### Community 16 - "Cleaning Management"
Cohesion: 0.14
Nodes (34): ACTIONS, ALIAS, barreOutils(), basculer(), compteurs(), correspond(), derniere(), echeance() (+26 more)

### Community 17 - "Temperature Monitoring"
Cohesion: 0.17
Nodes (34): ACTIONS, attacher(), aujourdhui(), borne(), conformeEq(), creneauDe(), CRENEAUX, creneauxFaits() (+26 more)

### Community 18 - "AccountUseCases"
Cohesion: 0.21
Nodes (3): AccountUseCases, operatorDisplayName(), validateOperator()

### Community 19 - "storage_repository.js"
Cohesion: 0.07
Nodes (23): DEFAULT_CHECKLIST_ROUTINES, ChecklistItem, CoolingCycle, DefrostCycle, DishAllergens, NonConformity, PhControlRecord, PreparationLabel (+15 more)

### Community 21 - "Defrosting Management"
Cohesion: 0.13
Nodes (30): ACTIONS, attacher(), blocEnCours(), blocHistorique(), blocKpis(), blocMesures(), blocRegle(), champValeur() (+22 more)

### Community 22 - "Export and Labeling"
Cohesion: 0.13
Nodes (28): buildLabelHtml(), fmtDate(), labelCss(), buildRegisterHtml(), fmtDate(), fmtNum(), registerCss(), statusLabel() (+20 more)

### Community 23 - "router.js"
Cohesion: 0.13
Nodes (28): contexte(), demonter(), destroy(), element(), idDuHash(), idEtat(), initRouter(), majHash() (+20 more)

### Community 24 - "Oil and Fryer Monitoring"
Cohesion: 0.17
Nodes (28): ACTIONS, apercuTpm(), attacher(), compteurs(), consigner(), decision(), echapper(), ECHELLE (+20 more)

### Community 25 - "App Integration Tests"
Cohesion: 0.07
Nodes (28): audio, barcodeSVG, chks, cleanings, cool, defrost, delivConform, delivReject (+20 more)

### Community 26 - "test_clean_arch.js"
Cohesion: 0.08
Nodes (20): BarcodeService, checklists, conformPh, conformWeight, dangerPh, docs, eq, expiredDoc (+12 more)

### Community 27 - "Parity and Integrity Checks"
Cohesion: 0.08
Nodes (25): BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlPath, idsJs, idsLegacy (+17 more)

### Community 28 - "Checklist Management"
Cohesion: 0.17
Nodes (22): ACTIONS, attacher(), autoCompleter(), autoFait, barreProgression(), echapper(), estAutomatique(), historique() (+14 more)

### Community 29 - "scripts"
Cohesion: 0.08
Nodes (25): description, gates, artifact-fresh, _comment, css-cascade, ui-paint, name, private (+17 more)

### Community 31 - "app.js"
Cohesion: 0.11
Nodes (68): playBeep(), showToast(), afficherPortailConnexion(), deconnecterEtablissement(), initAuth(), rafraichirToutesLesVues(), synchroniserEtablissementConnecte(), updateHeaderEstablishment() (+60 more)

### Community 32 - "dashboard.js"
Cohesion: 0.19
Nodes (18): ACTIONS, attacher(), blocAlertes(), blocBanniere(), blocRoutineRapide(), blocTuiles(), dateFr(), debutDeJour() (+10 more)

### Community 33 - "settings_usecases.js"
Cohesion: 0.11
Nodes (14): COLLECTIONS, CONTROLES_REGLAGES, COUPLES_ORDONNES, DENSITES, PLAGES_SEUILS, SECTIONS_PURGEABLES, SECTIONS_SAUVEGARDE, THEMES (+6 more)

### Community 34 - "manifest.json"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, icons, id, lang (+9 more)

### Community 35 - "CSS Coverage Analysis"
Cohesion: 0.12
Nodes (14): cssFiles, cssText, defined, MIGRATION_DONE, missing, ROOT, single, SKIP (+6 more)

### Community 36 - "test-export-service.mjs"
Cohesion: 0.11
Nodes (12): app, backupStr, csv, lbl, preps, r2, r3, regHtml (+4 more)

### Community 37 - "Design and Emoji Linting"
Cohesion: 0.15
Nodes (13): ALLOWED_SYMBOLS, BANS, cssFiles, EMOJI_RANGES, findEmoji(), MIGRATION_DONE, presFiles, ROOT (+5 more)

### Community 38 - "UI Audit Tooling"
Cohesion: 0.14
Nodes (13): calledFuncs, declaredFuncs, declaredIdMatches, declaredIds, declaredTabContainers, eventMatches, getElemMatches, html (+5 more)

### Community 40 - "test-gates.mjs"
Cohesion: 0.12
Nodes (9): BAC, dCasse, dSain, ENV, ICI, rClippee, rSaine, rSwCasse (+1 more)

### Community 41 - "LocalPatisserieRepository"
Cohesion: 0.06
Nodes (14): PatisserieUseCases, IngredientLot, RecipeTechnicalSheet, SaleRecord, SecondaryDlcRecord, WitnessSampleRecord, FifoStockService, RecallConsoService (+6 more)

### Community 42 - "UI Paint Performance Audit"
Cohesion: 0.24
Nodes (7): argv, echecs, lancerNavigateur(), LARGEURS, loadPlaywright(), opt, require

### Community 44 - "Syntax Validation"
Cohesion: 0.22
Nodes (6): errors, files, html, ROOT, SKIP, tmp

### Community 47 - "entities.js"
Cohesion: 0.18
Nodes (10): PERMISSIONS_RESERVEES, createOperator(), createSettings(), DeliveryRecord, Fryer, makeOperatorId(), normalizeOperator(), OBVIOUS_PINS (+2 more)

### Community 50 - "vercel.json"
Cohesion: 0.40
Nodes (4): cleanUrls, headers, rewrites, version

### Community 51 - "constants.js"
Cohesion: 0.14
Nodes (15): ALL_14_ALLERGENS, APP_VERSION, DEFAULT_BRIGADE, DEFAULT_EQUIPMENTS, DEFAULT_SETTINGS, HACCP_NORMS, NC_CATEGORIES, SAN_DOC_CATEGORIES (+7 more)

### Community 54 - "SupabaseClient"
Cohesion: 0.15
Nodes (3): encoderFiltres(), messageFr(), SupabaseClient

### Community 59 - "check-artifact-fresh.mjs"
Cohesion: 0.18
Nodes (8): argv, changes, cible, code, marqueur, opt, rapport, re

### Community 60 - "TraqHACCP — Architecture cible v4 (contrat d'exécution)"
Cohesion: 0.17
Nodes (12): 1. Contraintes non négociables, 2. Arborescence cible, 3. Navigation — source de vérité unique, 4. Contrat des modules de vue, 5. API stable à utiliser dans les vues (contrat inter-specs), 6. Stratégie de migration (zéro casse, vérifiable à chaque étape), 8.1 Séquence de démarrage (contrat figé), 8.2 Repli legacy pendant la migration (+4 more)

### Community 61 - "DATA.md — Socle de données TraqHACCP"
Cohesion: 0.18
Nodes (10): 1. Le tenant, c'est l'établissement, 2. Schéma (20 tables), 3. Rôles et permissions, 4. Cloisonnement (RLS), 5. Modes de persistance, 6. Bootstrap d'un établissement, 7. Appliquer les migrations, 8. Ce qui n'est pas fait (+2 more)

### Community 62 - "TraqHACCP — Contrat de design « REGISTRE »"
Cohesion: 0.18
Nodes (11): 10. Définition de « fini » (checklist de revue visuelle), 1. Intention, 2. Interdits (signatures « AI slop » à éliminer), 3. Typographie, 4. Couleurs — thème « papier » (défaut) et « nuit », 5. Espacement, rayons, grille, 6. Profondeur, mouvement, accessibilité, 7. Classes de composants (contrat obligatoire) (+3 more)

### Community 63 - "Manuel Utilisateur — TraqHACCP Pro"
Cohesion: 0.18
Nodes (11): 1. Premiers pas : Accéder à l'application & Mode d'utilisation, 2. Créer un compte et son établissement, 4. Rôles et permissions, 7.1 Le Mode Inspection sécurisé (Module 15), 7.2 Registre officiel et exports (Module 14), 7. Contrôles officiels (DDPP / DDecPP / Services vétérinaires), 8. Installation sur tablette ou smartphone (PWA hors-ligne), 9. Sauvegardes et sécurité (+3 more)

### Community 65 - "TraqHACCP — Registre sanitaire"
Cohesion: 0.22
Nodes (9): Architecture, Design system, Données locales, Démarrage (sans build), Déploiement — Vercel (unique cible), Les 17 modules, Rôles et permissions, TraqHACCP — Registre sanitaire (+1 more)

### Community 66 - "BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles"
Cohesion: 0.22
Nodes (8): 1. 16/09/2026 — « les titres s'affichent mais rien d'autre », 2. 17/09/2026 — artefact généré périmé + raccourci cassé, 3. 16/09/2026 — écrasement silencieux en cascade, 4. 17/09/2026 — les pièges des gates eux-mêmes (appris en les posant), 5. 18/09/2026 — le gate ne pouvait plus mordre (binaire Playwright absent), 6. 23/09/2026 — le « hors-ligne » qui n'existait pas (service worker jeté en silence), BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles, Méta-gate : `tools/test-gates.mjs`

### Community 68 - "5. Utilisation quotidienne : Les modules indispensables"
Cohesion: 0.29
Nodes (7): 5.1 Températures des enceintes (Module 02), 5.2 Réception des marchandises & livraisons (Module 05), 5.3 Traçabilité, étiquettes & DLC secondaires (Module 04), 5.4 Plan de nettoyage et désinfection (Module 03), 5.5 Checklists d'ouverture et de fermeture (Module 06), 5.6 Huiles de friture (Module 07), 5. Utilisation quotidienne : Les modules indispensables

### Community 69 - "Guide de conformité HACCP pour TraqHACCP"
Cohesion: 0.33
Nodes (5): 1. Barèmes de Températures Réglementaires (Arrêté du 21/12/2009), 2. Refroidissement Rapide et Cuisson, 3. Huiles de Friture, 4. Inviolabilité et Traçabilité, Guide de conformité HACCP pour TraqHACCP

### Community 71 - "6. Contrôles spécifiques & Gestion des écarts"
Cohesion: 0.40
Nodes (5): 6.1 Refroidissement rapide (Module 09), 6.2 Décongélation sécurisée (Module 10), 6.3 Allergènes (Module 11 - Réglementation INCO), 6.4 Fiches de non-conformité et actions correctives (Module 08), 6. Contrôles spécifiques & Gestion des écarts

### Community 72 - "3. Configuration initiale essentielle"
Cohesion: 0.50
Nodes (4): 3.1 Compléter la fiche établissement, 3.2 Déclarer vos équipements de froid et chaud, 3.3 Configurer votre brigade et attribuer les rôles, 3. Configuration initiale essentielle

### Community 74 - "sw.js"
Cohesion: 0.33
Nodes (3): ASSETS_TO_CACHE, CDN_CRITIQUE, TIERS_SECONDAIRES

### Community 75 - "Instructions pour l'assistant"
Cohesion: 0.50
Nodes (3): Automatisation Git (Push après correctif et vérifications), Instructions pour l'assistant, Publication (déploiement)

### Community 80 - "config.js"
Cohesion: 0.12
Nodes (21): appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), lireStockage(), MODE_PERSISTANCE, modeParametreUrl(), modePersistance(), MODES_PERSISTANCE (+13 more)

## Knowledge Gaps
- **438 isolated node(s):** `html`, `getElemMatches`, `uniqueQueriedIds`, `declaredIdMatches`, `declaredIds` (+433 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SettingsUseCases` connect `SettingsUseCases` to `settings_usecases.js`, `Export and Labeling`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `SupabaseHACCPRepository` connect `SupabaseHACCPRepository` to `config.js`, `supabase_repository.js`, `SettingsUseCases`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `HACCPStore` connect `context.js` to `App Integration Tests`, `constants.js`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `html`, `getElemMatches`, `uniqueQueriedIds` to the rest of the system?**
  _438 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `shell.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0586997685672207 - nodes in this community are weakly interconnected._
- **Should `supabase_repository.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14482758620689656 - nodes in this community are weakly interconnected._
- **Should `compte.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._