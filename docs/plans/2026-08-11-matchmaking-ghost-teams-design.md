# Design : Dégel du matchmaking + équipes fantômes

**Date :** 2026-08-11
**Statut :** Approuvé — lots 1 à 4 faits ; reste le lot 5

## Contexte

Le pivot du 2026-07-11 a gelé tout ce qui n'était pas compétition + live dans `src/app/_shelved/`. La Miabé CAN 2026 est passée (poules 24/07 → 09/08). On rouvre la première verticale gelée : les **matchs amicaux entre équipes** (`matches`), avec son **calendrier** (`calendar`) et les **convocations joueur** (`participations`).

Nouveauté produit : une équipe doit pouvoir planifier et jouer contre une **équipe qui n'est pas sur la plateforme** (équipe fantôme, effectif fantôme). Sans ça la feature est inutilisable au lancement — l'adversaire type d'un club amateur n'a pas de compte.

### Ce qui existe déjà (et qu'on ne réécrit pas)

- Les trois surfaces sont **intactes** dans `_shelved` et **compilent contre la lib actuelle** : `npx tsc --noEmit` passe, et `tsconfig.json` n'exclut pas `_shelved` (donc elles étaient déjà type-checkées à chaque build). Le préfixe `_` sort juste le dossier du routage (doc Next locale `01-app/01-getting-started/02-project-structure.md:257`).
- Toute la couche données est restée branchée dans `src/lib/firestore.ts` : `createMatch` (statut `"challenge"`), `onMatchChallengesForManager`, `respondToMatchChallenge`, participations, lineups, console live, rollups.
- Les **joueurs fantômes existent déjà** : sous-collection `teams/{teamId}/ghost_players` (`FirestoreGhostPlayer`/`GhostPlayer` dans `src/types/index.ts:779`), CRUD + listener dans `firestore.ts:2128+`, UI de gestion dans `src/app/(app)/teams/[id]/page.tsx:421` (`GhostPlayerModal`, `GhostStatsModal`), rollup de stats via `rollupGhostPlayerStats` (`firestore.ts:2196`).

## Décisions

1. **Périmètre du dégel = `matches` + `calendar` + `participations`.** `referee-panel`, `referees`, `venues`, `recruitment`, `community` restent au placard. Un match fantôme n'a de toute façon pas d'arbitre plateforme — le champ `local_referee_name` existe déjà pour l'arbitre de terrain.

