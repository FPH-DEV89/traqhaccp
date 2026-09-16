# SPEC P3 — Domaine : rôles, permissions, normes HACCP, réglages par défaut

## Contexte
`traqhaccp` : PWA statique (vanilla JS, ES modules, clean architecture, **aucun build**).
La couche `src/domain/` existe déjà (`constants.js`, `entities.js`). Il manque :
la notion de **rôle/permission**, une **source unique des seuils réglementaires**, la
**navigation** (aujourd'hui codée en dur dans `index.html`) et les **réglages** (aujourd'hui
inexistants : aucune fonction `getSettings()` dans le repository).

**Lis d'abord :**
- `src/domain/constants.js` et `src/domain/entities.js` (état actuel — **ne casse rien** :
  d'autres modules les importent)
- `docs/ARCHITECTURE.md` §3 (navigation), §5 (API) et §1 (contraintes)
- `docs/DESIGN.md` §9 (données de démonstration crédibles)
- `index.html` : pour retrouver les **seuils déjà utilisés** dans le code v3 (températures
  cibles des enceintes, refroidissement 63→10 °C, TPM huile, fréquences de nettoyage,
  allergènes, familles de produits) — reprends les valeurs réelles qui s'y trouvent plutôt
  que d'en inventer.

## Ta mission

### 1. `src/domain/roles.js` (nouveau, ≤ 120 lignes)
Exporte, avec JSDoc :
```js
export const PERMISSIONS = { /* clé → libellé français lisible */ };
// records.create, records.edit, records.delete, records.sign, nc.manage,
// settings.edit, equipment.manage, users.manage, export.data, inspection.mode, backup.restore
export const ROLES = { gerant: {...}, responsable: {...}, operateur: {...}, lecture: {...}, inspecteur: {...} };
//  chaque rôle : { id, label, description, permissions: [ … ] }
export const ROLE_ORDER = ['gerant', 'responsable', 'operateur', 'lecture', 'inspecteur'];
export function hasPermission(roleId, permission)   // -> boolean, tolérant (rôle inconnu = false, sauf 'gerant')
export function permissionsOf(roleId)               // -> string[]
export function roleLabel(roleId)                   // -> libellé français (fallback: rôle brut)
export function canManageUsers(roleId)              // -> boolean
```
Matrice exacte :
- `gerant` : **toutes** les permissions.
- `responsable` : toutes **sauf** `users.manage` et `backup.restore`.
- `operateur` : `records.create`, `records.edit`, `records.sign`, `export.data`.
- `lecture` : `export.data`.
- `inspecteur` : `inspection.mode`, `export.data`.

### 2. `src/domain/haccp_norms.js` (nouveau, ≤ 150 lignes)
Source unique et **documentée** des seuils réglementaires (règlement CE 852/2004,
arrêté du 21/12/2009, INCO 1169/2011). Exporte un objet gelé :
```js
export const NORMS = {
  cold:   { positiveMin: 0, positiveMax: 4, frozenMax: -18, label: 'Enceintes froides' },
  hot:    { serviceMin: 63, label: 'Maintien au chaud' },
  cooling:{ fromTemp: 63, toTemp: 10, maxHours: 2, label: 'Refroidissement rapide' },
  defrost:{ maxTemp: 4, maxHours: 24, label: 'Décongélation' },
  oil:    { tpmMax: 24, tpmAlert: 20, restHours: 8, label: 'Huiles de friture' },
  ph:     { min: 2, max: 7, label: 'pH' },
  weight: { lossAlertPct: 10, label: 'Pertes au poids' },
  cleaning:{ frequencies: ['Chaque service', 'Quotidien', 'Hebdomadaire', 'Mensuel', 'Trimestriel'] },
  retentionYears: 3,
};
export const ALLERGENS_14 = [ /* les 14 allergènes INCO, libellés français exacts, clé technique */ ];
export function normFor(key) // -> objet ou null
```
Chaque seuil porte un commentaire `// source: …`. Les valeurs de `index.html` (v3) primen
si elles diffèrent, sauf si elles contredisent la réglementation (le cas échéant, garde la
valeur réglementaire et signale-le dans le commentaire).

### 3. `src/domain/constants.js` (patch, en conservant **tous** les exports existants)
Ajoute, sans rien supprimer :
- `export const NAV = [...]` — **exactement** la structure de `docs/ARCHITECTURE.md` §3
  (3 groupes, 17 modules, index `01`→`17`, `id`/`idx`/`icon`/`title`/`desc`).
  L'entrée `settings` disparaît : remplacée par `compte` et `reglages`.
- `export const DEFAULT_ESTABLISHMENT` — données de démonstration **crédibles** :
  `{ name: "Le Comptoir des Halles", activity: "Restaurant traditionnel — cuisine sur place",
     siret: "812 447 093 00041", address: "14 rue des Halles", postal: "26000", city: "Valence",
     phone: "04 75 42 18 06", email: "contact@comptoir-des-halles.fr",
     manager: "Amélie Ferrand", agreement: "FR 26 118 0042", seats: 48, openedYear: 2019 }`
- `export const DEFAULT_EQUIPMENTS` — 6 à 8 équipements réalistes avec
  `{ id, name, type, min, max, location, active }` : chambre froide positive (0/4),
  armoire positive (0/4), congélateur négatif (-22/-18), vitrine pâtissière (0/4),
  cellule de refroidissement (-2/4), bain-marie (63/90), armoire chaude (63/80),
  chambre froide légumes (2/6). Emplacements : « Cuisine chaude », « Réserve », « Pâtisserie ».
- `export const DEFAULT_BRIGADE` — enrichi : chaque membre
  `{ id, firstName, lastName, short, initials, role, pin, active, createdAt }`.
  Reprends les 4 personnes du fichier actuel si leur nom est crédible ; sinon :
  Amélie Ferrand (gérante, PIN 4 chiffres, active), Karim Bouziane (responsable),
  Léa Marcotte (operateur), Tom Rivière (operateur). `short` = prénom, `initials` = 2 lettres.
  **Un seul `gerant`, actif, obligatoirement.**
- `export const DEFAULT_SETTINGS` — objet complet :
  `{ theme: 'papier', density: 'confortable', sounds: true, autoLockMinutes: 15,
     tempUnit: 'C', establishment: DEFAULT_ESTABLISHMENT, norms: <valeurs de haccp_norms>,
     allergens: ALLERGENS_14, backupReminderDays: 7 }`
- `export const STORAGE_KEYS` (si absent) : objet des clés `localStorage` existantes +
  `settings`, `session`, `activityLog` — **réutilise les clés existantes** (aucune migration
  de données ne doit être nécessaire).
- `export const APP_VERSION = '4.0-registre'`.

### 4. `src/domain/entities.js` (patch, en conservant **tous** les exports existants)
Ajoute les fabriques/normaliseurs (purs, sans accès au stockage) :
```js
export function createOperator(input)      // id stable (slug ou timestamp), valeurs par défaut, validation
export function normalizeOperator(raw)     // données v3 (sans role/active) -> v4 ; role par défaut 'operateur'
export function validateOperator(op)       // -> { ok, errors: { champ: message français } }
export function createSettings(input)      // fusion profonde avec DEFAULT_SETTINGS (2 niveaux)
export function normalizeSettings(raw)     // objet partiel/absent -> settings valides (jamais null)
export function operatorDisplayName(op)    // "Amélie Ferrand"
export function operatorInitials(op)       // "AF" (calcul si absent)
```
Règles de validation : nom et prénom requis (2–40 car., lettres/tirets/apostrophes/espaces) ;
rôle ∈ ROLES ; PIN optionnel mais s'il est fourni : 4 à 6 chiffres, pas de suite évidente
(`1234`, `0000`, `1111` refusés) ; pas deux opérateurs actifs avec le même nom complet.

## Contraintes
- Aucune dépendance, aucun `import` hors `src/domain/`, **aucun accès** à `localStorage`
  ou au DOM dans cette couche.
- Ne modifie **aucun** fichier hors ces 4 (`src/domain/*`). En particulier : ne touche pas
  `src/infrastructure/storage_repository.js` (une autre spec le fait), ni `index.html`.
- `src/domain/constants.js` et `entities.js` doivent rester **sous 500 lignes** (découpe
  si besoin en gardant les mêmes exports).
- Code commenté en français, JSDoc sur chaque export.

## Critères d'acceptation (vérifie-les toi-même avant de rendre)
- `node tools/check-syntax.mjs` → OK.
- `node tools/check-design.mjs` → 0 violation.
- `python3 /opt/data/scripts/god-file-guard.py --check src/domain/constants.js` (idem
  `entities.js`, `roles.js`, `haccp_norms.js`) → OK.
- `node -e "import('./src/domain/constants.js').then(m => { \
   const ids = m.NAV.flatMap(g => g.items.map(i => i.id)); \
   if (ids.length !== 17) throw new Error('NAV: ' + ids.length + ' modules'); \
   console.log('NAV OK', ids.join(',')); })"` → 17 modules, ids exacts de l'ARCHITECTURE.
- `node -e "import('./src/domain/roles.js').then(m => { \
   const all = new Set(Object.keys(m.PERMISSIONS)); \
   for (const r of Object.values(m.ROLES)) for (const p of r.permissions) if (!all.has(p)) throw new Error('permission inconnue: ' + p); \
   console.log('ROLES OK'); })"`
- `node -e "import('./src/domain/entities.js').then(m => { \
   const s = m.normalizeSettings({}); if (!s.establishment || !s.norms) throw new Error('settings incomplets'); \
   const op = m.normalizeOperator({ firstName:'Jean', lastName:'Dupont' }); if (op.role !== 'operateur' || op.active !== true) throw new Error('normalizeOperator KO'); \
   console.log('ENTITIES OK'); })"`
