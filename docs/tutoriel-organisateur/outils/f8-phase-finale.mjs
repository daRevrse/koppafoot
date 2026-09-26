// Chapitre 11 : la phase finale.
import { open, go, shot, region, settle, loadState, content } from "./lib.mjs";
import { roster, TEAMS } from "./roster.mjs";

const { cid } = loadState();
const S = Object.fromEntries(TEAMS.map(([n, s]) => [s, n]));
const idx = Object.fromEntries(TEAMS.map(([, s], i) => [s, i]));
const attaquants = (s) => { const r = roster(idx[s]); return [r[9][0], r[10][0], r[8][0]]; };

const { ctx, page } = await open("kossi");
page.on("dialog", async (d) => { console.log("DIALOG:", d.message().slice(0, 200)); await d.accept(); });
await page.clock.setFixedTime(new Date("2026-12-14T10:00:00Z"));
await go(page, `/organizer/competitions/${cid}/knockout`);
await settle(page, 1500);

// 1. Générer le tableau
const generer = page.getByRole("button", { name: /générer automatiquement/ });
if (await generer.count()) {
  await region(page, "62-phase-finale-vide", content(page), {
    marks: [
      { loc: page.getByRole("button", { name: "4 équipes" }), n: 1, badge: "top" },
      { loc: page.getByRole("button", { name: /Dessiner le tableau/ }), n: 2 },
      { loc: generer, n: 3 },
    ],
  });
  await generer.click();
  await settle(page, 3000);
  const prov = page.locator("select").filter({ has: page.locator("option", { hasText: "1er poule A" }) });
  await region(page, "63-tableau-genere", content(page), {
    maxHeight: 1000,
    marks: [
      { loc: page.getByText(/À vérifier avant de lancer/).locator("xpath=../.."), n: 1 },
      { loc: prov.first(), n: 2 },
    ],
  });
  const wanted = ["1er poule A", "2e poule B", "1er poule B", "2e poule A"];
  for (let i = 0; i < 4; i++) {
    await prov.nth(i).selectOption({ label: wanted[i] });
    await page.waitForTimeout(1200);
  }
  await page.getByRole("button", { name: /Attribuer les places/ }).click();
  await settle(page, 2500);
}
await region(page, "64-places-attribuees", content(page), {
  maxHeight: 950,
  marks: [
    { loc: page.getByRole("button", { name: /Attribuer les places/ }), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /Passer en phase finale/ }), n: 2, badge: "top" },
  ],
});
const passer = page.getByRole("button", { name: /Passer en phase finale/ });
if ((await passer.count()) && (await passer.isEnabled())) {
  await passer.click();
  await settle(page, 2000);
}

// 2. Dates des matchs à élimination
const PLAN = [
  ["2026-12-19", "15:00", "Terrain de Bè"],
  ["2026-12-19", "17:00", "Terrain de Bè"],
  ["2026-12-20", "16:30", "Terrain de Bè"],
  ["2026-12-20", "14:00", "Terrain de Bè"],
];
const kpanel = () => page.locator(".modal-layer").last().locator(":scope > div").last();
for (let i = 0; i < PLAN.length; i++) {
  const aucune = page.getByRole("button", { name: /Aucune date/ }).first();
  if (!(await aucune.count())) break;
  if (i === 0) {
    await region(page, "65a-aucune-date", aucune.locator("xpath=.."), { margin: 30,
      marks: [{ loc: aucune, n: 1, badge: "top" }],
    });
  }
  await aucune.click();
  await settle(page, 700);
  const [date, time, venue] = PLAN[i];
  await kpanel().locator('input[type="date"]').fill(date);
  await kpanel().locator('input[type="time"]').fill(time);
  await kpanel().getByPlaceholder("Nom du stade").fill(venue);
  await kpanel().getByPlaceholder("Ville").fill("Lomé");
  if (i === 0) {
    await region(page, "65-date-demi-finale", kpanel(), { margin: 40,
      marks: [{ loc: kpanel().getByRole("button", { name: /Enregistrer/ }), n: 1 }],
    });
  }
  await kpanel().getByRole("button", { name: /Enregistrer/ }).click();
  await page.waitForTimeout(1500);
}

