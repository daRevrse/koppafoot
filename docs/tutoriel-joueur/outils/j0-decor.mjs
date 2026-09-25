// Le décor, sans capture : les deux clubs et leurs managers, les coéquipiers.
// Les managers s'inscrivent et créent leur équipe à l'écran, comme dans le
// guide manager ; le reste (joueurs, dossards, créneau) est posé côté émulateur.
import { open, go, settle, saveState, modale } from "./lib.mjs";
import { createPlayer, addGhostPlayers, addMembers, setSquadNumbers, setTrainingSchedule } from "./admin.mjs";
import { COEQUIPIERS, SANS_COMPTE, TOKOIN } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";

async function manager(profil, prenom, nom, email, equipe, ville, description, ecusson, banniere) {
  const { ctx, page } = await open(profil);
  await go(page, "/signup?role=manager");
  await page.fill("#firstName", prenom);
  await page.fill("#lastName", nom);
  await page.fill("#signupEmail", email);
  await page.fill("#signupPassword", "Equipe2026!");
  await page.getByRole("button", { name: /^Continuer$/ }).click();
  await settle(page, 800);
  await page.fill("#locationCity", ville);
  await page.getByRole("button", { name: /Créer mon compte/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
  await go(page, "/teams");
  await page.getByRole("button", { name: "Créer une équipe" }).first().click();
  await settle(page, 800);
  await page.getByPlaceholder("FC Koppa").fill(equipe);
  await page.getByPlaceholder("Paris").fill(ville);
  if (description) await page.getByPlaceholder("Décris ton équipe...").fill(description);
  await modale(page).locator('input[type="number"]').fill("20");
  await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
  await settle(page, 2500);
  const id = (await page.getByRole("link", { name: new RegExp(equipe.split(" ").pop()) }).first().getAttribute("href")).split("/").pop();
  await go(page, `/teams/${id}`);
  await page.getByRole("button", { name: "Modifier l'équipe" }).click();
  await settle(page, 800);
  if (banniere) await page.locator("#banner-input").setInputFiles(`${A}/${banniere}`);
  await page.locator("#logo-input").setInputFiles(`${A}/${ecusson}`);
  await settle(page, 800);
  await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
  await page.waitForTimeout(4000);
  await ctx.close();
  return id;
}

const teamId = await manager("edem", "Edem", "Amouzou", "edem.amouzou@example.com", "Avenir d'Adakpamé", "Lomé",
  "Club de quartier d'Adakpamé : on joue le dimanche matin et on s'entraîne le mercredi soir.", "ecusson-avenir.png", "banniere-avenir.png");
const oppTeamId = await manager("kokou", "Kokou", "Tepe", "kokou.tepe@example.com", "Olympique de Tokoin", "Lomé",
  null, "ecusson-tokoin.png", null);
saveState({ teamId, teamUrl: `/teams/${teamId}`, oppTeamId });

// Les coéquipiers de Kafui, déjà dans l'équipe, avec leurs numéros.
const uids = [];
const numeros = {};
for (const j of COEQUIPIERS) {
  const uid = await createPlayer(j);
  uids.push(uid);
  numeros[uid] = j.num;
}
await addMembers(teamId, uids);
await setSquadNumbers(teamId, numeros);
await addGhostPlayers(teamId, SANS_COMPTE);
await addGhostPlayers(oppTeamId, TOKOIN);
await setTrainingSchedule(teamId, [{ day: 3, time: "18:30", location: "Terrain d'Adakpamé", label: "Physique et jeu" }]);

// Deux autres joueurs du mercato, pour que la liste ne soit pas vide.
await createPlayer({ first: "Mawuli", last: "Ayivi", email: "mawuli.ayivi@example.com", position: "forward", skill: "beginner", bio: "Je débute, motivé !" });
await createPlayer({ first: "Etse", last: "Gbeassor", email: "etse.gbeassor@example.com", position: "midfielder", skill: "advanced", bio: "Ancien joueur de D2, milieu relayeur." });
console.log("décor posé", teamId, oppTeamId);
