// Chapitre 5 : préparer la saison — composition type, entraînements.
import { open, go, shot, region, settle, loadState, modale, corps, loginUI, PHONE } from "./lib.mjs";
const { teamUrl } = loadState();

const ONZE = {
  G: ["Dodzi Ahadji"],
  D: ["Enyonam Kpodar", "Yao Lawson", "Messan Klutse", "Koffi Dossou"],
  M: ["Selom Adjo", "Fiifi Attiogbé", "Atsu Sodji", "Kodjo Amégan"],
  A: ["Kafui Mensah", "Ekoué Bawa"],
};
const BANC = ["Mawuena Doe", "Folly Akue", "Komlan Tepe"];

let { ctx, page } = await open("edem");
await go(page, teamUrl);
await page.getByRole("button", { name: /^Compositions/ }).first().click();
await settle(page, 1500);
const libres = () => page.locator('[aria-label^="Emplacement libre"]');
const selecteur = () => page.locator(".modal-layer").last();
const pas = page.getByText("Formation", { exact: true }).first().locator("xpath=..");
await region(page, "25-compositions", corps(page), {
  maxHeight: 1600,
  marks: [
    { loc: page.getByText("Format", { exact: true }).first().locator("xpath=.."), union: pas, n: 1 },
    { loc: libres().first(), n: 2, pad: 8 },
  ],
});

// Le gardien d'abord, pour la capture du sélecteur.
const gardien = page.locator('[aria-label^="Emplacement libre, G"]').first();
await gardien.click();
await settle(page, 800);
await shot(page, "26-choisir-joueur", {
  marks: [{ loc: selecteur().getByRole("button", { name: /Dodzi Ahadji/ }), n: 1 }],
});
await selecteur().getByRole("button", { name: /Dodzi Ahadji/ }).click();
await settle(page, 500);
const restants = { G: [], D: [...ONZE.D], M: [...ONZE.M], A: [...ONZE.A] };
let garde = 0;
while ((await libres().count()) && garde++ < 15) {
  const place = libres().first();
  const poste = (await place.getAttribute("aria-label")).match(/Emplacement libre, (\w)/)[1];
  const nom = restants[poste].shift();
  await place.click();
  await settle(page, 400);
  await selecteur().getByRole("button", { name: new RegExp(nom) }).click();
  await settle(page, 400);
}
for (const nom of BANC) {
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await settle(page, 400);
  await selecteur().getByRole("button", { name: new RegExp(nom) }).click();
  await settle(page, 400);
}
const enregistrer = page.getByRole("button", { name: /^Enregistrer$/ }).last();
await region(page, "27-composition-type", corps(page), {
  maxHeight: 1600,
  marks: [
    { loc: page.locator('button[title^="Retirer Mawuena"]').locator("xpath=.."), n: 1 },
    { loc: enregistrer, n: 2 },
  ],
});
await enregistrer.click();
await settle(page, 1500);

// Le créneau de chaque semaine
await page.getByRole("button", { name: /^Paramètres/ }).first().click();
await settle(page, 1500);
const planning = page.getByText("Planning d'entraînement", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border')][1]");
await planning.locator("select").selectOption({ label: "Mercredi" });
await planning.locator('input[type="time"]').fill("18:30");
await page.getByPlaceholder("Stade municipal").fill("Terrain d'Adakpamé");
await page.getByPlaceholder("Tactique, Physique...").fill("Physique et jeu");
await region(page, "28-creneau-hebdo", planning, {
  margin: 24,
  marks: [
    { loc: planning.locator("select"), union: planning.locator('input[type="time"]'), n: 1 },
    { loc: page.getByPlaceholder("Stade municipal"), union: page.getByPlaceholder("Tactique, Physique..."), n: 2 },
    { loc: planning.getByRole("button", { name: /Ajouter/ }), n: 3 },
  ],
});
await planning.getByRole("button", { name: /Ajouter/ }).click();
await settle(page, 1500);

// Une séance ponctuelle
await page.getByRole("button", { name: /^Entraînements/ }).first().click();
await settle(page, 1200);
await page.getByRole("button", { name: /Créer un entraînement/ }).click();
await settle(page, 800);
const t = modale(page);
await page.getByPlaceholder("Ex: Entraînement tactique").fill("Mise en place avant Tokoin");
await t.locator('input[type="date"]').fill("2026-10-03");
await t.locator('input[type="time"]').fill("16:00");
await page.getByPlaceholder("Ex: Stade municipal").fill("Terrain d'Adakpamé");
await t.locator("textarea").fill("Coups de pied arrêtés et placement défensif. Venez en tenue.");
await shot(page, "29-seance-ponctuelle", {
  marks: [
    { loc: page.getByPlaceholder("Ex: Entraînement tactique"), n: 1 },
    { loc: t.locator('input[type="date"]'), union: t.locator('input[type="time"]'), n: 2 },
    { loc: page.getByPlaceholder("Ex: Stade municipal"), n: 3 },
    { loc: t.getByRole("button", { name: /Créer|Programmer|Enregistrer/ }).last(), n: 4 },
  ],
});
await t.getByRole("button", { name: /Créer|Programmer|Enregistrer/ }).last().click();
await settle(page, 2000);
await ctx.close();

// Côté joueur : Kafui confirme sa présence.
({ ctx, page } = await open("kafui", PHONE));
await go(page, teamUrl);
await settle(page, 1500);
await page.getByRole("button", { name: /^Entraînements/ }).first().click();
await settle(page, 1500);
const present = page.getByRole("button", { name: /Présent/ }).first();
await present.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 120));
await shot(page, "30-joueur-seance", { marks: [{ loc: present, n: 1, badge: "top" }] });
await present.click();
await settle(page, 1500);
await ctx.close();

({ ctx, page } = await open("edem"));
await go(page, teamUrl);
await page.getByRole("button", { name: /^Entraînements/ }).first().click();
await settle(page, 2000);
await region(page, "31-seances", corps(page), {
  maxHeight: 1400,
  marks: [{ loc: page.getByText(/confirmés/).first(), n: 1, badge: "top" }],
});
await ctx.close();
