# Manuel Utilisateur — TraqHACCP Pro
## Guide de démarrage et d'utilisation pour les nouveaux utilisateurs & établissements

Bienvenue sur **TraqHACCP**, votre solution de gestion du Plan de Maîtrise Sanitaire (PMS) et registre sanitaire réglementaire conforme aux exigences européennes (Règlement CE 852/2004, Paquet Hygiène) et françaises.

Ce manuel vous accompagne pas à pas : de la **création de votre compte** et de votre premier établissement, jusqu'à la **prise en main quotidienne** des différents modules par votre brigade de cuisine.

---

## Sommaire

1. [Premiers pas : Accéder à l'application & Mode d'utilisation](#1-premiers-pas--accéder-à-lapplication--mode-dutilisation)
2. [Créer un compte et son établissement](#2-créer-un-compte-et-son-établissement)
3. [Configuration initiale essentielle](#3-configuration-initiale-essentielle)
   - [3.1 Compléter la fiche établissement](#31-compléter-la-fiche-établissement)
   - [3.2 Déclarer vos équipements de froid et chaud](#32-déclarer-vos-équipements-de-froid-et-chaud)
   - [3.3 Configurer votre brigade et attribuer les rôles](#33-configurer-votre-brigade-et-attribuer-les-rôles)
4. [Rôles et permissions](#4-rôles-et-permissions)
5. [Utilisation quotidienne : Les modules indispensables](#5-utilisation-quotidienne--les-modules-indispensables)
   - [5.1 Températures des enceintes (froid / chaud)](#51-températures-des-enceintes-froid--chaud)
   - [5.2 Réception des marchandises & livraisons](#52-réception-des-marchandises--livraisons)
   - [5.3 Traçabilité, étiquettes & DLC secondaires](#53-traçabilité-étiquettes--dlc-secondaires)
   - [5.4 Plan de nettoyage et désinfection](#54-plan-de-nettoyage-et-désinfection)
   - [5.5 Checklists d'ouverture et de fermeture](#55-checklists-douverture-et-de-fermeture)
   - [5.6 Huiles de friture (TPM)](#56-huiles-de-friture-tpm)
6. [Contrôles spécifiques & Gestion des écarts](#6-contrôles-spécifiques--gestion-des-écarts)
   - [6.1 Refroidissement rapide (63 °C → 10 °C en 2 h)](#61-refroidissement-rapide-63-c--10-c-en-2-h)
   - [6.2 Décongélation sécurisée](#62-décongélation-sécurisée)
   - [6.3 Allergènes (Règlement INCO - 14 allergènes)](#63-allergènes-règlement-inco---14-allergènes)
   - [6.4 Fiches de non-conformité et actions correctives](#64-fiches-de-non-conformité-et-actions-correctives)
7. [Contrôles officiels (DDPP / DDecPP / Services vétérinaires)](#7-contrôles-officiels-ddpp--ddecpp--services-vétérinaires)
   - [7.1 Le Mode Inspection sécurisé](#71-le-mode-inspection-sécurisé)
   - [7.2 Registre officiel et exports (PDF / CSV / JSON)](#72-registre-officiel-et-exports-pdf--csv--json)
8. [Installation sur tablette ou smartphone (PWA hors-ligne)](#8-installation-sur-tablette-ou-smartphone-pwa-hors-ligne)
9. [Sauvegardes et sécurité](#9-sauvegardes-et-sécurité)

---

## 1. Premiers pas : Accéder à l'application & Mode d'utilisation

TraqHACCP est accessible directement depuis votre navigateur web à l'adresse officielle :
👉 **https://traqhaccp.vercel.app/**

L'application propose deux modes de fonctionnement :
1. **Mode Serveur (Recommandé pour les équipes & multi-postes)** :
   Vos relevés sont synchronisés en temps réel et partagés entre tous les terminaux de l'établissement (tablettes de cuisine, smartphone du gérant, poste administratif).
2. **Mode Local (Hors-ligne / Sans compte)** :
   Toutes les données sont conservées uniquement dans le navigateur du terminal utilisé. Idéal pour tester sans inscription.

---

## 2. Créer un compte et son établissement

Pour démarrer avec le registre partagé :

1. Rendez-vous sur **TraqHACCP** (en mode connecté/serveur ou via le portail de connexion).
2. **Saisissez votre adresse e-mail et votre mot de passe**.
3. Lors de la première connexion avec une nouvelle adresse e-mail :
   - L'écran affiche automatiquement l'étape **« Créer mon établissement »**.
   - Saisissez la **Raison sociale / Nom commercial** de votre établissement (ex. *« Le Bistrot Gourmand »*, *« Boulangerie Saint-Honoré »*).
   - Cliquez sur **« Créer mon établissement »**.
4. Votre compte administrateur (**Gérant**) est immédiatement créé et votre établissement est initialisé.

> **Remarque :**
> En cas de coupure réseau, l'application reste accessible. Pour basculer à tout moment en mode local de secours, un lien *« Continuer sans compte (données locales) »* est disponible sur la fenêtre de connexion.

---

## 3. Configuration initiale essentielle

Dès votre arrivée sur l'interface, effectuez les 3 étapes de configuration suivantes avant le premier service :

### 3.1 Compléter la fiche établissement
1. Rendez-vous dans le menu **« Compte & Brigade »** (Module 16) dans la barre de navigation latérale.
2. Sous l'onglet **« Fiche établissement »**, cliquez sur **« Modifier »**.
3. Renseignez :
   - **Activité** (Restaurant traditionnel, Restauration rapide, Traiteur, Boulangerie, etc.),
   - **Numéro SIRET** (14 chiffres) et **Numéro d'agrément sanitaire ou de déclaration DDPP** (CERFA),
   - **Adresse complète**, e-mail et téléphone,
   - **Nom du responsable de la sécurité sanitaire**.
4. Cliquez sur **« Enregistrer »**. Ces informations apparaîtront légalement sur les exports officiels et les étiquettes de traçabilité.

### 3.2 Déclarer vos équipements de froid et chaud
1. Allez dans le menu **« Réglages »** (Module 17) > onglet **« Équipements »**.
2. Créez la liste de vos meubles froids et chauds (ex : *Chambre froide positive viandes*, *Frigo bar*, *Congélateur négatif*, *Bain-marie chaud*).
3. Pour chaque équipement, choisissez son type pour lui affecter automatiquement les plages de températures réglementaires :
   - **Froid positif viandes / produits très périssables** : 0 °C à +4 °C
   - **Froid positif fruits & légumes** : +2 °C à +6 °C
   - **Froid négatif / surgelés** : -18 °C à -24 °C
   - **Liaison chaude** : ≥ +63 °C

### 3.3 Configurer votre brigade et attribuer les rôles
Dans **« Compte & Brigade »** > onglet **« Utilisateurs »** :
- Ajoutez les membres de votre brigade (cuisiniers, plongeurs, commis, chefs de partie).
- Affectez à chacun un **Rôle** adapté (Gérant, Responsable, Opérateur).
- Attribuez un **code PIN** (4 chiffres) à chaque équipier si vous souhaitez sécuriser et fluidifier la signature des relevés en cuisine.
- Définissez l'opérateur en service d'un simple clic sur son profil.

---

## 4. Rôles et permissions

TraqHACCP applique une séparation stricte des droits pour garantir l'intégrité de votre registre sanitaire :

| Rôle | Profil type | Droits & Prérogatives |
|---|---|---|
| **Gérant** | Patron, Directeur, Chef propriétaire | **Accès total** : gestion des utilisateurs, validation des non-conformités, modification des seuils, export légal, sauvegarde et restauration. |
| **Responsable** | Chef de cuisine, Second, Responsable qualité | **Supervision opérationnelle** : gestion des équipements, saisie et signature des relevés, traitement des non-conformités, exports. *(Ne peut pas supprimer le dernier gérant ni réinitialiser le registre)*. |
| **Opérateur** | Cuisinier, Commis, Équipier | **Saisie terrain** : saisie des températures, réceptions, nettoyage, checklists et signature de ses actions. |
| **Lecture seule** | Direction de groupe, Comptabilité | Consultation des historiques et exports de rapports. |
| **Inspecteur** | Agent DDPP / DDecPP / Vétérinaire | Accès dédié en consultation pure sans modification possible des registres. |

---

## 5. Utilisation quotidienne : Les modules indispensables

### 5.1 Températures des enceintes (Module 02)
- Relevez les températures au moins **1 à 2 fois par jour** (à l'ouverture et avant le coup de feu).
- Cliquez sur l'équipement, saisissez la température observée.
- En cas de dépassement, une alerte visuelle s'affiche immédiatement et propose la création d'une action corrective.
- Signez le relevé avec votre identifiant ou code PIN.

### 5.2 Réception des marchandises & livraisons (Module 05)
- À chaque livraison fournisseur :
  - Renseignez le nom du fournisseur, le numéro de bon de livraison (BL).
  - Contrôlez la **température à cœur ou de surface du camion/colis**.
  - Vérifiez l'intégrité des emballages, les dates limites (DLC) et l'aspect des denrées.
  - Prenez une photo du bon de livraison directement avec la caméra de votre tablette.
  - En cas de marchandise impropre : **refus de livraison** notifié dans le registre.

### 5.3 Traçabilité, étiquettes & DLC secondaires (Module 04)
- **Déconditionnement ou fabrication interne** :
  - Choisissez le produit ou la préparation (ex : *Sauce au poivre maison*, *Découpe de volaille*).
  - L'application applique automatiquement la **DLC secondaire réglementaire** (J+1 pour préparations ultra-sensibles, J+2 pour viandes/poissons décongelés, J+3 standard).
  - Prenez en photo l'étiquette sanitaire d'origine (numéro de lot fournisseur, estampille sanitaire).
  - Imprimez ou enregistrez l'étiquette interne traçable.

### 5.4 Plan de nettoyage et désinfection (Module 03)
- Retrouvez les tâches planifiées selon leur fréquence : **quotidiennes**, **hebdomadaires**, **mensuelles** (pianos, hottes, sols, chambres froides, siphons).
- Cochez les tâches réalisées au cours du poste.
- Indiquez le produit utilisé et signez l'intervention.

### 5.5 Checklists d'ouverture et de fermeture (Module 06)
- Rituels de début et fin de service : contrôle visuel des locaux, vérification des lave-mains (savon, essuie-mains jetables), fermeture des vannes de gaz, évacuation des déchets.
- Validation en 1 clic pour consigner la conformité du poste.

### 5.6 Huiles de friture (Module 07)
- Mesurez le taux de composés polaires (TPM) à l'aide de votre testeur électronique :
  - **< 18 % TPM** : Huile saine et optimale.
  - **18 % à 24 % TPM** : Huile sous surveillance.
  - **≥ 25 % TPM** : **Seuil légal de rejet dépassé** (Arrêté du 11/10/2005) — vidange et remplacement obligatoires.
- Consignez la filtration ou le changement d'huile.

---

## 6. Contrôles spécifiques & Gestion des écarts

### 6.1 Refroidissement rapide (Module 09)
- Obligation réglementaire pour toute cuisson conservée pour un service ultérieur : passage de **+63 °C à +10 °C à cœur en moins de 2 heures**.
- Déclenchez le chronomètre dans l'application lors de l'enfournement en cellule de refroidissement.
- Validez la température finale avant transfert en chambre froide.

### 6.2 Décongélation sécurisée (Module 10)
- Toute décongélation doit obligatoirement avoir lieu en **enceinte réfrigérée (+4 °C max)**, jamais à température ambiante.
- Consommation sous **J+2 (48 h)** maximum.

### 6.3 Allergènes (Module 11 - Réglementation INCO)
- Matrice dynamique des **14 allergènes à déclaration obligatoire** (Gluten, Crustacés, Œufs, Poissons, Arachides, Soja, Lait, Fruits à coque, Céleri, Moutarde, Sésame, Sulfites, Lupin, Mollusques).
- Tenez à jour la liste des plats de votre carte avec les allergènes présents pour mise à disposition immédiate des clients et inspecteurs.

### 6.4 Fiches de non-conformité et actions correctives (Module 08)
- En cas de panne de frigo, livraison non conforme, corps étranger ou rupture de la chaîne du froid :
  - Ouvrez une **Fiche de Non-Conformité**.
  - Précisez la nature de l'écart et mesure immédiate (ex : *Destruction des denrées*, *Consigne*, *Renvoi au fournisseur*).
  - Suivez et clôturez l'incident avec signature du responsable.

---

## 7. Contrôles officiels (DDPP / DDecPP / Services vétérinaires)

En cas de contrôle inopiné des services sanitaires :

### 7.1 Le Mode Inspection sécurisé (Module 15)
- Cliquez sur **« Mode inspection »** dans le menu ou la barre de navigation.
- **Ce mode verrouille l'application en lecture seule stricte** :
  - L'inspecteur peut librement vérifier l'ensemble des historiques (températures, huiles, traçabilité, hygiène, non-conformités).
  - Aucun bouton de modification, de suppression ou de falsification n'est accessible.
  - Vous pouvez prêter votre tablette à l'agent de contrôle en toute sérénité.
  - La sortie du mode inspection est protégée.

### 7.2 Registre officiel et exports (Module 14)
- Générez en un instant le **rapport de contrôle consolidé** :
  - Synthèse PDF téléchargeable ou imprimable,
  - Export CSV / Excel pour les analyses comptables ou audits externes,
  - Archive complète sécurisée au format JSON.

---

## 8. Installation sur tablette ou smartphone (PWA hors-ligne)

TraqHACCP est une **Progressive Web App (PWA)**. Vous n'avez pas besoin de passer par un App Store :

- **Sur iPad / iPhone (Safari)** :
  1. Ouvrez https://traqhaccp.vercel.app/
  2. Cliquez sur l'icône de partage (carré avec flèche vers le haut).
  3. Sélectionnez **« Sur l'écran d'accueil »**.
- **Sur Tablette / Smartphone Android (Chrome)** :
  1. Ouvrez l'adresse.
  2. Cliquez sur les 3 points en haut à droite > **« Installer l'application »** (ou « Ajouter à l'écran d'accueil »).
- **Avantages** : Plein écran sans barre d'adresse de navigateur, icône dédiée sur l'accueil, démarrage instantané, fonctionnement hors-ligne garanti.

---

## 9. Sauvegardes et sécurité

- **Multi-postes / Serveur** : Vos données sont protégées dans le cloud sécurisé de l'établissement avec isolation étanche des données (Row-Level Security).
- **Mode Local** : Pensez à exporter régulièrement une sauvegarde JSON depuis **Réglages > Sauvegardes** pour parer à toute perte ou casse de votre tablette.
- **Raccourci pratique** : Appuyez sur `Ctrl + K` (ou `Cmd + K` sur Mac/iPad) pour ouvrir la palette de recherche rapide et sauter vers n'importe quel module en 1 seconde.

---

*TraqHACCP — Conforme aux exigences du Paquet Hygiène européen (Règlement CE 852/2004) et aux Bonnes Pratiques d'Hygiène en Restauration.*
