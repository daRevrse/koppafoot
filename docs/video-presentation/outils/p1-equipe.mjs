// Scène 03, début : Edem s'inscrit et crée l'Avenir d'Adakpamé, depuis son téléphone.
import { open, go, settle, ecran, cible, saveState, modale, PHONE } from "./lib.mjs";
import { EDEM } from "./roster.mjs";
import { db, uidOf } from "./admin.mjs";
const A = process.env.ASSETS ?? "actifs";

const { ctx, page } = await open("edem-tel", PHONE);
// `reprise` : le compte et l'équipe existent déjà, on ne refait que la fin.
if (process.argv[2] !== "reprise") {
await go(page, "/signup?role=manager");
await page.fill("#firstName", EDEM.prenom);
await page.fill("#lastName", EDEM.nom);
await page.fill("#signupEmail", EDEM.email);
await page.fill("#signupPassword", EDEM.mdp);
await page.getByRole("radio", { name: "Homme" }).click();
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await settle(page, 2000);

await go(page, "/teams");
await settle(page, 2000);
const creer = page.getByRole("button", { name: "Créer une équipe" }).first();
await creer.click();
await settle(page, 1000);
const m = modale(page);
await page.waitForTimeout(1500);
await cible(page, "03a-creer-vide", page.getByPlaceholder("FC Koppa"));
await ecran(page, "03a-creer-vide");
await page.getByPlaceholder("FC Koppa").fill(EDEM.equipe);
await page.getByPlaceholder("Paris").fill("Lomé");
await m.locator('input[type="number"]').fill("20");
await page.getByPlaceholder("FC Koppa").scrollIntoViewIfNeeded();
await settle(page, 600);
await cible(page, "03b-creer-nom", page.getByPlaceholder("FC Koppa"));
await ecran(page, "03b-creer-nom");
const valider = m.getByRole("button", { name: "Créer l'équipe" });
await valider.click();
await settle(page, 2500);
}
// L'équipe, relue dans la base : plus sûr que le lien de la liste.
const edemUid = await uidOf(EDEM.email);
const teamId = (await db.collection("teams").where("manager_id", "==", edemUid).get()).docs[0].id;
saveState({ teamId, teamUrl: `/teams/${teamId}`, edem: edemUid });

// L'écusson et la bannière.
await go(page, `/teams/${teamId}`);
await settle(page, 1500);
await page.getByRole("button", { name: "Modifier l'équipe" }).click();
await settle(page, 800);
await page.locator("#banner-input").setInputFiles(`${A}/banniere-avenir.png`);
await page.locator("#logo-input").setInputFiles(`${A}/ecusson-avenir.png`);
await page.getByPlaceholder("Ex: Toujours debout !").fill("L'avenir se joue le samedi").catch(() => {});
await settle(page, 800);
await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(4000);
await go(page, `/teams/${teamId}`);
await settle(page, 3000);
await ecran(page, "03c-equipe");
await ctx.close();
console.log("équipe", teamId);
