# SPEC P2 — Composants CSS du design system « REGISTRE »

## Contexte
`traqhaccp` : PWA statique (vanilla JS, ES modules, **aucun build**). Le design system maison
remplace l'ancien Tailwind dark/émeraude. Le socle (`css/tokens.css`, `css/base.css`,
`css/layout.css`) est écrit par une autre spec en parallèle : **ne les crée pas, ne les
modifie pas**.

**Lis d'abord, et applique à la lettre :**
- `docs/DESIGN.md` §4 à §7 (couleurs, espacements, mouvement, **contrat de classes**)
- `docs/ARCHITECTURE.md` §1 et §2

## Ta mission
Créer **exactement ces 2 fichiers** (et rien d'autre) :

1. `css/components.css` (≤ 500 lignes) — tous les composants génériques du contrat :
   - Commandes : `.btn` (et `--primary`, `--ghost`, `--danger`, `--sm`, `--block`),
     `.icon-btn`, `.link`, `.seg`/`.seg__item`, `.toolbar`, `.switch` (+ `__track`, `__thumb`),
     `.checkbox`, `.radio`.
   - Formulaires : `.field`, `.field__label`, `.field__hint`, `.field__error`, `.input`,
     `.select` (avec chevron SVG en `background-image`, `currentColor` via `mask` ou data-URI
     encodée en `--ink-3`), `.textarea`, `.input-group` (préfixe/suffixe), `.pin` (4 cases
     mono 40 px de large, 44 px de haut — **jamais de ronds**).
   - Conteneurs : `.section`, `.section__head`, `.section__title`, `.section__action`,
     `.sheet` (+ `__head`, `__body`, `__foot`) — surface `--sheet`, filet 1 px, rayon `--r-2`,
     **aucune ombre**, `.kpi` (+ `__label`, `__value`, `__unit`, `__delta` avec `.is-up`/
     `.is-down`, `__spark`), `.callout` (+ `--info`, `--warn`, `--danger` — bordure gauche
     3 px, fond `--sheet`, icône 16 px), `.rule`, `.divider`.
   - Données : `.table` (+ `--zebra`, `--compact`), `.table--scroll` (conteneur
     `overflow-x:auto` avec ombre de bord en `linear-gradient` **sur le conteneur
     uniquement**, jamais un fond), `th`/`td`, `.num` (mono, tabulaire, droite),
     `tr.is-selected`, `.mark` (+ `--ok`, `--warn`, `--danger`, `--neutral`) = carré 8 px
     + `.mark__label` (`--t-label`), `.timeline`/`.timeline__item`, `.stamp` (tampon
     d'enregistrement : filet accent, texte mono, `letter-spacing` léger).
   - Surcouches : `.backdrop`, `.modal` (+ `__panel`, `__head`, `__body`, `__foot`, `--sm`,
     `--lg`), `.panel` (+ `__head`, `__body`, `__foot`), `.toast` (+ `--ok`, `--warn`,
     `--danger`, `__action`), `.palette` (+ `__input`, `__list`, `__item`, `.is-active`),
     `.lightbox`.
   - États : `.empty` (état vide composé : icône 32 px, titre, corps, action),
     `.skeleton` (bloc `--paper-2`, animation d'opacité douce, `prefers-reduced-motion`
     respecté), `.badge-count` (compteur discret, **pas** de pilule colorée).
   - A11y : `:focus-visible` sur tout élément interactif, `.is-disabled` + `[disabled]`
     (opacité 0.5, `cursor: not-allowed`), `[aria-invalid="true"]` sur `.input` → bordure
     `--danger`.
   - Tailles de contrôle cohérentes avec `--ctl`, `--ctl-lg`, `--row`.

2. `css/views.css` (≤ 400 lignes) — styles spécifiques aux modules métier :
   - `.matrix` (matrice allergènes INCO : conteneur `overflow:auto`, `thead th` vertical
     (`writing-mode: vertical-rl`, hauteur 140 px), cellules 36×36 px centrées, `.matrix__on`
     = carré 10 px `--ok`, `.matrix__off` = tiret `--ink-3`).
   - `.gauge` (jauge de TPM huile : barre horizontale 8 px, segments de seuil, curseur
     2 px, valeurs mono) + `.gauge__mark` (seuil réglementaire).
   - `.chrono` (chronomètre refroidissement/décongélation : valeur `--t-num-xl` mono,
     `.chrono--late` en `--danger`, barre de progression 4 px, libellé `--t-label`).
   - `.temp` (affichage de température : valeur mono, `.temp--cold` (≈ bleu nuit
     `--accent`), `.temp--warm` (`--warn`), `.temp--hot` (`--danger`), `.temp--ok`) — pas
     de couleur décorative, uniquement sémantique.
   - `.checklist`, `.checklist__item` (ligne 48 px, case 20 px à gauche, libellé, échéance
     mono, `.is-done` = libellé barré `--ink-3` + case cochée `--accent`).
   - `.ged` (GED documents : ligne de document, icône type, nom, métadonnées mono,
     actions au survol), `.zone-upload` (zone de dépôt, tirets 1 px `--rule-2`, jamais de
     fond pointillé coloré).
   - `.inspection-banner` (bandeau lecture seule en haut de contenu : filet 2 px `--warn`,
     libellé « Mode inspection — lecture seule », hauteur 40 px).
   - `.receipt` (bloc « fiche » imprimable : entête établissement + tampon + tableau).
   - `.sign` (bloc signature/validation : bordure, ligne de signature, nom + horodatage mono).
   - `.roles` (matrice de permissions : table compacte, cases en `.mark`).

## Contraintes
- CSS natif uniquement, **aucun hex/rgb** (tout en `var(--…)`), aucune ombre hors
  `--sh-1`/`--sh-2`, aucun dégradé hors l'indice de scroll de `.table--scroll`.
- Rayons : `--r-1`/`--r-2`/`--r-3` uniquement (jamais `border-radius: 50%` sauf `.mark`
  et `.switch__thumb` — et jamais `9999px` ailleurs).
- Ne modifie **aucun** autre fichier. Ne crée pas `tokens.css`/`base.css`/`layout.css`.
- Chaque composant doit fonctionner en thème « papier » **et** « nuit » (aucune couleur
  littérale, uniquement les variables) et être lisible à 1024×768.

## Critères d'acceptation (vérifie-les toi-même avant de rendre)
- `node tools/check-design.mjs` → **0 violation**.
- `node tools/check-syntax.mjs` → OK.
- `python3 /opt/data/scripts/god-file-guard.py --check css/components.css` et idem
  `css/views.css` → OK (≤ 500 lignes).
- Toutes les classes citées ci-dessus ont une règle définie (aucune classe du contrat
  laissée sans style).