// 3. Résultats (on se place après les demi-finales)
await ctx.close();
const { ctx: ctx2, page: p2 } = await open("kossi");
p2.on("dialog", async (d) => { await d.accept(); });
const panel = () => p2.locator(".modal-layer").last().locator(":scope > div").last();

async function saisir(a, sa, b, sb, capture) {
  await go(p2, `/organizer/competitions/${cid}/knockout`);
  await settle(p2, 1500);
  const carte = p2.locator("div.border, div.bg-white").filter({ hasText: S[a] }).filter({ hasText: S[b] })
    .filter({ has: p2.getByRole("button", { name: /Ajouter score/ }) }).last();
  await carte.getByRole("button", { name: /Ajouter score/ }).click();
  await settle(p2, 800);
  const titre = await panel().innerText();
  const homeFirst = titre.indexOf(S[a]) < titre.indexOf(S[b]);
  const [hs, as] = homeFirst ? [sa, sb] : [sb, sa];
  const [hT, aT] = homeFirst ? [a, b] : [b, a];
  const nums = panel().locator('input[type="number"]');
  await nums.nth(0).fill(String(hs));
  await nums.nth(1).fill(String(as));
  await settle(p2, 600);
  const selects = panel().locator("select").filter({ has: p2.locator("option", { hasText: "Buteur inconnu" }) });
  const n = await selects.count();
  for (let g = 0; g < n; g++) {
    const team = g < hs ? hT : aT;
    const k = g < hs ? g : g - hs;
    const name = attaquants(team)[k % 3];
    const label = (await selects.nth(g).locator("option").allInnerTexts()).find((o) => o.includes(name));
    if (label) await selects.nth(g).selectOption({ label });
  }
  if (capture) await region(p2, capture, panel(), { margin: 40,
    marks: [{ loc: panel().getByRole("button", { name: /Valider le score/ }), n: 1 }],
  });
  await panel().getByRole("button", { name: /Valider le score/ }).click();
  await p2.waitForTimeout(2500);
}

await saisir("ASB", 2, "OBA", 0, null);
await saisir("JHE", 1, "FCT", 2, null);

// Petite finale : placer les perdants à la main
await go(p2, `/organizer/competitions/${cid}/knockout`);
await settle(p2, 1500);
const petite = p2.getByText("Petite finale", { exact: true }).locator("xpath=ancestor::section[1] | ancestor::div[.//text()[contains(., 'À déterminer')]][1]").first();
for (const [i, s] of [[0, "OBA"], [1, "JHE"]]) {
  const slot = p2.getByText("À déterminer").first().locator("xpath=ancestor::div[.//button][1]");
  await slot.locator('button[title="Placer une équipe à la main"]').or(slot.locator("button")).first().click();
  await settle(p2, 600);
  const sel = p2.locator("select").filter({ has: p2.locator("option", { hasText: "Choisir une équipe" }) }).first();
  await sel.selectOption({ label: S[s] });
  if (i === 0) {
    await region(p2, "66-placer-a-la-main", sel.locator("xpath=ancestor::div[.//button][2]"), { margin: 30,
      marks: [
        { loc: sel, n: 1, badge: "top" },
        { loc: p2.locator('button[title="Valider"]').first(), n: 2, badge: "top" },
      ],
    });
  }
  await p2.locator('button[title="Valider"]').first().click();
  await p2.waitForTimeout(1500);
}

await saisir("JHE", 3, "OBA", 1, null);
await saisir("ASB", 2, "FCT", 1, "67-score-finale");

await go(p2, `/organizer/competitions/${cid}/knockout`);
await settle(p2, 2000);
await region(p2, "68-tableau-complet", content(p2), { maxHeight: 1500 });
await ctx2.close();
