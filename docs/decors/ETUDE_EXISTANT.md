# Étude initiale de l’existant
Date : 12 novembre 2026.

## Sources consultées
README et package.json publics de Jempasam/3d_wam_editor ; copie locale des fichiers src/editor2.ts, src/editor/LoadSavePane.ts et src/WamGUIGenerator.ts.
Documentation des gizmos et déclarations TypeScript BabylonJS 9.34.0.
Deux articles transmis par Aya consultés précédemment dans ce chat.

## Constats
L’éditeur WAM possède des panneaux Controls, Settings, Images, Examples, Editor, 3D View et Load/Save.
LoadSavePane utilise WamGUIGenerator.save/load et une représentation JSON ; une URL de WAM peut accompagner le document.
Ce mécanisme décrit l’interface d’un plugin : les fichiers consultés ne prouvent pas la prise en charge directe de mondes complets.
Le package public consulté utilise BabylonJS 8.x ; le laboratoire verrouille 9.34.0. Les versions et formats nécessitent donc une vérification avant intégration.
Le laboratoire fournit une scène et des modèles procéduraux réutilisables, avec Vitest et Playwright.

## Conséquences proposées
Séparer document de décors et rendu pour pouvoir adapter l’export ; préserver les fonctions WAM existantes.
Ne pas annoncer le JSON du prototype comme directement compatible avec WamGUIGenerator.

## Étude restant à terminer
Essai interactif de l’éditeur ; export réel puis rechargement ; vidéos ; étude du loader WAM JAM Party ; confirmation du dépôt d’intégration.
La lecture du code ne remplace pas ces vérifications.
