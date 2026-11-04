// Scène 4 : Ekoué vit son match, puis la semaine qui suit.
//  - en coulisses : le défi du jour, les feuilles ;
//  - chez Ekoué : la fiche du match, la cloche, « Tu suis ce match » ;
//  - en coulisses : la console (Ekoué marque deux fois et fait marquer Kafui) ;
//  - chez Ekoué : la fiche du match terminé ;
//  - un visiteur : le classement d'après, avec la photo d'Ekoué ;
//  - l'administration publie le joueur de la semaine (page admin, ordinateur) ;
//  - un visiteur : la diapositive du Direct, l'affiche, l'historique.
import fs from "node:fs";
import path from "node:path";
import { open, go, settle, shot, cible, loadState, saveState, loginUI, OUT, BASE, PHONE, BUREAU } from "./lib.mjs";
import { ensureAdmin } from "./admin.mjs";
import { defi, feuille, console_ } from "./decor.mjs";
import { classement, ligne } from "./classement.mjs";
import { EDEM, KOKOU, EKOUE, TITULAIRES, TOKOIN, MATCH2 } from "./roster.mjs";
const { ekoue: uid } = loadState();

const mid = await defi(MATCH2);
saveState({ match2: mid });
await feuille(mid, "edem", EDEM, TITULAIRES);
await feuille(mid, "kokou", KOKOU, TOKOIN.slice(0, 11).map(([p, n]) => `${p} ${n}`));

// Ekoué suit son match.
const k = await open("ekoue", PHONE);
await loginUI(k.page, EKOUE.email, EKOUE.mdp);
await go(k.page, `/matches/${mid}`);
await settle(k.page, 3000);
const cloche = k.page.getByRole("button", { name: "Suivre ce match" }).first();
await cible(k.page, "09-fiche-avant", cloche);
await shot(k.page, "09-fiche-avant");
await cloche.click();
await k.page.mouse.move(195, 760);
await k.page.getByText("Tu suis ce match").first().waitFor({ timeout: 10000 });
await k.page.waitForTimeout(700);
await shot(k.page, "09b-fiche-suivie");

// La console, en coulisses. Le chrono posé à m minutes écoulées, la console
// note la minute suivante : 17 → 18'.
const c = await console_(mid);
await c.but("Ekoué Bawa", "Kafui Mensah", 17);
await c.miTemps();
await c.but("Kafui Mensah", "Ekoué Bawa", 51);
await c.but("Ekoué Bawa", null, 80);
await c.fin("Ekoué Bawa");
await c.fermer();

await go(k.page, `/matches/${mid}`);
await settle(k.page, 3000);
await shot(k.page, "10-fiche-finale");
await k.ctx.close();

// Le classement d'après : Ekoué y a son visage, et sa ligne mène à sa fiche.
const v = await open("visiteur", PHONE);
// Une seule ligne à son nom : la fusion a repris ses matchs d'avant.
await classement(v.page, async (p) => (await p.locator(`a[href="/profile/${uid}"]`).count()) > 0
  && (await p.getByText("Ekoué Bawa", { exact: true }).count()) === 1);
await cible(v.page, "11-classement-apres", ligne(v.page, "Ekoué Bawa"));
await shot(v.page, "11-classement-apres");
await v.ctx.close();

// L'administration publie le joueur de la semaine en cours.
const admin = await ensureAdmin();
const a = await open("admin", BUREAU);
await loginUI(a.page, admin.email, admin.password);
await go(a.page, "/admin/joueur-semaine");
await settle(a.page, 4000);
// La page s'ouvre sur la semaine terminée ; le match du jour est dans la suivante.
await a.page.getByRole("button", { name: /Suivante/ }).click();
await settle(a.page, 4000);
await a.page.getByRole("button", { name: /Aperçu/ }).click();
await settle(a.page, 6000);
await a.page.screenshot({ path: "logs/admin-avant.png", fullPage: true });
await a.page.getByRole("button", { name: /Publier dans l'appli/ }).click();
await a.page.getByText("Publié", { exact: true }).first().waitFor({ timeout: 90000 });
await settle(a.page, 1500);
await a.page.screenshot({ path: "logs/admin-publie.png", fullPage: true });
await a.ctx.close();

// Le Direct, sur le téléphone d'un visiteur : la diapositive, dès qu'elle paraît
// (le carrousel défile seul après sept secondes).
const d = await open("visiteur", PHONE);
for (let essai = 0; ; essai++) {
  await d.page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const ok = await d.page.getByText("Joueur de la semaine", { exact: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (ok) break;
  if (essai > 12) throw new Error("la diapositive n'est pas venue");
  await d.page.waitForTimeout(10000);
}
await d.page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
await d.page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((n) => n.remove()));
await cible(d.page, "12-direct-partager", d.page.getByRole("button", { name: "Partager" }).first());
await cible(d.page, "12-direct-suivre", d.page.getByRole("button", { name: "Suivre" }).first());
await shot(d.page, "12-direct-joueur-semaine");

// L'affiche que « Partager » envoie.
const adresse = await d.page.evaluate(() => [...document.images].map((i) => i.getAttribute("src")).find((s) => s?.includes("/api/joueur-semaine/")));
const verticale = new URL(adresse, BASE);
verticale.searchParams.set("format", "vertical");
verticale.searchParams.delete("taille");
const r = await fetch(verticale);
fs.writeFileSync(path.join(OUT, "13-affiche.jpg"), Buffer.from(await r.arrayBuffer()));
console.log("📸 13-affiche", r.status);

// L'historique, en tête de Top performances.
await go(d.page, "/top-players");
await settle(d.page, 2500);
await shot(d.page, "14-historique");
await d.ctx.close();
console.log("semaine vécue");
