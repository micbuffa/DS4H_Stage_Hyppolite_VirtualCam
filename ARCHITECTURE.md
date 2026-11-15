# Architecture du laboratoire de caméras virtuelles

Statut au 15 novembre 2026 : T00 à T18 en place selon la [spécification version 2.2](CAMERAS_VIRTUELLES_SPEC.md). Les effets 2D sont validés dans les rapports [T13](docs/validation/T13.md), [T14](docs/validation/T14.md) et [T15](docs/validation/T15.md), le moniteur et les tests hors direct [à T16](docs/validation/T16.md), les trajets, points de passage et leur test sur moniteur [à T17](docs/validation/T17.md), les commandes multiécrans et exercices [à T18](docs/validation/T18.md). Le rapport T18 consigne aussi le blocage de démarrage de la longue sélection et la réussite du cas rejoué isolément. La stabilité en longue série et les mesures matérielles restent à T19.

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

Dans le socle, le gestionnaire de flux possède au maximum une `RenderTargetTexture` par caméra actuellement diffusée. Plusieurs écrans réutilisent cette texture. Avec trois écrans, au plus trois flux distincts sont rendus simultanément. La sélection seule ne crée pas de flux lorsque l'aperçu est désactivé. Les consommateurs de transition et d'aperçu sont implémentés à T13/T16, avec quatre captations actives au plus selon les budgets décrits plus bas.

Les listes de rendu des flux contiennent uniquement le concert filmable. Elles excluent les surfaces vidéo des trois écrans, le panneau de régie, les représentations des caméras, les frustums et les gizmos. Les couches utilitaires sont configurées pour la vue d'observation ; leur exclusion est également vérifiée dans le navigateur. Cette règle évite les boucles de rendu et les accessoires visibles à l'antenne.

## Propriété et destruction

L'application possède moteur et scène. Chaque thème possède ses nœuds et observateurs. Le gestionnaire de flux possède les RTT partagées et compte leurs consommateurs ; les écrans possèdent leurs matériaux, sans détruire une texture partagée. L'interface possède son gestionnaire GUI ; l'éditeur possède ses gizmos et ses abonnements.

Une réaffectation met à jour l'état et les consommateurs ; une RTT sans consommateur est retirée des cibles actives puis libérée. La dernière libération d'un flux ne doit pas intervenir pendant une passe GPU en cours : différer au point sûr de la boucle de rendu. L'arrêt est idempotent ; aucun callback, contrôle de caméra ou événement DOM ne reste actif.

## Évolution et décisions

Conserver le socle sans backend. Les transitions, l'aperçu et les trajets temporaires sont planifiés dans T12 à T19 ; la sauvegarde locale, le travelling permanent et le suivi automatique restent facultatifs. Une modification des frontières, du pipeline de rendu ou du format de pose nécessite une décision courte dans `docs/decisions/`, accompagnée des conséquences pour les tests. La [décision 0006](docs/decisions/0006-transitions-previsualisation-et-budgets.md), adoptée pour les contrats à T12, encadre cette évolution et distingue conception et rendu GPU restant à vérifier.

## Architecture cible des transitions — T12 à T19

### Répartition des responsabilités

Le tableau situe les responsabilités de l'extension. Les contrats implémentés à T12 sont détaillés en fin de document ; les adaptateurs et fonctions visuelles restent à créer. Aucun dossier vide n'est requis pour représenter la cible.

| Couche / emplacement cible | Responsabilités à ajouter |
| --- | --- |
| `domain/direction/` | Catalogue et paramètres, état de transition, plan de passage par écran, ordre/délai et règles de concurrence |
| `domain/cameras/` | Interpolation position/quaternion/FOV, points de passage et validation de trajectoire contre des volumes sérialisables |
| `domain/rendering/` | Budget des sources et politique de qualité explicite, sans dépendance GPU |
| `application/commands/` | Orchestration de diffusion et d'aperçu ; capture de commande, horloge injectable, annulation et restauration globale |
| `application/ports/` | Préparation/possession des sources, composition A/B, présentation, caméra temporaire et signal de visibilité |
| `application/presentation/` | État du pupitre : réglages préparés, routes validées, images présentées, participants et progression |
| `infrastructure/babylon/rendering/` | Réutilisation des flux, matériaux de transition et shaders locaux rangés par effet |
| `infrastructure/babylon/cameras/` | Adaptateur de caméra temporaire, sans entrée utilisateur et hors registre 1…9 |
| `infrastructure/babylon/ui/` et `interaction/` | Commandes 3D, moniteur, picking et restrictions d'édition observant l'état applicatif |
| `app/` et composition du runtime | Injection des adaptateurs, branchement visibilité/horloge et destruction dans l'ordre inverse de création |

