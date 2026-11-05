// Scène 5 : ce que son compte change, sur le téléphone d'Ekoué.
//  - le classement des joueurs : sa ligne, avec sa photo, mène à sa fiche ;
//  - en coulisses : l'administration publie le joueur de la semaine, celle de
//    son doublé (page admin, ordinateur) ;
//  - le Direct : la diapositive « Joueur de la semaine », l'affiche que
//    « Partager » envoie, puis l'historique de Top performances.
import fs from "node:fs";
import path from "node:path";
import { open, go, settle, shot, cible, loadState, loginUI, OUT, BASE, PHONE, BUREAU } from "./lib.mjs";
import { ensureAdmin, db } from "./admin.mjs";
import { classement, ligne } from "./classement.mjs";
import { EKOUE } from "./roster.mjs";
const { ekoue: uid } = loadState();
const nom = `${EKOUE.prenom} ${EKOUE.nom}`;

// Le classement, recalculé par la fusion : une seule ligne à son nom, la sienne.
const k = await open("ekoue", PHONE);
await loginUI(k.page, EKOUE.email, EKOUE.mdp);
await classement(k.page, async (p) => (await p.locator(`a[href="/profile/${uid}"]`).count()) > 0
  && (await p.getByText(nom, { exact: true }).count()) === 1);
await cible(k.page, "11-classement-apres", ligne(k.page, nom));
await shot(k.page, "11-classement-apres");

// L'administration publie le joueur de la semaine : la page s'ouvre sur la
// semaine terminée, celle du match de dimanche.
const admin = await ensureAdmin();
const a = await open("admin", BUREAU);
await loginUI(a.page, admin.email, admin.password);
await go(a.page, "/admin/joueur-semaine");
await settle(a.page, 4000);
await a.page.getByRole("button", { name: /Aperçu/ }).click();
await settle(a.page, 6000);
await a.page.getByRole("button", { name: /Publier dans l'appli/ }).click();
await a.page.getByText("Publié", { exact: true }).first().waitFor({ timeout: 90000 });
await settle(a.page, 1500);
await a.page.screenshot({ path: "logs/admin-publie.png", fullPage: true });
await a.ctx.close();

// Le Direct, chez Ekoué : la diapositive, dès qu'elle paraît (le carrousel
// défile seul après sept secondes).
for (let essai = 0; ; essai++) {
  await k.page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const ok = await k.page.getByText("Joueur de la semaine", { exact: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (ok) break;
  if (essai > 12) throw new Error("la diapositive n'est pas venue");
  await k.page.waitForTimeout(10000);
}
await k.page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
await k.page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((n) => n.remove()));
await cible(k.page, "12-direct-partager", k.page.getByRole("button", { name: "Partager" }).first());
await shot(k.page, "12-direct-joueur-semaine");

// L'affiche que « Partager » envoie : la diapositive ne la montre pas, on la
// demande à la route publique, à la version de la publication.
const [publication] = (await db.collection("joueurs_semaine").orderBy("lundi", "desc").limit(1).get()).docs;
const verticale = `${BASE}/api/joueur-semaine/${publication.id}/affiche?format=vertical&v=${publication.data().version}`;
const r = await fetch(verticale);
if (!r.ok) throw new Error(`affiche introuvable : ${r.status}`);
fs.writeFileSync(path.join(OUT, "13-affiche.jpg"), Buffer.from(await r.arrayBuffer()));
console.log("📸 13-affiche", r.status);

// L'historique, en tête de Top performances.
await go(k.page, "/top-players");
await settle(k.page, 2500);
await shot(k.page, "14-historique");
await k.ctx.close();
console.log("semaine vécue");
