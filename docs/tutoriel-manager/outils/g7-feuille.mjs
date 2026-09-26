// Chapitre 7 : avant le match — la fiche du match et la feuille de match.
import { open, go, shot, region, settle, loadState, corps } from "./lib.mjs";
const { matchId } = loadState();
const TITULAIRES = ["Dodzi Ahadji", "Enyonam Kpodar", "Yao Lawson", "Messan Klutse", "Koffi Dossou",
  "Selom Adjo", "Fiifi Attiogbé", "Atsu Sodji", "Kodjo Amégan", "Kafui Mensah", "Ekoué Bawa"];

let { ctx, page } = await open("edem");
await go(page, `/matches/${matchId}`);
await settle(page, 2500);
const remplir = page.getByRole("button", { name: /Remplir la feuille de match/i }).first();
await region(page, "42-fiche-match", corps(page), {
  bas: remplir.locator("xpath=ancestor::div[contains(@class,'border')][1]"),
  marks: [{ loc: remplir, n: 1 }],
});

await remplir.click();
await settle(page, 1000);
await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
await settle(page, 1200);
const roles = page.locator('select[aria-label^="Rôle de "]');
const noms = await roles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace("Rôle de ", "")));
for (const n of noms) await page.getByLabel(`Rôle de ${n}`).selectOption("substitute");
for (const n of TITULAIRES) await page.getByLabel(`Rôle de ${n}`).selectOption("starter");
await page.getByRole("button", { name: "4-4-2", exact: true }).click();
await settle(page, 800);
const editeur = page.locator("div.bg-gray-900").filter({ hasText: "Configuration Tactique" }).first();
const listeTitre = editeur.getByText(/Effectif du match/i).first();
// La feuille est très haute : deux captures, le terrain puis la liste.
await region(page, "43a-feuille-terrain", editeur, {
  bas: listeTitre,
  margin: 20,
  marks: [
    { loc: page.getByRole("button", { name: "4-4-2", exact: true }), n: 1, badge: "top" },
    { loc: editeur.getByText(/Titulaires ·/).first().locator("xpath=.."), n: 2 },
  ],
});
await region(page, "43b-feuille-joueurs", editeur, {
  depuis: listeTitre,
  margin: 20,
  maxHeight: 2400,
  marks: [
    { loc: page.getByLabel(`Dossard de ${noms[0]}`), union: page.getByLabel(`Dossard de ${noms.at(-1)}`), n: 3, pad: 1 },
    { loc: page.getByLabel(`Poste de ${noms[0]}`), union: page.getByLabel(`Poste de ${noms.at(-1)}`), n: 4, badge: "top", pad: 1 },
    { loc: page.getByLabel(`Rôle de ${noms[0]}`), union: page.getByLabel(`Rôle de ${noms.at(-1)}`), n: 5, badge: "right", pad: 1 },
    { loc: page.getByRole("button", { name: /Envoyer à l'arbitre/i }), n: 6 },
  ],
});
await page.getByRole("button", { name: /Envoyer à l'arbitre/i }).click();
await settle(page, 2500);
const validee = page.getByText("Feuille de match validée", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(page, "44-feuille-validee", corps(page), {
  bas: validee,
  maxHeight: 2000,
  marks: [{ loc: validee, n: 1 }],
});
await ctx.close();

// En face, Kokou remplit la sienne (onze premiers titulaires, le reste au banc).
({ ctx, page } = await open("kokou"));
await go(page, `/matches/${matchId}`);
await settle(page, 2000);
await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
await settle(page, 1000);
await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
await settle(page, 1200);
await page.getByRole("button", { name: /Envoyer à l'arbitre/i }).click();
await settle(page, 2500);
console.log("Tokoin :", (await page.getByText("Feuille de match validée").count()) ? "feuille validée" : "?");
await ctx.close();
