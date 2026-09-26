// Chapitre 1 : de la vitrine MyFields à la candidature envoyée.
import { open, go, shot, region, settle } from "./lib.mjs";
import { GERANT, TERRAIN } from "./roster.mjs";

const { ctx, page } = await open("yawo");

// La vitrine des propriétaires de terrain.
await go(page, "/terrains");
await settle(page, 1500);
await shot(page, "01-vitrine", {
  marks: [{ loc: page.getByRole("link", { name: /Référencer mon terrain/ }).first(), n: 1, pad: 4 }],
});

// Sans compte, la candidature commence par en créer un.
await page.getByRole("link", { name: /Référencer mon terrain/ }).first().click();
await page.waitForURL(/candidature/);
await settle(page, 1500);
const bloc = page.locator("section div.border").filter({ hasText: "Il faut un compte" }).first();
await region(page, "02-il-faut-un-compte", bloc, {
  hideHeader: false, margin: 30,
  marks: [{ loc: bloc.getByRole("link", { name: "Créer mon compte" }), n: 1 }],
});
await bloc.getByRole("link", { name: "Créer mon compte" }).click();
await page.waitForURL(/login/);
await settle(page, 1500);
// La moitié droite : le formulaire (la photo de gauche n'apprend rien).
await shot(page, "03-connexion-myfields", {
  clip: { x: 540, y: 0, width: 740, height: 800 },
  marks: [{ loc: page.getByRole("link", { name: "Créer un compte" }), n: 1, badge: "right" }],
});
await page.getByRole("link", { name: "Créer un compte" }).click();
await page.waitForURL(/signup/);
await settle(page, 1500);
await page.fill("#firstName", GERANT.prenom);
await page.fill("#lastName", GERANT.nom);
await page.fill("#signupEmail", GERANT.email);
await page.fill("#signupPassword", GERANT.mdp);
await page.locator("#signupPassword").blur();
await shot(page, "04-inscription", {
  clip: { x: 540, y: 0, width: 740, height: 800 },
  marks: [
    { loc: page.locator("#firstName"), union: page.locator("#lastName"), n: 1 },
    { loc: page.locator("#signupEmail"), n: 2 },
    { loc: page.locator("#signupPassword"), n: 3 },
    { loc: page.getByRole("button", { name: /^Continuer$/ }), n: 4 },
  ],
});
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.getByRole("button", { name: /Créer mon compte/i }).click();
// Le compte créé, on revient tout seul à la candidature.
await page.waitForURL(/terrains\/candidature/, { timeout: 60000 });
await settle(page, 2500);

// Le formulaire.
await page.locator("#nom").fill(TERRAIN.nom);
await page.locator("#ville").fill(TERRAIN.ville);
await page.locator("#tel").fill(TERRAIN.telephone);
await page.locator("#adresse").fill(TERRAIN.adresse);
await page.getByRole("radio", { name: "11 contre 11" }).click();
await page.getByRole("radio", { name: "Synthétique" }).click();
await page.locator("#lien").fill(TERRAIN.lien);
await settle(page, 500);
const form = page.locator("section div.border").filter({ has: page.locator("#nom") }).first();
await region(page, "05-candidature", form, {
  hideHeader: false, margin: 24,
  marks: [
    { loc: page.locator("#nom"), n: 1 },
    { loc: page.locator("#ville"), n: 2 },
    { loc: page.locator("#tel"), union: page.getByText(/Montré, avec ton nom et ton email/), n: 3, badge: "right" },
    { loc: page.locator("#adresse"), n: 4 },
    { loc: page.getByRole("radiogroup", { name: "Format du terrain" }), union: page.getByRole("radiogroup", { name: "Surface du terrain" }), n: 5 },
    { loc: page.locator("#lien"), n: 6 },
    { loc: page.getByRole("button", { name: "Envoyer ma candidature" }), n: 7 },
  ],
});
await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
await settle(page, 2500);
const attente = page.locator("section div.border").filter({ hasText: "En cours d'examen" }).first();
await region(page, "06-en-attente", attente, {
  hideHeader: false, margin: 30,
  marks: [
    { loc: page.getByText("En cours d'examen"), n: 1, pad: 3 },
    { loc: page.getByRole("button", { name: "Modifier ma demande" }), n: 2, badge: "top" },
    { loc: page.getByRole("button", { name: "Retirer ma demande" }), n: 3, badge: "top" },
  ],
});
await ctx.close();
