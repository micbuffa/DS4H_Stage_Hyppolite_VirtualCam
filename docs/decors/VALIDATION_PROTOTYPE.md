# Validation du prototype de décors
Validation dans la nuit du 12 au 13 novembre 2026. Branche aya-scene-et-decore.

## Contrôles réussis
- TypeScript : tsc --noEmit.
- ESLint : eslint .
- git diff --check.
- Vitest : vitest run --maxWorkers=2 : 21 fichiers, 164 tests réussis, dont 23 nouveaux tests de décors.
- Build : vite build ; les entrées index.html et decors.html sont produites.
Avertissement : un chunk BabylonJS commun dépasse 500 ko minifié. Le budget de chargement reste à optimiser.

## Vérifications navigateur
Google Chrome, ANGLE/SwiftShader, viewport CSS 1440 x 900.
Quatre scénarios réussis ensemble sur la version distribuable :
1. Rendu, passage entre un et trois écrans, conservation des décors ajoutés.
2. Modification, duplication, sauvegarde locale, rechargement puis restauration.
3. Export JSON, réimport et refus d’un document invalide sans perte des objets.
4. Réglage des spots et rotation via l’inspecteur.

Le cinquième scénario (glissement réel du gizmo X et désélection par Échap) a réussi séparément : 1 test passé en environ 1,2 minute.
Le passage complet avait dépassé le délai du cinquième : ne pas annoncer une commande globale de cinq tests entièrement verte.
Ce test isolé utilise moins d’étapes graphiques et un délai adapté au rendu logiciel.
Les captures ont été examinées visuellement.

## Reproduction
Sur serveur préalablement lancé : définir DECORS_TEST_URL=http://127.0.0.1:5180 puis exécuter npx playwright test --config playwright.decors.config.ts.
Sous PowerShell : $env:DECORS_TEST_URL='http://127.0.0.1:5180'.
Sans cette variable, le serveur de développement dédié démarre sur 5189.
Le ratio de pixels du profil automatisé est de 0,5 afin de limiter le coût logiciel. Une première capture a aussi été examinée à ratio 1.
Ces résultats ne constituent pas des mesures de performances sur Meta Quest.

## Corrections issues des tests
Imports explicites des instances et rayons BabylonJS ; fusion des groupes statiques par matériau ; rendu au repos avec première image garantie ; nettoyage à la sortie de la page.

## Limites
Annulation pendant un geste par blur/pointercancel et rotation/échelle au gizmo non testées exhaustivement. Les valeurs numériques ont été testées.
Les 141 tests unitaires/intégration existants passent ; la suite navigateur historique complète n’a pas été réexécutée.
Textures externes, ports WAM, import réel WAM JAM Party, casque et coédition restent à réaliser.
Le prototype couvre un sous-ensemble des étapes Decors.md ; T0 reste ouvert pour l’étude complète et la confirmation de la base de travail.
