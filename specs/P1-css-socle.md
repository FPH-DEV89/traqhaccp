# SPEC P1 — Socle CSS du design system « REGISTRE »

## Contexte
`traqhaccp` est une PWA statique (vanilla JS, ES modules, **aucun build**) de Plan de Maîtrise
Sanitaire. Le design actuel (Tailwind CDN dark slate + émeraude, `rounded-3xl`, glow) est un
« AI slop » typique : il doit être **entièrement remplacé** par un design system maison en CSS
natif inspiré d'un registre sanitaire papier.

**Lis d'abord, et applique à la lettre :**
- `docs/DESIGN.md` — contrat visuel (tokens, échelle typo, interdits, classes)
- `docs/ARCHITECTURE.md` — contraintes générales (§1) et arborescence (§2)

## Ta mission
Créer **exactement ces 4 fichiers** (et rien d'autre) :

1. `css/tokens.css` (≤ 160 lignes)
   - `:root` = thème « papier », `[data-theme="nuit"]` = thème sombre, **exactement** les
     variables de DESIGN.md §4/§5/§6 (couleurs, espacements, rayons, z-index, durées, easings,
     familles de polices, tailles de police, `--rail`, `--topbar`, `--content-max`, `--row`,
     `--ctl`, `--ctl-lg`, `--touch`, `--sh-1`, `--sh-2`).
   - C'est le **seul** fichier autorisé à contenir des valeurs littérales `#hex` / `rgba()`.
     Ajoute un commentaire d'en-tête qui le rappelle.
   - Inclusion du `@media (prefers-color-scheme: dark)` optionnel : garde le thème « papier »
     par défaut, le thème suit `data-theme` posé par le JS (pas de bascule automatique).

2. `css/base.css` (≤ 380 lignes)
   - Reset moderne et sobre (`box-sizing`, marges, `img/svg` block, `button/input` inherit,
     `:focus-visible` global, `::selection` en `--accent-wash`).
   - Typographie appliquée via variables de `tokens.css` : `body` = Archivo `--t-body`,
     titres, `h1..h4`, `small`, `code/kbd/samp` en IBM Plex Mono.
   - Classes utilitaires **uniquement** celles du contrat : `.container`, `.num`, `.unit`,
     `.rule`, `.skip-link` (visible au focus), `.visually-hidden`, `.hide-mobile`,
     `.stack`/`.row` (`gap` via `--s-*`), `.right`, `.muted`, `.strong`, `.truncate`.
   - États textuels : `.is-ok`/`.is-warn`/`.is-danger` (couleur seule, pas de fond).
   - `@media print` global : `--paper:#fff`, masquage de `.rail`, `.topbar`, `.toolbar`,
     `.btn`, `.panel`, `.modal`, `.toast`, `.palette`, `.tabbar`, `@page { margin: 14mm }`,
     `break-inside: avoid` sur `.sheet`, `.table tr`, `thead` répété.
   - `@media (prefers-reduced-motion: reduce)` : durées à 1ms, pas de transform.
   - `@media (pointer: coarse)` : cibles interactives ≥ `--touch`.

3. `css/layout.css` (≤ 400 lignes)
   - `.app` : grille `var(--rail) 1fr`, hauteur `100dvh`, fond `--paper`.
   - `.rail` (232 px, fond `--paper`, filet droit 1 px `--rule`, scrollable, sticky) :
     `.rail__brand` (monogramme + nom), `.rail__title`, `.rail__meta` (version mono),
     `.rail__group` + `.rail__group-label` (micro-libellé `--t-label`), `.nav-item`
     (h 38 px, grille `28px 1fr auto`, `--ink-2`), `.nav-item__idx` (mono 11 px `--ink-3`,
     tabulaire), `.nav-item__icon` (18 px), `.nav-item__label`, `.nav-item__count`
     (mono 11 px), `.nav-item.is-active` = fond `--accent-wash`, texte `--ink`,
     barre gauche 2 px `--accent`, icône `--accent`.
   - `.topbar` (h 56 px, fond `--paper`, filet bas 1 px, sticky, `--z-topbar`) :
     `.topbar__left`, `.topbar__right`, `.topbar__id` (établissement, `--t-sm`),
     `.topbar__clock` (mono, tabulaire), `.op-chip` (squircle 28 px `--accent-wash`,
     initiales mono, nom, rôle `--ink-3`).
   - `.main` : scrollable, fond `--paper`, padding `--s-8` (`--s-5` mobile).
   - `.page-head` (numéro d'index mono + titre Instrument Serif + description `--t-sm`),
     filet bas après l'entête.
   - `.grid`, `.grid--2`, `.grid--3`, `.grid--4`, `.grid--split` (7/5), `.grid--auto` ;
     responsive : 4→2 colonnes ≤ 1100 px, →1 colonne ≤ 760 px.
   - Mobile ≤ 900 px : `.rail` masqué, `.tabbar` (barre inférieure fixe, 5 items +
     `.tabbar__more`, h 56 px, `padding-bottom: env(safe-area-inset-bottom)`),
     `.app` en une colonne, `.main` padding bas augmenté.
   - `.backdrop`, `.panel` (feuille latérale droite 480 px, `--sheet`, ombre `--sh-1`,
     transition `translateX`), `.modal` (`.modal__panel` centré, max 640 px, `--sh-2`,
     `--r-3`), `.toast` (bas-gauche, 320 px, `--sh-1`), `.palette` (centré haut, 560 px,
     `--sh-2`), `.lightbox` (plein écran, fond `--paper` opaque), `.skip-link`.

4. `assets/favicon.svg`
   - 32×32 : carré `--accent` (`#0E4F55`) arrondi 3 px, monogramme « T » en Instrument Serif
     (texte SVG ou tracé), couleur `#F7FBFA`. Lisible à 16 px. Aucun dégradé.

## Contraintes
- CSS natif uniquement : **pas de Tailwind, pas de `@apply`, pas de préprocesseur**.
- **Aucun hex/rgb hors de `tokens.css`** : tout le reste utilise `var(--…)`.
- Ne modifie **aucun** autre fichier (surtout pas `index.html` : la migration HTML est faite
  par d'autres specs ; Tailwind CDN reste chargé pendant la transition).
- N'ajoute aucune dépendance, aucun `@import`, aucun fichier de police local.
- Les polices (Archivo, Instrument Serif, IBM Plex Mono) sont chargées par `index.html`
  (une autre spec s'en occupe) : référence-les uniquement via `--ff-*`.

## Critères d'acceptation (vérifie-les toi-même avant de rendre)
- `node tools/check-design.mjs` → **0 violation** (les 4 fichiers sont dans son périmètre).
- `node tools/check-syntax.mjs` → OK.
- `python3 /opt/data/scripts/god-file-guard.py --check css/*.css` → OK pour chacun.
- Aucune règle ne cible une classe Tailwind existante de `index.html`.
- Le styleguide de vérification visuelle (créé par une autre spec) doit pouvoir rendre
  l'intégralité de `.rail`, `.topbar`, `.nav-item`, `.page-head`, `.grid`, `.panel`,
  `.modal`, `.toast`, `.tabbar` : vérifie que toutes ces classes ont bien un style défini
  dans l'un de tes fichiers (aucune classe du contrat ne doit rester sans règle).
