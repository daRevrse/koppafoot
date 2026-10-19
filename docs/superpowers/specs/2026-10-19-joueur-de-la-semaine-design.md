# Joueur de la semaine : classement, affiche, vidéo

Date : 2026-10-19. Demande du propriétaire du produit : chaque semaine, mettre
à l'honneur le meilleur joueur de la plateforme sur les réseaux, avec une
affiche (publication) et une courte vidéo animée pour YouTube Shorts et
TikTok. Le choix se fait côté administration, à partir d'un classement de la
semaine.

Maquettes et essai vidéo validés dans la conversation du 2026-10-19 (direction
« collage », d'après une affiche de bienvenue du São Paulo FC). Le script qui
les a produits, `scripts/maquettes-joueur-semaine.tsx`, est jetable : il sert
de référence visuelle et de preuve que le moteur d'affiches (Satori) sait tout
dessiner, pas de base de code.

## Pourquoi

KoppaFoot se finance par ses sponsors (voir le dossier business plan) et se
présente comme un club-média. Un rendez-vous chaque lundi donne du contenu
régulier aux réseaux, met en avant des joueurs de quartier, et ouvre un
emplacement à vendre aux partenaires. C'est aussi la première fois que le
travail des organisateurs et des scoreurs se voit hors du site.

## Préalable

Le classement de la semaine s'appuie sur deux correctifs du 2026-10-19, sur
la branche `claude/classement-apres-coup` : les joueurs nommés d'un camp sans
feuille comptent (`nommesSansFeuille`), et un match jamais chronométré ne
note personne (`aEteChronometre`, lib/notes). Ils doivent être fusionnés dans
master avant que ce chantier commence, ou ce chantier part de leur branche.

## Ce qui est décidé (par le propriétaire)

- **La semaine va du lundi au dimanche.**
- **Les dossards ne comptent jamais.** Une ligne de feuille au dossard (« N°8 »,
  identifiant `dos-…`) ou un adversaire hors plateforme (`ext-…`) n'est pas un
  candidat, quelle que soit sa semaine.
- **L'administration peut écarter une compétition pour une semaine donnée**,
  quand sa saisie n'est pas fiable (Dékawowo Sportfest, semaine du 12 octobre).
  C'est un choix de semaine, pas une exclusion définitive.
- **Le classement de la semaine est réservé à l'administration** pour
  l'instant : aucune page publique.
- **Un doublé l'emporte sur une note** : la semaine du 12 octobre, l'affiche
  revient à AMEGAN Kodjo (FC LION, 2 buts, match saisi après coup, sans
  note) plutôt qu'au meilleur noté (6,7 sur 2 faits) ou à l'homme du match
  désigné par le scoreur.
- **Un joueur peut avoir joué plusieurs matchs dans la semaine**, dans
  plusieurs compétitions et pour plusieurs équipes : l'affiche montre **une
  ligne par match**.
- **La performance n'est qu'un détail** : elle tient en petit, en bout de ligne
  (« 2 BUTS », « 1 PASSE »). Le titre honore le joueur : « JOUEUR DE LA
  SEMAINE », jamais l'exploit (« DOUBLÉ »).
- **Direction artistique : blanc, noir et vert KoppaFoot.** Fond blanc pur,
  sans grain. Jamais les couleurs du club.
- **Pas de période datée** (« du 12 au 18 octobre 2026 ») sur l'affiche.
- **L'intitulé des lignes est « MATCHS DE LA SEMAINE ».**
- **Les écussons des équipes du joueur vont en colonne, en haut à droite**, à
  côté de la photo.
- **La vidéo : l'affiche se monte sous nos yeux**, chaque élément entre à sa
  façon. L'enchaînement de l'essai est validé tel quel (voir « La vidéo »).
- **Les zones partenaires sont configurables**, et l'emplacement se vend comme
  les autres, depuis la page admin Partenaires, avec ses dates.
- **L'accord du joueur avant toute publication.** L'affiche publie un visage et
  un nom sur TikTok et YouTube ; beaucoup de joueurs n'ont pas de compte (leur
  photo a été posée par un organisateur) et certains sont mineurs. Les boutons
  qui téléchargent l'affiche et génèrent la vidéo restent grisés tant que
  l'admin n'a pas coché « J'ai l'accord du joueur, ou de ses parents s'il est
  mineur, pour publier son image ». L'accord se demande hors de l'outil, par
  l'organisateur ou le manager ; la case n'est pas enregistrée et se recoche à
  chaque affiche.

## Objectifs, non-objectifs, anti-objectifs

Objectifs :

1. Une page admin « Joueur de la semaine » : choisir la semaine, écarter des
   compétitions, voir le classement, choisir le joueur.
2. L'affiche en deux formats, à télécharger : **publication 1080×1350** (PNG)
   et **vertical 1080×1920** (PNG).
