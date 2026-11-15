# DS4H_Stage_Hyppolite_VirtualCam

Laboratoire pédagogique BabylonJS : positionner neuf caméras virtuelles et réaliser la retransmission d'un concert sur trois écrans 3D.

## État du projet

Au 15 novembre 2026, T00 à T18 sont validées selon leurs comptes rendus. La [spécification version 2.2](CAMERAS_VIRTUELLES_SPEC.md) décrit la phase transitions. **Les onze passages 2D, le trajet virtuel avec trois points éditables, le moniteur, le test hors direct et les séquences multiécrans sont disponibles.** Voir les recettes [T17](docs/validation/T17.md) et [T18](docs/validation/T18.md). T19 est la prochaine étape, non commencée, pour la stabilité en longue série et les performances sur GPU matériel.

Les contrats T12 conservent la capture des plans, une horloge indépendante et l'annulation. Le [compte rendu T12](docs/validation/T12.md) reste le bilan historique de cette étape. Les nouveaux shaders sont branchés au runtime ; les modes avancés sans adaptateur sont refusés. L'[architecture](ARCHITECTURE.md) distingue ce qui est en place de la cible. Les performances avec GPU matériel restent à confirmer à T19.

La [recette T16](docs/validation/T16.md) consigne 308 tests unitaires/intégration, le build et 46 parcours navigateur sélectionnés réussis. Les douze parcours T16 ont aussi été relancés après les derniers ajustements, avec conservation des identifiants de textures en cas d'affectation identique. Les captures du moniteur et du pupitre ont été inspectées. La suite navigateur complète n'a pas été relancée ; les rapports antérieurs conservent leur périmètre. Le rendu de test utilise SwiftShader ; le benchmark matériel reste à effectuer.

T18 porte les contrôles locaux à **402 tests unitaires/intégration** avec TypeScript, lint et build réussis. Les **54 parcours navigateur distincts** sélectionnés ont une exécution réussie : la longue sélection termine à 53/54, puis le parcours d'aperçu bloqué au démarrage réussit isolément. Le scénario 19 enrichi est aussi rejoué avec succès. Les pixels confirment les six ordres, les restaurations tardives et les relais de trajet ; les plafonds restent quatre sources en 2D et cinq en trajet. La capture SÉQUENCE a été inspectée. Le [rapport T18](docs/validation/T18.md) conserve le blocage de démarrage comme observation à surveiller à T19 ; la suite complète du dépôt et les mesures matérielles restent à effectuer.

## Fonctions disponibles

Le laboratoire réunit les fonctions de réalisation du concert. Le plateau réunit quatre musiciens, neuf caméras de captation et trois écrans 16:9 qui démarrent sur C1. Le panneau de réalisation 3D se trouve en bas à droite dans la vue régie. Le public compte 144 spectateurs par défaut. Diffuser **C9** permet de voir la foule depuis le plateau. L’effectif et la graine sont configurables dans `src/domain/concert/audienceLayout.ts`.

Choisir une caméra avec un bouton numéroté ou en cliquant sur son boîtier 3D. Les touches caméra distinguent **SÉLECTION** et **EN DIFFUSION**. Cocher les écrans cibles, puis cliquer sur **DIFFUSER**. **TOUS LES ÉCRANS** coche les trois destinations. Les lignes « Écran n ← Cn » indiquent les routes validées. Une même caméra peut alimenter plusieurs écrans. Si la préparation échoue, le panneau affiche l’erreur et la régie conserve le direct précédent.

La touche **TRANSITIONS** ouvre la page des passages du pupitre. **EFFET PRÉCÉDENT / SUIVANT** parcourt les douze modes disponibles. **DURÉE − / +** règle les effets 2D de 100 à 3 000 ms, avec 600 ms par défaut ; **DIRECTION** change le sens du volet. **RÉGLAGES GRILLE** ou **RÉGLAGES EFFET** ouvre les paramètres pertinents : taille ou bandes, graine, amplitude, relief ou douceur ; **RETOUR EFFETS** retrouve les commandes de passage. Les valeurs initiales sont 8 × 4 cases, graine 0, intensité 30 %. Le Zoom conserve les définitions des caméras ; l'écran partagé garde les deux cadrages complets avec des bandes et se règle par sa durée. **DIFFUSER** reste l'unique lancement du direct. **ANNULER TRANSITION** restaure les anciennes sources. **ÉDITION** retrouve les commandes de cadrage. Pendant le mélange, les sources restent en direct ; les caméras participantes et le changement de qualité sont verrouillés. La pause du concert n'arrête pas le passage ; masquer l'onglet suspend son horloge.

