// Chapitres 5 et 6 : les poules, puis le calendrier.
import { open, go, shot, region, settle, loadState, saveState, content } from "./lib.mjs";
import { TEAMS } from "./roster.mjs";
import { db } from "./admin.mjs";

const { cid } = loadState();
const { ctx, page } = await open("kossi");

// ---- Poules
await go(page, `/organizer/competitions/${cid}/groups`);
const teamRow = (name) =>
  page.locator("div", { has: page.getByText(name, { exact: true }) }).filter({ has: page.locator("select") }).last();
await region(page, "25-poules-vides", content(page), {
  marks: [
    { loc: page.getByRole("button", { name: /Tirage aléatoire/ }), n: 1, badge: "top" },
    { loc: teamRow(TEAMS[0][0]).locator("select"), n: 2 },
  ],
});
for (let i = 0; i < 8; i++) {
  await teamRow(TEAMS[i][0]).locator("select").selectOption({ label: i < 4 ? "Poule A" : "Poule B" });
  await page.waitForTimeout(400);
}
await settle(page, 800);
await region(page, "26-poules-composees", content(page), {
  marks: [{ loc: page.getByRole("button", { name: /Valider les poules/ }), n: 1, badge: "top" }],
});
await page.getByRole("button", { name: /Valider les poules/ }).click();
await settle(page, 2000);

// ---- Calendrier
await go(page, `/organizer/competitions/${cid}/schedule`);
await region(page, "27-calendrier-vide", content(page), {
  marks: [
    { loc: page.getByRole("button", { name: /générer un round-robin/ }), n: 1 },
    { loc: page.getByRole("link", { name: /Importer des matchs/ }).or(page.getByRole("button", { name: /Importer des matchs/ })).first(), n: 2 },
  ],
});
await page.getByRole("button", { name: /générer un round-robin/ }).click();
await settle(page, 3000);
await shot(page, "28-matchs-generes", {
  marks: [{ loc: page.getByRole("button", { name: "Programmer" }).first(), n: 1 }],
});

// Dates : trois journées par poule, deux matchs par jour.
const S = Object.fromEntries(TEAMS.map(([n, s]) => [s, n]));
const PLAN = [
  ["ASB", "EDA", "2026-12-05", "15:00", "Terrain de Bè"], ["FCT", "RAG", "2026-12-05", "17:00", "Terrain de Bè"],
  ["ENY", "UKO", "2026-12-06", "15:00", "Terrain d'Agoè"], ["JHE", "OBA", "2026-12-06", "17:00", "Terrain d'Agoè"],
  ["ASB", "RAG", "2026-12-09", "15:00", "Terrain de Bè"], ["EDA", "FCT", "2026-12-09", "17:00", "Terrain de Bè"],
  ["ENY", "OBA", "2026-12-10", "15:00", "Terrain d'Agoè"], ["UKO", "JHE", "2026-12-10", "17:00", "Terrain d'Agoè"],
  ["ASB", "FCT", "2026-12-12", "15:00", "Terrain de Bè"], ["RAG", "EDA", "2026-12-12", "17:00", "Terrain de Bè"],
  ["ENY", "JHE", "2026-12-13", "15:00", "Terrain d'Agoè"], ["OBA", "UKO", "2026-12-13", "17:00", "Terrain d'Agoè"],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const row = (a, b) =>
  page.locator("div.p-4").filter({ hasText: new RegExp(`${esc(a)} vs ${esc(b)}|${esc(b)} vs ${esc(a)}`) }).first();

for (let i = 0; i < PLAN.length; i++) {
  const [a, b, date, time, venue] = PLAN[i];
  const r = row(S[a], S[b]);
  await r.getByRole("button", { name: /Programmer|Modifier/ }).click();
  await page.waitForTimeout(400);
  await r.locator('input[type="date"]').fill(date);
  await r.locator('input[type="time"]').fill(time);
  await r.getByPlaceholder("Nom du stade").fill(venue);
  await r.getByPlaceholder("Ville").fill("Lomé");
  if (i === 0) {
    await region(page, "29-programmer-un-match", r, {
      margin: 24,
      marks: [
        { loc: r.locator('input[type="date"]'), n: 1, badge: "top" },
        { loc: r.locator('input[type="time"]'), n: 2, badge: "top" },
        { loc: r.getByPlaceholder("Nom du stade"), n: 3, badge: "top" },
        { loc: r.getByRole("button", { name: "Enregistrer" }), n: 4, badge: "top" },
      ],
    });
  }
  await r.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(1500);
}
await page.reload();
await settle(page, 2500);
await region(page, "30-calendrier-programme", content(page), { maxHeight: 1100 });

// Identifiants des matchs, pour la suite.
const ms = await db.collection(`competitions/${cid}/comp_matches`).get();
const matches = {};
for (const m of ms.docs) {
  const d = m.data();
  const sh = TEAMS.find((t) => t[0] === d.home_team_name)[1];
  const sa = TEAMS.find((t) => t[0] === d.away_team_name)[1];
  matches[`${sh}-${sa}`] = m.id;
}
saveState({ matches });

// Le tableau de bord coche les étapes
await go(page, `/organizer/competitions/${cid}`);
await settle(page, 1500);
await region(page, "31-mise-en-place-avancee", page.getByText("Mise en place", { exact: true }).locator("xpath=../.."));

await ctx.close();
