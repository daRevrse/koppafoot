// Les gestes joués en coulisses, communs à plusieurs scènes : le défi entre
// les deux clubs, les feuilles de match et la console du direct.
//
// LA CONSOLE A CHANGÉ depuis les vidéos précédentes :
//   - le coup d'envoi se donne en touchant « Donner le ballon à <équipe> » ;
//   - après un but ou la mi-temps, le ballon est mort jusqu'à
//     « Engagement · <équipe> » : plus de verrou minuté à attendre.
import { open, go, settle, loginUI, PHONE, PHONE_LAND } from "./lib.mjs";
import { setClockAmical, db } from "./admin.mjs";
import { EDEM, KOKOU, AUJOURDHUI } from "./roster.mjs";

/** Edem défie l'Olympique de Tokoin pour `match` ; Kokou accepte. Rend l'id du match. */
export async function defi(match) {
  const avant = new Set((await db.collection("matches").get()).docs.map((d) => d.id));
  let { ctx, page } = await open("edem");
  await loginUI(page, EDEM.email, EDEM.mdp);
  await go(page, "/matches");
  await settle(page, 2500);
  await page.getByRole("button", { name: "Défier une équipe" }).first().click();
  await settle(page, 1200);
  const form = page.locator("div.border-2").filter({ hasText: "Défier une équipe" }).first();
  // L'équipe d'Edem : la seule de la liste, après « Sélectionner une équipe ».
  await form.locator("select").first().selectOption({ index: 1 });
  await page.getByPlaceholder("Rechercher une équipe sur KoppaFoot...").fill("Tokoin");
  await settle(page, 2000);
  await page.getByRole("button", { name: /Olympique de Tokoin/ }).first().click();
  await settle(page, 800);
  // Le formulaire refuse une date passée : le défi naît au plus tôt
  // aujourd'hui, puis il est rangé à sa date (en coulisses, plus bas).
  const date = match.date < AUJOURDHUI ? AUJOURDHUI : match.date;
  await form.locator('input[type="date"]').first().fill(date);
  await form.locator('input[type="time"]').first().fill(match.time);
  await page.getByPlaceholder("Nom du terrain").fill(match.lieu);
  await page.getByPlaceholder("Ville").fill(match.ville);
  await form.getByText("11v11", { exact: true }).click();
  await settle(page, 600);
  await form.getByRole("button", { name: /Envoyer le défi/ }).click();
  await settle(page, 2500);
  await ctx.close();

  ({ ctx, page } = await open("kokou"));
  await loginUI(page, KOKOU.email, KOKOU.mdp);
  await go(page, "/matches");
  await page.getByRole("button", { name: /À traiter/ }).click();
  await settle(page, 1500);
  const recu = page.locator("div").filter({ has: page.getByRole("button", { name: "Accepter" }) }).filter({ hasText: /Défi reçu/i }).last();
  await recu.getByRole("button", { name: "Accepter" }).click();
  await settle(page, 2500);
  await ctx.close();

  const nouveau = (await db.collection("matches").get()).docs.find((d) => !avant.has(d.id));
  if (!nouveau) throw new Error("défi introuvable");
  if (nouveau.data().date !== match.date) await nouveau.ref.update({ date: match.date });
  // L'écusson de l'adversaire voyage avec le match ; la recherche ne l'a pas
  // rendu sur les émulateurs : on le recopie depuis la fiche de l'équipe.
  const n = nouveau.data();
  for (const cote of ["home", "away"]) {
    if (n[`${cote}_team_logo`] || !n[`${cote}_team_id`]) continue;
    const logo = (await db.doc(`teams/${n[`${cote}_team_id`]}`).get()).data()?.logo_url ?? null;
    if (logo) await nouveau.ref.update({ [`${cote}_team_logo`]: logo });
  }
  console.log("défi", nouveau.id, nouveau.data().status, match.date);
  return nouveau.id;
}

