# Design : Une administration qui marche, et qui dit quoi faire

**Date :** 2026-09-28
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration.

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
- **Garde-fous** : un message ou une relance se relit avant l'envoi, nombre de destinataires affiché pendant la saisie ; corriger ou supprimer un match recalcule le classement, et supprimer un score renseigné reprend ce qu'il avait crédité ; la suspension dit ce qu'elle fait vraiment (elle retire de la recherche et des envois, elle ne bloque pas la connexion).
- **Messages et Campagnes réunis** en deux onglets.
- **Le style du produit** : noir et blanc, angles nets, capitales, briques communes (`components/admin/ui`). Le profil de l'administrateur perd ses boutons sans effet.
- **Téléphone** : le menu s'ouvre depuis l'en-tête, les listes remplacent les tableaux.

## Ce qui reste ouvert

- La suspension ne bloque pas la connexion (`is_active` n'est lu que par la recherche et les envois). La rendre effective demanderait de désactiver le compte dans Firebase Auth : décision produit.
- Annuler un match couvert en direct ne retire pas les compteurs historiques du profil (`users.goals`, `matches_played`), que les statistiques calculées ne lisent plus.

## Vérifications

- `mobile/src/__tests__/admin-tableau.test.ts` : rôle effectif, segments, relances, comptes, matchs.
- Émulateurs : tutoriel manager rejoué, puis une administratrice au drapeau accepte un organisateur, refuse un scoreur avec motif, accorde une casquette, tranche deux contestations, marque un retour, prépare un message ; chaque écran relu sur ordinateur et téléphone.
