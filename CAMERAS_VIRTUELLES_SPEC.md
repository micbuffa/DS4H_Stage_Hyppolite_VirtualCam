# Caméras virtuelles — spécification et tâches incrémentales

Version : 1.5 — 6 novembre 2026. Statut : T00 à T06 réalisées ; T07 est la prochaine tâche, non commencée ; T08 à T11 restent à réaliser. Documents associés : [instructions IA](AGENTS.md), [architecture](ARCHITECTURE.md), [bonnes pratiques BabylonJS](docs/BABYLONJS_BONNES_PRATIQUES.md).

## 1. Objectif pédagogique

Créer un laboratoire interactif BabylonJS où l'utilisateur réalise la retransmission d'un concert : il observe une scène 3D, positionne et oriente des caméras virtuelles avec la souris, puis distribue leurs images en direct sur trois écrans du concert.

L'expérience doit rendre compréhensibles la différence entre point de vue d'observation et caméra de captation, l'effet de la position, de l'orientation et du champ de vision, ainsi que la relation entre source vidéo et écran de destination.

Le décor évoque un festival rock en plein air, avec structures métalliques, instruments et éclairages colorés. Il ne reproduit pas une marque ou une scène réelle. Une esthétique low poly suffit ; le fonctionnement des caméras est prioritaire.

## 2. Hypothèses retenues et périmètre

- Application locale dans un navigateur de bureau compatible WebGL2, clavier et souris, interface française. Aucun backend requis.
- Neuf caméras de captation disponibles dès le démarrage, numérotées de 1 à 9, toutes éditables. Une caméra d'observation supplémentaire n'appartient pas à cette liste.
- Trois écrans physiques dans le monde 3D : écran 1 gauche, écran 2 droite, écran 3 central au-dessus du fond de scène. Gauche et droite sont définies du point de vue du public face à la scène.
- Sélectionner une caméra ne change pas la diffusion. L'utilisateur choisit les écrans cibles puis appuie sur « DIFFUSER » pour appliquer une coupe franche.
- Un écran reçoit au maximum une caméra ; une caméra peut alimenter un, deux ou trois écrans. Les trois écrans peuvent recevoir des sources distinctes.
- Socle avec modèles procéduraux, quatre musiciens et un public stylisé. Les assets détaillés sont facultatifs et ne doivent pas bloquer l'expérimentation.
- Aucun son, enregistrement vidéo, streaming réseau, webcam réelle, VR, multijoueur, montage temporel ou fondu requis.
- Sauvegarde des réglages et mouvements automatiques : extensions futures, hors tâches obligatoires.

Ces choix résolvent les ambiguïtés initiales et peuvent être ajustés avant l'implémentation sans changer l'objectif.

## 3. Implantation et contenu du concert

### 3.1 Repère et dimensions de départ

Unité : mètre ; Y vertical ; repère gauche BabylonJS. La scène est vers +Z depuis le public. Plateau d'environ 20 × 12 m, hauteur 1,5 m, centre à X=0, Z=10 ; sol d'environ 80 × 80 m. Le public occupe la zone Z négative, séparée du plateau par une barrière.

Les écrans latéraux, environ 8 × 4,5 m, sont placés vers X=-17 et X=17, Z=10, centres à Y=7, tournés vers le public. L'écran central, environ 6,4 × 3,6 m, est placé au fond du plateau, vers Z=15, centre à Y=8. Leur pose finale sera ajustée pour la lisibilité ; le format 16:9 reste invariant.

Le panneau de réalisation est au premier plan du point de vue initial, vers Z=-18. La vue initiale surélevée doit montrer simultanément le panneau, le plateau et les trois écrans. Une commande « VUE RÉGIE » rétablit cette vue sans changer les caméras ni la diffusion. Toutes les positions sont configurables dans un fichier dédié futur.

### 3.2 Éléments requis

