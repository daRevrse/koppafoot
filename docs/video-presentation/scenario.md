# Vidéo de présentation KoppaFoot (YouTube) : scénario et voix off

Une vidéo d'**un peu moins de 3 minutes**, au format horizontal (1920 × 1080, 16:9, 30 images/s), pour la chaîne YouTube. Elle présente toute l'application, de A à Z. Le fil rouge est **un week-end de l'Avenir d'Adakpamé**, du recrutement au palmarès.

La voix off est générée par une IA. Ce document donne :

1. les personnages et les règles du film ;
2. le découpage scène par scène : ce qu'on voit et ce qu'on entend ;
3. le **texte de la voix off seul**, prêt à coller dans l'outil de synthèse ;
4. la description YouTube avec ses chapitres.

---

## 1. Les règles du film

**Tout ce qu'on voit existe dans l'application.** Les écrans de téléphone sont de vraies captures, jouées sur les émulateurs Firebase avec des comptes fictifs, comme pour les autres vidéos du dossier `docs/`. Aucune donnée de production n'est lue ni écrite.

**Aucun chiffre inventé présenté comme réel.** Pas de « des milliers d'utilisateurs », pas de nombre de matchs. Les scores, les notes et les j'aime à l'écran sont ceux du décor fictif.

**La vidéo ne parle pas du paiement mobile des réservations.** Il n'est pas encore dans l'application (voir [la vidéo terrains](../video-terrains/)). Ici, l'équipe demande un créneau et le gérant le confirme, comme aujourd'hui.

**Deux fonctions sont ajoutées en même temps que ce scénario**, sur la même branche :

- la **notification de commentaire** : l'auteur d'une publication est prévenu quand on la commente ;
- l'**annonce de recrutement** : le manager qui ouvre le recrutement de son équipe peut l'annoncer dans la Tribune, sous son nom.

Le tournage se fera une fois ces deux fonctions fusionnées.

### Les personnages (tous fictifs)

Ce sont les personnes des guides et des autres vidéos.

| Personnage | Rôle dans le film |
|---|---|
| **Edem Amouzou** | Manager de l'Avenir d'Adakpamé. Il crée l'équipe, recrute, défie, compose. |
| **Kafui Mensah** | Attaquant de l'Avenir. Il marque deux fois, devient homme du match et publie dans la Tribune. |
| **Kokou Tepe** | Manager de l'Olympique de Tokoin, l'adversaire du samedi. |
| **Komi Adjovi** | Arbitre du match, désigné depuis son corps arbitral, « Les Sifflets du Golfe ». |
| **Afi Lawson** | Scoreuse : elle tient la console au bord du terrain. |
| **Elikem** | Supporter. Il n'est pas au stade, il suit le match sur son téléphone. |
| **Yawo Agbeko** | Gérant du Complexe sportif de Bè, où se joue le match. |
| **Kossi Mensah** | Organisateur de la Coupe des Quartiers 2026. |

### Le style

- **Fond** : nuit verte, les projecteurs du stade de la [vidéo terrains](../video-terrains/), la foule de la [vidéo Tribune](../video-tribune/).
- **Le téléphone** est à gauche ou au centre ; les titres et les mots clés de la voix off s'affichent à côté, en Outfit, avec les couleurs de KoppaFoot.
- **Chaque chapitre s'ouvre sur une carte de titre** de 1 seconde, avec le jour (« Lundi », « Samedi, 16 h »…) : le spectateur suit le week-end.
- **Musique** : afro-pop ou afrobeat instrumental, assez bas sous la voix (–18 à –20 dB), qui remonte sur l'intro, le coup de sifflet final et la fin.
- **Bruitages** : sifflet, foule, vibration du téléphone, touchers de l'interface (comme dans la vidéo « Suivre son match »).
- **Sous-titres** : un fichier `.srt` tiré du texte ci-dessous, à charger dans YouTube Studio.

---

