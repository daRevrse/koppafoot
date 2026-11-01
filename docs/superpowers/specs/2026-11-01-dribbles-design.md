# Les dribbles dans la console

Date : 2026-11-01. Demande du propriétaire du produit : pouvoir ajouter les
dribbles d'un joueur depuis la console. Ce qui est marqué *(choix du
rédacteur)* a été proposé par nous, dans la logique des pertes et gains de
balle (`2026-10-23-console-gardien-et-pertes-de-balle-design.md`).

## Ce qui est décidé avec le propriétaire

- **Deux actions, « Dribble réussi » et « Dribble raté »**, dans la fenêtre
  d'un joueur sur le terrain.
- **Un dribble réussi vaut +0,1 dans la note du match**, un peu moins qu'un
  ballon récupéré (+0,15). La note nourrit déjà le classement, le joueur de la
  semaine et la forme : ils suivent sans rien changer de plus.

## Les choix de détail *(choix du rédacteur)*

- **On ne dribble qu'avec le ballon** (`dribblePossible`, `lib/etat-du-jeu`) :
  les deux actions sont proposées aux joueurs de l'équipe qui a le ballon, et à
  tous quand personne ne l'a encore. Après un dribble raté, l'adversaire a le
  ballon : ses joueurs ont les dribbles, ceux d'en face ne les ont plus. Un
  ballon, une saisie, comme pour les pertes.
- **Le ballon suit la saisie** (`balleApres`) : réussi, il reste à l'équipe du
  dribbleur ; raté, il passe en face.
- **Le dribble raté EST un ballon perdu.** Il pèse comme lui dans la note
  (−0,1) : le scoreur qui saisit « Perte de balle » ou « Dribble raté » pour le
  même ballon ne change pas la note. Il compte aussi dans la ligne « Ballons
  perdus », comme le tir cadré compte dans « Tirs ».
- **Deux lignes de statistiques**, juste après « Ballons perdus » :
  « Dribbles » (tentés) et « Dribbles réussis », la lecture de « Tirs » et
  « Tirs cadrés ». Elles apparaissent dans la console, sur la fiche publique et
  dans les totaux d'une compétition, et disparaissent à zéro.
- **Pas pour le gardien**, qui n'a pas non plus le tir : sa fenêtre reste
  courte.
- **Ni dans le fil ni en notification** : des comptables (`estStatistique`,
  `estMineur`), comme le tir ou la perte de balle.
- **Les types** : `dribble` et `dribble_failed`, libellés « Dribble réussi » et
  « Dribble raté » (« Successful dribble », « Failed dribble »), emojis 🌀 et
  💥.

## L'application Android déjà installée

Elle embarque sa copie des libellés : tant qu'elle n'est pas mise à jour, un
dribble s'affiche « Événement » dans le fil d'un match (`libelleDuFait` a un
cas par défaut, rien ne plante). La version suivante de l'application le
range avec les compteurs.

## Corrigé au passage : le brouillon d'une feuille effacé par l'autre

En testant sur la console couchée, où les deux feuilles s'affichent côte à
côte : valider la feuille de domicile effaçait le brouillon de l'extérieur
(rôles et dossards du jour). Les deux feuilles se ressemaient à chaque
instantané du match, parce que ses tableaux sont neufs à chaque lecture. Elles
se ressèment désormais sur leur propre contenu.

## Vérifié

- `scripts/test-dribbles.ts` : qui peut dribbler, le ballon après, les
  compteurs, la note. Les autres `scripts/test-*.ts` restent verts.
- Sur les émulateurs Firebase, console couchée : les deux feuilles remplies
  côte à côte puis validées, le match lancé ; Koffi (son équipe a le ballon) a
  les deux dribbles ; après le dribble raté d'un coéquipier, il ne les a plus
  et l'adversaire les a ; les deux événements sont écrits ; les compteurs
  disent « Ballons perdus 1 – 0 », « Dribbles 2 – 0 », « Dribbles réussis
  1 – 0 ».
