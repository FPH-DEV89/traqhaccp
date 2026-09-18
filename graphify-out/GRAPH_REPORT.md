# Graph Report - .  (2026-09-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1556 nodes · 3438 edges · 58 communities (43 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.59)
- Token cost: 2,440 input · 668 output

## Graph Freshness
- Built from commit: `4f30856c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Design System and Assets
- Supabase Client Configuration
- Auth and Permissions
- UI Navigation and Actions
- Non-Conformity Management
- Traceability and Allergens
- App Router
- Reception Management
- Local Storage Repository
- App Store and Audio
- Supabase Data Repository
- Audit and Scoring
- Cooling Cycle Tracking
- Document Management
- Inspection and Compliance
- pH and Weight Records
- Cleaning Management
- Temperature Monitoring
- Account Use Cases
- Domain Entities and Logic
- HACCP Use Cases
- Defrosting Management
- Export and Labeling
- Settings Constants
- Oil and Fryer Monitoring
- App Integration Tests
- Barcode and QR Services
- Parity and Integrity Checks
- Checklist Management
- Project Metadata and Scripts
- Settings Use Cases
- Connection and Persistence
- Dashboard and Alerts
- Storage Repository Defaults
- PWA Web Manifest
- CSS Coverage Analysis
- Export Service Tests
- Design and Emoji Linting
- UI Audit Tooling
- Settings and Backup Logic
- Gate and Environment Tests
- Artifact Freshness Check
- UI Paint Performance Audit
- Camera and Scanning Service
- Syntax Validation
- CI/CD Deployment Workflow
- Mock Storage Repository
- Checklist Routine Logic
- CSS Cascade Analysis
- HACCP Fixture Seeding
- Vercel Deployment Config
- Cleaning Task Entity
- Equipment Entity
- Domain Logic Tests
- Git Pre-push Hook
- Compliance Checker Tool
- View Module Interface

## God Nodes (most connected - your core abstractions)
1. `SupabaseHACCPRepository` - 48 edges
2. `LocalStorageHACCPRepository` - 48 edges
3. `HACCPUseCases` - 34 edges
4. `SettingsUseCases` - 34 edges
5. `AccountUseCases` - 27 edges
6. `HACCPStore` - 25 edges
7. `SupabaseClient` - 24 edges
8. `icon()` - 23 edges
9. `esc()` - 19 edges
10. `normalizeSettings()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Favicon monogramme T` --conceptually_related_to--> `Contrat de design REGISTRE`  [INFERRED]
  assets/favicon.svg → docs/DESIGN.md
- `Git Automation Flow` --semantically_similar_to--> `TraqHACCP CI Workflow`  [INFERRED] [semantically similar]
  GEMINI.md → .github/workflows/ci.yml
- `Design system styleguide` --references--> `Contrat de design REGISTRE`  [EXTRACTED]
  design/styleguide.html → docs/DESIGN.md
- `TraqHACCP — Registre sanitaire` --references--> `Architecture Target v4`  [EXTRACTED]
  README.md → docs/ARCHITECTURE.md
- `createApp()` --indirect_call--> `icon()`  [INFERRED]
  src/presentation/context.js → src/presentation/icons.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design system Registre : tokens + contrat + styleguide** — docs_design, design_styleguide, assets_favicon, index [EXTRACTED 0.85]

## Communities (58 total, 15 thin omitted)

### Community 0 - "Design System and Assets"
Cohesion: 0.05
Nodes (74): Favicon monogramme T, Design system styleguide, Architecture Target v4, BUGS & Gates Registry, Contrat de design REGISTRE, TraqHACCP — Registre sanitaire, APP_VERSION, icon() (+66 more)

### Community 1 - "Supabase Client Configuration"
Cohesion: 0.05
Nodes (45): DEFAULT_ESTABLISHMENT, appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), lireStockage(), MODE_PERSISTANCE, modeParametreUrl(), modePersistance() (+37 more)

### Community 2 - "Auth and Permissions"
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

### Community 6 - "App Router"
Cohesion: 0.10
Nodes (44): contexte(), demonter(), destroy(), element(), idDuHash(), idEtat(), initRouter(), majHash() (+36 more)

### Community 7 - "Reception Management"
Cohesion: 0.10
Nodes (44): ACTIONS, attacher(), blocFiltres(), blocFormulaire(), blocTable(), blocVerdict(), brancherVerdict(), celluleTemperature() (+36 more)

### Community 9 - "App Store and Audio"
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

### Community 18 - "Account Use Cases"
Cohesion: 0.17
Nodes (6): AccountUseCases, PERMISSIONS_RESERVEES, operatorDisplayName(), operatorInitials(), validateOperator(), ROLES

### Community 19 - "Domain Entities and Logic"
Cohesion: 0.08
Nodes (15): DEFAULT_CHECKLIST_ROUTINES, HACCP_NORMS, ChecklistItem, CoolingCycle, createOperator(), DeliveryRecord, DishAllergens, Fryer (+7 more)

### Community 21 - "Defrosting Management"
Cohesion: 0.13
Nodes (30): ACTIONS, attacher(), blocEnCours(), blocHistorique(), blocKpis(), blocMesures(), blocRegle(), champValeur() (+22 more)

### Community 22 - "Export and Labeling"
Cohesion: 0.13
Nodes (28): buildLabelHtml(), fmtDate(), labelCss(), buildRegisterHtml(), fmtDate(), fmtNum(), registerCss(), statusLabel() (+20 more)

### Community 23 - "Settings Constants"
Cohesion: 0.09
Nodes (24): COLLECTIONS, CONTROLES_REGLAGES, COUPLES_ORDONNES, DENSITES, PLAGES_SEUILS, SECTIONS_PURGEABLES, SECTIONS_SAUVEGARDE, THEMES (+16 more)

### Community 24 - "Oil and Fryer Monitoring"
Cohesion: 0.17
Nodes (28): ACTIONS, apercuTpm(), attacher(), compteurs(), consigner(), decision(), echapper(), ECHELLE (+20 more)

### Community 25 - "App Integration Tests"
Cohesion: 0.07
Nodes (28): audio, barcodeSVG, chks, cleanings, cool, defrost, delivConform, delivReject (+20 more)

### Community 26 - "Barcode and QR Services"
Cohesion: 0.08
Nodes (20): BarcodeService, checklists, conformPh, conformWeight, dangerPh, docs, eq, expiredDoc (+12 more)

### Community 27 - "Parity and Integrity Checks"
Cohesion: 0.08
Nodes (25): BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlPath, idsJs, idsLegacy (+17 more)

### Community 28 - "Checklist Management"
Cohesion: 0.17
Nodes (22): ACTIONS, attacher(), autoCompleter(), autoFait, barreProgression(), echapper(), estAutomatique(), historique() (+14 more)

### Community 29 - "Project Metadata and Scripts"
Cohesion: 0.08
Nodes (24): description, gates, artifact-fresh, _comment, css-cascade, ui-paint, name, private (+16 more)

### Community 31 - "Connection and Persistence"
Cohesion: 0.27
Nodes (20): definirModePersistance(), retirerModeUrl(), afficherConnexion(), afficherErreur(), afficherEtape(), champ(), contexte, continuerEnLocal() (+12 more)

### Community 32 - "Dashboard and Alerts"
Cohesion: 0.19
Nodes (18): ACTIONS, attacher(), blocAlertes(), blocBanniere(), blocRoutineRapide(), blocTuiles(), dateFr(), debutDeJour() (+10 more)

### Community 33 - "Storage Repository Defaults"
Cohesion: 0.11
Nodes (16): DefrostCycle, NonConformity, DEFAULT_ALLERGEN_DISHES, DEFAULT_CHECKLISTS_DATA, DEFAULT_CLEANINGS, DEFAULT_COOLINGS, DEFAULT_DEFROSTS, DEFAULT_DELIVERIES (+8 more)

### Community 34 - "PWA Web Manifest"
Cohesion: 0.12
Nodes (16): background_color, categories, description, dir, display, icons, lang, name (+8 more)

### Community 35 - "CSS Coverage Analysis"
Cohesion: 0.12
Nodes (14): cssFiles, cssText, defined, MIGRATION_DONE, missing, ROOT, single, SKIP (+6 more)

### Community 36 - "Export Service Tests"
Cohesion: 0.12
Nodes (12): app, backupStr, csv, lbl, preps, r2, r3, regHtml (+4 more)

### Community 37 - "Design and Emoji Linting"
Cohesion: 0.15
Nodes (13): ALLOWED_SYMBOLS, BANS, cssFiles, EMOJI_RANGES, findEmoji(), MIGRATION_DONE, presFiles, ROOT (+5 more)

### Community 38 - "UI Audit Tooling"
Cohesion: 0.14
Nodes (13): calledFuncs, declaredFuncs, declaredIdMatches, declaredIds, declaredTabContainers, eventMatches, getElemMatches, html (+5 more)

### Community 39 - "Settings and Backup Logic"
Cohesion: 0.19
Nodes (3): createSettings(), normalizeSettings(), parseBackup()

### Community 40 - "Gate and Environment Tests"
Cohesion: 0.17
Nodes (5): BAC, ENV, ICI, rClippee, rSaine

### Community 41 - "Artifact Freshness Check"
Cohesion: 0.18
Nodes (8): argv, changes, cible, code, marqueur, opt, rapport, re

### Community 42 - "UI Paint Performance Audit"
Cohesion: 0.24
Nodes (7): argv, echecs, lancerNavigateur(), LARGEURS, loadPlaywright(), opt, require

### Community 44 - "Syntax Validation"
Cohesion: 0.22
Nodes (6): errors, files, html, ROOT, SKIP, tmp

### Community 45 - "CI/CD Deployment Workflow"
Cohesion: 0.40
Nodes (5): Deployment Rules, Git Automation Flow, Assistant Instructions, TraqHACCP CI Workflow, Vercel Production Deployment

### Community 50 - "Vercel Deployment Config"
Cohesion: 0.50
Nodes (3): cleanUrls, headers, version

## Knowledge Gaps
- **337 isolated node(s):** `NOMBRE`, `ICON_ALIAS`, `ICONS`, `TRACES`, `BARRE_MOBILE` (+332 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HACCPUseCases` connect `HACCP Use Cases` to `App Store and Audio`, `Barcode and QR Services`, `Domain Entities and Logic`, `App Integration Tests`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `SupabaseHACCPRepository` connect `Supabase Data Repository` to `Supabase Client Configuration`, `Settings and Backup Logic`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `HACCP_NORMS` connect `Domain Entities and Logic` to `Traceability and Allergens`, `Reception Management`, `Audit and Scoring`, `Cooling Cycle Tracking`, `pH and Weight Records`, `Temperature Monitoring`, `Defrosting Management`, `Settings Constants`, `Oil and Fryer Monitoring`, `App Integration Tests`, `Barcode and QR Services`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `NOMBRE`, `ICON_ALIAS`, `ICONS` to the rest of the system?**
  _337 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design System and Assets` be split into smaller, more focused modules?**
  _Cohesion score 0.05426356589147287 - nodes in this community are weakly interconnected._
- **Should `Supabase Client Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.05225718194254446 - nodes in this community are weakly interconnected._
- **Should `Auth and Permissions` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._