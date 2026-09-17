# Instructions pour l'assistant

## Automatisation Git (Push après correctif et vérifications)

Dès qu'un correctif, un bogue résolu ou une tâche demandée par l'utilisateur est terminé et validé :
1. **Validation & Gates locales** : Lancer systématiquement la suite de validation (`npm test`) pour garantir qu'aucune régression fonctionnelle ou HACCP n'est introduite.
2. **Statut Git** : Vérifier l'état du dépôt (`git status`).
3. **Indexation** : Ajouter les fichiers modifiés concernés (`git add <fichiers>`).
4. **Commit** : Créer un commit avec un message conventionnel clair et explicite (ex: `fix: ...`, `refactor: ...`, `feat: ...`).
5. **Push automatique** : Pousser immédiatement les commits sur la branche distante active (`git push origin <branche>`).
6. **Rapport** : Mentionner brièvement le hash du commit et la confirmation du push dans la réponse finale.
