// Scène 04, le match : Afi tient la console au bord du terrain (son
// téléphone à l'horizontale) ; Elikem suit la fiche, chez lui. Le réseau
// coupe pendant le deuxième but : la saisie continue, et part au retour.
import { open, go, settle, ecran, cible, loadState, loginUI, PHONE, PHONE_LAND } from "./lib.mjs";
import { setClockAmical, db } from "./admin.mjs";
import { SCOREUSE, SUPPORTER } from "./roster.mjs";
const { matchId: mid } = loadState();
const CONSOLE = `/matches/${mid}/manage`;

// Elikem garde la fiche ouverte tout le match.
const f = await open("elikem-tel", PHONE);
await loginUI(f.page, SUPPORTER.email, SUPPORTER.mdp);
await go(f.page, `/matches/${mid}`);
await settle(f.page, 3000);
const filmer = async (nom) => {
  await settle(f.page, 3000);
  await f.page.evaluate(() => scrollTo(0, 0));
  await ecran(f.page, nom);
};

// Le coup d'envoi, en portrait ; puis le téléphone passe à l'horizontale.
let c = await open("afi-console", PHONE);
await loginUI(c.page, SCOREUSE.email, SCOREUSE.mdp);
await go(c.page, CONSOLE);
await settle(c.page, 3000);
await c.page.getByRole("button", { name: /Coup d'envoi/i }).click();
await settle(c.page, 2500);
await c.ctx.close();
c = await open("afi-console", PHONE_LAND);
const page = c.page;
await go(page, CONSOLE);
await settle(page, 3000);
const consigne = page.getByText("Touche pour continuer");
if (await consigne.count()) { await consigne.click(); await settle(page, 800); }
await page.getByRole("button", { name: /^Lancer$/i }).first().click();
await settle(page, 1500);
await setClockAmical(mid, 3);
await filmer("04e-fiche-coup-envoi");

const joueur = (nom) => page.getByRole("button", { name: `${nom}, actions` }).first();
const modal = () => page.locator(".modal-layer").last();
// La console compte la minute en cours : 22:40 au chrono, c'est la 23e.
async function but(buteur, passeur, chrono, nom) {
  if (chrono != null) {
    await setClockAmical(mid, chrono);
    await settle(page, 1200);
  }
  await joueur(buteur).click();
  await settle(page, 700);
  if (nom) {
    await cible(page, nom, modal().getByRole("button", { name: /But$/ }).first());
    await ecran(page, nom);
  }
  await modal().getByRole("button", { name: /But$/ }).first().click();
  await settle(page, 900);
  await modal().getByRole("button", { name: passeur ? new RegExp(passeur) : /Aucune passe/ }).first().click();
  await settle(page, 1500);
}

// 23e : Kafui, sur une passe de Selom.
await but("Kafui Mensah", "Selom Adjo", 22, "04f-console-but");
await ecran(page, "04g-console-1-0");
await filmer("04h-fiche-1-0");

// 38e : un carton jaune pour l'Olympique de Tokoin.
try {
  await setClockAmical(mid, 38);
  await settle(page, 1200);
  await joueur("Kodjovi Agbo").click();
  await settle(page, 700);
  await modal().getByRole("button", { name: /Carton jaune|Jaune/ }).first().click();
  await settle(page, 1500);
} catch (e) { console.log("carton jaune non saisi :", e.message.slice(0, 120)); }

// La mi-temps, puis la reprise.
await setClockAmical(mid, 45);
await settle(page, 2500);
await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
await settle(page, 1500);
await filmer("04i-fiche-mi-temps");
await page.getByRole("button", { name: /^Reprise$/i }).first().click();
await settle(page, 1500);

// 67e : le réseau coupe au bord du terrain ; Afi saisit quand même.
// Le chrono est avancé avant la coupure : hors ligne, la console ne reçoit
// plus rien, et compterait encore depuis la reprise.
await page.waitForTimeout(32000); // le bouton « But » reste verrouillé après un but
await setClockAmical(mid, 66);
await settle(page, 2500);
await c.ctx.setOffline(true);
await settle(page, 1500);
await but("Kafui Mensah", "Etse Gbeassor", null);
await settle(page, 1500);
await ecran(page, "04j-console-hors-ligne");
await c.ctx.setOffline(false);
await settle(page, 6000);
await ecran(page, "04k-console-2-0");
await filmer("04l-fiche-2-0");

// Le coup de sifflet final, et l'homme du match.
await setClockAmical(mid, 90);
await settle(page, 2500);
await page.getByRole("button", { name: /Fin du match/i }).first().click();
await settle(page, 1000);
await page.getByRole("button", { name: /Coup de sifflet final/i }).first().click();
await settle(page, 2500);
const mvp = modal().locator("button", { hasText: "Kafui Mensah" }).first();
await cible(page, "04m-console-homme-du-match", mvp);
await ecran(page, "04m-console-homme-du-match");
await mvp.click();
await settle(page, 4000);
await c.ctx.close();

// La fiche finale, chez Elikem : le score, l'homme du match et sa note.
await go(f.page, `/matches/${mid}`);
await filmer("04n-fiche-finale");
const homme = f.page.getByText(/Homme du match/i).first();
if (await homme.count()) {
  await homme.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settle(f.page, 1200);
  await ecran(f.page, "04o-homme-du-match");
}
await f.ctx.close();
const m = (await db.collection("matches").doc(mid).get()).data();
console.log("match joué", m.status, m.score_home, m.score_away, m.mvp_player_name, (m.live_state?.events ?? []).map((e) => `${e.type}:${e.minute}`).join(" "));
