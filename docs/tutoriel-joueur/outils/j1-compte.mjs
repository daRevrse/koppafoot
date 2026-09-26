// Chapitre 1 : créer son compte de joueur, trouver ses outils.
import { open, go, shot, settle, loginUI, PHONE } from "./lib.mjs";

let { ctx, page } = await open("kafui");
await go(page, "/roles");
// La page des rôles a un bandeau haut de 88 % de l'écran : on vise la
// section des affiches dans une fenêtre juste assez haute.
const affiches = page.locator("section#ouverts");
await page.setViewportSize({ width: 1280, height: 1120 });
await affiches.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
await settle(page, 1500);
const bA = await affiches.boundingBox();
await shot(page, "01-choisir-joueur", {
  clip: { x: 0, y: bA.y, width: 1280, height: Math.min(bA.height, 1120 - bA.y) },
  marks: [{ loc: affiches.getByRole("link", { name: "Devenir joueur" }).first(), n: 1, badge: "top" }],
});
await page.setViewportSize({ width: 1280, height: 800 });

await affiches.getByRole("link", { name: "Devenir joueur" }).first().click();
await page.waitForURL(/signup/);
await settle(page, 1500);
await page.fill("#firstName", "Kafui");
await page.fill("#lastName", "Mensah");
await page.fill("#signupEmail", "kafui.mensah@example.com");
await page.fill("#signupPassword", "Joueur2026!");
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

// Le menu MySpace, côté joueur, et les deux boutons de la page Mes équipes.
await go(page, "/teams");
await settle(page, 1500);
await page.locator("header").getByRole("button", { name: /MySpace/i }).first().click();
await settle(page, 800);
await shot(page, "04-menu-myspace", {
  clip: { x: 380, y: 0, width: 900, height: 330 },
  marks: [
    { loc: page.locator("header a[href='/teams']").first(), union: [page.locator("header a[href='/stats']").first(), page.locator("header a[href='/mes-reservations']").first()], n: 1, pad: 4 },
    { loc: page.getByRole("link", { name: /Mes convocations/ }).or(page.getByRole("button", { name: /Mes convocations/ })).first(), n: 2, badge: "top" },
    { loc: page.getByRole("link", { name: /^Mercato$/ }).or(page.getByRole("button", { name: /^Mercato$/ })).first(), n: 3, badge: "top" },
  ],
});
await ctx.close();

// Sur téléphone : l'onglet « Espace » en bas de l'écran.
({ ctx, page } = await open("kafui-tel", PHONE));
await loginUI(page, "kafui.mensah@example.com", "Joueur2026!");
await go(page, "/teams");
await settle(page, 1500);
await page.getByRole("button", { name: /Espace/ }).or(page.getByRole("link", { name: /Espace/ })).last().click();
await settle(page, 1000);
// Seul le panneau du bas compte : le haut de l'écran est voilé.
await shot(page, "05-telephone-espace", {
  clip: { x: 0, y: 360, width: 390, height: 484 },
  marks: [{
    loc: page.locator("a[href='/teams']:visible").last(),
    union: [page.locator("a[href='/stats']:visible").last(), page.locator("a[href='/mes-reservations']:visible").last()],
    n: 1, pad: 4, badge: "top",
  }],
});
await ctx.close();
