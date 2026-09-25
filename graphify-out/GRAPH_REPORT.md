# Graph Report - traqhaccp_clean_architecture  (2026-09-25)

## Corpus Check
- 58 files · ~187,036 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 701 nodes · 1299 edges · 56 communities (42 shown, 14 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ce940a4f`
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
- [[_COMMUNITY_TraqHACCP — Guide utilisateur|TraqHACCP — Guide utilisateur]]
- [[_COMMUNITY_14. Les réglages de l'établissement (8 onglets)|14. Les réglages de l'établissement (8 onglets)]]
- [[_COMMUNITY_16. Sauvegarde, restauration et usage hors connexion|16. Sauvegarde, restauration et usage hors connexion]]
- [[_COMMUNITY_3. Compte, connexion et mode de démonstration|3. Compte, connexion et mode de démonstration]]
- [[_COMMUNITY_7. Réception d'une marchandise dans le registre|7. Réception d'une marchandise dans le registre]]
- [[_COMMUNITY_9. Ventes et déstockage FIFO|9. Ventes et déstockage FIFO]]
- [[_COMMUNITY_10. Fiches coût, recettes et marges|10. Fiches coût, recettes et marges]]
- [[_COMMUNITY_13. Équipe, rôles et codes PIN|13. Équipe, rôles et codes PIN]]
- [[_COMMUNITY_2. Installer l'application sur le poste de travail|2. Installer l'application sur le poste de travail]]
- [[_COMMUNITY_5. Se repérer  l'anatomie de l'écran principal|5. Se repérer : l'anatomie de l'écran principal]]
- [[_COMMUNITY_6. La routine quotidienne en trois passes|6. La routine quotidienne en trois passes]]
- [[_COMMUNITY_11. Saisie assistée  scan d'étiquette et ajustement d'inventaire|11. Saisie assistée : scan d'étiquette et ajustement d'inventaire]]
- [[_COMMUNITY_12. Contrôle sanitaire DDPP et enquête de traçabilité|12. Contrôle sanitaire DDPP et enquête de traçabilité]]
- [[_COMMUNITY_15. Couleurs, statuts et alertes|15. Couleurs, statuts et alertes]]
- [[_COMMUNITY_8. DLC secondaires et témoins sanitaires|8. DLC secondaires et témoins sanitaires]]

## God Nodes (most connected - your core abstractions)
1. `playBeep()` - 33 edges
2. `SupabaseClient` - 25 edges
3. `showToast()` - 24 edges
4. `TraqHACCP — Guide utilisateur` - 23 edges
5. `icon()` - 21 edges
6. `saveState()` - 18 edges
7. `tabContext()` - 15 edges
8. `closeModals()` - 14 edges
9. `scripts` - 14 edges
10. `rafraichirToutesLesVues()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `saveForm()` --calls--> `handler()`  [INFERRED]
  js/patisserie/settings.js → api/extract-label.js
- `afficherPortailConnexion()` --calls--> `afficherConnexion()`  [INFERRED]
  js/patisserie/auth.js → src/presentation/connexion.js
- `renderNormes()` --calls--> `icon()`  [INFERRED]
  js/patisserie/settings-norms.js → src/presentation/icons.js
- `renderEquipements()` --calls--> `icon()`  [INFERRED]
  js/patisserie/settings-norms.js → src/presentation/icons.js
- `renderDurees()` --calls--> `icon()`  [INFERRED]
  js/patisserie/settings-norms.js → src/presentation/icons.js

## Import Cycles
- None detected.

## Communities (56 total, 14 thin omitted)

### Community 0 - "App UI State Management"
Cohesion: 0.09
Nodes (76): callGeminiDirect(), compressImage(), extractLabelData(), playBeep(), showToast(), afficherPortailConnexion(), deconnecterEtablissement(), initAuth() (+68 more)

### Community 1 - "Supabase Persistence Configuration"
Cohesion: 0.08
Nodes (17): appliquerSurchargeModeUrl(), CONFIG_SUPABASE, ecrireStockage(), lireStockage(), modeParametreUrl(), modePersistance(), MODES_PERSISTANCE, stockageLocal() (+9 more)

### Community 2 - "HACCP Regulatory Compliance"
Cohesion: 0.20
Nodes (9): 1. 16/09/2026 — « les titres s'affichent mais rien d'autre », 2. 17/09/2026 — artefact généré périmé + raccourci cassé, 3. 16/09/2026 — écrasement silencieux en cascade, 4. 17/09/2026 — les pièges des gates eux-mêmes (appris en les posant), 5. 18/09/2026 — le gate ne pouvait plus mordre (binaire Playwright absent), 6. 23/09/2026 — le « hors-ligne » qui n'existait pas (service worker jeté en silence), 7. 24/09/2026 — la chaîne de vérification validait du code mort, BUGS.md — pannes vécues et le gate qui les rend re-livables impossibles (+1 more)

### Community 3 - "HACCP Data Repository"
Cohesion: 0.14
Nodes (32): handler(), actionHandlers, armConfirm(), armed, bindSettingsEvents(), clone(), esc(), isDarkTheme() (+24 more)

### Community 4 - "Multi-tenant Security Schema"
Cohesion: 0.18
Nodes (10): 1. Le tenant, c'est l'établissement, 2. Schéma (20 tables), 3. Rôles et permissions, 4. Cloisonnement (RLS), 5. Modes de persistance, 6. Bootstrap d'un établissement, 7. Appliquer les migrations, 8. Ce qui n'est pas fait (+2 more)

### Community 5 - "Icon and Overlay UI"
Cohesion: 0.13
Nodes (33): NAV, icon(), ICON_ALIAS, iconFor(), ICONS, TRACES, banner(), camera() (+25 more)

### Community 6 - "Application Constants and Norms"
Cohesion: 0.08
Nodes (45): clone(), DLC_DEFAULTS, DLC_FAMILIES, dlcOf(), EQUIPMENT_TYPES, equipmentType(), frNumber(), frRange() (+37 more)

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
Cohesion: 0.14
Nodes (26): ALERT_FALLBACK, applyArchive(), archiveField(), archiveFileName(), backupState(), buildArchive(), chooseArchiveFile(), demanderAutorisation() (+18 more)

### Community 28 - "notifications.js"
Cohesion: 0.27
Nodes (16): alerteDate(), alertesDuJour(), dansHeuresCalmes(), dateLisible(), DEFAUTS, demarrerAlertes(), deuxChiffres(), ecrireVues() (+8 more)

### Community 29 - "Guide de conformité HACCP pour TraqHACCP"
Cohesion: 0.33
Nodes (5): 1. Barèmes de Températures Réglementaires (Arrêté du 21/12/2009), 2. Refroidissement Rapide et Cuisson, 3. Huiles de Friture, 4. Inviolabilité et Traçabilité, Guide de conformité HACCP pour TraqHACCP

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
Cohesion: 0.50
Nodes (4): 10.1 Comment lire une fiche, 10.2 Utiliser une fiche pour décider, 10.3 Vendre depuis une fiche, 10. Fiches coût, recettes et marges

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
Nodes (3): 11.1 Scanner une étiquette, 11.2 Ajuster le stock d'un lot (inventaire), 11. Saisie assistée : scan d'étiquette et ajustement d'inventaire

### Community 53 - "12. Contrôle sanitaire DDPP et enquête de traçabilité"
Cohesion: 0.67
Nodes (3): 12.1 Le rapport de contrôle en trois points, 12.2 Enquête sanitaire et traçabilité descendante (le rappel produit), 12. Contrôle sanitaire DDPP et enquête de traçabilité

### Community 54 - "15. Couleurs, statuts et alertes"
Cohesion: 0.67
Nodes (3): 15.1 Les statuts de lot, 15.2 Les alertes de service, 15. Couleurs, statuts et alertes

### Community 55 - "8. DLC secondaires et témoins sanitaires"
Cohesion: 0.67
Nodes (3): 8.1 Créer une DLC secondaire, 8.2 Enregistrer un échantillon témoin, 8. DLC secondaires et témoins sanitaires

## Knowledge Gaps
- **316 isolated node(s):** `DEFAUTS`, `ALERT_FALLBACK`, `REMINDER_LABELS`, `DLC_DEFAULTS`, `TABS_SOCLE` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `icon()` connect `Icon and Overlay UI` to `Authentication UI Logic`, `HACCP Data Repository`, `Application Constants and Norms`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `showToast()` connect `App UI State Management` to `HACCP Data Repository`, `notifications.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `icon()` (e.g. with `renderDurees()` and `renderEquipements()`) actually correct?**
  _`icon()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DEFAUTS`, `ALERT_FALLBACK`, `REMINDER_LABELS` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App UI State Management` be split into smaller, more focused modules?**
  _Cohesion score 0.09192886456908345 - nodes in this community are weakly interconnected._
- **Should `Supabase Persistence Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.07890070921985816 - nodes in this community are weakly interconnected._
- **Should `HACCP Data Repository` be split into smaller, more focused modules?**
  _Cohesion score 0.14260249554367202 - nodes in this community are weakly interconnected._