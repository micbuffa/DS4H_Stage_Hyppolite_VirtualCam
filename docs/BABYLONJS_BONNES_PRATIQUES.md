# Bonnes pratiques BabylonJS

Ce document guide la future implémentation. Les API citées sont des pistes vérifiées dans les sources officielles le 6 novembre 2026 ; vérifier leurs signatures avec les versions effectivement installées avant de coder.

## Projet et dépendances

- Employer les modules npm `@babylonjs/core` et `@babylonjs/gui` avec versions compatibles et fichier de verrouillage. Ajouter les loaders uniquement si des assets importés le nécessitent.
- Vérifier les imports nécessaires aux enregistrements et effets de bord pour la version choisie ; ne pas appliquer aveuglément une recette de tree shaking d'une autre version.
- Garder des caches Vite distincts pour le serveur interactif et les tests : les imports dynamiques des shaders ne doivent pas pointer vers des chunks supprimés par un autre prébundling.
- Ne déclarer le rendu prêt qu’après la préparation des shaders et une image complète ; gérer également les erreurs asynchrones de compilation et nettoyer les observateurs temporaires.
- Utiliser un seul moteur, une scène principale et une boucle de rendu. Brancher le redimensionnement, le ratio de pixels plafonné et l'arrêt dès le démarrage.
- Garder l'inspecteur et les diagnostics optionnels en développement ; ne pas les inclure systématiquement au démarrage.

## Repère, modèles et animation

- Fixer le repère gauche BabylonJS : Y vers le haut, scène vers +Z depuis le public, unités en mètres. Le document de spécification donne les dimensions initiales.
- Utiliser un `TransformNode` racine par ensemble thématique. Distinguer coordonnées locales et monde.
- Employer des quaternions cohérents pour les rotations de rigs ; éviter le mélange concurrent Euler/quaternion.
- Construire les musiciens et instruments avec primitives pour le socle. Partager géométries et matériaux quand possible ; les modèles GLB détaillés viendront ensuite si nécessaire.
- Piloter les animations avec le temps écoulé et une source de temps injectable ; plafonner les grands pas après retour d'un onglet masqué.
- Définir explicitement les objets sélectionnables ; décors et public ne doivent pas intercepter la sélection des caméras ou des boutons.

## Caméras et manipulation

- Réserver l'`ArcRotateCamera` d'observation à la navigation ; ne pas attacher les entrées utilisateur aux caméras de captation.
- Pour ZQSD/flèches, supprimer le plugin clavier orbital par défaut, lire les lettres via `event.key`, appliquer une translation horizontale relative au regard et normaliser les diagonales. Limiter le pas après une interruption, libérer les touches sur blur/onglet masqué et laisser Cmd/Ctrl/Alt aux raccourcis.
- Conserver le contrôle molette BabylonJS pour les défilements de trackpad à petits deltas ; son `preventDefault` empêche le défilement de la page dans le canvas. Le trackpad physique et les variantes Safari nécessitent une recette sur matériel réel.
- Attacher les gizmos aux représentations dédiées, jamais à un mesh choisi arbitrairement. Désactiver leur attachement automatique non filtré.
- Gérer explicitement le début et la fin d'un glissement, l'annulation, `pointercancel` et la perte de focus. Restaurer la navigation dans tous les cas.
- Valider les poses, le FOV et les plans de clipping dans le métier avant de les appliquer au moteur.
- Employer un FOV vertical en radians dans le moteur, présenté en degrés dans l'interface. Valider les conversions par tests.

## Flux vidéo sur surfaces 3D

- Employer une `RenderTargetTexture` par source effectivement diffusée, avec caméra de captation explicitement associée. L'enregistrer une seule fois dans le mécanisme de rendu retenu.
- Conserver la caméra d'observation pour la vue principale ; ne pas lui substituer la caméra sélectionnée pour produire un flux.
- Préparer une liste de rendu explicite incluant les objets filmables créés ultérieurement. Exclure toutes les surfaces vidéo pour empêcher les dépendances circulaires, ainsi que les aides et le panneau.
- Partager une RTT si plusieurs écrans diffusent la même caméra. Libérer le flux quand son dernier écran le quitte.
- Utiliser une surface vidéo émissive/non éclairée, sans teinte du matériau. Avec `StandardMaterial`, la couleur émissive constante s’ajoute à la texture : la mettre à noir pour une image non blanchie. Vérifier gamma, exposition et rendu des couleurs avec une mire ; ne pas corriger arbitrairement par des facteurs magiques.
- Fixer surfaces et RTT en 16:9 ; ne pas étirer les images. Tester une mire asymétrique pour détecter miroir, retournement UV et mauvais cadrage.
- Valider que le ratio de projection de chaque caméra de flux correspond à sa RTT, indépendamment du ratio du canvas. Éviter qu'une matrice de projection en cache conserve le ratio de la vue principale.
- Distinguer « prêt », « sans signal » et « erreur ». Une réaffectation ne montre pas un tampon GPU non initialisé : afficher le nouveau flux après son premier rendu valide.
- Ne pas utiliser les événements RTT de bind/unbind ou `onAfterRenderObservable` comme preuve de dessin : ils peuvent aussi venir des vérifications de disponibilité. Employer l’événement de dessin de `ObjectRenderer`, puis vérifier la disponibilité hors passe GPU. Si le renderer est fourni à la RTT, le libérer explicitement.

