# Réaliser le concert virtuel

Ce guide décrit le socle, les onze passages 2D, le trajet virtuel, leur test hors direct et les commandes de séquence multiécran de la [spécification version 2.2](../CAMERAS_VIRTUELLES_SPEC.md). La coupe reste le mode initial. Les mesures de performance sur GPU matériel restent prévues à T19.

Démarrer avec `npm ci` puis `npm run dev`. Ouvrir l’adresse affichée par Vite dans un navigateur de bureau doté de WebGL2. Au départ, les trois écrans montrent C1 et l’écran gauche est la seule cible cochée.

1. Cliquer sur **4** dans la grille des caméras pour préparer un plan du chanteur. Le bandeau indique C4 et les écrans continuent de montrer C1.
2. Cliquer sur **DIFFUSER**. Le plan C4 apparaît à gauche. Pour diffuser C7 à droite et au centre, choisir **7**, décocher **1**, cocher **2** et **3**, puis cliquer sur **DIFFUSER**.
3. Choisir une caméra puis **DÉPLACER** ou **ORIENTER**. Glisser un axe, un plan ou un anneau. Le relâchement valide la pose. **Échap** annule le geste. **FOV − / +** modifie l’angle vertical par pas de 5°. **VISER LA SCÈNE** et **RÉINITIALISER** aident à retrouver un cadrage.
4. Sélectionner **C9** pour voir le public depuis le plateau. **TOUS LES ÉCRANS** puis **DIFFUSER** permet de partager un seul plan sur les trois écrans. Les témoins **SÉLECTION** et **EN DIFFUSION** indiquent des états distincts.
5. Cliquer sur **PAUSE** pour figer le concert pendant la préparation d’un plan. Les caméras et les écrans restent disponibles. Cliquer sur **REPRENDRE** pour poursuivre les animations.

ZQSD et les flèches déplacent l’observateur. Glisser avec le bouton gauche pour orbiter et avec le bouton droit pour déplacer la cible. La molette ou le défilement à deux doigts règle le zoom. Cliquer sur le canvas pour lui rendre le focus. **R** ou **VUE RÉGIE** ramène à la vue initiale. **H** masque ou affiche le frustum de la caméra sélectionnée.

Dans **AIDE**, le profil **Réduite** utilise des textures 512 × 288 au lieu de 1024 × 576. Le changement conserve les affectations et remplace les images ensemble lorsque le nouveau profil est prêt. Si une source ne se prépare pas, le panneau affiche une erreur et conserve les images précédentes. Au démarrage, un écran sans source affiche **SANS SIGNAL**.

## Passer par un fondu ou un volet

1. Ouvrir **TRANSITIONS**, en haut à droite du pupitre. Les caméras et les écrans cibles restent accessibles ; les commandes de cadrage sont remplacées par celles des effets.
2. Utiliser **EFFET PRÉCÉDENT / SUIVANT** pour choisir **Coupe**, **Fondu enchaîné**, **Fondu au noir** ou **Volet**. Le fondu enchaîné superpose progressivement les deux images ; le fondu au noir marque un noir au milieu du passage ; le volet révèle le nouveau plan depuis un bord.
3. Régler **DURÉE − / +**, par pas de 100 ms entre 100 et 3 000 ms. La durée initiale d'un effet est de 600 ms. La coupe reste instantanée. Pour le volet, **DIRECTION** parcourt gauche, droite, haut et bas.
4. Choisir la caméra suivante, cocher les écrans et appuyer sur **DIFFUSER**. La sélection et les réglages seuls ne changent pas les images. Pendant le passage, les participants portent **EN TRANSITION** et l'état indique la progression. Les anciennes affectations restent affichées jusqu'à la présentation finale.
5. **ANNULER TRANSITION** restaure les sources précédentes de toutes les cibles. Une erreur conserve également le direct antérieur avec une explication. **ÉDITION** retrouve les commandes de cadrage.

Les deux sources continuent à filmer pendant le mélange. Les caméras participantes ne peuvent pas être déplacées, réorientées ou réinitialisées pendant le passage ; leurs gizmos et commandes sont indisponibles. Les autres caméras restent éditables. Le changement de qualité est temporairement désactivé. Un glissement actif doit être terminé avant de diffuser.

**PAUSE** fige le spectacle, mais laisse le passage avancer. Masquer l'onglet suspend l'horloge de transition et son retour ne rattrape pas le temps caché. Échap garde son rôle pour les gestes d'édition ; l'annulation du passage utilise son bouton dédié. Le champ préparé peut être modifié pour la commande suivante sans retoucher celle en cours.

## Rolling Cubes, Mosaïque et Grid Morph

