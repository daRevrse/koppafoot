// Chapitre 6 : bloquer ses créneaux, et voir sa semaine.
import { open, go, region, settle, loadState } from "./lib.mjs";
import { JEUDI, JEUDI_FIN } from "./roster.mjs";

const { venueId } = loadState();
const { ctx, page } = await open("yawo");
await go(page, "/mes-terrains/reservations");
await settle(page, 1500);

// Les habitués du jeudi : douze semaines d'un coup.
await page.getByRole("button", { name: /Bloquer un créneau/ }).click();
await settle(page, 800);
const form = page.locator("div.border").filter({ hasText: "Un créneau pris hors de KoppaFoot" }).first();
await form.locator("#b-date").fill(JEUDI);
await form.locator("#b-heure").fill("19:00");
await form.getByRole("radio", { name: "2 h" }).click();
await form.getByText(/^Chaque semaine, le/).click();
await form.locator("#b-jusqua").fill(JEUDI_FIN);
await form.locator("#b-note").fill("Les habitués du jeudi");
await settle(page, 600);
await region(page, "28-bloquer", form, {
  margin: 20,
  marks: [
    { loc: form.locator("#b-date"), union: form.locator("#b-heure"), n: 1 },
    { loc: form.getByRole("radiogroup"), n: 2 },
    { loc: form.getByText(/^Chaque semaine, le/), n: 3 },
    { loc: form.locator("#b-jusqua"), n: 4 },
    { loc: form.locator("#b-note"), n: 5 },
    { loc: form.getByRole("button", { name: /^Bloquer \d+ créneaux$/ }), n: 6 },
  ],
});
await form.getByRole("button", { name: /^Bloquer \d+ créneaux$/ }).click();
await settle(page, 2500);

const serie = page.locator("section").filter({ hasText: "À venir" }).locator("li").filter({ hasText: "Les habitués du jeudi" }).first();
await region(page, "29-serie", serie, {
  margin: 24,
  marks: [
    { loc: serie.getByText(/^Chaque jeudi/), n: 1 },
    { loc: serie.getByRole("button", { name: "Débloquer ce jour" }), n: 2, badge: "top" },
    { loc: serie.getByRole("button", { name: "Débloquer la série" }), n: 3, badge: "top" },
  ],
});

// La semaine : ce qui est pris, ce qui reste libre.
await page.getByRole("button", { name: /^Semaine$/ }).click();
await settle(page, 1000);
await page.getByRole("button", { name: "Semaine suivante" }).click();
await settle(page, 1200);
const planning = page.locator("div.mt-6.border").filter({ has: page.getByRole("button", { name: "Semaine suivante" }) }).first();
await region(page, "30-semaine", planning, {
  margin: 20,
  marks: [
    { loc: page.getByRole("button", { name: "Semaine suivante" }), union: page.getByRole("button", { name: "Semaine précédente" }), n: 1, badge: "top" },
    { loc: page.getByText(/Touche un créneau libre pour le bloquer/), n: 2, badge: "top" },
  ],
});
await ctx.close();

// Ce que la fiche montre aux équipes : occupé, sans nom ni motif.
const e = await open("edem");
await go(e.page, `/terrains/${venueId}`);
await settle(e.page, 2500);
const deja = e.page.getByText("Déjà réservé").first().locator("xpath=..");
await region(e.page, "31-deja-reserve", deja, {
  margin: 20,
  marks: [{ loc: deja, n: 1, badge: "top" }],
});
await e.ctx.close();
