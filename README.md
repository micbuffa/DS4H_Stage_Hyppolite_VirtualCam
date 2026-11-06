# DS4H_Stage_Hyppolite_VirtualCam

Laboratoire pédagogique BabylonJS : positionner neuf caméras virtuelles et réaliser la retransmission d'un concert sur trois écrans 3D.

T01 et T02 sont implémentées : caméra d'observation, plateau de concert, toit et treillis, enceintes, barrières et trois écrans 16:9 avec mires. Les musiciens et instruments arriveront à T03 ; les flux de caméras seront ajoutés à T05/T06.

## Démarrer

Prérequis : Node.js 22.13+ (24 LTS recommandé), npm et navigateur de bureau avec WebGL2. Versions verrouillées dans `package-lock.json`.

```sh
npm ci
npm run dev
```

Ouvrir l'adresse indiquée par Vite (habituellement http://127.0.0.1:5173 ; le port suivant est choisi si nécessaire). Le clavier est actif dès l'ouverture. Z ou ↑ avance, S ou ↓ recule, Q ou ← déplace à gauche, D ou → à droite, sur le plan horizontal dans la direction du regard. Les touches sont lues selon leur lettre AZERTY. Glisser avec le bouton gauche pour orbiter, avec le bouton droit pour déplacer la cible ; utiliser la molette ou le défilement à deux doigts du trackpad pour zoomer. Les événements de pincement traduits en Ctrl+wheel sont aussi pris en charge par le contrôle BabylonJS. Après un clic hors de la scène, recliquer dans celle-ci pour réactiver le clavier. Les déplacements s'arrêtent à la perte de focus.

## Valider

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` lance TypeScript strict, ESLint, les tests unitaires/intégration puis le build. Les tests navigateur démarrent leur propre serveur sur le port 5187, qui doit être libre, et utilisent Chromium avec WebGL2 logiciel. Ils ne réutilisent pas un serveur existant. La référence visuelle actuelle est celle de macOS/Chromium. Sur une autre plateforme, créer puis examiner sa référence avec `npm run test:e2e -- --grep 'renders WebGL2' --update-snapshots` ; ne pas renouveler les captures sans contrôle du rendu.

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

Lire ces documents avant de poursuivre l'implémentation.
