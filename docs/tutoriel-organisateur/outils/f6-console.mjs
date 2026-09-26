// Chapitre 9 : le jour du match, la console live (téléphone).
import { open, go, shot, region, settle, loadState, loginUI, content, PHONE, PHONE_LAND, DESKTOP } from "./lib.mjs";
import { setClock } from "./admin.mjs";

const { cid, matches } = loadState();
const mid = matches["ASB-EDA"];
const LIVE = `/organizer/competitions/${cid}/matches/${mid}/live`;

// ---- Portrait : trouver le match, remplir les feuilles
let { ctx, page } = await open("kossi-phone", PHONE);
await loginUI(page, "kossi.mensah@example.com", "Coupe2026!");
await go(page, `/organizer/competitions/${cid}/schedule`);
await settle(page, 2000);
const row = page.locator("div.p-4").filter({ hasText: "AS Bè vs Étoile d'Adidogomé" }).first();
await row.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -120));
await shot(page, "38-ouvrir-la-console", {
  marks: [{ loc: row.getByRole("link", { name: /Console live/ }), n: 1 }],
});

await go(page, LIVE);
await settle(page, 2500);
const horsFeuille = () => page.locator("button:visible", { hasText: /Hors feuille/i });
await shot(page, "39-feuille-vide", {
  marks: [
    { loc: page.getByText(/Titulaires/i).first(), n: 1, pad: 6 },
    { loc: horsFeuille().first(), n: 2 },
  ],
});
async function remplirFeuille() {
  let guard = 0;
  while ((await horsFeuille().count()) && guard++ < 20) {
    await horsFeuille().first().click();
    await page.waitForTimeout(120);
  }
}
await remplirFeuille();
await settle(page, 500);
const valider = () => page.getByRole("button", { name: /Valider la feuille/i }).locator("visible=true").first();
await shot(page, "40-feuille-remplie", {
  marks: [
    { loc: page.getByText(/Titulaires/i).first(), n: 1, pad: 6 },
    { loc: valider(), n: 2 },
  ],
});
await valider().click();
await settle(page, 1500);
await page.getByRole("button", { name: "Étoile d'Adidogomé" }).first().click();
await settle(page, 800);
await remplirFeuille();
await valider().click();
await settle(page, 1500);
await shot(page, "41-feuilles-validees", {
  marks: [{ loc: page.getByRole("button", { name: /Coup d'envoi/i }), n: 1 }],
});
await page.getByRole("button", { name: /Coup d'envoi/i }).click();
await settle(page, 2500);
await shot(page, "42-tourne-ton-telephone");
await ctx.close();

// ---- Paysage : le match
({ ctx, page } = await open("kossi-phone", PHONE_LAND));
await go(page, LIVE);
await settle(page, 2500);
const joueur = (nom) => page.getByRole("button", { name: `${nom}, actions` }).first();
const modal = () => page.locator(".modal-layer").last();
await shot(page, "43-console-avant-lancer", {
  marks: [
    { loc: page.getByRole("button", { name: /^Lancer$/i }).first(), n: 1 },
  ],
});
await page.getByRole("button", { name: /^Lancer$/i }).first().click();
await settle(page, 1000);
await setClock(cid, mid, 12);
await settle(page, 1500);
await shot(page, "44-console-en-cours", {
  marks: [
    { loc: page.getByText(/1ère mi-temps/i).first().locator("xpath=.."), n: 1, badge: "top" },
    { loc: joueur("Fiifi Lawson"), n: 2, pad: 2 },
    { loc: page.getByRole("button", { name: /Corner/i }).first(), n: 3, badge: "top" },
  ],
});

// But + passe décisive
await setClock(cid, mid, 18);
await settle(page, 1200);
await joueur("Fiifi Lawson").click();
await settle(page, 800);
await shot(page, "45-actions-joueur", {
  marks: [
    { loc: modal().getByRole("button", { name: /But$/ }).first(), n: 1 },
    { loc: modal().getByRole("button", { name: /Carton jaune/ }), n: 2, badge: "right" },
    { loc: modal().getByRole("button", { name: /Remplacer/ }), n: 3, badge: "right" },
  ],
});
await modal().getByRole("button", { name: /But$/ }).first().click();
await settle(page, 1000);
await shot(page, "46-passe-decisive", {
  marks: [
    { loc: modal().getByRole("button", { name: /Dodzi Dzidzonu/ }).first(), n: 1, badge: "right" },
    { loc: modal().getByRole("button", { name: /Aucune passe/ }).first(), n: 2 },
  ],
});
await modal().getByRole("button", { name: /Dodzi Dzidzonu/ }).first().click();
await settle(page, 1500);
await shot(page, "47-but-marque", {
  marks: [{ loc: page.getByText("AS Bè", { exact: true }).first(), union: page.getByText("AS Bè", { exact: true }).first().locator("xpath=following-sibling::*[1]"), n: 1 }],
});

// Carton jaune
await setClock(cid, mid, 24);
await settle(page, 1200);
await joueur("Kwami Tsogbe").click();
await settle(page, 700);
await modal().getByRole("button", { name: /Carton jaune/ }).click();
await settle(page, 1500);
await shot(page, "48-carton-jaune", {
  marks: [{ loc: joueur("Kwami Tsogbe"), n: 1, pad: 8 }],
});

// Remplacement
await setClock(cid, mid, 27);
await settle(page, 1200);
await joueur("Mawuena Dossou").click();
await settle(page, 700);
await modal().getByRole("button", { name: /Remplacer/ }).click();
await settle(page, 1000);
await shot(page, "49-qui-entre", {
  marks: [{ loc: modal().getByRole("button", { name: /Mawuli Hounkpati/ }).first(), n: 1, badge: "right" }],
});
await modal().getByRole("button", { name: /Mawuli Hounkpati/ }).first().click();
await settle(page, 1500);

// L'historique, pour corriger une erreur
await page.getByRole("button", { name: /Compteurs et historique/ }).click();
await settle(page, 1200);
await shot(page, "50-historique");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: /Compteurs et historique/ }).click().catch(() => {});
await settle(page, 800);

// Fin de la première période : le chrono s'arrête seul
await setClock(cid, mid, 30);
await settle(page, 2500);
await shot(page, "51-fin-premiere-periode", {
  marks: [{ loc: page.getByRole("button", { name: /^Mi-temps$/i }).first(), n: 1 }],
});
await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
await settle(page, 1500);
await shot(page, "52-mi-temps", {
  marks: [{ loc: page.getByRole("button", { name: /^Reprise$/i }).first(), n: 1 }],
});

// Pendant ce temps, le public suit le match
const pub = await open("public-phone", PHONE);
await go(pub.page, "/c/coupe-des-quartiers-2026");
await settle(pub.page, 2500);
await shot(pub.page, "53-public-en-direct");
await pub.ctx.close();

// Seconde période
await page.getByRole("button", { name: /^Reprise$/i }).first().click();
await settle(page, 1500);
await setClock(cid, mid, 41);
await settle(page, 1200);
await joueur("Selom Akpaki").click();
await settle(page, 600);
await modal().getByRole("button", { name: /But$/ }).first().click();
await settle(page, 900);
await modal().getByRole("button", { name: /Kwami Tsogbe/ }).first().click();
await settle(page, 1500);
// Le bouton « But » reste verrouillé quelques secondes après un but.
await page.waitForTimeout(32000);
await setClock(cid, mid, 52);
await settle(page, 1200);
await joueur("Yao Ayivi").click();
await settle(page, 600);
await modal().getByRole("button", { name: /But$/ }).first().click();
await settle(page, 900);
await modal().getByRole("button", { name: /Fiifi Lawson/ }).first().click();
await settle(page, 1500);

// Fin du match
await setClock(cid, mid, 60);
await settle(page, 2500);
await shot(page, "54-fin-du-temps-reglementaire", {
  marks: [{ loc: page.getByRole("button", { name: /Fin du match/i }).first(), n: 1 }],
});
await page.getByRole("button", { name: /Fin du match/i }).first().click();
await settle(page, 1000);
await shot(page, "55-terminer-le-match", {
  marks: [{ loc: page.getByRole("button", { name: /Coup de sifflet final/i }).first(), n: 1 }],
});
await page.getByRole("button", { name: /Coup de sifflet final/i }).first().click();
await settle(page, 2500);
await shot(page, "56-homme-du-match", {
  marks: [
    { loc: modal().locator("button", { hasText: "Fiifi Lawson" }).first(), n: 1 },
    { loc: modal().getByRole("button", { name: /Terminer sans désigner/ }), n: 2 },
  ],
});
await modal().locator("button", { hasText: "Fiifi Lawson" }).first().click();
await settle(page, 3500);
await ctx.close();

// Le résultat est dans le calendrier
({ ctx, page } = await open("kossi", DESKTOP));
await go(page, `/organizer/competitions/${cid}/schedule`);
await settle(page, 2000);
const done = page.locator("div.p-4").filter({ hasText: "AS Bè vs Étoile d'Adidogomé" }).first();
await region(page, "57-resultat-dans-le-calendrier", done, {
  margin: 30,
  marks: [
    { loc: done.getByText("2 - 1"), n: 1, badge: "top", pad: 4 },
    { loc: done.getByRole("button", { name: /Score & buteurs/ }), n: 2, badge: "top" },
  ],
});
await ctx.close();
