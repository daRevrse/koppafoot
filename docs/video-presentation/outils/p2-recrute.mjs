// Scène 03, suite : Edem annonce dans la Tribune qu'il cherche un gardien,
// invite des joueurs au mercato ; Dodzi, gardien, demande à rejoindre
// l'équipe depuis l'annonce.
import { open, go, settle, ecran, cible, loadState, saveState, loginUI, PHONE } from "./lib.mjs";
import { addGhostPlayers, db } from "./admin.mjs";
import { EDEM, RECRUES, JOUEURS, GARDIEN, SANS_COMPTE } from "./roster.mjs";
const { teamId, teamUrl } = loadState();
const carte = (page, nom, bouton) =>
  page.locator("div", { has: page.getByText(nom, { exact: true }) }).filter({ has: bouton }).last();

// 1. L'annonce, depuis les paramètres de l'équipe.
let { ctx, page } = await open("edem-tel", PHONE);
await loginUI(page, EDEM.email, EDEM.mdp);
await go(page, teamUrl);
await settle(page, 2500);
await page.getByRole("tab", { name: /Paramètres/ }).click();
await settle(page, 1500);
const annoncer = page.getByRole("button", { name: "Annoncer dans la Tribune" });
await annoncer.evaluate((el) => el.scrollIntoView({ block: "center" }));
await settle(page, 800);
await cible(page, "03d-parametres", annoncer);
await ecran(page, "03d-parametres");
await annoncer.click();
await page.getByRole("dialog").waitFor();
await settle(page, 900);
const gardien = page.getByRole("dialog").getByRole("button", { name: "Gardien", exact: true });
await cible(page, "03e-fenetre-vide", gardien);
await ecran(page, "03e-fenetre-vide");
await gardien.click();
await settle(page, 700);
const publier = page.getByRole("dialog").getByRole("button", { name: "Publier" });
await cible(page, "03f-fenetre-gardien", publier);
await ecran(page, "03f-fenetre-gardien");
await publier.click();
await page.getByRole("link", { name: "Voir l'annonce" }).waitFor({ timeout: 30000 });
await settle(page, 1500);
const annonce = (await db.collection("posts").where("type", "==", "team_announcement").get()).docs[0].id;
saveState({ annonce });

// 2. Le mercato : la sélection, puis les invitations.
await go(page, "/mercato?tab=players");
await settle(page, 2500);
const shortlist = (nom) => carte(page, nom, page.getByRole("button", { name: "Ajouter à la shortlist" }))
  .getByRole("button", { name: "Ajouter à la shortlist" });
await cible(page, "03g-mercato", page.getByRole("button", { name: "Ajouter à la shortlist" }).first());
await ecran(page, "03g-mercato");
for (const n of RECRUES) {
  await shortlist(n).click();
  await settle(page, 900);
}
await page.getByRole("button", { name: /^Sélection/ }).first().click();
await settle(page, 1500);
const inviter = carte(page, "Kafui Mensah", page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" });
await cible(page, "03h-selection", inviter);
await ecran(page, "03h-selection");
for (const n of RECRUES) {
  await carte(page, n, page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" }).click();
  await settle(page, 800);
  if (n === "Kafui Mensah") await page.getByPlaceholder("Un petit mot pour le joueur...").fill("Salut Kafui ! On cherche un attaquant pour samedi. Viens essayer !");
  await page.getByRole("button", { name: /Envoyer/ }).last().click();
  await settle(page, 1500);
}
await ctx.close();

// Chacun accepte, depuis son compte.
const email = (nom) => JOUEURS.find((j) => `${j.first} ${j.last}` === nom).email;
async function accepterInvitation(profil, adresse) {
  const j = await open(profil);
  await loginUI(j.page, adresse, "Joueur2026!");
  await go(j.page, "/mercato?tab=invitations");
  await settle(j.page, 1500);
  await j.page.getByRole("button", { name: /^Invitations/ }).first().click().catch(() => {});
  await settle(j.page, 800);
  await j.page.getByRole("button", { name: /^Accepter$/i }).first().click();
  await settle(j.page, 2000);
  await j.ctx.close();
}
for (const n of RECRUES) await accepterInvitation(n.split(" ")[0].toLowerCase(), email(n));

// 3. Dodzi voit l'annonce dans la Tribune et demande à rejoindre l'équipe.
const d = await open("dodzi-tel", PHONE);
await loginUI(d.page, GARDIEN.email, "Joueur2026!");
await go(d.page, `/feed?post=${annonce}`);
await settle(d.page, 3500);
const carteAnnonce = d.page.locator(`#post-${annonce}`);
await carteAnnonce.evaluate((el) => el.scrollIntoView({ block: "center" }));
await settle(d.page, 2500);
const demander = carteAnnonce.getByRole("button", { name: "Demander à rejoindre" });
await cible(d.page, "03i-annonce", demander);
await ecran(d.page, "03i-annonce");
await demander.click();
await settle(d.page, 600);
await carteAnnonce.locator("textarea").fill("Gardien dispo pour samedi !");
await carteAnnonce.getByRole("button", { name: "Envoyer la demande" }).click();
await carteAnnonce.getByText("Demande envoyée").waitFor({ timeout: 30000 });
await settle(d.page, 1200);
await ecran(d.page, "03j-demande-envoyee");
await d.ctx.close();

// 4. Edem accepte la candidature ; Dodzi accepte l'invitation qui suit.
({ ctx, page } = await open("edem-tel", PHONE));
await go(page, teamUrl);
await settle(page, 2500);
await page.getByRole("tab", { name: /Candidatures/ }).click();
await settle(page, 2000);
const accepter = page.getByRole("button", { name: /^Accepter/ }).first();
await accepter.evaluate((el) => el.scrollIntoView({ block: "center" }));
await settle(page, 800);
await cible(page, "03k-candidature", accepter);
await ecran(page, "03k-candidature");
await accepter.click();
await settle(page, 2500);
await ctx.close();
await accepterInvitation("dodzi", GARDIEN.email);

// Le reste de l'effectif : des joueurs sans compte.
await addGhostPlayers(teamId, SANS_COMPTE);
({ ctx, page } = await open("edem-tel", PHONE));
await go(page, teamUrl);
await settle(page, 3000);
await ecran(page, "03l-effectif");
await ctx.close();
console.log("recrutement fait, annonce", annonce);
