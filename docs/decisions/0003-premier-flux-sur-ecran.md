# 0003 — Premier flux de captation sur une surface 3D

Date : 6 novembre 2026. Statut : appliquée pour T05.

## Composition et propriété

`createConcertScene` fournit des références explicites à la scène, l'observateur et aux groupes thématiques, dont les trois écrans. La fonction `createObservationScene` reste un raccourci vers la scène de base pour les recettes sans diffusion. Le runtime assemble ces références avec le registre des caméras ; il ne retrouve pas des meshes arbitrairement par leur nom.

`createCameraFeed` possède un `ObjectRenderer` et une `RenderTargetTexture` de 1024 × 576. C1 est sa caméra explicite ; une seule inscription dans `scene.customRenderTargets` déclenche une passe par image. Le matériau d'écran utilise cette texture en émissif : `StandardMaterial` ne programme pas automatiquement les cibles employées comme texture émissive. Aucun appel manuel à `texture.render()` n'est ajouté dans la boucle principale.

Le renderer de flux possède sa liste de meshes, réutilisée et actualisée avant chaque image. La règle pure `isFilmable` accepte uniquement la catégorie `concert` et refuse notamment toutes les catégories de surfaces vidéo, de caméras et d'interface. Les cadres des écrans restent filmables ; les trois surfaces vidéo sont exclues, même lorsqu'elles montrent encore une mire. Le contrôle des couches reste activé en complément. Particules et sprites ne sont pas inclus implicitement.

## Projection et couleurs

La taille de la RTT est fixe et 16:9 ; `doNotChangeAspectRatio: false` est configuré à la fois sur le renderer et la RTT. Babylon recalcule la projection dans le framebuffer de captation. Aucune matrice n'est figée et aucun changement de `scene.activeCamera` n'est réalisé manuellement par le code du projet pour produire le flux ; le moteur effectue sa substitution interne puis restaure l'observateur.

Le matériau d'écran garde une couleur diffuse noire, une couleur émissive constante noire et un éclairage désactivé. Le flux est échantillonné en bilinéaire, sans mipmaps. Aucun facteur de correction de couleur empirique n'est appliqué. Les couleurs de la mire sont vérifiées dans le pipeline actuel ; tout futur changement d'exposition ou de traitement d'image nécessitera une nouvelle recette.

## Première image et démontage

Les simples événements RTT `onBeforeRender`, `onAfterRender` et d'unbind peuvent aussi être émis lors des vérifications de disponibilité. Ils ne prouvent pas qu'une image a été dessinée. Le gestionnaire s'appuie donc sur l'événement public `ObjectRenderer.onAfterRenderingManagerRenderObservable` pour constater une passe réelle, puis vérifie la disponibilité complète hors de la passe GPU.

La commande pure `bindPreparedFeed` conserve la texture précédente jusqu'à cette première image. Après liaison, `createFirstScreenFeed` attend une image principale prête avec le nouveau matériau avant d'annoncer le direct. Les erreurs asynchrones restent remontées au statut principal. Le runtime attend à la fois la scène et la présentation du flux.

La liaison restaure la texture précédente au démontage si elle possède encore l'affectation courante. Elle libère ensuite son flux ; le gestionnaire retire la RTT de la scène, ses observateurs, la texture et son renderer externe. Le renderer externe doit être détruit explicitement puisque la RTT n'en est pas propriétaire. Les textures des mires restent détenues par le groupe d'écrans.

## Portée et validation

T05 fixe la route C1 → écran 1. La sélection et les mires des écrans 2/3 sont indépendantes. Le partage entre plusieurs écrans et les changements de route atomiques seront introduits à T06.

Les tests purs couvrent le filtre, la résolution et la liaison différée avec erreurs et démontage. L'intégration vérifie les références de caméra, la liste et son actualisation, l'inscription unique et la libération. Les tests GPU vérifient la mire, les valeurs RGBA, la projection après redimensionnement, le nombre réel de passes, les objets ajoutés après démarrage, le mouvement visible et le retour à la mire après arrêt.

Références : [RenderTargetTexture](https://doc.babylonjs.com/typedoc/classes/BABYLON.RenderTargetTexture), [cibles de rendu de scène](https://doc.babylonjs.com/typedoc/classes/BABYLON.Scene), et signatures/sources de `ObjectRenderer` et `StandardMaterial` dans BabylonJS 9.34.0 installé.
