// Le décor, sans capture : les deux clubs de la vidéo manager, leurs joueurs,
// le défi accepté pour dimanche, et Elikem, le supporter qui ne sera pas au
// stade. Les managers créent leur équipe et le défi à l'écran (rien de tout
// ça n'est filmé ici : c'est l'objet de la vidéo manager).
import { open, go, settle, saveState, loginUI, modale } from "./lib.mjs";
import { ensureAdmin, createPlayer, addGhostPlayers, addMembers, setSquadNumbers, compteSimple, uidOf, db } from "./admin.mjs";
import { JOUEURS, DOSSARDS, SANS_COMPTE, TOKOIN, EDEM, KOKOU, MATCH, SUPPORTER } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";

await ensureAdmin();
for (const j of JOUEURS) {
  const uid = await createPlayer(j);
  // Un compte à rôle dit son genre ; sans lui, l'application le redemande à
  // chaque connexion, par une fenêtre qui masquerait les captures.
  await db.collection("users").doc(uid).update({ gender: "male" });
}
const elikem = await compteSimple(SUPPORTER);
await db.collection("users").doc(elikem).update({ gender: "male" });

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
  await go(page, "/teams");
  await page.getByRole("button", { name: "Créer une équipe" }).first().click();
  await settle(page, 800);
  await page.getByPlaceholder("FC Koppa").fill(m.equipe);
  await page.getByPlaceholder("Paris").fill("Lomé");
  await modale(page).locator('input[type="number"]').fill("20");
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

// Les recrues de la vidéo manager, avec leur dossard, et le reste de l'effectif.
const uids = Object.fromEntries(await Promise.all(JOUEURS.map(async (j) => [`${j.first} ${j.last}`, await uidOf(j.email)])));
await addMembers(teamId, Object.values(uids));
await setSquadNumbers(teamId, Object.fromEntries(Object.entries(DOSSARDS).map(([n, d]) => [uids[n], d])));
await addGhostPlayers(teamId, SANS_COMPTE);
await addGhostPlayers(oppTeamId, TOKOIN);

// Edem défie l'Olympique de Tokoin ; Kokou accepte.
let { ctx, page } = await open("edem");
await go(page, "/matches");
await settle(page, 2500);
await page.getByRole("button", { name: "Défier une équipe" }).first().click();
await settle(page, 1200);
const form = page.locator("div.border-2").filter({ hasText: "Défier une équipe" }).first();
await form.locator("select").first().selectOption({ label: EDEM.equipe }).catch(() => {});
await page.getByPlaceholder("Rechercher une équipe sur KoppaFoot...").fill("Tokoin");
await settle(page, 2000);
await page.getByRole("button", { name: /Olympique de Tokoin/ }).first().click();
await settle(page, 800);
await form.locator('input[type="date"]').first().fill(MATCH.date);
await form.locator('input[type="time"]').first().fill(MATCH.time);
await page.getByPlaceholder("Nom du terrain").fill(MATCH.lieu);
await page.getByPlaceholder("Ville").fill(MATCH.ville);
await form.getByText("11v11", { exact: true }).click();
await settle(page, 600);
await form.getByRole("button", { name: /Envoyer le défi/ }).click();
await settle(page, 2500);
await ctx.close();

({ ctx, page } = await open("kokou"));
await loginUI(page, KOKOU.email, KOKOU.mdp);
await go(page, "/matches");
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
const recu = page.locator("div").filter({ has: page.getByRole("button", { name: "Accepter" }) }).filter({ hasText: /Défi reçu/i }).last();
await recu.getByRole("button", { name: "Accepter" }).click();
await settle(page, 2500);
await ctx.close();

const m = (await db.collection("matches").where("home_team_id", "==", teamId).get()).docs[0];
saveState({ teamId, oppTeamId, matchId: m.id });
console.log("décor posé : match", m.id, m.data().status);
