# DS4H_Stage_Hyppolite_VirtualCam

Laboratoire pédagogique BabylonJS : positionner neuf caméras virtuelles et réaliser la retransmission d'un concert sur trois écrans 3D.

T01 à T06 sont implémentées : caméra d'observation, plateau de concert, structures, enceintes, barrières, quatre musiciens avec instruments 3D et neuf caméras de captation représentées par leurs boîtiers et labels C1…C9. Cliquer dessus sélectionne une caméra et affiche ses aides de cadrage. Les trois écrans 16:9 démarrent sur C1 en direct.

Dans **Régie**, choisir une caméra par la liste ou son boîtier 3D, cocher les écrans cibles puis appuyer sur **DIFFUSER**. La sélection seule conserve la diffusion précédente. **Tous les écrans** coche les trois destinations ; décocher toutes les cibles désactive DIFFUSER. Les lignes « Écran n ← Cn » indiquent les routes réellement validées. Une même caméra peut alimenter plusieurs écrans ou chaque écran montrer une source différente. La coupe attend une image préparée ; une erreur conserve les routes précédentes et affiche un message. Les contrôles HTML seront remplacés par le panneau 3D à T08. La manipulation des caméras à la souris sera ajoutée à T07.

## Démarrer

Prérequis : Node.js 22.13+ (24 LTS recommandé), npm et navigateur de bureau avec WebGL2. Versions verrouillées dans `package-lock.json`.

```sh
npm ci
npm run dev
```

Ouvrir l'adresse indiquée par Vite (habituellement http://127.0.0.1:5173 ; le port suivant est choisi si nécessaire). Le clavier est actif dès l'ouverture. Z ou ↑ avance, S ou ↓ recule, Q ou ← déplace à gauche, D ou → à droite, sur le plan horizontal dans la direction du regard. Les touches sont lues selon leur lettre AZERTY. Glisser avec le bouton gauche pour orbiter, avec le bouton droit pour déplacer la cible ; utiliser la molette ou le défilement à deux doigts du trackpad pour zoomer. Les événements de pincement traduits en Ctrl+wheel sont aussi pris en charge par le contrôle BabylonJS. Après un clic hors de la scène, recliquer dans celle-ci pour réactiver le clavier. Les déplacements s'arrêtent à la perte de focus. **R** ou le bouton **Vue régie** restaure la vue d'observation sans changer les caméras de captation. **H** ou le bouton d'aides masque/affiche le frustum de la caméra sélectionnée. **Réinitialiser Cn** restaure son préréglage.

## Valider

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` lance TypeScript strict, ESLint, les tests unitaires/intégration puis le build. Les tests navigateur démarrent leur propre serveur sur le port 5187, qui doit être libre, et utilisent Chromium avec WebGL2 logiciel. Ils ne réutilisent pas un serveur existant. Le mode `e2e` sépare leur cache Vite (`node_modules/.vite-e2e`) de celui du serveur interactif (`node_modules/.vite-dev`), pour garder les shaders disponibles pendant les tests. La référence visuelle actuelle est celle de macOS/Chromium. Sur une autre plateforme, créer puis examiner sa référence avec `npm run test:e2e -- --grep 'renders WebGL2' --update-snapshots` ; ne pas renouveler les captures sans contrôle du rendu.

Pour isoler le téléchargement du navigateur comme dans cet environnement :

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/virtual-cameras-playwright npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/virtual-cameras-playwright npm run test:e2e
```

`npm run build` produit `dist/` ; `npm run preview` permet de le consulter localement. `npm run test:watch` active le mode interactif des tests unitaires. Aucun déploiement automatique.

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

Lire ces documents avant de poursuivre l'implémentation.

## En cas d'erreur de chargement d'un shader

Après une mise à jour de l'outillage, recharger une fois la page (⌘⇧R sur Mac) pour abandonner les anciens modules déjà chargés dans l'onglet. Le statut « Prêt à explorer » attend désormais la préparation du rendu ; une erreur de chargement affiche un message explicite. Le correctif et ses tests sont décrits dans [la décision 0001](docs/decisions/0001-vite-cache-et-preparation-du-rendu.md).

## Volet décors - préparation documentaire

Les documents du futur éditeur de décors sont regroupés dans [docs/decors/](docs/decors/Decors.md) : [spécification](docs/decors/Decors.md), [instructions IA](docs/decors/AGENTS.md), [architecture proposée](docs/decors/ACHITECTURE.md) et [bonnes pratiques BabylonJS](docs/decors/BABYLONJS_BONNES_PRATIQUES.md). Leurs tâches sont distinctes de celles du laboratoire ; aucun code ni statut de validation existant n’est modifié par cet ajout.

## Atelier de décors - prototype Aya
Après démarrage du serveur Vite, ouvrir /decors.html. Cette page est indépendante du laboratoire de caméras.
Configurations, catalogue, gizmos, valeurs numériques, couleurs, spots RGB, public statique, sauvegarde locale explicite et export/import du JSON du prototype.
Intégration WAM JAM Party et performances casque non validées.
Voir [le parcours de démonstration](docs/decors/POINT_PROF.md), [l’étude](docs/decors/ETUDE_EXISTANT.md) et [la décision 0005](docs/decisions/0005-atelier-decors-experimental.md).
Tests dédiés : npx playwright test --config playwright.decors.config.ts (Google Chrome installé requis).

## Dossier de présentation d’Aya
Le prototype, les tests et le dossier illustré sont rassemblés sur la branche aya-scene-et-decore.
- [Rapport illustré](docs/presentation-aya/Rapport_Aya_Decors_Concert_Virtuel.pdf)
- [Synthèse de deux pages](docs/presentation-aya/Synthese_avancement_Aya_2pages.pdf)
- [Démonstration guidée hors ligne](docs/presentation-aya/Demonstration_guidee_Aya.html) : télécharger le fichier HTML puis l’ouvrir dans un navigateur.
- [Instructions de lancement](docs/presentation-aya/LIRE_AVANT_LA_PRESENTATION.md)
- [Trame orale](docs/presentation-aya/Trame_orale_Aya.md)

Pour manipuler les décors : npm ci, npm run dev, puis ouvrir /decors.html à l’adresse indiquée par Vite.
Le dossier de présentation contient également une version construite et un lanceur local nécessitant Node.js.
La publication des fichiers sur GitHub ne déploie pas automatiquement une application web.
Les rapports constituent un état d’avancement daté : leur mention du blocage Git décrit la situation avant cette publication.
