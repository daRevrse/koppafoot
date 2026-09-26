// Chapitre 2 : créer son équipe et lui donner ses couleurs.
import { open, go, shot, region, settle, saveState, modale, content } from "./lib.mjs";
const A = process.env.ASSETS ?? "actifs";

let { ctx, page } = await open("edem");
await go(page, "/teams");
await settle(page, 1500);
await shot(page, "06-mes-equipes-vide", {
  marks: [{ loc: page.getByRole("button", { name: "Créer une équipe" }).first(), n: 1, badge: "top" }],
});

await page.getByRole("button", { name: "Créer une équipe" }).first().click();
await settle(page, 800);
const m = modale(page);
await page.getByPlaceholder("FC Koppa").fill("Avenir d'Adakpamé");
await page.getByPlaceholder("Paris").fill("Lomé");
await page.getByPlaceholder("Décris ton équipe...").fill("Club de quartier d'Adakpamé : on joue le dimanche matin et on s'entraîne le mercredi soir.");
await m.locator("select").last().selectOption({ label: "Amateur" });
await m.locator('input[type="number"]').fill("20");
await shot(page, "07-creer-equipe", {
  marks: [
    { loc: page.getByPlaceholder("FC Koppa"), n: 1 },
    { loc: page.getByPlaceholder("Paris"), n: 2 },
    { loc: m.locator("select").last(), union: m.locator('input[type="number"]'), n: 3 },
    { loc: m.getByRole("button", { name: "Créer l'équipe" }), n: 4 },
  ],
});
await m.getByRole("button", { name: "Créer l'équipe" }).click();
await settle(page, 2500);
const carte = page.getByRole("link", { name: /Adakpamé/ }).first();
const href = await carte.getAttribute("href");
const teamId = href.split("/").pop();
saveState({ teamId, teamUrl: `/teams/${teamId}` });
await shot(page, "08-equipe-creee", { marks: [{ loc: carte, n: 1 }] });

// Écusson, bannière, slogan : la fiche de l'équipe
await page.setViewportSize({ width: 1280, height: 1060 });
await go(page, `/teams/${teamId}`);
await settle(page, 1500);
await page.getByRole("button", { name: "Modifier l'équipe" }).click();
await settle(page, 800);
const e = modale(page);
await page.locator("#banner-input").setInputFiles(`${A}/banniere-avenir.png`);
await page.locator("#logo-input").setInputFiles(`${A}/ecusson-avenir.png`);
await page.getByPlaceholder("Ex: Toujours debout !").fill("L'avenir se joue le dimanche");
await settle(page, 1000);
await shot(page, "09-modifier-equipe", {
  marks: [
    { loc: page.locator("#banner-input").locator("xpath=.."), n: 1 },
    { loc: page.locator("#logo-input").locator("xpath=.."), n: 2 },
    { loc: page.getByPlaceholder("Ex: Toujours debout !"), n: 3 },
    { loc: e.getByRole("button", { name: /Enregistrer/ }), n: 4 },
  ],
});
await e.getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(4000);
await page.setViewportSize({ width: 1280, height: 800 });
await go(page, `/teams/${teamId}`);
await settle(page, 2500);
const onglets = page.getByRole("button", { name: /^À propos/ }).first();
await shot(page, "10-page-equipe", {
  marks: [
    { loc: onglets, union: page.getByRole("button", { name: /^Paramètres/ }).first(), n: 1, pad: 6 },
    { loc: page.getByRole("button", { name: "Modifier l'équipe" }), n: 2, badge: "top" },
  ],
});
await ctx.close();

// L'adversaire des chapitres suivants : Kokou Tepe et l'Olympique de Tokoin.
({ ctx, page } = await open("kokou"));
await go(page, "/signup?role=manager");
await page.fill("#firstName", "Kokou");
await page.fill("#lastName", "Tepe");
await page.fill("#signupEmail", "kokou.tepe@example.com");
await page.fill("#signupPassword", "Equipe2026!");
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await go(page, "/teams");
await page.getByRole("button", { name: "Créer une équipe" }).first().click();
await settle(page, 800);
await page.getByPlaceholder("FC Koppa").fill("Olympique de Tokoin");
await page.getByPlaceholder("Paris").fill("Lomé");
await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
await settle(page, 2500);
const opp = (await page.getByRole("link", { name: /Tokoin/ }).first().getAttribute("href")).split("/").pop();
saveState({ oppTeamId: opp });
await go(page, `/teams/${opp}`);
await page.getByRole("button", { name: "Modifier l'équipe" }).click();
await settle(page, 800);
await page.locator("#logo-input").setInputFiles(`${A}/ecusson-tokoin.png`);
await settle(page, 800);
await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(4000);
await ctx.close();
