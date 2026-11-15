# Caméras virtuelles — spécification et tâches incrémentales

Version 2.2 du 15 novembre 2026. T00 à T18 sont réalisées et validées selon leurs comptes rendus. Les onze passages 2D, le trajet virtuel avec points éditables, la prévisualisation, leur test hors direct et les séquences multiécrans sont disponibles au pupitre. T18 consigne 402 tests locaux et 54 parcours navigateur couverts sous Windows/SwiftShader, avec un blocage de démarrage lors de la longue sélection puis réussite du cas rejoué isolément. T19 est la prochaine étape et n'a pas commencé ; la stabilité en longue série et les performances sur GPU matériel restent à confirmer. Documents associés : [instructions IA](AGENTS.md), [architecture](ARCHITECTURE.md), [bonnes pratiques BabylonJS](docs/BABYLONJS_BONNES_PRATIQUES.md).

## 1. Objectif pédagogique

Créer un laboratoire interactif BabylonJS où l'utilisateur réalise la retransmission d'un concert : il observe une scène 3D, positionne et oriente des caméras virtuelles avec la souris, puis distribue leurs images en direct sur trois écrans du concert.

L'expérience doit rendre compréhensibles la différence entre point de vue d'observation et caméra de captation, l'effet de la position, de l'orientation et du champ de vision, ainsi que la relation entre source vidéo et écran de destination.

Le décor évoque un festival rock en plein air, avec structures métalliques, instruments et éclairages colorés. Il ne reproduit pas une marque ou une scène réelle. Une esthétique low poly suffit ; le fonctionnement des caméras est prioritaire.

## 2. Hypothèses retenues et périmètre

- Application locale dans un navigateur de bureau compatible WebGL2, clavier et souris, interface française. Aucun backend requis.
- Neuf caméras de captation disponibles dès le démarrage, numérotées de 1 à 9, toutes éditables. Une caméra d'observation supplémentaire n'appartient pas à cette liste.
- Trois écrans physiques dans le monde 3D : écran 1 gauche, écran 2 droite, écran 3 central au-dessus du fond de scène. Gauche et droite sont définies du point de vue du public face à la scène.
- Sélectionner une caméra ne change pas la diffusion. L'utilisateur choisit les écrans cibles et le passage, puis appuie sur « DIFFUSER ». La coupe reste le mode initial ; T13 à T15 ajoutent les dix effets 2D du catalogue décrit en section 5.4 et T17 le trajet virtuel, ses points éditables et son test hors direct.
- Une affectation validée associe au maximum une caméra à chaque écran ; une caméra peut alimenter un, deux ou trois écrans. Pendant une transition, l'image présentée peut combiner les deux sources de départ et d'arrivée. Les trois écrans peuvent recevoir des sources distinctes.
- Socle avec modèles procéduraux, quatre musiciens et un public stylisé. Les assets détaillés sont facultatifs et ne doivent pas bloquer l'expérimentation.
- Aucun son, enregistrement vidéo, streaming réseau, webcam réelle, VR, multijoueur ou montage temporel requis. Les fondus, effets et trajets de transition deviennent des exigences de la nouvelle phase, sans modifier rétroactivement la recette du socle.
- Sauvegarde des réglages, travelling permanent et suivi automatique : extensions futures. Le trajet temporaire entre deux cadrages appartient à la phase transitions.

Ces choix résolvent les ambiguïtés initiales et peuvent être ajustés avant l'implémentation sans changer l'objectif.

## 3. Implantation et contenu du concert

### 3.1 Repère et dimensions de départ

Unité : mètre ; Y vertical ; repère gauche BabylonJS. La scène est vers +Z depuis le public. Plateau d'environ 20 × 12 m, hauteur 1,5 m, centre à X=0, Z=10 ; sol d'environ 80 × 80 m. Le public occupe la zone Z négative, séparée du plateau par une barrière.

Les écrans latéraux, environ 8 × 4,5 m, sont placés vers X=-17 et X=17, Z=10, centres à Y=7, tournés vers le public. L'écran central, environ 6,4 × 3,6 m, est placé au fond du plateau, vers Z=15, centre à Y=8. Leur pose finale sera ajustée pour la lisibilité ; le format 16:9 reste invariant.

Le panneau de réalisation est au premier plan à droite, à Z = −12. La vue initiale surélevée doit montrer simultanément le panneau, le plateau et les trois écrans. Une commande « VUE RÉGIE » rétablit cette vue sans changer les caméras ni la diffusion. La position et la disposition du panneau sont définies dans `src/domain/direction/panelLayout.ts`.

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
- « DIFFUSER » capture la caméra sélectionnée, les cibles et les réglages du passage. La table validée change en une commande atomique après présentation finale ; pendant un effet, les anciennes routes restent indiquées avec les participants et la progression. Les autres écrans conservent leur affectation. Les cibles restent cochées après le passage.
- Une nouvelle affectation identique est un succès sans création de ressource supplémentaire.
- Un ID caméra ou écran invalide provoque un refus sans modification partielle.
- Hors verrou de transition, une modification de pose ou de FOV se voit sur tous les écrans diffusant cette source, sans nouvelle coupe. Pendant un passage, les caméras participantes sont verrouillées ; les autres restent éditables.
- Une erreur technique de création d'un flux conserve les affectations précédentes et affiche un message. Au démarrage, un flux indisponible laisse les écrans « Sans signal » avec un état d'erreur explicite.

### 5.3 Contrat visuel et technique des flux

Il s'agit d'images recalculées de la scène courante, pas de vidéos préenregistrées. Le flux ne contient ni boîtiers de caméras, ni frustums, ni gizmos, ni panneau, ni surfaces vidéo des écrans. Les cadres et structures des écrans peuvent être filmés. Toutes les surfaces vidéo sont exclues, même si elles utilisent une autre source, afin d'éviter les boucles indirectes.

