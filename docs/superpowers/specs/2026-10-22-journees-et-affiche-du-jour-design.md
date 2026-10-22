# Les journées de compétition, et l'affiche « Journée X » / « Matchs du jour »

Date : 2026-10-22. Demande du propriétaire du produit : qu'un organisateur de
compétition puisse générer une affiche du programme, « matchs du jour » ou
« journée X », sur une ou plusieurs dates ; et ajouter la notion de journée de
compétition, qui n'existe pas.

Maquettes validées dans la conversation du 2026-10-22 : trois rendus Satori
(une journée sur trois dimanches, deux matchs d'un jour, douze matchs d'un
samedi), produits par un script jetable, `scripts/maquettes-journee.tsx`. Il
sert de référence visuelle et de preuve que le moteur d'affiches sait tout
dessiner, pas de base de code.

## Préalable

Le pied de l'affiche s'appuie sur le logo des partenaires (`logoDe`,
lib/partenaires), ajouté le même jour sur la branche
`claude/tirage-partenaires`. Elle doit être fusionnée dans master avant que
ce chantier commence, ou ce chantier part d'elle.

## Pourquoi

Les organisateurs annoncent leurs matchs en statut WhatsApp et sur Instagram.
Aujourd'hui, KoppaFoot leur donne une affiche par match (« MATCHDAY » avant,
« SCORE FINAL » après, lib/og-flyer) et un calendrier en PDF : rien pour dire
d'un coup « voici ce qui se joue ce week-end » ou « voici la journée 3, ses
résultats et ce qui reste ». C'est l'affiche qu'un organisateur poste le plus
souvent, et chaque fois qu'il la fait sur Canva, elle ne porte pas notre
adresse.

Ce qu'on voit en ligne le 2026-10-22 dit l'étendue des cas : Miabé CAN, deux
matchs par jour pendant un mois ; G2, deux matchs le dimanche, 14 matchs de
poule sur 18 encore sans date ; Dékawowo Sportfest, douze matchs le même
samedi. L'affiche doit tenir d'un à une douzaine de matchs, et au-delà.

## Ce que le lecteur doit y lire

Décidé avec le propriétaire : **les rencontres de la journée, ou du jour,
jouées et à venir**. Une affiche de programme et de résultats à la fois : un
match joué donne son score, un match à venir son heure.

## Partie 1 — La journée

### Ce qu'est une journée

**Le tour où chaque équipe joue une fois**, même s'il s'étale sur plusieurs
dates (décidé avec le propriétaire). Sur G2 — trois poules de quatre, deux
matchs le dimanche —, la journée 1 compte six matchs et s'étale sur trois
dimanches. Ce n'est PAS une date.

- Elle concerne les matchs de **poule** et de **championnat** (`stage ===
  "group"`), sur tous les types qui en ont : `league`, `groups_knockout`,
  `league_playoffs`. Une coupe n'en a pas.
- **La numérotation est celle de la compétition**, pas de la poule : la
  journée 2, c'est le deuxième tour de toutes les poules à la fois.
- **En aller-retour, elle continue** : une poule de quatre joue les journées
  1 à 3 à l'aller, 4 à 6 au retour.
- **Pas de journée** pour un match de phase finale (il garde son tour :
  « Quarts de finale », « Demi-finales »…) ni pour une exhibition.

### Le champ

`journee: number | null` sur `FirestoreCompMatch`, `journee: number | null`
sur `CompMatch` (lib/competition-mappers). Absent ou `null` : pas de journée.
Les règles Firestore n'ont pas à changer : l'organisateur et son staff
modifient déjà tout match de leur compétition sauf `venue_booking`
(firestore.rules, `comp_matches`).

### D'où vient le numéro

1. **Les nouvelles compétitions l'ont d'elles-mêmes.** `roundRobinPairs`
   (lib/competition-firestore) calcule déjà les tours par la méthode du cercle,
   puis jette leur numéro. Il doit le rendre, et `generateGroupFixtures` le
   pose : `journee = tour + 1` à l'aller, `tour + 1 + nombre de tours de
   l'aller` au retour. Une poule impaire a un exempt par tour : la journée où
   une équipe est exemptée, elle ne joue pas, et c'est normal.

