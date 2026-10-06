// Scène 1 : Edem crée son équipe, depuis son téléphone.
import { open, go, settle, shot, cible, saveState, modale, PHONE } from "./lib.mjs";
import { EDEM } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";

const { ctx, page } = await open("edem-tel", PHONE);
await go(page, "/signup?role=manager");
await page.fill("#firstName", EDEM.prenom);
await page.fill("#lastName", EDEM.nom);
await page.fill("#signupEmail", EDEM.email);
await page.fill("#signupPassword", EDEM.mdp);
await page.getByRole("radio", { name: "Homme" }).click();
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await settle(page, 2000);

// Mes équipes : rien encore.
await go(page, "/teams");
await settle(page, 2000);
const creer = page.getByRole("button", { name: "Créer une équipe" }).first();
await cible(page, "01-equipes-vide", creer);
await shot(page, "01-equipes-vide");

// Le formulaire, rempli.
await creer.click();
await settle(page, 1000);
const m = modale(page);
// Le formulaire vide : la vidéo y tape le nom, lettre par lettre. On attend
// la fin de l'animation d'ouverture de la fenêtre, sinon elle est encore
// réduite sur la capture.
await page.waitForTimeout(1500);
await cible(page, "02a-creer-equipe-vide", page.getByPlaceholder("FC Koppa"));
await shot(page, "02a-creer-equipe-vide");
await page.getByPlaceholder("FC Koppa").fill(EDEM.equipe);
await page.getByPlaceholder("Paris").fill("Lomé");
await m.locator("select").last().selectOption({ label: "Amateur" }).catch(() => {});
await m.locator('input[type="number"]').fill("20");
await page.getByPlaceholder("FC Koppa").scrollIntoViewIfNeeded();
await settle(page, 600);
await cible(page, "02-creer-equipe-nom", page.getByPlaceholder("FC Koppa"));
await shot(page, "02-creer-equipe");
const valider = m.getByRole("button", { name: "Créer l'équipe" });
await valider.scrollIntoViewIfNeeded();
await settle(page, 400);
await cible(page, "02b-creer-equipe-bouton", valider);
await shot(page, "02b-creer-equipe-bas");
await valider.click();
await settle(page, 2500);
const teamId = (await page.getByRole("link", { name: /Adakpamé/ }).first().getAttribute("href")).split("/").pop();
saveState({ teamId, teamUrl: `/teams/${teamId}` });

// Ses couleurs : écusson et bannière.
await go(page, `/teams/${teamId}`);
await settle(page, 1500);
await page.getByRole("button", { name: "Modifier l'équipe" }).click();
await settle(page, 800);
await page.locator("#banner-input").setInputFiles(`${A}/banniere-avenir.png`);
await page.locator("#logo-input").setInputFiles(`${A}/ecusson-avenir.png`);
await page.getByPlaceholder("Ex: Toujours debout !").fill("L'avenir se joue le dimanche").catch(() => {});
await settle(page, 800);
await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(4000);
await go(page, `/teams/${teamId}`);
await settle(page, 3000);
await shot(page, "03-equipe");
await ctx.close();
