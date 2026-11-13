# Architecture du laboratoire de caméras virtuelles

Statut : architecture cible, mise en place progressivement à partir de T01.

## Principes obligatoires

Le projet doit être clairement architecturé : fichiers séparés par responsabilité, dossiers regroupant les modèles thématiques, dépendances explicites et ressources maîtrisées. Le fichier principal assemble les composants ; il ne construit pas tout le concert et ne contient pas les règles de réalisation.

Le choix proposé est TypeScript strict avec Vite, BabylonJS modulaire, Vitest pour les tests unitaires et Playwright pour les parcours navigateur. Ces outils sont installés depuis T01, avec des versions compatibles verrouillées.

## Arborescence cible

```text
AGENTS.md
CLAUDE.md
GEMINI.md
CAMERAS_VIRTUELLES_SPEC.md
ARCHITECTURE.md
docs/
  BABYLONJS_BONNES_PRATIQUES.md
  decisions/                     décisions techniques motivées
  validation/                    recettes, captures et mesures
public/assets/
  stage/                         décors et structures
  musicians/                     personnages
  instruments/                   instruments et accessoires
  audience/                      ressources du public
  lighting/                      textures des éclairages
  licenses/                      provenance et licences
src/
  main.ts                        démarrage et arrêt uniquement
  app/                           composition, configuration, cycle de vie
  domain/
    cameras/                     identifiants, poses, objectifs, contraintes
    screens/                     identifiants et affectations
    direction/                   état et commandes de réalisation
    concert/                     descriptions des éléments du concert
  application/
    commands/                    sélectionner, déplacer, diffuser, réinitialiser
    ports/                       contrats de rendu et d'interaction
  infrastructure/
    babylon/
      engine/                    création moteur/scène, resize, disposal
      cameras/                   observer, rigs, représentation des caméras
      rendering/                 flux RTT, listes de rendu, matériaux d'écrans
      interaction/               picking, gizmos, arbitrage des entrées
      models/
        stage/                   factories du plateau et des structures
        musicians/               factories des personnages et animations
        instruments/             factories guitare, basse, batterie, micros
        audience/                factories et instances du public
        lighting/                factories et animation des lumières
        screens/                 géométrie des écrans
      ui/                        panneau 3D, labels, retour d'état
    persistence/                 extension facultative, hors socle
  shared/                        utilitaires réellement transversaux
tests/
  unit/                          logique pure et adaptateurs isolés
  integration/babylon/           assemblages sous NullEngine
  e2e/                           navigateur, interactions et rendu
```

Les chemins ci-dessus sont une cible, pas une invitation à créer des dossiers vides. Chaque modèle procédural a sa factory et sa configuration dans son thème ; chaque fichier reste centré sur une responsabilité. Le dossier `shared` ne doit pas devenir un dépôt de logique sans propriétaire.

## Frontières et sens des dépendances

- `domain` ne dépend ni de BabylonJS, ni du DOM, ni de l'interface. Positions, rotations et réglages y sont des données sérialisables.
- `application` dépend de `domain` et de ports ; elle orchestre les commandes et la validation sans créer de mesh.
- `infrastructure` implémente les ports et traduit les données en objets BabylonJS.
- `app` compose les implémentations concrètes ; l'interface invoque les commandes et observe leurs résultats.
- Aucun import circulaire ; pas de singleton global exposant moteur, scène et état à tous les modules.
- État métier autoritaire unique ; les meshes et boutons en sont des projections. Pendant un glissement, une pose candidate est validée puis propagée, sans boucle d'événements entre gizmo et état.

## Modèles et contrats

| Modèle / port | Responsabilité |
| --- | --- |
| CameraDefinition | ID, nom, pose, FOV vertical, clipping, cible facultative |
| ScreenDefinition | ID, nom, emplacement, format 16:9 |
| DirectorState | caméra sélectionnée, ensemble d'écrans cibles, affectation par écran, mode d'édition |
| CameraRegistry | neuf définitions et leurs poses initiales |
| ScreenRouting | validation et application atomique des affectations |
| CameraRenderPort | projection des poses et des paramètres dans les caméras BabylonJS |
| ScreenRenderPort | acquisition, partage et libération des flux par caméra |
| InteractionPort | sélection et gestes traduits en commandes |
| SceneElementFactory | création d'un thème, racine de transformation et destruction associée |

