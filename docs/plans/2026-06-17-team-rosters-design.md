# Design : Effectifs + feuille de match (config équipes)

**Date :** 2026-06-17
**Statut :** Approuvé

## Contexte

Aujourd'hui les `comp_teams` n'ont pas d'effectif : la console live saisit le buteur en **texte libre** et `computeTopScorers` agrège ces noms. L'organisateur veut de vrais **effectifs nommés (joueur + dossard)** et des **feuilles de match (titulaires + remplaçants)** par match.

## Décisions

- **Effectif obligatoire** (pivot assumé) : la saisie live impose de choisir un joueur ; le texte libre disparaît pour les nouveaux events.
- **Feuille de match par match = titulaires + remplaçants**, avec remplacements gérés en live.
- L'effectif obligatoire rend l'**import** (feature suivante) quasi nécessaire (~300 joueurs à saisir) — on enchaînera dessus.

## Modèle de données

- **Effectif** : `players: CompPlayer[]` sur le doc `comp_team`. `CompPlayer = { id; name; number; position? }` (id généré client-side). Petits effectifs → tableau sur le doc, voyage avec l'équipe.
- **Feuille de match** : sur `comp_match`, `home_lineup` / `away_lineup: LineupEntry[]` où `LineupEntry = { player_id; name; number; role: "starter" | "substitute" }` (nom+n° **dénormalisés** → console & public sans recharger l'effectif). + `home_lineup_ready` / `away_lineup_ready: boolean`.
- **Événements** : le type live a déjà `player_id` + `player_name` (on mettait `player_id: null`). Désormais `player_id` renseigné + nom dénormalisé. **Aucun changement du type d'event.** Les remplacements utilisent `type: "substitution"` (déjà dans l'union) + `detail`.

## Sécurité

- L'effectif (`players` sur `comp_team`) = **structure → organisateur-only** (règles `comp_teams` inchangées : write `isOrganizerOf`).
- La feuille de match (sur `comp_match`) = **organisateur OU modérateur** (règle `comp_matches` déjà `isOrganizerOf || isModeratorOf`). Celui qui opère le match la pose.

## Écrans

- **Config effectif** (organisateur) : CRUD joueurs (nom + dossard + position optionnelle) par équipe, dans `/organizer/competitions/[cid]/teams` (sous-écran par équipe ou modal).
- **Console live (`LiveMatchConsole` partagé, retravaillé)** :
  - Écran « avant coup d'envoi » = poser les deux feuilles de match (sélection titulaires/remplaçants depuis l'effectif) → verrou : les deux `*_lineup_ready` → **Lancer**. (Réintroduit le gate compo, mais géré par orga/modérateur.)
  - Pendant : but/carton → **sélecteur de joueur** (grille des joueurs de la feuille, façon console arbitre clubs) ; **remplacements** (sortant→entrant) ; plus de texte libre.
- **Public** : effectif sur la page équipe ; compos (feuille de match) sur la page match ; buteurs réels.

## Calculs

- `computeTopScorers` agrège par **`player_id`** (repli sur `player_name` pour les events legacy de test). La page buteurs affiche de vrais joueurs.

## Lots

1. **Modèle + lib** : types `CompPlayer`/`LineupEntry` (+ `players`, `home_lineup`/`away_lineup`/`*_ready` + mapper), CRUD joueurs (`addCompPlayer`/`update`/`delete` sur le tableau), `setCompMatchLineup(cid, mid, side, entries)`.
2. **UI effectif** : config joueurs par équipe (organisateur).
3. **Console live retravaillée** : gate feuille de match (titulaires/remplaçants), sélecteur joueur pour buts/cartons, remplacements. (Le gros morceau.)
4. **Buteurs par `player_id` + affichage public** (effectif page équipe, compos page match).

## Vérification
Pas de test runner → `npm run build` exit 0 + `npm run lint` (zéro nouvelle erreur) + manuel (saisir un effectif → poser une feuille de match → lancer → marquer en choisissant un joueur → buteurs réels).
