// Chapitres 1 et 2 : créer son compte, devenir organisateur.
import { open, go, shot, region, settle } from "./lib.mjs";
import { approveAllPending } from "./admin.mjs";

const { ctx, page } = await open("kossi");

// 1. La page Organisateurs
await go(page, "/organisateurs");
await shot(page, "01-page-organisateurs", {
  marks: [{ loc: page.getByRole("link", { name: /Déposer ma candidature/i }).first(), n: 1 }],
});

await page.getByRole("link", { name: /Déposer ma candidature/i }).first().click();
await page.waitForURL(/candidature/);
await settle(page, 2000);
await region(page, "02-creer-mon-compte", page.locator("#candidature"), {
  marks: [{ loc: page.getByRole("button", { name: /Créer mon compte/i }), n: 1 }],
});

await page.getByRole("button", { name: /Créer mon compte/i }).click();
await settle(page, 1000);
await region(page, "03-fenetre-connexion", page.getByRole("dialog"), {
  margin: 50,
  marks: [
    { loc: page.getByRole("link", { name: /Créer un compte/i }), n: 1, pad: 4 },
    { loc: page.getByRole("button", { name: /Continuer avec Google/i }).first(), n: 2 },
  ],
});

await page.getByRole("link", { name: /Créer un compte/i }).click();
await page.waitForURL(/signup/);
await settle(page, 1500);
await page.fill("#firstName", "Kossi");
await page.fill("#lastName", "Mensah");
await page.fill("#signupEmail", "kossi.mensah@example.com");
await page.fill("#signupPassword", "Coupe2026!");
await shot(page, "04-inscription-etape-1", {
  marks: [
    { loc: page.locator("#firstName").locator("xpath=../.."), n: 1 },
    { loc: page.locator("#signupEmail").locator("xpath=../.."), n: 2 },
    { loc: page.locator("#signupPassword").locator("xpath=../.."), n: 3 },
    { loc: page.getByRole("button", { name: /^Continuer$/ }), n: 4 },
  ],
});
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.fill("#signupPhone", "+22890000000");
await shot(page, "05-inscription-etape-2", {
  marks: [{ loc: page.getByRole("button", { name: /Créer mon compte/i }), n: 1 }],
});
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
await page.waitForTimeout(1500);
await shot(page, "06-compte-cree", {
  marks: [{ loc: page.getByText("Compte créé ! Vérifiez votre email."), pad: 12 }],
});

// 2. La candidature
await go(page, "/organisateurs/candidature");
await settle(page, 2000);
await page.getByPlaceholder(/Décris ta compétition/).fill(
  "Tournoi inter-quartiers de Lomé : 8 équipes, 2 poules de 4, puis demi-finales et finale, sur le terrain de Bè en décembre. J'organise ce tournoi chaque année depuis 2022.",
);
await page.getByPlaceholder(/Tournoi inter-quartiers/).fill("Coupe des Quartiers 2026");
const form = page.locator("#candidature");
await region(page, "07-candidature", form, {
  marks: [
    { loc: form.locator("input").first(), n: 1 },
    { loc: page.getByPlaceholder(/Décris ta compétition/), n: 2 },
    { loc: page.getByRole("button", { name: /Envoyer ma candidature/ }), n: 3 },
  ],
});
await page.getByRole("button", { name: /Envoyer ma candidature/ }).click();
await settle(page, 2500);
await region(page, "08-candidature-envoyee", page.getByText("Candidature en cours d'examen").locator("xpath=.."));

// L'équipe KoppaFoot valide la candidature (simulé).
await approveAllPending();
await page.reload();
await settle(page, 2500);
await region(page, "09-deja-organisateur", page.getByText("Tu es déjà organisateur").locator("xpath=.."), {
  marks: [{ loc: page.getByRole("link", { name: /Ouvrir mon espace organisateur/ }), n: 1 }],
});

// Retrouver son espace ensuite : le menu MySpace
await go(page, "/");
await page.getByRole("button", { name: /MySpace/i }).first().click();
await settle(page, 800);
await shot(page, "10-menu-myspace", {
  clip: { x: 520, y: 0, width: 760, height: 300 },
  marks: [
    { loc: page.getByRole("button", { name: /MySpace/i }).first(), n: 1 },
    { loc: page.getByText(/Compétitions organisées/i).first().locator("xpath=.."), n: 2 },
  ],
});
await page.getByText(/Compétitions organisées/i).first().click();
await page.waitForURL(/\/organizer/);
await settle(page, 2000);
await shot(page, "11-mes-competitions", {
  marks: [{ loc: page.getByRole("link", { name: /Nouvelle compétition/ }).first(), n: 1 }],
});

await ctx.close();
