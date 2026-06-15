# Competition Management & Live Score Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public, real-time "Miabé CAN" competition (groups + knockout) operated by a dedicated `organizer` role, designed as an acquisition funnel routing visitors toward clubs/mercato.

**Architecture:** A dedicated `competitions/{cid}` Firestore collection with `comp_teams` and `comp_matches` subcollections (reusing the existing `live_state` shape). A private `(organizer)` route group manages everything; public `/c/[slug]` routes (outside the auth-gated `(app)` group) render live scores via client `onSnapshot` (Firestore rules allow public read). Standings/scorers are computed client-side; the bracket is stored and propagated on match finish.

**Tech Stack:** Next.js 16 (App Router, route groups, Server Components for OG), React 19, Firebase Web SDK (client `onSnapshot`) + `firebase-admin` (server/OG), Tailwind v4, motion, lucide-react, react-hot-toast.

**Reference design:** `docs/plans/2026-06-15-competition-management-design.md`

---

## ⚠️ Verification reality (read first)

This project has **no test runner** (`package.json` scripts: `dev`, `build`, `start`, `lint` only). Existing plans use `npm run build` as the gate. So every task's verification is:

1. `npm run build` — TypeScript typecheck + compile. Expected: `✓ Compiled successfully`, no type errors.
2. `npm run lint` — Expected: no new errors.
3. **Manual** (where UI/behavior): `npm run dev`, then the exact in-browser steps listed.
4. **Firestore rules**: validated by behavior in the app; optionally `firebase deploy --only firestore:rules` (syntax check) before merging.

Do **not** invent Jest/Vitest. Treat `npm run build` as the "tests".

**Conventions to mirror (non-negotiable):**
- Firestore = `snake_case`; domain types = `camelCase`; provide a `toX(id, data)` converter (see `src/lib/firestore.ts` `toMatch`, and `firestoreToProfile` in `AuthContext.tsx`).
- Never write `undefined` to Firestore (see `buildFirestoreUser` filtering). Use `null` or omit.
- Live timer = **server clock**: `timer_start_at` (ISO) + `timer_offset` (ms). Never persist local elapsed time. (See `src/app/(app)/referee-panel/matches/[id]/manage/page.tsx`.)
- Keep the existing club match engine in `src/lib/firestore.ts` **untouched**; all competition logic goes in a new `src/lib/competition-firestore.ts`.

---

# PHASE 0 — Foundations

Goal: an organizer can be promoted, log into `/organizer`, create the Miabé CAN, and add its teams.

---

### Task 0.1: Add the `organizer` role

**Files:**
- Modify: `src/types/index.ts` (UserRole union + ROLE_REDIRECTS + ROLE_LABELS)
- Modify: `src/config/navigation.ts` (ROLE_BADGE_COLORS)

**Step 1: Extend the union and maps** in `src/types/index.ts`:

```ts
export type UserRole = "player" | "manager" | "referee" | "venue_owner" | "organizer" | "superadmin";
```
Add to `ROLE_REDIRECTS`: `organizer: "/organizer",`
Add to `ROLE_LABELS`: `organizer: "Organisateur",`

**Step 2: Badge color** in `src/config/navigation.ts` `ROLE_BADGE_COLORS`:
```ts
organizer: "bg-amber-100 text-amber-700",
```

**Step 3: Verify** — `npm run build`. Expected: PASS (TS unions exhaustively satisfied; no missing-key errors on the `Record<UserRole, ...>` maps). If build complains about a missing key in any `Record<UserRole, …>`, add the `organizer` entry there too.

**Step 4: Commit**
```bash
git add src/types/index.ts src/config/navigation.ts
git commit -m "feat(competition): add organizer role"
```

---

### Task 0.2: Competition data types

**Files:**
- Modify: `src/types/index.ts` (append a new `Competitions` section)

**Step 1: Add the types** (mirror the `FirestoreMatch`/`Match` dual pattern). Reuse the existing `live_state` shape by referencing the inline type already defined on `FirestoreMatch.live_state` — copy it verbatim into the comp match type so the live engine and views are interchangeable.