Une RTT partagée par source diffusée, initialement 1024 × 576, format 16:9. Dans le socle, au plus trois RTT actives pour les écrans ; les neuf caméras existent sans imposer neuf passes vidéo. Le budget supplémentaire de la phase transitions est défini en section 5.4. La caméra d'observation reste indépendante. La création d'une source et sa première image précèdent la bascule visible, au plus tard à l'image de présentation suivante après disponibilité ; une erreur de préparation annule la commande de routage.

Le socle T00 à T11 n'avait pas de moniteur de prévisualisation. Depuis T16, le moniteur hors direct permet d'inspecter un cadrage sans le diffuser ; il compte explicitement comme consommateur partagé ou distinct selon la section 5.4.

### 5.4 Nouvelle phase — Transitions et préparation du plan suivant

**Statut : contrats T12, effets 2D T13 à T15, prévisualisation T16, trajets T17 et chorégraphie T18 validés selon leurs rapports.** Les douze passages sont disponibles, avec aperçu et test sur le moniteur hors direct, ordre et délai au pupitre. La recette finale de stabilité et de performance matérielle reste à T19. Les limites à trois passes figurant dans les décisions historiques concernent la coupe du socle ; les effets 2D, les coupes décalées et l'aperçu autorisent quatre sources actives, les trajets cinq. L'architecture et les bonnes pratiques distinguent l'implémentation de la cible ; la [décision 0006](docs/decisions/0006-transitions-previsualisation-et-budgets.md) consigne les contrats, budgets, politique de couleurs et propriété des effets.

#### 5.4.1 Intention et catalogue

Apprendre à choisir un plan, le moment du changement et son traitement visuel. Un effet spectaculaire attire l'attention sur le passage ; il ne garantit pas que le changement devienne imperceptible. Les raccords et le choix des cadrages restent des techniques de réalisation manuelles.

| Mode / identifiant stable | Comportement attendu | Exemple pédagogique |
| --- | --- | --- |
| Coupe / `cut` | Remplacement direct après préparation de B ; fonctionnement du socle conservé | Entrée du solo, accent musical |
| Fondu enchaîné / `dissolve` | Mélange des images A et B, toutes deux en direct | Plan général vers chanteur, passage calme |
| Fondu au noir / `dip-black` | A descend au noir, puis B apparaît ; noir au milieu de la durée | Fin de morceau ou changement d'ambiance |
| Volet / `wipe` | B est révélée par un bord progressif ; directions gauche, droite, haut, bas | Passage graphique simple |
| Rolling Cubes / `rolling-cubes` | Une grille de blocs donne l'illusion de pivoter pour révéler B | Scénographie dynamique |
| Mosaïque / `mosaic` | Des cases révèlent B dans un ordre déterministe | Fragmentation graphique |
| Grid Morph / `grid-morph` | Une grille déforme les deux images pendant leur remplacement | Transformation visuelle stylisée |
| Glitch / `glitch` | Décalages et distorsions temporaires, sans clignotements plein écran répétés | Accent visuel bref |
| Zoom de transition / `zoom` | Transformation de l'image accompagnant le remplacement par B | Accent dynamique, sans modifier le FOV des caméras |
| Volet de luminance / `luma-wipe` | Un masque procédural de luminance révèle B | Apparition par zones claires ou sombres |
| Trajet virtuel / `virtual-travel` | Un point de vue temporaire rejoint le cadrage B depuis A | Déplacement continu dans le concert |
| Écran partagé / `split` | A et B apparaissent côte à côte, puis B occupe tout l'écran | Montrer deux musiciens pendant le passage |

Paramètres des grilles T14 : 8 × 4 cases, graine 0 et intensité 0,3 par défaut. Borner la grille à 1…32 colonnes et 1…18 lignes, la graine entière à 0…2³²−1 et l'intensité à 0…1. Le pupitre propose les grilles 4 × 2, 8 × 4, 16 × 9 et 32 × 18, des touches de graine −/+ et une intensité par pas de 0,1 avec retour à zéro après 1. La page RÉGLAGES GRILLE remplace les commandes effet/durée ; RETOUR EFFETS les retrouve et ANNULER TRANSITION reste accessible.

Le calendrier des cases est déterministe, avec départs répartis sur les premiers 40 % et progression locale sur 60 % de la durée. Le hash entier, son repli de graine dans 4 093 valeurs et ses collisions possibles sont définis dans la [décision 0006](docs/decisions/0006-transitions-previsualisation-et-budgets.md). Rolling Cubes simule un quart de tour orthographique et utilise l'intensité comme relief d'ombrage ; Mosaïque utilise un petit fondu local et ne propose pas d'amplitude ; Grid Morph déplace les UV de A/B en sens opposés, jusqu'à 0,8 × intensité case. Les bords de cases et les extrémités temporelles annulent la déformation ; les UV restent dans l'image. Aucun mesh ni RTT par case.

Ces noms définissent les comportements du projet et n'imposent aucune bibliothèque. Les variantes graphiques exactes doivent être fixées par captures de référence lors de leur tâche. Le zoom est un effet 2D ; le trajet virtuel est un mouvement 3D. Pour l'écran partagé, conserver le ratio des images avec bandes si nécessaire, sans étirement ni perte implicite de cadrage.

Variantes retenues à T15 : le Glitch décale horizontalement des bandes en huit phases déterministes, avec enveloppe nulle au départ et à l'arrivée, déplacement maximal de 0,08 × intensité largeur d'image et UV bornées ; il n'ajoute aucun flash ni multiplicateur de luminosité. Le nombre de bandes utilise les lignes de la grille. Le Zoom mélange A/B avec progression douce et transforme leurs UV autour du centre ; ses échelles sont `1 + intensité × progression douce` pour A et `1 + intensité × (1 − progression douce)` pour B. Aucun FOV ni pose de caméra ne change.

