# DATA.md — Socle de données TraqHACCP

Ce document décrit la couche de données serveur ajoutée en complément du mode local
(`localStorage`). **L'application reste utilisable sans compte** : le mode local est le
défaut, le mode serveur est opt-in.

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
| `local` (**défaut**) | `localStorage`, clés `traqhaccp_v2_*` | non |
| `serveur` | Supabase (PostgREST + GoTrue) | oui |

Le mode serveur ne remplace rien : `src/infrastructure/supabase_repository.js` expose
`SupabaseHACCPRepository`, qui implémente **la même interface** que
`LocalStorageHACCPRepository` (26 méthodes). Les vues n'ont pas été modifiées.

```js
import { SupabaseHACCPRepository } from './infrastructure/supabase_repository.js';
const repo = new SupabaseHACCPRepository({ onErreur: (e, t) => ui.toast(`${t} : ${e.message}`) });
await repo.client.signIn(email, motDePasse);   // GoTrue
await repo.hydrate();                          // charge l'établissement + les collections
repo.getEquipments();                          // synchrone : lecture depuis le cache hydraté
repo.saveEquipments(liste);                    // met à jour le cache puis écrit (Promise)
```

**Écart d'interface assumé** : les lectures restent synchrones (cache mémoire hydraté par
`hydrate()`), mais les écritures renvoient une `Promise` — le serveur est asynchrone et une
écriture peut être refusée par RLS. `onErreur` est appelé en cas de refus ; l'échec
n'interrompt jamais l'interface. `await repo.flush()` attend les écritures en attente.

## 6. Bootstrap d'un établissement

L'insertion directe d'un établissement est impossible : écrire exige de relire la ligne
(`return=representation`), ce qui exige une adhésion qui n'existe pas encore. Le
bootstrap passe donc par une fonction atomique :

```js
const id = await repo.creerEtablissement('Restaurant Le Port');
// create_establishment(nom) : crée l'établissement ET rattache l'appelant comme gerant
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
  réinitialisation de mot de passe, pas de changement d'établissement (le bloc « Session
  serveur » de la vue Compte ne sait que fermer la session).
- `getSession`/`saveSession` restent en `localStorage` (aucune table de session).
- `resetToDemo()` **refuse** de s'exécuter en mode serveur : un registre partagé réel ne se
  réinitialise pas comme une démo.

## 9. Écran de connexion (chantier 2, livré le 18/09/2026)

Le mode serveur est désormais **atteignable par l'écran**, sans rien changer au mode local.

**Comment on entre en mode serveur**

| Entrée | Effet |
| --- | --- |
| `index.html?mode=serveur` | Force + persiste le mode serveur (l'URL prime sur le stockage). |
| `index.html?mode=local` | Revient au mode local. |
| Réglages (bascule de mode) | Persiste le choix. |
| *(défaut)* | Mode local — comportement historique inchangé. |

**Séquence de démarrage (`boot()` dans `src/presentation/context.js`)**

1. `estModeServeur()` est faux → `createApp()` historique, aucun module Supabase chargé.
2. Sinon : `SupabaseHACCPRepository` est instancié, la session GoTrue est vérifiée
   (`verifierSession()` + `rafraichirSession()`), puis hydratée (`await hydrate()`).
3. Sans session valide, le **portail de connexion** (`src/presentation/connexion.js`) prend
   tout l'écran : e-mail, mot de passe, création d'établissement au premier compte, et une
   sortie « Continuer sans compte » qui repasse en local.
4. Une fois la session ouverte, `createApp(depotServeur)` est réétalé sur `app`
   (`Object.assign`) : **les 17 vues ne changent pas d'une ligne**, elles consomment le même
   contrat `store → useCases → repository`.
5. `session_serveur.js` ajoute le seul élément d'interface propre au mode serveur : un bloc
   « Session serveur » dans la vue Compte (identité connectée + « Se déconnecter »), vide en
   mode local. Sans lui, le portail serait définitivement hors d'atteinte après la 1re connexion.

**Pièges connus**

- Le paramètre `mode` de l'URL prime sur `localStorage` : tout choix explicite contraire doit
  appeler `retirerModeUrl()` (`config.js`) avant de recharger, sinon boucle sur le portail.
- Le portail est un `<div>` plein écran (`z-index: var(--z-modal)`) inséré dans `.app` : il est
  retiré du DOM (`masquerConnexion()`) et non simplement masqué.


