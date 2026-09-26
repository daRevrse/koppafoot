// Chapitre 5 : un match programmé sur le terrain.
// Edem programme un amical et choisit le Complexe sportif de Bè dans la
// liste des terrains : la demande part toute seule chez Yawo.
import { open, go, region, settle } from "./lib.mjs";
import { DIMANCHE, TERRAIN } from "./roster.mjs";

const e = await open("edem");
await go(e.page, "/matches");
await settle(e.page, 1500);
await e.page.getByRole("button", { name: /Programmer un amical/ }).first().click();
await settle(e.page, 800);
const f = e.page.locator("div.border-2").filter({ hasText: "Programmer un amical" }).first();
await f.locator("select").first().selectOption({ label: "Avenir d'Adakpamé" });
await e.page.getByPlaceholder("Nom de l'équipe adverse...").fill("Dynamo de Bè");
await f.locator('input[type="date"]').first().fill(DIMANCHE);
await f.locator('input[type="time"]').first().fill("09:00");
const choixTerrain = f.locator("select").filter({ has: e.page.locator("option", { hasText: TERRAIN.nom }) }).first();
await choixTerrain.selectOption({ label: `${TERRAIN.nom}, ${TERRAIN.ville}` });
await f.getByText("11v11", { exact: true }).click();
await settle(e.page, 800);
await region(e.page, "25-match-choix-terrain", f, {
  margin: 44,
  depuis: f.locator('input[type="date"]').first(),
  bas: f.getByText(/Le propriétaire recevra une demande/),
  marks: [
    { loc: choixTerrain, n: 1 },
    { loc: f.getByText(/Le propriétaire recevra une demande/), n: 2 },
  ],
});
await f.getByRole("button", { name: /Programmer le match/ }).click();
await settle(e.page, 4000);
await e.ctx.close();

// Yawo : la demande porte le match.
const { ctx, page } = await open("yawo");
await go(page, "/mes-terrains/reservations");
await settle(page, 2000);
const ligne = page.locator("section").filter({ hasText: "En attente de réponse" }).locator("li").filter({ hasText: "Dynamo" }).first();
await region(page, "26-demande-match", ligne, {
  margin: 24,
  marks: [
    { loc: ligne.getByText(/Dynamo de Bè/).first(), n: 1 },
    { loc: ligne.getByRole("button", { name: "Confirmer" }), n: 2, badge: "top" },
  ],
});
await ligne.getByRole("button", { name: "Confirmer" }).click();
await settle(page, 2500);
await ctx.close();

// Côté manager : la carte du match dit que le terrain est confirmé.
const e2 = await open("edem");
await go(e2.page, "/matches");
await settle(e2.page, 2500);
const carte = e2.page.getByText("Terrain confirmé").first().locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(e2.page, "27-match-confirme", carte, {
  margin: 20,
  marks: [{ loc: e2.page.getByText("Terrain confirmé").first(), n: 1, pad: 3 }],
});
await e2.ctx.close();
