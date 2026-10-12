import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  LIMITES_GRATUIT, droitActif, estPro, estSansPub, jourDeLome, limitesEnVigueur, type DroitAccorde,
} from "@/lib/offre";
import { compterUsage, lireDroits, lireLimitesDepuis, uidAppelant } from "@/lib/offre-server";
import { formulesPour } from "@/lib/paiement-serveur";

/**
 * GET /api/offre, ce que la page « Mon offre » affiche : le Pro et l'option
 * sans pub (actifs ou non, jusqu'à quand), les limites de l'offre gratuite,
 * leur date d'entrée en vigueur, et ce que le compte utilise déjà.
 *
 * Les casquettes disent quelles lignes concernent la personne : un joueur qui
 * ne gère rien n'a pas à lire un compteur de terrains.
 *
 * `formules` : ce que CE compte peut acheter, avec le prix. Vide tant que rien
 * n'est en vente — et, en bac à sable, pour tout autre qu'un superadmin.
 */

export const dynamic = "force-dynamic";

const vue = (d: DroitAccorde | null | undefined, jour: string) =>
  d ? { actif: droitActif(d, jour), depuis: d.depuis, jusquAu: d.jusqu_au, source: d.source } : null;

export async function GET(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const jour = jourDeLome();
    const [droits, limitesDepuis, usage, profil] = await Promise.all([
      lireDroits(uid),
      lireLimitesDepuis(),
      compterUsage(uid),
      adminDb.collection("users").doc(uid).get().then((s) => s.data() ?? {}),
    ]);
    const pro = estPro(droits, jour);
    return NextResponse.json({
      jour,
      estPro: pro,
      estSansPub: estSansPub(droits, jour),
      pro: vue(droits?.pro, jour),
      sansPub: vue(droits?.sans_pub, jour),
      limitesDepuis,
      limitesActives: limitesEnVigueur(limitesDepuis, jour),
      limites: LIMITES_GRATUIT,
      usage,
      casquettes: {
        manager: profil.user_type === "manager" || usage.equipes > 0,
        organisateur: profil.is_organizer === true,
        gerant: profil.is_venue_owner === true,
      },
      formules: await formulesPour(profil),
      // Un Pro sans échéance n'a rien à prolonger : la page ne lui vend rien.
      proIllimite: pro && droits?.pro?.jusqu_au === null,
    });
  } catch (err) {
    console.error("GET /api/offre:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
