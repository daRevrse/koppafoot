// Scène 03, fin : Edem défie l'Olympique de Tokoin au Complexe sportif de Bè ;
// Kokou accepte, Yawo confirme le créneau.
import { open, go, settle, ecran, cible, loadState, saveState, loginUI, PHONE } from "./lib.mjs";
import { db } from "./admin.mjs";
import { EDEM, KOKOU, GERANT, TERRAIN, MATCH } from "./roster.mjs";
const { teamId } = loadState();
const centrer = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: "center" }));

let { ctx, page } = await open("edem-tel", PHONE);
await loginUI(page, EDEM.email, EDEM.mdp);
await go(page, "/matches");
await settle(page, 2500);
await page.getByRole("button", { name: "Défier une équipe" }).first().click();
await settle(page, 1200);
const form = page.locator("div.border-2").filter({ hasText: "Défier une équipe" }).first();
await form.locator("select").first().selectOption({ label: EDEM.equipe }).catch(() => {});
await page.getByPlaceholder("Rechercher une équipe sur KoppaFoot...").fill("Tokoin");
await settle(page, 2000);
const resultat = page.getByRole("button", { name: /Olympique de Tokoin/ }).first();
await centrer(resultat);
await settle(page, 500);
await cible(page, "03m-defi-adversaire", resultat);
await ecran(page, "03m-defi-adversaire");
await resultat.click();
await settle(page, 800);
await form.locator('input[type="date"]').first().fill(MATCH.date);
await form.locator('input[type="time"]').first().fill(MATCH.time);
const choixTerrain = form.locator("select").filter({ has: page.locator("option", { hasText: TERRAIN.nom }) }).first();
await choixTerrain.selectOption({ label: `${TERRAIN.nom}, ${TERRAIN.ville}` });
await form.getByText("11v11", { exact: true }).click();
await settle(page, 800);
await centrer(choixTerrain);
await settle(page, 600);
await cible(page, "03n-defi-terrain", choixTerrain);
await ecran(page, "03n-defi-terrain");
const envoyer = form.getByRole("button", { name: /Envoyer le défi/ });
await centrer(envoyer);
await settle(page, 400);
await envoyer.click();
await settle(page, 3000);
await ctx.close();

// Kokou accepte le défi, depuis son ordinateur (sans capture).
({ ctx, page } = await open("kokou"));
await loginUI(page, KOKOU.email, KOKOU.mdp);
await go(page, "/matches");
await page.getByRole("button", { name: /À traiter/ }).click();
await settle(page, 1500);
const recu = page.locator("div").filter({ has: page.getByRole("button", { name: "Accepter" }) }).filter({ hasText: /Défi reçu/i }).last();
await recu.getByRole("button", { name: "Accepter" }).click();
await settle(page, 3000);
await ctx.close();
const m = (await db.collection("matches").where("home_team_id", "==", teamId).get()).docs[0];
saveState({ matchId: m.id });

// Yawo, le gérant, confirme le créneau.
const y = await open("yawo-tel", PHONE);
await loginUI(y.page, GERANT.email, GERANT.mdp);
await go(y.page, "/mes-terrains/reservations");
await settle(y.page, 2500);
const ligne = y.page.locator("section").filter({ hasText: "En attente de réponse" }).locator("li").filter({ hasText: /Tokoin|Adakpamé/ }).first();
await centrer(ligne);
await settle(y.page, 800);
await cible(y.page, "03o-gerant-demande", ligne.getByRole("button", { name: "Confirmer" }));
await ecran(y.page, "03o-gerant-demande");
await ligne.getByRole("button", { name: "Confirmer" }).click();
await settle(y.page, 2500);
await y.ctx.close();

// Le match est calé.
({ ctx, page } = await open("edem-tel", PHONE));
await go(page, "/matches");
await settle(page, 3000);
const confirme = page.getByText("Terrain confirmé").first();
await centrer(confirme);
await settle(page, 800);
await cible(page, "03p-match-cale", confirme);
await ecran(page, "03p-match-cale");
await ctx.close();
console.log("match", m.id, m.data().status, JSON.stringify(m.data().venue_booking ?? null));