## 2. Le découpage

Les temps sont indicatifs : ils seront recalés sur la durée réelle des fichiers audio (voir « Générer la voix », plus bas). Le débit compté est d'environ **deux mots et demi par seconde** (427 mots, soit 2 min 45 de parole), plus les cartes de titre et les silences qui laissent parler les images. Une voix plus rapide raccourcit le film ; il ne doit pas dépasser 3 minutes.

### Scène 01 · Intro (0:00 – 0:16)

**À l'écran.** Nuit. Un terrain de quartier vu de haut ; les lignes se tracent, un ballon roule. Flashs rapides : un but, un arrêt, des bras levés. Puis tout s'éteint d'un coup : « Et le lundi ? » Le logo KoppaFoot s'allume au centre du stade, projecteurs un par un.

**Voix off.**

> Chaque week-end, dans nos quartiers, on joue. Des buts, des arrêts, des héros.
> Et le lundi… plus rien. Pas de score, pas de trace.
> Koppa Foot, c'est l'application du foot amateur. Viens vivre un week-end avec l'Avenir d'Adakpamé.

### Scène 02 · Le Direct (0:16 – 0:32)

**À l'écran.** Carte de titre « Vendredi soir ». Le téléphone d'Elikem ouvre le Direct : l'affiche du match à venir, les matchs du moment avec leur score, la carte du classement. Gros plan sur « Qui va gagner ? » : Elikem touche l'Avenir, « Pronostic validé ». Puis il touche la cloche de la fiche du match : « Tu suis ce match ».

**Voix off.**

> Tout commence sur le Direct. Les matchs du moment, les scores, les buteurs, les compétitions.
> Avant le coup d'envoi, tu donnes ton pronostic.
> Et si un match t'intéresse, tu le suis : chaque but arrive sur ton téléphone.

### Scène 03 · Ton équipe (0:32 – 1:00)

**À l'écran.** Carte de titre « Lundi ».

1. **Créer.** Edem crée l'équipe : le nom tapé lettre par lettre, l'écusson, la fiche de l'équipe. (Captures de la [vidéo manager](../video-manager/), à refaire en 16:9.)
2. **Recruter.** Dans les paramètres de l'équipe, sous « Statut de recrutement », il touche « Annoncer dans la Tribune » : il coche « Gardien », publie. (Une équipe recrute dès sa création ; quand le manager rouvre le recrutement, la même fenêtre s'ouvre d'elle-même.) L'annonce apparaît dans la Tribune, signée « Edem A. · Manager », avec la carte de l'équipe, « Cherche : Gardien » et le bouton « Demander à rejoindre ».
3. **Le mercato.** Edem invite deux joueurs. De l'autre côté, un gardien touche « Demander à rejoindre » sous l'annonce : la demande arrive chez Edem. L'effectif se remplit.
4. **Défier.** Il défie l'Olympique de Tokoin : la date (samedi, 16 h), le terrain choisi dans l'annuaire, « Complexe sportif de Bè ». Le défi est accepté ; le statut du terrain passe à « Terrain confirmé ».

**Voix off.**

> Edem est manager. Il crée l'Avenir d'Adakpamé : un nom, un écusson, et l'équipe existe.
> Il lui manque un gardien. Il ouvre le recrutement, et l'annonce part dans la Tribune, sous son nom.
> Au mercato, il invite des joueurs. D'autres demandent à le rejoindre.
> Pour samedi, il défie l'Olympique de Tokoin, au Complexe sportif de Bè, trouvé dans l'annuaire.
> Le gérant confirme le créneau. Le match est calé.

### Scène 04 · Jour de match (1:00 – 1:36)

**À l'écran.** Carte de titre « Samedi, 16 h ».