2. **Une équipe fantôme est un vrai doc `teams`**, flaggé `is_ghost: true`, avec `manager_id` = le manager qui l'a créée. Alternative écartée : un simple nom en texte libre sur le match (`away_team_id: ""`) — moins cher, mais on perd l'effectif adverse (donc aucune attribution de but côté adversaire) et c'est un cul-de-sac sans chemin de migration.

   Conséquences directes, toutes favorables :
   - le rollup `batch.update(teams/{away_team_id})` de `updateMatchStatus` (`firestore.ts:1136`) trouve un doc existant — sinon **tout le batch échoue** et la clôture du match casse en silence ;
   - la sous-collection `ghost_players` de l'équipe fantôme sert de feuille de match adverse, **gratuitement** (les règles `ghost_players` (`firestore.rules:309`) autorisent déjà le `manager_id` du doc équipe, et l'UI d'édition d'effectif fantôme existe déjà sur `/teams/[id]`) ;
   - chemin de migration si l'adversaire s'inscrit un jour (réclamation d'équipe, à la manière de `RosterClaim` côté compétition).

3. **Les matchs fantômes n'alimentent pas les compteurs globaux des joueurs.** Voir « Intégrité des stats » ci-dessous. C'est la décision structurante du lot.

4. **Un match contre une équipe fantôme ne passe pas par le flux de défi.** Pas de `away_manager_id` → personne pour accepter. Il naît directement en `upcoming` (ou `pending` selon `auto_accept_players`), côté équipe réelle uniquement.

## Intégrité des stats (le vrai risque)

Aujourd'hui un résultat est crédible parce que **deux managers indépendants le valident** : `submitManagerFeedback` ne bascule `validation_status` en `validated` que si les deux ont validé (`firestore.ts:765`). Face à un fantôme il n'y a qu'un seul témoin — celui qui a créé le match. Il peut déclarer un 12-0, et `updateMatchStatus("completed")` incrémente directement `users/{id}.matches_played`, `.goals`, `.assists` (`firestore.ts:1177`). Ça pollue mercato et évolution, et c'est irrattrapable rétroactivement.

Règle retenue :

| | Match plateforme (2 managers) | Match fantôme |
|---|---|---|
| `validation_status` | `pending` → `validated` / `contested` | `unverified` (nouvel état terminal) |
| Rollup équipe (`teams`) | oui | oui (historique du club) |
| Rollup joueur (`users/{uid}`) | oui | **non** |
| Rollup `ghost_players` | oui | oui |
| Classements / mercato | oui | non |

Affichage : badge « amical non vérifié » sur la carte et le détail du match.

## Sécurité (à faire AVANT d'ouvrir)

`firestore.rules:172` autorise l'update d'un match dès que les clés touchées sont dans `['confirmed_home','confirmed_away','players_confirmed','status','updated_at']` — donc **n'importe quel utilisateur authentifié peut changer le `status` de n'importe quel match**. Idem clause 3 (`firestore.rules:168`) qui laisse écrire `result` via `hasAny`. Tant que le matchmaking était rangé c'était théorique ; en le rouvrant c'est exploitable.

Fix : borner ces deux branches aux acteurs du match (manager domicile, manager extérieur, arbitre confirmé, joueur convoqué pour les seuls compteurs de confirmation).

## Lots

### Lot 1 — Dégel des trois surfaces (sans fantôme) — FAIT

- `git mv` de `src/app/_shelved/(app)/{matches,calendar,participations}` vers `src/app/(app)/`.
- **Écart assumé par rapport au périmètre annoncé** : la console d'opération du match vivait dans le panel arbitre gelé (`referee-panel/matches/[id]/manage`) — c'est le seul écran qui démarre le chrono et saisit les buts d'un amical. Sans elle on pouvait planifier un match mais pas le **jouer**, ce qui vide le dégel de son sens. Elle est donc **re-logée** en `(app)/matches/[id]/manage`. Le reste du panel arbitre (tableau de bord arbitre, rapports, annuaire `referees`) reste au placard.
- Cette console n'avait **aucune garde d'accès** (atteignable à l'URL seule). Garde client ajoutée : manager domicile, manager extérieur ou arbitre confirmé — l'application réelle reste le job du lot 2.
- **Liens sortants qui pendaient** :
  - `matches/[id]/page.tsx:1153` → `/referee-panel/matches/${id}/manage` → repointé sur `/matches/${id}/manage`
  - `matches/page.tsx:1192` (« Trouver un arbitre ») → `/referees` → retiré ; l'arbitre de terrain se saisit déjà en texte libre (`localRefereeName`)
- Nav : entrées dans `ROLE_SPACE_ITEMS` (`AppSidebar.tsx`) — manager : « Matchs amicaux », « Calendrier » ; joueur : « Mes convocations », « Calendrier ».
- **Pas de nouvel onglet dans `MobileBottomNav`** : la barre basse est la nav publique (Direct / Compétitions / Tribune / Moi), identique pour les invités ; l'accès mobile aux destinations de rôle passe déjà par « Moi » → Espace joueur/manager → `/evolution`, mécanisme prévu par le commentaire `evolution/page.tsx:56`. La sidebar est `hidden lg:block`.
- `evolution/page.tsx` : lignes `ROLE_FEATURES` passées de teaser « Bientôt » à lien (ajout du `href`) — joueur : `/participations`, `/calendar` ; manager : `/matches`, plus une ligne « Mon calendrier » ajoutée (`/calendar` sert les deux rôles).
- Le lien de notification `createMatch` → `/matches` (`firestore.ts:672`) redevient valide automatiquement.
- **Trou UX comblé** : le formulaire de création lisait les lieux via `getVenues()` alors que la verticale `venues` reste gelée (collection vide → `venue_name: ""`). Saisie libre nom + ville, affichée seule quand aucun terrain n'est référencé, en option « Autre terrain » sinon. Même repli côté demande de modification, qui effaçait le terrain du match au lieu de le conserver.

### Lot 2 — Durcissement des règles — FAIT (⚠️ non déployé)

Branches 3 et 4 de `match /matches/{matchId}` passées de `hasAny` à `hasOnly` + contrôle de l'acteur :

- **Branche 3, arbitre en self-service** : bornée aux quatre champs arbitre, et réservée à qui se porte candidat sur un match sans arbitre (`referee_id` posé sur soi, statut `pending`) ou répond à sa propre désignation (`resource.data.referee_id == uid`). Les réponses côté manager passent par la branche 1.
- **Branche 4, compteurs joueur** : bornée au jeu de champs exact de `respondToParticipation` plus la seule transition légitime `pending → upcoming`. Les règles ne peuvent pas vérifier que l'appelant est convoqué (l'id du doc participation n'est pas dérivable du match), mais plus personne ne peut basculer un match en `live`, `completed` ou `cancelled` par ce chemin.
- **Branche 1** : `away_manager_id` lu via `.get(…, '')` — un uid n'est jamais vide, donc un adversaire fantôme (lot 3) ne matchera jamais.
- **`allow create`** resserré : `manager_id` doit être l'appelant (ou superadmin). C'était `isAuthenticated()` seul.

Tous les appels légitimes de `firestore.ts` ont été retracés un par un (console live, `respondToMatchChallenge`, `cancelMatch`, `updateMatchStatus`, `forceCompleteMatch`, `submitMatchReport`, `contestMatchEvent`, les quatre fonctions arbitre, `respondToParticipation`) : ils tombent tous dans les branches 1, 2 ou dans les deux branches bornées.

**Vérifié** : les règles compilent (chargées par `firebase emulators:exec --only firestore`). **Non vérifié** : le comportement autorisé/refusé, qui demanderait `@firebase/rules-unit-testing` — le projet n'a pas de runner de test et je n'ai pas ajouté de dépendance.

**Reste à faire par l'utilisateur** : `npx firebase deploy --only firestore:rules` (les règles prennent effet immédiatement, sans redéploiement applicatif).

### Lot 3 — Modèle équipe fantôme — FAIT

Le sélecteur d'adversaire ne peut pas être livré seul : une fois qu'on peut choisir un fantôme, le match doit se créer correctement. Les deux premiers points du lot 4 (statut à la création, convocations) et le garde-fou stats ont donc été tirés en avant — livrer le sélecteur sans eux aurait créé des matchs bloqués dans une boîte de défis que personne ne lit, sans joueur convoqué, et avec des stats auto-déclarées qui remontent aux profils.

Reste au lot 4 : la feuille de match adverse composée depuis les `ghost_players` du fantôme. Reste au lot 5 : la fiche d'une équipe fantôme (sans CTA social).


- `FirestoreTeam` / `Team` : `is_ghost?: boolean` / `isGhost?` (+ mapper `toTeam`).
- `createGhostTeam({ name, city?, color?, managerId })` dans `firestore.ts` : doc `teams` avec `manager_id` = créateur, `member_ids: []`, `is_recruiting: false`, `is_ghost: true`.
- **Exclusions d'annuaire** : `searchTeams` (`firestore.ts:424`) filtre déjà sur `is_recruiting == true`, donc une équipe fantôme en est exclue *de fait* — mercato compris. À l'inverse `getTeamsByManager` **remontera** les fantômes dans « Mes équipes » : les afficher dans une section distincte « Adversaires fantômes » plutôt que mélangées (ça donne aussi l'accès à l'édition de leur effectif, qui existe déjà).
- Sélecteur d'adversaire du formulaire de création : garder la recherche `searchTeams` pour les vraies équipes, ajouter une branche « Cette équipe n'est pas sur KoppaFoot » → création inline du fantôme + réutilisation des fantômes déjà créés par ce manager.

### Lot 4 — Flux de match fantôme — FAIT

Les deux premiers points ont été livrés avec le lot 3 (voir ci-dessus). Complété ici :

- **Feuille de match adverse** : `updateMatchLineup` écrit le rôle sur les docs `participations` — un joueur fantôme n'en a pas, ses assignations y étaient donc **silencieusement perdues** (bug préexistant, y compris pour les joueurs fantômes de sa propre équipe). Nouveau champ `ghost_lineup: FirestoreLineupEntry[]` dénormalisé sur le match, écrit par `setGhostLineup(matchId, ghostIsHome, entries)`, qui lève aussi le `*_lineup_ready` du bon côté. Même modèle que `home_lineup`/`away_lineup` côté compétition.
- **UI** : bloc « Feuille de match · <adversaire> » dans l'onglet Feuille de match, alimenté par les `ghost_players` de l'équipe fantôme (titulaire / remplaçant / hors feuille + numéro), visible uniquement pour le créateur d'un match fantôme.
- **Console live** : les deux grilles de joueurs passent par un type `ConsolePlayer` unique, alimenté soit par les participations, soit par `ghost_lineup`. Sans ça le panneau de l'adversaire restait vide et **aucun de ses buts n'était attribuable à un joueur**. Les remplacements résolvent les noms dans les deux sources.

**Bug préexistant corrigé au passage** : `myTeamId` assimilait `manager_id` à l'équipe **domicile**. Or `is_home` dit seulement si le créateur joue à domicile — dès qu'un manager planifiait un déplacement, les deux camps étaient inversés : feuille de match, numéros de maillot et drapeau « compo prête » atterrissaient chez l'adversaire. Le mapping passe désormais par `is_home`, et `updateMatchLineup` reçoit le bon côté.


- `createMatch` : si l'adversaire est fantôme → `away_manager_id: ""` (chaîne vide, pas `null` : les requêtes `where("away_manager_id","==",uid)` restent saines), statut direct `upcoming`/`pending`, **pas** de notification de défi.
- `respondToMatchChallenge` : non appelé pour ces matchs ; ne créer les participations que pour l'équipe réelle (`createParticipationsForTeam` une seule fois).
- Feuille de match adverse : sélection depuis les `ghost_players` de l'équipe fantôme (la page détail importe déjà `getGhostPlayersByTeam`).
- `submitManagerFeedback` : un seul manager → poser `validation_status: "unverified"` au lieu d'attendre `bothValidated` (`firestore.ts:765`).
- `updateMatchStatus("completed")` : garder le rollup équipe, **sauter le rollup `users/{uid}`** si le match est fantôme.
- `MatchStatus` / `validation_status` : ajouter `"unverified"` au type.

### Lot 5 — Affichage

- Badge « amical non vérifié » (liste + détail).
- Section « Adversaires fantômes » sur `/teams`.
- Page équipe d'un fantôme : accessible par lien, hors annuaire, sans CTA social (suivre, rejoindre, recruter).

## Vérification

Pas de test runner sur le projet — la porte reste `npx tsc --noEmit` + `npm run build` + `npm run lint` (baseline lint ~74 erreurs préexistantes) + parcours manuel connecté par l'utilisateur (l'agent n'a pas de session authentifiée).

Parcours manuels à couvrir : créer un fantôme → planifier un match → convoquer ses joueurs → console live → clôturer → vérifier que les stats du club bougent et que celles des joueurs **ne** bougent **pas**.

## Questions ouvertes

1. Un match fantôme démarre-t-il directement en `upcoming`, ou passe-t-il par `draft` pour laisser le manager le préparer ? (Reco : `upcoming` direct, `draft` reste disponible manuellement.)
2. Le nombre d'équipes fantômes par manager doit-il être plafonné (anti-spam) ?
3. Réclamation d'une équipe fantôme par son vrai club : dans ce lot ou plus tard ? (Reco : plus tard — c'est le hook de croissance, mais il demande son propre flux d'invitation.)
