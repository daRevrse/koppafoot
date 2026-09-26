// Chapitre 8 du guide : après le match — valider le résultat, lire les statistiques.
import { open, go, shot, region, settle, loadState, corps } from "./lib.mjs";
const { matchId, teamUrl } = loadState();

let { ctx, page } = await open("edem");
await go(page, `/matches/${matchId}`);
await settle(page, 2500);
const bandeau = page.getByText("Validation du rapport de match", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border')][1]");
await region(page, "45-valider-resultat", corps(page), {
  bas: bandeau,
  marks: [
    { loc: page.getByText(/En attente de la validation des deux camps/).locator("xpath=.."), n: 1 },
    { loc: bandeau.getByRole("button", { name: /Valider le Match/i }), n: 2 },
    { loc: bandeau.getByRole("button", { name: /Contester/i }), n: 3, badge: "top" },
  ],
});
await bandeau.getByRole("button", { name: /Valider le Match/i }).click();
await settle(page, 2000);
await ctx.close();

({ ctx, page } = await open("kokou"));
await go(page, `/matches/${matchId}`);
await settle(page, 2500);
await page.getByRole("button", { name: /Valider le Match/i }).first().click();
await settle(page, 2000);
await ctx.close();

({ ctx, page } = await open("edem"));
await go(page, `/matches/${matchId}`);
await settle(page, 2500);
const statut = page.getByText(/Validé par les deux camps/).locator("xpath=..");
const historique = page.getByText(/Coup d'envoi/i).last();
await region(page, "46-resultat-valide", corps(page), {
  bas: historique,
  maxHeight: 2600,
  marks: [{ loc: statut, n: 1 }],
});

// Le bilan du club
await go(page, teamUrl);
await page.getByRole("button", { name: /^Stats/ }).first().click();
await settle(page, 2000);
await region(page, "47-stats-equipe", corps(page), { maxHeight: 2400, margin: 14 });

// Les statistiques vont aux joueurs
await page.getByRole("button", { name: /^Effectif/ }).first().click();
await settle(page, 1200);
const ekoue = page.locator("div", { has: page.getByText("Ekoué Bawa", { exact: true }) })
  .filter({ has: page.getByRole("button", { name: /Stats/ }) }).last();
await ekoue.getByRole("button", { name: /Stats/ }).click();
await settle(page, 1200);
await shot(page, "48-stats-joueur-sans-compte");
await page.keyboard.press("Escape");
await settle(page, 600);

await go(page, "/matches");
await page.getByRole("button", { name: /Terminés/ }).click();
await settle(page, 2000);
const victoire = corps(page).locator("div.bg-white").filter({ hasText: "Olympique de Tokoin" }).filter({ has: page.getByRole("button", { name: /Noter les joueurs/ }) }).last();
await region(page, "49-matchs-termines", corps(page), {
  maxHeight: 2400,
  marks: [{ loc: victoire.getByRole("button", { name: /Noter les joueurs/ }), n: 1 }],
});
await victoire.getByRole("button", { name: /Noter les joueurs/ }).click();
await settle(page, 1500);
const notes = page.locator('.modal-layer input[type="range"]');
const valeurs = [8, 7, 9, 6, 7, 6, 7, 8, 6, 7, 7, 6, 8, 6];
for (let i = 0; i < await notes.count(); i++) await notes.nth(i).fill(String(valeurs[i % valeurs.length]));
await page.locator(".modal-layer .overflow-y-auto").evaluate((el) => { el.scrollTop = 0; });
await settle(page, 500);
await shot(page, "50-noter-joueurs", {
  marks: [
    { loc: notes.nth(0), n: 1 },
    { loc: page.locator(".modal-layer").getByRole("button", { name: /Enregistrer/ }), n: 2, badge: "top" },
  ],
});
await page.locator(".modal-layer").getByRole("button", { name: /Enregistrer/ }).click();
await settle(page, 1500);
await ctx.close();
