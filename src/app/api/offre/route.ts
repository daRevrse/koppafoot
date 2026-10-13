import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  LIMITES_GRATUIT, aDroitAKoppaFootPlus, droitActif, estPro, estSansPub, jourDeLome, koppaFootPlusLeve, limitesEnVigueur,
  titresDuProfil, type CleLimite, type DroitAccorde,
} from "@/lib/offre";
import { compterUsage, lireDroits, lireLimitesDepuis, uidAppelant } from "@/lib/offre-server";
import { formulesPour } from "@/lib/paiement-serveur";

/**
 * GET /api/offre, ce que la page de l'offre affiche : KoppaFoot+ et « Pas de
 * pubs » (actifs ou non, jusqu'à quand), les limites de l'offre gratuite,
 * leur date d'entrée en vigueur, et ce que le compte utilise déjà.
 *
 * TOUT PART DE CE QUE LE COMPTE EST (lib/offre, titresDuProfil). `casquettes`
 * dit ses titres, `plus` si KoppaFoot+ lui est proposé, `leve` les plafonds
 * que son KoppaFoot+ lève aujourd'hui. Un joueur qui ne gère rien n'a ni
 * compteur ni KoppaFoot+ à lire.
 *
 * `formules` : ce que CE compte peut acheter, avec le prix et le droit
 * accordé. Vide tant que rien n'est en vente, et, en bac à sable, pour tout
 * autre qu'un superadmin.
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
    const titres = titresDuProfil(profil);
    const leve = Object.fromEntries(
      (Object.keys(LIMITES_GRATUIT) as CleLimite[]).map((cle) => [cle, pro && koppaFootPlusLeve(titres, cle)]),
    ) as Record<CleLimite, boolean>;
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
      casquettes: titres,
      plus: aDroitAKoppaFootPlus(titres),
      leve,
      formules: await formulesPour(profil, droits),
    });
  } catch (err) {
    console.error("GET /api/offre:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
