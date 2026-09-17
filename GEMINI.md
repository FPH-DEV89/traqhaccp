# Instructions pour l'assistant

## Automatisation Git (Push après correctif)

Dès qu'un correctif, un bogue résolu ou une tâche demandée par l'utilisateur est terminé et validé :
1. **Statut Git** : Vérifier l'état du dépôt (`git status`).
2. **Indexation** : Ajouter les fichiers modifiés concernés (`git add <fichiers>`).
3. **Commit** : Créer un commit avec un message conventionnel clair et explicite (ex: `fix: ...`, `refactor: ...`, `feat: ...`).
4. **Push automatique** : Pousser immédiatement les commits sur la branche distante active (`git push origin <branche>`).
5. **Rapport** : Mentionner brièvement le hash du commit et la confirmation du push dans la réponse finale.
