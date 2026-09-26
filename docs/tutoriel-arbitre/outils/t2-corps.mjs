// Chapitre 2 : former son corps arbitral. Komi le crée et invite Yao
// (assistant) et Afi (scoreuse) ; Yao accepte à l'écran, Afi en coulisses.
import { open, go, settle, region, loginUI, loadState, BUREAU } from "./lib.mjs";
import { api } from "./admin.mjs";
import { ARBITRE, CORPS, ASSISTANT, SCOREUSE } from "./roster.mjs";

const { ctx, page } = await open("komi", BUREAU);
await go(page, "/corps-arbitral");
await settle(page, 2000);

// Créer : un nom, et c'est tout.
const creation = page.locator("section").filter({ hasText: "Crée ton corps arbitral" }).first();
await creation.getByPlaceholder(/Sifflets/).fill(CORPS);
await region(page, "08-creer-corps", creation, {
  margin: 24,
  marks: [
    { loc: creation.getByPlaceholder(/Sifflets/), n: 1 },
    { loc: creation.getByRole("button", { name: "Créer mon corps arbitral" }), n: 2, badge: "top" },
  ],
});
await creation.getByRole("button", { name: "Créer mon corps arbitral" }).click();
await settle(page, 2500);

const monCorps = () => page.locator("section").filter({ hasText: "Mon corps arbitral" }).first();
await region(page, "09-corps-cree", monCorps(), {
  margin: 12,
  marks: [
    { loc: monCorps().getByRole("button", { name: "Inviter un arbitre" }), n: 1, badge: "top" },
    { loc: monCorps().getByRole("button", { name: "Inviter un scoreur" }), n: 2, badge: "top" },
  ],
});

// Inviter un arbitre : Yao.
const fenetre = page.locator('[role="dialog"]');
await monCorps().getByRole("button", { name: "Inviter un arbitre" }).click();
await settle(page, 2000);
await fenetre.getByPlaceholder("Chercher par nom").fill(ASSISTANT.prenom);
await settle(page, 600);
const ligneYao = fenetre.locator("li").filter({ hasText: `${ASSISTANT.prenom} ${ASSISTANT.nom}` }).first();
await region(page, "10-inviter-arbitre", fenetre, {
  margin: 20, hideHeader: false,
  marks: [
    { loc: fenetre.getByPlaceholder("Chercher par nom"), n: 1 },
    { loc: ligneYao.getByRole("button", { name: "Inviter" }), n: 2, badge: "top" },
  ],
});
await ligneYao.getByRole("button", { name: "Inviter" }).click();
await settle(page, 2000);

// Inviter une scoreuse : Afi.
await monCorps().getByRole("button", { name: "Inviter un scoreur" }).click();
await settle(page, 2000);
const ligneAfi = fenetre.locator("li").filter({ hasText: `${SCOREUSE.prenom} ${SCOREUSE.nom}` }).first();
await region(page, "11-inviter-scoreur", fenetre, {
  margin: 20, hideHeader: false,
  marks: [{ loc: ligneAfi.getByRole("button", { name: "Inviter" }), n: 1, badge: "top" }],
});
await ligneAfi.getByRole("button", { name: "Inviter" }).click();
await settle(page, 2000);
await region(page, "12-invitations-envoyees", monCorps(), {
  margin: 12,
  marks: [{ loc: monCorps().getByText("Invitations envoyées").locator("xpath=.."), n: 1 }],
});
await ctx.close();

// Côté Yao : l'invitation l'attend sur la même page.
const y = await open("yao", BUREAU);
await loginUI(y.page, ASSISTANT.email, ASSISTANT.mdp);
await go(y.page, "/corps-arbitral");
await settle(y.page, 2000);
const invitation = y.page.locator("div").filter({ hasText: `« ${CORPS} »` }).filter({ has: y.page.getByRole("button", { name: "Rejoindre" }) }).last();
await region(y.page, "13-invitation-recue", invitation, {
  margin: 24,
  marks: [
    { loc: invitation.getByRole("button", { name: "Rejoindre" }), n: 1, badge: "top" },
    { loc: invitation.getByRole("button", { name: "Décliner" }), n: 2, badge: "top" },
  ],
});
await invitation.getByRole("button", { name: "Rejoindre" }).click();
await settle(y.page, 2000);
await y.ctx.close();

// Afi accepte de son côté (en coulisses).
const corps = (await import("./admin.mjs")).db;
const c = (await corps.collection("corps_arbitraux").where("nom", "==", CORPS).get()).docs[0];
await api(SCOREUSE.email, SCOREUSE.mdp, "POST", "/api/corps-arbitral", { action: "repondre", corpsId: c.id, accepte: true });

// Le corps au complet.
const k = await open("komi", BUREAU);
await go(k.page, "/corps-arbitral");
await settle(k.page, 2500);
const complet = k.page.locator("section").filter({ hasText: "Mon corps arbitral" }).first();
await region(k.page, "14-corps-complet", complet, { margin: 12 });
await k.ctx.close();
void loadState;
void ARBITRE;
