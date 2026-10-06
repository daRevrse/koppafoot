// Le décor, sans capture : les joueurs inscrits, et l'adversaire (Kokou et
// l'Olympique de Tokoin, créés à l'écran comme dans le guide manager).
import { open, go, settle, saveState, modale } from "./lib.mjs";
import { ensureAdmin, createPlayer, addGhostPlayers, db } from "./admin.mjs";
import { JOUEURS, KOKOU, TOKOIN } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";

await ensureAdmin();
for (const j of JOUEURS) {
  const uid = await createPlayer(j);
  // Un compte à rôle dit son genre ; sans lui, l'application le redemande à
  // chaque connexion, par une fenêtre qui masquerait les captures.
  const id = uid ?? (await db.collection("users").where("email", "==", j.email).limit(1).get()).docs[0]?.id;
  if (id) await db.collection("users").doc(id).update({ gender: "male" });
}

const { ctx, page } = await open("kokou");
await go(page, "/signup?role=manager");
await page.fill("#firstName", KOKOU.prenom);
await page.fill("#lastName", KOKOU.nom);
await page.fill("#signupEmail", KOKOU.email);
await page.fill("#signupPassword", KOKOU.mdp);
await page.getByRole("radio", { name: "Homme" }).click();
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await go(page, "/teams");
await page.getByRole("button", { name: "Créer une équipe" }).first().click();
await settle(page, 800);
await page.getByPlaceholder("FC Koppa").fill(KOKOU.equipe);
await page.getByPlaceholder("Paris").fill("Lomé");
await modale(page).locator('input[type="number"]').fill("20");
await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
await settle(page, 2500);
const oppTeamId = (await page.getByRole("link", { name: /Tokoin/ }).first().getAttribute("href")).split("/").pop();
await go(page, `/teams/${oppTeamId}`);
await page.getByRole("button", { name: "Modifier l'équipe" }).click();
await settle(page, 800);
await page.locator("#logo-input").setInputFiles(`${A}/ecusson-tokoin.png`);
await settle(page, 800);
await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(4000);
await ctx.close();
await addGhostPlayers(oppTeamId, TOKOIN);
saveState({ oppTeamId });
console.log("décor posé", oppTeamId);
