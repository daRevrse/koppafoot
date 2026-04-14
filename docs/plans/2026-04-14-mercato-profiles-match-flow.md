# Mercato, Profils publics & Flux match complet — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter le Mercato (4 onglets), les profils publics `/profile/[uid]`, les candidatures joueurs, le flux défi match manager→manager, et le système de quota de participation automatique.

**Architecture:** Client-side only (Next.js App Router + Firestore SDK). Toute la logique métier vit dans `src/lib/firestore.ts`. Deux nouvelles collections Firestore (`shortlists`, `join_requests`). Le match passe par 4 statuts : `challenge → pending → upcoming → completed/cancelled`.

**Tech Stack:** Next.js 16.2.3 App Router, React 19, Firestore SDK, TypeScript, Tailwind CSS 4, motion/react, lucide-react

**Design doc:** `docs/plans/2026-04-14-mercato-profiles-match-flow-design.md`

---

## Vérification de build (commande de référence)

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -20
```
Succès = "Generating static pages" sans erreur TypeScript.

---

## Task 1: Types — nouvelles interfaces & mises à jour

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Ajouter les nouveaux types**

Dans `src/types/index.ts`, ajouter après les types existants :

```typescript
// ============================================
// Shortlist (manager mercato)
// ============================================

export interface FirestoreShortlistEntry {
  manager_id: string;
  player_id: string;
  player_name: string;
  player_city: string;
  player_position: string;
  player_level: string;
  player_bio: string;
  created_at: string;
}

export interface ShortlistEntry {
  id: string;
  managerId: string;
  playerId: string;
  playerName: string;
  playerCity: string;
  playerPosition: string;
  playerLevel: string;
  playerBio: string;
  createdAt: string;
}

// ============================================
// Join Requests (player → team)
// ============================================

export type JoinRequestStatus = "pending" | "accepted" | "rejected";

