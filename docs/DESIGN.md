# TraqHACCP — Contrat de design « REGISTRE »

> Source de vérité visuelle. **Toute** vue doit s'y conformer. Aucune classe utilitaire
> Tailwind ne doit subsister dans les vues migrées (le CDN Tailwind est retiré à la fin).
> Version 4.0 — design system maison en CSS natif.

## 1. Intention

L'application remplace le **classeur sanitaire papier** d'un établissement alimentaire.
Le langage visuel n'est donc pas celui d'un « dashboard SaaS » mais celui d'un
**registre officiel** : papier chaud, encre, filets de 1 px, typographie éditoriale,
chiffres alignés, zéro décoration.

Trois mots-clés : **institutionnel · dense · lisible à 60 cm sur tablette de cuisine.**

Référence mentale : un registre de laboratoire / un JO / une fiche de température
de cuisine professionnelle — pas Linear ni un template Vercel.

## 2. Interdits (signatures « AI slop » à éliminer)

| Interdit | Pourquoi |
|---|---|
| Dégradés (linéaires, radiaux, text-gradient) | Aucune fonction informative |
| `backdrop-filter` / glassmorphism / `bg-white/5` | Décoratif, signature IA |
| Ombres portées sur les cartes | On hiérarchise par filets et espace, pas par élévation |
| Arc-en-ciel d'icônes (emerald/indigo/amber/purple/teal/sky/pink/cyan…) | **1 seule couleur d'accent** dans toute l'app |
| `rounded-xl` / `rounded-2xl` / `rounded-3xl` | Rayon max 6 px (feuille/modale), 3 px par défaut |
| `emerald`/`slate` de Tailwind, `#10b981`, `#34d399` | Palette « IA par défaut » |
| Emojis dans l'UI ou les notifications | Registre professionnel |
| Badges en pilule (`rounded-full` + fond coloré) | Statuts = marque carrée + micro-libellé |
| Modale pour une action simple | Feuille latérale (`.panel`) ou édition en ligne |
| `animate-pulse`, `animate-bounce`, spinner circulaire | Chargement = squelette de la forme réelle |
| `window.alert()` / `confirm()` | Feedback inline, `.callout`, `.toast` |
| Lorem ipsum, « John Doe », « Acme », chiffres ronds | Données réalistes et crédibles (voir §9) |
| `font-inter` / Inter | Typographie à caractère (§3) |
| `#000` pur, `#fff` pur | Papier/encre chauds (§4) |
| Exclamations dans les messages de succès (« Parfait ! ») | Ton neutre : « Enregistré », « Huile relevée » |
| Title Case sur les titres | Casse de phrase (règle française : majuscule initiale seulement) |
| `z-index: 9999` | Échelle `--z-*` (§6) |

## 3. Typographie

```
Instrument Serif  (400, italic)  → display éditorial : titres de page, couvertures de rapport
Archivo           (400/500/600/700) → interface, texte courant, libellés
IBM Plex Mono     (400/500)      → toutes les données : températures, heures, IDs, PIN, quantités
```

