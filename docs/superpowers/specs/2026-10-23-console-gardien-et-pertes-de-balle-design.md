# Console live : le gardien désigné, les pertes et gains de balle

Date : 2026-10-23. Décisions prises avec le propriétaire du produit, question
par question. Ce qui est marqué *(choix du rédacteur)* a été proposé par nous
et accepté dans un résumé, sans débat.

## Pourquoi

**Le gardien.** Une partie des matchs en 4v4 et en petit format se jouent
« petits poteaux » : personne n'arrête le ballon avec les mains. Soit tout le
monde peut aller au but, soit un joueur est désigné « cageman » pendant le
match, et il reste un joueur de champ. Or la console propose l'action
« Arrêt » au joueur dont le poste d'effectif est « Gardien ». Et quand aucun
joueur de la feuille n'a ce poste (deux lignes d'effectif sur trois n'en ont
pas), elle la propose à **tout le monde**. Elle compte donc des arrêts pour
des joueurs qui ne peuvent pas en faire. Ces arrêts entrent dans la note, le
classement, le joueur de la semaine et la forme.

À côté de ce problème, on en trouve un autre : le gardien est « le premier
joueur de la feuille dont le poste est Gardien », remplaçants compris. Un
gardien resté sur le banc peut ainsi récupérer les buts encaissés et la prime
« sans encaisser » du titulaire (`lib/notes`, `lib/classement`).

**Les pertes et gains.** Le propriétaire veut mesurer, joueur par joueur, les
ballons récupérés et les ballons perdus, et que ces chiffres comptent dans la
note du joueur. La console sait déjà quelle équipe a le ballon
(`lib/possession`) : c'est la base des deux nouvelles actions.

## Objectifs

1. Une case « Sans gardien de but (petits poteaux) » pour tout le match, sur
   l'écran des feuilles. Dans ce mode, personne n'a l'action « Arrêt ».
2. Avec gardien : un gardien **désigné** par feuille, et lui seul fait des
   arrêts. Les gants suivent les remplacements et les accidents du match.
3. Deux nouvelles actions joueur, « Gain de balle » et « Perte de balle »,
   proposées selon la possession. Le ballon suit la saisie, et les deux
   actions comptent dans la note.

## Non-objectifs

- Demander l'autre joueur d'une perte ou d'un gain (« Récupérée par qui ? »).
- Revoir la note, les classements ou les fiches des matchs déjà joués.
- Changer le terrain public (`TerrainCompo`) pour dessiner un petits poteaux
  sans cage. C'est souhaitable si ça ne coûte presque rien, sinon c'est une
  suite.
- Faire entrer les pertes et gains dans les suggestions d'homme du match
  (`lib/mvp`).
- Afficher les pertes et gains joueur par joueur ailleurs que dans la note
  (fiche du joueur, ligne du joueur sur la fiche du match, PDF). C'est le
  même cas que les arrêts aujourd'hui, que seule la note montre par joueur.
  Ce serait une suite.
- Le seuil de 60 minutes de la prime « sans encaisser », que les formats
  courts n'atteignent jamais (2 × 20). C'est une limite connue, qui ne change
  pas ici.
- L'application mobile : elle n'a pas de console.

## Anti-objectifs

Ces cas seraient des échecs, même si tout le reste marche :

- un deuxième geste demandé pour chaque ballon perdu : il y en a des dizaines
  par match ;
- une note de match déjà joué qui bouge après le déploiement ;
- un match « sans gardien » où un joueur peut encore poser un arrêt, ou prend
  des buts encaissés dans sa note ;
- un scoreur bloqué en plein match parce que la console ne sait plus qui est
  dans les cages.

## Décisions : le gardien

### Avant le match : l'écran des feuilles

- **Une seule case pour le match**, et non une par équipe : « Sans gardien de
  but (petits poteaux) », placée en haut de l'écran sous le format
  (« 4v4 · 2 × 20 min »). Elle est **décochée par défaut**. Elle reste
  visible et modifiable quand les deux feuilles sont déjà validées
  *(choix du rédacteur)*.
- **Avec gardien** : sur chaque feuille, le scoreur désigne le gardien en
  touchant un 🧤 à côté d'un **titulaire**. La désignation est déjà posée
  quand un titulaire a le poste « Gardien » dans l'effectif. **Une feuille ne
  se valide pas sans gardien désigné.**
- **Sans gardien** : il n'y a pas de 🧤 sur les feuilles. Le cageman est un
  joueur de champ comme les autres.
