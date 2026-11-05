// Scène 4 : la vie de son équipe, sur le téléphone d'Ekoué.
//  - en coulisses, chez Edem, par l'interface : un amical pour dimanche qui
//    vient, sans auto-acceptation (chaque joueur doit confirmer), puis une
//    séance d'entraînement la veille. Les notifications partent comme
//    d'habitude ;
//  - chez Ekoué : ses notifications, sa convocation (« Accepter »), puis la
//    séance (« Présent »).
import { open, go, settle, shot, cible, loadState, loginUI, modale, PHONE } from "./lib.mjs";
import { EDEM, EKOUE, AMICAL, ENTRAINEMENT } from "./roster.mjs";
const { teamId } = loadState();

// Edem programme l'amical, sans auto-acceptation.
const e = await open("edem");
await loginUI(e.page, EDEM.email, EDEM.mdp);
await go(e.page, "/matches");
await settle(e.page, 2000);
await e.page.getByRole("button", { name: /Programmer un amical/ }).first().click();
await settle(e.page, 800);
const f = e.page.locator("div.border-2").filter({ hasText: "Programmer un amical" }).first();
await f.locator("select").first().selectOption({ index: 1 });
await e.page.getByPlaceholder("Nom de l'équipe adverse...").fill(AMICAL.adversaire);
await f.locator('input[type="date"]').first().fill(AMICAL.date);
await f.locator('input[type="time"]').first().fill(AMICAL.time);
await e.page.getByPlaceholder("Nom du terrain").fill(AMICAL.lieu);
await e.page.getByPlaceholder("Ville").fill(AMICAL.ville);
await f.getByText("11v11", { exact: true }).click();
await f.getByText("Auto-acceptation des joueurs").locator("xpath=../..").locator("button").click();
await settle(e.page, 400);
await f.getByRole("button", { name: /Programmer le match/ }).click();
await settle(e.page, 3000);

// Puis la séance, depuis la page de l'équipe.
await go(e.page, `/teams/${teamId}`);
await settle(e.page, 2500);
await e.page.getByRole("tab", { name: /^Entraînements/ }).first().click();
await settle(e.page, 1200);
await e.page.getByRole("button", { name: /Créer un entraînement/ }).first().click();
await settle(e.page, 800);
const m = modale(e.page);
await m.getByPlaceholder("Ex: Entraînement tactique").fill(ENTRAINEMENT.titre);
await m.locator('input[type="date"]').fill(ENTRAINEMENT.date);
await m.locator('input[type="time"]').fill(ENTRAINEMENT.heure);
await m.getByPlaceholder("Ex: Stade municipal").fill(ENTRAINEMENT.lieu);
await m.getByRole("button", { name: /^Créer$/ }).click();
await settle(e.page, 3000);
await e.ctx.close();

// Ekoué : ses notifications, puis sa convocation.
const k = await open("ekoue", PHONE);
await loginUI(k.page, EKOUE.email, EKOUE.mdp);
await go(k.page, "/notifications");
await settle(k.page, 2500);
await cible(k.page, "15-notifications", k.page.getByText("Convocation à un match", { exact: true }).first());
await shot(k.page, "15-notifications");
await go(k.page, "/participations");
await settle(k.page, 2500);
const accepter = k.page.getByRole("button", { name: /^Accepter$/ }).first();
await cible(k.page, "16-convocations", accepter);
await shot(k.page, "16-convocations");
await accepter.click();
await settle(k.page, 1200);
await shot(k.page, "16b-convocation-acceptee");

// La séance : « Présent ».
await go(k.page, `/teams/${teamId}`);
await settle(k.page, 2500);
await k.page.getByRole("tab", { name: /^Entraînements/ }).first().click();
await settle(k.page, 1500);
const present = k.page.getByRole("button", { name: /Présent/ }).first();
await present.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 420));
await settle(k.page, 800);
await cible(k.page, "17-entrainement", present);
await cible(k.page, "17-seance", k.page.getByText(ENTRAINEMENT.titre).first());
await shot(k.page, "17-entrainement");
await present.click();
await settle(k.page, 1200);
await shot(k.page, "17b-entrainement-present");
await k.ctx.close();
console.log("équipe vécue");