Le volet de luminance utilise un bruit de valeurs interpolé sur la grille, normalisé entre 0 et 1 et déterminé par la graine ; les zones claires révèlent B en premier. L'intensité règle une douceur de seuil de 0 à 0,1, avec seuil dur à zéro. Le seuil dépasse les bornes du masque aux extrémités pour éviter une apparition brusque. L'écran partagé réserve le premier quart de la durée à l'ouverture de B, la moitié centrale aux deux images à parts égales, puis le dernier quart à l'agrandissement de B. Chaque image est ajustée dans sa région avec la même échelle X/Y et des bandes noires définies, en conservant son cadrage complet. Ces paramètres restent capturés à DIFFUSER ; le partage n'a pas de réglage supplémentaire hors durée.

#### 5.4.2 Commandes et états de la régie

- Ajouter au panneau 3D le choix « TRANSITION », « DURÉE − / + », « PRÉVISUALISER », « ANNULER TRANSITION » et le mode de passage « SIMULTANÉ / DÉCALÉ ». Une pagination thématique est autorisée si tous les boutons ne restent pas lisibles à 1280 × 720. L'aide 2D explique les modes et durées.
- Au démarrage, `cut` est choisi. Pour les effets 2D, durée par défaut de 600 ms, réglable de 100 à 3 000 ms par pas de 100 ms. Pour `virtual-travel`, 2 000 ms par défaut, de 500 à 10 000 ms par pas de 500 ms. La coupe a une durée effective nulle. Refuser les valeurs non finies et les modes inconnus ; écrêter les durées finies aux bornes du mode.
- Changer la sélection, les cibles ou les réglages prépare le prochain passage sans modifier les écrans. « DIFFUSER » capture destination, cibles, mode, paramètres, durée et ordre de passage au moment de la commande.
- La zone d'état distingue « Préparation », « Transition Cn → Cm : n % », « En diffusion », « Annulée » et « Erreur ». Pendant le mélange, indiquer les deux sources participantes ; l'affectation validée demeure A jusqu'à la présentation finale de B. Les écrans non ciblés restent inchangés.
- Une seule opération de diffusion est active pour toute la régie. Une deuxième commande est refusée explicitement, sans file cachée. Les sélections peuvent préparer la suivante sans retoucher l'opération en cours.
- Si toutes les cibles diffusent déjà B, succès immédiat sans effet ni nouvelle ressource. Dans un ensemble mixte, seules les cibles dont la source change participent à la transition. Un état « Sans signal » utilise une image procédurale définie comme départ, sans lire de texture absente.
- Pendant une transition, interdire les commandes modifiant la pose, le FOV ou le préréglage des caméras participantes ; les autres caméras restent éditables. Refuser le lancement pendant un drag actif. Désactiver le changement de profil vidéo pendant l'opération, avec explication.
- « ANNULER TRANSITION » restaure ensemble les affectations antérieures des cibles, y compris celles déjà passées en mode décalé. Une erreur de préparation ne modifie aucun écran. Une erreur pendant le passage restaure les routes précédentes et affiche sa cause ; si une ancienne source est elle-même indisponible, afficher « Sans signal » avec erreur explicite.
- Les transitions possèdent une horloge injectable indépendante de celle du concert. La pause du spectacle ne les arrête pas. Le masquage de l'onglet suspend leur horloge sans rattrapage au retour ; un simple blur ne les annule pas. Le démontage annule et libère toutes les ressources temporaires. Échap conserve les règles d'édition existantes ; l'annulation de transition utilise sa commande dédiée.

#### 5.4.3 Composition des images et ressources

- Pour un effet 2D, composer les textures A et B sur les surfaces vidéo uniquement, sans effet sur la vue d'observation. Les deux flux restent animés durant le passage, même si A n'est plus la destination finale d'aucun écran. Aucun gel caché d'une ancienne image pour tenir le budget.
- À progression 0, retrouver exactement A ; à progression 1, exactement B. Le fondu enchaîné utilise une progression continue et monotone ; les autres effets ont des paramètres bornés et un résultat déterministe à temps et graine identiques. Pas de pixel non initialisé, d'inversion UV, d'étirement, de récursion ou de saut de couleur aux extrémités. Le noir intermédiaire de `dip-black` est intentionnel.
- Une seule source B est demandée par commande. Avec au plus trois anciennes sources, autoriser au maximum **quatre RTT de captation actives pendant une transition 2D**, puis revenir à trois au plus. Partager chaque RTT entre ses consommateurs ; les surfaces composent les textures sans imposer une RTT de composition supplémentaire par écran.
- Le trajet virtuel est exécuté séquentiellement par écran : au maximum trois anciennes sources, une source B et un point de vue temporaire, soit **cinq RTT de captation actives** au pic. Leurs durées de possession sont explicites, même si certaines ressources peuvent être réutilisées.
- La prévisualisation décrite ci-dessous est suspendue et sa consommation distincte libérée avant la préparation d'une diffusion. Hors transition, elle ajoute au maximum une source aux trois sources du direct, soit quatre RTT de captation actives. Lors du remplacement de l'aperçu, suspendre son ancienne source distincte avant de préparer la suivante, en conservant sa texture et son ID pour récupération. Suspendre aussi l'aperçu pendant un changement de profil vidéo au repos, puis le rétablir. Aucun cumul non borné entre prévisualisation, préparation et trajet.
- Compter séparément les passes de scène, les textures allouées et la composition sur les écrans. Les plafonds ci-dessus portent sur les passes de captation ; toute allocation temporaire supplémentaire doit être documentée dans la décision T12 et vérifiée. Conserver les exclusions de captation du socle pour tous les nouveaux flux.
- Préparer les shaders, textures et premières images nécessaires avant le départ. Conserver les anciennes ressources jusqu'à la première présentation finale réussie ; revenir à l'état antérieur en cas d'échec. Une ressource partagée n'est détruite qu'après le départ de son dernier consommateur, à un point sûr du rendu.
- Commencer par des effets procéduraux locaux ; toute reprise de shader, masque ou bibliothèque externe exige provenance et licence documentées. Vérifier les API de la version BabylonJS installée avant l'implémentation ; aucune signature ni dépendance nouvelle n'est présumée ici.

