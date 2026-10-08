// Le décor de la vidéo, posé sur les ÉMULATEURS (jamais en production) :
//
//   · la Coupe des Quartiers, un match en direct (2 – 1 à la 67e) ;
//   · quatre publications dans la Tribune ;
//   · Sika Jus, partenaire du Direct et de la Coupe (« Présenté par ») ;
//   · trois annonces qui se relaient dans la Tribune et les Actus ;
//   · Elikem, le supporter qui fait défiler l'application à l'écran.
//
//   node decor.mjs
//
// Les marques sont fictives (voir visuels.mjs), les personnes aussi. Les
// visuels sont rangés en data: URI : pas de Storage à remplir.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

// firebase-admin est celui de l'application (package.json à la racine du dépôt).
const require = createRequire(path.resolve(import.meta.dirname, "../../../package.json"));
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const app = getApps()[0] ?? initializeApp({ projectId: "demo-koppafoot" });
const auth = getAuth(app);
const db = getFirestore(app);

const IMAGES = path.resolve(import.meta.dirname, "../source/images");
const dataUri = (fichier) => {
  const ext = path.extname(fichier).slice(1).replace("jpg", "jpeg");
  return `data:image/${ext};base64,${fs.readFileSync(path.join(IMAGES, fichier)).toString("base64")}`;
};

/** Le jour à Lomé (UTC), au format des compétitions. */
const aujourdhui = new Date().toISOString().slice(0, 10);
const dans = (jours) => new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);
const maintenant = new Date().toISOString();

// ── Les comptes ─────────────────────────────────────────────
async function compte(email, prenom, nom, extra = {}) {
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch { u = await auth.createUser({ email, password: "Video2026!", displayName: `${prenom} ${nom}`, emailVerified: true }); }
  await db.collection("users").doc(u.uid).set({
    email, phone: null, first_name: prenom, last_name: nom, user_type: "user",
    location_city: "Lomé", profile_picture_url: null, cover_photo_url: null, is_active: true,
    auth_providers: ["email"], evolution_role: null, gender: "male",
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(), ...extra,
  }, { merge: true });
  return u.uid;
}
const elikem = await compte("elikem@exemple.tg", "Elikem", "Agbeko");
const auteurs = [
  [await compte("afi@exemple.tg", "Afi", "Lawson"), "Afi Lawson"],
  [await compte("kossi@exemple.tg", "Kossi", "Mensah", { evolution_role: "manager" }), "Kossi Mensah"],
  [await compte("yawa@exemple.tg", "Yawa", "Kpodar", { evolution_role: "player" }), "Yawa Kpodar"],
  [await compte("dodzi@exemple.tg", "Dodzi", "Amegah"), "Dodzi Amegah"],
];

// ── La compétition et son match en direct ───────────────────
const cid = "coupe-des-quartiers";
await db.doc(`competitions/${cid}`).set({
  name: "Coupe des Quartiers", slug: cid, description: "Le tournoi des quartiers de Lomé.",
  logo_url: null, banner_url: dataUri("bannieres/affiche-coupe.jpg"),
  organizer_ids: [], moderator_ids: [], created_by: "video", organizer_name: "Ligue de Lomé",
  status: "group_stage", competition_type: "groups_knockout", category: "men",
  format: { group_count: 2, teams_per_group: 4, qualifiers_per_group: 2, has_third_place: false,
    points: { win: 3, draw: 1, loss: 0 }, team_size: 11, half_duration: 45 },
  start_date: dans(-10), end_date: dans(20), venue_city: "Lomé", rules_text: "",
  require_rules_acceptance: false, entry_fee: null, entry_fee_currency: "FCFA",
  is_validated: true, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
});
const equipe = (name, short, logo, group) => ({
  name, short_name: short, logo_url: dataUri(logo), color: "emerald", group, players: [],
  claimed_by_manager_id: null, claimed_by_team_id: null, created_at: maintenant, updated_at: maintenant,
});
await db.doc(`competitions/${cid}/comp_teams/avenir`).set(equipe("Avenir d'Adakpamé", "AVE", "ecusson-avenir.png", "A"));
await db.doc(`competitions/${cid}/comp_teams/tokoin`).set(equipe("Olympique de Tokoin", "OLT", "ecusson-tokoin.png", "A"));
const but = (id, minute, period, team_id, player_name) => ({
  id, type: "goal", period, minute, team_id, player_id: id, player_name, created_at: maintenant,
});
await db.doc(`competitions/${cid}/comp_matches/m1`).set({
  competition_id: cid, stage: "group", group: "A", round: null, bracket_slot: null,
  home_team_id: "avenir", away_team_id: "tokoin",
  home_team_name: "Avenir d'Adakpamé", away_team_name: "Olympique de Tokoin",
  home_team_logo: dataUri("ecusson-avenir.png"), away_team_logo: dataUri("ecusson-tokoin.png"),
  date: aujourdhui, time: "16:00", venue_name: "Stade de Bè", venue_city: "Lomé",
  status: "live", score_home: 2, score_away: 1, penalty_home: null, penalty_away: null, winner_team_id: null,
  feeds_into_match_id: null, feeds_into_slot: null,
  home_lineup: [], away_lineup: [], home_formation: null, away_formation: null,
  live_state: {
    current_period: 3,
    // Seconde mi-temps (période 3), 66 minutes écoulées : la fiche affiche la 67e.
    timer_start_at: new Date(Date.now() - 66 * 60000).toISOString(),
    timer_offset: 0, is_timer_running: true,
    events: [
      but("b1", 23, 1, "avenir", "Kafui Mensah"),
      but("b2", 41, 1, "tokoin", "Yao Tetteh"),
      but("b3", 64, 3, "avenir", "Ekoué Bawa"),
    ],
  },
  created_at: maintenant, updated_at: maintenant,
});