- Plateau, toit, piliers/treillis, fond de scène, barrières et enceintes.
- Chanteur au centre avec micro, guitariste à gauche, bassiste à droite, batteur au fond sur une estrade.
- Guitare, basse, batterie reconnaissable avec cymbales, pieds de micro et amplificateurs. Les instruments sont de vrais volumes 3D, pas des images planes.
- Au moins 100 spectateurs stylisés, construits de façon déterministe et répartis sans pénétrer la barrière ni le plateau.
- Éclairage ambiant assurant la visibilité, éclairage de scène et au moins quatre projecteurs colorés représentés visuellement. Les faisceaux peuvent être des volumes stylisés sans simulation volumétrique.
- Animation légère des musiciens, de quelques spectateurs et des projecteurs. Un mode pause/reprise fige ces animations tout en gardant navigation, édition et diffusion actives.

## 4. Caméras et gestes à la souris

### 4.1 Caméra d'observation

Navigation orbitale autour du concert à la souris ; déplacement horizontal relatif au regard avec ZQSD (lettres AZERTY) ou les flèches ; zoom à la molette ou par défilement à deux doigts sur le trackpad. Le pincement traduisant un événement Ctrl+wheel suit également le zoom BabylonJS. Les commandes sont indiquées dans l'aide. Le canvas reçoit le focus au démarrage ; les touches ne sont capturées que lorsqu'il est actif, sans détourner la saisie des autres contrôles. La perte de focus ou le masquage de l'onglet arrête le déplacement ; les raccourcis avec Cmd/Ctrl/Alt sont préservés. Les commandes sont bornées pour éviter de passer sous le sol. Le clic sur un bouton ou un rig ne doit pas déclencher l'orbite. Le panneau reste fixé dans le monde ; « VUE RÉGIE » est toujours accessible via une aide 2D et la touche R hors champ de saisie.

### 4.2 Caméras de captation

Chaque caméra a un ID, un nom, une position, une orientation, un FOV vertical et des plans de clipping. Un boîtier 3D et un label C1…C9 matérialisent sa présence pour l'observateur. La caméra sélectionnée affiche son axe de visée et son frustum, activable/désactivable par « AIDES ».

| Caméra | Préréglage initial |
| --- | --- |
| C1 | Plan d'ensemble frontal, scène complète |
| C2 | Plan côté gauche vers chanteur et guitariste |
| C3 | Plan côté droit vers chanteur et bassiste |
| C4 | Plan rapproché chanteur |
| C5 | Plan rapproché guitariste |
| C6 | Plan rapproché bassiste |
| C7 | Plan batterie depuis un côté de l'estrade |
| C8 | Vue haute en plongée sur le plateau |
| C9 | Contrechamp depuis la scène vers le public |

Ces préréglages donnent des plans distincts et testables, sans imposer une précision artistique aux coordonnées.

### 4.3 Édition

1. Cliquer sur un boîtier ou sur un bouton caméra du panneau sélectionne la même caméra.
2. Choisir « DÉPLACER » ou « ORIENTER » affiche le gizmo approprié sur son rig.
3. Glisser les axes/plans du gizmo déplace la caméra ; glisser les anneaux modifie son orientation. Aucun gizmo d'échelle.
4. Le déplacement utilise le repère monde ; la rotation est locale. Le frustum et tout écran diffusant cette caméra se mettent à jour pendant le geste.
5. Les boutons « FOV − » et « FOV + » ajustent par pas de 5° le champ vertical entre 20° et 90°, sans toucher la vue d'observation.
6. « VISER LA SCÈNE » oriente la caméra vers le centre des musiciens, sans déplacer son origine. Refuser une cible confondue avec l'origine.
7. « RÉINITIALISER CAMÉRA » restaure uniquement le préréglage de la caméra sélectionnée ; les affectations d'écrans restent actives.

