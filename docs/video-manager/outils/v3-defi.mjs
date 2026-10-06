// Scène 3 : Edem défie l'Olympique de Tokoin ; Kokou accepte.
import { open, go, settle, shot, cible, loadState, saveState, loginUI, corps, PHONE } from "./lib.mjs";
import { db } from "./admin.mjs";
import { EDEM, KOKOU, MATCH } from "./roster.mjs";
const { teamId } = loadState();

let { ctx, page } = await open("edem-tel", PHONE);
await go(page, "/matches");
await settle(page, 2500);
const defier = page.getByRole("button", { name: "Défier une équipe" }).first();
await cible(page, "09-matchs", defier);
await shot(page, "09-matchs");
await defier.click();
await settle(page, 1200);
const form = page.locator("div.border-2").filter({ hasText: "Défier une équipe" }).first();
await form.locator("select").first().selectOption({ label: EDEM.equipe }).catch(() => {});
await page.getByPlaceholder("Rechercher une équipe sur KoppaFoot...").fill("Tokoin");
await settle(page, 2000);
const resultat = page.getByRole("button", { name: /Olympique de Tokoin/ }).first();
await resultat.scrollIntoViewIfNeeded();
await settle(page, 500);
await cible(page, "10-defi-recherche", resultat);
await shot(page, "10-defi-recherche");
await resultat.click();
await settle(page, 800);
await form.locator('input[type="date"]').first().fill(MATCH.date);
await form.locator('input[type="time"]').first().fill(MATCH.time);
await page.getByPlaceholder("Nom du terrain").fill(MATCH.lieu);
await page.getByPlaceholder("Ville").fill(MATCH.ville);
await form.getByText("11v11", { exact: true }).click();
await settle(page, 600);
// Centré dans l'écran : la barre du bas masquait le bas du formulaire.
const centrer = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: "center" }));
await centrer(form.locator('input[type="time"]').first());
await settle(page, 500);
await shot(page, "11-defi-rempli");
const envoyer = form.getByRole("button", { name: /Envoyer le défi/ });
await centrer(envoyer);
await settle(page, 500);
await cible(page, "11b-defi-envoyer", envoyer);
await shot(page, "11b-defi-envoyer");
await envoyer.click();
await settle(page, 2500);
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
await page.evaluate(() => window.scrollTo(0, 0));
await shot(page, "12-defi-envoye");
await ctx.close();

// Kokou accepte le défi (depuis son ordinateur, sans capture).
({ ctx, page } = await open("kokou"));
await loginUI(page, KOKOU.email, KOKOU.mdp);
await go(page, "/matches");
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
const recu = page.locator("div").filter({ has: page.getByRole("button", { name: "Accepter" }) }).filter({ hasText: /Défi reçu/i }).last();
await recu.getByRole("button", { name: "Accepter" }).click();
await settle(page, 2500);
await ctx.close();
const m = (await db.collection("matches").where("home_team_id", "==", teamId).get()).docs[0];
saveState({ matchId: m.id });

// Edem : la notification, puis le match à venir.
({ ctx, page } = await open("edem-tel", PHONE));
await go(page, "/notifications");
await settle(page, 2500);
await shot(page, "13-notif-defi-accepte");
await go(page, "/matches");
await settle(page, 2500);
await shot(page, "14-a-venir");
await ctx.close();
console.log("match", m.id, m.data().status);
