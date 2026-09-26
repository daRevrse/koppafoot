// Chapitre 3 : rejoindre une équipe — candidater, répondre à une invitation.
import { open, go, shot, region, settle, loginUI, corps } from "./lib.mjs";
import { loadState } from "./lib.mjs";
const { teamId } = loadState();
const carte = (page, nom, bouton) =>
  page.locator("div", { has: page.getByText(nom, { exact: true }) }).filter({ has: bouton }).last();

let { ctx, page } = await open("kafui");
await go(page, "/mercato");
await settle(page, 2500);
const avenir = carte(page, "Avenir d'Adakpamé", page.getByRole("button", { name: /Candidater/i }));
await shot(page, "11-mercato-equipes", {
  marks: [
    { loc: page.getByPlaceholder("Rechercher une équipe..."), union: page.getByRole("button", { name: /Filtres/ }), n: 1 },
    { loc: avenir.getByRole("link", { name: /Détails/i }), n: 2, badge: "top" },
    { loc: avenir.getByRole("button", { name: /Candidater/i }), n: 3, badge: "top" },
  ],
});

await avenir.getByRole("link", { name: /Détails/i }).click();
await page.waitForURL(/\/teams\//);
await settle(page, 2500);
await shot(page, "12-details-equipe");

await go(page, "/mercato");
await settle(page, 2000);
await carte(page, "Avenir d'Adakpamé", page.getByRole("button", { name: /Candidater/i }))
  .getByRole("button", { name: /Candidater/i }).click();
await settle(page, 1000);
await page.getByPlaceholder("Présente-toi...").fill("Bonjour ! Attaquant, 24 ans, j'habite Adakpamé et je suis libre le dimanche matin. Je peux passer à l'entraînement mercredi.");
await shot(page, "13-candidater", {
  marks: [
    { loc: page.getByPlaceholder("Présente-toi..."), n: 1 },
    { loc: page.getByRole("button", { name: /Envoyer/ }).last(), n: 2 },
  ],
});
await page.getByRole("button", { name: /Envoyer/ }).last().click();
await settle(page, 2000);
await page.getByRole("button", { name: /^Candidatures/ }).first().click();
await settle(page, 1500);
await region(page, "14-candidature-envoyee", corps(page), {
  maxHeight: 1200,
  marks: [
    { loc: page.getByRole("button", { name: /^Candidatures/ }).first(), n: 1, badge: "top" },
    { loc: page.getByText("En attente", { exact: true }).last(), n: 2, badge: "top", pad: 4 },
  ],
});
await ctx.close();

// Pendant ce temps, Kokou Tepe invite Kafui à l'Olympique de Tokoin.
({ ctx, page } = await open("kokou"));
await go(page, "/mercato?tab=players");
await settle(page, 2000);
await carte(page, "Kafui Mensah", page.getByRole("button", { name: "Ajouter à la shortlist" }))
  .getByRole("button", { name: "Ajouter à la shortlist" }).click();
await settle(page, 800);
await page.getByRole("button", { name: /^Sélection/ }).first().click();
await settle(page, 1200);
await carte(page, "Kafui Mensah", page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" }).click();
await settle(page, 800);
await page.getByPlaceholder("Un petit mot pour le joueur...").fill("Kafui, l'Olympique de Tokoin cherche un attaquant. Viens nous voir jouer !");
await page.getByRole("button", { name: /Envoyer/ }).last().click();
await settle(page, 1500);
await ctx.close();

// Kafui est prévenu
({ ctx, page } = await open("kafui"));
await go(page, "/teams");
await settle(page, 2000);
await go(page, "/notifications");
await settle(page, 2000);
await region(page, "15-notification-invitation", corps(page), {
  maxHeight: 1000,
  marks: [{ loc: page.getByText("Nouvelle invitation", { exact: true }).first(), union: page.getByText(/vous invite à rejoindre/).first(), n: 1 }],
});

await go(page, "/mercato?tab=invitations");
await settle(page, 2000);
await page.getByRole("button", { name: /^Invitations/ }).first().click().catch(() => {});
await settle(page, 1200);
await region(page, "16-invitation-recue", corps(page), {
  maxHeight: 1200,
  marks: [
    { loc: page.getByRole("button", { name: /^Accepter$/i }).first(), n: 1, badge: "top" },
    { loc: page.getByRole("button", { name: /^Décliner$/i }).first(), n: 2, badge: "top" },
  ],
});
// Kafui a déjà candidaté ailleurs : il décline.
await page.getByRole("button", { name: /^Décliner$/i }).first().click();
await settle(page, 2000);
await ctx.close();

// Edem accepte la candidature.
({ ctx, page } = await open("edem"));
await go(page, "/mercato?tab=applications");
await settle(page, 2000);
await page.getByRole("button", { name: /^Accepter$/i }).first().click();
await settle(page, 2500);
await ctx.close();

// L'acceptation arrive sous la forme d'une invitation de l'équipe.
({ ctx, page } = await open("kafui"));
await go(page, "/mercato?tab=invitations");
await settle(page, 2000);
await page.getByRole("button", { name: /^Invitations/ }).first().click().catch(() => {});
await settle(page, 1200);
const bienvenue = page.locator("div", { has: page.getByText(/Suite à votre candidature/) }).filter({ has: page.getByRole("button", { name: /^Accepter$/i }) }).last();
await region(page, "17-candidature-acceptee", corps(page), {
  maxHeight: 1200,
  marks: [
    { loc: page.getByText(/Suite à votre candidature/).first(), n: 1 },
    { loc: bienvenue.getByRole("button", { name: /^Accepter$/i }), n: 2, badge: "top" },
  ],
});
await bienvenue.getByRole("button", { name: /^Accepter$/i }).click();
await settle(page, 2000);
await go(page, "/teams");
await settle(page, 2000);
await shot(page, "18-mes-equipes", {
  marks: [{ loc: page.getByRole("link", { name: /Adakpamé/ }).first(), n: 1 }],
});
await ctx.close();
