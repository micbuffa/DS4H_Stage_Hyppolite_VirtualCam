# 0006 — Transitions, prévisualisation et budgets de rendu

Date : 13 novembre 2026 ; validations du rendu et de l'aperçu T13 à T16 clôturées le 14 novembre 2026. Statut : **adoptée à T12 pour les contrats et appliquée aux effets 2D et à la prévisualisation validés à T13 à T16**.

Références : [spécification version 2.2](../../CAMERAS_VIRTUELLES_SPEC.md), [architecture](../../ARCHITECTURE.md), [bonnes pratiques](../BABYLONJS_BONNES_PRATIQUES.md). Cette décision distingue les contrats T12, les effets 2D T13 à T15, la prévisualisation T16 et les extensions futures. Les validations visuelles sont consignées dans les rapports de leurs étapes.

## Problème

La [décision 0004](0004-routage-transactionnel.md) permet une coupe avec trois sources rendues et peut suspendre brièvement une source remplacée. Un fondu ou un effet graphique exige que les images de départ et d'arrivée continuent à évoluer pendant le mélange. Un moniteur d'aperçu et une caméra de trajet créent également des consommateurs supplémentaires. Réutiliser le budget de trois passes sans le revoir conduirait à figer une image ou à dépasser un plafond implicite.

## Orientation retenue pour les contrats

Conserver la séparation métier/application/adaptateurs. Étendre l'orchestration du routage avec un plan de transition immuable pendant son exécution, une horloge injectable et des ports de préparation, composition et présentation. Une seule opération de diffusion est active ; ni l'aperçu ni les surfaces d'écran ne deviennent propriétaires indépendants des mêmes sources.

Composer les effets 2D dans les matériaux des écrans, à partir de deux flux partagés et d'une progression. Préparer shaders et premières images avant le départ. Ne pas créer de cible de composition supplémentaire par écran. À progression 0 et 1, retrouver respectivement A et B avec orientation, ratio et couleurs identiques aux flux directs. Préférer des shaders procéduraux locaux ; documenter provenance et licence de toute reprise externe.

Le rendu 2D cible utilisera un `ShaderMaterial` non éclairé sur les surfaces, avec sources GLSL locales et uniforms A/B/progression. Le mélange des intensités sera effectué en espace linéaire : décoder les échantillons gamma des RTT, mélanger, réencoder une seule fois pour l'affichage, sans seconde exposition. Aux extrémités, renvoyer directement l'échantillon A ou B afin de préserver l'image initiale/finale. Reprendre les conversions officielles du moteur et leurs options plutôt qu'une correction empirique.

À T12, les déclarations distribuées avec BabylonJS 9.34.0 ont été inspectées : `Materials/shaderMaterial.pure.d.ts` (constructeur, `setTexture`, `setFloat`), `Materials/material.pure.d.ts` (`forceCompilationAsync`), ainsi que les sources `Shaders/default.fragment.js` et `Shaders/ShadersInclude/helperFunctions.js`. Le flux actuel déclare `gammaSpace: true` et la scène n'ajoute pas de réglage d'exposition. Les points sûrs de préparation et de présentation restent ceux de `watchSceneReadiness` pour la coupe. Aucun nouveau paquet ni appel de shader n'est ajouté à T12.

T13 devra compiler ces shaders, tester le traitement des couleurs sur mire et comparer leurs extrémités au matériau direct actuel avec une tolérance documentée ; cette inspection des sources ne constitue pas une preuve GPU. Toute incompatibilité observée devra être traitée et la présente politique révisée avant validation du rendu.

Cette vérification est réalisée dans le [compte rendu T13](../validation/T13.md) : 239 tests unitaires/intégration et 42 parcours navigateur validés. Les cinq parcours de transitions ont aussi été relancés après dégagement de la mire et renforcement des assertions de couleur le 14 novembre. Les effets avancés gardent leurs validations propres à venir.

## Mise en œuvre du rendu à T13

`FeedRouter` détient les leases et les RTT partagées ; le driver ne crée pas de second gestionnaire de flux. La préparation conserve les sources initiales animées et ajoute au plus B. Les matériaux de transition sont propres aux écrans modifiés ; ils sont préparés avant de remplacer les matériaux directs. La dernière présentation restaure ces derniers avec les textures B, puis permet de valider les routes et de libérer A. L'annulation rétablit les matériaux/textures antérieurs avant libération des leases.

