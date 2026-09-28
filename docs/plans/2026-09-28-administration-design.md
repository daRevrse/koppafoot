# Design : Une administration qui marche, et qui dit quoi faire

**Date :** 2026-09-28
**Statut :** Livré. Aucune migration. Suspension (voir plus bas) : `firestore.rules` à déployer.

## Le problème

L'administration a été relue écran par écran sur les émulateurs, connectée avec un administrateur tel qu'il existe depuis la bascule des rôles : `is_superadmin: true`, `user_type: "user"`.

1. **L'administrateur ne pouvait plus agir.** Huit routes comparaient encore `user_type` à « superadmin » (le correctif du 5 septembre en avait réparé vingt et une). Accepter ou refuser un organisateur, donner une casquette, envoyer un message : « Accès refusé ». Paramètres annonçait « 0 superadmin sur la plateforme ». Les nouvelles candidatures et les retours d'utilisateurs ne prévenaient plus personne.
2. **Les écrans lisaient les comptes à moitié.** `admin-firestore` portait ses propres copies des convertisseurs du produit, restées sans rôle Évolution ni casquettes : « 14 comptes, dont 14 sans aucun espace », des filtres de rôle à zéro, une fenêtre qui proposait de promouvoir administrateur un administrateur, un panneau d'activité toujours à zéro, et la fiche d'une équipe qui plantait (`createdAt.slice`).
3. **Les chiffres mentaient.** Le tableau de bord comptait les rôles par `user_type` (0 joueur, 0 manager), étiquetait tout le monde « Joueur », comptait comme « joués » les amicaux à venir, ignorait les compétitions, et affichait un bandeau « tous les systèmes fonctionnent normalement » écrit en dur. Deux campagnes sur quatre et le segment « propriétaires » visaient toujours zéro personne.
4. **Rien ne disait ce qui attendait.** Trois candidatures, un signalement et deux retours attendaient ; le signalement vivait au bas de la page Tribune, les retours n'étaient lisibles nulle part, et un amical contesté n'avait aucune issue.
5. **Les gestes dangereux passaient sans garde-fou.** « Désactiver » en bouton rouge sur chaque ligne ; un message à tous sans confirmation ; un score corrigé ou un match supprimé sans recalcul du classement ni reprise de ce qu'il avait crédité.
6. **Sur téléphone, l'administration débordait**, et le bouton du menu recouvrait le titre.

## Décisions

### Reconnaître l'administrateur

- Les huit routes passent par `exigerSuperadmin` / `estSuperadmin`, qui lisent le drapeau et l'ancien type. `superadminsDeLaPlateforme()` trouve les administrateurs sur les deux signaux pour les prévenir.
- `/api/admin/promote` accorde aussi la casquette de scoreur ; retirer l'administration à un compte de l'ancien modèle efface aussi son ancien type.
- `scripts/promote-superadmin.ts` pose le drapeau au lieu d'écrire le rôle.

### Lire comme le produit

- Les écrans lisent les comptes avec `firestoreToProfile` (lib/profil). Ce qui se compte ou se croise passe par des routes serveur (`lib/admin-serveur`) : tableau de bord, compteurs « à traiter », matchs, équipes, fiche d'un compte, retours, contestations, administrateurs.
- Un rôle est le rôle effectif (activé, ou à défaut déclaré), partout : écrans, segments d'envoi, relances (`lib/admin-segments`, `lib/admin-tableau`, purs et testés).
- Un match est joué quand il est terminé, amicaux et compétitions ensemble. Le bilan d'une équipe est celui de sa fiche publique, son effectif compte les joueurs sans compte.

### Dire quoi faire

- **Tableau de bord** : d'abord « À traiter » (candidatures, contestations, signalements, retours, compétitions à rendre publiques), chaque ligne menant à sa page ; puis les chiffres ; puis les matchs du jour et les dernières inscriptions.
- **Menu rangé par geste**, avec le compte de ce qui attend : À traiter, Plateforme, Communication, Réglages.
- **Retours** : une page pour lire et marquer traités les messages du formulaire « Un retour ? ».
- **Contestations** : l'administration tranche un amical contesté, au vu de ce que chaque camp a dit et des événements contestés. *Valider* : le score compte ; un score renseigné refusé par l'adversaire est alors crédité, par la même règle que la contresignature (`lib/match-renseigne-server`). *Annuler* : le match passe « annulé » et sort des bilans, du classement et des statistiques calculées ; ce qu'un score renseigné avait crédité est repris. Le motif est exigé, notifié aux deux managers et affiché sur la page du match.
- **Candidatures** : une seule file pour organisateurs, scoreurs et terrains, un refus toujours motivé, lu par le candidat sur sa page. Le scoreur accepté ou refusé est désormais prévenu.
- **Signalements** : leur propre page, à côté de ce qui attend une décision.

