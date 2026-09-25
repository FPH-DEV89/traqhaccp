# Graph Report - traqhaccp  (2026-09-25)

## Corpus Check
- 66 files · ~191,505 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 895 nodes · 1620 edges · 67 communities (52 shown, 15 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fbe36b52`
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
- Authentication UI Logic
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
- AI Assistant Instructions
- check-css-cascade.mjs
- HACCP Data Seeding
- settings-data.js
- CI Validation Workflow
- notifications.js
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
- marked.min.cjs
- extract-label.js
- capture-scan-guide.mjs
- export-graphviz.py
- pre-push

## God Nodes (most connected - your core abstractions)
1. `playBeep()` - 33 edges
2. `w` - 26 edges
3. `SupabaseClient` - 25 edges
4. `showToast()` - 24 edges
5. `TraqHACCP — Guide utilisateur` - 23 edges
6. `se` - 22 edges
7. `saveState()` - 18 edges
8. `icon()` - 18 edges
9. `scripts` - 17 edges
10. `construireRegistreDdpp()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `tabContext()` --indirect_call--> `icon()`  [INFERRED]
  js/patisserie/settings.js → src/presentation/icons.js
- `renderTabPreferences()` --calls--> `icon()`  [EXTRACTED]
  js/patisserie/settings.js → src/presentation/icons.js
- `renderTabCompte()` --calls--> `icon()`  [EXTRACTED]
  js/patisserie/settings.js → src/presentation/icons.js
- `renderSettings()` --calls--> `icon()`  [EXTRACTED]
  js/patisserie/settings.js → src/presentation/icons.js
- `tabContext()` --indirect_call--> `showToast()`  [INFERRED]
  js/patisserie/settings.js → js/patisserie/audio-toast.js

## Import Cycles
- None detected.

## Communities (67 total, 15 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.09
Nodes (78): callOpenRouterDirect(), compressImage(), DEMO_LABEL_DATA_URL, demoLabelData(), extractLabelData(), playBeep(), showToast(), afficherPortailConnexion() (+70 more)

### Community 1 - "config.js"
Cohesion: 0.06
Nodes (26): appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), lireStockage(), MODE_PERSISTANCE, modeParametreUrl(), modePersistance(), MODES_PERSISTANCE (+18 more)

### Community 2 - "BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles"
Cohesion: 0.20
Nodes (9): 1. 16/09/2026 — « les titres s'affichent mais rien d'autre », 2. 17/09/2026 — artefact généré périmé + raccourci cassé, 3. 16/09/2026 — écrasement silencieux en cascade, 4. 17/09/2026 — les pièges des gates eux-mêmes (appris en les posant), 5. 18/09/2026 — le gate ne pouvait plus mordre (binaire Playwright absent), 6. 23/09/2026 — le « hors-ligne » qui n'existait pas (service worker jeté en silence), 7. 24/09/2026 — la chaîne de vérification validait du code mort, BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles (+1 more)

### Community 3 - "settings.js"
Cohesion: 0.15
Nodes (31): actionHandlers, armConfirm(), armed, bindSettingsEvents(), clone(), esc(), isDarkTheme(), onSettingsClick() (+23 more)

### Community 4 - "DATA.md — Socle de données TraqHACCP"
Cohesion: 0.18
Nodes (10): 1. Le tenant, c'est l'établissement, 2. Schéma (20 tables), 3. Rôles et permissions, 4. Cloisonnement (RLS), 5. Modes de persistance, 6. Bootstrap d'un établissement, 7. Appliquer les migrations, 8. Ce qui n'est pas fait (+2 more)

### Community 5 - "Icon and Overlay UI"
Cohesion: 0.12
Nodes (33): icon(), ICON_ALIAS, iconFor(), ICONS, TRACES, banner(), camera(), closeAllOverlays() (+25 more)

### Community 6 - "settings-norms.js"
Cohesion: 0.07
Nodes (46): clone(), DLC_DEFAULTS, DLC_FAMILIES, dlcOf(), EQUIPMENT_TYPES, equipmentType(), frNumber(), frRange() (+38 more)

### Community 7 - "Manuel Utilisateur — TraqHACCP Pro"
Cohesion: 0.07
Nodes (27): 1. Premiers pas : Accéder à l'application & Mode d'utilisation, 2. Créer un compte et son établissement, 3.1 Compléter la fiche établissement, 3.2 Déclarer vos équipements de froid et chaud, 3.3 Configurer votre brigade et attribuer les rôles, 3. Configuration initiale essentielle, 4. Rôles et permissions, 5.1 Températures des enceintes (Module 02) (+19 more)

### Community 8 - "Design Debt Validation"
Cohesion: 0.08
Nodes (25): addDebtViolation(), ALLOWED_SYMBOLS, BANS, cssFiles, dvBaselinePath, dvErrors, dvWarnings, EMOJI_RANGES (+17 more)

### Community 9 - "scripts"
Cohesion: 0.07
Nodes (27): description, gates, artifact-fresh, _comment, css-cascade, ui-paint, name, private (+19 more)

### Community 10 - "check-css-coverage.mjs"
Cohesion: 0.09
Nodes (22): baselinePath, cssFiles, cssText, defined, htmlPath, isKnown(), jsDir, knownStructural (+14 more)

### Community 11 - "Authentication UI Logic"
Cohesion: 0.33
Nodes (22): afficherConnexion(), afficherErreur(), afficherEtape(), analyserHashAuth(), champ(), contexte, effacerErreur(), etatOccupe() (+14 more)

### Community 12 - "check-parity.mjs"
Cohesion: 0.10
Nodes (20): allJsSources, BASELINE, basePath, BROWSER_GLOBALS, definedFns, fatal, htmlName, htmlPath (+12 more)

