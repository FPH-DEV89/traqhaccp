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
