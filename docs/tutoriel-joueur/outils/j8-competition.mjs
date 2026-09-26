// Chapitre 8 : les compétitions.
import { open, go, shot, region, settle, saveState, corps, content } from "./lib.mjs";
import { createOpenCompetition, answerRegistrations } from "./admin.mjs";

// Le décor : la Coupe des Quartiers ouvre ses inscriptions, Edem y inscrit
// l'équipe (guide manager, chapitre 9), l'organisateur accepte.
const { cid, organizer } = await createOpenCompetition();
saveState({ cid });
let { ctx, page } = await open("edem");
await go(page, "/mon-equipe");
await settle(page, 2500);
await page.getByRole("button", { name: "S'inscrire" }).first().click();
await settle(page, 1000);
const m = page.locator(".modal-layer").last();
await m.locator('input[type="checkbox"]').check();
await m.getByRole("button", { name: "Envoyer" }).click();
await settle(page, 2500);
await ctx.close();
await answerRegistrations(organizer, cid, "accept");

({ ctx, page } = await open("kafui"));
await go(page, "/notifications");
await settle(page, 2500);
await region(page, "33-notification-competition", corps(page), {
  maxHeight: 1000,
  marks: [{ loc: page.getByText("Nouvelle compétition", { exact: true }).first(), union: page.getByText(/est inscrite à Coupe des Quartiers/).first(), n: 1, pad: 6 }],
});

await go(page, "/stats");
await settle(page, 2500);
const ligne = page.getByText("Coupe des Quartiers 2026", { exact: true }).first().locator("xpath=ancestor::a[1]");
await region(page, "34-stats-competition", corps(page), {
  bas: ligne,
  margin: 24,
  marks: [{ loc: ligne, n: 1 }],
});
await ligne.click();
await page.waitForURL(/\/c\/.+\/teams\//);
await settle(page, 2500);
await region(page, "35-equipe-competition", corps(page), {
  maxHeight: 2400,
  marks: [
    { loc: page.getByText("Toi", { exact: true }).first().locator("xpath=ancestor::div[1]"), n: 1 },
    { loc: page.getByRole("button", { name: /Résultats/i }).first(), n: 2, badge: "top" },
  ],
});

await go(page, "/c/coupe-des-quartiers-2026");
await settle(page, 2500);
await shot(page, "36-page-competition", {
  marks: [
    { loc: page.getByRole("button", { name: /Suivre/ }).first(), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /^Calendrier$/i }).first(), union: page.getByRole("button", { name: /^Buteurs$/i }).first(), n: 2, pad: 6 },
  ],
});
await ctx.close();