2. **Les matchs déjà générés passent par un bouton « Numéroter les
   journées »**, dans le calendrier de l'organisateur, visible tant qu'un
   match de poule n'a pas de journée. Il PROPOSE une numérotation (on la voit
   avant d'accepter) et ne remplit que les matchs qui n'en ont pas : il ne
   touche jamais une journée déjà posée, à la main ou par la génération.

   L'algorithme, poule par poule :
   - les matchs triés par date et heure, les matchs sans date à la fin ;
   - chaque match va dans la plus petite journée où aucune de ses deux équipes
     ne joue déjà (en tenant compte des journées déjà posées) ;
   - en aller-retour, la première rencontre d'une paire est l'aller, la
     seconde le retour : les allers d'abord (journées 1 à N), puis les retours
     à partir de N + 1, dans le même ordre de dates.

   Sur une poule de quatre (G2), il n'existe qu'une façon de former trois
   tours : la proposition est forcément juste. **À tester** : les 720 ordres
   possibles des six matchs d'une poule de quatre donnent tous trois journées
   correctes. Sur une poule plus grande, l'algorithme peut produire plus de
   journées qu'il n'en faut, ou un ordre qui ne correspond pas aux dates :
   l'organisateur corrige à la main (ci-dessous). Si la proposition dépasse le
   nombre attendu de journées (n − 1 pour n équipes paires, n pour n impaires,
   le double en aller-retour), le bouton le dit avant qu'on accepte.

3. **L'organisateur corrige n'importe quel match à la main** : un sélecteur
   « Journée » sur la ligne du match dans son calendrier (vide, 1, 2, … jusqu'à
   la plus grande journée de la compétition + 1).

### Où elle se voit

Décidé avec le propriétaire, et rien d'autre :

- **La fiche d'un match et ses images** : « Poule A · Journée 2 » dans
  l'en-tête de la fiche publique (`c/[slug]/matches/[mid]`, là où elle écrit
  « Poule A »), et au surtitre des images du match — flyers MATCHDAY et SCORE
  FINAL (lib/og-flyer), aperçu de lien (lib/og). *Choix du rédacteur* : par un
  champ `journee` à part dans lib/match-public, et non en l'ajoutant à
  `etape`, que la page d'une équipe, l'administration et la liste des matchs
  d'un club réutilisent — elles ne changent pas.
- **Le calendrier de l'organisateur** (`organizer/competitions/[cid]/schedule`)
  : la journée sur chaque ligne, et un filtre par journée.
- **Le calendrier en PDF** (lib/calendrier-competition, lib/pdf-calendrier) :
  la journée à côté de la poule.
- **L'affiche** (partie 2).

Hors de ces endroits — l'onglet Calendrier public de la compétition,
l'accueil Direct, les classements —, rien ne change.

## Partie 2 — L'affiche

### Ce que l'organisateur choisit

Un bouton **« Affiche »** dans son calendrier, à côté du bouton « PDF ». Il
ouvre un choix :

- **Une journée** : la liste des journées qui ont des matchs, avec les dates
  qu'elles couvrent (« Journée 2 — 18 oct., 25 oct., 1er nov. »). Titre :
  **JOURNÉE 2**.
- **Des dates** : les jours qui ont des matchs, à cocher (un ou plusieurs).
  Titre : **MATCHS DU JOUR** pour une seule date, **AU PROGRAMME** pour
  plusieurs (supposition non contestée).

Sur une date, tous les matchs de la compétition y figurent, phase finale et
exhibitions comprises ; sur une journée, seulement ses matchs de poule. Puis
un aperçu, « Télécharger » et « Partager » (le partage de fichier du
navigateur, comme les affiches de phase finale, voir
components/competition/AffichesPhaseFinale).

### Ce que l'affiche montre

Portrait 1080 × 1350 (statut WhatsApp, publication Instagram), dans la
direction des flyers de match (lib/og-flyer, lib/og-da) : le cadre d'éclats,
la carte nuit, le titre fendu en Anton, l'adresse en pied.

- **En tête**, le logo de la compétition si elle en a un, sinon celui de
  KoppaFoot (comme le flyer, `Cadre`).
- **Le surtitre** : le nom de la compétition et l'étape (« G2 ÉDITION 2026 ·
  PHASE DE POULES ») ; pour une seule date, la date en toutes lettres, et le
  terrain si tous les matchs s'y jouent.
- **Le titre** : JOURNÉE 2, MATCHS DU JOUR ou AU PROGRAMME.
- **Les matchs**, par date puis par heure. Plusieurs dates : un intertitre par
  date (« DIMANCHE 25 OCTOBRE »). Sur chaque match :
  - **joué** : le score en blanc, « FINAL » en gris ; tirs au but en petit sous
    le score ; un forfait dit « FORFAIT » au lieu de « FINAL » ;
  - **en cours** au moment où l'affiche est faite : le score du moment, « EN
    COURS » ;
  - **à venir** : l'heure en vert, « VS » ; sans heure, « VS » seul ;
  - la poule (ou le tour de phase finale) sous l'heure, tant qu'il reste la
    place ;
  - un match **annulé** n'y figure pas.