- Les deux feuilles peuvent avoir été validées ailleurs, par les managers
  depuis la fiche du match. Dans ce cas, l'écran « Les deux feuilles sont
  validées » montre le gardien de chaque équipe, ou « Gardien à désigner ».
  Le coup d'envoi n'est pas proposé tant qu'une équipe n'a pas de gardien et
  que la case n'est pas cochée. Le scoreur désigne alors le gardien par
  « Revoir les feuilles » *(choix du rédacteur)*.
- **L'adversaire hors plateforme d'un amical est dispensé de gardien.** Sa
  feuille « Joueur N » est validée d'office, sans poste, et la console ne
  peut rien saisir pour lui (« Équipe non définie ») : exiger son gardien
  bloquerait tous ces amicaux *(choix du rédacteur)*.
- **La case reste modifiable pendant le match**, depuis le menu ⋯ de la
  console, comme « Inverser les côtés ». Le gardien est souvent déjà posé sur
  une feuille faite par un manager (son terrain met le poste « Gardien » sur
  la case G) : le coup d'envoi n'est alors pas bloqué, et un petits poteaux
  peut démarrer avec la case décochée. Passer en « sans gardien » ne supprime
  aucun arrêt déjà saisi ; le scoreur les retire depuis l'historique s'il le
  faut. Repasser en « avec gardien » rend les gants à celui qui les tenait.
  Après le coup de sifflet final, la case ne bouge plus
  *(choix du rédacteur)*.

### Pendant le match

- **Sans gardien** : personne n'a « Arrêt », jamais.
- **Avec gardien** : seul le gardien **en place** a « Arrêt ». Le gardien
  n'a ni « Tir », ni « Tir cadré », ni « Hors-jeu », comme aujourd'hui.
- **Le remplaçant qui entre à la place du gardien devient gardien**, avec
  ses propres chiffres : ses arrêts, les buts encaissés pendant qu'il était
  dans les cages, sa prime s'il y a tenu le temps requis. C'est automatique,
  le scoreur n'a rien à dire de plus.
- **Un joueur déjà sur le terrain ne prend les gants que si son équipe n'a
  plus de gardien en jeu** : un rouge, ou une blessure sans changement
  possible (« Sortie sans remplaçant »). Tant que c'est le cas, tous les
  joueurs de cette équipe sur le terrain ont l'action « 🧤 Prendre les
  gants ». Celui qui la touche est gardien à partir de ce moment-là.
- Juste après le rouge ou la sortie du gardien, la console propose d'elle-même
  « Qui prend les gants ? », parmi les joueurs de l'équipe sur le terrain.
  On peut passer la question (« Un remplaçant va entrer »). L'action reste
  alors disponible *(choix du rédacteur)*.
- Ce cas couvre aussi le gardien remplaçant qu'on fait entrer à la place d'un
  joueur de champ après un rouge : il entre comme joueur de champ, puis prend
  les gants.
- **Un dépanneur rend les gants.** Tant que le gardien en place les a pris
  par « Prendre les gants » (un joueur de champ qui dépanne), l'action reste
  proposée aux autres joueurs de son équipe sur le terrain. Le gardien
  remplaçant qui entre ensuite peut donc les reprendre, sans annuler le
  temps du dépanneur dans les cages. Un gardien désigné sur la feuille, ou
  entré à la place du gardien, ne se voit jamais retirer les gants de cette
  façon : c'est la règle du propriétaire *(choix du rédacteur)*.
- Tant que personne n'a repris les gants, cette équipe n'a pas d'« Arrêt », et
  les buts qu'elle encaisse ne vont à personne.
- **Penalty « Arrêté »** : l'arrêt va au gardien en place de l'équipe qui
  défend. Sans gardien, ou sans gardien en place, l'issue s'enregistre et
  l'arrêt ne va à personne (ce qui arrive déjà aujourd'hui quand la feuille
  n'a pas de gardien).

### Dans les chiffres

- **Sans gardien** : la ligne « Arrêts » disparaît d'elle-même, puisqu'il n'y
  en a plus. Aucune note ne compte de buts encaissés ni de prime « sans
  encaisser ».
- **Note** (`lib/notes`) : chaque but encaissé (même règle qu'aujourd'hui,
  contre son camp compris) va au gardien **qui était dans les cages à ce
  moment-là**. La prime « sans encaisser » va à chaque gardien qui n'a rien
  encaissé pendant qu'il y était, et qui y est resté au moins
  `MINUTES_CLEAN_SHEET` (60) minutes. Les poids ne changent pas.