**TRAJET VIRTUEL**, accessible depuis Coupe avec EFFET PRÉCÉDENT, déplace une caméra temporaire sans modifier C1…C9. Durée de 500 à 10 000 ms par écran, 2 secondes par défaut ; les écrans sont parcourus successivement. **POINTS DU TRAJET** propose jusqu'à trois points : ajout/suppression, point suivant, axe X/Y/Z et −/+ 0,5 m. Sans point, le trajet est direct. Le test joue seulement sur le moniteur et indique **Vue temporaire**, puis retrouve B. Un chemin bloqué est refusé avant interruption de l'aperçu. Les volumes sont conservateurs et ne garantissent ni sujet visible en permanence ni trajectoire automatique : inspecter le passage avant diffusion. Voir le [guide](docs/GUIDE_UTILISATEUR.md).

**SÉQUENCE**, depuis TRANSITIONS, ouvre SIMULTANÉ/DÉCALÉ, les six ordres des écrans et le délai de 0 à 1 000 ms par pas de 100 ms. Le résumé affiche l'ordre effectif et la durée totale, en ignorant les cibles déjà sur B. Le trajet impose le décalé ; le choix 2D précédent revient au changement de famille. Les coupes décalées restent annulables globalement après le premier écran. Le [guide](docs/GUIDE_UTILISATEUR.md) propose les exercices général → chanteur → solo → public et les raccords manuels.

**DÉPLACER** affiche les axes et plans du repère monde. **ORIENTER** affiche les anneaux de rotation locale. Les écrans qui diffusent cette caméra suivent le geste en direct. Relâcher valide la pose. **Échap**, la perte de focus ou une interruption du pointeur annulent le geste. Hors geste, Échap quitte l’outil.

**PRÉVISUALISER**, sur l'extension gauche du pupitre, active le moniteur hors direct. La sélection suivante y prépare sa nouvelle image, avec conservation de l'image et de l'ID précédents en cas d'échec. **TESTER L'EFFET** utilise l'écran ciblé de plus petit numéro comme référence et joue seulement sur le moniteur. **ARRÊTER LE TEST** retrouve l'aperçu simple ; **MASQUER L'APERÇU** le désactive. Sans cible, seul le test est grisé. Diffusion et changement de qualité interrompent le test, suspendent l'aperçu et reprennent ensuite la dernière sélection. Voir C4 dans le moniteur ne change pas les affectations des spectateurs.

**FOV − / +** règle le champ vertical par pas de 5° entre 20° et 90°. **VISER LA SCÈNE** oriente vers le centre des musiciens. **RÉINITIALISER** restaure le préréglage de la caméra sélectionnée. Les positions sont limitées à X [-35, 35], Y [0,5 à 25] et Z [-35, 25]. Les caméras peuvent traverser le décor.

**AIDE** et **VUE RÉGIE** restent accessibles dans le bandeau lorsque le panneau sort du champ. **PAUSE / REPRENDRE** fige ou reprend les animations. Dans **AIDE**, le profil vidéo réduit à 512 × 288 conserve les sources affectées aux écrans.

## Démarrer

Prérequis : Node.js 22.13+ (24 LTS recommandé), npm et navigateur de bureau avec WebGL2. Versions verrouillées dans `package-lock.json`.

```sh
npm ci
npm run dev
```

Ouvrir l'adresse indiquée par Vite (habituellement http://127.0.0.1:5173 ; le port suivant est choisi si nécessaire). Le clavier est actif dès l'ouverture. Z ou ↑ avance, S ou ↓ recule, Q ou ← déplace à gauche, D ou → à droite, sur le plan horizontal dans la direction du regard. Les touches sont lues selon leur lettre AZERTY. Glisser avec le bouton gauche pour orbiter, avec le bouton droit pour déplacer la cible ; utiliser la molette ou le défilement à deux doigts du trackpad pour zoomer. Les événements de pincement traduits en Ctrl+wheel sont aussi pris en charge par le contrôle BabylonJS. Après un clic hors de la scène, recliquer dans celle-ci pour réactiver le clavier. Les déplacements s'arrêtent à la perte de focus. **R** ou le bouton **Vue régie** restaure la vue d'observation sans changer les caméras de captation. **H** ou le bouton d'aides masque/affiche le frustum de la caméra sélectionnée. **RÉINITIALISER** restaure son préréglage.

Le [guide utilisateur](docs/GUIDE_UTILISATEUR.md) propose un parcours de prise en main.

