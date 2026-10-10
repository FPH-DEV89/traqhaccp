# Recette de la synchronisation

Preuve **de bout en bout** que le registre d'un poste arrive bien sur Supabase et se relit
depuis un autre poste. Les gates de `tools/` vérifient le contrat *statiquement* (structure du
code, précache, mapping) — ils ne voient pas un enchaînement asynchrone. Cette recette, elle,
exécute le vrai chemin : `state.js` → `saveState()` → `sync.js` → table `registry_records`.

⚠️ **Ce n'est pas un gate.** La recette exige le réseau et des identifiants : elle ne doit
jamais entrer dans `npm test` ni `npm run gate` (qui doivent rester hors-ligne et rapides).

## Ce qu'elle prouve

1. **Poste A** (contexte navigateur 1) — un relevé saisi par le vrai chemin part vers le
   serveur : la ligne est relue dans `registry_records` avec la clé de service (bon
   établissement, bonne `collection`/`record_id`, payload attendu, auteur posé par le
   déclencheur, `deleted = false`).
2. **Poste B** (contexte navigateur 2, aucune donnée locale) — après connexion du même
   compte, le relevé écrit par A est **relu depuis le serveur**.

## Prérequis

- Le projet Supabase **réel** et ses clés : `/opt/data/.env.supabase-traqhaccp`
  (noms attendus lus par `provisionner.py` : URL du projet, clé anon, clé de service).
- Playwright **non déclaré dans ce dépôt** : il vit dans `/opt/data/node_modules`. Les
  scripts doivent donc s'exécuter avec un cwd sous `/opt/data` (Node remonte l'arborescence
  depuis le dossier du script, pas depuis `/tmp`) et avec
  `PLAYWRIGHT_BROWSERS_PATH=/opt/data/.pw-browsers`.

## Lancement

```bash
npm run recette:provisionner   # utilisateur + établissement de test dédiés
npm run recette:sync           # la recette elle-même (2 contextes)
```

`provisionner.py` crée l'utilisateur via l'API admin (e-mail déjà confirmé), l'établissement
et l'adhésion `gerant` (sans elle, l'écriture est refusée par RLS). Il **n'imprime aucun
secret** : le mot de passe de test est généré à la volée et écrit dans
`/tmp/e2e-sync/identifiants.json` (mode 0600), que la recette relit. Jamais un compte réel —
toujours cet établissement de test jetable.

## Pièges (payés une fois)

- **Le service worker recharge la page.** À la première visite, `index.html` enregistre
  `sw.js`, qui s'active et recharge l'onglet. Toute action lancée sans attendre
  `navigator.serviceWorker.controller` est tuée en vol : le script échoue alors *sans raison
  apparente* (la session n'est « pas reconnue »). D'où `stabiliser()` en tête de chaque
  navigation.
- **L'envoi est différé.** `viderFile()` déclenche d'abord le minuteur en attente ; c'est ce
  défaut-là que la recette a mis au jour le 25/09/2026 (corrigé depuis, verrouillé par
  `tools/check-sync-contract.mjs`).
- **Deux postes = deux contextes**, pas deux onglets : le registre vit dans `localStorage`,
  qui est partagé entre les onglets d'un même contexte. Un onglet ne prouverait rien.

## Recette « compte client réel » (`recette:client`)

Prouve qu'un **compte client réel** se connecte sur un **profil navigateur vierge**, adopte
son établissement et relit l'intégralité de ses données depuis Supabase — **sans jamais connaître
ni modifier son mot de passe**, et en **lecture seule stricte** (aucune écriture dans les tables
ni dans le registre local).

C'est cette recette qui comble l'angle mort de l'incident du 08/10/2026 : `recette:sync` valide le
code de synchronisation sur un banc jetable, mais ne prouve pas que le compte réel d'un client
retrouve ses vraies données dans son établissement de production.

### Ce qu'elle prouve

1. **Connexion par lien magique admin** : génération d'un jeton GoTrue via l'API d'administration
   (`POST /auth/v1/admin/generate_link`), puis échange dans Playwright contre une session cliente
   complète (`access_token`, `refresh_token`, `user`, `expires_at`). Aucun mot de passe manipulé.
2. **Profil navigateur vierge** : contexte totalement isolé (`localStorage` vide), injection
   exclusive de la session avant chargement de la page via `addInitScript()`.
3. **Adoption de l'établissement** : l'app passe de `'serveur'` à l'identifiant réel de
   l'établissement gérant du client (vérifié côté serveur dans `memberships`).
4. **Indicateur d'état actif** : le badge `#badge-sauvegarde` dans l'en-tête reflète l'état serveur
   (« Sauvegardé ») et n'est pas en mode « Local seulement ».
5. **Relecture croisée des données (local ≥ serveur)** : pour chaque collection de données
   (`lots`, `recipes`, `secondaryDlcs`, `witnessSamples`, `salesHistory`, `teamMembers`), le nombre
   d'enregistrements dans l'app est comparé aux lignes actives (`deleted = false`) de la table
   `registry_records` sur Supabase. Le local doit être **≥ au serveur** (un « moins » révélerait
   des données serveur non relues).
6. **Absence de bavure** : 0 requête réseau échouée, 0 erreur console et capture d'écran finale
   enregistrée dans `/tmp/e2e-sync/client-<horodatage>.png`.

### Lancement

```bash
# Serveur local actif (ex: npm run serve)
npm run recette:client

# Avec arguments personnalisés :
PLAYWRIGHT_BROWSERS_PATH=/opt/data/.pw-browsers node tools/recette-sync/recette-client.mjs --email manon@lesartssucres.fr --url http://127.0.0.1:8899/index.html
```

Variables d'environnement acceptées : `CLIENT_EMAIL` (défaut : `manon@lesartssucres.fr`), `APP_URL`
(défaut : `http://127.0.0.1:8899/index.html`).

### Pièges (propres au compte réel)

- **Pas d'écriture sur le compte client.** Contrairement au banc jetable, la recette est en lecture
  seule pure : aucun enregistrement créé, aucun `saveState()`, pas d'adhésion touchée.
- **Le service worker recharge au premier chargement.** `addInitScript()` garantit que la session
  persiste même si l'activation du worker recharge l'onglet. `stabiliser()` laisse le contrôleur
  s'installer avant les assertions.
- **Secrets masqués.** Aucun jeton d'accès, jeton haché ou corps de session GoTrue n'est affiché
  dans les journaux de test.