Contraintes initiales : X dans [-35,35], Y dans [0,5;25], Z dans [-35,25]. Écrêter les déplacements aux bornes ; rejeter les coordonnées non finies et les orientations invalides. Le FOV demandé hors bornes est écrêté. Clipping initial proposé : proche 0,1 m, lointain 200 m ; exiger 0 < proche < lointain. Pas de détection de collision avec le décor dans le socle ; l'aide explique qu'une caméra peut traverser un objet et perdre son cadrage.

Pendant un geste, la navigation d'observation est suspendue. Relâchement valide la pose ; Échap annule le geste et restaure la pose antérieure. Perte de focus ou `pointercancel` annule également et réactive les entrées. Sans geste actif, Échap quitte l'outil d'édition sans effacer la sélection. La caméra reste sélectionnable depuis le panneau même si son boîtier est masqué par le décor.

## 5. Panneau de réalisation et diffusion

### 5.1 Interface 3D

Panneau spatial assez grand pour lire les labels depuis la vue initiale sur un viewport de 1280 × 720. Il comporte :

- Une grille 3 × 3 de boutons numérotés 1 à 9, titrée « CAMÉRAS ».
- Une rangée de boutons 1 à 3, titrée « ÉCRANS CIBLES », avec les labels Gauche, Droite, Centre.
- Les commandes « TOUS LES ÉCRANS », « DIFFUSER », « DÉPLACER », « ORIENTER », « FOV − », « FOV + », « VISER LA SCÈNE », « RÉINITIALISER CAMÉRA », « AIDES » et « PAUSE/REPRENDRE ».
- Une zone d'état : « Caméra sélectionnée : Cn », FOV, cibles cochées et trois lignes « Écran n ← Cn » ou « Sans signal ».

La caméra sélectionnée a un contour et le texte « SÉLECTION ». Les cibles portent une coche ; les caméras effectivement diffusées portent un indicateur « EN DIFFUSION ». Une légende explique ces états sans dépendre uniquement des couleurs. Les commandes indisponibles sont visiblement désactivées avec une explication textuelle.

La régie est visible dans la vue principale ; elle n'apparaît dans aucune image de captation. La zone de statut affiche les erreurs de commande sans fenêtre bloquante. L'aide 2D complémentaire reste discrète et ne remplace pas les boutons 3D.

### 5.2 Règles de sélection et routage

- Démarrage : C1 sélectionnée, écran 1 seul coché, trois écrans diffusant C1. Les commandes d'édition sont inactives tant qu'aucun outil n'est choisi.
- Cliquer un bouton caméra remplace la sélection et le gizmo actif ; ne change aucune affectation.
- Cliquer un bouton écran inverse uniquement son appartenance à l'ensemble des cibles. Un ensemble vide est autorisé ; « DIFFUSER » est alors désactivé.
- « TOUS LES ÉCRANS » sélectionne les trois cibles, de façon idempotente.
- « DIFFUSER » affecte la caméra sélectionnée à toutes les cibles en une commande atomique. Les autres écrans conservent leur affectation. Les cibles restent cochées après la coupe.
- Une nouvelle affectation identique est un succès sans création de ressource supplémentaire.
- Un ID caméra ou écran invalide provoque un refus sans modification partielle.
- Une modification de pose ou de FOV se voit sur tous les écrans diffusant cette source, sans nouvelle coupe.
- Une erreur technique de création d'un flux conserve les affectations précédentes et affiche un message. Au démarrage, un flux indisponible laisse les écrans « Sans signal » avec un état d'erreur explicite.

### 5.3 Contrat visuel et technique des flux

Il s'agit d'images recalculées de la scène courante, pas de vidéos préenregistrées. Le flux ne contient ni boîtiers de caméras, ni frustums, ni gizmos, ni panneau, ni surfaces vidéo des écrans. Les cadres et structures des écrans peuvent être filmés. Toutes les surfaces vidéo sont exclues, même si elles utilisent une autre source, afin d'éviter les boucles indirectes.