### Community 13 - "Automated Gate Testing"
Cohesion: 0.11
Nodes (11): BAC, dCasse, dSain, ENV, ICI, rClippee, rDomainNormal, rDomainSelftest (+3 more)

### Community 14 - "PWA Web Manifest"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, icons, id, lang (+9 more)

### Community 15 - "TraqHACCP — Contrat de design « REGISTRE »"
Cohesion: 0.06
Nodes (29): Favicon monogramme T, Design system styleguide, 1. Ce qui est livré, en production, 2. Contraintes non négociables, 3. Arborescence réelle, 4. Graphe d'exécution — la seule vérité, 5. Chaîne de vérification — ce que chaque gate prouve (et ne prouve pas), 6. Dette mesurée au 24/09/2026 (+21 more)

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

### Community 21 - "vercel.json"
Cohesion: 0.40
Nodes (4): cleanUrls, headers, redirects, version

### Community 22 - "AI Assistant Instructions"
Cohesion: 0.50
Nodes (3): Automatisation Git (Push après correctif et vérifications), Instructions pour l'assistant, Publication (déploiement)

### Community 23 - "check-css-cascade.mjs"
Cohesion: 0.22
Nodes (6): CIBLES, fichiers(), walk(), walk(), d(), n()

### Community 25 - "settings-data.js"
Cohesion: 0.13
Nodes (27): ALERT_FALLBACK, applyArchive(), archiveField(), archiveFileName(), backupState(), buildArchive(), chooseArchiveFile(), demanderAutorisation() (+19 more)

### Community 28 - "notifications.js"
Cohesion: 0.27
Nodes (16): alerteDate(), alertesDuJour(), dansHeuresCalmes(), dateLisible(), DEFAUTS, demarrerAlertes(), deuxChiffres(), ecrireVues() (+8 more)

### Community 29 - "Guide de conformité HACCP pour TraqHACCP"
Cohesion: 0.33
Nodes (5): 1. Barèmes de Températures Réglementaires (Arrêté du 21/12/2009), 2. Refroidissement Rapide et Cuisson, 3. Huiles de Friture, 4. Inviolabilité et Traçabilité, Guide de conformité HACCP pour TraqHACCP

### Community 38 - "ddpp_report.js"
Cohesion: 0.14
Nodes (39): downloadSanitaryReport(), blocSignature(), construireFicheAlerteRecherche(), construireRegistreDdpp(), enTete(), estDepassee(), jourIso(), nomFichierFicheAlerte() (+31 more)

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
Cohesion: 0.33
Nodes (6): 7.1 Ouvrir le formulaire, 7.2 Les champs du formulaire, 7.3 Valider, 7.4 Exemple complet (cas réel), 7.5 Filtres et lecture de la liste des lots, 7. Réception d'une marchandise dans le registre

### Community 46 - "9. Ventes et déstockage FIFO"
Cohesion: 0.40
Nodes (5): 9.1 Vendre une pâtisserie de la carte, 9.2 Enregistrer une vente hors carte (plusieurs produits, commande), 9.3 Les champs du déstockage, 9.4 Historique des ventes et déstockages, 9. Ventes et déstockage FIFO

### Community 47 - "10. Fiches coût, recettes et marges"
Cohesion: 0.40
Nodes (5): 10.1 Comment lire une fiche, 10.2 Utiliser une fiche pour décider, 10.3 Vendre depuis une fiche, 10.4 Créer une nouvelle fiche recette, 10. Fiches coût, recettes et marges

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

### Community 56 - "oe"
Cohesion: 0.20
Nodes (3): le, oe, t()

### Community 57 - "push-guide-drive.py"
Cohesion: 0.31
Nodes (10): export_doc_pdf(), get_meta(), main(), md5(), pdf_stats(), push_doc(), push_pdf(), (pages, images) d'un PDF, via PyMuPDF. (+2 more)

### Community 59 - "build-guide-doc.mjs"
Cohesion: 0.20
Nodes (9): DOCS, html, kb, marked, MD, MIME, missing, OUT (+1 more)

### Community 60 - "build-guide-pdf.mjs"
Cohesion: 0.22
Nodes (8): body, marked, MD, OUT_HTML, OUT_PDF, require, ROOT, st

### Community 62 - "marked.min.cjs"
Cohesion: 0.38
Nodes (3): ce(), ie, p()

### Community 63 - "extract-label.js"
Cohesion: 0.67
Nodes (3): CATEGORIES, handler(), parseJsonLoose()

### Community 64 - "capture-scan-guide.mjs"
Cohesion: 0.50
Nodes (3): { chromium }, R, require

## Knowledge Gaps
- **361 isolated node(s):** `CATEGORIES`, `DEMO_LABEL_DATA_URL`, `DEFAUTS`, `HORIZONS_DLC`, `ALERT_FALLBACK` (+356 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `icon()` connect `Icon and Overlay UI` to `Authentication UI Logic`, `settings.js`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `n()` connect `check-css-cascade.mjs` to `marked.min.cjs`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `CATEGORIES`, `DEMO_LABEL_DATA_URL`, `DEFAUTS` to the rest of the system?**
  _361 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08855799373040753 - nodes in this community are weakly interconnected._
- **Should `config.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06328320802005012 - nodes in this community are weakly interconnected._
- **Should `Icon and Overlay UI` be split into smaller, more focused modules?**
  _Cohesion score 0.12435897435897436 - nodes in this community are weakly interconnected._
- **Should `settings-norms.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07402031930333818 - nodes in this community are weakly interconnected._