Le domaine reste indépendant du DOM, de BabylonJS et des shaders. Le choix de T12 est d'étendre `RoutingDirector` avec un `TransitionOperation` pour l'exécution, tout en conservant `FeedRouter` comme propriétaire des ressources. Les futurs drivers doivent réutiliser cette autorité unique sur les sources ; aucun deuxième gestionnaire concurrent n'est admis.

### État transactionnel et présentation

Séparer explicitement les réglages de la prochaine commande, la table d'affectation validée, le plan capturé de l'opération et les images effectivement présentées. Cette séparation est nécessaire en mode décalé : un écran peut déjà montrer B alors que l'opération complète reste annulable. Le statut expose les étapes présentées sans faire passer l'opération globale pour terminée.

Une seule diffusion suit préparation → passage → présentation finale → validation globale. Enregistrer les routes et consommateurs initiaux pour restaurer toutes les cibles en cas d'annulation ou d'échec, y compris les étapes déjà présentées. Ne libérer les anciennes sources qu'après réussite de l'opération complète. Les écrans non ciblés conservent leur source. Les changements de sélection ne modifient pas le plan capturé.

L'horloge de transition est indépendante du spectacle ; elle continue pendant sa pause, se suspend quand l'onglet est masqué et ne rattrape pas le temps caché. Le blur conserve sa signification pour l'édition et n'annule pas la transition. Les caméras participantes sont verrouillées pour les mutations de pose/FOV ; aucun lancement pendant un drag, aucune deuxième diffusion ou modification de profil pendant l'opération.

### Pipeline et budgets cibles

| Situation | Plafond de RTT de captation actives | Consommateurs |
| --- | ---: | --- |
| Direct au repos sans aperçu | 3 | Sources des écrans |
| Direct et aperçu simple ou test d'effet 2D | 4 | Sources du direct et au plus une source sélectionnée distincte |
| Préparation et passage par effet 2D | 4 | Au plus trois sources initiales et une destination B |
| Préparation, test ou diffusion d'un trajet virtuel | 5 | Sources initiales, B et une caméra temporaire ; trajets séquentiels |

L'aperçu simple et les tests hors direct sont interrompus avant une diffusion. Leurs consommateurs distincts sont retirés avant d'acquérir ceux du passage ; les sources encore partagées restent possédées. Lors d'un remplacement d'aperçu, suspendre le rendu de l'ancien aperçu distinct avant de préparer le nouveau, tout en conservant sa texture et son ID pour un retour en cas d'erreur. Aucun pic de cinq sources actives n'est permis pour ce simple remplacement.

Chaque source partagée a une RTT et plusieurs consommateurs possibles : écrans au direct, départs conservés pour rollback, destination, aperçu. Le point de vue temporaire est un consommateur technique distinct. Une référence de restauration peut conserver une allocation sans forcément imposer une passe une fois sa contribution visuelle terminée ; en cas de rollback, préparer sa reprise avant présentation. Une source encore visible dans un mélange doit rester en direct.

Les effets 2D composent A/B dans les matériaux des surfaces vidéo ; aucune RTT de composition par écran n'est prévue. La caméra d'observation reste inchangée. Compter les passes de captation séparément de la vue principale, des dessins de surfaces et des allocations conservées. Les plafonds sont des contraintes de conception à vérifier, pas une garantie de cadence. Un changement de qualité au repos suspend aussi l'aperçu avant la transaction existante, puis le rétablit.