Les trois passages de grille sont accessibles après Volet dans **EFFET SUIVANT**. **Rolling Cubes** simule des blocs tournants qui remplacent chaque portion de A par B. **Mosaïque** révèle les cases par petits fondus successifs. **Grid Morph** déforme les deux images dans chaque case pendant leur remplacement. Ces effets rendent le changement visible et conviennent à une intention graphique.

Les valeurs initiales suffisent : grille **8 × 4**, graine **0**, amplitude ou relief **30 %**, durée **600 ms**. Pour un passage plus lisible, commencer par une durée de 1 500 ms et une grille 4 × 2.

**RÉGLAGES GRILLE** ouvre les réglages du mode choisi. **GRILLE** parcourt 4 × 2, 8 × 4, 16 × 9 et 32 × 18. **GRAINE − / +** change l'ordre des cases ; conserver la graine permet de rejouer le même passage. **AMPLITUDE** augmente la déformation du Grid Morph par pas de 10 points, puis revient à zéro après 100 %. Pour les cubes, cette touche devient **RELIEF** et règle l'ombrage des faces ; la rotation reste un quart de tour. Elle est grisée pour la mosaïque. **RETOUR EFFETS** retrouve le choix du passage et la durée ; **ANNULER TRANSITION** reste accessible.

Ces réglages préparent la prochaine commande. Le direct ne change qu'après **DIFFUSER**, et les changements de réglage pendant un passage ne retouchent pas celui-ci. Les déformations restent dans l'image ; les cubes sont une illusion graphique sur la surface vidéo.

## Glitch, Zoom, volet de luminance et écran partagé

Après Grid Morph, **EFFET SUIVANT** propose **Glitch**, **Zoom**, **Volet de luminance** et **Écran partagé**, puis **Trajet virtuel**. Depuis Coupe, deux pressions sur **EFFET PRÉCÉDENT** arrivent sur Écran partagé. Les quatre effets graphiques utilisent la même durée de 100 à 3 000 ms, la même commande DIFFUSER et la même annulation.

| Effet | Résultat et réglages |
| --- | --- |
| Glitch | Des bandes horizontales se décalent brièvement pendant le mélange. RÉGLAGES EFFET propose BANDES, GRAINE −/+ et AMPLITUDE. L'effet ne superpose pas de flash lumineux. |
| Zoom | Les images se rapprochent autour de leur centre pendant le remplacement. RÉGLAGES EFFET règle seulement AMPLITUDE ; le cadrage et le FOV des caméras restent inchangés. |
| Volet de luminance | B apparaît d'abord dans les zones claires d'un masque procédural. DÉTAIL DU MASQUE et GRAINE changent sa forme ; DOUCEUR règle le bord de révélation, jusqu'au seuil net à 0 %. |
| Écran partagé | Le premier quart du passage ouvre B à droite, la moitié centrale montre A et B côte à côte, puis le dernier quart agrandit B au plein écran. Les deux cadrages sont conservés en entier, avec des bandes noires. Seule la durée se règle. |

Les valeurs initiales suffisent : amplitude ou douceur 30 %, graine 0, quatre bandes pour le Glitch et grille 8 × 4 pour le masque. Les touches de taille parcourent les mêmes préréglages que les grilles ; seules leurs lignes comptent pour le nombre de bandes. RETOUR EFFETS retrouve le choix et la durée ; les réglages sans effet pour le mode choisi sont grisés. Pour observer le maintien des deux images en écran partagé, choisir une durée de 2 000 ou 3 000 ms.

## Prévisualiser et tester hors direct

Le moniteur se trouve sur l'extension gauche du pupitre, sous **PRÉPARATION · HORS DIRECT**. Choisir une caméra puis cliquer **PRÉVISUALISER**. Son image apparaît après préparation ; les écrans du concert conservent leurs affectations. Le libellé **Aperçu Cn** indique la caméra effectivement affichée. Tant que l'aperçu reste actif, une autre sélection remplace son image ; en cas d'échec, l'ancien cadrage et son ID restent affichés avec un message d'erreur.

Cocher au moins un écran, préparer un effet et sa durée, puis cliquer **TESTER L'EFFET**. L'écran ciblé de plus petit numéro sert de référence : son numéro et la caméra A sont indiqués. Le moniteur joue A → caméra sélectionnée, sans modifier les écrans du concert. **ARRÊTER LE TEST** ou la fin du passage retrouve l'aperçu simple de B. Sans cible, l'aperçu reste disponible mais le test est grisé. Pour un effet 2D, un départ Sans signal reprend l'image réelle de cet écran ; un trajet exige une caméra de départ.

