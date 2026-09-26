// Chapitre 3 : l'espace terrain, et la fiche complétée.
import path from "node:path";
import { open, go, shot, region, settle, loadState, corps } from "./lib.mjs";
import { TERRAIN } from "./roster.mjs";

const { venueId } = loadState();
const PHOTO = path.resolve("../../../public/branding/fan_terrain.png");

const { ctx, page } = await open("yawo");

// Le menu MySpace : l'espace terrain.
await go(page, "/mes-terrains");
await settle(page, 1500);
await page.locator("header").getByRole("button", { name: /MySpace/i }).first().click();
await settle(page, 800);
await shot(page, "10-menu-myspace", {
  clip: { x: 380, y: 0, width: 900, height: 300 },
  marks: [
    { loc: page.locator("header a[href='/mes-terrains']").first(), n: 1, badge: "top" },
    { loc: page.locator("header a[href='/mes-terrains/reservations']").first(), n: 2, badge: "top" },
  ],
});
await page.keyboard.press("Escape");
await go(page, "/mes-terrains");
await settle(page, 1500);

// La carte du terrain, telle que l'approbation l'a créée.
const carte = page.locator("article").filter({ hasText: TERRAIN.nom }).first();
await region(page, "11-mes-terrains", corps(page), {
  bas: carte,
  marks: [
    { loc: carte.getByText(/^Il manque/), n: 1 },
    { loc: carte.getByRole("button", { name: `Modifier ${TERRAIN.nom}` }), n: 2, badge: "top" },
    { loc: carte.getByRole("link", { name: `Voir la fiche publique de ${TERRAIN.nom}` }), n: 3, badge: "top" },
  ],
});

// Compléter la fiche.
await carte.getByRole("button", { name: `Modifier ${TERRAIN.nom}` }).click();
await settle(page, 1200);
await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
await page.waitForTimeout(2500);
await page.locator("#v-prix").fill("15000");
for (const e of ["Vestiaires", "Douches", "Éclairage", "Parking", "Buvette", "Buts avec filets"]) {
  const b = page.getByRole("group", { name: "Équipements du terrain" }).getByRole("button", { name: e });
  if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
}
const preciser = page.getByRole("button", { name: "Préciser les horaires" });
if (await preciser.count()) await preciser.click();
await page.getByLabel("Lundi, ouverture").fill("07:00");
await page.getByLabel("Lundi, fermeture").fill("23:00");
await page.getByRole("button", { name: "Le lundi pour tous les jours" }).click();
await page.locator("#v-tel").fill(TERRAIN.accueil);
await settle(page, 800);

const form = page.locator("div")
  .filter({ has: page.locator("#v-nom") })
  .filter({ has: page.getByRole("button", { name: "Enregistrer", exact: true }) })
  .last();
await region(page, "12-fiche-photo", form, {
  margin: 20,
  depuis: page.getByText("Photo de couverture"),
  bas: page.getByText(/Jusqu.à 6 vues/),
  marks: [
    { loc: page.getByText(/^(Changer la photo|Ajouter une photo)$/).first(), n: 1 },
    { loc: page.getByText(/^Autres photos/).first(), union: page.getByText(/Jusqu.à 6 vues/), n: 2 },
  ],
});
await region(page, "13-fiche-tarif", form, {
  margin: 20,
  depuis: page.getByText("Tarif horaire (FCFA)"),
  bas: page.getByRole("button", { name: "Le lundi pour tous les jours" }),
  marks: [
    { loc: page.locator("#v-prix"), n: 1 },
    { loc: page.getByRole("group", { name: "Équipements du terrain" }), n: 2 },
    { loc: page.getByLabel("Lundi, ouverture"), union: page.getByLabel("Lundi, fermeture"), n: 3 },
    { loc: page.getByRole("button", { name: "Le lundi pour tous les jours" }), n: 4, badge: "top" },
  ],
});
await region(page, "14-fiche-contact", form, {
  margin: 20,
  depuis: page.getByText("Contact montré aux équipes"),
  bas: page.getByRole("button", { name: "Enregistrer", exact: true }),
  marks: [
    { loc: page.getByText(/« Contacter le responsable » montre ton nom/), n: 1 },
    { loc: page.locator("#v-tel"), n: 2 },
    { loc: page.getByText(/^Montrer aussi mon email/), n: 3 },
    { loc: page.getByText(/^Ouvert aux demandes/), n: 4 },
    { loc: page.getByRole("button", { name: "Enregistrer", exact: true }), n: 5 },
  ],
});
await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
await page.waitForTimeout(5000);
await settle(page, 1500);
await region(page, "15-carte-complete", page.locator("article").filter({ hasText: TERRAIN.nom }).first(), { margin: 24 });

// Sa propre fiche : ses deux portes, pas le formulaire des équipes.
await go(page, `/terrains/${venueId}`);
await settle(page, 2000);
const aside = page.locator("aside#reserver");
await region(page, "17-ta-fiche", aside, {
  margin: 24,
  marks: [
    { loc: aside.getByRole("link", { name: /Réservations reçues/ }), n: 1 },
    { loc: aside.getByRole("link", { name: /Modifier la fiche/ }), n: 2 },
  ],
});
await ctx.close();

// Ce que voit une équipe : Edem, manager de l'Avenir d'Adakpamé.
const e = await open("edem");
await go(e.page, `/terrains/${venueId}`);
await settle(e.page, 2500);
await e.page.setViewportSize({ width: 1280, height: 1500 });
await settle(e.page, 800);
await shot(e.page, "16-fiche-publique", {
  clip: { x: 0, y: 60, width: 1280, height: 1150 },
  marks: [
    { loc: e.page.getByText("Ouvert aux demandes").first(), n: 1, pad: 3 },
    { loc: e.page.locator("dl").first(), n: 2 },
    { loc: e.page.getByRole("heading", { name: "Demander un créneau" }), n: 3, badge: "top" },
  ],
});
await e.page.setViewportSize({ width: 1280, height: 800 });
await e.page.getByRole("button", { name: "Contacter le responsable" }).click();
await e.page.getByRole("dialog").getByText(TERRAIN.accueil).waitFor();
await settle(e.page, 1200);
await shot(e.page, "18-contact-vu", { el: e.page.getByRole("dialog") });
await e.ctx.close();
