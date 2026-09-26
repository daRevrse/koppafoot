// Chapitre 6 : le match — pronostic, suivi, composition, résultat.
import { open, go, shot, region, settle, loadState, corps, PHONE, PHONE_LAND } from "./lib.mjs";
import { setClockAmical } from "./admin.mjs";
const { matchId: mid } = loadState();
const TITULAIRES = ["Dodzi Ahadji", "Enyonam Kpodar", "Yao Lawson", "Messan Klutse", "Koffi Dossou",
  "Selom Adjo", "Fiifi Attiogbé", "Atsu Sodji", "Kodjo Amégan", "Kafui Mensah", "Ekoué Bawa"];

// ---- Avant le match : la fiche, le pronostic, la cloche
let { ctx, page } = await open("kafui");
await go(page, `/matches/${mid}`);
await settle(page, 2500);
const sondage = page.locator("section", { has: page.getByText("Qui gagne ?", { exact: true }) }).first();
const cloche = page.getByRole("button", { name: "Suivre ce match" }).first();
await region(page, "27-fiche-match", corps(page), {
  bas: sondage,
  marks: [
    { loc: cloche, n: 1, badge: "top" },
    { loc: page.getByRole("tab", { name: /Composition/ }), n: 2, badge: "top" },
    { loc: sondage, n: 3 },
  ],
});
await sondage.getByRole("button", { name: /Avenir d'Adakpamé/ }).click();
await settle(page, 1500);
await cloche.click();
await settle(page, 1500);
await region(page, "28-pronostic", sondage, { margin: 16 });
await ctx.close();

// ---- Les deux managers remplissent leur feuille (guide manager, chapitre 7).
async function feuille(profil, titulaires) {
  const { ctx, page } = await open(profil);
  await go(page, `/matches/${mid}`);
  await settle(page, 2000);
  await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
  await settle(page, 1000);
  await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
  await settle(page, 1200);
  if (titulaires) {
    const roles = page.locator('select[aria-label^="Rôle de "]');
    const noms = await roles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace("Rôle de ", "")));
    for (const n of noms) await page.getByLabel(`Rôle de ${n}`).selectOption("substitute");
    for (const n of titulaires) await page.getByLabel(`Rôle de ${n}`).selectOption("starter");
    await page.getByRole("button", { name: "4-4-2", exact: true }).click();
  }
  await page.getByRole("button", { name: /Envoyer à l'arbitre/i }).click();
  await settle(page, 2500);
  await ctx.close();
}
await feuille("edem", TITULAIRES);
await feuille("kokou", null);

({ ctx, page } = await open("kafui"));
await go(page, `/matches/${mid}`);
await settle(page, 2000);
await page.getByRole("tab", { name: /Composition/ }).click();
await settle(page, 2000);
const terrain = page.locator("svg").filter({ has: page.locator("text", { hasText: "K. Mensah" }) }).first();
await region(page, "29-composition", corps(page), {
  bas: terrain,
  marks: [{ loc: page.locator("g", { has: page.locator("text", { hasText: "K. Mensah" }) }).last(), n: 1, pad: 4, badge: "right" }],
});
await ctx.close();

// ---- Le match est joué, en coulisses (Kafui marque et finit homme du match).
({ ctx, page } = await open("edem", PHONE));
await go(page, `/matches/${mid}/manage`);
await settle(page, 3000);
await page.getByRole("button", { name: /Coup d'envoi/i }).click();
await settle(page, 2500);
await ctx.close();
({ ctx, page } = await open("edem", PHONE_LAND));
await go(page, `/matches/${mid}/manage`);
await settle(page, 2500);
const joueur = (nom) => page.getByRole("button", { name: `${nom}, actions` }).first();
const modal = () => page.locator(".modal-layer").last();
async function but(buteur, passeur, minute) {
  await setClockAmical(mid, minute);
  await settle(page, 1200);
  await joueur(buteur).click();
  await settle(page, 700);
  await modal().getByRole("button", { name: /But$/ }).first().click();
  await settle(page, 900);
  await modal().getByRole("button", { name: passeur ? new RegExp(passeur) : /Aucune passe/ }).first().click();
  await settle(page, 1500);
}
await page.getByRole("button", { name: /^Lancer$/i }).first().click();
await settle(page, 1000);
await but("Kafui Mensah", "Selom Adjo", 24);
await setClockAmical(mid, 45);
await settle(page, 2500);
await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
await settle(page, 1500);
await page.getByRole("button", { name: /^Reprise$/i }).first().click();
await settle(page, 1500);
// Le bouton « But » reste verrouillé quelques secondes après un but.
await page.waitForTimeout(32000);
await but("Ekoué Bawa", "Kafui Mensah", 63);
await page.waitForTimeout(32000);
await but("Tchao Assiongbon", null, 78);
await setClockAmical(mid, 90);
await settle(page, 2500);
await page.getByRole("button", { name: /Fin du match/i }).first().click();
await settle(page, 1000);
await page.getByRole("button", { name: /Coup de sifflet final/i }).first().click();
await settle(page, 2500);
await modal().locator("button", { hasText: "Kafui Mensah" }).first().click();
await settle(page, 3500);
await ctx.close();

// ---- Après le match
({ ctx, page } = await open("kafui"));
await go(page, `/matches/${mid}`);
await settle(page, 2500);
const hdm = page.getByText(/Homme du match/i).first().locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(page, "30-apres-match", corps(page), {
  bas: page.getByText(/Coup d'envoi/i).last(),
  maxHeight: 2600,
  marks: [
    { loc: page.getByText(/Kafui Mensah\s*\d+'/).first(), n: 1, badge: "top", pad: 3 },
    { loc: hdm, n: 2 },
  ],
});
await ctx.close();