Le rendu emploie des sources GLSL locales via les champs `vertexSource` et `fragmentSource` de `IShaderPath`, `setTexture`, `setFloat`, `isReady(mesh)` et `dispose(false, false)`. Ces signatures ont été vérifiées dans les déclarations et sources officielles distribuées avec BabylonJS 9.34.0. Le shader importe `Shaders/ShadersInclude/helperFunctions` pour les conversions gamma/linéaire. Les textures d'entrée partagées ne sont pas détruites avec le matériau temporaire.

La préparation utilise un observateur de fin d'image annulable ; elle n'utilise pas la boucle de timers de `forceCompilationAsync`. L'effet doit être stocké au niveau du matériau : le cinquième argument `storeEffectOnSubMeshes` du constructeur `ShaderMaterial` est fixé à `false`, car la préparation appelle `isReady(mesh)` sans sous-maillage. Avec la valeur par défaut, un effet de préparation en erreur peut rester référencé et empêcher `engine.areAllEffectsReady()` de redevenir vrai, même après restauration visible du direct. Le scénario de panne navigateur vérifie explicitement la libération du programme et une nouvelle transition réussie.

Les tests GPU fondamentaux comparent les échantillons des flux directs aux valeurs produites à 0, 25, 50, 75 et 100 %. La tolérance est de deux unités par canal sur 255 pour le mélange linéaire réencodé ; les cinq points asymétriques couvrent l'orientation et les quatre directions du volet. Les extrémités reprennent directement les échantillons A/B ; le milieu du fondu au noir est intentionnellement noir. Les variantes avancées gardent leurs propres validations à venir.

## Grilles procédurales à T14

Implémentation validée selon le [compte rendu T14](../validation/T14.md). Les trois effets prioritaires utilisent la même composition et les mêmes acquisitions que T13. Une grille ne crée ni RTT, ni mesh, ni matériau par case. Les seuls uniformes supplémentaires sont sa taille, une graine repliée et l'intensité. `ShaderMaterial.setArray2` est vérifié dans les sources officielles du paquet 9.34.0 installé et transmet le vec2 de grille ; aucun paquet supplémentaire n'est requis.

Pour un index de case `i = ligne × colonnes + colonne`, on replie la graine `s = (graine % 4093 + floor(graine / 4093) % 4093) % 4093`, puis `h = (((i × 37 + s × 17) % 4093) × 61 + 19) % 4093`. L'ordre est `h / 4093`. Les calculs entiers intermédiaires restent inférieurs à 2²⁴ et sont reproduits sans hash trigonométrique en GLSL haute précision. Le domaine replié autorise des collisions entre graines ; il n'y a aucune promesse d'un ordre unique pour chacune des 2³² graines.

Chaque case commence à `ordre × 0,4` et avance selon `clamp((progression − début) / 0,6, 0, 1)`. Rolling Cubes utilise cette progression pour un quart de tour orthographique et un ombrage borné par le relief. La projection des deux faces couvre toute la case ; la silhouette débordante est découpée à ses limites. Mosaïque utilise un mélange linéaire pondéré par `smoothstep` sur la progression locale. Grid Morph ajoute un déplacement opposé des UV A/B, d'amplitude au plus `0,8 × intensité` case, avec une enveloppe sinusoïdale nulle sur les bords et aux extrémités. Les UV globales sont bornées ; aucun tampon intermédiaire n'est lu. Les branches globales 0/1 renvoient directement A/B.

Les shaders sont écrits localement pour ce projet : aucune reprise de shader tiers, masque, texture ou bibliothèque d'effets. Les fonctions de couleur proviennent uniquement du paquet BabylonJS existant, sous Apache-2.0. La recette propre à T14 valide leurs images intermédiaires sur mire et concert, leur déterminisme, leurs extrémités et la restauration après échec de compilation.

## Effets complémentaires à T15

Implémentation validée selon le [compte rendu T15](../validation/T15.md). `graphicTransitions.ts` fournit les références métier et `graphicTransitionShaders.ts` leurs équivalents GLSL. Aucun sampler ni texture de masque n'est ajouté ; aucune RTT ni matériau n'est créé par bande. Les matériaux des écrans et les deux sources partagées restent détenus par la composition et le routeur existants. Le stockage et la libération des effets restent ceux de T13. Les API `setFloat`, `setArray2` et `setTexture` proviennent du paquet officiel 9.34.0 installé, sans nouvelle signature ni dépendance.

