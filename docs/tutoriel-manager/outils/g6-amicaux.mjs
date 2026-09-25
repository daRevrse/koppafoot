// Chapitre 6 : les matchs amicaux — défier, programmer, renseigner.
import { open, go, shot, region, settle, loadState, saveState, corps, PHONE } from "./lib.mjs";
import { addGhostPlayers, db } from "./admin.mjs";
import { TOKOIN } from "./roster.mjs";
const { teamId, oppTeamId } = loadState();
await addGhostPlayers(oppTeamId, TOKOIN);

let { ctx, page } = await open("edem");
await go(page, "/matches");
await settle(page, 2000);
const bDefi = page.getByRole("button", { name: "Défier une équipe" }).first();
const bAmical = page.getByRole("button", { name: /Programmer un amical/ }).first();
const bJoue = page.getByRole("button", { name: /Renseigner un match joué/ }).first();
await shot(page, "32-matchs", {
  marks: [{ loc: bDefi, n: 1, badge: "top" }, { loc: bAmical, n: 2, badge: "top" }, { loc: bJoue, n: 3, badge: "top" }],
});

// 1. Défier une équipe inscrite
await bDefi.click();
await settle(page, 1000);
const form = page.locator("div.border-2").filter({ hasText: "Défier une équipe" }).first();
await form.locator("select").first().selectOption({ label: "Avenir d'Adakpamé" });
await page.getByPlaceholder("Rechercher une équipe sur KoppaFoot...").fill("Tokoin");
await settle(page, 2000);
const resultat = page.getByRole("button", { name: /Olympique de Tokoin/ }).first();
await shot(page, "33-defi-recherche", {
  marks: [
    { loc: page.getByPlaceholder("Rechercher une équipe sur KoppaFoot..."), n: 1 },
    { loc: resultat, n: 2 },
  ],
});
await resultat.click();
await settle(page, 800);
await form.locator('input[type="date"]').first().fill("2026-10-04");
await form.locator('input[type="time"]').first().fill("09:00");
await page.getByPlaceholder("Nom du terrain").fill("Terrain d'Adakpamé");
await page.getByPlaceholder("Ville").fill("Lomé");
await form.getByText("11v11", { exact: true }).click();
await settle(page, 600);
await region(page, "34-defi-rempli", form, {
  margin: 20,
  marks: [
    { loc: form.locator('input[type="date"]').first(), n: 1, badge: "top" },
    { loc: form.locator('input[type="time"]').first(), n: 2 },
    { loc: page.getByPlaceholder("Nom du terrain"), union: page.getByPlaceholder("Ville"), n: 3 },
    { loc: form.getByText("11v11", { exact: true }), n: 4, pad: 3, badge: "top" },
    { loc: form.getByText("Auto-acceptation des joueurs").locator("xpath=../.."), n: 5 },
    { loc: form.getByRole("button", { name: /Envoyer le défi/ }), n: 6 },
  ],
});
await form.getByRole("button", { name: /Envoyer le défi/ }).click();
await settle(page, 2500);
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
const envoye = corps(page).locator("div.bg-white").filter({ hasText: "Olympique de Tokoin" }).filter({ has: page.getByRole("button", { name: /Annuler le défi/ }) }).last();
await region(page, "35-defi-envoye", envoye, {
  margin: 16,
  marks: [
    { loc: envoye.getByText(/Défi envoyé/i).first(), n: 1, badge: "top", pad: 3 },
    { loc: envoye.getByRole("button", { name: /Annuler le défi/ }), n: 2 },
  ],
});
await ctx.close();

// Kokou reçoit le défi et l'accepte.
({ ctx, page } = await open("kokou"));
await go(page, "/matches");
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
const recu = page.locator("div").filter({ has: page.getByRole("button", { name: "Accepter" }) }).filter({ hasText: /Défi reçu/i }).last();
await region(page, "36-defi-recu", recu, {
  margin: 16,
  marks: [
    { loc: recu.getByRole("button", { name: "Accepter" }), n: 1, badge: "top" },
    { loc: recu.getByRole("button", { name: "Refuser" }), n: 2, badge: "top" },
  ],
});
await recu.getByRole("button", { name: "Accepter" }).click();
await settle(page, 2500);
await ctx.close();
const m = (await db.collection("matches").where("home_team_id", "==", teamId).get()).docs[0];
saveState({ matchId: m.id });

