# Design — Mercato, Profils publics & Flux match complet

**Date :** 2026-04-14  
**Statut :** Approuvé

---

## Contexte

Koppafoot est une plateforme football multi-rôles (joueur, manager, arbitre, venue_owner, superadmin) construite avec Next.js 16 App Router, Firebase Auth et Firestore. Ce document couvre 7 évolutions majeures du produit.

---

## 1. Manager non-joueur

Le manager gère une équipe mais n'en est pas membre joueur.

- `createTeam()` : ne plus ajouter `managerId` dans `member_ids`
- `member_ids` représente uniquement les joueurs
- Le manager n'apparaît pas dans le quota de participation aux matchs
- Firestore : `teams.manager_id` reste, `teams.member_ids` exclut le manager

---

## 2. Modèle de données

### Collections modifiées

**`teams`**
- `member_ids` : ne contient plus `manager_id`

**`matches`** — nouveaux champs :
```
away_manager_id   string        // uid du manager adverse
status            "challenge" | "pending" | "upcoming" | "completed" | "cancelled"
confirmed_home    number        // joueurs confirmés équipe domicile
confirmed_away    number        // joueurs confirmés équipe extérieur
```

### Nouvelles collections

**`shortlists/{id}`**
```
manager_id       string
player_id        string
player_name      string
player_city      string
player_position  string
player_level     string
player_bio       string
created_at       timestamp
```

**`join_requests/{id}`**
```
player_id        string
player_name      string
player_city      string
player_position  string
player_level     string
team_id          string
team_name        string
manager_id       string
message          string
status           "pending" | "accepted" | "rejected"
created_at       timestamp
updated_at       timestamp
```

---

## 3. Règles Firestore

```
/shortlists/{id}
  read, create, delete : manager_id == request.auth.uid

/join_requests/{id}
  create : player_id == request.auth.uid
  read   : player_id == request.auth.uid OU manager_id == request.auth.uid
  update : manager_id == request.auth.uid
```

---

## 4. Flux métier

### Flux A — Invitation manager → joueur
```
Manager (Mercato) → voit joueur → ajoute à shortlist
→ depuis shortlist : "Inviter" (choix équipe + message)
→ createInvitation() → joueur reçoit dans /player-invitations
→ joueur "Accepte" → respondToInvitation()
  → arrayUnion(playerId) dans team.member_ids
  → invitation status = "accepted"
```

### Flux B — Candidature joueur → équipe
```
Joueur (/teams/search) → "Candidater" → modal message → createJoinRequest()
→ Manager voit dans :
  • Mercato onglet "Candidatures reçues" (badge)
  • /teams/[id] onglet "Candidatures"
→ Manager "Accepte" → sendInvitation() automatique vers le joueur
  → join_request status = "accepted"
→ joueur reçoit invitation → "Accepte" → rejoint l'équipe (Flux A final)
→ Manager "Refuse" → join_request status = "rejected"
```

### Flux C — Défi match + quota → confirmation automatique
```
Manager A crée match (équipe A vs équipe B)
→ match status = "challenge"
→ away_manager_id = manager de l'équipe B
→ Manager B reçoit :
  • Badge nav sur /matches (onglet "Défis reçus")
  • Post dans La Tribune (notification)

Manager B REFUSE → match status = "cancelled"

Manager B ACCEPTE → match status = "pending"
→ createParticipationsForTeam(équipe A) — sans manager A
→ createParticipationsForTeam(équipe B) — sans manager B
→ Joueurs reçoivent demande dans /participations

Joueur confirme → respondToParticipation()
→ recompter confirmed_home ou confirmed_away dans le match
→ SI confirmed_home >= minQuota ET confirmed_away >= minQuota :
  updateMatch(status: "upcoming")
  createPost(type: "match_announcement")
    contenu: "Le match [Équipe A] vs [Équipe B] est confirmé !"

Manager saisit le score → status = "completed"
```

### Quotas universels
| Format | Minimum par équipe |
|--------|-------------------|
| 5v5    | 3 joueurs         |
| 7v7    | 5 joueurs         |
| 11v11  | 8 joueurs         |

---

## 5. Pages & routes

### Nouvelles pages

| Route | Description |
|-------|-------------|
| `/mercato` | Manager — 4 onglets |
| `/profile/[uid]` | Tous rôles — profil public |

### `/mercato` — 4 onglets manager

| Onglet | Contenu |
|--------|---------|
| **Joueurs disponibles** | Players actifs non membres des équipes du manager. Clic → `/profile/[uid]`. Bouton "Ajouter au Mercato" |
| **Liste de recrutement** | Shortlistés. Bouton "Inviter" (modal équipe + message) + "Retirer" |
| **Candidatures reçues** | `join_requests` where `manager_id == uid`, status pending. Accepter → invite auto. Refuser → rejected |
| **Invitations envoyées** | Invitations existantes (pending / accepted / declined) |

Badge nav Mercato = candidatures pending + invitations pending.

### `/profile/[uid]` — profil public

- Photo de couverture + avatar, nom, rôle, ville, bio
- **Joueur** : poste, niveau, équipes actuelles, stats (matchs, buts, passes)
- **Manager** : équipes gérées, bilan
- **Arbitre** : niveau licence, expérience
- **Venue owner** : nom compagnie, terrains
- Bouton **"Ajouter au Mercato"** visible si visiteur = manager ET profil = joueur non shortlisté

### Pages modifiées

| Page | Modification |
|------|--------------|
| `/matches` | +onglet "Défis reçus" avec badge. Créer match → statut "challenge" |
| `/teams/search` | Bouton "Rejoindre" → "Candidater" + modal message |
| `/teams/[id]` | +onglet "Candidatures" (manager only) |
| `/profile` | +lien "Voir mon profil public" |
| Navigation manager | "Recrutement" → "Mercato", route `/mercato` |

---

## 6. Navigation

### Manager — MANAGER_GROUPED (mise à jour)
```
Mon équipe :
  - /teams       → Mes équipes
  - /mercato     → Mercato  [badge: candidatures pending + invitations pending]

Compétition :
  - /matches     → Matchs   [badge: défis reçus]
  - /referees    → Arbitres
  - /calendar    → Calendrier
```

---

## 7. Choix techniques

- **Shortlist** : collection Firestore `/shortlists/{id}` — persistance cross-session
- **Join requests** : collection séparée `/join_requests/{id}` — flux distinct des invitations
- **Quota check** : côté client dans `respondToParticipation()`, race condition acceptable
- **Match challenge** : champ `away_manager_id` + status `"challenge"` dans le document match existant
- **Pas de Cloud Functions** : toute la logique reste côté client Firestore SDK
