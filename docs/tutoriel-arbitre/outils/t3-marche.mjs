// Chapitre 3 : trouver un match. Komi se porte candidat sur l'amical du
// samedi ; Edem, le manager, accepte à l'écran.
import { open, go, settle, region, loginUI, loadState, BUREAU } from "./lib.mjs";
import { EDEM } from "./roster.mjs";

const { matchA } = loadState();
const { ctx, page } = await open("komi", BUREAU);
await go(page, "/designations");
await settle(page, 2500);
const vide = page.getByText("Aucune désignation pour le moment").locator("xpath=ancestor::div[contains(@class,'border-dashed')][1]");
await region(page, "15-designations-vide", vide, {
  margin: 24, depuis: page.getByRole("heading", { name: "Mes désignations" }),
  marks: [{ loc: vide.getByRole("button", { name: /Trouver un match à arbitrer/ }), n: 1, badge: "top" }],
});
await vide.getByRole("button", { name: /Trouver un match à arbitrer/ }).click();
await settle(page, 2500);

const carteA = page.locator("div.overflow-hidden").filter({ hasText: "Olympique de Tokoin" }).filter({ hasText: "Avenir d'Adakpamé" }).first();
const liste = carteA.locator("xpath=ancestor::div[contains(@class,'space-y-4')][1]");
await region(page, "16-marche", liste, {
  margin: 24,
  marks: [
    { loc: page.getByRole("button", { name: "Lomé", exact: true }), union: page.getByRole("button", { name: "Partout" }), n: 1, badge: "top" },
    { loc: carteA.getByRole("button", { name: "Me porter candidat" }), n: 2, badge: "top" },
  ],
});
await carteA.getByRole("button", { name: "Me porter candidat" }).click();
await settle(page, 2000);
await page.getByRole("button", { name: /Mes matchs/ }).first().click();
await settle(page, 1500);
const candidature = page.getByText("Candidatures envoyées").locator("xpath=ancestor::section[1]");
await region(page, "17-candidature-envoyee", candidature, {
  margin: 24,
  marks: [
    { loc: candidature.getByText("Réponse du manager"), n: 1 },
    { loc: candidature.getByRole("button", { name: "Retirer ma candidature" }), n: 2, badge: "top" },
  ],
});
await ctx.close();

// Côté Edem : la candidature arrive sur la carte du match.
const e = await open("edem", BUREAU);
await loginUI(e.page, EDEM.email, EDEM.mdp);
await go(e.page, "/matches");
await settle(e.page, 2500);
const carteEdem = e.page.locator("div.group").filter({ hasText: "Un arbitre se propose" }).first();
await region(e.page, "18-cote-manager-candidature", carteEdem, {
  margin: 24,
  marks: [
    { loc: carteEdem.getByRole("link", { name: "Komi Adjovi" }), n: 1, badge: "top" },
    { loc: carteEdem.getByRole("button", { name: "Accepter l'arbitre" }), n: 2, badge: "top" },
    { loc: carteEdem.getByRole("button", { name: "Refuser" }), n: 3, badge: "top" },
  ],
});
await carteEdem.getByRole("button", { name: "Accepter l'arbitre" }).click();
await settle(e.page, 2500);
await e.ctx.close();

// Komi est prévenu.
const k = await open("komi", BUREAU);
await go(k.page, "/notifications");
await settle(k.page, 2000);
const notif = k.page.getByText("Tu arbitres ce match").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
await region(k.page, "19-notif-confirme", notif, { margin: 16, hideHeader: false, marks: [{ loc: notif, n: 1, badge: "top" }] });
await k.ctx.close();
void matchA;