La caméra temporaire réutilise les exclusions de captation et ne modifie aucune pose C1…C9. Les obstacles sont fournis par références/configurations explicites ; ne pas rechercher arbitrairement des meshes par nom. La validation du trajet et l'interpolation sont pures ; l'adaptateur projette la pose candidate dans BabylonJS.

### Propriété et validation à venir

Le gestionnaire de flux possède les textures et leurs abonnements ; l'orchestrateur possède les réservations temporaires et l'horloge ; les écrans et le moniteur possèdent leurs matériaux sans détruire les textures partagées ; l'adaptateur de trajet possède sa caméra temporaire. Chaque préparation asynchrone doit pouvoir être abandonnée : un résultat devenu périmé est libéré et ne remplace jamais une sélection plus récente ou un runtime démonté.

Les tests purs couvrent les commandes, erreurs, horloges, trajectoires et budgets. NullEngine vérifie assemblages et destruction compatibles. Les tests WebGL2 vérifient shaders, images intermédiaires, absence de saut aux extrémités, exclusions et rollback visible. T19 ajoute la recette Windows, les 100 transitions/20 cycles et les mesures matérielles. Les rapports T01 à T11 restent des validations historiques du socle.

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

## Mise en place à T12 — contrats et orchestration

`domain/direction/transitionDefinition.ts` définit les douze modes, durées et paramètres validés. Les réglages normalisés sont copiés et gelés. `transitionPlan.ts` capture routes initiales/finales, cibles uniques, sources participantes et calendrier de chaque écran. Les cibles déjà sur B ne créent aucune étape ; les sources absentes sont représentées par `null`. Le trajet impose une séquence. `transitionFrame` calcule une progression par écran sans moteur 3D.

`transitionClock.ts` accumule le temps visible à partir d'échantillons monotones incluant les changements de visibilité ; il est indépendant du spectacle. `domain/rendering/sourceBudget.ts` compte séparément allocations, sources actives et consommateurs, et vérifie les plafonds 3/4/5. Ce calcul pur ne crée pas de nouvelle autorité sur les textures.

`application/ports/transition.ts` définit `TransitionDriver`, `PreparedTransition`, `SourceLease` et `SharedSourcePort`. Les deux derniers sont le contrat à implémenter dans le gestionnaire de ressources à T13. Un driver prépare une session annulable, reçoit les progressions et garantit la présentation finale avant validation. L'adaptateur de composition et son échantillonneur navigateur restent à réaliser ; aucun driver d'effet n'est branché dans le runtime à T12.

`TransitionOperation` possède l'opération active et son `AbortController`, expose les phases et restaure une session après erreur ou annulation. Il nettoie également une session dont la préparation se termine après abandon. `RoutingDirector` reste propriétaire des seules routes validées ; il utilise cet orchestrateur pour toutes les coupes, capture les réglages de la commande et expose les verrous de caméras et de qualité aux futurs adaptateurs. Le runtime fournit le prédicat de drag pour refuser un lancement pendant un geste.

Le chemin coupe réemploie `RoutingRenderPort.prepare(routes, signal)`. `createRoutingRenderer` transmet le signal à `FeedRouter`, qui libère le candidat et réactive les sources suspendues lors de l'annulation. Il retire le listener d'annulation et l'attente de présentation au règlement de la transaction. Le budget GPU courant demeure trois sources actives ; la présence du catalogue n'alloue aucune RTT. Les modes sans driver sont refusés explicitement, y compris une séquence de coupes différées qui exige le futur adaptateur multiécran.

## Mise en place à T13 — effets fondamentaux et pupitre

`FeedRouter` implémente `SharedSourcePort` avec `retain`, des leases annulables et un comptage par propriétaire. Les consommateurs des écrans restent présents pendant la préparation et le mélange ; `prepareTransition` conserve les sources initiales et prépare B sans les suspendre, avec quatre sources actives au maximum. La composition reçoit une paire de textures par écran modifié. Après présentation réussie, les routes changent ensemble, les leases sont retirées et les sources sans consommateur sont libérées. Une annulation ou une erreur restaure les textures et matériaux antérieurs avant de libérer le candidat. Le changement de profil et les coupes concurrentes sont refusés tant que cette transaction est ouverte.