export interface FirestoreJoinRequest {
  player_id: string;
  player_name: string;
  player_city: string;
  player_position: string;
  player_level: string;
  team_id: string;
  team_name: string;
  manager_id: string;
  message: string;
  status: JoinRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface JoinRequest {
  id: string;
  playerId: string;
  playerName: string;
  playerCity: string;
  playerPosition: string;
  playerLevel: string;
  teamId: string;
  teamName: string;
  managerId: string;
  message: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Mettre à jour MatchStatus et FirestoreMatch**

Remplacer :
```typescript
export type MatchStatus = "draft" | "upcoming" | "completed" | "cancelled";
```
Par :
```typescript
export type MatchStatus = "challenge" | "pending" | "upcoming" | "completed" | "cancelled";
```

Dans `FirestoreMatch`, ajouter les champs :
```typescript
  away_manager_id: string;
  confirmed_home: number;
  confirmed_away: number;
```

Dans `Match`, ajouter :
```typescript
  awayManagerId: string;
  confirmedHome: number;
  confirmedAway: number;
```

**Step 3: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -15
```
Attendu : succès (les nouveaux champs peuvent créer des erreurs TypeScript dans les pages existantes — les noter pour le Task suivant).

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add ShortlistEntry, JoinRequest; extend Match with challenge fields"
```

---

## Task 2: Firestore service — nouvelles fonctions

**Files:**
- Modify: `src/lib/firestore.ts`

**Step 1: Ajouter les imports manquants**

S'assurer que `src/lib/firestore.ts` importe `ShortlistEntry`, `FirestoreShortlistEntry`, `JoinRequest`, `FirestoreJoinRequest` depuis `@/types`.

**Step 2: Ajouter les converters**

```typescript
function toShortlistEntry(id: string, d: FirestoreShortlistEntry): ShortlistEntry {
  return {
    id, managerId: d.manager_id, playerId: d.player_id,
    playerName: d.player_name, playerCity: d.player_city,
    playerPosition: d.player_position, playerLevel: d.player_level,
    playerBio: d.player_bio, createdAt: d.created_at,
  };
}

function toJoinRequest(id: string, d: FirestoreJoinRequest): JoinRequest {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    playerCity: d.player_city, playerPosition: d.player_position,
    playerLevel: d.player_level, teamId: d.team_id, teamName: d.team_name,
    managerId: d.manager_id, message: d.message, status: d.status,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}
```

**Step 3: Corriger createTeam (manager non-joueur)**

Dans `createTeam()`, changer `member_ids: [data.managerId]` en `member_ids: []`.

**Step 4: Mettre à jour toMatch**

Dans `toMatch()`, ajouter les nouveaux champs :
```typescript
awayManagerId: d.away_manager_id ?? "",
confirmedHome: d.confirmed_home ?? 0,
confirmedAway: d.confirmed_away ?? 0,
```

**Step 5: Mettre à jour createMatch**

Ajouter les nouveaux paramètres au type d'entrée :
```typescript
awayManagerId: string;
```
Dans le corps de la fonction, ajouter dans le document Firestore :
```typescript
away_manager_id: data.awayManagerId,
confirmed_home: 0,
confirmed_away: 0,
status: "challenge",  // remplace data.status
```

**Step 6: Fonctions Shortlist**

```typescript
// ============================================
// Shortlist
// ============================================

export async function getShortlistByManager(managerId: string): Promise<ShortlistEntry[]> {
  const q = query(collection(db, "shortlists"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toShortlistEntry(d.id, d.data() as FirestoreShortlistEntry));
}

export async function addToShortlist(data: {
  managerId: string; playerId: string; playerName: string;
  playerCity: string; playerPosition: string; playerLevel: string; playerBio: string;
}): Promise<string> {
  // Check if already in shortlist
  const q = query(collection(db, "shortlists"),
    where("manager_id", "==", data.managerId),
    where("player_id", "==", data.playerId));
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "shortlists"), {
    manager_id: data.managerId, player_id: data.playerId,
    player_name: data.playerName, player_city: data.playerCity,
    player_position: data.playerPosition, player_level: data.playerLevel,
    player_bio: data.playerBio, created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function removeFromShortlist(shortlistId: string): Promise<void> {
  await deleteDoc(doc(db, "shortlists", shortlistId));
}

export async function isInShortlist(managerId: string, playerId: string): Promise<string | null> {
  const q = query(collection(db, "shortlists"),
    where("manager_id", "==", managerId),
    where("player_id", "==", playerId));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
}
```

**Step 7: Fonctions JoinRequest**

```typescript
// ============================================
// Join Requests
// ============================================

export async function createJoinRequest(data: {
  playerId: string; playerName: string; playerCity: string;
  playerPosition: string; playerLevel: string;
  teamId: string; teamName: string; managerId: string; message: string;
}): Promise<string> {
  // Check if request already exists
  const q = query(collection(db, "join_requests"),
    where("player_id", "==", data.playerId),
    where("team_id", "==", data.teamId),
    where("status", "==", "pending"));
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "join_requests"), {
    player_id: data.playerId, player_name: data.playerName,
    player_city: data.playerCity, player_position: data.playerPosition,
    player_level: data.playerLevel, team_id: data.teamId,
    team_name: data.teamName, manager_id: data.managerId,
    message: data.message, status: "pending",
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export function onJoinRequestsByManager(managerId: string, callback: (data: JoinRequest[]) => void): Unsubscribe {
  const q = query(collection(db, "join_requests"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest)));
  });
}

export function onJoinRequestsByTeam(teamId: string, callback: (data: JoinRequest[]) => void): Unsubscribe {
  const q = query(collection(db, "join_requests"), where("team_id", "==", teamId), where("status", "==", "pending"), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest)));
  });
}

export async function getJoinRequestsByPlayer(playerId: string): Promise<JoinRequest[]> {
  const q = query(collection(db, "join_requests"), where("player_id", "==", playerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest));
}

export async function respondToJoinRequest(requestId: string, accepted: boolean): Promise<void> {
  await updateDoc(doc(db, "join_requests", requestId), {
    status: accepted ? "accepted" : "rejected",
    updated_at: serverTimestamp(),
  });
}
```

**Step 8: Fonctions Match Challenge**

```typescript
// ============================================
// Match challenges
// ============================================

export async function getMatchChallengesForManager(managerId: string): Promise<Match[]> {
  const q = query(collection(db, "matches"),
    where("away_manager_id", "==", managerId),
    where("status", "==", "challenge"),
    orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch));
}

export async function respondToMatchChallenge(
  matchId: string,
  accepted: boolean,
  homeTeamMemberIds: string[],
  homeTeamMemberNames: Map<string, string>,
  awayTeamMemberIds: string[],
  awayTeamMemberNames: Map<string, string>,
  matchLabel: string,
  matchDate: string,
  matchTime: string,
  venueName: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<void> {
  if (!accepted) {
    await updateDoc(doc(db, "matches", matchId), {
      status: "cancelled", updated_at: serverTimestamp(),
    });
    return;
  }
  await updateDoc(doc(db, "matches", matchId), {
    status: "pending", updated_at: serverTimestamp(),
  });
  // Create participations for both teams (excluding managers)
  await createParticipationsForTeam(matchId, matchLabel, matchDate, matchTime, venueName, homeTeamId, homeTeamMemberIds, homeTeamMemberNames);
  await createParticipationsForTeam(matchId, matchLabel, matchDate, matchTime, venueName, awayTeamId, awayTeamMemberIds, awayTeamMemberNames);
}
```

**Step 9: Mettre à jour respondToParticipation avec vérification quota**

```typescript
const MATCH_QUOTAS: Record<string, number> = {
  "5v5": 3,
  "7v7": 5,
  "11v11": 8,
};

export async function respondToParticipation(
  participationId: string,
  accepted: boolean,
  matchId?: string,
  teamId?: string,
  format?: string,
  isHome?: boolean,
): Promise<void> {
  await updateDoc(doc(db, "participations", participationId), {
    status: accepted ? "confirmed" : "declined",
    updated_at: serverTimestamp(),
  });

  if (!accepted || !matchId || !teamId || !format) return;

  // Count confirmed for this team in this match
  const q = query(collection(db, "participations"),
    where("match_id", "==", matchId),
    where("team_id", "==", teamId),
    where("status", "==", "confirmed"));
  const snap = await getDocs(q);
  const confirmed = snap.size;

  // Update match confirmed count
  const matchRef = doc(db, "matches", matchId);
  await updateDoc(matchRef, {
    [isHome ? "confirmed_home" : "confirmed_away"]: confirmed,
    updated_at: serverTimestamp(),
  });

  // Check if both teams meet quota
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;
  const matchData = matchSnap.data() as FirestoreMatch;
  const minQuota = MATCH_QUOTAS[format] ?? 3;

  if (
    matchData.status === "pending" &&
    matchData.confirmed_home >= minQuota &&
    matchData.confirmed_away >= minQuota
  ) {
    await updateDoc(matchRef, { status: "upcoming", updated_at: serverTimestamp() });
    // Announce in Tribune
    await addDoc(collection(db, "posts"), {
      author_id: "system",
      author_name: "Koppafoot",
      author_role: "system",
      author_avatar: "",
      type: "match_announcement",
      content: `⚽ Match confirmé ! ${matchData.home_team_name} vs ${matchData.away_team_name} le ${matchData.date} à ${matchData.time} — ${matchData.venue_name}`,
      metadata: {
        home_team: matchData.home_team_name,
        away_team: matchData.away_team_name,
      },
      likes: [], comment_count: 0,
      created_at: serverTimestamp(), updated_at: serverTimestamp(),
    });
  }
}
```

**Step 10: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -20
```

Corriger les éventuelles erreurs TypeScript dues aux nouveaux champs requis dans les pages existantes (notamment `/matches/page.tsx` et `/participations/page.tsx`).

**Step 11: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat(firestore): add shortlist, join-request, match-challenge functions; fix createTeam manager non-player; add quota auto-confirm"
```

---

## Task 3: Firestore Rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Ajouter les règles shortlists et join_requests**

Ajouter dans le bloc `match /databases/{database}/documents` :

```javascript
// ============================================
// Shortlists collection (manager mercato)
// ============================================
match /shortlists/{shortlistId} {
  allow read, create, delete: if isAuthenticated()
    && request.auth.uid == (resource != null ? resource.data.manager_id : request.resource.data.manager_id);
}

// ============================================
// Join Requests collection (player → team)
// ============================================
match /join_requests/{requestId} {
  // Player creates and reads their own requests
  allow create: if isAuthenticated()
    && request.resource.data.player_id == request.auth.uid;
  allow read: if isAuthenticated()
    && (resource.data.player_id == request.auth.uid
        || resource.data.manager_id == request.auth.uid);
  // Manager updates (accept/reject)
  allow update: if isAuthenticated()
    && resource.data.manager_id == request.auth.uid;
}
```

**Step 2: Mettre à jour les règles matches**

Permettre au manager adverse de mettre à jour le statut d'un défi :

```javascript
match /matches/{matchId} {
  allow read: if true;
  allow create: if isAuthenticated();
  allow update: if isAuthenticated()
    && (resource.data.manager_id == request.auth.uid
        || resource.data.away_manager_id == request.auth.uid);
  allow delete: if isAuthenticated()
    && resource.data.manager_id == request.auth.uid;
  // ...subcollections inchangées
}
```

**Step 3: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): add shortlists, join_requests; allow away_manager to update match"
```

---

## Task 4: Fix pages existantes — nouveaux champs Match

**Files:**
- Modify: `src/app/(app)/matches/page.tsx`
- Modify: `src/app/(app)/participations/page.tsx`

**Step 1: Mettre à jour /matches/page.tsx**

Dans `createMatch()`, ajouter le paramètre `awayManagerId`. Le manager adverse est le `manager_id` de l'équipe sélectionnée comme adversaire. Ajouter un champ dans le formulaire pour sélectionner l'équipe adverse et récupérer son `manager_id`.

Logique :
- À la création d'un match, le manager choisit son équipe (home) et l'équipe adverse (from `searchTeams`)
- `awayManagerId = awayTeam.managerId`
- `status = "challenge"` (géré dans `createMatch`)
- **Ne plus appeler `createParticipationsForTeam`** à la création — les participations sont créées seulement quand le manager adverse accepte

**Step 2: Mettre à jour /participations/page.tsx**

Dans `respondToParticipation()`, passer les nouveaux paramètres :
- `matchId` : participation.matchId
- `teamId` : participation.teamId
- `format` : récupérer le format du match (ajouter un champ `match_format` dans la participation, ou faire un `getDoc` du match)

Simplification : ajouter `match_format` et `is_home` dans le document participation lors de la création.

**Step 3: Ajouter match_format et is_home dans FirestoreParticipation**

Dans `src/types/index.ts`, ajouter à `FirestoreParticipation` :
```typescript
match_format: string;
is_home: boolean;
```
Et dans `Participation` :
```typescript
matchFormat: string;
isHome: boolean;
```
Mettre à jour `toParticipation()` dans `firestore.ts`.

Mettre à jour `createParticipationsForTeam()` pour accepter `format` et `isHome` :
```typescript
export async function createParticipationsForTeam(
  matchId: string, matchLabel: string, matchDate: string, matchTime: string,
  venueName: string, teamId: string, memberIds: string[],
  memberNames: Map<string, string>, format: string, isHome: boolean,
): Promise<void>
```

**Step 4: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add src/types/index.ts src/lib/firestore.ts src/app/(app)/matches/page.tsx src/app/(app)/participations/page.tsx
git commit -m "feat(matches): add challenge flow, match_format in participation, quota check in respond"
```

---

## Task 5: Page /matches — onglet "Défis reçus"

**Files:**
- Modify: `src/app/(app)/matches/page.tsx`

**Step 1: Ajouter l'onglet "Défis reçus"**

Ajouter un 4ème onglet à côté de `upcoming / completed / draft` :
- **"Défis reçus"** — badge si `challenges.length > 0`
- Utilise `getMatchChallengesForManager(user.uid)` au montage
- Chaque carte affiche : équipes, date, lieu, format, manager challenger
- Boutons : **"Accepter"** et **"Refuser"**

**Step 2: Implémenter l'acceptation**

On "Accepter" :
1. Charger les membres des deux équipes (`getUsersByIds`)
2. Construire les `memberNames` Maps
3. Appeler `respondToMatchChallenge(matchId, true, ...)`

On "Refuser" :
1. Appeler `respondToMatchChallenge(matchId, false, ...)`

**Step 3: Formulaire de création de match — sélection équipe adverse**

Remplacer le champ texte `awayTeamName` par une recherche d'équipes réelles (`searchTeams`). Le manager choisit une équipe existante, on récupère automatiquement `awayTeamId`, `awayTeamName` et `awayManagerId`.

**Step 4: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add src/app/(app)/matches/page.tsx
git commit -m "feat(matches): add challenge tab with accept/reject; link away team by search"
```

---

## Task 6: Page /mercato (nouvelle)

**Files:**
- Create: `src/app/(app)/mercato/page.tsx`
- Delete: `src/app/(app)/recruitment/page.tsx` (ou garder en redirect)

**Step 1: Créer la page /mercato/page.tsx**

Structure : 4 onglets — `disponibles | shortlist | candidatures | invitations`

**Onglet "Joueurs disponibles"**
- Utilise `searchPlayers()` pour récupérer tous les joueurs actifs
- Filtre côté client : exclure les joueurs déjà dans une des équipes du manager (`myTeamMemberIds`)
- Chaque carte affiche nom, ville, poste, niveau, bio
- Lien "Voir le profil" → `/profile/[uid]`
- Bouton "Ajouter au Mercato" → `addToShortlist()` + met à jour l'état local `shortlistedIds`
- Filtres : ville, poste, niveau, recherche par nom

**Onglet "Liste de recrutement"**
- Utilise `getShortlistByManager(user.uid)` au montage
- Chaque carte : nom, ville, poste, niveau
- Bouton "Inviter" → modal (choix d'équipe + message) → `sendInvitation()`
- Bouton "Retirer" → `removeFromShortlist()`
- Lien "Voir le profil" → `/profile/[uid]`

**Onglet "Candidatures reçues"**
- Utilise `onJoinRequestsByManager(user.uid, callback)` (real-time)
- Sous-tabs : `pending | accepted | rejected`
- Chaque carte : nom joueur, équipe cible, message, ville, poste
- Bouton "Accepter" → `respondToJoinRequest(id, true)` + `sendInvitation()` automatique
- Bouton "Refuser" → `respondToJoinRequest(id, false)`

**Onglet "Invitations envoyées"**
- Identique à l'ancien onglet invitations de `/recruitment`
- Utilise `onInvitationsByManager(user.uid, callback)`

**Badge Mercato** = `joinRequests.filter(r => r.status === "pending").length + invitations.filter(i => i.status === "pending").length`

**Step 2: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git add src/app/(app)/mercato/page.tsx
git commit -m "feat(mercato): new 4-tab page replacing recruitment — shortlist, candidatures, invitations"
```

---

## Task 7: Page /profile/[uid] (nouvelle)

**Files:**
- Create: `src/app/(app)/profile/[uid]/page.tsx`

**Step 1: Créer la page**

Utilise `useParams<{ uid: string }>()` pour récupérer l'uid.

Récupère les données :
- `getUserById(uid)` — profil utilisateur (adapter `getUsersByIds` pour un seul uid)
- Si `userType === "player"` : `getTeamsByPlayer(uid)`, `getParticipationsForPlayer(uid)` pour les stats
- Si `userType === "manager"` : `getTeamsByManager(uid)`

**Contenu selon le rôle du profil consulté :**

**Joueur** :
- Header : avatar/initiales, nom, badge rôle, ville, bio
- Badges : poste, niveau
- Équipes actuelles (cartes miniatures avec lien `/teams/[id]`)
- Stats : matchs joués (participations confirmed), buts, passes

**Manager** :
- Header identique
- Équipes gérées (cartes miniatures)
- Bilan global : victoires / défaites / nuls

**Arbitre** :
- Header + niveau licence + années d'expérience

**Venue owner** :
- Header + nom compagnie + terrains

**Bouton "Ajouter au Mercato"** (conditionnel) :
- Visible uniquement si `currentUser.userType === "manager"` ET `profile.userType === "player"`
- Vérifie si déjà shortlisté via `isInShortlist(managerId, uid)` au montage
- Si non shortlisté : bouton vert "Ajouter au Mercato" → `addToShortlist()`
- Si déjà shortlisté : bouton désactivé "Dans le Mercato ✓"

**Step 2: Ajouter getUserById dans firestore.ts**

```typescript
export async function getUserById(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return toUserProfile(snap.id, snap.data() as FirestoreUser);
}
```

**Step 3: Lien "Voir mon profil public" sur /profile**

Dans `src/app/(app)/profile/page.tsx`, ajouter un lien :
```tsx
<Link href={`/profile/${user.uid}`} ...>Voir mon profil public</Link>
```

**Step 4: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add src/app/(app)/profile/[uid]/page.tsx src/lib/firestore.ts src/app/(app)/profile/page.tsx
git commit -m "feat(profile): public profile page /profile/[uid] with role-based content and Mercato CTA"
```

---

## Task 8: Teams Search — candidature joueur

**Files:**
- Modify: `src/app/(app)/teams/search/page.tsx`

**Step 1: Remplacer "Rejoindre" par "Candidater"**

- Remplacer le bouton `handleApply` par un bouton qui ouvre un modal
- Modal : textarea pour le message (optionnel) + bouton "Envoyer ma candidature"

**Step 2: Implémenter createJoinRequest**

Au submit du modal :
1. Récupérer le `manager_id` de l'équipe (`team.managerId`)
2. Appeler `createJoinRequest({ playerId: user.uid, playerName, teamId, teamName, managerId, message, ... })`
3. Afficher "Candidature envoyée" sur la carte

**Step 3: Récupérer les candidatures existantes du joueur**

Au montage, `getJoinRequestsByPlayer(user.uid)` pour construire un Set des `teamId` déjà candidatés → désactiver le bouton.

**Step 4: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add src/app/(app)/teams/search/page.tsx
git commit -m "feat(teams): replace join button with candidature modal and createJoinRequest"
```

---

## Task 9: Teams [id] — onglet Candidatures

**Files:**
- Modify: `src/app/(app)/teams/[id]/page.tsx`

**Step 1: Ajouter l'onglet "Candidatures" (manager uniquement)**

- Type `ActiveTab` : ajouter `"applications"`
- Nouvel onglet dans la liste de tabs si `isTeamManager`
- Badge = `joinRequests.filter(r => r.status === "pending").length`

**Step 2: Charger les candidatures**

Dans `useEffect`, si `isTeamManager`, appeler `onJoinRequestsByTeam(teamId, callback)` (real-time).

**Step 3: Affichage onglet Candidatures**

Chaque carte :
- Nom, ville, poste, niveau du joueur
- Message de candidature
- Bouton "Accepter" → `respondToJoinRequest(id, true)` + `sendInvitation()` automatique vers le joueur
- Bouton "Refuser" → `respondToJoinRequest(id, false)`

**Step 4: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add src/app/(app)/teams/[id]/page.tsx
git commit -m "feat(teams): add candidatures tab in team detail for manager"
```

---

## Task 10: Navigation — Mercato & badges

**Files:**
- Modify: `src/config/navigation.ts`

**Step 1: Renommer Recrutement → Mercato**

Dans `MANAGER_GROUPED` et `MANAGER_NAV`, remplacer :
```typescript
{ path: "/recruitment", icon: "UserPlus", label: "Recrutement", badge: true }
```
Par :
```typescript
{ path: "/mercato", icon: "TrendingUp", label: "Mercato", badge: true }
```

**Step 2: Ajouter badge Matchs pour les défis reçus**

Dans `MANAGER_GROUPED`, section "competition" :
```typescript
{ path: "/matches", icon: "Trophy", label: "Matchs", badge: true }
```

**Step 3: Redirect /recruitment → /mercato**

Créer `src/app/(app)/recruitment/page.tsx` avec un redirect (ou supprimer si la page n'existe plus) :
```tsx
// src/app/(app)/recruitment/page.tsx
import { redirect } from "next/navigation";
export default function RecruitmentRedirect() {
  redirect("/mercato");
}
```

**Step 4: Vérifier le build**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add src/config/navigation.ts src/app/(app)/recruitment/page.tsx
git commit -m "feat(nav): rename Recrutement to Mercato /mercato; add matches badge; redirect /recruitment"
```

---

## Task 11: Vérification finale & build complet

**Step 1: Build complet**

```bash
cd C:\football-network\koppafoot && npx next build 2>&1
```

Attendu :
- 0 erreurs TypeScript
- Routes visibles : `/mercato`, `/profile/[uid]`, toutes les routes existantes
- Pas de routes orphelines

**Step 2: Vérifier les routes générées**

S'assurer que dans la sortie build :
```
○ /mercato
ƒ /profile/[uid]
ƒ /teams/[id]
```
sont présentes.

**Step 3: Commit final si changements résiduels**

```bash
git add -p  # vérifier soigneusement
git commit -m "fix: final build cleanup after mercato/profiles/match-challenge implementation"
```

---

## Récapitulatif des fichiers touchés

| Fichier | Action |
|---------|--------|
| `src/types/index.ts` | ShortlistEntry, JoinRequest, MatchStatus update, Match fields |
| `src/lib/firestore.ts` | 15+ nouvelles fonctions, fix createTeam, update respondToParticipation |
| `firestore.rules` | Règles shortlists, join_requests, matches away_manager |
| `src/app/(app)/mercato/page.tsx` | **CRÉER** — 4 onglets |
| `src/app/(app)/profile/[uid]/page.tsx` | **CRÉER** — profil public |
| `src/app/(app)/matches/page.tsx` | +onglet Défis, formulaire adversaire par recherche |
| `src/app/(app)/teams/search/page.tsx` | Candidature modal |
| `src/app/(app)/teams/[id]/page.tsx` | +onglet Candidatures |
| `src/app/(app)/profile/page.tsx` | +lien profil public |
| `src/app/(app)/participations/page.tsx` | Passer format+isHome à respondToParticipation |
| `src/app/(app)/recruitment/page.tsx` | Redirect → /mercato |
| `src/config/navigation.ts` | Recrutement → Mercato, badges |