Une RTT partagée par source diffusée, initialement 1024 × 576, format 16:9. Au plus trois RTT actives pour les écrans ; les neuf caméras existent sans imposer neuf passes vidéo. La caméra d'observation reste indépendante. La création d'une source et sa première image précèdent la bascule visible, au plus tard à l'image de présentation suivante après disponibilité ; une erreur de préparation annule la commande de routage.

Pas de moniteur de prévisualisation supplémentaire dans le socle : pour inspecter le cadrage d'une caméra, la diffuser sur l'écran de son choix. Un éventuel moniteur futur comptera explicitement comme consommateur de flux et modifiera le budget de rendu.

## 6. Scénarios d'acceptation globaux

1. À l'ouverture, voir le concert, quatre musiciens et leurs instruments, le public, les lumières, trois écrans actifs sur C1 et le panneau lisible.
2. Sélectionner C4 : constater le changement de sélection et le maintien des trois images C1.
3. Cibler l'écran 1 seulement puis diffuser : écran 1 sur C4, écrans 2 et 3 sur C1.
4. Déplacer et orienter C4 à la souris : sa représentation et l'image de l'écran 1 changent, la vue principale ne tourne pas durant le geste.
5. Sélectionner C7 et cibler les écrans 2 et 3 : diffuser C7 sur les deux ; écran 1 reste C4. Les écrans 2 et 3 partagent le même flux.
6. Faire diffuser respectivement C2, C5 et C9 : obtenir trois images distinctes en simultané.
7. Diffuser C8 sur tous les écrans : obtenir un flux unique partagé ; modifier son FOV et vérifier les trois cadrages.
8. Annuler un déplacement par Échap, puis par perte de focus : retrouver la pose précédente et pouvoir naviguer à nouveau.
9. Mettre le concert en pause, déplacer une caméra et changer la diffusion : le décor animé reste figé, la réalisation fonctionne.
10. Revenir à « VUE RÉGIE » : retrouver la vue initiale sans changer les poses ni les affectations.

## 7. Stratégie de tests

Chaque tâche fonctionnelle ci-dessous comprend des tests unitaires à créer lors de son implémentation. Ils portent sur une logique ou un contrat observable. Les tâches documentaires n'exigent pas de tests exécutables. Les tests d'intégration et navigateur complètent les unitaires ; ils ne les remplacent pas.

- **U — unitaires** : Vitest, état pur et ports simulés ; fixtures déterministes et erreurs contrôlées.
- **I — intégration** : BabylonJS `NullEngine` pour hiérarchie, synchronisation et cycle de vie compatibles, avec dépendances GUI/canvas isolées si nécessaire.
- **B — navigateur** : Playwright avec WebGL2 disponible, interactions réelles et contrôles visuels. Un environnement sans WebGL2 est signalé comme non validé, jamais comme une réussite implicite.
- **M — recette humaine** : lisibilité du panneau, qualité des plans et reconnaissance des instruments. Captures et environnement consignés.

Ne pas tester des pixels avec `NullEngine`. Les tests unitaires de gestion des flux utilisent un port simulé pour vérifier réutilisation, préparation, échec et libération ; le navigateur vérifie que l'image existe et correspond à la bonne caméra. Les animations sont figées à un instant connu pour comparer les captures. La mire asymétrique est un outil de test temporaire, absent du concert final.

## 8. Tâches incrémentales obligatoires

Les cases ne seront cochées qu'une fois les critères et tests satisfaits. Chaque étape doit laisser une application utilisable ; les fixtures provisoires nécessaires aux étapes initiales sont retirées quand leur remplacement est validé.

Suivi : `[DONE]` indique une tâche terminée et validée ; `[CURRENT]` désigne l’étape active à traiter. T07 est la prochaine tâche ; son implémentation n’a pas encore commencé. Les tâches suivantes restent sans marqueur.

### T00 [DONE] — Préparer la documentation pour les assistants

Livrables : ce document, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `ARCHITECTURE.md` et les bonnes pratiques.

