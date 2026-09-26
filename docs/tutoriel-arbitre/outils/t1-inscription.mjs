// Chapitre 1 : devenir arbitre. Komi s'inscrit, puis renseigne sa licence.
import { open, go, settle, shot, region } from "./lib.mjs";
import { ARBITRE } from "./roster.mjs";

const { ctx, page } = await open("komi");

// La page des rôles : la carte Arbitre.
await go(page, "/roles");
await settle(page, 1500);
const cta = page.getByRole("link", { name: "Devenir arbitre" }).first();
await cta.scrollIntoViewIfNeeded();
// La carte s'anime en entrant à l'écran : on attend qu'elle soit posée, et on
// la capture seule (une zone mesurée pendant l'animation sortait écrasée).
const carte = cta.locator("xpath=ancestor::article[1]");
await settle(page, 2000);
await page.addStyleTag({ content: "header { visibility: hidden !important; }" });
await shot(page, "01-role-arbitre", { el: carte, marks: [{ loc: cta, n: 1, badge: "top" }] });

// L'inscription, en deux temps.
await cta.click();
await page.waitForURL(/signup/);
await settle(page, 1200);
await page.fill("#firstName", ARBITRE.prenom);
await page.fill("#lastName", ARBITRE.nom);
await page.fill("#signupEmail", ARBITRE.email);
await page.fill("#signupPassword", ARBITRE.mdp);
const form = page.locator("form").first();
await region(page, "02-inscription", form, {
  margin: 48,
  marks: [
    { loc: page.locator("#firstName"), union: page.locator("#lastName"), n: 1 },
    { loc: page.locator("#signupEmail"), n: 2 },
    { loc: page.locator("#signupPassword"), n: 3 },
    { loc: page.getByRole("button", { name: /^Continuer$/ }), n: 4, badge: "top" },
  ],
});
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", ARBITRE.ville);
await region(page, "03-inscription-ville", page.locator("form").first(), {
  margin: 48,
  marks: [
    { loc: page.locator("#locationCity"), n: 1 },
    { loc: page.getByRole("button", { name: /Créer mon compte/i }), n: 2, badge: "top" },
  ],
});
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await settle(page, 3000);
console.log("après inscription :", page.url());

// L'accueil : la liste « Pour bien démarrer ».
await go(page, "/");
await settle(page, 2500);
const demarrer = page.getByText("Pour bien démarrer").first().locator("xpath=ancestor::div[contains(@class,'bg-gray-50')][1]");
await region(page, "04-bien-demarrer", demarrer, { margin: 16 });

// Le profil : la licence, à compléter.
await go(page, "/profile");
await settle(page, 2000);
const licence = page.getByText("Ma licence d'arbitre").locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(page, "05-licence-vide", licence, {
  margin: 20,
  marks: [{ loc: licence.getByRole("button", { name: /Compléter|Modifier/ }), n: 1, badge: "top" }],
});
await licence.getByRole("button", { name: /Compléter|Modifier/ }).click();
await settle(page, 1200);
await page.locator('input[name="licenseNumber"]').fill(ARBITRE.licence);
await page.locator('select[name="licenseLevel"]').selectOption(ARBITRE.niveau);
await page.locator('input[name="experienceYears"]').fill(ARBITRE.experience);
const zone = page.locator('input[name="licenseNumber"]').locator("xpath=ancestor::form[1]");
await region(page, "06-licence-edition", zone, {
  margin: 20,
  depuis: page.locator('input[name="licenseNumber"]').locator("xpath=ancestor::div[1]"),
  marks: [
    { loc: page.locator('input[name="licenseNumber"]'), n: 1 },
    { loc: page.locator('select[name="licenseLevel"]'), n: 2 },
    { loc: page.locator('input[name="experienceYears"]'), n: 3 },
    { loc: zone.getByRole("button", { name: /Enregistrer/ }), n: 4, badge: "top" },
  ],
});
await zone.getByRole("button", { name: /Enregistrer/ }).click();
await settle(page, 2500);
const licence2 = page.getByText("Ma licence d'arbitre").locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(page, "07-licence-remplie", licence2, { margin: 20 });
await ctx.close();
