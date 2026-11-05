# Vidéo joueur : « Tes buts t'attendent » — scénario

Une vidéo de **50 secondes**, verticale (1080 × 1920, 9:16, 30 images/s), pour les statuts WhatsApp, TikTok, Reels et Shorts. Elle s'adresse au joueur de quartier **qui joue déjà** dans une équipe suivie sur KoppaFoot, mais **sans compte** : ses buts sont sur les feuilles de match, à son nom, et ne mènent nulle part.

Elle se fabrique comme la [vidéo manager](../video-manager/) et la [vidéo « Suivre son match »](../video-suivre-match/) : de vraies captures de l'application, jouées sur les émulateurs Firebase avec des comptes fictifs, montées dans une ligne de temps GSAP.

---

## 1. Le message

> **Tu joues déjà. Tes buts sont déjà là. Il ne manque que toi.**

Trois idées, dans l'ordre :

1. **Tes stats existent déjà.** Chaque match couvert sur KoppaFoot inscrit les buteurs, les passeurs et les cartons sur la feuille, même pour un joueur sans compte.
2. **Crée ton compte, rejoins ton équipe : ton manager te les rend.** Une minute pour toi, un geste pour lui.
3. **Et tu vis le foot autrement** : ta fiche, ton classement, tes matchs suivis en direct.

### Ce que dit le code, et pourquoi la vidéo ne dit pas « réclame ta ligne »

J'ai suivi le vrai parcours dans le code avant d'écrire :

- **Le joueur ne réclame plus sa ligne lui-même.** Le bouton « Rattacher » de l'effectif d'une compétition (`RosterClaimList`) est réservé au superadmin, comme outil de réparation : « Players do NOT claim their line any more ». La route `roster-claims` existe toujours, mais aucun joueur ne la voit.
- **Ce sont les gestes du manager qui rendent les stats** :
  - **dans son club** (amicaux, défis) : le joueur sans compte est une fiche de l'équipe (`ghost_players`). Quand le joueur crée son compte et rejoint l'équipe, le manager le **fusionne** avec sa fiche (« Fusionner un joueur », `GhostMergeCorner`, route `/api/teams/merge-ghost`). La fusion additionne ses buts, passes et matchs sur son compte et réécrit les feuilles déjà jouées à son nom ;
  - **en compétition** : à l'inscription du club, ou en touchant « Resynchroniser » sur l'équipe de compétition, le manager rapproche les lignes tapées par l'organisateur des joueurs de son club (`lib/fusion-import`, `lib/club-import-server`). La ligne garde son identifiant, donc ses matchs, et reçoit le compte du joueur.
- **Un dossard de secours n'est personne** (`lib/dossards`) : un « N°9 » tiré par le scoreur est hors classement et ne se rattache pas tant qu'on ne l'a pas nommé. La vidéo ne s'appuie donc **que sur un joueur nommé** sur la feuille.
- **Le classement** (`/top-players`) compte déjà les joueurs sans compte, mais sans photo ni lien vers une fiche. Il se recalcule **à la fin de chaque match**, pas au moment de la fusion. La vidéo montre donc le classement **après le match suivant**.
- **Le joueur de la semaine** : l'administration le choisit chaque semaine. Il devient public avec ce chantier, livré dans une PR à part avant le tournage : la diapositive « Joueur de la semaine » en tête du carrousel du Direct, toute la semaine, avec « Voir sa fiche », « Suivre » et « Partager » (le lien et l'affiche), et l'historique des joueurs élus sur la page Top performances (`/top-players`). La vidéo filme ces écrans-là. Le consentement à l'image n'y paraît pas : le joueur le découvre dans l'application.

L'appel à l'action est donc : **« Crée ton compte. Rejoins ton équipe. Tes stats te suivent. »** La vidéo ne promet rien qui n'existe pas.

---

## 2. Les règles du film

- **Tout ce qu'on voit existe dans l'application.** Les écrans du téléphone sont de vraies captures (site en format téléphone, 390 × 844). Aucune donnée de production n'est lue ni écrite.
- **Aucun chiffre inventé présenté comme réel** : les buts sont ceux du décor fictif.
- **Ni voix off ni musique.** Comme les vidéos manager et « Suivre son match », tout passe par les titres à l'écran : la plupart des statuts se regardent sans le son. Seulement des bruitages (toucher, frappe au clavier, notification, sifflet, compteurs qui montent, déclic de l'affiche), synthétisés par `mixage.mjs`, à -14 LUFS.

