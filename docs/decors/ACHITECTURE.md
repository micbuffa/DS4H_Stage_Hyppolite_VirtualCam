# Architecture proposée

Nom conservé selon la demande : ACHITECTURE.md.
Statut : proposition à adapter après lecture du code existant, sans déplacement de fichiers à ce stade.

L’architecture racine ../../ARCHITECTURE.md reste la référence du laboratoire. L’arborescence ci-dessous est une proposition pour l’éditeur de décors, à rapprocher de l’existant avant toute implémentation ; elle n’impose pas un second découpage concurrent.

## Principes
Le projet doit être clairement architecturé. Chaque responsabilité doit avoir des fichiers séparés ; les modèles sont regroupés dans des dossiers thématiques.
Préserver les conventions TypeScript et les points d’entrée existants. Éviter une scène monolithique contenant l’interface, les modèles et la sauvegarde.

## Organisation indicative
- docs/ : décisions, format d’échange, protocole de validation.
- src/domain/ : descriptions de décors, transformations, paramètres, ports et validation ; sans dépendance au DOM ou à BabylonJS.
- src/catalog/ : définitions des modèles et variantes.
- src/models/stages/ : plateaux et escaliers.
- src/models/screens/ : écrans.
- src/models/lighting/ : spots, supports, faisceaux.
- src/models/audio/ : enceintes et cabines.
- src/models/performers/ : musiciens et instruments.
- src/models/audience/ : public.
- src/rendering/ : scène, caméra, moteur, matériaux, registre objets/maillages et profils de qualité.
- src/editor/ : sélection, commandes de transformation et état d’édition.
- src/ui/ : catalogue, inspecteur et dialogues.
- src/persistence/ : stockage local, validation et migrations.
- src/integration/wam-jam/ : contrat d’export et adaptateur du loader cible.
- assets/ : modèles et textures avec manifeste de licences.
- test/unit/, test/integration/, test/fixtures/ : tests selon les conventions existantes.

Cette arborescence décrit des responsabilités, pas une réécriture obligatoire de l’éditeur.

## Flux de données
L’interface émet une commande ; le domaine valide puis met à jour le document.
Le rendu traduit ce document en objets BabylonJS. Le picking remonte un identifiant métier.
La sauvegarde sérialise le document, pas les objets internes du moteur.
L’export passe par un adaptateur dédié pour ne pas coupler l’éditeur au loader cible.

## Contrat des objets
Chaque décor possède un identifiant stable, un type de catalogue, une transformation locale, des paramètres et des références de ressources.
Les objets composés utilisent une racine commune pour déplacer ensemble leurs sous-éléments.
Les ports sont décrits par identifiant, type, sens et transformation locale.
Le document possède une version de schéma. Les unités, axes et conventions de rotation doivent être choisis et documentés avant le premier export.

## Responsabilité des ressources
Le moteur appartient à l’application ; les scènes, observateurs, gizmos et objets ont un propriétaire explicite.
Matériaux et textures partagés passent par un registre avec gestion de durée de vie.
Supprimer un décor ne doit pas détruire une ressource encore utilisée par un autre.
Chargements asynchrones annulés ou devenus obsolètes ne doivent pas réintroduire d’objets supprimés.

## Intégration et décisions ouvertes
Points à confirmer : dépôt principal, version BabylonJS, framework de tests, format réel du loader, résolution des ressources, contraintes des ports WAM, stockage des textures et budgets Quest.
Documenter chaque décision avec son contexte et son impact ; ne pas créer de loader incompatible à partir d’une hypothèse.
