// Chapitre 8 : sur téléphone (joué avant le chapitre 7 : le match du samedi
// est encore à venir).
import { open, go, shot, settle, loginUI, PHONE } from "./lib.mjs";
import { ARBITRE } from "./roster.mjs";

const { ctx, page } = await open("komi-tel", PHONE);
await loginUI(page, ARBITRE.email, ARBITRE.mdp);
await go(page, "/designations");
await settle(page, 2500);
await page.evaluate(() => window.scrollTo(0, 0));
await shot(page, "37-tel-designations", {
  marks: [{ loc: page.getByText("Ton équipe pour ce match").first(), n: 1 }],
});
await page.getByRole("button", { name: /Espace/ }).or(page.getByRole("link", { name: /Espace/ })).last().click();
await settle(page, 1200);
await shot(page, "38-tel-espace", {
  clip: { x: 0, y: 380, width: 390, height: 464 },
  marks: [{
    loc: page.locator("a[href='/designations']:visible").last(),
    union: page.locator("a[href='/corps-arbitral']:visible").last(),
    n: 1, pad: 4, badge: "top",
  }],
});
await ctx.close();
