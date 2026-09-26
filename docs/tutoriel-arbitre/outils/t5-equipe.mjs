// Chapitre 5 : emmener son équipe. Komi compose l'équipe du samedi :
// Yao en assistant, Afi à la console. Chacun le voit de son côté.
import { open, go, settle, region, loginUI, loadState, BUREAU } from "./lib.mjs";
import { ASSISTANT, SCOREUSE, EDEM, KOKOU } from "./roster.mjs";

const { matchA } = loadState();
const { ctx, page } = await open("komi", BUREAU);
await go(page, "/designations");
await settle(page, 2500);
const carteA = () => page.locator("div.overflow-hidden").filter({ hasText: "Ton équipe pour ce match" }).filter({ hasText: KOKOU.equipe }).filter({ hasText: EDEM.equipe }).first();
await region(page, "23-confirme-seul", carteA(), {
  margin: 24,
  marks: [
    { loc: carteA().getByText("Ton équipe pour ce match").locator("xpath=ancestor::div[contains(@class,'bg-gray-50')][1]"), n: 1 },
    { loc: carteA().getByRole("button", { name: /Composer mon équipe/ }), n: 2, badge: "top" },
  ],
});
await carteA().getByRole("button", { name: /Composer mon équipe/ }).click();
await settle(page, 1200);
const fenetre = page.locator('[role="dialog"]');
await fenetre.getByRole("button", { name: new RegExp(ASSISTANT.prenom) }).click();
await fenetre.getByRole("button", { name: new RegExp(SCOREUSE.prenom) }).click();
await settle(page, 400);
await region(page, "24-composer", fenetre, {
  margin: 20, hideHeader: false,
  marks: [
    { loc: fenetre.getByRole("button", { name: new RegExp(ASSISTANT.prenom) }), n: 1 },
    { loc: fenetre.getByRole("button", { name: new RegExp(SCOREUSE.prenom) }), n: 2 },
    { loc: fenetre.getByRole("button", { name: /^Enregistrer$/ }), n: 3, badge: "top" },
  ],
});
await fenetre.getByRole("button", { name: /^Enregistrer$/ }).click();
await settle(page, 2500);
await region(page, "25-equipe-composee", carteA(), {
  margin: 24,
  marks: [
    { loc: carteA().getByText("Ton équipe pour ce match").locator("xpath=ancestor::div[contains(@class,'bg-gray-50')][1]"), n: 1 },
    { loc: carteA().getByText(/qui tient la console/).first(), n: 2 },
    { loc: carteA().getByRole("link", { name: /Console \(en secours\)/ }), n: 3, badge: "top" },
  ],
});

// La fiche du match, onglet Infos : qui officie.
await go(page, `/matches/${matchA}`);
await settle(page, 2500);
await page.getByRole("button", { name: /^Infos$/i }).first().click().catch(() => {});
await settle(page, 1200);
const details = page.getByRole("heading", { name: "Détails" }).locator("xpath=ancestor::section[1]");
await region(page, "26-fiche-officiels", details, {
  margin: 44,
  marks: [{ loc: details.locator("li").filter({ hasText: "Arbitre" }).first(), union: details.locator("li").filter({ hasText: "Scoreur" }).first(), n: 1 }],
});
await ctx.close();

// Afi : le match l'attend dans ses directs.
const a = await open("afi", BUREAU);
await loginUI(a.page, SCOREUSE.email, SCOREUSE.mdp);
await go(a.page, "/live-ops");
await settle(a.page, 2500);
const aCouvrir = a.page.getByText("Matchs à couvrir").locator("xpath=..");
await region(a.page, "27-scoreuse-directs", aCouvrir, {
  margin: 24,
  marks: [{ loc: aCouvrir.getByText(/Scoreur de Komi Adjovi/), n: 1 }],
});
await a.ctx.close();

// Yao : « En renfort » dans ses désignations.
const y = await open("yao", BUREAU);
await go(y.page, "/designations");
await settle(y.page, 2500);
const renfort = y.page.getByText("En renfort", { exact: true }).locator("xpath=ancestor::section[1]");
await region(y.page, "28-assistant-renfort", renfort, {
  margin: 24,
  marks: [{ loc: renfort.getByText("Assistant", { exact: true }), n: 1, badge: "top" }],
});
await y.ctx.close();

// Edem : ce que voit le manager sur la carte de son match.
const e = await open("edem", BUREAU);
await go(e.page, "/matches");
await settle(e.page, 2500);
const bloc = e.page.getByText("Arbitre :").first().locator("xpath=ancestor::div[contains(@class,'border-emerald-200')][1]");
await region(e.page, "29-cote-manager-equipe", bloc, { margin: 16, marks: [{ loc: bloc, n: 1 }] });
await e.ctx.close();