`createTransitionComposition` possède les `ShaderMaterial` temporaires, les observateurs de compilation, l'attente de présentation et leur libération. Les shaders GLSL locaux se trouvent dans `rendering/shaders/basicTransitionShaders.ts` : échantillons directs aux extrémités, mélange linéaire pour les fondus et seuil UV pour le volet dans quatre directions. Il n'existe pas de RTT de composition par écran. Les matériaux directs des écrans retrouvent leur place avant la présentation finale.

La préparation appelle `isReady(mesh)` depuis un observateur possédé de scène, sans boucle de timers. Le cinquième argument de `ShaderMaterial` est `false` : l'effet est détenu par le matériau, en cohérence avec cet appel sans sous-maillage. Cela évite qu'un effet de préparation en échec survive à la destruction et rende `engine.areAllEffectsReady()` faux. Les textures partagées ne sont jamais détruites par le matériau temporaire.

`createTransitionDriver` relie les fins d'image et les événements de visibilité du document à l'horloge T12. Chaque attente retire ses observateurs/listeners après résolution, annulation ou destruction de scène. Le runtime branche ce driver à `RoutingDirector`. Les verrous de participants sont injectés dans `CameraEditor`, répercutés aux gizmos et aux touches ; le contrôle de qualité observe le directeur et reste désactivé pendant l'opération.

Le pupitre conserve ses dimensions et la position des commandes existantes. `panelLayout.ts` ajoute une bascule de page et six touches de transition. `directorPanelModel` projette la visibilité, les raisons de désactivation, les participants et la progression ; les maillages et labels des touches de l'autre page sont désactivés pour le picking. `DirectorPanel` prépare mode/durée/direction sans toucher au direct et transmet diffusion/annulation aux commandes applicatives. Le bandeau HTML n'ajoute qu'un état de transition préparée en lecture seule.

## Mise en place à T14 — grilles procédurales

Implémentation validée selon le [compte rendu T14](docs/validation/T14.md). `domain/direction/gridTransitions.ts` définit le catalogue des grilles, les préréglages du pupitre et le calendrier pur des cases. Le hash entier est reproduit en GLSL avec des opérations exactement représentables en haute précision ; les 32 bits de graine sont repliés dans un domaine de 4 093 valeurs. Des graines distinctes peuvent donc produire le même ordre, sans aléatoire lié aux images ou à l'horloge système.

`rendering/shaders/gridTransitionShaders.ts` fournit les fonctions des trois effets au shader de composition existant. Rolling Cubes projette orthographiquement les deux faces adjacentes d'un cube par case, avec ombrage de relief ; Mosaïque mélange les cases dans leur ordre déterministe ; Grid Morph déplace les UV des deux images en sens opposés avant mélange linéaire. L'enveloppe de déformation s'annule aux bords des cases et aux extrémités temporelles. Les UV sont bornées dans l'image, et les faces des cubes couvrent chaque case. Les branches terminales reprennent directement A ou B.

La composition transmet grille, graine repliée et intensité une fois à la préparation ; seul `progress` change pendant le passage. Elle conserve la propriété de ses matériaux et effets, sans nouvelle RTT ni maillage par case. Le routeur, les leases et les annulations restent ceux de T13. Les valeurs des uniformes utilisent les API du paquet officiel 9.34.0 installé (`setArray2` pour le vec2 de grille).

Le pupitre propose sept passages. Pour les trois effets de grille, la touche contextuelle ouvre quatre réglages aux emplacements des commandes effet/durée : grille, amplitude ou relief, graine − et graine +. RETOUR EFFETS retrouve ces commandes. ANNULER TRANSITION reste visible sur les deux pages. Les touches masquées et leurs labels ne sont pas sélectionnables ; aucun réglage ne modifie une commande déjà capturée.

## Mise en place à T15 — effets complémentaires

