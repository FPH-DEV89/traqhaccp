# TraqHACCP

Application PWA de traçabilité et gestion HACCP pour la restauration et les métiers de bouche, conçue selon les principes de la **Clean Architecture** (Architecture Propre).

## 🚀 Fonctionnalités
- **Relevés de températures** (enceintes froides, liaisons chaudes/froides)
- **Réception des marchandises** (contrôle à réception, non-conformités)
- **Plan de nettoyage & désinfection**
- **Traçabilité & DLC secondaire**
- **Mode hors-ligne (PWA)** avec synchronisation locale et Service Worker
- **Rapports & Audit** exportables

## 🧱 Architecture
Le projet suit une séparation stricte des responsabilités :
- `src/domain/` : Entités métier, règles HACCP, interfaces de dépôts et contrats.
- `src/usecases/` : Cas d'utilisation applicatifs (enregistrer un relevé, valider une conformité, etc.).
- `src/adapters/` : Contrôleurs, présentateurs et adaptateurs d'infrastructure (stockage local / IndexedDB).
- `src/infrastructure/` : Gestion du stockage persistant, Service Worker et synchronisation réseau.

## 🛠️ Utilisation
Ouvrez directement `index.html` dans un navigateur moderne ou déployez les fichiers sur un hébergeur statique (GitHub Pages, Netlify, Vercel).
