# Instructions pour l'assistant

## Automatisation Git (Push après correctif et vérifications)

Dès qu'un correctif, un bogue résolu ou une tâche demandée par l'utilisateur est terminé et validé :
1. **Validation & Gates locales** : Lancer systématiquement la suite de validation (`npm test`) pour garantir qu'aucune régression fonctionnelle ou HACCP n'est introduite.
2. **Actualisation du graphe d'architecture (Graphify)** : Lancer systématiquement `graphify update .` dès que du code a été modifié afin de maintenir la cartographie du projet à jour avec HEAD.
3. **Statut Git** : Vérifier l'état du dépôt (`git status`).
4. **Indexation** : Ajouter les fichiers modifiés concernés (`git add <fichiers>`).
5. **Commit** : Créer un commit avec un message conventionnel clair et explicite (ex: `fix: ...`, `refactor: ...`, `feat: ...`).
6. **Push automatique** : Pousser immédiatement les commits sur la branche distante active (`git push origin <branche>`).
7. **Rapport** : Mentionner brièvement le hash du commit et la confirmation du push dans la réponse finale.

## Publication (déploiement)

- **Une seule URL publique** : `https://traqhaccp.vercel.app/`.
- **Un seul projet Vercel** (`traqhaccp`) relié au dépôt. Ne jamais créer ni relier un
  second projet Vercel au même dépôt : chaque push déclencherait un déploiement de plus,
  donc une seconde URL susceptible de diverger au premier build qui échoue d'un côté.
- **Aucune URL d'origine codée en dur** : chemins relatifs uniquement dans `index.html`,
  `manifest.json`, `sw.js` et `vercel.json`.
- Après un push, vérifier qu'**un seul** déploiement de production a été déclenché.
