// Scène 02 : vendredi soir, Elikem ouvre le Direct. L'affiche du samedi, son
// pronostic, les scores du championnat ; puis il suit le match.
import { open, go, settle, ecran, cible, loadState, loginUI, PHONE } from "./lib.mjs";
import fs from "node:fs";
import { SUPPORTER } from "./roster.mjs";
import { db, uidOf, chronosDuChampionnat } from "./admin.mjs";
const { matchId } = loadState();

// Une prise propre : ni pronostic, ni suivi d'une prise précédente.
const elikem = await uidOf(SUPPORTER.email);
for (const c of ["match_predictions", "match_follows"]) {
  for (const d of (await db.collection(c).get()).docs) if (d.id.includes(elikem)) await d.ref.delete();
}
fs.rmSync("profiles/elikem-tel", { recursive: true, force: true });

const { ctx, page } = await open("elikem-tel", PHONE);
await loginUI(page, SUPPORTER.email, SUPPORTER.mdp);
await chronosDuChampionnat();
await go(page, "/");
await settle(page, 4000);

// L'affiche tourne d'elle-même : son point de pagination la fixe sur le
// match du samedi (le deuxième, après le championnat), et arrête la rotation.
const affiche = () => page.locator("div", { has: page.getByText("Qui va gagner ?") }).filter({ has: page.getByRole("button", { name: "Suivant" }) }).last();
await page.getByRole("button", { name: "Affiche 2", exact: true }).first().click();
await settle(page, 1500);
await page.evaluate(() => scrollTo(0, 0));
await settle(page, 600);
const pour = affiche().getByRole("button", { name: /Adakpamé/ }).first();
await cible(page, "02a-direct", pour);
await ecran(page, "02a-direct");
await pour.click();
await settle(page, 2500);
await ecran(page, "02b-pronostic");

// La fiche du match du samedi : il la suit.
await go(page, `/matches/${matchId}`);
await settle(page, 3500);
const cloche = page.getByRole("button", { name: "Suivre ce match" }).first();
await cible(page, "02d-fiche", cloche);
await ecran(page, "02d-fiche");
await cloche.click();
await settle(page, 2000);
await ecran(page, "02e-suivi");
await ctx.close();
