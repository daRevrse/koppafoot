# Ghost Players — Design Document
Date: 2026-04-24

## Concept

Un ghost player est un membre permanent d'une équipe créé par le manager pour des joueurs sans compte Firebase Auth (pas de smartphone/PC). Il est traité exactement comme un vrai joueur partout dans l'interface — roster, composition, events live — sans distinction visuelle.

Différences internes uniquement :
- Stocké dans `/teams/{teamId}/ghost_players/{ghostId}` au lieu de `/users/{uid}`
- Actions manager dans le roster : Modifier / Supprimer / Stats (au lieu de Voir profil / Retirer)
- Pas de demande de participation : directement disponible en composition

---

## Section 1 — Types (`types/index.ts`)

```typescript
interface FirestoreGhostPlayer {
  first_name: string;
  last_name: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  squad_number?: string;
  matches_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  created_at: string;
  updated_at: string;
}

interface GhostPlayer {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  squadNumber?: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## Section 2 — Firestore (`lib/firestore.ts`)

Sous-collection : `/teams/{teamId}/ghost_players`

```typescript
createGhostPlayer(teamId, data)
updateGhostPlayer(teamId, ghostId, data)
deleteGhostPlayer(teamId, ghostId)
getGhostPlayersByTeam(teamId)            // one-shot
onGhostPlayersByTeam(teamId, callback)   // real-time
rollupGhostPlayerStats(teamId, ghostPlayers, matchEvents)
```

**Rollup** : appelé dans le batch de validation post-match (côté client, manager).
- Filtre les events dont `player_id` est dans la liste des `ghostId`s de l'équipe
- Incrémente `goals`, `assists`, `yellow_cards`, `red_cards`, `matches_played`
- Batch write Firestore

---

## Section 3 — Roster (`teams/[id]/page.tsx`)

Onglet **Effectif** : liste unifiée `members + ghostPlayers`, triée par position.

Actions manager selon nature du joueur :
- **Vrai joueur** → Voir profil + Retirer de l'équipe
- **Ghost player** → Stats + Modifier + Supprimer

Bouton **"+ Ajouter un joueur"** (manager, bas de liste) → modal création/édition avec : prénom, nom, poste, numéro de dossard (optionnel).

Modal **Stats** : affiche matchs joués, buts, assists, cartons jaunes, cartons rouges.

---

## Section 4 — Match live

**Composition** : `onGhostPlayersByTeam` alimente la liste des joueurs disponibles, mélangés aux vrais joueurs, triés par position.

**Events** : l'arbitre choisit l'auteur parmi vrais joueurs + ghost players — aucune distinction.

**Rollup post-match** : déclenché dans le batch de validation du manager via `rollupGhostPlayerStats`.
