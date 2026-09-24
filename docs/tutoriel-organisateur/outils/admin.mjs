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
if (process.argv[2] === "clock") await setClock(process.argv[3], process.argv[4], Number(process.argv[5]));