- **Trois matchs ou moins** : chacun en face-à-face, grands écussons et noms
  dessous, comme le flyer MATCHDAY (maquette B). **Quatre et plus** : une
  ligne par match, de plus en plus serrées (maquettes A et C).
- **Douze au plus par affiche.** Au-delà, deux affiches (ou plus), numérotées
  « 1/2 », « 2/2 », coupées entre deux dates quand c'est possible.
- Les noms trop longs se raccourcissent d'une ellipse : Satori ne mesure pas
  le texte (voir `raccourcir` dans lib/og-phase-finale).
- **Au pied, le partenaire de la compétition**, s'il en a un avec un logo :
  « PRÉSENTÉ PAR » et son logo, à côté de l'adresse (décidé avec le
  propriétaire). Sans partenaire à elle, ou sans logo, le pied ne montre que
  l'adresse : jamais de cadre vide. *Choix du rédacteur* : les partenariats
  dont `competition_id` est cette compétition, de formule `partenaire` (pas
  les annonces), à l'affiche le jour où l'image est faite (`aLAffiche`), quels
  que soient leurs emplacements, et seulement s'ils ont un logo (`logoDe`,
  lib/partenaires) ; deux au plus, le plus récent d'abord. Une affiche ne
  compte pas de vue : une image partagée ne dit pas qui l'a regardée.

### La route

Publique, comme les autres affiches d'une compétition (`api/c/[slug]/affiche/
tableau`, `…/champion`) : `GET /api/c/[slug]/affiche/programme?journee=2` ou
`?dates=2026-10-25,2026-11-01`, plus `&page=2` quand l'affiche est coupée.
404 pour une compétition en brouillon, une journée ou des dates sans match.
Une minute de cache, comme les affiches de phase finale : les scores changent.
Les logos sont téléchargés et réduits par le serveur (`imageDistante`), Satori
ne lisant pas le WebP.

## Non-objectifs

- Pas de version verticale (1080 × 1920) pour l'instant.
- Pas de partenaire général de KoppaFoot sur l'affiche : seulement celui de
  la compétition (ci-dessus).
- Pas de journée dans l'onglet Calendrier public, sur l'accueil Direct ni dans
  les classements.
- Pas de vidéo : c'est le point 4 (les matchs « chauds »), qui viendra après.
- Pas de journée pour les amicaux.

## Anti-objectifs

- **Une journée fausse affichée au public.** La numérotation proposée pour un
  match déjà généré ne s'écrit qu'après que l'organisateur l'a vue et
  acceptée.
- **Écraser une journée posée** par l'organisateur.
- **Une affiche qui déborde** : un nom qui passe sous l'écusson voisin, une
  ligne qui mord sur l'adresse. Chaque cas (1, 2, 3, 4, 6, 12, 13 matchs ;
  noms de 40 caractères ; plusieurs dates) se regarde rendu avant de livrer,
  par un script de rendu comme scripts/rendu-joueur-semaine.tsx.

## Choix du rédacteur

Tranchés sans le propriétaire, parce qu'un constructeur sensé l'aurait fait
sans changer ce qui se construit. À relire :

- Le champ s'appelle `journee`, en français, comme les champs récents.
- La journée n'est jamais affichée au public avant que l'organisateur ait
  accepté la numérotation proposée.
- La route de l'affiche est publique, comme celles du tableau et du champion ;
  seul le calendrier de l'organisateur y mène pour l'instant.
- L'affiche est en français seulement, comme les flyers de match.
- Un match « à venir » dont la date est passée (un report jamais corrigé)
  s'affiche comme à venir : il n'existe pas de statut « reporté ».
- Le score d'un match en cours est celui que porte le document du match à
  l'instant de l'affiche ; le constructeur vérifie qu'il se met bien à jour
  pendant le direct, sinon il le lit dans `live_state`.

## Ce qui reste au constructeur

- Les tailles exactes (lignes, écussons, polices) selon le nombre de matchs.
- La forme du choix « une journée / des dates » dans le calendrier.
- La façon dont l'organisateur voit la proposition de « Numéroter les
  journées » avant de l'accepter.
- Une colonne « journée » facultative dans l'import de calendrier
  (`importMatches`), si elle ne coûte presque rien.
