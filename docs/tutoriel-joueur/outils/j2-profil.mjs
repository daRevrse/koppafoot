// Chapitre 2 : compléter son profil de joueur.
import { open, go, shot, region, settle, corps } from "./lib.mjs";

const { ctx, page } = await open("kafui");
await go(page, "/teams");
await settle(page, 1500);
const avatar = page.locator("header button:visible").filter({ hasText: /KM/ }).first();
await avatar.click();
await settle(page, 800);
const voir = page.getByRole("link", { name: /Voir mon profil/ });
await shot(page, "06-menu-avatar", {
  clip: { x: 780, y: 0, width: 500, height: 520 },
  marks: [{ loc: voir, n: 1 }],
});
await voir.click();
await page.waitForURL(/\/profile$/);
await settle(page, 2000);
const modifier = page.getByRole("button", { name: /^Modifier$/i }).first();
await shot(page, "07-profil", {
  marks: [
    { loc: modifier, n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: "Changer ma photo" }), n: 2 },
    { loc: page.getByRole("button", { name: /^Informations$/i }).first(), union: page.getByRole("button", { name: /^Compte$/i }).first(), n: 3, pad: 4 },
  ],
});

await modifier.click();
await settle(page, 1200);
await page.locator('textarea[name="bio"]').fill("Attaquant rapide, 24 ans. Je joue le dimanche matin et je marque de la tête.");
await page.locator('select[name="strongFoot"]').selectOption("right");
await page.locator('input[name="height"]').fill("178");
await page.locator('input[name="weight"]').fill("72");
await page.locator('input[name="dateOfBirth"]').fill("2002-03-14");
await page.locator('select[name="position"]').selectOption("forward");
await page.locator('select[name="skillLevel"]').selectOption("intermediate");
await settle(page, 500);
const enregistrer = page.getByRole("button", { name: /Enregistrer/ }).last();
await region(page, "08-modifier-profil", corps(page), {
  maxHeight: 2400,
  marks: [
    { loc: page.locator('textarea[name="bio"]'), n: 1 },
    { loc: page.locator('select[name="strongFoot"]'), union: page.locator('input[name="dateOfBirth"]'), n: 2 },
    { loc: page.locator('select[name="position"]'), union: page.locator('select[name="skillLevel"]'), n: 3 },
    { loc: enregistrer, n: 4, badge: "top" },
  ],
});
await enregistrer.click();
await settle(page, 2500);

// La fiche publique, telle que la voient les managers et les autres joueurs.
await page.getByRole("link", { name: /Ma fiche publique/i }).click();
await page.waitForURL(/\/profile\/.+/);
await settle(page, 2500);
await shot(page, "09-fiche-publique");

// La carte KoppaFoot
await go(page, "/profile");
await settle(page, 1500);
await page.getByRole("button", { name: /Carte FUT/i }).click();
await settle(page, 2000);
await region(page, "10-carte-fut", corps(page), {
  maxHeight: 1600,
  marks: [{ loc: page.getByRole("button", { name: /Télécharger ma carte/ }), n: 1 }],
});
await ctx.close();
