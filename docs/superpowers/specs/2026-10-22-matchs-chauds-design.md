# Les matchs « chauds » : mis en avant sur le Direct, et leur vidéo d'annonce

Date : 2026-10-22. Demande du propriétaire du produit (point 4 de sa liste du
jour) : qu'un organisateur puisse mettre en tête d'affiche certains matchs,
« chauds », à partir d'une liste proposée d'après la forme des équipes sur
leurs derniers matchs de la compétition (cinq au plus), et générer une vidéo
animée d'annonce de la rencontre.

## Préalable

Ce chantier part de la branche `claude/tirage-partenaires` (PR #151), ou de
master une fois qu'elle y est fusionnée : le surtitre du flyer MATCHDAY y
porte la journée (« Groupe A · Journée 2 »), que la vidéo reprend.

## Pourquoi

L'accueil Direct met en avant cinq matchs au plus, choisis par la machine :
les matchs en direct, puis les prochains, compétition par compétition. Un
organisateur ne peut pas y dire « c'est CE match-là qu'il ne faut pas
rater ». Le choc d'une journée — deux équipes en forme qui se rencontrent —
se perd entre deux matchs sans enjeu. Et pour l'annoncer sur les réseaux,
l'organisateur n'a qu'une image fixe ; la vidéo du joueur de la semaine a
montré qu'une affiche qui se construit à l'écran porte plus loin.

## Ce qui est décidé avec le propriétaire

### Marquer un match chaud

- L'organisateur et ses modérateurs marquent un match **à venir** comme
  chaud depuis leur calendrier (`organizer/competitions/[cid]/schedule`).
- Un encart **« Suggestions »** leur propose les **3** matchs à venir où les
  deux équipes arrivent le plus en forme. L'organisateur garde le dernier
  mot : la suggestion ne marque rien d'elle-même.
- **Le calcul de la forme** : pour chaque équipe, ses points sur ses 5
  derniers matchs joués de la compétition avant ce match (3 par victoire, 1
  par nul), lus comme sur la fiche d'un match (`derniersResultats`,
  lib/forme). Les rencontres sont classées par **la plus faible des deux
  formes** : un choc oppose deux équipes en forme, pas une équipe en feu à la
  lanterne rouge. À égalité, le match le plus proche dans le temps d'abord.
- **Deux matchs chauds à venir au plus par compétition, en même temps.**
  Sans limite, un seul tournoi occuperait les cinq places de l'accueil.

### Sur l'accueil Direct

- Un match chaud passe **en tête des matchs mis en avant**, devant les
  matchs en direct des autres compétitions, dès qu'il est marqué et jusqu'au
  coup de sifflet final. Joué (ou annulé), il reprend sa place normale.
- Entre plusieurs matchs chauds, le plus proche dans le temps d'abord.
- **Une icône flamme** sur sa carte, et rien d'autre : pas de mot « CHOC ».

### La vidéo d'annonce

- **Le flyer MATCHDAY qui se construit à l'écran** : le titre fendu, les
  deux écussons qui entrent chacun de son côté, puis la date, l'heure et le
  terrain. **Le titre reste « MATCHDAY ».** **Pas de forme des équipes.**
- **Vertical, 1080 × 1920**, 8 à 10 secondes, MP4 : statuts WhatsApp,
  TikTok, Shorts.
- **Sans musique** : il faudrait des droits.
- **Proposée seulement pour les matchs chauds.**
- **Fabriquée dans le navigateur de l'organisateur**, comme la vidéo du
  joueur de la semaine (lib/video-joueur-semaine-client) : Chrome ou Edge
  sur ordinateur. Ailleurs, le bouton dit pourquoi il ne peut pas.

## Ce que le constructeur doit savoir

### Le champ

`chaud?: boolean` sur `FirestoreCompMatch`, `chaud: boolean` sur
`CompMatch` (lu `d.chaud === true`). Le drapeau reste sur un match joué : ce
qui compte pour l'accueil, c'est un match chaud **à venir ou en direct**.

### Les règles Firestore

Aujourd'hui, le détenteur d'un code d'accès de scoreur peut modifier tout
champ du match qu'il couvre, sauf `venue_booking`. Marquer un match chaud
revient à l'organisateur et à ses modérateurs : `chaud` rejoint
`venue_booking` dans les champs interdits à la seule voie du code d'accès
(`comp_matches`, firestore.rules). Les règles se déploient avec
`--project koppafoot`, après comparaison des règles en prod avec le fichier.

### La limite de deux

Tenue à deux endroits, parce que les règles ne savent pas compter : le
calendrier n'offre pas la flamme d'un troisième match à venir tant que deux
sont chauds (il dit pourquoi), et **l'accueil n'en retient que deux par
compétition**, les plus proches dans le temps — même si les données en
portaient plus, l'accueil ne se laisse pas envahir.

### L'accueil

Le choix des matchs mis en avant vit aujourd'hui dans
components/direct/DirectHomeV2 (`spotlightEntries`). La règle des matchs
chauds y entre en tête, avant la sélection actuelle, qui ne change pas pour
le reste. Elle passe dans une fonction pure (lib/direct-shared, à côté de
`kickoff` et `ordreDesCompetitions`) pour être testée. Les amicaux ne sont
jamais chauds.

### La vidéo

