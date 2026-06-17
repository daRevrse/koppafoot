# Public Competition Discovery + Landing Refonte — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the public discover competitions via a server-rendered `/competitions` directory and a competition-first landing (HeroSpotlight + teaser), while keeping the acquisition funnel below.

**Architecture:** New server-only lib (`competition-admin.ts`, `firebase-admin`) exposes `getPublicCompetitions()` + `getFeaturedCompetition()`. The pure Firestore converters are extracted to an SDK-agnostic `competition-mappers.ts` shared by the existing client lib and the new server lib. `/competitions` and `/` become Server Components (`revalidate = 60`) that fetch on the server and pass plain props to presentational client components; live realtime stays on the match pages.

**Tech Stack:** Next.js 16 (App Router, Server Components, ISR), React 19, firebase-admin (server reads), Firebase Web SDK (existing client reads), Tailwind v4, motion, lucide-react.

**Reference design:** `docs/plans/2026-06-17-public-competition-discovery-design.md`

---

## ⚠️ Verification reality (read first)

No test runner exists (`package.json`: dev/build/start/lint). Per-task verification:
1. `npm run build` — must end **exit 0** (`=== BUILD EXIT: 0 ===`). If you see a TS error pointing at `.next/dev/types/routes.d.ts`, it's a stale cache — `Remove-Item -Recurse -Force .next` (PowerShell) and rebuild; it's not a code issue.
2. `npm run lint` / `npx eslint <files>` — repo baseline is **76 errors / 155 warnings**; add **zero** new. No `any`.
3. Manual where noted (`npm run dev`).

**Conventions:** `snake_case` Firestore ↔ `camelCase` domain via converters; never write `undefined` to Firestore; mappers produce **plain serializable objects** (ISO string dates) so they can cross the server→client boundary as props.

**Critical boundary:** `firebase-admin` must NEVER be imported into a client component (`"use client"`) — it would leak server credentials / break the build. `competition-admin.ts` is server-only and imported only by Server Components.

---

### Task 1: Extract shared converters to `competition-mappers.ts`

Pure refactor — no behavior change. Lets the server lib reuse the converters without importing the web SDK.

**Files:**
- Create: `src/lib/competition-mappers.ts`
- Modify: `src/lib/competition-firestore.ts`

