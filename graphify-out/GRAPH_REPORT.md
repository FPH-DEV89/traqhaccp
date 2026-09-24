# Graph Report - traqhaccp_clean_architecture  (2026-09-24)

## Corpus Check
- 55 files · ~66,953 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 620 nodes · 1213 edges · 41 communities (27 shown, 14 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47663915`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_App UI State Management|App UI State Management]]
- [[_COMMUNITY_Supabase Persistence Configuration|Supabase Persistence Configuration]]
- [[_COMMUNITY_HACCP Regulatory Compliance|HACCP Regulatory Compliance]]
- [[_COMMUNITY_HACCP Data Repository|HACCP Data Repository]]
- [[_COMMUNITY_Multi-tenant Security Schema|Multi-tenant Security Schema]]
- [[_COMMUNITY_Icon and Overlay UI|Icon and Overlay UI]]
- [[_COMMUNITY_Application Constants and Norms|Application Constants and Norms]]
- [[_COMMUNITY_User Onboarding Documentation|User Onboarding Documentation]]
- [[_COMMUNITY_Design Debt Validation|Design Debt Validation]]
- [[_COMMUNITY_Project Scripts and Metadata|Project Scripts and Metadata]]
- [[_COMMUNITY_CSS Coverage Analysis|CSS Coverage Analysis]]
- [[_COMMUNITY_Authentication UI Logic|Authentication UI Logic]]
- [[_COMMUNITY_HTMLJS Parity Checking|HTML/JS Parity Checking]]
- [[_COMMUNITY_Automated Gate Testing|Automated Gate Testing]]
- [[_COMMUNITY_PWA Web Manifest|PWA Web Manifest]]
- [[_COMMUNITY_Design System Styleguide|Design System Styleguide]]
- [[_COMMUNITY_Service Worker Asset Audit|Service Worker Asset Audit]]
- [[_COMMUNITY_Artifact Freshness Check|Artifact Freshness Check]]
- [[_COMMUNITY_UI Paint Performance Audit|UI Paint Performance Audit]]
- [[_COMMUNITY_Syntax Validation Utility|Syntax Validation Utility]]
- [[_COMMUNITY_Service Worker Caching Strategy|Service Worker Caching Strategy]]
- [[_COMMUNITY_Vercel Deployment Configuration|Vercel Deployment Configuration]]
- [[_COMMUNITY_AI Assistant Instructions|AI Assistant Instructions]]
- [[_COMMUNITY_CSS Cascade Analysis|CSS Cascade Analysis]]
- [[_COMMUNITY_HACCP Data Seeding|HACCP Data Seeding]]
- [[_COMMUNITY_Git Pre-push Hooks|Git Pre-push Hooks]]
- [[_COMMUNITY_CI Validation Workflow|CI Validation Workflow]]
- [[_COMMUNITY_notifications.js|notifications.js]]
- [[_COMMUNITY_Guide de conformité HACCP pour TraqHACCP|Guide de conformité HACCP pour TraqHACCP]]
- [[_COMMUNITY_God File 500-line non-negotiable|God File 500-line non-negotiable]]
- [[_COMMUNITY_HACCP regulatory thresholds (CE 8522004, Arrêté 21122009)|HACCP regulatory thresholds (CE 852/2004, Arrêté 21/12/2009)]]
- [[_COMMUNITY_Measured import closure as single source of truth|Measured import closure as single source of truth]]
- [[_COMMUNITY_Read-only DDPP inspection mode|Read-only DDPP inspection mode]]
- [[_COMMUNITY_Offline-first PWA|Offline-first PWA]]
- [[_COMMUNITY_Multi-tenant Row Level Security|Multi-tenant Row Level Security]]
- [[_COMMUNITY_Five roles and permission matrix|Five roles and permission matrix]]
- [[_COMMUNITY_Frozen Tailwind CDN debt (2880 classes  667 violations)|Frozen Tailwind CDN debt (2880 classes / 667 violations)]]
- [[_COMMUNITY_patisserie.html — single-page app shell|patisserie.html — single-page app shell]]
- [[_COMMUNITY_PERSISTENCE_MODE|PERSISTENCE_MODE]]
- [[_COMMUNITY_closeTopOverlay|closeTopOverlay]]

## God Nodes (most connected - your core abstractions)
1. `playBeep()` - 33 edges
2. `SupabaseClient` - 25 edges
3. `showToast()` - 24 edges
4. `icon()` - 21 edges
5. `saveState()` - 18 edges
6. `tabContext()` - 15 edges
7. `closeModals()` - 14 edges
8. `scripts` - 14 edges
9. `rafraichirToutesLesVues()` - 12 edges
10. `confirmStockDepletion()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `afficherPortailConnexion()` --calls--> `afficherConnexion()`  [INFERRED]
  js/patisserie/auth.js → src/presentation/connexion.js
- `renderNormes()` --calls--> `icon()`  [INFERRED]
  js/patisserie/settings-norms.js → src/presentation/icons.js
- `renderEquipements()` --calls--> `icon()`  [INFERRED]
  js/patisserie/settings-norms.js → src/presentation/icons.js
- `renderDurees()` --calls--> `icon()`  [INFERRED]
  js/patisserie/settings-norms.js → src/presentation/icons.js
- `tabContext()` --indirect_call--> `icon()`  [INFERRED]
  js/patisserie/settings.js → src/presentation/icons.js

## Import Cycles
- None detected.

## Communities (41 total, 14 thin omitted)

### Community 0 - "App UI State Management"
Cohesion: 0.10
Nodes (72): playBeep(), showToast(), afficherPortailConnexion(), deconnecterEtablissement(), initAuth(), rafraichirToutesLesVues(), synchroniserEtablissementConnecte(), updateHeaderEstablishment() (+64 more)

### Community 1 - "Supabase Persistence Configuration"
Cohesion: 0.08
Nodes (17): appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), lireStockage(), modeParametreUrl(), modePersistance(), MODES_PERSISTANCE, stockageLocal() (+9 more)

