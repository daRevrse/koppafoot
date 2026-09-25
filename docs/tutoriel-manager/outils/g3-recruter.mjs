// Chapitre 3 : recruter des joueurs sur le mercato.
import { open, go, shot, region, settle, loadState, loginUI, content, PHONE } from "./lib.mjs";
const { teamUrl } = loadState();
const carte = (page, nom, bouton) =>
  page.locator("div", { has: page.getByText(nom, { exact: true }) }).filter({ has: bouton }).last();

let { ctx, page } = await open("edem");
await go(page, teamUrl);
await settle(page, 1500);
await shot(page, "11-recruter", {
  marks: [{ loc: page.getByRole("button", { name: /Recruter/ }).or(page.getByRole("link", { name: /Recruter/ })).first(), n: 1 }],
});

await go(page, "/mercato?tab=players");
await settle(page, 2000);
const kafui = carte(page, "Kafui Mensah", page.getByRole("link", { name: /Profil/i }));
await shot(page, "12-mercato-joueurs", {
  marks: [
    { loc: page.getByPlaceholder("Rechercher par nom..."), union: page.getByRole("button", { name: /Filtres/ }), n: 1 },
    { loc: kafui.getByRole("link", { name: /Profil/i }), n: 2, badge: "top" },
    { loc: kafui.getByRole("button", { name: "Ajouter à la shortlist" }), n: 3, badge: "top" },
  ],
});

await kafui.getByRole("link", { name: /Profil/i }).click();
await settle(page, 2500);
await shot(page, "13-profil-joueur");
await go(page, "/mercato?tab=players");
await settle(page, 1500);
for (const n of ["Kafui Mensah", "Dodzi Ahadji", "Enyonam Kpodar"]) {
  await carte(page, n, page.getByRole("button", { name: "Ajouter à la shortlist" }))
    .getByRole("button", { name: "Ajouter à la shortlist" }).click();
  await settle(page, 900);
}
await page.getByRole("button", { name: /^Sélection/ }).first().click();
await settle(page, 1500);
const ligne = carte(page, "Kafui Mensah", page.getByRole("button", { name: "Inviter" }));
await shot(page, "14-selection", {
  marks: [
    { loc: page.getByRole("button", { name: /^Sélection/ }).first(), n: 1, badge: "top" },
    { loc: ligne.getByRole("button", { name: "Inviter" }), n: 2 },
  ],
});
await ligne.getByRole("button", { name: "Inviter" }).click();
await settle(page, 1000);
await page.getByPlaceholder("Un petit mot pour le joueur...").fill("Salut Kafui ! On cherche un attaquant pour le dimanche matin à Adakpamé. Viens essayer !");
await shot(page, "15-inviter", {
  marks: [
    { loc: page.locator(".modal-layer select, div.fixed.inset-0 select").last(), n: 1 },
    { loc: page.getByPlaceholder("Un petit mot pour le joueur..."), n: 2 },
    { loc: page.getByRole("button", { name: /Envoyer/ }).last(), n: 3 },
  ],
});
await page.getByRole("button", { name: /Envoyer/ }).last().click();
await settle(page, 2000);
// Les deux autres, sans capture
for (const n of ["Dodzi Ahadji", "Enyonam Kpodar"]) {
  await carte(page, n, page.getByRole("button", { name: "Inviter" })).getByRole("button", { name: "Inviter" }).click();
  await settle(page, 800);
  await page.getByRole("button", { name: /Envoyer/ }).last().click();
  await settle(page, 1500);
}
await page.getByRole("button", { name: /^Invitations/ }).first().click();
await settle(page, 1500);
await shot(page, "16-invitations-envoyees", {
  marks: [{ loc: page.getByText("En attente", { exact: true }).first(), n: 1, badge: "top" }],
});
await ctx.close();

// Côté joueur, sur son téléphone : Kafui accepte.
({ ctx, page } = await open("kafui", PHONE));
await loginUI(page, "kafui.mensah@example.com", "Joueur2026!");
await go(page, "/mercato?tab=invitations");
await settle(page, 2000);
await page.getByRole("button", { name: /^Invitations/ }).first().click().catch(() => {});
await settle(page, 1000);
await shot(page, "17-joueur-invitation", {
  marks: [{ loc: page.getByRole("button", { name: /^Accepter$/i }).first(), n: 1 }],
});
await page.getByRole("button", { name: /^Accepter$/i }).first().click();
await settle(page, 2000);
await ctx.close();
for (const [prof, email] of [["dodzi", "dodzi.ahadji@example.com"], ["enyonam", "enyonam.kpodar@example.com"]]) {
  ({ ctx, page } = await open(prof));
  await loginUI(page, email, "Joueur2026!");
  await go(page, "/mercato?tab=invitations");
  await page.getByRole("button", { name: /^Accepter$/i }).first().click();
  await settle(page, 2000);
  await ctx.close();
}

// Selom, lui, candidate de lui-même.
({ ctx, page } = await open("selom"));
await loginUI(page, "selom.adjo@example.com", "Joueur2026!");
await go(page, "/mercato");
await settle(page, 2000);
// La carte de l'Avenir d'Adakpamé, et pas la première venue : l'Olympique de
// Tokoin recrute aussi, et l'ordre des équipes n'est pas fixe.
await page.getByPlaceholder("Rechercher une équipe...").fill("Adakpamé").catch(() => {});
await settle(page, 1200);
await carte(page, "Avenir d'Adakpamé", page.getByRole("button", { name: /Candidater/i }))
  .getByRole("button", { name: /Candidater/i }).click();
await settle(page, 1000);
await page.getByPlaceholder("Présente-toi...").fill("Bonjour, je suis milieu de terrain et j'habite Adakpamé. Je suis disponible le dimanche.");
await page.getByRole("button", { name: /Envoyer|Candidater/ }).last().click();
await settle(page, 2000);
await ctx.close();

({ ctx, page } = await open("edem"));
await go(page, "/mercato?tab=applications");
await settle(page, 2000);
await shot(page, "18-candidature-recue", {
  marks: [
    { loc: page.getByText(/Bonjour, je suis milieu/).first(), n: 1 },
    { loc: page.getByRole("button", { name: /^Accepter$/i }).first(), n: 2 },
  ],
});
await page.getByRole("button", { name: /^Accepter$/i }).first().click();
await settle(page, 2000);
await ctx.close();