Chargement (dans `index.html`, 1 seule requête) :
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,500;0,600;0,700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
```

Échelle (base 16 px) — définie en tokens, jamais en dur :

| Token | Taille | Graisse | Usage |
|---|---|---|---|
| `--t-display` | 30px / 1.08 / -0.015em | Serif 400 | Titre de page, couverture rapport |
| `--t-h1` | 21px / 1.2 / -0.01em | Archivo 600 | Titre de section principale |
| `--t-h2` | 15px / 1.3 / -0.005em | Archivo 600 | Titre de bloc / carte |
| `--t-h3` | 13px / 1.35 | Archivo 600 | Sous-titre, entête de tableau |
| `--t-body` | 13.5px / 1.5 | Archivo 400 | Texte courant |
| `--t-sm` | 12px / 1.45 | Archivo 400 | Texte secondaire |
| `--t-label` | 10.5px / 1.2 / **+0.09em** / uppercase | Archivo 600 | Micro-libellés (couleur `--ink-3`) |
| `--t-num` | 13.5px | Plex Mono 400 `tabular-nums` | Valeurs |
| `--t-num-lg` | 20px / 1.1 | Plex Mono 500 `tabular-nums` | KPI |
| `--t-num-xl` | 34px / 1 / -0.02em | Plex Mono 500 `tabular-nums` | Score sanitaire |

Règles :
- Tout chiffre mesuré (température, %, heure, poids, DLC, quantité) : `font-family: var(--ff-mono); font-variant-numeric: tabular-nums;` + classe `.num`.
- Unités (°C, g, %, h) : `<span class="unit">` — taille `--t-sm`, couleur `--ink-3`, `margin-left: 2px`, jamais collées au chiffre.
- Largeur de paragraphe : `max-width: 68ch`.
- Titres : `text-wrap: balance`. Paragraphes : `text-wrap: pretty`.
- `letter-spacing` négatif uniquement ≥ 20 px.
- Un titre de page s'écrit : numéro d'index mono + titre serif + sous-titre `--t-sm` (voir `.page-head`).

## 4. Couleurs — thème « papier » (défaut) et « nuit »

Une seule famille de gris (chaude) par thème. **Un seul accent.**

```css
:root, [data-theme="papier"] {
  --paper:      #F2F0EA;  /* fond application */
  --paper-2:    #EAE7DF;  /* fond alterné, entêtes de tableau */
  --sheet:      #FBFAF7;  /* surface des composants */
  --ink:        #1A1C1E;  /* texte principal */
  --ink-2:      #4C5257;  /* texte secondaire */
  --ink-3:      #6F757B;  /* libellés, unités, métadonnées */
  --rule:       #DDD9CF;  /* filet 1px */
  --rule-2:     #C3BEB1;  /* filet accentué, séparateur de groupe */
  --accent:     #0E4F55;  /* pétrole — LA couleur de marque */
  --accent-2:   #0A3B40;  /* accent survol/appui */
  --accent-wash:#E3EDED;  /* fond teinté accent (sélection, actif) */
  --ok:         #1D6B3F;
  --warn:       #8A5A00;
  --danger:     #9E241C;
  --on-accent:  #F7FBFA;
}
[data-theme="nuit"] {
  --paper:      #141413; --paper-2: #1A1918; --sheet: #1C1B19;
  --ink:        #E9E6E0; --ink-2: #ABA8A1; --ink-3: #8A867F;
  --rule:       #2E2C29; --rule-2: #423F3A;
  --accent:     #5FB3B0; --accent-2: #7CC5C2; --accent-wash: #14312F;
  --ok:         #4FA96E; --warn: #C79A3A; --danger: #D9645A;
  --on-accent:  #0C1613;
}
```

- Sémantique de statut : `--ok` (conforme), `--warn` (à surveiller / écart mineur), `--danger` (non conforme / hors plage), `--accent` (information, sélection, action).
- Fond coloré plein autorisé **uniquement** pour `.btn--primary`, `.mark` (marque de statut), `.callout--danger`, `.stamp`.
- Ombres : uniquement `--sh-1` (feuille latérale) et `--sh-2` (modale). Jamais sur les cartes.
- `--sh-1: 0 12px 40px -18px rgba(26,28,30,.35)`
- `--sh-2: 0 20px 56px -20px rgba(26,28,30,.40), 0 2px 8px -4px rgba(26,28,30,.14)`

## 5. Espacement, rayons, grille

```css
--s-1:2px; --s-2:4px; --s-3:6px; --s-4:8px; --s-5:12px; --s-6:16px; --s-7:20px; --s-8:24px; --s-9:32px; --s-10:40px; --s-11:56px;
--r-1:2px; --r-2:3px; --r-3:6px;
--rail: 232px;   /* largeur du rail de navigation */
--topbar: 56px;
--content-max: 1240px;
--row: 40px;     /* hauteur de ligne de tableau */
--ctl: 32px;     /* hauteur de contrôle (bouton, input dense) */
--ctl-lg: 36px;  /* input de formulaire */
--touch: 44px;   /* cible tactile minimale (tablette) */
```

- Grille de contenu : `display:grid; gap: var(--s-6); grid-template-columns: repeat(12, 1fr)` via `.grid--2/3/4` (desktop) → 2 col ≤1100px → 1 col ≤760px. Jamais 3 cartes identiques en ligne pour un « feature row » : utiliser 2 colonnes asymétriques (7/5) ou 4/4/4 uniquement pour des KPI.
- Rythme vertical : sections séparées par un filet `.rule` de 1 px + `--s-9` de marge, **pas** par des cartes flottantes. Padding vertical optique (bas légèrement > haut).
- `.container` : `max-width: var(--content-max)`, `margin-inline: auto`, padding inline `--s-8` (mobile `--s-5`).
- Aucune largeur en px dur hormis les tokens ci-dessus.

## 6. Profondeur, mouvement, accessibilité

```css
--z-rail:20; --z-topbar:30; --z-panel:40; --z-modal:50; --z-toast:60; --z-lightbox:70;
--e-out: cubic-bezier(.2,.7,.3,1);
--d-1:120ms; --d-2:180ms; --d-3:240ms;
```

- Hover : changement de fond/teinte (`--paper-2`, `--accent-wash`) + `border-color` en `--d-1`. Pas de `scale` sur les blocs.
- Appui : `.btn:active { transform: translateY(1px) }`. Pas d'animation sur `width`/`height`/`top`/`left`.
- Modale / feuille : opacité + `translateY(4px)` (modale) / `translateX(12px)` (feuille) en `--d-2`.
- Tampon d'enregistrement `.stamp` : `opacity 0→1` + `scale 1.04→1` en `--d-3`, **une seule fois**.
- `:focus-visible` : `outline: 2px solid var(--accent); outline-offset: 2px;` sur **tout** élément interactif. Non négociable.
- `@media (prefers-reduced-motion: reduce)` : toutes les durées à `1ms`, aucun `transform`.
- Cibles tactiles ≥ `--touch` sur `(pointer: coarse)`.
- Lien d'évitement `.skip-link` en tête de `<body>`.
- Contraste : texte courant ≥ 4.5:1, `--ink-3` réservé aux libellés ≥ 10.5 px 600 uppercase.

## 7. Classes de composants (contrat obligatoire)

**Shell**
- `.app` (grid `--rail` + 1fr) · `.rail` · `.rail__brand` · `.rail__title` · `.rail__meta` · `.rail__group` (+ `.rail__group-label`) · `.nav-item` (+ `.is-active`) · `.nav-item__idx` · `.nav-item__icon` · `.nav-item__label` · `.nav-item__count` · `.topbar` · `.topbar__left/__right` · `.page-head` · `.page-head__idx` · `.page-head__title` · `.page-head__desc`
- Mobile : `.rail` passe en barre inférieure `.tabbar` (`.tabbar__item`) + `.rail-more` (feuille de navigation complète). Le rail est masqué ≤ 900 px.

**Opérateur (compte courant)**
- `.op-chip` (squircle 28 px avec initiales mono + nom + rôle) → ouvre `.op-menu` (liste des utilisateurs actifs). Jamais de pastille ronde avatar.

**Conteneurs**
- `.section` · `.section__head` · `.section__title` · `.section__action` · `.rule`
- `.sheet` (surface `--sheet`, bordure 1 px `--rule`, rayon `--r-2`, **aucune ombre**) · `.sheet__head` · `.sheet__body` · `.sheet__foot`
- `.kpi` · `.kpi__label` · `.kpi__value` (`.num` `--t-num-xl`) · `.kpi__unit` · `.kpi__delta` (`.is-up`/`.is-down`) · `.kpi__spark` (SVG inline optionnel)
- `.callout` (+ `--info|--warn|--danger`) : avis en ligne, bordure gauche 3 px, fond `--sheet`, icône 16 px.
- `.empty` (état vide composé : icône, titre, explication, action) · `.skeleton` (bloc `--paper-2` animé en opacité).
- `.stamp` (tampon d'enregistrement : bordure 1 px accent, texte mono, date + opérateur).

**Commandes**
- `.btn` (h `--ctl`, bordure 1 px `--rule-2`, fond `--sheet`, texte `--ink`, rayon `--r-2`, padding inline `--s-5`, gap `--s-4`, icône 16 px) · `.btn--primary` (fond accent, texte `--on-accent`, bordure transparente) · `.btn--ghost` (bordure transparente) · `.btn--danger` (texte/bordure `--danger`) · `.btn--sm` (h 26 px) · `.btn--block` · `.icon-btn` (carré 32 px, icône 18 px) · `.link` (texte souligné accent, tertiaire).
- `.toolbar` (barre de filtres : hauteur 48 px, filet bas, champs inline, `gap --s-5`).
- `.seg` / `.seg__item` (segmented control : bordure 1 px, item actif = fond `--accent-wash` + texte accent).
- `.field` · `.field__label` (`--t-label`) · `.input` · `.select` · `.textarea` · `.field__hint` · `.field__error` (texte `--danger` `--t-sm`) · `.switch` (+ `.switch__track`, `.switch__thumb`) · `.checkbox` · `.pin` (saisie PIN : 4 cases mono 40 px, PAS de gros ronds).
- `.input` : h `--ctl-lg`, fond `--sheet`, bordure 1 px `--rule`, rayon `--r-2`, padding inline `--s-5`, focus = `outline 2px accent`. Champs numériques : `class="input num"`.
- Validation inline obligatoire : `.field__error` + `aria-invalid="true"`. Aucun `alert()`.

**Données**
- `.table` (pleine largeur, `border-collapse: collapse`) · `th` (`--t-label`, fond `--paper-2`, filet bas `--rule-2`, aligné gauche, padding `--s-5`) · `td` (h `--row`, filet bas `--rule`) · `.num` (mono, tabulaire, aligné droite) · `tr.is-selected` (fond `--accent-wash`) · `.table--zebra` (lignes paires `--paper`).
- `.mark` (+ `--ok|--warn|--danger|--neutral`) : carré 8 px, rayon `--r-1`, `background: currentColor` + `.mark__label` (`--t-label`, couleur du statut). Jamais de pilule.
- `.matrix` (matrice allergènes : 14 colonnes, entêtes verticales `writing-mode: vertical-rl`, cellules 36 px, `--ok` = point plein, vide = tiret `--ink-3`).
- `.timeline` / `.timeline__item` (historique : filet vertical, point 8 px, heure mono).

**Surcouches**
- `.backdrop` (fond `rgba(26,28,30,.42)` **sans blur**) · `.modal` · `.modal__panel` (`.sheet`, rayon `--r-3`, ombre `--sh-2`, max 640 px) · `.modal__head/__body/__foot`
- `.panel` (feuille latérale droite 480 px, `--sheet`, ombre `--sh-1`, entrée `translateX`) — **usage privilégié** pour toute création/édition/détail de fiche (remplace les modales).
- `.toast` (bandeau bas-gauche 320 px : marque de statut + message + action « Annuler ») · `.toast--ok/warn/danger`.
- `.palette` (palette de commandes ⌘K / Ctrl+K : recherche de module et d'action, liste 44 px, surlignage `--accent-wash`).
- `.lightbox` (photo plein écran, fond `--paper` opaque, métadonnées en pied).

**Impression** (`@media print`) : `--paper: #fff`, masquer `.rail/.topbar/.toolbar/.btn/, .panel, .modal, .toast, .palette`, filets visibles, `@page { margin: 14mm }`, titres serif, tableaux non coupés (`break-inside: avoid`), en-tête d'établissement répété. Le registre DDPP et les fiches doivent sortir propres en A4 portrait.

