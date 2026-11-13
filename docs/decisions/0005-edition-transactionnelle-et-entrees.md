# 0005 — Édition transactionnelle et arbitrage des entrées

Date : 6 novembre 2026. Statut : adopté à T07.

## Décision

Réutiliser `PositionGizmo` et `RotationGizmo` de BabylonJS 9.34.0, sur une `UtilityLayerRenderer` possédée par l'éditeur et explicitement associée à la caméra d'observation. Attacher uniquement l'outil actif au rig sélectionné ; translation monde, rotation locale. Les sources de captation n'ont aucune entrée et leur liste de rendu ne contient jamais cette couche.

Le métier reste autoritaire : le gizmo fournit une pose candidate, l'application valide ses coordonnées/quaternion et écrête les déplacements avant projection dans le rig et ses écrans. Le FOV vertical est présenté en degrés, converti en radians pour BabylonJS et limité à 20–90°. Les quaternions invalides et valeurs non finies sont rejetés. Une transaction conserve la définition avant glissement pour restaurer exactement la pose en cas d'annulation. Les changements de sélection ou d'outil annulent un geste actif. Les commandes FOV/visée/réinitialisation ne changent aucune route.

Suspendre explicitement les entrées orbitales et vider l'inertie pendant le geste. Le clavier est bloqué et ses touches mémorisées sont vidées pendant cette période. Désactiver l'automatisme `detachCameraControls` des comportements natifs afin de centraliser la restauration dans le port de navigation. Ne pas appeler `canvas.blur()` pour suspendre : le système de périphériques BabylonJS transforme ce blur en relâchement de bouton, ce qui interrompait immédiatement le geste dans la première recette WebGL. Un test de non-régression vérifie l'absence de blur lors de la suspension.

Écouter les interruptions de focus et de pointeur en capture, avant les handlers natifs susceptibles de synthétiser un pointer-up. Annuler sur Échap, blur du canvas/de la fenêtre, onglet masqué, pointercancel ou perte de capture. Après annulation, libérer aussi le comportement de drag natif afin qu'un mouvement ultérieur ne réapplique pas une pose abandonnée. Le relâchement normal valide la transaction ; Échap sans geste quitte l'outil.

## Validation

Tests purs de contraintes et de transactions, de changement de sélection, de restauration après erreur et d'arbitrage du clavier. Intégration native pour attachement, pose parentée sans double transformation, FOV/frustum, destruction de la couche. Tests navigateur pour les glissements réels des trois axes et anneaux, les interruptions, le retour à la navigation et les images GPU partagées. Les fixtures calculent uniquement des coordonnées de picking ; elles ne simulent pas les notifications de drag.
