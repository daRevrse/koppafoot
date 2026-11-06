# Conception : gérer son équipe dans l'application

**Date :** 2026-11-06
**Statut :** lancé par l'utilisateur sans tour de questions (« on peut y aller, l'application mobile doit être
complète d'abord »). Le découpage et l'ordre des lots sont mes choix, à corriger s'ils ne conviennent pas.

## Pourquoi

Un manager ne peut rien faire pour son équipe depuis l'application : l'onglet Évolution lui montre la fiche de son
club, en lecture seule, et tout geste renvoie au site. L'utilisateur veut une application complète avant de la
publier : ce que le site permet à un manager, l'application doit le permettre.

En production (2026-11-06) : 11 comptes manager, 9 clubs, un seul avec un vrai effectif (7 joueurs). Dans G2, aucune
des 12 équipes n'est rattachée à son manager, l'organisateur saisit tout. Les outils existent sur le site, ils
servent peu. L'application est l'endroit où un manager amateur a une chance de s'en servir : son téléphone.

## Ce que le site permet à un manager

| Domaine | Sur le site | Dans l'application aujourd'hui |
|---|---|---|
| Créer son club | `/teams` (route `POST /api/teams`, plafonnée par l'offre) | renvoi au site |
| Effectif du club | `/teams/[id]`, onglet Effectif : titulaires, dossards, retirer un membre, joueurs sans compte (ajout, modification, stats, état de forme, photo), consentements à l'image, fusion d'un joueur sans compte | lecture seule |
| Candidatures | onglet Candidatures : accepter, refuser | rien |
| Invitations | mercato : chercher un joueur, l'inviter, annuler | rien (le joueur, lui, répond déjà depuis son Compte) |
| Réglages du club | onglet Réglages : infos, couleur, catégorie, statut de recrutement et annonce, staff délégué, planning d'entraînement, suppression ; logo, bannière, galerie, palmarès | rien |
| Compositions types | onglet Compositions : une formation par format (5, 7, 11…) | rien |
| Entraînements | onglet Entraînements : créer, convoquer l'effectif, réponses | rien |
| Matchs amicaux | `/matches` : programmer, défier, répondre à un défi, reprogrammer, annuler, supprimer, renseigner un match joué ; `/matches/[id]` : convocations, composition ; `/matches/[id]/manage` : console | fiche native en lecture ; console sur le site |
| Compétitions | `/mon-equipe` : inscription, reprise d'une équipe par invitation ; `/mon-equipe/[cid]/[tid]` : effectif en compétition, import depuis le club, compte lié, photos, consentements | rien |
| Recrutement | `/mercato` : recherche, sélection, annonce | rien |
| Terrains | `/mes-reservations` : réserver un créneau, suivre ses demandes | rien côté manager |

## Les lots, dans l'ordre

Chaque lot est une PR qui marche seule, vérifiée, que l'utilisateur fusionne.

1. **L'effectif du club.** L'onglet Évolution d'un manager devient « Mon club » : effectif (titulaires, dossards,
   retirer un membre, joueurs sans compte), candidatures, invitations (chercher un joueur, l'inviter, annuler), et
   la création du club quand il n'en a pas. Détaillé plus bas.
2. **Les matchs amicaux.** Programmer, défier, répondre à un défi, reprogrammer, annuler, supprimer, renseigner un
   match joué ; convoquer l'effectif et voir les réponses ; la composition du match. La console reste sur le site.
3. **Les entraînements.** Créer, convoquer, suivre les réponses ; le planning.
4. **Les compétitions.** Inscrire son équipe, reprendre une équipe par invitation, gérer l'effectif engagé, l'import
   depuis le club et le compte lié.
5. **Les réglages du club.** Infos, couleur, catégorie, recrutement et annonce, staff délégué, suppression ; état de
   forme et consentements à l'image ; stats d'un joueur sans compte ; compositions types ; palmarès.
6. **Recrutement et terrains.** La sélection du mercato ; réserver un terrain et suivre ses demandes.
7. **Les photos.** Logo, bannière, galerie, photo d'un joueur. Seul lot qui demande un module natif
   (`expo-image-picker`), donc un build : regroupé à la fin, quand l'utilisateur voudra un build.

Le côté joueur (mes convocations, candidater à un club, quitter un club) a les mêmes manques ; il viendra après, ou
dans le lot du domaine concerné quand il en est l'autre moitié (les convocations du lot 2, par exemple).

## Principes communs à tous les lots

- **Les mêmes règles, les mêmes routes.** L'application écrit dans Firestore avec les règles du site, et passe par
  les routes du site là où il y passe (création d'équipe, notifications, recherche de membres). Aucune règle ni
  route nouvelle sans nécessité ; si un lot en demande une, la conception du lot le dit.
- **La délégation comme le site.** Tout écran de gestion s'ouvre selon `peutGererEquipe` (`lib/team-access`) : le
  staff délégué a les droits du manager ; seul le propriétaire nomme le staff et supprime l'équipe.
- **Le code partagé reste partagé.** Ce qui ne dépend d'aucun SDK sort de `lib/firestore.ts` dans un module commun
  (mappeurs, règles de calcul) ; le site le réexporte, rien ne change pour ses appelants.
- **Natif, pas de page web enchâssée.** Un geste du manager est un écran de l'application. Ce qui n'a pas encore son
  écran garde son renvoi au site, signalé comme tel.
- **Pas d'essai en production.** Chaque geste est essayé contre les émulateurs Firebase (base et comptes locaux, les
  vraies règles appliquées), comme les vidéos tutoriels du site (`docs/tutoriel-*/outils/emulateurs`). Le
  branchement sur les émulateurs est un correctif temporaire, jamais commité.

## Lot 1 : l'effectif du club

**Pour qui :** un compte qui gère au moins un club (`getTeamsIManage` du site : propriétaire ou staff délégué).

**Où :** l'onglet Évolution. Pour un manager, il montre aujourd'hui `MonClub` (la fiche publique). Il devient
l'écran de gestion de son club ; la fiche publique reste à un toucher (« Voir la fiche du club »).

**L'écran :**
- En tête, le club (logo, nom, ville). S'il en gère plusieurs, une rangée de pastilles pour passer de l'un à l'autre.
- Trois onglets : **Effectif**, **Candidatures** (avec le nombre en attente), **Invitations**.
- Effectif : les membres et les joueurs sans compte, par poste. Pour chacun : le dossard (modifiable), titulaire ou
  non (modifiable), et ses gestes : retirer du club (un membre), modifier ou supprimer (un joueur sans compte). Les
  changements de dossards et de titulaires s'accumulent et s'enregistrent d'un seul bouton, qui n'apparaît que
  s'il y a quelque chose à enregistrer. En bas, « Ajouter un joueur sans compte » (prénom, nom, poste, dossard).
- Candidatures : les demandes en attente (photo, nom, poste, ville, niveau, message), Accepter ou Refuser ; les
  réponses passées plus bas, repliées.
- Invitations : celles en attente, chacune annulable ; « Inviter un joueur » ouvre une recherche (nom, ville) sur la
  route du site, puis l'invitation avec son message.
- Sans club : « Créer mon équipe » (nom, ville, niveau, catégorie, couleur, description) par `POST /api/teams`. Le
  plafond de l'offre gratuite répond comme sur le site ; l'écran affiche son message.

**Les gestes, exactement comme le site** (`lib/firestore.ts`) :
- dossards → `squad_numbers` ; titulaires → `lineup_ids` ;
- retirer un membre → `member_ids` sans lui, et s'il était du staff, le staff sans lui (sinon il garderait les
  droits du manager sur l'équipe qui vient de l'écarter), puis la notification d'équipe (`member_left`) ;
