/**
 * KOPPAFOOT — Seed the Miabé CAN 2026 competition (dev/ops helper).
 *
 * Usage:
 *   npx tsx scripts/seed-miabe-can.ts [organizer-email]
 *
 * Creates the competition (slug: miabe-can-2026), its 20 national teams
 * in poules A–E, and the 30 group-stage matches from the official
 * schedule (24 July – 9 August 2026, Haady Parc, Lomé, GMT times).
 *
 * Idempotent: aborts if the slug already exists. The organizer email
 * (default: gassougilles07@gmail.com) must have an account — its uid
 * becomes created_by / organizer_ids[0].
 *
 * Uses firebase-admin (bypasses security rules — run locally).
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const ORGANIZER_EMAIL = process.argv[2] ?? "gassougilles07@gmail.com";
const SLUG = "miabe-can-2026";
const VENUE = "Haady Parc";
const CITY = "Lomé";

// ---- Teams: [name, shortName, group, color] --------------------------------

const TEAMS: [string, string, string, string][] = [
  ["Mali", "MLI", "A", "#0CB04A"],
  ["Guinée", "GUI", "A", "#CE1126"],
  ["Burkina Faso", "BFA", "A", "#009E49"],
  ["Congo Brazzaville", "CGO", "A", "#FBDE4A"],
  ["Tchad", "TCD", "B", "#002664"],
  ["Niger", "NIG", "B", "#E05206"],
  ["Gambie", "GAM", "B", "#3A7728"],
  ["Comores", "COM", "B", "#3D8E33"],
  ["Afrique du Sud", "RSA", "C", "#007A4D"],
  ["Nigeria", "NGA", "C", "#008751"],
  ["Guinée Équatoriale", "GEQ", "C", "#3E9A00"],
  ["Cameroun", "CMR", "C", "#007A5E"],
  ["Ghana", "GHA", "D", "#CE1126"],
  ["Bénin", "BEN", "D", "#008751"],
  ["Gabon", "GAB", "D", "#3A75C4"],
  ["Maroc", "MAR", "D", "#C1272D"],
  ["Sierra Leone", "SLE", "E", "#1EB53A"],
  ["Côte d'Ivoire", "CIV", "E", "#F77F00"],
  ["Togo", "TOG", "E", "#006A4E"],
  ["Reste d'Afrique (RDA)", "RDA", "E", "#009639"],
];

// ---- Group-stage schedule: [date, time, home, away, group] -----------------
// Official poster — all times GMT, Haady Parc.

const MATCHES: [string, string, string, string, string][] = [
  // Vendredi 24-07
  ["2026-07-24", "20:00", "Mali", "Guinée", "A"],
  // Samedi 25-07
  ["2026-07-25", "19:30", "Congo Brazzaville", "Burkina Faso", "A"],
  ["2026-07-25", "21:30", "Tchad", "Niger", "B"],
  // Dimanche 26-07
  ["2026-07-26", "19:00", "Comores", "Gambie", "B"],
  ["2026-07-26", "21:00", "Afrique du Sud", "Cameroun", "C"],
  // Mardi 28-07
  ["2026-07-28", "19:30", "Nigeria", "Guinée Équatoriale", "C"],
  ["2026-07-28", "21:30", "Togo", "Sierra Leone", "E"],
  // Mercredi 29-07
  ["2026-07-29", "19:30", "Ghana", "Gabon", "D"],
  ["2026-07-29", "21:30", "Côte d'Ivoire", "Reste d'Afrique (RDA)", "E"],
  // Jeudi 30-07
  ["2026-07-30", "19:30", "Bénin", "Maroc", "D"],
  ["2026-07-30", "21:30", "Mali", "Burkina Faso", "A"],
  // Vendredi 31-07
  ["2026-07-31", "19:30", "Congo Brazzaville", "Guinée", "A"],
  ["2026-07-31", "21:30", "Niger", "Comores", "B"],
  // Samedi 01-08
  ["2026-08-01", "19:00", "Tchad", "Gambie", "B"],
  ["2026-08-01", "21:00", "Togo", "Côte d'Ivoire", "E"],
  // Dimanche 02-08
  ["2026-08-02", "19:00", "Afrique du Sud", "Nigeria", "C"],
  ["2026-08-02", "21:00", "Reste d'Afrique (RDA)", "Sierra Leone", "E"],
  // Mercredi 05-08
  ["2026-08-05", "19:30", "Guinée Équatoriale", "Cameroun", "C"],
  ["2026-08-05", "21:30", "Ghana", "Maroc", "D"],
  // Jeudi 06-08
  ["2026-08-06", "19:30", "Bénin", "Gabon", "D"],
  ["2026-08-06", "21:30", "Mali", "Congo Brazzaville", "A"],
  // Vendredi 07-08
  ["2026-08-07", "19:30", "Guinée", "Burkina Faso", "A"],
  ["2026-08-07", "21:30", "Tchad", "Comores", "B"],
  // Samedi 08-08
  ["2026-08-08", "16:00", "Afrique du Sud", "Guinée Équatoriale", "C"],
  ["2026-08-08", "18:00", "Cameroun", "Nigeria", "C"],
  ["2026-08-08", "20:00", "Bénin", "Ghana", "D"],
  ["2026-08-08", "21:30", "Togo", "Reste d'Afrique (RDA)", "E"],
  // Dimanche 09-08
  ["2026-08-09", "16:00", "Gabon", "Maroc", "D"],
  ["2026-08-09", "18:00", "Sierra Leone", "Côte d'Ivoire", "E"],
  ["2026-08-09", "20:00", "Niger", "Gambie", "B"],
];

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  const auth = getAuth(app);
  const db = getFirestore(app);

  // Sanity: schedule must be a full double check
  if (TEAMS.length !== 20) throw new Error(`Expected 20 teams, got ${TEAMS.length}`);
  if (MATCHES.length !== 30) throw new Error(`Expected 30 matches, got ${MATCHES.length}`);
  const names = new Set(TEAMS.map(([n]) => n));
  for (const [, , home, away] of MATCHES) {
    if (!names.has(home)) throw new Error(`Unknown home team: ${home}`);
    if (!names.has(away)) throw new Error(`Unknown away team: ${away}`);
  }

  // Idempotence: abort if slug exists
  const existing = await db.collection("competitions").where("slug", "==", SLUG).limit(1).get();
  if (!existing.empty) {
    console.log(`ℹ️  La compétition "${SLUG}" existe déjà (${existing.docs[0].id}). Rien à faire.`);
    process.exit(0);
  }

  // Organizer uid
  console.log(`🔍 Organisateur: ${ORGANIZER_EMAIL}...`);
  const organizer = await auth.getUserByEmail(ORGANIZER_EMAIL).catch(() => null);
  if (!organizer) {
    console.error(`❌ Aucun compte pour "${ORGANIZER_EMAIL}". Crée le compte d'abord.`);
    process.exit(1);
  }
  console.log(`✅ uid: ${organizer.uid}`);

  const now = FieldValue.serverTimestamp();

  // 1. Competition
  const compRef = db.collection("competitions").doc();
  const batch = db.batch();
  batch.set(compRef, {
    name: "Miabé CAN 2026",
    slug: SLUG,
    description:
      "La CAN du quartier — 20 équipes, 5 poules, du 24 juillet au 9 août 2026 au Haady Parc de Lomé. #MIABE_CAN",
    logo_url: null,
    banner_url: null,
    organizer_ids: [organizer.uid],
    moderator_ids: [],
    created_by: organizer.uid,
    status: "registration",
    format: {
      group_count: 5,
      teams_per_group: 4,
      qualifiers_per_group: 2,
      has_third_place: true,
      points: { win: 3, draw: 1, loss: 0 },
    },
    start_date: "2026-07-24",
    end_date: "2026-08-09",
    venue_city: CITY,
    created_at: now,
    updated_at: now,
  });

  // 2. Teams
  const teamIdByName = new Map<string, string>();
  for (const [name, shortName, group, color] of TEAMS) {
    const ref = compRef.collection("comp_teams").doc();
    teamIdByName.set(name, ref.id);
    batch.set(ref, {
      name,
      short_name: shortName,
      logo_url: null,
      color,
      group,
      players: [],
      created_at: now,
      updated_at: now,
    });
  }

  // 3. Group-stage matches
  for (const [date, time, home, away, group] of MATCHES) {
    const ref = compRef.collection("comp_matches").doc();
    batch.set(ref, {
      competition_id: compRef.id,
      stage: "group",
      group,
      round: null,
      bracket_slot: null,
      home_team_id: teamIdByName.get(home),
      away_team_id: teamIdByName.get(away),
      home_team_name: home,
      away_team_name: away,
      home_team_logo: null,
      away_team_logo: null,
      date,
      time,
      venue_name: VENUE,
      venue_city: CITY,
      status: "scheduled",
      score_home: null,
      score_away: null,
      penalty_home: null,
      penalty_away: null,
      winner_team_id: null,
      feeds_into_match_id: null,
      feeds_into_slot: null,
      live_state: null,
      created_at: now,
      updated_at: now,
    });
  }

  await batch.commit();

  console.log(`\n🎉 Miabé CAN 2026 créée !`);
  console.log(`   Compétition: ${compRef.id} (slug: ${SLUG}, statut: registration)`);
  console.log(`   Équipes: ${TEAMS.length} (poules A–E) · Matchs: ${MATCHES.length}`);
  console.log(`   Publique sur /c/${SLUG} et sur la home.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur:", err.message);
  process.exit(1);
});