#### 5.4.4 Prévisualisation avant diffusion

Un moniteur sur le pupitre montre la caméra sélectionnée après activation de « PRÉVISUALISER », sans changer le direct. Il est exclu de tous les flux. La sélection suivante remplace son aperçu après disponibilité ; les échecs conservent l'aperçu précédent avec son ID clairement affiché et un message d'erreur.

À T16, l'extension gauche porte aussi « MASQUER L'APERÇU » et « ARRÊTER LE TEST ». Les textes distinguent demande, source réellement liée, référence, test, suspension et erreur. Le test couvre les onze passages 2D et, depuis T17, le trajet décrit ci-dessous. Une affectation identique interrompt un éventuel test sans recréer la texture de l'aperçu simple. Les gardes de drag sont vérifiées avant suspension et les participants sont verrouillés dès l'attente de préparation.

Un mode « TESTER L'EFFET » joue l'effet choisi uniquement sur le moniteur à partir de la source de l'écran cible de référence : plus petit ID ciblé, indiqué textuellement. Il utilise les sources du direct partagées et au plus une source sélectionnée supplémentaire. Sans cible, la prévisualisation simple reste possible, mais le test de transition est désactivé. Le trajet est testé pour ce seul écran avec la même politique de budget que la diffusion, après suspension de l'aperçu simple. Aucun aperçu ne modifie les routes, les poses de C1…C9 ou la caméra d'observation. La diffusion interrompt le test et restaure l'aperçu simple à sa fin ou après annulation.

#### 5.4.5 Trajet virtuel et chorégraphie multiécran

Le trajet emploie une caméra temporaire hors numérotation 1…9, sans commandes de navigation. Ses positions et FOV sont interpolés avec départ et arrivée progressifs ; ses orientations utilisent une interpolation quaternion par le chemin court. Les poses de départ et d'arrivée sont capturées au lancement, sans modifier les préréglages ni les rigs. La dernière image temporaire correspond au cadrage B, puis le flux B prend le relais sans saut visible.

Prévoir un trajet direct et des points de passage réglables avant lancement. Valider l'enveloppe du mouvement contre le sol et les volumes d'obstacles explicitement déclarés (plateau, structures, écrans et pupitre), avec une marge documentée. Refuser un trajet bloqué et proposer une coupe ou un effet 2D ; ne jamais changer silencieusement de mode. Les occultations par d'autres objets restent possibles et doivent être visibles en prévisualisation. Le système ne promet pas une recherche automatique universelle de chemin ni une visibilité permanente du sujet.

Pour les effets 2D, le mode simultané lance toutes les cibles sur la même horloge, chacune depuis sa source A vers B. Le mode décalé utilise par défaut Centre → Gauche → Droite, filtré selon les cibles ; le panneau permet de choisir l'ordre. Chaque passage commence après la fin du précédent et un délai réglable de 0 à 1 000 ms, par pas de 100 ms, nul par défaut. Le trajet virtuel impose cette séquence même si « SIMULTANÉ » avait été choisi, avec explication avant lancement. L'opération complète reste unique et annulable jusqu'à sa dernière présentation.

#### 5.4.6 Situations de réalisation à enseigner

| Situation | Proposition de plans et de passage |
| --- | --- |
| Début du concert | Plan général, puis chanteur à son entrée |
| Couplet calme | Plan rapproché, fondu modéré vers un autre cadrage |
| Début d'un solo | Coupe sur le guitariste ou le batteur au moment de son intervention |
| Refrain énergique | Coupes sur les accents, alternance groupe, chanteur et public |
| Applaudissements | Scène → public → plan général tenu |
| Fin de morceau | Plan général puis fondu au noir |
| Deux plans trop proches | Intercaler un plan du public ou de la batterie pour éviter un saut de cadrage |
| Continuité de geste | Préparer deux cadrages cohérents puis couper pendant le même mouvement |
| Coupe masquée | Préparer une sortie et une entrée derrière un obstacle ou un panoramique rapide cohérent |
| Scénographie | Rolling Cubes, Mosaïque, Grid Morph, écran partagé ou passage décalé entre écrans |

Ces exemples sont des exercices manuels, pas une synchronisation musicale automatique. Le projet n'a pas de son ni d'analyse de rythme. Les raccords dans le mouvement, par obstacle et par panoramique rapide sont documentés comme pratiques ; leur détection ou génération automatique n'est pas requise.

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

### Scénarios complémentaires de la phase transitions

