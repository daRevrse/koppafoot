import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ficheDuClub } from "@/lib/fiche-club-serveur";

/**
 * GET /api/public/team/[id], la fiche publique d'une équipe.
 *
 * Même raison que pour les profils : `teams/{id}` est fermé aux visiteurs
 * dans firestore.rules. Plutôt que d'ouvrir la règle, on lit ici avec le SDK
 * admin et on ne renvoie qu'une projection en liste blanche.
 *
 * L'EFFECTIF EN FAIT PARTIE, DÉSORMAIS. Il en était sorti pour ne pas relier
 * des personnes entre elles sans qu'elles l'aient demandé — mais les mêmes
 * noms étaient déjà publics ailleurs, sur chaque composition de match et sur
 * l'effectif d'une équipe en compétition. La fiche du club était la seule à
 * les taire, et affichait « Effectif 14 » au-dessus de « Aucun joueur ». On
 * publie ce que la feuille de match montre déjà : le nom, le numéro, le poste,
 * la photo, et le lien vers la fiche publique de ceux qui ont un compte.
 * Jamais `member_ids` en tant que tel, ni un email, ni un téléphone, ni la
 * condition déclarée (blessé, suspendu), qui reste l'affaire du club.
 *
 * Le manager et son staff : leurs noms et leurs titres, comme la composition
 * d'un match montre déjà le manager (voir ./manager).
 */

export const revalidate = 300;

const PUBLIC_FIELDS = [
  "name", "city", "description", "slogan", "logo_url", "banner_url",
  "color", "level", "is_recruiting", "max_members",
  "achievements",
  "gallery_urls", "is_ghost",
  // Un nombre, pas une liste d'abonnés : un visiteur voyait « 0 abonné ».
  "followers_count",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ team: null }, { status: 404 });

  try {
    const snap = await adminDb.collection("teams").doc(id).get();
    if (!snap.exists) return NextResponse.json({ team: null }, { status: 404 });

    const data = snap.data() as Record<string, unknown>;
    const out: Record<string, unknown> = { id };
    for (const key of PUBLIC_FIELDS) {
      if (data[key] !== undefined) out[key] = data[key];
    }
    // Le nombre de membres est une information d'équipe.
    out.member_count = Array.isArray(data.member_ids) ? data.member_ids.length : 0;

    /**
     * LA FICHE SE CALCULE, ELLE NE SE LIT PLUS.
     *
     * Le bilan servait les quatre compteurs du document — `matches_played`,
     * `wins`, `draws`, `losses` —, et ils mentent : rien ne les décrémente
     * quand un match est supprimé, rien ne les rejoue quand un score est
     * corrigé après coup. Voir lib/bilan-club. L'effectif, les matchs et les
     * meilleurs joueurs se lisent désormais au même endroit, amicaux ET
     * compétitions (voir lib/fiche-club-serveur). La route revalide toutes
     * les cinq minutes, ces lectures ne se paient donc pas à chaque visiteur.
     */
    // Un adversaire hors plateforme n'a pas de fiche : la page le renvoie
    // ailleurs, inutile de tout lire pour lui.
    if (data.is_ghost === true) return NextResponse.json({ team: out });
    const fiche = await ficheDuClub(id, data);
    out.squad_count = fiche.effectif.length;
    out.matches_played = fiche.bilan.joues;
    out.wins = fiche.bilan.gagnes;
    out.draws = fiche.bilan.nuls;
    out.losses = fiche.bilan.perdus;
    out.goals_for = fiche.bilan.butsPour;
    out.goals_against = fiche.bilan.butsContre;
    out.clean_sheets = fiche.bilan.sansEncaisser;
    out.form = fiche.forme;
    out.effectif = fiche.effectif;
    out.manager = fiche.manager;
    out.staff = fiche.staff;
    out.matchs = fiche.matchs;
    out.competitions = fiche.competitions;
    out.meneurs = fiche.meneurs;
    return NextResponse.json({ team: out });
  } catch (err) {
    console.error("GET public team failed:", err);
    return NextResponse.json({ team: null }, { status: 500 });
  }
}