Les caméras participant au test sont temporairement verrouillées pour l'édition ; les autres restent éditables. Choisir une autre caméra annule le test et prépare son aperçu. **DIFFUSER** interrompt aussi le test, suspend l'aperçu et lance le passage sur les écrans ciblés. Après fin, annulation ou erreur de diffusion, l'aperçu reprend la dernière caméra sélectionnée. Le changement de qualité utilise la même suspension. Une image indisponible est signalée explicitement.

**MASQUER L'APERÇU** désactive le moniteur et libère sa source si aucun écran ne l'utilise. La sélection, l'aperçu et la diffusion restent trois actions distinctes : voir C4 dans le moniteur ne signifie pas que les spectateurs la voient sur leurs écrans.

## Préparer une réalisation avec les commandes actuelles

Commencer par un plan général C1, prévisualiser C4 pour le chanteur et tester un passage, puis diffuser. Choisir ensuite le cadrage du guitariste ou du batteur au moment de son intervention, puis préparer C9 pour montrer le public. Terminer sur un plan général tenu. Vérifier le cadrage sur le moniteur avant chaque diffusion.

Une coupe peut paraître naturelle si elle correspond à une action ou si les deux cadrages sont cohérents. Un raccord dans le mouvement, derrière un obstacle ou par panoramique rapide se prépare manuellement. L'application ne détecte ni le rythme musical ni le bon instant pour changer de caméra ; elle ne fournit pas de son.

## Réaliser un trajet virtuel

Le **Trajet virtuel** déplace un point de vue temporaire entre le cadrage actuellement diffusé et celui de la caméra sélectionnée. Les neuf caméras restent en place. Le mode rejoint les onze passages 2D dans le catalogue du pupitre.

1. Choisir la caméra d'arrivée, cocher les écrans cibles et ouvrir **TRANSITIONS**. Depuis Coupe, **EFFET PRÉCÉDENT** choisit directement Trajet virtuel.
2. Régler la durée par écran avec **DURÉE − / +** : 2 secondes par défaut, de 500 à 10 000 ms, par pas de 500 ms. **Séquentiel** indique que les cibles seront parcourues successivement. **SÉQUENCE** choisit l'ordre et le délai, Centre → Gauche → Droite et 0 ms par défaut, filtrés selon la sélection et les écrans déjà sur B. La table des routes ne sera validée qu'à la fin de toute la commande.
3. Sans point intermédiaire, le trajet est direct. **POINTS DU TRAJET** ouvre une page dédiée. **AJOUTER UN POINT** crée d'abord le milieu entre départ et arrivée ; les ajouts suivants copient le dernier point. **POINT SUIVANT** choisit le point à modifier, **AXE X/Y/Z** choisit sa coordonnée et les touches **−/+ 0,5 m** la modifient. **SUPPRIMER POINT** le retire. Trois points au maximum, soumis aux mêmes bornes spatiales que les caméras. **RETOUR EFFETS** retrouve les commandes de durée et de mode.
4. **TESTER L'EFFET** parcourt seulement le moniteur depuis l'écran ciblé de plus petit numéro. Le texte **Trajet Cn → Cm · Vue temporaire** distingue cette vue de l'aperçu simple de B. Le direct reste inchangé. À la fin ou avec **ARRÊTER LE TEST**, l'aperçu de B revient. Modifier la sélection ou lancer une diffusion interrompt ce test.
5. Si le résultat convient, **DIFFUSER** lance la séquence sur les cibles. **ANNULER TRANSITION**, également présent sur la page des points, restaure toutes les images initiales, même si une première cible montrait déjà B. La diffusion et le changement de qualité ont priorité sur le test du moniteur et rétablissent ensuite l'aperçu de la dernière sélection.

Un chemin bloqué est refusé avant de changer les images ou de suspendre l'aperçu. Le message indique l'obstacle et le segment concernés. Modifier les points, ou revenir à une coupe/effet 2D ; l'application ne change pas silencieusement de passage. Le contrôle comprend le sol, les volumes fixes de scène, les écrans et le pupitre, avec une marge de 25 cm augmentée de l'enveloppe optique proche. Il reste conservateur près des coins et des treillis. Personnages, instruments et projecteurs peuvent encore occulter l'image. Les points règlent la position du trajet, sans suivi automatique du sujet : tester le cadrage avant de diffuser.

Les positions ralentissent au départ, à l'arrivée et aux points intermédiaires. La rotation et le FOV rejoignent progressivement le cadrage B ; le flux B prend ensuite le relais. Les caméras participantes sont verrouillées pour les modifications dès la préparation du test ou du direct. Les autres restent éditables. La pause du spectacle n'arrête pas le passage ; un onglet masqué suspend son horloge sans rattrapage au retour.

