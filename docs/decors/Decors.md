# Spécification - Éditeur de décors 3D pour WAM JAM Party

## Statut et périmètre
Spécification et suivi. Premier prototype de bureau autorisé par Aya le 12 novembre 2026, en cours de validation. Voir POINT_PROF.md et la décision 0005 ; les étapes détaillées ci-dessous ne sont pas toutes accomplies.
Objectif : un éditeur web spécialisé BabylonJS pour assembler, positionner, redimensionner et texturer des décors low-poly destinés à WAM JAM Party.
Le premier livrable est une expérimentation sur ordinateur ; la scène exportée devra ensuite être évaluée dans le navigateur d’un Meta Quest 3.
Ce projet ne vise pas à remplacer Blender, ni à développer un moteur audio ou une nouvelle plateforme collaborative.

## Ressources et éléments à confirmer
- Éditeur existant : https://github.com/Jempasam/3d_wam_editor
- Démonstration à tester : https://jempasam.github.io/3d_wam_editor/app/
- Autre dépôt fourni : https://github.com/micbuffa/DS4H_Stage_Hyppolite_VirtualCam
  Ce dépôt héberge un laboratoire de caméras virtuelles. Son README décrit T01 à T06 comme implémentées ; ces validations antérieures n’ont pas été réexécutées ici. Cette spécification de décors est ajoutée sur aya-scene-et-decore ; l’intégration avec l’éditeur WAM reste à confirmer.
- Article à lire : https://insa-lyon.hal.science/hal-05627990/
- Vidéo à regarder : https://www.youtube.com/watch?v=6dYesOW6qhc&list=PLNUy77gRLMkw&index=2
- Deux articles transmis par Aya ont été consultés ; les vidéos et Ten years of Web Audio Modules restent à étudier.
Le README de l’éditeur décrit des interfaces 3D WAM et un export JSON. Cela ne prouve pas que cet export accepte déjà des mondes complets.
L’intégration WAM JAM Party et le rôle du logiciel appelé « 3DCoder » dans les échanges doivent être clarifiés.

## Parcours utilisateur cible
Ouvrir l’éditeur > choisir un modèle de scène > ajouter un décor > le sélectionner à la souris > le déplacer, tourner ou redimensionner > modifier son apparence > prévisualiser > sauvegarder > exporter.
Les commandes souris constituent la première cible. L’édition immersive aux contrôleurs et la coédition réseau sont hors première version.

## Articulation avec le laboratoire existant
Les tâches T0 à T10 ci-dessous appartiennent au volet décors, distinct des tâches T00 à T11 de CAMERAS_VIRTUELLES_SPEC.md. Leur statut ne modifie pas celui du laboratoire. La variante à un écran, les trois spots RGB, la persistance et la cible Quest sont des objectifs du volet décors, pas des changements déjà appliqués au laboratoire à trois écrans. L’architecture racine reste la référence pour toute modification de son code.

## Convention de validation
Chaque fonctionnalité future comprend ses tests unitaires, écrits lors de son implémentation, avant son passage à « terminé ».
Les tests unitaires ne valident pas seuls un rendu visuel, un geste souris réel ou les performances d’un casque : prévoir aussi les contrôles d’intégration et manuels indiqués.
Les étapes complètes ci-dessous ne sont pas déclarées terminées. Le prototype en couvre un sous-ensemble ; voir VALIDATION_PROTOTYPE.md.

## T0 [CURRENT] - Comprendre et établir la référence
Actions : lire les articles, regarder les vidéos, tester la démonstration ; relever les entrées/sorties WAM ; identifier le dépôt de développement et celui d’intégration ; inventorier les scripts et versions existants.
Livrable : notes d’expérimentation, procédure de lancement vérifiée et exemple réel de chargement/export.
Critères : chaque dépôt a un rôle confirmé ; le comportement de référence et les erreurs observées sont consignés.
Tests : inventorier et exécuter les tests existants si disponibles, sans inventer de commandes ni de résultats. Aucune nouvelle feature à tester à ce stade.
Dépendance : aucune.

## T1 - Préparer le socle de développement
Actions : appliquer AGENTS.md, architecture modulaire et conventions BabylonJS ; identifier le moteur de tests et ajouter un test de référence pertinent.
Critères : commandes réelles de lancement, tests et build documentées ; séparation données/rendu.
Tests unitaires : création et nettoyage d’une scène minimale sans objets résiduels ; validation d’une transformation valide/invalide.
Contrôle navigateur : ouverture, redimensionnement de la fenêtre, fermeture propre.
Dépendance : T0.

## T2 - Première scène et variantes
Features : plateau, sol, escalier ; modèle avec écran arrière seul et modèle avec écrans gauche, droit et arrière ; largeur paramétrable.
Critères : modèles distincts sélectionnables ; éléments identifiés ; dimensions cohérentes ; les écrans sont initialement des surfaces visuelles, sans flux vidéo.
Tests unitaires : nombres et rôles des écrans ; dimensions strictement positives ; position relative des écrans ; mise à l’échelle du groupe ; absence de doublons après changement de modèle.
Contrôle visuel : visibilité depuis le public, accès à la scène et absence d’intersections manifestes.
Dépendance : T1.

