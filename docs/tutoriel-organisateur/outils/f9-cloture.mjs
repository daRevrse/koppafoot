// Chapitre 12 : clôturer la compétition.
import { open, go, shot, region, settle, loadState, PHONE } from "./lib.mjs";

const { cid } = loadState();
const { ctx, page } = await open("kossi");
await go(page, `/organizer/competitions/${cid}`);
await settle(page, 2000);
const statut = page.getByText("Statut", { exact: true }).locator("xpath=..");
await region(page, "69-passer-en-terminee", statut, {
  marks: [{ loc: statut.getByRole("button", { name: "Terminée" }), n: 1, badge: "top" }],
});
await statut.getByRole("button", { name: "Terminée" }).click();
await settle(page, 2500);
const mvp = page.getByText("Meilleur joueur du tournoi").locator("xpath=..");
await region(page, "70-meilleur-joueur", mvp, {
  marks: [{ loc: mvp.getByRole("button", { name: /Fiifi Lawson/ }).first(), n: 1 }],
});
await mvp.getByRole("button", { name: /Fiifi Lawson/ }).first().click();
await settle(page, 2000);
await region(page, "71-meilleur-joueur-designe", page.getByText("Meilleur joueur du tournoi").locator("xpath=.."));
await ctx.close();

// La page publique, compétition terminée
const pub = await open("public-phone", PHONE);
await go(pub.page, "/c/coupe-des-quartiers-2026");
await settle(pub.page, 2500);
await shot(pub.page, "72-public-terminee");
const tab = pub.page.getByRole("button", { name: /Tableau/i }).or(pub.page.getByRole("tab", { name: /Tableau/i })).or(pub.page.getByRole("link", { name: /^Tableau$/i })).first();
await tab.click().catch(() => console.log("pas d'onglet tableau"));
await settle(pub.page, 2000);
await tab.scrollIntoViewIfNeeded().catch(() => {});
await pub.page.evaluate(() => window.scrollBy(0, -90));
await shot(pub.page, "73-public-tableau");
await pub.ctx.close();
