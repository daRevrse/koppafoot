# Design : Les notifications push, fiables et utiles

**Date :** 2026-09-29
**Statut :** Livré. **À déployer : `firestore.rules`**, après le code (l'ancien client n'écrit pas `from_uid`). **Application mobile : nouvelle version à construire** (module natif `expo-notifications`).

## Le problème

L'inventaire des push a montré :

1. **Une faille.** `/api/notifications/push` prenait le destinataire, le titre, le texte et le lien dans le corps de la requête : n'importe quel compte connecté faisait vibrer le téléphone de n'importe qui au nom de KoppaFoot, et déclenchait même un e-mail (type « invitation », « demande d'adhésion », « message admin »). Les règles laissaient aussi n'importe qui écrire dans la cloche de n'importe qui, et le modèle d'e-mail n'échappait pas son texte.
2. **Des doublons.** La console appelait deux routes (abonnés de la compétition, abonnés du match) : qui suivait les deux recevait chaque but deux fois.
3. **Du bruit.** Carton jaune, « VAR en cours », « But accordé », « Reprise du match » : autant de vibrations pour chacun des matchs suivis.
4. **Pas de démenti.** Un but retiré dans la console restait annoncé.
5. **Des notifications muettes.** Une quinzaine n'existaient que dans la cloche : résultat à confirmer, inscriptions en compétition, rattachements, équipes confiées, scoreur ou modérateur désigné, publication retirée.
6. **Des réponses sans retour.** Défi accepté ou refusé, candidature acceptée ou refusée : l'autre camp n'apprenait rien. Aucun rappel le jour du match, aucune convocation d'entraînement, et le délai de validation d'un amical courait sans que l'adversaire le sache.
7. **Aucun réglage fin** (le filtre par catégorie existait côté serveur, sans écran) et **aucun push dans l'application mobile**.

## Décisions

### La route générique ne croit plus le navigateur
- `createNotification` signe la notification (`from_uid`) ; les règles n'acceptent que l'auteur, six types écrits au geste (invitation, candidature, défi, match, convocation, arbitrage — `lib/notification-client`, liste vérifiée par un test contre `firestore.rules`), un lien interne, des tailles bornées.
- La route reçoit un identifiant, relit la notification, vérifie l'auteur, la fraîcheur et qu'elle n'a pas déjà été poussée (transaction), plafonne à 60 envois par compte et par dix minutes (`push_quotas`), et n'envoie que vers un lien interne (`lienInterne`).
- L'e-mail (invitation, candidature) est écrit par le serveur à partir du type et du nom de l'expéditeur ; `adminMessageEmailHtml` échappe son texte.

### Le direct
- Une seule route (`/api/notifications/match`) réunit abonnés du match et de la compétition, chacun une fois ; elle reprend les droits des deux anciennes (organisateurs, modérateurs, porteurs d'un code d'accès, managers et scoreur d'un amical) et ignore les compétitions d'entraînement. `/api/notifications/competition` est supprimée.
- Restent : coup d'envoi, mi-temps, but, but refusé par la VAR, exclusion (rouge ou second jaune), score final. Partent : jaune simple, VAR en cours, but accordé, reprise.
- Retirer un but ou une exclusion pendant le match envoie « ↩️ But annulé » (avec le score corrigé) ou « ↩️ Exclusion annulée » (`annonceDuRetrait`, testé).

### Ce qui était muet
- `lib/notifier-serveur` : cloche + push en un appel, branché sur toutes les notifications serveur qui n'étaient que dans la cloche. « Tu couvres un match » et « Tu es modérateur » ne sont plus classées en annonces mais en personnel.

### Ce qui manquait
- Défi accepté ou refusé → celui qui l'a lancé ; candidature acceptée ou refusée → le joueur.
- Fin d'un amical entre deux comptes → l'autre manager : « valide ou conteste avant 18h30 », le délai tacite étant de douze heures.
- Rappel du matin (tâche de 6 h existante) : « Tu joues aujourd'hui », avec l'heure et le lieu, et la demande de répondre à qui ne l'a pas fait. Une fois par match.
- Créer un entraînement convoque ses joueurs.

### Réglages et mobile
- **Site** : quand le push est actif sur l'appareil, cinq bascules par catégorie (pour moi, mes équipes, ce que je suis, direct, annonces), valables pour tout le compte.
- **Application Android** : interrupteur dans l'onglet Compte (permission demandée au geste), jeton FCM natif rangé avec ceux du site, retiré à la déconnexion, suivi s'il change ; mêmes catégories ; un toucher ouvre la page annoncée dans le navigateur intégré. Le serveur envoie désormais le lien en données et le canal Android `koppafoot`. iPhone non couvert : l'application n'est pas construite pour iOS.

## Vérifications

- `mobile/src/__tests__/notifications.test.ts` : liens internes, filtre, types écrits par le navigateur = types des règles, démentis de retrait.
- Émulateurs (journal temporaire des envois, FCM n'étant pas joignable) : règles (signature, type, lien externe, taille), route générique (ancien corps refusé, relue en base, une seule fois, pas celle d'un autre, plafond), direct (abonnés réunis sans doublon, lien externe remplacé, porteur de code, inconnu refusé, bac à sable), résultat à confirmer, fin de match, entraînement, rappel du matin (confirmé, sans réponse, décliné exclu, une seule fois), réglages par catégorie sur ordinateur et Android, et un parcours navigateur complet (candidature acceptée → notification signée → push).
- Prebuild Android d'essai (hors dépôt) : canal par défaut, icône et couleur dans le manifeste ; permission `POST_NOTIFICATIONS` fournie par le paquet.
