import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { bilanDuClub } from "@/lib/bilan-club";

/**
 * GET /api/public/team/[id], la fiche publique d'une équipe.
 *
 * Même raison que pour les profils : `teams/{id}` est fermé aux visiteurs
 * dans firestore.rules. Plutôt que d'ouvrir la règle, on lit ici avec le SDK
 * admin et on ne renvoie qu'une projection en liste blanche.
 *
 * Ce qui n'en fait PAS partie : `member_ids` et `manager_id`. Un effectif est
 * une liste d'identifiants de comptes, et la publier permettrait de relier
 * des personnes entre elles sans qu'elles l'aient demandé. On publie ce qui
 * décrit l'équipe, pas qui la compose, le nombre de membres suffit à dire
 * si elle est complète.
 */

export const revalidate = 300;

const PUBLIC_FIELDS = [
  "name", "city", "description", "slogan", "logo_url", "banner_url",
  "color", "level", "is_recruiting", "max_members",
  "achievements",
  "gallery_urls", "is_ghost",
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
    // Le nombre de membres est une information d'équipe ; la liste ne l'est pas.
    out.member_count = Array.isArray(data.member_ids) ? data.member_ids.length : 0;

    /**
     * LE BILAN SE CALCULE, IL NE SE LIT PLUS.
     *
     * Cette route servait les quatre compteurs du document — `matches_played`,
     * `wins`, `draws`, `losses` —, et ils mentent : rien ne les décrémente
     * quand un match est supprimé, rien ne les rejoue quand un score est
     * corrigé après coup. Un club affichait ainsi 3 matchs joués et 1 victoire
     * pour un seul match terminé, et c'est la page PUBLIQUE qui le racontait.
     * Voir lib/bilan-club.
     *
     * Deux requêtes, et pas une de plus : un match nomme ses deux équipes dans
     * deux champs distincts, Firestore ne sait pas faire un OU entre eux. La
     * route revalide toutes les cinq minutes, ces lectures ne se paient donc
     * pas à chaque visiteur.
     */
    const [chezNous, chezEux] = await Promise.all([
      adminDb.collection("matches").where("home_team_id", "==", id).get(),
      adminDb.collection("matches").where("away_team_id", "==", id).get(),
    ]);
    const parId = new Map<string, FirebaseFirestore.DocumentData>();
    for (const d of [...chezNous.docs, ...chezEux.docs]) parId.set(d.id, d.data());

    const bilan = bilanDuClub(
      [...parId.values()].map((m) => ({
        status: String(m.status ?? ""),
        homeTeamId: (m.home_team_id as string) ?? null,
        awayTeamId: (m.away_team_id as string) ?? null,
        scoreHome: typeof m.score_home === "number" ? m.score_home : null,
        scoreAway: typeof m.score_away === "number" ? m.score_away : null,
      })),
      id,
    );
    out.matches_played = bilan.joues;
    out.wins = bilan.gagnes;
    out.draws = bilan.nuls;
    out.losses = bilan.perdus;
    out.goals_for = bilan.butsPour;
    out.goals_against = bilan.butsContre;

    return NextResponse.json({ team: out });
  } catch (err) {
    console.error("GET public team failed:", err);
    return NextResponse.json({ team: null }, { status: 500 });
  }
}
