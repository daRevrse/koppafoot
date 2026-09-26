// Chapitre 9 du guide : inscrire son équipe à une compétition.
import { open, go, shot, region, settle, saveState, content } from "./lib.mjs";
import { createOpenCompetition, answerRegistrations } from "./admin.mjs";

// Le décor : la Coupe des Quartiers de Kossi Mensah, ouverte aux inscriptions
// (c'est elle que construit le guide organisateur).
const { cid, organizer } = await createOpenCompetition();
saveState({ cid });

let { ctx, page } = await open("edem");
await go(page, "/mon-equipe");
await settle(page, 2500);
await region(page, "51-mes-competitions", content(page), {
  maxHeight: 1400,
  marks: [{ loc: page.getByRole("button", { name: "S'inscrire" }).first(), n: 1 }],
});
await page.getByRole("button", { name: "S'inscrire" }).first().click();
await settle(page, 1000);
const m = page.locator(".modal-layer").last();
await m.locator("textarea").fill("Bonjour ! L'Avenir d'Adakpamé sera de la partie. À bientôt sur le terrain.");
await m.locator('input[type="checkbox"]').check();
await shot(page, "52-inscription", {
  marks: [
    { loc: m.locator("select"), n: 1 },
    { loc: m.locator("textarea"), n: 2 },
    { loc: m.getByText(/Frais d.inscription/).locator("xpath=.."), n: 3 },
    { loc: m.locator('input[type="checkbox"]').locator("xpath=.."), n: 4 },
    { loc: m.getByRole("button", { name: "Envoyer" }), n: 5, badge: "top" },
  ],
});
await m.getByRole("button", { name: "Envoyer" }).click();
await settle(page, 2500);
await region(page, "53-demande-en-attente", content(page), {
  maxHeight: 1400,
  marks: [{ loc: page.getByText("En attente", { exact: true }).first(), n: 1, badge: "top", pad: 4 }],
});
await ctx.close();

// L'organisateur accepte la demande (depuis son espace, voir le guide organisateur).
await answerRegistrations(organizer, cid, "accept");

({ ctx, page } = await open("edem"));
await go(page, "/mon-equipe");
await settle(page, 2500);
const entree = page.locator("a[href^='/mon-equipe/']").first();
await region(page, "54-equipe-inscrite", content(page), {
  maxHeight: 1400,
  marks: [{ loc: entree, n: 1 }],
});
const href = await entree.getAttribute("href");
saveState({ compTeamUrl: href });
await go(page, href);
await settle(page, 2500);
await region(page, "55-effectif-engage", content(page), {
  maxHeight: 2600,
  marks: [
    { loc: page.getByRole("button", { name: /Resynchroniser/ }), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /Ajouter un joueur/ }), n: 2 },
    { loc: page.getByRole("button", { name: /Rattachements/ }), n: 3, badge: "top" },
  ],
});

await go(page, "/c/coupe-des-quartiers-2026");
await settle(page, 2500);
const bandeau = page.getByText("Inscriptions ouvertes", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border')][1]");
await shot(page, "56-page-publique", {
  marks: [
    { loc: bandeau, n: 1 },
    { loc: page.getByRole("button", { name: /Suivre/ }).first(), n: 2, badge: "top" },
  ],
});
await ctx.close();
