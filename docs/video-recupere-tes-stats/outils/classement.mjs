// Le classement des joueurs, vu par un visiteur. La page se régénère au plus
// toutes les 60 s (ISR) : on la recharge jusqu'à y voir ce qu'on attend.
import { go, settle } from "./lib.mjs";

export async function classement(page, attendu, { max = 150 } = {}) {
  const fin = Date.now() + max * 1000;
  for (;;) {
    await go(page, "/top-players");
    await settle(page, 1500);
    if (await attendu(page)) return;
    if (Date.now() > fin) throw new Error("le classement n'a pas bougé");
    await page.waitForTimeout(10000);
  }
}

/** La ligne d'un joueur au classement. */
export const ligne = (page, nom) =>
  page.locator("div").filter({ has: page.getByText(nom, { exact: true }) }).filter({ hasText: /G\/A|\d,\d/ }).last();
