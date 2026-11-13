# DS4H_Stage_Hyppolite_VirtualCam

Laboratoire pédagogique BabylonJS : positionner neuf caméras virtuelles et réaliser la retransmission d'un concert sur trois écrans 3D.

Le laboratoire réunit les fonctions de réalisation du concert. Le plateau réunit quatre musiciens, neuf caméras de captation et trois écrans 16:9 qui démarrent sur C1. Le panneau de réalisation 3D se trouve en bas à droite dans la vue régie. Le public compte 144 spectateurs par défaut. Diffuser **C9** permet de voir la foule depuis le plateau. L’effectif et la graine sont configurables dans `src/domain/concert/audienceLayout.ts`.

Choisir une caméra avec un bouton numéroté ou en cliquant sur son boîtier 3D. Les touches caméra distinguent **SÉLECTION** et **EN DIFFUSION**. Cocher les écrans cibles, puis cliquer sur **DIFFUSER**. **TOUS LES ÉCRANS** coche les trois destinations. Les lignes « Écran n ← Cn » indiquent les routes validées. Une même caméra peut alimenter plusieurs écrans. Si la préparation échoue, le panneau affiche l’erreur et la régie conserve le direct précédent.

**DÉPLACER** affiche les axes et plans du repère monde. **ORIENTER** affiche les anneaux de rotation locale. Les écrans qui diffusent cette caméra suivent le geste en direct. Relâcher valide la pose. **Échap**, la perte de focus ou une interruption du pointeur annulent le geste. Hors geste, Échap quitte l’outil.

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

`check` lance TypeScript strict, ESLint, les tests unitaires/intégration puis le build. Les tests navigateur démarrent leur propre serveur sur le port 5187, qui doit être libre, et utilisent Chromium avec WebGL2 logiciel. Ils ne réutilisent pas un serveur existant. Le mode `e2e` sépare leur cache Vite (`node_modules/.vite-e2e`) de celui du serveur interactif (`node_modules/.vite-dev`), pour garder les shaders disponibles pendant les tests. Les plans fixes de référence sont ceux de macOS et Chromium. Sur une autre plateforme, produire puis inspecter les captures avec `npm run test:e2e -- --grep 'nine distinct|closer view|calibration image' --update-snapshots`. Les parcours animés contrôlent la pause et les changements d’image sans comparer un instant arbitraire à une image fixe.

Pour isoler le téléchargement du navigateur comme dans cet environnement :

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/virtual-cameras-playwright npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/virtual-cameras-playwright npm run test:e2e
```

`npm run build` produit `dist/` ; `npm run preview` permet de le consulter localement. `npm run test:watch` active le mode interactif des tests unitaires. Aucun déploiement automatique.

Pour utiliser Chrome installé, définir `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`. La mesure de performance se lance seule avec `CONCERT_BENCHMARK=1 npm run test:e2e -- performance.spec.ts --workers=1`.

## Documents du projet

- [Spécification et tâches incrémentales](CAMERAS_VIRTUELLES_SPEC.md)
- [Instructions communes aux assistants IA](AGENTS.md), avec points d'entrée [Claude](CLAUDE.md) et [Gemini](GEMINI.md)
- [Architecture cible](ARCHITECTURE.md)
- [Bonnes pratiques BabylonJS](docs/BABYLONJS_BONNES_PRATIQUES.md)
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

Lire ces documents avant de poursuivre l'implémentation.

## En cas d'erreur de chargement d'un shader

Après une mise à jour de l'outillage, recharger une fois la page (⌘⇧R sur Mac) pour abandonner les anciens modules déjà chargés dans l'onglet. Le statut « Prêt à explorer » attend désormais la préparation du rendu ; une erreur de chargement affiche un message explicite. Le correctif et ses tests sont décrits dans [la décision 0001](docs/decisions/0001-vite-cache-et-preparation-du-rendu.md).
