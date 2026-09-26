// Actions « équipe KoppaFoot » simulées sur les émulateurs.
import { createRequire } from "node:module";
// firebase-admin est celui de l'application (package.json à la racine du dépôt).
const require = createRequire(new URL("../../../package.json", import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const app = getApps()[0] ?? initializeApp({ projectId: "demo-koppafoot" });
export const auth = getAuth(app);
export const db = getFirestore(app);
export { FieldValue };
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export async function ensureAdmin() {
  const email = "equipe@koppafoot.example";
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch { u = await auth.createUser({ email, password: "Admin2026!", displayName: "Équipe KoppaFoot", emailVerified: true }); }
  await db.collection("users").doc(u.uid).set({
    email, first_name: "Équipe", last_name: "KoppaFoot", user_type: "superadmin", is_superadmin: true,
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { uid: u.uid, email, password: "Admin2026!" };
}

export async function idToken(email, password) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}

export async function approveAllPending() {
  const admin = await ensureAdmin();
  const token = await idToken(admin.email, admin.password);
  const snap = await db.collection("organizer_applications").where("status", "==", "pending").get();
  for (const d of snap.docs) {
    const r = await fetch(`${BASE}/api/organizer-applications/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "approve" }),
    });
    console.log("approve", d.id, r.status, await r.text());
  }
}

export async function verifyEmail(email) {
  const u = await auth.getUserByEmail(email);
  await auth.updateUser(u.uid, { emailVerified: true });
}

if (process.argv[2] === "approve") await approveAllPending();
if (process.argv[2] === "verify") await verifyEmail(process.argv[3]);

/** Place le chrono d'un match en cours à `minutes` écoulées (chrono lancé). */
export async function setClock(cid, mid, minutes) {
  const ref = db.doc(`competitions/${cid}/comp_matches/${mid}`);
  const ls = (await ref.get()).data().live_state ?? {};
  const offset = ls.timer_offset || 0;
  const start = new Date(Date.now() - minutes * 60000 + offset);
  await ref.update({ "live_state.timer_start_at": start.toISOString(), "live_state.is_timer_running": true });
}

/** Un compte joueur, comme une inscription avec le rôle « joueur ». */
export async function createPlayer({ first, last, email, position, skill = "amateur", city = "Lomé", bio }) {
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch { u = await auth.createUser({ email, password: "Joueur2026!", displayName: `${first} ${last}`, emailVerified: true }); }
  await db.collection("users").doc(u.uid).set({
    email, phone: null, first_name: first, last_name: last, user_type: "user",
    location_city: city, profile_picture_url: null, cover_photo_url: null, is_active: true,
    auth_providers: ["email"], evolution_role: "player", position, skill_level: skill,
    ...(bio ? { bio } : {}),
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  return u.uid;
}

/** Des joueurs sans compte (joueurs « fantômes ») dans une équipe. */
export async function addGhostPlayers(teamId, list) {
  const col = db.collection(`teams/${teamId}/ghost_players`);
  for (const [first, last, position, num] of list) {
    await col.add({
      first_name: first, last_name: last, position, squad_number: num == null ? null : String(num),
      matches_played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0,
      created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
    });
  }
}

/** Même chose pour un match amical (`matches/{id}`). */
export async function setClockAmical(mid, minutes) {
  const ref = db.doc(`matches/${mid}`);
  const ls = (await ref.get()).data().live_state ?? {};
  const offset = ls.timer_offset || 0;
  const start = new Date(Date.now() - minutes * 60000 + offset);
  await ref.update({ "live_state.timer_start_at": start.toISOString(), "live_state.is_timer_running": true });
}

/**
 * Une compétition ouverte aux inscriptions, et son organisateur.
 * Tout ce que le guide organisateur construit à la main : ici, c'est le décor.
 */
export async function createOpenCompetition() {
  const email = "kossi.mensah@example.com";
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch { u = await auth.createUser({ email, password: "Coupe2026!", displayName: "Kossi Mensah", emailVerified: true }); }
  await db.collection("users").doc(u.uid).set({
    email, phone: null, first_name: "Kossi", last_name: "Mensah", user_type: "user", location_city: "Lomé",
    profile_picture_url: null, cover_photo_url: null, is_active: true, auth_providers: ["email"],
    is_organizer: true,
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  const ref = await db.collection("competitions").add({
    name: "Coupe des Quartiers 2026", slug: "coupe-des-quartiers-2026",
    description: "Le tournoi des quartiers de Lomé : huit équipes, deux poules, une finale au stade de Bè.",
    logo_url: null, banner_url: null, organizer_ids: [u.uid], moderator_ids: [], created_by: u.uid,
    status: "registration", competition_type: "groups_knockout", organizer_name: "Association Sportive des Quartiers",
    format: { group_count: 2, teams_per_group: 4, qualifiers_per_group: 2, has_third_place: false, points: { win: 3, draw: 1, loss: 0 }, team_size: 11, half_duration: 30 },
    start_date: "2026-11-07", end_date: "2026-12-13", venue_city: "Lomé",
    rules_text: "Chaque équipe présente 16 joueurs au plus. Tout joueur doit figurer sur la liste avant son premier match. Deux cartons jaunes valent un match de suspension.",
    require_rules_acceptance: true, entry_fee: 10000, entry_fee_currency: "FCFA",
    is_validated: true, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  });
  return { cid: ref.id, organizer: { uid: u.uid, email, password: "Coupe2026!" } };
}

/** L'organisateur répond à une demande d'inscription, par la vraie route. */
export async function answerRegistrations(org, cid, action = "accept") {
  const token = await idToken(org.email, org.password);
  const r = await fetch(`${BASE}/api/competitions/registrations?cid=${cid}`, { headers: { authorization: `Bearer ${token}` } });
  const { registrations } = await r.json();
  for (const reg of registrations) {
    const p = await fetch(`${BASE}/api/competitions/registrations`, {
      method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: reg.id, action }),
    });
    console.log("inscription", reg.clubName, action, p.status, (await p.text()).slice(0, 200));
  }
}
