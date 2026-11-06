# 0001 — Isoler les caches Vite et attendre la préparation du rendu

Date : 6 novembre 2026. Statut : appliquée.

## Problème observé

Un onglet du serveur de développement sur 5188 utilisait encore un import de shader `default.vertex-BmcMPR6d.js`. Ce fichier renvoyait HTTP 404 après les essais navigateur, alors que le cache contenait des fichiers d'une autre génération. Le serveur interactif et le serveur Playwright partageaient `node_modules/.vite`. Le prébundling de dépendances supplémentaires pouvait remplacer des chunks encore référencés par le premier serveur ou son onglet.

Les tests antérieurs s'exécutaient sur un serveur neuf et ne couvraient pas cette coexistence. En outre, l'interface annonçait que le rendu était prêt dès le démarrage de la boucle, avant le chargement et la compilation asynchrones des shaders.

## Décisions

- Cache de développement : `node_modules/.vite-dev`.
- Cache des tests navigateur : `node_modules/.vite-e2e`, avec Vite lancé en mode `e2e`.
- Cache unitaire : `node_modules/.vite-unit`.
- En développement, le scanner part uniquement d'`index.html`. En mode e2e, les fixtures HTML sont explicitement ajoutées aux entrées. Les fichiers de test ne modifient pas implicitement le graphe de prébundling du serveur interactif.
- Le port de rendu expose `whenReady()`. L'application affiche « Prêt à explorer » seulement après une image rendue et une scène prête, cibles de rendu incluses.
- Un échec asynchrone de préparation d'effet au démarrage rejette cette attente, arrête le runtime et affiche un message de rechargement. Le statut ne reste pas vert en présence d'un échec de chargement de shader.
- Le démontage retire aussi les observateurs temporaires de préparation. Un remplacement HMR empêche les callbacks de l'ancien runtime de modifier le nouveau statut.

## Validation et portée

Un test navigateur démarre deux serveurs, ouvre une scène de développement, force une optimisation différente sur le serveur compagnon, revérifie en HTTP les anciens liens de shaders puis recharge la première scène. Les répertoires temporaires de ce test restent distincts du cache utilisateur.

Un autre test bloque intentionnellement les imports des shaders `default` et vérifie le statut d'erreur. Les unitaires couvrent l'attente d'une vraie image prête, le rejet et le nettoyage après erreur ou annulation. Le serveur interactif 5188 a également été contrôlé directement dans Chromium : HTTP 200 pour les shaders, chargement et rechargement sans erreur console ni requête échouée.

Un onglet conservant les anciens modules avant cette correction doit être rechargé une fois, éventuellement avec ⌘⇧R sur Mac. Aucun rechargement automatique en boucle ni effacement du cache du navigateur n'est introduit. Les erreurs survenant après la préparation initiale ne sont pas couvertes par cette seule promesse de démarrage ; les fonctionnalités introduisant de nouveaux effets en cours de session devront gérer leur propre disponibilité.

## Références

- [Vite : options de prébundling et entrées](https://vite.dev/config/dep-optimization-options).
- [Vite : dépannage des modules dynamiques](https://vite.dev/guide/troubleshooting).
- API BabylonJS installée : `Scene.isReady`, `Scene.onAfterRenderObservable` et `AbstractEngine.onEffectErrorObservable`.