Les contrats détaillés seront écrits à leur étape, avec tests associés, avant leurs implémentations. Aucune méthode d'un autre thème ne doit être atteinte en recherchant arbitrairement un mesh par son nom.

## Organisation du rendu

Une scène de concert et une caméra d'observation contrôlent la vue principale. Les neuf caméras de captation restent indépendantes des entrées de navigation. Une représentation manipulable porte la pose de chacune ; la caméra réelle se synchronise avec elle sans transformation appliquée deux fois.

Le gestionnaire de flux possède au maximum une `RenderTargetTexture` par caméra actuellement diffusée. Plusieurs écrans réutilisent cette texture. Avec trois écrans, au plus trois flux distincts sont rendus simultanément. La sélection d'une caméra ne crée pas de flux.

Les listes de rendu des flux contiennent uniquement le concert filmable. Elles excluent les surfaces vidéo des trois écrans, le panneau de régie, les représentations des caméras, les frustums et les gizmos. Les couches utilitaires sont configurées pour la vue d'observation ; leur exclusion est également vérifiée dans le navigateur. Cette règle évite les boucles de rendu et les accessoires visibles à l'antenne.

## Propriété et destruction

L'application possède moteur et scène. Chaque thème possède ses nœuds et observateurs. Le gestionnaire de flux possède les RTT partagées et compte leurs consommateurs ; les écrans possèdent leurs matériaux, sans détruire une texture partagée. L'interface possède son gestionnaire GUI ; l'éditeur possède ses gizmos et ses abonnements.

Une réaffectation met à jour l'état et les consommateurs ; une RTT sans consommateur est retirée des cibles actives puis libérée. La dernière libération d'un flux ne doit pas intervenir pendant une passe GPU en cours : différer au point sûr de la boucle de rendu. L'arrêt est idempotent ; aucun callback, contrôle de caméra ou événement DOM ne reste actif.

## Évolution et décisions

Conserver le socle sans backend. La sauvegarde locale, les déplacements automatiques et les transitions sont des extensions séparées. Une modification des frontières, du pipeline de rendu ou du format de pose nécessite une décision courte dans `docs/decisions/`, accompagnée des conséquences pour les tests.

## Mise en place à T02

Les dimensions et emplacements sont regroupés dans `src/domain/concert/concertLayout.ts`, les contraintes des écrans dans `src/domain/screens/screenDefinition.ts`. Les groupes `models/stage` et `models/screens` construisent et libèrent leurs ressources ; `models/modelGroup.ts` porte leur propriété commune. Les surfaces vidéo ont la catégorie `video-surface`, distincte des cadres `concert`, pour préparer les exclusions des futurs flux.

La translation ZQSD/flèches sépare le calcul pur (`domain/cameras/observerMovement.ts`) de l'adaptateur d'événements et d'animation (`infrastructure/babylon/interaction/attachObserverKeyboard.ts`). Le clavier orbital BabylonJS est retiré afin d'éviter deux actions sur les flèches. La molette et les événements de trackpad restent gérés par le contrôle BabylonJS existant. La grille temporaire de T01 a été retirée.

## Mise en place à T03

`domain/concert/bandLayout.ts` décrit les quatre rôles, leurs instruments, leurs poses et les ancrages locaux. Les poses sont validées sur le plateau ou l'estrade ; les coordonnées monde peuvent être calculées sans BabylonJS. La description de l'estrade est partagée avec la factory de scène pour éviter des hauteurs divergentes.

`models/musicians/createBand.ts` assemble quatre groupes indépendants construits par `createMusician.ts`. Chaque groupe possède ses matériaux, son personnage et les instruments qui lui sont parentés. Les factories de guitare/basse, batterie, micro et amplificateur vivent dans `models/instruments/` et reçoivent les matériaux du propriétaire. Elles ne détruisent pas les matériaux partagés au sein du musicien. Supprimer un musicien supprime tous ses éléments ; supprimer le groupe libère les quatre propriétaires de façon idempotente.

`models/modelGeometry.ts` regroupe les primitives utilisées par ces modèles, en conservant leur catégorie filmable et leur thème. Aucun mesh musical n'intercepte le picking. Les poses sont statiques à T03 ; l'animation reste prévue à T10.