// ── La Tribune ──────────────────────────────────────────────
const anciens = await db.collection("posts").where("author_id", "in", auteurs.map(([uid]) => uid)).get();
for (const d of anciens.docs) await d.ref.delete();
const textes = [
  "Quel match à Bè ! L'Avenir mène 2 – 1, l'ambiance est folle 🔥",
  "Entraînement demain 6 h au terrain de Tokoin. Tout le monde à l'heure !",
  "Mon premier but en Coupe des Quartiers. Merci les gars 🙏⚽",
  "Qui vient voir la demi-finale samedi ? On se retrouve devant la buvette.",
];
for (const [i, [uid, nom]] of auteurs.entries()) {
  await db.collection("posts").add({
    author_id: uid, author_name: nom, author_role: i === 1 ? "manager" : i === 2 ? "player" : "supporter",
    author_avatar: "", type: "text", content: textes[i], metadata: null,
    likes: auteurs.slice(0, 4 - i).map(([u]) => u), comment_count: 3 - (i % 3), media_urls: [],
    created_at: Timestamp.fromMillis(Date.now() - (i + 1) * 23 * 60000),
    updated_at: Timestamp.fromMillis(Date.now() - (i + 1) * 23 * 60000),
  });
}

// ── Les partenariats ────────────────────────────────────────
const partenariat = (id, champs) => db.doc(`partenariats/${id}`).set({
  accroche: null, format: "banniere", type: "partenaire", image_verticale_url: null,
  lien: "https://exemple.tg", competition_id: null, competition_nom: null,
  debut: dans(-3), fin: dans(30), actif: true, vues: 0, clics: 0, created_by: "video",
  created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(), ...champs,
});
const anciensP = await db.collection("partenariats").get();
for (const d of anciensP.docs) await d.ref.delete();
await partenariat("sika-direct", {
  annonceur: "Sika Jus", accroche: "100 % fruits pressés", image_url: dataUri("bannieres/sika-jus.jpg"),
  emplacements: ["direct", "direct_affiche", "direct_vide"],
});
await partenariat("sika-coupe", {
  annonceur: "Sika Jus", accroche: "100 % fruits pressés", image_url: dataUri("bannieres/sika-jus.jpg"),
  emplacements: ["competition", "match"], competition_id: cid, competition_nom: "Coupe des Quartiers",
});
for (const [id, annonceur, fichier] of [
  ["novo", "Novo Assurances", "novo-assurances.jpg"],
  ["lagune", "Pharmacie de la Lagune", "pharmacie-lagune.jpg"],
  ["mawuli", "Mawuli Auto", "mawuli-auto.jpg"],
]) {
  await partenariat(`annonce-${id}`, {
    annonceur, type: "annonce", image_url: dataUri(`bannieres/${fichier}`), emplacements: ["tribune", "actus"],
  });
}

fs.writeFileSync(path.resolve(import.meta.dirname, "state.json"), JSON.stringify({ elikem, cid, match: "m1" }, null, 2));
console.log(`décor posé : ${cid}, match m1 en direct, ${auteurs.length} publications, 5 partenariats`);