- [x] Documentation créée, sans code ni dépendance installée.
- Validation documentaire : cohérence des identifiants, dépendances des tâches et liens locaux.

### T01 [DONE] — Initialiser le socle exécutable

Dépendance : T00. Implémentation autorisée le 6 novembre 2026. Créer l'outillage TypeScript/Vite, les scripts de développement, build, typecheck, lint, tests unitaires et navigateur. Créer le moteur, une scène vide éclairée et la caméra d'observation ; gérer resize et démontage.

- [x] Critères : démarrage reproductible documenté, erreurs WebGL compréhensibles, vue navigable, aucun callback restant après arrêt.
- Validation : 18 tests unitaires/intégration et 2 tests navigateur réussis ; voir [compte rendu T01](docs/validation/T01.md).
- **U** : configuration validée ; échec de création du moteur propagé proprement ; resize routé une seule fois ; arrêt idempotent retirant les abonnements via ports simulés.
- **I/B** : bootstrap/démontage, canvas redimensionné et scène visible sans erreur console.

### T02 [DONE] — Construire la scène et les trois écrans

Dépendance : T01. Créer plateau, structures, barrières, enceintes et les trois écrans nommés. Utiliser une texture de mire statique provisoire pour régler leurs faces et UV.

- [x] Critères : géométrie thématique séparée, positions conformes au repère, trois écrans 16:9 visibles depuis la vue régie.
- Extension demandée : déplacement ZQSD/flèches et zoom molette/trackpad, validés avec T02 ; voir [compte rendu T02](docs/validation/T02.md).
- **U** : validation dimensions et IDs ; calcul du ratio ; factories créant les trois définitions attendues sans doublon.
- **I** : racines, transformations et destruction des ensembles ; surfaces identifiées distinctement des cadres.
- **B/M** : mire non inversée, bon côté visible et implantation lisible.

### T03 [DONE] — Ajouter les musiciens et instruments

Dépendance : T02. Quatre personnages, leurs instruments et accessoires procéduraux ; assembler chaque musicien dans son thème.

- [x] Critères : volumes reconnaissables, placés sur le plateau, batterie sur estrade, aucune dépendance à un téléchargement externe.
- Validation initiale : 71 tests unitaires/intégration et 12 tests navigateur. Après correction d’un cas révélé par l’essai utilisateur (cache Vite partagé et chargement asynchrone des shaders), la suite comprend 75 tests unitaires/intégration et 14 tests navigateur ; voir [compte rendu T03](docs/validation/T03.md).
- **U** : descriptions des quatre rôles et leurs instruments ; validation des poses et calcul des ancrages locaux.
- **I** : présence des groupes attendus, parentage correct et suppression complète d'un groupe.
- **B/M** : reconnaissance des instruments et absence d'interpénétration majeure.

### T04 [DONE] — Créer les neuf caméras et leurs représentations

Dépendances : T03. Registre, préréglages, boîtiers, labels, sélection unique et retour à la vue régie ; sélection provisoire par clic sur boîtier avant le panneau T08.

- [x] Critères : neuf plans distincts, observation indépendante, aide/frustum de la sélection activable.
- Validation : 101 tests unitaires/intégration et 17 tests navigateur réussis ; voir [compte rendu T04](docs/validation/T04.md).
- **U** : IDs uniques 1..9 ; ID invalide refusé ; sélection unique ; sélection sans effet sur routage ; réinitialisation du préréglage ciblé uniquement.
- **I** : neuf caméras plus observation ; synchronisation pose/rig ; un seul frustum de sélection (gizmos d’édition à T07) ; aucun contrôle souris attaché aux caméras de captation.
- **B** : picking des boîtiers, retour régie sans modification métier.

### T05 [DONE] — Établir un premier flux de captation

Dépendance : T04. Afficher C1 sur l'écran 1 via une RTT ; les autres écrans gardent la mire pendant cette étape. Introduire le gestionnaire de flux et le filtrage des éléments filmables.

