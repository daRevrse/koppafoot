// Chapitre 10 : saisir un résultat après coup, les classements.
import { open, go, shot, region, settle, loadState, content, PHONE } from "./lib.mjs";
import { roster, TEAMS } from "./roster.mjs";

const { cid } = loadState();
const APRES_LES_POULES = new Date("2026-12-14T10:00:00Z");
const S = Object.fromEntries(TEAMS.map(([n, s]) => [s, n]));
const idx = Object.fromEntries(TEAMS.map(([, s], i) => [s, i]));

// Résultats des poules (hors ASB-EDA, joué en direct).
const RESULTATS = [
  ["FCT", 1, "RAG", 1], ["ASB", 3, "RAG", 0], ["EDA", 0, "FCT", 2], ["ASB", 1, "FCT", 1], ["RAG", 2, "EDA", 2],
  ["ENY", 0, "UKO", 1], ["JHE", 2, "OBA", 0], ["ENY", 1, "OBA", 1], ["UKO", 1, "JHE", 3], ["ENY", 0, "JHE", 2], ["OBA", 2, "UKO", 1],
];
const attaquants = (s) => { const r = roster(idx[s]); return [r[9][0], r[10][0], r[8][0]]; };

const { ctx, page } = await open("kossi");
await page.clock.setFixedTime(APRES_LES_POULES);
await go(page, `/organizer/competitions/${cid}/schedule`);
await settle(page, 2000);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const row = (a, b) =>
  page.locator("div.p-4").filter({ hasText: new RegExp(`${esc(a)} vs ${esc(b)}|${esc(b)} vs ${esc(a)}`) }).first();
const panel = () => page.locator(".modal-layer").last().locator(":scope > div").last();

for (let i = 0; i < RESULTATS.length; i++) {
  const [a, sa, b, sb] = RESULTATS[i];
  const r = row(S[a], S[b]);
  await r.scrollIntoViewIfNeeded();
  if (i === 0) {
    await page.evaluate(() => window.scrollBy(0, -80));
    await region(page, "58-date-depassee", r, {
      margin: 24,
      marks: [{ loc: r.getByRole("button", { name: "Ajouter score" }), n: 1, badge: "top" }],
    });
  }
  await r.getByRole("button", { name: "Ajouter score" }).click();
  await settle(page, 800);
  // Qui est à domicile dans ce match ?
  const titre = await panel().innerText();
  const homeFirst = titre.indexOf(S[a]) < titre.indexOf(S[b]);
  const [hs, as] = homeFirst ? [sa, sb] : [sb, sa];
  const [hTeam, aTeam] = homeFirst ? [a, b] : [b, a];
  const nums = panel().locator('input[type="number"]');
  await nums.nth(0).fill(String(hs));
  await nums.nth(1).fill(String(as));
  await settle(page, 600);
  // Buteurs : une ligne par but, domicile d'abord.
  const selects = panel().locator("select").filter({ has: page.locator("option", { hasText: "Buteur inconnu" }) });
  const n = await selects.count();
  const mins = [12, 27, 44, 51, 58];
  for (let g = 0; g < n; g++) {
    const team = g < hs ? hTeam : aTeam;
    const k = g < hs ? g : g - hs;
    const name = attaquants(team)[k % 3];
    const label = (await selects.nth(g).locator("option").allInnerTexts()).find((o) => o.includes(name));
    if (label) await selects.nth(g).selectOption({ label });
    const minInput = panel().getByPlaceholder("min").nth(g);
    if (await minInput.count()) await minInput.fill(String(mins[g % mins.length]));
  }
  if (i === 0) {
    await region(page, "59-ajouter-le-score", panel(), { margin: 40,
      marks: [
        { loc: nums.nth(0), union: nums.nth(1), n: 1 },
        { loc: selects.first(), n: 2 },
        { loc: panel().getByRole("button", { name: /Valider le score/ }), n: 3 },
      ],
    });
  }
  await panel().getByRole("button", { name: /Valider le score/ }).click();
  await page.waitForTimeout(2000);
}
await settle(page, 1500);
await ctx.close();

// Le classement public se calcule seul
const pub = await open("public-phone", PHONE);
await pub.page.clock.setFixedTime(APRES_LES_POULES);
await go(pub.page, "/c/coupe-des-quartiers-2026");
await settle(pub.page, 2000);
await pub.page.getByRole("button", { name: /Classement/i }).or(pub.page.getByRole("tab", { name: /Classement/i })).or(pub.page.getByRole("link", { name: /Classement/i })).first().click();
await settle(pub.page, 2000);
const onglets = pub.page.getByText(/^Calendrier$/i).first();
await onglets.scrollIntoViewIfNeeded();
await pub.page.evaluate(() => window.scrollBy(0, -90));
await shot(pub.page, "60-classement");
await pub.page.getByRole("button", { name: /Buteurs/i }).or(pub.page.getByRole("tab", { name: /Buteurs/i })).or(pub.page.getByRole("link", { name: /Buteurs/i })).first().click().catch(() => console.log("pas d'onglet buteurs"));
await settle(pub.page, 2000);
await onglets.scrollIntoViewIfNeeded();
await pub.page.evaluate(() => window.scrollBy(0, -90));
await shot(pub.page, "61-buteurs");
await pub.ctx.close();