- joueur sans compte → `teams/{id}/ghost_players` (création, modification, suppression), sans photo ;
- candidature → statut, et si acceptée, le joueur dans `member_ids` (un seul lot d'écritures), la notification
  d'équipe (`member_joined`) et celle du candidat (« Candidature acceptée » ou « refusée ») ;
- invitation → le document `invitations` et la notification du joueur ; annuler → suppression.

**Décisions de ma part :**
- **Pas d'invitation en double.** Quand le manager accepte une candidature, le site ajoute le joueur ET lui envoie une
  invitation « Rejoins-nous » pour la même équipe : le joueur, déjà membre, reçoit une carte d'invitation inutile.
  L'application ne la reproduit pas ; c'est signalé à l'utilisateur, qui décidera s'il faut aussi la retirer du site.
- **Un seul bouton Enregistrer** pour dossards et titulaires, là où le site en a deux.
- Hors de ce lot : état de forme, stats et photo d'un joueur sans compte, consentements, fusion, staff, réglages,
  compositions types (lots 5 et 7).

**Fait quand :** un manager (ou un délégué) fait tous ces gestes depuis l'application, contre les émulateurs, et
retrouve le résultat sur le site ; les tests couvrent les écritures et les règles qui les autorisent ; un compte qui
ne gère pas le club n'a aucun bouton et les règles le refusent.
