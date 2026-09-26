import { NextResponse } from "next/server";
import { lireFormes, publierFormes } from "@/lib/formes-admin";

/**
 * GET /api/public/formes?cles=uid:<compte>,ligne:<équipe>:<ligne>
 *
 * L'état de forme calculé de plusieurs joueurs d'un coup — un effectif entier,
 * une feuille de match — en une seule lecture (voir lib/formes-admin). Les
 * clés sont celles de lib/etat-de-forme : `uid:` pour un compte, `ligne:` pour
 * un joueur sans compte.
 *
 * PUBLIQUE, comme le sont les matchs dont elle est tirée : les feuilles et
 * les faits d'un match se lisent déjà sans compte, sur sa fiche. La forme n'y
 * ajoute qu'une moyenne. La CONDITION déclarée (blessé, suspendu…), elle, ne
 * passe jamais par ici : elle vit sur `users`, fermé aux visiteurs.
 *
 * LE PREMIER APPEL APRÈS LA MISE EN SERVICE calcule les formes, une fois : le
 * document n'existe qu'à partir de la première fin de match, et sans ça
 * toutes les pastilles resteraient vides jusque-là. Une seule tentative par
 * instance et par quart d'heure, pour qu'un échec ne se paie pas à chaque
 * visite.
 */

export const dynamic = "force-dynamic";

/** Un effectif et son banc, largement. Au-delà, c'est un balayage. */
const MAX_CLES = 60;
const CLE = /^(uid:[A-Za-z0-9_-]{1,128}|ligne:[A-Za-z0-9_-]{1,128}:[A-Za-z0-9_-]{1,128})$/;

let derniereTentative = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cles = [...new Set(
    (url.searchParams.get("cles") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => CLE.test(c)),
  )].slice(0, MAX_CLES);

  if (cles.length === 0) return NextResponse.json({ formes: {}, calculeLe: null });

  let publiees = await lireFormes(cles);

  if (publiees.calculeLe === null && Date.now() - derniereTentative > 15 * 60_000) {
    derniereTentative = Date.now();
    try {
      await publierFormes();
      publiees = await lireFormes(cles);
    } catch (err) {
      console.error("GET /api/public/formes: premier calcul impossible", err);
    }
  }

  return NextResponse.json(publiees);
}
