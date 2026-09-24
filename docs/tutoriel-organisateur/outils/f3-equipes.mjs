// Chapitre 4 : les équipes et leurs effectifs.
import { open, go, shot, region, settle, loadState, content } from "./lib.mjs";
import { roster, TEAMS } from "./roster.mjs";

const A = process.env.ASSETS ?? "actifs";
const { cid } = loadState();
const { ctx, page } = await open("kossi");
const panel = () => page.locator(".modal-layer").last().locator(":scope > div").last();

// Page Équipes vide
await go(page, `/organizer/competitions/${cid}/teams`);
await region(page, "17-equipes-vide", content(page), {
  marks: [
    { loc: page.getByRole("button", { name: "Ajouter une équipe" }).first(), n: 1, badge: "top" },
    { loc: page.getByRole("link", { name: "Importer" }).first(), n: 2, badge: "top" },
  ],
});

// Ajouter une équipe à la main
await page.getByRole("button", { name: "Ajouter une équipe" }).first().click();
await settle(page, 800);
await page.getByPlaceholder("ex: FC Étoile").fill("AS Bè");
await page.getByPlaceholder("ex: ETO").fill("ASB");
await page.locator('[aria-label^="Couleur #"]').first().click();
await page.locator('.modal-layer input[type="file"]').first().setInputFiles(A + "/equipe-as-be.png");
await settle(page, 1200);
const modal = panel();
await region(page, "18-nouvelle-equipe", modal, {
  margin: 50,
  marks: [
    { loc: page.getByPlaceholder("ex: FC Étoile"), n: 1 },
    { loc: page.getByPlaceholder("ex: ETO"), n: 2 },
    { loc: page.getByText("Couleur", { exact: true }).locator("xpath=.."), n: 3 },
    { loc: modal.getByText(/^Logo/).locator("xpath=.."), n: 4 },
    { loc: modal.getByRole("button", { name: "Ajouter", exact: true }), n: 5 },
  ],
});
await modal.getByRole("button", { name: "Ajouter", exact: true }).click();
await settle(page, 2500);
await region(page, "19-equipe-ajoutee", page.locator("div.border", { hasText: "AS Bè" }).filter({ has: page.getByRole("link", { name: /Effectif/ }) }).first(), {
  marks: [
    { loc: page.getByRole("link", { name: /Effectif/ }).first(), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /Inviter un manager/ }).first(), n: 2, badge: "top" },
  ],
});

// Effectif : ajouter un joueur à la main
await page.getByRole("link", { name: /Effectif/ }).first().click();
await page.waitForURL(/teams\/[^/]+$/);
await settle(page, 1500);
await page.getByRole("button", { name: /Ajouter un joueur/ }).first().click();
await settle(page, 800);
await page.getByPlaceholder("ex: Jean Dupont").fill("Kossi Adjévi");
await page.getByPlaceholder("ex: 10").fill("1");
const sel = page.locator(".modal-layer select");
if (await sel.count()) {
  const opts = await sel.first().locator("option").allInnerTexts();
  const gk = opts.find((o) => /Gardien/i.test(o));
  if (gk) await sel.first().selectOption({ label: gk });
}
const pmodal = panel();
await region(page, "20-nouveau-joueur", pmodal, {
  margin: 50,
  marks: [
    { loc: page.getByPlaceholder("ex: Jean Dupont"), n: 1 },
    { loc: page.getByPlaceholder("ex: 10"), n: 2 },
    { loc: pmodal.getByRole("button", { name: "Ajouter", exact: true }), n: 3 },
  ],
});
await pmodal.getByRole("button", { name: "Ajouter", exact: true }).click();
await settle(page, 2000);

// Importer les 7 autres équipes
await go(page, `/organizer/competitions/${cid}/import`);
const tsv = TEAMS.slice(1).map(([n, s, c]) => `${n}\t${s}\t\t${c}`).join("\n");
await page.locator("textarea").first().fill(tsv);
await settle(page, 800);
await region(page, "21-import-equipes", content(page), {
  marks: [
    { loc: page.getByRole("button", { name: "Équipes", exact: true }), n: 1 },
    { loc: page.locator("textarea").first(), n: 2 },
    { loc: page.getByText(/^Aperçu/).locator("xpath=.."), n: 3 },
    { loc: page.getByRole("button", { name: /^Importer \d+/ }), n: 4 },
  ],
});
await page.getByRole("button", { name: /^Importer \d+/ }).click();
await settle(page, 2500);

// Importer les joueurs, équipe par équipe
await page.getByRole("button", { name: "Joueurs", exact: true }).click();
await settle(page, 800);
for (let t = 0; t < TEAMS.length; t++) {
  const select = page.locator("select").first();
  const label = (await select.locator("option").allInnerTexts()).find((o) => o.startsWith(TEAMS[t][0]));
  await select.selectOption({ label });
  await page.locator("textarea").first().fill(roster(t).map((r) => r.join("\t")).join("\n"));
  await settle(page, 500);
  if (t === 1) {
    await region(page, "22-import-joueurs", content(page), {
      marks: [
        { loc: page.getByRole("button", { name: "Joueurs", exact: true }), n: 1 },
        { loc: select, n: 2 },
        { loc: page.locator("textarea").first(), n: 3 },
        { loc: page.getByRole("button", { name: /^Importer \d+/ }), n: 4 },
      ],
    });
  }
  await page.getByRole("button", { name: /^Importer \d+/ }).click();
  await page.waitForTimeout(2000);
}

// Logos des équipes importées (en coulisses)
await go(page, `/organizer/competitions/${cid}/teams`);
for (const [name, , , slug] of TEAMS.slice(1)) {
  await page.getByRole("button", { name: `Modifier ${name}` }).click();
  await settle(page, 600);
  await page.locator('.modal-layer input[type="file"]').first().setInputFiles(`${A}/equipe-${slug}.png`);
  await settle(page, 800);
  await panel().getByRole("button", { name: /Enregistrer/ }).click();
  await page.waitForTimeout(1800);
}
await settle(page, 1500);
await region(page, "23-equipes-inscrites", content(page));

// L'effectif complet d'une équipe
await go(page, `/organizer/competitions/${cid}/teams`);
const href = await page.getByRole("link", { name: /Effectif/ }).first().getAttribute("href");
await go(page, href);
await settle(page, 1500);
await region(page, "24-effectif", content(page), {
  marks: [{ loc: page.getByRole("button", { name: /Ajouter un joueur/ }).first(), n: 1 }],
});

await ctx.close();