- **Classement de la plateforme** (`lib/classement`) : « matchs au but » et
  « sans encaisser » regardent qui était dans les cages, et non plus le poste
  de la feuille. Un gardien resté sur le banc n'y compte plus. Pour le
  reste, ils gardent leur mesure d'aujourd'hui, sans seuil de minutes : un
  « match au but » pour chaque joueur passé dans les cages, quelle que soit
  la durée, et un « sans encaisser » pour chacun de ceux qui n'y ont rien
  encaissé, même s'ils sont deux dans le même match. Le seuil de 60 minutes
  reste celui de la prime de la note *(choix du rédacteur)*.
- **Les matchs déjà joués, et ceux en cours au déploiement, gardent la règle
  d'aujourd'hui** : le poste de la feuille, et l'arrêt ouvert à tous quand
  personne n'a ce poste *(choix du rédacteur)*. Il faut donc qu'un match dise
  s'il est tenu sous la nouvelle règle (voir « Pistes techniques »). Un match
  jamais passé par la console, dont le résultat est saisi après coup, reste
  donc sous l'ancienne règle. Sa note est déjà nulle (`aEteChronometre`) ;
  seul son « sans encaisser » du classement suit encore le poste.

## Décisions : les pertes et gains de balle

- **Qui a quelle action** (joueurs sur le terrain seulement) :
  - l'équipe qui a le ballon : « Perte de balle » ;
  - l'équipe qui ne l'a pas : « Gain de balle » ;
  - personne n'a le ballon : tout le monde a « Gain de balle », personne n'a
    « Perte » ;
  - ballon mort (but, penalty, arrêt de jeu, mi-temps, avant-match) : les deux
    actions sont fermées, comme le tir ou la faute (`verrou` de
    `lib/etat-du-jeu`).
- **Le ballon suit la saisie** : une perte donne le ballon à l'adversaire, un
  gain le donne à l'équipe du joueur (`balleApres`, puis la bascule de
  possession). Une saisie ne compte jamais de passe.
- **Un seul geste, aucune question sur l'autre joueur.** La perte et le gain
  sont deux faits indépendants. Un ballon perdu ne finit pas toujours chez un
  adversaire : une touche, par exemple, est un ballon perdu que personne n'a
  récupéré. Le scoreur saisit ce qu'il a vu.
- **Un ballon, une saisie.** Après la perte de Koffi, l'équipe de Yao a le
  ballon, et Yao n'a plus que « Perte de balle ». L'interception se saisit
  donc soit en perte de Koffi, soit en gain de Yao, jamais les deux. Le
  propriétaire l'a choisi en connaissance de cause, contre un rattrapage
  « jusqu'au geste suivant ».
- **Toucher la pelouse ne change pas** : on donne le ballon, ou on compte une
  passe, sans nommer personne.
- **Note** : gain **+0,15**, perte **−0,1**, sur la note du match. Elle
  nourrit déjà le classement, le joueur de la semaine et la forme, donc
  ceux-ci suivent sans rien changer de plus.
- **Statistiques** *(choix du rédacteur)* : deux lignes, « Ballons
  récupérés » et « Ballons perdus », juste après « Passes », dans
  `lignesStats`. Elles apparaissent donc dans la console, sur la fiche
  publique et dans les totaux des stats de jeu d'une compétition
  (`lib/stats-competition`, qui passe par `lignesStats`). Comme les autres
  lignes, elles disparaissent quand elles sont à zéro.
- **Ni dans le fil du match ni en notification** *(choix du rédacteur)* : ce
  sont des comptables, comme le tir ou la touche (`estStatistique`,
  `estMineur`).

## Contraintes

- **Une seule réponse à « qui est dans les cages ? »**, dans un module pur
  sans SDK, lu par tous : les actions de la console, le penalty arrêté, la
  note, le classement. C'est le principe de `lib/stats-match` et de
  `lib/evenements` : deux définitions divergent dès le premier correctif.
- Les événements vivent dans `live_state.events`. Un nouveau type passe par
  `TypeEvenement` (`lib/evenements`) ; les `Record<TypeEvenement, …>` (libellés
  fr et en, emojis) et les convertisseurs de `types`, `firestore` et
  `competition-firestore` suivent le compilateur.
