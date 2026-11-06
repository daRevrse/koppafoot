// Les graines de l'essai de bout en bout « Gérer son équipe », sur les
// émulateurs SEULEMENT (voir LISEZMOI.md) : la base et les comptes de
// l'émulateur sont vidés, puis remplis. Le script refuse de tourner sans les
// variables des émulateurs, pour ne jamais toucher un vrai projet.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node mobile/outils/emulateurs/graines.cjs
//
// Les comptes : e-mail ci-dessous, mot de passe MOT_DE_PASSE. Ils n'existent
// que dans l'émulateur.

const http = require("node:http");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const PROJET = "demo-koppafoot";
const MOT_DE_PASSE = "essai-emulateur-2026";
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FIRESTORE || !AUTH) {
  console.error("FIRESTORE_EMULATOR_HOST et FIREBASE_AUTH_EMULATOR_HOST sont requis : ce script ne vise que les émulateurs.");
  process.exit(1);
}

const COMPTES = [
  { uid: "manager-e2e", prenom: "Mo", nom: "Manager", role: "manager", genre: "male" },
  { uid: "delegue-e2e", prenom: "Dédé", nom: "Délégué", role: "player", poste: "midfielder", genre: "male" },
  { uid: "membre1-e2e", prenom: "Ama", nom: "Attaque", role: "player", poste: "forward", genre: "female" },
  { uid: "membre2-e2e", prenom: "Bébé", nom: "But", role: "player", poste: "goalkeeper", genre: "male" },
  { uid: "candidat-e2e", prenom: "Céline", nom: "Candidate", role: "player", poste: "defender", genre: "female" },
  { uid: "invite-e2e", prenom: "Ivan", nom: "Invité", role: "player", poste: "forward", genre: "male" },
  // Un manager sans club : pour créer une équipe (l'autre a déjà les deux de l'offre gratuite).
  { uid: "nouveau-e2e", prenom: "Nina", nom: "Nouvelle", role: "manager", genre: "female" },
];
const email = (uid) => `${uid}@essai.koppafoot.test`;

function supprimer(hote, chemin) {
  const [host, port] = hote.split(":");
  return new Promise((resolve, reject) => {
    const r = http.request({ host, port: Number(port), method: "DELETE", path: chemin, headers: { Authorization: "Bearer owner" } }, (rep) => {
      rep.resume();
      if (rep.statusCode === 200) resolve();
      else reject(new Error(`${chemin} : ${rep.statusCode}`));
    });
    r.on("error", reject);
    r.end();
  });
}

async function main() {
  await supprimer(FIRESTORE, `/emulator/v1/projects/${PROJET}/databases/(default)/documents`);
  await supprimer(AUTH, `/emulator/v1/projects/${PROJET}/accounts`);

  initializeApp({ projectId: PROJET });
  const auth = getAuth();
  const db = getFirestore();
  const maintenant = FieldValue.serverTimestamp();

  for (const c of COMPTES) {
    await auth.createUser({ uid: c.uid, email: email(c.uid), password: MOT_DE_PASSE, displayName: `${c.prenom} ${c.nom}` });
    await db.doc(`users/${c.uid}`).set({
      first_name: c.prenom, last_name: c.nom, email: email(c.uid),
      user_type: c.role, evolution_role: c.role, is_active: true,
      location_city: "Lomé", position: c.poste ?? null, skill_level: "amateur", gender: c.genre,
      created_at: maintenant, updated_at: maintenant,
    });
  }

  const club = {
    city: "Lomé", description: "", level: "amateur", looking_for: [], max_members: 20, color: "emerald",
    wins: 0, losses: 0, draws: 0, matches_played: 0, is_recruiting: true, category: "men",
    created_at: maintenant, updated_at: maintenant,
  };
  await db.doc("teams/t-e2e").set({
    ...club, name: "FC Émulateur", manager_id: "manager-e2e",
    member_ids: ["delegue-e2e", "membre1-e2e", "membre2-e2e"],
    staff: [{ uid: "delegue-e2e", name: "Dédé Délégué", title: "Adjoint", delegated: true }],
    staff_manager_ids: ["delegue-e2e"],
    squad_numbers: { "membre1-e2e": "9" }, lineup_ids: [],
  });
  await db.doc("teams/t2-e2e").set({
    ...club, name: "AS Seconde", manager_id: "manager-e2e", color: "blue",
    member_ids: [], staff: [], staff_manager_ids: [], squad_numbers: {}, lineup_ids: [],
  });
  const iso = new Date().toISOString();
  await db.doc("teams/t-e2e/ghost_players/g-e2e").set({
    first_name: "Kodjo", last_name: "Mensah", position: "defender", squad_number: "5",
    goals: 0, assists: 0, matches_played: 0, created_at: iso, updated_at: iso,
  });
  await db.doc("join_requests/jr-e2e").set({
    player_id: "candidat-e2e", player_name: "Céline Candidate", player_photo: null, team_logo: null,
    player_city: "Lomé", player_position: "defender", player_level: "amateur",
    team_id: "t-e2e", team_name: "FC Émulateur", manager_id: "manager-e2e",
    message: "Je joue arrière gauche, disponible le dimanche.", status: "pending",
    created_at: maintenant, updated_at: maintenant,
  });

  console.log(`Graines posées : ${COMPTES.length} comptes (mot de passe « ${MOT_DE_PASSE} »), 2 clubs, 1 joueur sans compte, 1 candidature.`);
  for (const c of COMPTES) console.log(`  ${email(c.uid)}  ${c.prenom} ${c.nom} (${c.role})`);
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