## Interface 3D et entrées

- Construire les contrôles spatiaux avec `GUI3DManager`, conteneurs et boutons 3D, ou une solution équivalente justifiée. Les boutons restent dans l'espace 3D ; le HUD 2D éventuel n'est qu'une aide.
- Définir la caméra de référence des couches utilitaires pour l'observation et vérifier l'absence des contrôles dans les flux.
- Le picking du panneau prime sur les rigs ; le drag de gizmo prime sur la navigation. Un événement consommé ne déclenche pas une seconde action métier.
- Les labels textuels complètent les couleurs pour sélection et diffusion. Prévoir un retour à la vue régie si le panneau quitte le champ.

## Performance et ressources

- Réutiliser matériaux et géométries ; instancier le public. Ne pas allouer vecteurs, matériaux ou meshes à chaque image sans nécessité.
- Commencer sans ombres pour le public et avec une seule source d'ombres pour la scène. Limiter les lumières affectant simultanément un matériau ; utiliser des faisceaux stylisés pour l'ambiance.
- Ne geler une matrice ou un matériau qu'après avoir vérifié que l'objet ne sera plus animé ou édité.
- Réduire d'abord résolution des RTT, densité du public et ombres si nécessaire ; mesurer avant d'optimiser.
- Identifier qui détruit chaque texture, matériau, mesh, gestionnaire GUI, gizmo et abonnement. Retirer les callbacks de rendu et les écouteurs DOM au démontage.
- Lancer les contrôles dans un vrai navigateur WebGL2. WebGPU constitue une évolution, pas un prérequis du prototype.

## Tests

- Tester les commandes et calculs en mémoire avec Vitest et des adaptateurs simulés ; pas de GPU pour les invariants métier.
- Utiliser `NullEngine` pour les assemblages de scène et cycles de vie compatibles. Injecter ou simuler les parties exigeant canvas, GUI ou GPU.
- Tester en navigateur le picking, les drags, les RTT, les couleurs, les ombres, le ratio et les couches utilitaires : un moteur sans GPU ne valide pas ces résultats.
- Rendre l'animation et le public déterministes pour les captures ; comparer avec une tolérance documentée et garder une recette humaine du rendu.

## Références officielles

- [Gizmos : attachement, rotations et couches utilitaires](https://doc.babylonjs.com/features/featuresDeepDive/mesh/gizmo).
- [GUI 3D : gestionnaire et contrôles dans l'espace](https://doc.babylonjs.com/features/featuresDeepDive/gui/gui3D).
- [API RenderTargetTexture](https://doc.babylonjs.com/typedoc/classes/BABYLON.RenderTargetTexture).
- [API Scene, dont customRenderTargets](https://doc.babylonjs.com/typedoc/classes/BABYLON.Scene).
- [Sources officielles du moteur NullEngine](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Engines/nullEngine.ts).

La stratégie de partage des flux et la séparation métier/moteur sont des choix de ce projet, fondés sur ces mécanismes ; elles ne constituent pas des prescriptions de BabylonJS.

### Coupes multiécrans et budget de rendu

Préparer une première image avant de modifier les textures des matériaux. Remplacer les références de tous les écrans ciblés entre deux images et conserver les anciennes ressources jusqu'à la première présentation réussie. En cas d'échec, restaurer l'affectation complète. La suppression d'un consommateur ne détruit pas un flux encore utilisé ailleurs.

Distinguer textures allouées et RTT programmées dans `scene.customRenderTargets`. Pour préparer une coupe depuis trois sources sans quatrième passe active, suspendre une source devenue inutile dans la prochaine table en conservant sa dernière image ; la reprendre si la préparation échoue. Le renderer possède et nettoie aussi les allocations partielles en cas d'échec GPU. Les écrans ne détruisent jamais les textures partagées.