Une fixture navigateur dans `tests/e2e/fixtures/` utilise la scène de production avec un cadrage fixe pour la recette rapprochée, sans interface de diagnostic ni globale ajoutée à l'application. Elle ne constitue pas une entrée du build de production.

## Préparation asynchrone et serveurs de développement

Le port `RenderRuntime` expose `whenReady(): Promise<void>`. La composition renvoie cette disponibilité via `app.ready`, libère le runtime en cas d'échec et conserve la cause technique. Le point d'entrée traite l'erreur et ne présente le statut prêt qu'après une image complète. `watchSceneReadiness.ts` possède les observateurs de démarrage et les retire à la résolution, au rejet ou au démontage.

Les caches Vite du développement, des unitaires et des tests navigateur sont distincts. Voir [la décision 0001](docs/decisions/0001-vite-cache-et-preparation-du-rendu.md) pour le défaut observé, les choix et le scénario de non-régression à deux serveurs.

## Mise en place à T04

Le domaine `cameras/` contient les définitions sérialisables, neuf préréglages, leur registre et le calcul du frustum. `CameraRegistry` possède la sélection, les poses et la visibilité des aides ; ses abonnements projettent cet état vers le rendu et l'aide HTML. La pose de régie est également une configuration pure (`observerView.ts`).

`createBabylonRuntime.ts` assemble la scène de concert et son observateur, puis le registre, `createCaptureCameras.ts` et `attachCameraControls.ts`. La factory de scène de base reste utilisable sans les représentations pour les recettes du concert. Les caméras de captation sont parentées aux rigs et ne reçoivent aucune entrée utilisateur. Le point de vue principal ne change pas lors d'une sélection.

Le renderer possède les boîtiers, labels, textures et le frustum unique ; l'adaptateur d'interaction possède le picking, les raccourcis et les abonnements aux boutons. Leur destruction est appelée par le runtime et reste idempotente. Les helpers utilisent le bit de couche 2, les caméras de captation uniquement le bit 1. Les détails du contrat sont décrits dans [la décision 0002](docs/decisions/0002-poses-et-selection-des-cameras.md).

## Mise en place à T05

`createConcertScene` expose les références des écrans et groupes thématiques ; le raccourci `createObservationScene` conserve les recettes de scène de base. Le runtime branche directement le handle de C1 sur celui de l'écran gauche, sans recherche par nom de mesh.

`domain/rendering/cameraFeed.ts` valide les dimensions et définit la règle des catégories filmables. Les ports génériques `CameraFeedPort` et `ScreenTexturePort`, ainsi que `bindPreparedFeed`, isolent la liaison différée de BabylonJS. L'adaptateur `rendering/createCameraFeed.ts` possède le renderer, la RTT, sa liste réutilisée et ses observateurs ; `createFirstScreenFeed.ts` assemble la liaison et attend sa première présentation.

La route est fixe C1 → écran 1 à cette étape. Le partage entre consommateurs et les routes interactives restent à T06. La disponibilité d'une image réelle est distinguée des contrôles de disponibilité du moteur, comme décrit dans [la décision 0003](docs/decisions/0003-premier-flux-sur-ecran.md).

## Mise en place à T06

`domain/direction/screenRouting.ts` calcule une nouvelle table complète après validation de tous les identifiants. `application/commands/routingDirector.ts` possède les cibles et routes validées ; la sélection reste celle de `CameraRegistry`. Une commande capture caméra et cibles à son invocation, interdit une deuxième coupe concurrente et laisse préparer les sélections suivantes.

`FeedRouter` possède les flux via des ports génériques, sans dépendance BabylonJS. La préparation réutilise les sources existantes ; la validation remplace toutes les textures dans une opération synchrone, attend leur présentation puis libère les sources sans consommateur. Le rollback restaure les textures et les sources suspendues. L'adaptateur `createRoutingRenderer` fournit les ports de matériaux, les mires « SANS SIGNAL » et les factories natives. L'interface `ui/attachRoutingControls.ts` traduit les gestes HTML en commandes et reflète l'état validé ; elle ne possède aucun flux.

