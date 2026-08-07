/**
 * KOPPAFOOT — Backfill `evolution_role` on accounts predating /evolution.
 *
 * Why: since the pivot every account is created with `user_type: "player"`,
 * so that field no longer says anything about what someone actually does.
 * The mercato and the role spaces key off `evolution_role` instead — but
 * accounts created before /evolution existed have no such field, and would
 * silently vanish from the market.
 *
 * This does NOT set the role on everyone: doing that would put every
 * spectator back into the mercato and undo the fix. A role is inferred only
 * from evidence:
 *
 *   manager — owns at least one team (teams.manager_id)
 *   player  — is on a team roster (teams.member_ids), or has filled a
 *             sport-specific field (position / strong_foot / skill_level),
 *             or already holds a validated competition roster line
 *
 * Accounts with neither stay untouched: they are spectators until they
 * activate a space themselves. Organizers and superadmins keep their
 * user_type; only evolution_role is written.
 *
 * Dry run by default — nothing is written without --apply.
 *
 * Usage:
 *   npx tsx scripts/backfill-evolution-role.ts            # report only
 *   npx tsx scripts/backfill-evolution-role.ts --apply    # write
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

const APPLY = process.argv.includes("--apply");

type Role = "player" | "manager";

async function main() {
  console.log(`\n=== Backfill evolution_role ${APPLY ? "(ÉCRITURE)" : "(DRY RUN)"} ===\n`);

  // Team memberships tell us who plays and who manages.
  const teamsSnap = await db.collection("teams").get();
  const managerIds = new Set<string>();
  const memberIds = new Set<string>();
  for (const doc of teamsSnap.docs) {
    const t = doc.data();
    if (t.manager_id) managerIds.add(t.manager_id as string);
    for (const uid of (t.member_ids ?? []) as string[]) memberIds.add(uid);
  }
  console.log(`Équipes lues : ${teamsSnap.size} — ${managerIds.size} manager(s), ${memberIds.size} membre(s)\n`);

  const usersSnap = await db.collection("users").get();

  const planned: { uid: string; name: string; role: Role; reason: string }[] = [];
  let alreadySet = 0;
  let noEvidence = 0;

  for (const doc of usersSnap.docs) {
    const u = doc.data();
    if (u.evolution_role) {
      alreadySet += 1;
      continue;
    }

    const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || doc.id;

    let role: Role | null = null;
    let reason = "";

    if (managerIds.has(doc.id)) {
      role = "manager";
      reason = "gère une équipe";
    } else if (memberIds.has(doc.id)) {
      role = "player";
      reason = "membre d'une équipe";
    } else if (Array.isArray(u.linked_comp_players) && u.linked_comp_players.length > 0) {
      role = "player";
      reason = "rattaché à un effectif de compétition";
    } else if (u.position || u.strong_foot || u.skill_level) {
      role = "player";
      reason = "profil sportif renseigné";
    }

    if (!role) {
      noEvidence += 1;
      continue;
    }
    planned.push({ uid: doc.id, name, role, reason });
  }

  console.log(`Comptes lus            : ${usersSnap.size}`);
  console.log(`Déjà renseignés        : ${alreadySet}`);
  console.log(`Sans indice (ignorés)  : ${noEvidence}`);
  console.log(`À mettre à jour        : ${planned.length}\n`);

  for (const p of planned) {
    console.log(`  ${p.role.padEnd(7)} ${p.name.padEnd(28)} ${p.reason}`);
  }

  if (planned.length === 0) {
    console.log("\nRien à faire.");
    return;
  }

  if (!APPLY) {
    console.log("\nDRY RUN — relance avec --apply pour écrire.");
    return;
  }

  // Firestore caps a batch at 500 writes.
  let written = 0;
  for (let i = 0; i < planned.length; i += 450) {
    const batch = db.batch();
    for (const p of planned.slice(i, i + 450)) {
      batch.update(db.collection("users").doc(p.uid), {
        evolution_role: p.role,
        updated_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += Math.min(450, planned.length - i);
    console.log(`\n… ${written}/${planned.length} écrits`);
  }

  console.log(`\n✓ ${written} compte(s) mis à jour.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nFATAL", e);
    process.exit(1);
  });
