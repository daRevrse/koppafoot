// Le décor, sans capture : les deux clubs qui demanderont des créneaux, et
// leurs managers. Ils s'inscrivent et créent leur équipe à l'écran, comme
// dans le guide manager.
import { open, go, settle, saveState, modale } from "./lib.mjs";
import { ensureAdmin } from "./admin.mjs";
const A = process.env.ASSETS ?? "actifs";

async function manager(profil, prenom, nom, email, equipe, ville, ecusson) {
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
  await modale(page).locator('input[type="number"]').fill("20");
  await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
  await settle(page, 2500);
  const id = (await page.getByRole("link", { name: new RegExp(equipe.split(" ").pop()) }).first().getAttribute("href")).split("/").pop();
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
const teamId = await manager("edem", "Edem", "Amouzou", "edem.amouzou@example.com", "Avenir d'Adakpamé", "Lomé", "ecusson-avenir.png");
const oppTeamId = await manager("kokou", "Kokou", "Tepe", "kokou.tepe@example.com", "Olympique de Tokoin", "Lomé", "ecusson-tokoin.png");
saveState({ teamId, oppTeamId });
console.log("décor posé", teamId, oppTeamId);
