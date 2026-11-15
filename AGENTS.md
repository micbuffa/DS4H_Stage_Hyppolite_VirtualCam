# Instructions communes aux assistants IA

## État et mandat

Ce dépôt prépare un laboratoire pédagogique BabylonJS de réalisation de concert avec caméras virtuelles. L'implémentation incrémentale est autorisée depuis la demande du 6 novembre 2026, en commençant par T01. Les tests décrits dans la spécification sont obligatoires pour chaque étape implémentée.

Au 15 novembre 2026, T00 à T18 sont terminées selon leurs comptes rendus. Les effets 2D sont validés dans `docs/validation/T13.md` à `T15.md` ; la prévisualisation dans `docs/validation/T16.md` ; les trajets dans `docs/validation/T17.md` ; les séquences, leurs commandes et exercices dans `docs/validation/T18.md`. T18 consigne 402 tests locaux et 54 parcours navigateur couverts sous Windows/Chrome/SwiftShader : 53/54 lors de la longue sélection, puis réussite du parcours d'aperçu rejoué isolément. Les cinq nouveaux parcours et le scénario 19 enrichi passent ; la capture est inspectée. T19 est la prochaine étape, non commencée, pour la stabilité en longue série et les mesures sur GPU matériel. Consulter la spécification version 2.2 pour l'état courant après cette date.

## Documents à lire avant toute intervention

1. `CAMERAS_VIRTUELLES_SPEC.md` : comportement attendu, tâches et critères de recette.
2. `ARCHITECTURE.md` : découpage obligatoire et dépendances autorisées.
3. `docs/BABYLONJS_BONNES_PRATIQUES.md` : règles de développement et de rendu.
4. Les instructions locales éventuelles du dossier concerné.

## Méthode de travail

- Respecter les instructions explicites de l'utilisateur et signaler les contradictions documentaires.
- Distinguer le comportement actuel du socle, des contrats T12, des effets 2D T13 à T15, de la prévisualisation T16, des trajets T17 et des commandes multiécrans T18 de la recette finale T19. La décision 0006 encadre les contrats, budgets et propriétaires des effets ; les rapports précisent les validations réellement exécutées. Les décisions et rapports historiques conservent leur périmètre. Une mise à jour documentaire seule ne valide aucune fonctionnalité.
- Dans la spécification, marquer les tâches terminées et validées `[DONE]` et conserver un seul marqueur `[CURRENT]` sur l’étape active ; préciser si son implémentation n’a pas encore commencé.
- Implémenter une tâche incrémentale à la fois, dans l'ordre des dépendances ; annoncer les hypothèses et mettre à jour son statut après validation.
- Pour chaque fonctionnalité implémentée, créer ses tests unitaires métier et les tests d'adaptateurs prévus ; compléter avec intégration ou navigateur lorsque le comportement dépend de BabylonJS ou du GPU.
- Tester les résultats observables et les erreurs pertinentes, sans recopier simplement les détails internes.
- Ne jamais présenter un test `NullEngine` comme une preuve de rendu visuel correct.
- Ne pas déclarer une fonctionnalité terminée si ses critères d'acceptation ou ses tests requis ne sont pas satisfaits. Expliquer toute vérification non exécutée.
- Maintenir des fichiers séparés et des dossiers thématiques ; ne pas concentrer la scène, l'interface et la logique métier dans un fichier principal.
- Consulter les API officielles pour la version installée, garder les paquets BabylonJS compatibles et ne pas inventer de signatures.
- Conserver les modifications existantes de l'utilisateur. Ne pas supprimer d'assets ou modifier l'historique Git sans demande.
- Documenter les ressources externes et leur licence. Privilégier les primitives procédurales pour le premier prototype.
- Ne pas publier, déployer ni ajouter de service distant ou de télémétrie sans demande.

## Conventions futures

- Documentation et interface en français ; identifiants du code en anglais.
- TypeScript strict, modules ES, logique métier testable sans DOM ni moteur 3D.
- Identifiants stables : caméras `1..9`, écrans `1..3` ; caméra d'observation hors de cette numérotation.
- Les changements de sélection, d'édition et de diffusion sont des commandes distinctes.
- Chaque ressource BabylonJS a un propriétaire et un cycle de libération explicites.
- Pour la phase transitions, compter les consommateurs d'aperçu et les ressources de rollback ; vérifier les plafonds prévus par la spécification (3 sources au repos sans aperçu, 4 pour aperçu/effet 2D, 5 pour trajet séquentiel). Aucun gel caché d'une source visible pendant un mélange.
- Séparer horloge du spectacle et horloge de transition. Les caméras temporaires restent hors numérotation 1..9 ; les restrictions de commande et les annulations suivent la spécification.
- Ne pas assimiler les mesures macOS/SwiftShader du socle à une recette Windows ou à une mesure sur GPU matériel ; ces vérifications restent prévues à T19.
- En fin d'intervention : résumer les changements, les validations réalisées et les limites restantes ; référencer les fichiers concernés.

## Utilisation selon l'assistant

Ce fichier `AGENTS.md` constitue le guide commun, avec la casse conventionnelle attendue notamment par Codex. `CLAUDE.md` et `GEMINI.md` y renvoient pour éviter de dupliquer les règles. Si un outil ne charge pas ces fichiers automatiquement, lui fournir explicitement les quatre documents ci-dessus dans son contexte.
