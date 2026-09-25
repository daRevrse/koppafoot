// Chapitre 4 : l'effectif — dossards, joueurs sans compte, staff.
import { open, go, shot, region, settle, loadState, modale, corps } from "./lib.mjs";
import { addGhostPlayers } from "./admin.mjs";
import { DOSSARDS, SANS_COMPTE } from "./roster.mjs";
const { teamId, teamUrl } = loadState();
const numero = (page, nom) =>
  page.locator("div", { has: page.getByText(nom, { exact: true }) })
    .filter({ has: page.locator('input[type="text"]') }).last().locator('input[type="text"]').last();

const { ctx, page } = await open("edem");
await go(page, teamUrl);
await settle(page, 2000);
for (const [nom, n] of Object.entries(DOSSARDS)) await numero(page, nom).fill(n);
await settle(page, 600);
await region(page, "20-dossards", corps(page), {
  maxHeight: 1400,
  marks: [
    { loc: numero(page, "Dodzi Ahadji"), union: numero(page, "Kafui Mensah"), n: 1, pad: 6 },
    { loc: page.getByRole("button", { name: /Dossards/ }), n: 2 },
  ],
});
await page.getByRole("button", { name: /Dossards/ }).click();
await settle(page, 1500);

// Un joueur sans compte
await page.getByRole("button", { name: "Ajouter un joueur" }).first().click();
await settle(page, 800);
const m = modale(page);
await page.getByPlaceholder("Jean").fill("Komlan");
await page.getByPlaceholder("Dupont").fill("Tepe");
await m.locator("select").first().selectOption({ label: "Défenseur" });
await page.getByPlaceholder("Ex: 10").fill("5");
await shot(page, "21-joueur-sans-compte", {
  marks: [
    { loc: page.getByPlaceholder("Jean"), union: page.getByPlaceholder("Dupont"), n: 1 },
    { loc: m.locator("select").first(), n: 2 },
    { loc: page.getByPlaceholder("Ex: 10"), n: 3 },
    { loc: m.getByRole("button", { name: "Ajouter", exact: true }), n: 4 },
  ],
});
await m.getByRole("button", { name: "Ajouter", exact: true }).click();
await settle(page, 2000);

// Les neuf autres, d'un coup (même geste, neuf fois).
await addGhostPlayers(teamId, SANS_COMPTE);
await go(page, teamUrl);
await settle(page, 2500);
const komlan = page.locator("div", { has: page.getByText("Komlan Tepe", { exact: true }) })
  .filter({ has: page.getByRole("button", { name: /Modifier/ }) }).last();
const fusion = page.getByText("Fusionner un joueur", { exact: true }).locator("xpath=ancestor::div[.//select][1]");
await region(page, "22-effectif-complet", corps(page), {
  maxHeight: 2600,
  marks: [
    { loc: komlan.getByRole("button", { name: /Modifier/ }), n: 1, badge: "top" },
    { loc: fusion, n: 2 },
  ],
});

// Le staff : un adjoint avec les droits du manager
await page.getByRole("button", { name: /^Paramètres/ }).first().click();
await settle(page, 1500);
const staff = page.getByText("Staff de l'équipe", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border')][1]");
await staff.locator("select").selectOption({ label: "Selom Adjo" });
await page.getByPlaceholder("Coach, dirigeant…").fill("Adjoint");
await staff.locator('input[type="checkbox"]').check();
await region(page, "23-staff", staff, {
  margin: 24,
  marks: [
    { loc: staff.locator("select"), union: page.getByPlaceholder("Coach, dirigeant…"), n: 1 },
    { loc: staff.locator('input[type="checkbox"]').locator("xpath=.."), n: 2 },
    { loc: staff.getByRole("button", { name: /Ajouter au staff/ }), n: 3 },
  ],
});
await staff.getByRole("button", { name: /Ajouter au staff/ }).click();
await settle(page, 2000);
const recrutement = page.getByText("Statut de recrutement", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(page, "24-parametres", corps(page), {
  maxHeight: 2600,
  marks: [
    { loc: recrutement, n: 1 },
    { loc: staff, n: 2 },
  ],
});
await ctx.close();
