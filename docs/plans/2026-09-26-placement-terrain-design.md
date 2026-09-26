# Design : Placer ses joueurs sur le terrain de la composition

**Date :** 2026-09-26
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration : les feuilles existantes se dessinent comme avant.

## Le problème

« Difficile de placer le joueur sur le terrain comme on veut. » Vérifié : sur l'écran Compositions, toucher la case d'arrière droit et y mettre un joueur le plaçait **tout à gauche** de la défense. Le terrain ne retenait que le **poste** de la case, puis rangeait chaque ligne dans l'ordre de l'effectif. Rien ne permettait ensuite de déplacer un joueur ; dans l'éditeur de feuille de match, le terrain était en lecture seule.

## Décisions

1. **Chaque titulaire peut porter son `emplacement`** : `{ ligne, colonne }` dans la formation (ligne 0 le gardien, puis défense → attaque ; colonne 0 à gauche). Il est écrit sur les lignes de feuille (`FirestoreLineupEntry.emplacement`), sur les compositions types comme sur les feuilles d'amical et de compétition.

2. **`lib/terrain` le respecte à la case près**, avant tout le reste. Les autres joueurs se rangent comme avant, dans les cases libres. Une case invalide (formation changée, case prise deux fois) est ignorée.

3. **Déplacer fige tout le monde** (`placerSurTerrain`) : chaque titulaire reçoit la case où il est dessiné, puis le joueur déplacé prend sa nouvelle case. Si elle est occupée, les deux joueurs s'échangent. Sans ce gel, libérer une case faisait glisser les voisins. Le poste suit la case.

4. **On place en glissant.** Sur l'écran Compositions et dans l'éditeur de feuille de match, une pastille se prend et se pose sur une autre case. Un simple toucher reste un clic et ouvre le sélecteur. Dans le sélecteur, choisir un titulaire déjà placé l'échange ; choisir un remplaçant envoie l'occupant sur le banc.

5. **La prise est une poignée HTML, pas la pastille SVG.** Chrome ignore `touch-action` sur les éléments internes d'un SVG. Au doigt, glisser un joueur vers la droite revenait donc à la page précédente, et vers le bas en haut de page déclenchait « tirer pour actualiser ». Une `div` transparente en `touch-action: none` sur chaque joueur règle les deux ; le reste du terrain défile normalement.

6. **Changer de formation efface les cases choisies** : on repart des postes. Une case d'un 4-4-2 ne veut rien dire dans un 4-3-3.

7. **Console couchée** : l'équipe qui attaque vers la gauche est dessinée en miroir, son aile gauche en bas. Maintenant que l'arrière gauche est vraiment à gauche, il doit l'être aussi vu de la tribune. Quand le scoreur revalide une feuille, il garde les cases des joueurs qui restent titulaires.

## Vérifications

- `mobile/src/__tests__/terrain.test.ts` : case respectée, remplissage autour, cases invalides, gardien placé à la main, miroir, échange, gel, joueur délogé.
- Parcours joués sur les émulateurs Firebase avec Playwright : écran Compositions (case touchée respectée, glisser pour déplacer ou échanger, enregistrer puis recharger), éditeur de feuille (glisser, postes mis à jour, enregistrement, réouverture identique, fiche publique), au doigt en taille téléphone (glissés horizontal et vertical, pas de défilement ni de navigation, un toucher ouvre le sélecteur).

## Hors périmètre

- Placement libre n'importe où sur la pelouse : le terrain reste une formation à cases, dessinée à l'identique sur la fiche publique et dans la console.
- La console de compétition propose toujours la composition type du club pour les rôles, pas pour la formation ni les cases.