11. Conserver les dix scénarios du socle en mode coupe ; choisir un effet sans changer le direct.
12. Diffuser C4 depuis C1 par fondu de 600 ms sur l'écran 1 : contrôler début, mélange et fin ; les deux autres écrans restent sur C1.
13. Partir de C2, C5 et C9 sur les trois écrans, puis diffuser C8 sur tous : départs distincts, arrivée commune, au plus quatre sources actives pour un effet 2D et une seule après retour au repos sans aperçu.
14. Pour chaque effet du catalogue 2D, inspecter des images déterministes à 0, 25, 50, 75 et 100 % avec mire asymétrique, puis avec concert animé. Vérifier noir intentionnel, directions, ratio et absence d'aides.
15. Prévisualiser une autre caméra et tester l'effet sans toucher aux écrans ; lancer la diffusion, vérifier la suspension puis le retour de l'aperçu et les plafonds de ressources.
16. Refuser une commande concurrente, une durée non finie et un mode invalide ; annuler un passage, puis simuler un échec de shader/source avant et pendant le passage. Vérifier restauration et erreurs explicites.
17. Mettre le concert en pause pendant un fondu ; le fondu continue. Masquer puis réafficher l'onglet ; la transition reprend sans saut de progression.
18. Réaliser un trajet autorisé, constater la continuité à l'arrivée et l'absence de modification des neuf poses ; refuser un trajet passant dans un obstacle déclaré.
19. Tester l'écran partagé puis la séquence Centre → Gauche → Droite ; annuler après le premier écran et retrouver toutes les routes antérieures.
20. Répéter au moins 100 transitions variées et 20 cycles de montage/démontage avec aperçu ; contrôler libération et mesures sur GPU matériel selon T19.

## 7. Stratégie de tests

Chaque tâche fonctionnelle ci-dessous comprend des tests unitaires à créer lors de son implémentation. Ils portent sur une logique ou un contrat observable. Les tâches documentaires n'exigent pas de tests exécutables. Les tests d'intégration et navigateur complètent les unitaires ; ils ne les remplacent pas.

- **U — unitaires** : Vitest, état pur et ports simulés ; fixtures déterministes et erreurs contrôlées.
- **I — intégration** : BabylonJS `NullEngine` pour hiérarchie, synchronisation et cycle de vie compatibles, avec dépendances GUI/canvas isolées si nécessaire.
- **B — navigateur** : Playwright avec WebGL2 disponible, interactions réelles et contrôles visuels. Un environnement sans WebGL2 est signalé comme non validé, jamais comme une réussite implicite.
- **M — recette humaine** : lisibilité du panneau, qualité des plans et reconnaissance des instruments. Captures et environnement consignés.

Ne pas tester des pixels avec `NullEngine`. Les tests unitaires de gestion des flux utilisent un port simulé pour vérifier réutilisation, préparation, échec et libération ; le navigateur vérifie que l'image existe et correspond à la bonne caméra. Les animations sont figées à un instant connu pour comparer les captures. La mire asymétrique est un outil de test temporaire, absent du concert final.

## 8. Tâches incrémentales obligatoires

Les cases ne seront cochées qu'une fois les critères et tests satisfaits. Chaque étape doit laisser une application utilisable ; les fixtures provisoires nécessaires aux étapes initiales sont retirées quand leur remplacement est validé.

Suivi : `[DONE]` indique une tâche terminée et validée ; le marqueur d'étape active désigne la tâche à traiter. T00 à T18 sont terminées. T19 est la prochaine étape ; son implémentation et sa recette n'ont pas commencé.

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

### T07 [DONE] — Manipuler les caméras à la souris

Dépendance : T06. Gizmos de position et rotation, FOV, visée scène, annulation et réinitialisation ; commandes provisoires accessibles en attendant T08.

- [x] Critères : édition à la souris dans les trois axes, effet en direct sur tous les écrans concernés, navigation restaurée après toute sortie de geste.
- Validation : 153 tests unitaires/intégration et 29 tests navigateur réussis ; contrôle des outils sur le serveur 5188, sans erreur de shader. Voir [compte rendu T07](docs/validation/T07.md).
- **U** : bornes spatiales/FOV ; rejets NaN et infini ; quaternion invalide ; conversions degrés/radians ; cible dégénérée ; clipping invalide ; commit/annulation d'une pose ; arbitrage des modes d'entrée et restauration après erreur.
- **I** : pose réelle synchronisée sans double transformation ; attachement au seul rig sélectionné ; frustum mis à jour ; réinitialisation sans changement d'affectation.
- **B** : drag position/rotation ; FOV ; Échap ; perte de focus et `pointercancel` ; caméra d'observation immobile pendant le geste et navigable après.

### T08 [DONE] — Construire le panneau de réalisation 3D

Dépendances : T06 et T07. Remplacer les contrôles provisoires par le panneau complet décrit en section 5 ; ajouter aide et état accessibles à tout moment.

- [x] Neuf boutons caméra et trois boutons écran distincts, commandes lisibles et états de sélection, de cibles et de diffusion séparés. Pause est grisée jusqu’à T10.
- 159 tests unitaires et d’intégration, 31 tests navigateur et build réussis. [Compte rendu T08](docs/validation/T08.md).
- **U** : modèle de présentation des 12 boutons numérotés ; basculement des cibles ; sélection de toutes ; DIFFUSER désactivé si aucune cible ; correspondance de chaque commande ; labels après réussite/échec ; un clic consommé produit une seule commande.
- **I** : souscriptions état/interface nettoyées ; boutons synchronisés après sélection via boîtier.
- **B/M** : cliquer les vrais boutons par picking ; survol puis clic sans mouvement parasite ; contrôle à 1280 × 720 ; absence du panneau dans chaque flux ; scénario complet sans console ni outil de développement.

### T09 [DONE] — Ajouter le public

Dépendance : T08. Public déterministe, distribué dans les zones autorisées et basé sur des ressources partagées.

- [x] 144 spectateurs par défaut, visibles depuis C9. Effectif et graine configurables, picking des caméras et du pupitre vérifié.
- 177 tests unitaires et d’intégration, 32 tests navigateur et build réussis. [Compte rendu T09](docs/validation/T09.md).
- **U** : même graine donnant la même distribution ; nombre demandé ; zones interdites et marges respectées ; zéro population accepté et nombre négatif refusé.
- **I** : instances/matériaux partagés et destruction complète ; public ajouté aux éléments filmables.
- **B/M** : contrechamp C9 avec public et absence d'interception indésirable du picking des contrôles.

