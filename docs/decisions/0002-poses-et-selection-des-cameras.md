# 0002 — Poses, sélection et représentations des caméras

Date : 6 novembre 2026. Statut : appliquée pour T04.

## Choix

Le domaine conserve les définitions des neuf caméras dans `CameraRegistry`. Une pose est une position monde en mètres et un quaternion normalisé (x, y, z, w), sans référence à BabylonJS. Les objectifs stockent le champ vertical en degrés et les plans de clipping en mètres. Les préréglages sont séparés des instances courantes et sont copiés pour empêcher les mutations involontaires.

Chaque caméra réelle est une `FreeCamera` sans entrées utilisateur, à position locale nulle sous un `TransformNode` portant la pose. La caméra conserve une rotation locale identité ; la transformation n'est appliquée qu'une fois. Les boîtiers héritent de cette même pose. Les labels suivent la position monde avec un décalage vertical et font face à l'observateur.

Le renderer s'abonne à l'état : sélection, pose, objectifs et aides. La sélection ne remplace jamais `scene.activeCamera` dans l'application et ne crée aucune cible de rendu. La réinitialisation restaure seulement le préréglage sélectionné. Le retour régie restaure uniquement l'observateur et annule ses offsets d'inertie.

## Visibilité et interactions

Les aides utilisent exclusivement le bit de couche 2. L'observateur affiche les bits 1 et 2 ; les caméras de captation affichent seulement le bit 1. Les meshes actuels du concert possèdent le bit 1 dans leur masque. À T05, une liste explicite de meshes filmables exclura également les trois surfaces vidéo pour prévenir les boucles de rendu ; les masques seuls ne remplacent pas cette liste.

Un unique volume filaire de sélection et son axe sont rattachés au rig sélectionné. Sa profondeur d'affichage vaut 5 m, son ratio 16:9 ; elle ne représente pas le plan lointain réel à 200 m. Le texte de l'interface le précise. La commande AIDES masque le volume et son axe, tandis que les boîtiers et labels restent disponibles pour sélectionner les caméras.

La sélection par raycast filtre uniquement les représentations des caméras, indépendamment des décors non sélectionnables. `onPrePointerObservable` consomme le geste avant les entrées orbitales : cliquer ou glisser depuis un boîtier ne fait pas pivoter l'observateur. Les autres gestes conservent la navigation. Le panneau 3D complet reste prévu à T08 ; T04 fournit des commandes 2D d'aide et de retour régie, ainsi que le picking des neuf labels/boîtiers.

## Validation

Les unitaires couvrent les IDs, la validation des poses/objectifs, la sélection, les copies, la réinitialisation et les commandes. L'intégration vérifie dix caméras au total, l'absence d'entrées sur les neuf sources, les transformations, le frustum unique, les masques et la destruction. Les tests navigateur sélectionnent les neuf labels, vérifient l'absence d'orbite pendant un geste de sélection, le retour régie après déplacement et orbite, et inspectent les neuf cadrages via une fixture réservée aux tests. Cette fixture peut activer une caméra de captation pour la recette ; elle ne change pas le comportement de l'application.

Références : [événements de scène](https://doc.babylonjs.com/features/featuresDeepDive/scene/interactWithScenes), [picking](https://doc.babylonjs.com/features/featuresDeepDive/mesh/interactions/picking_collisions), et signatures BabylonJS 9.34.0 installées.
