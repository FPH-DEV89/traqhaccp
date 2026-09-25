# DATA.md — Socle de données TraqHACCP

Ce document décrit la couche de données serveur connectée à **Supabase** (PostgREST + GoTrue).
L'application est connectée en permanence à Supabase, avec un cache local PWA de résilience.

## 1. Le tenant, c'est l'établissement

TraqHACCP est multi-établissement. Chaque table métier porte un `establishment_id`, et
l'isolation est appliquée **par le serveur** (Row Level Security), jamais par le client.

```
auth.users ──< memberships >── establishments ──< (toutes les tables métier)
                  (role)            (name, siret, address)
```

- `memberships` relie un **compte de connexion** à un établissement avec **un rôle**.
- `operators` (la « brigade ») sont les personnes qui **signent les relevés** sur le
  terrain : ce ne sont pas des comptes de connexion, ils n'ont pas d'authentification.
- `settings.payload` (jsonb) porte les réglages métier et les champs d'établissement qui
  ne sont pas des colonnes (`establishments` ne contient que `name`, `siret`, `address`).

## 2. Schéma (20 tables)

| Domaine | Tables |
|---|---|
| Ténancy | `establishments`, `memberships`, `operators`, `settings` |
| Températures | `equipments`, `temperature_logs` |
| Réception | `deliveries` |
| Traçabilité | `preparations`, `allergen_dishes` |
| Hygiène | `cleaning_tasks`, `checklists` |
| Huiles | `fryers` |
| Process | `cooling_cycles`, `defrost_cycles` |
| Contrôles | `ph_records`, `weight_records` |
| Conformité | `non_conformities`, `sanitary_documents` |
| Journal | `activity_log` |
| Commercial (hors registre) | `leads` |

Colonnes en `snake_case` côté serveur, `camelCase` côté JavaScript. Le mapping est
centralisé dans `src/infrastructure/supabase_mapping.js` — **aucune table n'est inventée
hors de la migration**.

`leads` (migration `0003`) est la seule table **non rattachée à un établissement** : c'est
le carnet de prospects de la vitrine commerciale. Elle n'obéit donc pas au cloisonnement
par tenant et suit la règle inverse : un seul droit est public — **déposer** un message.
Aucune politique de `select`/`update`/`delete` n'existe pour `anon` ou `authenticated`,
donc les prospects ne sont lisibles que par la clé de service (back-office, scripts). Un
garde-fou plafonne à 5 dépôts par heure et par adresse email.

⚠️ Piège vérifié le 18/09/2026 : poster sur `leads` avec `Prefer: return=representation`
échoue en `42501 new row violates row-level security policy` — non pas à cause de la
politique d'insertion, mais parce que PostgREST doit **relire** la ligne insérée et qu'`anon`
n'a aucun droit de lecture. Le formulaire de la vitrine doit poster en retour **minimal**
(comportement par défaut) et se contenter du code HTTP.

`temperature_logs` existe alors que `equipments.history` contient déjà un tableau : c'est
volontaire, l'historique JSON reste la vue courte de l'écran, la table permet les
requêtes analytiques (courbes, dérives) sans lire tout le registre.

## 3. Rôles et permissions

Cinq rôles, définis dans `src/domain/roles.js` :

- **gerant** — tout, y compris `users.manage` et `backup.restore`
- **responsable** — tout sauf la gestion des utilisateurs et la restauration
- **operateur** — saisie et signature des relevés, export
- **lecture** — consultation et export uniquement
- **inspecteur** (DDPP) — mode inspection lecture seule + export

Correspondance avec les politiques SQL :

| Écriture autorisée | Rôles | Fonction SQL |
|---|---|---|
| Relevés du quotidien (livraisons, préparations, nettoyage, refroidissement, décongélation, pH, poids, checklists, allergènes) | gerant, responsable, operateur | `can_write()` |
| Suppression de ces relevés | gerant, responsable | `can_delete()` |
| Référentiel et conformité (équipements, friteuses, réglages, non-conformités, opérateurs, documents) | gerant, responsable | `can_manage()` |
| Adhésions et établissement | gerant | `can_admin()` |

