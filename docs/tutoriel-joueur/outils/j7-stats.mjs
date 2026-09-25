// Chapitre 7 : tes statistiques.
import { open, go, shot, region, settle, loadState, corps, content } from "./lib.mjs";
const { kafuiUid } = loadState();

const { ctx, page } = await open("kafui");
await go(page, "/stats");
await settle(page, 2500);
const compteurs = page.getByText("Matchs", { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'grid')][1]");
const amicaux = page.getByText("Matchs amicaux", { exact: true }).first().locator("xpath=ancestor::a[1] | ancestor::div[contains(@class,'border')][1]").first();
await region(page, "31-mes-statistiques", corps(page), {
  maxHeight: 2400,
  marks: [
    { loc: compteurs, n: 1 },
    { loc: amicaux, n: 2 },
    { loc: page.getByText("Olympique de Tokoin", { exact: true }).first().locator("xpath=ancestor::a[1]"), n: 3 },
  ],
});

// La fiche publique, vue par les autres
await go(page, `/profile/${kafuiUid}`);
await settle(page, 2500);
await shot(page, "32-fiche-publique-stats", {
  marks: [{ loc: page.getByText(/^Matchs$/i).first().locator("xpath=ancestor::div[contains(@class,'grid')][1]"), n: 1, badge: "top" }],
});
await ctx.close();