Pour les coordonnées entières `(x,y)`, le bruit est `h = (((y × 37 + x × 61 + graine repliée × 17) % 4093) × 61 + 19) % 4093`, puis `h / 4093`. Les intermédiaires restent exactement représentables en GLSL haute précision. Le repli de graine est celui de T14, avec les mêmes collisions possibles. Glitch utilise `x = min(7, floor(progression × 8))` et la bande `y`, puis un décalage signé d'au plus `0,08 × intensité × 4p(1−p)` largeur d'image. Les UV sont bornées et les deux images mélangées par `smoothstep(p)` ; aucun gain lumineux, écran blanc ou noir clignotant n'est ajouté.

Zoom utilise le même mélange doux et les échelles `1 + intensité × smoothstep(p)` et `1 + intensité × (1−smoothstep(p))`. La transformation `(uv−0,5)/échelle + 0,5` reste dans l'image. Le volet de luminance interpole quatre valeurs de bruit aux sommets d'une case avec poids `smoothstep` en X/Y. Les zones claires apparaissent en premier. Avec douceur `f = 0,1 × intensité`, le seuil descend de `1+f` à `−f` ; un `smoothstep` autour de ce seuil donne la pondération de B, avec comparaison franche si `f=0`. Le masque est procédural, continu et borné dans [0,1].

Pour le split, la frontière A/B va doucement de 1 à 0,5 pendant le premier quart, reste à 0,5 pendant la moitié centrale, puis descend doucement à 0 pendant le dernier quart. Dans une région de largeur `w`, les UV X sont ramenées à cette largeur et Y devient `(v−0,5)/w+0,5`. Cette échelle identique sur les deux axes conserve le 16:9 et tout le cadrage ; les zones Y hors [0,1] sont des bandes noires opaques explicitement dessinées. La sortie reste exacte A/B aux extrémités. Aucun effet ne modifie les définitions ou les objets natifs des neuf caméras.

Les quatre shaders et le masque sont écrits localement. Aucune bibliothèque d'effets, texture ou ressource tierce n'est ajoutée. Les conversions de couleur de BabylonJS déjà utilisées restent sous Apache-2.0.

## Prévisualisation et tests hors direct à T16

Implémentation validée selon le [compte rendu T16](../validation/T16.md). Le contrôleur d'aperçu utilise exclusivement les leases du `FeedRouter`. Il suspend son ancienne source distincte avant de préparer la suivante et conserve la ressource de rollback jusqu'à présentation : trois sources du direct, un ancien aperçu suspendu et un candidat peuvent donner cinq allocations, avec quatre captations actives. Aucune source du direct n'est figée pour tenir ce budget. Les résultats portant une révision périmée sont libérés sans modifier le moniteur.

Le test possède une opération séparée, limitée au plus petit ID d'écran ciblé. Le moniteur reste lié à B comme matériau de base, le shader temporaire présente A/B et la fin du test retrouve B. A est partagée avec le direct ; un écran Sans signal fournit sa texture procédurale existante. La composition n'écrit jamais dans les matériaux du direct, ne valide aucune de ses routes et n'alloue pas de RTT supplémentaire. Les verrous de participants sont répercutés à l'édition.

La diffusion et la qualité sont prioritaires : leur directeur attend l'annulation du test et la libération de toutes les leases d'aperçu avant d'acquérir les ressources du direct. Après règlement, le contrôleur reprend la dernière sélection, même si elle a changé pendant la suspension. Une erreur de reprise reste explicite. Le changement de qualité et une diffusion ne peuvent pas préparer leurs pools en concurrence. Le moniteur ne détruit jamais une texture empruntée.

Une affectation identique n'acquiert aucune ressource du direct : elle arrête seulement le test et conserve l'aperçu simple existant. Le drag est refusé avant toute suspension ; les caméras du plan en attente sont déjà verrouillées. La recette contrôle les identifiants des textures pour détecter une recréation inutile, ainsi que l'annulation pendant l'attente de suspension.

Les API de surface, `StandardMaterial.emissiveTexture`, `RawTexture`, `RenderTargetTexture.renderList` et `Material.dispose` restent celles du paquet officiel 9.34.0 installé ; leurs signatures ont été inspectées. Les mires et le moniteur sont procéduraux et locaux, sans ressource externe ni nouveau paquet. Les rendus et cycles de vie sont validés dans le compte rendu propre à T16 ; NullEngine n'en valide pas les pixels.

## Contrats implémentés à T12