## Valider

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` lance TypeScript strict, ESLint, les tests unitaires/intégration puis le build. Les tests navigateur démarrent leur propre serveur sur le port 5187, qui doit être libre, et utilisent Chromium avec WebGL2 logiciel. Ils ne réutilisent pas un serveur existant. Le mode `e2e` sépare leur cache Vite (`node_modules/.vite-e2e`) de celui du serveur interactif (`node_modules/.vite-dev`), pour garder les shaders disponibles pendant les tests. Les plans fixes de référence existent pour macOS et Windows ; les six références Windows ont été inspectées à T12 sans modifier les images macOS. Sur une autre plateforme, produire puis inspecter les captures avec `npm run test:e2e -- --grep 'nine distinct|closer view|calibration image' --update-snapshots`. Les parcours animés contrôlent la pause et les changements d’image sans comparer un instant arbitraire à une image fixe.

Pour isoler le téléchargement du navigateur comme dans cet environnement :

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/virtual-cameras-playwright npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/virtual-cameras-playwright npm run test:e2e
```

`npm run build` produit `dist/` ; `npm run preview` permet de le consulter localement. `npm run test:watch` active le mode interactif des tests unitaires. Aucun déploiement automatique.

Pour utiliser Chrome installé, définir `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`. La mesure de performance se lance seule avec `CONCERT_BENCHMARK=1 npm run test:e2e -- performance.spec.ts --workers=1`.

Ces exemples d'affectation de variables utilisent la syntaxe d'un shell POSIX. Dans PowerShell, définir par exemple `$env:PLAYWRIGHT_CHROMIUM_CHANNEL = 'chrome'` puis lancer la commande npm. Le chemin `/private/tmp/...` ci-dessus est propre à l'environnement macOS de la recette historique ; il n'est pas requis sous Windows.

La configuration Playwright actuelle force SwiftShader, y compris avec le canal Chrome : cette commande mesure donc le rendu logiciel. La recette matérielle T19 devra vérifier le backend réellement utilisé avec une configuration adaptée. Les futurs effets nécessitent leurs propres tests et captures ; les comptes rendus actuels ne les couvrent pas.

Pour reproduire la recette Windows T12 avec Chrome installé, utiliser un seul worker : `npm run test:e2e -- --workers=1 --timeout=90000` après définition de la variable de canal. Les deux parcours d'édition longs possèdent un délai spécifique de 180 secondes pour leurs gestes et lectures GPU ; leurs assertions restent identiques.

## Documents du projet

- [Spécification et tâches incrémentales](CAMERAS_VIRTUELLES_SPEC.md)
- [Instructions communes aux assistants IA](AGENTS.md), avec points d'entrée [Claude](CLAUDE.md) et [Gemini](GEMINI.md)
- [Architecture cible](ARCHITECTURE.md)
- [Bonnes pratiques BabylonJS](docs/BABYLONJS_BONNES_PRATIQUES.md)
- [Décision 0006 — contrats des transitions, prévisualisation et budgets](docs/decisions/0006-transitions-previsualisation-et-budgets.md)
- [Validation et limites de T01](docs/validation/T01.md)
- [Validation de T02 et des déplacements](docs/validation/T02.md)
- [Validation de T03 : musiciens et instruments](docs/validation/T03.md)
- [Validation de T04 : caméras et sélection](docs/validation/T04.md)
- [Validation de T05 : premier flux sur écran](docs/validation/T05.md)
- [Validation de T06 : régie multiécran](docs/validation/T06.md)
- [Validation de T07 : édition à la souris](docs/validation/T07.md)
- [Validation de T08 — panneau de réalisation 3D](docs/validation/T08.md)
- [Validation de T09 — public du concert](docs/validation/T09.md)
- [Validation de T10 — éclairages et animations](docs/validation/T10.md)
- [Validation de T11 — recette et performances](docs/validation/T11.md)
- [Validation de T12 — contrats, orchestration et recette Windows](docs/validation/T12.md)
- [Validation de T13 — fondus, volet et commandes 3D](docs/validation/T13.md)
- [Validation de T14 — Rolling Cubes, Mosaïque et Grid Morph](docs/validation/T14.md)
- [Validation de T15 — Glitch, Zoom, luminance et écran partagé](docs/validation/T15.md)
- [Validation de T16 — moniteur, aperçu et test hors direct](docs/validation/T16.md)

Lire ces documents avant de poursuivre l'implémentation.

## En cas d'erreur de chargement d'un shader

Après une mise à jour de l'outillage, recharger une fois la page (⌘⇧R sur Mac) pour abandonner les anciens modules déjà chargés dans l'onglet. Le statut « Prêt à explorer » attend désormais la préparation du rendu ; une erreur de chargement affiche un message explicite. Le correctif et ses tests sont décrits dans [la décision 0001](docs/decisions/0001-vite-cache-et-preparation-du-rendu.md).