// 2. Un amical contre une équipe qui n'est pas sur KoppaFoot
({ ctx, page } = await open("edem"));
await go(page, "/matches");
await settle(page, 2000);
const carte = corps(page).locator("div.bg-white").filter({ hasText: "Olympique de Tokoin" }).filter({ has: page.getByRole("button", { name: /Modifier/ }) }).last();
await region(page, "37-a-venir", carte, {
  margin: 16,
  marks: [
    { loc: carte.getByText(/Feuille à remplir/i).first(), n: 1, badge: "top", pad: 3 },
    { loc: carte.getByRole("button", { name: /Modifier/ }), union: carte.getByRole("button", { name: /^Annuler$/ }), n: 2 },
  ],
});
await page.getByRole("button", { name: /Programmer un amical/ }).first().click();
await settle(page, 800);
const f2 = page.locator("div.border-2").filter({ hasText: "Programmer un amical" }).first();
await f2.locator("select").first().selectOption({ label: "Avenir d'Adakpamé" });
await page.getByPlaceholder("Nom de l'équipe adverse...").fill("Dynamo de Bè");
await f2.locator('input[type="date"]').first().fill("2026-10-11");
await f2.locator('input[type="time"]').first().fill("10:00");
await page.getByPlaceholder("Nom du terrain").fill("Stade de Bè");
await page.getByPlaceholder("Ville").fill("Lomé");
await f2.getByText("11v11", { exact: true }).click();
await f2.getByText("Extérieur", { exact: true }).click();
await settle(page, 600);
await region(page, "38-amical-hors-koppafoot", f2, {
  margin: 20,
  marks: [
    { loc: page.getByPlaceholder("Nom de l'équipe adverse..."), n: 1 },
    { loc: f2.getByText(/n.est pas sur KoppaFoot : le match est programmé directement, et son/).locator("xpath=.."), n: 2 },
    { loc: f2.getByText("Extérieur", { exact: true }), n: 3, pad: 3 },
    { loc: f2.getByRole("button", { name: /Programmer le match/ }), n: 4 },
  ],
});
await f2.getByRole("button", { name: /Programmer le match/ }).click();
await settle(page, 2500);

// 3. Renseigner un match déjà joué
await page.getByRole("button", { name: /Renseigner un match joué/ }).first().click();
await settle(page, 800);
const f3 = page.locator("div.border-2").filter({ hasText: "Renseigner un match joué" }).first();
await f3.locator("select").first().selectOption({ label: "Avenir d'Adakpamé" });
await page.getByPlaceholder("Nom de l'équipe…").fill("Espoir de Nyékonakpoè");
await settle(page, 1200);
await f3.locator('input[type="date"]').fill("2026-09-20");
await f3.locator('input[type="time"]').fill("09:00").catch(() => {});
await f3.getByRole("button", { name: "11v11", exact: true }).click().catch(() => f3.getByText("11v11", { exact: true }).click());
await f3.getByRole("button", { name: "Domicile", exact: true }).click();
const scores = f3.locator('input[type="number"]');
await scores.nth(0).fill("3");
await scores.nth(1).fill("2");
await settle(page, 800);
const ligne = (nom) => f3.locator("li").filter({ hasText: nom }).first();
const plus = (nom, champ) => ligne(nom).getByRole("button").nth(champ === "buts" ? 1 : 3);
await plus("Kafui Mensah", "buts").click();
await plus("Kafui Mensah", "buts").click();
await plus("Selom Adjo", "passes").click();
await plus("Ekoué Bawa", "buts").click();
await settle(page, 600);
await region(page, "39-renseigner-match", f3, {
  margin: 20,
  maxHeight: 2400,
  marks: [
    { loc: page.getByPlaceholder("Nom de l'équipe…"), n: 1 },
    { loc: scores.nth(0), union: scores.nth(1), n: 2, pad: 8 },
    { loc: ligne("Kafui Mensah"), n: 3 },
    { loc: f3.getByRole("button", { name: /Relire avant de valider/ }), n: 4 },
  ],
});
await f3.getByRole("button", { name: /Relire avant de valider/ }).click();
await settle(page, 1000);
const recap = page.locator("div.border-2").filter({ hasText: "Relis avant de valider" }).first();
await region(page, "40-relire", recap, {
  margin: 20,
  marks: [{ loc: recap.getByRole("button", { name: /Valider ce match/ }), n: 1 }],
});
await recap.getByRole("button", { name: /Valider ce match/ }).click();
await settle(page, 2500);

await ctx.close();

// Les joueurs retrouvent tout dans leur calendrier.
({ ctx, page } = await open("kafui", PHONE));
await go(page, "/calendar");
await settle(page, 2000);
await page.getByRole("button", { name: "Mois suivant" }).click();
await settle(page, 1500);
const jour4 = page.locator('[aria-label^="4 Octobre"]').first();
await jour4.click();
await settle(page, 1000);
await page.evaluate(() => window.scrollTo(0, 110));
await settle(page, 500);
await shot(page, "41-calendrier-joueur", { marks: [{ loc: jour4, n: 1, pad: 2, badge: "top" }] });
await ctx.close();