- `transitionSettings` normalise et gèle les réglages ; `planTransition` capture les routes et la séquence ; `transitionFrame` calcule les progressions.
- Les paramètres communs sont bornés : grille de 1 à 32 colonnes et de 1 à 18 lignes (8 × 4 par défaut), graine entière de 0 à 2³²−1, intensité de 0 à 1 (0,3 par défaut), direction parmi gauche/droite/haut/bas. Ces données sont disponibles pour les futurs adaptateurs ; leur rendu sera fixé par les références de T14/T15.
- `TransitionClock.sample` reçoit des temps monotones et les changements de visibilité. L'orchestrateur ne présente pas une fin de transition pendant que l'onglet est masqué.
- `TransitionOperation` exécute une seule commande et conserve l'annulation via `AbortController`. `RoutingDirector` demeure l'autorité des routes validées ; le chemin coupe utilise le `FeedRouter` existant avec un signal d'annulation.
- `TransitionDriver.prepare` doit libérer ses allocations partielles sur rejet/annulation ; une session préparée tardivement est abandonnée par `rollback`. `PreparedTransition.render` reçoit les progressions ; `commit` attend la présentation finale ; `complete` libère les réservations antérieures ; `rollback` restaure toute l'opération et doit être idempotent.
- `SharedSourcePort`/`SourceLease` définissent la future acquisition par consommateur ; leur implémentation dans le gestionnaire de flux existant appartient à T13. Aucune seconde réserve de textures ni passe supplémentaire n'est créée à T12.
- Le driver doit annoncer les modes réellement disponibles. Un mode sans adaptateur, y compris une séquence de coupes avec délai, est refusé sans bascule implicite vers une coupe simple.

## Sources et plafonds retenus

| Situation | RTT de captation actives au maximum |
| --- | ---: |
| Direct seul au repos | 3 |
| Direct avec aperçu ou test d'effet 2D | 4 |
| Préparation et transition 2D | 4 |
| Préparation, test ou diffusion de trajet virtuel séquentiel | 5 |

Une commande ajoute une destination B au maximum. Pour un trajet, une seule caméra temporaire s'ajoute aux anciennes sources et à B. L'aperçu simple est suspendu avant diffusion ou test de trajet ; ses consommateurs distincts sont libérés. Lors du remplacement d'un aperçu ou d'un changement de qualité au repos, suspendre son ancienne source distincte avant préparation, avec texture précédente conservée pour récupération. Ces opérations ne doivent pas dépasser leur plafond.

Compter séparément sources rendues, textures allouées et passes de composition. Garder les références nécessaires au rollback jusqu'à la dernière présentation réussie. Une ancienne source encore mélangée reste en direct ; une ressource de restauration qui n'est plus visible peut être suspendue, puis préparée à nouveau avant restauration. Les allocations partielles et résultats asynchrones périmés doivent être libérés même après une erreur ou un démontage.

Le calcul pur `sourceBudget` compte ces trois états et refuse les doublons de propriétaire, les dépassements de sources actives et un aperçu encore consommateur pendant une transition. Les plafonds GPU futurs seront appliqués dans les adaptateurs. La coupe actuelle conserve trois sources actives et quatre allocations transitoires au plus ; un remplacement de qualité peut conserver jusqu'à six allocations pour trois sources rendues. Un remplacement d'aperçu distinct peut conserver cinq textures pour quatre sources rendues, afin de restaurer son ancienne image en cas d'erreur. Avant diffusion ou changement de qualité, libérer le consommateur d'aperçu distinct, puis le recréer après l'opération ; il ne doit pas s'ajouter aux allocations de préparation. Les allocations de matériaux, mires et images de référence sont comptées séparément des RTT de captation.

## État, concurrence et interruptions

Capturer sources initiales, destination, cibles, effet, paramètres, durée et ordre. Distinguer routes validées, étapes déjà présentées et réglages de la prochaine commande. La validation globale survient après la dernière présentation ; annulation ou échec restaure toutes les routes initiales, même en séquence décalée. Une source initiale devenue indisponible produit « Sans signal » et une erreur explicite.

La pause du spectacle ne suspend pas une transition ; le masquage de l'onglet suspend sa propre horloge sans rattrapage. Le blur conserve les règles d'annulation des gestes d'édition de la [décision 0005](0005-edition-transactionnelle-et-entrees.md) et n'annule pas à lui seul une transition. Échap reste réservé à l'édition ; une commande dédiée annule le passage.