- [x] Critères : image en direct, pas de récursion, pas d'aide dans le flux, format correct même avec canvas non 16:9.
- Validation : 113 tests unitaires/intégration et 19 tests navigateur réussis, contrôle direct du serveur 5188 ; voir [compte rendu T05](docs/validation/T05.md).
- **U** : constitution du filtre par catégorie ; exclusion des trois surfaces vidéo et de toutes les aides ; inclusion d'un musicien ajouté après initialisation ; configuration du ratio.
- **I** : caméra du flux et liste de rendu correctes ; enregistrement unique de la RTT ; caméra principale conservée avant/après la passe.
- **B** : mire asymétrique temporaire, projection cohérente et mouvement visible en direct ; aucune erreur GPU liée à une lecture/écriture de la même texture.

### T06 [DONE] — Généraliser le routage sur trois écrans

Dépendance : T05. État de réalisation, cibles multiples, commande atomique, partage des RTT et états sans signal/erreur. Démonstration via adaptateur de commande provisoire avant T08.

- [x] Critères : 1→N et trois sources simultanées ; sélections indépendantes ; initialisation finale des trois écrans sur C1.
- Validation : 141 tests unitaires/intégration et 23 tests navigateur réussis ; contrôle direct du serveur 5188 sans erreur et shaders HTTP 200. Voir [compte rendu T06](docs/validation/T06.md).
- **U** : table d'affectation pour tous les sous-ensembles non vides des trois écrans ; cibles vides ; IDs invalides ; idempotence ; préservation des écrans non ciblés ; source partagée ; suppression du dernier consommateur ; échec de préparation sans effet partiel.
- **I** : une RTT pour trois écrans sur C1 ; trois RTT pour trois sources ; retour à une RTT après regroupement ; arrêt détruisant une seule fois les ressources partagées.
- **B** : scénarios globaux 2, 3, 5, 6 et 7 ; aucune image noire transitoire issue d'un tampon non initialisé lors d'une coupe prête.

### T07 [CURRENT] — Manipuler les caméras à la souris

Dépendance : T06. Gizmos de position et rotation, FOV, visée scène, annulation et réinitialisation ; commandes provisoires accessibles en attendant T08.

- [ ] Critères : édition à la souris dans les trois axes, effet en direct sur tous les écrans concernés, navigation restaurée après toute sortie de geste.
- **U** : bornes spatiales/FOV ; rejets NaN et infini ; quaternion invalide ; conversions degrés/radians ; cible dégénérée ; clipping invalide ; commit/annulation d'une pose ; arbitrage des modes d'entrée et restauration après erreur.
- **I** : pose réelle synchronisée sans double transformation ; attachement au seul rig sélectionné ; frustum mis à jour ; réinitialisation sans changement d'affectation.
- **B** : drag position/rotation ; FOV ; Échap ; perte de focus et `pointercancel` ; caméra d'observation immobile pendant le geste et navigable après.

### T08 — Construire le panneau de réalisation 3D

Dépendances : T06 et T07. Remplacer les contrôles provisoires par le panneau complet décrit en section 5 ; ajouter aide et état accessibles à tout moment.

- [ ] Critères : neuf boutons caméra et trois boutons écran distincts, toutes les commandes prévues, labels lisibles, états sélection/cibles/diffusion séparés.
- **U** : modèle de présentation des 12 boutons numérotés ; basculement des cibles ; sélection de toutes ; DIFFUSER désactivé si aucune cible ; correspondance de chaque commande ; labels après réussite/échec ; un clic consommé produit une seule commande.
- **I** : souscriptions état/interface nettoyées ; boutons synchronisés après sélection via boîtier.
- **B/M** : cliquer les vrais boutons par picking ; survol puis clic sans mouvement parasite ; contrôle à 1280 × 720 ; absence du panneau dans chaque flux ; scénario complet sans console ni outil de développement.

