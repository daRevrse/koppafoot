# Design : Staff / modérateurs (gestion live déléguée)

**Date :** 2026-06-17
**Statut :** Approuvé

## Contexte

L'organisateur a besoin de déléguer la **saisie live** des matchs à du staff le jour du tournoi, sans leur donner le pouvoir de modifier la structure (équipes, poules, calendrier). Aujourd'hui `organizer_ids[]` + `isOrganizerOf` donnent un accès **complet** ; il manque un niveau « live only » et une UI.

## Décisions

- **Niveau unique « modérateur » = live only** (pas de co-organisateur pour l'instant).
- Le modérateur **garde son rôle normal** (pas promu `organizer` → ne peut pas créer de compétition).
- **Espace « live ops » dédié et minimal** (ne voit que ses compétitions → matchs → console live).

## Modèle & sécurité

- `FirestoreCompetition.moderator_ids: string[]` (+ `Competition.moderatorIds`, mapping dans `competition-mappers`, défaut `[]`).
- Règles : `isModeratorOf(cid)` = `uid in moderator_ids`. Écriture **`comp_matches`** → `isOrganizerOf(cid) || isModeratorOf(cid) || isSuperAdmin()`. **`comp_teams` + doc compétition restent organisateur-only.** La liste `moderator_ids` est modifiée via update du doc compétition (organisateur-only).
- Pas de nouvel index composite : la découverte des compétitions d'un modérateur se fait par deux requêtes `array-contains` (`moderator_ids` et `organizer_ids`), fusionnées + triées en mémoire.

## Ajout/retrait (par email)

Route API `POST/DELETE /api/competitions/moderators` (admin SDK, car email→uid) :
- Auth Bearer (cf. `/api/admin/promote`). **Autorisation : l'appelant ∈ `organizer_ids`** de la compétition (ou superadmin).
- `adminAuth.getUserByEmail` → uid → `arrayUnion`/`arrayRemove` sur `moderator_ids`.
- Notification in-app au modérateur ajouté (infra existante) avec le lien `/live-ops`.

## UI organisateur

- `/organizer/competitions/[cid]/staff` (+ carte « Staff » sur le dashboard) : liste des modérateurs, ajout par email, retrait.

## Espace modérateur « live ops »

- Groupe de routes `(moderator)`, gated **connecté** (tout rôle) ; `/live-ops` ajouté au proxy protégé.
- `/live-ops` : compétitions où l'utilisateur est modérateur **ou** organisateur (sinon état vide).
- `/live-ops/[cid]` : matchs de la compétition → console.
- `/live-ops/[cid]/matches/[mid]/live` : console live.
- **Console extraite** en composant partagé `LiveMatchConsole({ cid, mid, returnHref })`, réutilisée par l'espace orga ET l'espace modérateur (`returnHref` = destination après « fin de match »).
- Découvrabilité : lien « Live ops » dans le menu utilisateur du header app + la notif d'assignation.

## Lots d'implémentation

1. **Modèle + règles** : `moderator_ids`/`moderatorIds` + mapper + `isModeratorOf` + écriture comp_matches.
2. **Lib + API + UI staff orga** : `listModeratedCompetitions`/listener, route `/api/competitions/moderators`, écran staff.
3. **Espace live-ops + extraction `LiveMatchConsole`** : route group `(moderator)`, pages, proxy, lien header.

## Vérification
Pas de test runner → `npm run build` exit 0 + `npm run lint` (zéro nouvelle erreur) + manuel (orga ajoute un modérateur par email → le modérateur voit `/live-ops` → ouvre la console → peut saisir le live mais PAS la gestion équipes/poules).
