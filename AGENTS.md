# Instructions communes aux assistants IA

## État et mandat

Ce dépôt prépare un laboratoire pédagogique BabylonJS de réalisation de concert avec caméras virtuelles. L'implémentation incrémentale est autorisée depuis la demande du 6 novembre 2026, en commençant par T01. Les tests décrits dans la spécification sont obligatoires pour chaque étape implémentée.

## Documents à lire avant toute intervention

1. `CAMERAS_VIRTUELLES_SPEC.md` : comportement attendu, tâches et critères de recette.
2. `ARCHITECTURE.md` : découpage obligatoire et dépendances autorisées.
3. `docs/BABYLONJS_BONNES_PRATIQUES.md` : règles de développement et de rendu.
4. Les instructions locales éventuelles du dossier concerné.

## Méthode de travail

- Respecter les instructions explicites de l'utilisateur et signaler les contradictions documentaires.
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
- En fin d'intervention : résumer les changements, les validations réalisées et les limites restantes ; référencer les fichiers concernés.

## Utilisation selon l'assistant

Ce fichier `AGENTS.md` constitue le guide commun, avec la casse conventionnelle attendue notamment par Codex. `CLAUDE.md` et `GEMINI.md` y renvoient pour éviter de dupliquer les règles. Si un outil ne charge pas ces fichiers automatiquement, lui fournir explicitement les quatre documents ci-dessus dans son contexte.
