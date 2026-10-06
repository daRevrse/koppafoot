// Scène 4 : le jour du match. La console n'est pas l'objet de la vidéo : le
// match se joue en coulisses (feuilles, coup d'envoi, buts, coup de sifflet,
// comme dans le guide manager). On filme la fiche du match, telle que la
// suivent les joueurs et les supporters, sur leur téléphone.
import { open, go, settle, shot, loadState, loginUI, PHONE, PHONE_LAND } from "./lib.mjs";
import { setClockAmical } from "./admin.mjs";
import { EDEM, KOKOU, TITULAIRES, TOKOIN } from "./roster.mjs";
const { matchId: mid } = loadState();
const CONSOLE = `/matches/${mid}/manage`;

// Les feuilles de match, sans capture.
async function feuille(profil, compte, titulaires) {
  const { ctx, page } = await open(profil);
  await loginUI(page, compte.email, compte.mdp);
  await go(page, `/matches/${mid}`);
  await settle(page, 2500);
  await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
  await settle(page, 1000);
  await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click().catch(() => {});
  await settle(page, 1200);
  if (titulaires) {
    const roles = page.locator('select[aria-label^="Rôle de "]');
    const noms = await roles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace("Rôle de ", "")));
    for (const n of noms) await page.getByLabel(`Rôle de ${n}`).selectOption("substitute");
    for (const n of titulaires) await page.getByLabel(`Rôle de ${n}`).selectOption("starter");
    await page.getByRole("button", { name: "4-4-2", exact: true }).click().catch(() => {});
    await settle(page, 800);
  }
  await page.getByRole("button", { name: /Envoyer à l'arbitre|Valider la feuille/i }).first().click();
  await settle(page, 2500);
  await ctx.close();
}
await feuille("edem", EDEM, TITULAIRES);
// Les onze de Tokoin, écrits en clair : l'ordre par défaut de la feuille
// n'est pas fixe, et le buteur doit être sur le terrain.
await feuille("kokou", KOKOU, TOKOIN.slice(0, 11).map(([p, n]) => `${p} ${n}`));

// La fiche, sur le téléphone d'un supporter : elle reste ouverte tout le match.
const f = await open("supporter", PHONE);
await go(f.page, `/matches/${mid}`);
await settle(f.page, 2500);
await shot(f.page, "15-fiche-avant");
const filmer = async (nom) => {
  await settle(f.page, 3000);
  await f.page.evaluate(() => window.scrollTo(0, 0));
  await settle(f.page, 500);
  await shot(f.page, nom);
};

// La console, en coulisses : coup d'envoi en portrait, puis à l'horizontale.
let c = await open("edem-console", PHONE);
await loginUI(c.page, EDEM.email, EDEM.mdp);
await go(c.page, CONSOLE);
await settle(c.page, 3000);
await c.page.getByRole("button", { name: /Coup d'envoi/i }).click();
await settle(c.page, 2500);
await c.ctx.close();
c = await open("edem-console", PHONE_LAND);
const page = c.page;
await go(page, CONSOLE);
await settle(page, 3000);
const consigne = page.getByText("Touche pour continuer");
if (await consigne.count()) { await consigne.click(); await settle(page, 800); }
await page.getByRole("button", { name: /^Lancer$/i }).first().click();
await settle(page, 1500);
await setClockAmical(mid, 2);
await filmer("16-fiche-coup-envoi");

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

await but("Kafui Mensah", "Selom Adjo", 23);
await filmer("17-fiche-1-0");

// Mi-temps, puis reprise.
await setClockAmical(mid, 45);
await settle(page, 2500);
await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
await settle(page, 1500);
await page.getByRole("button", { name: /^Reprise$/i }).first().click();
await settle(page, 1500);

await page.waitForTimeout(32000); // le bouton « But » reste verrouillé après un but
await but("Tchao Assiongbon", null, 51);
await filmer("18-fiche-1-1");
await page.waitForTimeout(32000);
await but("Ekoué Bawa", "Kafui Mensah", 78);
await filmer("19-fiche-2-1");

// Le coup de sifflet final, et l'homme du match.
await setClockAmical(mid, 90);
await settle(page, 2500);
await page.getByRole("button", { name: /Fin du match/i }).first().click();
await settle(page, 1000);
await page.getByRole("button", { name: /Coup de sifflet final/i }).first().click();
await settle(page, 2500);
await modal().locator("button", { hasText: "Kafui Mensah" }).first().click();
await settle(page, 3500);
await c.ctx.close();
await filmer("20-fiche-finale");
await f.page.evaluate(() => window.scrollBy(0, 520));
await settle(f.page, 1500);
await shot(f.page, "20b-fiche-finale-fil");
await f.ctx.close();
console.log("match joué");