Implémentation validée selon le [compte rendu T15](docs/validation/T15.md). `domain/direction/graphicTransitions.ts` définit les références pures : hash entier et décalage des bandes Glitch, échelles du Zoom, masque de luminance continu et pondération, calendrier et coordonnées de l'écran partagé. `rendering/shaders/graphicTransitionShaders.ts` les traduit en GLSL et réutilise le mélange linéaire existant. Le point d'entrée de composition distingue les quatre modes avant la branche des grilles ; aucun autre gestionnaire de ressources n'est introduit.

Glitch utilise huit phases et un déplacement horizontal borné avec enveloppe temporelle, sans gain de luminosité ni écran de flash. Zoom transforme les UV autour du centre, sans accès aux caméras. Le masque est un bruit de valeurs lissé calculé à la demande ; aucune texture de masque supplémentaire n'est allouée. Le split distribue la largeur entre A/B, ajuste chaque image complète avec une échelle identique sur X/Y et dessine des bandes noires explicites. Les samplers A/B partagés restent les seules entrées vidéo ; les branches 0/1 renvoient directement leurs images.

Le pupitre parcourt onze modes. Sa page de paramètres existante sert aussi au Glitch, au Zoom et au volet de luminance, avec libellés et raisons de désactivation adaptés : bandes/graine/amplitude, amplitude seule, détail/graine/douceur. L'écran partagé utilise uniquement la durée. Aucune nouvelle touche ni ressource GUI n'est nécessaire. L'acquisition des sources, les verrous, l'horloge, la présentation et le rollback restent ceux de T13/T14.

## Mise en place à T16 — aperçu et test hors direct

Implémentation validée selon le [compte rendu T16](docs/validation/T16.md). `PreviewController` possède les acquisitions d'aperçu, la préparation courante, son numéro de révision et une opération de test distincte ; il ne possède ni les flux ni les routes validées. Il observe uniquement les changements de sélection du registre. Le port `SharedSourcePort` est exposé par le gestionnaire existant : une caméra déjà diffusée est partagée, une caméra distincte ajoute au plus une captation active.

Lors d'un remplacement, le consommateur précédent est suspendu, sa texture reste conservée pour récupération et le candidat est préparé. Le moniteur indique la source réellement liée, puis la première présentation réussie libère l'ancien consommateur. Une erreur réactive l'ancien flux et conserve son image/ID. Une nouvelle sélection ou un arrêt annule immédiatement le candidat ; les révisions empêchent toute publication asynchrone périmée. Avec trois sources du direct, le remplacement peut conserver cinq textures de captation, dont quatre seulement rendues. Les sources du direct restent animées.

`PreviewViewPort` reçoit les images et la composition à présenter ; `createPreviewMonitor` possède le caisson, la surface 16:9, la texture vide initialisée et ses textes. Il emprunte les textures vidéo sans les détruire. Tous ses maillages sont exclus des flux. L'extension gauche du pupitre et ses trois boutons utilisent `previewPlacement` ; le caisson et son raccord consomment les clics comme le panneau principal. Les positions des commandes antérieures ne changent pas. La texture du statut est initialisée à la création, sans dépendre d'un premier rafraîchissement de l'interface.

Le test capture destination, réglages et plus petit écran cible. Il partage les sources A/B et réutilise `TransitionOperation` avec un adaptateur qui compose uniquement sur le moniteur ; sa validation ne modifie aucune route du direct. `createTransitionComposition` accepte désormais une liste minimale de surfaces pour servir aux écrans et au moniteur. Le cas Sans signal emprunte l'image réelle de l'écran de référence au renderer. Annuler ou terminer le test retrouve l'aperçu B. Sans cible, la prévisualisation reste possible et le test est refusé avant acquisition.

`RoutingDirector` reçoit un `PreviewCoordinator` optionnel : la diffusion attend sa suspension, puis rétablit l'aperçu de la dernière sélection après succès, annulation ou erreur. `changeQuality` applique la même politique et exclut les diffusions concurrentes ; le profil peut conserver les allocations de remplacement habituelles du socle, sans consommateur d'aperçu supplémentaire. Les caméras participant au test sont verrouillées via le directeur et l'éditeur existants. Le runtime détruit d'abord contrôleur et moniteur, puis panneau et routeur ; les abonnements et ressources de tests tardifs sont annulés.

