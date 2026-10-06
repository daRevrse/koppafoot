// Scène 2 : Edem recrute au mercato ; les joueurs acceptent.
import { open, go, settle, shot, cible, loadState, loginUI, PHONE } from "./lib.mjs";
import { addGhostPlayers } from "./admin.mjs";
import { SANS_COMPTE } from "./roster.mjs";
const { teamId, teamUrl } = loadState();
const RECRUES = ["Kafui Mensah", "Dodzi Ahadji", "Enyonam Kpodar", "Selom Adjo", "Etse Gbeassor"];
const carte = (page, nom, bouton) =>
  page.locator("div", { has: page.getByText(nom, { exact: true }) }).filter({ has: bouton }).last();

let { ctx, page } = await open("edem-tel", PHONE);
await go(page, "/mercato?tab=players");
await settle(page, 2500);
const shortlist = (nom) => carte(page, nom, page.getByRole("button", { name: "Ajouter à la shortlist" }))
  .getByRole("button", { name: "Ajouter à la shortlist" });
// Le toucher se pose sur la première carte visible.
await cible(page, "04-mercato", page.getByRole("button", { name: "Ajouter à la shortlist" }).first());
await shot(page, "04-mercato");
for (const n of RECRUES) {
  await shortlist(n).click();
  await settle(page, 900);
}
await page.getByRole("button", { name: /^Sélection/ }).first().click();
await settle(page, 1500);
const inviter = carte(page, "Kafui Mensah", page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" });
await cible(page, "05-selection", inviter);
await shot(page, "05-selection");
await inviter.click();
await settle(page, 1000);
await page.getByPlaceholder("Un petit mot pour le joueur...").fill("Salut Kafui ! On cherche un attaquant pour le dimanche. Viens essayer !");
await settle(page, 400);
await cible(page, "06-inviter", page.getByRole("button", { name: /Envoyer/ }).last());
await shot(page, "06-inviter");
await page.getByRole("button", { name: /Envoyer/ }).last().click();
await settle(page, 2000);
for (const n of RECRUES.slice(1)) {
  await carte(page, n, page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" }).click();
  await settle(page, 800);
  await page.getByRole("button", { name: /Envoyer/ }).last().click();
  await settle(page, 1500);
}
await ctx.close();

// Chacun accepte, depuis son compte.
const emails = { "Kafui Mensah": "kafui.mensah@example.com", "Dodzi Ahadji": "dodzi.ahadji@example.com",
  "Enyonam Kpodar": "enyonam.kpodar@example.com", "Selom Adjo": "selom.adjo@example.com", "Etse Gbeassor": "etse.gbeassor@example.com" };
for (const [nom, email] of Object.entries(emails)) {
  const j = await open(nom.split(" ")[0].toLowerCase());
  await loginUI(j.page, email, "Joueur2026!");
  await go(j.page, "/mercato?tab=invitations");
  await settle(j.page, 1500);
  await j.page.getByRole("button", { name: /^Invitations/ }).first().click().catch(() => {});
  await settle(j.page, 800);
  await j.page.getByRole("button", { name: /^Accepter$/i }).first().click();
  await settle(j.page, 2000);
  await j.ctx.close();
}
// Le reste de l'effectif : des joueurs sans compte.
await addGhostPlayers(teamId, SANS_COMPTE);

({ ctx, page } = await open("edem-tel", PHONE));
await go(page, "/notifications");
await settle(page, 2500);
await shot(page, "07-notifications");
await go(page, teamUrl);
await settle(page, 3000);
await shot(page, "08-equipe-effectif");
await page.evaluate(() => window.scrollBy(0, 420));
await settle(page, 1200);
await shot(page, "08b-effectif-liste");
await ctx.close();
