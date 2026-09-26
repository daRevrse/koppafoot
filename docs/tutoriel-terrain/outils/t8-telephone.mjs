// Chapitre 8 : sur téléphone.
import { open, go, shot, settle, loginUI, PHONE } from "./lib.mjs";
import { GERANT } from "./roster.mjs";

const { ctx, page } = await open("yawo-tel", PHONE);
await loginUI(page, GERANT.email, GERANT.mdp);
await go(page, "/mes-terrains");
await settle(page, 1500);
await page.getByRole("button", { name: /Espace/ }).or(page.getByRole("link", { name: /Espace/ })).last().click();
await settle(page, 1200);
// Seul le panneau du bas compte : le haut de l'écran est voilé.
await shot(page, "34-tel-espace", {
  clip: { x: 0, y: 400, width: 390, height: 444 },
  marks: [{
    loc: page.locator("a[href='/mes-terrains']:visible").last(),
    union: page.locator("a[href='/mes-terrains/reservations']:visible").last(),
    n: 1, pad: 4, badge: "top",
  }],
});
await page.keyboard.press("Escape");
await go(page, "/mes-terrains/reservations");
await settle(page, 2000);
const premiere = page.locator("section").filter({ hasText: "À venir" }).locator("li").filter({ hasText: "Edem Amouzou" }).first();
await premiere.scrollIntoViewIfNeeded();
await settle(page, 600);
await shot(page, "35-tel-reservations", {
  marks: [
    { loc: premiere.locator("a[href^='tel:']"), n: 1, badge: "top" },
    { loc: premiere.getByText("WhatsApp"), n: 2, badge: "top" },
  ],
});
await ctx.close();
