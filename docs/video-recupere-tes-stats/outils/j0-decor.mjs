// Le décor, sans capture : les deux clubs de la vidéo manager, leurs joueurs
// avec compte, et leurs joueurs sans compte, dont Ekoué Bawa. Les managers
// s'inscrivent et créent leur équipe par l'interface, écusson compris.
import { open, go, settle, saveState, modale } from "./lib.mjs";
import { ensureAdmin, createPlayer, addGhostPlayers, addMembers, setSquadNumbers, uidOf, photoDeProfil, db } from "./admin.mjs";
import { JOUEURS, DOSSARDS, SANS_COMPTE, TOKOIN, EDEM, KOKOU } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";

await ensureAdmin();
for (const j of JOUEURS) {
  const uid = await createPlayer(j);
  // Un compte à rôle dit son genre ; sans lui, l'application le redemande.
  await db.collection("users").doc(uid).update({ gender: "male" });
}

/** Un manager s'inscrit et crée son équipe, écusson compris. Rend l'id de l'équipe. */
async function equipe(profil, m, ecusson) {
  const { ctx, page } = await open(profil);
  await go(page, "/signup?role=manager");
  await page.fill("#firstName", m.prenom);
  await page.fill("#lastName", m.nom);
  await page.fill("#signupEmail", m.email);
  await page.fill("#signupPassword", m.mdp);
  await page.getByRole("radio", { name: "Homme" }).click();
  await page.getByRole("button", { name: /^Continuer$/ }).click();
  await settle(page, 800);
  await page.fill("#locationCity", "Lomé");
  await page.getByRole("button", { name: /Créer mon compte/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
  await settle(page, 1500);
  await go(page, "/teams");
  await page.getByRole("button", { name: "Créer une équipe" }).first().click();
  await settle(page, 800);
  await page.getByPlaceholder("FC Koppa").fill(m.equipe);
  await page.getByPlaceholder("Paris").fill("Lomé");
  await modale(page).locator('input[type="number"]').fill("20").catch(() => {});
  await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
  await settle(page, 2500);
  const id = (await page.getByRole("link", { name: m.equipe }).first().getAttribute("href")).split("/").pop();
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

const teamId = await equipe("edem", EDEM, "ecusson-avenir.png");
const oppTeamId = await equipe("kokou", KOKOU, "ecusson-tokoin.png");

// Les joueurs avec compte, avec leur dossard ; puis ceux qui n'en ont pas.
const uids = Object.fromEntries(await Promise.all(JOUEURS.map(async (j) => [`${j.first} ${j.last}`, await uidOf(j.email)])));
await addMembers(teamId, Object.values(uids));
await setSquadNumbers(teamId, Object.fromEntries(Object.entries(DOSSARDS).map(([n, d]) => [uids[n], d])));
await addGhostPlayers(teamId, SANS_COMPTE);
await addGhostPlayers(oppTeamId, TOKOIN);

// Kafui a un compte, et sa photo : au classement, il a un visage et une
// fiche, quand Ekoué n'a que ses initiales.
await photoDeProfil(uids["Kafui Mensah"], `${A}/portrait-kafui.png`);

saveState({ teamId, oppTeamId });
console.log("décor posé", teamId, oppTeamId);
