import fs from "node:fs";
// Scène 04, avant le coup d'envoi : Edem compose son équipe (un joueur
// glissé sur le terrain, le blessé sur le banc) ; Kokou remplit la sienne ;
// Komi est désigné, Afi tiendra la console.
import { open, go, settle, ecran, cible, loadState, loginUI, PHONE } from "./lib.mjs";
import { api, db, setSquadNumbers, uidOf } from "./admin.mjs";
import { EDEM, KOKOU, TITULAIRES, TOKOIN, ARBITRE, JOUEURS, GARDIEN, BLESSE } from "./roster.mjs";
const { matchId: mid, teamId, komi, afi } = loadState();

// Ekoué s'est tordu la cheville à l'entraînement : il l'a déclaré.
for (const d of (await db.collection(`teams/${teamId}/ghost_players`).get()).docs) {
  if (`${d.data().first_name} ${d.data().last_name}` === BLESSE) {
    await d.ref.update({ condition: { statut: "blesse", retour_prevu: "2026-10-31", note: "Entorse de la cheville", declaree_le: new Date().toISOString() } });
  }
}

// Les dossards des joueurs avec compte, comme le manager les enregistre.
const dossards = { "Dodzi Ahadji": "1", "Etse Gbeassor": "5", "Selom Adjo": "7", "Kafui Mensah": "9", "Enyonam Kpodar": "14" };
const parNom = Object.fromEntries([...JOUEURS, GARDIEN].map((j) => [`${j.first} ${j.last}`, j.email]));
await setSquadNumbers(teamId, Object.fromEntries(await Promise.all(Object.entries(dossards).map(async ([n, d]) => [await uidOf(parNom[n]), d]))));

async function ouvrirFeuille(page) {
  await go(page, `/matches/${mid}`);
  await settle(page, 3000);
  await page.getByRole("tab", { name: /Compo/i }).first().click();
  await settle(page, 1500);
  const b = page.getByRole("button", { name: /Remplir la feuille de match|Modifier la feuille/i }).last();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.getByText("Configuration Tactique").waitFor();
  await settle(page, 1200);
}
async function roles(page, titulaires) {
  const noms = await page.locator('select[aria-label^="Rôle de "]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace("Rôle de ", "")));
  for (const n of noms) await page.getByLabel(`Rôle de ${n}`).selectOption("substitute");
  for (const n of titulaires) await page.getByLabel(`Rôle de ${n}`).selectOption("starter");
  await page.getByRole("button", { name: "4-4-2", exact: true }).click().catch(() => {});
  await settle(page, 900);
}

// Edem, sur son téléphone.
let { ctx, page } = await open("edem-tel", PHONE);
await loginUI(page, EDEM.email, EDEM.mdp);
await ouvrirFeuille(page);
await roles(page, TITULAIRES);
const terrain = page.getByText(/^Sur le terrain/i).first();
await terrain.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => scrollBy(0, -150));
await settle(page, 1000);
// Le joueur qu'Edem fait glisser : Fiifi, monté en attaque à la place de
// Kodjo (les deux s'échangent).
// Le nom figure aussi sur le terrain d'affichage, plus haut : c'est le dernier
// qui est sur le terrain de l'éditeur.
const pastille = async (nom) => {
  const b = await page.locator("svg text", { hasText: nom }).last().boundingBox();
  return { x: b.x + b.width / 2, y: b.y - 14 };
};
const de = await pastille("F. Attiogbé");
const vers = await pastille("K. Amégan");
await cible(page, "04a-compo", page.locator("svg text", { hasText: "F. Attiogbé" }).first());
await ecran(page, "04a-compo");
await page.mouse.move(de.x, de.y);
await page.mouse.down();
for (let k = 1; k <= 12; k++) await page.mouse.move(de.x + ((vers.x - de.x) * k) / 12, de.y + ((vers.y - de.y) * k) / 12);
await page.mouse.up();
await settle(page, 1200);
await ecran(page, "04b-compo-glisse");
fs.writeFileSync("glisse.json", JSON.stringify({ de, vers }));

// Le blessé, dans la liste : à confirmer avant de l'aligner.
const blesse = page.getByText(/^Blessé/).first();
await blesse.evaluate((el) => el.scrollIntoView({ block: "center" }));
await settle(page, 800);
await cible(page, "04c-blesse", blesse);
await ecran(page, "04c-blesse");
await page.getByRole("button", { name: /Envoyer à l'arbitre|Valider la feuille/i }).first().click();
await settle(page, 2500);
await ctx.close();

// Kokou, en coulisses.
({ ctx, page } = await open("kokou"));
await loginUI(page, KOKOU.email, KOKOU.mdp);
await ouvrirFeuille(page);
await roles(page, TOKOIN.slice(0, 11).map(([p, n]) => `${p} ${n}`));
await page.getByRole("button", { name: /Envoyer à l'arbitre|Valider la feuille/i }).first().click();
await settle(page, 2500);
await ctx.close();

// L'arbitrage : Edem invite Komi, qui accepte et compose son équipe.
await api(EDEM.email, EDEM.mdp, "POST", `/api/matches/${mid}/arbitre`, { action: "inviter", arbitreId: komi });
await api(ARBITRE.email, ARBITRE.mdp, "POST", `/api/matches/${mid}/arbitre`, { action: "accepter" });
await api(ARBITRE.email, ARBITRE.mdp, "POST", `/api/matches/${mid}/arbitre`, { action: "composer", assistants: [], scoreur: afi });

const k = await open("komi-tel", PHONE);
await loginUI(k.page, ARBITRE.email, ARBITRE.mdp);
await go(k.page, "/designations");
await settle(k.page, 3000);
const carte = k.page.getByText("Ton équipe pour ce match").first();
await carte.evaluate((el) => el.scrollIntoView({ block: "center" }));
await settle(k.page, 800);
await ecran(k.page, "04d-designation");
await k.ctx.close();
const m = (await db.collection("matches").doc(mid).get()).data();
console.log("feuilles", m.home_lineup_ready, m.away_lineup_ready, "arbitre", m.referee_status, JSON.stringify(m.equipe_arbitrale?.scoreur));
