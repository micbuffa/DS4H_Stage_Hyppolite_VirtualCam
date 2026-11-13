# Réaliser le concert virtuel

Démarrer avec `npm ci` puis `npm run dev`. Ouvrir l’adresse affichée par Vite dans un navigateur de bureau doté de WebGL2. Au départ, les trois écrans montrent C1 et l’écran gauche est la seule cible cochée.

1. Cliquer sur **4** dans la grille des caméras pour préparer un plan du chanteur. Le bandeau indique C4 et les écrans continuent de montrer C1.
2. Cliquer sur **DIFFUSER**. Le plan C4 apparaît à gauche. Pour diffuser C7 à droite et au centre, choisir **7**, décocher **1**, cocher **2** et **3**, puis cliquer sur **DIFFUSER**.
3. Choisir une caméra puis **DÉPLACER** ou **ORIENTER**. Glisser un axe, un plan ou un anneau. Le relâchement valide la pose. **Échap** annule le geste. **FOV − / +** modifie l’angle vertical par pas de 5°. **VISER LA SCÈNE** et **RÉINITIALISER** aident à retrouver un cadrage.
4. Sélectionner **C9** pour voir le public depuis le plateau. **TOUS LES ÉCRANS** puis **DIFFUSER** permet de partager un seul plan sur les trois écrans. Les témoins **SÉLECTION** et **EN DIFFUSION** indiquent des états distincts.
5. Cliquer sur **PAUSE** pour figer le concert pendant la préparation d’un plan. Les caméras et les écrans restent disponibles. Cliquer sur **REPRENDRE** pour poursuivre les animations.

ZQSD et les flèches déplacent l’observateur. Glisser avec le bouton gauche pour orbiter et avec le bouton droit pour déplacer la cible. La molette ou le défilement à deux doigts règle le zoom. Cliquer sur le canvas pour lui rendre le focus. **R** ou **VUE RÉGIE** ramène à la vue initiale. **H** masque ou affiche le frustum de la caméra sélectionnée.

Dans **AIDE**, le profil **Réduite** utilise des textures 512 × 288 au lieu de 1024 × 576. Le changement conserve les affectations et remplace les images ensemble lorsque le nouveau profil est prêt. Si une source ne se prépare pas, le panneau affiche une erreur et conserve les images précédentes. Au démarrage, un écran sans source affiche **SANS SIGNAL**.
