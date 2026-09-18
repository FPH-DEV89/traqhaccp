# TraqHACCP — Architecture cible v4 (contrat d'exécution)

> Ce document est **normatif**. Toute spec agy s'y réfère. Il décrit l'état final visé,
> les contrats d'interface entre modules, et la stratégie de migration sans casse.

## 1. Contraintes non négociables

1. **Aucun build, aucun bundler, aucun framework.** ES modules natifs servis tels quels
   (Vercel, ou n'importe quel serveur de fichiers / `python3 -m http.server`). Pas de `package.json` runtime,
   pas de `npm install` pour faire tourner l'app, pas de TypeScript, pas de JSX.
2. **Fonctionnement hors-ligne** conservé (PWA, `sw.js`). Toute nouvelle ressource (CSS,
   module, police, icône) doit être ajoutée à la liste de précache du service worker,
   et le nom du cache doit être incrémenté (`traqhaccp-v4`).
3. **Aucune régression fonctionnelle.** Les 16 modules existants conservent : identifiants
   DOM, libellés français, comportements (création de fiche, exports CSV/JSON, rapport PDF,
   impression, photo caméra, sons, mode inspection lecture seule).
4. **Aucune perte de données.** Les clés `localStorage` existantes sont conservées.
   Les données v3 (brigade sans rôle, réglages absents) sont migrées automatiquement
   et silencieusement au chargement. Le format d'export JSON complet reste lisible ;
   `version` passe à `4.0-registre`.
5. **Aucun secret, aucune donnée client réelle** dans le code ou les données de démo.
6. **God File** : aucun fichier > **500 lignes non vides** (`.js`, `.css`) ;
   `index.html` visé ≤ **150 lignes non vides**. Découpage par domaine, pas par taille.
7. **Aucune dépendance CDN nouvelle.** Les CDN existants retirés : TailwindCSS, Font Awesome.
   Restent : Google Fonts (3 familles, cf. DESIGN.md §3), Tone.js (sons).
8. **Accessibilité** : navigation clavier complète, `:focus-visible`, `aria-*` sur les
   composants interactifs, contrastes DESIGN.md §6.

## 2. Arborescence cible

```
index.html                                  Shell : <head>, rail, topbar, #view, surcouches  (~150 l.)
manifest.json                               PWA (theme_color/background_color = papier, icônes)
sw.js                                       precache v4
assets/favicon.svg                          Monogramme « T » (DESIGN.md §8)

css/
  tokens.css        variables, thèmes papier/nuit, échelles, z-index, motion      (≤ 160 l.)
  base.css          reset moderne, typographie, éléments bruts, .container,
                    utilitaires (.num, .unit, .rule, .skip-link, .visually-hidden),
                    @media print global                                            (≤ 380 l.)
  layout.css        .app, .rail, .topbar, .page-head, .tabbar (mobile), responsive (≤ 400 l.)
  components.css    .btn .field .input .table .mark .sheet .kpi .callout .toast
                    .panel .modal .seg .toolbar .empty .skeleton .stamp .palette (≤ 500 l.)
  views.css         styles spécifiques aux modules (matrice allergènes, jauges huile,
                    chronomètres refroidissement/décongélation, GED, inspection)  (≤ 400 l.)

src/domain/
  constants.js      + ROLES, PERMISSIONS, DEFAULT_SETTINGS, DEFAULT_EQUIPMENTS,
                    DEFAULT_BRIGADE (enrichie : role, active, pin), NAV (source de vérité
                    de la navigation : groupes, index, titres, icônes)               (≤ 500 l.)
  roles.js          ROLES, PERMISSIONS, ROLE_PERMISSIONS, hasPermission(),
                    canManageUsers(), roleLabel()                                   (≤ 120 l.)
  entities.js       + createOperator(), normalizeOperator(), validateOperator(),
                    createSettings(), normalizeSettings()                           (≤ 500 l.)
  haccp_norms.js    seuils réglementaires documentés (source unique des valeurs par
                    défaut : 63→10 °C en 2 h, TPM ≤ 24 %, pH, DLC par famille)      (≤ 150 l.)

src/application/
  usecases.js       (existant — non modifié)
  account_usecases.js   Compte, utilisateurs, session, permissions, journal        (≤ 400 l.)
  settings_usecases.js  Réglages, normes, équipements, sauvegardes, purge          (≤ 400 l.)

src/infrastructure/
  storage_repository.js  + getSettings/saveSettings/getSession/saveSession/
                           getActivityLog/appendActivity/saveBrigade + migration v3→v4 (≤ 500 l.)
  audio_service.js       (existant — non modifié)
  export_service.js      export CSV / JSON / PDF / impression (extrait du script inline) (≤ 500 l.)

Socle serveur (mode opt-in, additif — l'app reste utilisable en localStorage) :
  config.js                    URL + clé publiable Supabase, mode de persistance   (≤ 500 l.)
  supabase_client.js           client sans dépendance : PostgREST + GoTrue (fetch)  (≤ 500 l.)
  supabase_mapping.js          specs des 14 collections, camelCase ⇄ snake_case     (≤ 500 l.)
  supabase_repository_base.js  plomberie interne : session, écritures différées     (≤ 500 l.)
  supabase_repository.js       SupabaseHACCPRepository — 26 méthodes, même interface
                               que LocalStorageHACCPRepository                     (≤ 500 l.)
  supabase_backup.js           export/import de sauvegarde JSON                    (≤ 500 l.)
  → modèle de données, RLS et matrice des rôles : voir docs/DATA.md

src/presentation/
  context.js        Racine de composition : repository, audio, useCases, account,
                    settings, store, ui, router. Singleton `app`.                   (≤ 120 l.)
  store.js          (existant, étendu : settings, operators, currentOperatorId,
                    permissions, notify(), can())
  router.js         Registre des vues, switchTab(), repli legacy, hash, raccourcis    (≤ 200 l.)
  shell.js          Rail, topbar, chip opérateur, palette ⌘K, toasts, confirm,
                    panneau latéral, modale, caméra, lightbox                         (≤ 480 l.)
  icons.js          Sprite SVG `icon(name, size)` + ICON_ALIAS                        (≤ 300 l.)
  ui.js             API impérative : ui.toast, ui.confirm, ui.panel, ui.modal,
                    ui.palette, ui.photo, ui.skeleton                                 (≤ 200 l.)
  views/
    dashboard.js  checklists.js  temperatures.js  reception.js  traceability.js
    allergens.js  cleaning.js    oil.js           cooling.js    defrost.js
    phweight.js   documents.js   nonconformities.js  audit.js   inspection.js
    compte.js     reglages.js
    (1 fichier par module — ≤ 350 l. chacun, aucune exception)

tools/
  check-parity.mjs   Vérifie que tout id / onclick / data-tab / window.* référencé
                     par le JS existe bien dans le DOM rendu ou les modules de vue
  check-design.mjs   Interdit : classes Tailwind résiduelles, emojis, couleurs hors
                     palette, rounded-xl+, shadow, backdrop-blur, z-index arbitraires
```

## 3. Navigation — source de vérité unique

`src/domain/constants.js` exporte `NAV`, seule source de la navigation (rail, tabbar,
palette, fil d'Ariane, titres de page). Le HTML ne code aucun libellé de module.

```js
export const NAV = [
  { group: 'Registre', items: [
    { id:'dashboard',        idx:'01', icon:'dashboard',  title:'Tableau de bord',      desc:"Vue d'ensemble du jour" },
    { id:'checklists',       idx:'02', icon:'clipboard',  title:'Checklists',           desc:'Ouverture et fermeture de service' },
    { id:'temperatures',     idx:'03', icon:'thermometer',title:'Températures',         desc:'Relevés des enceintes froides et chaudes' },
    { id:'reception',        idx:'04', icon:'truck',      title:'Réception',            desc:'Contrôle marchandises et agréments' },
    { id:'traceability',     idx:'05', icon:'tag',        title:'DLC et traçabilité',   desc:'Étiquetage, décongélation, préparations' },
    { id:'allergens',        idx:'06', icon:'wheat',      title:'Allergènes',           desc:'Matrice INCO des 14 allergènes' },
    { id:'cleaning',         idx:'07', icon:'spray',      title:'Plan de nettoyage',    desc:'Tâches, fréquences et validation' },
    { id:'oil',              idx:'08', icon:'droplet',    title:'Huiles de friture',    desc:'TPM, filtration et mise au repos' },
    { id:'cooling',          idx:'09', icon:'snowflake',  title:'Refroidissement',      desc:'Cycle 63 °C → 10 °C en 2 h' },
    { id:'defrost',          idx:'10', icon:'flame',      title:'Décongélation',        desc:'Cycles et températures de décongélation' },
    { id:'ph-weight',        idx:'11', icon:'scale',      title:'pH et poids',          desc:'Contrôles spécialisés' },
    { id:'documents',        idx:'12', icon:'folder',     title:'Documents sanitaires', desc:'GED : agréments, HACCP, contrats' },
    { id:'nonconformities',  idx:'13', icon:'alert',      title:'Non-conformités',      desc:'Écarts, actions correctives et clôture' },
  ]},
  { group: 'Contrôle officiel', items: [
    { id:'audit',            idx:'14', icon:'seal',       title:'Registre DDPP',        desc:'Registre officiel consolidé' },
    { id:'ddpp-inspection',  idx:'15', icon:'shield',     title:'Mode inspection',      desc:'Consultation lecture seule' },
  ]},
  { group: 'Administration', items: [
    { id:'compte',           idx:'16', icon:'users',      title:'Compte et établissement', desc:'Fiche établissement, utilisateurs, rôles' },
    { id:'reglages',         idx:'17', icon:'settings',   title:'Réglages',             desc:'Normes, équipements, préférences, sauvegardes' },
  ]},
];
```

L'onglet legacy `settings` (id DOM `tab-settings`) est **remplacé** par `compte` et
`reglages`. Il n'existe plus dans `NAV`.

## 4. Contrat des modules de vue

Chaque module `src/presentation/views/<id>.js` exporte exactement :

```js
export const meta = { id, idx, icon, title, desc, permissions: null | ['records.create', ...] };
export function render(ctx)            // -> string HTML. Pur, sans effet de bord, sans accès DOM.
export function mount(root, ctx)       // branche les écouteurs. root = conteneur du module.
export function unmount(root)          // nettoyage (timers, abonnements, AudioContext). Idempotent.
```

- `ctx` = `{ state, store, useCases, account, settings, repository, ui, icon, fmt }`
  (`fmt` : `fmt.temp(v)`, `fmt.pct(v)`, `fmt.date(iso)`, `fmt.time(iso)`, `fmt.dt(iso)`,
   `fmt.relative(iso)`, `fmt.quantity(v, unit)` → toujours typographie française).
- **Aucun accès à `document.getElementById` d'un autre module.** Un module ne touche que
  `root`. Les interactions inter-modules passent par `store` + `router.switchTab()`.
- **Rendu par re-rendu complet** : `store.subscribe(() => rerender())` → `root.innerHTML = render(ctx)`
  puis `mount(root, ctx)`. Pas de mutation DOM chirurgicale, sauf chronomètres (mis à jour
  par `textContent` dans un `setInterval` propre, nettoyé par `unmount`).
- Toute modale/feuille de saisie est **rendue par le module propriétaire** (jamais par un
  registre global). Les surcouches génériques (caméra, confirmation, lightbox, palette,
  navigation mobile) appartiennent à `shell.js`.
- Les tâches sont centralisées sur `document` par le routeur (délégation d'événements
  `data-action="..."`), pas par `onclick=` inline dans le HTML généré.

## 5. API stable à utiliser dans les vues (contrat inter-specs)

```js
// src/presentation/ui.js — toutes les méthodes sont sûres si l'appel arrive avant le boot
ui.toast({ status:'ok'|'warn'|'danger'|'info'|'neutral', message, actionLabel?, onAction?, duration? })
ui.confirm({ title, body, confirmLabel='Confirmer', danger=false }) -> Promise<boolean>
ui.panel({ id, title, subtitle?, body, actions?, width?, onMount?, onClose? })  // feuille latérale
ui.modal({ id, title, body, actions?, size? })                                  // surcouches bloquantes
ui.closeOverlay(id?)            // ferme la surcouche courante ; Échap = même effet
ui.photo(src, caption?)         // lightbox
ui.camera({ onCapture(dataUrl) })                                               // capture photo
ui.palette()                    // palette de commandes
ui.skeleton(lines=3)            // squelette de chargement
ui.empty({ icon, title, body, actionLabel?, onAction? })                        // état vide composé
icon(name, size=18)             // sprite SVG (src/presentation/icons.js)

// src/presentation/store.js
store.getState() · store.subscribe(fn) -> unsubscribe · store.setActiveTab(id) · store.notify()
store.getSettings() · store.getOperators() · store.getActiveOperators() · store.getOperator(id)
store.getCurrentOperator() · store.can(permission) · store.getEquipments() · store.getActivityLog()

// src/application/account_usecases.js  (classe AccountUseCases)
listOperators() · getOperator(id) · createOperator({firstName,lastName,role,pin?,initials?})
updateOperator(id, patch) · setOperatorActive(id, active) · deleteOperator(id)
setCurrentOperator(id, { pin } = {})  // résout 'pin_required' | 'pin_invalid' | 'ok'
verifyPin(id, pin) · changePin(id, newPin) · clearPin(id)
setEstablishment(patch) · getEstablishment() · logActivity({ action, target, details })

// src/application/settings_usecases.js  (classe SettingsUseCases)
getSettings() · updateSettings(patch) -> { ok, errors } · updateThresholds(patch)
listEquipments()/createEquipment(d)/updateEquipment(id,p)/deleteEquipment(id)
listCleaningTasks()/createCleaningTask(d)/updateCleaningTask(id,p)/deleteCleaningTask(id)
resetSettings() · exportFullBackup() · importBackup(text) -> { ok, errors, counts }
restoreDemoData() · purgeYear(year) -> { purged } · lastBackupAt()/markBackupDone()
```

Permissions (`src/domain/roles.js`) :
`records.create` `records.edit` `records.delete` `records.sign` `nc.manage`
`settings.edit` `equipment.manage` `users.manage` `export.data` `inspection.mode` `backup.restore`
Rôles : `gerant` (toutes), `responsable` (toutes sauf `users.manage`, `settings.edit` partiel,
`backup.restore`), `operateur` (`records.*`, `export.data`), `lecture` (`export.data`),
`inspecteur` (`inspection.mode`, `export.data`).
Un utilisateur créé par défaut est `operateur`. **Il doit toujours rester au moins un
`gerant` actif** : `deleteOperator`/`setOperatorActive` refusent sinon avec un message clair.

## 6. Stratégie de migration (zéro casse, vérifiable à chaque étape)

Pendant la migration, `index.html` conserve le markup et les fonctions legacy. Le routeur
arbitre module par module :

```js
// src/presentation/router.js
const VIEWS = { defrost: DefrostView, compte: CompteView, /* ... */ };  // modules migrés
function switchTab(id) {
  if (VIEWS[id]) { mountView(VIEWS[id]); hideLegacySections(); }
  else { showLegacySection(id); runLegacyRenderer(id); }   // repli v3
}
```

- Les sections legacy sont identifiées par `.tab-content` + `id="tab-<id>"` ; le routeur
  masque/affiche via `hidden`. La vue migrée est rendue dans `<div id="view">`.
- Une fois les 17 modules migrés (dernière vague), le bloc legacy est **supprimé** :
  markup des sections, script inline, fonctions `renderXxx()`, modales inline, et
  `tailwindcss`/`font-awesome` retirés du `<head>`. `index.html` ne contient plus que
  le shell.
- `window.switchTab`, `window.saveSettings`, `window.restoreDemoData` restent exposés
  jusqu'à la suppression du legacy (compatibilité des `onclick`).

## 8. Démarrage, graphe de modules, repli legacy

### 8.1 Séquence de démarrage (contrat figé)

`index.html` ne contient **qu'un seul** script : les imports et l'appel au boot.

```html
<script type="module">
  import { boot } from './src/presentation/context.js';
  boot();
</script>
```

`src/presentation/context.js` (racine de composition) :
```js
export const app = { repository, audio, useCases, account, settings, store, ui, icon, fmt, exports, nav: NAV };
export function boot() {
  initShell(app);            // shell.js : injecte rail + topbar dans #rail / #topbar
  initRouter(app);           // router.js : registre VIEWS, raccourcis, hash, module courant
  app.ready = true;
}
```
- `boot()` est idempotent (garde `if (app.ready) return;`).
- Ordre imposé : `initShell` **avant** `initRouter` (le routeur utilise les éléments du shell).
- `ui.js` et `icons.js` sont **auto-suffisants** : ils ne dépendent ni du shell ni du routeur.
- Aucun module ne s'auto-exécute au chargement (pas d'effet de bord à l'import), sauf
  `context.js` qui construit `app` (instanciation pure, sans DOM).
- `app.fmt` : `temp(v)`, `pct(v)`, `date(iso)`, `time(iso)`, `dt(iso)`, `relative(iso)`,
  `quantity(v, unit)`, `signed(v)` — typographie française (virgule décimale, espace
  insécable avant `°C` et `%`).

### 8.2 Repli legacy pendant la migration

`router.js` migre module par module. Pour un module absent de `VIEWS`, il masque `#view`,
affiche `#tab-<id>` et appelle les fonctions de rendu v3 :

```js
const LEGACY_RENDER = {
  dashboard:        ['renderDashboard'],
  checklists:       ['setChecklistRoutineTab', 'renderChecklists'],
  temperatures:     ['renderEquipmentCards'],
  reception:        ['renderReceptionsTable'],
  traceability:     ['renderPreparationCards'],
  allergens:        ['renderAllergenFilterButtons', 'renderAllergensMatrix'],
  cleaning:         ['renderCleaningTasks'],
  oil:              ['renderFryersList'],
  cooling:          ['renderCoolingCycles'],
  defrost:          ['renderDefrostCycles'],
  'ph-weight':      ['renderPhRecords', 'renderWeightRecords'],
  documents:        ['renderSanitaryDocs'],
  nonconformities:  ['renderNonConformitiesTable'],
  audit:            ['renderAuditView'],
  'ddpp-inspection':['renderDdppInspectionView'],
  settings:         [],
};
```
`renderSanitaryDocs` et `setChecklistRoutineTab` attendent des arguments : le repli les
appelle sans argument (comportement v3 par défaut) — `filterDocs()` peut être appelé avec
`''`. Si une fonction est absente (`undefined`), le routeur l'ignore silencieusement.
Le repli doit rester **fonctionnel jusqu'à la dernière vague** : ne supprime jamais une
fonction v3 tant que son module n'est pas migré et vérifié.

### 8.3 Fin de migration

Quand les 17 modules existent : supprimer les 16 sections `.tab-content`, tout le script
inline v3, `LEGACY_RENDER`, le CDN Tailwind et Font Awesome ; écrire
`docs/MIGRATION_COMPLETE` (ce fichier active les contrôles stricts : `check-design` sur
`index.html`, détection de doublons d'id, `parity-baseline.json` vidé).

## 9. Vérification obligatoire

- `node tools/check-parity.mjs` : tout `getElementById(x)` du legacy doit trouver `id="x"`
  dans une section legacy **ou** dans un module de vue ; tout `data-action`/`onclick` doit
  être implémenté ; aucune référence orpheline. **Doit passer à zéro erreur.**
- `node tools/check-design.mjs` : interdits DESIGN.md §2 (Tailwind, emoji, `rounded-xl`,
  `shadow-*`, `backdrop-blur`, couleurs hors palette, `z-index` arbitraire) sur `css/`
  et `src/presentation/views/`. **Doit passer à zéro erreur.**
- E2E navigateur : les 17 modules s'ouvrent sans erreur console ; relevé de température,
  création d'utilisateur, modification d'un seuil et export JSON fonctionnent.
- Captures 1440×900, 1024×768 et 390×844 de chaque module pour revue visuelle.
