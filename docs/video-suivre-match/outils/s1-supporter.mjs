// Le match, sur le téléphone d'Elikem : il ne sera pas au stade. Il ouvre la
// fiche, touche la cloche, et la garde ouverte tout le match. La console se
// tient en coulisses, comme dans la vidéo manager : elle n'est pas l'objet de
// la vidéo. Ce qu'elle envoie aux abonnés (les notifications) est redessiné
// dans l'animation, mot pour mot.
import { open, go, settle, shot, cible, loadState, loginUI, PHONE, PHONE_LAND } from "./lib.mjs";
import { setClockAmical } from "./admin.mjs";
import { EDEM, KOKOU, TITULAIRES, TOKOIN, SUPPORTER } from "./roster.mjs";
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
  const roles = page.locator('select[aria-label^="Rôle de "]');
  const noms = await roles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace("Rôle de ", "")));
  for (const n of noms) await page.getByLabel(`Rôle de ${n}`).selectOption("substitute");
  for (const n of titulaires) await page.getByLabel(`Rôle de ${n}`).selectOption("starter");
  await page.getByRole("button", { name: "4-4-2", exact: true }).click().catch(() => {});
  await settle(page, 800);
  await page.getByRole("button", { name: /Envoyer à l'arbitre|Valider la feuille/i }).first().click();
  await settle(page, 2500);
  await ctx.close();
}
await feuille("edem", EDEM, TITULAIRES);
await feuille("kokou", KOKOU, TOKOIN.slice(0, 11).map(([p, n]) => `${p} ${n}`));

// Elikem ouvre la fiche, et touche la cloche.
const f = await open("elikem", PHONE);
await loginUI(f.page, SUPPORTER.email, SUPPORTER.mdp);
await go(f.page, `/matches/${mid}`);
await settle(f.page, 3000);
const cloche = f.page.getByRole("button", { name: "Suivre ce match" }).first();
await cible(f.page, "01-fiche-avant", cloche);
await shot(f.page, "01-fiche-avant");
await cloche.click();
// Le pointeur s'en va : posé sur le message, il le retiendrait à l'écran
// pour tout le reste du match.
await f.page.mouse.move(195, 760);
await f.page.getByText("Tu suis ce match").first().waitFor({ timeout: 10000 });
await f.page.waitForTimeout(700);
await shot(f.page, "02-fiche-suivie");
const filmer = async (nom) => {
  await settle(f.page, 3000);
  await f.page.evaluate(() => window.scrollTo(0, 0));
  await settle(f.page, 500);
  await shot(f.page, nom);
};
/** Le fil du match, sous le tableau d'affichage. `repere` : la ligne que la vidéo entoure. */
const fil = async (nom, repere) => {
  await f.page.evaluate(() => window.scrollTo(0, 0));
  await settle(f.page, 400);
  const h = f.page.getByText("Historique", { exact: true }).first();
  await h.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 230));
  await settle(f.page, 1200);
  // La vidéo souligne toute la ligne, à la hauteur de ce repère.
  if (repere) await cible(f.page, nom, repere);
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
await filmer("03-fiche-direct");

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

// Le chrono à 22 minutes écoulées : la console note la 23e.
await but("Kafui Mensah", "Selom Adjo", 22);
await filmer("04-fiche-1-0");

// Un carton jaune pour Tokoin : sur la fiche, pas sur le téléphone (un jaune
// ne sonne pas, voir LiveMatchConsole).
await setClockAmical(mid, 36);
await settle(page, 1200);
await joueur("Elom Dogbe").click();
await settle(page, 700);
await modal().getByRole("button", { name: /Carton jaune/ }).first().click();
await settle(page, 1500);
await fil("05-fil-jaune");

// Mi-temps.
await setClockAmical(mid, 45);
await settle(page, 2500);
await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
await settle(page, 1500);
await filmer("06-fiche-mi-temps");
await page.getByRole("button", { name: /^Reprise$/i }).first().click();
await settle(page, 1500);

await page.waitForTimeout(32000); // le bouton « But » reste verrouillé après un but
await but("Ekoué Bawa", "Kafui Mensah", 66);
await filmer("07-fiche-2-0");
await fil("07b-fil-2-0");

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
await filmer("08-fiche-finale");
await fil("08b-fil-final", f.page.getByText("Carton jaune", { exact: true }).first());
await f.ctx.close();
console.log("match joué");
