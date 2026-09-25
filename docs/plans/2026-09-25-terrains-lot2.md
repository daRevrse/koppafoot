# Terrains, lot 2 : l'annuaire, le planning, les compétitions

**Où on en est.** Le lot 1 est sur `claude/friendly-gates-qq4sv7` (commits
`a7b9ff7`, `c01a0d8`, `2c07e68`) : contact de l'équipe, contre-proposition,
blocage de créneaux, horaires d'ouverture, email à chaque demande, et les
amicaux et défis qui demandent leur créneau au propriétaire. Tout passe par
`/api/bookings`, `/api/bookings/[id]` et `/api/matches/[mid]/terrain`, sur le
calcul pur de `lib/reservations.ts`.

Ce lot traite ce qui reste, dans cet ordre : ce que voit celui qui CHERCHE un
terrain, puis ce que voit celui qui le GÈRE, puis les compétitions.

---

## 1. L'annuaire public (`/terrains/annuaire`)

### Constats

- **Sur téléphone, un terrain par écran.** Chaque carte porte une photo 4:3
  pleine largeur (~290 px) et 200 px de texte. Pour comparer trois terrains,
  on fait défiler trois écrans.
- **La liste ne dit pas QUAND.** Ni les horaires, ni si le terrain est déjà
  pris le soir où l'on veut jouer. On l'apprend fiche par fiche, en ouvrant
  chacune — alors que la question de celui qui arrive est précisément
  « où jouer samedi à 18 h ».
- **Rien ne suit du choix à la demande.** On choisit un terrain dans la
  liste, puis on ressaisit la date et l'heure sur sa fiche.

### Changements

1. **« Quand jouer ? »** : un jour, une heure, une durée, facultatifs. Une
   fois posés, la liste ne garde que les terrains **ouverts** à ce moment
   (horaires) et **libres** (aucun créneau confirmé ou bloqué qui chevauche).
   Les occupations viennent du serveur, dans la même lecture que la liste :
   date, heure et durée seulement, jamais de nom ni de motif — ce que la fiche
   publie déjà.
2. **La carte dit quand** : les horaires du jour choisi (ou d'aujourd'hui), et
   « Libre samedi 18:00 → 19:30 » quand un créneau est posé.
3. **Le créneau suit jusqu'à la fiche** : le lien porte `?date=&heure=&duree=`,
   et le formulaire de demande s'ouvre prérempli.
4. **Une liste compacte sur téléphone** : vignette carrée à gauche, faits à
   droite, trois ou quatre terrains par écran. La grille reste au-delà de
   640 px.
5. **Trier** : les ouverts d'abord (actuel), ou le prix croissant.

### Fichiers

- `src/lib/terrains.ts` : `libreA(horaires, occupations, creneau)`, pur.
- `src/app/(marketing)/terrains/annuaire/page.tsx` : lit aussi les créneaux
  confirmés à venir, par terrain.
- `src/components/venue/AnnuaireTerrains.tsx` : filtre « Quand jouer ? »,
  tri, carte compacte, horaires.
- `src/components/venue/BookingRequest.tsx` : valeurs initiales depuis l'URL.

### Vérification

Tests purs de `libreA` ; captures de l'annuaire à 390 px et à 1280 px, avec
et sans créneau choisi, sur l'émulateur.

---

## 2. Le planning du propriétaire

### Constats

La page « Réservations reçues » est une liste triée par date. Elle ne montre
pas une JOURNÉE : un propriétaire qui reçoit un appel ne voit pas d'un coup
d'œil ses soirs libres, ni où caser l'équipe au téléphone.

### Changements

1. **Une bascule Liste / Semaine** sur « Réservations reçues ».
2. **La semaine** : 7 colonnes sur ordinateur, les heures d'ouverture en
   lignes (08:00 → 23:00 sans horaires). Confirmé en vert, bloqué en gris,
   en attente en ambre. Semaine précédente / suivante. Un sélecteur de
   terrain quand il y en a plusieurs.
3. **Sur téléphone, un jour à la fois** : 7 colonnes ne tiennent pas en 390 px.
   Une rangée de jours (L M M J V S D) et la journée en frise verticale.
4. **Toucher un créneau libre ouvre « Bloquer un créneau » prérempli** — le
   geste de l'appel téléphonique.
5. **Toucher une réservation l'ouvre** avec ses actions (confirmer, refuser,
   appeler), les mêmes que dans la liste.

### Fichiers

- `src/lib/terrains.ts` : placement des blocs (minutes depuis l'ouverture,
  colonnes quand deux créneaux se chevauchent), pur.
- `src/components/venue/PlanningSemaine.tsx` : nouveau.
- `src/app/(app)/mes-terrains/reservations/page.tsx` : la bascule.

### Vérification

Tests purs du placement ; captures semaine et jour sur l'émulateur.

---

## 3. Les matchs de compétition sur un terrain référencé

### Constats

L'organisateur saisit le lieu en texte libre (ajout d'un match, planification,
import). Un match de compétition joué sur un terrain référencé n'est jamais
demandé à son propriétaire, qui peut l'avoir promis à quelqu'un d'autre.

### Changements

1. **Choisir un terrain référencé** dans le calendrier de l'organisateur
   (ajout, planification, report), la saisie libre restant possible.
2. **`venue_id` et `venue_booking` sur `comp_matches`**, comme sur un amical.
3. **La même synchronisation** : `synchroniserTerrain` apprend à lire un match
   de compétition ; une route `POST /api/competitions/[cid]/terrain` prend une
   LISTE de matchs. Le demandeur est l'organisateur ; le libellé,
   « Nom de la compétition · A vs B ».
4. **Un import, un email** : après un import ou une planification en masse,
   le propriétaire reçoit une notification par match mais UN seul email qui
   les récapitule. Vingt emails pour une journée de championnat, c'est une
   boîte qu'on ne lit plus.
5. **La réponse du terrain sur le calendrier de l'organisateur** : en
   attente, confirmé, refusé — et « prendre l'horaire proposé », qui ouvre le
   report prérempli.
6. **Règles** : `venue_booking` rejoint les champs que seul le serveur écrit
   sur `comp_matches`, comme sur `matches`.

### Fichiers

- `src/types/index.ts`, `src/lib/competition-mappers.ts`,
  `src/lib/competition-firestore.ts` (création, planification, report).
- `src/lib/reservations.ts` : « scheduled » rejoint les états à réserver.
- `src/lib/reservations-server.ts` : lecture d'un match de compétition,
  récapitulatif par email.
- `src/app/api/competitions/[cid]/terrain/route.ts` : nouvelle.
- `src/app/(organizer)/organizer/competitions/[cid]/schedule/page.tsx`.
- `firestore.rules`.

### Vérification

Tests purs étendus ; scénario de bout en bout sur l'émulateur (import de trois
matchs sur un terrain → trois demandes, un email ; refus → calendrier ;
report sur la proposition → confirmé).

---

## Hors de ce lot

- **Une carte** : les terrains n'ont pas de coordonnées, seulement une adresse
  en texte.
- **Le paiement** : la plateforme n'encaisse rien, c'est la promesse de la
  vitrine.

## Livraison

Un commit par chantier au moins, sur la même branche ; `tsc`, lint (compte
inchangé), build, et les vérifications de chaque section avant de pousser.
