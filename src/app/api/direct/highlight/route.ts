import { NextResponse } from "next/server";
import { getDirectFeed } from "@/lib/competition-admin";

/**
 * GET /api/direct/highlight, un match à pronostiquer par compétition locale.
 *
 * Uniquement les compétitions de la plateforme : `getDirectFeed` ne lit que
 * Firestore, donc rien de ce qui vient du fournisseur externe n'entre ici.
 * C'est voulu, on ne pronostique que les matchs qu'on gère, et un match de
 * football-data.org n'a même pas de page chez nous.
 *
 * Pour chaque compétition : le match en cours, sinon le prochain programmé,
 * sinon le dernier joué. Ce troisième cas garde la carte utile un jour creux :
 * elle montre alors le résultat du vote sur la dernière rencontre.
 *
 * Lecture serveur avec le SDK admin, donc lisible sans compte.
 */

export const revalidate = 60;

export async function GET() {
  try {
    const feed = await getDirectFeed(8);
    const dated = (m: { date: string | null }) => m.date ?? "";

    const highlights = feed.flatMap((entry) => {
      const ms = entry.matches;
      const live = ms.find((m) => m.status === "live");
      const next = ms
        .filter((m) => m.status === "scheduled" && m.date)
        .sort((a, b) => dated(a).localeCompare(dated(b)))[0];
      const last = ms
        .filter((m) => m.status === "completed")
        .sort((a, b) => dated(b).localeCompare(dated(a)))[0];

      const pick = live ?? next ?? last;
      if (!pick) return [];

      return [{
        id: pick.id,
        homeTeamName: pick.homeTeamName,
        awayTeamName: pick.awayTeamName,
        homeTeamLogo: pick.homeTeamLogo,
        awayTeamLogo: pick.awayTeamLogo,
        status: pick.status,
        scoreHome: pick.scoreHome,
        scoreAway: pick.scoreAway,
        competitionSlug: entry.competition.slug ?? null,
        competitionName: entry.competition.name,
      }];
    });

    return NextResponse.json({ highlights });
  } catch (err) {
    console.error("GET direct highlight failed:", err);
    return NextResponse.json({ highlights: [] });
  }
}