### T10 [DONE] — Ajouter éclairages et animations

Dépendance : T09. Ambiance rock, projecteurs, mouvements légers, pause/reprise ; commencer avec budget d'ombres limité.

- [x] Quatre projecteurs et animations visibles dans les flux. La pause conserve les commandes de réalisation. [Compte rendu T10](docs/validation/T10.md).
- **U** : couleurs/intensités dans les bornes ; trajectoires à temps connu ; équivalence de deux découpages temporels ; pause sans saut à la reprise ; pas de progression pendant pause ; plafonnement du delta après onglet masqué.
- **I** : transformations attendues ; observateurs désabonnés au démontage ; éléments animés conservés dans les listes des flux.
- **B/M** : quatre projecteurs représentés, animation visible sur écrans, absence de surexposition majeure ; scénario global 9.

### T11 [DONE] — Stabiliser, mesurer et documenter l'expérimentation

Dépendance : T10. Exécuter les scénarios globaux, traiter les erreurs et documenter les commandes ainsi que les mesures.

- [x] Les dix scénarios, 100 coupes et 20 cycles de montage et démontage sont vérifiés. Le guide, la capture des trois sources et le bilan des deux profils sont disponibles. [Compte rendu T11](docs/validation/T11.md).
- 184 tests unitaires et d’intégration, 37 tests navigateur, une recette de performance séparée et build réussis.
- **U** : états dégradés sur perte de disponibilité d'un port ; refus de commande après arrêt ; politique de qualité avec valeurs bornées ; changement de résolution sans changement d'affectation ; aucune double libération après réaffectations répétées.
- **I/B** : 100 coupes alternées entre une et trois sources, puis 20 cycles de montage/démontage ; pas d'accumulation d'observateurs, de RTT ou de ressources possédées après stabilisation.
- **B/M** : recette des dix scénarios globaux, resize du canvas, clavier/souris, absence d'erreurs console/GPU ; consigner toute limitation.

### T12 [DONE] — Définir le contrat et l'orchestration des transitions

Dépendance : T11. **Implémentation et validation réalisées le 13 novembre 2026.** Données pures, commandes et ports de la section 5.4 définis ; décision 0006 adoptée pour les contrats, les budgets et la politique de couleurs. L'architecture et les bonnes pratiques sont alignées. Le runtime reste utilisable en mode coupe ; les adaptateurs d'effets seront ajoutés à partir de T13.

- [x] Critères : catalogue et paramètres validés ; cycle préparation → passage → présentation → validation, annulation et erreur ; capture des paramètres de commande ; une opération active ; comptage des consommateurs et plafonds explicites.
- Validation : `npm run check` réussi avec 227 tests unitaires/intégration et build ; 37 parcours navigateur validés sous Chrome/Windows/SwiftShader, dont deux parcours d'édition relancés avec un délai adapté. Le benchmark séparé est exclu. Voir [compte rendu T12](docs/validation/T12.md).
- **U** : durées, valeurs non finies, IDs, modes inconnus, cibles vides/mixtes, identité A=B, horloge indépendante, pause/visibilité, concurrence, rollback et arrêt idempotent via ports simulés.
- **I/B** : non-régression de la coupe et des dix scénarios existants ; absence de nouvelles ressources au repos avant activation d'un effet.

### T13 [DONE] — Ajouter les transitions fondamentales et leurs commandes 3D

Dépendance : T12. **Implémentation validée ; clôture le 14 novembre 2026.** Fondu enchaîné, fondu au noir et volet, choix du mode et de la durée, progression et annulation sont disponibles sur la page Transitions du pupitre. DIFFUSER demeure l'unique lancement du direct.

- [x] Critères : deux images en direct, première image prête avant départ, cibles synchronisées, conservation des écrans non ciblés, quatre RTT de captation au plus pendant un effet 2D et retour au budget de repos.
- Validation : `npm run check`, 239 tests unitaires/intégration et build réussis ; 42 parcours navigateur réussis, benchmark exclu. Les cinq parcours de transitions ont été relancés le 14 novembre après dégagement de la mire de recette et renforcement du contrôle de couleur. Captures inspectées ; voir [compte rendu T13](docs/validation/T13.md).
- **U** : progression monotone, bornes et extrémités, instant du noir, directions, restrictions d'édition/qualité et restauration après annulation/échec.
- **I** : partage A/B, abonnements et libération des consommateurs ; ressources temporaires nettoyées après succès, échec et démontage.
- **B/M** : scénarios 11 à 13, 16 et 17 ; comparaison des images intermédiaires, respect des couleurs et ratio, vrai picking du panneau et lisibilité à 1280 × 720. Aucun résultat NullEngine ne remplace ces vérifications.

### T14 [DONE] — Ajouter Rolling Cubes, Mosaïque et Grid Morph

Dépendance : T13. **Implémentation et validation réalisées le 14 novembre 2026.** Implémenter les trois effets prioritaires avec paramètres bornés. Définir et documenter la grille, l'ordre des cases, la graine et l'amplitude des déformations ; des valeurs par défaut doivent suffire pour les utiliser.

