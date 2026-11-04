// Scène 1 : le passé d'Ekoué. Le match du dimanche dernier se joue en
// coulisses : Ekoué, sans compte, marque deux fois et fait marquer Kafui.
// Puis deux écrans, vus par un visiteur : la fiche du match, et le
// classement des joueurs, où Ekoué figure sans photo ni lien.
import { open, go, settle, shot, cible, loadState, saveState, PHONE } from "./lib.mjs";
import { db } from "./admin.mjs";
import { defi, feuille, console_ } from "./decor.mjs";
import { classement, ligne } from "./classement.mjs";
import { EDEM, KOKOU, TITULAIRES, TOKOIN, MATCH1 } from "./roster.mjs";

const mid = await defi(MATCH1);
saveState({ match1: mid });
await feuille(mid, "edem", EDEM, TITULAIRES);
await feuille(mid, "kokou", KOKOU, TOKOIN.slice(0, 11).map(([p, n]) => `${p} ${n}`));

const c = await console_(mid, { capture: "j1" });
await c.but("Kafui Mensah", "Ekoué Bawa", 12);
await c.but("Ekoué Bawa", "Selom Adjo", 34);
await c.miTemps();
await c.but("Tchao Assiongbon", null, 51);
await c.but("Ekoué Bawa", null, 77);
await c.fin("Ekoué Bawa");
await c.fermer();

const m = (await db.doc(`matches/${mid}`).get()).data();
console.log("match 1 :", m.status, m.date, JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => /score/.test(k)))));

// Le visiteur : la fiche du match, son fil, puis le classement.
const v = await open("visiteur", PHONE);
await go(v.page, `/matches/${mid}`);
await settle(v.page, 3000);
await shot(v.page, "01-fiche-match1");
const h = v.page.getByText("Historique", { exact: true }).first();
if (await h.count()) {
  await h.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 200));
  await settle(v.page, 1200);
  await cible(v.page, "01b-fil-match1", v.page.getByText("Ekoué Bawa").first());
  await shot(v.page, "01b-fil-match1");
}
// Le classement : Ekoué y est, mais sans photo, et son nom ne mène nulle part.
await classement(v.page, (p) => p.getByText("Ekoué Bawa", { exact: true }).count().then((n) => n > 0));
await cible(v.page, "02-classement-avant", ligne(v.page, "Ekoué Bawa"));
await shot(v.page, "02-classement-avant");
await v.ctx.close();
console.log("passé joué");