1. **La composition.** Edem glisse ses joueurs sur le terrain de la composition. Les pastilles de condition et de forme sont visibles : un joueur « Blessé » reste sur le banc.
2. **L'arbitre.** Notification « Désignation » sur le téléphone de Komi Adjovi ; l'écran « Mes désignations ».
3. **La console.** Afi saisit les faits du match : but de Kafui, passeur, carton jaune, remplacement. Un pictogramme « hors ligne » s'allume puis s'éteint : rien n'est perdu.
4. **Le supporter.** Écran verrouillé d'Elikem : coup d'envoi, but à la 23ᵉ, mi-temps, but à la 67ᵉ, score final (les notifications exactes de la console, comme dans la vidéo « Suivre son match »).
5. **Le coup de sifflet.** Score final, 2 – 0. Le bandeau « Homme du match » se pose : Kafui, sa photo, sa note.

**Voix off.**

> Samedi. Edem compose son équipe en glissant ses joueurs à leur poste. Il voit qui est apte, qui est blessé, qui est en forme.
> Komi, l'arbitre, a reçu sa désignation.
> Au bord du terrain, Afi saisit tout en direct, même quand le réseau coupe : buts, passes, cartons, remplacements.
> Elikem n'est pas au stade, mais il ne rate rien : le coup d'envoi, le but à la vingt-troisième minute, la mi-temps.
> Coup de sifflet final : deux à zéro. L'homme du match, c'est Kafui : deux buts, et la meilleure note du match.

> **À vérifier au tournage** : que Kafui ait bien la meilleure note du match dans le décor, sinon retirer « et la meilleure note du match ».

### Scène 05 · La Tribune (1:36 – 1:57)

**À l'écran.** Carte de titre « Samedi soir ». La foule de la vidéo Tribune.

1. Kafui publie : « Victoire 2-0 à Bè ! Doublé pour moi, merci les gars », avec sa photo.
2. Les cœurs s'envolent, les commentaires tombent. Sur l'écran verrouillé de Kafui : « Afi L. a commenté ta publication ».
3. Le fil défile : le résultat officiel publié par KoppaFoot, puis l'annonce de recrutement d'Edem, avec son bouton.
4. Glissement vers les Actus : la grille d'articles de la presse sportive du jour.

**Voix off.**

> Le soir, tout le monde se retrouve dans la Tribune. Kafui raconte sa victoire, photo à l'appui.
> Les j'aime pleuvent, les commentaires aussi : Kafui est prévenu à chaque fois.
> Ici tombent aussi les résultats officiels et les annonces des managers qui recrutent.
> Et dans les Actus, la presse sportive du jour.

### Scène 06 · Ta fiche de joueur (1:57 – 2:15)

**À l'écran.** Carte de titre « Dimanche ».

1. La fiche de Kafui : son état de forme, à gauche ce qu'il déclare (« Apte »), à droite ce que disent ses matchs.
2. Le classement des joueurs : la ligne de Kafui monte de quelques places, sa pastille de note s'allume.

**Voix off.**

> Chaque joueur a sa fiche. Kafui y déclare sa condition : apte, blessé, de retour samedi.
> Ses matchs, eux, disent sa forme.
> Et ses notes le placent au classement des joueurs, sur ses cinq derniers matchs. Ici, le classement se gagne sur le terrain.

### Scène 07 · Les compétitions (2:15 – 2:33)

**À l'écran.** Carte de titre « Et ensuite ? ». L'espace organisateur de Kossi.

1. La Coupe des Quartiers 2026 : les inscriptions ouvertes, Edem inscrit l'Avenir.
2. Le statut passe à « Inscriptions closes ».
3. Le tirage aléatoire des poules, le calendrier qui se remplit, le tableau final.
4. La page publique `/c/coupe-des-quartiers` : Calendrier, Classement, Équipes, Buteurs.

**Voix off.**

> Prochain objectif : la Coupe des Quartiers. Kossi l'organise sur Koppa Foot.
> Il ouvre les inscriptions, Edem inscrit son équipe.
> Un tirage pour les poules, le calendrier se construit, puis le tableau final.
> Et chaque compétition a sa page publique : résultats, classement, buteurs.