### Lire et agir vite

- **Fiche d'un compte** (`/admin/users/[uid]`) : identité, rôle, casquettes à accorder ou retirer une à une, activité, équipes, compétitions, candidatures ; corriger, suspendre, supprimer. La liste des comptes n'a plus qu'une ligne par compte et un menu « … ». `?q=` préremplit la recherche.
- **Matchs** : amicaux et compétitions, dates en toutes lettres, lien vers chaque match, statut « non clos » pour un amical passé jamais terminé, filtre des contestés.
- **Garde-fous** : un message ou une relance se relit avant l'envoi, nombre de destinataires affiché pendant la saisie ; corriger ou supprimer un match recalcule le classement, et supprimer un score renseigné reprend ce qu'il avait crédité ; la suspension bloque la connexion (voir « Suspendre pour de bon »).
- **Messages et Campagnes réunis** en deux onglets.
- **Le style du produit** : noir et blanc, angles nets, capitales, briques communes (`components/admin/ui`). Le profil de l'administrateur perd ses boutons sans effet.
- **Téléphone** : le menu s'ouvre depuis l'en-tête, les listes remplacent les tableaux.

### Suspendre pour de bon

La suspension n'écrivait que `is_active: false` : le compte sortait de la recherche et des envois, et se connectait comme avant. Pire, l'écriture partait du navigateur, et les règles ne laissent un compte modifier que son propre document : le bouton était refusé. Décision produit : la suspension bloque vraiment la connexion.

- **Une route serveur** (`POST /api/admin/comptes/[uid]/suspension`, `lib/suspension-serveur`) : le compte est désactivé dans Firebase Auth (plus de connexion par e-mail, Google ou téléphone, site et application) et ses jetons de renouvellement sont révoqués ; puis le document reçoit `is_active`, le motif, l'auteur et la date. La réactivation rend la connexion et efface la trace.
- **Garde-fous** : motif exigé (5 caractères), pas de suspension de soi-même ni d'un administrateur (on retire d'abord l'accès). La route des enregistrements n'écrit plus `is_active`, qui marquerait suspendu un compte qui se connecte encore.
- **Une session ouverte se ferme aussitôt** : le jeton déjà délivré vaudrait encore jusqu'à une heure. Le site et l'application écoutent `is_active` sur le compte connecté et déconnectent, en ne croyant que le serveur (le cache local persistant garderait l'ancien `false` d'un compte réactivé). Sur le site, `/login?suspendu=1` dit pourquoi ; une tentative de connexion reçoit le même message, qui renvoie à la page Aide (lisible sans compte, avec le formulaire de retour).
- **Plus de notifications** sur le téléphone d'un compte suspendu.
- **La fiche** dit qui a suspendu, quand, pourquoi, et si la connexion est bien bloquée. Un compte suspendu avant ce changement le signale (« peut encore se connecter ») avec un bouton « Bloquer la connexion ».
- **Règles** : `suspension_reason`, `suspended_by`, `suspended_at` rejoignent les champs qu'un compte ne s'écrit pas.

## Ce qui reste ouvert

- Un jeton déjà délivré reste accepté par les routes serveur et les règles jusqu'à son expiration (une heure au plus) : le site et l'application se déconnectent d'eux-mêmes, un client modifié pourrait s'en servir d'ici là. Le fermer tout à fait demanderait `verifyIdToken(jeton, true)` sur chaque route (un appel à Firebase Auth par requête).
- Annuler un match couvert en direct ne retire pas les compteurs historiques du profil (`users.goals`, `matches_played`), que les statistiques calculées ne lisent plus.

## Vérifications

- `mobile/src/__tests__/admin-tableau.test.ts` : rôle effectif, segments, relances, comptes, matchs.
- Émulateurs, suspension : garde-fous de la route, règles, compte désactivé et jetons révoqués dans Auth, session d'un joueur ouverte dans un second navigateur fermée en une seconde, reconnexion refusée avec le message, ancien suspendu renvoyé puis bloqué depuis sa fiche, réactivation depuis la liste au téléphone et reconnexion malgré le cache.
- Émulateurs : tutoriel manager rejoué, puis une administratrice au drapeau accepte un organisateur, refuse un scoreur avec motif, accorde une casquette, tranche deux contestations, marque un retour, prépare un message ; chaque écran relu sur ordinateur et téléphone.
