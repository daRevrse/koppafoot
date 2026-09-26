// Chapitre 4 : répondre à une invitation. Kokou cherche un arbitre pour son
// match du dimanche et invite Komi ; Komi accepte.
import { open, go, settle, region, loginUI, BUREAU } from "./lib.mjs";
import { KOKOU, MATCH_B } from "./roster.mjs";

// Côté Kokou : « Trouver un arbitre », sur la carte du match.
const kk = await open("kokou", BUREAU);
await loginUI(kk.page, KOKOU.email, KOKOU.mdp);
await go(kk.page, "/matches");
await settle(kk.page, 2500);
const carteB = kk.page.locator("div.group").filter({ hasText: MATCH_B.adversaire }).first();
await carteB.getByRole("button", { name: "Trouver un arbitre" }).click();
await settle(kk.page, 2500);
const fenetre = kk.page.locator('[role="dialog"]');
const ligneKomi = fenetre.locator("li").filter({ hasText: "Komi Adjovi" }).first();
await region(kk.page, "20-manager-cherche", fenetre, {
  margin: 20, hideHeader: false,
  marks: [
    { loc: ligneKomi.getByText(/Sifflets du Golfe/), n: 1 },
    { loc: ligneKomi.getByRole("button", { name: "Inviter" }), n: 2, badge: "top" },
  ],
});
await ligneKomi.getByRole("button", { name: "Inviter" }).click();
await settle(kk.page, 2500);
await kk.ctx.close();

// Côté Komi : l'invitation passe devant tout le reste.
const { ctx, page } = await open("komi", BUREAU);
await go(page, "/notifications");
await settle(page, 2000);
const notif = page.getByText("On te propose un match").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
await region(page, "21-notif-invitation", notif, { margin: 16, hideHeader: false, marks: [{ loc: notif, n: 1, badge: "top" }] });
await go(page, "/designations");
await settle(page, 2500);
const invitations = page.getByText("On te demande d'arbitrer").locator("xpath=ancestor::section[1]");
await region(page, "22-invitation", invitations, {
  margin: 24,
  marks: [
    { loc: invitations.getByRole("button", { name: /^Accepter$/ }), n: 1, badge: "top" },
    { loc: invitations.getByRole("button", { name: /Décliner/ }), n: 2, badge: "top" },
  ],
});
await invitations.getByRole("button", { name: /^Accepter$/ }).click();
await settle(page, 2500);
await ctx.close();