- [x] Critères : variantes visuelles identifiables, résultat déterministe, A exacte au départ et B exacte à l'arrivée, aucun trou non initialisé, choix accessible sur le pupitre.
- Validation : `npm run check`, 265 tests unitaires/intégration et build réussis ; 13 parcours navigateur T13/T14 réussis sans mise à jour des références. Trente références Windows sur mire et concert inspectées, avec contrôles de sources en direct, paramètres, erreurs et picking du pupitre ; voir [compte rendu T14](docs/validation/T14.md). La suite navigateur complète n'a pas été relancée à cette étape.
- **U** : validation des paramètres, graines, progression et erreurs transmises par le port de rendu.
- **I** : possession des matériaux/shaders et nettoyage ; pas de duplication de RTT par case.
- **B/M** : scénario 14 pour chacun des trois effets, concert animé et mire ; comparaison de captures de référence et cas d'échec de compilation. Documenter toute ressource externe et sa licence.

### T15 [DONE] — Compléter les effets graphiques et l'écran partagé

Dépendance : T14. **Implémentation et validation réalisées le 14 novembre 2026.** Ajouter Glitch, Zoom, Volet de luminance et Écran partagé. Le masque de luminance est procédural ; l'aléatoire du glitch est reproductible. Le zoom n'altère pas les définitions des caméras.

- [x] Critères : modes distincts, paramètres bornés, absence de clignotements plein écran répétés pour le glitch, cadrages préservés pour l'écran partagé et extrémités conformes.
- Validation : `npm run check`, 292 tests unitaires/intégration et build réussis ; 26 parcours T13/T14/T15 réussis sans mise à jour des références, dont treize nouveaux parcours T15. Quarante références Windows sur mire et concert inspectées ; couleurs, coins du split, neuf poses/FOV, partage des sources et erreurs vérifiés. Voir [compte rendu T15](docs/validation/T15.md). La suite navigateur complète n'a pas été relancée à cette étape.
- **U** : paramètres, répartition temporelle du split, validation de masque et déterminisme.
- **I** : partage des sources et destruction des ressources spécifiques.
- **B/M** : scénario 14 pour les quatre modes, première partie du scénario 19, inspection du split en 16:9 et vérification des neuf poses/FOV inchangés.

### T16 [DONE] — Prévisualiser la caméra et tester un effet hors direct

Dépendance : T15. **Implémentation et validation réalisées le 14 novembre 2026.** Ajouter le moniteur de préparation sur le pupitre et les commandes de la section 5.4.4. Expliquer la distinction sélection, aperçu, sources participantes et diffusion validée.

- [x] Critères : aperçu sans coupe, source de référence affichée, erreurs identifiées, aperçu suspendu avant diffusion et rétabli après, quatre RTT de captation actives au plus au repos avec aperçu.
- Validation : `npm run check`, 308 tests unitaires/intégration et build réussis ; 46 parcours navigateur de transitions, aperçu et non-régression réussis. Les douze parcours T16 ont été relancés et réussis sur le code final après renforcement des gardes et conservation des textures lors d'une affectation identique. Références et pupitre inspectés ; voir [compte rendu T16](docs/validation/T16.md). La suite navigateur complète n'a pas été relancée.
- **U** : consommateur d'aperçu partagé ou distinct, changement de sélection pendant préparation, rejet d'un résultat asynchrone périmé, absence de cible et priorité de la diffusion.
- **I** : moniteur exclu des listes de captation ; destruction des textures et abonnements sans double libération ; récupération après échec d'aperçu.
- **B/M** : scénario 15, absence du moniteur dans les flux, test d'effet sans changement du direct, lisibilité de l'ID réellement prévisualisé.

### T17 [DONE] — Ajouter le trajet virtuel entre cadrages

Dépendance : T16. **Implémentation terminée et validée.** Le domaine interpole les poses capturées et valide continûment les segments ; les obstacles fixes et la marge sont déclarés. Le directeur effectue cette validation avant suspension de l'aperçu. La source temporaire dans le pool, la composition séquentielle, les relais présentés vers B, les commandes des trois points de passage et le test hors direct sont implémentés, avec attentes de rendu annulables et restauration globale. Le pupitre propose les douze passages, dont le trajet. Validation : `npm run check`, 389 tests dans 47 fichiers, puis 49 parcours navigateur sélectionnés réussis sur Windows/Chrome/SwiftShader ; captures inspectées. Voir le [compte rendu T17](docs/validation/T17.md). Les performances matérielles restent à T19.

Choix du premier lot : au plus trois points de passage, soumis aux bornes spatiales des caméras. Géométrie en segments droits, temps proportionnel à leurs longueurs et progression cubique douce sur chaque segment, sans dépassement ; arrêt progressif de la position aux points. Orientation par SLERP court, FOV et clipping interpolés avec progression douce globale. L'enveloppe est une sphère conservatrice englobant le plan proche 16:9, augmentée de 0,25 m ; intersection continue avec les boîtes d'obstacles dilatées. Le sol, le plateau, le toit, les treillis, l'estrade, les escaliers, la barrière, les enceintes, les écrans/supports et le pupitre/moniteur sont déclarés. Les coins des boîtes et les ensembles de treillis peuvent produire des refus conservateurs ; musiciens, public, instruments et projecteurs ne sont pas des obstacles de ce premier lot et peuvent occulter l'image.

- [x] Critères : aucune modification des neuf caméras, continuité position/orientation/FOV, arrivée sans saut, refus explicite des chemins bloqués, un seul trajet actif à la fois, cinq RTT de captation actives au plus.
- **U** : interpolation aux bornes, quaternion par chemin court, points non finis, limites spatiales/FOV, trajectoire à temps connu et validation du trajet complet entre points, pas uniquement de ses sommets.
- **I** : caméra temporaire hors registre 1…9, synchronisation du rendu, mêmes exclusions de captation, destruction après annulation/échec/arrêt.
- **B/M** : scénario 18, trajets proches du sol et des structures, test hors direct, arrivée conforme à B et inspection du confort visuel. Les limites de détection d'obstacles sont consignées.

