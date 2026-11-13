# Trame orale pour le point avec Michel Buffa

## Introduction
Mon projet porte sur la création de décors de concert virtuel pour WAM JAM Party. J’ai commencé par structurer les besoins, puis par développer, avec assistance IA, un premier atelier expérimental sur ordinateur.

## Montrer la contribution
Je réutilise le plateau et les musiciens du laboratoire existant. Mon travail actuel porte sur l’atelier de décors, les configurations, les éléments ajoutables et modifiables, les spots RGB et la conservation du document de scène.

## Faire la démonstration
Je compare une scène à trois écrans et une scène compacte. J’ajoute une cabine ou une enceinte, je la déplace et je modifie ses paramètres. Je montre ensuite la puissance du spot et la visibilité du faisceau, qui sont deux réglages différents.
Enfin, j’enregistre, je recharge puis je restaure la scène. Le JSON peut être exporté et réimporté dans ce prototype.

## Donner les preuves
La suite unitaires/intégration comprend 164 tests réussis, dont 23 nouveaux tests de décors. Quatre scénarios navigateur passent ensemble ; le déplacement à la souris et la désélection ont été validés séparément.
Mon export d’essai contient 16 objets. Ce nombre n’est pas une mesure de performance.

## Expliquer la limite actuelle
Le JSON n’est pas encore compatible de manière démontrée avec WAM JAM Party. Les textures importées, les connexions musicales et les essais sur Meta Quest restent à réaliser. La branche est prête pour le travail local, mais le nouveau commit reste bloqué par les permissions Git ; une archive conserve les fichiers.

## Demander une décision
J’ai besoin de confirmer avec vous le dépôt cible et le format exact du loader pour intégrer cet atelier sans refaire les mécanismes WAM existants.

## Si la démonstration en direct ne démarre pas
Ouvrir Demonstration_guidee_Aya.html : elle contient les captures réelles et les notes pour les commenter.
