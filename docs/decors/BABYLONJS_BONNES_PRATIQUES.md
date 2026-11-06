# Bonnes pratiques BabylonJS

## Portée
Recommandations à adapter à la version installée et à l’architecture existante.
Référence consultée : https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene/
Les méthodes de test et les choix d’organisation ci-dessous sont des propositions de projet.

## Organisation et ressources
- Passer explicitement la scène aux fonctions de création ; éviter les variables globales.
- Utiliser TransformNode comme parent sans géométrie visible.
- Donner des noms lisibles et des identifiants métier stables ; ne pas exporter les identifiants internes du moteur.
- Séparer les constructeurs de modèles des commandes de l’éditeur.
- Détruire les observateurs, gizmos, scènes et ressources propriétaires ; protéger les ressources partagées.
- Gérer explicitement erreurs et annulations de chargement.

## Interactions
- Mapper les sous-maillages vers le décor parent lors de la sélection.
- Activer le picking seulement pour les objets concernés ; un faisceau décoratif ne doit pas intercepter la sélection.
- Ne pas désactiver globalement le picking si le déplacement à la souris en dépend.
- Arbitrer les événements entre caméra et gizmos ; traiter aussi la fin de geste hors canvas.
- Valider les transformations : nombres finis, échelles strictement positives dans les bornes du projet.

## Low-poly et performances
- Mesurer avant d’optimiser : triangles, draw calls, textures, mémoire et temps par image.
- Réutiliser géométries et matériaux ; envisager les instances pour le public et les éléments répétés.
- Garder une correspondance de sélection et une stratégie d’édition si des instances sont utilisées.
- Limiter transparences, ombres dynamiques et lumières coûteuses ; prévoir un profil de qualité.
- Faire des faisceaux une option visuelle légère ; leur présence ne remplace pas un SpotLight.
- Ne figer matrices et matériaux que pour les objets réellement statiques ; réactiver les mises à jour avant édition.
- Éviter un mode de performance global qui désactive implicitement le picking ou empêche les mises à jour nécessaires.
- Fixer les budgets sur le casque cible après mesure ; les performances PC ne suffisent pas.

## Matériaux et textures
- Mutualiser les matériaux inchangés ; isoler les propriétés lorsque l’utilisateur modifie un seul objet.
- Limiter dimensions et nombre de textures selon les budgets retenus.
- Conserver provenance, licence et références portables.
- Signaler une texture absente et fournir un remplacement visuel explicite.
- Ne pas modifier un matériau gelé sans gérer son dégel et sa remise à jour.

## Tests
- Couvrir par tests unitaires la validation des données et les commandes métier.
- Employer NullEngine pour les tests de construction et de nettoyage lorsque la version installée le permet.
- Utiliser des tests navigateur pour les interactions et de vraies vérifications visuelles pour les faisceaux, textures et cadrages.
- Tester la persistance après rechargement réel et l’export avec le loader réel.
- Vérifier la suppression répétée d’objets et l’absence de ressources ou observateurs résiduels.
- Consigner séparément résultats PC et casque ; ne pas déclarer un test exécuté lorsqu’il est seulement prévu.
