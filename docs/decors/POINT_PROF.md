# Point d’avancement - Aya
## Création de décors et d’éléments de décors pour concert de musique virtuel
Préparé dans la nuit du 12 au 13 novembre 2026.

Ouvrir la démonstration : http://127.0.0.1:5180/decors.html
Si le serveur est arrêté, lancer Demarrer-atelier.cmd, puis ouvrir cette adresse.

## Ce que je peux présenter
J’ai préparé une spécification incrémentale et commencé une expérimentation BabylonJS.
Le prototype possède sa propre page /decors.html. Le plateau et les musiciens réutilisent les modèles existants ; le travail nouveau concerne l’atelier, les décors modifiables, les spots, le document et la sauvegarde.

## Démonstration (environ 3 minutes)
1. Ouvrir /decors.html : montrer la scène, les trois écrans, les spots RGB et le public stylisé.
2. Choisir la scène compacte, puis revenir au festival.
3. Ajouter une enceinte ; modifier X, Y, Z et essayer les flèches du gizmo.
4. Essayer rotation et échelle ; changer la couleur puis dupliquer.
5. Choisir un spot ; modifier sa puissance et masquer/afficher son faisceau.
6. Enregistrer, recharger la page, puis Restaurer : sauvegarde locale explicite.
7. Exporter le JSON puis le réimporter dans cet atelier.

## Limites à annoncer
- Prototype dans le dépôt de tests, pas encore intégré à l’éditeur WAM.
- Export JSON propre au prototype ; import dans WAM JAM Party non réalisé.
- Textures importées, ports audio/MIDI et coédition non implémentés.
- Finition bois : teinte unie, pas une texture.
- Public statique ; plateau et musiciens fixes. Les éléments ajoutés sont modifiables.
- Performances Quest 3 et contrôleurs non évalués.
- Vidéos encore à regarder ; consultation des sources distincte d’un test exhaustif de l’éditeur existant.

## Questions pour M. Buffa
1. Intégrer le module dans Jempasam/3d_wam_editor ou conserver une application séparée ?
2. Quel fichier d’exemple et quel loader de WAM JAM Party utiliser comme contrat d’export ?
3. Quels mécanismes réutiliser pour les points de connexion ?
4. Quel matériel et quels budgets de performances retenir ?

## Prochaines étapes
Essai guidé de l’éditeur WAM et lecture de Ten years of Web Audio Modules ; validation du contrat d’intégration ; textures ; ports ; import réel ; tests sur casque.