### Scène 08 · Pour les pros (2:33 – 2:49)

**À l'écran.** Écran partagé en deux.

- **À gauche, les terrains** : l'annuaire des terrains, la fiche du Complexe sportif de Bè, le planning du gérant qui se remplit. Mention : « Ton premier terrain est gratuit ».
- **À droite, les partenaires** : une marque fictive dans les emplacements partenaires du Direct, de la Tribune et des Actus (les bannières de la [vidéo annonceurs](../video-annonceurs/)).

**Voix off.**

> Tu as un terrain ? Référence-le : les équipes te trouvent, demandent un créneau, tu confirmes. Le premier terrain est gratuit.
> Tu as une marque ? Affiche-toi sur le Direct, la Tribune et les Actus, là où le foot de quartier se regarde.

### Scène 09 · Fin (2:49 – 2:59)

**À l'écran.** Retour au stade la nuit, tous les projecteurs allumés. Logo KoppaFoot. Trois lignes, une par une : « Ton équipe. », « Tes matchs. », « Ton palmarès. ». Puis « koppafoot.com ». Les éléments de fin de YouTube (s'abonner, vidéo suivante) se posent dans YouTube Studio sur les dernières secondes : le plan les laisse libres à droite.

**Voix off.**

> Koppa Foot. Ton équipe. Tes matchs. Ton palmarès.
> Rendez-vous sur koppa foot point com, et installe l'application sur ton téléphone.

---

## 3. Le texte de la voix off, prêt à coller

Un bloc par scène : **génère un fichier audio par bloc** (`01-intro.mp3`, `02-direct.mp3`…). Le montage se cale sur la durée de chaque fichier, et un bloc raté se refait sans toucher aux autres.

Le texte est écrit pour une voix de synthèse :

- les nombres sont en toutes lettres ;
- les adresses sont épelées comme elles se disent (« koppa foot point com ») ;
- les points de suspension et les retours à la ligne marquent les respirations.

**01 · Intro**

```
Chaque week-end, dans nos quartiers, on joue. Des buts, des arrêts, des héros.
Et le lundi… plus rien. Pas de score, pas de trace.
Koppa Foot, c'est l'application du foot amateur. Viens vivre un week-end avec l'Avenir d'Adakpamé.
```

**02 · Le Direct**

```
Tout commence sur le Direct. Les matchs du moment, les scores, les buteurs, les compétitions.
Avant le coup d'envoi, tu donnes ton pronostic.
Et si un match t'intéresse, tu le suis : chaque but arrive sur ton téléphone.
```

**03 · Ton équipe**

```
Edem est manager. Il crée l'Avenir d'Adakpamé : un nom, un écusson, et l'équipe existe.
Il lui manque un gardien. Il ouvre le recrutement, et l'annonce part dans la Tribune, sous son nom.
Au mercato, il invite des joueurs. D'autres demandent à le rejoindre.
Pour samedi, il défie l'Olympique de Tokoin, au Complexe sportif de Bè, trouvé dans l'annuaire.
Le gérant confirme le créneau. Le match est calé.
```

**04 · Jour de match**

```
Samedi. Edem compose son équipe en glissant ses joueurs à leur poste. Il voit qui est apte, qui est blessé, qui est en forme.
Komi, l'arbitre, a reçu sa désignation.
Au bord du terrain, Afi saisit tout en direct, même quand le réseau coupe : buts, passes, cartons, remplacements.
Elikem n'est pas au stade, mais il ne rate rien : le coup d'envoi, le but à la vingt-troisième minute, la mi-temps.
Coup de sifflet final : deux à zéro. L'homme du match, c'est Kafui : deux buts, et la meilleure note du match.
```

**05 · La Tribune**

