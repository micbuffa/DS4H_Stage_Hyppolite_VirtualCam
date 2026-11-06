# Instructions pour les assistants IA - documentation décors

Portée : ce dossier documentaire uniquement. Les instructions racine restent applicables. Les chemins cités ci-dessous sont relatifs à ce dossier. L’interdiction de coder décrit cette livraison, sans révoquer le mandat existant du laboratoire.

## Mission et état actuel
Projet : éditeur web de décors low-poly BabylonJS pour WAM JAM Party.
Lire Decors.md, ACHITECTURE.md et BABYLONJS_BONNES_PRATIQUES.md.
La mission actuelle est documentaire : ne pas implémenter de fonctionnalité sans demande ultérieure.
Ne pas affirmer avoir lu les pièces jointes absentes, regardé les vidéos ou testé la VR.

## Avant toute future modification
- Identifier le dépôt, sa branche, les changements locaux et ses instructions existantes.
- Confirmer le rôle du dépôt si inconnu ; ne pas modifier un dépôt voisin par supposition.
- Lire package.json et les conventions réelles ; conserver les versions et le gestionnaire de paquets existants.
- Ne jamais écraser les modifications de l’utilisatrice, les instructions existantes ou réinitialiser Git.
- Si ces fichiers sont intégrés à un dépôt possédant déjà un AGENTS.md, fusionner les consignes pertinentes au lieu de le remplacer.

## Travail incrémental
- Traiter une tâche Decors.md à la fois avec ses dépendances.
- Expliquer brièvement le résultat et les prochaines actions en français simple.
- Séparer modèles de données, rendu, interface et adaptateurs.
- Pour chaque fonctionnalité implémentée, créer ses tests unitaires et vérifier ses critères.
- Utiliser le framework de tests existant ; s’il manque, documenter le choix avant ajout.
- Utiliser NullEngine lorsque pertinent pour la construction BabylonJS sans navigateur ; garder les gestes/rendus dans des tests navigateur et contrôles visuels.
- Exécuter les commandes réellement disponibles ; rapporter commandes, résultats et limites. Ne jamais inventer un nombre de tests validés.
- Ne pas lancer toute la suite pour une modification documentaire seule.

## Limites et intégration
- Ne pas introduire Blender, moteur audio ou dépendance lourde sans besoin justifié.
- Ne pas considérer GLB ou JSON comme compatible sans vérification avec le loader cible.
- Ne pas confondre port décoratif et connexion audio fonctionnelle.
- Ne jamais publier, fusionner ou envoyer des messages au nom de l’utilisatrice sans demande correspondante.
- Garder secrets, jetons, fichiers personnels et dépendances générées hors des commits.
- Consigner les décisions, les limites et la provenance/licence des ressources.
