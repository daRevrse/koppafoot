// Chapitre 1 : créer son compte de manager, trouver ses outils.
import { open, go, shot, region, settle, loginUI, PHONE } from "./lib.mjs";
import { createPlayer } from "./admin.mjs";
import { JOUEURS } from "./roster.mjs";

// Le décor : des joueurs déjà inscrits, que le manager recrutera au chapitre 3.
for (const j of JOUEURS) await createPlayer(j);

let { ctx, page } = await open("edem");
await go(page, "/roles");
// La page des rôles a un bandeau haut de 88 % de l'écran : pas de capture
// « zone » ici (elle agrandirait le bandeau avec la fenêtre), on vise la
// section des affiches dans une fenêtre juste assez haute.
const affiches = page.locator("section#ouverts");
await page.setViewportSize({ width: 1280, height: 1120 });
await affiches.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
await settle(page, 1500);
const bA = await affiches.boundingBox();
await shot(page, "01-choisir-manager", {
  clip: { x: 0, y: bA.y, width: 1280, height: Math.min(bA.height, 1120 - bA.y) },
  marks: [{ loc: affiches.getByRole("link", { name: "Devenir manager" }).first(), n: 1, badge: "top" }],
});
await page.setViewportSize({ width: 1280, height: 800 });
await affiches.getByRole("link", { name: "Devenir manager" }).first().click();
await page.waitForURL(/signup/);
await settle(page, 1500);
await page.fill("#firstName", "Edem");
await page.fill("#lastName", "Amouzou");
await page.fill("#signupEmail", "edem.amouzou@example.com");
await page.fill("#signupPassword", "Equipe2026!");
await page.locator("#signupPassword").blur();
await shot(page, "02-inscription", {
  marks: [
    { loc: page.locator("#firstName"), union: page.locator("#lastName"), n: 1 },
    { loc: page.locator("#signupEmail"), n: 2 },
    { loc: page.locator("#signupPassword"), n: 3 },
    { loc: page.getByRole("button", { name: /^Continuer$/ }), n: 4 },
  ],
});
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await shot(page, "03-inscription-ville", {
  marks: [
    { loc: page.locator("#locationCity"), n: 1 },
    { loc: page.getByRole("button", { name: /Créer mon compte/i }), n: 2 },
  ],
});
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await settle(page, 2500);
await go(page, "/teams");

// Le menu MySpace : tous les outils du manager.
const menu = page.locator("header").getByRole("button", { name: /MySpace/i }).first();
await menu.click();
await settle(page, 800);
await shot(page, "04-menu-myspace", {
  clip: { x: 380, y: 0, width: 900, height: 330 },
  marks: [
    { loc: page.locator("header a[href='/teams']").first(), union: [page.locator("header a[href='/calendar']").first(), page.locator("header a[href='/mes-reservations']").first()], n: 1, pad: 4 },
    { loc: page.getByRole("link", { name: "Mercato" }).or(page.getByRole("button", { name: "Mercato" })).first(), n: 2, badge: "top" },
  ],
});
await ctx.close();

// Sur téléphone : l'onglet « Espace » en bas de l'écran.
({ ctx, page } = await open("edem-tel", PHONE));
await loginUI(page, "edem.amouzou@example.com", "Equipe2026!");
await go(page, "/teams");
await settle(page, 1500);
const espace = page.getByRole("button", { name: /Espace/ }).or(page.getByRole("link", { name: /Espace/ })).last();
await espace.click();
await settle(page, 1000);
// Seul le panneau du bas compte : le haut de l'écran est voilé.
await shot(page, "05-telephone-espace", {
  clip: { x: 0, y: 360, width: 390, height: 484 },
  marks: [{
    loc: page.locator("a[href='/teams']:visible").last(),
    union: [page.locator("a[href='/calendar']:visible").last(), page.locator("a[href='/mes-reservations']:visible").last()],
    n: 1, pad: 4, badge: "top",
  }],
});
await ctx.close();