Une affectation identique arrête seulement le test éventuel et conserve la lease d'aperçu existante, sans suspendre/recréer sa texture. `TransitionOperation.assertCanStart` vérifie notamment le drag avant toute suspension ; les participants du plan en attente sont déjà verrouillés jusqu'au règlement de la commande.

## Premier lot T17 — calcul et validation

`domain/cameras/travelPath.ts` possède la capture immuable des vues, la limite de trois points, la géométrie en segments droits et son interpolation. Les segments reçoivent une durée proportionnelle à leur longueur ; une progression cubique de position annule la vitesse à leurs extrémités. La rotation suit le SLERP quaternion court ; FOV et clipping suivent la progression douce globale. Les points consécutifs confondus ne créent pas de division par zéro ; un trajet réduit à une rotation reste possible. Les vues capturées sont retournées exactement aux bornes temporelles.

`travelCollision.ts` décrit les volumes sérialisables et l'intersection continue segment/boîte dilatée. L'enveloppe conservatrice est une sphère centrée sur l'origine optique, contenant le plan proche 16:9 pour le plus grand FOV et le plus grand clipping proche des deux vues, avec 25 cm de marge supplémentaire. Elle protège tout le mouvement, indépendamment de la cadence de rendu. Elle ne valide pas la visibilité permanente du sujet. Les boîtes alignées au monde des structures et du pupitre incliné peuvent refuser certains chemins pourtant libres près de leurs coins.

`domain/concert/travelObstacles.ts` déclare explicitement les enveloppes fixes à partir des configurations du concert et du pupitre : sol, plateau, toit, treillis, fond, estrade, escaliers, enceintes, barrière, écrans/supports, pupitre et moniteur. Les musiciens, instruments, public et projecteurs restent hors de cette détection. Un test d'intégration compare ces enveloppes avec les bornes mondiales des géométries natives concernées, sans découverte arbitraire de meshes dans le code de production. Modifier le décor impose de revoir ces volumes et ce test.

`captureTravelPlan` associe un chemin capturé à chaque étape du plan, dans son ordre effectif. Tous les chemins sont validés avant de retourner le plan, y compris ceux des étapes ultérieures. `RoutingDirector` l'appelle après la garde de drag et avant de suspendre l'aperçu ou d'acquérir les sources. Les réglages et les poses natifs ultérieurs ne peuvent pas retoucher la commande. Une source initiale Sans signal est refusée explicitement pour un trajet. Les erreurs de validation sont exposées sans modifier les routes ni l'aperçu.

Ce premier lot n'ajoute aucun propriétaire de RTT. Le catalogue du pupitre reste limité aux onze passages 2D ; un driver sans trajet continue de refuser ce mode. Les tests de calcul et de volumes ne prouvent pas la continuité des pixels. Le deuxième lot ci-dessous introduit la source temporaire ; la composition et la recette complète restent ouvertes à T17.

## Deuxième lot T17 — source temporaire

`createTravelCameraFeed` possède un rig et une `FreeCamera` sans entrées, hors registre 1…9, sous la même racine que les rigs de captation. Le constructeur ne prend jamais la place de la caméra d'observation. La pose, le FOV vertical et le clipping utilisent les mêmes contraintes métier, extraites dans `validateCameraView`, et la même hiérarchie native que les sources numérotées. Le flux réutilise `createCameraFeed`, ses exclusions, son ratio et sa programmation unique dans les RTT de scène. Son propriétaire libère flux, caméra, rig et attentes à l'arrêt ou en cas d'échec de construction.

`TravelFeed` et `TravelSourceLease` exposent `setPose` et `waitForFrame`. Cette attente exige un événement de dessin du renderer puis une fin d'image avec texture disponible ; un bind de RTT ou une vérification de disponibilité seule ne suffit pas. Annuler, changer la pose, rencontrer une erreur de shader ou arrêter la scène rejette les attentes et détache leurs observateurs. La modification de pose valide d'abord toutes les données, avant toute mutation native.

