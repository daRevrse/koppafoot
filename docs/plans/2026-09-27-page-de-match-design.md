# Design : La page publique d'un match, qui dit juste et se lit d'un coup

**Date :** 2026-09-27
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration. Une route publique en plus : `/api/public/photos`.

## Le problème

La page d'un match de compétition a été relue en visiteur, dans ses trois états (à venir, en direct, terminé), sur téléphone et sur ordinateur. Trois familles de défauts :

1. **Elle disait faux, ou cachait ce qu'on sait.** Un point de forme rouge sous le nom d'une équipe, en plein direct, se lisait comme un carton rouge. Un remplacement tenait sur une ligne coupée : sur téléphone, « Mawuena Dossou → … », et l'entrant disparaissait. Le passeur, que la console demande à chaque but, n'apparaissait nulle part. « 1ère mi-temps » passait sur deux lignes et le chrono touchait le nom de l'équipe voisine.
2. **Elle se lisait mal.** L'homme du match occupait un quart d'écran au-dessus de chacun des cinq onglets, sans photo ni note. « Classement » était coupé en « CLA » au bord de la rangée d'onglets, sans rien qui dise qu'elle défile, et le fil existait avant le coup d'envoi pour n'y rien montrer. Dans le fil, « BUT » en capitales écrasait le nom du buteur. L'équipe à l'extérieur était grise dans les stats : « Cartons jaunes 0 – 1 » donnait une barre grise, lue « personne ».
3. **La composition ne racontait rien, et l'ordinateur restait vide.** Onze pastilles identiques avant et après le match ; le banc coupait les noms (« M. Hounkpa… ») ; « Pas de compo » ne disait pas si elle viendrait. Sur grand écran, un terrain de 600 px dans une carte de 1 400, une équipe à la fois, et un fil de deux événements seul au milieu de la page.

## Décisions

### Dire juste

- **La forme en lettres** (V, N, D sur leur couleur) : une lettre ne se prend pas pour un carton, et elle suffit à un daltonien.
- **Un remplacement sur deux lignes** : ↑ l'entrant en gras, ↓ le sortant dessous. Lu dans `player_name` / `out_player_name`, sinon dans le texte « Sortant → Entrant » des remplacements plus anciens (`joueursDuRemplacement`).
- **Le passeur** sous le but dans le fil (« passe de … »), et sous le buteur dans le tableau d'affichage (`Buteur.passeurs`).
- **La période au-dessus du chrono** sur téléphone, à côté sur grand écran.
- **Le nom d'une équipe passe sur deux lignes** dans le tableau d'affichage plutôt que d'être coupé (« ESPOIR NYÉKONAKP… »).

### Se lire d'un coup

- **L'homme du match vit en tête du fil**, avec son visage, ce qu'il a fait (« 2 buts · 1 passe ») et sa note du match, accompagnée du nombre de faits qui la fondent (même calcul et même durée que le classement de la plateforme, voir `lib/notes`). Un match qui a un homme du match s'ouvre sur le fil.
- **Des onglets courts** (Fil, Infos, Compo, Stats, Classement) qui tiennent sur un téléphone ; quand ils dépassent quand même, le bord qui cache un onglet s'estompe, et l'onglet ouvert reste à l'écran. **Pas de fil avant le coup d'envoi.**
- **Le joueur d'abord dans le fil**, l'action en petit dessous.
- **Chaque équipe dans sa couleur sur les barres de stats** (`couleursDesBarres`). Une barre n'est pas un maillot : une couleur qui disparaîtrait sur la piste est foncée, et deux équipes du même ton laissent l'extérieur au gris d'avant.
- **Le pronostic nomme les équipes par leur sigle**, le nul par « = ». **Le classement** donne aux chiffres leur largeur et à l'équipe le reste, avec son écusson.

### Raconter le match sur le terrain

- **Des marques autour des pastilles** (`lib/recit-du-match`, pur et testé) : les buts en haut à droite (le nombre dans le ballon), le carton en haut à gauche, la sortie et sa minute en bas à droite, l'homme du match en bas à gauche. Sur le banc, l'entrée et sa minute, les buts, le carton. Par identifiant de feuille, jamais par nom.
- **Les visages des joueurs** qui ont un compte, sur les pastilles, par la nouvelle route `/api/public/photos` : `users` est fermé aux visiteurs, la route ne rend que la photo, que la fiche publique du joueur montre déjà.
- **Le banc écrit les noms** (initiale et nom de famille, sans la coupe du terrain). **Une composition absente dit si elle viendra** : « Composition à venir, le manager la publie avant le coup d'envoi ».

### Occuper le grand écran

- **Les deux compositions se font face** au lieu de se basculer.
- **Le fil a une colonne à côté de lui** : les stats et la poule des deux équipes.

La fiche d'un amical partage ces composants : elle reçoit les mêmes onglets courts, l'homme du match en tête du fil avec sa note, les marques sur le terrain et les couleurs des deux clubs sur les stats.

## Vérifications

- `mobile/src/__tests__/recit-du-match.test.ts` et `couleurs-equipe.test.ts` (`couleursDesBarres`).
- Le parcours organisateur du tutoriel rejoué sur les émulateurs, puis la page vue en visiteur dans ses trois états, sur téléphone et sur ordinateur : passeurs sous les buteurs et dans le fil, remplacement sur deux lignes, forme en lettres, période au-dessus du chrono, homme du match avec sa note (puis avec une photo posée sur son compte, sur la carte et sur sa pastille), onglets qui tiennent sur 390 px et pas de fil avant le coup d'envoi, marques sur le terrain et entrée sur le banc, stats aux couleurs des deux équipes, composition « à venir », deux terrains face à face et colonne stats et poule sur ordinateur.
