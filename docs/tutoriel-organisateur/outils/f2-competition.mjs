// Chapitre 3 : créer la compétition.
import { open, go, shot, region, settle, saveState, content } from "./lib.mjs";

const A = process.env.ASSETS ?? "actifs";
const { ctx, page } = await open("kossi");

await go(page, "/organizer/competitions/new");
const section = (title) => page.locator("div.border", { has: page.locator("div.text-sm.font-semibold", { hasText: title }) }).first();

// Informations générales
await page.getByPlaceholder("ex: Coupe d'été 2026").fill("Coupe des Quartiers 2026");
await page.getByPlaceholder(/Présentez votre compétition/).fill(
  "Le grand tournoi inter-quartiers de Lomé : 8 équipes, 2 poules, puis demi-finales et finale.",
);
const files = page.locator('input[type="file"]');
await files.nth(0).setInputFiles(A + "/logo-coupe.png");
await files.nth(1).setInputFiles(A + "/banniere-coupe.png");
await settle(page, 1500);
const general = section("Informations générales");
await region(page, "12-infos-generales", general, {
  marks: [
    { loc: page.getByPlaceholder("ex: Coupe d'été 2026"), n: 1 },
    { loc: page.getByPlaceholder(/Présentez votre compétition/), n: 2 },
    { loc: page.getByText(/Logo \(optionnel\)/i).locator("xpath=.."), n: 3 },
    { loc: page.getByText(/Bannière \(optionnel\)/i).locator("xpath=.."), n: 4 },
  ],
});

// Type
const typeSection = section("Type de compétition");
await region(page, "13-type-competition", typeSection, {
  marks: [{ loc: typeSection.getByRole("button", { name: /Poules \+ phase finale/ }), n: 1 }],
});

// Format
const numbers = page.locator('input[type="number"]');
await numbers.nth(0).fill("30"); // mi-temps
await numbers.nth(1).fill("2"); // nombre de groupes
const formatSection = section(/^\s*Format\s*$/);
await region(page, "14-format", formatSection, {
  marks: [
    { loc: formatSection.locator("select").first(), n: 1 },
    { loc: numbers.nth(0), n: 2 },
    { loc: numbers.nth(1).locator("xpath=../.."), n: 3 },
  ],
});

// Dates et lieu
await page.locator('input[type="date"]').nth(0).fill("2026-12-05");
await page.locator('input[type="date"]').nth(1).fill("2026-12-20");
await page.getByPlaceholder("ex: Paris").fill("Lomé");
const datesSection = section("Dates et lieu");
const submit = page.getByRole("button", { name: /Créer la compétition/ });
await region(page, "15-dates-et-lieu", datesSection, {
  extraBottom: 70,
  marks: [
    { loc: page.locator('input[type="date"]').nth(0).locator("xpath=../.."), n: 1 },
    { loc: page.getByPlaceholder("ex: Paris"), n: 2 },
    { loc: submit, n: 3 },
  ],
});

await submit.click();
await page.waitForURL(/\/organizer\/competitions\/[^/]+$/, { timeout: 60000 });
await settle(page, 2500);
const cid = page.url().split("/").pop();
saveState({ cid });

await region(page, "16-tableau-de-bord", content(page), {
  marks: [
    { loc: page.getByText("Mise en place", { exact: true }).locator("xpath=../.."), n: 1 },
    { loc: page.getByText("Statut", { exact: true }).locator("xpath=.."), n: 2 },
  ],
});

await ctx.close();