`FeedRouter` reste le propriétaire unique des ressources. Son pool accepte aussi la clé technique `temporary`, avec réservation exclusive par `retainTemporary` ; une deuxième réservation ne peut pas partager un point de vue mutable. Les consommateurs de trajet utilisent le contexte à cinq sources, qui interdit tout consommateur d'aperçu, même partagé ou suspendu. Les acquisitions et changements d'activité vérifient le budget avant mutation. Les anciennes sources du direct restent rendues ; la ressource temporaire est libérée à la fin de sa lease et une référence périmée ne peut plus déplacer une caméra ultérieure.

`createRoutingRenderer` fournit la factory temporaire au pool, avec la résolution courante et les dépendances de flux existantes. Aucun second pool ni RTT de composition n'est ajouté. Les tests métier couvrent cinq sources, conflits, erreurs, réservations abandonnées et rollback ; les tests NullEngine couvrent la hiérarchie, les exclusions et le nettoyage, sans preuve de pixels. La recette WebGL2 de source compare les extrémités au concert réel. Le troisième lot ci-dessous ajoute la composition et sa présentation ; les commandes et le test hors direct restent ouverts.

## Troisième lot T17 — composition et présentation séquentielles

`application/commands/createTravelPass` possède la session de trajet, ses attentes annulables, les textures initiales et une réservation de la source temporaire. Ses dépendances sont le port de sources partagé, une table de surfaces et un port de présentation ; elle ne dépend pas de BabylonJS. `createTravelComposition` traduit ces surfaces vers les matériaux natifs existants, sans shader ou RTT de composition supplémentaire. Le driver natif choisit explicitement cet adaptateur pour `virtual-travel` ; le compositeur 2D refuse ce mode.

`PreparedTransition.render` peut retourner une promesse. `FeedRouter` la transmet et `TransitionOperation` attend son règlement avant tout nouvel échantillon ou validation. Les effets 2D gardent leur rendu synchrone. Le trajet interdit les appels de rendu concurrents ou les progressions rétrogrades. Après une attente annulée, les gardes empêchent une publication tardive ; les observateurs de présentation sont libérés exactement une fois.

La session présente le point de départ, échantillonne le chemin capturé, attend le dessin de la pose et présente le cadrage temporaire final avant de basculer vers B. B est ensuite présenté avant que la caméra puisse être déplacée vers le départ de l'écran suivant. Pendant un délai, les surfaces futures conservent leurs images initiales. Un saut d'horloge franchissant plusieurs étapes les termine successivement et présente chacune de leurs extrémités ; aucune surface ne conserve la texture temporaire lors de sa réutilisation ailleurs.

La validation globale reste après la dernière présentation. Les sources initiales restent possédées et rendues jusque-là ; annulation ou erreur restaure toutes les cibles, y compris celles déjà passées sur B, avant destruction de la source temporaire. `FeedRouter` reste seul propriétaire du pool. La recette sur concert compare les pixels des RTT aux extrémités et le framebuffer principal avant/après le relais, en conservant les neuf caméras et l'observateur. Le quatrième lot ci-dessous ajoute les commandes, les points éditables et le test hors direct.

## Quatrième lot T17 — pupitre et test de trajet hors direct

`PreviewController` capture et valide le chemin du plus petit écran ciblé avant de modifier l'aperçu. Le plan en attente verrouille immédiatement ses participants, puis les révisions invalident annulation, sélection ou préparation périmée. Avant acquisition du trajet, la source d'aperçu simple est libérée. A est réservée comme source de trajet et B comme source de retour à l'aperçu ; elles utilisent le même pool que le direct. `createPreviewMonitor` reçoit une factory dédiée injectée par le renderer, qui adapte `createTravelComposition` à sa seule surface et à l'ID de référence, sans modifier les surfaces du direct.

