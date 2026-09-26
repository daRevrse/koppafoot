// Le décor, sans capture : les deux clubs et leurs managers (ils s'inscrivent
// et créent leur équipe à l'écran, comme dans le guide manager), les deux
// futurs membres du corps arbitral, et trois matchs qui cherchent un arbitre.
import { open, go, settle, saveState, modale } from "./lib.mjs";
import { ensureAdmin, db, compteSimple, addGhostPlayers, FieldValue } from "./admin.mjs";
import { EDEM, KOKOU, ASSISTANT, SCOREUSE, MATCH_A, MATCH_B, MATCH_C } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";

async function manager(profil, m, ville, ecusson) {
  const { ctx, page } = await open(profil);
  await go(page, "/signup?role=manager");
  await page.fill("#firstName", m.prenom);
  await page.fill("#lastName", m.nom);
  await page.fill("#signupEmail", m.email);
  await page.fill("#signupPassword", m.mdp);
  await page.getByRole("button", { name: /^Continuer$/ }).click();
  await settle(page, 800);
  await page.fill("#locationCity", ville);
  await page.getByRole("button", { name: /Créer mon compte/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
  await go(page, "/teams");
  await page.getByRole("button", { name: "Créer une équipe" }).first().click();
  await settle(page, 800);
  await page.getByPlaceholder("FC Koppa").fill(m.equipe);
  await page.getByPlaceholder("Paris").fill(ville);
  await modale(page).locator('input[type="number"]').fill("20");
  await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
  await settle(page, 2500);
  const id = (await page.getByRole("link", { name: new RegExp(m.equipe.split(" ").pop()) }).first().getAttribute("href")).split("/").pop();
  await go(page, `/teams/${id}`);
  await page.getByRole("button", { name: "Modifier l'équipe" }).click();
  await settle(page, 800);
  await page.locator("#logo-input").setInputFiles(`${A}/${ecusson}`);
  await settle(page, 800);
  await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
  await page.waitForTimeout(4000);
  await ctx.close();
  return id;
}

await ensureAdmin();
const teamId = await manager("edem", EDEM, "Lomé", "ecusson-avenir.png");
const oppTeamId = await manager("kokou", KOKOU, "Lomé", "ecusson-tokoin.png");

// Des joueurs sans compte dans les deux effectifs : les feuilles de match
// de la console ont ainsi des noms à montrer.
const effectif = (noms) => noms.map(([p, n, pos], i) => [p, n, pos, i + 1]);
await addGhostPlayers(teamId, effectif([
  ["Sena", "Kpogo", "goalkeeper"], ["Elom", "Agbodjan", "defender"], ["Kafui", "Dossou", "defender"],
  ["Mawuli", "Ahiako", "defender"], ["Selom", "Akakpo", "defender"], ["Kodjo", "Afanou", "midfielder"],
  ["Enyonam", "Tsogbe", "midfielder"], ["Delali", "Gbeto", "midfielder"], ["Atsu", "Ekpe", "forward"],
  ["Yawo", "Kuevi", "forward"], ["Koffi", "Amedji", "forward"], ["Dela", "Sossou", "midfielder"],
  ["Mensah", "Adzraku", "defender"], ["Senyo", "Attiogbe", "forward"],
]));
await addGhostPlayers(oppTeamId, effectif([
  ["Komlan", "Ayeva", "goalkeeper"], ["Akouete", "Lawson", "defender"], ["Sitsofe", "Nyaku", "defender"],
  ["Edoh", "Koudawo", "defender"], ["Folly", "Batcho", "defender"], ["Kossi", "Agbeviade", "midfielder"],
  ["Mawunyo", "Tay", "midfielder"], ["Elikem", "Fiagbe", "midfielder"], ["Kwami", "Dogbe", "forward"],
  ["Nutifafa", "Amenyo", "forward"], ["Yao", "Klu", "forward"], ["Agbeko", "Tchalla", "midfielder"],
  ["Dzifa", "Ahadji", "defender"], ["Selasi", "Kpodo", "forward"],
]));

// Les deux membres du futur corps arbitral. Afi est scoreuse validée par
// KoppaFoot (sa candidature, sur la page Scoreurs, est hors du guide).
const yao = await compteSimple({ prenom: ASSISTANT.prenom, nom: ASSISTANT.nom, email: ASSISTANT.email, mdp: ASSISTANT.mdp });
await db.collection("users").doc(yao).update({
  evolution_role: "referee", user_type: "referee", license_level: "regional", experience_years: 4,
});
const afi = await compteSimple({ prenom: SCOREUSE.prenom, nom: SCOREUSE.nom, email: SCOREUSE.email, mdp: SCOREUSE.mdp });
await db.collection("users").doc(afi).update({ is_scorer: true });

// Trois matchs, comme les managers les programment : un amical entre les
// deux clubs (défi accepté), et un amical de chacun contre une équipe hors
// plateforme. Aucun n'a d'arbitre.
const users = async (email) => (await db.collection("users").where("email", "==", email).limit(1).get()).docs[0].id;
const edem = await users(EDEM.email);
const kokou = await users(KOKOU.email);
const logo = async (id) => (await db.collection("teams").doc(id).get()).data()?.logo_url ?? null;
const base = (m) => ({
  date: m.date, time: m.time, venue_name: m.lieu, venue_city: m.ville, venue_id: null,
  result: null, score_home: null, score_away: null,
  referee_id: null, referee_name: null, referee_status: "none", local_referee_name: null,
  format: "11v11", is_home: true, players_confirmed: 0, players_total: 22,
  confirmed_home: 0, confirmed_away: 0, auto_accept_players: true, status: "upcoming",
  created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
});
const fantome = () => Array.from({ length: 11 }, (_, i) => ({
  player_id: `ext-${Math.random().toString(36).slice(2, 8)}-${i + 1}`, name: `Joueur ${i + 1}`,
  number: String(i + 1), role: "starter", position: null,
}));
const mA = await db.collection("matches").add({
  ...base(MATCH_A),
  home_team_id: teamId, away_team_id: oppTeamId, home_team_name: EDEM.equipe, away_team_name: KOKOU.equipe,
  home_team_logo: await logo(teamId), away_team_logo: await logo(oppTeamId),
  manager_id: edem, away_manager_id: kokou,
});
const mB = await db.collection("matches").add({
  ...base(MATCH_B),
  home_team_id: oppTeamId, away_team_id: "", home_team_name: KOKOU.equipe, away_team_name: MATCH_B.adversaire,
  home_team_logo: await logo(oppTeamId), away_team_logo: null,
  manager_id: kokou, away_manager_id: "", away_ghost_lineup: fantome(), away_lineup_ready: true,
});
const mC = await db.collection("matches").add({
  ...base(MATCH_C),
  home_team_id: teamId, away_team_id: "", home_team_name: EDEM.equipe, away_team_name: MATCH_C.adversaire,
  home_team_logo: await logo(teamId), away_team_logo: null,
  manager_id: edem, away_manager_id: "", away_ghost_lineup: fantome(), away_lineup_ready: true,
});
saveState({ teamId, oppTeamId, matchA: mA.id, matchB: mB.id, matchC: mC.id, yao, afi });
console.log("décor posé", teamId, oppTeamId, mA.id, mB.id, mC.id);
