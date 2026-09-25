// Chapitre 4 : la vie de l'équipe — la page du club, les entraînements.
import { open, go, shot, region, settle, loadState, saveState, corps, PHONE, loginUI } from "./lib.mjs";
import { setSquadNumbers, createTraining, uidOf } from "./admin.mjs";
const { teamId, teamUrl } = loadState();

// Le manager donne son numéro à Kafui et programme une séance (guide manager, chapitres 4 et 5).
const kafui = await uidOf("kafui.mensah@example.com");
saveState({ kafuiUid: kafui });
await setSquadNumbers(teamId, { [kafui]: "9" });
await createTraining({
  teamId, title: "Mise en place avant Tokoin", date: "2026-10-03", time: "16:00",
  location: "Terrain d'Adakpamé", description: "Coups de pied arrêtés et placement défensif. Venez en tenue.",
});

let { ctx, page } = await open("kafui");
await go(page, teamUrl);
await settle(page, 2500);
const maLigne = page.locator("div", { has: page.getByText("Kafui Mensah", { exact: true }) })
  .filter({ has: page.getByText("N°9") }).last();
await region(page, "19-page-equipe", corps(page), {
  bas: maLigne,
  marks: [
    { loc: page.getByRole("button", { name: /^À propos/ }).first(), union: page.getByRole("button", { name: /^Galerie/ }).first(), n: 1, pad: 6 },
    { loc: maLigne, n: 2 },
  ],
});
await ctx.close();

// Sur téléphone : répondre à la séance.
({ ctx, page } = await open("kafui-tel", PHONE));
await go(page, teamUrl);
await settle(page, 2000);
await page.getByRole("button", { name: /^Entraînements/ }).first().click();
await settle(page, 1500);
const present = page.getByRole("button", { name: /Présent/ }).first();
await present.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 120));
await shot(page, "20-seance", {
  marks: [
    { loc: present, n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /Absent/ }).first(), n: 2, badge: "right" },
  ],
});
await present.click();
await settle(page, 2000);
await page.evaluate(() => window.scrollBy(0, -60));
await shot(page, "21-seance-confirmee", {
  marks: [{ loc: page.getByText(/confirmés/).first(), n: 1, badge: "top", pad: 3 }],
});
await ctx.close();