```ts
// ============================================
// Competitions
// ============================================

export type CompetitionStatus = "draft" | "registration" | "group_stage" | "knockout" | "completed";
export type CompMatchStage = "group" | "knockout";
export type CompMatchRound = "round_of_16" | "quarter" | "semi" | "final" | "third_place";
export type CompMatchStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface CompetitionFormat {
  group_count: number;
  teams_per_group: number;
  qualifiers_per_group: number;
  has_third_place: boolean;
  points: { win: number; draw: number; loss: number };
}

export interface FirestoreCompetition {
  name: string;
  slug: string;
  description?: string;
  logo_url: string | null;
  banner_url: string | null;
  organizer_ids: string[];
  created_by: string;
  status: CompetitionStatus;
  format: CompetitionFormat;
  start_date: string | null;
  end_date: string | null;
  venue_city: string | null;
  created_at: string;
  updated_at: string;
}

export interface Competition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  organizerIds: string[];
  createdBy: string;
  status: CompetitionStatus;
  format: CompetitionFormat;
  startDate: string | null;
  endDate: string | null;
  venueCity: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreCompTeam {
  name: string;
  short_name: string;
  logo_url: string | null;
  color: string;
  group: string | null;            // "A".."D" | null
  claimed_by_manager_id?: string | null;  // V2
  claimed_by_team_id?: string | null;      // V2
  created_at: string;
  updated_at: string;
}

export interface CompTeam {
  id: string;
  competitionId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  color: string;
  group: string | null;
  createdAt: string;
  updatedAt: string;
}

// Reuse the SAME event shape as FirestoreMatch.live_state.events
export interface FirestoreCompMatch {
  competition_id: string;
  stage: CompMatchStage;
  group: string | null;
  round: CompMatchRound | null;
  bracket_slot: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  date: string | null;
  time: string | null;
  venue_name: string | null;
  venue_city: string | null;
  status: CompMatchStatus;
  score_home: number | null;
  score_away: number | null;
  penalty_home: number | null;
  penalty_away: number | null;
  winner_team_id: string | null;
  feeds_into_match_id: string | null;
  feeds_into_slot: "home" | "away" | null;
  live_state: FirestoreMatch["live_state"];   // reuse verbatim
  created_at: string;
  updated_at: string;
}

export interface CompMatch {
  id: string;
  competitionId: string;
  stage: CompMatchStage;
  group: string | null;
  round: CompMatchRound | null;
  bracketSlot: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  date: string | null;
  time: string | null;
  venueName: string | null;
  venueCity: string | null;
  status: CompMatchStatus;
  scoreHome: number | null;
  scoreAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerTeamId: string | null;
  feedsIntoMatchId: string | null;
  feedsIntoSlot: "home" | "away" | null;
  liveState: Match["liveState"];   // reuse verbatim
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Verify** — `npm run build`. Expected: PASS.

**Step 3: Commit**
```bash
git add src/types/index.ts
git commit -m "feat(competition): add competition data types"
```

---

### Task 0.3: Firestore security rules

**Files:**
- Modify: `firestore.rules`

**Step 1:** Inside `match /databases/{database}/documents { … }`, add the helper near the other functions:
```js
function isOrganizerOf(cid) {
  let p = /databases/$(database)/documents/competitions/$(cid);
  return isAuthenticated() && exists(p) && request.auth.uid in get(p).data.organizer_ids;
}
```

**Step 2:** Add the collection block (alongside the others):
```js
match /competitions/{cid} {
  allow read: if true;
  allow create: if isRole('organizer')
                && request.auth.uid in request.resource.data.organizer_ids;
  allow update, delete: if isOrganizerOf(cid) || isSuperAdmin();

  match /comp_teams/{tid} {
    allow read: if true;
    allow write: if isOrganizerOf(cid) || isSuperAdmin();
  }
  match /comp_matches/{mid} {
    allow read: if true;
    allow write: if isOrganizerOf(cid) || isSuperAdmin();
  }
}
```

**Step 3: Verify** — syntax: `firebase deploy --only firestore:rules --dry-run` if the CLI is configured; otherwise visually confirm braces balance. (Deploy for real when ready to test in-app.)

**Step 4: Commit**
```bash
git add firestore.rules
git commit -m "feat(competition): firestore rules for competitions (public read, organizer write)"
```

---

### Task 0.4: Firestore composite indexes

**Files:**
- Modify: `firestore.indexes.json`

**Step 1:** Add to the `indexes` array (collectionGroup so public pages can query across the subcollection path):
```json
{
  "collectionGroup": "comp_matches",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "comp_matches",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "group", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" }
  ]
}
```

**Step 2: Verify** — valid JSON (`npm run build` won't check this; open the file or run `node -e "require('./firestore.indexes.json')"`). Deploy with `firebase deploy --only firestore:indexes` when testing queries.

**Step 3: Commit**
```bash
git add firestore.indexes.json
git commit -m "feat(competition): composite indexes for comp_matches"
```

---

### Task 0.5: Competition lib — converters + competition CRUD

**Files:**
- Create: `src/lib/competition-firestore.ts`

**Step 1:** Create the file. Import the same Firestore helpers used in `src/lib/firestore.ts` (open it to copy the exact import line for `db`, `collection`, `doc`, `getDoc`, `getDocs`, `addDoc`, `updateDoc`, `onSnapshot`, `query`, `where`, `orderBy`, `serverTimestamp`, `arrayUnion`, `increment`, `Unsubscribe`).

Implement, in order:
- `toCompetition(id, data)`, `toCompTeam(id, compId, data)`, `toCompMatch(id, data)` converters (snake→camel, mirror `toMatch`).
- `slugify(name)`: lowercase, strip accents (`normalize("NFD").replace(/[̀-ͯ]/g,"")`), non-alnum → `-`, collapse dashes.
- `createCompetition(input)`: writes `competitions/{auto}` with `organizer_ids: [input.createdBy]`, `status: "draft"`, `created_at/updated_at: serverTimestamp()`, format defaults. Returns the new id. Ensure slug uniqueness by querying `where("slug","==",slug)`; if taken, append `-2`, `-3`…
- `getCompetition(id)`, `getCompetitionBySlug(slug)`, `listCompetitionsByOrganizer(uid)` (`where("organizer_ids","array-contains",uid)`), `onCompetition(id, cb)`, `updateCompetition(id, patch)`.

Keep each function small and typed. **Do not** write `undefined`.

**Step 2: Verify** — `npm run build`. Expected: PASS.

**Step 3: Commit**
```bash
git add src/lib/competition-firestore.ts
git commit -m "feat(competition): competition converters + CRUD"
```

---

### Task 0.6: Organizer route group (layout, sidebar, nav, proxy)

**Files:**
- Create: `src/app/(organizer)/layout.tsx` (mirror `src/app/(venue-owner)/layout.tsx`, gate on `userType !== "organizer"`)
- Create: `src/components/layout/OrganizerSidebar.tsx` (mirror `VenueOwnerSidebar.tsx`)
- Modify: `src/config/navigation.ts` (add `ORGANIZER_GROUPED_NAV`, `ORGANIZER_BOTTOM`, register in `ROLE_GROUPED_NAV`/`ROLE_BOTTOM_NAV`, add `ROLE_HEADER_TITLES.organizer = "Espace Organisateur"`)
- Modify: `src/proxy.ts` (add `/organizer` to a protected list)

**Step 1: proxy** — add a constant and include it in `isProtected`:
```ts
const ORGANIZER_ROUTES = ["/organizer"];
// …
const isOrganizerRoute = ORGANIZER_ROUTES.some((r) => pathname.startsWith(r));
const isProtected = isProtectedRoute || isVenueOwnerRoute || isAdminRoute || isOrganizerRoute || isOnboardingRoute;
```
> Do NOT add `/c` anywhere — public routes must stay ungated.

**Step 2: navigation** — add:
```ts
const ORGANIZER_GROUPED: NavEntry[] = [
  { path: "/organizer", icon: "Trophy", label: "Mes compétitions", exact: true },
];
// register: ROLE_GROUPED_NAV.organizer = ORGANIZER_GROUPED
// ROLE_BOTTOM_NAV.organizer = [{ path: "/organizer", icon: "Trophy", label: "Compét.", exact: true }, { path: "/feed", icon:"MessageCircle", label:"Tribune" }]
// ROLE_HEADER_TITLES.organizer = "Espace Organisateur"
```
(Per-competition sub-links are added contextually inside the competition dashboard, not the global sidebar.)

**Step 3: layout + sidebar** — copy the venue-owner files, swap the role guard to `"organizer"`, swap sidebar nav source to `ROLE_GROUPED_NAV.organizer`, header title "Espace Organisateur".

**Step 4: Verify** — `npm run build` + `npm run lint`. Then manual is deferred until Task 0.7 adds the page.

**Step 5: Commit**
```bash
git add src/app/\(organizer\) src/components/layout/OrganizerSidebar.tsx src/config/navigation.ts src/proxy.ts
git commit -m "feat(competition): organizer route group, sidebar, nav, route gating"
```

---

### Task 0.7: Promote-to-organizer + organizer landing + create form

**Files:**
- Modify: `src/app/api/admin/promote/route.ts` (generalize to a target role)
- Create: `src/app/(organizer)/organizer/page.tsx` (list competitions + "Nouvelle compétition")
- Create: `src/app/(organizer)/organizer/competitions/new/page.tsx` (create form)

**Step 1: promote route** — keep `promote`/`revoke` but accept an optional `role` (default `"superadmin"`); validate against `["superadmin","organizer"]`; on `promote` set `user_type: role`. Preserve the superadmin-only caller check and self-revoke guard exactly as-is.

**Step 2: organizer landing** — `"use client"`, `useAuth`, `listCompetitionsByOrganizer(user.uid)` on mount; render cards (mirror admin list styling) + a primary "Nouvelle compétition" link to `/organizer/competitions/new`. Empty state with a Trophy icon.

**Step 3: create form** — fields: name (→ live slug preview), description, format (group_count, teams_per_group, qualifiers_per_group, has_third_place, points win/draw/loss with sane defaults 4/4/2/true/3/1/0), start_date, end_date, venue_city. On submit → `createCompetition({ ...form, createdBy: user.uid })` → `router.push(\`/organizer/competitions/${id}\`)`. Use `react-hot-toast` for feedback (mirror existing forms).

**Step 4: Verify (manual)** —
- Promote yourself: get your ID token (already in the `__session` cookie post-login) and `POST /api/admin/promote` with `{ "email": "<you>", "action": "promote", "role": "organizer" }` from a superadmin account. Re-login.
- `npm run dev` → visit `/organizer` → "Nouvelle compétition" → create "Miabé CAN 2026" → lands on the (empty) competition dashboard. Confirm the doc exists in Firestore with `organizer_ids: [yourUid]`, `status: "draft"`.

**Step 5: Commit**
```bash
git add src/app/api/admin/promote/route.ts src/app/\(organizer\)/organizer
git commit -m "feat(competition): organizer promotion + competition create flow"
```

---

### Task 0.8: comp_teams CRUD + competition dashboard

**Files:**
- Modify: `src/lib/competition-firestore.ts` (add team CRUD)
- Create: `src/app/(organizer)/organizer/competitions/[cid]/page.tsx` (dashboard: status, quick links, "match du jour" placeholder)
- Create: `src/app/(organizer)/organizer/competitions/[cid]/teams/page.tsx` (CRUD UI)

**Step 1: lib** — `createCompTeam(cid, {name, shortName, color, logoUrl?})` (group `null`), `listCompTeams(cid)` (onSnapshot variant `onCompTeams`), `updateCompTeam(cid, tid, patch)`, `deleteCompTeam(cid, tid)`.

**Step 2: dashboard** — load competition (`onCompetition`), show status badge + a sub-nav of cards linking to `/teams`, `/groups`, `/schedule`, `/knockout`. Guard: redirect if `user.uid` not in `competition.organizerIds`.

**Step 3: teams page** — grid of team cards + "Ajouter une équipe" modal (name, short_name, color picker, optional logo URL). Edit/delete per card. Mirror the modal styling from `referee-panel` manage or `teams/[id]` page.

**Step 4: Verify (manual)** — add 8–16 teams, edit one, delete one; confirm real-time list updates via `onCompTeams`.

**Step 5: Commit**
```bash
git add src/lib/competition-firestore.ts src/app/\(organizer\)/organizer/competitions
git commit -m "feat(competition): comp teams CRUD + competition dashboard"
```

---

# PHASE 1 — The live (CRITICAL PATH / minimum vendable)

Goal: from the organizer console, run a match live; a public visitor watches the score update in real time without an account.

---

### Task 1.1: Fixtures lib — round-robin generator + match CRUD

**Files:**
- Modify: `src/lib/competition-firestore.ts`

**Step 1: round-robin (circle method)** — pure helper, easy to reason about:
```ts
/** Single round-robin pairings for one group. Returns [homeId, awayId][]. */
export function roundRobinPairs(teamIds: string[]): [string, string][] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const rounds: [string, string][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") rounds.push([a, b]);
    }
    // rotate keeping first fixed
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds;
}
```

**Step 2:** `generateGroupFixtures(cid)`:
- Load competition + teams. For each group letter, take its teams, compute `roundRobinPairs`, and `addDoc` a `comp_matches` doc per pair with: `stage:"group"`, `group:<letter>`, `round:null`, denormalized names/logos, `status:"scheduled"`, all score/penalty/winner/live_state = `null`, `date/time/venue` = `null`.
- Guard: refuse if group fixtures already exist (idempotent — query existing `stage==group` first).

**Step 3:** match accessors — `onCompMatches(cid, cb)` (orderBy date), `onCompMatch(cid, mid, cb)`, `getCompMatch(cid, mid)`, `updateCompMatch(cid, mid, patch)`, `scheduleCompMatch(cid, mid, {date,time,venueName,venueCity})`.

**Step 4: Verify** — `npm run build`. Add a temporary console smoke test in dev if desired; remove before commit.

**Step 5: Commit**
```bash
git add src/lib/competition-firestore.ts
git commit -m "feat(competition): round-robin generator + comp match CRUD"
```

---

### Task 1.2: Groups screen (draw)

**Files:**
- Create: `src/app/(organizer)/organizer/competitions/[cid]/groups/page.tsx`

**Step 1:** List unassigned teams + one column per group (count target = `format.teams_per_group`). Assign via select/drag → `updateCompTeam(cid, tid, { group })`. Button **"Tirage aléatoire"**: shuffle unassigned teams, distribute evenly across groups. Button **"Valider les poules"** → guard each group is full → `updateCompetition(cid, { status: "group_stage" })`.

**Step 2: Verify (manual)** — random draw fills groups evenly; can't validate until full; status flips to `group_stage`.

**Step 3: Commit**
```bash
git add src/app/\(organizer\)/organizer/competitions
git commit -m "feat(competition): group draw screen"
```

---

### Task 1.3: Schedule screen (generate + date matches)

**Files:**
- Create: `src/app/(organizer)/organizer/competitions/[cid]/schedule/page.tsx`

**Step 1:** Button **"Générer les matchs de poule"** → `generateGroupFixtures(cid)`. List generated matches grouped by group; each row has date/time/venue inputs → `scheduleCompMatch(...)`. Link each row to its live console `/organizer/competitions/[cid]/matches/[mid]/live`.

**Step 2: Verify (manual)** — generate once (second click is a no-op), set dates on a few matches, confirm persistence.

**Step 3: Commit**
```bash
git add src/app/\(organizer\)/organizer/competitions
git commit -m "feat(competition): fixture generation + scheduling screen"
```

---

### Task 1.4: Live engine lib (timer, free-text goals, finish + bracket propagation)

**Files:**
- Modify: `src/lib/competition-firestore.ts`

**Step 1:** Port the four live writers from `src/lib/firestore.ts` (`initLiveMatch`, `startMatchTimer`, `pauseMatchTimer`, `updateMatchPeriod`, `addMatchEvent`) onto the `competitions/{cid}/comp_matches/{mid}` path. Read those originals first and keep identical timer semantics. Names: `initLiveCompMatch`, `startCompTimer`, `pauseCompTimer(cid, mid, elapsedMs)`, `updateCompPeriod`, `addCompEvent`.

`addCompEvent(cid, mid, event)` — same as `addMatchEvent` but the goal side increments by explicit `side: "home"|"away"`:
```ts
const updates: any = { "live_state.events": arrayUnion(newEvent), updated_at: serverTimestamp() };
if (event.type === "goal") updates[event.side === "home" ? "score_home" : "score_away"] = increment(1);
await updateDoc(matchRef, updates);
```
The event carries `player_name` (free text, may be `null`), `team_id`, no `player_id`.

**Step 2:** `finishCompMatch(cid, mid, { penaltyHome?, penaltyAway? })`:
- Load the match. Compute winner: higher score; if equal and `stage==="knockout"`, use penalties; else `winner_team_id=null` (group draw).
- `updateCompMatch(... { status:"completed", winner_team_id, penalty_home, penalty_away })`.
- **Bracket propagation (idempotent):** if `feeds_into_match_id` and `winner_team_id`, read the target match; only write if the target slot is empty or differs:
```ts
if (m.feeds_into_match_id && winnerId) {
  const tgt = await getCompMatch(cid, m.feeds_into_match_id);
  const slot = m.feeds_into_slot; // "home" | "away"
  const idField = slot === "home" ? "homeTeamId" : "awayTeamId";
  if (tgt && tgt[idField] !== winnerId) {
    const winnerTeam = await getCompTeam(cid, winnerId);
    await updateCompMatch(cid, m.feeds_into_match_id, slot === "home"
      ? { home_team_id: winnerId, home_team_name: winnerTeam.name, home_team_logo: winnerTeam.logoUrl }
      : { away_team_id: winnerId, away_team_name: winnerTeam.name, away_team_logo: winnerTeam.logoUrl });
  }
}
```
(Add `getCompTeam(cid, tid)` if missing.)

**Step 3: Verify** — `npm run build`. Expected: PASS.

**Step 4: Commit**
```bash
git add src/lib/competition-firestore.ts
git commit -m "feat(competition): live engine (timer, free-text goals, finish + bracket propagation)"
```

---

### Task 1.5: Organizer live console

**Files:**
- Create: `src/app/(organizer)/organizer/competitions/[cid]/matches/[mid]/live/page.tsx`

**Step 1:** Start from a **copy** of `src/app/(app)/referee-panel/matches/[id]/manage/page.tsx`. Strip: participations subscription, player grids, substitution modal, lineup-ready gate. Keep: timer display logic (server clock), period flow, finish flow, scoreboard.

Replace the scoring UI with two big **"+1 BUT"** buttons (home/away). On tap → small modal: free-text "Buteur (optionnel)" input + "Passer". Submit → `addCompEvent(cid, mid, { type:"goal", side, team_id, period, minute, player_name: name || null })`. Add optional yellow/red buttons (same modal pattern, `type:"yellow_card"|"red_card"`).

"Lancer le match" → `initLiveCompMatch`; play/pause → `startCompTimer`/`pauseCompTimer`; next period → `updateCompPeriod`; "Siffler la fin" → if knockout & draw, prompt penalties, then `finishCompMatch`. Subscribe via `onCompMatch`.

**Step 2: Verify (manual)** — start a scheduled match, run the timer, score goals (with and without scorer name), advance periods, finish. Confirm `score_home/away` and `live_state.events` update in Firestore.

**Step 3: Commit**
```bash
git add src/app/\(organizer\)/organizer/competitions
git commit -m "feat(competition): organizer live console (simplified)"
```

---

### Task 1.6: Public match live view (real-time, no auth)

**Files:**
- Create: `src/app/c/[slug]/layout.tsx` (minimal public shell — NO auth, NO `(app)` sidebar)
- Create: `src/app/c/[slug]/matches/[mid]/page.tsx` (public live view)

**Step 1: public layout** — a light wrapper (brand header + the children). It must not import `useAuth`-gated layouts. Confirm `firebase.ts` client init runs without a signed-in user (it does; `onSnapshot` works under `read: if true`).

**Step 2: live view** — start from a **copy** of `src/app/(app)/matches/[id]/live/page.tsx`. Resolve `slug → competitionId` (Server Component parent can pass `cid`, or fetch via `getCompetitionBySlug` client-side once), then subscribe with `onCompMatch(cid, mid, …)`. Reuse the scoreboard/timer/events timeline as-is.

**Step 3: Verify (manual)** — open the public URL `/c/miabe-can/matches/<mid>` in a **logged-out** browser (incognito) while the organizer scores in another window. Score updates live with no login. This is the demoable milestone.

**Step 4: Commit**
```bash
git add src/app/c
git commit -m "feat(competition): public real-time match view"
```

> 🎯 **End of Phase 1 = minimum vendable.** A real match can be run live and watched publicly. Demo to the organization here.

---

# PHASE 2 — Public hub (outline — expand into bite-sized tasks when reached)

Each task: build the screen, `npm run build` + `npm run lint`, manual check, commit.

- **2.1 Standings util + page** — `computeStandings(matches, teams, format)` pure function in `competition-firestore.ts` (points win/draw/loss; sort points → GD → GF → head-to-head). Page `src/app/c/[slug]/standings/page.tsx`: one table per group, qualifiers highlighted. (Unit-testable pure fn — at minimum exercise it via a dev scratch script.)
- **2.2 Calendar** — `src/app/c/[slug]/calendar/page.tsx`: matches grouped by day, status pills, link to match view.
- **2.3 Bracket + knockout generation** — `generateKnockout(cid)` seeds qualifiers (1A–2B…) into `comp_matches` with `feeds_into_*` links; organizer `/knockout` screen (auto + manual edit); public `src/app/c/[slug]/bracket/page.tsx` (reactive tree).
- **2.4 Scorers** — `computeTopScorers(matches)` aggregates goal events by `player_name` + team; page `src/app/c/[slug]/scorers/page.tsx`.
- **2.5 Team page** — `src/app/c/[slug]/teams/[tid]/page.tsx`: logo, group, position, results, next match.
- **2.6 Competition home** — `src/app/c/[slug]/page.tsx`: live-now block (`onCompMatches` filtered `status==live`), today/next, latest results, quick links.
- **2.7 OG images** — `src/app/c/[slug]/matches/[mid]/opengraph-image.tsx` (+ competition/team variants) via Server Component + `adminDb`, with a static fallback.

---

# PHASE 3 — Conversion funnel (outline)

- **3.1 WhatsApp share** — `<ShareButton>` component (`wa.me/?text=…`), placed on match/goal/standings/team pages.
- **3.2 Notif-on-goal hook** — "follow team" capture (lightweight `comp_team_followers`), express signup, FCM token capture (reuse `fcm-client.ts` + `/api/notifications/push`); on `addCompEvent` goal, push to followers.
- **3.3 Manager CTAs + next-edition waitlist** — recurring "Tu gères une équipe ? Crée ton club" + waitlist capture; segmented onboarding (manager-first) when arriving from a competition.
- **3.4 signup_source** — add to `SignupData`/`FirestoreUser`/`buildFirestoreUser`; set `"competition:<slug>"` when signup originates from a comp page.
- **3.5 Auto-post Tribune** — on `finishCompMatch`, create a feed post (reuse the `createPost` pattern from `submitMatchReport`).

---

# PHASE 4 — Rodage (checklist before kickoff)

- Full dress rehearsal: create a throwaway competition, run a match end-to-end **on a phone**, mid-match **refresh + airplane-mode toggle** on the console (state must recover from `live_state`).
- Add a lightweight "single operator" lock (e.g. `live_state.operator_uid` + last-heartbeat) to avoid double data entry.
- Public page weight/perf on mobile data; lazy images.
- Firestore read-cost sanity at peak (finale): confirm public pages don't fan out into N listeners; consider a single aggregated live doc if needed.
- Timezone/date display pass.

---

## Notes for the executor
- Keep `src/lib/firestore.ts` (club engine) untouched; everything lives in `src/lib/competition-firestore.ts`.
- Mirror existing styling (rounded cards, motion, lucide, toast) — don't invent a new design language.
- Commit after every task. If `npm run build` fails, fix before moving on (it's the test suite here).
- V2 (out of scope): team claim → pre-filled club, scorer↔profile linking, automated email/push campaigns.