3. La **vidéo verticale 1080×1920** (MP4), générée depuis la même affiche.
4. Un emplacement partenaire **« Affiche Joueur de la semaine »**, géré dans la
   page Partenaires existante.

Non-objectifs (pas maintenant) :

- Une page publique du classement de la semaine, ou un badge « joueur de la
  semaine » sur le profil.
- Un historique des joueurs élus.
- La publication automatique sur les réseaux : l'admin télécharge, puis
  publie lui-même.
- La musique : la vidéo sort sans son, le son s'ajoute au moment de publier
  sur TikTok ou YouTube, qui gèrent les droits.
- Le détourage du joueur (photo sans fond).
- Les partenaires d'une compétition précise sur l'affiche (voir
  « Partenaires »).
- Le comptage des vues et des clics d'un partenaire sur l'affiche : une image
  publiée ailleurs ne se mesure pas.

Anti-objectifs (ce qui serait un échec même si ça marche) :

- **Un dossard, ou un « Joueur 9 » généré, à l'affiche.**
- **Un cadre vide « PARTENAIRE »** sur une affiche ou une vidéo téléchargée :
  c'est un repère de maquette, jamais un rendu.
- **Une affiche qui crie la statistique** au lieu d'honorer le joueur.
- **Une affiche téléchargée sans que l'admin ait confirmé l'accord du joueur.**
- **Une affiche et une vidéo qui divergent** : la vidéo est l'affiche qui se
  monte, sa dernière image est l'affiche verticale.
- **Le texte important sous l'interface de TikTok** (voir « Contraintes »).

## A. Le classement de la semaine

### Quels matchs

Les matchs **terminés** de la plateforme dont la `date` (« AAAA-MM-JJ », heure
de Lomé) tombe entre le lundi et le dimanche de la semaine choisie. La
lecture est celle du classement de la plateforme (`matchsDeLaPlateforme` dans
lib/classement-admin) : les compétitions publiques, hors compétitions
d'entraînement (`isSandbox`) et hors matchs d'exhibition, plus les amicaux.

Sont écartés :

- les compétitions que l'admin décoche pour cette semaine (les amicaux forment
  un groupe « Matchs amicaux » qu'on décoche d'un coup) ;
- *mon choix :* **les forfaits** (`forfeitByTeamId`) : leur score est attribué,
  pas joué, comme dans les statistiques de jeu (lib/stats-competition).

La semaine proposée à l'ouverture est **la dernière semaine terminée** (le
lundi, c'est celle qui vient de finir). On peut remonter aux semaines
précédentes.

### Qui a joué quel match

Les mêmes règles que le classement de la plateforme, appliquées match par
match :

- **la feuille** décide quand le camp en a une ;
- **un camp de compétition sans feuille** (score saisi après coup) est
  représenté par les joueurs que ses événements nomment (`nommesSansFeuille`,
  lib/classement, branche `claude/classement-apres-coup`) ;
- **un amical renseigné après coup** l'est par ses buteurs déclarés
  (`recorded_scorers`, voir `ContributionDirecte`) ;
- les lignes `dos-…` et `ext-…` sont écartées (`estLigneHorsPlateforme`).

**L'identité suit le classement, avec un garde-fou** (*mon choix*) : le
compte quand la ligne en a un, et alors le joueur réunit ses matchs de toutes
ses équipes. **Sans compte, le nom ET l'équipe** : le classement de la
plateforme fusionne deux homonymes sans compte (`cleDe`), ce qui passe dans
une liste de cent, mais une affiche qui réunirait deux « Kossi » de deux
clubs inventerait un joueur. Le prix : un joueur sans compte qui a joué pour
deux équipes y paraît en deux candidats.

### Ce qu'on retient de chaque match

Pour chaque match d'un joueur : la date, la compétition (« Match amical » pour
un amical), **son équipe** dans ce match (nom, écusson), l'adversaire, le
score, ses buts et ses passes (un csc ne compte pas, un but annulé par la VAR
non plus), et sa note s'il en a une (match chronométré, voir lib/notes).

### L'ordre du classement

*Mon choix, d'après la décision « un doublé l'emporte sur une note » :* buts
de la semaine, puis passes, puis note moyenne sur ses matchs notés (moyenne
simple : ils sont tous de la même semaine ; un joueur sans note passe après
ceux qui en ont une), puis nombre de fois homme du match, puis le nom.

L'admin **peut choisir un autre joueur que le premier** : le classement
propose, l'admin décide (un gardien qui a tout arrêté n'a ni but ni passe).

### Ce que la page montre

Pour chaque joueur : son nom, ses équipes, son nombre de matchs, ses buts, ses
passes, sa note moyenne, ses titres d'homme du match, et s'il a une photo.
*Mon choix :* les trente premiers, et une recherche par nom pour aller
chercher les autres (une semaine chargée compte des centaines de joueurs).