/** La feuille de match d'un manager : tout le monde remplaçant, puis les titulaires. */
export async function feuille(mid, profil, compte, titulaires) {
  const { ctx, page } = await open(profil);
  await loginUI(page, compte.email, compte.mdp);
  await go(page, `/matches/${mid}`);
  await settle(page, 2500);
  await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click();
  await settle(page, 1000);
  await page.getByRole("button", { name: /Remplir la feuille de match/i }).first().click().catch(() => {});
  await settle(page, 1200);
  const roles = page.locator('select[aria-label^="Rôle de "]');
  const noms = await roles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace("Rôle de ", "")));
  for (const n of noms) await page.getByLabel(`Rôle de ${n}`).selectOption("substitute");
  for (const n of titulaires) await page.getByLabel(`Rôle de ${n}`).selectOption("starter");
  await page.getByRole("button", { name: "4-4-2", exact: true }).click().catch(() => {});
  await settle(page, 800);
  await page.getByRole("button", { name: /Envoyer à l'arbitre|Valider la feuille/i }).first().click();
  await settle(page, 2500);
  await ctx.close();
}

/**
 * La console d'Edem, à l'horizontale, coup d'envoi donné. Rend de quoi jouer
 * le match : `but`, `carton`, `miTemps`, `fin`, et `fermer`.
 */
export async function console_(mid, { capture } = {}) {
  const CONSOLE = `/matches/${mid}/manage`;
  let c = await open("edem-console", PHONE);
  await loginUI(c.page, EDEM.email, EDEM.mdp);
  await go(c.page, CONSOLE);
  await settle(c.page, 3000);
  await c.page.getByRole("button", { name: /Coup d'envoi/i }).first().click();
  await settle(c.page, 2500);
  await c.ctx.close();
  c = await open("edem-console", PHONE_LAND);
  const page = c.page;
  await go(page, CONSOLE);
  await settle(page, 3000);
  const consigne = page.getByText("Touche pour continuer");
  if (await consigne.count()) { await consigne.click(); await settle(page, 800); }
  if (capture) await page.screenshot({ path: `logs/${capture}-console.png` });
  await page.getByRole("button", { name: /Donner le ballon à/i }).first().click();
  await settle(page, 1500);
  await setClockAmical(mid, 1);

  const joueur = (nom) => page.getByRole("button", { name: `${nom}, actions` }).first();
  const modal = () => page.locator(".modal-layer").last();
  /** Le ballon est mort après un but ou la mi-temps : l'engagement le remet en jeu. */
  const engager = async () => {
    const b = page.getByRole("button", { name: /Engagement ·/ }).first();
    if (await b.count()) { await b.click(); await settle(page, 1200); }
  };
  return {
    page,
    async but(buteur, passeur, minute) {
      await setClockAmical(mid, minute);
      await settle(page, 1200);
      await joueur(buteur).click();
      await settle(page, 700);
      await modal().getByRole("button", { name: /But$/ }).first().click();
      await settle(page, 900);
      await modal().getByRole("button", { name: passeur ? new RegExp(passeur) : /Aucune passe/ }).first().click();
      await settle(page, 1500);
      await engager();
    },
    async miTemps() {
      await setClockAmical(mid, 45);
      await settle(page, 2000);
      await page.getByRole("button", { name: /^Mi-temps$/i }).first().click();
      await settle(page, 1500);
      await engager();
    },
    async fin(homme) {
      await setClockAmical(mid, 90);
      await settle(page, 2000);
      await page.getByRole("button", { name: /Fin du match/i }).first().click();
      await settle(page, 1000);
      await page.getByRole("button", { name: /Coup de sifflet final/i }).first().click();
      await settle(page, 2500);
      if (homme) await modal().locator("button", { hasText: homme }).first().click();
      else await page.getByRole("button", { name: /Terminer sans désigner/ }).first().click();
      await settle(page, 4000);
    },
    fermer: () => c.ctx.close(),
  };
}
