// Décor : le match amical est joué, sans aucune capture.
// Le guide ne montre pas la console live (c'est l'affaire du guide
// organisateur) ; l'après-match a seulement besoin d'un match terminé, avec
// ses buts, son carton et son homme du match.
import { open, go, settle, loadState, PHONE, PHONE_LAND } from "./lib.mjs";
import { setClockAmical } from "./admin.mjs";
const { matchId: mid } = loadState();
const CONSOLE = `/matches/${mid}/manage`;

// Les deux feuilles sont validées depuis la fiche du match : coup d'envoi.
let { ctx, page } = await open("edem-tel", PHONE);
await go(page, CONSOLE);
await settle(page, 3000);
await page.getByRole("button", { name: /Coup d'envoi/i }).click();
await settle(page, 2500);
await ctx.close();

({ ctx, page } = await open("edem-tel", PHONE_LAND));
await go(page, CONSOLE);
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
await setClockAmical(mid, 33);
await settle(page, 1200);
await joueur("Kossivi Amegah").click();
await settle(page, 700);
await modal().getByRole("button", { name: /Carton jaune/ }).click();
await settle(page, 1500);

// Mi-temps : le chrono s'arrête seul à la 45e.
await setClockAmical(mid, 45);
await settle(page, 2500);
await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
await settle(page, 1500);
await page.getByRole("button", { name: /^Reprise$/i }).first().click();
await settle(page, 1500);

await setClockAmical(mid, 58);
await settle(page, 1200);
await joueur("Atsu Sodji").click();
await settle(page, 700);
await modal().getByRole("button", { name: /Remplacer/ }).click();
await settle(page, 1000);
await modal().getByRole("button", { name: /Folly Akue/ }).first().click();
await settle(page, 1500);
await but("Ekoué Bawa", null, 63);
// Le bouton « But » reste verrouillé quelques secondes après un but.
await page.waitForTimeout(32000);
await but("Tchao Assiongbon", "Mensah Lawani", 78);

await setClockAmical(mid, 90);
await settle(page, 2500);
await page.getByRole("button", { name: /Fin du match/i }).first().click();
await settle(page, 1000);
await page.getByRole("button", { name: /Coup de sifflet final/i }).first().click();
await settle(page, 2500);
// L'homme du match se désigne dans la foulée, sur le même écran.
await modal().locator("button", { hasText: "Kafui Mensah" }).first().click();
await settle(page, 3500);
await ctx.close();
console.log("match joué");
