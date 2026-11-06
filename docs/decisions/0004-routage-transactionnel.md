# 0004 — Routage transactionnel et flux partagés

Date : 6 novembre 2026. Statut : adopté à T06.

## Problème

Trois écrans peuvent recevoir la même caméra ou trois sources distinctes. Une sélection ne doit pas changer le direct. Une coupe ne doit montrer ni tampon neuf vide, ni affectation partielle en cas d'échec de préparation.

## Décision

Séparer `CameraRegistry` (sélection/poses), `RoutingDirector` (cibles et routes validées) et `FeedRouter` (ressources partagées). Un seul flux existe par source demandée. La commande capture ses paramètres, valide toute la table puis prépare les sources manquantes. Les matériaux ne basculent qu'après la première image réelle. Le changement des trois références est synchrone entre images ; l'état public est validé après une présentation complète. Les anciennes ressources sont alors libérées une seule fois. Une affectation identique ne prépare rien.

Le budget est de trois flux **rendus** simultanément. Si les trois places sont occupées, suspendre un ancien flux absent de la prochaine table pour préparer la nouvelle source. Son ancienne texture reste affichée et peut donc être brièvement figée. La commande DIFFUSER apporte une source nouvelle au maximum : quatre textures peuvent être allouées transitoirement, trois sont rendues. Après succès, retour à une, deux ou trois allocations. Après échec, supprimer le candidat et reprendre l'ancienne source.

Un échec initial laisse des mires explicites « SANS SIGNAL » ; un échec ultérieur conserve les routes et images précédentes. Une erreur globale de compilation des shaders reste traitée comme une erreur du runtime. Ne pas déclarer toute la scène inutilisable pour un échec isolé d'acquisition de source. Les effets d'une perte GPU après une préparation réussie feront l'objet de la stabilisation T11.

Le panneau HTML est un adaptateur provisoire avant T08, sans globale de diagnostic dans l'application. Les fixtures de test composent les mêmes classes et adaptateurs avec des sources volontairement indisponibles ou une préparation retardée.

## Validation

Tests purs pour les sept ensembles de cibles, partage, idempotence, commandes concurrentes et rollback. NullEngine pour les ressources natives et la libération après allocation refusée. Chromium/WebGL2 pour le routage visible, les pixels GPU conservés pendant la préparation, les sources partagées en mouvement et la récupération après erreur. Les compteurs distinguent ressources allouées et passes actives.
