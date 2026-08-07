/**
 * KOPPAFOOT — End-to-end test of the competition registration flow.
 *
 * Hits the REAL API routes over HTTP with REAL Firebase ID tokens, so it
 * exercises the deployed code path including authorization — not a
 * simulation against Firestore.
 *
 *   1. open a competition for entries (status -> registration)
 *   2. the manager registers their club          POST   /registrations
 *   3. the organizer accepts                     PATCH  /registrations
 *   4. verify: comp_team created, squad imported, user_id on the real
 *      member, and linked_comp_players written on that member's own doc
 *
 * Usage:
 *   npx tsx scripts/test-registration-flow.ts <competitionId> <clubId>
 *   npx tsx scripts/test-registration-flow.ts <competitionId> <clubId> --cleanup
 *
 * --cleanup removes what the run created (registration + comp_team + the
 * linked_comp_players rows) and puts the competition status back.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
const auth = getAuth(app);

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;

const [cid, clubId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const CLEANUP = process.argv.includes("--cleanup");

/** Custom token -> ID token, the same exchange the web SDK performs. */
async function idTokenFor(uid: string): Promise<string> {
  const custom = await auth.createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`Échange de jeton impossible : ${JSON.stringify(data)}`);
  return data.idToken as string;
}

function ok(label: string, pass: boolean, detail = "") {
  console.log(`  ${pass ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  if (!cid || !clubId) {
    console.error("Usage: npx tsx scripts/test-registration-flow.ts <competitionId> <clubId>");
    process.exit(1);
  }

  const [compSnap, clubSnap] = await Promise.all([
    db.collection("competitions").doc(cid).get(),
    db.collection("teams").doc(clubId).get(),
  ]);
  if (!compSnap.exists) throw new Error("Compétition introuvable");
  if (!clubSnap.exists) throw new Error("Club introuvable");

  const comp = compSnap.data()!;
  const club = clubSnap.data()!;
  const organizerUid = (comp.organizer_ids ?? [])[0];
  const managerUid = club.manager_id as string;
  const originalStatus = comp.status as string;

  console.log(`\nCompétition : ${comp.name} (${cid})`);
  console.log(`Club        : ${club.name} (${clubId})`);
  console.log(`Manager     : ${managerUid}`);
  console.log(`Organisateur: ${organizerUid}\n`);

  if (CLEANUP) {
    console.log("=== NETTOYAGE ===");
    const regs = await db
      .collection("competition_registrations")
      .where("competition_id", "==", cid)
      .where("club_id", "==", clubId)
      .get();
    for (const d of regs.docs) {
      const teamId = d.data().comp_team_id as string | undefined;
      if (teamId) {
        const t = await db.collection("competitions").doc(cid)
          .collection("comp_teams").doc(teamId).get();
        for (const p of (t.data()?.players ?? []) as { user_id?: string | null }[]) {
          if (!p.user_id) continue;
          const uSnap = await db.collection("users").doc(p.user_id).get();
          const links = (uSnap.data()?.linked_comp_players ?? []) as { team_id: string }[];
          await uSnap.ref.update({
            linked_comp_players: links.filter((l) => l.team_id !== teamId),
          });
        }
        await t.ref.delete();
        console.log(`  équipe ${teamId} supprimée + liens retirés`);
      }
      await d.ref.delete();
      console.log(`  inscription ${d.id} supprimée`);
    }
    await compSnap.ref.update({ status: originalStatus === "registration" ? "draft" : originalStatus });
    console.log(`  statut remis à ${originalStatus === "registration" ? "draft" : originalStatus}`);
    return;
  }

  // ── 1. Open for entries ──────────────────────────────────
  console.log("=== 1. Ouverture des inscriptions ===");
  await compSnap.ref.update({ status: "registration" });
  ok("statut passé à registration", true);

  const [managerToken, organizerToken] = await Promise.all([
    idTokenFor(managerUid),
    idTokenFor(organizerUid),
  ]);

  // ── 2. Manager registers ─────────────────────────────────
  console.log("\n=== 2. Le manager inscrit son club ===");
  let res = await fetch(`${BASE}/api/competitions/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerToken}` },
    body: JSON.stringify({ cid, clubId, message: "Test automatisé" }),
  });
  let data = await res.json();
  ok(`POST /registrations -> ${res.status}`, res.ok, JSON.stringify(data).slice(0, 120));
  if (!res.ok) return;
  const regId = data.id as string;

  // Duplicate must be refused.
  res = await fetch(`${BASE}/api/competitions/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${managerToken}` },
    body: JSON.stringify({ cid, clubId }),
  });
  ok("doublon refusé (409)", res.status === 409);

  // ── 3. Organizer sees it and accepts ─────────────────────
  console.log("\n=== 3. L'organisateur valide ===");
  res = await fetch(`${BASE}/api/competitions/registrations?cid=${cid}`, {
    headers: { Authorization: `Bearer ${organizerToken}` },
  });
  data = await res.json();
  ok("l'organisateur voit la demande", (data.registrations ?? []).some((r: { id: string }) => r.id === regId));

  // A stranger must not.
  res = await fetch(`${BASE}/api/competitions/registrations?cid=${cid}`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  ok("un non-organisateur est refusé (403)", res.status === 403);

  res = await fetch(`${BASE}/api/competitions/registrations`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${organizerToken}` },
    body: JSON.stringify({ id: regId, action: "accept" }),
  });
  data = await res.json();
  ok(`PATCH accept -> ${res.status}`, res.ok, JSON.stringify(data).slice(0, 160));
  if (!res.ok) return;
  const teamId = data.teamId as string;

  // ── 4. Verify the resulting state ────────────────────────
  console.log("\n=== 4. Vérification de l'état ===");
  const teamSnap = await db.collection("competitions").doc(cid)
    .collection("comp_teams").doc(teamId).get();
  ok("équipe de compétition créée", teamSnap.exists);

  const team = teamSnap.data()!;
  const players = (team.players ?? []) as { id: string; name: string; user_id?: string | null }[];
  const memberCount = (club.member_ids ?? []).length;
  const ghostCount = (await clubSnap.ref.collection("ghost_players").get()).size;

  ok(
    `effectif importé : ${players.length} (attendu ${memberCount + ghostCount})`,
    players.length === memberCount + ghostCount,
  );
  ok("club rattaché (claimed_by_team_id)", team.claimed_by_team_id === clubId);
  ok("manager rattaché", team.claimed_by_manager_id === managerUid);

  const linked = players.filter((p) => p.user_id);
  ok(`comptes rattachés sur l'effectif : ${linked.length} (attendu ${memberCount})`, linked.length === memberCount);

  // The half that used to be missing.
  let linksOk = 0;
  for (const p of linked) {
    const uSnap = await db.collection("users").doc(p.user_id!).get();
    const links = (uSnap.data()?.linked_comp_players ?? []) as { team_id: string }[];
    if (links.some((l) => l.team_id === teamId)) linksOk += 1;
  }
  ok(`linked_comp_players écrit côté joueur : ${linksOk}/${linked.length}`, linksOk === linked.length);

  const ghosts = players.filter((p) => p.id.startsWith("ghost_"));
  ok(`joueurs fantômes repris : ${ghosts.length} (attendu ${ghostCount})`, ghosts.length === ghostCount);

  console.log("\nRelance avec --cleanup pour effacer ce que ce test a créé.");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("\nFATAL", e.message);
    process.exit(1);
  });
