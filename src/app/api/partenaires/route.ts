import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  EMPLACEMENTS, aLAffiche, choisirAffiches, formatDe, jourDeLome, lienValide, typeDe,
  type EmplacementPartenaire, type FirestorePartenariat, type PartenaireAffiche,
} from "@/lib/partenaires";

/**
 * GET /api/partenaires?emplacement=competition&cid=<id>
 *
 * Ce qu'un emplacement montre : `{ partenaire, annonces }`. Un partenaire
 * seul s'il y en a un à l'affiche (il a payé l'exclusivité), sinon les
 * annonces qui s'y relaient, ou rien (voir lib/partenaires, `choisirAffiches`).
 * Public : il sert les pages que tout le monde lit, avec ou sans compte.
 *
 * PAR LE SERVEUR, ET PAS PAR LES RÈGLES FIRESTORE. Le document porte les
 * compteurs et le lien de destination, que le navigateur n'a pas à lire ; la
 * réponse n'en garde que ce que l'emplacement affiche. La collection reste
 * fermée aux clients (firestore.rules).
 *
 * MISE EN CACHE CINQ MINUTES, par adresse : une page de compétition lue mille
 * fois pendant une finale ne coûte qu'une lecture toutes les cinq minutes. La
 * rotation entre partenaires se fait donc par tranche de cinq minutes, pas à
 * chaque visite, ce qui suffit. L'ordre des annonces, lui, est tiré par le
 * navigateur à chaque affichage.
 *
 * Pas d'index composite : la requête ne filtre que sur l'emplacement, le reste
 * (actif, dates, compétition) se trie ici. La collection compte quelques
 * dizaines de documents au plus.
 */

type Doc = FirestorePartenariat & { id: string };

function affiche(p: Doc, cid: string | null): PartenaireAffiche {
  const format = formatDe(p);
  return {
    id: p.id,
    type: typeDe(p),
    annonceur: p.annonceur,
    accroche: p.accroche ?? null,
    format,
    imageUrl: p.image_url ?? null,
    // Le vertical n'a de sens que pour une bannière : un logo garde son encadré.
    imageVerticaleUrl: format === "banniere" ? p.image_verticale_url ?? null : null,
    cliquable: lienValide(p.lien) !== null,
    deLaCompetition: Boolean(cid && p.competition_id === cid),
  };
}

export async function GET(req: NextRequest) {
  const emplacement = req.nextUrl.searchParams.get("emplacement") as EmplacementPartenaire | null;
  const cid = req.nextUrl.searchParams.get("cid") || null;
  if (!emplacement || !EMPLACEMENTS.includes(emplacement)) {
    return NextResponse.json({ error: "Emplacement inconnu" }, { status: 400 });
  }

  try {
    const snap = await adminDb.collection("partenariats").where("emplacements", "array-contains", emplacement).get();
    const jour = jourDeLome();
    const candidats = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as FirestorePartenariat) }))
      .filter((p) => aLAffiche(p, jour))
      // Le partenaire d'une autre compétition n'a rien à faire ici.
      .filter((p) => !p.competition_id || p.competition_id === cid);

    const { partenaire, annonces } = choisirAffiches(candidats, cid, Math.random());
    return NextResponse.json(
      {
        partenaire: partenaire ? affiche(partenaire, cid) : null,
        annonces: annonces.map((a) => affiche(a, cid)),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    console.error("[partenaires GET]", err);
    // Un emplacement vide vaut mieux qu'une page en erreur.
    return NextResponse.json({ partenaire: null, annonces: [] });
  }
}