Verrouiller les mutations de pose/FOV des caméras participantes, refuser un lancement pendant un drag et une seconde diffusion concurrente, désactiver le changement de qualité pendant une opération. L'aperçu ne change aucune route ; il affiche l'ID réellement disponible, même si la sélection suivante est encore en préparation.

## Trajet virtuel

Utiliser une caméra temporaire hors registre 1…9, sans contrôle utilisateur. Interpoler position, orientation quaternion et FOV, sans toucher aux neuf définitions. Valider l'enveloppe du trajet complet contre le sol et les volumes déclarés avec une marge documentée. Refuser un trajet bloqué ; ne pas basculer implicitement vers un autre effet. Exécuter les trajets successivement pour plusieurs écrans.

## Conséquences et validation requise

Le budget cible augmente temporairement ; aucune cadence matérielle n'est garantie sans mesure. Les décisions 0004 et 0005 restent la description du socle : cette décision étend leur périmètre sans réécrire les validations passées.

T12 a validé les contrats purs, l'horloge, les refus, l'abandon des préparations, les consommateurs et le rollback avec des ports simulés, ainsi que la non-régression en mode coupe sous Windows/Chrome/SwiftShader. Voir le [compte rendu T12](../validation/T12.md) : 227 tests unitaires/intégration et 37 parcours navigateur validés, dont deux parcours longs relancés avec délai adapté. T13 à T18 ajouteront les adaptateurs et fonctions progressivement. Les tests WebGL2 devront contrôler les images intermédiaires des effets, couleurs, erreurs de shader, extrémités, exclusions de captation et ressources. NullEngine ne valide pas ces pixels.

T19 doit vérifier les scénarios 1 à 20 avec les nouveaux effets, 100 transitions, 20 cycles de montage/démontage et les performances Windows sur GPU matériel. Les chiffres historiques SwiftShader restent présentés comme résultats logiciels. L'adoption des contrats à T12 ne valide ni les futurs effets ni leur cadence.

## Précision T17 — premier lot du 14 novembre 2026

Le trajet retient jusqu'à trois points intermédiaires et des segments droits, parcourus avec une progression cubique par segment et une durée proportionnelle à leur longueur. Ce choix donne un arrêt progressif de position aux points, sans débordement géométrique ; une future courbe différente exigerait une autre validation de son enveloppe. L'orientation suit le SLERP court, FOV et clipping une progression cubique globale.

Le domaine valide une sphère centrée sur l'origine optique, de rayon `0,25 + max(nearA, nearB) × sqrt(1 + tan(max(FOVA, FOVB)/2)² × (1 + (16/9)²))` mètres. Chaque segment est intersecté continûment avec les boîtes d'obstacles dilatées de ce rayon, contact inclus. Cette approximation est conservatrice aux coins des boîtes et autour des treillis ; elle ne promet pas de chemin automatique ni de sujet constamment visible. Le pupitre incliné, son moniteur et son raccord sont représentés par leurs boîtes mondiales conservatrices. Les instruments, personnages et projecteurs ne participent pas à cette première détection.

`RoutingDirector` capture et valide toutes les étapes avant toute suspension d'aperçu ou acquisition. Les tests de ce lot couvrent calcul, capture, refus et inclusion des géométries fixes dans les volumes sous NullEngine. La caméra temporaire, son flux partagé par le propriétaire existant, la présentation, les commandes et la recette visuelle restent ouvertes. Ce complément ne déclare pas T17 terminée.

## Précision T17 — deuxième lot du 14 novembre 2026

La caméra temporaire et sa RTT sont désormais possédées par un adaptateur dédié, réservé exclusivement dans `FeedRouter` sous la clé `temporary`. Le pool existant compte cette source et ses consommateurs ; aucun gestionnaire parallèle n'est créé. Les anciennes sources et B restent actives, et la présence de tout consommateur d'aperçu empêche la réservation de trajet. Un contexte de trajet ne dépasse pas cinq sources actives.

L'adaptateur reprend la hiérarchie des rigs numérotés, le FOV vertical, les exclusions et la résolution de flux courante. Il ne s'enregistre pas dans les neuf caméras et ne change pas l'observateur. Une attente de pose rendue exige un dessin réel puis une fin d'image ; elle est rejetée sur changement de pose, annulation, erreur et arrêt. Les tests de source et de cycle de vie restent distincts de la future composition séquentielle, de la présentation finale vers B et du test hors direct. Voir le [suivi T17](../validation/T17.md) pour les validations et critères encore ouverts.