La session vidéo libère la caméra temporaire avant de retirer le consommateur de trajet A. B reste alors détenue pour restauration et peut recevoir une lease d'aperçu sans recréation de sa RTT ; ce consommateur de retour est ensuite retiré. La même promotion intervient après une annulation ou erreur si B est prête et si la demande reste courante. Une préparation interrompue avant session est nettoyée, puis l'aperçu est repris seulement si la révision reste valide ; une diffusion, une qualité en cours ou un arrêt interdit cette reprise. Le budget reste de cinq captations pendant le trajet, puis quatre avec l'aperçu simple.

Le statut distingue la destination B du point de vue temporaire non numéroté. Les ports exposent explicitement la capacité du moniteur à tester le trajet ; un moniteur sans factory dédiée le refuse. Le contrôleur conserve la priorité du direct et de la qualité et ne modifie ni routes ni poses de captation ni observateur.

Le driver natif suit aussi la visibilité pendant les attentes asynchrones de dessin/présentation, indépendamment de `nextSample`. Son horloge retranche les intervalles masqués même si leurs deux événements surviennent entre deux lectures. Le suivi est initialisé au premier échantillon et possédé jusqu'à la destruction de la scène, qui retire son listener. Le `TransitionClock` métier reste indépendant du spectacle et conserve ses propres règles de suspension ; les temps fournis par le driver empêchent tout rattrapage à l'issue d'une attente d'image masquée.

Le catalogue du pupitre ajoute le trajet après les onze passages 2D, ce qui conserve leurs indices de shader. Le driver filtre sa capacité réelle sans doublon ; le compositeur 2D continue de refuser le trajet. Le changement de famille rétablit les durées par défaut 2 000/600 ms ; depuis T18, le pupitre mémorise l'ordre simultané/décalé choisi avant le trajet et le restaure au retour aux effets 2D, tandis que le domaine impose la séquence des trajets. Les points sont édités dans une page distincte : huit touches réutilisent l'espace des réglages, le texte d'état de transition est masqué sur leur quatrième rangée et les commandes d'aperçu restent accessibles. Les touches antérieures conservent leurs coordonnées.

La page propose trois points au maximum, sélection du point et de l'axe, ajout/suppression et déplacement de 0,5 m borné par les contraintes des caméras. Le premier ajout utilise le milieu de A/B de référence ; les suivants copient le dernier point. Ces commandes modifient les réglages suivants, sans retoucher un plan déjà capturé, les rigs ou le direct. Les libellés annoncent le mode effectif séquentiel avant diffusion. Le guide et l'aide décrivent les limites des volumes, les occultations possibles et l'usage du moniteur avant diffusion.

## T18 — commandes de séquence multiécran

`domain/direction/screenSequence` possède six permutations immuables et leur parcours cyclique. `DirectorPanel` expose une page SÉQUENCE distincte des effets et des points de trajet ; elle modifie uniquement les réglages de la prochaine commande. Les coordonnées des touches précédentes restent stables ; seul le titre est réduit pour placer l'accès SÉQUENCE. Le pupitre compte 53 touches, dont les groupes masqués selon la page.

`application/presentation/sequencePanelModel` réutilise `planTransition` pour afficher l'ordre filtré et le total ; il ne recalcule pas une deuxième règle de calendrier. Les écrans non ciblés ou déjà sur B ne consomment ni étape ni délai. Pour n étapes, le total décalé vaut n × durée + (n − 1) × délai ; le simultané vaut une durée. Le délai est borné à 0…1 000 ms par pas de 100 ms. Le mode effectif apparaît dans le libellé préparé ; pendant le passage, la progression par écran provient du plan capturé, indépendamment des réglages suivants.

Les coupes décalées de durée totale positive passent par la même transaction de transition que les effets 2D : le driver annonce aussi `cut`, les shaders n'échantillonnent que les extrémités 0/1 et conservent les sources A vivantes avec B, au plus quatre captations. Une coupe instantanée conserve le chemin du socle et son budget de trois captations. Aucun pool ni RTT de composition supplémentaire n'est créé. Les routes ne sont validées qu'après la dernière présentation ; toutes les images initiales restent restaurables après une première étape terminée. Le trajet réutilise sa seule caméra temporaire, impose la succession et garde son plafond de cinq sources. L'aperçu hors direct reste un test de la seule référence, sans chorégraphie multiécran.