### Community 2 - "HACCP Regulatory Compliance"
Cohesion: 0.20
Nodes (9): 1. 16/09/2026 — « les titres s'affichent mais rien d'autre », 2. 17/09/2026 — artefact généré périmé + raccourci cassé, 3. 16/09/2026 — écrasement silencieux en cascade, 4. 17/09/2026 — les pièges des gates eux-mêmes (appris en les posant), 5. 18/09/2026 — le gate ne pouvait plus mordre (binaire Playwright absent), 6. 23/09/2026 — le « hors-ligne » qui n'existait pas (service worker jeté en silence), 7. 24/09/2026 — la chaîne de vérification validait du code mort, BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles (+1 more)

### Community 3 - "HACCP Data Repository"
Cohesion: 0.14
Nodes (33): actionHandlers, armConfirm(), armed, bindSettingsEvents(), clone(), TABS_DATA, esc(), isDarkTheme() (+25 more)

### Community 4 - "Multi-tenant Security Schema"
Cohesion: 0.18
Nodes (10): 1. Le tenant, c'est l'établissement, 2. Schéma (20 tables), 3. Rôles et permissions, 4. Cloisonnement (RLS), 5. Modes de persistance, 6. Bootstrap d'un établissement, 7. Appliquer les migrations, 8. Ce qui n'est pas fait (+2 more)

### Community 5 - "Icon and Overlay UI"
Cohesion: 0.13
Nodes (33): NAV, icon(), ICON_ALIAS, iconFor(), ICONS, TRACES, banner(), camera() (+25 more)

### Community 6 - "Application Constants and Norms"
Cohesion: 0.08
Nodes (44): clone(), DLC_DEFAULTS, DLC_FAMILIES, dlcOf(), EQUIPMENT_TYPES, equipmentType(), frNumber(), frRange() (+36 more)

### Community 7 - "User Onboarding Documentation"
Cohesion: 0.07
Nodes (27): 1. Premiers pas : Accéder à l'application & Mode d'utilisation, 2. Créer un compte et son établissement, 3.1 Compléter la fiche établissement, 3.2 Déclarer vos équipements de froid et chaud, 3.3 Configurer votre brigade et attribuer les rôles, 3. Configuration initiale essentielle, 4. Rôles et permissions, 5.1 Températures des enceintes (Module 02) (+19 more)

### Community 8 - "Design Debt Validation"
Cohesion: 0.09
Nodes (25): addDebtViolation(), ALLOWED_SYMBOLS, BANS, cssFiles, dvBaselinePath, dvErrors, dvWarnings, EMOJI_RANGES (+17 more)

### Community 9 - "Project Scripts and Metadata"
Cohesion: 0.08
Nodes (24): description, gates, artifact-fresh, _comment, css-cascade, ui-paint, name, private (+16 more)

### Community 10 - "CSS Coverage Analysis"
Cohesion: 0.09
Nodes (22): baselinePath, cssFiles, cssText, defined, htmlPath, isTailwindClass(), jsDir, knownStructural (+14 more)