### T18 [DONE] — Orchestrer les passages entre plusieurs écrans et documenter les exercices

Dépendance : T17. **Implémentation terminée et validée selon le [rapport T18](docs/validation/T18.md).** La page SÉQUENCE expose les six ordres, le délai de 0 à 1 000 ms et le mode simultané/décalé ; le trajet conserve sa séquence obligatoire. Le résumé filtre les cibles déjà sur B et affiche le total ; l'annulation reste globale. Le guide complète les situations de la section 5.4.6, dont les raccords manuels, sans synchronisation audio automatique. `npm run check` réussit avec 402 tests dans 49 fichiers. Les cinq nouveaux parcours navigateur réussissent ; la sélection de non-régression termine à 53/54, puis le parcours d'aperçu bloqué au démarrage réussit isolément. Le scénario 19 enrichi est également rejoué avec succès. Le rapport conserve cette limite de stabilité pour T19.

- [x] Critères : ordre filtré selon les cibles, sources de départ distinctes conservées, commande globale unique, rollback complet même après le passage du premier écran, indication claire du mode effectif avant lancement.
- **U** : permutations, cibles partielles, délai borné, durée totale, sources identiques, annulation après une étape et panne tardive.
- **I** : réutilisation des flux et de la caméra temporaire, aucune accumulation d'allocations au fil de la séquence.
- **B/M** : scénario 19 complet, trois sources initiales vers une destination commune, exercices plan général → chanteur → solo → public, sans outils de développement.

### T19 [CURRENT] — Valider la nouvelle phase sur la machine d'expérimentation

Dépendance : T18. **Implémentation et recette T19 non commencées.** Relancer les scénarios du socle et de la phase transitions, effectuer une recette Windows et mesurer avec accélération GPU réelle. Cette tâche couvre les limites matérielles déjà indiquées dans T11, sans réécrire ses résultats historiques. Surveiller aussi le blocage de démarrage non reproduit en relance isolée, consigné dans T18 ; une sélection longue entièrement réussie reste à obtenir.

- [ ] Critères : scénarios 1 à 20 validés ; guide à jour ; captures et mesures séparées par effet/profil ; machine et backend graphique identifiés ; aucune réussite GPU déduite de SwiftShader ou de NullEngine.
- **U/I** : 100 opérations variées incluant annulations et échecs, 20 cycles de montage/démontage ; compteurs de ressources revenus au niveau attendu, sans fuite de matériaux, textures ou observateurs.
- **B/M** : Windows/Chromium WebGL2, picking et lisibilité, départs/arrivées des effets, rendu animé, profils standard/réduit, qualité des raccords et confort des trajets. Préparer et inspecter les références Windows avant de les adopter ; ne pas écraser les captures macOS pour faire passer les tests.
- **Performance** : protocole de la section 9, comparaison coupe/fondu/effets complexes/trajet/aperçu, pic de passes et allocations, temps de préparation et d'image. Une cible non atteinte reste explicitement indiquée et déclenche une proposition d'optimisation fondée sur les mesures.

## 9. Objectifs de performance et définition de terminé

Cible indicative : au moins 30 images/s en moyenne sur une séquence de 60 secondes après 10 secondes de chauffe, canvas 1280 × 720, ratio de pixels plafonné à 1,5, 100 spectateurs et trois sources vidéo distinctes à 1024 × 576. La machine de référence n'étant pas encore définie, cette cible doit être confirmée et mesurée sur la machine d'expérimentation ; aucune garantie universelle n'est avancée.

Consigner OS, navigateur/version, CPU/GPU, ratio de pixels, résolution réelle du canvas, qualité des ombres, nombre de meshes/draw calls et RTT actives. Rapporter moyenne et 95e percentile du temps d'image. Tester avec onglet visible. En cas de cible manquée, documenter la cause et un profil réduit proposé, par exemple RTT 512 × 288 ; ne pas masquer une baisse de qualité dans les résultats.

Le socle est terminé quand T01 à T11 sont validées, que les dix scénarios fonctionnent, que chaque feature possède ses tests unitaires et ses validations complémentaires, que l'architecture est respectée et que le guide permet à un nouvel utilisateur de manipuler une caméra et de diffuser son image sur plusieurs écrans. Toute vérification non exécutée reste indiquée comme telle.

La phase transitions est terminée lorsque T12 à T19 sont validées, que le catalogue complet et la prévisualisation fonctionnent, que les scénarios 11 à 20 passent avec non-régression du socle et que le guide distingue effets, trajets et raccords manuels. Les plafonds de la section 5.4 sont vérifiés en préparation, pendant le passage, après annulation et après retour au repos.

Mesurer également des séquences répétées de transitions sur 60 secondes après chauffe, avec trois sources initiales distinctes, ainsi que le cas d'aperçu au repos. Conserver la cible indicative de 30 images/s et publier moyenne/P95, pics de ressources et temps de préparation pour chaque profil. La cible reste à confirmer sur la machine matérielle choisie ; les résultats logiciels historiques de T11 ne constituent pas une validation matérielle de cette nouvelle phase. Aucune baisse automatique et silencieuse de qualité n'est admise pour masquer un dépassement.

## 10. Extensions possibles après le socle

Les transitions, le moniteur de prévisualisation et les trajets entre cadrages sont désormais planifiés dans T12 à T19. Ils ne figurent plus parmi les idées sans tâche.

Restent facultatifs : sauvegarder/restaurer les poses et affectations dans un format versionné ; travelling permanent et suivi d'un musicien ; assets GLB détaillés ; son et synchronisation musicale ; enregistrement ; profils de qualité supplémentaires ; détection automatique de raccords ou recherche générale de chemins. Chacune de ces extensions nécessitera sa propre tâche, ses critères et ses tests avant implémentation.
