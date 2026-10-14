# Console live : un vrai match de foot

Date : 2026-10-14. Décisions prises avec le propriétaire du produit, question
par question, à partir d'un audit de `LiveMatchConsole`.

## Le problème

La console ne connaît qu'un état — le chrono tourne ou non — et lui fait porter
trois choses que le terrain sépare : la montre de l'arbitre (qui ne s'arrête
presque jamais), le ballon en jeu ou mort (qui s'arrête cent fois), et ce qui
peut encore se produire. Faute d'état « ballon mort », elle devine par des
minuteurs (15 s, 60 s, arrêt automatique à 45+N). Conséquences relevées :
possession créditée au marqueur pendant la célébration, verrous qui se lèvent
ballon mort, minutes décalées par « Arrêter », mi-temps sifflée par erreur à la
12e sans retour, minutes du temps additionnel notées 46', etc.

## Décisions

1. **Le chrono suit la montre de l'arbitre.** Il tourne du coup d'envoi au
   sifflet de chaque période, ballon mort compris. Il est à l'arrêt avant le
   coup d'envoi, à la pause, pendant une interruption, après la fin. Plus de
   bouton Arrêter/Lancer, plus d'arrêt automatique.
2. **Ballon mort seulement sur les longs arrêts** : but (jusqu'à l'engagement),
   penalty accordé (jusqu'à son issue), arrêt de jeu déclaré par le scoreur,
   mi-temps. Les arrêts courts (touche, corner, faute, six mètres) ne coupent
   rien : la saisie donne le ballon au bon camp.
3. **La reprise se fait en touchant la pelouse du camp qui repart**, ou par le
   bouton central contextuel (« Engagement · <équipe> », « Reprise »).
4. **Faute et hors-jeu valent coup franc pour l'adversaire**, par calcul :
   coups francs de Y = coups francs saisis pour Y + fautes de X + hors-jeu de
   X. Vérification en base avant activation (doublons faute + coup franc).
5. **Les côtés suivent le regard du scoreur** : inversion possible au coup
   d'envoi, inversion automatique à la mi-temps. Réglage local à l'appareil.
6. **Le public voit comme à la télé** : minutes 45+2' / 90+3' partout (calcul,
   anciens matchs compris), « +3 » annoncé, « MT » à la pause, libellé
   d'avant-match au lieu de « 1' ». Le ballon mort ne s'affiche pas, sauf
   « Match interrompu ».
7. **Prolongations** : réglage par compétition, non par défaut ; durée par
   défaut = un tiers d'une mi-temps (15 en 2×45, 7 en 2×20).
8. **Tirs au but tir par tir** : qui commence, puis issue et tireur
   (facultatif) de chaque tir ; alternance, fin et mort subite automatiques ;
   5 tirs ; « Annuler le dernier tir » ; suivi public ; repli « saisir le score
   final ».
9. **Changements par format** : 5 et sortie définitive de 9 à 11 joueurs,
   illimités et volants à 8 ou moins ; réglables par l'organisateur (part de la
   case « changements illimités » déjà livrée).
10. **Penalty** : « Faute de qui ? » (facultatif) puis « Carton : aucun / 🟨 /
    🟥 », puis l'issue. La faute est marquée « penalty » et exclue du calcul des
    coups francs.
11. **Minimum de joueurs** : geste « Sortie sans remplaçant » ; minimum
    round(n × 7 / 11) réglable ; sous le minimum, interruption automatique,
    puis « Reprendre » ou « Arrêt définitif · forfait de X » (organisateur et
    administration en compétition ; 3–0 ou score du moment s'il est plus
    favorable à l'adversaire).

## L'état du jeu

Stocké dans `live_state.jeu`, à côté de la possession. Module pur
`lib/etat-du-jeu.ts` : transitions, ce qui est permis, et à qui va le ballon
après une saisie.

| Situation | Ce qui reste permis | Reprise |
|---|---|---|
| Avant le coup d'envoi | changements, cartons | toucher l'équipe qui engage : chrono lancé, ballon à elle, notif « C'est parti » |
| En jeu | tout | — |
| Mort · but | cartons, changements, VAR, annulation | « Engagement · <encaisseur> » ou une pelouse |
| Mort · penalty | cartons, changements, issue | l'issue : marqué → engagement adverse ; raté/arrêté → en jeu, ballon à la défense ; une pelouse relance aussi, le penalty reste « Issue ? » |
| Mort · arrêt de jeu | cartons, changements | « Reprise » (camp retenu) ou une pelouse |
| Mi-temps | changements, cartons | « Engagement · <l'autre équipe> » : période suivante, chrono relancé, côtés inversés |
| Match interrompu | cartons, changements | « Reprendre le match » (seul arrêt du chrono) |

- Plus de minuteurs : on ne marque pas deux fois sans engagement entre deux.
- La possession ne compte que **ballon en jeu** (au lieu de « chrono qui
  tourne ») ; `lib/possession` ne change pas.
- Retirer le but qui a mis le ballon mort → « arrêt de jeu » : le scoreur
  relance, la console ne devine pas.
- Ballon après une saisie (en jeu) : corner/touche/coup franc pour X → X ;
  faute ou hors-jeu de X → Y ; tir de X (cadré ou non) → Y ; arrêt du gardien
  de Y → Y.
- Un match sans `jeu` (en cours au déploiement) est déduit : en jeu si le
  chrono tourne, mi-temps en période 2.

## Écran du scoreur

Bandeau central selon l'état : Arrêt de jeu (en jeu) · Engagement · <équipe> ·
Reprise · Penalty · Issue ? · Reprendre le match. Le temps additionnel −/+ et
Mi-temps / Fin du match restent. Les verrous disent leur raison (« But ·
engagement », « Penalty », « Arrêt de jeu », « Mi-temps », « Avant-match »).
Mi-temps : confirmation seulement avant le temps réglementaire, « Annuler »
quelques secondes après. Temps additionnel écoulé : le bouton de fin de période
passe en orange et pulse. Menu ⋯ : Recaler le chrono (±10 s / ±1 min, borné au
début de la période), Interrompre le match, Inverser les côtés. Le tableau
d'affichage suit les côtés.

## Chrono et notation

Une transition = une écriture (chrono, période et état ensemble). La possession
suit dans sa propre écriture : elle se suspend et reprend d'elle-même quand le
ballon change d'état, quel que soit le chemin qui l'a changé.
Notation : au-delà de la durée réglementaire de la période → `fin+N'`
(45+1', 90+3', 105+1', 120+2' ; 20+1' en 2×20). Une seule fonction partagée
(console, notifications, fil public, Direct, mobile).

## Prolongations et tirs au but

Périodes 5 à 9 : pause avant prolongations, 1re prolongation, pause, 2e
prolongation, tirs au but ; 4 reste « terminé ». Le chrono continue (90:00 →
105:00 → 120:00), côtés inversés entre les deux prolongations, temps de jeu
jusqu'à 120. Séance stockée à part (`live_state.tirs_au_but`), hors des
événements ; à la fin, `penalty_home/away` puis le chemin de fin habituel.
Élimination directe de compétition seulement.

## Livraison

1. Notation 45+N et libellés publics (MT, avant-match, +3).
2. État du jeu et console (reprises, chrono, recalage, interruption, côtés,
   possession automatique).
3. Coups francs calculés (après vérification en base) et fautif du penalty.
4. Règles par format (réglages, valeurs par défaut, formulaire).
5. Sortie sans remplaçant, minimum de joueurs, arrêt définitif (champ de
   forfait sur les amicaux : règles Firestore à étendre).
6. Prolongations et tirs au but tir par tir.

Tests : modules purs via le jest de `mobile/` (alias `@/` vers `src/`).
Console : vérifiée dans le navigateur sur un match d'entraînement.
