# Graph Report - .  (2026-09-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 240 nodes · 363 edges · 11 communities (5 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.75)
- Token cost: 593 input · 28 output

## Graph Freshness
- Built from commit: `b0442ab5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- HACCP Domain Constants
- Application UI Shell
- LocalStorageHACCPRepository
- HACCPUseCases
- test_clean_arch.js
- manifest.json
- HACCPStore
- CameraService
- AudioService
- vercel.json
- sw.js

## God Nodes (most connected - your core abstractions)
1. `LocalStorageHACCPRepository` - 37 edges
2. `HACCPUseCases` - 31 edges
3. `switchTab(tab)` - 16 edges
4. `TraqHACCP Pro index.html Shell` - 11 edges
5. `TraqHACCP README` - 11 edges
6. `HACCPStore` - 10 edges
7. `CameraService` - 8 edges
8. `ChecklistRoutine` - 6 edges
9. `DeliveryRecord` - 6 edges
10. `SanitaryDocument` - 6 edges

## Surprising Connections (you probably didn't know these)
- `TraqHACCP Pro index.html Shell` --conceptually_related_to--> `Offline PWA with Local Sync and Service Worker`  [INFERRED]
  index.html → README.md
- `Registre DDPP Officiel Tab` --conceptually_related_to--> `Rapports & Audit exportables`  [INFERRED]
  index.html → README.md
- `Plan de Nettoyage Tab` --conceptually_related_to--> `Plan de nettoyage & désinfection`  [INFERRED]
  index.html → README.md
- `Réception Livraisons Tab` --conceptually_related_to--> `Réception des marchandises (contrôle à réception, non-conformités)`  [INFERRED]
  index.html → README.md
- `Températures Tab` --conceptually_related_to--> `Relevés de températures (enceintes froides, liaisons chaudes/froides)`  [INFERRED]
  index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Plan de Maîtrise Sanitaire Modules** — index_tab_temperatures, index_tab_reception, index_tab_cleaning, index_tab_traceability, index_tab_allergens, index_tab_oil, index_tab_cooling, index_tab_defrost, index_tab_ph_weight, index_tab_nonconformities [EXTRACTED 0.90]
- **Clean Architecture Layer Stack** — readme_domain_layer, readme_usecases_layer, readme_adapters_layer, readme_infrastructure_layer [EXTRACTED 0.95]
- **DDPP Inspection & Reporting Flow** — index_enterinspectionmode, index_exportfullhaccpcsv, index_downloadofficialpdfreport, index_tab_audit, index_switchtab [INFERRED 0.75]

## Communities (11 total, 6 thin omitted)

### Community 0 - "HACCP Domain Constants"
Cohesion: 0.06
Nodes (32): ALL_14_ALLERGENS, DEFAULT_BRIGADE, DEFAULT_CHECKLIST_ROUTINES, HACCP_NORMS, NC_CATEGORIES, SAN_DOC_CATEGORIES, SHELF_LIFE_PRESETS, ChecklistItem (+24 more)

### Community 1 - "Application UI Shell"
Cohesion: 0.08
Nodes (34): TraqHACCP Pro index.html Shell, enterInspectionMode(), exportFullHACCPCSV(), onOperatorSelectChange(value), openBackupModal(), openPinModal(), switchTab(tab), 14 Allergènes INCO Tab (+26 more)

### Community 4 - "test_clean_arch.js"
Cohesion: 0.07
Nodes (21): Fryer, BarcodeService, checklists, conformPh, conformWeight, dangerPh, docs, eq (+13 more)

### Community 5 - "manifest.json"
Cohesion: 0.13
Nodes (14): background_color, categories, description, display, icons, lang, name, orientation (+6 more)

### Community 9 - "vercel.json"
Cohesion: 0.50
Nodes (3): cleanUrls, headers, version

## Knowledge Gaps
- **61 isolated node(s):** `NC_CATEGORIES`, `SAN_DOC_CATEGORIES`, `SHELF_LIFE_PRESETS`, `DEFAULT_ALLERGEN_DISHES`, `DEFAULT_CHECKLISTS_DATA` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LocalStorageHACCPRepository` connect `LocalStorageHACCPRepository` to `HACCP Domain Constants`, `test_clean_arch.js`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `HACCPUseCases` connect `HACCPUseCases` to `HACCP Domain Constants`, `test_clean_arch.js`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **What connects `NC_CATEGORIES`, `SAN_DOC_CATEGORIES`, `SHELF_LIFE_PRESETS` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `HACCP Domain Constants` be split into smaller, more focused modules?**
  _Cohesion score 0.05519480519480519 - nodes in this community are weakly interconnected._
- **Should `Application UI Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.07507507507507508 - nodes in this community are weakly interconnected._
- **Should `LocalStorageHACCPRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `HACCPUseCases` be split into smaller, more focused modules?**
  _Cohesion score 0.06050420168067227 - nodes in this community are weakly interconnected._