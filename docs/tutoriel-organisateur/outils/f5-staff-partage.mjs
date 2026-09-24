// Chapitres 7 et 8 : s'entourer d'une équipe, publier et partager.
import { open, go, shot, region, settle, loadState, content, PHONE } from "./lib.mjs";

const { cid } = loadState();
const { ctx, page } = await open("kossi");
const panel = () => page.locator(".modal-layer").last().locator(":scope > div").last();

// ---- Staff
await go(page, `/organizer/competitions/${cid}/staff`);
await region(page, "32-staff", content(page), {
  marks: [
    { loc: page.getByRole("button", { name: "Créer un code" }), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: "Ajouter", exact: true }), n: 2, badge: "top" },
  ],
});
await page.getByRole("button", { name: "Créer un code" }).click();
await settle(page, 800);
await page.getByPlaceholder("Kodjo, poule A").fill("Afi, poule A");
const scope = panel().locator("select").first();
await scope.selectOption({ label: "Poule A" });
await panel().locator('input[type="date"]').fill("2026-12-20");
await page.getByPlaceholder("Kodjo, poule A").click();
await settle(page, 400);
await region(page, "33-nouveau-code", panel(), {
  margin: 50,
  marks: [
    { loc: page.getByPlaceholder("Kodjo, poule A"), n: 1 },
    { loc: scope, n: 2 },
    { loc: panel().locator('input[type="date"]'), n: 3 },
    { loc: panel().getByRole("button", { name: /Générer le code/ }), n: 4 },
  ],
});
await panel().getByRole("button", { name: /Générer le code/ }).click();
await settle(page, 2000);
await region(page, "34-code-cree", panel(), {
  margin: 50,
  marks: [
    { loc: panel().getByRole("button", { name: /Partager le lien/ }), n: 1, badge: "top" },
    { loc: panel().getByRole("button", { name: /Copier le code/ }), n: 2, badge: "top" },
  ],
});
await panel().getByRole("button", { name: /Fermer/ }).click().catch(() => {});

// ---- Publier et partager
await go(page, `/organizer/competitions/${cid}`);
await settle(page, 1500);
const share = page.getByText("Ta page publique", { exact: false }).first().locator("xpath=../../..");
await region(page, "35-page-publique-partage", share, {
  marks: [
    { loc: page.getByRole("link", { name: /Voir/ }).or(page.getByRole("button", { name: /^Voir$/ })).first(), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /Partager/ }).first(), n: 2, badge: "top" },
  ],
});
await region(page, "36-statut", page.getByText("Statut", { exact: true }).locator("xpath=.."), {
  marks: [{ loc: page.getByRole("button", { name: "Inscriptions" }), n: 1, badge: "top" }],
});
await ctx.close();

// ---- La page publique, sur téléphone
const phone = await open("public-phone", PHONE);
await go(phone.page, "/c/coupe-des-quartiers-2026");
await settle(phone.page, 2500);
await shot(phone.page, "37-page-publique-mobile");
await phone.ctx.close();