## 8. Iconographie

- **Aucune police d'icônes** (Font Awesome retiré). Sprite SVG inline maison : `src/presentation/icons.js` → `icon(name, size = 18)` retourne une chaîne `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`.
- Grille 24, trait **1.6 constant**, `stroke="currentColor"`, `aria-hidden="true"` sauf si `role="img"` + `<title>`.
- Couleur : héritée du contexte (`--ink-2` au repos, `--accent` si actif). **Jamais** de couleur décorative par icône.
- Liste des noms à fournir dans `icons.js` : `dashboard, clipboard, thermometer, truck, tag, wheat, spray, droplet, snowflake, flame, scale, folder, alert, shield, seal, users, settings, search, plus, edit, trash, check, x, chevron-right, chevron-down, download, upload, printer, camera, clock, calendar, filter, command, logout, lock, eye, refresh, sun, moon, bell, mail, phone, map`. Alias acceptés pour compatibilité avec les anciens `fa-*` (`fa-temperature-half → thermometer`, etc.) via la table `ICON_ALIAS`.
- Favicon : `assets/favicon.svg` — monogramme « T » serif blanc sur carré pétrole, + `<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">` et `theme-color` = `--paper`.

## 9. Contenu et micro-copie

- Français, casse de phrase, ton neutre, phrases courtes, voix active.
- Données de démo **crédibles et irrégulières** : pas de `99.99 %`, pas de `John Doe`. Ex. de brigade : *Amélie Ferrand* (gérante), *Karim Bouziane* (second de cuisine), *Léa Marcotte* (pâtisserie), *Tom Rivière* (plonge). Établissement : *Le Comptoir des Halles — 14 rue des Halles, 26000 Valence — SIRET 812 447 093 00041*. Températures : `3.4 °C`, `-18.6 °C`, `−0.2 °C`.
- Messages : « Relevé enregistré », « Huile mise au repos », « 3 tâches en retard ». Jamais « Oops », jamais « Parfait ! ».
- Écriture typographique française : espace insécable avant `: ; ! ? %` et `°C`, virgule décimale, `–` (tiret demi-cadratin) pour les plages.
- Chaque écran doit fournir un **état vide** et un **état de chargement** (squelette), pas un blanc.

## 10. Définition de « fini » (checklist de revue visuelle)

1. Zéro classe `bg-slate-*` / `text-emerald-*` / `rounded-xl` / `shadow-*` / `backdrop-blur*` dans les vues migrées.
2. Une seule couleur d'accent visible à l'écran ; les statuts utilisent `--ok/--warn/--danger`.
3. Tous les nombres en mono tabulaire, unités en `.unit`.
4. Aucune modale pour une action non destructive → `.panel`.
5. Focus visible au clavier, `Tab` parcourt logiquement l'écran, `Échap` ferme les surcouches.
6. 1024×768 (tablette cuisine) : aucun débordement horizontal, cibles ≥ 44 px.
7. 1440×900 : contenu contenu par `--content-max`, pas étiré.
8. 390×844 (téléphone) : rail → `.tabbar`, tableaux scrollables horizontalement (`overflow-x:auto`), pas de troncature de données.
9. Impression A4 : fiche et registre lisibles, filets conservés, navigation masquée.
10. Console navigateur vide (aucune erreur) sur les 17 modules.
