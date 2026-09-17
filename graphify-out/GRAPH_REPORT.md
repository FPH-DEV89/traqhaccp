# Graph Report - .  (2026-09-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1281 nodes · 2972 edges · 44 communities (37 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.61)
- Token cost: 2,051 input · 462 output

## Graph Freshness
- Built from commit: `7c358c72`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- UI Preferences and Actions
- User Account Management
- Non-Conformity Management
- Traceability and Allergens
- Router and Navigation
- Reception and Delivery
- HACCP Local Storage
- Audit and Reporting
- Cooling Cycle Tracking
- Document Management
- Inspection and Compliance
- pH and Weight Control
- Shell and Navigation
- Settings Use Cases
- Barcode and Label Export
- Cleaning Task Management
- Domain Entities and Validation
- Temperature Monitoring
- UI Overlay Management
- Defrost Cycle Tracking
- HACCP Business Logic
- Oil and Fryer Control
- Account Access Control
- Parity and Script Checking
- Fryer and Equipment Mocks
- Checklist Management
- HACCP State Store
- Operator and Permissions
- Dashboard and KPIs
- Global Constants
- Export Service Testing
- Settings Configuration
- Design System and Shell
- PWA Manifest
- Audio and App Boot
- CSS Coverage Analysis
- Design and Symbol Linting
- Project Metadata and Scripts
- Camera and Barcode Service
- Syntax Validation
- Checklist Routine Logic
- Vercel Deployment Config
- Delivery Record Entity
- Domain Logic Testing

