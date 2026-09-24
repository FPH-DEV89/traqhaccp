# Graph Report - .  (2026-09-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 606 nodes · 1074 edges · 28 communities (23 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.5)
- Token cost: 1,592 input · 306 output

## Graph Freshness
- Built from commit: `64337e73`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App UI State Management
- Supabase Persistence Configuration
- HACCP Regulatory Compliance
- HACCP Data Repository
- Multi-tenant Security Schema
- Icon and Overlay UI
- Application Constants and Norms
- User Onboarding Documentation
- Design Debt Validation
- Project Scripts and Metadata
- CSS Coverage Analysis
- Authentication UI Logic
- HTML/JS Parity Checking
- Automated Gate Testing
- PWA Web Manifest
- Design System Styleguide
- Service Worker Asset Audit
- Artifact Freshness Check
- UI Paint Performance Audit
- Syntax Validation Utility
- Service Worker Caching Strategy
- Vercel Deployment Configuration
- AI Assistant Instructions
- CSS Cascade Analysis
- HACCP Data Seeding
- Git Pre-push Hooks
- CI Validation Workflow

## God Nodes (most connected - your core abstractions)
1. `SupabaseHACCPRepository` - 48 edges
2. `playBeep()` - 33 edges
3. `SupabaseClient` - 26 edges
4. `showToast()` - 18 edges
5. `closeModals()` - 14 edges
6. `saveState()` - 14 edges
7. `scripts` - 14 edges
8. `icon()` - 13 edges
9. `rafraichirToutesLesVues()` - 12 edges
10. `confirmStockDepletion()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `afficherPortailConnexion()` --calls--> `definirModePersistance()`  [EXTRACTED]
  js/patisserie/auth.js → src/infrastructure/config.js
- `deconnecterEtablissement()` --calls--> `definirModePersistance()`  [EXTRACTED]
  js/patisserie/auth.js → src/infrastructure/config.js
- `initAuth()` --calls--> `modePersistance()`  [EXTRACTED]
  js/patisserie/auth.js → src/infrastructure/config.js
- `gabarit()` --calls--> `icon()`  [EXTRACTED]
  src/presentation/connexion.js → src/presentation/icons.js
- `preparer()` --calls--> `toast()`  [EXTRACTED]
  src/presentation/connexion.js → src/presentation/ui.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design system Registre : tokens + contrat + styleguide** — docs_design, design_styleguide, assets_favicon [EXTRACTED 0.85]

## Communities (28 total, 5 thin omitted)

### Community 0 - "App UI State Management"
Cohesion: 0.10
Nodes (71): playBeep(), showToast(), afficherPortailConnexion(), deconnecterEtablissement(), initAuth(), rafraichirToutesLesVues(), synchroniserEtablissementConnecte(), updateHeaderEstablishment() (+63 more)

### Community 1 - "Supabase Persistence Configuration"
Cohesion: 0.07
Nodes (24): appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), estModeServeur(), lireStockage(), MODE_PERSISTANCE, MODES_PERSISTANCE, PERSISTENCE_MODE (+16 more)

### Community 2 - "HACCP Regulatory Compliance"
Cohesion: 0.05
Nodes (41): 1. Barèmes de Températures Réglementaires (Arrêté du 21/12/2009), 2. Refroidissement Rapide et Cuisson, 3. Huiles de Friture, 4. Inviolabilité et Traçabilité, Guide de conformité HACCP pour TraqHACCP, God File 500-line non-negotiable, HACCP regulatory thresholds (CE 852/2004, Arrêté 21/12/2009), Measured import closure as single source of truth (+33 more)

### Community 4 - "Multi-tenant Security Schema"
Cohesion: 0.07
Nodes (32): Multi-tenant Row Level Security, Five roles and permission matrix, 1. Le tenant, c'est l'établissement, 2. Schéma (20 tables), 3. Rôles et permissions, 4. Cloisonnement (RLS), 5. Modes de persistance, 6. Bootstrap d'un établissement (+24 more)

### Community 5 - "Icon and Overlay UI"
Cohesion: 0.12
Nodes (33): icon(), ICON_ALIAS, iconFor(), ICONS, TRACES, banner(), camera(), closeAllOverlays() (+25 more)

### Community 6 - "Application Constants and Norms"
Cohesion: 0.11
Nodes (24): ALL_14_ALLERGENS, APP_VERSION, DEFAULT_BRIGADE, DEFAULT_CHECKLIST_ROUTINES, DEFAULT_EQUIPMENTS, DEFAULT_ESTABLISHMENT, DEFAULT_SETTINGS, HACCP_NORMS (+16 more)

### Community 7 - "User Onboarding Documentation"
Cohesion: 0.07
Nodes (27): 1. Premiers pas : Accéder à l'application & Mode d'utilisation, 2. Créer un compte et son établissement, 3.1 Compléter la fiche établissement, 3.2 Déclarer vos équipements de froid et chaud, 3.3 Configurer votre brigade et attribuer les rôles, 3. Configuration initiale essentielle, 4. Rôles et permissions, 5.1 Températures des enceintes (Module 02) (+19 more)

### Community 8 - "Design Debt Validation"
Cohesion: 0.08
Nodes (25): addDebtViolation(), ALLOWED_SYMBOLS, BANS, cssFiles, dvBaselinePath, dvErrors, dvWarnings, EMOJI_RANGES (+17 more)

### Community 9 - "Project Scripts and Metadata"
Cohesion: 0.08
Nodes (24): description, gates, artifact-fresh, _comment, css-cascade, ui-paint, name, private (+16 more)

### Community 10 - "CSS Coverage Analysis"
Cohesion: 0.09
Nodes (22): baselinePath, cssFiles, cssText, defined, htmlPath, isKnown(), jsDir, knownStructural (+14 more)

### Community 11 - "Authentication UI Logic"
Cohesion: 0.33
Nodes (22): afficherConnexion(), afficherErreur(), afficherEtape(), analyserHashAuth(), champ(), contexte, effacerErreur(), etatOccupe() (+14 more)

### Community 12 - "HTML/JS Parity Checking"
Cohesion: 0.10
Nodes (19): allJsSources, BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlPath, idsHtml (+11 more)

### Community 13 - "Automated Gate Testing"
Cohesion: 0.11
Nodes (11): BAC, dCasse, dSain, ENV, ICI, rClippee, rDomainNormal, rDomainSelftest (+3 more)

### Community 14 - "PWA Web Manifest"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, icons, id, lang (+9 more)

### Community 15 - "Design System Styleguide"
Cohesion: 0.14
Nodes (13): Favicon monogramme T, Design system styleguide, 10. Définition de « fini » (checklist de revue visuelle), 1. Intention, 2. Interdits (signatures « AI slop » à éliminer), 3. Typographie, 4. Couleurs — thème « papier » (défaut) et « nuit », 5. Espacement, rayons, grille (+5 more)

### Community 16 - "Service Worker Asset Audit"
Cohesion: 0.20
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
Cohesion: 0.33
Nodes (5): cleanUrls, headers, redirects, rewrites, version

### Community 22 - "AI Assistant Instructions"
Cohesion: 0.50
Nodes (3): Automatisation Git (Push après correctif et vérifications), Instructions pour l'assistant, Publication (déploiement)

## Ambiguous Edges - Review These
- `roles.js` → `DATA.md`  [AMBIGUOUS]
  docs/DATA.md · relation: references

## Knowledge Gaps
- **264 isolated node(s):** `DEFAULT_LOTS`, `DEFAULT_RECIPES`, `DEFAULT_SALES`, `DEFAULT_SEC_DLC`, `DEFAULT_TEAM` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `roles.js` and `DATA.md`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Five roles and permission matrix` connect `Multi-tenant Security Schema` to `HACCP Regulatory Compliance`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `SupabaseHACCPRepository` connect `HACCP Data Repository` to `Supabase Persistence Configuration`, `Multi-tenant Security Schema`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `Manuel Utilisateur — TraqHACCP Pro` connect `User Onboarding Documentation` to `HACCP Regulatory Compliance`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `DEFAULT_LOTS`, `DEFAULT_RECIPES`, `DEFAULT_SALES` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App UI State Management` be split into smaller, more focused modules?**
  _Cohesion score 0.10158227848101266 - nodes in this community are weakly interconnected._
- **Should `Supabase Persistence Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.06778476589797344 - nodes in this community are weakly interconnected._