import { cache } from "react";
import { cookies, headers } from "next/headers";
import { CLE_LANGUE, langueDeLaRequete, type Langue } from "./config";
import type { Phrases, Textes, Traduction } from "./textes";

// ============================================
// La langue, lue par un composant serveur.
//
// La MÊME décision que le layout racine, qui la transmet aux composants
// clients : un titre rendu par le serveur et le reste de la page rendu par le
// navigateur ne peuvent pas choisir chacun de leur côté.
//
// `cache` : le layout, la page et `generateMetadata` la demandent tous, pour
// une seule requête. On ne la calcule qu'une fois.
// ============================================

export const langueServeur = cache(async (): Promise<Langue> => {
  const [lesCookies, lesEnTetes] = await Promise.all([cookies(), headers()]);
  return langueDeLaRequete(lesCookies.get(CLE_LANGUE)?.value, lesEnTetes.get("accept-language"));
});

/** Les phrases d'un écran, dans la langue de la requête. */
export async function textesServeur<F extends Phrases>(t: Textes<F>): Promise<Traduction<F>> {
  return t[await langueServeur()];
}
