// Chapitre 7 : gérer ses terrains (en ajouter un, fermer, retirer).
import { open, go, region, settle, shot, corps } from "./lib.mjs";
import { TERRAIN } from "./roster.mjs";

const { ctx, page } = await open("yawo");
await go(page, "/mes-terrains");
await settle(page, 1500);
const carte = page.locator("article").filter({ hasText: TERRAIN.nom }).first();
await region(page, "32-plusieurs", corps(page), {
  bas: carte,
  marks: [
    { loc: page.getByRole("button", { name: "Ajouter un terrain" }), n: 1 },
    { loc: carte.getByText("Ouvert", { exact: true }), n: 2, pad: 3 },
    { loc: carte.getByRole("button", { name: `Retirer ${TERRAIN.nom}` }), n: 3, badge: "top" },
  ],
});

// Retirer : ce que la fenêtre annonce avant de confirmer. On n'y va pas.
await carte.getByRole("button", { name: `Retirer ${TERRAIN.nom}` }).click();
await settle(page, 1500);
const dlg = page.getByRole("alertdialog");
const b = await dlg.boundingBox();
await shot(page, "33-retirer", {
  clip: { x: b.x - 16, y: b.y - 16, width: b.width + 32, height: b.height + 32 },
});
await page.keyboard.press("Escape");
await ctx.close();
