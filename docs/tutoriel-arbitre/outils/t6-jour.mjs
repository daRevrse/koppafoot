// Chapitre 6 : le jour du match. Avant le coup d'envoi, Komi regarde où en
// sont les feuilles de match ; et il se désiste du match du dimanche.
import { open, go, settle, shot, region, loginUI, loadState, BUREAU } from "./lib.mjs";
import { KOKOU, MATCH_B } from "./roster.mjs";

const { matchA } = loadState();
const { ctx, page } = await open("komi", BUREAU);

// La console, avant le coup d'envoi : les deux feuilles, et le bouton qui
// attend qu'elles soient validées.
await go(page, `/matches/${matchA}/manage`);
await settle(page, 3500);
await shot(page, "30-console-avant-match", {
  marks: [
    { loc: page.getByText("Valide les deux feuilles pour lancer le match."), n: 1 },
    { loc: page.getByRole("button", { name: /Coup d'envoi/i }), n: 2, badge: "top" },
  ],
});

// Se désister du match du dimanche.
await go(page, "/designations");
await settle(page, 2500);
const carteB = page.locator("div.overflow-hidden").filter({ hasText: MATCH_B.adversaire }).filter({ has: page.getByRole("button", { name: /Me désister/ }) }).first();
await region(page, "31-desister", carteB, {
  margin: 24,
  marks: [{ loc: carteB.getByRole("button", { name: /Me désister/ }), n: 1, badge: "top" }],
});
page.once("dialog", (d) => d.accept());
await carteB.getByRole("button", { name: /Me désister/ }).click();
await settle(page, 2500);
await ctx.close();

// Kokou est prévenu, et son match cherche de nouveau un arbitre.
const kk = await open("kokou", BUREAU);
await loginUI(kk.page, KOKOU.email, KOKOU.mdp);
await go(kk.page, "/notifications");
await settle(kk.page, 2000);
const notif = kk.page.getByText("Arbitre désisté").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
await region(kk.page, "32-manager-desistement", notif, { margin: 16, hideHeader: false, marks: [{ loc: notif, n: 1, badge: "top" }] });
await kk.ctx.close();