### T09 — Ajouter le public

Dépendance : T08. Public déterministe, distribué dans les zones autorisées et basé sur des ressources partagées.

- [ ] Critères : au moins 100 spectateurs, lisibles depuis C9, sans bloquer la manipulation ; population paramétrable.
- **U** : même graine donnant la même distribution ; nombre demandé ; zones interdites et marges respectées ; zéro population accepté et nombre négatif refusé.
- **I** : instances/matériaux partagés et destruction complète ; public ajouté aux éléments filmables.
- **B/M** : contrechamp C9 avec public et absence d'interception indésirable du picking des contrôles.

### T10 — Ajouter éclairages et animations

Dépendance : T09. Ambiance rock, projecteurs, mouvements légers, pause/reprise ; commencer avec budget d'ombres limité.

- [ ] Critères : éclairages visibles dans les flux, musiciens lisibles, animation indépendante du nombre d'images, pause compatible avec la régie.
- **U** : couleurs/intensités dans les bornes ; trajectoires à temps connu ; équivalence de deux découpages temporels ; pause sans saut à la reprise ; pas de progression pendant pause ; plafonnement du delta après onglet masqué.
- **I** : transformations attendues ; observateurs désabonnés au démontage ; éléments animés conservés dans les listes des flux.
- **B/M** : quatre projecteurs représentés, animation visible sur écrans, absence de surexposition majeure ; scénario global 9.

### T11 — Stabiliser, mesurer et documenter l'expérimentation

Dépendance : T10. Exécuter les scénarios globaux, traiter les erreurs et documenter les commandes ainsi que les mesures.

- [ ] Critères : tous les tests requis réussis ; captures de trois sources distinctes ; guide utilisateur et bilan des performances.
- **U** : états dégradés sur perte de disponibilité d'un port ; refus de commande après arrêt ; politique de qualité avec valeurs bornées ; changement de résolution sans changement d'affectation ; aucune double libération après réaffectations répétées.
- **I/B** : 100 coupes alternées entre une et trois sources, puis 20 cycles de montage/démontage ; pas d'accumulation d'observateurs, de RTT ou de ressources possédées après stabilisation.
- **B/M** : recette des dix scénarios globaux, resize du canvas, clavier/souris, absence d'erreurs console/GPU ; consigner toute limitation.

## 9. Objectifs de performance et définition de terminé

Cible indicative : au moins 30 images/s en moyenne sur une séquence de 60 secondes après 10 secondes de chauffe, canvas 1280 × 720, ratio de pixels plafonné à 1,5, 100 spectateurs et trois sources vidéo distinctes à 1024 × 576. La machine de référence n'étant pas encore définie, cette cible doit être confirmée et mesurée sur la machine d'expérimentation ; aucune garantie universelle n'est avancée.

Consigner OS, navigateur/version, CPU/GPU, ratio de pixels, résolution réelle du canvas, qualité des ombres, nombre de meshes/draw calls et RTT actives. Rapporter moyenne et 95e percentile du temps d'image. Tester avec onglet visible. En cas de cible manquée, documenter la cause et un profil réduit proposé, par exemple RTT 512 × 288 ; ne pas masquer une baisse de qualité dans les résultats.

Le socle est terminé quand T01 à T11 sont validées, que les dix scénarios fonctionnent, que chaque feature possède ses tests unitaires et ses validations complémentaires, que l'architecture est respectée et que le guide permet à un nouvel utilisateur de manipuler une caméra et de diffuser son image sur plusieurs écrans. Toute vérification non exécutée reste indiquée comme telle.

## 10. Extensions possibles après le socle

Sauvegarder/restaurer les poses et affectations dans un format versionné ; ajouter un moniteur de prévisualisation ; mouvements de travelling ; suivi d'un musicien ; transitions ; assets GLB détaillés ; son ; profils de qualité supplémentaires. Chacune nécessitera sa propre tâche, ses critères et ses tests avant implémentation.
