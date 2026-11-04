// Scène 2 : Ekoué crée son compte, depuis son téléphone. Le formulaire vide
// d'abord (l'animation y tape son prénom et son nom), puis rempli, puis la
// seconde étape, puis l'écran où l'inscription le dépose.
import { open, go, settle, shot, cible, saveState, PHONE } from "./lib.mjs";
import { verifyEmail, uidOf, db } from "./admin.mjs";
import { EKOUE } from "./roster.mjs";

const { ctx, page } = await open("ekoue", PHONE);
await go(page, "/signup?role=player");
await settle(page, 1500);
await cible(page, "03a-prenom", page.locator("#firstName"));
await cible(page, "03a-nom", page.locator("#lastName"));
await shot(page, "03a-signup-vide");

await page.fill("#firstName", EKOUE.prenom);
await page.fill("#lastName", EKOUE.nom);
await page.fill("#signupEmail", EKOUE.email);
await page.fill("#signupPassword", EKOUE.mdp);
await page.getByRole("radio", { name: "Homme" }).click();
await page.locator("#firstName").blur();
await settle(page, 600);
const continuer = page.getByRole("button", { name: /^Continuer$/ });
await continuer.scrollIntoViewIfNeeded();
await settle(page, 300);
await cible(page, "03b-signup-rempli", continuer);
await shot(page, "03b-signup-rempli");
await continuer.click();
await settle(page, 1000);

await page.fill("#locationCity", "Lomé");
const creer = page.getByRole("button", { name: /Créer mon compte/i });
await creer.scrollIntoViewIfNeeded();
await settle(page, 300);
await cible(page, "03c-signup-ville", creer);
await shot(page, "03c-signup-ville");
await creer.click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await settle(page, 3000);
console.log("après l'inscription :", page.url());
await shot(page, "03d-bienvenue");
await ctx.close();

// L'adresse est vérifiée en coulisses (le lien du courriel, sur les émulateurs).
await verifyEmail(EKOUE.email);
const uid = await uidOf(EKOUE.email);
const u = (await db.doc(`users/${uid}`).get()).data();
console.log("compte", uid, u.evolution_role, u.gender, u.position ?? "(pas de poste)");
saveState({ ekoue: uid });