## Précision T17 — troisième lot du 14 novembre 2026

La session applicative de composition possède une réservation temporaire, les textures initiales et ses attentes annulables. Le port de rendu accepte désormais une promesse ; routeur et orchestrateur la transmettent et l'attendent. Les effets 2D restent synchrones. Aucun nouveau shader ou RTT de composition n'est nécessaire au trajet : les surfaces utilisent leurs matériaux vidéo ordinaires.

Présenter le départ puis le chemin capturé et l'extrémité B temporaire ; présenter ensuite le flux B avant de repositionner la caméra pour l'écran suivant. Un échantillon qui franchit plusieurs étapes les termine successivement, avec présentation de leurs extrémités. Les délais conservent les surfaces futures sur leurs sources initiales. La table de routes et les anciennes ressources restent inchangées jusqu'à la dernière présentation globale ; annulation ou panne restaure toutes les surfaces avant destruction temporaire, même après un relais déjà visible.

Le driver du direct choisit explicitement l'adaptateur de trajet. Sans cet adaptateur, le mode est refusé ; le compositeur 2D le refuse aussi. Le contrôleur d'aperçu refuse encore le test de trajet avant toute mutation, pour éviter une substitution silencieuse par un effet 2D pendant que les commandes et l'adaptateur hors direct restent à traiter. Les comparaisons GPU de pixels des sources et du framebuffer principal encadrent le relais visible ; elles ne valident pas à elles seules le confort artistique ni la recette complète T17.

## Précision T17 — quatrième lot du 14 novembre 2026

Le moniteur injecte désormais la même composition de trajet sur sa seule surface. Le contrôleur valide d'abord le plan capturé, verrouille ses participants en attente et libère l'aperçu simple avant les acquisitions du trajet. A reste un consommateur de trajet, B un consommateur de retour pour restauration. Après libération de la caméra temporaire et de A, la même RTT B reçoit une lease d'aperçu, sans nouvelle allocation, puis son consommateur de retour est retiré. Le budget autorise cinq sources en test puis quatre en aperçu. Les révisions empêchent une reprise après sélection, priorité du direct/qualité ou arrêt. Un moniteur sans factory dédiée continue de refuser le trajet.

Le catalogue utilisateur devient complet sans modifier les indices des shaders 2D : le trajet est ajouté après Split. Sa durée est de 2 secondes par défaut, bornée à 500…10 000 ms par pas de 500 ms. Une page de huit touches remplace les réglages pour éditer jusqu'à trois points, avec coordonnées bornées et pas de 0,5 m ; le texte d'état superposé est masqué. Les anciennes positions de boutons et les neuf rigs restent inchangés. Le mode séquentiel effectif est annoncé avant diffusion. La recette et ses limites figurent dans le [compte rendu T17](../validation/T17.md), distinct des mesures matérielles T19.

Le suivi natif de visibilité reste possédé par le driver pendant toute la vie de la scène après sa première utilisation. Les temps masqués sont retirés même lorsque le rendu attend une image et ne demande pas encore d'échantillon ; un aller-retour caché/visible pendant cette attente ne provoque donc pas de rattrapage. La scène retire ce listener à sa destruction. Le `TransitionClock` métier et l'horloge du spectacle conservent leurs responsabilités indépendantes.

## Précision T18 — commandes multiécrans du 15 novembre 2026

La page SÉQUENCE expose les six ordres et le délai borné, avec un résumé calculé par le plan métier et filtré avant décompte des intervalles. Le mode simultané/décalé est explicite pour les effets 2D ; le trajet impose la succession avec explication. Le pupitre mémorise le choix 2D avant d'entrer en trajet, puis le restaure au retour. Les réglages modifiés pendant un passage préparent seulement la commande suivante.

Une coupe décalée dont la durée totale est positive utilise la transaction 2D existante et ses sources A/B vivantes, avec quatre captations au maximum. Les extrémités exactes du shader suffisent, puisque la progression d'une coupe est toujours 0 ou 1. Une coupe instantanée utilise toujours le chemin du socle à trois captations. Le commit et la restauration restent globaux ; terminer un écran ne libère pas sa source initiale. Le trajet ne crée pas une source temporaire par étape ; le test hors direct ne répète pas la chorégraphie. Aucun nouveau propriétaire de RTT n'est ajouté. Le [rapport T18](../validation/T18.md) distingue ces vérifications de la future recette matérielle T19.