**Rien n'est enregistré** : ni les compétitions écartées, ni le joueur choisi,
ni la photo, ni les partenaires décochés, ni la case d'accord du joueur. La page sert à fabriquer l'affiche ;
la refaire demande de refaire ses choix. (Un historique des élus est un
non-objectif.)
*Mon choix :* sous la liste, une ligne signale combien de joueurs au dossard
ont été écartés, avec leurs chiffres, pour que l'admin puisse demander à
l'organisateur de les nommer.

## B. L'affiche

Les deux formats partagent une seule mise en page, celle des maquettes
validées (`C2-publication.png`, `C2-vertical-3-matchs.png`).

### De haut en bas

- **Un bloc noir** en haut à gauche, et **une bande verte** verticale qui
  descend le long de la photo, avec « /// SEMAINE 42 » écrit à la verticale (le
  numéro de semaine ISO). *Ce texte est resté sans objection ; à confirmer à la
  relecture.*
- **La photo**, sur un rectangle sombre, qui grandit quand la semaine a peu de
  matchs (pas de trou au-dessus du pied).
- **La colonne d'écussons**, en haut à droite : une équipe par écusson, la plus
  récente d'abord, quatre au plus. Une équipe sans logo prend son initiale
  dans un rond vert.
- **Le bloc noir de droite**, derrière le bandeau, qui s'arrête avec le nom.
- **Le bandeau vert** « JOUEUR DE / LA SEMAINE », en Anton, noir sur vert, sur un
  camouflage de verts proches.
- **L'étiquette noire du nom**, en Outfit, blanc.
- **« MATCHS DE LA SEMAINE »**, puis une ligne par match : la date
  (« DIM. 18 OCT. »), l'écusson de son équipe, la compétition en petit,
  l'affiche en gras, et le détail de sa performance en vert, à droite, ou rien.
- **Le pied** : le logo KoppaFoot et les partenaires.

### Les textes

- **L'affiche d'un match** met son équipe en premier : « FC LION 4–0 PRAISE
  FC », même quand FC LION jouait à l'extérieur. *Mon choix.*
- **Le nom affiché est modifiable avant de générer.** La base le range comme
  il a été saisi (« AMEGAN Kodjo », nom puis prénom, parfois avec une
  faute) : on ne sait pas de façon fiable lequel est le prénom. Le champ est
  prérempli avec le nom en capitales, l'admin le corrige s'il veut. *Mon
  choix.*
- **Un texte trop long se raccourcit d'une ellipse** (voir `raccourcir` dans
  lib/og-phase-finale) : une affiche de match ne passe jamais à la ligne.
- **Quatre lignes de matchs au plus.** Au-delà, la quatrième devient « + N
  autres matchs ». *Mon choix.*

### La photo

Par ordre de préférence :

1. **une photo choisie par l'admin** au moment de générer (un fichier de son
   ordinateur), non conservée : elle ne sert qu'à cette affiche et à sa
   vidéo. *Mon choix* : les photos d'effectif sont des photos de téléphone
   d'environ 383×512, floues une fois agrandies ;
2. la photo du profil, pour un joueur qui a un compte ;
3. pour un joueur sans compte, celle de sa ligne d'effectif ou de sa fiche de
   club (la logique de `photosSansCompte`, lib/classement-admin) ;
4. sinon, ses initiales en Anton sur le rectangle sombre. *Mon choix.*

## C. La vidéo

**1080×1920, 30 images par seconde, 10 secondes, MP4 (H.264), sans son.** La
dernière image est l'affiche verticale.

L'enchaînement validé (celui de l'essai `essai-video.mp4`) :

| Instant | Élément | Entrée |
|---|---|---|
| 0 s | bloc noir du haut | descend du haut (0,45 s, sortie cubique) |
| 0,1 s | bande verte | descend du haut (0,6 s) |
| 0,35 s | photo | se dévoile de bas en haut (0,75 s), en reculant d'un zoom 1,08 à 1 |
| 0,75 s | « /// SEMAINE 42 » | monte en fondu (0,5 s) |
| 0,9 s | bloc noir de droite | glisse depuis la droite (0,5 s) |
| 1,2 s | bandeau | claque depuis la gauche, dépasse et revient (0,6 s, « back ») |
| 1,75 s | étiquette du nom | glisse depuis la droite (0,45 s) |
| 2,2 s | écussons | tombent et rebondissent, un toutes les 0,2 s (0,7 s, « bounce ») |
| 2,6 s | « MATCHS DE LA SEMAINE » | fondu (0,35 s) |
| 2,8 s | lignes de matchs | montent en fondu, une toutes les 0,22 s (0,45 s) |
| 3,7 s | pied | monte en fondu (0,5 s) |
| 1,6 s → 10 s | photo | zoom très lent de 1 à 1,045 |