Pour conserver au plus trois passes vidéo actives pendant une coupe depuis trois sources, un ancien flux devenu inutile dans la prochaine table peut être suspendu. Sa dernière image reste lisible jusqu'au remplacement ; sa texture est libérée après présentation. La commande publique ajoute au maximum une nouvelle source et peut donc conserver temporairement quatre textures allouées, avec au plus trois rendues. Voir [la décision 0004](docs/decisions/0004-routage-transactionnel.md).

## Mise en place à T07

`domain/cameras/cameraEditing.ts` contient les conversions angulaires, l'écrêtage des positions/FOV et la visée. `CameraRegistry.updateCamera` valide et copie une définition complète pour les changements d'objectif et la restauration exacte d'une transaction. L'application `CameraEditor` possède l'outil actif et la définition antérieure au geste ; elle applique les candidats validés en direct, valide au relâchement ou restaure après interruption. Elle ne modifie jamais le routage.

`interaction/createCameraGizmos.ts` possède une couche utilitaire explicite et les gizmos natifs de position/rotation attachés au rig sélectionné. Translation monde, rotation locale, aucune mise à l'échelle. Les événements de glissement alimentent le port d'édition ; la couche ne se rend qu'avec l'observateur principal. `createEditingNavigation` suspend les entrées orbitales et annule l'inertie ; le clavier ZQSD possède en plus un prédicat d'autorisation. Le canvas garde son focus pendant cette suspension pour éviter le pointer-up synthétique produit par BabylonJS lors d'un blur.

`ui/attachEditingControls.ts` possède les commandes HTML et interruptions : Échap, blur, document masqué, pointercancel et lostpointercapture. Les annulations de focus/pointeur sont écoutées en capture afin de restaurer la définition avant qu'un événement natif synthétique de relâchement puisse la valider. La destruction retire l'interface, annule le geste, libère gizmos/couche, puis détache les contrôles et détruit la scène. Voir [la décision 0005](docs/decisions/0005-edition-transactionnelle-et-entrees.md).

## Mise en place à T08

`domain/direction/panelLayout.ts` fixe la position du pupitre et la disposition de ses touches. `DirectorPanel` relie les commandes au registre des caméras, au directeur de diffusion et à l’éditeur. `directorPanelModel` projette leurs instantanés en libellés et états de touches. Les souscriptions sont retirées au démontage.

`ui/createDirectorPanel.ts` possède le caisson, les touches et les textures de texte. Le panneau occupe le premier plan à droite. Ses maillages utilisent la couche d’observation et la catégorie `panel`, exclue des flux. Les libellés sont repeints lors d’un changement d’état ou de survol. `panelReadout.ts` répercute l’état et les erreurs dans le bandeau HTML, qui conserve l’accès à l’aide et au retour à la vue régie.

`attachPanelPicking.ts` intercepte les appuis sur le pupitre après les gizmos et avant le picking des caméras. `PanelGesture` valide un seul clic si le pointeur est relâché sur la même touche sans glissement. La commande Pause est grisée jusqu’à T10.

## Mise en place à T09

`domain/concert/audienceLayout.ts` calcule les emplacements, l’orientation, la taille et le modèle de chaque spectateur à partir d’un effectif et d’une graine. La distribution réserve une allée centrale et le volume au sol du panneau. `createConcertScene` accepte cette configuration et utilise 144 spectateurs par défaut.

`models/audience` construit six silhouettes colorées à partir de primitives fusionnées. Chaque spectateur est une instance d’une silhouette. Le groupe possède les géométries et un matériau partagé, ainsi que les instances qu’il peut déplacer individuellement à T10. Le marquage `concert` inclut le public dans les flux. Le picking ignore ses maillages.

## Mise en place à T10 et T11

`concertMotion.ts` calcule les trajectoires sur une horloge de spectacle indépendante du rendu. `attachConcertShow` applique les poses au groupe, au public et aux projecteurs. La pause est transmise par le pupitre et fige les poses du spectacle. L’adaptateur retire son observateur de scène et libère les lumières au démontage.

Le changement de profil vidéo réemploie la transaction du routeur. Les nouvelles textures sont préparées avec la même table d’affectation. Le routeur suspend les anciens flux au besoin pour limiter à trois les passes vidéo actives, puis publie les textures prêtes en une seule opération. En cas d’échec, il réactive les anciens flux et conserve leurs textures.