```
Le soir, tout le monde se retrouve dans la Tribune. Kafui raconte sa victoire, photo à l'appui.
Les j'aime pleuvent, les commentaires aussi : Kafui est prévenu à chaque fois.
Ici tombent aussi les résultats officiels et les annonces des managers qui recrutent.
Et dans les Actus, la presse sportive du jour.
```

**06 · Ta fiche de joueur**

```
Chaque joueur a sa fiche. Kafui y déclare sa condition : apte, blessé, de retour samedi.
Ses matchs, eux, disent sa forme.
Et ses notes le placent au classement des joueurs, sur ses cinq derniers matchs. Ici, le classement se gagne sur le terrain.
```

**07 · Les compétitions**

```
Prochain objectif : la Coupe des Quartiers. Kossi l'organise sur Koppa Foot.
Il ouvre les inscriptions, Edem inscrit son équipe.
Un tirage pour les poules, le calendrier se construit, puis le tableau final.
Et chaque compétition a sa page publique : résultats, classement, buteurs.
```

**08 · Pour les pros**

```
Tu as un terrain ? Référence-le : les équipes te trouvent, demandent un créneau, tu confirmes. Le premier terrain est gratuit.
Tu as une marque ? Affiche-toi sur le Direct, la Tribune et les Actus, là où le foot de quartier se regarde.
```

**09 · Fin**

```
Koppa Foot. Ton équipe. Tes matchs. Ton palmarès.
Rendez-vous sur koppa foot point com, et installe l'application sur ton téléphone.
```

### Générer la voix

- **Une seule voix, la même pour tous les blocs**, et les mêmes réglages : sinon le timbre change d'une scène à l'autre. Une voix chaleureuse et posée, avec de l'énergie, mais sans ton de bonimenteur. Un accent d'Afrique de l'Ouest francophone colle mieux au film, si l'outil en propose une.
- **Débit** : naturel. Si l'outil a un réglage de vitesse, reste entre 0,95 et 1,05.
- **Format** : WAV ou MP3 à 44,1 kHz, sans musique ni effet, avec un court silence au début et à la fin de chaque fichier.
- **Écoute ces mots en premier**, car les voix de synthèse les ratent souvent. Si l'un d'eux sonne faux, réécris-le dans le texte comme il se prononce :

| Mot | À l'écrit dans le texte | Si la voix bute, essaie |
|---|---|---|
| KoppaFoot | « Koppa Foot » | « Kopa Fout » |
| Adakpamé | « Adakpamé » | « Adak-pamé » |
| Tokoin | « Tokoin » | à ajuster à l'oreille, selon la prononciation locale |
| Bè | « Bè » | « Bèh » |
| Kafui | « Kafui » | « Ka-fou-i » |
| Komi, Elikem, Kossi, Afi | tels quels | les couper en syllabes |
| koppafoot.com | « koppa foot point com » | — |

Quand les neuf fichiers sont prêts, dépose-les dans `docs/video-presentation/voix/` : l'animation sera calée dessus, scène par scène.

---

## 4. Pour YouTube

**Titre** : KoppaFoot, l'application du foot amateur : un week-end avec l'Avenir d'Adakpamé

**Description** (les chapitres seront recalés sur le montage final) :

```
Crée ton équipe, recrute, défie, joue, et garde la trace de chaque match.
KoppaFoot, c'est l'application du foot amateur : le Direct, les équipes, la console du match, la Tribune, les fiches des joueurs, les compétitions, les terrains.

Les personnes et les équipes de cette vidéo sont fictives.

0:00 Intro
0:16 Le Direct
0:32 Ton équipe
1:00 Jour de match
1:36 La Tribune
1:57 Ta fiche de joueur
2:15 Les compétitions
2:33 Pour les terrains et les marques
2:49 Rejoins KoppaFoot

👉 https://koppafoot.com
```

YouTube n'affiche les chapitres que s'ils sont au moins trois, si le premier est à 0:00 et si chacun dure au moins 10 secondes. Le découpage ci-dessus respecte ces trois règles.
