// Scène 3 : Ekoué rejoint l'Avenir, et Edem lui rend ses stats.
//  - en coulisses : sa photo de profil, puis l'invitation d'Edem au mercato ;
//  - à l'écran, chez Ekoué : la notification, l'invitation, « Accepter » ;
//    sa fiche, encore vide ;
//  - chez Edem : « Fusionner un joueur », le joueur sans compte et le compte ;
//  - chez Ekoué : sa fiche, avec ses buts.
import { open, go, settle, shot, cible, loadState, loginUI, modale, PHONE } from "./lib.mjs";
import { photoDeProfil, db } from "./admin.mjs";
import { EDEM, EKOUE } from "./roster.mjs";
const A = process.env.ASSETS ?? "actifs";
const { teamId, ekoue: uid } = loadState();
const nom = `${EKOUE.prenom} ${EKOUE.nom}`;
const carte = (page, nom, bouton) =>
  page.locator("div", { has: page.getByText(nom, { exact: true }) }).filter({ has: bouton }).last();

/** Choisit, dans un menu, l'option qui porte ce nom (« N°11 · Ekoué Bawa »). */
async function choisir(menu, nom) {
  const options = await menu.locator("option").evaluateAll((os) => os.map((o) => ({ v: o.value, t: o.textContent })));
  const o = options.find((x) => x.v && x.t.includes(nom));
  if (!o) throw new Error(`« ${nom} » absent du menu : ${options.map((x) => x.t).join(" | ")}`);
  await menu.selectOption(o.v);
}

// Une reprise après un échec ne rejoue pas ce qui est fait.
const dejaMembre = ((await db.doc(`teams/${teamId}`).get()).data().member_ids ?? []).includes(uid);
let e, k;
if (!dejaMembre) {
await photoDeProfil(uid, `${A}/portrait-ekoue.png`);

// Edem l'invite, depuis le mercato.
e = await open("edem-tel", PHONE);
await loginUI(e.page, EDEM.email, EDEM.mdp);
await go(e.page, "/mercato?tab=players");
await settle(e.page, 2500);

await carte(e.page, nom, e.page.getByRole("button", { name: "Ajouter à la shortlist" })).getByRole("button", { name: "Ajouter à la shortlist" }).click();
await settle(e.page, 900);
await e.page.getByRole("button", { name: /^Sélection/ }).first().click();
await settle(e.page, 1500);
await carte(e.page, nom, e.page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" }).click();
await settle(e.page, 1000);
await e.page.getByPlaceholder("Un petit mot pour le joueur...").fill("Ekoué ! Ton compte est créé, viens retrouver tes buts chez nous.");
await e.page.getByRole("button", { name: /Envoyer/ }).last().click();
await settle(e.page, 2000);
await e.ctx.close();

// Ekoué : la notification, puis l'invitation.
k = await open("ekoue", PHONE);
await loginUI(k.page, EKOUE.email, EKOUE.mdp);
await go(k.page, `/profile/${uid}`);
await settle(k.page, 2500);
await shot(k.page, "06a-fiche-avant");
await go(k.page, "/notifications");
await settle(k.page, 2500);
const notif = k.page.getByText(/invit/i).first();
await cible(k.page, "04-notifications", notif);
await shot(k.page, "04-notifications");
await go(k.page, "/mercato?tab=invitations");
await settle(k.page, 2000);
await k.page.getByRole("button", { name: /^Invitations/ }).first().click().catch(() => {});
await settle(k.page, 1000);
const accepter = k.page.getByRole("button", { name: /^Accepter$/i }).first();
await cible(k.page, "05-invitation", accepter);
await shot(k.page, "05-invitation");
await accepter.click();
await settle(k.page, 2500);
await shot(k.page, "05b-invitation-acceptee");
await k.ctx.close();
}

// Edem : la fusion.
e = await open("edem-tel", PHONE);
await loginUI(e.page, EDEM.email, EDEM.mdp);
await go(e.page, `/teams/${teamId}`);
await settle(e.page, 3000);
const coin = e.page.getByRole("heading", { name: "Fusionner un joueur" });
await coin.scrollIntoViewIfNeeded();
await choisir(e.page.locator("#fusion-fantome"), nom);
await choisir(e.page.locator("#fusion-compte"), nom);
await settle(e.page, 800);
await coin.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120));
await settle(e.page, 600);
const fusionner = e.page.getByRole("button", { name: /^Fusionner$/ }).first();
await cible(e.page, "07a-fusion", fusionner);
await shot(e.page, "07a-fusion");
await fusionner.click();
await settle(e.page, 1200);
const confirmer = modale(e.page).getByRole("button", { name: /Fusionner/ }).last();
await cible(e.page, "07b-fusion-confirmer", confirmer);
await shot(e.page, "07b-fusion-confirmer");
await confirmer.click();
await settle(e.page, 3000);
await shot(e.page, "07c-fusion-faite");
await e.ctx.close();

// Ekoué : sa fiche, avec ses buts.
k = await open("ekoue", PHONE);
await loginUI(k.page, EKOUE.email, EKOUE.mdp);
await go(k.page, `/profile/${uid}`);
await settle(k.page, 3000);
await shot(k.page, "08-fiche-apres");
await go(k.page, `/teams/${teamId}`);
await settle(k.page, 3000);
await shot(k.page, "08b-equipe");
await k.ctx.close();
console.log("stats rendues");