- La chaîne existe : des calques rendus par Satori sur le serveur, animés et
  encodés dans le navigateur (lib/og-joueur-semaine `calquesJoueurSemaine`,
  lib/video-joueur-semaine, lib/video-joueur-semaine-client). L'encodeur
  connaît aujourd'hui l'animation du joueur de la semaine en dur : il la
  reçoit désormais en paramètre (l'animation, la durée), pour servir aux
  deux vidéos.
- Le flyer MATCHDAY (lib/og-flyer) n'existe qu'en 1080 × 1350 : il lui faut
  une version verticale 1080 × 1920, découpable en calques, dans la même
  direction (cadre d'éclats, carte nuit, Anton fendu). Rien d'important dans
  les 150 px du haut ni les 440 px du bas : TikTok les recouvre (voir le
  rendu `zones-tiktok` de scripts/rendu-joueur-semaine.tsx).
- Les calques viennent d'une route réservée au staff de la compétition
  (`peutConfigurer`, comme le calendrier PDF), seulement pour un match chaud
  à venir.
- Un script de rendu des calques et de leur recomposition, comme
  scripts/rendu-joueur-semaine.tsx, avec des équipes fictives (le dépôt est
  public).

## Non-objectifs

- Pas de match chaud pour les amicaux, ni dans l'application mobile (elle
  n'a pas de matchs mis en avant).
- Pas de suggestion automatique qui marquerait sans l'organisateur.
- Pas de vidéo pour un match qui n'est pas chaud, ni de version paysage.
- Pas de forme des équipes sur la vidéo.
- Pas de notification push « match chaud ».

## Anti-objectifs

- **Un accueil envahi** par une seule compétition.
- **Un match passé resté en tête** de l'accueil.
- **Une vidéo qui déborde** dans les zones que TikTok recouvre, ou un nom
  d'équipe qui sort de sa place.

## Choix du rédacteur

À relire :

- La forme se compte **en moyenne de points par match joué** (sur les 5
  derniers au plus), pas en somme : une équipe qui n'a joué que trois matchs
  n'est pas pénalisée face à une équipe qui en a joué cinq.
- Un match n'est **suggéré que si ses deux équipes ont déjà joué au moins
  deux matchs** de la compétition : sans cela, la forme ne dit rien, et la
  première journée ne proposerait que les trois prochains matchs.
- Un match à venir **sans date** peut être suggéré et marqué, après ceux qui
  en ont une.
- La flamme d'un match chaud est **orange** (lucide `Flame`), la seule
  couleur chaude de l'accueil, et ne paraît **que sur sa carte mise en
  avant** : pas sur sa ligne du tableau des scores, ni sur sa fiche.
- La vidéo dure **8 secondes**.

## Ce qui reste au constructeur

- L'animation exacte de chaque calque et leur ordre.
- La place de l'encart « Suggestions » et de la flamme dans le calendrier.
- La place de la flamme sur la carte de l'accueil.

## Révision du 2026-11-09 : plus visibles, et des notifications d'avant match

Demande du propriétaire : la flamme seule ne mettait pas assez en avant un
match chaud sur le Direct, et il veut des notifications d'avant match. Deux
non-objectifs ci-dessus tombent donc : « une icône flamme, et rien
d'autre » et « pas de notification push match chaud ».

### Sur l'accueil Direct

- **La carte mise en avant** d'un match chaud porte un **bandeau orange** en
  tête : « À NE PAS MANQUER », le **temps qui reste** avant le coup d'envoi
  (« Coup d'envoi dans 2 h 15 », « Demain », « J-3 », « En direct
  maintenant » — `avantLeCoupDEnvoi`, lib/chauds) et un bouton **« Me
  prévenir »**, qui suit le match (lib/suivi-match). La carte prend un liseré
  orange.
- **Les matchs chauds ouvrent le carrousel**, avant le joueur de la semaine,
  et y restent **12 secondes** au lieu de 7. Leurs points de pagination sont
  orange.
- **Dans le tableau des scores**, la ligne d'un match chaud porte un filet
  orange à gauche, un fond orangé et une flamme sous l'heure.
- Tout cela s'éteint au coup de sifflet final, comme avant.

### Les notifications d'avant match (lib/chauds-serveur)

- **Destinataires** : les abonnés du match (`match_follows`) et ceux de sa
  compétition — les listes et le plafond (500) des buts en direct, dans la
  catégorie push « competitions ». Jamais une compétition d'entraînement.
- **L'annonce**, quand l'organisateur allume la flamme depuis son
  calendrier (`POST /api/competitions/[cid]/matches/[mid]/chaud`, réservée à
  `peutConfigurer`). **Une fois par match** (`chaud_annonce_le`) : éteindre
  et rallumer ne sonne pas deux fois.
- **Le rappel du matin**, le jour du match, par la tâche de 6 h
  (`/api/cron/scoreur-manquant`). **Une fois par date** (`chaud_rappel_pour`)
  : un match reporté se rappelle à sa nouvelle date. Pas de rappel pour un
  match annoncé le jour même.
- Les deux marqueurs se posent dans une transaction **avant** l'envoi, et
  les règles Firestore les réservent au serveur.
- **Pas de rappel « une heure avant »** : les tâches planifiées de Vercel
  tournent une fois par jour sur l'offre actuelle. Qui a touché « Me
  prévenir » reçoit de toute façon le coup d'envoi en direct.