## Orchestrer plusieurs écrans

Dans **TRANSITIONS**, ouvrir **SÉQUENCE**. Le bouton **MODE SIMULTANÉ / MODE DÉCALÉ** bascule entre un départ commun et des passages successifs. **ORDRE DES ÉCRANS** parcourt les six permutations : 3 → 1 → 2, 1 → 2 → 3, 2 → 3 → 1, 3 → 2 → 1, 2 → 1 → 3 et 1 → 3 → 2. **1 = gauche, 2 = droite, 3 = centre**. **DÉLAI − / + 100 ms** règle l'attente entre la fin d'un écran et le début du suivant, de 0 à 1 000 ms. L'ordre et le délai sont grisés en simultané. **RETOUR EFFETS** retrouve le catalogue et sa durée par écran.

Le résumé affiche l'ordre effectif et la durée totale avant **DIFFUSER**. Les écrans décochés et ceux déjà sur la destination sont ignorés. Exemple : un fondu de 600 ms, trois écrans à changer et un délai de 200 ms donnent **2 200 ms** en décalé, contre **600 ms** en simultané. Avec seulement deux écrans à changer, le total devient **1 400 ms**. Une coupe a une durée par écran nulle : trois coupes séparées de 200 ms durent 400 ms ; à délai nul elles se produisent ensemble.

Le trajet impose des passages successifs pour partager un seul point de vue temporaire : le bouton de mode est grisé et l'explication est affichée. L'ordre et le délai restent réglables. Revenir à un effet 2D retrouve le choix simultané/décalé préparé auparavant.

Pendant la diffusion, la page SÉQUENCE affiche le pourcentage de chaque écran. Les lignes d'affectation restent celles du départ jusqu'à la présentation finale de toute la commande. **ANNULER TRANSITION** restaure les images de toutes les cibles, même celles déjà passées sur B. Une erreur tardive produit la même restauration. Les anciennes caméras continuent à filmer pendant l'attente. Une modification des réglages prépare la commande suivante ; elle ne modifie pas la séquence en cours. Le test sur le moniteur reste limité à l'écran de référence : il ne répète pas la séquence multiécran.

## Exercices de réalisation et raccords manuels

Ces exercices se réalisent avec les caméras, l'aperçu et DIFFUSER. L'application n'a ni son, ni analyse du rythme, ni choix automatique du moment de coupe.

| Situation | Exercice au pupitre |
| --- | --- |
| Début du concert | Diffuser le plan général C1, préparer C4 sur le moniteur, puis couper sur le chanteur à son entrée. |
| Couplet calme | Préparer deux cadrages rapprochés cohérents et tester un fondu modéré avant diffusion. |
| Début d'un solo | Prévisualiser C5 pour le guitariste ou C7 pour la batterie, puis couper au début de l'intervention. |
| Refrain énergique | Alterner groupe, chanteur et C9 pour le public ; déclencher les coupes manuellement sur les accents observés. |
| Applaudissements | Passer de la scène au public C9 puis revenir au plan général C1 et le tenir. |
| Fin du morceau | Retrouver C1 puis utiliser un fondu au noir pour rejoindre un autre cadrage. Le noir de cet effet est intermédiaire ; il ne maintient pas un écran noir à la fin. |
| Plans trop proches | Insérer un plan du public ou de la batterie entre deux cadrages dont le changement produit un saut gênant. |
| Continuité de geste | Préparer deux angles avec une direction de mouvement cohérente, puis couper pendant le geste. Observer le raccord ; l'application ne le détecte pas. |
| Coupe masquée | Préparer deux cadrages où un obstacle occupe l'image au moment du changement, ou deux panoramiques de même direction et vitesse. Déclencher la coupe manuellement et comparer. |
| Scénographie | Tester Rolling Cubes, Mosaïque, Grid Morph ou Écran partagé ; puis comparer le même effet en simultané et en Centre → Gauche → Droite. |

Pour la séquence complète **général → chanteur → solo → public**, commencer sur C1, préparer C4, choisir un fondu et cocher tous les écrans. Dans SÉQUENCE, choisir DÉCALÉ, 3 → 1 → 2 et 200 ms. Diffuser puis annuler lorsque le centre montre C4 : les trois écrans retrouvent leur départ. Relancer jusqu'au terme, puis revenir en SIMULTANÉ/Coupe pour passer à C5 et à C9. Pour observer trois départs distincts, affecter d'abord C1 à gauche, C2 à droite et C3 au centre, en ne cochant qu'un écran à chaque diffusion.