⚠️ **Le rôle est lu dans `memberships`, pas dans le JWT.** Un changement de rôle prend
effet immédiatement, sans réémission de jeton.

## 4. Cloisonnement (RLS)

> ⚠️ **Le socle décrit dans cette section a été conçu et appliqué le 18/09/2026, mais l'app
> livrée ne l'utilise plus.** Depuis le 24/09/2026 (`8560223`), l'app n'écrit dans aucune de ces
> tables : le registre vit en `localStorage` (cf. §5). Les migrations restent dans
> `supabase/migrations/` et s'appliquent toujours, mais elles protègent un socle que l'app ne
> remplit plus. À lire comme une conception disponible, pas comme le fonctionnement actuel.

19 tables, 19 en RLS, 72 politiques. Les fonctions de contrôle sont `security definer`
pour éviter la récursion RLS sur `memberships` :

```sql
current_role(est)  -- rôle de auth.uid() dans est
is_member(est)     -- auth.uid() est-il rattaché à est
can_write(est) / can_delete(est) / can_manage(est) / can_admin(est)
```

Règles de base : `select` = membre de l'établissement ; `insert`/`update`/`delete` selon la
matrice ci-dessus. **Aucun accès anonyme** (les droits de `anon` sont révoqués).

Preuves exécutées le 18/09/2026 (11/11) : un utilisateur de l'établissement B ne voit ni
ne peut écrire aucune ligne de A (même en filtrant explicitement sur l'identifiant de A) ;
un opérateur crée un relevé mais ne peut ni gérer un équipement ni supprimer ; une requête
sans authentification ne retourne rien.

## 5. Modes de persistance

| Mode | Persistance | Compte requis |
|---|---|---|
| `serveur` (**seul mode**) | Registre sur l'appareil (`localStorage`) + comptes & établissement sur Supabase | oui pour l'auth, **non** pour les données |

⚠️ **Réalité vérifiée le 25/09/2026.** Un seul mode, câblé en dur : `MODE_PERSISTANCE = 'serveur'`,
et `normaliserMode()` / `modePersistance()` / `modeParametreUrl()` renvoient tous `'serveur'`.
Attention au contresens : « serveur » ne signifie **pas** que le registre est stocké sur un serveur.

- **Sur Supabase** : uniquement les comptes (`signUp`, session GoTrue), les adhésions
  (`memberships`) et l'établissement (`create_establishment`, `establishments`).
- **Sur l'appareil** : **tout le registre HACCP** — `lots`, `recipes`, `secondaryDlcs`,
  `witnessSamples`, `salesHistory`, `teamMembers` — écrit par `saveState()` dans
  `localStorage` (`js/patisserie/state.js`), clés `traqhaccp_patisserie_<etabId>_<suffix>_v1`.
  **Aucun appel de table Supabase** pour ces données.

Conséquence directe : le registre est **par appareil, sans sauvegarde serveur ni partage**
entre membres d'un même établissement. Un poste perdu ou un cache vidé = registre perdu.

Cette couche a été **supprimée le 24/09/2026** (commit `8560223`, « retirer le legacy
abandonné » : 50 fichiers de clean architecture retirés, décision produit du 23/09).
`SupabaseHACCPRepository`, les lectures hydratées (`hydrate()`) et les écritures en
`Promise` (`flush()`, `onErreur`) **n'existent plus** : `src/infrastructure/` ne contient
que `config.js` et `supabase_client.js`. Plus aucun dépôt ne sait synchroniser le
registre — `js/patisserie/state.js` écrit `localStorage` en direct.

## 6. Bootstrap d'un établissement

L'insertion directe d'un établissement est impossible : écrire exige de relire la ligne
(`return=representation`), ce qui exige une adhésion qui n'existe pas encore. Le
bootstrap passe donc par une fonction atomique :

```js
const id = await supabase.rpc('create_establishment', { p_name: nom });
// create_establishment(nom) : crée l'établissement ET rattache l'appelant comme gérant
// (js/patisserie/auth.js:59 — c'est le seul RPC encore vivant)
```


## 7. Appliquer les migrations

Les migrations sont dans `supabase/migrations/`, numérotées, idempotentes
(`if not exists` / `drop policy if exists`) :

- `0001_init.sql` — 19 tables, index, 6 fonctions de contrôle, 72 politiques
- `0002_bootstrap_establishment.sql` — `create_establishment()`
- `0003_leads.sql` — table `leads` (prospects de la vitrine), RLS « dépôt seul »,
  garde-fou anti-inondation

Elles s'appliquent via l'API Management (SQL arbitraire) ou `supabase db push`.
En pratique : `python3 /opt/data/scripts/traqhaccp-socle/apply-migration.py <fichier.sql>`
(token Management dans `/opt/data/.env.supabase-cmz`, référence projet dans
`.env.supabase-traqhaccp`). Contrôle après coup :
`python3 /opt/data/scripts/traqhaccp-socle/verif-leads.py` — 6 vérifications HTTP réelles.

## 8. Ce qui n'est pas fait

- Aucune interface de **gestion des comptes** : pas d'écran d'invitation, pas de
  réinitialisation de mot de passe, pas de changement d'établissement. Le bloc « Session »
  de la vue Compte ne sait que fermer la session.
- La session GoTrue reste en `localStorage` (aucune table de session).
- **Aucune sauvegarde ni restauration du registre** : ni export serveur, ni duplication entre
  appareils. C'est le manque le plus lourd pour un registre à valeur légale.

## 9. Écran de connexion

Le portail de connexion Supabase (`src/presentation/connexion.js`) prend tout l'écran tant
qu'aucune session GoTrue valide n'existe. **Il n'existe plus de sortie « sans compte »** :
c'est un passage obligé, même si le registre, lui, ne quitte jamais l'appareil (cf. §5).

| Entrée | Effet |
| --- | --- |
| `index.html?mode=serveur` | Sans effet : `'serveur'` est le seul mode. |
| `index.html?mode=local` | **Ne fait plus rien** — plus aucun code ne lit ce paramètre. |
| *(défaut)* | Mode serveur : `normaliserMode()` renvoie toujours `'serveur'`. |

> ⚠️ Ne pas confondre **hors-ligne** et **mode local**. Le service worker précache les assets,
> donc l'app s'ouvre sans réseau et lit son registre dans `localStorage` : le fonctionnement
> hors-ligne est réel et complet. Ce qui a disparu, c'est seulement le *commutateur* `?mode=local`
> qui servait à sauter le portail d'authentification.

**Séquence de démarrage (`js/patisserie/auth.js`)**

1. `supabase.hasSession()` est testé. Sans session → le portail s'affiche (e-mail, mot de
   passe, inscription possible avec `establishment_name`).
2. Session présente : `loadState()` restaure le **dernier établissement connu** (id + nom,
   relus depuis `localStorage`).
3. Première connexion d'un compte : `supabase.rpc('create_establishment', { p_name })`, puis
   `select('memberships')` (rôle + `establishment_id`), puis
   `select('establishments', { id })` pour le nom, et enfin `loadState(etabId, etabNom)`.
4. Le registre est alors lu **depuis `localStorage`**, pas depuis le serveur (cf. §5).
5. Déconnexion : `supabase.signOut()` + `supabase.effacerSession()`.

**Pièges connus**

- Le portail est un `<div>` plein écran (`z-index: var(--z-modal)`) inséré dans `.app` : il est
  **retiré du DOM** par `masquerConnexion()` (idempotent), pas simplement masqué. Pour tester
  l'UI en headless, il faut donc le retirer ou s'authentifier — `?mode=local` ne saute plus rien.
- Le mode subsiste sous deux noms dans `config.js` : `MODE_PERSISTANCE = 'serveur'` (ligne 62)
  et son alias gelé `MODES_PERSISTANCE` (ligne 68). Plusieurs guides citent encore le pluriel.