Les courbes et les valeurs exactes sont dans `etat()`, dans le script de
maquettes.

**Comment elle se fabrique** (*mon choix*) : **dans le navigateur de l'admin.**
Le serveur rend l'affiche en calques, un par élément, chacun recadré sur ce
qu'il occupe, avec sa position. La page les anime sur un `<canvas>`, image par
image, et encode le MP4 avec WebCodecs (`VideoEncoder`) et une bibliothèque de
multiplexage MP4. Pas de serveur de rendu, pas de service payant, et la vidéo
reste par construction identique à l'affiche. Vercel ne fournit pas ffmpeg, et
rendre 300 images dans une fonction serveur dépasserait ses limites.

## Partenaires

- **Un nouvel emplacement** `affiche_semaine`, libellé « Affiche Joueur de la
  semaine », dans la liste fermée de lib/partenaires (`EMPLACEMENTS`,
  `LIBELLE_EMPLACEMENT`). La page Partenaires le propose alors comme les
  autres, avec ses dates et son interrupteur.
- **Qui paraît** : les partenariats à l'affiche le jour où l'admin génère
  (`aLAffiche`, `jourDeLome`), qui ont cet emplacement. *Mon choix* : seuls les
  partenariats généraux (`competition_id` vide) ; ceux d'une compétition sont
  un non-objectif.
- **Deux zones au plus.** S'il y a plus de candidats : les partenaires avant
  les annonces, puis le partenariat le plus récent. L'admin voit qui va
  paraître et peut en décocher pour cette affiche. *Mon choix.*
- **Le visuel** : la bannière 4:1 quand le partenariat en a une (les zones font
  à peu près ce format), sinon le logo, centré dans la zone sur fond blanc,
  sans cadre. Sans image du tout, le nom de la marque en Outfit.
- **Sans partenaire, le pied ne garde que le logo KoppaFoot.** Jamais de cadre
  vide. Avec un seul, il prend la place de droite.

## Contraintes

- **Satori, pas un navigateur** : flexbox seulement, tout élément à plusieurs
  enfants déclare `display: flex`, pas de filtre CSS, pas de WebP (lib/og-da
  réencode en PNG). Les dégradés linéaires et `backgroundClip: "text"`
  fonctionnent (vérifié). **Un dégradé radial a noirci toute la photo** dans
  une maquette : à éviter.
- **Polices et ressources** : Anton et Outfit, déjà chargées par
  `chargerRessources` (lib/og-da). Les images distantes passent par
  `imageDistante` (hôtes du Storage seulement).
- **Couleurs** : blanc `#ffffff`, noir `#0b0b0b`, vert `#10b981`
  (`--color-primary-500`), vert de texte `#047857`, camouflage du bandeau
  `#0ea371`, `#1fc58f`, `#0b9a69`, `#14b884`.
- **Le vertical sous TikTok** : tout ce qui compte tient entre y = 150 et
  y = 1480, et à gauche de x = 940 dans la moitié basse (les boutons de
  droite). La colonne d'écussons, en haut à droite, est hors de leur portée,
  à vérifier sur une vraie publication.
- **Une semaine de Lomé** : UTC+0, sans heure d'été ; les dates des matchs sont
  déjà des jours de Lomé.
- **L'administration seule** : routes d'API protégées par `exigerSuperadmin`
  (lib/admin-api-auth), page appelée avec le jeton Firebase, comme
  /admin/audience.
- **La vidéo ne dépend pas du temps réel.** Elle se calcule image par image
  (t = n / 30), jamais au rythme de `requestAnimationFrame` : un onglet en
  arrière-plan, ou le volet de prévisualisation de l'outil, ne fait pas
  tourner `requestAnimationFrame`.
- **Le navigateur de l'admin** : WebCodecs existe sur Chrome et Edge de bureau.
  Ailleurs, la page le dit et propose l'affiche seule.

## Laissé au constructeur

- Le découpage en fichiers. Une piste : un module pur pour la semaine et le
  classement (testé par un script `scripts/test-…` comme lib/classement), un
  module serveur pour la lecture des matchs, des photos et des partenaires,
  un module Satori pour l'affiche et ses calques, des routes sous
  `/api/admin/joueur-semaine`, la page `/admin/joueur-semaine`, et une entrée
  « Joueur de la semaine » dans le groupe « Communication » de la barre latérale
  (components/layout/AdminSidebar).
- La bibliothèque de multiplexage MP4 et la façon de transmettre les calques
  (images en ligne dans un JSON, ou une adresse par calque).
- Les noms des fichiers téléchargés.
- La mise en page exacte pour quatre lignes et plus, dans les limites
  ci-dessus.