### Les personnages (tous fictifs, repris de `roster.mjs`)

| Personnage | Rôle |
|---|---|
| **Ekoué Bawa** | Attaquant n°11 de l'Avenir d'Adakpamé. Sans compte au départ, il a déjà marqué. C'est le héros. |
| **Edem Amouzou** | Manager de l'Avenir. Il invite Ekoué et fusionne sa fiche avec son compte, en coulisses : on ne voit que ce qu'Ekoué reçoit. |
| **Kafui Mensah** | Coéquipier, qui a déjà un compte : c'est sa fiche qu'Ekoué voit au classement, avec une photo, quand la sienne n'en a pas. |
| **Kokou Tepe** | Manager de l'Olympique de Tokoin, l'adversaire. |

### Le décor à jouer en coulisses

Repris de la vidéo manager : Avenir d'Adakpamé contre l'Olympique de Tokoin.

1. **Match 1, avant la vidéo (le passé d'Ekoué)** : un défi joué en direct, Avenir 3 – 1 Tokoin. Ekoué, sans compte, marque deux fois ; Kafui une fois avec une passe d'Ekoué. Le classement est recalculé : Ekoué y figure, sans photo ni lien.
2. **Ekoué crée son compte à l'écran**, puis rejoint l'Avenir (invitation d'Edem acceptée à l'écran).
3. **Edem fusionne** « Ekoué Bawa (sans compte) » avec le compte d'Ekoué.
4. **Match 2, à l'écran** : Ekoué suit son prochain match en direct, puis le joue. Il marque deux fois et fait marquer Kafui (3 – 0). À la fin du match, le classement se recalcule et Ekoué y apparaît avec sa photo et son lien, ses matchs d'avant compris.
5. **L'administration l'élit joueur de la semaine** (en coulisses) : la page admin, « Publier dans l'appli ».

---

## 3. La découpe seconde par seconde

| Temps | Scène | À l'écran | Titres |
|---|---|---|---|
| **0 – 4 s** | Accroche | Le téléphone monte : la fiche du match de dimanche, 3 – 1. Les buteurs sous le score, puis la carte de l'homme du match : Ekoué Bawa. | « Ce doublé, c'est le tien. » |
| **4 – 9 s** | Le problème | Le classement des joueurs (`/top-players`) : la ligne d'Ekoué, premier, sans photo. Le doigt touche la ligne : rien ne s'ouvre. Juste en dessous, Kafui avec sa photo. | « Tes buts sont là… » puis « Mais personne ne sait que c'est toi. » |
| **9 – 11 s** | Bascule | Noir, un coup de sifflet. | « Récupère tes stats en 3 étapes » |
| **11 – 20 s** | 1. Crée ton compte | `/signup?role=player` : le prénom et le nom tapés lettre par lettre, « Continuer », la ville, « Créer mon compte ». (Le formulaire ne demande pas le poste : il se complète ensuite dans le profil.) | « Crée ton compte » · « Gratuit. Une minute. » |
| **20 – 27 s** | 2. Rejoins ton équipe | La notification « Edem Amouzou t'invite à rejoindre Avenir d'Adakpamé », puis l'invitation, le doigt sur « Accepter ». | « Rejoins ton équipe » · « Ton manager t'invite, tu acceptes. » |
| **27 – 34 s** | 3. Tes buts te suivent | Sa fiche, encore vide (0 match, 0 but, 0 passe), puis la même fiche : 1 match, 2 buts, 1 passe, et les bulles « +1 match », « +2 buts », « +1 passe ». La fusion, faite par Edem, n'est pas filmée. | « Tes buts te suivent » · « Ton manager confirme que c'est toi : tes matchs passés arrivent sur ta fiche. » |
| **34 – 41 s** | Ta place au classement | Le même classement qu'au début, sur son téléphone : sa ligne, maintenant avec sa photo, mène à sa fiche. | « Grimpe au classement » · « Ta photo, ta fiche, tes buts. » |
| **41 – 46 s** | Le joueur de la semaine | Le Direct : la diapositive « Joueur de la semaine », la semaine de son doublé, « Sa fiche · C'est toi · Partager ». Le doigt touche « Partager » : l'affiche verticale se pose par-dessus, prête pour un statut. | « Et peut-être… le joueur de la semaine. » |
| **46 – 50 s** | Fin | Logo KoppaFoot. « Tu joues déjà. », « Tes buts t'attendent. », « Crée ton compte », koppafoot.com. | — |

---

## 4. Les écrans à filmer

Format téléphone, 390 × 844, comme les autres vidéos. Les scripts de tournage s'appellent `j0-decor.mjs` … `j4-apres.mjs`.

| N° | Écran | Compte | Script |
|---|---|---|---|
| 01 | Fiche du match 1 terminé, fil avec les buts d'Ekoué | visiteur | `j1-passe.mjs` |
| 02 | `/top-players` : Ekoué sans photo ni lien, Kafui au-dessus | visiteur | `j1-passe.mjs` |
| 03 | `/signup?role=player` vide, puis rempli (une capture par lettre du prénom et du nom, comme la vidéo manager) | Ekoué | `j2-compte.mjs` |
| 04 | La cloche des notifications avec l'invitation d'Edem | Ekoué | `j3-equipe.mjs` |
| 05 | La page d'invitation, « Accepter » | Ekoué | `j3-equipe.mjs` |
| 06 | La fiche de l'équipe avec Ekoué dans l'effectif | Ekoué | `j3-equipe.mjs` |
| 07 | « Fusionner un joueur » rempli, chez Edem, et sa fenêtre de confirmation | Edem | `j3-equipe.mjs` |
| 08 | `/profile/<uid>` d'Ekoué avant la fusion (zéros), puis après | Ekoué | `j3-equipe.mjs` |
| 09 | Fiche du match 2 à venir, puis « Tu suis ce match » | Ekoué | `j4-apres.mjs` |
| 10 | Fiche du match 2 terminé | Ekoué | `j4-apres.mjs` |
| 11 | `/top-players` après le match 2 : Ekoué avec sa photo | visiteur | `j4-apres.mjs` |
| 12 | Le Direct, la diapositive « Joueur de la semaine » d'Ekoué | visiteur | `j4-apres.mjs` |
| 13 | L'affiche verticale publiée (celle que « Partager » envoie) | — | `j4-apres.mjs` |
| 14 | Top performances : l'historique des joueurs de la semaine | visiteur | `j4-apres.mjs` |

Dessinés dans l'animation, comme dans la vidéo « Suivre son match » : l'écran verrouillé et ses notifications, reprises mot pour mot de ce que la console envoie aux abonnés d'un match.

---

## 5. Validé le 2026-11-04

1. **Le message** : « Crée ton compte, rejoins ton équipe, ton manager te rend tes stats ».
2. **Le joueur de la semaine** reste, sans la fenêtre de consentement. Il s'appuie sur la diapositive du Direct et l'historique de Top performances, construits d'abord dans une PR à part (branche `claude/joueur-semaine-public`).
3. **Le son** : bruitages seulement, sans musique ni voix.
4. **Le dossier et la branche** : `docs/video-recupere-tes-stats/` et `claude/video-recupere-tes-stats`.

## 6. Révisé le 2026-11-05 : le point de vue du joueur

Demande du propriétaire, après la première version (56 s) : la vidéo montre ce que vit **le joueur**, et seulement lui.

- **Les écrans du manager sont retirés.** La fusion (« Fusionner un joueur ») se fait toujours, en coulisses, car c'est elle qui rend les stats ; à l'écran, Ekoué voit ses buts arriver sur sa fiche, et le sous-titre dit d'où ils viennent.
- **Le match suivi en direct est retiré** (la cloche, l'écran verrouillé et ses notifications). Sans second match, le classement d'après est celui de juste après la fusion, et le joueur de la semaine est celui de la semaine du doublé.
- La vidéo dure maintenant 50 secondes. Les écrans 07 (fusion), 09 et 10 (match suivi) ne sont plus tournés ; les écrans 11 à 14 se filment sur le téléphone d'Ekoué, connecté.
