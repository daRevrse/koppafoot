// Chapitre 5 : les convocations — répondre, et tout retrouver dans le calendrier.
import { open, go, shot, region, settle, loadState, saveState, corps, PHONE } from "./lib.mjs";
import { db } from "./admin.mjs";
const { teamId } = loadState();

// Le manager programme un amical sans auto-acceptation : chaque joueur doit confirmer.
let { ctx, page } = await open("edem");
await go(page, "/matches");
await settle(page, 2000);
await page.getByRole("button", { name: /Programmer un amical/ }).first().click();
await settle(page, 800);
let f = page.locator("div.border-2").filter({ hasText: "Programmer un amical" }).first();
await f.locator("select").first().selectOption({ label: "Avenir d'Adakpamé" });
await page.getByPlaceholder("Nom de l'équipe adverse...").fill("Étoile de Hédzranawoé");
await f.locator('input[type="date"]').first().fill("2026-10-18");
await f.locator('input[type="time"]').first().fill("09:00");
await page.getByPlaceholder("Nom du terrain").fill("Terrain d'Adakpamé");
await page.getByPlaceholder("Ville").fill("Lomé");
await f.getByText("7v7", { exact: true }).click();
await f.getByText("Auto-acceptation des joueurs").locator("xpath=../..").locator("button").click();
await settle(page, 400);
await f.getByRole("button", { name: /Programmer le match/ }).click();
await settle(page, 2500);
await ctx.close();
const amical = (await db.collection("matches").where("away_team_name", "==", "Étoile de Hédzranawoé").get()).docs[0].id;
saveState({ amicalId: amical });

({ ctx, page } = await open("kafui-tel", PHONE));
await go(page, "/notifications");
await settle(page, 2000);
await shot(page, "22-notification-convocation", {
  marks: [{ loc: page.getByText("Convocation à un match", { exact: true }).first(), union: page.getByText(/Vous êtes convoqué/).first(), n: 1, pad: 6 }],
});
await go(page, "/participations");
await settle(page, 2000);
await shot(page, "23-mes-convocations", {
  marks: [
    { loc: page.getByRole("button", { name: /^Accepter$/ }).first(), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /^Décliner$/ }).first(), n: 2, badge: "top" },
  ],
});

// Même réponse possible depuis la fiche du match.
await go(page, `/matches/${amical}`);
await settle(page, 2500);
await page.getByRole("tab", { name: /Composition/ }).click().catch(() => {});
await settle(page, 1500);
const confirmer = page.getByRole("button", { name: /Confirmer ma présence/ });
await confirmer.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 200));
await settle(page, 600);
await shot(page, "24-rejoins-le-combat", {
  marks: [
    { loc: confirmer, n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /Je ne peux pas/ }), n: 2, badge: "top" },
  ],
});
await confirmer.click();
await settle(page, 2000);
await go(page, "/participations");
await settle(page, 1500);
await page.getByRole("button", { name: /Historique/ }).click();
await settle(page, 1200);
await shot(page, "25-convocation-confirmee", {
  marks: [{ loc: page.getByText("Confirmé", { exact: true }).first(), n: 1, badge: "top", pad: 4 }],
});
await ctx.close();

// Un défi à l'Olympique de Tokoin, accepté par Kokou (auto-acceptation : tout le monde est sur la feuille).
({ ctx, page } = await open("edem"));
await go(page, "/matches");
await settle(page, 2000);
await page.getByRole("button", { name: "Défier une équipe" }).first().click();
await settle(page, 1000);
f = page.locator("div.border-2").filter({ hasText: "Défier une équipe" }).first();
await f.locator("select").first().selectOption({ label: "Avenir d'Adakpamé" });
await page.getByPlaceholder("Rechercher une équipe sur KoppaFoot...").fill("Tokoin");
await settle(page, 2000);
await page.getByRole("button", { name: /Olympique de Tokoin/ }).first().click();
await settle(page, 800);
await f.locator('input[type="date"]').first().fill("2026-10-04");
await f.locator('input[type="time"]').first().fill("09:00");
await page.getByPlaceholder("Nom du terrain").fill("Terrain d'Adakpamé");
await page.getByPlaceholder("Ville").fill("Lomé");
await f.getByText("11v11", { exact: true }).click();
await f.getByRole("button", { name: /Envoyer le défi/ }).click();
await settle(page, 2500);
await ctx.close();
({ ctx, page } = await open("kokou"));
await go(page, "/matches");
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
await page.locator("div").filter({ has: page.getByRole("button", { name: "Accepter" }) }).filter({ hasText: /Défi reçu/i }).last()
  .getByRole("button", { name: "Accepter" }).click();
await settle(page, 2500);
await ctx.close();
const defi = (await db.collection("matches").where("away_team_name", "==", "Olympique de Tokoin").get()).docs[0].id;
saveState({ matchId: defi });

// Le calendrier de Kafui
({ ctx, page } = await open("kafui-tel", PHONE));
await go(page, "/calendar");
await settle(page, 2000);
await page.getByRole("button", { name: "Mois suivant" }).click();
await settle(page, 1500);
const jour4 = page.locator('[aria-label^="4 Octobre"]').first();
await jour4.click();
await settle(page, 1000);
await page.evaluate(() => window.scrollTo(0, 110));
await settle(page, 500);
await shot(page, "26-calendrier", { marks: [{ loc: jour4, n: 1, pad: 2, badge: "top" }] });
await ctx.close();