## T3 - Bibliothèque de décors
Features : haut-parleurs latéraux, pylônes, lampes, cabine de sonorisateur, musiciens et instruments simplifiés, public low-poly.
Critères : chaque modèle possède identifiant, catégorie, origine/licence, dimensions et paramètres ; musiciens/public sont des représentations visuelles sans moteur audio ajouté.
Tests unitaires : catalogue sans identifiants dupliqués ; création et suppression par catégorie ; instances indépendantes pour les paramètres éditables ; modèle inconnu traité explicitement.
Contrôle visuel : silhouettes lisibles et public ne masquant pas la scène.
Dépendance : T2.

## T4 - Éclairage de concert
Features : trois spots rouge/vert/bleu sur les pylônes ou au-dessus de la scène ; orientation vers les musiciens ; représentation visible des faisceaux.
Critères : distinguer la lumière qui éclaire les surfaces du volume visuel simulant son faisceau ; puissance, couleur, angle et visibilité réglables ; aucun effet volumétrique coûteux obligatoire.
Tests unitaires : couleurs et cibles initiales ; intensité non négative ; angles dans les bornes définies ; activation indépendante du spot et du faisceau ; nettoyage des ressources à la suppression.
Contrôle visuel : orientation, faisceaux visibles et transparences acceptables.
Dépendance : T2 ; T3 pour les supports détaillés.

## T5 - Manipulation à la souris
Features : ajouter plusieurs décors, sélectionner, déplacer, tourner, redimensionner, dupliquer et supprimer ; gizmos ; panneau de valeurs.
Critères : sélection du décor complet même si un sous-maillage est cliqué ; navigation caméra suspendue pendant le geste ; identifiant neuf à la duplication ; aucun changement après annulation.
Tests unitaires : résolution sous-maillage/objet ; transformations locales ; valeurs non finies et échelles nulles rejetées ; duplication sans mutation de l’original ; suppression de la sélection ; commande annulée.
Intégration : clic dans le vide, glisser-déposer, relâchement hors canvas et gestion des conflits caméra.
Dépendance : T3.

## T6 - Matériaux et propriétés
Features : textures du sol et des écrans, couleurs et réglages des lampes ; import limité de textures.
Critères : formats et taille maximale définis après mesure ; erreur lisible si fichier invalide ; modification ciblée même si deux décors partagent un matériau initial.
Tests unitaires : validation type/taille ; paramètres normalisés ; indépendance des objets ; référence de texture manquante ; libération des textures inutilisées.
Intégration : chargement réussi/échoué et prévisualisation après modification.
Dépendance : T4, T5.

## T7 - Persistance locale
Features : sauvegarder, lister, rouvrir et supprimer un projet ; signaler les erreurs de stockage.
Critères : document versionné, identifiants stables, transformations et paramètres conservés ; stratégie explicite de stockage des images ; aucune perte silencieuse du travail courant.
Tests unitaires : aller-retour données équivalentes ; document corrompu ; version inconnue ; quota dépassé via stockage simulé ; isolation des projets ; annulation de l’ouverture.
Intégration : sauvegarder, recharger la page, rouvrir et comparer la scène.
Dépendance : T6.

## T8 - Points de connexion WAM
Features : métadonnées d’entrées/sorties sur les décors compatibles, notamment table de mixage.
Critères : type audio/MIDI/autre confirmé avec l’existant ; positions locales suivant les transformations ; aucun graphe audio fonctionnel simulé.
Tests unitaires : identifiants uniques ; sens/type des ports ; position mondiale après rotation/échelle ; références cassées rejetées.
Intégration : branchement visuel et validation avec un composant réel du logiciel cible.
Dépendance : T0, T5.

## T9 - Export et import cible
Actions : examiner un fichier réel et le loader de WAM JAM Party ; décider du contrat ; écrire un adaptateur séparé.
Proposition à valider : JSON versionné pour les paramètres éditables, accompagné de références aux ressources ; GLB seulement si le loader cible le justifie. Ce n’est pas encore un format compatible validé.
Critères : export portable, ressources résolubles, erreurs explicites ; scène exportée puis chargée dans WAM JAM Party.
Tests unitaires : schéma/version ; transformations et ports conservés ; ressources manquantes ; migration explicitement supportée ; refus des versions incompatibles ; aller-retour sur une fixture convenue.
Intégration : chargement réel dans le logiciel cible ; vérifier l’absence de régression des interfaces WAM existantes.
Dépendance : T7, T8 et contrat validé.

## T10 - Validation et optimisation casque
Actions : mesurer sur PC puis Meta Quest 3 ; ajuster géométrie, textures, instances, éclairages et ombres.
Critères : budgets de triangles, draw calls, mémoire, temps de chargement et fréquence d’affichage fixés après référence sur matériel réel ; résultats datés avec navigateur et matériel.
Tests unitaires : choix des profils de qualité ; comptage et limites du catalogue lorsque les budgets sont approuvés ; activation/désactivation des détails.
Contrôles : sessions répétées, croissance mémoire, entrée/sortie XR, confort et stabilité ; aucun succès Quest annoncé après un simple test PC.
Dépendance : T9.

## Première action recommandée
Terminer T0 avant d’écrire la scène : tester l’éditeur et faire confirmer par M. Buffa quel dépôt reçoit les modifications. Les fichiers de cette livraison constituent la préparation documentaire.