**Step 1: Create the mappers module.** Move `formatDate`, `toCompetition`, `toCompTeam`, `toCompMatch` (and the `FirestoreDate` type) **verbatim** from `competition-firestore.ts` into `src/lib/competition-mappers.ts`. Import the needed types from `@/types`. This file imports NOTHING from `@/lib/firebase` or `firebase/firestore` (it's pure data mapping) — verify there are no such imports.

**Step 2: Re-wire `competition-firestore.ts`.** Remove the moved function bodies; add `import { toCompetition, toCompTeam, toCompMatch } from "./competition-mappers";`. Because other modules may import these converters from `competition-firestore.ts`, ALSO re-export them for compatibility:
```ts
export { toCompetition, toCompTeam, toCompMatch } from "./competition-mappers";
```
(If `formatDate` was only used internally, it now lives in mappers; confirm nothing else referenced it.)

**Step 3: Verify.** `npm run build` → exit 0. `npx eslint src/lib/competition-mappers.ts src/lib/competition-firestore.ts` → exit 0. Grep `toCompetition\|toCompTeam\|toCompMatch` across `src` to confirm all importers still resolve.

**Step 4: Commit.**
```bash
git add src/lib/competition-mappers.ts src/lib/competition-firestore.ts
git commit -m "refactor(competition): extract pure converters to competition-mappers"
```

---

### Task 2: Server admin lib `competition-admin.ts`

**Files:**
- Create: `src/lib/competition-admin.ts`

**Step 1: Implement.** Server-only (no `"use client"`). Use `adminDb` from `@/lib/firebase-admin` and the shared mappers. Every Firestore-touching function wraps work in try/catch returning a safe default (`[]` / `null`) so the public pages degrade gracefully (and the build never crashes if Firestore is unreachable at prerender time).

```ts
import { adminDb } from "@/lib/firebase-admin";
import { toCompetition, toCompMatch } from "@/lib/competition-mappers";
import type { Competition, CompMatch, FirestoreCompetition, FirestoreCompMatch, CompetitionStatus } from "@/types";

// Relevance rank: ongoing first, then upcoming, then finished.
const STATUS_RANK: Record<CompetitionStatus, number> = {
  group_stage: 0, knockout: 0, registration: 1, completed: 2, draft: 99,
};

/** All publicly-visible competitions (status != draft), most relevant first. */
export async function getPublicCompetitions(): Promise<Competition[]> {
  try {
    const snap = await adminDb.collection("competitions").get();
    const comps = snap.docs
      .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
      .filter((c) => c.status !== "draft");
    comps.sort((a, b) => {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (r !== 0) return r;
      // tie-break: most recent start_date (fallback created_at) first
      return (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt);
    });
    return comps;
  } catch (err) {
    console.error("getPublicCompetitions failed:", err);
    return [];
  }
}

/** The single highlighted competition + its live (or next scheduled) match. */
export async function getFeaturedCompetition(): Promise<{ competition: Competition; highlightMatch: CompMatch | null } | null> {
  try {
    const comps = await getPublicCompetitions();
    const competition = comps[0];
    if (!competition) return null;

    const matchesCol = adminDb.collection("competitions").doc(competition.id).collection("comp_matches");

    // Prefer a live match.
    const liveSnap = await matchesCol.where("status", "==", "live").limit(1).get();
    if (!liveSnap.empty) {
      const d = liveSnap.docs[0];
      return { competition, highlightMatch: toCompMatch(d.id, d.data() as FirestoreCompMatch) };
    }

    // Else the next scheduled match with a real date (filter null in memory).
    const schedSnap = await matchesCol.where("status", "==", "scheduled").orderBy("date", "asc").limit(5).get();
    const next = schedSnap.docs
      .map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch))
      .find((m) => m.date != null);
    return { competition, highlightMatch: next ?? null };
  } catch (err) {
    console.error("getFeaturedCompetition failed:", err);
    return null;
  }
}
```
Notes: the `status == "scheduled"` + `orderBy("date")` query is covered by the existing `comp_matches (status, date)` composite index (added earlier). `toCompMatch`/`toCompetition` produce plain objects (ISO dates) — safe as client props.

**Step 2: Verify.** `npm run build` → exit 0. `npx eslint src/lib/competition-admin.ts` → exit 0. (No runtime call yet; consumed in Tasks 3-4.)

**Step 3: Commit.**
```bash
git add src/lib/competition-admin.ts
git commit -m "feat(competition): server lib for public competition discovery"
```

---

### Task 3: Public directory page `/competitions`

**Files:**
- Create: `src/app/competitions/page.tsx` (Server Component)
- Create: `src/components/competition/CompetitionDirectoryCard.tsx` (presentational; can be a Server Component)
- Create: `src/components/competition/CompetitionDirectorySearch.tsx` (`"use client"` filter island)

**Step 1: Card component.** `CompetitionDirectoryCard({ competition }: { competition: Competition })` — banner/logo (use plain `<img>` for organizer-entered logos — NOT `next/image` — with `// eslint-disable-next-line @next/next/no-img-element`, matching how organizer-entered logos are handled elsewhere), name, a status badge (🟢 En cours for group_stage|knockout, 🔵 À venir for registration, ⚪ Terminée for completed), date range, `venueCity`. Whole card is a `<Link href={\`/c/${competition.slug}\`}>`. Mirror the rounded-card styling of the `/c` pages.

**Step 2: Search island.** `CompetitionDirectorySearch({ competitions }: { competitions: Competition[] })` — `"use client"`. A text input; filters `competitions` by `name`/`venueCity` (case-insensitive). Renders the matching `CompetitionDirectoryCard`s grouped into "En cours" / "À venir" / "Terminées" sections (hide empty sections). When the query is empty it shows everything. This island owns the grouped rendering so search + grouping stay consistent.

**Step 3: Page.** `src/app/competitions/page.tsx`:
```tsx
export const revalidate = 60;
export const metadata = {
  title: "Compétitions — Koppafoot",
  description: "Découvre et suis les compétitions de football amateur en direct sur Koppafoot.",
};
```
`export default async function CompetitionsPage()` → `const competitions = await getPublicCompetitions();`. Render: a light public header (logo `→ /`, a "Rejoindre" `→ /signup` CTA — a small inline header, NOT `LandingNav`), a hero strip ("Compétitions" + total count), then `<CompetitionDirectorySearch competitions={competitions} />`. Empty state when `competitions.length === 0` (friendly message + signup CTA).

**Step 4: Verify.** `npm run build` → exit 0; route `/competitions` present. `npx eslint` on the 3 files → exit 0. Manual: `npm run dev`, visit `/competitions` **logged out** — the Miabé CAN appears under its status group; search filters; cards link to `/c/[slug]`.

**Step 5: Commit.**
```bash
git add "src/app/competitions/page.tsx" src/components/competition/CompetitionDirectoryCard.tsx src/components/competition/CompetitionDirectorySearch.tsx
git commit -m "feat(competition): public /competitions directory page"
```

---

### Task 4: Landing refonte (hero spotlight + teaser + reorder)

**Files:**
- Create: `src/components/landing/HeroSpotlight.tsx` (`"use client"`, props from server)
- Create: `src/components/landing/CompetitionsTeaser.tsx` (`"use client"`, props from server)
- Modify: `src/app/page.tsx` (async Server Component; reorder; fetch + props)
- Modify: `src/components/landing/LandingNav.tsx` (add "Compétitions" link)

**Step 1: HeroSpotlight.** Props: `{ featured: { competition: Competition; highlightMatch: CompMatch | null } | null }`.
- If `featured == null` → render the **existing brand hero** (copy the markup from `src/components/landing/HeroSection.tsx`: stadium bg, "Le foot amateur en mieux", `/signup` CTA). This is the graceful pre-launch / fetch-error fallback.
- Else → competition spotlight: background = `competition.bannerUrl` (plain `<img>`, fallback to the stadium image); a glassy card with logo + name + status badge; then:
  - `highlightMatch?.status === "live"` → mini scoreboard (`homeTeamName` `scoreHome`–`scoreAway` `awayTeamName`) + pulsing "EN DIRECT" → primary CTA "Suivre le direct" `→ /c/${slug}/matches/${highlightMatch.id}`;
  - else if `highlightMatch` (scheduled) → "Prochain match" + teams + date/time → primary CTA "Voir la compétition" `→ /c/${slug}`;
  - else → primary CTA "Voir la compétition" `→ /c/${slug}`.
  - secondary CTA "Rejoindre Koppafoot" `→ /signup`.
- Keep `motion` entrance animations like the current hero.

**Step 2: CompetitionsTeaser.** Props: `{ competitions: Competition[] }`.
- If `competitions.length <= 1` → a slim band: "Découvre toutes les compétitions" + button `→ /competitions` (no duplicate of the hero's competition).
- Else → a heading ("À la une") + a row of up to 3 `CompetitionDirectoryCard`s (reuse the Task 3 card) + "Voir toutes les compétitions →" `→ /competitions`.

**Step 3: Reorder `src/app/page.tsx`.** Make it `async`:
```tsx
export const revalidate = 60;

export default async function Home() {
  const [featured, competitions] = await Promise.all([
    getFeaturedCompetition(),
    getPublicCompetitions(),
  ]);
  return (
    <>
      <LandingNav />
      <HeroSpotlight featured={featured} />
      <CompetitionsTeaser competitions={competitions} />
      <RolesSection />
      <FeaturesSection />
      <StatsSection />
      <CTASection />
      <LandingFooter />
    </>
  );
}
```
Remove the `HeroSection` and `FanSection` imports/usages (leave the files in place, just unused). Import `getFeaturedCompetition`/`getPublicCompetitions` from `@/lib/competition-admin` and the two new components.

**Step 4: LandingNav.** Add a "Compétitions" link `→ /competitions` (a real `<Link>`, not a `#` anchor) in both the desktop links group and the mobile menu, before the auth CTAs.

**Step 5: Verify.** `npm run build` → exit 0 (confirm `/` still prerenders; with `revalidate` it's ISR). `npx eslint` on changed/new files → exit 0. Manual: `npm run dev`, load `/` logged out — the Miabé CAN spotlight shows (live scoreboard if a match is live, else next match, else CTA); teaser/band links to `/competitions`; nav has "Compétitions"; Roles/Features/Stats/CTA still render below. Temporarily rename/hide the competition (set status `draft` via the organizer) to confirm the hero falls back to the brand hero with no crash.

**Step 6: Commit.**
```bash
git add "src/app/page.tsx" src/components/landing/HeroSpotlight.tsx src/components/landing/CompetitionsTeaser.tsx src/components/landing/LandingNav.tsx
git commit -m "feat(competition): competition-first landing (hero spotlight + teaser)"
```

---

## Notes for the executor
- `firebase-admin` only in `competition-admin.ts` + Server Components. If a client component needs competition data, it must come via props from a server parent (as designed) — do NOT import `competition-admin` into a `"use client"` file.
- All organizer-entered logos/banners render with plain `<img>` (never `next/image`) — they're arbitrary URLs. (A separate task already tracks removing the `next.config` wildcard once all crests use `<img>`.)
- Build-time prerender calls the admin fns; they catch errors and return `[]`/`null`, so a build without Firestore access degrades to the brand hero / empty directory rather than failing. Admin creds come from `.env.local` (local) / env vars (Vercel).
- Keep diffs presentational-only where possible; reuse `/c` card styling. DRY: the directory card is reused by the landing teaser.
```