- **Règles Firestore** : sur un amical, un modérateur ne peut écrire que les
  clés de `champsDeLaConsole()`. Un nouveau champ de premier niveau sur le
  match doit y entrer, puis être déployé. Le déploiement est autorisé
  d'avance, à condition de comparer d'abord les règles en production au
  fichier, avec `--project koppafoot`. Sur un match de compétition, le staff
  écrit déjà ce qu'il veut, sauf `chaud` et `venue_booking`.
- `initLiveCompMatch` et `initLiveMatch` réécrivent `live_state` en entier au
  lancement : ce qui est posé avant le coup d'envoi ne peut pas vivre dans
  `live_state`.
- Le dépôt est public : les tests et les rendus n'utilisent que des équipes et
  des joueurs fictifs.
- Les tests de logique pure vont dans `scripts/test-*.ts` (tsx et
  `node:assert`, sur le modèle de `scripts/test-passes-changements-fusion.ts`),
  et sont écrits avant le code.
- La console se vérifie sur le banc d'essai sans compte
  (`src/app/banc-console/page.tsx`, jamais commité), pas sur l'accueil Direct
  en dev, qui ajoute des vues aux partenaires en production.

## Pistes techniques *(choix du rédacteur, modifiables par le constructeur)*

- **Le marqueur de la nouvelle règle** : un booléen `live_state.sans_gardien`,
  écrit au lancement (`true` ou `false`) par `initLiveCompMatch` et
  `initLiveMatch`, puis par la case du menu ⋯. Absent, le match est lu comme
  aujourd'hui. Avant le coup d'envoi, la case vit dans l'état de la console,
  qui la passe au lancement. `live_state` figure déjà dans les clés permises
  aux modérateurs : il n'y a aucune règle Firestore à changer ni à déployer.
  La contrepartie : la case se remet à « avec gardien » si la console est
  rechargée avant le coup d'envoi. On le voit sur l'écran des feuilles, et le
  coup d'envoi reste bloqué si une feuille n'a pas de gardien.
- **Le gardien désigné** : il se lit sur la feuille. Désigner un titulaire
  pose son `position` à `goalkeeper` sur la feuille de ce match, et le retire
  aux autres titulaires de cette feuille : sur une feuille, le poste est le
  rôle du jour. Les remplaçants gardent le leur. Le terrain et les
  suggestions d'homme du match suivent alors sans changement. Une case
  « sans gardien » cochée après la validation des feuilles doit pourtant
  produire le même effet partout où on compte (voir « Dans les chiffres »).
- **Les gants en cours de match** : la transmission par remplacement se
  **déduit** des événements (le joueur qui entre à la place du gardien en
  place). La prise de gants est un événement à part, porté par le joueur
  (`playerId`, `teamId`, minute), comptable et jamais notifié, que « Annuler »
  retire comme les autres. Un retrait qui remet le gardien sur la pelouse
  (le rouge annulé) emporte la prise de gants qu'il avait provoquée, sur le
  modèle du jaune qui emporte son rouge (`lib/retrait-evenement`).
- **Les minutes dans les cages** se calculent sur le modèle de
  `computeMinutesPlayed` : même tri des événements, mêmes bornes.
- **Les deux types d'événement** : `ball_won` et `ball_lost`, à l'anglaise
  comme les autres types joueur, avec les libellés « Gain de balle » et
  « Perte de balle » (« Ball won » et « Ball lost » en anglais).

## Ce qui reste au constructeur

Les noms exacts, les emojis, l'endroit du 🧤 sur une ligne de feuille (la
ligne entière sert déjà à changer le rôle), le texte de la question « Qui
prend les gants ? », l'ordre des actions dans la fenêtre du joueur, et le
découpage en commits.

## Ce qui sera fini

- Les deux corrections, sur la branche `claude/gardien-pertes-de-balle`,
  partie de `origin/master`.
- Des tests écrits d'abord pour la logique pure : qui est dans les cages, les
  actions proposées, la note, les compteurs, le ballon après une saisie.
- Tous les `scripts/test-*.ts` verts, sauf `test-registration-flow` qui
  demande des données réelles. `npx tsc --noEmit -p .` propre, et eslint
  propre sur les fichiers touchés.
- La console vérifiée sur le banc d'essai : petits poteaux, gardien remplacé,
  gardien expulsé, pertes et gains.
- Les règles Firestore déployées si un champ de premier niveau a été ajouté.
- Un commit, puis la proposition d'une PR. On ne la crée qu'avec l'accord du
  propriétaire.
