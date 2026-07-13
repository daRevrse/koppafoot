/**
 * KOPPAFOOT — Set up + simulate the "Coupe 2" test competition.
 *
 * - assigns the 8 teams to 2 poules (A: FC 1-4, B: FC 5-8)
 * - fills every team with 25 players (GK/DEF/MID/FWD)
 * - flips the competition to group_stage
 * - generates the round-robin (6 matches per group, 12 total)
 * - simulates every group match EXCEPT the last of each group (2 left
 *   unplayed) with realistic scores + goal events (real player ids, so
 *   standings and top scorers populate)
 *
 * Idempotent-ish: reuses existing group matches; re-running re-simulates.
 * Usage: npx tsx scripts/setup-sim-coupe2.ts
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const rid = () => Math.random().toString(36).slice(2, 11);
const rint = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const FIRST = ["Kossi", "Yao", "Koffi", "Edem", "Komi", "Ayi", "Selom", "Kodjo", "Mensah", "Amine", "Ibrahim", "Moussa", "Serge", "David", "Emmanuel", "Prince", "Rachid", "Kevin", "Josué", "Élie", "Franck", "Boris", "Cédric", "Aymar", "Junior"];
const LAST = ["Mensah", "Adjovi", "Agbeko", "Doe", "Sossou", "Lawson", "Kponton", "Amégan", "Bawa", "Tepe", "Johnson", "Diallo", "Traoré", "Koné", "Bakary", "Ouedraogo", "Nkurunziza", "Okafor", "Eyram", "Gnassingbe"];

interface Player { id: string; name: string; number: string; position: string }

function makeRoster(): Player[] {
  // 25 players: 3 GK, 8 DEF, 8 MID, 6 FWD
  const layout = [
    ...Array(3).fill("goalkeeper"),
    ...Array(8).fill("defender"),
    ...Array(8).fill("midfielder"),
    ...Array(6).fill("forward"),
  ];
  return layout.map((position, i) => ({
    id: rid(),
    name: `${pick(FIRST)} ${pick(LAST)}`,
    number: String(i + 1),
    position,
  }));
}

// Weight goals toward forwards/midfielders.
function scorer(roster: Player[]): Player {
  const attackers = roster.filter((p) => p.position === "forward" || p.position === "midfielder");
  return Math.random() < 0.85 && attackers.length > 0 ? pick(attackers) : pick(roster.filter((p) => p.position !== "goalkeeper"));
}

// Standard circle-method round robin for 4 team ids.
function roundRobin(ids: string[]): [string, string][] {
  const arr = [...ids];
  const n = arr.length;
  const out: [string, string][] = [];
  const rot = [...arr];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) out.push([rot[i], rot[n - 1 - i]]);
    rot.splice(1, 0, rot.pop() as string);
  }
  return out;
}

function goalEvents(teamId: string, roster: Player[], count: number) {
  const minutes = Array.from({ length: count }, () => rint(1, 90)).sort((a, b) => a - b);
  return minutes.map((minute) => {
    const p = scorer(roster);
    return {
      id: rid(),
      type: "goal" as const,
      period: minute <= 45 ? 1 : 3,
      minute,
      team_id: teamId,
      player_id: p.id,
      player_name: p.name,
      created_at: new Date().toISOString(),
    };
  });
}

async function main() {
  const comps = await db.collection("competitions").get();
  const target = comps.docs.find((c) => (c.data().name ?? "").toLowerCase().includes("coupe 2"));
  if (!target) { console.error("❌ Coupe 2 introuvable"); process.exit(1); }
  const cref = target.ref;
  console.log("Coupe 2:", cref.id);

  // 1. Teams → assign groups (FC 1-4 = A, FC 5-8 = B) + fill 25 players.
  const teamsSnap = await cref.collection("comp_teams").get();
  const teams = teamsSnap.docs
    .map((d) => ({ id: d.id, name: d.data().name as string, ref: d.ref }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));

  const rosters = new Map<string, Player[]>();
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const group = i < 4 ? "A" : "B";
    const roster = makeRoster();
    rosters.set(t.id, roster);
    await t.ref.update({ group, players: roster, updated_at: FieldValue.serverTimestamp() });
  }
  const groupOf = new Map(teams.map((t, i) => [t.id, i < 4 ? "A" : "B"]));
  console.log("Poules assignées + 25 joueurs/équipe.");

  // 2. Competition → group_stage (visible publicly).
  await cref.update({ status: "group_stage", updated_at: FieldValue.serverTimestamp() });

  // 3. Round-robin fixtures per group (skip if group matches already exist).
  const existing = await cref.collection("comp_matches").where("stage", "==", "group").get();
  let matchDocs = existing.docs;
  if (matchDocs.length === 0) {
    const A = teams.filter((t) => groupOf.get(t.id) === "A").map((t) => t.id);
    const B = teams.filter((t) => groupOf.get(t.id) === "B").map((t) => t.id);
    const byId = new Map(teams.map((t) => [t.id, t]));
    const batch = db.batch();
    const created: FirebaseFirestore.DocumentReference[] = [];
    for (const [group, ids] of [["A", A], ["B", B]] as [string, string[]][]) {
      for (const [h, a] of roundRobin(ids)) {
        const ref = cref.collection("comp_matches").doc();
        created.push(ref);
        batch.set(ref, {
          competition_id: cref.id, stage: "group", group, round: null, bracket_slot: null,
          home_team_id: h, away_team_id: a,
          home_team_name: byId.get(h)!.name, away_team_name: byId.get(a)!.name,
          home_team_logo: null, away_team_logo: null, banner_url: null,
          date: null, time: null, venue_name: null, venue_city: null,
          status: "scheduled", score_home: null, score_away: null,
          penalty_home: null, penalty_away: null, winner_team_id: null,
          feeds_into_match_id: null, feeds_into_slot: null, live_state: null,
          created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();
    console.log(`${created.length} matchs de poule générés (round-robin).`);
    const refreshed = await cref.collection("comp_matches").where("stage", "==", "group").get();
    matchDocs = refreshed.docs;
  } else {
    console.log(`${matchDocs.length} matchs de poule déjà présents — réutilisés.`);
  }

  // 4. Leave the LAST match of each group unplayed; simulate the rest.
  const byGroup = new Map<string, typeof matchDocs>();
  for (const m of matchDocs) {
    const g = m.data().group ?? "—";
    if (!byGroup.has(g)) byGroup.set(g, [] as typeof matchDocs);
    byGroup.get(g)!.push(m);
  }
  const leaveUnplayed = new Set<string>();
  for (const [, list] of byGroup) {
    if (list.length > 0) leaveUnplayed.add(list[list.length - 1].id); // one per group
  }

  let simulated = 0;
  for (const m of matchDocs) {
    if (leaveUnplayed.has(m.id)) continue;
    const d = m.data();
    const homeId = d.home_team_id as string;
    const awayId = d.away_team_id as string;
    const sh = Math.random() < 0.15 ? 0 : rint(0, 4);
    const sa = Math.random() < 0.15 ? 0 : rint(0, 4);
    const events = [
      ...goalEvents(homeId, rosters.get(homeId) ?? [], sh),
      ...goalEvents(awayId, rosters.get(awayId) ?? [], sa),
    ].sort((a, b) => a.minute - b.minute);

    await m.ref.update({
      status: "completed",
      score_home: sh,
      score_away: sa,
      winner_team_id: sh > sa ? homeId : sa > sh ? awayId : null,
      live_state: {
        current_period: 4,
        timer_start_at: null,
        timer_offset: 5_400_000,
        is_timer_running: false,
        events,
      },
      updated_at: FieldValue.serverTimestamp(),
    });
    simulated += 1;
  }

  console.log(`\n✅ ${simulated} matchs simulés · ${leaveUnplayed.size} laissés à jouer (1 par poule).`);
  console.log(`   Public : /c/${target.data().slug}`);
  process.exit(0);
}

main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