### Community 11 - "Authentication UI Logic"
Cohesion: 0.33
Nodes (22): afficherConnexion(), afficherErreur(), afficherEtape(), analyserHashAuth(), champ(), contexte, effacerErreur(), etatOccupe() (+14 more)

### Community 12 - "HTML/JS Parity Checking"
Cohesion: 0.09
Nodes (20): allJsSources, BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlName, htmlPath (+12 more)

### Community 13 - "Automated Gate Testing"
Cohesion: 0.11
Nodes (11): BAC, dCasse, dSain, ENV, ICI, rClippee, rDomainNormal, rDomainSelftest (+3 more)

### Community 14 - "PWA Web Manifest"
Cohesion: 0.13
Nodes (14): background_color, categories, description, dir, display, icons, id, lang (+6 more)

### Community 15 - "Design System Styleguide"
Cohesion: 0.06
Nodes (29): Favicon monogramme T, Design system styleguide, 1. Ce qui est livré, en production, 2. Contraintes non négociables, 3. Arborescence réelle, 4. Graphe d'exécution — la seule vérité, 5. Chaîne de vérification — ce que chaque gate prouve (et ne prouve pas), 6. Dette mesurée au 24/09/2026 (+21 more)

### Community 16 - "Service Worker Asset Audit"
Cohesion: 0.18
Nodes (11): argv, bloc, fermeture(), manquants, opt, oublies, precache, precacheSet (+3 more)

### Community 17 - "Artifact Freshness Check"
Cohesion: 0.18
Nodes (8): argv, changes, cible, code, marqueur, opt, rapport, re

### Community 18 - "UI Paint Performance Audit"
Cohesion: 0.24
Nodes (7): argv, echecs, lancerNavigateur(), LARGEURS, loadPlaywright(), opt, require

### Community 19 - "Syntax Validation Utility"
Cohesion: 0.22
Nodes (6): errors, files, htmlPath, ROOT, SKIP, tmp

### Community 20 - "Service Worker Caching Strategy"
Cohesion: 0.33
Nodes (3): ASSETS_TO_CACHE, CDN_CRITIQUE, TIERS_SECONDAIRES

### Community 21 - "Vercel Deployment Configuration"
Cohesion: 0.40
Nodes (4): cleanUrls, headers, redirects, version

### Community 22 - "AI Assistant Instructions"
Cohesion: 0.50
Nodes (3): Automatisation Git (Push après correctif et vérifications), Instructions pour l'assistant, Publication (déploiement)

### Community 25 - "Git Pre-push Hooks"
Cohesion: 0.15
Nodes (25): ALERT_FALLBACK, applyArchive(), archiveField(), archiveFileName(), backupState(), buildArchive(), chooseArchiveFile(), demanderAutorisation() (+17 more)

### Community 28 - "notifications.js"
Cohesion: 0.27
Nodes (16): alerteDate(), alertesDuJour(), dansHeuresCalmes(), dateLisible(), DEFAUTS, demarrerAlertes(), deuxChiffres(), ecrireVues() (+8 more)

### Community 29 - "Guide de conformité HACCP pour TraqHACCP"
Cohesion: 0.33
Nodes (5): 1. Barèmes de Températures Réglementaires (Arrêté du 21/12/2009), 2. Refroidissement Rapide et Cuisson, 3. Huiles de Friture, 4. Inviolabilité et Traçabilité, Guide de conformité HACCP pour TraqHACCP

## Knowledge Gaps
- **258 isolated node(s):** `DEFAUTS`, `ALERT_FALLBACK`, `REMINDER_LABELS`, `DLC_DEFAULTS`, `TABS_SOCLE` (+253 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `icon()` connect `Icon and Overlay UI` to `Authentication UI Logic`, `HACCP Data Repository`, `Application Constants and Norms`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `showToast()` connect `App UI State Management` to `HACCP Data Repository`, `notifications.js`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `icon()` (e.g. with `renderDurees()` and `renderEquipements()`) actually correct?**
  _`icon()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DEFAUTS`, `ALERT_FALLBACK`, `REMINDER_LABELS` to the rest of the system?**
  _258 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App UI State Management` be split into smaller, more focused modules?**
  _Cohesion score 0.10030864197530864 - nodes in this community are weakly interconnected._
- **Should `Supabase Persistence Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.07890070921985816 - nodes in this community are weakly interconnected._
- **Should `HACCP Data Repository` be split into smaller, more focused modules?**
  _Cohesion score 0.14260249554367202 - nodes in this community are weakly interconnected._