# 0005 - Atelier de décors expérimental
Date : 12 novembre 2026.

## Contexte et décision
Aya demande un premier résultat démontrable. Créer /decors.html dans le laboratoire, sur aya-scene-et-decore.
Réutiliser les factories de plateau et musiciens sans modifier les commandes de régie.
Un panneau HTML est retenu pour l’édition sur ordinateur ; il ne remplace pas le panneau de régie 3D de la spécification caméras.

## Modules
- src/domain/decors : document et validation sans DOM ni BabylonJS.
- src/application/ports/decorRenderer.ts : contrat de manipulation.
- src/infrastructure/babylon/models : factories thématiques.
- src/infrastructure/babylon/engine/createDecorRuntime.ts : assemblage et cycle de vie.
- src/infrastructure/persistence/decorStorage.ts : stockage local isolé.
- src/app/createDecorEditor.ts : coordination de l’interface.

## Contrat provisoire
JSON aya-decors version 1 : préréglage, finition et objets procéduraux avec identifiant, type, position, rotation, échelle, couleur et paramètres de spot.
Mètres, Y vertical, scène vers +Z ; rotations Euler en radians traduites en quaternions dans le moteur.
Ce format ne contient pas de graphe WAM et n’est compatible qu’avec cet atelier tant que le loader cible n’a pas été validé.

## Performance et ressources
Public statique : 60 spectateurs par instances. Les groupes statiques sont fusionnés par matériau dans l’atelier seulement, afin de réduire les appels de rendu.
Le plateau et les musiciens ne sont pas éditables individuellement dans ce prototype ; les décors ajoutés restent indépendants.
Faisceaux transparents stylisés distincts des SpotLight. Plafond de 30 images/s : réglage, pas mesure ni validation Quest.
Les groupes possèdent leurs matériaux et les détruisent à la suppression.

## Limites
Le lieu d’intégration définitif doit être confirmé avec l’encadrant. Les tâches T00-T11 du laboratoire restent inchangées.
Ce prototype ne clôt pas toutes les tâches Decors.md. Textures externes, ports WAM, édition immersive et coédition restent futurs.