## God Nodes (most connected - your core abstractions)
1. `LocalStorageHACCPRepository` - 47 edges
2. `SettingsUseCases` - 35 edges
3. `HACCPUseCases` - 32 edges
4. `AccountUseCases` - 28 edges
5. `HACCPStore` - 24 edges
6. `Architecture cible v4 (contrat d'exécution)` - 23 edges
7. `icon()` - 21 edges
8. `esc()` - 19 edges
9. `texte()` - 18 edges
10. `redessiner()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `initRouter()` --references--> `switchTab()`  [INFERRED]
  src/presentation/router.js → docs/ARCHITECTURE.md
- `Favicon monogramme T` --conceptually_related_to--> `Contrat de design REGISTRE`  [INFERRED]
  assets/favicon.svg → docs/DESIGN.md
- `index.html shell` --references--> `Favicon monogramme T`  [EXTRACTED]
  index.html → assets/favicon.svg
- `Design system styleguide` --references--> `Contrat de design REGISTRE`  [EXTRACTED]
  design/styleguide.html → docs/DESIGN.md
- `groupes()` --indirect_call--> `contexte()`  [INFERRED]
  src/presentation/views/cleaning.js → src/presentation/router.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design system Registre : tokens + contrat + styleguide** — css_tokens, docs_design, design_styleguide, assets_favicon, index [EXTRACTED 0.85]
- **Contrat des modules de vue (render/mount/unmount + ctx)** — src_presentation_views, src_presentation_router, src_presentation_store, src_presentation_ui, src_presentation_icons [EXTRACTED 0.90]
- **Séquence de démarrage boot() → shell → routeur** — index, src_presentation_context_boot, src_presentation_shell_initshell, src_presentation_router_initrouter [EXTRACTED 0.95]

## Communities (44 total, 7 thin omitted)

### Community 0 - "UI Preferences and Actions"
Cohesion: 0.07
Nodes (70): ACTIONS, afficherErreurs(), afficherErreursPanneau(), aller(), annees(), apercu(), appliquerPreference(), appliquerSauvegarde() (+62 more)

### Community 1 - "User Account Management"
Cohesion: 0.09
Nodes (63): ACTIONS, ACTIVITES, afficherErreursFiche(), afficherErreursPanneau(), annee(), attacher(), autorise(), basculerOperateur() (+55 more)

### Community 2 - "Non-Conformity Management"
Cohesion: 0.12
Nodes (52): ACTIONS, aujour(), barreFiltres(), basculer(), blocTransition(), categorieDe(), champ(), chercher() (+44 more)

### Community 3 - "Traceability and Allergens"
Cohesion: 0.10
Nodes (47): ACTIONS, ajouterJours(), allergeneDe(), attacher(), blocChamp(), blocDlc(), blocFiltres(), blocFormulaire() (+39 more)

### Community 4 - "Router and Navigation"
Cohesion: 0.10
Nodes (45): contexte(), demonter(), destroy(), element(), idDuHash(), idEtat(), initRouter(), majHash() (+37 more)

### Community 5 - "Reception and Delivery"
Cohesion: 0.10
Nodes (43): ACTIONS, attacher(), blocFiltres(), blocFormulaire(), blocTable(), blocVerdict(), brancherVerdict(), celluleTemperature() (+35 more)

### Community 7 - "Audit and Reporting"
Cohesion: 0.11
Nodes (38): ACTIONS, appExport(), attacher(), blocRecherche(), blocScore(), cellule(), dansPeriode(), debutPeriode() (+30 more)

### Community 8 - "Cooling Cycle Tracking"
Cohesion: 0.14
Nodes (39): ACTIONS, attacher(), carteEnCours(), chrono(), cloturer(), consignerPoint(), corrective(), courbe() (+31 more)

### Community 9 - "Document Management"
Cohesion: 0.15
Nodes (37): ACTIONS, aujour(), barreOutils(), brancherFichier(), categorieDe(), chercher(), corpsFiche(), dateDuJour() (+29 more)

### Community 10 - "Inspection and Compliance"
Cohesion: 0.13
Nodes (35): ACTIONS, appExport(), attacher(), bloc(), blocConformite(), blocDocuments(), blocDomaines(), blocEquipements() (+27 more)

### Community 11 - "pH and Weight Control"
Cohesion: 0.14
Nodes (34): ACTIONS, apercuPh(), apercuPoids(), atMs(), attacher(), blocSeg(), champ(), conformePh() (+26 more)

### Community 12 - "Shell and Navigation"
Cohesion: 0.13
Nodes (35): NAV, appliquer(), bandeau(), BARRE_MOBILE, basculerVerrou(), cablerPin(), choisirOperateur(), compteurs() (+27 more)

### Community 13 - "Settings Use Cases"
Cohesion: 0.10
Nodes (4): SettingsUseCases, createSettings(), normalizeSettings(), parseBackup()

### Community 14 - "Barcode and Label Export"
Cohesion: 0.11
Nodes (29): BarcodeService, buildLabelHtml(), fmtDate(), labelCss(), buildRegisterHtml(), fmtDate(), fmtNum(), registerCss() (+21 more)

### Community 15 - "Cleaning Task Management"
Cohesion: 0.14
Nodes (34): ACTIONS, ALIAS, barreOutils(), basculer(), compteurs(), correspond(), derniere(), echeance() (+26 more)

### Community 16 - "Domain Entities and Validation"
Cohesion: 0.07
Nodes (23): DEFAULT_CHECKLIST_ROUTINES, ChecklistItem, CoolingCycle, DefrostCycle, DishAllergens, NonConformity, PhControlRecord, PreparationLabel (+15 more)

### Community 17 - "Temperature Monitoring"
Cohesion: 0.16
Nodes (33): ACTIONS, attacher(), aujourdhui(), borne(), conformeEq(), creneauDe(), CRENEAUX, creneauxFaits() (+25 more)

### Community 18 - "UI Overlay Management"
Cohesion: 0.16
Nodes (27): icon(), banner(), camera(), closeAllOverlays(), closeOverlay(), closeTopOverlay, confirm(), conteneurs() (+19 more)

### Community 19 - "Defrost Cycle Tracking"
Cohesion: 0.13
Nodes (30): ACTIONS, attacher(), blocEnCours(), blocHistorique(), blocKpis(), blocMesures(), blocRegle(), champValeur() (+22 more)

### Community 21 - "Oil and Fryer Control"
Cohesion: 0.17
Nodes (28): ACTIONS, apercuTpm(), attacher(), compteurs(), consigner(), decision(), echapper(), ECHELLE (+20 more)

### Community 22 - "Account Access Control"
Cohesion: 0.21
Nodes (3): AccountUseCases, operatorDisplayName(), validateOperator()

### Community 23 - "Parity and Script Checking"
Cohesion: 0.08
Nodes (25): BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlPath, idsJs, idsLegacy (+17 more)

### Community 24 - "Fryer and Equipment Mocks"
Cohesion: 0.08
Nodes (20): Fryer, checklists, conformPh, conformWeight, dangerPh, docs, eq, expiredDoc (+12 more)

### Community 25 - "Checklist Management"
Cohesion: 0.17
Nodes (22): ACTIONS, attacher(), autoCompleter(), autoFait, barreProgression(), echapper(), estAutomatique(), historique() (+14 more)

### Community 27 - "Operator and Permissions"
Cohesion: 0.15
Nodes (13): PERMISSIONS_RESERVEES, DEFAULT_SETTINGS, createOperator(), makeOperatorId(), normalizeOperator(), OBVIOUS_PINS, operatorInitials(), SanitaryDocument (+5 more)

### Community 28 - "Dashboard and KPIs"
Cohesion: 0.20
Nodes (19): ACTIONS, attacher(), blocAlertes(), blocKpis(), blocReleves(), blocRoutine(), dateFr(), debutDeJour() (+11 more)

### Community 29 - "Global Constants"
Cohesion: 0.15
Nodes (15): ALL_14_ALLERGENS, APP_VERSION, DEFAULT_BRIGADE, DEFAULT_EQUIPMENTS, DEFAULT_ESTABLISHMENT, HACCP_NORMS, NC_CATEGORIES, SAN_DOC_CATEGORIES (+7 more)

### Community 30 - "Export Service Testing"
Cohesion: 0.11
Nodes (12): app, backupStr, csv, lbl, preps, r2, r3, regHtml (+4 more)

### Community 31 - "Settings Configuration"
Cohesion: 0.11
Nodes (13): COLLECTIONS, CONTROLES_REGLAGES, COUPLES_ORDONNES, DENSITES, PLAGES_SEUILS, SECTIONS_PURGEABLES, SECTIONS_SAUVEGARDE, THEMES (+5 more)

### Community 32 - "Design System and Shell"
Cohesion: 0.20
Nodes (13): Favicon monogramme T, tokens.css, Design system styleguide, Architecture cible v4 (contrat d'exécution), Contrat de design REGISTRE, index.html shell, TraqHACCP — Registre sanitaire, ICON_ALIAS (+5 more)

### Community 33 - "PWA Manifest"
Cohesion: 0.12
Nodes (16): background_color, categories, description, dir, display, icons, lang, name (+8 more)

### Community 34 - "Audio and App Boot"
Cohesion: 0.15
Nodes (11): AudioService, app, boot(), charger(), createApp(), creerPasserelle(), fmt, HEURE (+3 more)

### Community 35 - "CSS Coverage Analysis"
Cohesion: 0.12
Nodes (14): cssFiles, cssText, defined, MIGRATION_DONE, missing, ROOT, single, SKIP (+6 more)

### Community 36 - "Design and Symbol Linting"
Cohesion: 0.15
Nodes (13): ALLOWED_SYMBOLS, BANS, cssFiles, EMOJI_RANGES, findEmoji(), MIGRATION_DONE, presFiles, ROOT (+5 more)

### Community 37 - "Project Metadata and Scripts"
Cohesion: 0.15
Nodes (12): description, name, private, scripts, check, check:norms, lint:design, serve (+4 more)

### Community 39 - "Syntax Validation"
Cohesion: 0.22
Nodes (6): errors, files, html, ROOT, SKIP, tmp

### Community 41 - "Vercel Deployment Config"
Cohesion: 0.50
Nodes (3): cleanUrls, headers, version

## Ambiguous Edges - Review These
- `roles.js` → `constants.js`  [AMBIGUOUS]
  docs/ARCHITECTURE.md · relation: conceptually_related_to

## Knowledge Gaps
- **245 isolated node(s):** `NOMBRE`, `ACTIONS`, `BORNES`, `etat`, `FAMILLES` (+240 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `roles.js` and `constants.js`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Architecture cible v4 (contrat d'exécution)` connect `Design System and Shell` to `Audio and App Boot`, `Router and Navigation`, `Design and Symbol Linting`, `Shell and Navigation`, `Barcode and Label Export`, `Domain Entities and Validation`, `UI Overlay Management`, `Parity and Script Checking`, `Operator and Permissions`, `Global Constants`, `Settings Configuration`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `AccountUseCases` connect `Account Access Control` to `Operator and Permissions`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `LocalStorageHACCPRepository` connect `HACCP Local Storage` to `Domain Entities and Validation`, `Fryer and Equipment Mocks`, `Audio and App Boot`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `NOMBRE`, `ACTIONS`, `BORNES` to the rest of the system?**
  _245 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Preferences and Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.0730593607305936 - nodes in this community are weakly interconnected._
- **Should `User Account Management` be split into smaller, more focused modules?**
  _Cohesion score 0.08798076923076924 - nodes in this community are weakly interconnected._